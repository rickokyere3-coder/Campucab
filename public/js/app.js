/* Campucab app: map, ride assistant, trips, rider registration, rider mode and admin.
   Data goes through window.backend.use('db'|'user'), which js/firebase.js provides on top of Firebase. */
(function(){
const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const S = 100; // svg units per km

// Schematic positions in km from Central Market (x east, y north). Approximate, not surveyed.
const PLACES = {
  central:{name:'Central Market',x:0,y:0,lab:'t',al:['central market','market','town','sunyani central','cbd']},
  lorry:{name:'Main Lorry Station',x:0.5,y:-0.3,lab:'r',al:['main lorry station','lorry station','lorry park','main station','station']},
  coronation:{name:'Coronation Park',x:-0.8,y:0.3,lab:'l',al:['coronation park','coronation']},
  hospital:{name:'Regional Hospital',x:-1.3,y:0.9,lab:'l',al:['regional hospital','hospital']},
  penkwase:{name:'Penkwase',x:-1.9,y:-0.4,lab:'b',al:['penkwase']},
  berlin:{name:'Berlin Top',x:-0.5,y:1.4,lab:'r',al:['berlin top','berlin']},
  kotokrom:{name:'Kotokrom',x:-0.9,y:2.7,lab:'r',al:['kotokrom']},
  newdormaa:{name:'New Dormaa',x:1.0,y:0.8,lab:'r',al:['new dormaa','dormaa']},
  baakoniaba:{name:'Baakoniaba',x:1.9,y:1.7,lab:'r',al:['baakoniaba','bakoniaba']},
  airport:{name:'Sunyani Airport',x:2.4,y:2.8,lab:'r',al:['sunyani airport','airport','airstrip']},
  odumase:{name:'Odumase',x:0.6,y:5.4,lab:'r',al:['odumase']},
  ridge:{name:'Ridge',x:0.6,y:-1.2,lab:'r',al:['ridge']},
  estate:{name:'Estate',x:1.5,y:-0.9,lab:'t',al:['estate']},
  stu:{name:'Sunyani Technical University',x:2.7,y:-1.5,lab:'b',al:['sunyani technical university','technical university','stu','poly','polytechnic']},
  nkwabeng:{name:'Nkwabeng',x:-0.4,y:-1.7,lab:'l',al:['nkwabeng']},
  abesim:{name:'Abesim',x:0.9,y:-5.0,lab:'r',al:['abesim']},
  uenr:{name:'UENR',x:-3.0,y:0.9,lab:'b',al:['uenr','university of energy and natural resources','university of energy','energy university']},
  fiapre:{name:'Fiapre',x:-4.1,y:1.6,lab:'b',al:['fiapre']},
  cug:{name:'Catholic University',x:-4.8,y:2.3,lab:'t',al:['catholic university','cug','catholic']},
  atronie:{name:'Atronie',x:-3.6,y:-3.4,lab:'r',al:['atronie']}
};
const EDGES = [
  ['central','coronation',1],['coronation','hospital',1],['hospital','uenr',1],['uenr','fiapre',1],['fiapre','cug',1],
  ['central','berlin',1],['berlin','kotokrom',1],['kotokrom','odumase',1],
  ['central','ridge',1],['ridge','abesim',1],
  ['central','lorry'],['central','newdormaa'],['hospital','berlin'],['coronation','penkwase'],
  ['newdormaa','baakoniaba'],['baakoniaba','airport'],['airport','odumase'],['ridge','estate'],['estate','stu'],
  ['lorry','estate'],['ridge','nkwabeng'],['nkwabeng','abesim'],['penkwase','uenr'],['penkwase','atronie'],
  ['nkwabeng','atronie'],['lorry','newdormaa'],['penkwase','nkwabeng']
];
const STUBS = [['cug',-5.7,2.9,'to Berekum'],['odumase',0.8,6.3,'to Techiman'],['abesim',1.1,-5.9,'to Kumasi']];
const DRIVERS = [
  {n:'Kwame Asante',r:4.9,p:'BA 2471-23',ph:'024 555 0193',trips:1240},
  {n:'Yaw Boateng',r:4.8,p:'BA 8812-22',ph:'054 555 0471',trips:860},
  {n:'Kofi Owusu',r:4.7,p:'BA 3306-24',ph:'020 555 0718',trips:410},
  {n:'Kwabena Darko',r:4.9,p:'BA 5520-21',ph:'055 555 0264',trips:2015},
  {n:'Abena Sarpong',r:5.0,p:'BA 9047-24',ph:'024 555 0839',trips:532}
];
// Demo riders are used only until at least one registered rider is approved.
const DEMO_NODES = ['berlin','lorry','penkwase','estate','uenr','newdormaa'];
const demoFleet = DRIVERS.map((d,i)=>Object.assign({}, d, {id:'demo'+i, node:DEMO_NODES[i%DEMO_NODES.length], busy:false, serves:['student','worker'], demo:true}));
let regFleet = [];
let fleet = demoFleet;

const IDS = Object.keys(PLACES);
const adj = {}; IDS.forEach(i => adj[i] = []);
EDGES.forEach(([a,b]) => {
  const d = Math.hypot(PLACES[a].x-PLACES[b].x, PLACES[a].y-PLACES[b].y) * 1.2;
  adj[a].push([b,d]); adj[b].push([a,d]);
});
function route(a,b){
  const dist={}, prev={}, q=new Set(IDS);
  IDS.forEach(i => dist[i]=Infinity); dist[a]=0;
  while(q.size){
    let u=null; q.forEach(i => { if(u===null || dist[i]<dist[u]) u=i; });
    q.delete(u); if(u===b) break;
    adj[u].forEach(([v,w]) => { if(dist[u]+w < dist[v]){ dist[v]=dist[u]+w; prev[v]=u; } });
  }
  const path=[b]; while(path[0]!==a) path.unshift(prev[path[0]]);
  return {path, km:dist[b]};
}
const r05 = v => Math.round(v*2)/2;
let rider='student'; // student | worker
const STUDENT_RATE=0.9; // students pay 90% (10% off)
function fares(km){
  const drop=Math.max(8, r05(5+2.4*km)), shared=Math.max(4, r05(drop*0.45));
  if(rider==='student') return {drop:Math.max(7,r05(drop*STUDENT_RATE)), shared:Math.max(3.5,r05(shared*STUDENT_RATE)), full:{drop,shared}};
  return {drop, shared};
}
const ghs = v => 'GH₵ ' + v.toFixed(2);
const mins = km => Math.max(2, Math.round(km*3)); // ~20 km/h in town traffic
const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Map ---------- */
const svg = $('#map');
function el(tag, attrs, parent){ const e=document.createElementNS(NS,tag); for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
const PX = id => PLACES[id].x*S, PY = id => -PLACES[id].y*S;
let gRoute, gApproach, gPins, gIdle, gDriver;
// Draws the roads and places into any map svg. Returns two empty layers that sit under the place labels.
let VIEWBOX='';
function drawBase(target, interactive){
  if(!VIEWBOX){
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    const grow=(a,b,c,d)=>{x0=Math.min(x0,a);x1=Math.max(x1,b);y0=Math.min(y0,c);y1=Math.max(y1,d);};
    IDS.forEach(id=>{
      const p=PLACES[id], w=p.name.length*8.2, x=PX(id), y=PY(id);
      if(p.lab==='r') grow(x,x+16+w,y-12,y+12);
      else if(p.lab==='l') grow(x-16-w,x,y-12,y+12);
      else grow(x-w/2,x+w/2,y-30,y+30);
    });
    STUBS.forEach(s=>grow(s[1]*S-60,s[1]*S+60,-s[2]*S-20,-s[2]*S+20));
    const pad=24;
    VIEWBOX=`${x0-pad} ${y0-pad} ${x1-x0+pad*2} ${y1-y0+pad*2}`;
  }
  target.setAttribute('viewBox', VIEWBOX);
  const gR=el('g',{},target);
  STUBS.forEach(([id,x,y,t])=>{
    el('line',{x1:PX(id),y1:PY(id),x2:x*S,y2:-y*S,class:'stub'},gR);
    const tx=el('text',{x:x*S,y:-y*S+(y<0?18:-8),'text-anchor':'middle',class:'stub-label'},gR); tx.textContent=t;
  });
  EDGES.filter(e=>!e[2]).forEach(([a,b])=>el('line',{x1:PX(a),y1:PY(a),x2:PX(b),y2:PY(b),class:'road'},gR));
  EDGES.filter(e=>e[2]).forEach(([a,b])=>el('line',{x1:PX(a),y1:PY(a),x2:PX(b),y2:PY(b),class:'road main'},gR));
  const layers={approach:el('g',{},target), route:el('g',{},target)};
  const gN=el('g',{},target);
  IDS.forEach(id=>{
    const p=PLACES[id], x=PX(id), y=PY(id);
    const g=el('g',interactive?{class:'node',tabindex:'0',role:'button','aria-label':p.name}:{class:'node fixed'},gN);
    el('circle',{cx:x,cy:y,r:7},g);
    const o={r:[x+13,y+5,'start'],l:[x-13,y+5,'end'],t:[x,y-13,'middle'],b:[x,y+24,'middle']}[p.lab];
    const t=el('text',{x:o[0],y:o[1],'text-anchor':o[2]},g); t.textContent=p.name;
    if(interactive){
      g.addEventListener('click',()=>placeClick(id));
      g.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); placeClick(id); } });
    }
  });
  return layers;
}
function drawMap(){
  const L=drawBase(svg,true); gApproach=L.approach; gRoute=L.route;
  gIdle=el('g',{},svg); gPins=el('g',{},svg);
  gDriver=el('g',{visibility:'hidden'},svg);
  el('circle',{r:17,class:'drv-bg'},gDriver);
  el('rect',{x:-9,y:-7,width:12,height:9,rx:2.5,class:'drv-ink'},gDriver);
  el('rect',{x:3,y:-3,width:6,height:5,rx:1.2,class:'drv-ink'},gDriver);
  el('circle',{cx:-6,cy:5,r:2.6,class:'drv-ink'},gDriver);
  el('circle',{cx:7,cy:5,r:2.6,class:'drv-ink'},gDriver);
  drawIdle();
}
function fleetLabel(){
  const n=fleet.filter(f=>!f.busy).length;
  return n+(n===1?' rider':' riders')+' nearby'+(fleet===demoFleet?' (demo)':'');
}
function drawIdle(){
  if(!gIdle) return;
  gIdle.innerHTML='';
  fleet.filter(f=>!f.busy).forEach((f,i)=>{ if(!PLACES[f.node]) return; const g=el('g',{class:'idle'},gIdle); el('circle',{cx:PX(f.node)+(i%2?14:-14),cy:PY(f.node)-12,r:6},g); });
  if(!isActive()) setPill(fleetLabel(),false);
}
function polyPts(path){ return path.map(id=>`${PX(id)},${PY(id)}`).join(' '); }
function drawPins(){
  gPins.innerHTML=''; gRoute.innerHTML='';
  if(draft.pickup && draft.dest){ el('polyline',{points:polyPts(route(draft.pickup,draft.dest).path),class:'route'},gRoute); }
  const pin=(id,cls,letter)=>{ const g=el('g',{},gPins); el('circle',{cx:PX(id),cy:PY(id),r:13,class:cls},g);
    const t=el('text',{x:PX(id),y:PY(id)+4.5,'text-anchor':'middle',class:'pin-label'+(letter==='B'?' d':'')},g); t.textContent=letter; };
  if(draft.pickup) pin(draft.pickup,'pin-pick','A');
  if(draft.dest) pin(draft.dest,'pin-drop','B');
}
function setDriver(x,y){ gDriver.setAttribute('transform',`translate(${x},${y})`); gDriver.setAttribute('visibility','visible'); }

