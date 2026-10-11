export class RecordedAudio {
 constructor(clips,Context){this.clips=clips;this.Context=Context;this.context=null;this.decoded=new Map();this.active=new Set();this.enabled=true;this.generation=0;}
 stopAll(){this.generation++;for(const source of this.active){try{source.stop();}catch{}}this.active.clear();}
 setEnabled(value){this.enabled=value;if(!value)this.stopAll();}
 async play(kind,delay=0,options={}){
   if(!this.enabled)return false;
   const generation=this.generation;
   const bytes=this.clips[kind];if(!bytes)throw Error('Brak nagrania: '+kind);
   if(!this.context){this.context=new this.Context();}
   const ctx=this.context;
   // Resume synchronously inside the keyboard/click gesture, before decoding.
   const resumed=ctx.resume();
   if(!this.decoded.has(kind))this.decoded.set(kind,ctx.decodeAudioData(bytes.slice(0)));
   const buffer=await this.decoded.get(kind);await resumed;
   if(!this.enabled||generation!==this.generation)return false;
   const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;
   const rate=Math.max(.4,Math.min(2,options.rate||1));source.playbackRate.value=rate;
   source.connect(gain);gain.connect(ctx.destination);
   const offset=Math.max(0,Math.min(options.offset||0,buffer.duration-.01));
   const duration=Math.max(.01,Math.min(options.duration||buffer.duration,buffer.duration-offset));
   const playbackDuration=duration/rate;
   const start=ctx.currentTime+delay,volume=Math.max(0,Math.min(1,options.volume??(kind==='burp'?.8:.85)));
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.008);
   gain.gain.setValueAtTime(volume,start+Math.max(.008,playbackDuration-.018));gain.gain.linearRampToValueAtTime(0,start+playbackDuration);
   this.active.add(source);source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();};source.start(start,offset,duration);return true;
 }
}
export async function loadRecordings(fetcher=fetch){
 const entries=await Promise.all([['bleat','goat-bleat.mp3'],['burp','burp.mp3'],['chew','chew.mp3'],['growl','growl.mp3'],['fart','fart.mp3'],['death','death.mp3']].map(async([kind,file])=>{const response=await fetcher('./assets/'+file);if(!response.ok)throw Error('Nie udało się wczytać dźwięku '+file);return [kind,await response.arrayBuffer()];}));
 return Object.fromEntries(entries);
}
