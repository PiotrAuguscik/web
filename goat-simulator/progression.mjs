import {MAX_TRAINING_LEVEL,clamp} from './rules.mjs';

export function canUnlockCity(level,skills){
  return level===1&&['legs','hooves','jumps'].every(type=>skills[type]>=MAX_TRAINING_LEVEL);
}
export function voiceRadius(level){return 6+clamp(level,0,MAX_TRAINING_LEVEL)*3;}
export function voiceDistraction(level){return 3+clamp(level,0,MAX_TRAINING_LEVEL);}

export const CITY_FOOD_POSITIONS=[
  [-2,15],[-4,7],[4,20],[-8,15],[-7,-2],[-2,-11],[-3,32],[32,2],[-30,5],[-16,31],[37,-3],[6,-32],
  [-5,25],[-8,29],[3,30],[16,18],[-22,15],[6,-4],
  [22,20],[31,3],[-20,30],[20,-12.5],[23,-15],[16,19]
];
export const CITY_PICKUP_POSITIONS=[
  [2,16],[-2,17],[5,6],[-4,-8],[11,-7],[-14,15],[25,26],[-8,31],
  [-3,18],[16,14],[22,3],[-11,29],[4,17],[-4,23],[12,-5],[-22,20]
];