let animId=0;
function animate(path, msPerKm, onProgress, onDone){
  cancelAnimationFrame(animId);
  const pts=path.map(id=>[PX(id),PY(id)]); const seg=[]; let total=0;
  for(let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); seg.push(d); total+=d; }
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur=Math.max(1500,(total/S)*msPerKm)*(reduce?0.3:1), t0=performance.now();
  function step(now){
    const f=Math.min(1,(now-t0)/dur); let d=f*total, i=0;
    while(i<seg.length && d>seg[i]){ d-=seg[i]; i++; }
    if(i>=seg.length){ setDriver(...pts[pts.length-1]); }
    else { const k=seg[i]?d/seg[i]:0; setDriver(pts[i][0]+(pts[i+1][0]-pts[i][0])*k, pts[i][1]+(pts[i+1][1]-pts[i][1])*k); }
    onProgress(f);
    if(f<1) animId=requestAnimationFrame(step); else onDone();
  }
  animId=requestAnimationFrame(step);
}

/* ---------- State ---------- */
let state='idle'; // idle | searching | enroute | arrived | ontrip | done
let draft={pickup:null,dest:null,type:'shared',pay:'cash'};
let driver=null, driverFrom=null, legKm=0, progress=0, timers=[], qid=0, lastFare=0;
const ACTIVE=['searching','enroute','arrived','ontrip'];
const isActive=()=>ACTIVE.includes(state);

/* ---------- Chat UI ---------- */
const log=$('#log');
let queue=Promise.resolve();
function addMsg(who, html){
  const d=document.createElement('div'); d.className='msg '+who; d.innerHTML=html; log.appendChild(d);
  log.scrollTop=log.scrollHeight; return d;
}
function bot(html, delay){
  queue=queue.then(()=>new Promise(res=>{
    const t=addMsg('bot','<div class="typing"><i></i><i></i><i></i></div>'); t.style.padding='0';
    setTimeout(()=>{ t.remove(); addMsg('bot',html); renderChips(); res(); }, delay==null?450:delay);
  }));
  return queue;
}
function send(text){ if(!text.trim()) return; addMsg('me',esc(text)); handle(text); }
function renderChips(){
  const c=$('#chips'); c.innerHTML='';
  chipsFor().forEach(t=>{ const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=t; b.onclick=()=>send(t); c.appendChild(b); });
}
function chipsFor(){
  if(state==='searching'||state==='enroute') return ['Where is my rider?','Call rider','Cancel ride'];
  if(state==='arrived') return ["I'm on board",'Call rider','Cancel ride'];
  if(state==='ontrip') return ['How long left?','Call rider','Emergency help'];
  if(state==='done') return ['Book another ride','Thank you'];
  if(draft.pickup && draft.dest) return ['Confirm ride', draft.type==='shared'?'Make it a drop':'Make it shared', draft.pay==='cash'?'Pay with MoMo':'Pay with cash','Cancel'];
  if(draft.dest) return ['Central Market','UENR','Penkwase','Main Lorry Station','Fiapre'].filter(n=>PLACES[draft.dest].name!==n).map(n=>'From '+n);
  const swap = rider==='student' ? "I'm a worker" : "I'm a student";
  if(draft.pickup) return (rider==='student'
      ? ['UENR','Catholic University','Sunyani Technical University','Central Market','Fiapre']
      : ['Central Market','Regional Hospital','Main Lorry Station','Ridge','Estate']
    ).filter(n=>PLACES[draft.pickup].name!==n).map(n=>'To '+n);
  return rider==='student'
    ? ['Take me to UENR','Fiapre to Catholic University','Fare from Fiapre to Central Market',swap,'Help']
    : ['Take me to Central Market','Abesim to Regional Hospital','Fare from Penkwase to Ridge',swap,'Help'];
}

