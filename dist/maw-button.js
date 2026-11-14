// The atlas supplies the authored fold motion. The shader adds only surface life.
export function createMawButton(button, media) {
  let painted=false;
  let canvas = document.createElement('canvas');
  canvas.className = 'maw-surface';
  canvas.setAttribute('aria-hidden', 'true');
  button.prepend(canvas);
  const atlas = new Image();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let gl, program, texture, context2d;
  let enabled = false;
  let ambient = true;
  let hover = 0;
  let touch = 0;
  let depth = media.paused ? 1 : 0;
  let lastTime = 0;
  let animationId = 0;
  let ready = false;

  const vertexSource = `
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      uv = vec2(position.x * .5 + .5, .5 - position.y * .5);
      gl_Position = vec4(position, 0., 1.);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform sampler2D atlas;
    uniform float pose, time, activity, contact;
    varying vec2 uv;
    vec4 sprite(vec2 p) {
      float index = floor(pose + .5);
      vec2 cell = vec2(mod(index, 5.), floor(index / 5.));
      p = clamp(p, .008, .992);
      return texture2D(atlas, (cell + p) / vec2(5., 3.));
    }
    vec3 emission(vec2 p) {
      vec3 c = sprite(p).rgb;
      float strength = smoothstep(.52, .96, c.r) *
        smoothstep(.13, .42, c.r - c.g);
      return vec3(1., .12, .055) * strength;
    }
    void main() {
      vec2 p = uv;
      vec2 center = vec2(.50, .49);
      vec2 delta = p - center;
      float soft = exp(-dot(delta * vec2(2.8, 2.6), delta * vec2(2.8, 2.6)));
      // Both lobes swell at slightly different phases, with the collar pinned.
      float breath = sin(time * 1.15 + p.x * 1.7) * .005 * activity;
      p -= delta * soft * breath;
      p.y += soft * contact * .007;
      vec3 color = sprite(p).rgb;
      vec3 halo = vec3(0.);
      for (int i = 0; i < 8; i++) {
        float angle = float(i) * .785398;
        vec2 direction = vec2(cos(angle), sin(angle));
        halo += emission(p + direction * .021) * .065;
        halo += emission(p + direction * .047) * .027;
      }
      float pulse = 1. + activity * .13 * sin(time * 1.15);
      color += halo * pulse + emission(p) * .075 * pulse;
      // An analytic curved surface gives a faint, moving wet reflection.
      vec3 normal = normalize(vec3(delta.x * 2.6, delta.y * 2.6, .65));
      vec3 light = normalize(vec3(-.7 + sin(time * .3) * .16, -.9, 1.4));
      float specular = pow(max(dot(reflect(-light, normal), vec3(0.,0.,1.)), 0.), 34.);
      color += vec3(.7, .4, .36) * specular * .045 * soft * activity;
      float edge = 1. - smoothstep(.47, .515, max(abs(uv.x-.5), abs(uv.y-.5)));
      gl_FragColor = vec4(color, edge);
    }
  `;

  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(result));
    }
    return result;
  }

  function initialize() {
    gl = canvas.getContext('webgl', {alpha: true, antialias: false, premultipliedAlpha: false});
    if (!gl) throw new Error('WebGL unavailable');
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader link failed');
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.uniform1i(gl.getUniformLocation(program, 'atlas'), 0);
    button.dataset.renderer = 'webgl';
  }

  function fallback() {
    const replacement = canvas.cloneNode();
    canvas.replaceWith(replacement);
    canvas = replacement;
    gl = null;
    context2d = canvas.getContext('2d');
    button.dataset.renderer = 'canvas';
  }

  function schedule() {
    if (!animationId && ready && enabled && !document.hidden) {
      animationId = requestAnimationFrame(render);
    }
  }

  function render(now) {
    animationId = 0;
    if (!enabled || document.hidden) return;
    const dt = Math.min((now - (lastTime || now)) / 1000, .05);
    lastTime = now;
    const target = media.paused || media.ended ? 1 : 0;
    // A constant speed makes mid-transition reversals continuous.
    const distance = dt / .52;
    depth += Math.sign(target-depth) * Math.min(Math.abs(target-depth), distance);
    if (reducedMotion.matches) depth = target;
    const size = Math.max(1, Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2)));
    if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size;
    const pose = Math.round(depth * 14);
    button.dataset.pose = String(pose);
    if (gl) {
      gl.viewport(0, 0, size, size);
      gl.useProgram(program);
      gl.uniform1f(gl.getUniformLocation(program, 'pose'), pose);
      gl.uniform1f(gl.getUniformLocation(program, 'time'), now / 1000);
      gl.uniform1f(gl.getUniformLocation(program, 'activity'), ambient && !reducedMotion.matches ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(program, 'contact'), touch || hover * .25);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else if (context2d) {
      const w = atlas.width / 5, h = atlas.height / 3;
      context2d.clearRect(0, 0, size, size);
      context2d.drawImage(atlas, pose % 5 * w + 2, Math.floor(pose / 5) * h + 2, w-4, h-4, 0, 0, size, size);
    }
    painted=true;
    if (depth !== target || (ambient && !reducedMotion.matches)) schedule();
  }

  atlas.onload = () => {
    try { initialize(); } catch (error) { button.dataset.renderError = error.message; fallback(); }
    ready = true;
    button.classList.add('maw-ready');
    schedule();
  };
  atlas.src = './tissue/maw-play-pause.webp';
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    ready = false;
    button.classList.remove('maw-ready');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try { initialize(); } catch (error) { button.dataset.renderError = error.message; fallback(); }
    ready = true;
    button.classList.add('maw-ready');
    schedule();
  });
  // Let the native button handle activation once, without player hotkeys.
  for (const event of ['keydown', 'keyup']) {
    button.addEventListener(event, e => {
      if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
    });
  }
  button.addEventListener('pointerenter', () => { hover=1; schedule(); });
  button.addEventListener('pointerleave', () => { hover=0; touch=0; schedule(); });
  button.addEventListener('pointerdown', () => { touch=1; schedule(); });
  for (const event of ['pointerup','pointercancel','blur']) {
    window.addEventListener(event, () => { touch=0; schedule(); });
  }
  for (const event of ['play','pause','ended','error']) media.addEventListener(event, schedule);
  document.addEventListener('visibilitychange', () => { lastTime=0; schedule(); });
  reducedMotion.addEventListener('change', schedule);
  new ResizeObserver(schedule).observe(button);

  return {
    get isReady(){return ready&&painted;},
    select(active) {
      enabled = active;
      button.classList.toggle('maw-button', active);
      if (active) {painted=false; depth = media.paused ? 1 : 0; lastTime=0; schedule(); }
    },
    motion(active) { ambient=active; schedule(); }
  };
}
