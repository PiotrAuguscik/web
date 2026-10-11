export const W=72,H=36,SURFACE=4,DAY=120;
export const TILE={SKY:0,SOIL:1,CLAY:2,ROOT:3,ROCK:4,AIR:5};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
export class World{
  constructor(seed=Date.now()){
    this.seed=seed;this.rand=random(seed);this.time=0;this.health=100;this.hunger=90;this.energy=100;this.food=2;this.wood=4;this.treasure=0;this.stash=0;this.dug=0;this.eaten=0;this.claws=0;this.found=[];this.events=[];this.rooms=[];this.exits=[];this.drains=[];this.won=false;this.dead=false;this.invincible=0;this.pulse=0;this.listenCooldown=0;this.noise=0;this.stepClock=0;this.simClock=0;this.waterClock=0;this.digProgress=0;this.digTarget=-1;this.lastDir={x:1,y:0};this.p={x:12,y:10};this.home={x:12,y:10};
    this.tiles=new Array(W*H);this.seen=new Array(W*H).fill(false);this.water=new Array(W*H).fill(0);this.foods=[];this.discoveries=[];
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      let t=y<SURFACE?0:1;const r=this.rand();
      if(y>=SURFACE){if(r<.065)t=4;else if(r<.2&&y>9)t=2;else if(r<.24)t=3;}
      if(x===0||x===W-1||y===H-1)t=4;
      this.tiles[this.idx(x,y)]=t;
    }
    // Roots form recognizable obstacles under trees.
    for(const tx of [8,27,45,62])for(let y=4;y<12;y++)for(let x=tx-1;x<=tx+1;x++)if(this.valid(x,y))this.tiles[this.idx(x,y)]=3;
    this.carve(12,10,1);this.rooms.push({x:12,y:10,type:'home'});
    for(let y=3;y<10;y++)this.tiles[this.idx(12,y)]=5;
    this.tiles[this.idx(12,3)]=0;this.exits.push(12);
    for(let x=9;x<=17;x++)this.tiles[this.idx(x,10)]=5;
    for(const [x,y] of [[16,10],[18,11],[13,13],[10,12],[15,8],[7,10]]){this.tiles[this.idx(x,y)]=1;this.foods.push({x,y,type:'worm'});}
    this.tiles[this.idx(15,10)]=3;this.tiles[this.idx(17,12)]=3;this.tiles[this.idx(10,13)]=3;
    for(let i=0;i<125;i++){const x=2+Math.floor(this.rand()*(W-4)),y=5+Math.floor(this.rand()*(H-7));if(this.tile(x,y)!==4&&!this.foods.some(f=>f.x===x&&f.y===y))this.foods.push({x,y,type:this.tile(x,y)===3?'larva':'worm'});}
    for(let i=0;i<15;i++)this.foods.push({x:3+Math.floor(this.rand()*(W-6)),y:3,type:i%3===0?'leaf':'worm'});
    for(const [x,y,type] of [[22,13,'coin'],[33,17,'boot'],[48,25,'cave'],[58,11,'old']]){
      this.discoveries.push({x,y,type,found:false});this.tiles[this.idx(x,y)]=1;
      if(type!=='coin'){this.carve(x,y,type==='cave'?2:1);if(type==='old')for(let xx=x-5;xx<=x+5;xx++)this.tiles[this.idx(xx,y)]=5;}
    }
    this.predators=[{type:'fox',x:35,y:3,dir:-1,clock:0,alert:0},{type:'owl',x:49,y:1,dir:1,clock:0,alert:0},{type:'snake',x:57,y:11,dir:-1,clock:0,alert:0},{type:'fox',x:66,y:3,dir:1,clock:0,alert:0}];
    this.predators.push({type:'snake',x:33,y:17,dir:1,clock:0,alert:0});this.peek=0;this.stashWetClock=0;this.reveal();
  }
  idx(x,y){return y*W+x;}valid(x,y){return x>0&&x<W-1&&y>=1&&y<H-1;}
  tile(x,y){return this.valid(x,y)?this.tiles[this.idx(x,y)]:4;}
  open(x,y){const t=this.tile(x,y);return t===0||t===5;}
  carve(cx,cy,r){for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)if(this.valid(x,y)&&y>=SURFACE)this.tiles[this.idx(x,y)]=5;}
  event(text,type='info'){this.events.push({text,type});}
  reveal(){const r=this.p.y<SURFACE?3.2:3.6;for(let y=Math.floor(this.p.y-r);y<=this.p.y+r;y++)for(let x=Math.floor(this.p.x-r);x<=this.p.x+r;x++)if(this.valid(x,y)&&Math.hypot(x-this.p.x,y-this.p.y)<=r)this.seen[this.idx(x,y)]=true;}
  get day(){return Math.floor(this.time/DAY)+1;}
  get raining(){return this.time>=DAY+25&&this.time<DAY+90||this.time>=DAY*3+15&&this.time%(DAY*2)<90;}
  get nearHome(){return this.rooms.some(r=>distance(r,this.p)<2.5&&r.type!=='drain');}
  get bedroom(){return this.rooms.find(r=>r.type==='bedroom'&&distance(r,this.p)<2.5);}
  get progress(){return {days:Math.min(3,Math.floor(this.time/DAY)),rooms:Math.min(3,this.rooms.filter(r=>['bedroom','pantry','safe'].includes(r.type)).length),stash:Math.min(6,this.stash),exits:Math.min(2,this.exits.length)};}
  move(dx,dy,dt){
    if(this.dead)return;dx=Math.sign(dx);dy=Math.sign(dy);if(!dx&&!dy){this.digProgress=0;this.digTarget=-1;return;}if(dx&&dy)dy=0;
    this.lastDir={x:dx,y:dy};const nx=this.p.x+dx,ny=this.p.y+dy,i=this.idx(nx,ny),t=this.tile(nx,ny);if(ny<3)return;
    if(t===4){if(this.digTarget!==i)this.event('Kamień. Poszukaj drogi dookoła.');this.digTarget=i;this.digProgress=0;return;}
    if(t!==0&&t!==5){
      if(this.energy<1){if(this.digTarget!==i)this.event('Brak energii. Zjedz dżdżownicę lub odpocznij w norze.');this.digTarget=i;return;}
      if(this.digTarget!==i){this.digTarget=i;this.digProgress=0;}
      const hard=t===2?.58:t===3?.4:.2;this.digProgress+=dt*(1+this.claws*.45);this.noise=1;
      if(this.digProgress<hard)return;
      this.tiles[i]=5;this.dug++;this.energy=clamp(this.energy-(t===2?2.8:1.1),0,100);if(t===3){this.wood++;if(this.wood<9)this.event('Korzeń! +1 materiał do budowania.');}
      this.digProgress=0;
    }
    if(this.stepClock>0)return;
    const previousY=this.p.y;this.p.x=nx;this.p.y=ny;this.stepClock=this.water[i]>.35?.26:.15;this.digTarget=-1;
    if(((ny===3&&previousY===4)||(ny===4&&previousY===3))&&this.open(nx,4)&&!this.exits.includes(nx)){this.exits.push(nx);this.event('Nowe wyjście awaryjne! Lis nie zna wszystkich twoich dróg.');}
    this.reveal();this.collect();
  }
  collect(){
    for(let i=this.foods.length-1;i>=0;i--){const f=this.foods[i];if(distance(f,this.p)<.6){if(f.type==='leaf'){this.wood+=2;this.event('Suche liście! +2 materiały.');}else{this.food++;this.event(f.type==='larva'?'Larwa przy korzeniu! +1 jedzenie.':'Dżdżownica złapana! Q / Zjedz, aby odzyskać siły.');}this.foods.splice(i,1);}}
    for(const d of this.discoveries){if(!d.found&&distance(d,this.p)<1.8){d.found=true;this.found.push(d.type);const msg={coin:'Zakopana moneta! +2 błyskotki na lepsze pazurki.',boot:'Stary but! Gotowa komora i +3 materiały.',cave:'Wielka jama pod drzewem! Idealna kryjówka.',old:'Tunele innego kreta. Ktoś już tu mieszkał…'};this.event(msg[d.type],'discovery');if(d.type==='coin')this.treasure+=2;if(d.type==='boot')this.wood+=3;if(d.type==='boot'||d.type==='cave')this.rooms.push({x:d.x,y:d.y,type:'shelter'});}}
  }
  eat(){if(!this.food){this.event('Nie masz jedzenia. Nasłuchuj drgań w ziemi.');return false;}if(this.hunger>95&&this.energy>95){this.event('Brzuszek pełny. Zachowaj jedzenie na później.');return false;}this.food--;this.eaten++;this.hunger=clamp(this.hunger+32,0,100);this.energy=clamp(this.energy+24,0,100);this.health=clamp(this.health+5,0,100);this.event('Mniam! Sytość +32, energia +24.');return true;}
  listen(){if(this.listenCooldown>0){this.event('Jeszcze chwila… Nasłuch wróci za '+Math.ceil(this.listenCooldown)+' s.');return false;}this.pulse=3.5;this.listenCooldown=6;if(this.p.y===4&&this.open(this.p.x,3)){this.peek=2.5;this.event('Wystawiasz nos i nasłuchujesz. Twoje ciało zostaje w tunelu.');}else this.event('Ciche drgania: jedzenie. Ciężkie, czerwone: zagrożenie.');return true;}
  build(type){
    if(type==='claws'){if(this.claws>=2){this.event('Masz już najlepsze pazurki.');return false;}if(this.wood<6&&this.treasure<2){this.event('Potrzebujesz 6 materiałów albo 2 błyskotek.');return false;}if(this.treasure>=2)this.treasure-=2;else this.wood-=6;this.claws++;this.event('Mocniejsze pazurki! Szybciej kopiesz.');return true;}
    const relocating=type==='relocate';const cost={bedroom:3,pantry:3,safe:4,drain:2,relocate:2}[type];if(!cost)return false;
    if(relocating&&!this.rooms.some(r=>r.type==='pantry')){this.event('Najpierw zbuduj spiżarnię.');return false;}
    if(this.p.y<7){this.event('Buduj głębiej: co najmniej 3 warstwy pod ziemią.');return false;}
    if(this.wood<cost){this.event('Za mało materiałów. Kop korzenie lub zbieraj liście na powierzchni.');return false;}
    if(this.rooms.some(r=>distance(r,this.p)<3.5)||this.drains.some(r=>distance(r,this.p)<3)){this.event('Zostaw trochę miejsca między komorami. Odejdź co najmniej 4 kroki.');return false;}
    for(let y=this.p.y-1;y<=this.p.y+1;y++)for(let x=this.p.x-1;x<=this.p.x+1;x++)if(this.tile(x,y)===4){this.event('W tym miejscu jest skała. Wybierz wolną przestrzeń.');return false;}
    if(type!=='drain'&&this.rooms.some(r=>r.type===type)){this.event('Masz już taką komorę. Zbuduj kolejny rodzaj.');return false;}
    this.wood-=cost;this.carve(this.p.x,this.p.y,1);if(type==='drain')this.drains.push({...this.p});else{if(relocating){this.rooms=this.rooms.filter(r=>r.type!=='pantry');this.stashWetClock=0;}this.rooms.push({...this.p,type:relocating?'pantry':type});}this.reveal();
    this.event({bedroom:'Sypialnia gotowa! Tu szybciej odpoczywasz.',pantry:'Spiżarnia gotowa! Zanieś tu zapasy.',safe:'Bezpieczna komora! Drapieżniki nie wejdą do środka.',drain:'Odpływ gotowy! Osusza połączone tunele.',relocate:'Spiżarnia przeniesiona razem ze wszystkimi zapasami.'}[type]);this.checkWin();return true;
  }
  deposit(){if(!this.rooms.some(r=>r.type==='pantry'&&distance(r,this.p)<2.5)){this.event('Zapasy składaj w spiżarni. Najpierw ją zbuduj.');return false;}const n=Math.max(0,this.food-2);if(!n){this.event('Zachowaj 2 porcje na drogę. Przynieś więcej jedzenia.');return false;}this.food-=n;this.stash+=n;this.event('W spiżarni: '+this.stash+' porcji. Dwie zostają przy tobie.');this.checkWin();return true;}
  withdraw(){if(!this.rooms.some(r=>r.type==='pantry'&&distance(r,this.p)<2.5)||!this.stash){this.event('Nie ma tutaj zapasów do zabrania.');return false;}const n=Math.min(3,this.stash);this.stash-=n;this.food+=n;this.event('Zabierasz '+n+' porcje na wyprawę.');return true;}
  rest(){if(!this.nearHome){this.event('Odpoczywaj w norze albo odkrytej kryjówce.');return false;}if(this.hunger<18){this.event('Zjedz przed odpoczynkiem, żeby nie obudzić się głodnym.');return false;}if(this.water[this.idx(this.p.x,this.p.y)]>.2){this.event('Tu jest mokro. Znajdź suchą komorę albo zbuduj odpływ.');return false;}const bed=!!this.bedroom;this.energy=clamp(this.energy+(bed?60:35),0,100);this.health=clamp(this.health+(bed?30:15),0,100);this.hunger-=12;this.time+=25;this.event('Drzemka: siły wracają, mija 25 sekund.');this.checkWin();return true;}
  tick(dt,input={x:0,y:0}){
    if(this.dead)return;const rainBefore=this.raining,dayBefore=this.day;this.time+=dt;this.stepClock=Math.max(0,this.stepClock-dt);this.invincible=Math.max(0,this.invincible-dt);this.listenCooldown=Math.max(0,this.listenCooldown-dt);this.pulse=Math.max(0,this.pulse-dt);this.noise=Math.max(0,this.noise-dt*.6);
    this.move(input.x,input.y,dt);
    this.hunger=Math.max(0,this.hunger-dt*.15);if(this.hunger<=0)this.health-=dt*3;
    if(!input.x&&!input.y){this.energy=clamp(this.energy+dt*(this.nearHome?5:.9),0,100);if(this.nearHome&&this.hunger>20)this.health=clamp(this.health+dt*.9,0,100);}
    if(this.water[this.idx(this.p.x,this.p.y)]>.65){this.energy=Math.max(0,this.energy-dt*2);this.health-=dt*2.5;}
    if(!rainBefore&&this.raining)this.event('Nadchodzi ulewa! Woda wlewa się przez wyjścia. Buduj odpływy.','danger');
    if(rainBefore&&!this.raining){this.event('Deszcz ustaje. Na powierzchni pojawiło się dużo jedzenia!');for(let i=0;i<12;i++)this.foods.push({x:3+Math.floor(this.rand()*(W-6)),y:3,type:i%4===0?'leaf':'worm'});}
    this.peek=Math.max(0,this.peek-dt);const pantry=this.rooms.find(r=>r.type==='pantry');if(pantry&&this.stash>0&&this.water[this.idx(pantry.x,pantry.y)]>.6){this.stashWetClock+=dt;if(this.stashWetClock>20){this.stashWetClock=0;this.stash--;this.event('Spiżarnia zalana! Tracisz porcję. Przenieś zapasy wyżej lub zbuduj odpływ.','danger');}}else this.stashWetClock=0;
    if(this.day!==dayBefore){this.event('Dzień '+this.day+'. Nowa wyprawa, nowe drgania.');for(let i=0;i<8;i++)this.foods.push({x:3+Math.floor(this.rand()*(W-6)),y:3,type:i%2?'leaf':'worm'});}
    this.simClock+=dt;if(this.simClock>.4){this.simClock=0;this.simulate(.4);}
    this.waterClock+=dt;if(this.waterClock>.45){this.waterClock=0;this.flowWater();}
    if(this.health<=0){this.health=0;this.dead=true;this.event('Przygoda dobiegła końca.','dead');}
    this.checkWin();
  }
  safeAt(x,y){return this.rooms.some(r=>r.type==='safe'&&distance(r,{x,y})<2.2);}
  simulate(dt){
    // Small prey escapes slowly; larvae stay near roots.
    for(const f of this.foods){if(f.type!=='worm'||f.y<SURFACE||distance(f,this.p)>3||this.rand()>.15)continue;const dx=Math.sign(f.x-this.p.x)||1,dy=Math.sign(f.y-this.p.y);const opts=[[dx,0],[0,dy||1]];for(const [x,y] of opts){const nx=f.x+x,ny=f.y+y;if(this.valid(nx,ny)&&this.tile(nx,ny)!==4&&ny>=SURFACE&&!this.foods.some(o=>o!==f&&o.x===nx&&o.y===ny)){f.x=nx;f.y=ny;break;}}}
    for(const e of this.predators){
      e.clock+=dt;const d=distance(e,this.p);e.alert=0;
      if(e.type==='fox'){
        const hears=this.noise>.1&&this.p.y<=9&&Math.abs(e.x-this.p.x)<9;
        if(this.p.y<SURFACE&&Math.abs(e.x-this.p.x)<13||hears){e.alert=1;if(e.clock>.65){e.clock=0;if(Math.abs(e.x-this.p.x)>.5){if(e.y>3)e.y--;else e.x+=Math.sign(this.p.x-e.x);}else if(this.p.y<=9&&e.y<this.p.y&&!this.safeAt(e.x,e.y+1)&&this.tile(e.x,e.y+1)!==4){e.y++;this.tiles[this.idx(e.x,e.y)]=5;this.noise=.6;}}}
        else if(e.clock>1){e.clock=0;if(e.y>3)e.y--;else{e.x+=e.dir;if(e.x<3||e.x>W-4)e.dir*=-1;}}
      }else if(e.type==='owl'){
        if(this.p.y<SURFACE&&d<17){e.alert=1;if(e.clock>.5){e.clock=0;e.x+=Math.sign(this.p.x-e.x);e.y+=Math.sign(this.p.y-e.y);}}
        else if(e.clock>.6){e.clock=0;e.y=1;e.x+=e.dir;if(e.x<3||e.x>W-4)e.dir*=-1;}
      }else{
        if(d<13)e.alert=1;
        if(e.clock>.85){e.clock=0;let opts=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>this.open(e.x+dx,e.y+dy)&&e.y+dy>=3&&!this.safeAt(e.x+dx,e.y+dy));if(e.alert)opts.sort((a,b)=>distance({x:e.x+a[0],y:e.y+a[1]},this.p)-distance({x:e.x+b[0],y:e.y+b[1]},this.p));else opts.sort(()=>this.rand()-.5);if(opts.length){e.x+=opts[0][0];e.y+=opts[0][1];}}
      }
      if(distance(e,this.p)<1&&!this.invincible&&!this.safeAt(this.p.x,this.p.y)){
        this.health-=e.type==='owl'?40:32;this.invincible=4;this.energy=Math.max(0,this.energy-8);this.event({fox:'Lis cię dopadł! Uciekaj głębiej lub drugim wyjściem.',owl:'Sowa atakuje! Schowaj się pod ziemią.',snake:'Wąż w tunelu! Uciekaj do bezpiecznej komory.'}[e.type],'danger');
      }
    }
  }
  flowWater(){
    if(this.raining)for(let x=1;x<W-1;x++){const i=this.idx(x,4);if(this.open(x,4))this.water[i]=clamp(this.water[i]+.24,0,1);}
    for(let y=H-2;y>=SURFACE;y--)for(let x=1;x<W-1;x++){
      const i=this.idx(x,y);let v=this.water[i];if(v<=0)continue;
      this.water[i]=Math.max(0,v-(this.raining?.001:.012));
      for(const [dx,dy] of [[0,1],[-1,0],[1,0]]){const nx=x+dx,ny=y+dy,j=this.idx(nx,ny);if(!this.open(nx,ny)||ny<SURFACE)continue;const diff=dy?this.water[i]:Math.max(0,(this.water[i]-this.water[j])*.5);const amount=Math.min(diff,1-this.water[j],dy?.3:.08);this.water[i]-=amount;this.water[j]+=amount;}
    }
    // Each drain pumps its connected tunnel network, never through solid earth.
    for(const d of this.drains){const queue=[[d.x,d.y,0]],visited=new Set();for(let n=0;n<queue.length;n++){const [x,y,depth]=queue[n],i=this.idx(x,y);if(visited.has(i)||depth>20||!this.open(x,y))continue;visited.add(i);this.water[i]=Math.max(0,this.water[i]-.12);for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]])if(this.valid(x+dx,y+dy))queue.push([x+dx,y+dy,depth+1]);}}
  }
  checkWin(){const p=this.progress;if(!this.won&&!this.dead&&p.days===3&&p.rooms===3&&p.stash===6&&p.exits===2){this.won=true;this.event('Przetrwałeś trzy dni! Twoja nora jest gotowa.','win');}}
  save(){const keys=['seed','time','health','hunger','energy','food','wood','treasure','stash','dug','eaten','claws','found','rooms','exits','drains','won','dead','p','home','tiles','seen','water','foods','discoveries','predators'];const data={version:1};for(const k of keys)data[k]=this[k];return data;}
  static load(data){if(data?.version!==1||data.tiles?.length!==W*H||data.seen?.length!==W*H||data.water?.length!==W*H||!Array.isArray(data.foods)||!Array.isArray(data.rooms)||!Array.isArray(data.predators))throw Error('Invalid save');const w=new World(data.seed);for(const k of Object.keys(w.save()))if(k!=='version'&&data[k]!==undefined)w[k]=data[k];if(!Number.isInteger(w.p.x)||!Number.isInteger(w.p.y)||!w.valid(w.p.x,w.p.y))throw Error('Invalid position');w.reveal();return w;}
}
