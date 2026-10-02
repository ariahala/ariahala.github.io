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
    const trace = fn => sample(fn, large ? 64 : 40);
    const meridians = large ? 18 : 10;
    for (let i = 0; i < meridians; i++) {
      const longitude = tau * i / meridians;
      lines.push(curve(trace(t => {
        const latitude = Math.PI * t;
        const twist = large ? .08 * Math.sin(latitude * 2) : .5 * Math.cos(latitude);
        return [Math.sin(latitude) * Math.cos(longitude + twist),
          Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude + twist)];
      }), large ? .48 : .82));
    }
    for (let i = 1; i < (large ? 8 : 4); i++) {
      const latitude = Math.PI * i / (large ? 8 : 4);
      lines.push(curve(trace(t => [Math.sin(latitude) * Math.cos(tau * t),
        Math.cos(latitude), Math.sin(latitude) * Math.sin(tau * t)]), large ? .22 : .38));
    }
    lines.push(curve(trace(t => [Math.cos(tau * t), 0, Math.sin(tau * t)]), 1, 1.4));
    // The gathered inner ribs echo the spindle shapes inside the drawn spheres.
    for (let i = 0; i < (large ? 8 : 6); i++) {
      lines.push(curve(trace(t => {
        const radius = Math.sin(Math.PI * t) ** 1.8 * (large ? .18 : .55);
        const angle = tau * i / (large ? 8 : 6) + 2.2 * t;
        return [radius * Math.cos(angle), 2 * t - 1, radius * Math.sin(angle)];
      }), .7));
    }
    if (large) {
      lines.push(curve(trace(t => [.24 * Math.cos(tau * t), -.04,
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
      }, 48), .8));
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
      }, 72), .9));
    }
    lines.push(curve([[0, -1, 0], [0, 1, 0]], .3));
    return lines;
  }

  function curlyTube() {
    const lines = [];
    // A narrow tube whose centerline curls, with ribs and round cross sections.
    function point(t, angle) {
      const turn = tau * 1.65 * t;
      const radius = .13 + .055 * Math.sin(Math.PI * t);
      return [.48 * Math.sin(turn) + radius * Math.cos(angle),
        2 * t - 1, .3 * Math.cos(turn) + radius * Math.sin(angle)];
    }
    for (let i = 0; i < 6; i++) {
      lines.push(curve(sample(t => point(t, tau * i / 6), 64), .75));
    }
    for (let i = 0; i <= 12; i++) {
      lines.push(curve(sample(t => point(i / 12, tau * t), 16), .48));
    }
    return lines;
  }

  window.createDrawingSurfaceScene = ({ context, compact, artwork, side = 1 }) => {
    // Reuse projection buffers and style groups instead of allocating thousands
    // of points, segments, and string keys during each scrolling frame.
    const styles = [];
    const styleIds = new Map();
    function prepare(lines, opacity) {
      return lines.map(line => {
        const alpha = Math.round(line.opacity * opacity * 10) / 10;
        const key = `${alpha},${line.weight}`;
        if (!styleIds.has(key)) {
          styleIds.set(key, styles.length);
          styles.push({ alpha, weight: line.weight,
            buckets: Array.from({ length: 6 }, () => ({ data: new Float32Array(1024), length: 0 })) });
        }
        return { points: new Float64Array(line.points.flat()), style: styles[styleIds.get(key)] };
      });
    }
    const meshes = { globe: prepare(globe(), .86), pod: prepare(pod(), .86),
      coil: prepare(coil(), .86), tube: prepare(curlyTube(), .86) };
    const central = prepare(globe(true), 1);
    // Each hanging strand has its own rhythm; nothing resets at a screen edge.
    const strands = [
      { x: .08, phase: .2, beads: [[.15, 'globe', .075], [.47, 'pod', .045], [.84, 'globe', .07]] },
      { x: .135, phase: 1.6, beads: [[.04, 'pod', .026], [.35, 'tube', .033], [.64, 'globe', .032]] },
      { x: .2, phase: 2.1, beads: [[.08, 'coil', .035], [.31, 'globe', .055], [.69, 'coil', .035], [.92, 'pod', .04]] },
      { x: .255, phase: 3.4, beads: [[.24, 'coil', .025], [.52, 'tube', .023], [.78, 'pod', .026]] },
      { x: .32, phase: 4.4, beads: [[.14, 'pod', .035], [.48, 'tube', .026], [.83, 'globe', .043]] },
      { x: .45, phase: 1.3, beads: [[.04, 'globe', .025], [.91, 'coil', .03]] },
      { x: .57, phase: 3.7, beads: [[.11, 'coil', .03], [.85, 'pod', .028]] },
      { x: .7, phase: 5.2, beads: [[.08, 'globe', .072], [.27, 'pod', .035], [.54, 'tube', .021], [.81, 'globe', .065]] },
      { x: .76, phase: .9, beads: [[.36, 'tube', .026], [.58, 'globe', .032], [.96, 'pod', .026]] },
      { x: .82, phase: 2.9, beads: [[.14, 'coil', .045], [.38, 'globe', .039], [.7, 'pod', .035], [.95, 'coil', .04]] },
      { x: .885, phase: 6.1, beads: [[.05, 'globe', .03], [.52, 'tube', .032], [.74, 'coil', .024]] },
      { x: .94, phase: 4.9, beads: [[.26, 'pod', .075], [.53, 'globe', .065], [.86, 'globe', .08]] }
    ];
    function add(lines, center, size, rotation, stretch = 1) {
      const [ax, ay, az] = rotation;
      const sx = Math.sin(ax), cx = Math.cos(ax);
      const sy = Math.sin(ay), cy = Math.cos(ay);
      const sz = Math.sin(az), cz = Math.cos(az);
      for (const line of lines) {
        let previousX = 0, previousY = 0, previousZ = 0;
        const points = line.points;
        for (let i = 0; i < points.length; i += 3) {
          const x = points[i], y = points[i + 1] * stretch, z = points[i + 2];
          const y1 = y * cx - z * sx;
          const z1 = y * sx + z * cx;
          const x2 = x * cy + z1 * sy;
          const z2 = -x * sy + z1 * cy;
          const perspective = 1 / (1 - z2 * .09);
          const pointX = center[0] + (x2 * cz - y1 * sz) * size * perspective;
          const pointY = center[1] - (x2 * sz + y1 * cz) * size * perspective;
          if (i) {
            const depth = Math.max(0, Math.min(5, Math.floor(3 + (z2 + previousZ) * 1.15)));
            const bucket = line.style.buckets[depth];
            if (bucket.length + 4 > bucket.data.length) {
              const larger = new Float32Array(bucket.data.length * 2);
              larger.set(bucket.data);
              bucket.data = larger;
            }
            bucket.data[bucket.length++] = previousX;
            bucket.data[bucket.length++] = previousY;
            bucket.data[bucket.length++] = pointX;
            bucket.data[bucket.length++] = pointY;
          }
          previousX = pointX;
          previousY = pointY;
          previousZ = z2;
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
        for (const style of styles) {
          for (const bucket of style.buckets) bucket.length = 0;
        }
        const unit = Math.min(width, height);
        const center = [width * (.5 + (artwork ? 0 : side * .27)) + unit * .012 * Math.sin(time * .08),
          height * (.49 - .025 * scroll) + unit * .008 * Math.cos(time * .1)];
        const radius = Math.min(width * .29, height * (artwork ? .31 : .39));

        for (const strand of strands) {
          if (compact && [.255, .45, .57, .76].includes(strand.x)) continue;
          const sway = .026 * Math.sin(time * .13 + strand.phase);
          // Draw the continuous, gently waving threads beneath the beads.
          context.beginPath();
          for (let i = 0; i <= 100; i++) {
            const y = i / 100 * 1.16 - .08;
            const x = strandX(strand, y, time, width);
            if (i) context.lineTo(x, height * y);
            else context.moveTo(x, height * y);
          }
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
                .14 * Math.sin(time * .13 + strand.phase + i)],
              type === 'globe' ? 1.05 : type === 'tube' ? 3.4 : 2.1);
          }
        }

        add(central, center, radius, [.16 + .04 * Math.sin(time * .08),
          time * .045 + scroll * .6, -.05 + .025 * Math.sin(time * .09)], 1.04);

        // One path per opacity/weight group keeps the animation light on phones.
        context.lineCap = 'round';
        for (let depth = 0; depth < 6; depth++) {
          for (const style of styles) {
            const bucket = style.buckets[depth];
            if (!bucket.length) continue;
            const alpha = (artwork ? .22 : .12) + depth * (artwork ? .04 : .02);
            context.strokeStyle = `rgba(72,72,72,${alpha * style.alpha})`;
            context.lineWidth = (artwork ? .8 : .65) * style.weight;
            context.beginPath();
            const data = bucket.data;
            for (let i = 0; i < bucket.length; i += 4) {
              context.moveTo(data[i], data[i + 1]);
              context.lineTo(data[i + 2], data[i + 3]);
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
