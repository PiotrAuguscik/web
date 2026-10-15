import {collides} from './world.mjs?v=2';
export function supported(world,p){return collides(world,{...p,y:p.y-.025});}
export function moveAxis(world,p,axis,delta){
 if(!delta)return false;
 const old=p[axis];p[axis]+=delta;
 if(!collides(world,p))return false;
 let clear=old,blocked=p[axis];
 for(let i=0;i<12;i++){p[axis]=(clear+blocked)/2;if(collides(world,p))blocked=p[axis];else clear=p[axis];}
 p[axis]=clear;return true;
}
export function stepPlayer(world,p,input,dt){
 p.vy??=0;p.jumpBuffer??=0;p.coyote??=0;p.radius=.29;
 const desiredHeight=input.sneak?1.5:1.75;
 if(desiredHeight<p.height||!collides(world,{...p,height:desiredHeight}))p.height=desiredHeight;
 p.height??=1.75;
 p.grounded=p.vy<=0&&supported(world,p);
 p.coyote=p.grounded?.10:Math.max(0,p.coyote-dt);
 p.jumpBuffer=input.jumpPressed?.15:Math.max(0,p.jumpBuffer-dt);
 let forward=input.forward,side=input.side;const n=Math.hypot(forward,side);if(n>1){forward/=n;side/=n;}
 const speed=input.sneak?1.3:input.sprint&&forward>0?5.612:4.317;
 const dx=(side*Math.cos(input.yaw)-forward*Math.sin(input.yaw))*speed*dt;
 const dz=(-forward*Math.cos(input.yaw)-side*Math.sin(input.yaw))*speed*dt;
 for(const [axis,d] of [['x',dx],['z',dz]]){
  const old=p[axis];moveAxis(world,p,axis,d);
  if(input.sneak&&p.grounded&&!supported(world,p))p[axis]=old;
 }
 if((p.jumpBuffer>0||input.jumpHeld)&&p.coyote>0){p.vy=7.3;p.grounded=false;p.coyote=0;p.jumpBuffer=0;}
 p.vy-=21*dt;
 const descending=p.vy<0;
 if(moveAxis(world,p,'y',p.vy*dt)){p.vy=0;p.grounded=descending;}else p.grounded=p.vy<=0&&supported(world,p);
 return p;
}
