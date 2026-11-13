export const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
export function wormMetrics(rect) {
  const headWidth=clamp(rect.w*.17,42,66);
  const socket=rect.x+rect.w*.065;
  const start=socket+headWidth*.35;
  const end=Math.max(start+1,rect.x+rect.w*.90);
  return {headWidth,socket,start,end,travel:end-start,diameter:clamp(rect.w*.055,15,25)};
}
// Coordinates are distance BACK FROM THE HEAD, not a normalized visible body.
// Material enters through the socket instead of being stretched to fill the rail.
export function wormTextureU(joinX,x,materialLength) {
  return clamp(1-(joinX-x)/Math.max(1,materialLength));
}
export function createWormMotion(count=40) {
  let progress=0,initialized=false,velocity=0,tension=0,clock=0,pulseAge=10,pulsePower=0,wasDragging=false;
  const offset=new Float64Array(count),speed=new Float64Array(count),radius=new Float64Array(count).fill(1),radialSpeed=new Float64Array(count);
  function reset(p) {progress=clamp(p);velocity=tension=0;offset.fill(0);speed.fill(0);radius.fill(1);radialSpeed.fill(0);pulseAge=10;initialized=true;wasDragging=false;}
  function advance(p,elapsed,{dragging=false,ambient=true,reduced=false}={}) {
    p=clamp(p);if(!initialized)reset(p);
    const dt=clamp(elapsed,0,.1),difference=p-progress;
    // Discrete jumps (Home/End, a programmatic seek) must not fling the anatomy.
    if(reduced||Math.abs(difference)>.32){reset(p);return;}
    const raw=dt>0?clamp(difference/dt,-3,3):0;
    velocity+=(raw-velocity)*(1-Math.exp(-dt*12));
    tension+=(clamp(velocity*1.1,-.8,.8)-tension)*(1-Math.exp(-dt*15));
    if(wasDragging&&!dragging){pulseAge=0;pulsePower=Math.min(.8,Math.abs(tension)+.22);}
    wasDragging=dragging;progress=p;pulseAge+=dt;
    clock+=dt*(ambient||dragging?1:0);
    const steps=Math.max(1,Math.ceil(dt*120)),step=dt/steps;
    for(let pass=0;pass<steps;pass++)for(let i=count-1;i>=0;i--){
      const q=i/(count-1),neck=Math.exp(-q*6);
      const wave=ambient||dragging?Math.sin(clock*(dragging?8:1.7)-q*13)*(.12+(dragging?.55:0)):0;
      const recoil=Math.exp(-Math.pow((q-pulseAge*.8)/.14,2))*pulsePower*Math.exp(-pulseAge*2);
      const targetY=(wave+recoil*.8)*Math.sin(Math.PI*q)*.9;
      const coupled=i>0?offset[i-1]*.13:0;
      speed[i]+=(125*(targetY+coupled-offset[i])-21*speed[i])*step;
      offset[i]+=speed[i]*step;
      const wrinkle=.024*Math.sin(q*58-clock*2)*(ambient||dragging?1:0);
      const targetRadius=clamp(1-tension*.30*neck+recoil*.20+wrinkle,.68,1.30);
      radialSpeed[i]+=(150*(targetRadius-radius[i])-23*radialSpeed[i])*step;
      radius[i]=clamp(radius[i]+radialSpeed[i]*step,.6,1.4);
    }
    offset[0]=speed[0]=0; // neck stays attached to the precisely positioned head
  }
  function sample(q) {
    const n=clamp(q)*(count-1),a=Math.floor(n),b=Math.min(count-1,a+1),f=n-a;
    return {offset:offset[a]*(1-f)+offset[b]*f,radius:radius[a]*(1-f)+radius[b]*f};
  }
  return {advance,reset,sample,get progress(){return progress},get tension(){return tension},get velocity(){return velocity},get clock(){return clock},get active(){return Math.abs(tension)>.002||pulseAge<2.5||speed.some(v=>Math.abs(v)>.005)}};
}
