/*
 * Tiffany-blue WebGL flowing heart.
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

  // Moving Bezier segments follow a parametric heart contour.
  // Two light trails share the Tiffany-blue palette instead of pink/blue.
  const fragmentShaderSource = `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    #define POINT_COUNT 8

    vec2 points[POINT_COUNT];
    const float speed = -0.5;
    const float segmentStep = 0.25;

    vec2 getHeartPosition(float t) {
      return vec2(
        16.0 * pow(sin(t), 3.0),
        -(13.0 * cos(t) - 5.0 * cos(2.0*t)
          - 2.0 * cos(3.0*t) - cos(4.0*t))
      );
    }

    float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
      vec2 a = B - A;
      vec2 b = A - 2.0 * B + C;
      vec2 c = a * 2.0;
      vec2 d = A - pos;
      float bb = max(dot(b, b), 0.00000001);
      float kk = 1.0 / bb;
      float kx = kk * dot(a, b);
      float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
      float kz = kk * dot(d, a);
      float p = ky - kx*kx;
      float q = kx*(2.0*kx*kx - 3.0*ky) + kz;
      float h = q*q + 4.0*p*p*p;
      float res;
      if (h >= 0.0) {
        h = sqrt(h);
        vec2 x = (vec2(h, -h) - q) * 0.5;
        vec2 uv = sign(x) * pow(abs(x), vec2(1.0/3.0));
        float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
        vec2 v = d + (c + b*t)*t;
        res = length(v);
      } else {
        float z = sqrt(-p);
        float v = acos(clamp(q/(p*z*2.0), -1.0, 1.0)) / 3.0;
        float m = cos(v);
        float n = sin(v) * 1.732050808;
        vec3 t = clamp(vec3(m+m, -n-m, n-m) * z - kx, 0.0, 1.0);
        vec2 v = d + (c+b*t.x)*t.x;
        res = dot(v,v);
        v = d + (c+b*t.y)*t.y;
        res = min(res, dot(v,v));
        v = d + (c+b*t.z)*t.z;
        res = sqrt(min(res, dot(v,v)));
      }
      return res;
    }

    float getSegment(float t, vec2 pos, float offset, float scale) {
      for (int i=0; i<POINT_COUNT; i++) {
        points[i] = getHeartPosition(
          offset + float(i)*segmentStep + fract(speed*t)*6.2831853
        );
      }
      vec2 c = (points[0] + points[1]) * 0.5;
      vec2 prev;
      float dist = 10000.0;
      for (int i=0; i<POINT_COUNT-1; i++) {
        prev = c;
        c = (points[i] + points[i+1])*0.5;
        dist = min(dist, sdBezier(pos, scale*prev, scale*points[i], scale*c));
      }
      return max(dist, 0.00001);
    }

    void main() {
      // Preserve aspect ratio and a stationary heart silhouette.
      vec2 uv = gl_FragCoord.xy / resolution;
      vec2 pos = vec2(0.5) - uv;
      pos.y /= (resolution.x / resolution.y);
      pos.y += 0.02;
      float scale = 0.000015 * resolution.y;

      float d1 = getSegment(time, pos, 0.0, scale);
      float d2 = getSegment(time, pos, 3.4, scale);

      // #81D8D0 Tiffany blue + a paler cyan strand and white-hot cores.
      vec3 tiffany = vec3(0.506, 0.847, 0.816);
      vec3 pale = vec3(0.67, 0.97, 0.96);
      float glow1 = pow(0.015 / d1, 0.90);
      float glow2 = pow(0.015 / d2, 0.90);
      vec3 col = glow1*tiffany + glow2*pale;
      col += 7.0 * vec3(1.0) * (smoothstep(0.003, 0.001, d1)
                              + smoothstep(0.003, 0.001, d2));
      col = 1.0 - exp(-col);

      // Transparent away from the glow so the original purple backdrop remains.
      float alpha = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
      gl_FragColor = vec4(col, alpha);
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

  function startWebGLHeart() {
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
