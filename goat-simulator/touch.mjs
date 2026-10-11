// An analogue stick with a dead zone and one captured finger. Other fingers
// remain free to use action buttons or drag the camera.
export function usesTouchLayout({mode='auto',touchPoints=0,coarsePointer=false,width,height}){
 if(mode==='touch')return true;
 if(mode==='keyboard')return false;
 return touchPoints>0||coarsePointer||width<=600||(height<=500&&width<=1000);
}

export function attachTouchLayout(element,select,onChange=()=>{}){
 const coarse=matchMedia('(any-pointer: coarse)');
 const update=()=>{
  element.classList.toggle('touch-layout',usesTouchLayout({
   mode:select.value,touchPoints:navigator.maxTouchPoints||0,
   coarsePointer:coarse.matches,width:innerWidth,height:innerHeight
  }));
  onChange();
 };
 select.addEventListener('change',update);
 coarse.addEventListener('change',update);
 addEventListener('resize',update);
 update();
}

export function joystickVector(dx,dy,radius,deadZone=.12){
 const distance=Math.hypot(dx,dy);
 const travel=Math.min(distance,Math.max(1,radius));
 const visualScale=distance?travel/distance:0;
 const strength=Math.max(0,(travel/Math.max(1,radius)-deadZone)/(1-deadZone));
 return {side:distance?dx/distance*strength:0,forward:distance?-dy/distance*strength:0,
  strength,x:dx*visualScale,y:dy*visualScale};
}

export function attachJoystick(element,onChange,isActive=()=>true){
 let pointer=null,center={x:0,y:0},radius=1;
 const knob=element.querySelector('.joystick-knob');
 function update(event){
  const v=joystickVector(event.clientX-center.x,event.clientY-center.y,radius);
  knob.style.transform=`translate(${v.x}px,${v.y}px)`;
  element.classList.toggle('running',v.strength>.9);
  onChange({forward:v.forward,side:v.side,strength:v.strength});
 }
 function reset(){
  const captured=pointer;pointer=null;
  if(captured!==null&&element.hasPointerCapture(captured))element.releasePointerCapture(captured);
  knob.style.transform='translate(0px,0px)';
  element.classList.remove('active','running');
  onChange({forward:0,side:0,strength:0});
 }
 element.addEventListener('pointerdown',event=>{
  if(pointer!==null||!isActive()||(event.pointerType==='mouse'&&event.button!==0))return;
  event.preventDefault();
  const box=element.getBoundingClientRect();
  center={x:box.left+box.width/2,y:box.top+box.height/2};
  radius=Math.max(1,(box.width-knob.offsetWidth)/2-5);
  pointer=event.pointerId;element.setPointerCapture(pointer);
  element.classList.add('active');update(event);
 });
 element.addEventListener('pointermove',event=>{
  if(event.pointerId!==pointer)return;
  if(!isActive()){reset();return;}
  event.preventDefault();update(event);
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])
  element.addEventListener(type,event=>{if(event.pointerId===pointer)reset();});
 return {reset};
}
