import { createThoraxWorm } from './thorax-worm.js';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (v, target, dt, rate) => v + (target - v) * (1 - Math.exp(-dt * rate));

export function createThorax(player, media, seek, volume) {
  const button = player.querySelector('#play'), rail = player.querySelector('#timeline');
  const bellows = player.querySelector('#gills');
  let canvas = document.createElement('canvas');
  canvas.className = 'thorax-scene'; canvas.setAttribute('aria-hidden', 'true');
  player.prepend(canvas);
  const scene = document.createElement('canvas'), ink = scene.getContext('2d');
  const blend = document.createElement('canvas'), mixInk = blend.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const images = {};
  const worm = createThoraxWorm(images,player);
  let enabled = false, ambient = true, ready = false, loading = false, raf = 0, prior = 0;
  let gl, program, texture, fallback, width = 1, height = 1, dpr = 1;
  let valve = media.paused ? 1 : 0, inflation = Number(volume.value) / 100;
  let pressure = 0, contact = '', dragging = false, seekPointer = null, volumePointer = null;
  let startX = 0, startVolume = 0, respiration = 0;
  let ripple = 0, rippleOrigin = 0, focused = '';
  const rects = {};

  function measure() {
    const p = player.getBoundingClientRect(); width = p.width; height = p.height;
    dpr = Math.min(devicePixelRatio || 1, 1.65);
    for (const [key, node] of Object.entries({valve: button, rail, bellows, organs: player.querySelector('.organs')})) {
      const r = node.getBoundingClientRect(); rects[key] = {x:r.left-p.left,y:r.top-p.top,w:r.width,h:r.height};
    }
    for (const surface of [canvas, scene]) {
      const w = Math.max(1,Math.round(width*dpr)), h = Math.max(1,Math.round(height*dpr));
      if (surface.width !== w || surface.height !== h) { surface.width=w; surface.height=h; }
    }
    player.dataset.layout = width <= 560 ? 'folded' : 'extended';
  }

  function initialize() {
    gl = canvas.getContext('webgl', {alpha:true, antialias:false, premultipliedAlpha:false});
    if (!gl) throw Error('WebGL unavailable');
    function shader(type, text) {
      const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;
    }
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
      precision mediump float;
      uniform sampler2D painting;uniform vec2 pixel;uniform float time,life,pressure;
      uniform vec4 valve,lung;varying vec2 uv;
      float field(vec2 p,vec4 r){vec2 d=(p-r.xy)/max(r.zw,vec2(.001));return exp(-dot(d,d)*9.);}
      vec3 ember(vec2 p){vec4 c=texture2D(painting,p);float m=smoothstep(.25,.65,c.r)*smoothstep(.06,.32,c.r-c.b)*smoothstep(.015,.18,c.g-c.b);return c.rgb*m*c.a;}
      void main(){
        vec2 p=uv;float v=field(p,valve),l=field(p,lung);
        // The frame is pinned; pressure is confined to soft anatomical regions.
        p+=(p-valve.xy)*v*pressure*.012;
        p+=(p-lung.xy)*l*sin(time*.9)*life*.004;
        vec4 c=texture2D(painting,p);vec3 bloom=vec3(0.);
        for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 d=vec2(cos(a),sin(a));bloom+=ember(p+d*pixel*5.)*.09+ember(p+d*pixel*12.)*.035;}
        float pulse=1.+life*.07*sin(time*.9);vec3 warm=bloom*pulse;
        gl_FragColor=vec4(c.rgb+warm,clamp(c.a+max(warm.r,max(warm.g,warm.b))*.30,0.,1.));
      }`));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.uniform1i(gl.getUniformLocation(program,'painting'),0);player.dataset.thoraxRenderer='webgl';
  }
  function useFallback() {
    const next=canvas.cloneNode();canvas.replaceWith(next);canvas=next;
    gl=null;fallback=canvas.getContext('2d');player.dataset.thoraxRenderer='canvas';
    canvas.addEventListener('webglcontextlost',lost);
  }
  function lost(event){event.preventDefault();useFallback();measure();schedule();}

  function glow(x,y,rx,ry,amount) {
    ink.save();ink.translate(x,y);ink.scale(rx,ry);ink.globalCompositeOperation='screen';ink.globalAlpha=amount;
    const g=ink.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'#ffd38a');g.addColorStop(.3,'#d68a38');g.addColorStop(1,'#6a310000');
    ink.fillStyle=g;ink.fillRect(-1,-1,2,2);ink.restore();
  }
  function nineSlice() {
    const compact=width<=560, im=compact?images.compact:images.body;
    const side=compact?125:180;
    const sx=[0,side,im.width-side,im.width], sy=compact?[0,140,730,im.height]:[0,130,600,im.height];
    const o=rects.organs, dx=[0,width*.105,width*.895,width],dy=[0,Math.min(78,width*.095),o.y+o.h*.04+(ambient&&!reduced.matches?Math.sin(respiration)*1.6:0),height];
    for(let y=0;y<3;y++)for(let x=0;x<3;x++){
      ink.drawImage(im,sx[x],sy[y],sx[x+1]-sx[x],sy[y+1]-sy[y],dx[x],dy[y],dx[x+1]-dx[x],dy[y+1]-dy[y]);
    }
  }
  function tendon(a,b,bend,thickness) {
    const mx=(a[0]+b[0])/2;
    ink.save();ink.lineCap='round';
    for(const [color,size] of [['#37271966',thickness+1],['#b99b6844',Math.max(.5,thickness*.25)]]){
      ink.strokeStyle=color;ink.lineWidth=size;ink.beginPath();ink.moveTo(...a);ink.bezierCurveTo(mx,a[1]+bend,mx,b[1]+bend,...b);ink.stroke();
    }ink.restore();
  }
  function sprite(name,frame,cols,rows,x,y,w,h,alpha=1) {
    const im=images[name],cw=im.width/cols,ch=im.height/rows;
    const f=clamp(frame,0,cols*rows-1),first=Math.floor(f),next=Math.min(first+1,cols*rows-1),mix=f-first;
    if(mix<.001){
      ink.save();ink.globalAlpha=alpha;ink.drawImage(im,first%cols*cw,Math.floor(first/cols)*ch,cw,ch,x,y,w,h);ink.restore();return;
    }
    // Add premultiplied weights on a transparent surface, then composite once.
    // Drawing two half-opacity sprites directly would dim their shared pixels.
    if(blend.width!==Math.round(cw)||blend.height!==Math.round(ch)){blend.width=Math.round(cw);blend.height=Math.round(ch);}
    mixInk.clearRect(0,0,blend.width,blend.height);mixInk.globalCompositeOperation='lighter';
    mixInk.globalAlpha=1-mix;mixInk.drawImage(im,first%cols*cw,Math.floor(first/cols)*ch,cw,ch,0,0,cw,ch);
    mixInk.globalAlpha=mix;mixInk.drawImage(im,next%cols*cw,Math.floor(next/cols)*ch,cw,ch,0,0,cw,ch);
    ink.save();ink.globalAlpha=alpha;ink.drawImage(blend,x,y,w,h);ink.restore();
  }
  function organ(name,pose,rect) {
    const cols=name==='valve'?6:5,rows=name==='valve'?5:3,count=cols*rows;
    const aspect=(images[name].width/cols)/(images[name].height/rows);
    let w=rect.w,h=w/aspect;if(h>rect.h*1.15){h=rect.h*1.15;w=h*aspect;}
    const breath=ambient&&!reduced.matches?Math.sin(respiration+(name==='valve'?0:.55))*.012:0;
    const squeeze=contact===name?pressure*.045:0;
    w*=1+breath+squeeze;h*=1+breath-squeeze;
    const x=rect.x+(rect.w-w)/2,y=rect.y+(rect.h-h)/2;
    glow(rect.x+rect.w*.48,rect.y+rect.h*.63,w*.65,h*.60,name==='valve'?.08:.10+inflation*.05);
    ink.save();ink.shadowColor='#000b';ink.shadowBlur=6;ink.shadowOffsetY=3;
    sprite(name,pose*(count-1),cols,rows,x,y,w,h);ink.restore();
    if(focused===name)glow(rect.x+rect.w/2,rect.y+rect.h/2,w*.60,h*.60,.18);
  }
  function present(now,life) {
    if(gl){
      gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,scene);
      gl.uniform2f(gl.getUniformLocation(program,'pixel'),1/canvas.width,1/canvas.height);
      for(const key of ['valve','lung']){
        const r=rects[key==='lung'?'bellows':'valve'];
        gl.uniform4f(gl.getUniformLocation(program,key),(r.x+r.w/2)/width,1-(r.y+r.h/2)/height,r.w/width,r.h/height);
      }
      gl.uniform1f(gl.getUniformLocation(program,'time'),now/1000);gl.uniform1f(gl.getUniformLocation(program,'life'),life);
      gl.uniform1f(gl.getUniformLocation(program,'pressure'),pressure);gl.drawArrays(gl.TRIANGLES,0,6);
    }else{fallback.clearRect(0,0,canvas.width,canvas.height);fallback.drawImage(scene,0,0);}
  }
  function liveMotion(){return ambient&&!reduced.matches;}
  function render(now) {
    raf=0;if(!enabled||document.hidden||!ready)return;
    if(prior&&now-prior<32){schedule();return;}
    const elapsed=(now-(prior||now))/1000;
    const dt=Math.min(.05,elapsed),life=ambient&&!reduced.matches?1:0;
    const valveTarget=media.paused||media.ended?1:0;
    const valveStep=Math.min(elapsed,.25)/1.0; // 30 authored poses over one second, reversible in place
    valve=reduced.matches?valveTarget:valve+Math.sign(valveTarget-valve)*Math.min(Math.abs(valveTarget-valve),valveStep);
    inflation=reduced.matches?Number(volume.value)/100:ease(inflation,Number(volume.value)/100,dt,14);
    pressure=ease(pressure,dragging||contact?1:0,dt,14);
    respiration+=dt*.9*life;
    ripple=Math.max(0,ripple-dt*1.4);
    ink.setTransform(dpr,0,0,dpr,0,0);ink.clearRect(0,0,width,height);
    nineSlice();
    const v=rects.valve,l=rects.bellows,r=rects.rail,folded=width<=560;
    const breath=Math.sin(respiration)*life;
    tendon([v.x+v.w*.7,v.y+v.h*.52],[r.x+14,r.y+r.h*.5],folded?28:breath*2,folded?1.3:1.8);
    tendon([r.x+r.w-12,r.y+r.h*.50],[l.x+l.w*.25,l.y+l.h*.5],folded?-20:breath*-2,folded?1.3:1.8);
    worm.draw(ink,r,{progress:Number(seek.value)/1000,dt:Math.min(elapsed,.1),time:now/1000,dragging:seekPointer!==null,ambient:liveMotion(),reduced:reduced.matches,focused:focused==='rail'});organ('bellows',inflation,l);organ('valve',valve,v);
    if(ripple>0)glow(rippleOrigin,rects.organs.y+rects.organs.h*.5,35+(1-ripple)*100,35,ripple*.07);
    present(now,life);player.classList.add('thorax-ready');prior=now;
    player.dataset.thoraxPose=String(Math.round(valve*29));player.dataset.thoraxValve='iris-30';player.dataset.thoraxVolume=String(Math.round(inflation*100));
    if(life||worm.active||Math.abs(valve-(media.paused?1:0))>.001||Math.abs(inflation-Number(volume.value)/100)>.001||pressure>.001||ripple>0)schedule();
  }
  function schedule(){if(!raf&&enabled&&ready&&!document.hidden)raf=requestAnimationFrame(render);}
  function touched(name){contact=name;ripple=1;rippleOrigin=rects[name]?.x+rects[name]?.w/2||width/2;schedule();}
  button.addEventListener('pointerdown',()=>{if(enabled)touched('valve');});
  for(const [node,name] of [[button,'valve'],[seek,'rail'],[volume,'bellows']]){
    node.addEventListener('focus',()=>{if(enabled){focused=name;schedule();}});
    node.addEventListener('blur',()=>{focused='';schedule();});
  }
  function scrub(event){
    const r=rects.rail,m=worm.metrics(r);
    const left=player.getBoundingClientRect().left;
    seek.value=String(Math.round(clamp((event.clientX-left-m.start)/m.travel)*1000));
    seek.dispatchEvent(new Event('input',{bubbles:true}));schedule();
  }
  seek.addEventListener('pointerdown',e=>{
    if(!enabled||e.button!==0)return;e.preventDefault();seek.focus();seekPointer=e.pointerId;dragging=true;touched('rail');seek.setPointerCapture(e.pointerId);scrub(e);
  });
  seek.addEventListener('pointermove',e=>{if(enabled&&e.pointerId===seekPointer){e.preventDefault();scrub(e);}});
  volume.addEventListener('pointerdown',e=>{
    if(!enabled||e.button!==0)return;e.preventDefault();volume.focus();volumePointer=e.pointerId;dragging=true;startX=e.clientX;startVolume=Number(volume.value)/100;touched('bellows');volume.setPointerCapture(e.pointerId);
  });
  volume.addEventListener('pointermove',e=>{
    if(!enabled||e.pointerId!==volumePointer)return;e.preventDefault();
    volume.value=String(Math.round(clamp(startVolume+(startX-e.clientX)/Math.max(65,rects.bellows.w*.65))*100));
    volume.dispatchEvent(new Event('input',{bubbles:true}));schedule();
  });
  volume.addEventListener('keydown',e=>{
    if(!enabled)return;let v=Number(volume.value);
    if(e.key==='ArrowLeft'||e.key==='ArrowUp')v+=5;else if(e.key==='ArrowRight'||e.key==='ArrowDown')v-=5;
    else if(e.key==='Home')v=0;else if(e.key==='End')v=100;else return;
    e.preventDefault();e.stopPropagation();volume.value=String(clamp(v,0,100));volume.dispatchEvent(new Event('input',{bubbles:true}));schedule();
  });
  function release(){seekPointer=volumePointer=null;dragging=false;contact='';schedule();}
  for(const e of ['pointerup','pointercancel','blur'])window.addEventListener(e,release);
  for(const node of [seek,volume]){
    node.addEventListener('lostpointercapture',release);node.addEventListener('input',schedule);
    node.addEventListener('keydown',e=>{if(enabled&&(e.key.startsWith('Arrow')||['Home','End',' '].includes(e.key)))e.stopPropagation();});
  }
  for(const e of ['play','pause','ended','timeupdate','seeked','audiolevelchange','volumechange'])media.addEventListener(e,schedule);
  document.addEventListener('visibilitychange',()=>{prior=0;schedule();});
  reduced.addEventListener('change',schedule);
  new ResizeObserver(()=>{if(enabled){prior=0;measure();schedule();}}).observe(player);
  function prepareValveMatte(){
    const atlas=images.valve,matte=document.createElement('canvas');
    matte.width=atlas.width;matte.height=atlas.height;
    const c=matte.getContext('2d');c.drawImage(atlas,0,0);
    const pixels=c.getImageData(0,0,matte.width,matte.height),data=pixels.data;
    const cw=matte.width/6,ch=matte.height/5;
    for(let y=0;y<matte.height;y++)for(let x=0;x<matte.width;x++){
      const u=(x%cw)/cw,v=(y%ch)/ch;
      const radius=Math.hypot((u-.50)/.50,(v-.47)/.43);
      if(radius<.86)continue;
      const i=(y*matte.width+x)*4;
      const key=clamp((Math.max(data[i],data[i+1],data[i+2])-8)/30);
      const edge=clamp((radius-.86)/.14);
      data[i+3]=Math.round(255*(1-edge+edge*key));
    }
    c.putImageData(pixels,0,0);images.valve=matte;
  }
  function load(){
  if(loading)return;loading=true;
  Promise.all(['body','compact','valve','bellows','channel','wormSkin','wormHead','wormCage'].map(name=>new Promise((resolve,reject)=>{
    const im=images[name]=new Image();im.onload=resolve;im.onerror=reject;
    const paths={wormSkin:'worm-skin',wormHead:'worm-head',wormCage:'worm-cage'};
    im.src=paths[name]?'./tissue/thorax-'+paths[name]+(name==='wormHead'?'-v2.webp':'-v1.webp'):name==='valve'?'./tissue/thorax-iris-v3.webp':'./tissue/thorax-'+name+'-v2.webp';
  }))).then(()=>{
    prepareValveMatte();worm.prepare();
    try{initialize();}catch(error){player.dataset.thoraxRenderError=error.message;useFallback();}
    canvas.addEventListener('webglcontextlost',lost);ready=true;measure();schedule();
  }).catch(()=>{player.dataset.thoraxRenderError='Artwork could not load';});
  }
  return {
    select(active){enabled=active;player.classList.toggle('thoracic',active);canvas.hidden=!active;release();
      if(active){load();volume.dir='rtl';volume.title='Push the bone left to inflate · louder';valve=media.paused?1:0;inflation=Number(volume.value)/100;worm.reset(Number(seek.value)/1000);prior=0;measure();schedule();}
    },
    motion(active){ambient=active;schedule();}
  };
}
