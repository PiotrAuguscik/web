import {distance,surface} from './engine.js?v=2.2.0';
export function direction(from,to){const x=to.x-from.x,y=to.y-from.y;return Math.abs(x)>Math.abs(y)?x<0?'← z lewej':'→ z prawej':y<0?'↑ z góry':'↓ z dołu';}
const animalNames={fox:'Lis',owl:'Sowa',snake:'Wąż',rock:'Kamień'};
export function guidance(w,feedback=null){
  const cue=(kind,title,detail,action,button,extra={})=>({kind,title,detail,action,button,...extra});
  if(w.downed)return cue('danger','Potrzebujesz odpoczynku','Wracaj do nory przyciskiem w panelu.');
  if(w.trappedRock)return cue('danger','Przyciśnięty!','Ruszaj od kamienia albo naciśnij Wydostań.','escape','Wydostań',{threat:w.trappedRock});
  const rock=w.rocks.find(r=>(r.unstable>0||r.vy>10)&&distance(r,w.p)<180&&r.y<w.p.y+35);
  if(rock)return cue('danger','Kamień spada!','Odsuń się w bok. '+direction(w.p,rock)+'.',null,null,{threat:rock});
  const threats=w.predators.filter(e=>e.alert&&distance(e,w.p)<200&&(e.type==='owl'?w.surface:e.type==='fox'?w.p.y-surface(w.p.x)<55:w.openSegment(e,w.p)));
  threats.sort((a,b)=>distance(a,w.p)-distance(b,w.p));const threat=!w.safeAt(w.p)&&threats[0];
  if(threat)return cue('danger','Uciekaj!',animalNames[threat.type]+' '+direction(w.p,threat)+'. '+(w.surface?'Schowaj się pod ziemią ↓.':threat.type==='snake'?'Oddal się lub zasyp przejście.':'Zejdź głębiej ↓.'),!w.surface&&w.sealTarget().valid?'seal':null,!w.surface&&w.sealTarget().valid?'Zasyp · F':null,{threat});
  if(w.waterHere>.55)return cue('danger','Woda w tunelu!','Kieruj się w górę do suchego miejsca ↑.','building','Odpływ / nora');
  if(feedback?.hit){const s=feedback.source,enemy=s&&['fox','owl','snake'].includes(s.type),origin=s?.x===undefined?'':animalNames[s.type]+' '+direction(w.p,s)+' · ';return cue('danger',s?.type==='water'?'Wyjdź z wody!':s?.type==='hunger'?'Zjedz coś!':'Uciekaj!',origin+'−'+Math.ceil(feedback.hit)+' zdrowia. '+(enemy?'5 s ochrony — uciekaj!':s?.type==='hunger'?'Potrzebujesz jedzenia.':'Odsuń się od zagrożenia.'),s?.type==='hunger'&&w.food?'eat':null,s?.type==='hunger'&&w.food?'Zjedz · Q':null,{threat:s?.x===undefined?null:s});}
  if(w.escapeBoost>0)return cue('warning','Masz czas na ucieczkę!','Szybszy ruch i ochrona: '+Math.ceil(w.escapeBoost)+' s. Ruszaj od drapieżnika.');
  const object=w.interactable;
  if(object?.name)return cue('action','Zawołaj '+({Pikuś:'Pikusia',Figa:'Figę',Tuptuś:'Tuptusia'}[object.name]||object.name)+'!','Czeka na twój znak. Poprowadź go do domu.','interact','Zawołaj · E',{target:object});
  if(object?.title)return cue('action',object.title,'Dotknij Odkryj, żeby zebrać nagrodę.','interact','Odkryj · E',{target:object});
  if(w.energy<18||w.hunger<15)return cue('warning',w.energy<18?'Brakuje energii!':'Jesteś głodny!',w.food?'Zjedz robaka, żeby odzyskać siły.':'Nasłuchuj robaków albo wróć do nory.',w.food?'eat':'listen',w.food?'Zjedz · Q':'Nasłuch');
  if(object)return cue('action','Mały kamień','Możesz go przesunąć; lepsze pazurki go kruszą.','interact','Przesuń · E',{target:object});
  const stuck=w.kids.find(k=>k.state==='follow'&&k.stuck>1.2);
  if(stuck)return cue('warning',stuck.name+' nie może przejść','Odkop lub poszerz jego drogę. '+direction(w.p,stuck)+'.','map','Pokaż mapę',{target:stuck});
  if(feedback)return cue(feedback.type==='rescue'||feedback.type==='discovery'?'success':'info',feedback.title,feedback.text,feedback.type==='rescue'?'mission':null,feedback.type==='rescue'?'Rodzina':null);
  const follower=w.kids.find(k=>k.state==='follow');
  if(follower)return cue('success',follower.name+' idzie za tobą','Wracaj do nory. Dom '+direction(w.p,w.home)+'.','map','Mapa · M');
  if(w.nearRoom)return cue('safe','Bezpieczna nora','Odpocznij, odłóż zapasy lub ulepsz pazurki.','building','Nora · E');
  if(w.blocked==='rock')return cue('warning','Skała blokuje drogę','Obejdź ją. Małe kamienie można przesuwać.','listen','Nasłuch');
  if(w.blocked==='exit')return cue('info','Wyjście jest pionowe','Ruszaj prosto w górę ↑ albo zejdź głębiej ↓.');
  if(w.surface)return cue('warning','Jesteś na powierzchni','Widzisz niewyraźnie. Uważaj na lisa i sowę.','listen','Nasłuch');
  return cue('info',w.won?'Rodzina bezpieczna!':'Szukaj głosów rodziny',w.won?'Zostały sekrety i urządzanie podziemi.':'Nasłuch pokaże kierunek jedzenia i małych kretów.',w.won?'mission':'listen',w.won?'Odkrycia':'Nasłuch');
}
