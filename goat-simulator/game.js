import * as THREE from './vendor/three.module.js';
import {attachJoystick} from './touch.mjs';
import {RecordedAudio,loadRecordings} from './audio.mjs';
import {mealReaction,HungerAudioClock} from './reactions.mjs';
import {buildCity} from './city.mjs';
import {canUnlockCity,voiceRadius,voiceDistraction,CITY_FOOD_POSITIONS,CITY_PICKUP_POSITIONS} from './progression.mjs';
const hungerAudio=new HungerAudioClock();
let mealCooldown=0;
const recordedAudio=new RecordedAudio(await loadRecordings(),window.AudioContext||window.webkitAudioContext);
import {ITEMS,FOOD,clamp,feed,hunger,guardDecision,canTrain,movementMultiplier,throwingMultiplier,throwingNoise,jumpingMultiplier,MAX_TRAINING_LEVEL,cameraRelativeMovement} from './rules.mjs';

const $=s=>document.querySelector(s);
const canvas=$('#world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xc8d4ba,.009);
const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.1,420);
const sun=new THREE.DirectionalLight(0xffe3ad,3.1);sun.position.set(-35,55,36);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.camera.near=1;sun.shadow.camera.far=145;sun.shadow.bias=-.00025;sun.shadow.normalBias=.045;
scene.add(sun,new THREE.HemisphereLight(0xc9e0ef,0x7a8748,2.0));
const warmFill=new THREE.DirectionalLight(0x9dbde5,.35);warmFill.position.set(30,20,-40);scene.add(warmFill);
const loader=new THREE.TextureLoader();
const grassTex=await loader.loadAsync('./assets/grass.jpg');grassTex.colorSpace=THREE.SRGBColorSpace;grassTex.wrapS=grassTex.wrapT=THREE.RepeatWrapping;grassTex.repeat.set(22,22);grassTex.anisotropy=8;
const woodTex=await loader.loadAsync('./assets/wood.jpg');woodTex.colorSpace=THREE.SRGBColorSpace;woodTex.wrapS=woodTex.wrapT=THREE.RepeatWrapping;woodTex.repeat.set(1,3);woodTex.anisotropy=4;
let seed=84329;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function range(a,b){return a+rand()*(b-a);}
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.85,...extra});
const M={wood:mat(0x8a7655,{map:woodTex}),darkWood:mat(0x554733,{map:woodTex}),red:mat(0x864233),cream:mat(0xe2d8b9),roof:mat(0x485450,{metalness:.35,roughness:.65}),stone:mat(0x7b8071),metal:mat(0x485254,{metalness:.7,roughness:.4}),black:mat(0x282621),orange:mat(0xd48736),green:mat(0x668445),yellow:mat(0xe8bd45),pink:mat(0xd89983),white:mat(0xeae5d2)};
const unitBox=new THREE.BoxGeometry(1,1,1),unitSphere=new THREE.SphereGeometry(1,20,14),unitIco=new THREE.IcosahedronGeometry(1,2);
const colliders=[];
function mesh(g,m,parent=scene){const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(parent,m,x,y,z,sx,sy,sz){const o=mesh(unitBox,m,parent);o.position.set(x,y,z);o.scale.set(sx,sy,sz);return o;}
function ell(parent,m,x,y,z,sx,sy,sz,geo=unitSphere){const o=mesh(geo,m,parent);o.position.set(x,y,z);o.scale.set(sx,sy,sz);return o;}
function cyl(parent,m,x,y,z,r1,r2,h,n=12){const o=mesh(new THREE.CylinderGeometry(r1,r2,h,n),m,parent);o.position.set(x,y,z);return o;}
function branch(parent,m,a,b,r1,r2){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b);const o=mesh(new THREE.CylinderGeometry(r2,r1,av.distanceTo(bv),9),m,parent);o.position.copy(av).lerp(bv,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return o;}
function terrainY(x,z){const d=Math.hypot(x,z);return .16*Math.sin(x*.15)*Math.cos(z*.13)+.1*Math.sin(z*.31)+(d>47?Math.min(10,Math.pow((d-47)/32,1.4)*1.4):0);}
function group(x,z,y=0){const g=new THREE.Group();g.position.set(x,terrainY(x,z)+y,z);scene.add(g);return g;}
function obstacle(x,z,hx,hz){colliders.push({x,z,hx,hz});}

// Daylight sky: a real sphere, with thin, drifting cloud layers.
const skyTime={value:0};
const sky=mesh(new THREE.SphereGeometry(300,40,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{time:skyTime},vertexShader:'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vP;uniform float time;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){vec3 d=normalize(vP);float h=max(d.y,0.);vec3 col=mix(vec3(.84,.85,.71),vec3(.35,.56,.70),pow(h,.55));vec2 uv=d.xz/max(.2,d.y)*2.5+vec2(time*.003,0.);float cloud=noise(uv)*.55+noise(uv*2.1)*.28+noise(uv*4.2)*.17;float c=smoothstep(.58,.75,cloud)*smoothstep(.05,.25,h)*.5;col=mix(col,vec3(.94,.91,.79),c);gl_FragColor=vec4(col,1.);}`}),scene);sky.castShadow=sky.receiveShadow=false;
const groundGeo=new THREE.PlaneGeometry(260,260,180,180);groundGeo.rotateX(-Math.PI/2);
const groundPos=groundGeo.attributes.position;const groundColors=[];
for(let i=0;i<groundPos.count;i++){const x=groundPos.getX(i),z=groundPos.getZ(i);groundPos.setY(i,terrainY(x,z));const col=new THREE.Color().setHSL(.24+rand()*.025,.13,.77+rand()*.06);groundColors.push(col.r,col.g,col.b);}
groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(groundColors,3));groundGeo.computeVertexNormals();const farmGround=mesh(groundGeo,mat(0xdbdfb2,{map:grassTex,vertexColors:true,bumpMap:grassTex,bumpScale:.06}));

function pathX(z){return Math.sin(z*.05)*3;}
const dirtCanvas=document.createElement('canvas');dirtCanvas.width=dirtCanvas.height=256;const dc=dirtCanvas.getContext('2d');dc.fillStyle='#a89772';dc.fillRect(0,0,256,256);for(let i=0;i<18000;i++){const a=range(.025,.2);dc.fillStyle=`rgba(${rand()>.5?'49,43,28':'224,214,181'},${a})`;dc.fillRect(rand()*256,rand()*256,range(1,3),range(1,3));}const dirtTex=new THREE.CanvasTexture(dirtCanvas);dirtTex.wrapS=dirtTex.wrapT=THREE.RepeatWrapping;dirtTex.repeat.set(2,30);dirtTex.colorSpace=THREE.SRGBColorSpace;
const pathPos=[],pathUV=[],pathIdx=[];for(let i=0;i<=120;i++){const z=-53+i*106/120,x=pathX(z);for(const off of [-1.65,1.65]){pathPos.push(x+off,terrainY(x+off,z)+.018,z);pathUV.push(off<0?0:1,i/120);}if(i<120){const j=i*2;pathIdx.push(j,j+2,j+1,j+1,j+2,j+3);}}
const pathGeo=new THREE.BufferGeometry();pathGeo.setAttribute('position',new THREE.Float32BufferAttribute(pathPos,3));pathGeo.setAttribute('uv',new THREE.Float32BufferAttribute(pathUV,2));pathGeo.setIndex(pathIdx);pathGeo.computeVertexNormals();const farmPath=mesh(pathGeo,mat(0xd7c49a,{map:dirtTex}));

// Mountains and a wooded horizon keep the farm inside a larger landscape.
for(let i=0;i<19;i++){const angle=i/19*Math.PI*2,r=range(145,230),x=Math.sin(angle)*r,z=Math.cos(angle)*r;const g=new THREE.ConeGeometry(range(33,68),range(25,57),32,8);const p=g.attributes.position;for(let j=0;j<p.count;j++)p.setY(j,p.getY(j)+range(-2,2));g.computeVertexNormals();const o=mesh(g,mat(new THREE.Color().setHSL(.25,.13,range(.31,.4))));o.position.set(x,7,z);o.castShadow=false;}

const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=128;const lc=leafCanvas.getContext('2d');
lc.beginPath();lc.moveTo(64,6);lc.bezierCurveTo(116,34,112,95,64,124);lc.bezierCurveTo(12,98,10,34,64,6);const lg=lc.createLinearGradient(10,0,115,0);lg.addColorStop(0,'#687c35');lg.addColorStop(.5,'#a2ad5b');lg.addColorStop(1,'#566e32');lc.fillStyle=lg;lc.fill();lc.strokeStyle='#c5cd7b88';lc.lineWidth=1.5;lc.beginPath();lc.moveTo(64,10);lc.lineTo(64,120);for(let i=0;i<6;i++){const y=28+i*14;lc.moveTo(64,y+14);lc.lineTo(32,y);lc.moveTo(64,y+14);lc.lineTo(96,y);}lc.stroke();const leafTex=new THREE.CanvasTexture(leafCanvas);leafTex.colorSpace=THREE.SRGBColorSpace;
const leafMatrices=[],leafColors=[],treeRanges=[];const leafDummy=new THREE.Object3D();
function canopy(x,y,z,sx,sy,sz){for(let i=0;i<420;i++){let a=range(-1,1),b=range(-1,1),c=range(-1,1);if(a*a+b*b+c*c>1){i--;continue;}leafDummy.position.set(x+a*sx,y+b*sy,z+c*sz);leafDummy.rotation.set(rand()*6,rand()*6,rand()*6);leafDummy.scale.set(range(.38,.64),range(.4,.78),1);leafDummy.updateMatrix();leafMatrices.push(leafDummy.matrix.clone());leafColors.push(new THREE.Color().setHSL(range(.2,.27),range(.17,.33),range(.57,.8)));}}
function tree(x,z,scale=1){const leafStart=leafMatrices.length;const g=group(x,z);g.scale.setScalar(scale);cyl(g,M.darkWood,0,2.3,0,.22,.38,4.6);for(let i=0;i<7;i++){const a=i*2.4;const tip=[Math.sin(a)*range(1.4,2.5),range(4,6),Math.cos(a)*range(1.4,2.5)];branch(g,M.wood,[0,range(2.6,3.5),0],tip,.15,.055);canopy(x+tip[0]*scale,g.position.y+tip[1]*scale,z+tip[2]*scale,1.7*scale,1.5*scale,1.7*scale);}canopy(x,g.position.y+6*scale,z,2*scale,1.8*scale,2*scale);treeRanges.push({group:g,x,z,start:leafStart,end:leafMatrices.length});if(scale>1)obstacle(x,z,.48*scale,.48*scale);return g;}
for(let i=0;i<47;i++){const a=i/47*Math.PI*2;tree(Math.sin(a)*range(60,83),Math.cos(a)*range(60,83),range(1.1,2.1));}
for(const [x,z,s] of [[-27,17,1.4],[-25,-25,1.5],[19,24,1.6],[33,7,1.4],[-30,-3,1.1],[28,-25,1.5],[-12,37,1.2],[34,35,1.4],[-38,-35,1.6],[43,-10,1.2],[-36,28,1.3]])tree(x,z,s);
const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({map:leafTex,alphaTest:.4,side:THREE.DoubleSide,roughness:.9}),leafMatrices.length);for(let i=0;i<leafMatrices.length;i++){leaves.setMatrixAt(i,leafMatrices[i]);leaves.setColorAt(i,leafColors[i]);}leaves.castShadow=true;leaves.receiveShadow=true;scene.add(leaves);

const environmentColliders=colliders.map(c=>({...c}));
const farmStart=scene.children.length;
function fence(x,z,length,rotate=0){const g=group(x,z);g.rotation.y=rotate;const count=Math.ceil(length/3);for(let i=0;i<=count;i++)box(g,M.wood,-length/2+i*length/count,.7,0,.16,1.5,.16);for(let row=0;row<2;row++)box(g,M.wood,0,.55+row*.48,0,length,.11,.1);return g;}
fence(-19,7,16);fence(-27,-4,22,Math.PI/2);fence(-19,-15,16);fence(13,11,14);
for(let i=0;i<4;i++){const z=-37+i*24;fence(-49,z,23,Math.PI/2);fence(49,z,23,Math.PI/2);}
fence(0,-49,98);fence(0,49,98);
obstacle(-27,-4,.18,11);obstacle(-19,7,8,.18);obstacle(-19,-15,8,.18);obstacle(13,11,7,.18);

function barn(){const g=group(-18,-7);box(g,M.red,0,2.5,0,12,5,10);for(let i=-5.7;i<=5.7;i+=.45)box(g,mat(0x944a39),i,2.5,5.025,.05,5,.04);for(const x of [-6,6])for(const z of [-5,5])box(g,M.cream,x,2.5,z,.16,5,.15);box(g,M.darkWood,0,1.65,5.05,3.1,3.3,.12);for(const x of [-1.65,1.65])box(g,M.cream,x,1.75,5.15,.13,3.5,.12);box(g,M.cream,0,3.5,5.15,3.4,.15,.12);const a=box(g,M.cream,0,1.75,5.2,.12,3.55,.1);a.rotation.z=.75;const b=box(g,M.cream,0,1.75,5.22,.12,3.55,.1);b.rotation.z=-.75;const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute([-6.6,5,-5.6,6.6,5,-5.6,0,7.7,-5.6,-6.6,5,5.6,0,7.7,5.6,6.6,5,5.6],3));roof.setIndex([0,1,2,3,4,5,0,2,3,2,4,3,2,1,4,1,5,4]);roof.computeVertexNormals();mesh(roof,M.roof,g);for(let i=-5.5;i<5.6;i+=.7){branch(g,M.metal,[-6.6,5,i],[0,7.72,i],.027,.027);branch(g,M.metal,[0,7.72,i],[6.6,5,i],.027,.027);}for(const x of [-4.4,4.4]){box(g,M.cream,x,3.5,5.05,1.6,1.4,.14);box(g,mat(0x416064,{metalness:.15}),x,3.5,5.15,1.3,1.1,.03);box(g,M.cream,x,3.5,5.19,.06,1.1,.04);}obstacle(-18,-7,6.4,5.4);return g;}
barn();

