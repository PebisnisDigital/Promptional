(()=>{
 const $=id=>document.getElementById(id);
 if(!$('v-marketing'))return;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dayName=n=>{
  if(!state?.settings?.start_date)return 'Tanggal belum diatur';
  const date=new Date(state.settings.start_date+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()+n-1);
  return date.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 };
  let state=null,loaded=false,busy=false,page=0,selectedPrompt=null,selectedDay=null,editing=null,candidates=[],draggingSlotDay=null;
 async function request(action,body={}){
  const {jwt}=await account.createJWT();
  const response=await fetch('/api/telegram/manager',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',authorization:'Bearer '+jwt},body:JSON.stringify({action,...body}),cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Permintaan gagal.');
  return data;
 }
 function notice(message,tone='info'){const el=$('mktNotice');el.textContent=message;el.dataset.tone=tone}
 function lock(v){busy=Boolean(v);$('v-marketing').querySelectorAll('button').forEach(b=>{if(v){b.dataset.wasDisabled=String(b.disabled);b.disabled=true}else{b.disabled=b.dataset.wasDisabled==='true';delete b.dataset.wasDisabled}})}
 async function act(work){if(busy)return;lock(true);try{await work()}catch(e){notice(e.message||'Permintaan gagal.','error')}finally{lock(false)}}
 function settingsForm(){
  const s=state.settings;
  $('mktStartDate').value=s.start_date||'';
  $('mktTime').value=s.send_time||'06:00';
  $('mktDeleteHours').value=s.delete_hours??24;
  $('mktLoop').checked=s.loop_campaign===true;
  $('mktEnabled').value=String(Boolean(s.enabled));
  $('mktEnabled').querySelector('option[value="true"]').disabled=!state.server_gate;
  $('mktDefaultOffer').value=s.default_offer||'';
  $('mktDefaultLabel').value=s.default_cta_label||'BUKA PREMIUM';
  $('mktDefaultType').value=s.default_cta_type||'premium';
  $('mktDefaultUrl').value=s.default_cta_url||'';
  $('mktGate').textContent=state.server_gate?(s.enabled?'Jadwal AKTIF. Konten terisi akan dikirim pada jam dan tanggal yang ditetapkan.':'Jadwal DRAF. Semua pengiriman rutin ditahan; penghapusan kiriman terdahulu tetap berjalan.'):'Pengiriman server belum tersedia. Kalender tersimpan sebagai DRAF.';
  $('mktDefaultUrl').disabled=$('mktDefaultType').value!=='url';
 }
 function statistics(){
  const filled=state.stats.filled;
  const cards=[
   [state.settings.enabled&&state.server_gate?'AKTIF':'DRAF','Status jadwal'],
    [filled+'/365','Hari terjadwal manual'],
    [state.stats.empty,'Hari kosong'],
    [availablePrompts().length,'Tersisa di perpustakaan'],
    [state.stats.published??candidates.length,'Total prompt terbit']
  ];
  $('mktStats').innerHTML=cards.map(([n,label])=>'<div class="mkt-stat"><b>'+escape(n)+'</b><span>'+escape(label)+'</span></div>').join('');
 }
 const slots=()=>new Map((state?.slots||[]).map(s=>[s.day,s]));
 const promptKey=p=>p.source+':'+(p.id||p.prompt_id);
 const availablePrompts=()=>{
  const scheduled=new Set((state?.slots||[]).filter(s=>!s.needs_review).map(promptKey));
  return candidates.filter(p=>!scheduled.has(promptKey(p)));
 };
 function captureCard(el){
  return el?{rect:el.getBoundingClientRect(),clone:el.cloneNode(true)}:null;
 }
 function capturePrompt(prompt){
  const key=promptKey(prompt);
  return captureCard([...$('mktPromptList').querySelectorAll('[data-mkt-prompt]')].find(el=>el.dataset.mktPrompt===key));
 }
 function animateTransfer(origin,target,arrivalClass){
  if(!target)return;
  target.classList.add(arrivalClass);
  target.addEventListener('animationend',()=>target.classList.remove(arrivalClass),{once:true});
  if(!origin||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const from=origin.rect,to=target.getBoundingClientRect();
  if(from.bottom<0||from.top>innerHeight||to.bottom<0||to.top>innerHeight)return;
  const ghost=origin.clone;
  ghost.removeAttribute('draggable');ghost.removeAttribute('data-mkt-prompt');ghost.removeAttribute('data-mkt-day');
  ghost.querySelector('button')?.remove();
  ghost.classList.add('mkt-transfer-ghost');
  Object.assign(ghost.style,{left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px'});
  document.body.appendChild(ghost);
  const dx=to.left+to.width/2-from.left-from.width/2,dy=to.top+to.height/2-from.top-from.height/2;
  const scale=Math.min(.65,to.width/from.width);
  const animation=ghost.animate([
   {transform:'translate3d(0,0,0) scale(1)',opacity:.94},
   {transform:'translate3d('+dx+'px,'+dy+'px,0) scale('+scale+')',opacity:.08}
  ],{duration:550,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
  void animation.finished.then(()=>ghost.remove(),()=>ghost.remove());
 }
 function updateBoard(){statistics();renderCalendar();renderCandidates()}
 function renderCalendar(){
  const source=slots(),first=page*30+1,last=Math.min(365,first+29);
  $('mktPage').innerHTML=Array.from({length:13},(_,i)=>{const f=1+i*30,l=Math.min(365,f+29);return '<option value="'+i+'">Bagian '+(i+1)+' · Hari '+f+'–'+l+'</option>'}).join('');
  $('mktPage').value=String(page);
  $('mktPrev').disabled=page===0;
  $('mktNext').disabled=last===365;
  $('mktPageCount').textContent=first+'–'+last+' dari 365';
  let html='';
  for(let day=first;day<=last;day++){
   const slot=source.get(day),on=selectedDay===day,empty=!slot;
   html+='<button type="button" class="mkt-day '+(empty?'empty':'')+'" aria-selected="'+on+'" data-mkt-day="'+day+'" '+(slot?'draggable="true"':'')+' aria-label="Hari '+day+', '+escape(slot?slot.title:'kosong')+'">'+
     '<span>HARI</span><strong>'+day+'</strong><small>'+escape(slot?slot.title:dayName(day))+'</small>'+
     (slot?'<span class="mkt-pill">'+(slot.needs_review?'! PERLU REVIEW':'● TERJADWAL')+'</span>':'<small>+ TARUH PROMPT</small>')+'</button>';
  }
  $('mktCalendar').innerHTML=html;
  if(selectedDay){
   const slot=source.get(selectedDay);
   $('mktDayDetail').textContent='Hari '+selectedDay+' · '+dayName(selectedDay)+' · '+(slot?'Terisi: '+slot.title:'Belum ada konten.')+(selectedPrompt?' Prompt dipilih: '+selectedPrompt.title:'');
  }else $('mktDayDetail').textContent='Seret prompt dari perpustakaan ke hari kosong untuk langsung menyimpannya. Di HP, pilih prompt lalu ketuk hari dan simpan.';
  document.querySelectorAll('[data-mkt-day]').forEach(el=>{
   el.addEventListener('click',()=>chooseDay(Number(el.dataset.mktDay)));
   el.addEventListener('dragstart',e=>{
    const day=Number(el.dataset.mktDay);
    if(!source.has(day)){e.preventDefault();return}
    draggingSlotDay=day;
    el.classList.add('is-dragging');
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain','slot:'+day);
   });
   el.addEventListener('dragend',()=>{draggingSlotDay=null;el.classList.remove('is-dragging');$('mktLibraryPanel').classList.remove('drop-target')});
   el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drop-target')});
   el.addEventListener('dragleave',()=>el.classList.remove('drop-target'));
   el.addEventListener('drop',e=>{
    e.preventDefault();el.classList.remove('drop-target');
    const payload=e.dataTransfer.getData('text/plain'),target=Number(el.dataset.mktDay);
    if(payload.startsWith('slot:'))return void move(Number(payload.split(':')[1]),target);
     if(payload.startsWith('prompt:')){
     const parts=payload.split(':'),prompt=candidates.find(x=>x.source===parts[1]&&x.id===parts[2]);
     if(prompt)void assignPrompt(target,prompt);
    }
   });
  });
 }
 function renderCandidates(){
  const q=$('mktSearch').value.trim().toLowerCase();
  const available=availablePrompts();
  const filtered=available.filter(p=>[p.title,p.category,p.summary].join(' ').toLowerCase().includes(q));
  $('mktLibraryCount').textContent=available.length+' tersedia · '+(candidates.length-available.length)+' dijadwalkan';
  $('mktPromptList').innerHTML=filtered.length?filtered.map(p=>{
   const yes=selectedPrompt?.id===p.id&&selectedPrompt?.source===p.source;
   return '<div class="mkt-prompt" draggable="true" data-mkt-prompt="'+escape(p.source+':'+p.id)+'" data-selected="'+yes+'">'+
     (p.preview_url?'<img src="'+escape(p.preview_url)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<span class="mkt-prompt-placeholder">TEKS</span>')+
    '<div class="mkt-prompt-meta"><strong>'+escape(p.title)+'</strong><p>'+escape(p.category||'Prompt visual')+'</p><small class="mkt-prompt-schedule">SIAP DIJADWALKAN</small><button type="button" class="btn dark" data-mkt-pick="'+escape(p.source+':'+p.id)+'">'+(yes?'DIPILIH ✓':'PILIH PROMPT')+'</button></div></div>';
  }).join(''):'<p class="mkt-empty">'+(available.length?'Tidak ada prompt yang cocok. Coba kata pencarian lain.':'Semua prompt terbit sudah masuk kalender. Kosongkan hari untuk mengembalikan prompt ke sini.')+'</p>';
  $('mktLoadMore').hidden=true;
  document.querySelectorAll('[data-mkt-prompt]').forEach(el=>el.addEventListener('dragstart',e=>{
   el.classList.add('is-dragging');
   e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','prompt:'+el.dataset.mktPrompt);
  }));
  document.querySelectorAll('[data-mkt-prompt]').forEach(el=>el.addEventListener('dragend',()=>el.classList.remove('is-dragging')));
  document.querySelectorAll('[data-mkt-pick]').forEach(el=>el.addEventListener('click',()=>{
   selectedPrompt=candidates.find(x=>x.source+':'+x.id===el.dataset.mktPick);
   $('mktSelection').textContent=selectedPrompt?selectedPrompt.title+' dipilih':'Belum memilih prompt';
   renderCandidates();renderCalendar();notice('Prompt dipilih. Klik salah satu hari di kalender untuk mengatur pesan dan CTA.','success');
  }));
 }
  function loadCandidates(){
   candidates=state?.library||[];
   if(selectedPrompt&&!availablePrompts().some(p=>promptKey(p)===promptKey(selectedPrompt)))selectedPrompt=null;
   renderCandidates();
  }
 function chooseDay(day){
  selectedDay=day;
  const slot=slots().get(day);
  editing=selectedPrompt||slot||null;
  renderCalendar();
  if(!editing){
   $('mktEditor').hidden=true;
   notice('Hari '+day+' kosong. Pilih prompt dari perpustakaan terlebih dahulu.');
   return;
  }
  $('mktEditor').hidden=false;
  $('mktEditDay').textContent=String(day);
  $('mktEditorPrompt').textContent='PROMPT: '+editing.title+' · '+dayName(day)+(slot&&selectedPrompt?' (akan menggantikan '+slot.title+')':'');
  $('mktEditOffer').value=selectedPrompt?(state.settings.default_offer||''):(slot?.offer_text||state.settings.default_offer);
  $('mktEditLabel').value=selectedPrompt?state.settings.default_cta_label:(slot?.cta_label||state.settings.default_cta_label);
  $('mktEditType').value=selectedPrompt?state.settings.default_cta_type:(slot?.cta_type||state.settings.default_cta_type);
  $('mktEditUrl').value=selectedPrompt?state.settings.default_cta_url:(slot?.cta_url||state.settings.default_cta_url);
  $('mktDeleteSlot').disabled=!slot;
  refreshMock();
  $('mktEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 async function assignPrompt(day,prompt){
  const previous=slots().get(day);
  if(previous&&previous.prompt_id!==prompt.id&&!confirm('Ganti prompt yang sudah dijadwalkan untuk hari '+day+'?'))return;
  const origin=capturePrompt(prompt);
  await act(async()=>{
   await request('marketing-slot-save',{day,source:prompt.source,prompt_id:prompt.id,
    offer_text:state.settings.default_offer,cta_label:state.settings.default_cta_label,
    cta_type:state.settings.default_cta_type,cta_url:state.settings.default_cta_url});
   state=await request('marketing-get');selectedPrompt=null;selectedDay=day;editing=null;
   $('mktEditor').hidden=true;$('mktSelection').textContent='Belum memilih prompt';
   updateBoard();animateTransfer(origin,document.querySelector('[data-mkt-day="'+day+'"]'),'mkt-day-arrived');
   notice(prompt.title+' berpindah ke hari '+day+'. Perpustakaan otomatis berkurang satu.','success');
  });
 }
 async function returnToLibrary(day){
  const existing=slots().get(day);
  if(!existing||!confirm('Kembalikan prompt hari '+day+' ke perpustakaan? Jadwal hari ini akan dikosongkan.'))return;
  const origin=captureCard(document.querySelector('[data-mkt-day="'+day+'"]'));
  await act(async()=>{
   await request('marketing-slot-delete',{day});
   state=await request('marketing-get');selectedPrompt=null;editing=null;
   $('mktEditor').hidden=true;$('mktSelection').textContent='Belum memilih prompt';
   updateBoard();
   const returned=[...$('mktPromptList').querySelectorAll('[data-mkt-prompt]')].find(el=>el.dataset.mktPrompt===promptKey(existing));
   animateTransfer(origin,returned||$('mktLibraryCount'),returned?'mkt-prompt-arrived':'mkt-library-arrived');
   notice('Prompt hari '+day+' kembali ke perpustakaan. Hari tersebut sekarang kosong.','success');
  });
 }
 function refreshMock(){
  $('mktMockContent').textContent='🖼 '+(editing?.title||'PROMPT')+'\n\nIsi prompt lengkap yang dipilih dari Member Area akan dikirim terlebih dahulu.';
  $('mktMockOffer').textContent=$('mktEditOffer').value+'\n\nPesan gratis dihapus setelah '+Number($('mktDeleteHours')?.value||24)+' jam (sesuai Pengaturan jadwal).';
  $('mktMockButton').textContent=($('mktEditLabel').value||'BUKA PREMIUM')+' ↗';
  $('mktEditUrl').disabled=$('mktEditType').value!=='url';
 }
 async function move(from,to){
  if(from===to)return;
  await act(async()=>{
   await request('marketing-slot-move',{from,to});
   const updated=await request('marketing-get');state=updated;
   selectedDay=to;selectedPrompt=null;
   updateBoard();notice('Konten dari hari '+from+' berhasil '+(slots().has(from)?'ditukar':'dipindahkan')+' ke hari '+to+'.','success');
  });
 }

 async function loadTesters(){
  const selector=$('mktTestUser'),old=selector.value;
  try{
   const overview=await request('overview');
   const main=overview.settings?.main_bot_id;
   const tests=(overview.testers||[]).filter(x=>x.bot_id===main);
   selector.innerHTML='<option value="">'+(tests.length?'Pilih penguji Telegram':'Belum ada tester. Atur akun penguji di tab BOT')+'</option>'+
     tests.map(x=>'<option value="'+escape(x.telegram_id)+'">Tester Telegram •••'+escape(String(x.telegram_id).slice(-4))+'</option>').join('');
   if(tests.some(x=>String(x.telegram_id)===old))selector.value=old;
   $('mktTestButton').disabled=!tests.length;
  }catch(e){selector.innerHTML='<option value="">Penguji tidak dapat dimuat</option>';$('mktTestButton').disabled=true;$('mktTestStatus').textContent='Gagal membaca daftar tester: '+(e.message||'Server tidak tersedia');}
 }
 $('mktTestForm').addEventListener('submit',e=>{
  e.preventDefault();
  const day=Number($('mktTestDay').value),telegram_id=$('mktTestUser').value;
  if(!telegram_id||!Number.isInteger(day)||day<1||day>365){$('mktTestStatus').textContent='Pilih hari terisi dan akun tester yang sudah diotorisasi.';return;}
  if(!state?.slots?.some(slot=>slot.day===day)){$('mktTestStatus').textContent='Hari '+day+' masih kosong. Simpan promptnya dulu.';return;}
  if(!confirm('Kirim gambar, prompt dan upselling hari '+day+' HANYA ke akun Telegram penguji? Ini akan mengirim pesan sungguhan.'))return;
  void act(async()=>{
   $('mktTestStatus').textContent='Mengirim kiriman tes ke Telegram…';
   const request_id=crypto.randomUUID();
   const result=await request('marketing-test-send',{day,telegram_id,request_id});
   $('mktTestStatus').textContent=result.status==='sent'?
     'Tes hari '+day+' berhasil dikirim. Periksa gambar, prompt, dan tombol CTA di Telegram penguji. Pesan tercatat untuk penghapusan.':
     'Kiriman belum sepenuhnya berhasil (status: '+result.status+'). Periksa pengiriman sebelum mencoba lagi.';
   notice(result.status==='sent'?'Pengiriman ke akun tester berhasil. Tidak ada broadcast ke member.':'Periksa hasil tes Marketing: '+result.status,result.status==='sent'?'success':'error');
  });
 });
 async function refresh(){
  state=await request('marketing-get');
  settingsForm();statistics();renderCalendar();
  await loadTesters();
   loadCandidates();statistics();loaded=true;
   notice('Perpustakaan sinkron: '+state.stats.published+' prompt tayang. '+state.stats.filled+' hari dijadwalkan manual; hari kosong tidak mengirim. Status '+(state.settings.enabled&&state.server_gate?'aktif':'draf')+'.','success');
 }
 $('mktPage').addEventListener('change',e=>{page=Number(e.target.value);renderCalendar()});
 $('mktPrev').addEventListener('click',()=>{page=Math.max(0,page-1);renderCalendar()});
 $('mktNext').addEventListener('click',()=>{page=Math.min(12,page+1);renderCalendar()});
 $('mktSearch').addEventListener('input',renderCandidates);
 $('mktRefresh').addEventListener('click',()=>void act(refresh));
 $('mktDefaultType').addEventListener('change',()=>{$('mktDefaultUrl').disabled=$('mktDefaultType').value!=='url'});
 $('mktDeleteHours').addEventListener('input',refreshMock);
 $('mktSettingsForm').addEventListener('submit',e=>{e.preventDefault();void act(async()=>{
  const body={start_date:$('mktStartDate').value,send_time:$('mktTime').value,delete_hours:Number($('mktDeleteHours').value),enabled:$('mktEnabled').value==='true',loop_campaign:$('mktLoop').checked,default_offer:$('mktDefaultOffer').value,default_cta_label:$('mktDefaultLabel').value,default_cta_type:$('mktDefaultType').value,default_cta_url:$('mktDefaultUrl').value};
  if(body.enabled&&!state.settings.enabled&&!confirm('AKTIFKAN kalender 365 hari? Konten yang sudah dijadwalkan akan dikirim otomatis ke member Free sesuai tanggal dan jam WIB.'))return;
  const r=await request('marketing-settings',body);state.settings=r.settings;settingsForm();statistics();renderCalendar();
  notice(body.enabled?'Kalender AKTIF. Hanya hari terisi yang dikirim pada jadwal WIB.':'Kalender DRAF tersimpan. Tidak ada kiriman rutin.','success');
 })});
 $('mktEditForm').addEventListener('submit',e=>{e.preventDefault();void act(async()=>{
  if(!selectedDay||!editing)throw Error('Pilih hari dan prompt dahulu.');
  const origin=selectedPrompt?capturePrompt(selectedPrompt):null;
  const assigned=Boolean(selectedPrompt);
  const body={day:selectedDay,source:editing.source,prompt_id:editing.id||editing.prompt_id,offer_text:$('mktEditOffer').value,cta_label:$('mktEditLabel').value,cta_type:$('mktEditType').value,cta_url:$('mktEditUrl').value};
  await request('marketing-slot-save',body);
  selectedPrompt=null;editing=null;$('mktEditor').hidden=true;
  state=await request('marketing-get');updateBoard();
  if(assigned)animateTransfer(origin,document.querySelector('[data-mkt-day="'+selectedDay+'"]'),'mkt-day-arrived');
  $('mktSelection').textContent='Belum memilih prompt';
  notice('Hari '+selectedDay+' disimpan! Preview dan tombol CTA mengikuti pengaturan hari tersebut.','success');
 })});
 $('mktCloseEditor').addEventListener('click',()=>{$('mktEditor').hidden=true;editing=null});
 $('mktDeleteSlot').addEventListener('click',()=>{if(selectedDay)void returnToLibrary(selectedDay)});
 const libraryPanel=$('mktLibraryPanel');
 libraryPanel.addEventListener('dragover',e=>{
  if(!draggingSlotDay)return;
  e.preventDefault();e.dataTransfer.dropEffect='move';libraryPanel.classList.add('drop-target');
 });
 libraryPanel.addEventListener('dragleave',e=>{
  if(!libraryPanel.contains(e.relatedTarget))libraryPanel.classList.remove('drop-target');
 });
 libraryPanel.addEventListener('drop',e=>{
  libraryPanel.classList.remove('drop-target');
  if(!draggingSlotDay)return;
  e.preventDefault();const day=draggingSlotDay;draggingSlotDay=null;
  void returnToLibrary(day);
 });
 ['mktEditOffer','mktEditLabel','mktEditType','mktEditUrl'].forEach(id=>$(id).addEventListener('input',refreshMock));
 document.querySelector('[data-tg-tab="content"]')?.addEventListener('click',()=>{if(!loaded)void act(refresh)});
})();
