/*
 * One monochrome surface per page load. Native canvas keeps this static site
 * self-contained: no CDN, WebGL requirement, tracking, or continuous idle loop.
 * All coordinate normalizations are uniform, preserving the minimal surfaces.
 * The Schwarz P candidate is explicitly a nodal approximation, not the exact
 * minimal Schwarz P surface.
 */
(() => {
  'use strict';

  if (document.querySelector('.minimal-surface-background')) return;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;

  canvas.className = 'minimal-surface-background';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const tau = 2 * Math.PI;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compact = window.matchMedia('(max-width: 700px)').matches;
  const density = compact ? .65 : 1;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  // Weld coincident vertices and draw each edge once, including polar seams.
  function meshBuilder() {
    const vertices = [];
    const edges = [];
    const vertexIds = new Map();
    const edgeIds = new Set();

    function vertex(point) {
      const key = point.map(value => Math.round(value * 1e7)).join(',');
      if (vertexIds.has(key)) return vertexIds.get(key);
      const index = vertices.length;
      vertexIds.set(key, index);
      vertices.push(point);
      return index;
    }

    function edge(a, b) {
      if (a === b) return;
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (edgeIds.has(key)) return;
      edgeIds.add(key);
      edges.push([a, b]);
    }

    function triangle(a, b, c) {
      edge(a, b);
      edge(b, c);
      edge(c, a);
    }

    function finish() {
      const minimum = [Infinity, Infinity, Infinity];
      const maximum = [-Infinity, -Infinity, -Infinity];
      for (const point of vertices) {
        for (let axis = 0; axis < 3; axis++) {
          minimum[axis] = Math.min(minimum[axis], point[axis]);
          maximum[axis] = Math.max(maximum[axis], point[axis]);
        }
      }
      const center = minimum.map((value, axis) => (value + maximum[axis]) / 2);
      let radius = 0;
      for (const point of vertices) {
        for (let axis = 0; axis < 3; axis++) point[axis] -= center[axis];
        radius = Math.max(radius, Math.hypot(...point));
      }
      for (const point of vertices) {
        for (let axis = 0; axis < 3; axis++) point[axis] /= radius || 1;
      }
      return { vertices, edges };
    }

    return { vertex, triangle, finish };
  }

  function grid(fn, u0, u1, v0, v1, columns, rows) {
    const builder = meshBuilder();
    const indices = [];
    const nu = Math.max(12, Math.round(columns * density));
    const nv = Math.max(12, Math.round(rows * density));
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        indices.push(builder.vertex(fn(u0 + (u1 - u0) * i / nu,
          v0 + (v1 - v0) * j / nv)));
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i;
        const b = a + 1;
        const c = a + nu + 1;
        const d = c + 1;
        builder.triangle(indices[a], indices[c], indices[b]);
        builder.triangle(indices[b], indices[c], indices[d]);
      }
    }
    return builder.finish();
  }

  // Weierstrass data g(z) = z^m: the real parts of its polynomial integrals.
  function enneper(order) {
    const limit = order === 1 ? 1.55 : order === 3 ? 1.32 : 1.23;
    return grid((r, theta) => {
      const k = 2 * order + 1;
      const x = r * Math.cos(theta) - r ** k * Math.cos(k * theta) / k;
      const y = -r * Math.sin(theta) - r ** k * Math.sin(k * theta) / k;
      const z = 2 * r ** (order + 1) * Math.cos((order + 1) * theta) / (order + 1);
      return [x, z, y];
    }, 0, limit, 0, tau, 34, 112);
  }

  function scherk() {
    return grid((u, v) => [u, Math.log(Math.cos(v) / Math.cos(u)), v],
      -1.43, 1.43, -1.43, 1.43, 56, 56);
  }

  function associate() {
    const angle = Math.PI * .31;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return grid((u, v) => [
      c * Math.cosh(v) * Math.cos(u) + s * Math.sinh(v) * Math.sin(u),
      c * v + s * u,
      c * Math.cosh(v) * Math.sin(u) - s * Math.sinh(v) * Math.cos(u)
    ], -Math.PI * 1.35, Math.PI * 1.35, -1.2, 1.2, 100, 36);
  }

  function schwarzPNodalApproximation() {
    const builder = meshBuilder();
    const count = compact ? 14 : 20;
    const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
      [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
    const tetrahedra = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6],
      [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];

    for (let iz = 0; iz < count; iz++) {
      for (let iy = 0; iy < count; iy++) {
        for (let ix = 0; ix < count; ix++) {
          const points = corners.map(([x, y, z]) => [
            -Math.PI + tau * (ix + x) / count,
            -Math.PI + tau * (iy + y) / count,
            -Math.PI + tau * (iz + z) / count
          ]);
          const values = points.map(([x, y, z]) => Math.cos(x) + Math.cos(y) + Math.cos(z));
          const crossing = (a, b) => {
            const t = values[a] / (values[a] - values[b]);
            return builder.vertex(points[a].map((value, axis) =>
              value + t * (points[b][axis] - value)));
          };
          for (const tetrahedron of tetrahedra) {
            const inside = tetrahedron.filter(index => values[index] < 0);
            const outside = tetrahedron.filter(index => values[index] >= 0);
            if (!inside.length || !outside.length) continue;
            if (inside.length === 2) {
              const [a, b] = inside;
              const [c, d] = outside;
              const ac = crossing(a, c);
              const ad = crossing(a, d);
              const bc = crossing(b, c);
              const bd = crossing(b, d);
              builder.triangle(ac, ad, bc);
              builder.triangle(bc, ad, bd);
            } else {
              const single = inside.length === 1 ? inside[0] : outside[0];
              const other = inside.length === 1 ? outside : inside;
              builder.triangle(...other.map(index => crossing(single, index)));
            }
          }
        }
      }
    }
    return builder.finish();
  }

  const presets = [
    { name: 'enneper', make: () => enneper(1), tilt: .52 },
    { name: 'enneper-order-3', make: () => enneper(3), tilt: .75 },
    { name: 'enneper-order-5', make: () => enneper(5), tilt: .72 },
    { name: 'scherk', make: scherk, tilt: .44 },
    { name: 'catenoid-helicoid-associate', make: associate, tilt: .38, edgeOffset: .24 },
    { name: 'schwarz-p-nodal-approximation', make: schwarzPNodalApproximation, tilt: .54 }
  ];

  // No persistence: a fresh load makes a fresh choice, fixed until the next load.
  const preset = presets[Math.floor(Math.random() * presets.length)];
  const side = Math.random() < .5 ? -1 : 1;
  const initialTurn = -.65 + Math.random() * .3;
  const geometry = preset.make();
  canvas.dataset.surface = preset.name;

  const projected = geometry.vertices.map(() => [0, 0, 0]);
  const buckets = Array.from({ length: 7 }, () => []);
  let width = 0;
  let height = 0;
  let scrollRange = 1;
  let targetScroll = 0;
  let currentScroll = 0;
  let frame = 0;
  let previousTime = 0;
  let marginFade = null;

  function updateFade() {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 17;
    marginFade = context.createLinearGradient(0, 0, width, 0);
    if (width <= 58 * rem) {
      marginFade.addColorStop(0, 'rgba(0,0,0,.75)');
      marginFade.addColorStop(.15, 'rgba(0,0,0,.075)');
      marginFade.addColorStop(.85, 'rgba(0,0,0,.075)');
      marginFade.addColorStop(1, 'rgba(0,0,0,.75)');
    } else {
      marginFade.addColorStop(0, '#000');
      marginFade.addColorStop((width / 2 - 23 * rem) / width, '#000');
      marginFade.addColorStop((width / 2 - 16 * rem) / width, 'rgba(0,0,0,.1)');
      marginFade.addColorStop((width / 2 + 16 * rem) / width, 'rgba(0,0,0,.1)');
      marginFade.addColorStop((width / 2 + 23 * rem) / width, '#000');
      marginFade.addColorStop(1, '#000');
    }
  }

  function readScroll() {
    return clamp(window.scrollY / scrollRange, 0, 1);
  }

  function render(t) {
    context.clearRect(0, 0, width, height);
    const ax = preset.tilt + .28 * t;
    const ay = initialTurn + 1.8 * t;
    const az = -.22 + .2 * Math.sin(Math.PI * t);
    const sx = Math.sin(ax), cx = Math.cos(ax);
    const sy = Math.sin(ay), cy = Math.cos(ay);
    const sz = Math.sin(az), cz = Math.cos(az);
    const scale = Math.max(width * .64, height * .74);
    const centerX = width * (.5 + side * ((preset.edgeOffset || .075) - .035 * Math.sin(Math.PI * t)));
    const centerY = height * (.49 - .12 * t);

    for (let i = 0; i < geometry.vertices.length; i++) {
      const [x, y, z] = geometry.vertices[i];
      const y1 = y * cx - z * sx;
      const z1 = y * sx + z * cx;
      const x2 = x * cy + z1 * sy;
      const z2 = -x * sy + z1 * cy;
      const perspective = 1 / (1 - z2 / 5.5);
      projected[i][0] = centerX + (x2 * cz - y1 * sz) * scale * perspective;
      projected[i][1] = centerY - (x2 * sz + y1 * cz) * scale * perspective;
      projected[i][2] = z2;
    }

    for (const bucket of buckets) bucket.length = 0;
    for (const edge of geometry.edges) {
      const a = projected[edge[0]];
      const b = projected[edge[1]];
      if ((a[0] < 0 && b[0] < 0) || (a[0] > width && b[0] > width) ||
          (a[1] < 0 && b[1] < 0) || (a[1] > height && b[1] > height)) continue;
      const depth = clamp(Math.floor(((a[2] + b[2]) * .25 + .5) * buckets.length),
        0, buckets.length - 1);
      buckets[depth].push(edge);
    }

    context.lineWidth = .65;
    context.lineCap = 'round';
    for (let i = 0; i < buckets.length; i++) {
      context.beginPath();
      // Only opacity varies with depth; every line stays neutral gray.
      context.strokeStyle = `rgba(72,72,72,${.13 + .10 * i / (buckets.length - 1)})`;
      for (const [a, b] of buckets[i]) {
        context.moveTo(projected[a][0], projected[a][1]);
        context.lineTo(projected[b][0], projected[b][1]);
      }
      context.stroke();
    }

    // Bake the fade into the pixels instead of masking the fixed layer in CSS.
    context.save();
    context.globalCompositeOperation = 'destination-in';
    context.fillStyle = marginFade;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  function tick(time) {
    frame = 0;
    if (document.hidden) return;
    if (reducedMotion.matches) {
      render(0);
      previousTime = 0;
      return;
    }
    const dt = previousTime ? Math.min(time - previousTime, 64) : 16;
    previousTime = time;
    currentScroll += (targetScroll - currentScroll) * (1 - Math.exp(-dt / 85));
    if (Math.abs(targetScroll - currentScroll) < .00015) {
      currentScroll = targetScroll;
      previousTime = 0;
    }
    render(currentScroll);
    if (currentScroll !== targetScroll) frame = requestAnimationFrame(tick);
  }

  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function resize() {
    width = document.documentElement.clientWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    updateFade();
    scrollRange = Math.max(1, document.documentElement.scrollHeight - height);
    targetScroll = readScroll();
    currentScroll = targetScroll;
    schedule();
  }

  window.addEventListener('scroll', () => {
    targetScroll = readScroll();
    if (!reducedMotion.matches) schedule();
  }, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pageshow', resize);
  window.addEventListener('load', resize, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    } else resize();
  });
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', resize);
  else reducedMotion.addListener(resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(document.body);
  resize();
})();
