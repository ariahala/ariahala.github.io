/* A wireframe interpretation of the pencil drawing: beads, coils, and a sphere. */
(() => {
  'use strict';

  const tau = Math.PI * 2;

  function curve(points, opacity = 1, weight = 1) {
    return { points, opacity, weight };
  }

  function sample(fn, count = 64) {
    return Array.from({ length: count + 1 }, (_, i) => fn(i / count));
  }

  function globe(large = false) {
    const lines = [];
    const meridians = large ? 18 : 10;
    for (let i = 0; i < meridians; i++) {
      const longitude = tau * i / meridians;
      lines.push(curve(sample(t => {
        const latitude = Math.PI * t;
        const twist = large ? .08 * Math.sin(latitude * 2) : .5 * Math.cos(latitude);
        return [Math.sin(latitude) * Math.cos(longitude + twist),
          Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude + twist)];
      }), large ? .48 : .82));
    }
    for (let i = 1; i < (large ? 8 : 4); i++) {
      const latitude = Math.PI * i / (large ? 8 : 4);
      lines.push(curve(sample(t => [Math.sin(latitude) * Math.cos(tau * t),
        Math.cos(latitude), Math.sin(latitude) * Math.sin(tau * t)]), large ? .22 : .38));
    }
    lines.push(curve(sample(t => [Math.cos(tau * t), 0, Math.sin(tau * t)]), 1, 1.4));
    // The gathered inner ribs echo the spindle shapes inside the drawn spheres.
    for (let i = 0; i < (large ? 8 : 6); i++) {
      lines.push(curve(sample(t => {
        const radius = Math.sin(Math.PI * t) ** 1.8 * (large ? .18 : .55);
        const angle = tau * i / (large ? 8 : 6) + 2.2 * t;
        return [radius * Math.cos(angle), 2 * t - 1, radius * Math.sin(angle)];
      }), .7));
    }
    if (large) {
      lines.push(curve(sample(t => [.24 * Math.cos(tau * t), -.04,
        .24 * Math.sin(tau * t)]), .8, 1.2));
    }
    return lines;
  }

  function pod() {
    const lines = [];
    for (let i = 0; i < 9; i++) {
      lines.push(curve(sample(t => {
        const radius = Math.sin(Math.PI * t) ** 1.25;
        const angle = tau * i / 9 + 1.65 * t;
        return [radius * Math.cos(angle), 2 * t - 1, radius * Math.sin(angle)];
      }), .8));
    }
    return lines;
  }

  function coil() {
    const lines = [];
    for (let i = 0; i < 4; i++) {
      lines.push(curve(sample(t => {
        const radius = .08 + .72 * Math.sin(Math.PI * t) ** 1.5;
        const angle = tau * (2.4 * t + i / 4);
        return [radius * Math.cos(angle), 2 * t - 1, radius * Math.sin(angle)];
      }, 96), .9));
    }
    lines.push(curve([[0, -1, 0], [0, 1, 0]], .3));
    return lines;
  }

  window.createDrawingSurfaceScene = ({ context, compact, artwork, side = 1 }) => {
    const meshes = { globe: globe(), pod: pod(), coil: coil() };
    const central = globe(true);
    // Each hanging strand has its own rhythm; nothing resets at a screen edge.
    const strands = [
      { x: .08, phase: .2, beads: [[.15, 'globe', .075], [.47, 'pod', .045], [.84, 'globe', .07]] },
      { x: .2, phase: 2.1, beads: [[.08, 'coil', .035], [.31, 'globe', .055], [.69, 'coil', .035], [.92, 'pod', .04]] },
      { x: .32, phase: 4.4, beads: [[.14, 'pod', .035], [.83, 'globe', .043]] },
      { x: .45, phase: 1.3, beads: [[.04, 'globe', .025], [.91, 'coil', .03]] },
      { x: .57, phase: 3.7, beads: [[.11, 'coil', .03], [.85, 'pod', .028]] },
      { x: .7, phase: 5.2, beads: [[.08, 'globe', .072], [.27, 'pod', .035], [.81, 'globe', .065]] },
      { x: .82, phase: 2.9, beads: [[.14, 'coil', .045], [.38, 'globe', .039], [.7, 'pod', .035], [.95, 'coil', .04]] },
      { x: .94, phase: 4.9, beads: [[.26, 'pod', .075], [.53, 'globe', .065], [.86, 'globe', .08]] }
    ];
    const buckets = Array.from({ length: 6 }, () => []);

    function add(lines, center, size, rotation, opacity = 1, stretch = 1) {
      const [ax, ay, az] = rotation;
      const sx = Math.sin(ax), cx = Math.cos(ax);
      const sy = Math.sin(ay), cy = Math.cos(ay);
      const sz = Math.sin(az), cz = Math.cos(az);
      for (const line of lines) {
        let previous = null;
        for (const [x, rawY, z] of line.points) {
          const y = rawY * stretch;
          const y1 = y * cx - z * sx;
          const z1 = y * sx + z * cx;
          const x2 = x * cy + z1 * sy;
          const z2 = -x * sy + z1 * cy;
          const perspective = 1 / (1 - z2 * .09);
          const point = [center[0] + (x2 * cz - y1 * sz) * size * perspective,
            center[1] - (x2 * sz + y1 * cz) * size * perspective, z2];
          if (previous) {
            const depth = Math.max(0, Math.min(5, Math.floor(3 + (z2 + previous[2]) * 1.15)));
            buckets[depth].push([previous[0], previous[1], point[0], point[1],
              line.opacity * opacity, line.weight]);
          }
          previous = point;
        }
      }
    }

    function strandX(strand, y, time, width) {
      return width * (strand.x + .018 * Math.sin(y * tau * 1.4 + strand.phase + time * .12)
        + .012 * Math.sin(time * .09 + strand.phase));
    }

    return {
      render(width, height, scroll, time, marginFade) {
        context.clearRect(0, 0, width, height);
        for (const bucket of buckets) bucket.length = 0;
        const unit = Math.min(width, height);
        const center = [width * (.5 + (artwork ? 0 : side * .27)) + unit * .012 * Math.sin(time * .08),
          height * (.49 - .025 * scroll) + unit * .008 * Math.cos(time * .1)];
        const radius = Math.min(width * .29, height * (artwork ? .31 : .39));

        for (const strand of strands) {
          if (compact && (strand.x === .45 || strand.x === .57)) continue;
          const sway = .026 * Math.sin(time * .13 + strand.phase);
          const spine = sample(t => {
            const y = t * 1.16 - .08;
            return [strandX(strand, y, time, width), height * y, 0];
          }, 100);
          // Draw the continuous, gently waving threads beneath the beads.
          context.beginPath();
          context.moveTo(spine[0][0], spine[0][1]);
          for (const point of spine) context.lineTo(point[0], point[1]);
          context.strokeStyle = artwork ? 'rgba(72,72,72,.14)' : 'rgba(72,72,72,.075)';
          context.lineWidth = .6;
          context.stroke();

          for (let i = 0; i < strand.beads.length; i++) {
            const [baseY, type, scale] = strand.beads[i];
            const y = baseY + sway + .009 * Math.sin(time * .21 + i * 2 + strand.phase);
            const x = strandX(strand, y, time, width);
            const size = unit * scale;
            const turn = time * (i % 2 ? -.095 : .08) + strand.phase + scroll * .8;
            add(meshes[type], [x, height * y], size,
              [.12 + .1 * Math.sin(time * .1 + strand.phase), turn,
                .14 * Math.sin(time * .13 + strand.phase + i)], .86,
              type === 'globe' ? 1.05 : 2.1);
          }
        }

        add(central, center, radius, [.16 + .04 * Math.sin(time * .08),
          time * .045 + scroll * .6, -.05 + .025 * Math.sin(time * .09)], 1, 1.04);

        // One path per opacity/weight group keeps the animation light on phones.
        context.lineCap = 'round';
        for (let depth = 0; depth < buckets.length; depth++) {
          const groups = new Map();
          for (const segment of buckets[depth]) {
            const key = `${Math.round(segment[4] * 10)},${segment[5]}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(segment);
          }
          for (const [key, segments] of groups) {
            const [opacity, weight] = key.split(',').map(Number);
            const alpha = (artwork ? .22 : .12) + depth * (artwork ? .04 : .02);
            context.strokeStyle = `rgba(72,72,72,${alpha * opacity / 10})`;
            context.lineWidth = (artwork ? .8 : .65) * weight;
            context.beginPath();
            for (const [x0, y0, x1, y1] of segments) {
              context.moveTo(x0, y0);
              context.lineTo(x1, y1);
            }
            context.stroke();
          }
        }

        if (!artwork) {
          context.save();
          context.globalCompositeOperation = 'destination-in';
          context.fillStyle = marginFade;
          context.fillRect(0, 0, width, height);
          context.restore();
        }
      }
    };
  };
})();