/* ---------- Understanding messages ---------- */
const norm = t => t.toLowerCase().replace(/ɛ/g,'e').replace(/ɔ/g,'o').replace(/[’`]/g,"'").replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim();
const ALIASES=[]; IDS.forEach(id=>PLACES[id].al.forEach(a=>ALIASES.push([a,id]))); ALIASES.sort((a,b)=>b[0].length-a[0].length);
function findPlaces(t){
  const taken=[], out=[];
  for(const [a,id] of ALIASES){
    const re=new RegExp('\\b'+a.replace(/ /g,' ')+'\\b','g'); let m;
    while((m=re.exec(t))){ const s=m.index, e=s+a.length; if(taken.some(([x,y])=>s<y&&e>x)) continue; taken.push([s,e]); out.push({id,s,e}); }
  }
  out.sort((a,b)=>a.s-b.s);
  return out.filter((m,i)=>i===0||m.id!==out[i-1].id);
}
function assignRoles(t,ms){
  let prevEnd=0;
  ms.forEach(m=>{
    const pre=t.slice(Math.max(prevEnd,m.s-30),m.s);
    const re=/\b(drop me(?: off)? at|going to|go to|to|for|towards|reach)\b|\b(from|at|in|near|pick me up at|pick me at|pick up at|pickup at)\b/g;
    let r,last=null; while((r=re.exec(pre))) last=r;
    m.role = last ? (last[1]?'dest':'pick') : null; prevEnd=m.e;
  });
}
function applyPlaces(ms){
  const pk=ms.find(m=>m.role==='pick'), ds=[...ms].reverse().find(m=>m.role==='dest');
  let p=pk&&pk.id, d=ds&&ds.id; const un=ms.filter(m=>!m.role).map(m=>m.id);
  if(!p&&!d){ if(un.length>=2){ p=un[0]; d=un[1]; } else if(draft.dest&&!draft.pickup) p=un[0]; else d=un[0]; }
  else if(!p&&un.length) p=un[0];
  else if(!d&&un.length) d=un[un.length-1];
  if(p) draft.pickup=p; if(d) draft.dest=d;
  if(draft.pickup && draft.pickup===draft.dest){
    if(d) draft.dest=null; else draft.pickup=null;
    drawPins(); bot(`Pickup and destination are both <b>${PLACES[p||d].name}</b>. Where would you like to go instead?`); return false;
  }
  return true;
}

function handle(raw){
  const t=norm(raw); if(!t) return;
  if(/\b(emergency|accident|police|unsafe|not safe|danger|sos)\b/.test(t)) return safety();
  if(/\b(cancel|abort)\b/.test(t)) return cancel();
  if(/\b(help|what can you do|how does this work|how do i)\b/.test(t)) return help();
  if(driver && isActive() && /\b(call|phone|number|contact)\b/.test(t)) return callRider();
  if(/\b(on board|onboard|i'm in|im in|start (the )?trip|let's go|lets go|i'm seated)\b/.test(t)) return board();
  if(isActive() && /\b(where is|status|how long|eta|how far|left|arrive|coming|where are you)\b/.test(t)) return status();
  if(/\b(book another|new ride|another ride|book again)\b/.test(t)){ resetDraft(); state='idle'; return bot('Sure. Where are you going?'); }
  if(/\b(thank|thanks|medaase|meda wo ase)\b/.test(t)) return bot('Mepa wo kyɛw, you are welcome. Safe travels around Sunyani!');
  if(/\b(become a rider|register as a rider|be a rider|rider registration|join as a rider|sign up as a rider|drive for|register my pragia)\b/.test(t)){
    showView('register'); return bot('I\'ve opened the <b>Become a rider</b> form. Fill it in and we will call you to arrange verification.');
  }
  if(/\b(where do you go|where can you go|places|areas|locations|which towns|do you cover|list)\b/.test(t)) return listPlaces();
  if(/\b(i'm a student|im a student|i am a student|student ride|student fare|student mode|as a student|switch to student)\b/.test(t)) return setRider('student');
  if(/\b(i'm a worker|im a worker|i am a worker|worker ride|worker fare|worker mode|as a worker|switch to worker|i work|staff|employee)\b/.test(t)) return setRider('worker');

  let changed=[];
  if(/\b(momo|mobile money|telecel cash|at money)\b/.test(t)){ draft.pay='momo'; changed.push('payment set to MoMo'); }
  else if(/\bcash\b/.test(t)){ draft.pay='cash'; changed.push('payment set to cash'); }
  if(/\b(shared|share|seat|cheaper|cheapest)\b/.test(t)){ draft.type='shared'; changed.push('shared seat'); }
  else if(/\b(a drop|dropping|private|alone|whole|myself|just me)\b/.test(t)){ draft.type='drop'; changed.push('drop (whole pragia to yourself)'); }

  const ms=findPlaces(t);
  if(ms.length){
    if(isActive()) return bot('You have a ride in progress. Say <b>cancel ride</b> first if you want to book somewhere else.');
    if(state==='done') resetDraft();
    assignRoles(t,ms);
    if(!applyPlaces(ms)) return;
    return afterDraft(/\b(how much|price|fare|cost|charge)\b/.test(t));
  }
  if(changed.length && !isActive()){
    if(draft.pickup&&draft.dest){ refreshQuote(); return bot('Done: '+changed.join(', ')+'. New price is on the card above.'); }
    return bot('Noted: '+changed.join(', ')+'. Now tell me where you are going.');
  }
  if(/^(yes|yeah|yep|ok|okay|sure|confirm|book it|book|request|go ahead|aane|yoo|let's do it)\b/.test(t) || /\bconfirm\b/.test(t)){
    if(state==='idle' && draft.pickup && draft.dest) return confirmRide();
    if(isActive()) return status();
    return bot('Tell me where you are and where you are going, and I will get you a pragia.');
  }
  if(/^(no|nope|not now|daabi)\b/.test(t)) return bot('No problem. I am here when you need a ride.');
  if(/\b(how much|price|fare|cost|charge)\b/.test(t)){
    if(draft.pickup&&draft.dest) return afterDraft(true);
    return bot('Fares depend on distance. Shared seats start at <span class="mono">GH₵ 4.00</span>, a drop at <span class="mono">GH₵ 8.00</span>. Try <i>“How much from Fiapre to Central Market?”</i>');
  }
  if(/\b(hi|hello|hey|akwaaba|maakye|maaha|maadwo|good morning|good afternoon|good evening|ete sen|wo ho te sen|how are you)\b/.test(t)){
    return bot(`${greet()}! Me ho yɛ, medaase. Where are you heading today?`);
  }
  if(/\b(book|ride|pragia|okada|taxi|need|want|take me|go|travel)\b/.test(t)){
    if(isActive()) return status();
    return bot('Where are you going? You can name a place like <b>Regional Hospital</b> or <b>Abesim</b>, or tap it on the map.');
  }
  bot('I didn\'t catch a place in that. I know areas like Penkwase, Fiapre, Abesim, Berlin Top, New Dormaa, Odumase and UENR. Try <i>“Take me from Ridge to STU”</i>.');
}
function greet(){ const h=new Date().getHours(); return h<12?'Maakye (good morning)':h<17?'Maaha (good afternoon)':'Maadwo (good evening)'; }

function afterDraft(isFareQuestion){
  drawPins();
  if(draft.pickup&&draft.dest){
    const r=route(draft.pickup,draft.dest);
    return bot(`${isFareQuestion?'Here is the fare':'Got it'}: <b>${PLACES[draft.pickup].name}</b> to <b>${PLACES[draft.dest].name}</b>.`+quoteHTML(++qid),600).then(()=>{
      document.querySelectorAll('.quote').forEach(q=>{ if(q.id!=='q'+qid) q.classList.add('stale'); });
    });
  }
  if(draft.dest) return bot(`Going to <b>${PLACES[draft.dest].name}</b>. Where should the rider pick you up?`);
  return bot(`Pickup at <b>${PLACES[draft.pickup].name}</b>. Where are you going?`);
}
function quoteInner(){
  const r=route(draft.pickup,draft.dest), f=fares(r.km);
  const was = k => f.full ? `<s>${ghs(f.full[k])}</s>` : '';
  return `<div class="q-cat">${rider==='student'?'Student fare · 10% off · show your student ID at pickup':'Worker fare · receipt after every trip'} · fares include a ${SERVICE_PCT} service charge</div>
  <div class="q-route"><span><i class="dot"></i>${PLACES[draft.pickup].name}</span><span><i class="dot d"></i>${PLACES[draft.dest].name}</span></div>
  <div class="q-meta">${r.km.toFixed(1)} km · about ${mins(r.km)} min · via ${r.path.slice(1,-1).map(i=>PLACES[i].name).join(', ')||'direct road'}</div>
  <div class="seg"><button type="button" class="opt ${draft.type==='shared'?'on':''}" data-act="type" data-v="shared">Shared seat<b>${ghs(f.shared)}${was('shared')}</b></button>
  <button type="button" class="opt ${draft.type==='drop'?'on':''}" data-act="type" data-v="drop">Drop (whole pragia)<b>${ghs(f.drop)}${was('drop')}</b></button></div>
  <div class="seg"><button type="button" class="opt ${draft.pay==='cash'?'on':''}" data-act="pay" data-v="cash">Cash</button>
  <button type="button" class="opt ${draft.pay==='momo'?'on':''}" data-act="pay" data-v="momo">Mobile Money</button></div>
  <button type="button" class="cta" data-act="confirm">Request pragia · ${ghs(draft.type==='shared'?f.shared:f.drop)}</button>`;
}
function quoteHTML(id){ return `<div class="quote" id="q${id}">${quoteInner()}</div>`; }
function refreshQuote(){ const q=document.getElementById('q'+qid); if(q && !q.classList.contains('stale')) q.innerHTML=quoteInner(); }

log.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b) return;
  const act=b.dataset.act, v=b.dataset.v;
  if(act==='type'){ draft.type=v; refreshQuote(); renderChips(); }
  else if(act==='pay'){ draft.pay=v; refreshQuote(); renderChips(); }
  else if(act==='confirm'){ addMsg('me','Request pragia'); confirmRide(); }
  else if(act==='rate'){ b.parentElement.querySelectorAll('button').forEach(x=>x.disabled=true); addMsg('me','★'.repeat(+v)); rate(+v); }
  else if(act==='net'){ const card=b.closest('.momo'); card.dataset.net=v; card.querySelectorAll('[data-act="net"]').forEach(x=>x.classList.toggle('on',x===b)); }
  else if(act==='momo-send'){ sendMomo(b.closest('.momo')); }
  else if(act==='pay-cash'){ payCashInstead(b.closest('.momo')); }
});
// Pick the network automatically from the number's prefix as it is typed.
log.addEventListener('input',e=>{
  const i=e.target.closest('[data-momo]'); if(!i) return;
  const net=detectNet(i.value), card=i.closest('.momo'); if(!net||!card) return;
  card.dataset.net=net; card.querySelectorAll('[data-act="net"]').forEach(x=>x.classList.toggle('on',x.dataset.v===net));
});

/* ---------- Trip flow ---------- */
function setPill(text,busy){ $('#pillText').textContent=text; $('#pill').classList.toggle('busy',!!busy); }
function renderTrip(){
  const box=$('#trip');
  $('.side').classList.toggle('busy',isActive());
  if(!isActive()){ box.hidden=true; setPill(fleetLabel(),false); return; }
  box.hidden=false;
  const st={searching:'Finding a rider near '+PLACES[draft.pickup].name+'…',
    enroute:'Rider on the way to pickup',arrived:'Rider is waiting at '+PLACES[draft.pickup].name,
    ontrip:'On trip to '+PLACES[draft.dest].name}[state];
  setPill(st,true);
  if(state==='searching'){ box.innerHTML=`<div class="trip-status">${st}</div><div class="bar"><i id="tbar" style="width:15%"></i></div>`; return; }
  const ini=driver.n.split(' ').map(w=>w[0]).join('');
  box.innerHTML=`<div class="trip-row">${driver.photo?`<img class="ava" src="${driver.photo}" alt="Photo of ${driver.n}">`:`<div class="ava">${ini}</div>`}<div><div class="trip-name">${driver.n}</div>
    <div class="trip-sub">★ ${driver.r.toFixed(1)} · ${driver.trips.toLocaleString()} trips · ${driver.ph}</div></div><span class="plate">${driver.p}</span></div>
    <div class="trip-status" id="tstat">${st}</div><div class="bar"><i id="tbar"></i></div>`;
  updateBar();
}
function remaining(){ return Math.max(1,Math.ceil(mins(legKm)*(1-progress))); }
function updateBar(){
  const b=$('#tbar'), s=$('#tstat'); if(b) b.style.width=(state==='arrived'?100:progress*100)+'%';
  if(s && (state==='enroute'||state==='ontrip')) s.textContent=(state==='enroute'?'Arriving at pickup in ':'Reaching '+PLACES[draft.dest].name+' in ')+remaining()+' min';
}
function confirmRide(){
  if(state!=='idle'&&state!=='done' || !draft.pickup || !draft.dest){ return bot('Tell me your pickup and destination first.'); }
  state='searching';
  document.querySelectorAll('.quote').forEach(q=>q.classList.add('stale'));
  renderTrip();
  bot(`Looking for a pragia near <b>${PLACES[draft.pickup].name}</b>…`);
  timers.push(setTimeout(assign, 2400));
}
let tripT={}; // when the rider took the request and when the passenger boarded
function assign(){
  if(state!=='searching') return;
  const pool=fleet.filter(f=>!f.busy && PLACES[f.node] && (f.serves||[]).includes(rider));
  if(!pool.length){ state='idle'; renderTrip(); return bot(`No riders for ${rider} trips are free right now. Please try again in a few minutes.`); }
  let best=null;
  pool.forEach(f=>{ const r=route(f.node,draft.pickup); if(!best||r.km<best.r.km) best={f,r}; });
  driver=best.f; driver.busy=true; driverFrom=driver.node; drawIdle();
  tripT={assigned:new Date().toISOString(), boarded:null};
  legKm=best.r.km; progress=0; state='enroute';
  gApproach.innerHTML=''; el('polyline',{points:polyPts(best.r.path),class:'approach'},gApproach);
  setDriver(PX(driver.node),PY(driver.node));
  renderTrip();
  bot(`<b>${driver.n}</b> accepted your ride. Yellow pragia, plate <span class="mono">${driver.p}</span>. Arriving in about <b>${mins(legKm)} min</b>.`+(rider==='student'?' Have your student ID ready to show for the student fare.':''));
  animate(best.r.path,1800,f=>{progress=f;updateBar();},arrivedAtPickup);
}
function arrivedAtPickup(){
  state='arrived'; gApproach.innerHTML=''; renderTrip();
  bot(`${driver.n.split(' ')[0]} is at <b>${PLACES[draft.pickup].name}</b>. Check the plate <span class="mono">${driver.p}</span>${driver.photo?' and that the rider matches the photo':''} before you climb in, then tap <b>I'm on board</b>.`);
}
function board(){
  if(state==='enroute') return bot(`Your rider isn't there yet. About <b>${remaining()} min</b> away.`);
  if(state!=='arrived') return bot(isActive()?'You are already on the way.':'You don\'t have a rider waiting. Where would you like to go?');
  const r=route(draft.pickup,draft.dest); legKm=r.km; progress=0; state='ontrip'; tripT.boarded=new Date().toISOString(); renderTrip();
  bot(`Enjoy the ride! You'll reach <b>${PLACES[draft.dest].name}</b> in about ${mins(legKm)} min. Hold on at the bumps.`);
  animate(r.path,1500,f=>{progress=f;updateBar();},finishTrip);
}
function finishTrip(){
  const f=fares(legKm); lastFare=draft.type==='shared'?f.shared:f.drop;
  state='done'; driver.node=draft.dest; driver.busy=false; driver.trips=(driver.trips||0)+1; renderTrip(); gDriver.setAttribute('visibility','hidden'); drawIdle();
  tripRec={id:'T'+Date.now().toString(36).toUpperCase(), at:new Date().toISOString(), day:dayKey(new Date()), from:draft.pickup, to:draft.dest,
    cat:rider, type:draft.type, fare:lastFare, fee:serviceFee(lastFare), riderGets:Math.round((lastFare-serviceFee(lastFare))*100)/100,
    pay:draft.pay, status:draft.pay==='momo'?'awaiting':'cash',
    rider:driver.id, riderFrom:driverFrom, assignedAt:tripT.assigned||null, boardedAt:tripT.boarded||null};
  recordRide(tripRec);
  const extra = rider==='worker' ? ' A trip receipt has been saved for your work records.' : ' Student discount applied.';
  const where = `You've arrived at <b>${PLACES[draft.dest].name}</b>. Fare: <span class="mono">${ghs(lastFare)}</span>, including a ${SERVICE_PCT} Campucab service charge of <span class="mono">${ghs(tripRec.fee)}</span>; ${driver.n.split(' ')[0]} receives <span class="mono">${ghs(tripRec.riderGets)}</span>.`;
  if(draft.pay==='momo'){
    bot(`${where}${extra} Pay with Mobile Money below.`+momoCard(++payN));
  } else {
    bot(`${where} Please pay ${driver.n.split(' ')[0]} in cash.${extra}`); askRating();
  }
}
function askRating(){
  if(!driver) return;
  bot(`How was your ride with ${driver.n.split(' ')[0]}?<div class="stars">${[1,2,3,4,5].map(n=>`<button type="button" data-act="rate" data-v="${n}" aria-label="${n} star${n>1?'s':''}">★</button>`).join('')}</div>`);
}

/* ---------- Mobile Money ---------- */
const MOMO_NETS={
  mtn:{name:'MTN MoMo',pre:['024','025','053','054','055','059']},
  telecel:{name:'Telecel Cash',pre:['020','050']},
  at:{name:'AirtelTigo Money',pre:['026','027','056','057']}
};
let payN=0, tripRec=null, momoSaved=null;
function detectNet(v){
  let d=(v||'').replace(/\D/g,''); if(d.startsWith('233')) d='0'+d.slice(3);
  const p=d.slice(0,3); return Object.keys(MOMO_NETS).find(k=>MOMO_NETS[k].pre.includes(p))||null;
}
// SIMULATED PROVIDER. To take real payments, replace this one function with a call to your own
// payment server. That server holds the secret keys, sends the request through Paystack, Hubtel or
// the MTN MoMo API, and reports back once the customer approves with their PIN on their phone.
function requestMomo({amount,number,network,reference}){
  return new Promise(res=>setTimeout(()=>res({status:'successful',reference:'MOMO-'+reference}),4000));
}
function momoCard(n){
  const num=momoSaved?momoSaved.number:'', net=(momoSaved&&MOMO_NETS[momoSaved.network]?momoSaved.network:null)||detectNet(num)||'mtn';
  return `<div class="quote momo" id="pay${n}" data-net="${net}">
    <div class="q-cat">Mobile Money · ${ghs(lastFare)}</div>
    <div class="seg seg3">${Object.keys(MOMO_NETS).map(k=>`<button type="button" class="opt ${k===net?'on':''}" data-act="net" data-v="${k}">${MOMO_NETS[k].name}</button>`).join('')}</div>
    <div class="field"><label for="momo${n}">MoMo number</label><input id="momo${n}" type="tel" inputmode="tel" autocomplete="tel" placeholder="024 123 4567" value="${esc(num)}" data-momo="${n}"></div>
    <button type="button" class="cta" data-act="momo-send">Send payment request</button>
    <button type="button" class="linkbtn" data-act="pay-cash">Pay cash instead</button>
    <p class="formmsg" id="momoMsg${n}" role="status">You approve the payment on your own phone. Campucab never asks for your PIN.</p></div>`;
}
async function sendMomo(card){
  if(!card||card.classList.contains('locked')) return;
  const n=card.id.slice(3), msg=$('#momoMsg'+n), input=$('#momo'+n), rec=tripRec;
  const number=normPhone(input.value), net=card.dataset.net;
  if(!number){ msg.className='formmsg err'; msg.textContent='Enter a Ghana mobile number, like 024 123 4567.'; return; }
  const det=detectNet(number);
  if(det && det!==net){ msg.className='formmsg err'; msg.textContent=`${number} is a ${MOMO_NETS[det].name} number. Choose ${MOMO_NETS[det].name} or check the number.`; return; }
  card.classList.add('locked');
  msg.className='formmsg'; msg.textContent=`Request sent to ${number}. Check your phone and enter your ${MOMO_NETS[net].name} PIN there to approve ${ghs(rec.fare)}.`;
  try{
    const res=await requestMomo({amount:rec.fare,number,network:net,reference:rec.id});
    if(!res||res.status!=='successful') throw new Error('not approved');
    msg.className='formmsg ok'; msg.textContent=`Paid · reference ${res.reference}`;
    updateRide(rec.id,{status:'paid',network:net,ref:res.reference});
    momoSaved={network:net,number}; saveMomo();
    bot(`Payment of <span class="mono">${ghs(rec.fare)}</span> received from ${MOMO_NETS[net].name} <span class="mono">${esc(number)}</span>. Reference <span class="mono">${esc(res.reference)}</span>.`);
    askRating();
  }catch(err){
    card.classList.remove('locked');
    msg.className='formmsg err'; msg.textContent='The payment was not approved. Try again, or pay cash instead.';
    updateRide(rec.id,{status:'failed'});
  }
}
function payCashInstead(card){
  if(!card||card.classList.contains('locked')) return;
  card.classList.add('locked');
  const rec=tripRec;
  saveRides(cur=>{
    const r=cur.recent.find(x=>x.id===rec.id); if(!r||r.pay==='cash') return;
    r.pay='cash'; r.status='cash';
    const d=cur.days[r.day]; if(d){ d.momo=Math.max(0,(d.momo||0)-1); d.cash=(d.cash||0)+1; }
  });
  addMsg('me','Pay cash instead');
  bot(`No problem. Please pay ${driver?driver.n.split(' ')[0]:'your rider'} <span class="mono">${ghs(rec.fare)}</span> in cash.`);
  askRating();
}
function rate(n){
  resetDraft();
  bot(n>=4?`Medaase! I'll pass your ${n} stars to ${driver.n.split(' ')[0]}.`:`Sorry it wasn't great. Thanks for the ${n}-star rating; our team will review the trip.`);
}
function status(){
  if(state==='searching') return bot('Still matching you with the nearest rider. It usually takes under a minute.');
  if(state==='enroute') return bot(`${driver.n.split(' ')[0]} is about <b>${remaining()} min</b> from ${PLACES[draft.pickup].name}.`);
  if(state==='arrived') return bot(`${driver.n.split(' ')[0]} is waiting at ${PLACES[draft.pickup].name}. Plate <span class="mono">${driver.p}</span>.`);
  if(state==='ontrip') return bot(`About <b>${remaining()} min</b> to ${PLACES[draft.dest].name}.`);
}
function callRider(){ bot(`You can reach ${driver.n.split(' ')[0]} on <span class="mono">${driver.ph}</span>. (Demo number.)`); }
function cancel(){
  if(isActive()){
    cancelAnimationFrame(animId); timers.forEach(clearTimeout); timers=[];
    if(driver) driver.busy=false;
    driverFrom=null;
    gApproach.innerHTML=''; gDriver.setAttribute('visibility','hidden');
    const wasOnTrip=state==='ontrip';
    state='idle'; driver=null; renderTrip(); drawIdle(); drawPins();
    return bot(wasOnTrip?'Trip ended early. Your rider will drop you at the next safe stop.':'Ride cancelled, no charge. Your trip details are kept; say <b>confirm ride</b> to request again.');
  }
  if(draft.pickup||draft.dest){ resetDraft(); return bot('Cleared. Where would you like to go?'); }
  bot('There is nothing to cancel right now.');
}
function resetDraft(){ draft.pickup=null; draft.dest=null; state='idle'; driverFrom=null; drawPins(); renderTrip(); }
function safety(){
  bot('If you are in danger, call the <b>Ghana Police on 191</b> or the national emergency line <b>112</b>. Ambulance: <b>193</b>. '+(isActive()?`Your rider is ${driver?driver.n+', plate <span class="mono">'+driver.p+'</span>':'not yet assigned'}. Share these details with someone you trust.`:''));
}
function help(){
  bot('I can book a pragia, give fares and track your rider. Try:<br>• <i>Take me from Penkwase to UENR</i><br>• <i>How much from Fiapre to Central Market?</i><br>• <i>Make it a drop</i> or <i>pay with MoMo</i><br>• <i>Where is my rider?</i> or <i>cancel ride</i><br>You can also tap places on the map.');
}
function listPlaces(){
  bot('I cover Sunyani and nearby towns: '+IDS.map(i=>PLACES[i].name).join(', ')+'.');
}
function setRider(v){
  if(isActive()) return bot('You can switch between Student and Worker after this ride.');
  rider=v;
  ['student','worker'].forEach(k=>{ const b=$(k==='student'?'#catStudent':'#catWorker'); b.classList.toggle('on',k===v); b.setAttribute('aria-checked',k===v); });
  $('#hero').classList.toggle('worker',v==='worker');
  $('#heroText').innerHTML = v==='student'
    ? 'Rides for UENR students<span>Campus, Fiapre and all of Sunyani</span>'
    : 'Rides for Sunyani workers<span>Dependable trips to work and back home</span>';
  refreshQuote();
  return bot(v==='student'
    ? 'Student rides on. You get <b>10% off</b> every fare; just show your student ID to the rider at pickup.'
    : 'Worker rides on. Standard fares, and a <b>trip receipt</b> is saved after every ride for your work records.');
}
document.querySelectorAll('.cat button').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.cat===rider) return;
  addMsg('me', b.dataset.cat==='student' ? "I'm a student" : "I'm a worker"); setRider(b.dataset.cat);
}));
function placeClick(id){
  if(isActive()) return bot('You have a ride in progress. Say <b>cancel ride</b> to change it.');
  send(!draft.pickup ? 'Pick me up at '+PLACES[id].name : 'Take me to '+PLACES[id].name);
}

