/* Tiffany-blue beating particle heart. Load after the original inline script. */
(() => {
  'use strict';
  const COLOR = [129, 216, 208]; // #81D8D0
  const glow = (a) => 'rgba(' + COLOR.join(',') + ',' + a + ')';
  let started = false;

  function initBeatingHeart() {
    if (started) return;
    started = true;
    const canvas = document.getElementById('pinkboard');
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx) return;

    const motionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0, height = 0, size = 1, ratio = 1;
    const random = (a, b) => a + Math.random() * (b - a);

    // Classical parametric heart, normalized to approximately -1..1.
    function heartPoint(t) {
      return {
        x: 16 * Math.pow(Math.sin(t), 3) / 17,
        y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17
      };
    }

    const points = [];
    // Fill particles: distributed inside the heart, denser near the edge.
    for (let i = 0; i < 1750; ++i) {
      const theta = random(-Math.PI, Math.PI);
      const boundary = heartPoint(theta);
      const radius = Math.sqrt(Math.random());
      points.push({
        x: boundary.x * radius, y: boundary.y * radius,
        phase: random(0, Math.PI * 2), speed: random(.55, 1.6),
        r: random(.55, 1.65), strength: random(.38, .9),
        halo: Math.random() < .08, offset: 0
      });
    }
    // A brighter, more precise silhouette.
    for (let i = 0; i < 550; ++i) {
      const theta = random(-Math.PI, Math.PI);
      const boundary = heartPoint(theta);
      const thickness = random(.978, 1.025);
      points.push({
        x: boundary.x * thickness, y: boundary.y * thickness,
        phase: random(0, Math.PI * 2), speed: random(.6, 1.5),
        r: random(.85, 1.8), strength: random(.7, 1),
        halo: Math.random() < .12, offset: 0
      });
    }
    // A surrounding cloud of drifting Tiffany-blue dust.
    for (let i = 0; i < 360; ++i) {
      const theta = random(-Math.PI, Math.PI);
      const boundary = heartPoint(theta);
      const outward = random(1.06, 1.48);
      points.push({
        x: boundary.x * outward + random(-.04, .04),
        y: boundary.y * outward + random(-.04, .04),
        phase: random(0, Math.PI * 2), speed: random(.4, 1.2),
        r: random(.4, 1.05), strength: random(.12, .46),
        halo: false, offset: 1
      });
    }

    function resize() {
      width = canvas.clientWidth || innerWidth;
      height = canvas.clientHeight || innerHeight;
      ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      size = Math.min(width * .40, height * .47, 245);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const start = performance.now();
    function draw(now) {
      const elapsed = (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);

      // Lub-dub: two close pulses then a short rest.
      const beatPeriod = elapsed % 1.24;
      const pulse1 = Math.exp(-Math.pow((beatPeriod - .13) / .075, 2));
      const pulse2 = .52 * Math.exp(-Math.pow((beatPeriod - .37) / .085, 2));
      const beating = motionReduced ? 0 : pulse1 + pulse2;
      const scale = 1 + .075 * beating;
      const cx = width / 2;
      const cy = height / 2 + Math.min(22, height * .027);

      // Subtle diffused bloom behind the heart.
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.22);
      bloom.addColorStop(0, glow(.075 + beating * .035));
      bloom.addColorStop(.65, glow(.022));
      bloom.addColorStop(1, glow(0));
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 1.22, 0, Math.PI * 2);
      ctx.fill();

      for (const p of points) {
        const twinkle = motionReduced ? 1 : .76 + .24 * Math.sin(elapsed * p.speed * 3 + p.phase);
        const drift = motionReduced ? 0 : Math.sin(elapsed * p.speed + p.phase) * (p.offset ? 7 : 1.2);
        const x = cx + p.x * size * scale + drift;
        const y = cy + p.y * size * scale + (p.offset ? drift * .6 : 0);
        const alpha = Math.min(1, p.strength * twinkle * (1 + .25 * beating));
        ctx.fillStyle = glow(alpha);
        ctx.beginPath();
        ctx.arc(x, y, p.r * (1 + .12 * beating), 0, Math.PI * 2);
        ctx.fill();
        if (p.halo) {
          ctx.fillStyle = glow(alpha * .11);
          ctx.beginPath();
          ctx.arc(x, y, p.r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!motionReduced) requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // Override only the animation engine. Login and GitHub messages remain untouched.
  window.initHeart = initBeatingHeart;

  const css = document.createElement('style');
  css.textContent = `
    #greeting-text {
      color: #c6f8f3 !important;
      text-shadow: 0 0 14px rgba(129,216,208,.85),
                   0 0 30px rgba(129,216,208,.35) !important;
      top: calc(50% + 22px) !important;
    }
  `;
  document.head.appendChild(css);

  // Change only the on-screen greeting, including after the login timeout.
  const greeting = document.getElementById('greeting-text');
  if (greeting) {
    const update = () => {
      const t = greeting.textContent.trim();
      if (t === 'Jing ❤️ Allen' || t === 'Jing ❤ Allen') greeting.textContent = 'J❤️A';
      if (t === 'Allen ❤️ Jing' || t === 'Allen ❤ Jing') greeting.textContent = 'A❤️J';
    };
    new MutationObserver(update).observe(greeting, { childList: true, characterData: true, subtree: true });
    update();
  }
})();
