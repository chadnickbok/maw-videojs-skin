const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function createMawScrubber(rail, input, media) {
  // Each x coordinate samples a unique part of the continuous painting.
  const canvas = document.createElement('canvas');
  canvas.className = 'maw-rail';
  canvas.setAttribute('aria-hidden', 'true');
  rail.prepend(canvas);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const assets = {};
  let enabled = false, ambient = true, ready = false;
  let width = 1, height = 1, progress = 0, previousX = 0;
  let grabbing = false, pointerId = null, speed = 0, direction = 1;
  let wakeX = 0, wakeStrength = 0, clock = 0, prior = 0, request = 0;
  let context, gl, program, buffer, renderer;
  const columns = 100, rows = 14;

  function metrics() {
    const grubWidth = clamp(width * .17, 46, 76);
    const margin = Math.min(grubWidth * .58, width * .24);
    return {grubWidth, margin, travel: Math.max(1, width - margin * 2)};
  }

  function position() { const m = metrics(); return m.margin + m.travel * progress; }
  function sourceU(u) {
    // Use the continuous middle of the painting. The end sockets are now
    // supplied by the shared body, so separate bulbous ends would double up.
    return .13 + u * .74;
  }

  function deform(u, v, lower) {
    const x = u * width, grub = position();
    const radius = metrics().grubWidth * .50;
    const distance = x - grub;
    const local = Math.exp(-Math.pow(distance / radius, 2));
    const trail = Math.exp(-Math.pow((x-wakeX) / (radius*1.35), 2)) * wakeStrength;
    const middle = Math.exp(-Math.pow((v-.515)/.17, 2));
    const pinned = Math.sin(Math.PI*u);
    const breath = ambient && !reduced.matches ? Math.sin(clock*.75+u*5)*.6 : 0;
    const opening = (8 + Math.min(Math.abs(speed)*.014, 5)) * local + trail*4;
    const bunch = Math.exp(-Math.pow((distance-direction*radius*.8)/(radius*.4),2));
    const shiftX = reduced.matches ? 0 : direction * (bunch*2.5-local*1.3) * Math.min(Math.abs(speed)/200,1);
    return [x+shiftX*middle*pinned,
      v*height + (lower?1:-1)*opening*middle*pinned + breath*middle*pinned];
  }

  const vertex = `
    attribute vec2 position;
    attribute vec2 texcoord;
    uniform vec2 resolution;
    varying vec2 uv;
    varying vec2 point;
    void main(){
      uv=texcoord; point=position;
      gl_Position=vec4(position/resolution*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);
    }`;
  const fragment = `
    precision mediump float;
    uniform sampler2D painting;
    uniform float layer, grubX, grubSize, elapsed, time, motion;
    varying vec2 uv;
    varying vec2 point;
    void main(){
      if(layer<.5 && uv.y>.515) discard;
      if(layer>1.5 && uv.y<.49) discard;
      vec4 c=texture2D(painting,uv);
      if(layer<.5 || layer>1.5){
        float contact=exp(-pow((point.x-grubX)/(grubSize*.50),2.));
        float seam=exp(-pow((uv.y-.515)/.045,2.));
        c.rgb*=1.-.30*contact*seam;
        float passed=1.-smoothstep(grubX-3.,grubX+1.,point.x);
        c.rgb+=vec3(.22,.018,.008)*seam*passed*(.9+.1*sin(time))*c.a;
        float wet=pow(max(0.,sin(uv.x*7.+time*.18)),12.)*motion;
        c.rgb+=vec3(.04,.02,.018)*wet*c.a;
      }
      gl_FragColor=c;
    }`;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function initialize() {
    gl = canvas.getContext('webgl', {alpha:true, antialias:true, premultipliedAlpha:false});
    if (!gl) throw Error('WebGL unavailable');
    program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for (const [name,offset] of [['position',0],['texcoord',8]]) {
      const location=gl.getAttribLocation(program,name);
      gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,16,offset);
    }
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    for (const asset of Object.values(assets)) {
      asset.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,asset.texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,asset.image);
    }
    renderer='webgl';
  }
  function fallback() {
    const replacement=canvas.cloneNode();
    canvas.replaceWith(replacement);
    // The canvas binding remains stable through the wrapper below.
    renderer='canvas'; context=replacement.getContext('2d'); surface=replacement;gl=null;
  }
  let surface=canvas;

  function mesh(lower) {
    const data=[];
    function push(x,y) {
      const u=x/columns,v=y/rows,p=deform(u,v,lower);
      data.push(p[0],p[1],sourceU(u),v);
    }
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
      push(x,y);push(x+1,y);push(x,y+1);
      push(x,y+1);push(x+1,y);push(x+1,y+1);
    }
    return new Float32Array(data);
  }
  function drawGL(asset, vertices, layer) {
    gl.bindTexture(gl.TEXTURE_2D,asset.texture);
    gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);
    gl.uniform1f(gl.getUniformLocation(program,'layer'),layer);
    gl.drawArrays(gl.TRIANGLES,0,vertices.length/4);
  }
  function spriteIndex() {
    if(reduced.matches) return 0;
    const rate = grabbing ? 7+Math.min(Math.abs(speed)/60,8) : ambient ? .8 : 0;
    clockPose += lastDelta*rate;
    return Math.floor(clockPose)%8;
  }
  let clockPose=0,lastDelta=0;
  function grubRectangle(frame) {
    const m=metrics(), size=m.grubWidth/.92;
    return {x:position()-size/2,y:height*.515-size*.59,width:size,height:size,
      u:(frame%4)/4,v:Math.floor(frame/4)/2};
  }
  function renderGL(frame) {
    gl.viewport(0,0,surface.width,surface.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(gl.getUniformLocation(program,'resolution'),width,height);
    gl.uniform1f(gl.getUniformLocation(program,'grubX'),position());
    gl.uniform1f(gl.getUniformLocation(program,'grubSize'),metrics().grubWidth);
    gl.uniform1f(gl.getUniformLocation(program,'time'),clock);
    gl.uniform1f(gl.getUniformLocation(program,'motion'),ambient&&!reduced.matches?1:0);
    drawGL(assets.base,mesh(false),0);
    const r=grubRectangle(frame),x=r.x,y=r.y,w=r.width,h=r.height,u=r.u,v=r.v;
    drawGL(assets.grub,new Float32Array([
      x,y,u,v, x+w,y,u+.25,v, x,y+h,u,v+.5,
      x,y+h,u,v+.5, x+w,y,u+.25,v, x+w,y+h,u+.25,v+.5
    ]),1);
    drawGL(assets.front,mesh(true),2);
  }

  function drawContinuous(asset, lower) {
    const img=asset.image;
    // Subpixel-overlapped, unique source columns keep Canvas fallback continuous.
    // Every column samples its own x; no repeated tissue tiles.
    const step=1;
    for(let x=0;x<width;x+=step) {
      const u=x/width, sourceX=sourceU(u)*img.width;
      const nextX=sourceU(Math.min(1,(x+step+ .2)/width))*img.width;
      const start=lower?.49:0, end=lower?1:.515;
      const top=deform(u,start,lower)[1], bottom=deform(u,end,lower)[1];
      context.drawImage(img,sourceX,start*img.height,Math.max(.1,nextX-sourceX),(end-start)*img.height,
        x,top,step+.2,bottom-top);
    }
  }
  function renderCanvas(frame) {
    const c=context,dpr=Math.min(devicePixelRatio||1,2);
    c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
    // A subtle internal filament is clipped by the lip drawn last.
    const x=position(), center=height*.515;
    c.save();c.strokeStyle='#a13f32';c.shadowColor='#f04729';c.shadowBlur=5;c.lineWidth=1.4;
    c.beginPath();c.moveTo(20,center);c.lineTo(x,center);c.stroke();c.restore();
    drawContinuous(assets.base,false);
    c.save();c.fillStyle='#000b';c.beginPath();c.ellipse(x,center+3,metrics().grubWidth*.43,8,0,0,Math.PI*2);c.fill();c.restore();
    const r=grubRectangle(frame),img=assets.grub.image;
    c.drawImage(img,r.u*img.width+2,r.v*img.height+2,img.width/4-4,img.height/2-4,r.x,r.y,r.width,r.height);
    drawContinuous(assets.front,true);
  }
  function schedule() {
    if (!request && ready && enabled && !document.hidden) request=requestAnimationFrame(render);
  }
  function render(now) {
    request=0;if(!enabled||document.hidden)return;
    if(prior && now-prior<30){schedule();return;}
    lastDelta=Math.min((now-(prior||now))/1000,.05);prior=now;clock+=lastDelta;
    progress=clamp(Number(input.value)/1000,0,1);
    const x=position(),instant=(x-previousX)/Math.max(.001,lastDelta);
    if(Math.abs(x-previousX)>.05) { direction=Math.sign(x-previousX);wakeStrength=Math.min(1,Math.abs(instant)/300); }
    speed+=(instant-speed)*Math.min(1,lastDelta*15);
    wakeX+=(x-wakeX)*Math.min(1,lastDelta*9);
    wakeStrength*=Math.exp(-lastDelta*5);previousX=x;
    const rect=rail.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(width*dpr),h=Math.round(height*dpr);
    if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;}
    const frame=spriteIndex();
    rail.dataset.progress=progress.toFixed(3);
    if(gl)renderGL(frame);else renderCanvas(frame);
    schedule();
  }
  async function load(name,file) {
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src='./tissue/scrubber/'+file;});
    assets[name]={image};
  }
  Promise.all([load('base','rail-base.webp'),load('front','rail-foreground.webp'),load('grub','grub-squirm-atlas.webp')])
    .then(()=>{try{initialize();}catch(error){rail.dataset.renderError=error.message;fallback();}
      ready=true;rail.dataset.renderer=renderer;rail.classList.add('maw-rail-ready');schedule();})
    .catch(()=>{rail.classList.remove('maw-rail-ready');});

  // Native range keyboard semantics stay available; pointer position uses the
  // exact same padded travel interval as the visible grub.
  input.addEventListener('pointerdown',event=>{
    if(!enabled)return;
    if(event.button!==0)return;
    event.preventDefault();input.focus();pointerId=event.pointerId;grabbing=true;
    input.setPointerCapture(pointerId);move(event);
  });
  function move(event) {
    if(!enabled||event.pointerId!==pointerId)return;
    event.preventDefault();
    const rect=rail.getBoundingClientRect(),m=metrics();
    input.value=String(Math.round(clamp((event.clientX-rect.left-m.margin)/m.travel,0,1)*1000));
    input.dispatchEvent(new Event('input',{bubbles:true}));
    schedule();
  }
  input.addEventListener('pointermove',move);
  function release(event) {
    if(event.pointerId!==pointerId)return;
    grabbing=false;pointerId=null;
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])input.addEventListener(type,release);
  window.addEventListener('blur',()=>{grabbing=false;pointerId=null;});
  for(const type of ['keydown','keyup'])input.addEventListener(type,event=>{if(enabled)event.stopPropagation();});
  document.addEventListener('visibilitychange',()=>{prior=0;schedule();});
  surface.addEventListener('webglcontextlost',event=>{
    event.preventDefault();fallback();rail.dataset.renderer=renderer;schedule();
  });
  return {
    select(active){enabled=active;rail.classList.toggle('maw-scrubber',active);prior=0;grabbing=false;pointerId=null;schedule();},
    motion(active){ambient=active;schedule();}
  };
}