$('#composer').addEventListener('submit',e=>{ e.preventDefault(); const i=$('#msg'); const v=i.value; i.value=''; send(v); });

/* ---------- Views ---------- */
const VIEWS={ride:'#rideView',trips:'#tripsView',register:'#regView',rider:'#riderView',admin:'#adminView'};
function showView(v){
  if(v==='admin' && !isAdmin) v='register';
  if(v==='rider' && !isRiderMe) v='register';
  Object.keys(VIEWS).forEach(k=>{ $(VIEWS[k]).hidden = k!==v; });
  document.querySelectorAll('.tabs button').forEach(b=>{ const on=b.dataset.view===v; b.classList.toggle('on',on); b.setAttribute('aria-selected',on); });
}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));

/* ---------- Rider registration (shared database) ----------
   applications/<viewer id> : each rider's own application (only they and admins can read it)
   riders/<viewer id>       : approved riders, readable by everyone, written by admins only */
let db=null, myId=null, isAdmin=false, myApp=null, apps=[], regRiders=[], formDirty=false;
const STATUS_LABEL={pending:'Under review',approved:'Approved',rejected:'Not approved',suspended:'Suspended'};
const YEARS_LABEL={'0':'under 1 yr','1':'1–3 yrs','3':'3–5 yrs','5':'5+ yrs'};
const stCls = s => STATUS_LABEL[s] ? s : 'pending';
const fmtDate = s => { const d=new Date(s); return isNaN(d)?'':d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); };
const placeName = id => PLACES[id] ? PLACES[id].name : '';

