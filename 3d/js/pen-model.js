// pen-model.js — vector "Pen" tool data model. Pure logic, no DOM.
//
// A *path* is an editable contour of cubic-Bézier segments:
//   { nodes: [Node...], closed: bool }
//   Node = { x, y, cIn:[x,y]|null, cOut:[x,y]|null }
//     x,y   — anchor point (absolute, model units, Y-up like source.loops)
//     cIn   — incoming handle control point (absolute), null = sharp
//     cOut  — outgoing handle control point (absolute), null = sharp
//
// Segment i→i+1 is the cubic (P0=node[i], P1=node[i].cOut, P2=node[i+1].cIn,
// P3=node[i+1]); a null handle collapses to its anchor (straight-ish).
//
// The geometry core wants flat polylines (source.loops). pathsToLoops()
// flattens Béziers adaptively (recursive subdivision to a mm tolerance);
// loopsToPaths() is the inverse for editing PDF/photo contours.

/* ------------------------------------------------------------------ */
/* Construction helpers                                                */
/* ------------------------------------------------------------------ */

export function makeNode(x, y, cIn = null, cOut = null, smooth = false) {
  return { x, y, cIn, cOut, smooth };
}

export function makePath(nodes = [], closed = false) {
  return { nodes, closed };
}

/* ------------------------------------------------------------------ */
/* Cubic Bézier evaluation + adaptive flattening                      */
/* ------------------------------------------------------------------ */

// Control points of the segment between two nodes. A missing handle sits
// on its own anchor, so a segment with no handles is a straight line.
function segCtrl(a, b) {
  return [
    [a.x, a.y],
    a.cOut ? a.cOut : [a.x, a.y],
    b.cIn ? b.cIn : [b.x, b.y],
    [b.x, b.y],
  ];
}

function cubicAt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const uu = u * u, tt = t * t;
  const a = uu * u, b = 3 * uu * t, c = 3 * u * tt, d = tt * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

// Perpendicular distance from point p to the line through a–b.
function distToLine(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) {
    const ex = p[0] - a[0], ey = p[1] - a[1];
    return Math.hypot(ex, ey);
  }
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / Math.sqrt(len2);
}

// Recursively subdivide one cubic until it is flat within `tol` (model
// units). Appends interior+end points to `out`; caller pushes the start.
function flattenCubic(p0, p1, p2, p3, tol, out, depth = 0) {
  // Flatness: how far the control points stray from the P0–P3 chord.
  const d1 = distToLine(p1, p0, p3);
  const d2 = distToLine(p2, p0, p3);
  if (depth >= 18 || (d1 <= tol && d2 <= tol)) {
    out.push([p3[0], p3[1]]);
    return;
  }
  // de Casteljau split at t=0.5
  const p01 = mid(p0, p1), p12 = mid(p1, p2), p23 = mid(p2, p3);
  const p012 = mid(p01, p12), p123 = mid(p12, p23);
  const m = mid(p012, p123);
  flattenCubic(p0, p01, p012, m, tol, out, depth + 1);
  flattenCubic(m, p123, p23, p3, tol, out, depth + 1);
}

function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

/* ------------------------------------------------------------------ */
/* paths → loops (for the geometry core)                               */
/* ------------------------------------------------------------------ */

// Flatten one path to a polyline (unclosed: last point ≠ first).
// `tol` is the max deviation from the true curve, in model units (mm-ish).
export function pathToPolyline(path, tol = 0.1) {
  const n = path.nodes.length;
  if (n === 0) return [];
  if (n === 1) return [[path.nodes[0].x, path.nodes[0].y]];

  const pts = [[path.nodes[0].x, path.nodes[0].y]];
  const segEnd = path.closed ? n : n - 1;
  for (let i = 0; i < segEnd; i++) {
    const a = path.nodes[i], b = path.nodes[(i + 1) % n];
    const [c0, c1, c2, c3] = segCtrl(a, b);
    flattenCubic(c0, c1, c2, c3, tol, pts);
  }
  // For a closed path the last flattened point equals the first anchor —
  // drop it so the loop stays unclosed per the source.loops convention.
  if (path.closed && pts.length > 1) {
    const f = pts[0], l = pts[pts.length - 1];
    if (Math.abs(f[0] - l[0]) < 1e-6 && Math.abs(f[1] - l[1]) < 1e-6) pts.pop();
  }
  return pts;
}

