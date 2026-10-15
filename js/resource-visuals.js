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

  // Exact minimal parametrizations. Geometry is sampled once per page load.
  const surfaces = [
    { id: 'catenoid', name: 'Catenoid', description: 'a minimal surface joining two circles',
      u: [0, tau], v: [-1.2, 1.2], columns: 96, rows: 24, stride: 4, periodic: true,
      point: (u, v) => [Math.cosh(v) * Math.cos(u), Math.cosh(v) * Math.sin(u), v] },
    { id: 'helicoid', name: 'Helicoid', description: 'a spiraling minimal surface',
      u: [-1.25 * Math.PI, 1.25 * Math.PI], v: [-1.8, 1.8], columns: 96, rows: 24, stride: 4,
      point: (u, v) => [v * Math.cos(u), v * Math.sin(u), .65 * u] },
    { id: 'enneper', name: 'Enneper’s surface', description: 'a minimal immersion with a curved saddle shape',
      u: [0, tau], v: [0, 1.45], columns: 96, rows: 24, stride: 4, periodic: true,
      point: (angle, r) => {
        const u = r * Math.cos(angle), v = r * Math.sin(angle);
        return [u - u ** 3 / 3 + u * v * v, v - v ** 3 / 3 + u * u * v, u * u - v * v];
      } },
    { id: 'scherk', name: 'Scherk’s surface', description: 'a saddle-shaped minimal graph',
      u: [-1.3, 1.3], v: [-1.3, 1.3], columns: 48, rows: 24, stride: 2,
      point: (u, v) => [u, v, Math.log(Math.cos(v) / Math.cos(u))] }
  ];

  function chooseSurface() {
    let previousSurface;
    try { previousSurface = sessionStorage.getItem('resource-minimal-surface'); } catch (_) {}
    const choices = surfaces.filter(surface => surface.id !== previousSurface);
    const surface = choices[Math.floor(Math.random() * choices.length)];
    try { sessionStorage.setItem('resource-minimal-surface', surface.id); } catch (_) {}
    return surface;
  }

  function surfaceMesh(surface) {
    const { columns, rows, stride, point, u, v } = surface;
    const vertices = [], edges = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
      vertices.push(point(u[0] + (u[1] - u[0]) * i / columns, v[0] + (v[1] - v[0]) * j / rows));
    }
    function edge(a, b, major) {
      if (Math.hypot(...vertices[a].map((value, axis) => value - vertices[b][axis])) > 1e-9) edges.push({ a, b, major });
    }
    for (let j = 0; j <= rows; j++) for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i;
      edge(a, a + 1, j === 0 || j === rows || j === rows / 2);
    }
    for (let i = 0; i <= columns; i += stride) {
      if (surface.periodic && i === columns) continue;
      for (let j = 0; j < rows; j++) {
        const a = j * (columns + 1) + i;
        edge(a, a + columns + 1, !surface.periodic && (i === 0 || i === columns));
      }
    }
    const center = [0, 1, 2].map(axis => (Math.min(...vertices.map(p => p[axis])) + Math.max(...vertices.map(p => p[axis]))) / 2);
    for (const p of vertices) for (let axis = 0; axis < 3; axis++) p[axis] -= center[axis];
    const radius = Math.max(...vertices.map(p => Math.hypot(...p)));
    // A single scale preserves the surface and fits every rotation inside the card.
    for (const p of vertices) for (let axis = 0; axis < 3; axis++) p[axis] /= radius;
    return { vertices, edges };
  }

  function projectSurface(mesh, time) {
    const tilt = .92 + .17 * Math.sin(time * .24);
    const turn = -.38 + .14 * Math.sin(time * .19);
    const projected = mesh.vertices.map(([x, y, z]) => {
      const yy = y * Math.cos(tilt) - z * Math.sin(tilt);
      const zz = y * Math.sin(tilt) + z * Math.cos(tilt);
      return [260 + 180 * (x * Math.cos(turn) + zz * Math.sin(turn)), 200 - 180 * yy, zz * Math.cos(turn) - x * Math.sin(turn)];
    });
    return mesh.edges.map(({ a, b, major }) => ({ a: projected[a], b: projected[b], major,
      depth: (projected[a][2] + projected[b][2]) / 2 })).sort((a, b) => a.depth - b.depth);
  }

  const surfaceOpacity = (major, depth) => (major ? .52 : .12) + .27 * (depth + 1) / 2;
  const surfaceCanvas = canvases.find(canvas => canvas.dataset.resourceVisual === 'minimal-surface');
  const surface = surfaceCanvas ? chooseSurface() : null;
  const mesh = surface ? surfaceMesh(surface) : null;
  if (surfaceCanvas) {
    surfaceCanvas.dataset.surface = surface.id;
    surfaceCanvas.setAttribute('aria-label', `A slowly turning wireframe of ${surface.name}, ${surface.description}. A different surface is chosen on refresh.`);
    document.getElementById('resource-surface-label').textContent = surface.name;
    // Keep the no-motion/print fallback and its caption consistent with the selection.
    const paths = projectSurface(mesh, 0).map(({ a, b, major, depth }) =>
      `<path d="M${a[0].toFixed(2)},${a[1].toFixed(2)}L${b[0].toFixed(2)},${b[1].toFixed(2)}" stroke-opacity="${surfaceOpacity(major, depth).toFixed(3)}" stroke-width="${major ? 1.35 : .65}"/>`).join('');
    const fallback = surfaceCanvas.parentElement.querySelector('img');
    fallback.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 400"><title>${surface.name}</title><g fill="none" stroke="#26507b">${paths}</g></svg>`);
    fallback.alt = `A wireframe of ${surface.name}, ${surface.description}.`;
  }

  function minimalSurface(ctx, time) {
    const ink = dark ? '159,191,232' : '38,80,123';
    for (const { a, b, major, depth } of projectSurface(mesh, time)) {
      ctx.strokeStyle = `rgba(${ink},${surfaceOpacity(major, depth)})`;
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
      if (canvas.dataset.resourceVisual === 'minimal-surface') minimalSurface(ctx, elapsed);
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
