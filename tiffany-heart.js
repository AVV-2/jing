/*
 * Two-stage Tiffany heart: Love.svelte WebGL intro, then Heart.svelte particle heart.
 * Adapted from the glowing-heart shader in xijaja/love-you:
 * https://github.com/xijaja/love-you/blob/main/src/lib/Love.svelte
 * Replaces only the heart renderer. GitHub messages and login remain unchanged.
 */
(() => {
  'use strict';

  let running = false;

  const vertexShaderSource = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  // Original Love.svelte shader math and pink/blue glow; particle heart remains Tiffany blue.
  const fragmentShaderSource = `
    precision highp float;
    
    uniform vec2 resolution;
    
    uniform float time;
    uniform float heartScalePixels;
    uniform float heartShiftPixels;
    
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
        pos.y += heartShiftPixels / resolution.x;
        // Match the second-stage Heart.svelte shape: 160 CSS px half-width at scale 1.
        float scale = (10.0 * heartScalePixels) / resolution.x;
    
        float t = time;
    
        //Get first segment
        float dist = getSegment(t, pos, 0.0, scale);
        float glow = getGlow(dist, radius, intensity);
    
        vec3 col = vec3(0.0);
    
        //White core
        col += 10.0*vec3((1.0 - smoothstep(0.001, 0.003, dist)));
        //Pink glow
        col += glow * vec3(0.94,0.14,0.4);
    
        //Get second segment
        dist = getSegment(t, pos, 3.4, scale);
        glow = getGlow(dist, radius, intensity);
    
        //White core
        col += 10.0*vec3((1.0 - smoothstep(0.001, 0.003, dist)));
        //Blue glow
        col += glow * vec3(0.2,0.6,1.0);
    
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



  // Stage 2: adapted from xijaja/love-you/src/lib/Heart.svelte.
  // Spawn tiny Tiffany-colored heart sprites along the mathematical heart
  // boundary, then move outward and fade over the original 3-second lifetime.
  function startParticleHeart() {
    if (document.getElementById('tiffany-particle-stage')) return;
    const app = document.getElementById('app-content');
    if (!app) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'tiffany-particle-stage';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;';
    app.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config = { length: 999, duration: 3, velocity: 60, effect: -0.6, size: 24 };
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = spriteCanvas.height = config.size;
    const spriteCtx = spriteCanvas.getContext('2d');

    function pointOnHeart(t) {
      return {
        x: 160 * Math.pow(Math.sin(t), 3),
        y: 130 * Math.cos(t) - 50 * Math.cos(2 * t)
           - 20 * Math.cos(3 * t) - 10 * Math.cos(4 * t) + 25
      };
    }
    // Same tiny-heart particle image approach as the upstream Heart.svelte.
    spriteCtx.beginPath();
    let pt = pointOnHeart(-Math.PI);
    spriteCtx.moveTo(config.size/2 + pt.x*config.size/350,
                     config.size/2 - pt.y*config.size/350);
    for(let t=-Math.PI; t<=Math.PI; t+=0.01) {
      pt=pointOnHeart(t);
      spriteCtx.lineTo(config.size/2 + pt.x*config.size/350,
                       config.size/2 - pt.y*config.size/350);
    }
    spriteCtx.closePath();
    spriteCtx.fillStyle='#81D8D0';
    spriteCtx.fill();

    const particles = [];
    let firstActive = 0, firstFree = 0;
    for(let i=0; i<config.length; i++) {
      particles.push({x:0,y:0,vx:0,vy:0,ax:0,ay:0,age:config.duration,insetX:0,insetY:0});
    }
    function emit(x,y,vx,vy,insetX=0,insetY=0) {
      const p=particles[firstFree];
      p.x=x;p.y=y;p.vx=vx;p.vy=vy;
      p.insetX=insetX;p.insetY=insetY;
      p.ax=vx*config.effect;p.ay=vy*config.effect;p.age=0;
      firstFree=(firstFree+1)%config.length;
      if(firstFree===firstActive) firstActive=(firstActive+1)%config.length;
    }
    function eachActive(fn) {
      let i=firstActive;
      while(i!==firstFree) {fn(particles[i]);i=(i+1)%config.length;}
    }

    let w=1,h=1,dpr=1,heartScale=1;
    function resize(){
      w=Math.max(1,canvas.clientWidth);
      h=Math.max(1,canvas.clientHeight);
      dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      // Upstream uses an approx. 320px-wide heart; shrink on narrow screens.
      heartScale=Math.min(1, w/430, h/530);
    }
    resize();
    window.addEventListener('resize',resize,{passive:true});

    // Particles start 65% inward, travel outward along their own heart
    // radius, and reach the ORIGINAL heart outline while retaining the
    // original outward velocity, acceleration, fade and full-sized shape.
    // No additional rim/outline is rendered.
    const spawnInset=0.35;

    // Favor both the upper diagonal shoulders and lower diagonal sides
    // rather than concentrating births at the widest horizontal edges.
    // Positive heart-coordinate y points upward. Only sampling weights change.
    function sampleHeartPoint() {
      for (;;) {
        const point=pointOnHeart(Math.PI-2*Math.PI*Math.random());
        const ax=Math.abs(point.x);

        // Upper angles measured from horizontal (0° side, 90° vertical).
        const upperAngleDeg=point.y>=0
          ? Math.atan2(point.y,Math.max(ax,1e-6))*180/Math.PI : -1;

        // Lower angles measured from downward vertical (0° center, 15° offset).
        const lowerFromVerticalDeg=point.y<0
          ? Math.atan2(ax,Math.max(-point.y,1e-6))*180/Math.PI : -1;

        let weight;
        if(point.y<0 && ax>=8 && lowerFromVerticalDeg<=15) {
          weight=1.15; // Lower center: within 15 degrees on either side
        } else if(point.y<0 && ax>=35 && ax<110) {
          weight=2.0;  // Lower diagonal sides
        } else if(point.y>=65 && ax>=5 && ax<35) {
          weight=1.8;  // Fill narrow upper-inner shoulders beside the center notch
        } else if(point.y>=110 && ax>=25 && ax<130) {
          weight=1.8;  // Restore density around BOTH upper heart-lobe peaks
        } else if(point.y>=0 && ax>=35 && ax<110
                  && upperAngleDeg>=40 && upperAngleDeg<=45) {
          weight=1.15; // Upper diagonals: 40-45 degrees
        } else if(ax>=110) {
          weight=1.1;  // Widest horizontal sides
        } else {
          weight=0.2;  // Upper/lower vertical regions
        }
        if(Math.random()*2.0<=weight) return point;
      }
    }
    const rate=config.length/config.duration;
    let last=performance.now(),fraction=0;
    const breathStart=last;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function draw(now) {
      const dt=Math.min((now-last)/1000,.055);
      last=now;
      ctx.clearRect(0,0,w,h);

      // Stronger 4-second breathing cycle: original size -> 125% -> original size.
      // Transform just this particle canvas, keeping the greeting and intro unchanged.
      const phase=(now-breathStart)/4000*2*Math.PI;
      const breath=reduced ? 1 : 1.125-0.125*Math.cos(phase);
      const centerX=w/2,centerY=h/2+22;
      ctx.save();
      ctx.translate(centerX,centerY);
      // Uniformly shrink the entire particle heart by 20%, including
      // particle positions, expansion paths and sprite sizes.
      // Keep the existing 100%-135% breathing cycle relative to this size.
      ctx.scale(breath*0.8,breath*0.8);
      ctx.translate(-centerX,-centerY);
      if(!reduced) {
        fraction+=rate*dt;
        while(fraction>=1) {
          fraction--;
          const pos=sampleHeartPoint();
          const length=Math.hypot(pos.x,pos.y)||1;
          const vx=pos.x/length*config.velocity*heartScale;
          const vy=-pos.y/length*config.velocity*heartScale;
          const outlineX=w/2+pos.x*heartScale;
          const outlineY=h/2-pos.y*heartScale+22;
          emit(outlineX,outlineY,vx,vy,
               pos.x*heartScale*(1-spawnInset),
               -pos.y*heartScale*(1-spawnInset));
        }
      }
      eachActive(p => {
        if(!reduced){
          p.x+=p.vx*dt;p.y+=p.vy*dt;
          p.vx+=p.ax*dt;p.vy+=p.ay*dt;
          p.age+=dt;
        }
        const life=Math.min(1,p.age/config.duration);
        if(life>=1)return;
        const eased=1-Math.pow(1-life,3);
        const spriteSize=config.size*heartScale*eased;
        // Animate the additional inward-to-outline distance over 1.35s.
        // The existing particle physics then continues past the full outline.
        const progress=Math.min(1,p.age/1.35);
        const smooth=progress*progress*(3-2*progress);
        const x=p.x-p.insetX*(1-smooth);
        const y=p.y-p.insetY*(1-smooth);
        ctx.globalAlpha=1-life;
        ctx.drawImage(spriteCanvas,x-spriteSize/2,y-spriteSize/2,spriteSize,spriteSize);
      });
      ctx.globalAlpha=1;

      ctx.restore();
      while(firstActive!==firstFree &&
            particles[firstActive].age>=config.duration) {
        firstActive=(firstActive+1)%config.length;
      }
      if(!reduced)requestAnimationFrame(draw);
    }
    if(reduced) {
      // A static filled set of little hearts for reduced-motion settings.
      for(let i=0;i<500;i++) {
        const pos=sampleHeartPoint();
        emit(w/2+pos.x*heartScale,h/2-pos.y*heartScale+22,0,0);
        particles[(firstFree+config.length-1)%config.length].age=Math.random()*2.6;
      }
    }
    requestAnimationFrame(draw);
  }

  // Stage 1: the original WebGL Love.svelte flowing-light animation.
  // Show it for two seconds, then switch to the separate Heart.svelte canvas.
  function startWebGLHeart() {
    if (running) return;
    running=true;
    const canvas = document.getElementById('pinkboard');
    if (!canvas) return;
    let switched=false;
    function switchToParticles(){
      if(switched)return;
      switched=true;
      canvas.style.display='none';
      startParticleHeart();
    }
    let gl;
    try {
      gl=canvas.getContext('webgl', {alpha:true,premultipliedAlpha:false});
      if(!gl) {switchToParticles();return;}
      const vertex=compile(gl,gl.VERTEX_SHADER,vertexShaderSource);
      const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentShaderSource);
      const program=gl.createProgram();
      gl.attachShader(program,vertex);
      gl.attachShader(program,fragment);
      gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);

      const position=gl.getAttribLocation(program,'position');
      const resolution=gl.getUniformLocation(program,'resolution');
      const time=gl.getUniformLocation(program,'time');
      const heartScalePixels=gl.getUniformLocation(program,'heartScalePixels');
      const heartShiftPixels=gl.getUniformLocation(program,'heartShiftPixels');
      const buffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,1,-1,-1,1,1,1,-1]),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);

      function resize(){
        const dpr=Math.min(window.devicePixelRatio||1,2);
        canvas.width=Math.max(1,Math.round(canvas.clientWidth*dpr));
        canvas.height=Math.max(1,Math.round(canvas.clientHeight*dpr));
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.uniform2f(resolution,canvas.width,canvas.height);
        // Match the particle heart's responsive size and visual center in device pixels.
        const scale=Math.min(1,canvas.clientWidth/430,canvas.clientHeight/530);
        gl.uniform1f(heartScalePixels,scale*dpr);
        gl.uniform1f(heartShiftPixels,(25*scale-22)*dpr);
      }
      resize();
      window.addEventListener('resize',()=>{if(!switched)resize();},{passive:true});

      const start=performance.now();
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function draw(now){
        if(switched)return;
        if(reduced || now-start>=2000){switchToParticles();return;}
        // Upstream Love.svelte advances time by 0.015 per frame.
        gl.uniform1f(time,(now-start)*.0009);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
        requestAnimationFrame(draw);
      }
      requestAnimationFrame(draw);
    } catch(error) {
      console.error('WebGL intro failed; showing particle heart instead:',error);
      switchToParticles();
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
      top: calc(50% + 22px - 10pt) !important;
      transform: translate(-50%, -50%) !important;
      animation: none !important;
    }
  `;
  document.head.appendChild(style);


  // Floating messages are an additional presentation of the existing
  // GitHub-backed history. Leave fetchMessages/postMessage/renderMessages intact.
  const boardStyle=document.createElement('style');
  boardStyle.textContent=`
    .board-drawer {
      border: 0 !important;
      background: rgba(15, 9, 29, .84) !important;
      box-shadow: 0 14px 35px rgba(0,0,0,.30) !important;
    }
    .msg-item { border: 0 !important; }
    .board-input-area {
      border-top: 0 !important;
      align-items: center;
    }
    .board-input-area input, #msg-input {
      min-width: 0; width: 100%; font-size: 17px !important;
      line-height: 1.35; -webkit-text-size-adjust: 100%;
    }
    .board-input-area button { padding-inline: 12px; flex-shrink: 0; }
    #greeting-text { z-index: 5 !important; }
    #floating-messages {
      position: absolute; inset: 0; z-index: 3;
      pointer-events: none; overflow: hidden; contain: layout;
    }
    #floating-messages .floating-message {
      position: absolute; left: 0; top: 0;
      display: inline-block; max-width: min(60vw, 260px);
      color: rgba(255, 132, 177, .95);
      font-size: clamp(12px, 3.3vw, 16px);
      font-weight: 500; line-height: 1.35;
      overflow-wrap: anywhere;
      text-shadow: 0 0 8px rgba(255, 105, 160, .68);
      opacity: 0;
      will-change: transform, opacity;
      animation: messageDrift var(--drift-duration, 11s) linear forwards;
    }
    #floating-messages.board-visible { opacity: 0; visibility: hidden; }
    @keyframes messageDrift {
      0% { opacity: 0; transform: translate3d(12px, 0, 0); }
      12% { opacity: .9; }
      80% { opacity: .9; }
      100% { opacity: 0; transform: translate3d(-26px,0,0); }
    }
    @media (prefers-reduced-motion: reduce) {
      #floating-messages .floating-message { animation: none; opacity: .85; }
    }
  `;
  document.head.appendChild(boardStyle);

  function setupFloatingMessages(){
    const app=document.getElementById('app-content');
    const list=document.getElementById('message-list');
    const drawer=document.getElementById('board-drawer');
    if(!app || !list || !drawer || document.getElementById('floating-messages')) return;

    const layer=document.createElement('div');
    layer.id='floating-messages';
    layer.setAttribute('aria-hidden','true');
    app.appendChild(layer);

    let history=[];
    let recentIndex=0;
    // Reserve the full horizontal animation sweep plus text height for each
    // visible message. This prevents collisions throughout the drift.
    const occupied=new Map();
    function releaseMessage(item){
      occupied.delete(item);
      item.remove();
    }
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function boardIsOpen(){ return drawer.classList.contains('open'); }
    function syncBoardState(){
      const open=boardIsOpen();
      layer.classList.toggle('board-visible',open);
      if(open){layer.replaceChildren();occupied.clear();}
    }
    new MutationObserver(syncBoardState).observe(drawer,{attributes:true,attributeFilter:['class']});

    function updateHistory(){
      const items=Array.from(list.querySelectorAll('.msg-item'));
      if(!items.length) {
        // The original loader clears the list while fetching. Keep the previous
        // successful history in that temporary state.
        if(list.textContent.includes('云端空空如也')) history=[];
        return;
      }
      history=items.map(item=>{
        const user=item.querySelector('.msg-header span');
        const children=item.children;
        const text=children.length>1 ? children[children.length-1].textContent : '';
        return {user:user ? user.textContent.replace('👤','').trim() : '', text:text.trim()};
      }).filter(msg=>msg.text);
      recentIndex=0;
    }
    new MutationObserver(updateHistory).observe(list,{childList:true,subtree:false});
    updateHistory();

    function addFloatingMessage(){
      if(!history.length || boardIsOpen() || app.style.display==='none') return;
      if(layer.childElementCount>=7)return;
      const recent=history.slice(-25);
      const msg=recent[recent.length-1-(recentIndex%recent.length)];
      const item=document.createElement('div');
      item.className='floating-message';
      item.textContent=(msg.user ? msg.user+'：' : '')+msg.text;
      layer.appendChild(item);

      const width=app.clientWidth,height=app.clientHeight;
      const scale=Math.min(1,width/430,height/530);
      const heartWidth=155*scale;
      const heartHeight=115*scale;
      const itemWidth=item.offsetWidth || 120;
      const itemHeight=item.offsetHeight || 20;
      const padding=10;
      const minLeft=34;
      const maxLeft=Math.max(minLeft,width-itemWidth-22);
      const minTop=40;
      const maxTop=Math.max(minTop,height-itemHeight-32);

      // Test the entire drift envelope, not just initial text rectangles.
      // No suitable space? Skip this cycle instead of stacking messages.
      let placement=null;
      for(let attempt=0;attempt<80;attempt++){
        const x=width/2+(Math.random()*2-1)*heartWidth;
        const y=height/2+22+(Math.random()*2-1)*heartHeight;
        const left=Math.round(Math.max(minLeft,Math.min(maxLeft,x-itemWidth/2)));
        const top=Math.round(Math.max(minTop,Math.min(maxTop,y)));
        const rect={
          left:left-26-padding, right:left+itemWidth+12+padding,
          top:top-padding, bottom:top+itemHeight+padding
        };
        const collides=Array.from(occupied.values()).some(other=>
          rect.left<other.right && rect.right>other.left &&
          rect.top<other.bottom && rect.bottom>other.top
        );
        if(!collides){placement={left,top,rect};break;}
      }
      if(!placement){item.remove();return;}
      item.style.left=placement.left+'px';
      item.style.top=placement.top+'px';
      occupied.set(item,placement.rect);
      recentIndex++;
      if(reduced){
        while(layer.childElementCount>5)releaseMessage(layer.firstElementChild);
      } else {
        const duration=10+Math.random()*4;
        item.style.setProperty('--drift-duration',duration+'s');
        item.addEventListener('animationend',()=>releaseMessage(item),{once:true});
      }
    }
    function whenVisible(){
      if(app.style.display==='none')return;
      // Initial historical messages are loaded by checkLogin() on login.
      if(layer.childElementCount===0 && history.length) {
        addFloatingMessage();addFloatingMessage();
      }
    }
    new MutationObserver(whenVisible).observe(app,{attributes:true,attributeFilter:['style']});
    // Recalculate lanes after orientation/viewport changes.
    window.addEventListener('resize',()=>{occupied.clear();layer.replaceChildren();},{passive:true});
    syncBoardState();
    setInterval(()=>{
      if(app.style.display==='none')return;
      addFloatingMessage();
    },2600);
    // Refresh the original GitHub-backed list periodically so new messages
    // from the other user can appear without reopening the panel.
    setInterval(()=>{
      if(app.style.display==='none' || boardIsOpen())return;
      if(typeof window.loadMessagesFromGitHub==='function') {
        window.loadMessagesFromGitHub().catch(error=>console.warn('Floating message refresh:',error));
      }
    },60000);
  }
  setupFloatingMessages();

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
