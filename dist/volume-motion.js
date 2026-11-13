const clamp=v=>Math.max(0,Math.min(1,v));
export function createVolumeMotion(){
 let sacs=0,target=0;
 function reset(value){sacs=target=clamp(value);}
 function advance(value,elapsed,reduced=false){
  target=clamp(value);if(reduced){reset(target);return;}
  const dt=Math.max(0,Math.min(.1,elapsed));sacs+=(target-sacs)*(1-Math.exp(-dt*28));
 }
 return {reset,advance,get sacs(){return sacs},get active(){return Math.abs(sacs-target)>.001}};
}