const hayMat=mat(0xa89b52);function hay(x,z){const g=group(x,z);const b=cyl(g,hayMat,0,.67,0,.65,.65,1.35,24);b.rotation.z=Math.PI/2;for(const dx of [-.43,.43]){const ring=mesh(new THREE.TorusGeometry(.657,.018,6,32),M.darkWood,g);ring.position.set(dx,.67,0);ring.rotation.y=Math.PI/2;}obstacle(x,z,.8,.68);}
for(const [x,z] of [[-11,-4],[-10,-6],[-11,-8],[-21,3],[-23,3]])hay(x,z);

// Pond with wind ripples and a proper reflective surface.
const pond=group(27,-8,-.02);ell(pond,mat(0x918c60),0,-.12,0,8.9,.12,6.4);
const water=mesh(new THREE.CircleGeometry(1,80),new THREE.MeshPhysicalMaterial({color:0x557f7a,roughness:.2,metalness:.25,transparent:true,opacity:.87,clearcoat:1}),pond);water.rotation.x=-Math.PI/2;water.scale.set(8.2,5.8,1);water.position.y=.03;
for(let i=0;i<35;i++){const a=i/35*Math.PI*2;ell(pond,M.stone,Math.cos(a)*8.7,.12,Math.sin(a)*6.3,range(.35,.75),range(.2,.4),range(.3,.6),unitIco);}
obstacle(27,-8,7.5,5.2);
const ripples=[];for(let i=0;i<7;i++){const ring=mesh(new THREE.RingGeometry(1,1.015,64),new THREE.MeshBasicMaterial({color:0xc3d8b7,transparent:true,opacity:.13,side:THREE.DoubleSide}),pond);ring.rotation.x=-Math.PI/2;ring.position.set(range(-4,4),.05,range(-3,3));ring.castShadow=false;ripples.push(ring);}
function rubberDuck(parent,x=0,y=0,z=0,s=1){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);parent.add(g);ell(g,M.yellow,0,.2,0,.24,.2,.32);ell(g,M.yellow,0,.46,-.17,.15,.15,.15);ell(g,M.orange,0,.42,-.32,.13,.045,.12);for(const side of [-1,1])ell(g,M.black,side*.1,.49,-.255,.02,.025,.016);ell(g,M.yellow,.12,.17,.25,.1,.13,.18).rotation.x=-.65;return g;}
const pondDucks=[];for(let i=0;i<3;i++)pondDucks.push(rubberDuck(pond,range(-4,4),.015,range(-2,2),1.4));

