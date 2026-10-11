export const WIDTH=3200,HEIGHT=1552,CELL=8,COLS=WIDTH/CELL,ROWS=HEIGHT/CELL,RADIUS=14;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const surface=x=>310+Math.sin(x/170)*15+Math.sin(x/410)*18;
export const zone=x=>x<940?0:x<1510?1:x<2110?2:x<2740?3:4;
export const ZONES=['Ogród korzeni','Piasek pod łąką','Zakopane ruiny','Podziemny strumień','Jaskinia grzybów'];
export const DISCOVERY_REWARDS={coin:'2 błyskotki na ulepszenia',boot:'4 materiały i 2 porcje jedzenia',spring:'1 błyskotka i pełna energia',ruin:'2 błyskotki i 3 materiały',cave:'1 błyskotka i pełna energia',mushroom:'3 porcje jedzenia i dalszy nasłuch'};
function rng(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function pack(a){let s='';for(let i=0;i<a.length;i+=8){let n=0;for(let j=0;j<8;j++)if(a[i+j])n|=1<<j;s+=n.toString(16).padStart(2,'0');}return s;}
function unpack(s,n){const a=new Uint8Array(n);for(let i=0;i<s.length;i+=2){const b=parseInt(s.slice(i,i+2),16);for(let j=0;j<8;j++)a[i*4+j]=b>>j&1;}return a;}
export class World{
  constructor(seed=20261011){
    this.seed=seed;this.random=rng(seed);this.time=0;this.escapeBoost=0;this.p={x:420,y:540};this.home={x:420,y:540};this.health=100;this.energy=100;this.hunger=86;this.food=3;this.wood=5;this.treasure=0;this.stash=0;this.claws=0;this.hearing=0;this.sprintUnlocked=false;this.cooldown=0;this.pulse=0;this.peek=0;this.noise=0;this.invincible=0;this.downed=false;this.won=false;this.facing={x:1,y:0};this.events=[];this.dug=0;this.moved=0;this.fillCount=0;this.waterClock=0;this._revealX=-999;this._revealY=-999;
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
  event(text,type='info',data={}){this.events.push({text,type,...data});}
  paint(x,y,r,kind=1,record=true){
    if(record)this.cuts.push({x,y,r,kind});
    const x0=Math.max(0,Math.floor((x-r)/CELL)),x1=Math.min(COLS-1,Math.ceil((x+r)/CELL)),y0=Math.max(0,Math.floor((y-r)/CELL)),y1=Math.min(ROWS-1,Math.ceil((y+r)/CELL));
    for(let gy=y0;gy<=y1;gy++)for(let gx=x0;gx<=x1;gx++)if(Math.hypot(gx*CELL+CELL/2-x,gy*CELL+CELL/2-y)<=r){const i=gy*COLS+gx;this.open[i]=kind?1:0;if(kind)this.openSet.add(i);else{this.openSet.delete(i);this.water[i]=0;}}
  }
  carve(x,y,r,record=true){const last=this.cuts[this.cuts.length-1];if(record&&last&&last.kind===1&&last.r===r&&distance(last,{x,y})<=3)return;this.paint(x,y,r,1,record);}
  soilInCircle(x,y,r){for(let gy=Math.max(0,Math.floor((y-r)/CELL));gy<=Math.min(ROWS-1,Math.ceil((y+r)/CELL));gy++)for(let gx=Math.max(0,Math.floor((x-r)/CELL));gx<=Math.min(COLS-1,Math.ceil((x+r)/CELL));gx++){const px=gx*CELL+4,py=gy*CELL+4;if(py>surface(px)&&Math.hypot(px-x,py-y)<r&&!this.open[gy*COLS+gx])return true;}return false;}
  clearSoilIslands(){
    const cx=Math.floor(this.p.x/CELL),cy=Math.floor(this.p.y/CELL),x0=Math.max(1,cx-12),x1=Math.min(COLS-2,cx+12),y0=Math.max(1,cy-12),y1=Math.min(ROWS-2,cy+12),visited=new Set();
    for(let y=y0+1;y<y1;y++)for(let x=x0+1;x<x1;x++){const start=y*COLS+x;if(visited.has(start)||this.open[start]||y*CELL<surface(x*CELL)+45)continue;const queue=[start],component=[],local=new Set();let enclosed=true;
      for(let n=0;n<queue.length;n++){const i=queue[n];if(visited.has(i)||this.open[i])continue;visited.add(i);local.add(i);component.push(i);const gx=i%COLS,gy=Math.floor(i/COLS);if(gx<=x0||gx>=x1||gy<=y0||gy>=y1||component.length>24){enclosed=false;break;}for(const j of [i-1,i+1,i-COLS,i+COLS])if(!this.open[j]){if(visited.has(j)&&!local.has(j))enclosed=false;else if(!visited.has(j))queue.push(j);}}
      if(enclosed)for(const i of component){const px=i%COLS*CELL+4,py=Math.floor(i/COLS)*CELL+4;if(py>surface(px)+45&&!this.rocks.some(r=>distance(r,{x:px,y:py})<r.r+4))this.paint(px,py,6.5,1);}
    }
  }
  reveal(){if(Math.hypot(this.p.x-this._revealX,this.p.y-this._revealY)<12)return;this._revealX=this.p.x;this._revealY=this.p.y;const r=185;this.sight.push({x:this.p.x,y:this.p.y,r});for(let gy=Math.max(0,Math.floor((this.p.y-r)/CELL));gy<Math.min(ROWS,Math.ceil((this.p.y+r)/CELL));gy++)for(let gx=Math.max(0,Math.floor((this.p.x-r)/CELL));gx<Math.min(COLS,Math.ceil((this.p.x+r)/CELL));gx++)if(Math.hypot(gx*CELL-this.p.x,gy*CELL-this.p.y)<r)this.seen[gy*COLS+gx]=1;}
  get surface(){return this.p.y<=surface(this.p.x)-RADIUS+2;}
  get raining(){return this.time%240>115&&this.time%240<165;}
  get nearHome(){return distance(this.p,this.home)<80;}
  get rescued(){return this.kids.filter(k=>k.state==='home').length;}
  get nearRoom(){return this.rooms.find(r=>distance(r,this.p)<70);}
  get waterHere(){return this.water[this.idx(this.p.x,this.p.y)]||0;}
  get nextKid(){return this.kids.find(k=>k.state!=='home');}
  get trappedRock(){return this.rocks.find(r=>distance(r,this.p)<r.r+RADIUS+2);}
  escapeDirection(){const trapped=this.trappedRock;if(!trapped)return null;const overlaps=this.rocks.filter(r=>distance(r,this.p)<r.r+RADIUS+2),reach=Math.max(...overlaps.map(r=>distance(r,trapped)+r.r))+RADIUS+8;const candidates=[];for(let i=0;i<24;i++){const a=i*Math.PI/12,target={x:trapped.x+Math.cos(a)*reach,y:trapped.y+Math.sin(a)*reach},d=distance(target,this.p);if(!d||!this.valid(target.x,target.y)||this.rockAt(target.x,target.y))continue;const x=(target.x-this.p.x)/d,y=(target.y-this.p.y)/d;if(overlaps.some(r=>distance(r,{x:this.p.x+x*3,y:this.p.y+y*3})<=distance(r,this.p)))continue;candidates.push({x,y,score:d+(this.isOpen(target.x,target.y)?0:100)});}candidates.sort((a,b)=>a.score-b.score);return candidates[0]||null;}
  get interactable(){return this.kids.find(k=>k.state==='waiting'&&distance(k,this.p)<74)||this.discoveries.find(d=>!d.found&&distance(d,this.p)<65&&this.isOpen(d.x,d.y))||this.rocks.find(r=>r.small&&distance(r,this.p)<r.r+45);}
  move(dx,dy,dt,sprint=false){
    const len=Math.hypot(dx,dy);if(len<.12){this.noise=Math.max(0,this.noise-dt);return;}
    dx/=Math.max(1,len);dy/=Math.max(1,len);
    const depth=this.p.y-surface(this.p.x),onSurface=this.surface,trapped=this.rocks.filter(r=>distance(r,this.p)<r.r+RADIUS+2),escaping=trapped.length>0;
    if(!escaping){if(dy<-.12&&depth<45&&!onSurface){dx=0;dy=-1;}else if(dy>.12&&depth<45){dx=0;dy=1;}
    else if(!onSurface&&depth<35&&Math.abs(dx)>.12){this.blocked='exit';return;}}
    this.facing={x:dx,y:dy};
    if(escaping&&trapped.some(r=>distance(r,{x:this.p.x+dx*3,y:this.p.y+dy*3})<=distance(r,this.p))){this.blocked='trapped';return;}
    const ahead={x:this.p.x+dx*30,y:this.p.y+dy*30};let rock=this.rocks.find(r=>!trapped.includes(r)&&distance(r,ahead)<r.r+RADIUS-2);
    if(rock){if(rock.small&&this.claws>0){rock.hp=(rock.hp??.9)-dt*(this.claws+1);this.noise=1;if(rock.hp<=0){this.rocks.splice(this.rocks.indexOf(rock),1);this.wood++;this.event('Mały kamień skruszony. +1 materiał.');}else return;}else{this.blocked='rock';return;}}
    const digging=!this.isOpen(ahead.x,ahead.y)||!onSurface&&this.soilInCircle(this.p.x+dx*8,this.p.y+dy*8,25),root=digging&&this.rootAt(ahead.x,ahead.y);this.blocked=null;
    if(digging&&this.energy<2&&!escaping&&!this.escapeBoost){this.blocked='energy';return;}
    let speed=digging?(root?33:zone(this.p.x)===1?88:64)*(1+this.claws*.22):112;
    if(escaping)speed=Math.max(90,speed);
    if(this.escapeBoost>0)speed=Math.max(135,speed);
    if(sprint&&this.sprintUnlocked&&this.energy>8&&!digging){speed=185;this.energy-=dt*8;}
    if(this.waterHere>.5)speed*=.65;
    const nx=clamp(this.p.x+dx*speed*dt,35,WIDTH-35),ground=surface(nx);let ny=clamp(this.p.y+dy*speed*dt,ground-RADIUS,HEIGHT-40);
    if(onSurface&&Math.abs(dy)<.1)ny=ground-RADIUS;
    else if(!onSurface&&dx!==0)ny=Math.max(ny,ground+35);
    if(this.rocks.some(r=>distance(r,{x:nx,y:ny})<r.r+RADIUS-2&&(!trapped.includes(r)||distance(r,{x:nx,y:ny})<=distance(r,this.p)))){this.blocked=escaping?'trapped':'rock';return;}
    if(!onSurface||ny>ground-RADIUS){const steps=Math.max(1,Math.ceil(Math.hypot(nx-this.p.x,ny-this.p.y)/6));for(let i=0;i<=steps;i++)this.carve(this.p.x+(nx-this.p.x)*i/steps,this.p.y+(ny-this.p.y)*i/steps,25);this.terrainDirty=true;}
    if(digging){this.dug+=dt*speed;this.energy=Math.max(0,this.energy-dt*(root?2.2:1.2));this.noise=1;if(root){this.rootGather=(this.rootGather||0)+dt;if(this.rootGather>1.4){this.rootGather=0;this.wood++;this.event('Korzeń daje materiał.','quiet');}}}
    const previousDepth=this.p.y-surface(this.p.x);this.moved+=Math.hypot(nx-this.p.x,ny-this.p.y);this.p={x:nx,y:ny};
    if((previousDepth<0&&ny>ground||previousDepth>=0&&ny<ground)&&!this.exits.some(x=>Math.abs(x-nx)<30)){this.exits.push(nx);this.event('Nowy pionowy otwór i kopiec na powierzchni.');}
    if(distance(this.p,this.path[this.path.length-1])>6){this.path.push({...this.p});if(this.path.length>4000){this.path.shift();for(const k of this.kids)k.pathIndex=Math.max(0,k.pathIndex-1);}}
    this.reveal();this.collect();
  }
  collect(){
    for(let i=this.foods.length-1;i>=0;i--){const f=this.foods[i];if(distance(f,this.p)<26){if(f.type==='leaf'){this.wood+=2;this.event('+2 liście do nory.','quiet');}else{this.food++;this.event('+1 jedzenie.','quiet');}this.foods.splice(i,1);}}
    for(const d of this.discoveries)if(!d.found&&distance(d,this.p)<30&&this.isOpen(d.x,d.y))this.discover(d);
    if(this.nearHome)for(const k of this.kids)if(k.state==='follow'&&distance(k,this.home)<100){k.state='home';this.health=100;this.energy=100;this.food+=2;if(this.rescued===1){this.claws=Math.max(1,this.claws);this.hearing=1;this.event(k.name+' wrócił do domu! Mocniejsze pazurki i dalszy nasłuch.','rescue');}else if(this.rescued===2){this.sprintUnlocked=true;this.event(k.name+' bezpiecznie w norze! Odblokowany zryw (Shift).','rescue');}else{this.won=true;this.event('Cała rodzina jest w domu. Udało się!','win');}}
  }
  discover(d){if(d.found)return false;d.found=true;const t=d.type;if(t==='coin')this.treasure+=2;if(t==='boot'){this.wood+=4;this.food+=2;}if(t==='spring'||t==='cave'){this.treasure++;this.energy=100;}if(t==='ruin'){this.treasure+=2;this.wood+=3;}if(t==='mushroom'){this.food+=3;this.hearing++;}this.event(d.title+': '+DISCOVERY_REWARDS[t]+'.','discovery');return true;}
  interact(){const object=this.interactable;if(!object)return false;if(object.name){object.state='follow';object.pathIndex=this.path.length-1;this.event(object.name+' idzie za tobą. Poprowadź go tunelami do nory.','rescue',{title:object.name+' idzie za tobą!'});}else if(object.title)this.discover(object);else{const nx=object.x+this.facing.x*34,ny=object.y+this.facing.y*34;if(this.valid(nx,ny)&&!this.rocks.some(r=>r!==object&&distance(r,{x:nx,y:ny})<r.r+object.r)){object.x=nx;object.y=ny;this.energy=Math.max(0,this.energy-4);this.event('Przesuwasz mały kamień.','quiet',{title:'Kamień przesunięty'});}}return true;}
  listen(){if(this.cooldown>0)return false;this.pulse=3.8;this.cooldown=5;this.peek=this.surface?0:this.p.y-surface(this.p.x)<42?2:0;this.event(this.peek?'Wystawiasz nos. Ciężkie kroki ostrzegają przed lisem.':'Nasłuch: zielone drgania — jedzenie, złote — mały kret, czerwone — zagrożenie.');return true;}
  eat(){if(!this.food){this.event('Brak jedzenia. Nasłuchuj drobnych drgań.');return false;}if(this.energy>95&&this.hunger>95)return false;this.food--;this.hunger=clamp(this.hunger+30,0,100);this.energy=clamp(this.energy+38,0,100);this.health=clamp(this.health+10,0,100);this.event('Mniam. Siły wracają.','quiet',{title:'Siły wracają!'});return true;}
  sealTarget(){
    const len=Math.hypot(this.facing.x,this.facing.y)||1,back={x:this.p.x-this.facing.x/len*58,y:this.p.y-this.facing.y/len*58};
    const candidates=[back,...this.path.slice(-180).filter(p=>distance(p,this.p)>=52&&distance(p,this.p)<=110)].sort((a,b)=>Math.abs(distance(a,this.p)-58)-Math.abs(distance(b,this.p)-58));
    const reason=p=>!this.valid(p.x,p.y)||p.y<surface(p.x)+40?'Zejdź głębiej, żeby zasypać tunel.':distance(p,this.home)<82||this.rooms.some(r=>distance(r,p)<72)?'Odejdź dalej od komory — jej środka nie zasypujemy.':this.kids.some(k=>distance(k,p)<40)?'Mały kret jest za blisko. Przejdź dalej, żeby go nie zasypać.':!this.isOpen(p.x,p.y)||!this.openSegment(this.p,p)?'Nie ma przejścia za tobą. Przejdź kawałek tunelem.':'';
    const target=candidates.find(p=>!reason(p))||back,message=reason(target);return {...target,r:28,valid:!message,reason:message};
  }
  seal(){const target=this.sealTarget();if(!target.valid){this.event(target.reason);return false;}this.paint(target.x,target.y,target.r,0);this.fillCount++;this.energy=Math.max(0,this.energy-5);this.event('Przejście za tobą zasypane. Możesz wykopać je ponownie.','info',{title:'Tunel zasypany!'});return true;}
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
  damage(amount,text,source=null){if(this.invincible||this.safeAt(this.p))return;const hit=Math.min(amount,this.health);this.health-=amount;this.invincible=5;if(source&&['snake','fox','owl'].includes(source.type)){this.escapeBoost=5;source.retreat=3.5;}this.event(text,'danger',{hit,source:source?{type:source.type||'rock',x:source.x,y:source.y}:null});if(this.health<=0){this.health=0;this.downed=true;this.event('Potrzebujesz odpoczynku. Twoje tunele i odkrycia zostają.','down');}}
  recover(){this.p={...this.home};this.health=85;this.energy=95;this.hunger=Math.max(50,this.hunger);this.food=Math.max(1,this.food-2);this.downed=false;this.invincible=5;for(const k of this.kids)if(k.state==='follow')k.state='waiting';this.path=[{...this.p}];this._revealX=-999;this.reveal();this.event('Wracasz do nory. Rodzina nadal na ciebie czeka.');}
  tick(dt,input={x:0,y:0,sprint:false}){
    if(this.downed)return;const wasRain=this.raining;this.time+=dt;this.escapeBoost=Math.max(0,(this.escapeBoost||0)-dt);this.cooldown=Math.max(0,this.cooldown-dt);this.pulse=Math.max(0,this.pulse-dt);this.peek=Math.max(0,this.peek-dt);this.invincible=Math.max(0,this.invincible-dt);this.noise=Math.max(0,this.noise-dt*.8);this.move(input.x,input.y,dt,input.sprint);
    this.hunger=Math.max(0,this.hunger-dt*.055);if(this.hunger===0)this.damage(dt*2,'Głód. Zjedz coś lub wróć po zapasy.',{type:'hunger'});
    if(Math.hypot(input.x,input.y)<.1){this.energy=clamp(this.energy+dt*(this.nearRoom?8:1.5),0,100);if(this.nearHome)this.health=clamp(this.health+dt*2,0,100);}
    if(this.waterHere>.75){this.energy=Math.max(0,this.energy-dt*3);this.damage(dt*4,'Woda sięga wysoko. Kieruj się do suchego tunelu.',{type:'water'});}
    if(!wasRain&&this.raining)this.event('Nadchodzi deszcz. Uważaj na dolne tunele.');if(wasRain&&!this.raining){this.event('Po deszczu na powierzchni jest dużo jedzenia.');for(let i=0;i<15;i++){const x=100+this.random()*3000;this.foods.push({x,y:surface(x)-14,type:i%4?'worm':'leaf',phase:i});}}
    this.terrainClock=(this.terrainClock||0)+dt;if(this.terrainDirty&&this.terrainClock>.18){this.clearSoilIslands();this.terrainDirty=false;this.terrainClock=0;}this.fallRocks(dt);this.followKids(dt);this.movePredators(dt);
    this.preyClock=(this.preyClock||0)+dt;if(this.preyClock>.6){this.preyClock=0;for(const f of this.foods)if(f.type==='worm'&&f.y>surface(f.x)&&distance(f,this.p)<120&&this.random()<.17){const angle=Math.atan2(f.y-this.p.y,f.x-this.p.x);const nx=f.x+Math.cos(angle)*13,ny=f.y+Math.sin(angle)*13;if(!this.rockAt(nx,ny)&&this.valid(nx,ny)){f.x=nx;f.y=ny;}}}
    this.waterClock+=dt;if(this.waterClock>=.1){this.waterClock%=.1;this.flowWater();}this.collect();
  }
  followKids(dt){for(const k of this.kids){if(k.state!=='follow')continue;const target=this.path[Math.min(k.pathIndex,this.path.length-1)];if(distance(k,target)<20&&k.pathIndex<this.path.length-1)k.pathIndex++;const t=this.path[Math.min(k.pathIndex,this.path.length-1)],d=distance(k,t);if(d>16){const step=Math.min(d,dt*108);const nx=k.x+(t.x-k.x)/d*step,ny=k.y+(t.y-k.y)/d*step;if(this.isOpen(nx,ny)&&!this.rockAt(nx,ny)){k.x=nx;k.y=ny;k.stuck=0;}else k.stuck=(k.stuck||0)+dt;}else k.stuck=0;}}
  actorFits(x,y,r=10){if(!this.isOpen(x,y))return false;for(let i=0;i<8;i++){const a=i*Math.PI/4;if(!this.isOpen(x+Math.cos(a)*r,y+Math.sin(a)*r))return false;}return !this.rocks.some(rock=>distance(rock,{x,y})<rock.r+r);}
  openSegment(a,b){const steps=Math.max(1,Math.ceil(distance(a,b)/4));for(let i=0;i<=steps;i++)if(!this.isOpen(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps))return false;return true;}
  stepActor(e,target,speed,dt){const d=distance(e,target);if(d<.1)return true;const travel=Math.min(d,speed*dt),steps=Math.max(1,Math.ceil(travel/3));for(let i=0;i<steps;i++){const x=e.x+(target.x-e.x)/distance(e,target)*travel/steps,y=e.y+(target.y-e.y)/distance(e,target)*travel/steps;if(!this.actorFits(x,y))return false;e.x=x;e.y=y;}return true;}
  rockUnsupported(r,drop=0){return [-.7,-.35,0,.35,.7].every(f=>{const x=r.x+f*r.r,y=r.y+Math.sqrt(r.r*r.r-(f*r.r)**2)+5+drop;return this.isOpen(x,y)&&!this.rocks.some(other=>other!==r&&distance(other,{x,y})<other.r+3);});}
  fallRocks(dt){for(const r of this.rocks){if(!this.rockUnsupported(r)){r.vy=0;r.unstable=undefined;continue;}if(r.unstable===undefined){r.unstable=.85;if(distance(r,this.p)<240)this.event('Kamień drży! Odsuń się spod niego.','danger');}r.unstable=Math.max(0,r.unstable-dt);if(r.unstable>0)continue;r.vy=Math.min(190,(r.vy||0)+dt*260);let remaining=r.vy*dt;while(remaining>0){const step=Math.min(3,remaining);if(!this.rockUnsupported(r,step)){r.vy=0;break;}r.y+=step;remaining-=step;if(distance(r,this.p)<r.r+RADIUS+3)this.damage(35,'Spadający kamień! Uciekaj spod skały.',r);}}}
  movePredators(dt){for(const e of this.predators){const d=distance(e,this.p),depth=this.p.y-surface(this.p.x);e.attack=Math.max(0,e.attack-dt);e.retreat=Math.max(0,(e.retreat||0)-dt);e.alert=0;if(e.retreat>0){const angle=Math.atan2(e.y-this.p.y,e.x-this.p.x);if(e.type==='snake'){for(const offset of [0,.5,-.5,1,-1]){const target={x:e.x+Math.cos(angle+offset)*12,y:e.y+Math.sin(angle+offset)*12};if(this.stepActor(e,target,90,dt)){e.angle=angle+offset;break;}}}else if(e.type==='owl'){e.x+=Math.cos(angle)*dt*110;e.y-=dt*70;}else if(e.y<=surface(e.x)-15){e.x=clamp(e.x+Math.sign(e.x-this.p.x||e.dir)*dt*70,35,WIDTH-35);e.y=surface(e.x)-17;}else this.stepActor(e,{x:e.entry??e.x,y:surface(e.entry??e.x)-17},65,dt);continue;}
    if(e.type==='fox'){
      const notices=depth<52&&(d<280&&this.noise>.1||this.surface&&d<360);
      const inside=e.entering||e.y>surface(e.x)-15;
      if(notices){e.alert=1;e.warning=Math.min(2,e.warning+dt);}else e.warning=Math.max(0,e.warning-dt);
      if(inside){const target=notices?{x:this.p.x,y:Math.min(this.p.y,surface(this.p.x)+35)}:{x:e.entry??e.x,y:surface(e.entry??e.x)-17};const previous={x:e.x,y:e.y};this.stepActor(e,target,60,dt);if(e.y>surface(e.x)+35||!this.actorFits(e.x,e.y)){Object.assign(e,previous);}if(e.y<=surface(e.x)-16.9)e.entering=false;if(distance(e,this.p)<48&&e.warning>1.1&&!e.attack&&depth<50&&this.openSegment(e,this.p)){e.attack=3;this.damage(28,'Lis wszedł do otworu! Schowaj się głębiej.',e);}}
      else{const entrance=this.exits.filter(x=>Math.abs(x-this.p.x)<160&&this.actorFits(x,surface(x)+8)).sort((a,b)=>Math.abs(a-this.p.x)-Math.abs(b-this.p.x))[0];const targetX=notices?(this.surface?this.p.x:entrance):undefined;if(targetX!==undefined){if(Math.abs(targetX-e.x)>3)e.x+=Math.sign(targetX-e.x)*Math.min(Math.abs(targetX-e.x),dt*85);e.dir=Math.sign(targetX-e.x)||e.dir;}else{e.x+=e.dir*dt*30;if(e.x<800||e.x>WIDTH-120)e.dir*=-1;}e.y=surface(e.x)-17;if(notices&&!this.surface&&entrance!==undefined&&Math.abs(e.x-entrance)<3){e.entry=entrance;this.stepActor(e,{x:entrance,y:surface(entrance)+Math.min(35,Math.max(8,depth))},60,dt);e.entering=e.y>surface(e.x)-16.9;}if(this.surface&&distance(e,this.p)<48&&e.warning>1.1&&!e.attack){e.attack=3;this.damage(28,'Lis na powierzchni! Wracaj do tunelu.',e);}}
    }else if(e.type==='owl'){
      if(this.surface&&d<330){e.alert=1;e.warning+=dt;const a=Math.atan2(this.p.y-20-e.y,this.p.x-e.x);if(e.warning>1.4){e.x+=Math.cos(a)*dt*140;e.y+=Math.sin(a)*dt*140;}if(d<42&&!e.attack){e.attack=4;this.damage(32,'Cień sowy! Wracaj pod ziemię.',e);}}
      else{e.warning=0;e.x+=e.dir*dt*50;e.y+=(surface(e.x)-135-e.y)*dt;if(e.x<800||e.x>WIDTH-150)e.dir*=-1;}
    }else{
      e.alert=d<310?1:0;let angle=e.alert?Math.atan2(this.p.y-e.y,this.p.x-e.x):e.angle;
      for(const offset of [0,.5,-.5,1,-1,2,-2,Math.PI]){const a=angle+offset,nx=e.x+Math.cos(a)*dt*57,ny=e.y+Math.sin(a)*dt*57;if(this.isOpen(nx,ny)&&this.isOpen(nx+Math.cos(a)*17,ny+Math.sin(a)*17)&&!this.safeAt({x:nx,y:ny})&&!this.rockAt(nx,ny)){e.x=nx;e.y=ny;e.angle=a;break;}}if(d<32&&!e.attack&&this.openSegment(e,this.p)){e.attack=4;this.damage(23,'Wąż w przejściu. Uciekaj albo zasyp tunel za sobą.',e);}
    }
  }}
  flowWater(){
    if(this.raining)for(const x of this.exits)for(const offset of [-8,0,8]){const i=this.idx(x+offset,surface(x)+12);if(this.open[i])this.water[i]=clamp(this.water[i]+.4,0,1);}
    for(const offset of [-8,0,8]){const source=this.idx(2180+offset,895);if(this.open[source])this.water[source]=clamp(this.water[source]+.8,0,1);}
    const indices=Array.from(this.openSet).sort((a,b)=>b-a);for(let pass=0;pass<2;pass++)for(const i of indices){if(this.water[i]<.002)continue;this.water[i]=Math.max(0,this.water[i]-.00005);const x=i%COLS;for(const j of [i+COLS,i-1,i+1]){if(!this.open[j]||j<0||j>=this.open.length||j===i-1&&x===0||j===i+1&&x===COLS-1)continue;const amount=Math.min(j===i+COLS?this.water[i]:Math.max(0,(this.water[i]-this.water[j])*.5),1-this.water[j],j===i+COLS?.65:.22);this.water[i]-=amount;this.water[j]+=amount;}}
    for(const drain of this.drains){const queue=[[this.idx(drain.x,drain.y),0]],visited=new Set();for(let n=0;n<queue.length&&n<6000;n++){const [i,depth]=queue[n];if(visited.has(i)||depth>70||!this.open[i])continue;visited.add(i);this.water[i]=Math.max(0,this.water[i]-.20);const x=i%COLS;for(const j of [i+COLS,i-COLS,x>0?i-1:-1,x<COLS-1?i+1:-1])if(j>=0&&j<this.open.length&&!visited.has(j))queue.push([j,depth+1]);}}
    const pantry=this.rooms.find(r=>r.type==='pantry');if(pantry&&this.water[this.idx(pantry.x,pantry.y)]>.7&&this.stash>0){this.wetClock=(this.wetClock||0)+.1;if(this.wetClock>20){this.stash--;this.wetClock=0;this.event('Spiżarnia mokra. Przenieś zapasy wyżej lub zbuduj odpływ.');}}
  }
  save(){const keys=['seed','time','p','health','energy','hunger','food','wood','treasure','stash','claws','hearing','sprintUnlocked','invincible','escapeBoost','downed','won','facing','dug','moved','fillCount','cuts','sight','path','exits','rooms','drains','rocks','foods','kids','discoveries','predators'];const d={version:2,seen:pack(this.seen),water:[]};for(const key of keys)d[key]=this[key];for(const i of this.openSet)if(this.water[i]>.01)d.water.push([i,Math.round(this.water[i]*100)/100]);return d;}
  static load(d){if(d?.version!==2||!Array.isArray(d.cuts)||d.cuts.length>50000||!Array.isArray(d.kids)||d.kids.length!==3||!Number.isFinite(d.p?.x)||!Number.isFinite(d.p?.y))throw Error('Invalid save');const w=new World(d.seed);if(!w.valid(d.p.x,d.p.y))throw Error('Invalid position');for(const key of Object.keys(w.save()))if(!['version','seen','water'].includes(key)&&d[key]!==undefined)w[key]=d[key];w.open.fill(0);w.openSet.clear();for(const cut of w.cuts)w.paint(cut.x,cut.y,cut.r,cut.kind,false);w.seen=unpack(d.seen||'',COLS*ROWS);w.water.fill(0);for(const [i,v] of d.water||[])if(w.open[i])w.water[i]=clamp(v,0,1);for(const e of w.predators)if(e.type==='fox'&&(e.entry===undefined||!w.actorFits(e.x,e.y))){e.y=surface(e.x)-17;e.entering=false;delete e.entry;}if(!w.path?.length)w.path=[{...w.p}];w._revealX=w.p.x;w._revealY=w.p.y;return w;}
}
