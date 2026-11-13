import {createVolumeMotion} from './volume-motion.js';
import {softenFrameAlpha} from './frame-edge.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function createThoraxVolume(images,player){
 const motion=createVolumeMotion(),frames=[],blend=document.createElement('canvas'),b=blend.getContext('2d');
 let ready=false;
 function prepare(){
  const atlas=images.volumeSacs,cw=atlas.width/5,ch=atlas.height/3;
  for(let i=0;i<15;i++){
   const c=document.createElement('canvas');c.width=cw;c.height=ch;const ink=c.getContext('2d',{willReadFrequently:true});
   ink.drawImage(atlas,i%5*cw,Math.floor(i/5)*ch,cw,ch,0,0,cw,ch);
   const pixels=ink.getImageData(0,0,cw,ch);softenFrameAlpha(pixels.data,cw,ch);ink.putImageData(pixels,0,0);frames.push(c);
  }
  const raw=images.volumeShell,shell=document.createElement('canvas');shell.width=raw.width;shell.height=raw.height;
  const c=shell.getContext('2d',{willReadFrequently:true});c.drawImage(raw,0,0);
  const p=c.getImageData(0,0,shell.width,shell.height);softenFrameAlpha(p.data,shell.width,shell.height);
  for(let i=0;i<p.data.length;i+=4){p.data[i]*=.77;p.data[i+1]*=.76;p.data[i+2]*=.74;}
  c.putImageData(p,0,0);images.volumeShell=shell;
  const tendon=images.volumeTendon,t=document.createElement('canvas');t.width=tendon.width;t.height=tendon.height;
  const tc=t.getContext('2d',{willReadFrequently:true});tc.drawImage(tendon,0,0);const tp=tc.getImageData(0,0,t.width,t.height);
  for(let i=0;i<tp.data.length;i+=4){tp.data[i]*=.72;tp.data[i+1]*=.59;tp.data[i+2]*=.50;tp.data[i+3]=255;}
  tc.putImageData(tp,0,0);images.volumeTendon=t;
  blend.width=cw;blend.height=ch;ready=true;
 }
 function mixed(p){
  const f=clamp(p)*14,a=Math.floor(f),next=Math.min(14,a+1),t=f-a;
  b.clearRect(0,0,blend.width,blend.height);b.globalCompositeOperation='lighter';
  b.globalAlpha=1-t;b.drawImage(frames[a],0,0);b.globalAlpha=t;b.drawImage(frames[next],0,0);b.globalAlpha=1;
  return blend;
 }
 function geometry(r){const w=Math.min(r.w,r.h*1.6),h=w/1.6;return {x:r.x+(r.w-w)/2,y:r.y+(r.h-h)/2,w,h};}
 function draw(c,r,{dt,value,reduced,ambient,time,focused,dragging}){
  if(!ready)return;motion.advance(value,dt,reduced);
  const g=geometry(r),X=u=>g.x+u*g.w,Y=v=>g.y+v*g.h;
  // Darkness belongs to the recess, so the skeleton retains a crisp silhouette.
  c.save();c.translate(X(.59),Y(.65));c.scale(g.w*.49,g.h*.43);
  const shade=c.createRadialGradient(0,0,0,0,0,1);shade.addColorStop(0,'#090705e8');shade.addColorStop(.65,'#100b08a6');shade.addColorStop(1,'#100b0800');c.fillStyle=shade;c.fillRect(-1,-1,2,2);c.restore();
  // Continuous textured tendon: one fixed root, a lagging free end, no frame morph.
  const p=motion.curl,life=ambient&&!reduced?1:0,breath=Math.sin(time*.9)*.004*life;
  const root={x:X(.90),y:Y(.44)},a={x:X(.98),y:Y(.88)},d={x:X(.25+.52*p),y:Y(.80-.22*p+breath)};
  const z={x:X(.55+.29*p),y:Y(.98-.10*p)};
  const nodes=[];
  for(let i=0;i<=48;i++){
   const t=i/48,u=1-t;
   nodes.push({x:u*u*u*root.x+3*u*u*t*a.x+3*u*t*t*z.x+t*t*t*d.x,y:u*u*u*root.y+3*u*u*t*a.y+3*u*t*t*z.y+t*t*t*d.y+Math.sin(t*Math.PI)*motion.velocity*g.h*.009});
  }
  const ribbon=nodes.map((n,i)=>{
   const before=nodes[Math.max(0,i-1)],after=nodes[Math.min(48,i+1)],len=Math.hypot(after.x-before.x,after.y-before.y)||1;
   const radius=g.w*.045*(1+.13*p-.12*i/48);
   return {...n,nx:-(after.y-before.y)/len,ny:(after.x-before.x)/len,radius};
  });
  c.save();c.beginPath();
  ribbon.forEach((n,i)=>i?c.lineTo(n.x+n.nx*n.radius,n.y+n.ny*n.radius):c.moveTo(n.x+n.nx*n.radius,n.y+n.ny*n.radius));
  const tip=ribbon[48];c.arc(tip.x,tip.y,tip.radius,Math.atan2(tip.ny,tip.nx),Math.atan2(tip.ny,tip.nx)+Math.PI);
  for(let i=48;i>=0;i--){const n=ribbon[i];c.lineTo(n.x-n.nx*n.radius,n.y-n.ny*n.radius);}c.closePath();
  c.shadowColor='#000b';c.shadowBlur=4;c.shadowOffsetY=3;c.fillStyle='#684d3c';c.fill();c.clip();c.shadowBlur=0;c.shadowOffsetY=0;
  for(let i=0;i<48;i++){
   const n=nodes[i],q=nodes[i+1],len=Math.hypot(q.x-n.x,q.y-n.y),thick=g.w*.090*(1+.13*p-.12*i/48);
   c.save();c.translate(n.x,n.y);c.rotate(Math.atan2(q.y-n.y,q.x-n.x));
   c.drawImage(images.volumeTendon,i/48*images.volumeTendon.width,0,images.volumeTendon.width/48+1,images.volumeTendon.height,-1,-thick/2-2,len+3,thick+4);
   const light=c.createLinearGradient(0,-thick/2,0,thick/2);light.addColorStop(0,'#170a06cc');light.addColorStop(.24,'#eac1a94a');light.addColorStop(.50,'#fff0');light.addColorStop(1,'#160906dd');c.fillStyle=light;c.fillRect(-1,-thick/2-2,len+3,thick+4);c.restore();
  }
  // Rounded free end uses the same skin material, with no rectangular cutoff.
  c.save();c.beginPath();c.arc(tip.x,tip.y,tip.radius,0,Math.PI*2);c.clip();c.drawImage(images.volumeTendon,images.volumeTendon.width-30,0,30,images.volumeTendon.height,tip.x-tip.radius,tip.y-tip.radius,tip.radius*2,tip.radius*2);c.restore();
  c.restore();
  // Small and large chambers share fixed ports. Only the tissue responds quickly.
  const pulse=life?Math.sin(time*.9)*.003:0;
  c.save();c.beginPath();c.ellipse(X(.67),Y(.34),g.w*.31,g.h*.24,0,0,Math.PI*2);c.clip();
  c.drawImage(mixed(motion.sacs),X(.335),Y(.11-pulse),g.w*.61,g.h*(.46+pulse));c.restore();
  // Static hard anatomy always occludes membrane joins and moving tendon.
  c.drawImage(images.volumeShell,g.x,g.y,g.w,g.h);
  if(focused||dragging){c.save();c.globalAlpha=.13;c.strokeStyle='#e6b969';c.lineWidth=1;c.beginPath();c.ellipse(X(.65),Y(.35),g.w*.29,g.h*.20,0,Math.PI*1.04,Math.PI*1.93);c.stroke();c.restore();}
  player.dataset.thoraxVolume=String(Math.round(motion.sacs*100));player.dataset.thoraxCurl=motion.curl.toFixed(3);player.dataset.thoraxVolumeRig='fixed-shell';
 }
 return {prepare,draw,reset:v=>motion.reset(v),get active(){return motion.active}};
}
