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
  const life=ambient&&!reduced?1:0;
  // Small and large chambers share fixed ports. Only the tissue responds quickly.
  const pulse=life?Math.sin(time*.9)*.003:0;
  c.save();c.beginPath();c.ellipse(X(.67),Y(.34),g.w*.31,g.h*.24,0,0,Math.PI*2);c.clip();
  c.drawImage(mixed(motion.sacs),X(.335),Y(.11-pulse),g.w*.61,g.h*(.46+pulse));c.restore();
  // Static hard anatomy always occludes the membrane joins.
  c.drawImage(images.volumeShell,g.x,g.y,g.w,g.h);
  if(focused||dragging){c.save();c.globalAlpha=.13;c.strokeStyle='#e6b969';c.lineWidth=1;c.beginPath();c.ellipse(X(.65),Y(.35),g.w*.29,g.h*.20,0,Math.PI*1.04,Math.PI*1.93);c.stroke();c.restore();}
  player.dataset.thoraxVolume=String(Math.round(motion.sacs*100));delete player.dataset.thoraxCurl;player.dataset.thoraxVolumeRig='fixed-shell';
 }
 return {prepare,draw,reset:v=>motion.reset(v),get active(){return motion.active}};
}
