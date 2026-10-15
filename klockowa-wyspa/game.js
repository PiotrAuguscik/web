import {VoxelWorld,BLOCKS,SIZE,HEIGHT,HALF,castRay,collides,overlapsBlock} from './world.mjs?v=2';
import {stepPlayer} from './player.mjs?v=2';
import {AnimalWorld} from './animals.mjs?v=2';
import {createAnimalViews} from './animal-view.js?v=2';
const T=window.THREE,$=id=>document.getElementById(id),canvas=$('world');
let renderer;
try{if(!T)throw Error('Brak biblioteki');renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}
catch(e){$('play').textContent='Nie udało się uruchomić 3D';document.querySelector('.intro>p').textContent='Spróbuj otworzyć grę w aktualnej przeglądarce z włączoną akceleracją grafiki.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color('#b8ddeb');scene.fog=new T.Fog('#b8ddeb',28,78);
const camera=new T.PerspectiveCamera(67,innerWidth/innerHeight,.05,160);camera.rotation.order='YXZ';
scene.add(new T.HemisphereLight('#fff7d8','#879c77',1.55));const sun=new T.DirectionalLight('#fff4db',1.2);sun.position.set(-22,40,18);scene.add(sun);
const world=new VoxelWorld(),SAVE_KEY='klockowa-wyspa-v1';
let saved=null;try{saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(saved?.version===1)world.load(saved.changes);}catch{}
const player={x:.5,y:7.001,z:10.5,height:1.75,vy:0};
let yaw=0,pitch=-.25,grounded=false,playing=false,started=false,selected=1,jumpQueued=false,dirty=false,saveTimer=0,toastTimer=0;
if(saved?.version===1&&saved.player&&['x','y','z'].every(k=>Number.isFinite(saved.player[k]))){const p=saved.player;if(world.inside(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z))&&!collides(world,p)){Object.assign(player,{x:p.x,y:p.y,z:p.z});yaw=Number.isFinite(p.yaw)?p.yaw:0;pitch=Number.isFinite(p.pitch)?Math.max(-1.5,Math.min(1.5,p.pitch)):-.16;}}
const keys=new Set();let joystick={x:0,y:0},joyId=null,lookId=null,lastLook={x:0,y:0},dragMouse=false,mouseTravel=0,mouseButton=0;
let touch=!!navigator.maxTouchPoints||matchMedia('(any-pointer: coarse)').matches;
function setTouch(v){touch=v;document.body.classList.toggle('touch',v);$('touch-controls').hidden=!v||!playing;$('touch-toggle').textContent=v?'Sterowanie myszą':'Sterowanie dotykowe';$('held-label').textContent=v?'Przysmak · dotknij Karm':'Przysmak · prawy klik, aby nakarmić';clearInputs();}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
// Original pixel textures, generated locally. No external art or font requests.
const atlas=document.createElement('canvas');atlas.width=256;atlas.height=64;const ctx=atlas.getContext('2d');
let randomSeed=74621;function rand(){randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;}
for(let tile=0;tile<16;tile++){
 const ox=(tile%8)*32,oy=Math.floor(tile/8)*32,base=tile===1?'#94724c':tile===12?'#83ae4d':tile===13?'#ba9158':(BLOCKS[tile]?.color||'#83ae4d');
 ctx.fillStyle=base;ctx.fillRect(ox,oy,32,32);
 for(let i=0;i<100;i++){const x=Math.floor(rand()*16)*2,y=Math.floor(rand()*16)*2;ctx.fillStyle=rand()>.5?'#ffffff12':'#26362313';ctx.fillRect(ox+x,oy+y,2+Math.floor(rand()*2)*2,2);}
 if(tile===1){ctx.fillStyle='#81a84a';ctx.fillRect(ox,oy,32,7);for(let x=0;x<32;x+=4){ctx.fillStyle='#6d9640';ctx.fillRect(ox+x,oy+6,4,2+rand()*4);}}
 if(tile===2){for(let y=7;y<32;y+=8){ctx.fillStyle='#79593655';ctx.fillRect(ox,oy+y,32,1);ctx.fillRect(ox+(y%16?9:23),oy+y-7,1,7);}}
 if(tile===6){ctx.fillStyle='#e6c5a1';for(let y=7;y<32;y+=8){ctx.fillRect(ox,oy+y,32,1);for(let x=(y%16?8:0);x<32;x+=16)ctx.fillRect(ox+x,oy+y-7,1,7);}}
 if(tile===10){ctx.fillStyle='#543c2c55';for(let x=3;x<32;x+=7)ctx.fillRect(ox+x,oy,2,32);}
 if(tile===13){ctx.strokeStyle='#82633c';for(let i=3;i<15;i+=4)ctx.strokeRect(ox+i,oy+i,32-2*i,32-2*i);}
}
const texture=new T.CanvasTexture(atlas);texture.magFilter=T.NearestFilter;texture.minFilter=T.NearestFilter;texture.colorSpace=T.SRGBColorSpace;
const material=new T.MeshLambertMaterial({map:texture,vertexColors:true});
const faces=[
 {d:[1,0,0],v:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],shade:.86},
 {d:[-1,0,0],v:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],shade:.74},
 {d:[0,1,0],v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],shade:1},
 {d:[0,-1,0],v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.57},
 {d:[0,0,1],v:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],shade:.92},
 {d:[0,0,-1],v:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],shade:.8}
];
const chunks=new Map(),CHUNK=8;
function rebuildChunk(cx,cz){
 if(cx<0||cz<0||cx>=SIZE/CHUNK||cz>=SIZE/CHUNK)return;
 const id=cx+','+cz,old=chunks.get(id);if(old){scene.remove(old);old.geometry.dispose();}
 const positions=[],normals=[],colors=[],uvs=[],indices=[];let count=0;
 for(let x=cx*CHUNK-HALF;x<(cx+1)*CHUNK-HALF;x++)for(let z=cz*CHUNK-HALF;z<(cz+1)*CHUNK-HALF;z++)for(let y=0;y<HEIGHT;y++){
  const type=world.get(x,y,z);if(!type)continue;
  for(let f=0;f<faces.length;f++){const face=faces[f],[dx,dy,dz]=face.d;if(world.get(x+dx,y+dy,z+dz))continue;
   let tile=type;if(type===1)tile=f===2?12:f===3?9:1;if(type===10&&f>=2&&f<=3)tile=13;
   const u=(tile%8)/8,v=1-(Math.floor(tile/8)+1)/2,eps=.0015;
   const uv=[[u+eps,v+eps],[u+.125-eps,v+eps],[u+.125-eps,v+.5-eps],[u+eps,v+.5-eps]];
   const shade=face.shade*(.94+((Math.abs(x*17+y*13+z*7)%11)/11)*.06);
   for(let i=0;i<4;i++){const p=face.v[i];positions.push(x+p[0],y+p[1],z+p[2]);normals.push(dx,dy,dz);colors.push(shade,shade,shade);uvs.push(...uv[i]);}
   indices.push(count,count+1,count+2,count,count+2,count+3);count+=4;
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeBoundingSphere();
 const mesh=new T.Mesh(geometry,material);chunks.set(id,mesh);scene.add(mesh);
}
function rebuildAt(x,z){const cx=Math.floor((x+HALF)/8),cz=Math.floor((z+HALF)/8);const ids=new Set([`${cx},${cz}`,`${Math.floor((x-1+HALF)/8)},${cz}`,`${Math.floor((x+1+HALF)/8)},${cz}`,`${cx},${Math.floor((z-1+HALF)/8)}`,`${cx},${Math.floor((z+1+HALF)/8)}`]);for(const id of ids)rebuildChunk(...id.split(',').map(Number));}
for(let x=0;x<SIZE/8;x++)for(let z=0;z<SIZE/8;z++)rebuildChunk(x,z);
const sea=new T.Mesh(new T.PlaneGeometry(280,280),new T.MeshLambertMaterial({color:'#83c8cf',transparent:true,opacity:.8}));sea.rotation.x=-Math.PI/2;sea.position.y=2.15;scene.add(sea);
// A few gentle clouds made of cubes.
const cloudMaterial=new T.MeshLambertMaterial({color:'#fffdf1'}),clouds=[];
for(let i=0;i<10;i++){const group=new T.Group();for(let j=0;j<4;j++){const cube=new T.Mesh(new T.BoxGeometry(3+rand()*4,1.1+rand(),2+rand()*3),cloudMaterial);cube.position.set(j*2,rand()*.5,rand()*2);group.add(cube);}group.position.set(-65+rand()*120,25+rand()*8,-65+rand()*100);scene.add(group);clouds.push(group);}
const flowerMaterial=[new T.MeshLambertMaterial({color:'#f5d579'}),new T.MeshLambertMaterial({color:'#e5a7ae'}),new T.MeshLambertMaterial({color:'#fcf3d5'})];
for(let i=0;i<90;i++){const x=Math.floor(rand()*38)-19,z=Math.floor(rand()*38)-19,y=world.surface(x,z);if(world.get(x,y-1,z)!==1||Math.abs(x)<4&&z>0&&z<13)continue;const flower=new T.Mesh(new T.BoxGeometry(.15,.18,.15),flowerMaterial[i%3]);flower.position.set(x+.5,y+.12,z+.5);flower.userData.cell={x,y,z};scene.add(flower);}
const outline=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.006,1.006,1.006)),new T.LineBasicMaterial({color:'#fff8d6',transparent:true,opacity:.95}));outline.visible=false;scene.add(outline);
const animals=new AnimalWorld(world,saved?.animals);
const animalViews=createAnimalViews(scene,animals);
const dir=new T.Vector3();let target=null,animalTarget=null,inventoryOpen=false,lastW=-Infinity,sprintLatch=false,jumpHeld=false;
const food={name:'Przysmak',color:'#dba955'};
const drops=[];
function item(type){return type===9?food:BLOCKS[type];}
function syncCamera(){camera.position.set(player.x,player.y+(player.height<1.7?1.27:1.56),player.z);camera.rotation.set(pitch,yaw,0,'YXZ');camera.updateMatrixWorld();}
let lastFriendCount=-1,lastPlaceSelection=-1;
function updateTarget(){
 camera.getWorldDirection(dir);target=castRay(world,camera.position,dir);animalTarget=animals.target(camera.position,dir);
 outline.visible=playing&&!inventoryOpen&&selected!==9&&!!target;
 if(target)outline.position.set(target.x+.5,target.y+.5,target.z+.5);
 const friends=animals.animals.filter(a=>a.friend).length;
 if(friends!==lastFriendCount){$('animal-status').textContent=`♡ Przyjaciele ${friends}/6`;lastFriendCount=friends;}
 if(animalTarget){$('hint').textContent=animalTarget.name+' · '+(selected===9?(animalTarget.happy>0?'Najedzone ♡':touch?'dotknij Karm':'prawy klik: nakarm'):'wybierz 9 — przysmak');}
 else if(selected===9)$('hint').textContent='Wyceluj w zwierzątko · '+(touch?'dotknij Karm':'prawy klik: karm');
 else $('hint').textContent=target?BLOCKS[target.type].name+' · '+(touch?'użyj przycisku':'lewy: kop · prawy: buduj'):'Podejdź bliżej i wyceluj w klocek';
 if(lastPlaceSelection!==selected){$('place').innerHTML=selected===9?'♡<small>Karm</small>':'＋<small>Buduj</small>';$('place').setAttribute('aria-label',selected===9?'Nakarm zwierzątko':'Postaw klocek');lastPlaceSelection=selected;}
}
function select(type){
 selected=type;
 document.querySelectorAll('[data-item]').forEach(b=>{const active=Number(b.dataset.item)===type;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 const held=$('held-food');held.hidden=selected!==9||!playing||inventoryOpen;
}
for(let i=1;i<=9;i++){
 const data=item(i);
 for(const parent of [$('hotbar'),$('inventory-items')]){
  const b=document.createElement('button');b.dataset.item=i;
  b.innerHTML=`<span class="number">${i}</span><span class="swatch ${i===9?'food-swatch':''}" style="--block:${data.color}">${i===9?'♧':''}</span><span class="block-name">${data.name}</span>`;
  b.title=`${i} · ${data.name}`;b.setAttribute('aria-label',`Wybierz: ${data.name}`);
  b.addEventListener('click',()=>{select(i);b.blur();if(inventoryOpen)toggleInventory(false);});parent.append(b);
 }
}select(1);
function save(){clearTimeout(saveTimer);try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,changes:world.serialize(),player:{x:player.x,y:player.y,z:player.z,yaw,pitch},animals:animals.serialize()}));$('save').textContent='✓ Zapisano na tym urządzeniu';dirty=false;}catch{$('save').textContent='Zapis niedostępny — zostaw otwartą kartę';}}
function scheduleSave(){dirty=true;$('save').textContent='Zapisywanie…';clearTimeout(saveTimer);saveTimer=setTimeout(save,650);}
function action(place){
 if(!playing||inventoryOpen)return;syncCamera();updateTarget();
 if(animalTarget){
  if(!place){toast('Zwierzątka są bezpieczne. Wybierz 9 i nakarm je prawym kliknięciem.');return;}
  if(selected!==9){toast('Wybierz przysmak pod klawiszem 9.');return;}
  const result=animals.feed(animalTarget,player);
  if(result==='fed'){toast(`${animalTarget.name} chrupie przysmak! ♡`);scheduleSave();}
  else toast(result==='full'?'Brzuszek pełny! Za chwilę będzie kolejny przysmak.':'Podejdź bliżej — nie można karmić przez ścianę.');
  return;
 }
 if(selected===9&&place){toast('Podejdź do zwierzątka i wyceluj w nie.');return;}
 if(!target){toast('Podejdź bliżej klocka i wyceluj w niego.');return;}
 let {x,y,z,type,normal}=target;
 if(place){
  x+=normal.x;y+=normal.y;z+=normal.z;
  if(!world.inside(x,y,z)||y===0){toast('To już granica wyspy. Buduj bliżej środka.');return;}
  if(overlapsBlock(player,x,y,z)){toast('Zrób krok w bok, żeby postawić tu klocek.');return;}
  if(animals.animals.some(a=>overlapsBlock(a,x,y,z))){toast('Zwierzątko stoi w tym miejscu. Poczekaj, aż odejdzie.');return;}
  if(world.get(x,y,z))return;type=selected;
 }else{if(y===0){toast('To twarde dno wyspy. Wyżej możesz kopać do woli!');return;}type=0;}
 world.set(x,y,z,type);rebuildAt(x,z);animals.invalidate();
 scene.children.filter(m=>m.userData.cell&&m.userData.cell.x===x&&m.userData.cell.z===z).forEach(m=>{const p=m.userData.cell;if(!world.get(p.x,p.y-1,p.z)||world.get(p.x,p.y,p.z)){scene.remove(m);m.geometry.dispose();}});
 scheduleSave();updateTarget();
}
function pickBlock(){if(!playing||inventoryOpen)return;syncCamera();updateTarget();if(target&&target.type<=8)select(target.type);}
function dropItem(){
 if(!playing||inventoryOpen)return;
 const type=selected,mesh=new T.Mesh(new T.BoxGeometry(.22,.22,.22),new T.MeshLambertMaterial({color:item(type).color}));
 const x=player.x-Math.sin(yaw)*.8,z=player.z-Math.cos(yaw)*.8;
 if(collides(world,{x,y:player.y+1,z,height:.24,radius:.12})){mesh.geometry.dispose();mesh.material.dispose();toast('Zrób krok od ściany, by wyrzucić przedmiot.');return;}
 mesh.position.set(x,player.y+1,z);scene.add(mesh);drops.push({mesh,type,x,y:player.y+1,z,vy:2,height:.23,radius:.12,age:0});toast(`Wyrzucono: ${item(type).name} · podejdź, by podnieść`);
}
function updateDrops(dt){for(let i=drops.length-1;i>=0;i--){const d=drops[i];d.age+=dt;d.vy-=21*dt;if(moveDrop(d,dt))d.vy=0;d.mesh.position.set(d.x,d.y+.11,d.z);d.mesh.rotation.y+=dt*1.5;
 if(d.age>1.2&&Math.hypot(d.x-player.x,d.z-player.z)<1.2&&Math.abs(d.y-player.y)<1.8||d.age>60){scene.remove(d.mesh);d.mesh.geometry.dispose();d.mesh.material.dispose();drops.splice(i,1);if(d.age<=60){select(d.type);toast('Podniesiono: '+item(d.type).name);}}
}}
function moveDrop(d,dt){const old=d.y;d.y+=d.vy*dt;if(collides(world,d)){d.y=old;return true;}return false;}
function clearInputs(){keys.clear();joystick={x:0,y:0};joyId=null;lookId=null;dragMouse=false;jumpQueued=false;jumpHeld=false;sprintLatch=false;$('stick').style.transform='';}
function pause(){if(!playing)return;playing=false;inventoryOpen=false;$('inventory').hidden=true;clearInputs();if(document.pointerLockElement)document.exitPointerLock();$('menu').hidden=false;$('crosshair').hidden=true;$('hint').hidden=true;$('held-food').hidden=true;$('touch-controls').hidden=true;document.body.classList.remove('playing');$('play').textContent='Wracam do budowania';save();}
function pointerStatus(){const locked=document.pointerLockElement===canvas;$('mouse-mode').textContent=locked?'Mysz: swobodna':'Włącz swobodną mysz';$('mouse-mode').title=locked?'Esc zwalnia mysz':'Kliknij, aby rozglądać się samym ruchem myszy';}
async function lockPointer(){
 if(touch||!playing||inventoryOpen||document.pointerLockElement===canvas)return;
 try{if(!canvas.requestPointerLock)throw Error('Brak Pointer Lock');await canvas.requestPointerLock();pointerStatus();}
 catch{pointerStatus();toast('Przeglądarka nie przejęła myszy. Przeciągaj widok lub otwórz link w Chrome / Edge.');}
}
function toggleInventory(open=!inventoryOpen){
 if(!playing)return;inventoryOpen=open;clearInputs();$('inventory').hidden=!open;$('crosshair').hidden=open;$('hint').hidden=open;$('touch-controls').hidden=!touch||open;$('held-food').hidden=selected!==9||open;
 if(open){if(document.pointerLockElement)document.exitPointerLock();$('inventory-close').focus();}else{canvas.focus({preventScroll:true});lockPointer();}
}
function start(){playing=true;started=true;clearInputs();$('menu').hidden=true;$('crosshair').hidden=false;$('hint').hidden=false;$('touch-controls').hidden=!touch;document.body.classList.add('playing');canvas.focus({preventScroll:true});select(selected);lockPointer();}
function home(){player.x=.5;player.z=10.5;player.y=Math.max(7.001,world.surface(0,10)+.001);player.vy=0;player.jumpBuffer=0;yaw=0;pitch=-.25;grounded=false;if(player.y>HEIGHT-2){player.x=-4.5;player.z=10.5;player.y=world.surface(-5,10)+.001;}save();toast('Jesteś z powrotem na polanie.');}
$('play').addEventListener('click',start);$('pause').addEventListener('click',()=>playing?pause():start());document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();pause();});$('home').addEventListener('click',home);$('touch-toggle').addEventListener('click',()=>{setTouch(!touch);if(document.pointerLockElement)document.exitPointerLock();});
$('mouse-mode').addEventListener('click',lockPointer);$('inventory-button').addEventListener('click',()=>toggleInventory());$('inventory-close').addEventListener('click',()=>toggleInventory(false));
$('reset').addEventListener('click',()=>{$('reset-confirm').hidden=false;});$('reset-no').addEventListener('click',()=>{$('reset-confirm').hidden=true;});$('reset-yes').addEventListener('click',()=>{try{localStorage.removeItem(SAVE_KEY);}catch{}location.reload();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Ta przeglądarka nie obsługuje pełnego ekranu.');}catch{toast('Pełny ekran niedostępny. Możesz grać w oknie.');}});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').title=document.fullscreenElement?'Wyjdź z pełnego ekranu':'Włącz pełny ekran';$('fullscreen').querySelector('span').textContent=document.fullscreenElement?'Wróć do okna':'Pełny ekran';clearInputs();resize();});
document.addEventListener('pointerlockchange',()=>{pointerStatus();if(!document.pointerLockElement&&playing&&!touch&&!inventoryOpen)pause();});
document.addEventListener('pointerlockerror',()=>{pointerStatus();if(playing&&!inventoryOpen)toast('Przejęcie myszy niedostępne w tej przeglądarce. Przeciągaj widok.');});
window.addEventListener('keydown',e=>{
 if(e.code==='Escape'){e.preventDefault();if(inventoryOpen)toggleInventory(false);else pause();return;}
 if(!playing)return;
 if(e.code==='KeyE'){e.preventDefault();if(!e.repeat)toggleInventory();return;}
 if(inventoryOpen)return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ControlLeft','ControlRight','ShiftLeft','ShiftRight','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','KeyQ'].includes(e.code))e.preventDefault();
 keys.add(e.code);
 if(e.code==='KeyW'&&!e.repeat){const now=performance.now();if(now-lastW<260)sprintLatch=true;lastW=now;}
 if(e.code==='Space'){jumpHeld=true;if(!e.repeat)jumpQueued=true;}
 if(/^Digit[1-9]$/.test(e.code))select(Number(e.code.slice(-1)));
 if(e.code==='KeyQ'&&!e.repeat)dropItem();
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')jumpHeld=false;if(e.code==='KeyW')sprintLatch=false;});
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>{if(started||dirty)save();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{if(!playing||inventoryOpen)return;e.preventDefault();select(((selected-1+Math.sign(e.deltaY)+9)%9)+1);},{passive:false});
canvas.addEventListener('pointerdown',e=>{
 if(!playing||inventoryOpen)return;
 canvas.focus({preventScroll:true});
 if(e.pointerType==='touch'){if(lookId!==null)return;lookId=e.pointerId;lastLook={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}
 else if(e.button===1){e.preventDefault();pickBlock();}
 else if(document.pointerLockElement===canvas){action(e.button===2);}
 else{dragMouse=true;mouseTravel=0;mouseButton=e.button;lookId=e.pointerId;lastLook={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);if(e.button===2)action(true);}
});
canvas.addEventListener('pointermove',e=>{if(!playing||inventoryOpen||document.pointerLockElement===canvas)return;if(e.pointerId!==lookId)return;const dx=e.clientX-lastLook.x,dy=e.clientY-lastLook.y;mouseTravel+=Math.abs(dx)+Math.abs(dy);yaw-=dx*.004;pitch=Math.max(-1.5,Math.min(1.5,pitch-dy*.004));lastLook={x:e.clientX,y:e.clientY};});
document.addEventListener('mousemove',e=>{if(playing&&!inventoryOpen&&document.pointerLockElement===canvas){yaw-=e.movementX*.0025;pitch=Math.max(-1.5,Math.min(1.5,pitch-e.movementY*.0025));}});
function endLook(e){if(e.pointerId===lookId){if(e.type==='pointerup'&&dragMouse&&mouseButton===0&&mouseTravel<6)action(false);lookId=null;dragMouse=false;}}for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,endLook);
const joy=$('joystick');function moveJoy(e){if(e.pointerId!==joyId)return;const r=joy.getBoundingClientRect(),max=r.width*.32;let x=(e.clientX-r.left-r.width/2)/max,y=(e.clientY-r.top-r.height/2)/max;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}joystick={x:Math.abs(x)<.13?0:x,y:Math.abs(y)<.13?0:y};$('stick').style.transform=`translate(${x*max}px,${y*max}px)`;}
joy.addEventListener('pointerdown',e=>{if(!playing||inventoryOpen||joyId!==null)return;joyId=e.pointerId;joy.setPointerCapture(joyId);moveJoy(e);});joy.addEventListener('pointermove',moveJoy);for(const type of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(type,e=>{if(e.pointerId===joyId){joyId=null;joystick={x:0,y:0};$('stick').style.transform='';}});
for(const [id,fn] of [['jump',()=>{jumpQueued=true;}],['remove',()=>action(false)],['place',()=>action(true)]])$(id).addEventListener('pointerdown',e=>{e.preventDefault();if(playing&&!inventoryOpen)fn();});
function physics(dt){
 const turn=1.7*dt;if(keys.has('ArrowLeft'))yaw+=turn;if(keys.has('ArrowRight'))yaw-=turn;if(keys.has('ArrowUp'))pitch=Math.min(1.5,pitch+turn);if(keys.has('ArrowDown'))pitch=Math.max(-1.5,pitch-turn);
 stepPlayer(world,player,{forward:(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-joystick.y,side:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joystick.x,yaw,sneak:keys.has('ShiftLeft')||keys.has('ShiftRight'),sprint:keys.has('ControlLeft')||keys.has('ControlRight')||sprintLatch,jumpPressed:jumpQueued,jumpHeld},dt);jumpQueued=false;
 if(player.y<-6){home();toast('Hop! Z powrotem na polanie.');}
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();clearInputs();}window.addEventListener('resize',resize);
setTouch(touch);syncCamera();$('play').disabled=false;$('play').textContent=saved?.version===1?'Wracam do budowania':'Zaczynamy';
if(saved?.version===1)$('save').textContent='✓ Wczytano twoją wyspę';
let lastTime=performance.now(),accumulator=0;
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min((now-lastTime)/1000,.08);lastTime=now;
 if(playing&&!inventoryOpen){accumulator+=dt;while(accumulator>=1/120){physics(1/120);accumulator-=1/120;}animals.step(dt,player,selected===9);updateDrops(dt);syncCamera();updateTarget();}
 else{accumulator=0;outline.visible=false;syncCamera();}
 animalViews.update(player);for(const c of clouds){c.position.x+=dt*.1;if(c.position.x>80)c.position.x=-80;}renderer.render(scene,camera);
}
requestAnimationFrame(frame);
