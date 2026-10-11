import {FOOD,feed} from './rules.mjs';

export function mealReaction(energy,type){
 if(!FOOD[type])throw Error('Nieznane jedzenie');
 const overfed=energy+FOOD[type].energy>100;
 const sounds=[{kind:'chew',delay:0,options:{volume:.65,duration:1.05,offset:.15}},{kind:'burp',delay:1.12,options:{volume:.75}}];
 if(overfed)sounds.push({kind:'fart',delay:1.8,options:{volume:.85}});
 return {energy:feed(energy,type),overfed,sounds};
}

export function hungerCue(energy){
 if(energy<=0||energy>55)return null;
 if(energy>35)return {level:1,interval:20,volume:.2,rate:1.08,duration:.8};
 if(energy>20)return {level:2,interval:13,volume:.4,rate:.97,duration:1.4};
 if(energy>8)return {level:3,interval:8,volume:.65,rate:.86,duration:2};
 return {level:4,interval:4.5,volume:.85,rate:.72,duration:2};
}

export class HungerAudioClock{
 constructor(){this.level=0;this.remaining=0;}
 reset(energy=100){this.level=hungerCue(energy)?.level||0;this.remaining=8;}
 update(energy,dt){
  const cue=hungerCue(energy);if(!cue){this.level=0;this.remaining=0;return null;}
  this.remaining-=dt;
  if(cue.level>this.level||this.remaining<=0){this.level=cue.level;this.remaining=cue.interval;return cue;}
  this.level=cue.level;return null;
 }
}