$('#rBase').innerHTML = IDS.map(id=>`<option value="${id}">${PLACES[id].name}</option>`).join('');
function notice(html){ const n=$('#regNotice'); n.innerHTML=html; n.hidden=!html; }
function formMsg(text,kind){ const m=$('#regMsg'); m.textContent=text; m.className='formmsg '+(kind||''); }
function setFormEnabled(on){ $('#regForm').querySelectorAll('input,select,button').forEach(x=>x.disabled=!on); }
function normPhone(v){
  let d=v.replace(/[^\d+]/g,'');
  if(d.startsWith('+233')) d='0'+d.slice(4); else if(d.startsWith('233')&&d.length===12) d='0'+d.slice(3);
  return /^0[235]\d{8}$/.test(d) ? d.slice(0,3)+' '+d.slice(3,6)+' '+d.slice(6) : null;
}
function fillForm(a){
  $('#rName').value=a.name||''; $('#rPhone').value=a.phone||''; $('#rPlate').value=a.plate||'';
  if(PLACES[a.base]) $('#rBase').value=a.base;
  if(YEARS_LABEL[a.years]) $('#rYears').value=a.years;
  const s=Array.isArray(a.serves)?a.serves:[]; $('#rStudent').checked=s.includes('student'); $('#rWorker').checked=s.includes('worker');
  $('#rLicence').checked=!!a.licence; $('#rCard').checked=!!a.ghanaCard; $('#rConduct').checked=!!a.conduct;
  photoData=safePhoto(a.photo); showPhoto(photoData);
  $('#regSubmit').textContent='Update application';
}
$('#regForm').addEventListener('input',()=>{ formDirty=true; });

/* Passport photo: cropped to 7:9 and shrunk to 280×360 on the rider's device, then saved as a small JPEG. */
let photoData=null;
const PHOTO_RE=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const safePhoto = p => (typeof p==='string' && p.length<200000 && PHOTO_RE.test(p)) ? p : null;
function showPhoto(src){
  const b=$('#rPhotoBox');
  if(src){ b.innerHTML=`<img src="${src}" alt="Your passport photo">`; b.classList.add('has'); }
  else { b.innerHTML='<span>No photo yet</span>'; b.classList.remove('has'); }
}
function toPassport(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{
      const W=280,H=360,r=W/H; let sw=img.naturalWidth, sh=img.naturalHeight, sx=0, sy=0;
      if(!sw||!sh){ URL.revokeObjectURL(url); return rej(new Error('empty')); }
      if(sw/sh>r){ const nw=sh*r; sx=(sw-nw)/2; sw=nw; } else { const nh=sw/r; sy=(sh-nh)*0.3; sh=nh; } // keep the top part, where the face usually is
      const c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H); ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',0.82));
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error('unreadable')); };
    img.src=url;
  });
}
$('#rPhoto').addEventListener('change',async e=>{
  const file=e.target.files&&e.target.files[0]; e.target.value=''; if(!file) return;
  if(!/^image\//.test(file.type)) return formMsg('Choose an image file, like a JPG or PNG photo.','err');
  if(file.size>15*1024*1024) return formMsg('That photo is too large. Choose one under 15 MB.','err');
  try{ photoData=await toPassport(file); showPhoto(photoData); formDirty=true; formMsg(''); }
  catch(err){ formMsg('Could not read that photo. Try a JPG or PNG instead.','err'); }
});
$('#regForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const name=$('#rName').value.trim().replace(/\s+/g,' ');
  const phone=normPhone($('#rPhone').value);
  const plate=$('#rPlate').value.trim().toUpperCase().replace(/\s+/g,' ');
  const serves=[$('#rStudent').checked&&'student',$('#rWorker').checked&&'worker'].filter(Boolean);
  const errs=[], photo=photoData||safePhoto(myApp&&myApp.photo);
  if(!photo) errs.push('Add a passport photo.');
  if(name.length<3) errs.push('Enter your full name.');
  if(!phone) errs.push('Enter a Ghana phone number, like 024 123 4567.');
  if(plate.length<5) errs.push('Enter your pragia plate number.');
  if(!serves.length) errs.push('Choose students, workers or both.');
  if(!$('#rLicence').checked||!$('#rCard').checked||!$('#rConduct').checked) errs.push('Tick the three confirmations.');
  if(errs.length) return formMsg(errs.join(' '),'err');
  if(!db||!myId) return formMsg('Registration is not available in this view.','err');
  const btn=$('#regSubmit'); btn.disabled=true; formMsg('Sending…');
  const body={name:name.slice(0,80),phone,plate:plate.slice(0,20),base:$('#rBase').value,years:$('#rYears').value,serves,
    licence:true,ghanaCard:true,conduct:true,photo,status:'pending',submittedAt:new Date().toISOString()};
  try{
    const wasUpdate=!!myApp;
    await db.doc('applications/'+myId).set(body); formDirty=false;
    formMsg(wasUpdate?'Application updated. We will review it again.':'Application sent. We will call you to arrange verification.','ok');
  }catch(err){
    const c=err&&err.code;
    formMsg(c==='invalid_argument'?'Your account is not allowed to send an application. Log out, log in again and try once more, or contact Campucab.'
      :c==='quota_exceeded'?'Registration is full right now. Please contact Campucab directly.'
      :'Could not send your application. Check your connection and try again.','err');
  }
  btn.disabled=false;
});

function renderMyApp(){
  const box=$('#myApp');
  const steps=`<ol class="steps"><li><b>Apply</b> with this form.</li><li><b>Verification.</b> We call you to check your Ghana Card, licence and pragia in person.</li><li><b>Go live.</b> Once approved you appear in the app and start getting passengers.</li></ol>`;
  if(!myApp){
    box.innerHTML=`<h3>Your application</h3><p class="muted">${db&&myId?'You have not applied yet.':'Not available in this view.'}</p>${steps}`;
    return;
  }
  const st=stCls(myApp.status), live=regRiders.some(r=>r.id===myId);
  const note = st==='approved' ? (live?'You are live. Passengers can now be matched with you.':'Approved. You will appear in the app shortly.')
    : st==='rejected' ? 'Your application was not approved. Update your details and submit again, or contact Campucab.'
    : st==='suspended' ? 'Your rider account is paused. Contact Campucab to find out more.'
    : 'We will call you on the number above to arrange verification. You can edit and resubmit any time.';
  const myPhoto=safePhoto(myApp.photo);
  box.innerHTML=`<h3>Your application</h3>${myPhoto?`<img class="myphoto" src="${myPhoto}" alt="Your passport photo">`:''}<span class="status ${st}">${STATUS_LABEL[st]}</span>
    <dl class="facts"><dt>Name</dt><dd>${esc(String(myApp.name||''))}</dd><dt>Phone</dt><dd class="mono">${esc(String(myApp.phone||''))}</dd>
    <dt>Plate</dt><dd class="mono">${esc(String(myApp.plate||''))}</dd><dt>Waits at</dt><dd>${placeName(myApp.base)}</dd>
    <dt>Carries</dt><dd>${(Array.isArray(myApp.serves)?myApp.serves:[]).map(s=>s==='student'?'Students':'Workers').join(' and ')}</dd>
    <dt>Sent</dt><dd>${fmtDate(myApp.submittedAt)}</dd></dl><p class="muted">${note}</p>${st==='pending'?steps:''}`;
}

