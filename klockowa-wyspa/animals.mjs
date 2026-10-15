import {collides,castRay} from './world.mjs?v=2';
import {moveAxis,supported} from './player.mjs?v=2';
export const ANIMAL_DEFS=[
 {id:'sheep-1',kind:'sheep',name:'Owieczka Chmurka',x:.5,z:7.5},
 {id:'pig-1',kind:'pig',name:'Świnka Malinka',x:-3.5,z:4.5},
 {id:'rabbit-1',kind:'rabbit',name:'Królik Fistaszek',x:3.5,z:5.5},
 {id:'sheep-2',kind:'sheep',name:'Owieczka Wełenka',x:8.5,z:6.5},
 {id:'pig-2',kind:'pig',name:'Świnka Pestka',x:-7.5,z:-1.5},
 {id:'rabbit-2',kind:'rabbit',name:'Królik Toffi',x:5.5,z:-5.5}
];
export function clearSight(world,a,b){const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},len=Math.hypot(d.x,d.y,d.z);if(len<.001)return true;return !castRay(world,a,{x:d.x/len,y:d.y/len,z:d.z/len},Math.max(0,len-.08));}
export function standAt(world,x,z,nearY,height=1.3,radius=.35){
 for(let y=Math.min(38,Math.floor(nearY+1.05));y>=Math.max(2,Math.floor(nearY-1.1));y--){const p={x,y:y+.001,z,height,radius};if(!collides(world,p)&&supported(world,p))return p;}
 return null;
}
export function pathTo(world,animal,destination){
 const start={x:Math.floor(animal.x),z:Math.floor(animal.z),y:Math.round(animal.y)},goal={x:Math.floor(destination.x),z:Math.floor(destination.z)};
 const queue=[{...start,path:[]}],visited=new Set([`${start.x},${start.z},${start.y}`]);let best=null;
 for(let i=0;i<queue.length&&i<480;i++){
  const node=queue[i],distance=Math.hypot(node.x-goal.x,node.z-goal.z);
  if(distance<=1.5)return node.path;
  if(!best||distance<best.distance)best={path:node.path,distance};
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=node.x+dx,z=node.z+dz;if(Math.abs(x)>21||Math.abs(z)>21)continue;
   const stand=standAt(world,x+.5,z+.5,node.y,animal.height,animal.radius);if(!stand)continue;
   const id=`${x},${z},${Math.round(stand.y)}`;if(visited.has(id))continue;
   // There must be room above both cells when stepping up.
   const crossing={...animal,x:node.x+.5,z:node.z+.5,y:Math.max(node.y,stand.y)};
   if(collides(world,crossing))continue;
   visited.add(id);queue.push({x,z,y:stand.y,path:[...node.path,stand]});
  }
 }
 return best?.path??[];
}
export class AnimalWorld{
 constructor(world,saved=[]){this.world=world;this.time=0;this.animals=ANIMAL_DEFS.map((def,i)=>{
  const old=Array.isArray(saved)?saved.find(a=>a?.id===def.id):null;
  const a={...def,x:def.x,z:def.z,y:world.surface(Math.floor(def.x),Math.floor(def.z))+.001,radius:def.kind==='rabbit'?.22:.36,height:def.kind==='rabbit'?.85:1.25,vy:0,phase:i*1.2,angle:i,plan:i*.3,route:[],fed:0,happy:0,friend:false,walking:false};
  if(old){a.friend=old.friend===true;a.fed=Number.isInteger(old.fed)?Math.min(9999,Math.max(0,old.fed)):0;if([old.x,old.y,old.z].every(Number.isFinite)&&Math.abs(old.x)<22&&Math.abs(old.z)<22&&old.y>1&&old.y<39&&!collides(world,{...a,x:old.x,y:old.y,z:old.z})){a.x=old.x;a.y=old.y;a.z=old.z;}}
  if(collides(world,a)){
   for(let r=1;r<=8;r++){let found=false;for(const [dx,dz] of [[r,0],[-r,0],[0,r],[0,-r]]){const p={...a,x:def.x+dx,z:def.z+dz,y:world.surface(Math.floor(def.x+dx),Math.floor(def.z+dz))+.001};if(p.y<37&&!collides(world,p)){Object.assign(a,{x:p.x,y:p.y,z:p.z});found=true;break;}}if(found)break;}
  }
  return a;
 });}
 serialize(){return this.animals.map(({id,x,y,z,friend,fed})=>({id,x,y,z,friend,fed}));}
 target(origin,dir,max=4){let best=null,bestT=max;for(const a of this.animals){
  const center={x:a.x,y:a.y+a.height*.55,z:a.z},v={x:center.x-origin.x,y:center.y-origin.y,z:center.z-origin.z},t=v.x*dir.x+v.y*dir.y+v.z*dir.z;
  const perpendicular=Math.hypot(v.x-dir.x*t,v.y-dir.y*t,v.z-dir.z*t);
  if(t>0&&t<bestT&&perpendicular<(a.kind==='rabbit'?.48:.72)&&clearSight(this.world,origin,center)){best=a;bestT=t;}
 }return best;}
 feed(a,player){
  if(!a||Math.hypot(a.x-player.x,a.y-player.y,a.z-player.z)>4.2||!clearSight(this.world,{x:player.x,y:player.y+1.4,z:player.z},{x:a.x,y:a.y+a.height*.55,z:a.z}))return 'far';
  if(a.happy>0)return 'full';a.friend=true;a.fed++;a.happy=8;a.route=[];return 'fed';
 }
 invalidate(){for(const a of this.animals){a.route=[];a.plan=0;}}
 step(dt,player,food){
  this.time+=dt;
  for(const a of this.animals){
   a.happy=Math.max(0,a.happy-dt);a.plan-=dt;a.walking=false;
   if(collides(this.world,a)){a.route=[];a.plan=.8;continue;}
   const dist=Math.hypot(a.x-player.x,a.z-player.z);
   const attracted=food&&dist<11&&a.happy===0&&clearSight(this.world,{x:a.x,y:a.y+.7,z:a.z},{x:player.x,y:player.y+1.3,z:player.z});
   if(a.plan<=0&&a.happy<6){
    a.plan=attracted?.7:3+(Math.sin(this.time+a.phase)+1)*1.5;
    const destination=attracted?player:{x:a.x+Math.sin(this.time*.7+a.phase)*4,z:a.z+Math.cos(this.time*.5+a.phase)*4};
    a.route=attracted&&dist<2.8?[]:pathTo(this.world,a,destination);
   }
   if(attracted&&dist<2.8)a.route=[];
   if(a.route.length&&a.happy<6){
    const next=a.route[0],dx=next.x-a.x,dz=next.z-a.z,len=Math.hypot(dx,dz);
    if(len<.09)a.route.shift();else{
     a.angle=Math.atan2(dx,dz);const speed=attracted?1.5:.65,step=Math.min(len,speed*dt),oldX=a.x,oldZ=a.z;
     if(next.y>a.y+.25&&supported(this.world,a))a.vy=6.9;
     moveAxis(this.world,a,'x',dx/len*step);moveAxis(this.world,a,'z',dz/len*step);
     if(this.animals.some(other=>other!==a&&Math.hypot(other.x-a.x,other.z-a.z)<a.radius+other.radius+.08&&Math.abs(other.y-a.y)<1)){a.x=oldX;a.z=oldZ;a.route=[];a.plan=.5;}
     a.walking=Math.hypot(a.x-oldX,a.z-oldZ)>.0005;
     if(!a.walking&&supported(this.world,a)){a.route=[];a.plan=.2;}
    }
   }
   a.vy-=21*dt;if(moveAxis(this.world,a,'y',a.vy*dt))a.vy=0;
  }
 }
}
