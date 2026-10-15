(() => {
  'use strict';
  const canvases = [...document.querySelectorAll('[data-resource-visual]')];
  const scenes = canvases.map(canvas => ({ canvas, context: canvas.getContext('2d') })).filter(scene => scene.context);
  if (!scenes.length) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('resource-motion-toggle');
  const tau = Math.PI * 2;
  let paused = motion.matches;
  let visible = true;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let drawn = 0;
  let dark = document.documentElement.dataset.theme === 'dark';

  function catenoid(ctx, time) {
    const tilt = .92 + .17 * Math.sin(time * .24);
    const turn = -.38 + .14 * Math.sin(time * .19);
    function point(u, v) {
      // Exact catenoid X(u,v) = (cosh(v) cos(u), cosh(v) sin(u), v).
      const x = Math.cosh(v) * Math.cos(u);
      const y = Math.cosh(v) * Math.sin(u);
      const z = v;
      const yy = y * Math.cos(tilt) - z * Math.sin(tilt);
      const zz = y * Math.sin(tilt) + z * Math.cos(tilt);
      return [260 + 92 * (x * Math.cos(turn) + zz * Math.sin(turn)), 200 - 92 * yy, zz * Math.cos(turn) - x * Math.sin(turn)];
    }
    const segments = [];
    function curve(fn, count, major) {
      let a = fn(0);
      for (let i = 1; i <= count; i++) {
        const b = fn(i / count);
        segments.push({ a, b, major, depth: (a[2] + b[2]) / 2 });
        a = b;
      }
    }
    for (let j = 0; j <= 20; j++) curve(t => point(t * tau, -1.2 + 2.4 * j / 20), 80, j === 0 || j === 20 || j === 10);
    for (let i = 0; i < 36; i++) curve(t => point(i * tau / 36, -1.2 + 2.4 * t), 40, false);
    segments.sort((a, b) => a.depth - b.depth);
    for (const { a, b, major, depth } of segments) {
      const ink = dark ? '159,191,232' : '38,80,123';
      ctx.strokeStyle = `rgba(${ink},${(major ? .52 : .12) + .27 * (depth + 2) / 4})`;
      ctx.lineWidth = major ? 1.35 : .65;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }

  function createVortices() {
    const counts = [2, 3, 4, 5, 6];
    let previousCount;
    try { previousCount = Number(sessionStorage.getItem('resource-vortex-count')); } catch (_) {}
    const choices = counts.filter(count => count !== previousCount);
    const count = choices[Math.floor(Math.random() * choices.length)];
    try { sessionStorage.setItem('resource-vortex-count', String(count)); } catch (_) {}
    const cores = [];
    for (let i = 0; i < count; i++) {
      let best, clearance = -1;
      // Bounded rejection sampling keeps cores distinct and inside the disk.
      for (let attempt = 0; attempt < 200; attempt++) {
        const angle = Math.random() * tau, radius = 118 * Math.sqrt(Math.random());
        const candidate = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
        const distance = Math.min(...cores.map(core => Math.hypot(candidate.x - core.x, candidate.y - core.y)));
        if (distance > clearance) { best = candidate; clearance = distance; }
        if (distance >= 64) break;
      }
      cores.push(best);
    }
    return cores;
  }

  // Prescribed degree-one factors, not a numerical GL solution:
  // u(z) = exp(i phase) product_j (z-a_j) / sqrt(|z-a_j|² + epsilon²).
  function vortexField(x, y, cores) {
    let angle = 0, amplitude = 1;
    for (const core of cores) {
      const dx = x - core.x, dy = y - core.y, radius = Math.hypot(dx, dy);
      angle += Math.atan2(dy, dx);
      amplitude *= radius / Math.hypot(radius, 20);
    }
    return { angle, amplitude };
  }

  const vortexCanvas = canvases.find(canvas => canvas.dataset.resourceVisual === 'vortex');
  const cores = vortexCanvas ? createVortices() : [];
  const wash = [], arrows = [];
  if (vortexCanvas) {
    vortexCanvas.setAttribute('aria-label', `An illustrative field with ${cores.length} degree-one vortices undergoing a global phase rotation. Arrow direction and color show phase; arrow length shows amplitude. The vortex count and positions change on refresh. This is not a numerical PDE solution.`);
    // Cache the spatial field once; resizing, pausing and theme changes keep its zeros.
    for (let y = -165; y < 165; y += 5) for (let x = -165; x < 165; x += 5) {
      if (Math.hypot(x + 2.5, y + 2.5) < 169) wash.push({ x, y, ...vortexField(x + 2.5, y + 2.5, cores) });
    }
    for (let y = -150; y <= 150; y += 20) for (let x = -150; x <= 150; x += 20) {
      if (Math.hypot(x, y) < 158) arrows.push({ x, y, ...vortexField(x, y, cores) });
    }
  }

  function vortex(ctx, time) {
    const phase = time * .18;
    const hue = angle => ((angle / tau * 360 + 225) % 360 + 360) % 360;
    // Only the global phase rotates; the sampled vortex configuration stays fixed.
    ctx.save();
    ctx.beginPath(); ctx.arc(260, 200, 165, 0, tau); ctx.clip();
    for (const sample of wash) {
      ctx.fillStyle = `hsla(${hue(sample.angle + phase)},38%,53%,${(dark ? .15 : .1) * sample.amplitude})`;
      ctx.fillRect(260 + sample.x, 200 - sample.y - 5, 5, 5);
    }
    ctx.restore();
    ctx.strokeStyle = dark ? '#b8b1c14f' : '#b7b1a53f'; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.arc(260, 200, 165, 0, tau); ctx.stroke();
    for (const { x, y, angle, amplitude } of arrows) {
      const theta = angle + phase;
      const length = 13 * amplitude, head = 3.5 * amplitude, wing = 2.5 * amplitude;
      const dx = Math.cos(theta), dy = -Math.sin(theta);
      const cx = 260 + x, cy = 200 - y;
      const ex = cx + dx * length / 2, ey = cy + dy * length / 2;
      ctx.strokeStyle = `hsla(${hue(theta)},${dark ? '52%,68%' : '38%,39%'},${.4 + .5 * amplitude})`;
      ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(cx - dx * length / 2, cy - dy * length / 2); ctx.lineTo(ex, ey);
      ctx.moveTo(ex - dx * head - dy * wing, ey - dy * head + dx * wing); ctx.lineTo(ex, ey);
      ctx.lineTo(ex - dx * head + dy * wing, ey - dy * head - dx * wing); ctx.stroke();
    }
    for (const core of cores) {
      const x = 260 + core.x, y = 200 - core.y;
      ctx.fillStyle = dark ? '#28262a' : '#fcfaf6';
      ctx.beginPath(); ctx.arc(x, y, 7, 0, tau); ctx.fill();
      ctx.strokeStyle = dark ? '#c2b4a3' : '#8d7f6d'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = dark ? '#c2b4a3' : '#8d7f6d';
      ctx.beginPath(); ctx.arc(x, y, 2, 0, tau); ctx.fill();
    }
  }

  function render() {
    for (const { canvas, context: ctx } of scenes) {
      ctx.clearRect(0, 0, 520, 400);
      if (canvas.dataset.resourceVisual === 'catenoid') catenoid(ctx, elapsed);
      else vortex(ctx, elapsed);
      canvas.parentElement.querySelector('img').hidden = true;
      canvas.removeAttribute('aria-hidden');
    }
  }
  // Repaint immediately on a mode change, including while motion is paused.
  new MutationObserver(() => {
    dark = document.documentElement.dataset.theme === 'dark';
    render();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  function schedule() {
    if (!frame && !paused && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function tick(time) {
    frame = 0;
    if (paused || !visible || document.hidden) { previous = 0; return; }
    elapsed += previous ? Math.min(time - previous, 80) / 1000 : 0;
    previous = time;
    if (time - drawn >= 1000 / 30) { render(); drawn = time; }
    schedule();
  }
  function resize() {
    for (const { canvas, context: ctx } of scenes) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(canvas.getBoundingClientRect().width * ratio);
      canvas.width = width;
      canvas.height = Math.round(width * 400 / 520);
      ctx.setTransform(width / 520, 0, 0, canvas.height / 400, 0, 0);
    }
    render(); schedule();
  }
  function setPaused(value) {
    paused = value; previous = 0;
    if (toggle) {
      document.getElementById('resource-motion-icon').setAttribute('d', paused ? 'M6 4 19 12 6 20Z' : 'M6 4h4v16H6zM14 4h4v16h-4z');
      document.getElementById('resource-motion-label').textContent = paused ? 'Resume motion' : 'Pause motion';
      toggle.setAttribute('aria-pressed', String(paused));
    }
    if (paused) { cancelAnimationFrame(frame); frame = 0; }
    else schedule();
  }
  if (toggle) {
    toggle.parentElement.hidden = false;
    toggle.addEventListener('click', () => setPaused(!paused));
  }
  motion.addEventListener('change', () => setPaused(motion.matches));
  document.addEventListener('visibilitychange', () => {
    previous = 0;
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else schedule();
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    previous = 0; schedule();
  }).observe(document.querySelector('.resource-portals'));
  window.addEventListener('resize', resize, { passive: true });
  setPaused(paused); resize();
})();