function renderAdmin(){
  if(!isAdmin) return;
  const live=new Set(regRiders.map(r=>r.id));
  const order={pending:0,approved:1,suspended:2,rejected:3};
  const list=[...apps].sort((a,b)=>(order[stCls(a.status)]-order[stCls(b.status)]) || String(b.submittedAt||'').localeCompare(String(a.submittedAt||'')));
  $('#appCount').textContent=apps.filter(a=>stCls(a.status)==='pending').length+' pending · '+regRiders.length+' live';
  $('#appList').innerHTML = list.length ? list.map(a=>{
    const st=stCls(a.status), id=esc(a.id), isLive=live.has(a.id);
    const serves=(Array.isArray(a.serves)?a.serves:[]).map(s=>s==='student'?'students':'workers').join(' & ');
    const ph=safePhoto(a.photo);
    return `<article class="app-row">${ph?`<img class="thumb" src="${ph}" alt="Photo of ${esc(String(a.name||'applicant'))}">`:'<div class="thumb" title="No photo"></div>'}<div class="app-main"><b>${esc(String(a.name||'Unnamed'))}</b><span class="status ${st}">${STATUS_LABEL[st]}</span>${isLive?'<span class="status approved">Live</span>':''}
      <div class="muted"><span class="mono">${esc(String(a.phone||''))}</span> · <span class="mono">${esc(String(a.plate||''))}</span> · waits at ${placeName(a.base)} · carries ${serves} · ${YEARS_LABEL[a.years]||''} riding · sent ${fmtDate(a.submittedAt)}</div></div>
      <div class="app-actions">${isLive?`<button type="button" data-adm="remove" data-id="${id}">Remove</button>`:`<button type="button" class="ok" data-adm="approve" data-id="${id}">Approve</button>`}${!isLive&&st!=='rejected'?`<button type="button" data-adm="reject" data-id="${id}">Reject</button>`:''}</div></article>`;
  }).join('') : '<p class="muted">No applications yet. When riders fill in the Become a rider form, they appear here.</p>';
}
$('#appList').addEventListener('click',async e=>{
  const b=e.target.closest('[data-adm]'); if(!b||!db) return;
  const id=b.dataset.id, a=apps.find(x=>x.id===id); if(!a) return;
  b.disabled=true; $('#admMsg').textContent='';
  try{
    if(b.dataset.adm==='approve'){
      await db.doc('riders/'+id).set({name:a.name,phone:a.phone,plate:a.plate,base:a.base,serves:a.serves,photo:safePhoto(a.photo),rating:5,trips:0,approvedAt:new Date().toISOString()});
      await db.doc('applications/'+id).update({status:'approved'});
    } else if(b.dataset.adm==='reject'){
      await db.doc('applications/'+id).update({status:'rejected'});
    } else if(b.dataset.adm==='remove'){
      await db.doc('riders/'+id).delete();
      await db.doc('applications/'+id).update({status:'suspended'});
    }
  }catch(err){ $('#admMsg').textContent='That change did not save ('+((err&&err.code)||'error')+'). Try again.'; }
  b.disabled=false;
});

function rebuildFleet(){
  const prev={}; regFleet.forEach(f=>prev[f.id]=f);
  regFleet = regRiders.map(r=>{
    const f = prev[r.id] || {id:r.id, busy:false, node:PLACES[r.base]?r.base:'central', trips:Number(r.trips)||0};
    // A rider's Rider mode check-in moves them on the map, unless they are carrying someone right now.
    const pos=posMap[r.id];
    f.online=!!(pos&&pos.online);
    if(pos && PLACES[pos.node] && !f.busy && String(pos.at||'')>(f.posAt||'')){ f.node=pos.node; f.posAt=String(pos.at||''); }
    // Names, plates and phones come from riders, so escape them before they reach any HTML.
    return Object.assign(f,{n:esc(String(r.name||'Rider')), r:Number(r.rating)||5, p:esc(String(r.plate||'')), ph:esc(String(r.phone||'')),
      serves:Array.isArray(r.serves)&&r.serves.length?r.serves:['student','worker'], photo:safePhoto(r.photo)});
  });
  // Passengers are matched with approved riders who are online; the demo riders stand in when none are.
  const live = regFleet.filter(f=>f.online||f.busy);
  fleet = live.length ? live : demoFleet;
  drawIdle();
}

/* ---------- Rider mode ----------
   positions/<rider id> = { online, node, at, trail: [{node, at, kind: online|offline|checkin}] }
   Each rider writes only their own document; everyone can read where online riders are. */
let posMap={}, isRiderMe=false, rmTouched=false, posWrite=Promise.resolve();
const MOVE_TXT={online:'Went online at',offline:'Went offline at',checkin:'Checked in at',
  assigned:'Took a trip request, starting from',pickup:'Picked up a passenger at',dropoff:'Dropped off a passenger at'};
const fmtTime = s => { const d=new Date(s); return isNaN(d)?'':d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); };
const initials = n => String(n||'').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
const myPos = () => (myId && posMap[myId]) || null;
function moveItem(e){
  const kind=MOVE_TXT[e.kind]?e.kind:'checkin';
  return `<li class="k-${kind}"><time>${fmtTime(e.at)}</time><i></i><span>${MOVE_TXT[kind]} <b>${PLACES[e.node].name}</b>${kind==='dropoff'&&e.fare?` · ${ghs(e.fare)}`:''}</span></li>`;
}
function rmMsg(t,k){ const m=$('#rmMsg'); m.textContent=t; m.className='formmsg '+(k||''); }
function renderRiderMode(){
  isRiderMe=!!(myId && regRiders.some(r=>r.id===myId));
  $('#tabRider').hidden=!isRiderMe;
  if(!isRiderMe){ if(!$('#riderView').hidden) showView('register'); return; }
  const p=myPos(), online=!!(p&&p.online), me=regRiders.find(r=>r.id===myId)||{};
  $('#rmStatus').textContent=online?'Online':'Offline';
  $('#rmStatus').className='status '+(online?'approved':'rejected');
  $('#rmToggle').textContent=online?'Go offline':'Go online';
  const sel=$('#rmPlace');
  if(!sel.options.length) sel.innerHTML=IDS.map(id=>`<option value="${id}">${PLACES[id].name}</option>`).join('');
  if(!rmTouched) sel.value=(p&&PLACES[p.node])?p.node:(PLACES[me.base]?me.base:'central');
  const today=dayKey(new Date());
  const trail=((p&&Array.isArray(p.trail))?p.trail:[]).filter(t=>t&&PLACES[t.node]&&dayKey(new Date(t.at))===today).reverse();
  $('#rmTrail').innerHTML = trail.length ? `<ol class="timeline">${trail.map(moveItem).join('')}</ol>`
    : '<p class="muted">Nothing recorded today. Go online and update your location as you move around.</p>';
}
function savePos(mutate, okText){
  if(!db||!myId) return rmMsg('Rider mode needs you to be logged in.','err');
  posWrite=posWrite.then(async()=>{
    const cur=myPos()?JSON.parse(JSON.stringify(myPos())):{online:false,trail:[]};
    if(!Array.isArray(cur.trail)) cur.trail=[];
    mutate(cur); cur.trail=cur.trail.slice(-80);
    posMap[myId]=cur; rebuildFleet(); renderRiderMode(); renderTracking();
    await db.doc('positions/'+myId).set(cur);
    rmMsg(okText,'ok');
  }).catch(()=>rmMsg('Could not save. Check your connection and try again.','err'));
}
$('#rmPlace').addEventListener('change',()=>{ rmTouched=true; });
$('#rmToggle').addEventListener('click',()=>{
  const node=$('#rmPlace').value, on=!(myPos()&&myPos().online), at=new Date().toISOString();
  savePos(c=>{ c.online=on; c.node=node; c.at=at; c.trail.push({node,at,kind:on?'online':'offline'}); },
    on?`You are online at ${PLACES[node].name}. Nearby passengers can now be matched with you.`:'You are offline. You will not get new passengers.');
});
$('#rmUpdate').addEventListener('click',()=>{
  const node=$('#rmPlace').value, at=new Date().toISOString();
  savePos(c=>{ c.node=node; c.at=at; c.trail.push({node,at,kind:'checkin'}); }, `Location updated: ${PLACES[node].name}.`);
});

