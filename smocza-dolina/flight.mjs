export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function reticleOffset(targetHeading,heading,targetPitch,pitch){return {x:clamp(-angleDelta(targetHeading,heading)*.42,-.3,.3),y:clamp(-(targetPitch-pitch)*.55,-.25,.25)};}
export function stickVector(x,y){const r=Math.hypot(x,y),m=clamp((r-.12)/.88,0,1);return r?{x:x/r*m,y:y/r*m}:{x:0,y:0};}

// The same flight rules receive independent mouse, keyboard and touch intent.
export class FlightMotion {
 constructor(){this.speed=0;this.vertical=0;this.pitch=0;this.glide=0;this.takeoff=0;this.grounded=true;}
 stop(){this.speed=0;this.vertical=0;this.glide=0;}
 step(dt,input,heading,viewHeading,boost=1){
  const ease=(v,target,rate)=>v+(target-v)*(1-Math.exp(-dt*rate));
  // Same turn-rate and pitch response as Głupie wrony.
  let nextHeading=heading+clamp(angleDelta(input.heading,heading)*4.5,-2.35,2.35)*dt,dx=0,dz=0;
  if(this.grounded&&!input.thrust&&!input.rise){
   let x=input.walkX,z=input.walkZ;const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
   const speed=input.fast?19:13;
   const walkHeading=input.mouseSteering?nextHeading:viewHeading;
   dx=(Math.sin(walkHeading)*z-Math.cos(walkHeading)*x)*speed*dt;
   dz=(Math.cos(walkHeading)*z+Math.sin(walkHeading)*x)*speed*dt;
   if(!input.mouseSteering&&Math.hypot(dx,dz)>.0001)nextHeading=heading+angleDelta(Math.atan2(dx,dz),heading)*(1-Math.exp(-dt*12));
   this.speed=Math.hypot(x,z)*speed;this.vertical=0;this.pitch=ease(this.pitch,0,8);this.glide=0;
   return {heading:nextHeading,dx,dz,dy:0,pitch:this.pitch,flapping:false};
  }
  if(this.grounded){this.grounded=false;this.takeoff=.95;this.speed=Math.max(9,this.speed);}
  this.takeoff=Math.max(0,this.takeoff-dt);
  const targetPitch=input.rise?.48:input.descend?-.58:input.pitch;
  this.pitch=ease(this.pitch,targetPitch,3.5);
  if(input.brake){this.speed=ease(this.speed,0,5);this.vertical=ease(this.vertical,0,6);this.glide=0;}
  else if(input.thrust){this.speed=ease(this.speed,(input.fast?43:29)*boost,2.8);this.glide=0;let vy=Math.sin(this.pitch)*this.speed;if(this.takeoff>0&&!input.descend)vy=Math.max(vy,10);this.vertical=ease(this.vertical,vy,4.5);}
  else{this.glide+=dt;this.speed=ease(this.speed,9,.28);const sink=Math.min(10,1.2+this.glide*.65);this.vertical=ease(this.vertical,Math.sin(this.pitch)*this.speed-sink,2.5);}
  dx=Math.sin(nextHeading)*this.speed*Math.cos(this.pitch)*dt;dz=Math.cos(nextHeading)*this.speed*Math.cos(this.pitch)*dt;
  return {heading:nextHeading,dx,dz,dy:this.vertical*dt,pitch:this.pitch,flapping:input.thrust&&!input.brake};
 }
 land(){this.grounded=true;this.takeoff=0;this.vertical=0;this.speed=0;this.glide=0;}
}

