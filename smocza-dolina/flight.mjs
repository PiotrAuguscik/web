export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function reticleOffset(targetHeading,heading,targetPitch,pitch){return {x:clamp(-angleDelta(targetHeading,heading)*.42,-.3,.3),y:clamp(-(targetPitch-pitch)*.55,-.25,.25)};}
export function stickVector(x,y){const r=Math.hypot(x,y),m=clamp((r-.12)/.88,0,1);return r?{x:x/r*m,y:y/r*m}:{x:0,y:0};}
// At a physical screen edge, movement deltas stop. Keep the steering command alive there.
function edgeAxis(position,size){const band=Math.min(80,size*.12);if(position<band)return -clamp((band-position)/band,0,1);if(position>size-band)return clamp((position-size+band)/band,0,1);return 0;}

// The same flight rules receive independent mouse, keyboard and touch intent.
export class FlightMotion {
 constructor(){this.speed=0;this.vertical=0;this.pitch=0;this.glide=0;this.takeoff=0;this.grounded=true;}
 stop(){this.speed=0;this.vertical=0;this.glide=0;}
 step(dt,input,heading,viewHeading,boost=1){
  const ease=(v,target,rate)=>v+(target-v)*(1-Math.exp(-dt*rate));
  let nextHeading=heading,dx=0,dz=0;
  if(this.grounded&&!input.thrust&&!input.rise){
   let x=input.walkX,z=input.walkZ;const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
   const speed=input.fast?19:13;
   dx=(Math.sin(viewHeading)*z-Math.cos(viewHeading)*x)*speed*dt;
   dz=(Math.cos(viewHeading)*z+Math.sin(viewHeading)*x)*speed*dt;
   if(Math.hypot(dx,dz)>.0001)nextHeading+=angleDelta(Math.atan2(dx,dz),nextHeading)*(1-Math.exp(-dt*12));
   this.speed=Math.hypot(x,z)*speed;this.vertical=0;this.pitch=ease(this.pitch,0,8);this.glide=0;
   return {heading:nextHeading,dx,dz,dy:0,pitch:this.pitch,flapping:false};
  }
  if(this.grounded){this.grounded=false;this.takeoff=.95;this.speed=Math.max(9,this.speed);}
  this.takeoff=Math.max(0,this.takeoff-dt);
  nextHeading+=angleDelta(input.heading,nextHeading)*(1-Math.exp(-dt*4.2));
  const targetPitch=input.rise?.62:input.descend?-.65:input.pitch;
  this.pitch=ease(this.pitch,targetPitch,4.5);
  if(input.brake){this.speed=ease(this.speed,0,5);this.vertical=ease(this.vertical,0,6);this.glide=0;}
  else if(input.thrust){this.speed=ease(this.speed,(input.fast?43:29)*boost,2.8);this.glide=0;let vy=Math.sin(this.pitch)*this.speed;if(this.takeoff>0&&!input.descend)vy=Math.max(vy,10);this.vertical=ease(this.vertical,vy,4.5);}
  else{this.glide+=dt;this.speed=ease(this.speed,9,.28);const sink=Math.min(10,1.2+this.glide*.65);this.vertical=ease(this.vertical,Math.sin(this.pitch)*this.speed-sink,2.5);}
  dx=Math.sin(nextHeading)*this.speed*Math.cos(this.pitch)*dt;dz=Math.cos(nextHeading)*this.speed*Math.cos(this.pitch)*dt;
  return {heading:nextHeading,dx,dz,dy:this.vertical*dt,pitch:this.pitch,flapping:input.thrust&&!input.brake};
 }
 land(){this.grounded=true;this.takeoff=0;this.vertical=0;this.speed=0;this.glide=0;}
}