/* ---------- Rider tracking (admin) ---------- */
let trkSel=null, trkDay=null, trkLayers=null;
function trackDirectory(){
  const dir={};
  regRiders.forEach(r=>{ dir[r.id]={name:esc(String(r.name||'Rider')), plate:esc(String(r.plate||'')), photo:safePhoto(r.photo), demo:false}; });
  return dir;
}
function trackEvents(dir){
  const ev={};
  const push=(id,e)=>{ if(!e.at||!PLACES[e.node]) return; (ev[id]=ev[id]||[]).push(e); };
  Object.keys(posMap).forEach(id=>{ if(!dir[id]) return; const p=posMap[id];
    (Array.isArray(p&&p.trail)?p.trail:[]).forEach(t=>{ if(t) push(id,{at:String(t.at||''),node:t.node,kind:['online','offline','checkin'].includes(t.kind)?t.kind:'checkin'}); }); });
  allRides.forEach(doc=>(Array.isArray(doc&&doc.recent)?doc.recent:[]).forEach(r=>{
    if(!r||typeof r.rider!=='string') return;
    const id=r.rider;
    if(!dir[id]){ const d=demoFleet.find(f=>f.id===id); if(!d) return; dir[id]={name:d.n, plate:d.p, photo:null, demo:true}; }
    push(id,{at:String(r.assignedAt||r.at||''),node:r.riderFrom,kind:'assigned'});
    push(id,{at:String(r.boardedAt||r.at||''),node:r.from,kind:'pickup'});
    push(id,{at:String(r.at||''),node:r.to,kind:'dropoff',fare:Number(r.fare)||0});
  }));
  Object.values(ev).forEach(a=>a.sort((x,y)=>x.at.localeCompare(y.at)));
  return ev;
}
function renderTracking(){
  if(!isAdmin) return;
  const svgT=$('#trkMap');
  if(!trkLayers){
    trkLayers=drawBase(svgT,false); trkLayers.dots=el('g',{},svgT);
    const now=new Date(); let o='';
    for(let i=0;i<7;i++){ const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i);
      o+=`<option value="${dayKey(d)}">${i===0?'Today':i===1?'Yesterday':d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</option>`; }
    $('#trkDay').innerHTML=o; trkDay=dayKey(now);
  }
  const dir=trackDirectory(), ev=trackEvents(dir);
  const isOn=id=>!!(posMap[id]&&posMap[id].online);
  const lastOf=id=>(ev[id]||[]).slice(-1)[0];
  const ids=Object.keys(dir).sort((a,b)=>(isOn(b)-isOn(a)) || String((lastOf(b)||{}).at||'').localeCompare(String((lastOf(a)||{}).at||'')));
  if(!trkSel||!dir[trkSel]) trkSel=ids[0]||null;
  $('#trkCount').textContent=`${ids.filter(isOn).length} online · ${ids.filter(id=>!dir[id].demo).length} approved`;
  $('#trkList').innerHTML = ids.length ? ids.map(id=>{
    const r=dir[id], last=lastOf(id), st=r.demo?['Demo','cash']:isOn(id)?['Online','approved']:['Offline','rejected'];
    return `<button type="button" class="trk-row ${id===trkSel?'on':''}" data-id="${esc(id)}">${r.photo?`<img class="ava" src="${r.photo}" alt="">`:`<span class="ava">${initials(r.name)}</span>`}
      <span><b>${r.name}</b><small>${last?`Last seen at ${PLACES[last.node].name} · ${fmtWhen(last.at)}`:'No movements yet'}</small></span><span class="status ${st[1]}">${st[0]}</span></button>`;
  }).join('') : '<p class="muted">No riders to track yet. Approve riders, and once they go online in Rider mode or carry passengers, their movements appear here.</p>';

  // Map: each rider's last known place, plus the selected rider's route for the chosen day.
  const dots=trkLayers.dots; dots.innerHTML=''; trkLayers.route.innerHTML='';
  const dayEv=trkSel?(ev[trkSel]||[]).filter(e=>dayKey(new Date(e.at))===trkDay):[];
  let km=0;
  if(dayEv.length){
    const nodes=dayEv.map(e=>e.node).filter((n,i,a)=>i===0||n!==a[i-1]);
    let path=[nodes[0]];
    for(let i=1;i<nodes.length;i++){ const r=route(nodes[i-1],nodes[i]); km+=r.km; path=path.concat(r.path.slice(1)); }
    if(path.length>1) el('polyline',{points:polyPts(path),class:'trk-trail'},trkLayers.route);
    el('circle',{cx:PX(nodes[0]),cy:PY(nodes[0]),r:8,class:'trk-start'},trkLayers.route);
  }
  const perNode={};
  ids.forEach(id=>{
    const last=lastOf(id); if(!last) return;
    const k=perNode[last.node]=(perNode[last.node]||0)+1, x=PX(last.node)+(k-1)*24, y=PY(last.node)-24;
    const cls=id===trkSel?' sel':(!dir[id].demo&&!isOn(id))?' off':'';
    const g=el('g',{},dots); el('circle',{cx:x,cy:y,r:13,class:'trk-dot'+cls},g);
    const t=el('text',{x,y:y+4,'text-anchor':'middle',class:'trk-lab'+cls},g); t.textContent=initials(dir[id].name);
  });

  // Timeline for the selected rider.
  if(!trkSel){ $('#trkTitle').textContent=''; $('#trkTimeline').innerHTML=''; return; }
  const dayLabel=$('#trkDay').selectedOptions[0]?$('#trkDay').selectedOptions[0].textContent:'';
  $('#trkTitle').innerHTML=`${dir[trkSel].name} · ${esc(dayLabel)}`;
  const trips=dayEv.filter(e=>e.kind==='dropoff').length;
  $('#trkTimeline').innerHTML = dayEv.length
    ? `<p class="trk-sum">${trips} ${trips===1?'trip':'trips'} · about ${km.toFixed(1)} km between recorded places</p><ol class="timeline">${dayEv.map(moveItem).join('')}</ol>`
    : '<p class="muted">No movements recorded for this rider on this day.</p>';
}
$('#trkList').addEventListener('click',e=>{ const b=e.target.closest('.trk-row'); if(!b) return; trkSel=b.dataset.id; renderTracking(); });
$('#trkDay').addEventListener('change',()=>{ trkDay=$('#trkDay').value; renderTracking(); });

function dataOff(msg){ notice(msg); setFormEnabled(false); renderMyApp(); renderTrips(); }
async function initData(){
  renderMyApp();
  const C=window.backend;
  if(!C||!C.use) return dataOff('Could not connect to the Campucab database. Check your connection, then reload the page.');
  const [d,u]=await Promise.all([C.use('db').catch(()=>null), C.use('user').catch(()=>null)]);
  db=d;
  if(!db) return dataOff('Log in to register as a rider. Your application is tied to your account.');
  if(u){ myId=await u.id(); isAdmin=await u.canEdit(); }
  $('#tabAdmin').hidden=!isAdmin;
  db.collection('riders').onSnapshot(s=>{ regRiders=s.docs.map(x=>Object.assign({id:x.id},x.data())); rebuildFleet(); renderAdmin(); renderMyApp(); renderRiderMode(); renderTracking(); },
    e=>console.warn('riders feed stopped:',e&&e.code));
  db.collection('positions').onSnapshot(s=>{ const m={}; s.docs.forEach(x=>{ m[x.id]=x.data(); }); posMap=m; rebuildFleet(); renderRiderMode(); renderTracking(); },
    e=>console.warn('positions feed stopped:',e&&e.code));
  if(myId){
    db.doc('applications/'+myId).onSnapshot(s=>{ myApp=s.exists?s.data():null; renderMyApp(); if(myApp&&!formDirty) fillForm(myApp); },
      e=>console.warn('application feed stopped:',e&&e.code));
  } else {
    dataOff('Log in to register as a rider. Your application is tied to your account.');
  }
  if(isAdmin){
    db.collection('applications').onSnapshot(s=>{ apps=s.docs.map(x=>Object.assign({id:x.id},x.data())); renderAdmin(); },
      e=>console.warn('applications feed stopped:',e&&e.code));
    db.collection('rides').onSnapshot(s=>{ allRides=s.docs.map(x=>x.data()); renderStats(); renderTracking(); },
      e=>console.warn('rides feed stopped:',e&&e.code));
    renderAdmin(); renderStats(); renderTracking();
    if(location.hash==='#admin') showView('admin');
  }
  if(myId){
    db.doc('rides/'+myId).onSnapshot(s=>{ if(!s.metadata.hasPendingWrites){ myRides=s.exists?s.data():null; ridesLoaded=true; renderTrips(); } },
      e=>console.warn('my rides feed stopped:',e&&e.code));
    db.doc('data/users/'+myId+'/profile').get().then(s=>{
      const m=s.exists&&s.data().momo;
      if(m&&MOMO_NETS[m.network]&&normPhone(String(m.number||''))) momoSaved={network:m.network,number:normPhone(String(m.number))};
    }).catch(()=>{});
  }
  renderMyApp(); renderTrips();
}

/* ---------- Ride records ----------
   rides/<passenger id> = { days: { "YYYY-MM-DD": {rides, student, worker, cash, momo, revenue} }, recent: [last 30 trips] }
   Each passenger writes only their own document; admins read them all to build the daily chart. */
