let playwright;try{playwright=require('playwright')}catch{playwright=require('/opt/codex/runtimes/cua/lib/node_modules/playwright')}
const {chromium}=playwright,fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),output=process.env.UI_ARTIFACTS||path.join(root,'work/telegram/ui');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='playwright'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 async function local(page){await page.route('https://badaiprompt.vercel.app/**',r=>{const u=new URL(r.request().url());let p=u.pathname==='/'?'/index.html':u.pathname;if(['/admin','/member'].includes(p))p+='.html';const f=root+p;return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});await page.route('https://sgp.cloud.appwrite.io/**',r=>r.abort());await page.route('https://fonts.googleapis.com/**',r=>r.abort())}
 const fixture=fs.readFileSync(path.join(root,'tests/fixtures/workspace-appwrite.js'),'utf8').replace('class Account{','class Account{async createJWT(){return {jwt:"verified-test-session"}} async create(input){window.mockCalls.push({mutation:"account",...input});return {$id:"test-member",...input}} ');
 const bot={$id:'tg_'+ 'a'.repeat(32),name:'Bot simulasi',username:'TestBadaiBot',bot_user_id:'123456',status:'connected',has_token:true,last_test_at:'2026-10-09T10:00:00Z',webhook_url:'https://badaiprompt.vercel.app/api/telegram/webhook?bot=test'};
 for(const width of [1280,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.type()==='prompt'?d.accept('HAPUS BOT'):d.accept());await local(page);await page.route('**/assets/vendor/appwrite-28.1.0.js',r=>r.fulfill({body:fixture,contentType:'application/javascript'}));
  let shouldFail=false,emptyMembers=true,sendEnabled=false;
  await page.route('**/api/telegram/manager',async r=>{const p=r.request().postDataJSON();requests.push({body:p,authorization:r.request().headers().authorization});if(shouldFail){shouldFail=false;return r.fulfill({status:503,json:{error:'Telegram belum dapat dihubungi.'}})}let data={ok:true};if(p.action==='overview')data={ok:true,bots:[bot],settings:{enabled:false,paused:true,dry_run:true,premium_time:'06:00',free_days:3,premium_days:1,delete_hours:24,term_days:365,batch_size:5,main_bot_id:bot.$id},stats:{users:4,free:2,premium:2,active:1,expired:1,today:3,sent:8,failed:1,deleted:2,blocked:1},errors:[{status:'uncertain',error:'Perlu diperiksa',at:'2026-10-09'}],members:emptyMembers?[]:[{telegram_id:'777',first_name:'Penguji'}],testers:[],prompts:[{id:'published',title:'Prompt asli'}],send_enabled:sendEnabled};if(p.action==='telegram-orders-list')data={ok:true,orders:[{id:'tg_'+'a'.repeat(32),channel:'bot',status:'activated',is_test:true,telegram_id:'777',display_name:'Penguji',telegram_username:'penguji',invoice_id:'SANDBOX-77',amount:199000,plan:'premium',paid_at:'2026-10-11T00:00:00Z',created_at:'2026-10-11T00:00:00Z',access_until:'2027-10-11T00:00:00Z'}],total:1,next_cursor:null};if(p.action==='telegram-buyers-list')data={ok:true,members:[{telegram_id:'777',first_name:'Penguji',username:'penguji',plan:'premium',is_active:true,appwrite_linked:true,premium_until:'2027-10-11T00:00:00Z',tester_authorized:false,can_reset:false}],total:1,next_cursor:null};if(p.action==='save')data={ok:true,bot};if(p.action==='prepare-switch')data={ok:true,confirmation:'one-use-confirmation',started_members:1};if(p.action==='test-message'||p.action==='test-prompt')data={ok:true,delivery_id:'test-delivery',message_ids:['101']};await r.fulfill({json:data})});
  await page.goto('https://badaiprompt.vercel.app/admin');await page.waitForFunction(()=>!document.getElementById('loading').classList.contains('show'));await page.locator('[data-view=marketing]').click();await page.locator('[data-tg-tab=bot]').click();await page.waitForFunction(()=>document.getElementById('tgStats').children.length===10);assert.equal(await page.locator('#tgStats strong').first().innerText(),'4');assert.match(await page.locator('#tgBotInfo').innerText(),/Tersimpan terenkripsi/);assert.equal(await page.locator('#tgToken').inputValue(),'');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#tgAuthorizeTester').isDisabled(),true);assert.equal(await page.locator('[data-tg-test=test-message]').isDisabled(),true);assert.match(await page.locator('#tgTesterHelp').innerText(),/Belum ada akun penguji/);assert.equal(await page.locator('#tgStartBot').getAttribute('href'),'https://t.me/TestBadaiBot');emptyMembers=false;await page.locator('#tgRefresh').click();await page.waitForFunction(()=>document.getElementById('tgTester').options.length===2);
  await page.screenshot({path:path.join(output,'telegram-admin-'+width+'.png'),fullPage:true});
  await page.locator('#tgToken').fill('123456:FAKE_TEST_TOKEN_DO_NOT_USE_1234567890');await page.locator('#tgBotForm button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('tgStatus').textContent.includes('Bot tersimpan'));assert.equal(await page.locator('#tgToken').inputValue(),'');assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/token|telegram/i.test(k))),false);
  await page.locator('[data-tg-action=connection]').click();await page.waitForFunction(()=>document.getElementById('tgStatus').textContent.includes('selesai'));
  shouldFail=true;await page.locator('[data-tg-action=webhook]').click();await page.waitForFunction(()=>document.getElementById('tgStatus').textContent.includes('belum dapat dihubungi'));assert.equal(await page.locator('[data-tg-action=webhook]').isEnabled(),true);
  await page.locator('#tgActivate').click();await page.waitForFunction(()=>document.getElementById('tgStatus').textContent.includes('Bot utama berhasil'));const activation=requests.find(x=>x.body.action==='activate');assert.equal(activation.body.confirmation,'one-use-confirmation');
  await page.locator('#tgTester').selectOption('777');assert.equal(await page.locator('[data-tg-test=test-message]').isDisabled(),true);sendEnabled=true;await page.locator('#tgRefresh').click();await page.waitForFunction(()=>document.getElementById('tgTester').value==='777'&&!document.querySelector('[data-tg-test=test-message]').disabled);assert.equal(await page.locator('#tgTester').inputValue(),'777');await page.locator('#tgPrompt').selectOption('published');await page.locator('#tgAuthorizeTester').click();await page.waitForFunction(()=>document.getElementById('tgStatus').textContent.includes('diotorisasi'));
  await page.locator('[data-tg-test=test-prompt]').click();await page.waitForFunction(()=>document.getElementById('tgStatus').textContent.includes('berhasil dikirim'));await page.locator('#tgTestDelete').click();await page.waitForFunction(()=>document.getElementById('tgStatus').textContent.includes('berhasil dihapus'));assert.equal(requests.find(x=>x.body.action==='test-delete').body.delivery_id,'test-delivery');assert(requests.every(x=>x.authorization==='Bearer verified-test-session'));
  assert.deepStrictEqual(errors,[]);await page.close();console.log('Telegram admin '+width+' PASS: layout, real-data rendering, token clearing, JWT, connection/error, switch confirmation, test prompt/delete. Simulated.');
 }
 const member=await browser.newPage({viewport:{width:390,height:900}});await local(member);await member.route('**/assets/vendor/appwrite-28.1.0.js',r=>r.fulfill({body:fixture,contentType:'application/javascript'}));await member.route('**/api/telegram/link',r=>{assert.equal(r.request().headers().authorization,'Bearer verified-test-session');return r.fulfill({json:{ok:true,url:'https://t.me/TestBadaiBot?start=link_simulated',expires_in:600}})});await member.goto('https://badaiprompt.vercel.app/member');await member.waitForFunction(()=>!document.getElementById('loading').classList.contains('show'));await member.locator('[data-mode="account"]').click();await member.locator('#tgLinkBtn').click();await member.locator('#tgLinkOpen').waitFor({state:'visible'});assert.match(await member.locator('#tgLinkOpen').getAttribute('href'),/^https:\/\/t.me\//);assert.match(await member.locator('#tgLinkMsg').innerText(),/10 menit/);await member.screenshot({path:path.join(output,'telegram-member-link.png')});await member.close();
 console.log('Member linking PASS: verified-session request, one-use deep link and expiry. Simulated.');
 // The landing page now embeds the real Premium checkout instead of exposing a
 // second, obsolete checkout form. Payment mutations are covered by API tests.
 const landing=await browser.newPage({viewport:{width:390,height:900}});await local(landing);
 await landing.goto('https://badaiprompt.vercel.app/');
 assert.equal(await landing.locator('#premiumCheckoutFrame').getAttribute('src'),'/beli-premium?embed=1');
 assert.equal(await landing.locator('#daftar.premium-registration').count(),1);
 await landing.close();console.log('Landing page PASS: Premium registration uses one embedded checkout.');
 // Marketing calendar: isolated browser simulation, no real messages or DB mutations.
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),pageErrors=[],calls=[],slots=new Map();
  page.on('pageerror',e=>pageErrors.push(e.message));page.on('dialog',dialog=>dialog.accept());await local(page);
  await page.route('https://example.com/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="290"><rect width="400" height="290" fill="#f6e9e6"/><circle cx="200" cy="110" r="60" fill="#f5a47a"/><text x="200" y="230" font-size="24" text-anchor="middle" fill="#362b30">PROMPTIONAL</text></svg>'}));
  await page.route('**/assets/vendor/appwrite-28.1.0.js',r=>r.fulfill({body:fixture,contentType:'application/javascript'}));
  let marketingSettings={enabled:false,loop_campaign:false,start_date:'2026-10-10',send_time:'06:00',delete_hours:24,timezone:'Asia/Jakarta',
    default_offer:'Suka prompt ini? Buka semua prompt Premium Rp199.000.',default_cta_label:'BUKA PREMIUM',default_cta_type:'premium',default_cta_url:''};
  const library=[
   {source:'scene_prompts',id:'p1',title:'BP001 • Foto Editorial',category:'Foto',preview_url:'https://example.com/p1.jpg',summary:'Prompt visual pertama'},
   {source:'scene_prompts',id:'p2',title:'BP002 • Poster Produk',category:'Bisnis',preview_url:'https://example.com/p2.jpg',summary:'Prompt visual kedua'}
  ];
  await page.route('**/api/telegram/manager',async route=>{
   const body=route.request().postDataJSON();calls.push(body);
   let reply={ok:true};
   if(body.action==='overview')reply={ok:true,bots:[],settings:{main_bot_id:'test-main-bot',enabled:false,paused:true,dry_run:true,premium_time:'06:00',free_days:1,premium_days:1,delete_hours:24,term_days:365,batch_size:5},stats:{},errors:[],members:[],prompts:[],send_enabled:false,testers:[{bot_id:'test-main-bot',telegram_id:'778812345'}]};
   if(body.action==='marketing-test-send')reply={ok:true,status:'sent',test:true,day:body.day,delivery_id:'test_delivery'};
   if(body.action==='marketing-preview'){
    const chosen=library.find(p=>p.id===body.prompt_id),sample='Isi prompt LENGKAP untuk '+(chosen?.title||'prompt')+' <produk> & AI.';
    reply={ok:true,prompt:{id:chosen.id,title:chosen.title,preview_url:chosen.preview_url,caption:chosen.title,fallback_title:chosen.title,chunks:['<pre>'+sample.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</pre>'],length:sample.length}};
   }
   if(body.action==='marketing-get')reply={ok:true,settings:marketingSettings,slots:[...slots.values()],library,stats:{filled:slots.size,empty:365-slots.size,target:365,published:library.length,unscheduled:library.length-slots.size,active:false,campaign_day:1},server_gate:false};
   if(body.action==='marketing-slot-save'){const item={...body,title:body.prompt_id==='p1'?'BP001 • Foto Editorial':'BP002 • Poster Produk'};slots.set(body.day,item);reply={ok:true,slot:item}}
   if(body.action==='marketing-slot-delete')slots.delete(body.day);
   if(body.action==='marketing-slot-move'){
     const from=slots.get(body.from),to=slots.get(body.to);
     slots.delete(body.from);if(to)slots.set(body.from,{...to,day:body.from});
     slots.set(body.to,{...from,day:body.to});
   }
   if(body.action==='marketing-settings'){marketingSettings={...marketingSettings,...body};reply={ok:true,settings:marketingSettings}}
   await route.fulfill({json:reply});
  });
  await page.goto('https://badaiprompt.vercel.app/admin');
  await page.waitForFunction(()=>!document.getElementById('loading').classList.contains('show'));
  await page.locator('[data-view="marketing"]').click();
  await page.locator('[data-tg-tab="content"]').click();
  await page.locator('#mktPromptList .mkt-prompt').first().waitFor();
  assert.match(await page.locator('#mktStats').innerText(),/0\/365/);
  assert.match(await page.locator('#mktPromptList').innerText(),/SIAP DIJADWALKAN/);
  assert.equal(await page.locator('#mktEnabled option[value="true"]').evaluate(el=>el.disabled),true);
  await page.locator('[data-mkt-pick="scene_prompts:p1"]').click();
  await page.locator('[data-mkt-day="1"]').click();
  await page.locator('#mktPreviewMessages pre').waitFor();
  assert.match(await page.locator('#mktPreviewMessages').innerText(),/Isi prompt LENGKAP/);
  assert.equal(await page.locator('#mktPreviewMessages .mkt-tg-photo').count(),1);
  assert.match(await page.locator('#mktPreviewChecks').innerText(),/Perubahan belum disimpan/);
  await page.locator('#mktEditOffer').fill('Coba prompt ini, lalu buka Premium Rp199.000 untuk 365 hari.');
  await page.locator('#mktEditLabel').fill('UPGRADE SEKARANG');
  assert.match(await page.locator('#mktPreviewMessages').innerText(),/Coba prompt ini/);
  assert.equal(await page.locator('#mktPreviewMessages .mkt-tg-button').innerText(),'UPGRADE SEKARANG ↗');
  assert.equal(await page.locator('#mktPreviewMessages .mkt-tg-button').getAttribute('href'),'https://promptional.vercel.app/beli-premium.html');
  await page.locator('#mktEditForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.getElementById('mktNotice').textContent.includes('disimpan'));
  await page.locator('#mktPreviewChecks').getByText('Konten sesuai jadwal tersimpan').waitFor();
  assert.match(await page.locator('[data-mkt-day="1"]').innerText(),/Foto Editorial/);
  assert.equal(slots.get(1).cta_label,'UPGRADE SEKARANG');
  assert.equal(await page.locator('#mktPromptList .mkt-prompt').count(),1);
  assert.equal(await page.locator('[data-mkt-prompt="scene_prompts:p1"]').count(),0);
  assert.match(await page.locator('#mktLibraryCount').innerText(),/1 tersedia · 1 dijadwalkan/);
  assert.equal(await page.locator('#mktStats .mkt-stat').nth(3).locator('b').innerText(),'1');
  if(width===1280){
   await page.locator('[data-mkt-prompt="scene_prompts:p2"]').dragTo(page.locator('[data-mkt-day="3"]'));
   await page.waitForFunction(()=>document.getElementById('mktNotice').textContent.includes('berpindah ke hari 3'));
   assert.equal(slots.get(3).prompt_id,'p2');
   assert.equal(await page.locator('#mktPromptList .mkt-prompt').count(),0);
   assert.match(await page.locator('#mktPromptList').innerText(),/Semua prompt terbit sudah masuk kalender/);
   assert.match(await page.locator('#mktLibraryCount').innerText(),/0 tersedia · 2 dijadwalkan/);
   await page.locator('[data-mkt-day="1"]').dragTo(page.locator('[data-mkt-day="2"]'));
   await page.waitForFunction(()=>/dipindahkan|ditukar/.test(document.getElementById('mktNotice').textContent));
   assert.match(await page.locator('[data-mkt-day="2"]').innerText(),/Foto Editorial/);
   assert.equal(slots.get(2).prompt_id,'p1');
   assert.equal(await page.locator('#mktPromptList .mkt-prompt').count(),0);
  }
  const dayToTest=width===1280?2:1;
  await page.locator('#mktTestDay').fill(String(dayToTest));
  await page.locator('#mktTestUser').selectOption('778812345');
  await page.locator('#mktTestButton').click();
  await page.waitForFunction(()=>document.getElementById('mktTestStatus').textContent.includes('berhasil dikirim'));
  const sends=calls.filter(x=>x.action==='marketing-test-send');
  assert.equal(sends.length,1);
  assert.equal(sends[0].day,dayToTest);
  assert.equal(sends[0].telegram_id,'778812345');
  assert.equal(marketingSettings.enabled,false);
  await page.locator('#mktLoop').check();
  await page.locator('#mktDeleteHours').fill('18');
  await page.locator('#mktSettingsForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.getElementById('mktNotice').textContent.includes('Kalender DRAF tersimpan'));
  assert.equal(marketingSettings.loop_campaign,true);
  assert.equal(marketingSettings.delete_hours,18);
  assert.equal(marketingSettings.enabled,false);
  if(width===1280){
   await page.locator('[data-mkt-day="3"]').dragTo(page.locator('#mktLibraryPanel'));
   await page.waitForFunction(()=>document.getElementById('mktNotice').textContent.includes('kembali ke perpustakaan'));
   assert.equal(slots.has(3),false);
   assert.equal(await page.locator('[data-mkt-prompt="scene_prompts:p2"]').count(),1);
   assert.equal(await page.locator('[data-mkt-prompt="scene_prompts:p1"]').count(),0);
   assert.match(await page.locator('#mktLibraryCount').innerText(),/1 tersedia · 1 dijadwalkan/);
  }else{
   await page.locator('[data-mkt-day="1"]').click();
   await page.locator('#mktDeleteSlot').click();
   await page.waitForFunction(()=>document.getElementById('mktNotice').textContent.includes('kembali ke perpustakaan'));
   assert.equal(slots.has(1),false);
   assert.equal(await page.locator('#mktPromptList .mkt-prompt').count(),2);
   assert.match(await page.locator('#mktLibraryCount').innerText(),/2 tersedia · 0 dijadwalkan/);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert(calls.filter(x=>x.action?.startsWith('marketing-')).every(x=>x.action!=='marketing-broadcast'));
  assert.deepStrictEqual(pageErrors,[]);
  await page.screenshot({path:path.join(output,'marketing-calendar-'+width+'.png'),fullPage:true});
  await page.close();
  console.log('Marketing Admin '+width+' PASS: Free calendar, prompt select, upsell CTA editor, draft settings'+(width===1280?', drag-and-drop':'')+'. Simulated.');
 }

 // Independent Premium checkout: mock the current form API without a real order.
 for(const enabled of [false,true]){
  const p=await browser.newPage({viewport:{width:390,height:900}}),errors=[],calls=[];
  p.on('pageerror',e=>errors.push(e.message));await local(p);
  await p.route('**/api/form-checkout**',async r=>{
   const action=new URL(r.request().url()).searchParams.get('action');calls.push(action);
   if(action==='config')return r.fulfill({json:{registration_open:enabled,payment_active:enabled,payment_configured:enabled,test_mode:false,price:199000}});
   if(action==='create')return r.fulfill({json:{success:true,public_token:'a'.repeat(48),status:'pending',qr_url:'data:image/png;base64,iVBORw0KGgo=',total_amount:199000,expires_at:new Date(Date.now()+900000).toISOString()}});
   return r.fulfill({json:{status:'pending',access_ready:false}});
  });
  await p.route('**/assets/vendor/appwrite-28.1.0.js',r=>r.fulfill({body:fixture,contentType:'application/javascript'}));
  await p.goto('https://badaiprompt.vercel.app/beli-premium.html');
  if(enabled){
   await p.locator('#fullName').fill('Pembeli Simulasi');await p.locator('#whatsapp').fill('081234567890');await p.locator('#email').fill('checkout@example.com');
   await p.locator('#payButton').click();
   await p.locator('#paymentStage:not([hidden])').waitFor();
   assert.match(await p.locator('#qrTotal').innerText(),/199.000/);
   assert(calls.includes('create'));
  }else{
   await p.waitForFunction(()=>document.getElementById('payButton').disabled);
   assert.match(await p.locator('#status').innerText(),/belum siap dibuka/);
   assert.equal(calls.includes('create'),false);
  }
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepStrictEqual(errors,[]);
  await p.screenshot({path:path.join(output,'website-premium-'+(enabled?'logged-in-qr-test':'disabled-fallback')+'.png')});
  await p.close();
 }
 console.log('Independent website Buy Premium PASS: gated fallback and mocked QRIS display, mobile 390px. All simulated.');

 // Telegram Login-only QA: no QRIS, no Appwrite purchases, no member updates.
 for(const mode of ['disabled','ready','verified']){
  const p=await browser.newPage({viewport:{width:390,height:830}}),errors=[],calls=[];
  p.on('pageerror',e=>errors.push(e.message));
  await local(p);
  await p.route('**/api/website-login**',r=>{
   const action=new URL(r.request().url()).searchParams.get('action');calls.push(action);
   if(action==='config')return r.fulfill({json:{ok:true,enabled:mode!=='disabled'}});
   if(action==='session')return r.fulfill({json:mode==='verified'?{ok:true,authenticated:true,name:'Tester Terverifikasi'}:{ok:true,authenticated:false}});
   return r.abort();
  });
  await p.route('**/api/website-checkout**',r=>{
   const action=new URL(r.request().url()).searchParams.get('action');calls.push('checkout:'+action);
   if(action==='preflight')return r.fulfill({json:{
    ok:true,telegram_verified:true,provider_ready:true,identity_linked:true,
    account_exists:false,account_check_pending:true,account_permission_ready:false,
    missing_appwrite_scopes:['users.read'],premium_already_active:false,account_review_needed:false,
    safe_to_test:false,merchant_test_mode:false,checkout_enabled:false,
    bot_notice_enabled:false,price:199000
   }});
   return r.abort();
  });
  await p.goto('https://badaiprompt.vercel.app/uji-login-telegram.html');
  await p.waitForFunction(()=>!document.getElementById('status').textContent.includes('Memeriksa konfigurasi'));
  const status=await p.locator('#status').innerText();
  if(mode==='disabled'){assert.match(status,/belum aktif/);assert.equal(await p.locator('#login').isHidden(),true);}
  if(mode==='ready'){assert.match(status,/Klik tombol/);assert.equal(await p.locator('#login').isVisible(),true);assert.match(await p.locator('#login').getAttribute('href'),/return=test/);}
  if(mode==='verified'){assert.match(status,/BERHASIL/);assert.match(status,/Tester Terverifikasi/);assert.equal(await p.locator('#login').isHidden(),true);}
  assert.deepStrictEqual(calls,['config','session']);
  if(mode==='verified'){
   await p.locator('#checkQris').click();
   await p.waitForFunction(()=>document.getElementById('qrisReadiness').textContent.includes('LIVE (RIIL)'));
   assert.match(await p.locator('#qrisReadiness').innerText(),/Merchant QRIS Rp199.000: TERKONFIGURASI/);
   assert.match(await p.locator('#qrisReadiness').innerText(),/Checkout QRIS baru: BELUM DIAKTIFKAN/);
   assert.match(await p.locator('#qrisReadiness').innerText(),/Akses baca akun Appwrite: PERLU IZIN users.read/);
   assert.match(await p.locator('#qrisReadiness').innerText(),/Pemeriksaan akun: BELUM BISA DIPASTIKAN/);
   assert.deepStrictEqual(calls,['config','session','checkout:preflight']);
  }else{
   assert.equal(await p.locator('#checkQris').isHidden(),true);
  }
  assert.deepStrictEqual(errors,[]);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.close();
 }
 console.log('Telegram OIDC Login-only page PASS: safe disabled state, first-login action and verified identity. No payment calls. Simulated.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