export class FlightInput {
 constructor({canvas,document:doc,window:win,keys,active,onPause,onMode,onCapture}){
  this.canvas=canvas;this.doc=doc;this.win=win;this.keys=keys;this.active=active;this.onPause=onPause;this.onMode=onMode;this.onCapture=onCapture;
  this.heading=0;this.pitch=0;this.lastMouse=null;this.mouseThrust=false;this.mouseBrake=false;this.mousePointer=null;this.overUI=false;this.edgeSteering={x:0,y:0};this.stick={x:0,y:0};this.held=new Map();this.releases=new Set();this.choice='auto';this.mode='mouse';this.wasLocked=false;this.swapped=false;this.element='fire';
  this.touchCapable=(win.navigator?.maxTouchPoints||0)>0||!!win.matchMedia?.('(any-pointer: coarse)').matches;
  this.showTouch=this.touchCapable;
  doc.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')this.setMode('touch');else if(e.pointerType==='mouse'&&e.sourceCapabilities?.firesTouchEvents!==true)this.setMode('mouse');});
  canvas.addEventListener('pointerdown',e=>{
   if(!active()||e.pointerType==='touch'||this.choice==='touch')return;e.preventDefault();this.setMode('mouse');canvas.focus({preventScroll:true});
   this.lastMouse={x:e.clientX,y:e.clientY};if(e.button===0)this.mouseThrust=true;if(e.button===2)this.mouseBrake=true;
   this.overUI=false;this.mousePointer=e.pointerId;canvas.setPointerCapture?.(e.pointerId);
   this.captureMouse();
  });
  canvas.addEventListener('mousedown',e=>{if(!active()||this.choice==='touch'||e.sourceCapabilities?.firesTouchEvents)return;e.preventDefault();this.setMode('mouse');if(e.button===0)this.mouseThrust=true;if(e.button===2)this.mouseBrake=true;this.captureMouse();});
  // Some hosts accept capture on the completed click rather than pointerdown.
  canvas.addEventListener('click',e=>{if(e.pointerType!=='touch'&&!e.sourceCapabilities?.firesTouchEvents)this.captureMouse();});
  const moveMouse=e=>{
   if(!active()||this.mode!=='mouse'||this.choice==='touch'||e.sourceCapabilities?.firesTouchEvents)return;
   let dx=0,dy=0;
   if(doc.pointerLockElement===canvas){this.overUI=false;dx=Number(e.movementX)||0;dy=Number(e.movementY)||0;}
   else if(e.target===canvas||this.mousePointer!==null){this.overUI=false;if(this.lastMouse){dx=e.clientX-this.lastMouse.x;dy=e.clientY-this.lastMouse.y;}this.lastMouse={x:e.clientX,y:e.clientY};}
   else {this.overUI=true;this.lastMouse=null;return;}
   this.heading-=dx*.0032;this.pitch=clamp(this.pitch-dy*.0026,-.8,.7);
  };
  doc.addEventListener('mousemove',moveMouse);
  // Free-cursor pointer events also cover hosts that omit compatibility mousemove during a drag.
  // Same coordinates produce a zero delta when both event families are delivered.
  doc.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&doc.pointerLockElement!==canvas)moveMouse(e);});
  canvas.addEventListener('pointerenter',()=>this.overUI=false);
  canvas.addEventListener('pointerleave',e=>{if(this.mousePointer===null&&e.relatedTarget!==null)this.lastMouse=null;});
  // Pointer capture preserves drag steering beyond the canvas without opening a pause menu.
  const mouseUp=e=>{if(e.pointerType==='touch')return;if(e.button===0)this.mouseThrust=false;if(e.button===2)this.mouseBrake=false;this.releaseMouse();};
  doc.addEventListener('pointerup',mouseUp);doc.addEventListener('mouseup',mouseUp);doc.addEventListener('pointercancel',e=>{if(e.pointerType!=='touch'){this.mouseThrust=this.mouseBrake=false;this.releaseMouse();}});
  canvas.addEventListener('lostpointercapture',e=>{if(e.pointerId===this.mousePointer){this.mousePointer=null;if(doc.pointerLockElement!==canvas)this.mouseThrust=this.mouseBrake=false;}});
  doc.addEventListener('pointerlockchange',()=>{this.capturePending=false;const locked=doc.pointerLockElement===canvas;if(locked){this.lastMouse=null;this.captureError=null;this.onCapture?.('locked');}if(this.wasLocked&&!locked){this.mouseThrust=this.mouseBrake=false;if(active())onPause();}this.wasLocked=locked;});
  doc.addEventListener('pointerlockerror',()=>this.captureFailed());
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
 }
 captureMouse(){
  if(!this.active()||this.choice==='touch'||this.mode==='touch'&&this.choice!=='mouse'||this.doc.pointerLockElement||this.capturePending)return;
  if(!this.canvas.requestPointerLock){this.captureFailed({name:'NotSupportedError'});return;}
  this.canvas.focus({preventScroll:true});this.capturePending=true;
  try{const request=this.canvas.requestPointerLock();request?.catch?.(error=>this.captureFailed(error));}catch(error){this.captureFailed(error);}
 }
 captureFailed(error){if(this.doc.pointerLockElement===this.canvas)return;this.capturePending=false;this.captureError=error?.name||'PointerLockError';this.onCapture?.('free',this.captureError);}
 releaseMouse(){const id=this.mousePointer;this.mousePointer=null;if(id!==null&&this.canvas.hasPointerCapture?.(id))this.canvas.releasePointerCapture(id);}
 setMode(mode){if(this.mode===mode)return;this.mode=mode;if(this.choice==='auto'&&mode==='touch')this.showTouch=true;this.onMode?.();}
 setChoice(choice){this.choice=choice;this.showTouch=choice==='touch'||choice==='auto'&&this.touchCapable;this.reset(this.heading,this.pitch,true);this.onMode?.();}
 reset(heading=this.heading,pitch=0,unlock=false){for(const release of [...this.releases])release();this.releaseMouse();this.held.clear();this.stick={x:0,y:0};this.edgeSteering={x:0,y:0};this.keys.clear();this.mouseThrust=this.mouseBrake=false;this.lastMouse=null;this.overUI=false;this.heading=heading;this.pitch=pitch;if(unlock&&this.doc.pointerLockElement===this.canvas)this.doc.exitPointerLock?.();}
 bindHold(el,name){return this.bindPointer(el,()=>this.held.set(name,true),()=>{},()=>this.held.delete(name));}
 bindPointer(el,start,move,end,anyPointer=false){let pointer=null;const release=()=>{if(pointer===null)return;const old=pointer;pointer=null;this.releases.delete(release);el.classList.remove('pressed');end();if(el.hasPointerCapture?.(old))el.releasePointerCapture(old);};
  el.addEventListener('pointerdown',e=>{if(!this.active()||pointer!==null||!anyPointer&&e.pointerType!=='touch'&&this.choice!=='touch')return;e.preventDefault();pointer=e.pointerId;el.setPointerCapture?.(pointer);this.releases.add(release);el.classList.add('pressed');start(e);});
  el.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();move(e);}});
  for(const kind of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(kind,e=>{if(e.pointerId===pointer)release();});return release;
 }
 bindElement(el,type,onSelect){this.bindPointer(el,()=>{this.element=type;this.held.set(type,true);onSelect(type);},()=>{},()=>this.held.delete(type),true);}
 bindStick(el,knob){const move=e=>{const r=el.getBoundingClientRect(),radius=r.width*.34;const v=stickVector((e.clientX-r.left-r.width/2)/radius,(e.clientY-r.top-r.height/2)/radius);this.stick=v;knob.style.transform=`translate(${v.x*radius}px,${v.y*radius}px)`;};this.bindPointer(el,move,move,()=>{this.stick={x:0,y:0};knob.style.transform='translate(0,0)';});}
 read(dt,heading,grounded){const k=this.keys,has=(...xs)=>xs.some(x=>k.has(x));const touch=this.choice==='touch'||this.mode==='touch'&&this.choice!=='mouse';let x=0,y=0;
  this.edgeSteering={x:0,y:0};
  if(!touch&&this.doc.pointerLockElement!==this.canvas&&!this.overUI&&this.lastMouse){
   const edgeX=edgeAxis(this.lastMouse.x,this.win.innerWidth),edgeY=edgeAxis(this.lastMouse.y,this.win.innerHeight);
   this.edgeSteering={x:edgeX,y:edgeY};
   this.heading-=edgeX*dt*1.8;this.pitch=clamp(this.pitch-edgeY*dt*1.15,-.8,.7);
  }
  if(touch){x=this.stick.x;y=this.stick.y;this.heading=grounded?heading:heading-x*dt*1.7;this.pitch=clamp(-y*.78,-.8,.7);}
  if(!grounded)this.heading=heading+clamp(angleDelta(this.heading,heading),-.95,.95);
  this.heading+=((has('ArrowLeft')?1:0)-(has('ArrowRight')?1:0))*dt*1.5;
  const walkX=touch?x:(has('KeyD')?1:0)-(has('KeyA')?1:0),walkZ=touch?-y:(has('KeyW')?1:0)-(has('KeyS')?1:0);
  const thrust=this.mouseThrust||this.held.has('thrust')||has('Space')||!grounded&&has('KeyW');
  const fire=this.held.has('fire')||has('KeyR','Digit1'),ice=this.held.has('ice')||has('KeyQ','Digit2');
  return {heading:this.heading,pitch:this.pitch,walkX,walkZ,thrust,brake:this.mouseBrake||this.held.has('brake')||!grounded&&has('KeyS'),rise:has('Space'),descend:has('KeyC'),fast:has('ShiftLeft','ShiftRight')||this.held.has('fast'),breath:this.held.has('breath')||fire||ice,element:fire&&ice?this.element:fire?'fire':ice?'ice':null};
 }
}
