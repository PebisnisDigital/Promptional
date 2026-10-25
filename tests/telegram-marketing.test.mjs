import test from 'node:test';
import assert from 'node:assert/strict';
import {Marketing,campaignDay,validateUrl,slotId,previewImages} from '../functions/activate-member/src/telegram/marketing.mjs';
import {contentHash} from '../functions/activate-member/src/telegram/marketing.mjs';
import fs from 'node:fs';

const NOW=Date.parse('2026-10-10T02:00:00Z');
const p=(id='p1')=>({$id:id,title:'Contoh '+id,category:'Foto AI',is_published:true,prompt_text:'Prompt unik untuk '+id,preview_url:'https://example.com/'+id+'.webp'});
function setup({globalSend=false}={}){
 const db=new Map(),changes=[],sources=new Map([['p1',p('p1')],['p2',p('p2')],['p3',p('p3')]]);
 const store={
  async get(table,key){if(table==='scene_prompts'||table==='prompts')return sources.get(key)||null;return db.get(key)||null},
  async state(key){const row=db.get(key);return row?{...row,data:JSON.parse(row.payload||'{}')}:null},
  async list(table,filters=[],limit=50,cursor){
   const rows=table==='telegram_state'?[...db.values()]:[...sources.values()];
   let list=rows.filter(row=>filters.every(([op,key,value])=>op==='equal'?row[key]===value:true)).sort((a,b)=>a.$id.localeCompare(b.$id));
   if(cursor){const idx=list.findIndex(x=>x.$id===cursor);list=list.slice(idx+1)}
   return {rows:list.slice(0,limit).map(x=>({...x})),total:list.length};
  },
  async putState(key,data,meta={}){
   const row={$id:key,kind:meta.kind||'settings',status:meta.status||'ready',payload:JSON.stringify(data),...meta};
   db.set(key,row);changes.push(['put',key]);return row
  },
  async transaction(fn){
   const clone=new Map([...db.entries()].map(([k,v])=>[k,{...v}]));
   const tx={
    async state(key){const row=clone.get(key);return row?{...row,data:JSON.parse(row.payload||'{}')}:null},
    async update(table,key,payload){if(!clone.has(key))throw Error('not found');clone.set(key,{...clone.get(key),...payload})},
    async put(key,data,meta){clone.set(key,{$id:key,payload:JSON.stringify(data),...meta})}
   };
   const res=await fn(tx);db.clear();for(const [k,v] of clone.entries())db.set(k,v);
   return res
  }
 };
 const s={store,now:()=>NOW,sendEnabled:globalSend,main:async()=>({is_active:true})};
 const marketing=new Marketing(s);
 return {marketing,store,db,changes,sources};
}
test('global WIB campaign day honors start date and optional loop',()=>{
 assert.equal(campaignDay('2026-10-10',Date.parse('2026-10-09T16:59:59Z')),0);
 assert.equal(campaignDay('2026-10-10',Date.parse('2026-10-09T17:00:00Z')),1);
 assert.equal(campaignDay('2026-10-10',Date.parse('2026-10-10T18:00:00Z')),2);
 assert.equal(campaignDay('2026-10-10',Date.parse('2027-10-08T17:00:00Z')),365);
 assert.equal(campaignDay('2026-10-10',Date.parse('2027-10-09T17:00:00Z')),366);
 assert.equal(campaignDay('2026-10-10',Date.parse('2027-10-09T17:00:00Z'),true),1);
});
test('all published prompts enter the library, but the calendar starts empty and cannot arm delivery',async()=>{
 const x=setup();const original=await x.marketing.get();
 assert.equal(original.server_gate,false);
 assert.equal(original.stats.filled,0);
 assert.equal(original.stats.empty,365);
 assert.equal(original.stats.published,3);
 assert.equal(original.stats.unscheduled,3);
 assert.deepEqual(original.slots,[]);
 await assert.rejects(()=>x.marketing.saveSettings({enabled:true,start_date:'2026-10-10'},'admin'),/DRAF/);
 const saved=await x.marketing.saveSettings({enabled:false,start_date:'2026-10-10',send_time:'06:00',loop_campaign:true},'admin');
 assert.equal(saved.settings.loop_campaign,true);
 assert.equal(saved.settings.enabled,false);
 assert.equal(saved.settings.delete_hours,24);
 await assert.rejects(()=>x.marketing.saveSettings({delete_hours:37},'admin'),/1–36/);
 await assert.rejects(()=>x.marketing.saveSettings({delete_hours:0},'admin'),/1–36/);
 const edited=await x.marketing.saveSettings({delete_hours:18},'admin');assert.equal(edited.settings.delete_hours,18);
});
test('calendar saves references only to real published Member Area prompts',async()=>{
 const x=setup();
 const saved=await x.marketing.save({day:1,source:'scene_prompts',prompt_id:'p1',offer_text:'Upgrade Premium untuk akses 365 hari.',cta_type:'premium',cta_label:'BUKA PREMIUM'},'admin');
 assert.equal(saved.slot.title,'Contoh p1');
 assert.equal(saved.slot.fingerprint,contentHash(p('p1')));
 assert.equal((await x.marketing.get()).slots[0].day,1);
 assert.equal((await x.marketing.get()).slots[0].cta_label,'BUKA PREMIUM');
 assert.equal((await x.marketing.get()).stats.unscheduled,2);
 await assert.rejects(()=>x.marketing.save({day:366,source:'scene_prompts',prompt_id:'p2'},'admin'),/Hari/);
 await assert.rejects(()=>x.marketing.save({day:2,source:'scene_prompts',prompt_id:'p1'},'admin'),/sudah ada di hari lain/);
 await assert.rejects(()=>x.marketing.save({day:2,source:'scene_prompts',prompt_id:'missing'},'admin'),/tayang/);
});
test('admin preview uses actual escaped Telegram chunks without sending or changing calendar',async()=>{
 const x=setup();x.sources.get('p1').prompt_text='Perintah AI <produk> & hasil akhir';
 const writesBefore=x.changes.length;
 const content=await x.marketing.previewContent({source:'scene_prompts',prompt_id:'p1'});
 assert.equal(content.prompt.id,'p1');
 assert.equal(content.prompt.caption,'Contoh p1');
 assert.equal(content.prompt.preview_url,'https://example.com/p1.webp');
 assert.deepEqual(content.prompt.images,['https://example.com/p1.webp']);
 assert.deepEqual(content.prompt.chunks,['<pre>Perintah AI &lt;produk&gt; &amp; hasil akhir</pre>']);
 assert.equal(content.prompt.length,[...'Perintah AI <produk> & hasil akhir'].length);
 assert.equal(x.changes.length,writesBefore);
 await assert.rejects(()=>x.marketing.previewContent({source:'prompts',prompt_id:'p1'}),/Member Area/);
 x.sources.get('p2').is_published=false;
 await assert.rejects(()=>x.marketing.previewContent({prompt_id:'p2'}),/tidak lagi diterbitkan/);
});
test('Telegram gallery matches Member Area ordering, file ID priority, deduplication and four-slot limit',async()=>{
 const x=setup(),prompt=x.sources.get('p1');
 Object.assign(prompt,{preview_file_id:'bp/photo 1',preview_url:'https://example.com/unused.webp',preview_url_2:'https://example.com/two.webp',preview_url_3:'https://example.com/two.webp',preview_url_4:'https://example.com/four.webp'});
 const images=previewImages(prompt);
 assert.deepEqual(images,[
  'https://sgp.cloud.appwrite.io/v1/storage/buckets/prompt-previews/files/bp%2Fphoto%201/view?project=badai-prompt-umkm',
  'https://example.com/two.webp','https://example.com/four.webp'
 ]);
 const preview=await x.marketing.previewContent({prompt_id:'p1'});
 assert.deepEqual(preview.prompt.images,images);
 assert.equal(preview.prompt.preview_url,images[0]);
 assert.equal((await x.marketing.get()).library.find(p=>p.id==='p1').preview_url,images[0]);
 prompt.preview_url_3='http://insecure.invalid/third.webp';
 assert.equal(previewImages(prompt).length,3);
});
test('moving a calendar slot swaps atomically and clears source for empty target',async()=>{
 const x=setup();for(const [day,id] of [[1,'p1'],[2,'p2'],[3,'p3']])await x.marketing.save({day,source:'scene_prompts',prompt_id:id},'admin');
 await x.marketing.move(1,2,'admin');
 assert.deepEqual((await x.marketing.get()).slots.map(x=>[x.day,x.prompt_id]),[[1,'p2'],[2,'p1'],[3,'p3']]);
 await x.marketing.move(2,10,'admin');
 assert.deepEqual((await x.marketing.get()).slots.map(x=>[x.day,x.prompt_id]),[[1,'p2'],[3,'p3'],[10,'p1']]);
 await x.marketing.remove(3,'admin');
 assert.deepEqual((await x.marketing.get()).slots.map(x=>x.day),[1,10]);
 assert.equal((await x.marketing.get()).stats.empty,363);
});
test('custom CTA is limited to verified HTTPS site and never Telegram in-chat QRIS',()=>{
 assert.equal(validateUrl('https://promptional.vercel.app/beli-premium.html'),'https://promptional.vercel.app/beli-premium.html');
 assert.equal(validateUrl('https://badaiprompt.vercel.app/#harga'),'https://badaiprompt.vercel.app/#harga');
 for(const url of ['https://evil.example/checkout','http://badaiprompt.vercel.app','javascript:alert(1)','https://user:pass@badaiprompt.vercel.app/','#harga','https://badaiprompt.vercel.app:444/'])
  assert.throws(()=>validateUrl(url),/tujuan|Tujuan/);
});
test('Free campaign reads live published prompt from Member Area and picks up edits',async()=>{
 const x=setup({globalSend:true});
 await x.marketing.saveSettings({enabled:true,start_date:'2026-10-10',send_time:'06:00'},'admin');
 assert.match((await x.marketing.forFree(NOW)).reason,/Belum ada prompt/);
 await x.marketing.save({day:1,source:'scene_prompts',prompt_id:'p1'},'admin');
 let chosen=await x.marketing.forFree(NOW);assert.equal(chosen.prompt.$id,'p1');
 assert.equal(chosen.prompt.marketing_offer.url,'https://promptional.vercel.app/beli-premium.html');
 assert.ok(chosen.prompt.marketing_offer.text.length>15);
 x.sources.get('p1').prompt_text='changed after scheduling';
 assert.equal((await x.marketing.forFree(NOW)).prompt.prompt_text,'changed after scheduling');
});
test('WIB send time holds delivery until scheduled clock, then releases one selected prompt',async()=>{
 const x=setup({globalSend:true});
 await x.marketing.saveSettings({enabled:true,start_date:'2026-10-10',send_time:'11:00'},'admin');
 await x.marketing.save({day:1,source:'scene_prompts',prompt_id:'p1'},'admin');
 const before=await x.marketing.forFree(NOW);
 assert.equal(before.skip,true);
 assert.match(before.reason,/Jam kirim/);
 assert.equal(before.next_send_at,'2026-10-10T04:00:00.000Z');
 assert.equal((await x.marketing.forFree(Date.parse(before.next_send_at))).prompt.$id,'p1');
});
test('new published prompts enter library but never schedule themselves or leak drafts',async()=>{
 const x=setup();
 x.sources.get('p2').is_published=false;
 let result=await x.marketing.get();
 assert.deepEqual(result.slots,[]);
 assert.equal(result.stats.unscheduled,2);
 x.sources.set('p4',{...p('p4'),sort_order:4});
 result=await x.marketing.get();
 assert.deepEqual(result.slots,[]);
 assert.equal(result.library.length,3);
 assert.equal(result.stats.unscheduled,3);
 await assert.rejects(()=>x.marketing.previewTestSlot(3),/belum memiliki prompt/);
 await x.marketing.save({day:3,source:'scene_prompts',prompt_id:'p4'},'admin');
 assert.equal((await x.marketing.previewTestSlot(3)).prompt_id,'p4');
 await assert.rejects(()=>x.marketing.candidates({source:'prompts'}),/Member Area/);
 await assert.rejects(()=>x.marketing.save({day:4,source:'prompts',prompt_id:'p1'},'admin'),/Member Area/);
 await x.marketing.remove(2,'admin');
 assert.deepEqual((await x.marketing.get()).slots.map(s=>s.day),[3]);
});
test('unpublished scheduled prompt is flagged for review instead of being silently replaced',async()=>{
 const x=setup();await x.marketing.save({day:8,source:'scene_prompts',prompt_id:'p2'},'admin');
 x.sources.get('p2').is_published=false;
 const view=await x.marketing.get();
 assert.equal(view.slots.length,1);
 assert.equal(view.slots[0].needs_review,true);
 assert.equal(view.stats.filled,0);
 assert.equal(view.stats.empty,364);
 assert.equal(view.stats.unscheduled,2);
});
test('backend and Admin share a single server safety gate and calendar control',()=>{
 const m=fs.readFileSync(new URL('../functions/activate-member/src/telegram/runtime.mjs',import.meta.url),'utf8');
 const d=fs.readFileSync(new URL('../assets/admin-marketing.js',import.meta.url),'utf8');
 const h=fs.readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 assert.match(m,/TELEGRAM_SEND_ENABLED==='true'/);
 assert.doesNotMatch(m,/TELEGRAM_MARKETING_ENABLED/);
 assert.match(h,/id="v-marketing"/);
 assert.match(h,/id="mktCalendar"/);
 assert.match(h,/id="mktEditOffer"/);
 assert.match(h,/id="mktLoop"/);
 assert.match(h,/id="mktDeleteHours"/);
 assert.doesNotMatch(h,/id="tgSettingsForm"/);
 assert.match(d,/addEventListener\('drop'/);
 assert.match(d,/request\('marketing-slot-save'/);
});
