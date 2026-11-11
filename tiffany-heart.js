/*
 * Tiffany-blue WebGL flowing heart, preserving the original Love.svelte shader.
 * Adapted from the glowing-heart shader in xijaja/love-you:
 * https://github.com/xijaja/love-you/blob/main/src/lib/Love.svelte
 * Replaces only the heart renderer. GitHub messages and login remain unchanged.
 */
(() => {
  'use strict';

  const originalInitHeart = window.initHeart;
  let running = false;

  const vertexShaderSource = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  // Original Love.svelte shader math, with only uniform wiring and Tiffany colors adapted.
  const fragmentShaderSource = `
    precision highp float;
    
    uniform vec2 resolution;
    
    uniform float time;
    
    #define POINT_COUNT 8
    
    vec2 points[POINT_COUNT];
    const float speed = -0.5;
    const float len = 0.25;
    float intensity = 0.9;
    float radius = 0.015;
    
    //https://www.shadertoy.com/view/MlKcDD
    //Signed distance to a quadratic bezier
    float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C){
        vec2 a = B - A;
        vec2 b = A - 2.0*B + C;
        vec2 c = a * 2.0;
        vec2 d = A - pos;
    
        float kk = 1.0 / dot(b,b);
        float kx = kk * dot(a,b);
        float ky = kk * (2.0*dot(a,a)+dot(d,b)) / 3.0;
        float kz = kk * dot(d,a);
    
        float res = 0.0;
    
        float p = ky - kx*kx;
        float p3 = p*p*p;
        float q = kx*(2.0*kx*kx - 3.0*ky) + kz;
        float h = q*q + 4.0*p3;
    
        if(h >= 0.0){
            h = sqrt(h);
            vec2 x = (vec2(h, -h) - q) / 2.0;
            vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
            float t = uv.x + uv.y - kx;
            t = clamp( t, 0.0, 1.0 );
    
            // 1 root
            vec2 qos = d + (c + b*t)*t;
            res = length(qos);
        }else{
            float z = sqrt(-p);
            float v = acos( q/(p*z*2.0) ) / 3.0;
            float m = cos(v);
            float n = sin(v)*1.732050808;
            vec3 t = vec3(m + m, -n - m, n - m) * z - kx;
            t = clamp( t, 0.0, 1.0 );
    
            // 3 roots
            vec2 qos = d + (c + b*t.x)*t.x;
            float dis = dot(qos,qos);
    
            res = dis;
    
            qos = d + (c + b*t.y)*t.y;
            dis = dot(qos,qos);
            res = min(res,dis);
    
            qos = d + (c + b*t.z)*t.z;
            dis = dot(qos,qos);
            res = min(res,dis);
    
            res = sqrt( res );
        }
    
        return res;
    }
    
    
    //http://mathworld.wolfram.com/HeartCurve.html
    vec2 getHeartPosition(float t){
        return vec2(16.0 * sin(t) * sin(t) * sin(t),
                                -(13.0 * cos(t) - 5.0 * cos(2.0*t)
                                - 2.0 * cos(3.0*t) - cos(4.0*t)));
    }
    
    //https://www.shadertoy.com/view/3s3GDn
    float getGlow(float dist, float radius, float intensity){
        return pow(radius/dist, intensity);
    }
    
    float getSegment(float t, vec2 pos, float offset, float scale){
        for(int i = 0; i < POINT_COUNT; i++){
            points[i] = getHeartPosition(offset + float(i)*len + fract(speed * t) * 6.28);
        }
    
        vec2 c = (points[0] + points[1]) / 2.0;
        vec2 c_prev;
        float dist = 10000.0;
    
        for(int i = 0; i < POINT_COUNT-1; i++){
            //https://tinyurl.com/y2htbwkm
            c_prev = c;
            c = (points[i] + points[i+1]) / 2.0;
            dist = min(dist, sdBezier(pos, scale * c_prev, scale * points[i], scale * c));
        }
        return max(0.0, dist);
    }
    
    void main(){
        vec2 uv = gl_FragCoord.xy/resolution.xy;
        float widthHeightRatio = resolution.x/resolution.y;
        vec2 centre = vec2(0.5, 0.5);
        vec2 pos = centre - uv;
        pos.y /= widthHeightRatio;
        //Shift upwards to centre heart
        pos.y -= 22.0 / resolution.x;
        float scale = min(min(resolution.x * 0.37, resolution.y * 0.36), 315.0) / (16.0 * resolution.x);
    
        float t = time;
    
        //Get first segment
        float dist = getSegment(t, pos, 0.0, scale);
        float glow = getGlow(dist, radius, intensity);
    
        vec3 col = vec3(0.0);
    
        //White core
        col += 10.0*vec3((1.0 - smoothstep(0.001, 0.003, dist)));
        //Pink glow
        col += glow * vec3(0.506,0.847,0.816);
    
        //Get second segment
        dist = getSegment(t, pos, 3.4, scale);
        glow = getGlow(dist, radius, intensity);
    
        //White core
        col += 10.0*vec3((1.0 - smoothstep(0.001, 0.003, dist)));
        //Blue glow
        col += glow * vec3(0.69,0.97,0.94);
    
        //Tone mapping
        col = 1.0 - exp(-col);
    
        //Output to screen
         gl_FragColor = vec4(col,1.0);
    }
      `;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const details = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Heart shader failed: ' + details);
    }
    return shader;
  }


  // Full heart particle layer: the reference WebGL shader alone renders only two trails.
  function startHeartParticles() {
    const parent=document.getElementById('app-content');
    if(!parent || document.getElementById('heart-particles')) return;
    const layer=document.createElement('canvas');
    layer.id='heart-particles';
    layer.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none';
    parent.appendChild(layer);
    const ctx=layer.getContext('2d');
    if(!ctx)return;
    let w,h,scale,dpr;
    function resize(){
      w=parent.clientWidth;h=parent.clientHeight;
      dpr=Math.min(devicePixelRatio||1,2);
      layer.width=Math.round(w*dpr);layer.height=Math.round(h*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      scale=Math.min(w*.37,h*.36,315);
    }
    resize();window.addEventListener('resize',resize,{passive:true});
    function heart(t){return {x:Math.pow(Math.sin(t),3),y:-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/16};}
    const rand=(a,b)=>a+Math.random()*(b-a);
    const particles=Array.from({length:1900},(_,i)=>{
      const p=heart(rand(0,Math.PI*2)),edge=i<950;
      const f=edge?rand(.985,1.015):Math.sqrt(Math.random());
      return {x:p.x*f,y:p.y*f,edge,phase:rand(0,6.28),speed:rand(1.1,3),r:rand(.5,1.65)};
    });
    const bursts=[];const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last=performance.now(),quota=0;
    function draw(now){
      const dt=Math.min(.06,(now-last)/1000);last=now;
      const t=now/1000,cx=w/2,cy=h/2+22;
      ctx.clearRect(0,0,w,h);
      ctx.strokeStyle='rgba(129,216,208,.64)';
      ctx.lineWidth=1.3;ctx.shadowColor='#81D8D0';ctx.shadowBlur=16;
      ctx.beginPath();
      for(let j=0;j<=360;j++){
        const p=heart(j*Math.PI*2/360);
        if(!j)ctx.moveTo(cx+p.x*scale,cy+p.y*scale);
        else ctx.lineTo(cx+p.x*scale,cy+p.y*scale);
      }
      ctx.closePath();ctx.stroke();ctx.shadowBlur=0;
      for(const p of particles){
        const a=t*p.speed*3+p.phase;
        const bounce=reduce?0:Math.max(0,Math.sin(a))**2;
        const x=cx+p.x*scale+ (reduce?0:Math.cos(a*.8)*1.4);
        const y=cy+p.y*scale-bounce*(p.edge?4:9);
        const opacity=(p.edge?.65:.3)+(reduce?0:.3*Math.sin(a)**2);
        ctx.fillStyle='rgba(129,216,208,'+Math.min(opacity,1)+')';
        ctx.beginPath();ctx.arc(x,y,p.r*(1+bounce*.45),0,Math.PI*2);ctx.fill();
      }
      if(!reduce){
        quota+=dt*120;
        while(quota>=1){
          quota--;
          const p=heart(rand(0,Math.PI*2)),theta=Math.atan2(p.y,p.x);
          bursts.push({x:p.x,y:p.y,vx:Math.cos(theta)*rand(12,28),
            vy:Math.sin(theta)*rand(12,28),born:t,life:rand(.9,2.1),r:rand(.7,2.1)});
        }
      }
      for(let i=bursts.length-1;i>=0;i--){
        const p=bursts[i],age=t-p.born;
        if(age>p.life){bursts.splice(i,1);continue;}
        const fade=1-age/p.life;
        ctx.fillStyle='rgba(129,216,208,'+(fade*.85)+')';
        ctx.beginPath();ctx.arc(cx+p.x*scale+p.vx*age,cy+p.y*scale+p.vy*age,p.r*fade,0,Math.PI*2);ctx.fill();
      }
      if(!reduce)requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  function startWebGLHeart() {
    startHeartParticles();
    if (running) return;
    const canvas = document.getElementById('pinkboard');
    if (!canvas) return;

    let gl;
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    } catch (e) { /* Browser may not support WebGL. */ }
    if (!gl) {
      if (typeof originalInitHeart === 'function') originalInitHeart();
      return;
    }

    try {
      const vertex = compile(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
      }
      gl.useProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);

      const position = gl.getAttribLocation(program, 'position');
      const resolution = gl.getUniformLocation(program, 'resolution');
      const time = gl.getUniformLocation(program, 'time');
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, 1, -1, -1, 1, 1, 1, -1
      ]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      let width = 0;
      let height = 0;
      function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = Math.max(1, Math.round(canvas.clientWidth * dpr));
        height = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        gl.uniform2f(resolution, width, height);
      }
      resize();
      window.addEventListener('resize', resize, { passive: true });

      const start = performance.now();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function draw(now) {
        gl.uniform1f(time, reducedMotion ? 0 : (now - start) * 0.001);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (!reducedMotion) requestAnimationFrame(draw);
      }
      running = true;
      requestAnimationFrame(draw);
    } catch (e) {
      console.error('WebGL heart initialization failed:', e);
    }
  }

  // Override only the animation, before checkLogin() calls initHeart().
  window.initHeart = startWebGLHeart;

  const style = document.createElement('style');
  style.textContent = `
    #greeting-text {
      color: #c6f8f3 !important;
      text-shadow: 0 0 12px rgba(129,216,208,.8),
                   0 0 25px rgba(129,216,208,.35) !important;
      top: calc(50% + 22px) !important;
      transform: translate(-50%, -50%) !important;
      animation: none !important;
    }
  `;
  document.head.appendChild(style);

  const greeting = document.getElementById('greeting-text');
  if (greeting) {
    const update = () => {
      const value = greeting.textContent.replace(/\s/g, '');
      if (value === 'Jing❤️Allen' || value === 'Jing❤Allen') greeting.textContent = 'J❤️A';
      if (value === 'Allen❤️Jing' || value === 'Allen❤Jing') greeting.textContent = 'A❤️J';
    };
    new MutationObserver(update).observe(greeting,
      { childList: true, characterData: true, subtree: true });
    update();
  }
})();