function label(text,x,z,y=2.4,parent=scene,width=3){const c=document.createElement('canvas');c.width=768;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle='#324129';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#b5bc8e';ctx.lineWidth=6;ctx.strokeRect(10,10,748,172);ctx.font='bold 57px Georgia';ctx.fillStyle='#f1ebcb';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,98);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const o=mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}),parent);o.position.set(x,y,z);return o;}
const stall=group(8,-16);for(const x of [-2.3,2.3])for(const z of [-1.6,1.6])box(stall,M.wood,x,1.85,z,.14,3.7,.14);box(stall,M.cream,0,.9,0,4.8,1.65,2.9);box(stall,M.wood,0,1.75,0,5.1,.16,3.1);for(let i=0;i<10;i++){const m=i%2?M.cream:mat(0x758c57);box(stall,m,-2.7+i*.6,3.9,0,.6,.1,4.2);box(stall,m,-2.7+i*.6,3.65,2.05,.6,.5,.1);}label('LODY • 50 ENERGII',0,2.13,3.05,stall,4.6);obstacle(8,-16,2.5,1.6);
const picnic=group(18,22);box(picnic,M.wood,0,1.1,0,4,.13,1.9);for(const z of [-1.4,1.4]){box(picnic,M.wood,0,.6,z,4,.14,.5);for(const x of [-1.3,1.3])box(picnic,M.wood,x,.4,z,.13,.8,.13);}for(const x of [-1.3,1.3])box(picnic,M.wood,x,.55,0,.15,1.1,1.3);obstacle(18,22,2.2,1.7);
const trashArea=group(-6,28);const bin=cyl(trashArea,mat(0x64756b,{metalness:.65}),0,.55,0,.55,.48,1.1,24);cyl(trashArea,M.metal,0,1.14,0,.59,.59,.08,24);obstacle(-6,28,.6,.6);

// Outdoor goat gym. The treadmill and hoof weights are interactive stations.
const gym=group(-13,21);box(gym,mat(0x756d54),0,-.02,2.2,10,.07,12.4);for(const x of [-4.9,4.9])box(gym,M.wood,x,1.8,-3.8,.15,3.6,.15);label('KOZIA SIŁOWNIA',0,-3.79,3.05,gym,7);label('NAJPIERW ZJEDZ',0,-3.78,2.32,gym,4);
const treadmill=new THREE.Group();gym.add(treadmill);treadmill.position.set(-2.4,0,0);box(treadmill,M.metal,0,.16,0,2.1,.32,3.6);box(treadmill,M.black,0,.35,0,1.8,.07,3.25);for(const x of [-1,1]){branch(treadmill,M.metal,[x,.2,-1.55],[x,1.9,-1.55],.065,.065);branch(treadmill,M.metal,[x,1.5,-1.55],[x,1.5,.6],.055,.055);}box(treadmill,M.metal,0,1.85,-1.55,2,.16,.2);box(treadmill,mat(0x203a33,{emissive:0x203a33,emissiveIntensity:.2}),0,1.95,-1.55,.6,.3,.1);for(let i=0;i<16;i++)box(treadmill,M.metal,0,.395,-1.45+i*.19,1.8,.015,.012);
const weights=new THREE.Group();gym.add(weights);weights.position.set(2.4,0,0);box(weights,M.darkWood,0,.55,0,2,.13,2);for(const x of [-.8,.8])for(const z of [-.8,.8])box(weights,M.wood,x,.28,z,.12,.55,.12);for(const z of [-.45,.45]){const rod=cyl(weights,M.metal,0,.76,z,.045,.045,1.7);rod.rotation.z=Math.PI/2;for(const x of [-.65,.65]){const w=cyl(weights,M.black,x,.76,z,.26,.26,.22,24);w.rotation.z=Math.PI/2;}}label('NOGI',-2.4,1.95,.85,gym,1.5);label('KOPYTA',2.4,1.95,.85,gym,1.9);
const trampoline=new THREE.Group();gym.add(trampoline);trampoline.position.set(0,0,6);
const trampolineRim=mesh(new THREE.TorusGeometry(1.8,.12,10,48),mat(0x6c8e84,{metalness:.3}),trampoline);trampolineRim.rotation.x=Math.PI/2;trampolineRim.position.y=.6;
const trampolineBed=mesh(new THREE.CircleGeometry(1.65,48),mat(0x303b3a,{side:THREE.DoubleSide}),trampoline);trampolineBed.rotation.x=-Math.PI/2;trampolineBed.position.y=.58;
for(let i=0;i<24;i++){const a=i/24*Math.PI*2;branch(trampoline,M.metal,[Math.cos(a)*1.62,.58,Math.sin(a)*1.62],[Math.cos(a)*1.8,.6,Math.sin(a)*1.8],.018,.018);}
for(let i=0;i<6;i++){const a=i/6*Math.PI*2;branch(trampoline,M.metal,[Math.cos(a)*1.75,.6,Math.sin(a)*1.75],[Math.cos(a)*1.75,.05,Math.sin(a)*1.75],.05,.05);}
label('SKOKI',0,8.2,1,gym,2.2);
const farmProps=scene.children.slice(farmStart);
const voiceStage=new THREE.Group();gym.add(voiceStage);voiceStage.visible=false;voiceStage.position.set(3.4,0,6);
box(voiceStage,M.darkWood,0,.12,0,2.7,.24,3);
cyl(voiceStage,M.metal,0,.9,-.8,.04,.06,1.8);ell(voiceStage,M.black,0,1.85,-.8,.12,.16,.12);
for(const x of [-1.1,1.1]){box(voiceStage,M.black,x,.5,-.95,.55,.9,.5);for(const y of [.28,.65]){const speaker=mesh(new THREE.CircleGeometry(.16,24),M.metal,voiceStage);speaker.position.set(x,y,-.69);}}
label('GŁOS',0,1.7,1.1,voiceStage,2.3);
const stations=[{x:-15.4,z:22.8,type:'legs',name:'Trenuj nogi'},{x:-10.6,z:22.8,type:'hooves',name:'Trenuj kopyta'},{x:-13,z:27,type:'jumps',name:'Trenuj skoki na trampolinie'},{x:-9.6,z:27,type:'voice',name:'Trenuj głos przy mikrofonie'}];

function furTexture(){const c=document.createElement('canvas');c.width=c.height=512;const ct=c.getContext('2d');ct.fillStyle='#dfd9bf';ct.fillRect(0,0,512,512);for(let i=0;i<26000;i++){const x=rand()*512,y=rand()*512;ct.strokeStyle=`rgba(${rand()>.5?'83,70,51':'255,255,233'},${range(.015,.12)})`;ct.beginPath();ct.moveTo(x,y);ct.lineTo(x+range(-1,1),y+range(2,6));ct.stroke();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const fur=furTexture();
function horn(parent,side){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.16,2.3,-1.04),new THREE.Vector3(side*.19,2.63,-.95),new THREE.Vector3(side*.23,2.79,-.65),new THREE.Vector3(side*.27,2.72,-.43)]);const geo=new THREE.TubeGeometry(curve,20,.075,8,false);const p=geo.attributes.position;for(let i=0;i<p.count;i++){const t=Math.floor(i/9)/20,c=curve.getPointAt(t),factor=1-t*.92;p.setXYZ(i,c.x+(p.getX(i)-c.x)*factor,c.y+(p.getY(i)-c.y)*factor,c.z+(p.getZ(i)-c.z)*factor);}geo.computeVertexNormals();mesh(geo,mat(0x9d916e),parent);}
function goat(x,z,color=0xe5deca,guard=false){const g=group(x,z);g.scale.setScalar(.9);const coat=mat(color,{map:fur,bumpMap:fur,bumpScale:.035}),tan=mat(guard?0x756552:0xa69477,{map:fur});const body=new THREE.Group();g.add(body);
ell(body,coat,0,1.28,.05,.46,.55,.87);ell(body,coat,0,1.38,-.51,.43,.49,.43);ell(body,coat,0,1.29,.65,.43,.46,.38);const neck=ell(body,tan,0,1.67,-.76,.29,.5,.32);neck.rotation.x=.42;
const head=new THREE.Group();head.position.set(0,0,0);body.add(head);const skull=ell(head,coat,0,2.01,-1.04,.27,.34,.36);skull.rotation.x=-.4;const nose=ell(head,tan,0,1.86,-1.37,.22,.24,.28);nose.rotation.x=-.3;ell(head,mat(0x564f45),0,1.73,-1.59,.18,.1,.07);
for(const s of [-1,1]){ell(head,M.black,s*.13,1.76,-1.632,.033,.022,.017);const ear=ell(head,coat,s*.4,2.07,-.85,.28,.07,.14);ear.rotation.z=s*.2;ell(head,mat(0xbdab90),s*.4,2.084,-.86,.19,.025,.1).rotation.z=s*.2;ell(head,mat(0xa99455),s*.235,2.04,-1.23,.049,.055,.06);ell(head,M.black,s*.276,2.04,-1.245,.013,.018,.035);ell(head,mat(0xfff7dd,{roughness:.1}),s*.281,2.058,-1.252,.006,.01,.01);horn(head,s);}
const beard=ell(head,tan,0,1.52,-1.32,.12,.2,.1);beard.rotation.x=-.3;const legs=[];
for(const x of [-.3,.3])for(const z of [-.55,.58]){const leg=new THREE.Group();leg.position.set(x,1.22,z);body.add(leg);cyl(leg,coat,0,-.24,0,.14,.1,.5);const lower=cyl(leg,tan,0,-.66,.04,.08,.07,.5);lower.rotation.x=z>0?-.12:.05;box(leg,M.black,0,-1.13,-.01,.17,.18,.23);box(leg,tan,0,-.985,0,.145,.12,.15);legs.push(leg);}
const tail=ell(body,coat,0,1.58,.96,.09,.23,.1);tail.rotation.x=-.7;
if(guard){const band=cyl(body,mat(0x9b4631),0,1.66,-.78,.32,.32,.11,24);band.rotation.x=.4;ell(body,M.yellow,0,1.43,-1.075,.07,.1,.035);}
return {group:g,body,head,legs,tail,phase:rand()*6};}
const player=goat(0,17);let yaw=0,orbitYaw=0,orbitPitch=.35,zoom=8.5;
const guards=[{...goat(8,-11,0xb8aa89,true),x:8,z:-11,home:{x:8,z:-11},state:'patrol',distracted:0,target:null},{...goat(20,18,0xb4b09e,true),x:20,z:18,home:{x:20,z:18},state:'patrol',distracted:0,target:null}];

