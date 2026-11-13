const clamp=v=>Math.max(0,Math.min(1,v));
export function createVolumeMotion(){
 let sacs=0,curl=0,velocity=0;
 function reset(value){sacs=curl=clamp(value);velocity=0;}
 function advance(value,elapsed,reduced=false){
  value=clamp(value);if(reduced){reset(value);return;}
  const dt=Math.max(0,Math.min(.1,elapsed));sacs+=(value-sacs)*(1-Math.exp(-dt*28));
  const steps=Math.max(1,Math.ceil(dt*120)),step=dt/steps;
  for(let i=0;i<steps;i++){velocity+=(95*(sacs-curl)-15*velocity)*step;curl+=velocity*step;}
 }
 return {reset,advance,get sacs(){return sacs},get curl(){return clamp(curl)},get velocity(){return velocity},get active(){return Math.abs(curl-sacs)>.001||Math.abs(velocity)>.003}};
}
