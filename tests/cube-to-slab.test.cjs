const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'cube-to-slab.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const context = vm.createContext({});
scripts.slice(0, 2).forEach(script => vm.runInContext(script, context));
const G = context.SlabGeometry;
const unit = [[0, 0], [1, 0], [1, 1], [0, 1]];
const area = rings => rings.reduce((sum, ring) => sum + Math.abs(G.polygonArea(ring)), 0);
const near = (actual, expected, tolerance = 1e-9) => assert.ok(
  Math.abs(actual - expected) < tolerance, `${actual} should be within ${tolerance} of ${expected}`
);
const stageRings = (pieces, stage) => pieces.map(piece => piece.source.map(([x, y]) => [
  piece.rho * x + piece.stages[stage].dx,
  piece.rho * y + piece.stages[stage].dy
]));
const bounds = rings => {
  const points = rings.flat();
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
};

test('all four intermediate steps converge to their width-one limits', () => {
  const atOne = G.buildPieces(1);
  // The second cut still raises the right triangle; the cap later returns it.
  near(bounds(stageRings(atOne, 2))[3], 2);
  for (const nu of [0.999, 0.9999, 0.99999]) {
    const pieces = G.buildPieces(nu);
    for (let stage = 0; stage < 5; stage++) {
      const limit = bounds(stageRings(atOne, stage));
      bounds(stageRings(pieces, stage)).forEach((value, i) => near(value, limit[i], 4 * (1 - nu)));
      // A probe on either side of the diagonal follows the same translation
      // at the endpoint; this checks fillings as well as the panel framing.
      for (const point of [[0.2, 0.7], [0.7, 0.2]]) {
        const branch = pieces.find(p => G.pointInRings(point, [p.source]));
        const endpoint = atOne.find(p => G.pointInRings(point, [p.source]));
        assert.ok(branch && endpoint);
        for (let axis = 0; axis < 2; axis++) {
          const offset = axis ? 'dy' : 'dx';
          near(branch.rho * point[axis] + branch.stages[stage][offset],
            point[axis] + endpoint.stages[stage][offset], 4 * (1 - nu));
        }
      }
    }
  }
});

test('the final width-one filling and relative boundary are the identity', () => {
  const rings = context.CycleTools.preset('wave', 0.4);
  const mapped = G.transformRings(rings, 1);
  near(area(mapped), area(rings));
  for (let x = 0.025; x < 1; x += 0.05) for (let y = 0.025; y < 1; y += 0.05) {
    assert.equal(G.pointInRings([x, y], mapped), G.pointInRings([x, y], rings));
  }
  const length = segments => segments.reduce((sum, [a, b]) => sum + Math.hypot(a[0] - b[0], a[1] - b[1]), 0);
  near(length(G.boundarySegments(mapped, [0, 0, 1, 1])), length(G.boundarySegments(rings, [0, 0, 1, 1])));
  for (const piece of G.buildPieces(1)) { near(piece.dx, 0); near(piece.dy, 0); }
});

test('the partition preserves area and maps onto each target slab', () => {
  for (const nu of [0.001, 0.01, 0.1, 0.25, 0.5, 0.9, 0.999, 1]) {
    const pieces = G.buildPieces(nu);
    near(area(pieces.map(piece => piece.source)), 1);
    for (let stage = 0; stage < 5; stage++) near(area(stageRings(pieces, stage)), nu);
    const mapped = G.transformRings([unit], nu);
    near(area(mapped), nu);
    for (const [x, y] of mapped.flat()) {
      assert.ok(x >= -1e-10 && x <= nu + 1e-10 && y >= -1e-10 && y <= 1 + 1e-10);
    }
    assert.equal(G.boundarySegments(mapped, [0, 0, nu, 1]).length, 0);
    for (let x = 0.05; x < 1; x += 0.1) for (let y = 0.05; y < 1; y += 0.1) {
      assert.equal(G.pointInRings([nu * x, y], mapped), true);
    }
  }
  assert.equal(G.buildPieces(0).length, 0);
  assert.equal(G.transformRings([unit], 0).length, 0);
});