function carrotModel(parent){const g=new THREE.Group();parent.add(g);const c=mesh(new THREE.ConeGeometry(.14,.7,12),M.orange,g);c.rotation.z=.18;c.position.y=.4;for(let i=0;i<4;i++){const l=ell(g,M.green,Math.sin(i)*.1,.86,Math.cos(i)*.08,.055,.23,.025);l.rotation.z=(i-1.5)*.35;}return g;}
function iceModel(parent){const g=new THREE.Group();parent.add(g);const c=mesh(new THREE.ConeGeometry(.18,.48,16),mat(0xb39664),g);c.rotation.z=Math.PI;c.position.y=.35;ell(g,mat(0xf0dbc0),0,.67,0,.225,.23,.225);ell(g,M.pink,.03,.86,.01,.19,.17,.19);return g;}
function trashModel(parent){const g=new THREE.Group();parent.add(g);const can=cyl(g,mat(0xa9bba2,{metalness:.7,roughness:.3}),0,.2,0,.12,.12,.4,16);can.rotation.z=.8;box(g,M.red,.05,.2,0,.18,.1,.23);const lid=cyl(g,M.metal,-.09,.32,0,.125,.125,.02,16);lid.rotation.z=.8;return g;}
function bootModel(parent){const g=new THREE.Group();parent.add(g);box(g,M.darkWood,0,.14,-.09,.24,.25,.46);box(g,M.black,0,.025,-.09,.26,.06,.48);cyl(g,M.darkWood,0,.34,.055,.13,.13,.3,12);return g;}
function rockModel(parent){const g=new THREE.Group();parent.add(g);ell(g,M.stone,0,.12,0,.19,.15,.16,unitIco);return g;}
const foods=[],pickups=[];function food(type,x,z,y=0){const g=group(x,z,y);const model=type==='carrot'?carrotModel(g):type==='ice'?iceModel(g):type==='jelly'?rubberDuck(g):trashModel(g);g.rotation.y=rand()*6;const glow=mesh(new THREE.RingGeometry(.45,.5,32),new THREE.MeshBasicMaterial({color:0xc5d995,transparent:true,opacity:.25,side:THREE.DoubleSide}),g);glow.rotation.x=-Math.PI/2;glow.position.y=.04;glow.castShadow=false;const f={type,x,z,y,group:g,model,taken:false,respawn:0,phase:rand()*6};foods.push(f);return f;}
for(const [x,z] of [[1.5,12],[-3,8],[5,20],[-8,10],[-7,-2],[-2,-11],[-3,32],[32,20],[-31,12],[-16,31],[37,-23],[6,-32]])food('carrot',x,z);
for(const [x,z] of [[-5,25],[-8,27],[3,30],[16,18],[-22,15],[6,-4]])food('trash',x,z);
for(const [x,z] of [[22,20],[31,2],[-20,30]])food('jelly',x,z);
food('ice',8,-12.5);food('ice',10.8,-15);food('ice',16,19);
function pickup(type,x,z){const g=group(x,z);const model=type===0?rockModel(g):type===1?rubberDuck(g):bootModel(g);pickups.push({type,x,z,group:g,model,taken:false,respawn:0});}
for(const [x,z] of [[2,16],[-2,17],[5,6],[-4,-8],[11,-7],[-14,15],[25,29],[-8,31]])pickup(0,x,z);
for(const [x,z] of [[-3,18],[16,14],[22,3],[-11,27]])pickup(1,x,z);
for(const [x,z] of [[4,17],[-4,23],[12,-5],[-22,20]])pickup(2,x,z);
const supply=group(-3,21);box(supply,M.wood,0,.45,0,1.4,.9,1.25);for(let i=0;i<4;i++)box(supply,M.darkWood,0,.15+i*.2,.64,1.42,.035,.04);label('ZAPASY',0,.68,1.25,supply,1.3);obstacle(-3,21,.75,.67);

const farmColliders=colliders.map(c=>({...c}));
const farmFoodPositions=foods.map(f=>[f.x,f.z]);const farmPickupPositions=pickups.map(f=>[f.x,f.z]);
let cityRoot=null,cityColliders=null;
// Thousands of individual grass blades, with lighting and wind.
const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.03,0,0,.03,0,0,.008,.55,.025,-.02,.32,.012],3));grassGeo.setIndex([0,1,3,1,2,3]);grassGeo.computeVertexNormals();
const wind={value:0};const grassMat=new THREE.MeshLambertMaterial({color:0x7d8941,side:THREE.DoubleSide});
grassMat.onBeforeCompile=shader=>{shader.uniforms.windTime=wind;shader.vertexShader='uniform float windTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vec4 wp=instanceMatrix*vec4(position,1.0); transformed.x += sin(windTime*1.5+wp.x*.38+wp.z*.21)*position.y*position.y*.25;');};
const grass=new THREE.InstancedMesh(grassGeo,grassMat,36000);const dummy=new THREE.Object3D();let grassCount=0;
for(let i=0;i<47000&&grassCount<36000;i++){const x=range(-57,57),z=range(-57,57);if(Math.abs(x-pathX(z))<2.1||Math.hypot((x-27)/1.3,z+8)<7||x>-25&&x<-11&&z>-13&&z<-1||x>-19&&x<-7&&z>16&&z<26||Math.abs(x-8)<4&&Math.abs(z+16)<3)continue;dummy.position.set(x,terrainY(x,z)+.02,z);dummy.rotation.set(0,rand()*Math.PI*2,range(-.2,.2));dummy.scale.set(range(.7,1.3),range(.3,1.05),1);dummy.updateMatrix();grass.setMatrixAt(grassCount,dummy.matrix);grass.setColorAt(grassCount,new THREE.Color().setHSL(range(.17,.25),range(.23,.48),range(.24,.42)));grassCount++;}
grass.count=grassCount;grass.receiveShadow=true;scene.add(grass);
const flowers=new THREE.InstancedMesh(new THREE.SphereGeometry(.045,6,4),mat(0xe0dba8),1100);for(let i=0;i<1100;i++){const x=range(-47,47),z=range(-47,47);dummy.position.set(x,terrainY(x,z)+range(.2,.5),z);dummy.scale.set(1,.65,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);flowers.setColorAt(i,new THREE.Color(rand()>.65?0xdccaaa:0xc6b56c));}scene.add(flowers);
const floating=new THREE.InstancedMesh(new THREE.SphereGeometry(.016,4,3),new THREE.MeshBasicMaterial({color:0xf3e6bb,transparent:true,opacity:.3}),120);const motes=[];for(let i=0;i<120;i++)motes.push({x:range(-35,35),y:range(.5,4),z:range(-35,35),phase:rand()*6});scene.add(floating);

