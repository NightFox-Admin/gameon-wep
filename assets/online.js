/* GameOn online: odalar, lobi (Hazır mısın?), sıra/hamle aktarımı, puanlar, arkadaşlar. Sunucu: gameon-server */
(function(){
const A=window.GameOnAPI,MAXP={batak:4,uno:4,okey:4,amiral:2,mangala:2,dortdortluk:2,tavla:2,dama:2,ludo:4},ONLINE=['mangala','okey','tavla','dortdortluk','dama','ludo','amiral','uno','batak'];
const NOTE={short:'Oyun çok kısa sürdü: puan verilmedi',pair:'Aynı oyuncularla günlük puan sınırı doldu',cap:'Günlük puan sınırına ulaştın'};
let fails=0,room=null,seat=0,pollT=null,seq=0,rdy=false,pend=[],q=Promise.resolve(),cg=null,myPw={},poll_busy=false;
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const gname=id=>(GAMES.find(g=>g.id===id)||{}).name||id,av=a=>'profil/'+(a||'profil1')+'.webp',pn=p=>p.username?'@'+p.username:(p.first_name||'Oyuncu');
const css=document.createElement('style');css.textContent=`
.rfilters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.rfilters select,.rfilters input{background:var(--bg-card);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:9px 10px;font:700 13px system-ui;min-width:0;flex:1 1 120px}
.rfilters button{background:linear-gradient(90deg,#1d4ed8,#3b82f6);border:0;color:#fff;border-radius:10px;padding:9px 16px;font:800 13px system-ui;cursor:pointer}
.rrow{display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--border2);border-radius:14px;padding:10px 12px;margin-bottom:8px;cursor:pointer}.rrow:active{transform:scale(.98)}
.rrow img{width:42px;height:42px;border-radius:50%;object-fit:cover}.rmid{flex:1;min-width:0}.rname{font-weight:900;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rgame{font-size:12px;color:var(--text-muted);font-weight:700}
.rcnt{font:900 16px ui-monospace,monospace;color:var(--accent2);background:rgba(59,130,246,.15);border-radius:10px;padding:6px 10px}.rempty{color:var(--text-muted);text-align:center;padding:30px 10px;font-weight:700}
#lobby{position:fixed;inset:0;z-index:450;background:radial-gradient(ellipse at 50% 0,#13265a,#050a18 70%);display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;overflow-y:auto}#lobby.on{display:flex}
#lobby h2{font-size:22px;font-weight:900}.lcode{font:900 20px ui-monospace,monospace;letter-spacing:3px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:8px 14px}
.lpl{width:100%;max-width:360px}.lp{display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--border2);border-radius:14px;padding:9px 12px;margin-bottom:8px;font-weight:800}.lp img{width:38px;height:38px;border-radius:50%}.lp .ck{margin-left:auto;font-size:20px}.lp.empty{opacity:.45}
#lobby .bt{width:100%;max-width:360px;border:0;border-radius:14px;padding:13px;font:900 16px system-ui;color:#fff;background:linear-gradient(90deg,#1d4ed8,#3b82f6);cursor:pointer}#lobby .bt.gray{background:#1f2a44}
#turnBlock{position:absolute;inset:0;z-index:4;display:none;background:transparent}#turnBlock.on{display:block}
#turnPill{position:absolute;left:50%;transform:translateX(-50%);top:max(8px,env(safe-area-inset-top));z-index:6;background:rgba(8,14,30,.85);border:1px solid rgba(255,255,255,.2);color:#fff;font:800 12px system-ui;padding:6px 14px;border-radius:16px;display:none}`;
css.textContent+=`#rmBtn{position:absolute;left:max(8px,env(safe-area-inset-left));top:calc(max(8px,env(safe-area-inset-top)) + 38px);z-index:5;height:32px;padding:0 14px;border-radius:16px;border:1px solid rgba(255,255,255,.25);background:rgba(8,14,30,.78);color:#fff;font:800 12px system-ui;cursor:pointer;display:none}
#netPill{position:absolute;left:50%;transform:translateX(-50%);top:calc(max(8px,env(safe-area-inset-top)) + 34px);z-index:6;background:rgba(120,40,20,.92);color:#fff;font:800 12px system-ui;padding:6px 14px;border-radius:16px;display:none;max-width:90vw;text-align:center}`;
document.head.appendChild(css);
const rm=document.createElement('button');rm.id='rmBtn';rm.textContent='🔁 Rövanş';const np=document.createElement('div');np.id='netPill';
function netMsg(t){np.textContent=t||'';np.style.display=t?'block':'none'}
function qdo(fn){const run=q.then(async()=>{for(let i=0;i<60;i++){try{const r=await fn();if(r&&(r.ok||[400,403,404,409,429].includes(r._status)))return r;fails++}catch(e){}if(!room)return null;await new Promise(r=>setTimeout(r,1500))}return null});q=run.catch(()=>{});return run}
const tb=document.createElement('div');tb.id='turnBlock';const tp=document.createElement('div');tp.id='turnPill';tp.textContent='⏳ Rakibin sırası…';
gw.append(tb,tp,rm,np);
const lob=document.createElement('div');lob.id='lobby';document.body.appendChild(lob);
function blockTurn(on){tb.classList.toggle('on',on);tp.style.display=on&&gameOpen?'block':'none'}

/* ---- sunucu kaydı: profil + puan ---- */
async function loadMe(){if(!A||!A.enabled)return;try{const r=await A.req('GET','/api/me');if(r&&r.me){$('#uPts').textContent='⭐ '+r.me.points;
  if(!store.get('gameon.profile')&&r.me.avatar&&r.me.avatar!=='profil1'){store.set('gameon.profile',r.me.avatar);applyProfile()}}}catch(e){}}
async function pushAvatar(){if(A&&A.enabled){try{await A.req('POST','/api/me',{avatar:store.get('gameon.profile')||'profil1'})}catch(e){}}}
$('#pgo').addEventListener('click',()=>setTimeout(pushAvatar,80));
loadMe().then(pushAvatar);setInterval(loadMe,60000);
async function loadStats(){if(!A||!A.enabled)return;try{const r=await A.req('GET','/api/stats');if(r&&r.games)document.querySelectorAll('.gstat').forEach(e=>{const s=r.games[e.dataset.g]||{};const b=e.querySelectorAll('b');b[0].textContent=s.plays||0;b[1].textContent=s.players||0})}catch(e){}}
loadStats();setInterval(loadStats,60000);

/* ---- Oda Kur / Botlarla Oyna (oda = sadece gerçek oyuncular) ---- */
function askSize(g,cb,title){card.innerHTML=`<h3>${title||'Kaç kişilik masa?'}</h3><div class="sub">${g.name}</div>
   ${[2,3,4].map(n=>`<button class="opt" data-n="${n}"><span class="oi">👥</span><span>${n} kişi</span></button>`).join('')}<button class="sheet-x" data-n="0">Vazgeç</button>`;
  sheet.classList.add('on');card.onclick=e=>{const b=e.target.closest('[data-n]');if(!b)return;const n=+b.dataset.n;if(!n)return closeSheet();cb(n)}}
async function startBotRoom(g,size){
  if(!A||!A.enabled){closeSheet();return toast('UNO botlu masa için sunucu bağlantısı gerekir')}
  card.innerHTML='<h3>Masa hazırlanıyor…</h3>';let r;try{r=await A.req('POST','/api/rooms',{game:g.id,size,bots:true})}catch(e){}
  closeSheet();if(!r||!r.ok)return toast(r&&r.error==='rate'?'Çok sık oda açıyorsun, biraz bekle':'Masa kurulamadı');
  enterRoom(r.room.code,g,size)}
chooseMode=function(g){if(!g)return;const on=ONLINE.includes(g.id);
  card.innerHTML=`<h3>${g.name}</h3><div class="sub">Nasıl oynamak istersin?</div>
   <button class="opt" data-a="bot"><span class="oi">🤖</span><span>Botlarla Oyna<small>Puan kazanılmaz</small></span></button>
   <button class="opt ${on?'primary':''}" data-a="${on?'room':'soon'}" ${on?'':'style="opacity:.55"'}><span class="oi">🏠</span><span>Oda Kur<small>${on?'Gerçek oyuncularla · puan kazan':'Bu oyun için yakında'}</small></span></button>
   <button class="sheet-x" data-a="close">Vazgeç</button>`;
  sheet.classList.add('on');
  card.onclick=e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
    if(a==='bot'){if(g.id==='uno')askSize(g,n=>startBotRoom(g,n),'Kaç kişilik masa? (botlarla)');else if(g.id==='batak'){closeSheet();startBotRoom(g,4)}else{closeSheet();openGame(g,'bot')}}else if(a==='room')roomType(g);else if(a==='soon')toast('Bu oyunun oda sistemi yakında');else closeSheet()}};
roomReady=async function(g,pw,size){
  if(!A||!A.enabled)return toast('Sunucu bağlantısı yok (config.js)');
  if(g.id==='uno'&&!size)return askSize(g,n=>roomReady(g,pw,n));
  card.innerHTML='<h3>Oda kuruluyor…</h3>';
  let r;try{r=await A.req('POST','/api/rooms',{game:g.id,password:pw,size})}catch(e){}
  if(!r||!r.ok){closeSheet();return toast(r&&r.banned?'Banlısın':r&&r.error==='rate'?'Çok sık oda açıyorsun, biraz bekle':'Oda kurulamadı')}
  const code=r.room.code;myPw[code]=pw;
  card.innerHTML=`<h3>🏠 Odan hazır</h3><div class="sub">Kodu ${pw?'ve şifreyi ':''}paylaş · ${size||MAXP[g.id]} kişi gerekli</div>
   <div class="kv"><div><small>Oda kodu</small><b>${code}</b></div><button data-c="${code}">Kopyala</button></div>
   ${pw?`<div class="kv"><div><small>Şifre</small><b>${esc(pw)}</b></div><button data-c="${esc(pw)}">Kopyala</button></div>`:''}
   <button class="opt primary" data-a="go" style="margin-top:6px"><span class="oi">🚪</span><span>Lobiye Git</span></button>`;
  card.onclick=e=>{const c=e.target.closest('[data-c]');if(c){try{navigator.clipboard.writeText(c.dataset.c);toast('Kopyalandı')}catch(x){toast(c.dataset.c)}return}
    if(e.target.closest('[data-a=go]')){closeSheet();enterRoom(code,g,size)}}};

/* ---- Odalar sayfası ---- */
$('#rfGame').innerHTML+=GAMES.filter(g=>!g.soon).map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
async function loadRooms(){const box=$('#roomList');if(!A||!A.enabled){box.innerHTML='<div class="rempty">Sunucu bağlantısı yok</div>';return}
  const p=new URLSearchParams({game:$('#rfGame').value,locked:$('#rfLock').value,q:$('#rfCode').value.trim()});
  try{const r=await A.req('GET','/api/rooms?'+p);if(!r||!r.ok)throw 0;
   box.innerHTML=r.rooms.length?r.rooms.map(x=>`<div class="rrow" data-code="${x.code}"><img src="${av(x.host.avatar)}" alt=""><div class="rmid"><div class="rname">${esc(pn(x.host))}</div><div class="rgame">${esc(gname(x.game))} ${x.locked?'🔒':''}</div></div><div class="rcnt">${x.max}/${x.cur}</div></div>`).join(''):'<div class="rempty">Açık oda yok</div>'}
  catch(e){box.innerHTML='<div class="rempty">Odalar yüklenemedi</div>'}}
['rfGame','rfLock'].forEach(i=>$('#'+i).addEventListener('change',loadRooms));$('#rfGo').onclick=loadRooms;
$('#rfCode').addEventListener('keydown',e=>{if(e.key==='Enter')loadRooms()});
setInterval(()=>{if($('#page-odalar').classList.contains('active')&&!lob.classList.contains('on'))loadRooms()},4000);
const _sp=showPage;showPage=function(id){_sp(id);if(id==='odalar')loadRooms()};
$('#roomList').addEventListener('click',e=>{const r=e.target.closest('[data-code]');if(!r)return;const row=r.querySelector('.rgame').textContent.includes('🔒');joinRoom(r.dataset.code,row)});
async function joinRoom(code,locked,pw){
  if(locked&&pw===undefined){card.innerHTML=`<h3>🔒 Şifreli oda</h3><div class="sub">${code}</div><div class="kv"><input id="jpw" placeholder="Şifre" style="flex:1;background:none;border:0;color:#fff;font:900 20px ui-monospace,monospace;outline:0;min-width:0"></div><button class="opt primary" data-a="go"><span class="oi">🚪</span><span>Katıl</span></button><button class="sheet-x" data-a="x">Vazgeç</button>`;
    sheet.classList.add('on');card.onclick=e=>{const b=e.target.closest('[data-a]');if(!b)return;if(b.dataset.a==='go'){const v=$('#jpw').value;closeSheet();joinRoom(code,true,v)}else closeSheet()};return}
  let r;try{r=await A.req('POST','/api/rooms/'+code+'/join',{password:pw||''})}catch(e){}
  if(!r||!r.ok)return toast({bad_password:'Şifre yanlış',full:'Oda dolu',not_found:'Oda bulunamadı'}[r&&r.error]||'Odaya girilemedi');
  enterRoom(code,GAMES.find(g=>g.id===r.room.game))}

/* ---- lobi / hazır ekranı ---- */
function enterRoom(code,g,size){room={code,g,size};seq=0;rdy=false;pend=[];lob.classList.add('on');drawLobby(null);startPoll()}
function startPoll(){clearInterval(pollT);pollT=setInterval(poll,1000);poll()}
function stopRoom(){clearInterval(pollT);pollT=null;room=null;lob.classList.remove('on');blockTurn(false)}
async function leaveRoom(){const c=room&&room.code;stopRoom();if(c&&A&&A.enabled)try{await A.req('POST','/api/rooms/'+c+'/leave',{})}catch(e){}}
function drawLobby(s){const g=room.g,max=(s&&s.max)||room.size||MAXP[g.id],ps=s?s.players:[];let h=`<h2>${g.name}</h2><div class="lcode">${room.code}${myPw[room.code]?' · 🔑 '+esc(myPw[room.code]):''}</div>`;
  h+='<div class="lpl">'+Array.from({length:max},(_,i)=>{const p=ps[i];return p?`<div class="lp"><img src="${av(p.avatar)}" alt=""><span>${esc(pn(p))}</span><span class="ck">${p.ready?'✔️':''}</span></div>`:'<div class="lp empty"><span>⏳ Oyuncu bekleniyor…</span></div>'}).join('')+'</div>';
  const full=ps.length===max,mine=ps.find(p=>p.id===(window.__myId)),me=ps.find(p=>p.seat===seat);
  h+=full?`<button class="bt" id="lrdy">${me&&me.ready?'Hazır değilim':'Hazır mısın? ✔️'}</button>`:`<div class="sub" style="color:var(--text-muted);font-weight:700">${ps.length}/${max} oyuncu — herkes gelince "Hazır mısın" çıkar</div>`;
  h+='<button class="bt gray" id="lout">Odadan Çık</button>';lob.innerHTML=h;
  $('#lout').onclick=leaveRoom;const rb=$('#lrdy');if(rb)rb.onclick=async()=>{const me=ps.find(p=>p.seat===seat);try{await A.req('POST','/api/rooms/'+room.code+'/ready',{ready:!(me&&me.ready)});poll()}catch(e){}}}
async function poll(){if(!room||poll_busy)return;poll_busy=true;
  try{const r=await A.req('GET','/api/rooms/'+room.code+'?since='+seq);
   if(!r||!r.ok){if(r&&r._status===404){toast('Oda kapandı');stopRoom();if(gameOpen)forceExit()}return}
   const s=r.room;const me=s.players.find(p=>p.id===window.__myId);if(!window.__myId||!me){const m=await A.req('GET','/api/me');window.__myId=m.me.id}
   seat=(s.players.find(p=>p.id===window.__myId)||{seat:0}).seat;
   fails=0;netMsg(s.status==='playing'&&s.away&&s.away.length&&!s.away.includes(seat)?'⚠️ Rakibin bağlantısı koptu'+(s.forfeit_in!=null?' — '+s.forfeit_in+' sn içinde dönmezse hükmen yenilir':''):'');
   if(room.round===undefined)room.round=s.round;
   if(s.round!==room.round&&s.status==='playing'&&gameOpen){room.round=s.round;room.doneShown=0;rm.style.display='none';rdy=false;gf.src=gf.src}
   if(gameOpen&&(s.uno||s.batak)&&gf.contentWindow)gf.contentWindow.postMessage({gameon:'state',s},'*');
   if(s.round!==room.round&&s.status==='waiting'){room.round=s.round;if(gameOpen)forceExit();pend=[];seq=0;rdy=false;room.done=0;rm.style.display='none';lob.classList.add('on')}
   rm.style.display=s.status==='done'&&!s.aborted&&gameOpen?'block':'none';rm.textContent='🔁 Rövanş ('+s.votes+'/'+s.players.length+')';
   if(s.status==='waiting'){if(!gameOpen)drawLobby(s)}
   else if(s.status==='playing'&&!gameOpen&&lob.classList.contains('on')){lob.classList.remove('on');rdy=false;room.s=s;openGame(room.g,'room',room.code)}
   if(s.status==='playing'){room.s=s;s.moves.forEach(m=>{if(m.seat!==seat){pend.push(m.data);}});seq=s.seq;flush()}
   if(s.status==='done')onDone(s);
  }catch(e){if(++fails>=3&&gameOpen)netMsg('📡 Bağlantın koptu, yeniden bağlanılıyor…')}finally{poll_busy=false}}
function onDone(s){const k=s.round+'x';if(room.doneShown===k)return;room.doneShown=k;const me=window.__myId,p=s.points&&s.points[String(me)],n=s.notes&&s.notes[String(me)];
  if(s.aborted){setLock(false);blockTurn(false);toast(s.forfeit===me?'Oyundan ayrıldın: hükmen yenildin':'Rakip oyundan düştü — hükmen kazandın'+(p?' · +'+p+' puan':n?' · '+NOTE[n]:''))}
  loadMe()}
rm.onclick=async()=>{if(!room)return;try{const r=await A.req('POST','/api/rooms/'+room.code+'/rematch',{});toast(r&&r.ok?'Rövanş isteği gönderildi, rakipler bekleniyor…':'Rövanş açılamadı')}catch(e){}};
function flush(){if(!rdy)return;const w=gf.contentWindow;while(pend.length)w.postMessage({gameon:'remote',data:pend.shift()},'*')}

/* ---- oyun <-> sunucu köprüsü ---- */
const _og=openGame;openGame=function(g,m,r){cg=g;return _og(g,m,r)};
addEventListener('message',e=>{if(e.source!==gf.contentWindow)return;const d=e.data||{};
  if(d.gameon==='ready'&&curMode==='room'&&room&&room.s){rdy=true;e.source.postMessage({gameon:'init',me:seat,players:room.s.players,seed:room.s.seed,priv:room.s.priv,state:room.s,moves:[]},'*');flush()}
  else if(d.gameon==='turn'&&curMode==='room')blockTurn(d.seat!==seat);
  else if(d.gameon==='move'&&room){const c=room.code;qdo(()=>A.req('POST','/api/rooms/'+c+'/move',{data:d.data,next:d.next}))}
  else if(d.gameon==='rpc'&&room){const c=room.code,src=e.source;qdo(()=>A.req(d.method,'/api/rooms/'+c+d.path,d.method==='POST'?(d.body||{}):undefined)).then(res=>src.postMessage({gameon:'rpc-res',id:d.id,res},'*'))}
  else if(d.gameon==='end'&&room&&Array.isArray(d.ranking)){const c=room.code;blockTurn(false);
    qdo(()=>A.req('POST','/api/rooms/'+c+'/finish',{ranking:d.ranking})).then(r=>{if(r&&r.points){const me=String(window.__myId),p=r.points[me],n=r.notes&&r.notes[me];toast(p?'🎉 +'+p+' puan kazandın!':(n?NOTE[n]:'Oyun bitti'));loadMe()}})}
  else if(d.gameon==='newgame'&&cg){const g=cg;(async()=>{if(room)await leaveRoom();forceExit();if(d.choice==='bot'){if(g.id==='uno')askSize(g,n=>startBotRoom(g,n),'Kaç kişilik masa? (botlarla)');else openGame(g,'bot')}else if(ONLINE.includes(g.id))roomType(g),sheet.classList.add('on');else toast('Bu oyun için oda yakında')})()}});
finishGame=function(){if(curMode!=='room')toast('Botlarla oynanan oyunda puan verilmez')};
function forceExit(){gameOpen=false;locked=false;gf.src='about:blank';gw.classList.remove('on');document.body.classList.remove('ingame');blockTurn(false);syncUI();if(pushed){pushed=false;try{history.back()}catch(e){}}}
const _ex=exitGame;exitGame=function(){const had=!!room;_ex();if(had&&!gameOpen)leaveRoom()};$('#exitBtn').onclick=()=>exitGame();

/* ---- ayarlar: ses / titreşim ---- */
const HF=TG&&TG.HapticFeedback;
function applySettings(){const s=store.get('gameon.sound')!=='0',h=store.get('gameon.haptic')!=='0';
  const b1=$('#tgSound'),b2=$('#tgHaptic');if(b1)b1.textContent='🔊 Ses: '+(s?'Açık':'Kapalı');if(b2)b2.textContent='📳 Titreşim: '+(h?'Açık':'Kapalı');
  if(HF&&!HF.__o){HF.__o={};['impactOccurred','notificationOccurred','selectionChanged'].forEach(m=>HF.__o[m]=HF[m])}
  if(HF)['impactOccurred','notificationOccurred','selectionChanged'].forEach(m=>HF[m]=h?HF.__o[m]:()=>{})}
$('#tgSound').onclick=e=>{e.stopPropagation();store.set('gameon.sound',store.get('gameon.sound')==='0'?'1':'0');applySettings()};
$('#tgHaptic').onclick=e=>{e.stopPropagation();store.set('gameon.haptic',store.get('gameon.haptic')==='0'?'1':'0');applySettings()};
applySettings();
/* ---- uygulama yeniden açılırsa: bekleyen odaya dön / süren oyun uyarısı ---- */
(async function(){if(!A||!A.enabled)return;try{const r=await A.req('GET','/api/rooms/mine');if(!r||!r.room)return;const s=r.room,g=GAMES.find(x=>x.id===s.game);
  if(s.status==='waiting'){enterRoom(s.code,g)}
  else{room={code:s.code,g};card.innerHTML=`<h3>⚠️ Devam eden oyunun var</h3><div class="sub">${esc(gname(s.game))} · uygulama kapandığı için oyuna geri dönülemiyor. Çıkarsan hükmen yenilirsin; çıkmazsan süre dolunca otomatik hükmen yenilirsin.</div><button class="opt primary" data-a="x"><span class="oi">🚪</span><span>Odadan Çık</span></button>`;sheet.classList.add('on');card.onclick=e=>{if(e.target.closest('[data-a]')){closeSheet();leaveRoom()}}}}catch(e){}})();
})();