export class FlightInput {
 constructor({canvas,document:doc,window:win,keys,active,onPause,onMode,onCapture,getHeading}){
  this.canvas=canvas;this.doc=doc;this.win=win;this.keys=keys;this.active=active;this.onPause=onPause;this.onMode=onMode;this.onCapture=onCapture;this.getHeading=getHeading||(()=>this.currentHeading);
  this.heading=0;this.currentHeading=0;this.pitch=0;this.aimX=0;this.aimY=0;this.lastMouse=null;this.mouseThrust=false;this.mouseBrake=false;this.mousePointer=null;this.overUI=false;this.stick={x:0,y:0};this.held=new Map();this.releases=new Set();this.choice='auto';this.mode='mouse';this.wasLocked=false;this.swapped=false;this.element='fire';
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
   if(doc.pointerLockElement===canvas){
    this.overUI=false;this.heading-=(Number(e.movementX)||0)*.0032;
    const heading=this.getHeading();this.heading=heading+clamp(angleDelta(this.heading,heading),-.95,.95);
    this.pitch=clamp(this.pitch-(Number(e.movementY)||0)*.0026,-.85,.7);
   }else if(e.target===canvas||this.mousePointer!==null){
    this.overUI=false;this.aimX=clamp((e.clientX-win.innerWidth/2)/(win.innerWidth*.42),-1,1);
    this.aimY=clamp((e.clientY-win.innerHeight/2)/(win.innerHeight*.42),-1,1);
   }else this.overUI=true;
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
  if(!this.active()||this.choice==='touch'||this.mode==='touch'&&this.choice!=='mouse'||this.doc.pointerLockElement||this.capturePending||!this.win.navigator?.userActivation?.isActive)return;
  if(!this.canvas.requestPointerLock){this.captureFailed({name:'NotSupportedError'});return;}
  this.canvas.focus({preventScroll:true});this.capturePending=true;
  try{const request=this.canvas.requestPointerLock();request?.catch?.(error=>this.captureFailed(error));}catch(error){this.captureFailed(error);}
 }
 captureFailed(error){if(this.doc.pointerLockElement===this.canvas)return;this.capturePending=false;this.captureError=error?.name||'PointerLockError';this.onCapture?.('free',this.captureError);}
 releaseMouse(){const id=this.mousePointer;this.mousePointer=null;if(id!==null&&this.canvas.hasPointerCapture?.(id))this.canvas.releasePointerCapture(id);}
 setMode(mode){if(this.mode===mode)return;this.mode=mode;if(this.choice==='auto'&&mode==='touch')this.showTouch=true;this.onMode?.();}
 setChoice(choice){this.choice=choice;this.showTouch=choice==='touch'||choice==='auto'&&this.touchCapable;this.reset(this.heading,this.pitch,true);this.onMode?.();}
 reset(heading=this.heading,pitch=0,unlock=false){for(const release of [...this.releases])release();this.releaseMouse();this.held.clear();this.stick={x:0,y:0};this.aimX=this.aimY=0;this.keys.clear();this.mouseThrust=this.mouseBrake=false;this.lastMouse=null;this.overUI=false;this.heading=this.currentHeading=heading;this.pitch=pitch;if(unlock&&this.doc.pointerLockElement===this.canvas)this.doc.exitPointerLock?.();}
 bindHold(el,name){return this.bindPointer(el,()=>this.held.set(name,true),()=>{},()=>this.held.delete(name));}
 bindPointer(el,start,move,end,anyPointer=false){let pointer=null;const release=()=>{if(pointer===null)return;const old=pointer;pointer=null;this.releases.delete(release);el.classList.remove('pressed');end();if(el.hasPointerCapture?.(old))el.releasePointerCapture(old);};
  el.addEventListener('pointerdown',e=>{if(!this.active()||pointer!==null||!anyPointer&&e.pointerType!=='touch'&&this.choice!=='touch')return;e.preventDefault();pointer=e.pointerId;el.setPointerCapture?.(pointer);this.releases.add(release);el.classList.add('pressed');start(e);});
  el.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();move(e);}});
  for(const kind of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(kind,e=>{if(e.pointerId===pointer)release();});return release;
 }
 bindElement(el,type,onSelect){this.bindPointer(el,()=>{this.element=type;this.held.set(type,true);onSelect(type);},()=>{},()=>this.held.delete(type),true);}
 bindStick(el,knob){const move=e=>{const r=el.getBoundingClientRect(),radius=r.width*.34;const v=stickVector((e.clientX-r.left-r.width/2)/radius,(e.clientY-r.top-r.height/2)/radius);this.stick=v;knob.style.transform=`translate(${v.x*radius}px,${v.y*radius}px)`;};this.bindPointer(el,move,move,()=>{this.stick={x:0,y:0};knob.style.transform='translate(0,0)';});}
 read(dt,heading,grounded){const k=this.keys,has=(...xs)=>xs.some(x=>k.has(x));const touch=this.choice==='touch'||this.mode==='touch'&&this.choice!=='mouse';let x=0,y=0;
  this.currentHeading=heading;
  if(touch){x=this.stick.x;y=this.stick.y;this.heading=grounded?heading:heading-x*.75;this.pitch=-y*.7;}
  else if(this.doc.pointerLockElement!==this.canvas){this.heading=heading-this.aimX*.75;this.pitch=-this.aimY*.65;}
  const walkX=touch?x:(has('KeyD','ArrowRight')?1:0)-(has('KeyA','ArrowLeft')?1:0),walkZ=touch?-y:(has('KeyW','ArrowUp')?1:0)-(has('KeyS','ArrowDown')?1:0);
  const thrust=this.mouseThrust||this.held.has('thrust')||has('Space');
  const fire=this.held.has('fire')||has('KeyR','Digit1'),ice=this.held.has('ice')||has('KeyQ','Digit2');
  return {heading:this.heading,pitch:this.pitch,mouseSteering:!touch,walkX,walkZ,thrust,brake:this.mouseBrake||this.held.has('brake'),rise:has('Space'),descend:has('KeyC'),fast:has('ShiftLeft','ShiftRight')||this.held.has('fast'),breath:this.held.has('breath')||fire||ice,element:fire&&ice?this.element:fire?'fire':ice?'ice':null};
 }
}
