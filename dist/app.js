import { createThorax } from './thorax.js';
import { createMediaAudio } from './media-audio.js';
import { createMawVolume } from './maw-volume.js';
import { createMawScrubber } from './maw-scrubber.js';
import { createMawButton } from './maw-button.js';
const $ = s => document.querySelector(s);
const media = $('#media'), seek = $('#timeline input'), volume = $('#gills input');
const audio = createMediaAudio(media, { onError: () => { $('#notice').textContent = 'Tap play or the volume control to resume audio.'; } });
const mawButton = createMawButton($('#play'), media);
const mawScrubber = createMawScrubber($('#timeline'), seek, media);
const mawVolume = createMawVolume($('#gills'), volume, media);
const thorax = createThorax($('#player'),media,seek,volume);
const specimens = [
 {id:'thorax',accent:'#f3bd70',ink:'#423524',cycle:5.8,title:'Costal reflex',note:'Press the living iris: its membrane petals close for pause and open to reveal play. Draw the amber larva through the tendon channel; the membrane parts around it. Push the bone left to inflate the bellows. Every organ shares the same breath.'},
 {id:'leech',accent:'#82e6df',ink:'#233c37',cycle:4.7,title:'Branchial reflex',note:'Pull the tendril to spread the gills. The eel follows your drag through a fluid channel, trailing cold light.'},
 {id:'chrysalis',accent:'#e7cc97',ink:'#493d49',cycle:7.2,title:'Pupal membrane',note:'Roll the luminous egg along the centipede. Its legs ripple in sequence as silk stretches around the volume antenna.'},
 {id:'maw',accent:'#fa978b',ink:'#442829',cycle:3.9,title:'Mandibular groove',note:'Draw the grub between the lips. The groove opens around its shell and contracts behind it. Press the paired cushions to pause. Push the bone left to inflate the sacs and increase volume.'}
];
const images = {};
const titleCase = s => s[0].toUpperCase()+s.slice(1);
const number = i => String(i+1).padStart(2,'0');
for (const [i,s] of specimens.entries()) {
 images[s.id]={};
 for (const part of ['track','thumb','volume']) {
  const img=new Image(); img.src='tissue/'+s.id+'-'+part+'.webp'; images[s.id][part]=img;
 }
 const button=document.createElement('button'); button.className='item'; button.dataset.id=s.id;
 button.innerHTML='<img alt="" src="tissue/'+s.id+'-volume.webp"><span><small>SPECIMEN '+number(i)+'</small><b>'+titleCase(s.id)+'</b></span><span class="dot"></span>';
 button.onclick=()=>select(s); $('#list').append(button);
}
let skin, live=!matchMedia('(prefers-reduced-motion: reduce)').matches, pressure=0, dragging=false, lastX=0, velocity=0;
function select(s){
 skin=s; $('#player').classList.toggle('organism',s.id==='maw'); mawButton.select(s.id === 'maw'); mawScrubber.select(s.id === 'maw');mawVolume.select(s.id === 'maw');thorax.select(s.id === 'thorax'); const body=document.body.style;
 body.setProperty('--accent',s.accent); body.setProperty('--ink',s.ink);body.setProperty('--cycle',s.cycle+'s');
 for(const part of ['dock','pause','frame']) body.setProperty('--'+part,'url(tissue/'+s.id+'-'+part+'.webp)');
 $('#cover').src='tissue/'+s.id+'-poster.webp'; $('#name').textContent=titleCase(s.id);
 $('#noteTitle').textContent=s.title;$('#desc').textContent=s.note;$('#species').textContent='SPECIMEN '+number(specimens.indexOf(s))+' / 04';
 for(const b of document.querySelectorAll('.item')){const on=b.dataset.id===s.id;b.setAttribute('aria-pressed',on);b.querySelector('.dot').textContent=on?'●':''}
 $('#mute').textContent=['maw','thorax'].includes(s.id)?(audio.muted?'×':'·'):(audio.muted?'×':'◖))');
 history.replaceState(null,'','#'+s.id);
}
select(specimens.find(s=>s.id===location.hash.slice(1))||specimens[3]);
function motion(){mawButton.motion(live);mawScrubber.motion(live);mawVolume.motion(live);thorax.motion(live);document.body.classList.toggle('live',live);$('#motion').setAttribute('aria-pressed',live);$('#motion').textContent='◌  Ambient motion '+(live?'on':'off')}
motion();$('#motion').onclick=()=>{live=!live;motion()};
function stamp(v){return Math.floor(v/60)+':'+String(Math.floor(v%60)).padStart(2,'0')}
function sync(){
 const duration=Number.isFinite(media.duration)?media.duration:0;
 seek.value=duration?1000*media.currentTime/duration:0;seek.setAttribute('aria-valuetext',stamp(media.currentTime)+' of '+stamp(duration));
 $('#clock').textContent=stamp(media.currentTime)+' / '+(duration?stamp(duration):'–:––');
 $('#mode').textContent=media.ended?'ENDED':media.paused?'AT REST':'PLAYING';
 $('#play').setAttribute('aria-label',media.paused?'Play':'Pause');$('#symbol').textContent=media.paused?'▶︎':'Ⅱ';
 volume.value=Math.round(audio.value*100);volume.setAttribute('aria-valuetext',volume.value+' percent');
 $('#mute').textContent=['maw','thorax'].includes(skin.id)?(audio.muted?'×':'·'):(audio.muted?'×':'◖))');$('#mute').setAttribute('aria-label',audio.muted?'Unmute':'Mute');
}
async function toggle(){if(!media.paused){media.pause();return}try{audio.unlock();await media.play()}catch{$('#notice').textContent='Playback could not start. Press play to retry.'}}
$('#play').onclick=toggle;$('.window').onclick=e=>{if(!e.target.closest('button'))toggle()};
for(const e of ['timeupdate','loadedmetadata','play','pause','volumechange','audiolevelchange','ended','seeked'])media.addEventListener(e,sync);
media.addEventListener('playing',()=>{$('#player').classList.add('started');$('#notice').textContent=''});
media.addEventListener('error',()=>{if(!media.src.includes('zencdn')){media.src='https://vjs.zencdn.net/v/oceans.mp4'}else{$('#notice').textContent='The demo video could not load.'}});
seek.oninput=()=>{if(Number.isFinite(media.duration)) media.currentTime=media.duration*seek.value/1000};
volume.oninput=()=>{audio.set(Number(volume.value)/100);sync()};
volume.addEventListener('pointerdown',audio.unlock);
volume.addEventListener('keydown',audio.unlock);
$('#mute').onclick=()=>{audio.toggleMute();sync()};
$('#expand').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('#player').requestFullscreen)await $('#player').requestFullscreen();else media.webkitEnterFullscreen()}catch{$('#notice').textContent='Fullscreen is unavailable in this browser.'}};
document.addEventListener('fullscreenchange',()=>$('#expand').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'));
for(const control of [seek,volume]){control.onpointerdown=e=>{dragging=true;lastX=e.clientX};control.onpointermove=e=>{if(dragging){velocity=Math.max(-1,Math.min(1,(e.clientX-lastX)/12));lastX=e.clientX}}}
for(const e of ['pointerup','pointercancel','blur'])window.addEventListener(e,()=>dragging=false);
sync();

const surfaces=['#timeline canvas:not(.maw-rail)','#gills canvas:not(.maw-bellows)'].map(sel=>{const canvas=$(sel);return {canvas,ctx:canvas.getContext('2d'),width:0,height:0}});
const resize=new ResizeObserver(entries=>{for(const entry of entries){const s=surfaces.find(o=>o.canvas===entry.target);s.width=entry.contentRect.width;s.height=entry.contentRect.height;const ratio=Math.min(devicePixelRatio||1,2);s.canvas.width=Math.round(s.width*ratio);s.canvas.height=Math.round(s.height*ratio);s.ctx.setTransform(ratio,0,0,ratio,0,0)}});
for(const s of surfaces) resize.observe(s.canvas);
function tissue(c,img,x,y,rx,ry,angle=0){
 if(!img.complete||!img.naturalWidth||rx<=0||ry<=0)return;
 c.save();c.translate(x,y);c.rotate(angle);c.beginPath();c.ellipse(0,0,rx,ry,0,0,2*Math.PI);c.clip();c.drawImage(img,-rx,-ry,rx*2,ry*2);c.restore();
}
function glow(c,x,y,r,amount){
 if(r<=0)return;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,skin.accent);g.addColorStop(1,skin.accent+'00');c.save();c.globalCompositeOperation='screen';c.globalAlpha=amount;c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.restore()
}
function drawSeek({ctx:c,width:w,height:h},t,b){
 if(skin.id==='maw' && $('#timeline').classList.contains('maw-rail-ready'))return;
 if(skin.id==='thorax')return;
 const a=images[skin.id],p=Number(seek.value)/1000, thumb=Math.min(24,w*.095), x=thumb+(w-2*thumb)*p;
 const y=u=>h*(.52+.055*Math.sin(u*7+t)*(.6+pressure));const size=Math.max(8,Math.min(17,h*.21));const step=Math.max(8,size*1.05);
 for(let j=0;j<w+step;j+=step){
  const u=j/w, near=Math.exp(-Math.abs(j-x)/33),wave=Math.sin(t*1.4-u*11), k=skin.id;
  if(k==='maw'){for(const side of [-1,1])tissue(c,a.track,j,y(u)+side*(5+near*(6+3*pressure)),step*1.35,size*.59,side*.1)}
  else{tissue(c,a.track,j,y(u),step*(k==='thorax'?.83:1.3),size*(.93+.09*wave),.12*wave);
   if(k==='chrysalis'){c.strokeStyle='#cfbac2';c.lineWidth=1.5;c.beginPath();c.moveTo(j+4,y(u)+size*.55);c.quadraticCurveTo(j+8,y(u)+size,j-2+4*wave,y(u)+size*1.45);c.stroke()}}
 }
 c.save();c.strokeStyle=skin.accent;c.shadowColor=skin.accent;c.shadowBlur=7;c.lineWidth=2;c.beginPath();c.moveTo(0,y(0));for(let j=0;j<x;j+=3)c.lineTo(j,y(j/w));c.stroke();c.restore();
 const float=live?Math.sin(t*2)*1.3:0;
 if(skin.id==='leech'||skin.id==='thorax'){for(let j=8;j>0;j--){let dx=x-j*thumb*.22;tissue(c,a.thumb,dx,y(dx/w)+Math.sin(t*2-j*.6)*(1.7+3*pressure),thumb*(.44-j*.025),size*(.63-j*.055))}}
 tissue(c,a.thumb,x,y(x/w)+float,thumb*(skin.id==='chrysalis'?.73:1),size*(1+.08*b),.08*Math.sin(t)+velocity*.13);
 glow(c,x,y(x/w),thumb*1.35,.14+b*.08+pressure*.07)
}
function drawVolume({ctx:c,width:w,height:h},t,b){
 if(skin.id==='maw' && $('#gills').classList.contains('maw-bellows-ready'))return;
 if(skin.id==='thorax')return;
 const a=images[skin.id],v=Number(volume.value)/100,n=skin.id==='thorax'?5:8, gap=w/(n+1),mid=h*.53;
 for(let i=0;i<n;i++){const pos=(i+1)/(n+1),opened=Math.max(0,Math.min(1,(v-pos)*n+1)),breath=Math.sin(t*1.2-i*.48);
  const x=(i+1)*gap,y=mid+3*breath;
  tissue(c,a.volume,x,y,gap*(.63+.13*opened),h*(.18+.14*opened+.018*breath),skin.id==='leech'?.22+.32*opened:breath*.14);
  glow(c,x,y,gap*1.3,(.06+.18*opened)*(1+.15*b))
 }
 const limbX=7+v*(w-14);
 c.strokeStyle='#070908';c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(w-2,mid+h*.25);c.bezierCurveTo(w*.78,mid+h*(.35+.04*b),limbX+9,mid-8,limbX,mid);c.stroke();c.strokeStyle=skin.accent+'99';c.lineWidth=2;c.stroke();
 tissue(c,a.thumb,limbX,mid,Math.max(6,gap*.76),h*.1,.27);
}
let prior=0;
function frame(now){requestAnimationFrame(frame);if(document.hidden||now-prior<31)return;prior=now;const t=live?now/1000*(Math.PI*2/skin.cycle):0,b=Math.sin(t);pressure+=(Number(dragging)-pressure)*.23;velocity*=.84;
 for(const [i,s] of surfaces.entries()){if(!s.width||!s.height)continue;s.ctx.clearRect(0,0,s.width,s.height);(i?drawVolume:drawSeek)(s,t,b)}
}requestAnimationFrame(frame);
