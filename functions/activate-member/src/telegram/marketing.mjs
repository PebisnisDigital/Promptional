import {createHash} from 'node:crypto';
export const contentHash=p=>createHash('sha256').update(String(p?.prompt_text||'').normalize('NFKC').replace(/\s+/g,' ').trim()).digest('hex');
// Preview is optional: the Member Area also displays text-only published prompts.
// Delivery sends the image when it has a usable HTTPS preview, otherwise just text.
export function previewReady(p){return p?.is_published===true&&Boolean(p.prompt_text?.trim())}
import {fail} from './security.mjs';
import {telegramHtml} from './engagement.mjs';
import {DAY, jakartaDay} from './policy.mjs';

// This is the same table read by member.html and edited by the admin prompt library.
// The old `prompts` collection contains text-only UMKM templates, not member gallery items.
export const PROMPT_LIBRARY='scene_prompts';
const CTA_TYPES=new Set(['premium','member','url']);
const BASE='https://promptional.vercel.app';
const DEFAULT_OFFER='Suka prompt gratis hari ini? Buka seluruh koleksi PROMPTIONAL langsung di Member Area Premium. Bayar sekali melalui QRIS di website resmi, tanpa menunggu kiriman prompt Premium harian.';
const DEFAULT_SETTINGS=Object.freeze({enabled:false,loop_campaign:false,start_date:'',send_time:'06:00',timezone:'Asia/Jakarta',default_offer:DEFAULT_OFFER,default_cta_label:'BUKA PREMIUM',default_cta_type:'premium',default_cta_url:''});
const slotId=day=>'telegram-marketing-'+String(day).padStart(3,'0');
const trim=(v,max)=>String(v??'').trim().slice(0,max);
const validDay=day=>{const n=Number(day);if(!Number.isInteger(n)||n<1||n>365)throw fail('Hari harus antara 1 dan 365.',400);return n};
function validateUrl(url){
 try{
  const u=new URL(String(url));
  if(u.protocol!=='https:'||u.username||u.password||u.port||!['promptional.vercel.app','badaiprompt.vercel.app'].includes(u.hostname))throw Error('not allowed');
  if(url.length>500)throw Error('too long');
  return u.toString()
 }catch{throw fail('Tujuan CTA harus HTTPS pada domain resmi PROMPTIONAL.',400)}
}
const link=slot=>slot.cta_type==='member'?BASE+'/member':slot.cta_type==='premium'?BASE+'/beli-premium.html':validateUrl(slot.cta_url);
function sanitizeSettings(input,old=DEFAULT_SETTINGS){
 const s={...old};
 for(const key of ['start_date','send_time','default_offer','default_cta_label','default_cta_type','default_cta_url']){
  if(Object.hasOwn(input,key))s[key]=input[key];
 }
 if(typeof input.enabled==='boolean')s.enabled=input.enabled;
 if(typeof input.loop_campaign==='boolean')s.loop_campaign=input.loop_campaign;
 if(s.start_date!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(s.start_date))throw fail('Tanggal mulai tidak valid.');
 if(s.start_date){const date=Date.parse(s.start_date+'T00:00:00Z');if(!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==s.start_date)throw fail('Tanggal mulai tidak valid.');}
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.send_time))throw fail('Jam kirim WIB tidak valid.');
 s.timezone='Asia/Jakarta';
 s.default_offer=trim(s.default_offer,850);
 telegramHtml(s.default_offer,{max:850});
 s.default_cta_label=trim(s.default_cta_label,40);
 if(!CTA_TYPES.has(s.default_cta_type))throw fail('Tipe CTA tidak dikenal.');
 if(!s.default_offer||!s.default_cta_label)throw fail('Pesan penjualan dan tulisan tombol wajib diisi.');
 s.default_cta_url=s.default_cta_type==='url'?validateUrl(s.default_cta_url):'';
 if(s.enabled&&!s.start_date)throw fail('Isi tanggal mulai sebelum mengaktifkan jadwal.',409);
 return s;
}
export function campaignDay(startDate,now,loop=false){
 if(!startDate)return 0;
 const today=jakartaDay(now);
 const day=Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(startDate+'T00:00:00Z'))/DAY)+1;
 if(!Number.isFinite(day))return 0;
 return loop&&day>0?((day-1)%365)+1:day
}
export class Marketing{
 constructor(service){this.s=service}
 async config(){return sanitizeSettings((await this.s.store.state('telegram-marketing-settings'))?.data||{});}
 async overrides(){
  const result=[];let cursor;
  do{
   const page=await this.s.store.list('telegram_state',[['equal','kind','marketing_slot']],100,cursor);
   result.push(...page.rows);if(page.rows.length<100)break;
   cursor=page.rows.at(-1)?.$id;
  }while(result.length<365);
  return result.map(x=>({...JSON.parse(x.payload||'{}'),status:x.status,$id:x.$id})).sort((a,b)=>a.day-b.day);
 }
 async entries(){return (await this.overrides()).filter(x=>x.status==='scheduled')}
 async published(){
  const result=[];let cursor;
  do{
   const page=await this.s.store.list(PROMPT_LIBRARY,[['equal','is_published',true]],100,cursor);
   result.push(...page.rows);if(page.rows.length<100)break;
   cursor=page.rows.at(-1)?.$id;
  }while(result.length<5000);
  return result.filter(previewReady).sort((a,b)=>
   (Number(a.sort_order)||0)-(Number(b.sort_order)||0)||a.$id.localeCompare(b.$id));
 }
 async calendar(){
  const [library,overrides,settings]=await Promise.all([this.published(),this.overrides(),this.config()]);
  const byId=new Map(library.map(p=>[p.$id,p]));
  const byDay=new Map(overrides.map(x=>[x.day,x]));
  const reserved=new Set(overrides.filter(x=>x.status==='scheduled').map(x=>x.prompt_id));
  const remaining=library.filter(p=>!reserved.has(p.$id));
  const rotation=remaining;
  const slots=[];let next=0;
  for(let day=1;day<=365;day++){
   const saved=byDay.get(day);
   if(saved?.status==='empty')continue; // Admin deliberately left this day blank.
   const position=next;
   const prompt=saved?.status==='scheduled'?byId.get(saved.prompt_id):rotation.length?rotation[(next++)%rotation.length]:null;
   if(!prompt){
    if(saved?.status==='scheduled')slots.push({...saved,day,automatic:false,needs_review:true});
    continue;
   }
   const meta=saved?.status==='scheduled'?saved:settings;
   slots.push({day,source:PROMPT_LIBRARY,prompt_id:prompt.$id,title:prompt.title,
    category:prompt.category||'',preview_url:prompt.preview_url,
    offer_text:meta.offer_text??settings.default_offer,
    cta_label:meta.cta_label??settings.default_cta_label,
    cta_type:meta.cta_type??settings.default_cta_type,
    cta_url:meta.cta_url??settings.default_cta_url,
    automatic:!saved,repeat:!saved&&position>=rotation.length,needs_review:false});
  }
  return {library,slots,overrides,settings};
 }
 async get(){
  const {settings,slots,library}=await this.calendar();
  return {ok:true,settings,slots,library:library.map(p=>({source:PROMPT_LIBRARY,id:p.$id,title:p.title,category:p.category||'',preview_url:p.preview_url,summary:trim(p.prompt_text,145)})),stats:{filled:slots.filter(s=>!s.needs_review).length,empty:365-slots.length,target:365,published:library.length,active:settings.enabled&&this.s.marketingEnabled,campaign_day:campaignDay(settings.start_date,this.s.now(),settings.loop_campaign)},server_gate:Boolean(this.s.marketingEnabled),note:'Sumber konten sama dengan Member Area. Slot otomatis mengikuti prompt yang tayang; pengaturan kirim dan hapus tetap terpisah.'};
 }
 async candidates({source=PROMPT_LIBRARY}={}){
  if(source!==PROMPT_LIBRARY)throw fail('Semua prompt aktif berasal dari Member Area.',400);
  const library=await this.published();
  return {ok:true,rows:library.map(p=>({source,id:p.$id,title:p.title,category:p.category||'',preview_url:p.preview_url,summary:trim(p.prompt_text,145)})),total:library.length,next_cursor:null};
 }
 async saveSettings(input,actor){
  const prev=await this.config(),updated=sanitizeSettings(input,prev);
  // Admin cannot arm a new sender just by toggling a form. Requires explicit server flag.
  if(updated.enabled&&!this.s.marketingEnabled)throw fail('Jadwal tersimpan sebagai DRAF. Pengiriman perlu izin server terpisah.',409);
  if(updated.enabled&&!prev.enabled){const system=await this.s.config();if(!this.s.sendEnabled||!system.enabled||system.paused||system.dry_run)throw fail('Aktifkan bot utama dan nonaktifkan dry-run setelah QA sebelum menjadwalkan.',409);}
  await this.s.store.putState('telegram-marketing-settings',updated,{kind:'marketing_settings',status:updated.enabled?'active':'draft',user_id:actor});
  return {ok:true,settings:updated};
 }
 validateSlot(body,base){
  const day=validDay(body.day),source=String(body.source||PROMPT_LIBRARY),prompt_id=String(body.prompt_id||'');
  if(source!==PROMPT_LIBRARY||!prompt_id||prompt_id.length>80)throw fail('Pilih prompt valid dari Member Area.');
  const offer_text=trim(body.offer_text??base.default_offer,850),cta_label=trim(body.cta_label??base.default_cta_label,40);
  const cta_type=String(body.cta_type||base.default_cta_type),cta_url=String((body.cta_url??base.default_cta_url)||'').trim();
  if(!offer_text||!cta_label||!CTA_TYPES.has(cta_type))throw fail('Lengkapi pesan upselling dan tombol CTA.');
  telegramHtml(offer_text,{max:850});
  const data={day,source,prompt_id,offer_text,cta_label,cta_type,cta_url:cta_type==='url'?validateUrl(cta_url):''};
  link(data);return data;
 }
 async save(body,actor){
  const [settings,entries]=await Promise.all([this.config(),this.entries()]);
  const data=this.validateSlot(body,settings),prompt=await this.s.store.get(data.source,data.prompt_id);
  if(!previewReady(prompt))throw fail('Prompt harus tayang dan memiliki teks.',409);
  if(entries.some(x=>x.day!==data.day&&x.source===data.source&&x.prompt_id===data.prompt_id))throw fail('Prompt sudah ada di hari lain. Hindari pengulangan pada kalender.',409);
  const payload={...data,title:trim(prompt.title,128),category:trim(prompt.category,128),preview_url:prompt.preview_url,fingerprint:contentHash(prompt),updated_at:new Date(this.s.now()).toISOString(),updated_by:actor};
  await this.s.store.putState(slotId(data.day),payload,{kind:'marketing_slot',status:'scheduled',user_id:actor});
  return {ok:true,slot:payload}
 }
 async remove(day,actor){
  day=validDay(day);
  const row=await this.s.store.get('telegram_state',slotId(day));
  if(row?.status==='empty')return {ok:true,already_empty:true};
  await this.s.store.putState(slotId(day),{day},{kind:'marketing_slot',status:'empty',user_id:actor});
  return {ok:true};
 }
 async move(from,to,actor){
  from=validDay(from);to=validDay(to);
  if(from===to)return {ok:true,unchanged:true};
  const {slots}=await this.calendar(),fromSlot=slots.find(x=>x.day===from),toSlot=slots.find(x=>x.day===to);
  if(!fromSlot||fromSlot.needs_review)throw fail('Slot sumber kosong atau membutuhkan review.',409);
  const leftKey=slotId(from),rightKey=slotId(to);
  await this.s.store.transaction(async tx=>{
   const [left,right]=await Promise.all([tx.state(leftKey),tx.state(rightKey)]);
   const payload=(slot,day)=>JSON.stringify({...slot,day,automatic:undefined,needs_review:undefined,updated_at:new Date(this.s.now()).toISOString(),updated_by:actor});
   const write=async(key,old,slot,day)=>{
    const value={kind:'marketing_slot',status:slot?'scheduled':'empty',payload:slot?payload(slot,day):JSON.stringify({day}),user_id:actor};
    return old?tx.update('telegram_state',key,value):tx.put(key,JSON.parse(value.payload),{kind:value.kind,status:value.status,user_id:actor});
   };
   await write(rightKey,right,fromSlot,to);
   await write(leftKey,left,toSlot,from);
  });
  return {ok:true,from,to};
 }
 async previewTestSlot(day){
  day=validDay(day);
  const {slots}=await this.calendar(),data=slots.find(s=>s.day===day);
  if(!data||data.needs_review)throw fail('Hari '+day+' belum memiliki prompt tayang yang siap dikirim.',409);
  const prompt=await this.s.store.get(PROMPT_LIBRARY,data.prompt_id);
  if(!previewReady(prompt))throw fail('Prompt sudah tidak tayang atau teks kosong.',409);
  const cta={text:data.offer_text,label:data.cta_label,url:link(data)};
  return {day,source:PROMPT_LIBRARY,prompt_id:prompt.$id,offer:cta,title:prompt.title,fingerprint:contentHash(prompt)};
 }
 async forFree(now){
  const s=await this.config();
  if(!this.s.marketingEnabled||!s.enabled)return null;
  const day=campaignDay(s.start_date,now,s.loop_campaign);
  if(day<1)return {skip:true,reason:'Kampanye belum dimulai',day};
  if(day>365)return {skip:true,reason:'Kampanye 365 hari telah berakhir',day};
  const {slots}=await this.calendar(),data=slots.find(s=>s.day===day);
  if(!data||data.needs_review)return {skip:true,reason:'Belum ada prompt tayang untuk hari '+day,day};
  const prompt=await this.s.store.get(PROMPT_LIBRARY,data.prompt_id);
  if(!previewReady(prompt))return {skip:true,reason:'Prompt hari '+day+' tidak lagi tayang atau teks kosong',day};
  const elapsed=campaignDay(s.start_date,now,false);
  const cycle=s.loop_campaign?Math.floor((elapsed-1)/365):0;
  return {day,prompt:{...prompt,content_source:PROMPT_LIBRARY,marketing_day:day,marketing_cycle:cycle,marketing_offer:{text:data.offer_text,label:data.cta_label,url:link(data)}}};
 }
}
export {DEFAULT_SETTINGS,validateUrl,slotId};
