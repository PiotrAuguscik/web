export const ITEMS=[{name:'Kamień',noise:18,flight:13},{name:'Kaczuszka',noise:23,flight:12},{name:'Stary but',noise:18,flight:11}];
export const FOOD={trash:{name:'Śmieci',energy:5,line:'Mmm… rocznik wczorajszy. +5 energii'},carrot:{name:'Marchewka',energy:15,line:'Chrup! +15 energii'},jelly:{name:'Galaretkowa kaczuszka',energy:20,line:'Kwa, kwa… mniam. +20 energii'},ice:{name:'Lody',energy:50,line:'Lodowy zawrót rogów! +50 energii'}};
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function feed(energy,type){if(!FOOD[type])throw Error('Nieznane jedzenie');return clamp(energy+FOOD[type].energy,0,100);}
export function hunger(energy,dt,running=false){return clamp(energy-dt*(running?.9:.38),0,100);}
export const MAX_TRAINING_LEVEL=5;
export function canTrain(energy,level){return energy>=65&&level<MAX_TRAINING_LEVEL;}
export function movementMultiplier(level){return 1+clamp(level,0,MAX_TRAINING_LEVEL)*.14;}
export function throwingMultiplier(level){return 1+clamp(level,0,MAX_TRAINING_LEVEL)*.22;}
// Stronger throws land farther away and must remain audible to nearby guards.
export function throwingNoise(type,level){return ITEMS[type].noise*(1+clamp(level,0,MAX_TRAINING_LEVEL)*.35);}
export function jumpingMultiplier(level){return Math.sqrt(1+clamp(level,0,MAX_TRAINING_LEVEL)*.25);}
export function cameraRelativeMovement(forward,side,viewX,viewZ){
 const viewLength=Math.hypot(viewX,viewZ);
 if(!viewLength)return {x:0,z:0};
 const fx=viewX/viewLength,fz=viewZ/viewLength;
 const x=forward*fx-side*fz,z=forward*fz+side*fx;
 const length=Math.hypot(x,z);
 return length?{x:x/length,z:z/length}:{x:0,z:0};
}
export function guardDecision(guard,player){if(guard.distracted>0)return 'distracted';const homeDist=Math.hypot(player.x-guard.home.x,player.z-guard.home.z);if(homeDist<7.5&&(guard.state==='chase'||Math.hypot(player.x-guard.x,player.z-guard.z)<5.7))return 'chase';return 'patrol';}