// All closed paths → loops (unclosed rings) for buildForest/buildSolid/…
// Open paths are skipped for solids (they can't bound an area).
export function pathsToLoops(paths, tol = 0.1) {
  const loops = [];
  for (const p of paths) {
    if (!p.closed || p.nodes.length < 2) continue;
    const poly = pathToPolyline(p, tol);
    if (poly.length >= 3) loops.push(poly);
  }
  return loops;
}

/* ------------------------------------------------------------------ */
/* loops → paths (edit imported PDF/photo contours)                    */
/* ------------------------------------------------------------------ */

// Ramer–Douglas–Peucker: drop points that stay within `eps` of the chord.
function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    let maxD = -1, idx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = distToLine(pts[i], pts[i0], pts[i1]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = true;
      stack.push([i0, idx], [idx, i1]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// One loop (unclosed ring) → editable closed path of sharp-corner nodes.
// `simplifyEps` (model units) thins dense traced polylines; 0 keeps all.
export function loopToPath(loop, simplifyEps = 0) {
  let pts = loop;
  if (simplifyEps > 0) pts = rdp(loop, simplifyEps);
  const nodes = pts.map(([x, y]) => makeNode(x, y));
  return makePath(nodes, true);
}

export function loopsToPaths(loops, simplifyEps = 0) {
  return loops.map((lp) => loopToPath(lp, simplifyEps));
}

/* ------------------------------------------------------------------ */
/* Editing ops (used by the Pen tool)                                  */
/* ------------------------------------------------------------------ */

function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function near(p, q) { return Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6; }

// Nearest point on the path's curve to (x,y): which segment and parameter t.
// Returns { i, t, dist } in model units, or null for a too-small path.
export function nearestSegment(path, x, y, samples = 24) {
  const n = path.nodes.length;
  if (n < 2) return null;
  const segEnd = path.closed ? n : n - 1;
  let best = null;
  for (let i = 0; i < segEnd; i++) {
    const [c0, c1, c2, c3] = segCtrl(path.nodes[i], path.nodes[(i + 1) % n]);
    for (let s = 0; s <= samples; s++) {
      const t = s / samples;
      const p = cubicAt(c0, c1, c2, c3, t);
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (!best || d < best.dist) best = { i, t, dist: d };
    }
  }
  return best;
}

// Split segment i→i+1 at parameter t (de Casteljau), inserting a new node
// that preserves the existing curve shape. Mutates and returns `path`.
export function splitSegment(path, i, t) {
  const n = path.nodes.length;
  const a = path.nodes[i], b = path.nodes[(i + 1) % n];
  const [p0, p1, p2, p3] = segCtrl(a, b);
  const p01 = lerp(p0, p1, t), p12 = lerp(p1, p2, t), p23 = lerp(p2, p3, t);
  const p012 = lerp(p01, p12, t), p123 = lerp(p12, p23, t);
  const m = lerp(p012, p123, t);

  // Updated neighbour handles (drop to null if they collapse onto the anchor)
  a.cOut = near(p01, [a.x, a.y]) ? null : p01;
  b.cIn = near(p23, [b.x, b.y]) ? null : p23;

  const cIn = near(p012, m) ? null : p012;
  const cOut = near(p123, m) ? null : p123;
  const node = { x: m[0], y: m[1], cIn, cOut, smooth: !!(cIn && cOut) };
  path.nodes.splice(i + 1, 0, node);
  return path;
}
