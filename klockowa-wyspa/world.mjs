export const SIZE=48, HEIGHT=40, HALF=SIZE/2;
export const BLOCKS=[null,
 {name:'Trawa',color:'#82a84d'}, {name:'Drewno',color:'#c59a61'},
 {name:'Kamień',color:'#9caaa6'}, {name:'Piasek',color:'#e5cf8c'},
 {name:'Liście',color:'#6b9649'}, {name:'Cegła',color:'#c48262'},
 {name:'Różowy',color:'#e6a5ac'}, {name:'Błękitny',color:'#8abfc6'},
 {name:'Ziemia',color:'#94724c'}, {name:'Pień',color:'#846341'},
 {name:'Podłoże',color:'#59665e'}];
export const key=(x,y,z)=>`${x},${y},${z}`;
export class VoxelWorld{
 constructor(){this.cells=new Uint8Array(SIZE*HEIGHT*SIZE);this.changes=new Map();this.generate();}
 inside(x,y,z){return x>=-HALF&&x<HALF&&z>=-HALF&&z<HALF&&y>=0&&y<HEIGHT;}
 index(x,y,z){return (x+HALF)+SIZE*((z+HALF)+SIZE*y);}
 get(x,y,z){return this.inside(x,y,z)?this.cells[this.index(x,y,z)]:0;}
 put(x,y,z,t){if(this.inside(x,y,z))this.cells[this.index(x,y,z)]=t;}
 set(x,y,z,t){if(!this.inside(x,y,z)||y===0||!Number.isInteger(t)||t<0||t>10)return false;this.put(x,y,z,t);this.changes.set(key(x,y,z),t);return true;}
 surface(x,z){for(let y=HEIGHT-1;y>=0;y--)if(this.get(x,y,z))return y+1;return 0;}
 generate(){
  for(let x=-HALF;x<HALF;x++)for(let z=-HALF;z<HALF;z++){
   const r=Math.hypot(x*.95,z),isBeach=r>20;
   let h=Math.floor(6+1.5*Math.sin(x*.19)*Math.cos(z*.16)+.7*Math.sin(z*.38+x*.13));
   if(Math.abs(x)<6&&z>-6&&z<13)h=6;
   if(r>18)h=Math.max(1,Math.floor(6-(r-18)*.75));
   for(let y=0;y<=h;y++)this.put(x,y,z,y===0?11:y===h?(isBeach?4:1):y>h-3?9:3);
  }
  for(const [x,z,h] of [[-8,-6,4],[7,-10,5],[12,1,4],[-13,5,4],[4,-17,4],[-6,16,4],[16,-8,4],[-15,-11,5],[11,13,4]]){
   const y=this.surface(x,z);
   for(let j=0;j<h;j++)this.put(x,y+j,z,10);
   for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)for(let c=-1;c<=2;c++)if(Math.abs(a)+Math.abs(b)+Math.max(c,0)<5&&!(a===0&&b===0&&c<0))this.put(x+a,y+h-1+c,z+b,5);
  }
 }
 load(changes){if(!Array.isArray(changes))return;for(const entry of changes){if(!Array.isArray(entry)||entry.length!==4)continue;const [x,y,z,t]=entry;if([x,y,z,t].every(Number.isInteger))this.set(x,y,z,t);}}
 serialize(){return [...this.changes].map(([k,t])=>[...k.split(',').map(Number),t]);}
}
export function overlapsBlock(p,x,y,z){const r=p.radius??.29,h=p.height??1.75;return p.x+r>x&&p.x-r<x+1&&p.y+h>y&&p.y<y+1&&p.z+r>z&&p.z-r<z+1;}
export function collides(world,p){
 const r=p.radius??.29,h=p.height??1.75,eps=.00001;
 if(p.x-r<-HALF||p.x+r>HALF||p.z-r<-HALF||p.z+r>HALF)return true;
 for(let x=Math.floor(p.x-r+eps);x<=Math.floor(p.x+r-eps);x++)for(let y=Math.floor(p.y+eps);y<=Math.floor(p.y+h-eps);y++)for(let z=Math.floor(p.z-r+eps);z<=Math.floor(p.z+r-eps);z++)if(world.get(x,y,z))return true;
 return false;
}
export function castRay(world,origin,dir,max=7){
 let x=Math.floor(origin.x),y=Math.floor(origin.y),z=Math.floor(origin.z),distance=0,normal={x:0,y:0,z:0};
 const step={x:Math.sign(dir.x),y:Math.sign(dir.y),z:Math.sign(dir.z)};
 const delta={x:Math.abs(1/dir.x),y:Math.abs(1/dir.y),z:Math.abs(1/dir.z)};
 const next={x:dir.x===0?Infinity:((dir.x>0?x+1:x)-origin.x)/dir.x,y:dir.y===0?Infinity:((dir.y>0?y+1:y)-origin.y)/dir.y,z:dir.z===0?Infinity:((dir.z>0?z+1:z)-origin.z)/dir.z};
 for(let i=0;i<100&&distance<=max;i++){
  const type=world.get(x,y,z);if(type)return {x,y,z,type,normal,distance};
  if(next.x<next.y&&next.x<next.z){distance=next.x;next.x+=delta.x;x+=step.x;normal={x:-step.x,y:0,z:0};}
  else if(next.y<next.z){distance=next.y;next.y+=delta.y;y+=step.y;normal={x:0,y:-step.y,z:0};}
  else{distance=next.z;next.z+=delta.z;z+=step.z;normal={x:0,y:0,z:-step.z};}
 }
 return null;
}