let myRides=null, allRides=[], rideWrite=Promise.resolve();
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const blankDay = () => ({rides:0,student:0,worker:0,cash:0,momo:0,revenue:0,fees:0});
// Campucab keeps 10% of every fare as a service charge, rounded to the pesewa; the rider gets the rest.
// Change SERVICE_RATE to change the charge everywhere. Past trips keep the charge they were recorded with.
const SERVICE_RATE = 0.10;
const SERVICE_PCT = Math.round(SERVICE_RATE*100)+'%';
function serviceFee(fare){ return Math.round(fare*SERVICE_RATE*100)/100; }
function saveRides(mutate){
  if(!db||!myId) return;
  rideWrite = rideWrite.then(async()=>{
    const cur = myRides ? JSON.parse(JSON.stringify(myRides)) : {};
    if(!cur.days||typeof cur.days!=='object') cur.days={};
    if(!Array.isArray(cur.recent)) cur.recent=[];
    mutate(cur); cur.updatedAt=new Date().toISOString();
    myRides=cur; renderTrips();
    await db.doc('rides/'+myId).set(cur);
  }).catch(e=>console.warn('ride not saved:',e&&e.code));
}
function recordRide(r){
  saveRides(cur=>{
    const d=cur.days[r.day]||(cur.days[r.day]=blankDay());
    d.rides=(d.rides||0)+1; d[r.cat]=(d[r.cat]||0)+1; d[r.pay]=(d[r.pay]||0)+1;
    d.revenue=Math.round(((d.revenue||0)+r.fare)*100)/100;
    d.fees=Math.round(((d.fees||0)+r.fee)*100)/100;
    cur.recent.unshift(r); cur.recent=cur.recent.slice(0,100);
  });
}
function updateRide(id,patch){ saveRides(cur=>{ const r=cur.recent.find(x=>x.id===id); if(r) Object.assign(r,patch); }); }
/* ---------- My trips ---------- */
let ridesLoaded=false;
const PAY_LABEL={paid:['Paid by MoMo','approved'],cash:['Cash','cash'],awaiting:['MoMo not completed','pending'],failed:['MoMo failed','rejected']};
const fmtWhen = s => { const d=new Date(s); return isNaN(d)?'':d.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
function cleanTrip(r){
  if(!r||typeof r!=='object'||!PLACES[r.from]||!PLACES[r.to]) return null;
  const status=PAY_LABEL[r.status]?r.status:(r.pay==='momo'?'awaiting':'cash');
  return {id:String(r.id||''), at:String(r.at||''), from:r.from, to:r.to, cat:r.cat==='worker'?'worker':'student', type:r.type==='drop'?'drop':'shared',
    fare:Number(r.fare)||0, fee:r.fee!=null&&Number.isFinite(Number(r.fee))?Number(r.fee):0 /* trips from before the service charge have none */, status, network:MOMO_NETS[r.network]?r.network:null, ref:String(r.ref||'')};
}
function renderTrips(){
  const list=$('#tripList'); if(!list) return;
  if(!db||!myId){
    $('#tripTiles').innerHTML=''; $('#tripCount').textContent='';
    list.innerHTML='<p class="muted">Log in to see your trips. Trips are saved to your account when you finish a ride.</p>'; return;
  }
  if(!ridesLoaded&&!myRides){ list.innerHTML='<p class="muted">Loading your trips…</p>'; return; }
  const all=((myRides&&Array.isArray(myRides.recent))?myRides.recent:[]).map(cleanTrip).filter(Boolean);
  const now=new Date(), mKey=dayKey(now).slice(0,7);
  const spent=all.reduce((a,t)=>a+t.fare,0), month=all.filter(t=>dayKey(new Date(t.at)).slice(0,7)===mKey);
  $('#tripCount').textContent=all.length+(all.length===1?' trip':' trips')+(all.length>=100?' (latest 100)':'');
  $('#tripTiles').innerHTML=[['Trips',all.length,'saved to your account'],['Spent',ghs(spent),'on all saved trips'],
    ['This month',ghs(month.reduce((a,t)=>a+t.fare,0)),month.length+(month.length===1?' trip':' trips')],
    ['Paid by MoMo',all.filter(t=>t.status==='paid').length,'trips']].map(t=>`<div class="tile"><span>${t[0]}</span><b>${t[1]}</b><small>${t[2]}</small></div>`).join('');
  const q=$('#tripSearch').value.trim().toLowerCase(), pay=$('#tripPay').value, cat=$('#tripCat').value;
  const shown=all.filter(t=>{
    if(pay&&t.status!==pay) return false;
    if(cat&&t.cat!==cat) return false;
    if(!q) return true;
    const hay=[PLACES[t.from].name,PLACES[t.to].name,fmtWhen(t.at),t.ref,t.network?MOMO_NETS[t.network].name:'',PAY_LABEL[t.status][0]].join(' ').toLowerCase();
    return hay.includes(q);
  });
  if(!all.length){ list.innerHTML='<p class="muted">No trips yet. Book a ride on the <b>Book a ride</b> tab and it will appear here when you arrive.</p>'; return; }
  if(!shown.length){ list.innerHTML='<p class="muted">No trips match that search. Clear the search or change the filters.</p>'; return; }
  list.innerHTML=shown.map(t=>{
    const [pl,pc]=PAY_LABEL[t.status];
    const momo=t.status==='paid'&&t.network?` · ${MOMO_NETS[t.network].name}${t.ref?` · ref <span class="mono">${esc(t.ref)}</span>`:''}`:'';
    return `<article class="trow"><div><div class="route">${PLACES[t.from].name}<span>→</span>${PLACES[t.to].name}</div>
      <div class="meta">${fmtWhen(t.at)}<br><span class="status ${pc}">${pl}</span>${t.cat==='student'?'Student':'Worker'} · ${t.type==='drop'?'Drop':'Shared seat'}${momo}<br>Includes ${ghs(t.fee)} service charge · rider received ${ghs(Math.round((t.fare-t.fee)*100)/100)}</div></div>
      <div class="side-r"><span class="fare">${ghs(t.fare)}</span><button type="button" class="again" data-from="${t.from}" data-to="${t.to}">Book again</button></div></article>`;
  }).join('');
}
['#tripSearch','#tripPay','#tripCat'].forEach(s=>$(s).addEventListener('input',renderTrips));
$('#tripList').addEventListener('click',e=>{
  const b=e.target.closest('.again'); if(!b||!PLACES[b.dataset.from]||!PLACES[b.dataset.to]) return;
  showView('ride');
  if(isActive()) return bot('You have a ride in progress. Say <b>cancel ride</b> first if you want to book another.');
  if(state==='done') resetDraft();
  draft.pickup=b.dataset.from; draft.dest=b.dataset.to;
  addMsg('me',`Book again: ${PLACES[draft.pickup].name} to ${PLACES[draft.dest].name}`);
  afterDraft(false);
});

function saveMomo(){ if(db&&myId) db.doc('data/users/'+myId+'/profile').set({momo:momoSaved}).catch(()=>{}); }

function renderStats(){
  const box=$('#rideStats'); if(!box||!isAdmin) return;
  const now=new Date(), keys=[];
  for(let i=13;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i); keys.push({k:dayKey(d),d}); }
  const agg={}; keys.forEach(({k})=>agg[k]=blankDay());
  allRides.forEach(doc=>{ const ds=(doc&&doc.days)||{}; keys.forEach(({k})=>{ const v=ds[k]; if(v&&typeof v==='object') Object.keys(agg[k]).forEach(f=>agg[k][f]+=safeNum(v[f])); }); });
  const last7=keys.slice(-7).map(x=>agg[x.k]), sum=f=>last7.reduce((a,v)=>a+v[f],0);
  const today=agg[keys[13].k], r7=sum('rides'), m7=sum('momo'), rev7=Math.round(sum('revenue')*100)/100, fee7=Math.round(sum('fees')*100)/100;
  const tiles=[['Today',today.rides,today.rides===1?'ride':'rides'],['Last 7 days',r7,r7===1?'ride':'rides'],
    ['Fares, last 7 days',ghs(rev7),`incl. ${ghs(fee7)} service charge`],['Paid by MoMo',r7?Math.round(m7/r7*100)+'%':'–','of rides, last 7 days']];
  const top=Math.max(4,Math.ceil(Math.max(...keys.map(x=>agg[x.k].rides))/2)*2);
  const W=700,H=220,L=34,B=28,T=12, cw=(W-L-8)/14, bw=Math.min(28,cw*0.6), y=v=>H-B-(v/top)*(H-B-T);
  let g='';
  [0,top/2,top].forEach(v=>{ g+=`<line x1="${L}" x2="${W-8}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" class="axis">${v}</text>`; });
  keys.forEach(({k,d},i)=>{
    const a=agg[k], cx=L+cw*i+cw/2, x=cx-bw/2;
    let segs='';
    if(a.student) segs+=`<rect x="${x}" y="${y(a.student)}" width="${bw}" height="${y(0)-y(a.student)}" rx="3" class="b-st"/>`;
    if(a.worker){ const h=y(0)-y(a.worker)-(a.student?2:0); if(h>0) segs+=`<rect x="${x}" y="${y(a.student+a.worker)}" width="${bw}" height="${h}" rx="3" class="b-wk"/>`; }
    if(i===13&&a.rides) segs+=`<text x="${cx}" y="${y(a.rides)-6}" text-anchor="middle" class="val">${a.rides}</text>`;
    g+=`<g class="bar-g" data-k="${k}"><rect x="${L+cw*i}" y="${T}" width="${cw}" height="${H-B-T}" class="hit"/>${segs}<text x="${cx}" y="${H-8}" text-anchor="middle" class="axis${i===13?' strong':''}">${i===13?'Today':d.getDate()}</text></g>`;
  });
  const fmtDay=d=>d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  const rows=[...keys].reverse().map(({k,d})=>{ const a=agg[k]; return `<tr><td>${fmtDay(d)}</td><td>${a.rides}</td><td>${a.student}</td><td>${a.worker}</td><td>${a.cash}</td><td>${a.momo}</td><td>${ghs(a.revenue)}</td><td>${ghs(a.fees)}</td><td>${ghs(Math.round((a.revenue-a.fees)*100)/100)}</td></tr>`; }).join('');
  box.innerHTML=`<div class="tiles">${tiles.map(t=>`<div class="tile"><span>${t[0]}</span><b>${t[1]}</b><small>${t[2]}</small></div>`).join('')}</div>
    <div class="legend"><span><i style="background:var(--brand)"></i>Students</span><span><i style="background:var(--accent)"></i>Workers</span></div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Completed rides per day for the last 14 days">${g}</svg><div class="tip" hidden></div></div>
    ${r7||allRides.length?'':'<p class="muted">No completed rides yet. Each finished trip is counted here.</p>'}
    <details><summary>Show as table</summary><div class="tablewrap"><table class="days"><thead><tr><th>Day</th><th>Rides</th><th>Students</th><th>Workers</th><th>Cash</th><th>MoMo</th><th>Fares</th><th>Service charge</th><th>To riders</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  const chart=box.querySelector('.chart'), tip=chart.querySelector('.tip');
  chart.addEventListener('mousemove',e=>{
    const gEl=e.target.closest('.bar-g'); if(!gEl){ tip.hidden=true; return; }
    const kd=keys.find(x=>x.k===gEl.dataset.k), a=agg[kd.k], r=chart.getBoundingClientRect();
    tip.innerHTML=`<b>${fmtDay(kd.d)}</b><br>${a.rides} ${a.rides===1?'ride':'rides'} · ${a.student} students · ${a.worker} workers<br>${ghs(a.revenue)} fares · ${ghs(a.fees)} service charge<br>${a.momo} MoMo, ${a.cash} cash`;
    tip.style.left=Math.min(Math.max(e.clientX-r.left,90),r.width-90)+'px'; tip.style.top=(e.clientY-r.top-10)+'px'; tip.hidden=false;
  });
  chart.addEventListener('mouseleave',()=>{ tip.hidden=true; });
}

drawMap(); renderChips();
if(location.hash==='#register') showView('register');
/* ---------- Security hardening (lookup tables) ----------
   Stored data is written by other people, so a place, status or network name could be anything.
   Without a prototype, keys like "constructor" or "__proto__" never match a table entry. */
[PLACES,MOMO_NETS,VIEWS,STATUS_LABEL,YEARS_LABEL,MOVE_TXT,PAY_LABEL].forEach(o=>Object.setPrototypeOf(o,null));
/* Counts from other people's records: only finite, non-negative numbers, capped, reach the stats. */
function safeNum(n){ n=Number(n); return Number.isFinite(n)&&n>0 ? Math.min(n,1e6) : 0; }
initData();
bot('Akwaaba! I\'m Ama, your Campucab assistant for Sunyani and nearby towns. Pick <b>Student</b> (10% off with your student ID) or <b>Worker</b> above, then tell me where you\'re going, like <i>“Take me from Penkwase to UENR”</i>, or tap a place on the map.',200);
})();
