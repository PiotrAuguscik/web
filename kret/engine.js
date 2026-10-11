export const WIDTH=3200,HEIGHT=1552,CELL=8,COLS=WIDTH/CELL,ROWS=HEIGHT/CELL,RADIUS=14;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const surface=x=>310+Math.sin(x/170)*15+Math.sin(x/410)*18;
export const zone=x=>x<940?0:x<1510?1:x<2110?2:x<2740?3:4;
export const ZONES=['Ogród korzeni','Piasek pod łąką','Zakopane ruiny','Podziemny strumień','Jaskinia grzybów'];
function rng(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function pack(a){let s='';for(let i=0;i<a.length;i+=8){let n=0;for(let j=0;j<8;j++)if(a[i+j])n|=1<<j;s+=n.toString(16).padStart(2,'0');}return s;}
function unpack(s,n){const a=new Uint8Array(n);for(let i=0;i<s.length;i+=2){const b=parseInt(s.slice(i,i+2),16);for(let j=0;j<8;j++)a[i*4+j]=b>>j&1;}return a;}
export class World{
  constructor(seed=20261011){
    this.seed=seed;this.random=rng(seed);this.time=0;this.p={x:420,y:540};this.home={x:420,y:540};this.health=100;this.energy=100;this.hunger=86;this.food=3;this.wood=5;this.treasure=0;this.stash=0;this.claws=0;this.hearing=0;this.sprintUnlocked=false;this.cooldown=0;this.pulse=0;this.peek=0;this.noise=0;this.invincible=0;this.downed=false;this.won=false;this.facing={x:1,y:0};this.events=[];this.dug=0;this.moved=0;this.fillCount=0;this.waterClock=0;this._revealX=-999;this._revealY=-999;
    this.open=new Uint8Array(COLS*ROWS);this.seen=new Uint8Array(COLS*ROWS);this.water=new Float32Array(COLS*ROWS);this.openSet=new Set();this.cuts=[];this.sight=[];this.path=[{...this.p}];this.exits=[420];this.rooms=[{x:420,y:540,type:'home'}];this.drains=[];
    this.rocks=[{x:1080,y:580,r:53},{x:1360,y:900,r:62},{x:1670,y:720,r:44},{x:2100,y:1080,r:48},{x:2670,y:600,r:66},{x:2950,y:1180,r:73}];
    for(let i=0;i<32;i++){const x=960+this.random()*2120,y=480+this.random()*940;this.rocks.push({x,y,r:12+this.random()*13,small:true});}
    this.roots=[];for(const tx of [210,620,810,1190,2600])for(let branch=0;branch<3;branch++){let old={x:tx,y:surface(tx)};for(let i=1;i<7;i++){const next={x:tx+(branch-1)*i*20+Math.sin(i*2+tx)*20,y:surface(tx)+i*45};this.roots.push({a:old,b:next,w:Math.max(3,11-i)});old=next;}}
    this.discoveries=[{x:585,y:585,type:'coin',title:'Moneta ogrodnika',found:false},{x:850,y:780,type:'boot',title:'But pełen liści',found:false},{x:1240,y:650,type:'spring',title:'Bursztyn pod łąką',found:false},{x:1770,y:860,type:'ruin',title:'Zapomniana studnia',found:false},{x:2470,y:1150,type:'cave',title:'Źródło w głębi ziemi',found:false},{x:2870,y:890,type:'mushroom',title:'Świecący ogród',found:false}];
    this.kids=[{name:'Pikuś',x:740,y:670,state:'waiting',pathIndex:0},{name:'Figa',x:1860,y:1030,state:'waiting',pathIndex:0},{name:'Tuptuś',x:2840,y:950,state:'waiting',pathIndex:0}];
    this.rocks=this.rocks.filter(r=>!this.kids.some(k=>distance(r,k)<r.r+100)&&!this.discoveries.some(d=>distance(r,d)<r.r+55));
    this.carve(420,540,68);for(let y=surface(420)-22;y<540;y+=14)this.carve(420+Math.sin(y/60)*9,y,25);
    for(const [x,y,r] of [[730,670,58],[850,780,49],[1240,650,58],[1750,880,78],[1810,950,58],[1860,1030,72],[2200,920,64],[2290,1010,64],[2450,1130,80],[2780,930,74],[2870,960,80]])this.carve(x,y,r);
    for(let i=0;i<=18;i++)this.carve(1740+i*10,860+i*9,27);
    for(let i=0;i<=23;i++)this.carve(2160+i*13,870+i*12,29);
    this.foods=[];for(let i=0;i<260;i++){const x=100+this.random()*3000,y=surface(x)+80+this.random()*1020;if(!this.rockAt(x,y))this.foods.push({x,y,type:this.random()<.2?'larva':'worm',phase:this.random()*6});}
    for(const [x,y] of [[510,550],[580,610],[660,630],[780,685],[500,450],[345,585],[880,770]])this.foods.push({x,y,type:'larva',phase:0});
    for(let i=0;i<24;i++){const x=120+this.random()*2900;this.foods.push({x,y:surface(x)-14,type:i%3?'worm':'leaf',phase:i});}
    this.predators=[{type:'fox',x:1260,y:surface(1260)-17,dir:-1,alert:0,warning:0,attack:0},{type:'fox',x:2580,y:surface(2580)-17,dir:1,alert:0,warning:0,attack:0},{type:'owl',x:1470,y:surface(1470)-145,dir:1,alert:0,warning:0,attack:0},{type:'snake',x:1780,y:900,angle:0,alert:0,warning:0,attack:0},{type:'snake',x:2260,y:970,angle:1,alert:0,warning:0,attack:0}];
    for(const i of this.openSet){const x=i%COLS*CELL,y=Math.floor(i/COLS)*CELL;if(x>2160&&x<2560&&y>1060||x>1800&&x<1920&&y>1080)this.water[i]=.68;}this.reveal();
  }
  idx(x,y){return Math.floor(y/CELL)*COLS+Math.floor(x/CELL);}
  valid(x,y){return x>=35&&x<=WIDTH-35&&y>=20&&y<=HEIGHT-40;}
  isOpen(x,y){return this.valid(x,y)&&(y<surface(x)||this.open[this.idx(x,y)]===1);}
  rockAt(x,y){return this.rocks.find(r=>distance(r,{x,y})<r.r+RADIUS-2);}
  rootAt(x,y){return this.roots.some(r=>{const vx=r.b.x-r.a.x,vy=r.b.y-r.a.y,t=clamp(((x-r.a.x)*vx+(y-r.a.y)*vy)/(vx*vx+vy*vy),0,1);return Math.hypot(x-r.a.x-vx*t,y-r.a.y-vy*t)<r.w+16;});}
  event(text,type='info'){this.events.push({text,type});}
  paint(x,y,r,kind=1,record=true){
    if(record)this.cuts.push({x,y,r,kind});
    const x0=Math.max(0,Math.floor((x-r)/CELL)),x1=Math.min(COLS-1,Math.ceil((x+r)/CELL)),y0=Math.max(0,Math.floor((y-r)/CELL)),y1=Math.min(ROWS-1,Math.ceil((y+r)/CELL));
    for(let gy=y0;gy<=y1;gy++)for(let gx=x0;gx<=x1;gx++)if(Math.hypot(gx*CELL+CELL/2-x,gy*CELL+CELL/2-y)<=r){const i=gy*COLS+gx;this.open[i]=kind?1:0;if(kind)this.openSet.add(i);else{this.openSet.delete(i);this.water[i]=0;}}
  }
  carve(x,y,r,record=true){const last=this.cuts[this.cuts.length-1];if(record&&last&&last.kind===1&&last.r===r&&distance(last,{x,y})<=3)return;this.paint(x,y,r,1,record);}
  reveal(){if(Math.hypot(this.p.x-this._revealX,this.p.y-this._revealY)<12)return;this._revealX=this.p.x;this._revealY=this.p.y;const r=185;this.sight.push({x:this.p.x,y:this.p.y,r});for(let gy=Math.max(0,Math.floor((this.p.y-r)/CELL));gy<Math.min(ROWS,Math.ceil((this.p.y+r)/CELL));gy++)for(let gx=Math.max(0,Math.floor((this.p.x-r)/CELL));gx<Math.min(COLS,Math.ceil((this.p.x+r)/CELL));gx++)if(Math.hypot(gx*CELL-this.p.x,gy*CELL-this.p.y)<r)this.seen[gy*COLS+gx]=1;}
  get surface(){return this.p.y<surface(this.p.x)+10;}
  get raining(){return this.time%240>115&&this.time%240<165;}
  get nearHome(){return distance(this.p,this.home)<80;}
  get rescued(){return this.kids.filter(k=>k.state==='home').length;}
  get nearRoom(){return this.rooms.find(r=>distance(r,this.p)<70);}
  get waterHere(){return this.water[this.idx(this.p.x,this.p.y)]||0;}
  get nextKid(){return this.kids.find(k=>k.state!=='home');}
  get interactable(){return this.kids.find(k=>k.state==='waiting'&&distance(k,this.p)<74)||this.rocks.find(r=>r.small&&distance(r,this.p)<r.r+45);}
  move(dx,dy,dt,sprint=false){
    const len=Math.hypot(dx,dy);if(len<.12){this.noise=Math.max(0,this.noise-dt);return;}
    dx/=Math.max(1,len);dy/=Math.max(1,len);this.facing={x:dx,y:dy};
    const ahead={x:this.p.x+dx*30,y:this.p.y+dy*30};let rock=this.rockAt(ahead.x,ahead.y);
    if(rock){if(rock.small&&this.claws>0){rock.hp=(rock.hp??.9)-dt*(this.claws+1);this.noise=1;if(rock.hp<=0){this.rocks.splice(this.rocks.indexOf(rock),1);this.wood++;this.event('Mały kamień skruszony. +1 materiał.');}else return;}else{this.blocked='rock';return;}}
    const digging=!this.isOpen(ahead.x,ahead.y),root=digging&&this.rootAt(ahead.x,ahead.y);this.blocked=null;
    if(digging&&this.energy<2){this.blocked='energy';return;}
    let speed=digging?(root?33:zone(this.p.x)===1?88:64)*(1+this.claws*.22):112;
    if(sprint&&this.sprintUnlocked&&this.energy>8&&!digging){speed=185;this.energy-=dt*8;}
    if(this.waterHere>.5)speed*=.65;
    const nx=clamp(this.p.x+dx*speed*dt,35,WIDTH-35),ground=surface(nx);let ny=clamp(this.p.y+dy*speed*dt,ground-RADIUS,HEIGHT-40);
    if(this.surface&&Math.abs(dy)<.1)ny=ground-RADIUS;
    if(this.rockAt(nx,ny)){this.blocked='rock';return;}
    if(digging){this.carve(nx,ny,25);this.dug+=dt*speed;this.energy=Math.max(0,this.energy-dt*(root?2.2:1.2));this.noise=1;if(root){this.rootGather=(this.rootGather||0)+dt;if(this.rootGather>1.4){this.rootGather=0;this.wood++;this.event('Korzeń daje materiał.','quiet');}}}
    const previousDepth=this.p.y-surface(this.p.x);this.moved+=Math.hypot(nx-this.p.x,ny-this.p.y);this.p={x:nx,y:ny};
    if((previousDepth<0&&ny>ground||previousDepth>=0&&ny<ground)&&!this.exits.some(x=>Math.abs(x-nx)<65)){this.exits.push(nx);this.event('Nowe wyjście. Masz kolejną drogę ucieczki.');}
    if(distance(this.p,this.path[this.path.length-1])>6){this.path.push({...this.p});if(this.path.length>4000){this.path.shift();for(const k of this.kids)k.pathIndex=Math.max(0,k.pathIndex-1);}}
    this.reveal();this.collect();
  }
  collect(){
    for(let i=this.foods.length-1;i>=0;i--){const f=this.foods[i];if(distance(f,this.p)<26){if(f.type==='leaf'){this.wood+=2;this.event('+2 liście do nory.','quiet');}else{this.food++;this.event('+1 jedzenie.','quiet');}this.foods.splice(i,1);}}
    for(const d of this.discoveries)if(!d.found&&distance(d,this.p)<55){d.found=true;this.treasure+=d.type==='coin'?2:1;this.wood+=d.type==='boot'?4:1;this.event(d.title+'! Błyskotka i materiały.','discovery');if(d.type==='spring')this.energy=100;}
    if(this.nearHome)for(const k of this.kids)if(k.state==='follow'&&distance(k,this.home)<100){k.state='home';this.health=100;this.energy=100;this.food+=2;if(this.rescued===1){this.claws=Math.max(1,this.claws);this.hearing=1;this.event(k.name+' wrócił do domu! Mocniejsze pazurki i dalszy nasłuch.','rescue');}else if(this.rescued===2){this.sprintUnlocked=true;this.event(k.name+' bezpiecznie w norze! Odblokowany zryw (Shift).','rescue');}else{this.won=true;this.event('Cała rodzina jest w domu. Udało się!','win');}}
  }
  interact(){const object=this.interactable;if(!object)return false;if(object.name){object.state='follow';object.pathIndex=this.path.length-1;this.event(object.name+' idzie za tobą. Poprowadź go tunelami do nory.','rescue');}else{const nx=object.x+this.facing.x*34,ny=object.y+this.facing.y*34;if(this.valid(nx,ny)&&!this.rocks.some(r=>r!==object&&distance(r,{x:nx,y:ny})<r.r+object.r)){object.x=nx;object.y=ny;this.energy=Math.max(0,this.energy-4);this.event('Przesuwasz mały kamień.','quiet');}}return true;}
  listen(){if(this.cooldown>0)return false;this.pulse=3.8;this.cooldown=5;this.peek=this.surface?0:this.p.y-surface(this.p.x)<42?2:0;this.event(this.peek?'Wystawiasz nos. Ciężkie kroki ostrzegają przed lisem.':'Nasłuch: zielone drgania — jedzenie, złote — mały kret, czerwone — zagrożenie.');return true;}
  eat(){if(!this.food){this.event('Brak jedzenia. Nasłuchuj drobnych drgań.');return false;}if(this.energy>95&&this.hunger>95)return false;this.food--;this.hunger=clamp(this.hunger+30,0,100);this.energy=clamp(this.energy+38,0,100);this.health=clamp(this.health+10,0,100);this.event('Mniam. Siły wracają.','quiet');return true;}
  seal(){const x=this.p.x-this.facing.x*58,y=this.p.y-this.facing.y*58;if(y<surface(x)+40||distance({x,y},this.home)<105||this.rooms.some(r=>distance(r,{x,y})<80)||this.kids.some(k=>distance(k,{x,y})<65)){this.event('Tu zostaw wolne przejście.');return false;}if(!this.isOpen(x,y)){this.event('Za tobą jest już ziemia.');return false;}this.paint(x,y,28,0);this.fillCount++;this.energy=Math.max(0,this.energy-5);this.event('Przejście za tobą zasypane. Możesz wykopać je ponownie.');return true;}
  build(type){
    if(type==='claws'){if(this.claws>=3){this.event('Masz najlepsze pazurki.');return false;}if(this.treasure<2&&this.wood<6){this.event('Potrzeba 2 błyskotek lub 6 materiałów.');return false;}if(this.treasure>=2)this.treasure-=2;else this.wood-=6;this.claws++;this.event('Lepsze pazurki: kopiesz szybciej i kruszysz małe kamienie.');return true;}
    if(type==='hearing'){if(this.treasure<1){this.event('Znajdź błyskotkę, żeby rozwinąć nasłuch.');return false;}this.treasure--;this.hearing++;this.event('Dalszy nasłuch. Łatwiej wyczujesz wołanie rodziny.');return true;}
    const relocate=type==='relocate',cost={bedroom:3,pantry:3,safe:4,drain:2,relocate:2}[type];if(!cost)return false;
    if(this.p.y<surface(this.p.x)+90){this.event('Komorę buduj trochę głębiej pod ziemią.');return false;}if(this.wood<cost){this.event('Potrzebujesz więcej materiałów z korzeni i liści.');return false;}if(this.rooms.some(r=>distance(r,this.p)<135)||this.drains.some(r=>distance(r,this.p)<100)){this.event('Odejdź trochę od istniejącej komory.');return false;}if(this.rocks.some(r=>distance(r,this.p)<r.r+65)){this.event('Duża skała zajmuje miejsce komory.');return false;}
    if(relocate&&!this.rooms.some(r=>r.type==='pantry')){this.event('Najpierw zbuduj spiżarnię.');return false;}if(!relocate&&type!=='drain'&&this.rooms.some(r=>r.type===type)){this.event('Taka komora już istnieje.');return false;}
    this.wood-=cost;this.carve(this.p.x,this.p.y,65);if(type==='drain')this.drains.push({...this.p});else{if(relocate)this.rooms=this.rooms.filter(r=>r.type!=='pantry');this.rooms.push({...this.p,type:relocate?'pantry':type});}this.event({bedroom:'Sypialnia gotowa.',pantry:'Spiżarnia gotowa.',safe:'Kryjówka zatrzyma węża.',drain:'Odpływ osusza połączone tunele.',relocate:'Spiżarnia przeniesiona wraz z zapasami.'}[type]);return true;
  }
  rest(){if(!this.nearRoom){this.event('Odpocznij w norze lub zbudowanej komorze.');return false;}if(this.waterHere>.4){this.event('Znajdź suche miejsce do odpoczynku.');return false;}if(this.hunger<12){this.event('Najpierw coś zjedz.');return false;}this.energy=100;this.health=clamp(this.health+40,0,100);this.hunger-=8;this.time+=15;this.event('Krótka drzemka. Łapki znowu pełne sił.');return true;}
  deposit(){if(this.nearRoom?.type!=='pantry'){this.event('Zapasy odkładaj w spiżarni.');return false;}const n=Math.max(0,this.food-3);this.food-=n;this.stash+=n;this.event('Zapasy w spiżarni: '+this.stash+'. Trzy porcje zostają na drogę.');return n>0;}
  withdraw(){if(this.nearRoom?.type!=='pantry'||!this.stash)return false;const n=Math.min(4,this.stash);this.food+=n;this.stash-=n;this.event('Zabierasz '+n+' porcje.');return true;}
  safeAt(p){return distance(p,this.home)<90||this.rooms.some(r=>r.type==='safe'&&distance(p,r)<80);}
  damage(amount,text){if(this.invincible||this.safeAt(this.p))return;this.health-=amount;this.invincible=3;this.event(text,'danger');if(this.health<=0){this.health=0;this.downed=true;this.event('Potrzebujesz odpoczynku. Twoje tunele i odkrycia zostają.','down');}}
  recover(){this.p={...this.home};this.health=85;this.energy=95;this.hunger=Math.max(50,this.hunger);this.food=Math.max(1,this.food-2);this.downed=false;this.invincible=5;for(const k of this.kids)if(k.state==='follow')k.state='waiting';this.path=[{...this.p}];this._revealX=-999;this.reveal();this.event('Wracasz do nory. Rodzina nadal na ciebie czeka.');}
  tick(dt,input={x:0,y:0,sprint:false}){
    if(this.downed)return;const wasRain=this.raining;this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.pulse=Math.max(0,this.pulse-dt);this.peek=Math.max(0,this.peek-dt);this.invincible=Math.max(0,this.invincible-dt);this.noise=Math.max(0,this.noise-dt*.8);this.move(input.x,input.y,dt,input.sprint);
    this.hunger=Math.max(0,this.hunger-dt*.055);if(this.hunger===0)this.damage(dt*2,'Głód. Zjedz coś lub wróć po zapasy.');
    if(Math.hypot(input.x,input.y)<.1){this.energy=clamp(this.energy+dt*(this.nearRoom?8:1.5),0,100);if(this.nearHome)this.health=clamp(this.health+dt*2,0,100);}
    if(this.waterHere>.75){this.energy=Math.max(0,this.energy-dt*3);this.damage(dt*4,'Woda sięga wysoko. Kieruj się do suchego tunelu.');}
    if(!wasRain&&this.raining)this.event('Nadchodzi deszcz. Uważaj na dolne tunele.');if(wasRain&&!this.raining){this.event('Po deszczu na powierzchni jest dużo jedzenia.');for(let i=0;i<15;i++){const x=100+this.random()*3000;this.foods.push({x,y:surface(x)-14,type:i%4?'worm':'leaf',phase:i});}}
    this.followKids(dt);this.movePredators(dt);
    this.preyClock=(this.preyClock||0)+dt;if(this.preyClock>.6){this.preyClock=0;for(const f of this.foods)if(f.type==='worm'&&f.y>surface(f.x)&&distance(f,this.p)<120&&this.random()<.17){const angle=Math.atan2(f.y-this.p.y,f.x-this.p.x);const nx=f.x+Math.cos(angle)*13,ny=f.y+Math.sin(angle)*13;if(!this.rockAt(nx,ny)&&this.valid(nx,ny)){f.x=nx;f.y=ny;}}}
    this.waterClock+=dt;if(this.waterClock>.6){this.waterClock=0;this.flowWater();}this.collect();
  }
  followKids(dt){for(const k of this.kids){if(k.state!=='follow')continue;const target=this.path[Math.min(k.pathIndex,this.path.length-1)];if(distance(k,target)<20&&k.pathIndex<this.path.length-1)k.pathIndex++;const t=this.path[Math.min(k.pathIndex,this.path.length-1)],d=distance(k,t);if(d>16){const step=Math.min(d,dt*108);const nx=k.x+(t.x-k.x)/d*step,ny=k.y+(t.y-k.y)/d*step;if(this.isOpen(nx,ny)&&!this.rockAt(nx,ny)){k.x=nx;k.y=ny;}}}}
  movePredators(dt){for(const e of this.predators){const d=distance(e,this.p),depth=this.p.y-surface(this.p.x);e.attack=Math.max(0,e.attack-dt);e.alert=0;
    if(e.type==='fox'){
      const notices=depth<52&&(d<280&&this.noise>.1||this.surface&&d<360);
      if(notices){e.alert=1;e.warning=Math.min(2,e.warning+dt);if(Math.abs(this.p.x-e.x)>22)e.x+=Math.sign(this.p.x-e.x)*dt*85;e.y=clamp(e.y+(this.p.y-e.y)*dt*2,surface(e.x)-17,surface(e.x)+35);if(e.warning>1.1&&Math.abs(this.p.x-e.x)<50&&depth<50){this.carve(e.x,surface(e.x)+20,28);if(!e.attack){e.attack=3;this.damage(28,'Lis sięga łapą do wejścia! Schowaj się głębiej.');}}}
      else{e.warning=Math.max(0,e.warning-dt);e.x+=e.dir*dt*30;e.y=surface(e.x)-17;if(e.x<800||e.x>WIDTH-120)e.dir*=-1;}e.y=Math.min(e.y,surface(e.x)+35);
    }else if(e.type==='owl'){
      if(this.surface&&d<330){e.alert=1;e.warning+=dt;const a=Math.atan2(this.p.y-20-e.y,this.p.x-e.x);if(e.warning>1.4){e.x+=Math.cos(a)*dt*140;e.y+=Math.sin(a)*dt*140;}if(d<42&&!e.attack){e.attack=4;this.damage(32,'Cień sowy! Wracaj pod ziemię.');}}
      else{e.warning=0;e.x+=e.dir*dt*50;e.y+=(surface(e.x)-135-e.y)*dt;if(e.x<800||e.x>WIDTH-150)e.dir*=-1;}
    }else{
      e.alert=d<310?1:0;let angle=e.alert?Math.atan2(this.p.y-e.y,this.p.x-e.x):e.angle;
      for(const offset of [0,.5,-.5,1,-1,2,-2,Math.PI]){const a=angle+offset,nx=e.x+Math.cos(a)*dt*57,ny=e.y+Math.sin(a)*dt*57;if(this.isOpen(nx,ny)&&this.isOpen(nx+Math.cos(a)*17,ny+Math.sin(a)*17)&&!this.safeAt({x:nx,y:ny})&&!this.rockAt(nx,ny)){e.x=nx;e.y=ny;e.angle=a;break;}}if(d<32&&!e.attack){e.attack=4;this.damage(23,'Wąż w przejściu. Uciekaj albo zasyp tunel za sobą.');}
    }
  }}
  flowWater(){
    if(this.raining)for(const x of this.exits){const y=surface(x)+12,i=this.idx(x,y);if(this.open[i])this.water[i]=clamp(this.water[i]+.23,0,1);}
    const source=this.idx(2180,895);if(this.open[source])this.water[source]=clamp(this.water[source]+.45,0,1);
    const indices=Array.from(this.openSet).sort((a,b)=>b-a);for(const i of indices){if(this.water[i]<.005)continue;this.water[i]=Math.max(0,this.water[i]-.0005);const x=i%COLS;for(const j of [i+COLS,i-1,i+1]){if(!this.open[j]||j<0||j>=this.open.length||j===i-1&&x===0||j===i+1&&x===COLS-1)continue;const amount=Math.min(j===i+COLS?this.water[i]:Math.max(0,(this.water[i]-this.water[j])*.5),1-this.water[j],j===i+COLS?.28:.08);this.water[i]-=amount;this.water[j]+=amount;}}
    for(const drain of this.drains){const queue=[[this.idx(drain.x,drain.y),0]],visited=new Set();for(let n=0;n<queue.length&&n<6000;n++){const [i,depth]=queue[n];if(visited.has(i)||depth>70||!this.open[i])continue;visited.add(i);this.water[i]=Math.max(0,this.water[i]-.20);const x=i%COLS;for(const j of [i+COLS,i-COLS,x>0?i-1:-1,x<COLS-1?i+1:-1])if(j>=0&&j<this.open.length&&!visited.has(j))queue.push([j,depth+1]);}}
    const pantry=this.rooms.find(r=>r.type==='pantry');if(pantry&&this.water[this.idx(pantry.x,pantry.y)]>.7&&this.stash>0){this.wetClock=(this.wetClock||0)+.6;if(this.wetClock>20){this.stash--;this.wetClock=0;this.event('Spiżarnia mokra. Przenieś zapasy wyżej lub zbuduj odpływ.');}}
  }
  save(){const keys=['seed','time','p','health','energy','hunger','food','wood','treasure','stash','claws','hearing','sprintUnlocked','downed','won','facing','dug','moved','fillCount','cuts','sight','path','exits','rooms','drains','rocks','foods','kids','discoveries','predators'];const d={version:2,seen:pack(this.seen),water:[]};for(const key of keys)d[key]=this[key];for(const i of this.openSet)if(this.water[i]>.01)d.water.push([i,Math.round(this.water[i]*100)/100]);return d;}
  static load(d){if(d?.version!==2||!Array.isArray(d.cuts)||d.cuts.length>50000||!Array.isArray(d.kids)||d.kids.length!==3||!Number.isFinite(d.p?.x)||!Number.isFinite(d.p?.y))throw Error('Invalid save');const w=new World(d.seed);if(!w.valid(d.p.x,d.p.y))throw Error('Invalid position');for(const key of Object.keys(w.save()))if(!['version','seen','water'].includes(key)&&d[key]!==undefined)w[key]=d[key];w.open.fill(0);w.openSet.clear();for(const cut of w.cuts)w.paint(cut.x,cut.y,cut.r,cut.kind,false);w.seen=unpack(d.seen||'',COLS*ROWS);w.water.fill(0);for(const [i,v] of d.water||[])if(w.open[i])w.water[i]=clamp(v,0,1);if(!w.path?.length)w.path=[{...w.p}];w._revealX=w.p.x;w._revealY=w.p.y;return w;}
}
