import {VoxelWorld,BLOCKS,SIZE,HEIGHT,HALF,castRay,collides,overlapsBlock} from './world.mjs';
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
const player={x:.5,y:7.001,z:10.5},velocity={y:0};
let yaw=0,pitch=-.25,grounded=false,playing=false,started=false,selected=1,jumpQueued=false,dirty=false,saveTimer=0,toastTimer=0;
if(saved?.version===1&&saved.player&&['x','y','z'].every(k=>Number.isFinite(saved.player[k]))){const p=saved.player;if(world.inside(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z))&&!collides(world,p)){Object.assign(player,{x:p.x,y:p.y,z:p.z});yaw=Number.isFinite(p.yaw)?p.yaw:0;pitch=Number.isFinite(p.pitch)?Math.max(-1.5,Math.min(1.5,p.pitch)):-.16;}}
const keys=new Set();let joystick={x:0,y:0},joyId=null,lookId=null,lastLook={x:0,y:0},dragMouse=false,mouseTravel=0,mouseButton=0;
let touch=!!navigator.maxTouchPoints||matchMedia('(any-pointer: coarse)').matches;
function setTouch(v){touch=v;document.body.classList.toggle('touch',v);$('touch-controls').hidden=!v||!playing;$('touch-toggle').textContent=v?'Sterowanie myszą':'Sterowanie dotykowe';clearInputs();}
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
const dir=new T.Vector3();let target=null;
function syncCamera(){camera.position.set(player.x,player.y+1.56,player.z);camera.rotation.set(pitch,yaw,0,'YXZ');camera.updateMatrixWorld();}
function updateTarget(){camera.getWorldDirection(dir);target=castRay(world,camera.position,dir);outline.visible=playing&&!!target;if(target){outline.position.set(target.x+.5,target.y+.5,target.z+.5);$('hint').textContent=BLOCKS[target.type].name+' · '+(touch?'użyj przycisku':'lewy: usuń · prawy: buduj');}else $('hint').textContent='Podejdź bliżej i wyceluj w klocek';}
function select(type){selected=type;document.querySelectorAll('#hotbar button').forEach((b,i)=>{b.classList.toggle('active',i+1===type);b.setAttribute('aria-pressed',String(i+1===type));});}
for(let i=1;i<=8;i++){const b=document.createElement('button');b.innerHTML=`<span class="number">${i}</span><span class="swatch" style="--block:${BLOCKS[i].color}"></span><span class="block-name">${BLOCKS[i].name}</span>`;b.title=`${i} · ${BLOCKS[i].name}`;b.setAttribute('aria-label',`Wybierz: ${BLOCKS[i].name}`);b.addEventListener('click',()=>select(i));$('hotbar').append(b);}select(1);
function save(){clearTimeout(saveTimer);try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,changes:world.serialize(),player:{...player,yaw,pitch}}));$('save').textContent='✓ Zapisano na tym urządzeniu';dirty=false;}catch{$('save').textContent='Zapis niedostępny — zostaw otwartą kartę';}}
function scheduleSave(){dirty=true;$('save').textContent='Zapisywanie…';clearTimeout(saveTimer);saveTimer=setTimeout(save,650);}
function action(place){
 if(!playing)return;syncCamera();updateTarget();if(!target){toast('Podejdź bliżej klocka i wyceluj w niego.');return;}
 let {x,y,z,type,normal}=target;
 if(place){x+=normal.x;y+=normal.y;z+=normal.z;if(!world.inside(x,y,z)||y===0){toast('To już granica wyspy. Buduj bliżej środka.');return;}if(overlapsBlock(player,x,y,z)){toast('Zrób krok w bok, żeby postawić tu klocek.');return;}if(world.get(x,y,z))return;type=selected;}
 else{if(y===0){toast('To twarde dno wyspy. Wyżej możesz kopać do woli!');return;}type=0;}
 world.set(x,y,z,type);rebuildAt(x,z);
 // Remove decorative flowers when their support or space changes.
 scene.children.filter(m=>m.userData.cell&&m.userData.cell.x===x&&m.userData.cell.z===z).forEach(m=>{const p=m.userData.cell;if(!world.get(p.x,p.y-1,p.z)||world.get(p.x,p.y,p.z)){scene.remove(m);m.geometry.dispose();}});
 scheduleSave();updateTarget();
}
function clearInputs(){keys.clear();joystick={x:0,y:0};joyId=null;lookId=null;dragMouse=false;jumpQueued=false;$('stick').style.transform='';}
function pause(){if(!playing)return;playing=false;clearInputs();if(document.pointerLockElement)document.exitPointerLock();$('menu').hidden=false;$('crosshair').hidden=true;$('hint').hidden=true;$('touch-controls').hidden=true;document.body.classList.remove('playing');$('play').textContent='Wracam do budowania';save();}
async function lockPointer(){if(touch||!playing||document.pointerLockElement===canvas)return;try{if(!canvas.requestPointerLock)throw Error('Pointer Lock unavailable');await canvas.requestPointerLock();}catch{toast('Przeciągaj myszą lub użyj strzałek. E buduje, Q usuwa.');}}
function start(){playing=true;started=true;clearInputs();$('menu').hidden=true;$('crosshair').hidden=false;$('hint').hidden=false;$('touch-controls').hidden=!touch;document.body.classList.add('playing');lockPointer();}
function home(){player.x=.5;player.z=10.5;player.y=Math.max(7.001,world.surface(0,10)+.001);velocity.y=0;yaw=0;pitch=-.25;grounded=false;if(player.y>HEIGHT-2){player.x=-4.5;player.z=10.5;player.y=world.surface(-5,10)+.001;}save();toast('Jesteś z powrotem na polanie.');}
$('play').addEventListener('click',start);$('pause').addEventListener('click',()=>playing?pause():start());document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();pause();});$('home').addEventListener('click',home);$('touch-toggle').addEventListener('click',()=>{setTouch(!touch);if(document.pointerLockElement)document.exitPointerLock();});
$('reset').addEventListener('click',()=>{$('reset-confirm').hidden=false;});$('reset-no').addEventListener('click',()=>{$('reset-confirm').hidden=true;});$('reset-yes').addEventListener('click',()=>{try{localStorage.removeItem(SAVE_KEY);}catch{}location.reload();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Ta przeglądarka nie obsługuje pełnego ekranu.');}catch{toast('Pełny ekran niedostępny. Możesz grać w oknie.');}});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').title=document.fullscreenElement?'Wyjdź z pełnego ekranu':'Włącz pełny ekran';$('fullscreen').querySelector('span').textContent=document.fullscreenElement?'Wróć do okna':'Pełny ekran';clearInputs();resize();});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&playing&&!touch)pause();});document.addEventListener('pointerlockerror',()=>{if(playing)toast('Przeciągaj myszą lub użyj strzałek. E buduje, Q usuwa.');});
window.addEventListener('keydown',e=>{if(e.code==='Escape'){pause();return;}if(!playing)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat)jumpQueued=true;if(/^Digit[1-8]$/.test(e.code))select(Number(e.code.slice(-1)));if(e.code==='KeyE'&&!e.repeat)action(true);if(e.code==='KeyQ'&&!e.repeat)action(false);});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>{if(started||dirty)save();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{if(!playing)return;e.preventDefault();select(((selected-1+Math.sign(e.deltaY)+8)%8)+1);},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(!playing)return;if(e.pointerType==='touch'){if(lookId!==null)return;lookId=e.pointerId;lastLook={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}else if(document.pointerLockElement===canvas){action(e.button===2);}else{dragMouse=true;mouseTravel=0;mouseButton=e.button;lookId=e.pointerId;lastLook={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);if(e.button===2)action(true);}});
canvas.addEventListener('pointermove',e=>{if(!playing||document.pointerLockElement===canvas)return;if(e.pointerId!==lookId)return;const dx=e.clientX-lastLook.x,dy=e.clientY-lastLook.y;mouseTravel+=Math.abs(dx)+Math.abs(dy);yaw-=dx*.004;pitch=Math.max(-1.5,Math.min(1.5,pitch-dy*.004));lastLook={x:e.clientX,y:e.clientY};});
document.addEventListener('mousemove',e=>{if(playing&&document.pointerLockElement===canvas){yaw-=e.movementX*.0025;pitch=Math.max(-1.5,Math.min(1.5,pitch-e.movementY*.0025));}});
function endLook(e){if(e.pointerId===lookId){if(e.type==='pointerup'&&dragMouse&&mouseButton===0&&mouseTravel<6)action(false);lookId=null;dragMouse=false;}}for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,endLook);
// Fallback keyboard actions remain available when a browser declines Pointer Lock.
const joy=$('joystick');function moveJoy(e){if(e.pointerId!==joyId)return;const r=joy.getBoundingClientRect(),max=r.width*.32;let x=(e.clientX-r.left-r.width/2)/max,y=(e.clientY-r.top-r.height/2)/max;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}joystick={x:Math.abs(x)<.13?0:x,y:Math.abs(y)<.13?0:y};$('stick').style.transform=`translate(${x*max}px,${y*max}px)`;}
joy.addEventListener('pointerdown',e=>{if(!playing||joyId!==null)return;joyId=e.pointerId;joy.setPointerCapture(joyId);moveJoy(e);});joy.addEventListener('pointermove',moveJoy);for(const type of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(type,e=>{if(e.pointerId===joyId){joyId=null;joystick={x:0,y:0};$('stick').style.transform='';}});
for(const [id,fn] of [['jump',()=>{jumpQueued=true;}],['remove',()=>action(false)],['place',()=>action(true)]])$(id).addEventListener('pointerdown',e=>{e.preventDefault();if(playing)fn();});
function physics(dt){
 const turn=1.7*dt;if(keys.has('ArrowLeft'))yaw+=turn;if(keys.has('ArrowRight'))yaw-=turn;if(keys.has('ArrowUp'))pitch=Math.min(1.5,pitch+turn);if(keys.has('ArrowDown'))pitch=Math.max(-1.5,pitch-turn);
 let forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-joystick.y,side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joystick.x;
 const length=Math.hypot(forward,side);if(length>1){forward/=length;side/=length;}
 const speed=keys.has('ShiftLeft')?6:4.3,dx=(side*Math.cos(yaw)-forward*Math.sin(yaw))*speed*dt,dz=(-forward*Math.cos(yaw)-side*Math.sin(yaw))*speed*dt;
 for(const [axis,delta] of [['x',dx],['z',dz]]){const old=player[axis];player[axis]+=delta;if(collides(world,player))player[axis]=old;}
 if(jumpQueued&&grounded){velocity.y=7.3;grounded=false;}jumpQueued=false;velocity.y-=21*dt;
 const before=player.y;player.y+=velocity.y*dt;
 if(collides(world,player)){if(velocity.y<0){player.y=Math.floor(before+.01)+.001;grounded=true;}else player.y=before;velocity.y=0;}else grounded=false;
 if(player.y<-6){home();toast('Hop! Z powrotem na polanie.');}
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();clearInputs();}window.addEventListener('resize',resize);
setTouch(touch);syncCamera();$('play').disabled=false;$('play').textContent=saved?.version===1?'Wracam do budowania':'Zaczynamy';
if(saved?.version===1)$('save').textContent='✓ Wczytano twoją wyspę';
let lastTime=performance.now(),accumulator=0;
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-lastTime)/1000,.08);lastTime=now;if(playing){accumulator+=dt;while(accumulator>=1/120){physics(1/120);accumulator-=1/120;}syncCamera();updateTarget();}else{accumulator=0;outline.visible=false;syncCamera();}for(const c of clouds){c.position.x+=dt*.1;if(c.position.x>80)c.position.x=-80;}renderer.render(scene,camera);}
requestAnimationFrame(frame);
