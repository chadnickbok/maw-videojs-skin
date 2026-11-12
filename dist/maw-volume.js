const clamp = value => Math.max(0, Math.min(1, value));

export function createMawVolume(rail, input, media) {
  let canvas = document.createElement('canvas');
  canvas.className = 'maw-bellows';
  canvas.setAttribute('aria-hidden', 'true');
  rail.prepend(canvas);
  const image = new Image();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = false, ready = false, ambient = true;
  let gl, program, context;
  let request = 0, previous = 0, inflation = media.muted ? 0 : media.volume;
  let pointer = null, startX = 0, startVolume = 0;
  let width = 1, height = 1;

  const vertex = `
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      uv=vec2(position.x*.5+.5,.5-position.y*.5);
      gl_Position=vec4(position,0.,1.);
    }`;
  const fragment = `
    precision mediump float;
    uniform sampler2D atlas;
    uniform float pose, time, motion;
    uniform vec2 contentScale;
    varying vec2 uv;
    vec4 samplePose(vec2 p) {
      float frame=floor(pose+.5);
      p=clamp(p,.009,.991);
      return texture2D(atlas,(vec2(mod(frame,5.),floor(frame/5.))+p)/vec2(5.,3.));
    }
    void main() {
      vec2 p=(uv-.5)/contentScale+.5;
      if(p.x<0.||p.x>1.||p.y<0.||p.y>1.) { gl_FragColor=vec4(0.); return; }
      float sac=exp(-dot((p-vec2(.34,.5))*vec2(4.,2.5),(p-vec2(.34,.5))*vec2(4.,2.5)));
      p-= (p-vec2(.34,.5))*sac*.004*sin(time*1.1)*motion;
      vec4 c=samplePose(p);
      float red=smoothstep(.16,.5,c.r-c.g)*smoothstep(.15,.5,c.r);
      c.rgb+=vec3(.055,.004,.002)*red*(1.+.15*sin(time*1.1)*motion);
      float edge=1.-smoothstep(.46,.50,max(abs(p.x-.5),abs(p.y-.5)));
      gl_FragColor=vec4(c.rgb,edge);
    }`;

  function compile(type, source) {
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function initialize() {
    gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false});
    if(!gl)throw Error('WebGL unavailable');
    program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Shader link failed');
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position');
    gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.uniform1i(gl.getUniformLocation(program,'atlas'),0);
    rail.dataset.renderer='webgl';
  }
  function fallback() {
    const replacement=canvas.cloneNode();
    canvas.replaceWith(replacement);canvas=replacement;
    gl=null;context=canvas.getContext('2d');rail.dataset.renderer='canvas';
  }
  function schedule() {
    if(!request&&ready&&enabled&&!document.hidden)request=requestAnimationFrame(render);
  }
  function render(now) {
    request=0;
    if(!enabled||document.hidden)return;
    if(previous&&now-previous<30){schedule();return;}
    const dt=Math.min((now-(previous||now))/1000,.05);previous=now;
    const target=media.muted?0:Number(input.value)/100;
    const distance=target-inflation;
    inflation=reduced.matches?target:inflation+distance*Math.min(1,dt*24);
    if(Math.abs(target-inflation)<.002)inflation=target;
    const rect=rail.getBoundingClientRect();
    width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    const dpr=Math.min(devicePixelRatio||1,2);
    const w=Math.round(width*dpr),h=Math.round(height*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const aspect=(image.width/5)/(image.height/3);
    const displayWidth=Math.min(width,height*aspect),displayHeight=displayWidth/aspect;
    const frame=Math.round(inflation*14);
    rail.dataset.pose=String(frame);
    rail.dataset.volume=String(Math.round(target*100));
    if(gl) {
      gl.viewport(0,0,w,h);gl.useProgram(program);
      gl.uniform1f(gl.getUniformLocation(program,'pose'),frame);
      gl.uniform1f(gl.getUniformLocation(program,'time'),now/1000);
      gl.uniform1f(gl.getUniformLocation(program,'motion'),ambient&&!reduced.matches?1:0);
      gl.uniform2f(gl.getUniformLocation(program,'contentScale'),displayWidth/width,displayHeight/height);
      gl.drawArrays(gl.TRIANGLES,0,6);
    } else {
      context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);
      const sw=image.width/5,sh=image.height/3;
      context.drawImage(image,frame%5*sw+2,Math.floor(frame/5)*sh+2,sw-4,sh-4,
        (width-displayWidth)/2,(height-displayHeight)/2,displayWidth,displayHeight);
    }
    if(inflation!==target||(ambient&&!reduced.matches))schedule();
  }
  image.onload=()=>{
    try{initialize();}catch(error){rail.dataset.renderError=error.message;fallback();}
    ready=true;rail.classList.add('maw-bellows-ready');
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();schedule();});
    schedule();
  };
  image.src='./tissue/maw-bellows.webp';

  // Relative travel keeps a tiny mobile piston controllable without a jump
  // when the finger first lands on its grip.
  input.addEventListener('pointerdown',event=>{
    if(!enabled||event.button!==0)return;
    event.preventDefault();input.focus();
    pointer=event.pointerId;startX=event.clientX;startVolume=Number(input.value)/100;
    input.setPointerCapture(pointer);
  });
  input.addEventListener('pointermove',event=>{
    if(!enabled||event.pointerId!==pointer)return;
    event.preventDefault();
    const travel=Math.max(65,rail.getBoundingClientRect().width*.65);
    input.value=String(Math.round(clamp(startVolume+(startX-event.clientX)/travel)*100));
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']) {
    input.addEventListener(type,event=>{if(event.pointerId===pointer)pointer=null;});
  }
  window.addEventListener('blur',()=>{pointer=null;});
  input.addEventListener('keydown',event=>{
    if(!enabled)return;
    event.stopPropagation();
    let value=Number(input.value);
    if(event.key==='ArrowLeft'||event.key==='ArrowUp')value+=5;
    else if(event.key==='ArrowRight'||event.key==='ArrowDown')value-=5;
    else if(event.key==='Home')value=0;
    else if(event.key==='End')value=100;
    else return;
    event.preventDefault();
    input.value=String(Math.max(0,Math.min(100,value)));
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  input.addEventListener('keyup',event=>{if(enabled)event.stopPropagation();});
  input.addEventListener('input',schedule);
  media.addEventListener('volumechange',schedule);
  document.addEventListener('visibilitychange',()=>{previous=0;schedule();});
  new ResizeObserver(schedule).observe(rail);
  reduced.addEventListener('change',schedule);
  return {
    select(active) {
      enabled=active;pointer=null;previous=0;
      rail.classList.toggle('maw-volume',active);
      input.setAttribute('dir',active?'rtl':'ltr');
      input.title=active?'Push left to inflate · louder':'Volume';
      if(active){inflation=media.muted?0:media.volume;schedule();}
    },
    motion(active){ambient=active;schedule();}
  };
}