let playing=false,paused=false,sleeping=false,energy=100,eaten=0,selected=0,inventory=[5,3,2],legLevel=0,hoofLevel=0,jumpLevel=0,voiceLevel=0,worldLevel=1,voiceCooldown=0;
let movementActive=false,lastCameraInput=-10;
const movementView=new THREE.Vector3();
let vy=0,jumpY=0,hitCooldown=0,velocity=new THREE.Vector3(),nearest=null,toastTimer=0,time=0,iceEaten=false;
let training=null,supplyCooldown=0;const explored=new Set();let audio=null,soundOn=true;const keys=new Set();const projectiles=[];
let joystickInput={forward:0,side:0,strength:0};
const touchControl=attachJoystick($('#joystick'),value=>joystickInput=value,()=>playing&&!paused&&!sleeping);
const markers=[{name:'Zielona łąka',x:0,z:17,r:25},{name:'Lodowy stragan',x:8,z:-16,r:13},{name:'Kaczy staw',x:27,z:-8,r:15},{name:'Kozia siłownia',x:-13,z:21,r:12}];
function toast(s,d=3.5){$('#toast').textContent=s;$('#toast').classList.add('visible');toastTimer=d;}
function sound(kind='bleat',delay=0,options={}){if(!soundOn)return;if(['bleat','burp','chew','growl','fart','death'].includes(kind)){recordedAudio.play(kind,delay,options).catch(()=>toast('Nie udało się odtworzyć dźwięku. Odśwież grę.',3));return;}if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),gain=audio.createGain();o.connect(gain);gain.connect(audio.destination);const now=audio.currentTime;o.type=kind==='duck'?'square':'sawtooth';const freq=kind==='duck'?600:kind==='eat'?360:kind==='throw'?130:kind==='hit'?80:180;const len=.22;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(freq*.48,now+len);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='duck'?.035:.055,now+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+len);o.start(now);o.stop(now+len);}
function select(i){selected=i;document.querySelectorAll('[data-slot]').forEach(b=>b.classList.toggle('selected',+b.dataset.slot===i));}
function updateInventory(){inventory.forEach((n,i)=>$('#count-'+i).textContent=n);}
function distract(point,noise,type){let n=0;for(const guard of guards){if(Math.hypot(guard.x-point.x,guard.z-point.z)<noise){guard.distracted=9;guard.state='distracted';guard.target={x:clamp(point.x,-46,46),z:clamp(point.z,-46,46)};n++;}}if(n){toast(type===1?'Kwa! Strażnik idzie sprawdzić kaczuszkę.':'Hałas! Strażnik odwrócił uwagę — masz 9 sekund!');sound(type===1?'duck':'throw');}else toast('Przedmiot spadł za daleko od strażników. Rzuć bliżej kozy.',3);}
function throwItem(){if(!playing||paused||sleeping||training)return;if(inventory[selected]<1){toast('Brak przedmiotów. Podnieś coś klawiszem F lub zajrzyj do skrzynki.');return;}inventory[selected]--;updateInventory();const g=new THREE.Group();scene.add(g);selected===0?rockModel(g):selected===1?rubberDuck(g):bootModel(g);camera.getWorldDirection(movementView);const aim=cameraRelativeMovement(1,0,movementView.x,movementView.z);const dir=new THREE.Vector3(aim.x,0,aim.z);const speed=ITEMS[selected].flight*throwingMultiplier(hoofLevel);g.position.copy(player.group.position).add(new THREE.Vector3(dir.x*.9,1.8,dir.z*.9));projectiles.push({group:g,v:dir.multiplyScalar(speed).add(new THREE.Vector3(0,5.2,0)),type:selected,noise:throwingNoise(selected,hoofLevel),ttl:18,landed:false});sound('throw');toast('Rzut! '+(hoofLevel?'Wyćwiczone kopyta niosą dalej.':'Celujesz w kierunku kamery.'),1.8);}
function nearby(){const p=player.group.position;let best=null;function candidate(item,kind,dist,limit){if(dist<limit&&(!best||dist<best.dist))best={item,kind,dist};}
for(const f of foods)if(!f.taken)candidate(f,'food',Math.hypot(p.x-f.x,p.z-f.z),2.1);for(const f of pickups)if(!f.taken)candidate(f,'pickup',Math.hypot(p.x-f.x,p.z-f.z),1.8);for(const f of stations)if(f.type!=='voice'||worldLevel===2)candidate(f,'gym',Math.hypot(p.x-f.x,p.z-f.z),1.9);candidate(supply,'supply',Math.hypot(p.x+3,p.z-21),2.2);return best;}
function eatOrTrain(){if(!playing||paused||sleeping||training)return;const n=nearby();if(!n)return;if(n.kind==='food'){if(mealCooldown>0)return;const f=n.item;const reaction=mealReaction(energy,f.type);const delta=reaction.energy-energy;energy=reaction.energy;mealCooldown=2.7;hungerAudio.reset(energy);f.taken=true;f.respawn=38;f.group.visible=false;eaten++;for(const cue of reaction.sounds)sound(cue.kind,cue.delay,cue.options);toast(FOOD[f.type].line+(reaction.overfed?' — przejedzenie! Prrrt!':''));if(f.type==='ice'&&worldLevel===1){iceEaten=true;$('#quest-title').textContent='Lody zdobyte!';$('#quest-copy').textContent='Strażnik może pilnować. Ty możesz chrupać. Teraz odwiedź siłownię lub zwiedzaj dalej.';$('#quest-check').textContent='✓';$('#quest-step').textContent='Operacja zakończona. Smacznego!';}}else if(n.kind==='gym'){const station=n.item,lv=trainingLevel(station.type);if(lv>=MAX_TRAINING_LEVEL){toast('Pięć gwiazdek! Kozi olimpijczyk!');return;}if(!canTrain(energy,lv)){toast('Najpierw zjedz! Trening wymaga przynajmniej 65 energii.');return;}training={station,elapsed:0};if(station.type==='legs'){player.group.position.x=station.x;player.group.position.z=21;yaw=0;}else if(station.type==='jumps'||station.type==='voice'){player.group.position.x=station.x;player.group.position.z=station.z;jumpY=0;vy=0;yaw=0;}toast(station.type==='legs'?'Biegnij, kózko! Trening nóg…':station.type==='hooves'?'Raz, dwa… przednie kopyta w górę!':station.type==='jumps'?'Hop! Trening skoków na trampolinie…':'Beeee! Próba mikrofonu. Trening głosu…',3);sound('bleat');}}
function take(){if(!playing||paused||sleeping||training)return;const n=nearby();if(n?.kind==='pickup'){const f=n.item;inventory[f.type]++;f.taken=true;f.respawn=35;f.group.visible=false;select(f.type);updateInventory();toast('Podniesiono: '+ITEMS[f.type].name+'. Q — rzuć.');}else if(n?.kind==='supply'){if(supplyCooldown>0){toast('Zapasy za '+Math.ceil(supplyCooldown)+' s. Poszukaj przedmiotów na farmie.');return;}inventory=inventory.map((n,i)=>Math.min(n+[3,2,1][i],12));updateInventory();supplyCooldown=30;toast('Kieszenie pełne kamieni, kaczek i… butów.');}}
function setPaused(v){if(sleeping)return;paused=v;if(v){recordedAudio.stopAll();if(audio)audio.suspend();}$('#pause').hidden=!v;keys.clear();touchControl.reset();}
function applyLevel(level){
 worldLevel=level;
 colliders.length=0;
 if(level===2){
   colliders.push(...environmentColliders.filter(c=>Math.hypot(c.x+13,c.z-30)>=12).map(c=>({...c})));
   if(!cityRoot){cityRoot=buildCity(THREE,{scene,mesh,box,cyl,ell,branch,label,mat,M,terrainY,obstacle});obstacle(20,-16,2.5,1.6);obstacle(-3,21,.75,.67);cityColliders=colliders.map(c=>({...c}));}
   else{colliders.length=0;colliders.push(...cityColliders.map(c=>({...c})));}
 }else colliders.push(...farmColliders.map(c=>({...c})));
 for(const prop of farmProps)prop.visible=level===1||prop===gym||prop===stall;
 if(cityRoot)cityRoot.visible=level===2;
 farmGround.visible=farmPath.visible=grass.visible=flowers.visible=level===1;
 voiceStage.visible=level===2;
 const hiddenLeaves=new THREE.Matrix4().makeScale(0,0,0);
 for(const tree of treeRanges){const hide=level===2&&Math.hypot(tree.x+13,tree.z-30)<12;tree.group.visible=!hide;for(let i=tree.start;i<tree.end;i++)leaves.setMatrixAt(i,hide?hiddenLeaves:leafMatrices[i]);}
 leaves.instanceMatrix.needsUpdate=true;
 stall.position.set(level===2?20:8,terrainY(level===2?20:8,-16),-16);
 for(const [objects,positions] of [[foods,level===2?CITY_FOOD_POSITIONS:farmFoodPositions],[pickups,level===2?CITY_PICKUP_POSITIONS:farmPickupPositions]])
   objects.forEach((f,i)=>{[f.x,f.z]=positions[i];f.group.position.set(f.x,terrainY(f.x,f.z)+(f.y||0),f.z);f.taken=false;f.respawn=0;f.group.visible=true;});
 guards.forEach((g,i)=>{const homes=level===2?[[20,-11],[20,18]]:[[8,-11],[20,18]];[g.x,g.z]=homes[i];g.home={x:g.x,z:g.z};g.distracted=0;g.target=null;g.state='patrol';g.patrolIndex=0;g.patrolWait=0;g.group.rotation.set(0,0,0);g.group.position.set(g.x,terrainY(g.x,g.z),g.z);});
 markers.splice(0,markers.length,...(level===2?[
   {name:'Aleja Rogów',x:0,z:17,r:20},{name:'Miejskie lody',x:20,z:-16,r:12},
   {name:'Plac z fontanną',x:20,z:11,r:12},{name:'Miejska siłownia',x:-13,z:24,r:12}
 ]:[{name:'Zielona łąka',x:0,z:17,r:25},{name:'Lodowy stragan',x:8,z:-16,r:13},{name:'Kaczy staw',x:27,z:-8,r:15},{name:'Kozia siłownia',x:-13,z:21,r:12}]));
 explored.clear();keys.clear();touchControl.reset();training=null;nearest=null;voiceCooldown=0;supplyCooldown=0;
 for(const p of projectiles)scene.remove(p.group);projectiles.length=0;
 $('#world').setAttribute('aria-label',level===2?'Świat gry 3D: miasto Kozopolis':'Świat gry 3D: farma Kozi Raj');
 $('.location small').textContent=level===2?'KOZOPOLIS · PLANSZA 2':'KOZI RAJ · PLANSZA 1';
 if(level===2){$('#quest-title').textContent='Głos miasta';$('#quest-copy').textContent='Zajrzyj do mikrofonu na siłowni. Trenuj głos i odciągaj strażników beczeniem (R).';$('#quest-check').textContent='○';}
}
function enterCity(){
 applyLevel(2);wake();updateUI();
 toast('15 gwiazdek! Witaj w Kozopolis! Na miejskiej siłowni czeka trening głosu.',9);
}
function bleat(){
 if(voiceCooldown>0){toast('Złap oddech! Kolejne bee za '+Math.ceil(voiceCooldown)+' s.',2);return;}
 sound('bleat',0,{volume:.7+voiceLevel*.04});
 if(worldLevel===2){
   const p=player.group.position,dir={x:-Math.sin(yaw),z:-Math.cos(yaw)};
   // Guards walk toward a spot beyond the goat, leaving their food behind.
   let affected=0;
   for(const g of guards)if(Math.hypot(g.x-p.x,g.z-p.z)<voiceRadius(voiceLevel)){
     g.distracted=voiceDistraction(voiceLevel);g.state='distracted';g.target={x:clamp(p.x+dir.x*5,-46,46),z:clamp(p.z+dir.z*5,-46,46)};affected++;
   }
   voiceCooldown=5;toast(affected?'BEEE! '+affected+' kozy sprawdzają hałas. Jedzenie wolne!':'BEEE! Zasięg głosu: '+voiceRadius(voiceLevel)+' m.',3);
 }else toast(['Beeee! Tłumaczenie: jestem kozą.','Bee! Czy ktoś widział moje lody?','Beeee… bardzo ważna kozia opinia.'][Math.floor(rand()*3)],2);
}
function wake(){touchControl.reset();recordedAudio.stopAll();hungerAudio.reset();mealCooldown=0;player.group.rotation.z=0;sleeping=false;$('#rest').hidden=true;energy=100;movementActive=false;orbitYaw=0;yaw=0;const spawnZ=worldLevel===2?25:17;player.group.position.set(0,terrainY(0,spawnZ),spawnZ);jumpY=0;vy=0;velocity.set(0,0,0);hitCooldown=3;toast('Drugie życie. Pierwsza myśl: jedzenie!');}
function reset(){applyLevel(1);voiceLevel=0;wake();paused=false;$('#pause').hidden=true;eaten=0;legLevel=hoofLevel=jumpLevel=0;inventory=[5,3,2];select(0);updateInventory();iceEaten=false;explored.clear();training=null;supplyCooldown=0;for(const f of [...foods,...pickups]){f.taken=false;f.respawn=0;f.group.visible=true;}for(const g of guards){g.x=g.home.x;g.z=g.home.z;g.distracted=0;g.target=null;g.state='patrol';g.group.position.set(g.x,terrainY(g.x,g.z),g.z);}for(const p of projectiles)scene.remove(p.group);projectiles.length=0;$('#quest-title').textContent='Operacja: lody';$('#quest-copy').textContent='Znajdź stragan. Odciągnij strażnika rzutem i spróbuj lodów.';$('#quest-check').textContent='○';$('#quest-step').textContent='Odkryj lodowy stragan';toast('Nowa przygoda. Ten sam apetyt.');}
$('#start').addEventListener('click',()=>{playing=true;document.body.classList.add('playing');$('#welcome').hidden=true;$('#hud').hidden=false;canvas.focus();sound('bleat');toast(getComputedStyle($('#touch')).display!=='none'?'Joystick — ruch. Pełne wychylenie — bieg. Przesuń świat drugim palcem, by obrócić kamerę.':'WASD — ruch. E — zjedz. Pierwsza marchewka czeka na ścieżce!',5);});
$('#help').addEventListener('click',()=>setPaused(!paused));$('#resume').addEventListener('click',()=>setPaused(false));$('#restart').addEventListener('click',reset);$('#wake').addEventListener('click',wake);
$('#sound').addEventListener('click',()=>{soundOn=!soundOn;recordedAudio.setEnabled(soundOn);if(!soundOn&&audio)audio.suspend();$('#sound').setAttribute('aria-pressed',String(soundOn));$('#sound').style.color=soundOn?'#dae9a1':'';$('#sound').setAttribute('aria-label',soundOn?'Wyłącz dźwięk':'Włącz dźwięk');sound();});
$('#full').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{toast('Pełny ekran jest niedostępny w tym podglądzie.');}});
$('#quality').addEventListener('change',e=>{const high=e.target.value==='high';grass.count=high?grassCount:Math.floor(grassCount/3);renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.6:1));renderer.shadowMap.enabled=high;});
document.querySelectorAll('[data-slot]').forEach(b=>b.addEventListener('click',()=>select(+b.dataset.slot)));
function press(code){if(code==='Escape'){setPaused(!paused);return;}if(!playing||paused||sleeping)return;if(code==='KeyE')eatOrTrain();if(code==='KeyF')take();if(code==='KeyQ')throwItem();if(code==='KeyR'&&!soundOn&&worldLevel===1){toast('Dźwięk jest wyciszony. Włącz go przyciskiem ♫.',3);return;}if(code==='KeyR'&&!training)bleat();if(['Digit1','Digit2','Digit3'].includes(code))select(+code.slice(-1)-1);if(code==='Space'&&jumpY<.03&&!training){vy=6.5*jumpingMultiplier(jumpLevel);sound('throw');}}
const gameKeys=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyE','KeyF','KeyQ','KeyR','Digit1','Digit2','Digit3','Escape'];
addEventListener('keydown',e=>{if(!gameKeys.includes(e.code)||e.target.tagName==='SELECT')return;e.preventDefault();if(!keys.has(e.code))press(e.code);keys.add(e.code);});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();touchControl.reset();if(playing&&!sleeping)setPaused(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();touchControl.reset();if(playing&&!sleeping)setPaused(true);}});
let dragging=false,lastPointer={x:0,y:0};canvas.addEventListener('pointerdown',e=>{dragging=true;lastPointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!dragging)return;lastCameraInput=time;orbitYaw-=(e.clientX-lastPointer.x)*.006;orbitPitch=clamp(orbitPitch+(e.clientY-lastPointer.y)*.004,.15,1.1);lastPointer={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom+e.deltaY*.009,4.3,15);},{passive:false});
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();if(e.pointerType==='mouse'&&e.button!==0)return;press(b.dataset.key);});});
function moveWithCollisions(pos,dx,dz,r=.55){pos.x=clamp(pos.x+dx,-47.6,47.6);for(const c of colliders){if(Math.abs(pos.x-c.x)<c.hx+r&&Math.abs(pos.z-c.z)<c.hz+r)pos.x=dx>0?c.x-c.hx-r:c.x+c.hx+r;}pos.z=clamp(pos.z+dz,-47.6,47.6);for(const c of colliders){if(Math.abs(pos.x-c.x)<c.hx+r&&Math.abs(pos.z-c.z)<c.hz+r)pos.z=dz>0?c.z-c.hz-r:c.z+c.hz+r;}}
function animateGoat(g,moving,dt,trainingStyle=null){g.phase+=dt*(moving?10:1.7);for(let i=0;i<4;i++)g.legs[i].rotation.x=moving?Math.sin(g.phase+(i===0||i===3?0:Math.PI))*.45:Math.sin(g.phase+i)*.025;g.body.position.y=moving?Math.abs(Math.sin(g.phase))* .045:Math.sin(g.phase)*.018;g.head.rotation.y=Math.sin(g.phase*.37)*.035;g.tail.rotation.x=-.7+Math.sin(g.phase*1.4)*.13;if(trainingStyle==='hooves'){g.body.rotation.x=-.4;g.legs[0].rotation.x=g.legs[2].rotation.x=-1.2+Math.sin(g.phase)*.4;}else g.body.rotation.x=0;if(trainingStyle==='voice'){g.head.rotation.x=Math.sin(g.phase*3)*.09;g.head.rotation.y=Math.sin(g.phase)*.1;}else g.head.rotation.x=0;}
function guardTick(g,dt){
 g.distracted=Math.max(0,g.distracted-dt);
 g.state=guardDecision(g,{x:player.group.position.x,z:player.group.position.z});
 let target;
 if(g.state==='distracted')target=g.target;
 else if(g.state==='chase')target=player.group.position;
 else{
   g.patrolIndex??=0;g.patrolWait??=0;
   g.patrolWait=Math.max(0,g.patrolWait-dt);
   const route=[[-1.5,1.2],[1.6,1.2],[1.6,-1.3],[-1.5,-1.3]];
   const offset=route[g.patrolIndex];
   target={x:g.home.x+offset[0],z:g.home.z+offset[1]};
 }
 const dx=target.x-g.x,dz=target.z-g.z,dist=Math.hypot(dx,dz);
 const speed=g.state==='chase'?4.8:g.state==='distracted'?3.1:1;
 let moved=false;
 if(dist>.45&&!(g.state==='patrol'&&g.patrolWait>0)){
   const pos=new THREE.Vector3(g.x,0,g.z);
   moveWithCollisions(pos,dx/dist*speed*dt,dz/dist*speed*dt,.52);
   moved=Math.hypot(g.x-pos.x,g.z-pos.z)>.005;
   g.x=pos.x;g.z=pos.z;
   if(moved){const goal=Math.atan2(-dx,-dz);const difference=Math.atan2(Math.sin(goal-g.group.rotation.y),Math.cos(goal-g.group.rotation.y));g.group.rotation.y+=clamp(difference,-dt*2.8,dt*2.8);}
 }else if(g.state==='patrol'&&dist<=.45){g.patrolIndex=(g.patrolIndex+1)%4;g.patrolWait=1.4;}
 g.group.position.set(g.x,terrainY(g.x,g.z),g.z);animateGoat(g,moved,dt);
 if(g.state==='chase'&&Math.hypot(g.x-player.group.position.x,g.z-player.group.position.z)<1.15&&hitCooldown<=0&&jumpY<1){energy=Math.max(0,energy-12);hitCooldown=2.5;const dir=player.group.position.clone().sub(g.group.position);dir.y=0;if(dir.length()<.1)dir.set(0,0,1);dir.normalize();velocity.add(dir.multiplyScalar(8));vy=4;sound('hit');toast('Bęc! „Moje lody!” — powiedziała koza. −12 energii.');}
}
function projectileTick(p,dt){p.ttl-=dt;if(!p.landed){p.v.y-=10.5*dt;p.group.position.addScaledVector(p.v,dt);p.group.rotation.x+=dt*5;p.group.rotation.z+=dt*2.2;const ground=terrainY(p.group.position.x,p.group.position.z);if(p.group.position.y<=ground+.12){p.group.position.y=ground+.12;p.landed=true;p.group.rotation.set(0,rand()*6,0);distract(p.group.position,p.noise,p.type);}}}
const camTarget=new THREE.Vector3(),camGoal=new THREE.Vector3();
camera.position.set(11,6.8,27);camera.lookAt(0,1.6,8);
function cameraTick(dt){
 if(!playing){camGoal.set(11+Math.sin(time*.045)*1.4,6.8,27);camTarget.set(0,1.6,8);}
 else{
   if(movementActive&&!paused&&!sleeping&&!dragging&&time-lastCameraInput>.8){const difference=Math.atan2(Math.sin(yaw-orbitYaw),Math.cos(yaw-orbitYaw));orbitYaw+=difference*(1-Math.exp(-dt*2.5));}
   const p=player.group.position;
   camGoal.set(p.x+Math.sin(orbitYaw)*Math.cos(orbitPitch)*zoom,p.y+1.4+Math.sin(orbitPitch)*zoom,p.z+Math.cos(orbitYaw)*Math.cos(orbitPitch)*zoom);
   camGoal.y=Math.max(camGoal.y,terrainY(camGoal.x,camGoal.z)+1.3);
   camTarget.lerp(new THREE.Vector3(p.x,p.y+1.3,p.z),1-Math.exp(-dt*7));
 }
 camera.position.lerp(camGoal,1-Math.exp(-dt*5));camera.lookAt(camTarget);
}
function trainingLevel(type){return type==='legs'?legLevel:type==='hooves'?hoofLevel:type==='jumps'?jumpLevel:voiceLevel;}
function updateTrainingStars(){for(const [type,name] of [['legs','Nogi'],['hooves','Kopyta'],['jumps','Skoki'],['voice','Głos']]){const level=trainingLevel(type),row=$('#skill-'+type);row.setAttribute('aria-label',name+': '+level+' z 5 poziomów');row.querySelectorAll('.star').forEach((star,i)=>star.classList.toggle('filled',i<level));}}
function updateUI(){
$('#skill-voice').hidden=worldLevel===1;$('#level-progress').textContent=worldLevel===1?'Farma · '+(legLevel+hoofLevel+jumpLevel)+'/15 ★ → miasto':'Kozopolis · plansza 2';
if(worldLevel===2){$('#quest-step').textContent='Głos: '+voiceLevel+'/5 ★ · R — odciągnij kozy';$('#quest-check').textContent=voiceLevel===5?'✓':'○';}
const n=Math.round(energy);$('#energy-number').textContent=n;$('#energy-fill').style.width=energy+'%';$('#energy-fill').style.background=energy<25?'#dfa47b':'#dae9a1';$('#energy-label').textContent=energy>65?'Pełny brzuszek. Można trenować!':energy>30?'Mała przekąska brzmi całkiem dobrze.':'Brzuch burczy. Znajdź jedzenie!';$('#eaten-count').textContent=eaten;updateTrainingStars();$('#explored-count').textContent=explored.size+' / 4';
$('#paused-mission').textContent=$('#quest-title').textContent+'. '+$('#quest-copy').textContent+' '+$('#quest-step').textContent;
const near=nearby();nearest=near;const interact=$('#touch-interact');interact.querySelector('.action-label').textContent=training?'Trening…':near?.kind==='gym'?'Ćwicz':'Jedz';interact.disabled=!!training||!near||!['food','gym'].includes(near.kind);const prompt=$('#prompt');if(training){prompt.hidden=false;prompt.innerHTML='<span>Trening… '+Math.ceil((3-training.elapsed))+' s · −20 energii</span>';return;}prompt.hidden=!near;if(near){let key='E',text='';if(near.kind==='food')text=FOOD[near.item.type].name+' · +'+FOOD[near.item.type].energy+' energii';else if(near.kind==='pickup'){key='F';text='Podnieś: '+ITEMS[near.item.type].name;}else if(near.kind==='supply'){key='F';text='Uzupełnij przedmioty';}else{const lv=trainingLevel(near.item.type);text=near.item.name+' · poziom '+lv+'/5 · −20 energii';}prompt.innerHTML='<kbd>'+key+'</kbd><span>'+text+'</span>';}}
let last=performance.now(),uiAccum=0;
function frame(now){const dt=Math.min((now-last)/1000,.04);last=now;time+=dt;wind.value=time;skyTime.value=time;
if(playing&&!paused&&!sleeping){const p=player.group.position;mealCooldown=Math.max(0,mealCooldown-dt);voiceCooldown=Math.max(0,voiceCooldown-dt);hitCooldown=Math.max(0,hitCooldown-dt);supplyCooldown=Math.max(0,supplyCooldown-dt);const keyboardForward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),keyboardSide=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);const keyboardMoving=!!(keyboardForward||keyboardSide);const forward=keyboardMoving?keyboardForward:joystickInput.forward,side=keyboardMoving?keyboardSide:joystickInput.side;const moveStrength=keyboardMoving?1:joystickInput.strength;const moving=moveStrength>0&&!training;movementActive=moving;const running=moving&&(keys.has('ShiftLeft')||keys.has('ShiftRight')||(!keyboardMoving&&moveStrength>.9));energy=hunger(energy,dt,running);camera.getWorldDirection(movementView);const movement=cameraRelativeMovement(forward,side,movementView.x,movementView.z);let dir=new THREE.Vector3(movement.x,0,movement.z);if(dir.length()>0&&!training){dir.normalize();const speed=(running?7.2:4.25)*moveStrength*movementMultiplier(legLevel)*(energy<20?.65:1);moveWithCollisions(p,dir.x*speed*dt,dir.z*speed*dt);const goal=Math.atan2(-dir.x,-dir.z);yaw+=Math.atan2(Math.sin(goal-yaw),Math.cos(goal-yaw))*Math.min(dt*10,1);}velocity.multiplyScalar(Math.exp(-dt*5));if(velocity.length()>.05)moveWithCollisions(p,velocity.x*dt,velocity.z*dt);vy-=16*dt;jumpY=Math.max(0,jumpY+vy*dt);if(jumpY<=0)vy=0;const trampolineSurface=Math.hypot(p.x+13,p.z-27)<1.65?.58:0;const voiceSurface=worldLevel===2&&Math.abs(p.x+9.6)<1.35&&Math.abs(p.z-27)<1.5?.24:0;p.y=terrainY(p.x,p.z)+jumpY+Math.max(trampolineSurface,voiceSurface)+(training?.station.type==='legs'?.38:0)+(training?.station.type==='jumps'?Math.abs(Math.sin(training.elapsed*Math.PI*2))*.9:0);player.group.rotation.y=yaw;animateGoat(player,moving||training?.station.type==='legs',dt,training?.station.type);if(training){training.elapsed+=dt;if(training.elapsed>=3){energy=Math.max(0,energy-20);if(training.station.type==='legs'){legLevel++;toast('Nogi '+legLevel+'/5. Biegasz o '+legLevel*14+'% szybciej!');}else if(training.station.type==='hooves'){hoofLevel++;toast('Kopyta '+hoofLevel+'/5. Rzucasz coraz dalej!');}else if(training.station.type==='jumps'){jumpLevel++;toast('Skoki '+jumpLevel+'/5. Skaczesz o '+jumpLevel*25+'% wyżej!');}else{voiceLevel++;toast('Głos '+voiceLevel+'/5! Beczenie słychać z '+voiceRadius(voiceLevel)+' m. R — odciągnij strażnika!');}training=null;sound('eat');if(canUnlockCity(worldLevel,{legs:legLevel,hooves:hoofLevel,jumps:jumpLevel}))enterCity();}}
for(const g of guards)guardTick(g,dt);$('#guard-alert').hidden=!guards.some(g=>g.state==='chase');for(const f of [...foods,...pickups]){if(f.taken){f.respawn-=dt;if(f.respawn<=0){f.taken=false;f.group.visible=true;}}else if(f.phase!==undefined)f.model.position.y=Math.sin(time*1.5+f.phase)*.06;}
for(let i=projectiles.length-1;i>=0;i--){projectileTick(projectiles[i],dt);if(projectiles[i].ttl<=0){scene.remove(projectiles[i].group);projectiles.splice(i,1);}}
let loc=worldLevel===2?'Aleja Rogów':'Zielona łąka',min=Infinity;for(const mark of markers){const d=Math.hypot(p.x-mark.x,p.z-mark.z);if(d<mark.r&&d<min){loc=mark.name;min=d;if(!explored.has(loc)){explored.add(loc);if(loc==='Lodowy stragan'&&!iceEaten){$('#quest-step').textContent='Rzuć przedmiot obok strażnika (Q)';toast('Lody! Strażnik ma słabość do głośnych przedmiotów.');}else if(loc==='Kozia siłownia'||loc==='Miejska siłownia')toast('Siłownia! Zjedz do 65 energii i naciśnij E przy stanowisku.');}}}$('#location-name').textContent=loc;
if(energy<=0){sleeping=true;keys.clear();touchControl.reset();training=null;movementActive=false;recordedAudio.stopAll();sound('death',0,{volume:.8});player.group.rotation.z=-Math.PI/2;player.group.position.y=terrainY(p.x,p.z)+.45;$('#rest').hidden=false;}else{const cue=hungerAudio.update(energy,dt);if(cue){sound('growl',0,{volume:cue.volume,rate:cue.rate,duration:cue.duration});if(cue.level>=3)sound('bleat',.8,{volume:cue.level===4?.7:.4,rate:cue.level===4?.7:.85});}}}
else{if(!paused&&!sleeping){animateGoat(player,false,dt);for(const g of guards)animateGoat(g,false,dt);}}
if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('#toast').classList.remove('visible');}
for(let i=0;i<ripples.length;i++){const s=1+(time*.12+i*.37)%2;ripples[i].scale.setScalar(s);ripples[i].material.opacity=.15*(1-(s-1)/2);}
for(let i=0;i<pondDucks.length;i++){pondDucks[i].position.y=Math.sin(time*1.7+i)*.025;pondDucks[i].rotation.y=Math.sin(time*.15+i)*.5;}
for(let i=0;i<motes.length;i++){const m=motes[i];dummy.position.set(m.x+Math.sin(time*.1+m.phase),m.y+Math.sin(time*.3+m.phase)*.3,m.z);dummy.scale.setScalar(1);dummy.rotation.set(0,0,0);dummy.updateMatrix();floating.setMatrixAt(i,dummy.matrix);}floating.instanceMatrix.needsUpdate=true;
uiAccum+=dt;if(playing&&uiAccum>.12){updateUI();uiAccum=0;}cameraTick(dt);renderer.render(scene,camera);requestAnimationFrame(frame);}
addEventListener('resize',()=>{touchControl.reset();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#error').hidden=false;$('#error-text').textContent='Grafika 3D została zatrzymana. Odśwież grę lub wybierz niższą jakość grafiki.';});
$('#sound').style.color='#dae9a1';$('#sound').setAttribute('aria-label','Wyłącz dźwięk');$('#sound').setAttribute('aria-pressed','true');
$('#start').disabled=false;$('#start').innerHTML='Ruszam na farmę <span>↗</span>';updateInventory();
requestAnimationFrame(frame);
// Read-only diagnostics are useful when checking graphics and gameplay.
window.goatGame={snapshot:()=>({playing,paused,sleeping,energy,eaten,position:{x:player.group.position.x,y:player.group.position.y,z:player.group.position.z},inventory:[...inventory],legLevel,hoofLevel,jumpLevel,voiceLevel,worldLevel,training:training?.station.type||null,guards:guards.map(g=>({x:g.x,z:g.z,state:g.state,distracted:g.distracted})),explored:[...explored],iceEaten,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,near:nearest?{kind:nearest.kind,type:nearest.item.type}:null})};
