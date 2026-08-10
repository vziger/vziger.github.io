// geometry.js — 2D contour → 3D solid → binary STL.
// Pure geometry, no DOM. earcut is expected at globalThis.earcut.
// Coordinate convention for input polygons: model space, Y-up, millimetres.

const EPS = 1e-9;

/* ------------------------------------------------------------------ */
/* Affine matrices [a,b,c,d,e,f]: x'=a*x+c*y+e, y'=b*x+d*y+f          */
/* ------------------------------------------------------------------ */
export const Mat = {
  id: () => [1, 0, 0, 1, 0, 0],
  // apply B first, then A (result(p) = A(B(p)))
  mul(A, B) {
    return [
      A[0] * B[0] + A[2] * B[1],
      A[1] * B[0] + A[3] * B[1],
      A[0] * B[2] + A[2] * B[3],
      A[1] * B[2] + A[3] * B[3],
      A[0] * B[4] + A[2] * B[5] + A[4],
      A[1] * B[4] + A[3] * B[5] + A[5],
    ];
  },
  pt(m, x, y) {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  },
};

/* ------------------------------------------------------------------ */
/* Polygon helpers                                                     */
/* ------------------------------------------------------------------ */
export function signedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function ensureOrientation(pts, ccw) {
  return signedArea(pts) < 0 === ccw ? pts.slice().reverse() : pts.slice();
}

export function bbox(pts) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const [x, y] of pts) {
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  return { minx, miny, maxx, maxy };
}

// ray-cast point in polygon (boundary counts as inside-ish, fine for nesting)
export function pointInPoly(pt, poly) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = poly.length - 1, n = poly.length; i < n; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) &&
        x < ((xj - xi) * (y - yi)) / (yj - yi + EPS) + xi) inside = !inside;
  }
  return inside;
}

// pick a point that is strictly interior to poly (average of first edge midpoints, fallback vertex)
function interiorSample(poly) {
  // centroid of first triangle usually interior for simple loops
  const a = poly[0], b = poly[Math.floor(poly.length / 3)] || poly[1], c = poly[Math.floor((2 * poly.length) / 3)] || poly[poly.length - 1];
  const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
  if (pointInPoly([cx, cy], poly)) return [cx, cy];
  return a; // last resort
}

/* ------------------------------------------------------------------ */
/* Nesting: build a forest of loops by containment.                    */
/* Returns array of nodes {index, pts, depth, children:[node]}         */
/* depth 0 = outer solid, 1 = hole/detail, 2 = island, ...             */
/* ------------------------------------------------------------------ */
export function buildForest(loops) {
  const items = loops.map((pts, index) => ({
    index, pts,
    area: Math.abs(signedArea(pts)),
    bb: bbox(pts),
    sample: interiorSample(pts),
    parent: -1,
    depth: 0,
    children: [],
  }));

  for (const c of items) {
    let best = -1, bestArea = Infinity;
    for (const p of items) {
      if (p === c || p.area <= c.area) continue;
      // quick bbox reject
      if (c.bb.minx < p.bb.minx - 1e-6 || c.bb.maxx > p.bb.maxx + 1e-6 ||
          c.bb.miny < p.bb.miny - 1e-6 || c.bb.maxy > p.bb.maxy + 1e-6) continue;
      if (pointInPoly(c.sample, p.pts) && p.area < bestArea) {
        best = p.index; bestArea = p.area;
      }
    }
    c.parent = best;
  }

  const byIndex = new Map(items.map((it) => [it.index, it]));
  const roots = [];
  for (const it of items) {
    if (it.parent === -1) roots.push(it);
    else byIndex.get(it.parent).children.push(it);
  }
  // assign depth
  const walk = (node, d) => { node.depth = d; node.children.forEach((ch) => walk(ch, d + 1)); };
  roots.forEach((r) => walk(r, 0));
  return { roots, items };
}

/* ------------------------------------------------------------------ */
/* Mesh accumulator — triangle soup, 9 floats per triangle.            */
/* ------------------------------------------------------------------ */
export class Mesh {
  constructor() { this.tris = []; }
  addTri(a, b, c) { this.tris.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
  // fill a cap (list of 2D rings: ring[0]=outer, rest=holes) at height z, normal +Z if up else -Z
  addCap(outer, holes, z, up) {
    const flat = [];
    for (const [x, y] of outer) flat.push(x, y);
    const holeIdx = [];
    for (const h of holes) { holeIdx.push(flat.length / 2); for (const [x, y] of h) flat.push(x, y); }
    const idx = globalThis.earcut(flat, holeIdx.length ? holeIdx : null, 2);
    const P = (i) => [flat[i * 2], flat[i * 2 + 1], z];
    for (let i = 0; i < idx.length; i += 3) {
      let a = P(idx[i]), b = P(idx[i + 1]), c = P(idx[i + 2]);
      // earcut output winding is CCW for +Z; flip for bottom
      if (!up) { const t = b; b = c; c = t; }
      this.addTri(a, b, c);
    }
  }
  // wall around a ring between zLow and zHigh. Ring orientation controls outward normal.
  addWall(ring, zLow, zHigh) {
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      const AL = [a[0], a[1], zLow], BL = [b[0], b[1], zLow];
      const BH = [b[0], b[1], zHigh], AH = [a[0], a[1], zHigh];
      this.addTri(AL, BL, BH);
      this.addTri(AL, BH, AH);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Mode 1: flat solid with through-holes.                              */
/* even depth = solid, odd depth = hole.                               */
/* ------------------------------------------------------------------ */
export function buildSolid(loops, height) {
  const { items } = buildForest(loops);
  const mesh = new Mesh();
  // orient: even depth CCW (solid), odd CW (hole)
  const oriented = new Map();
  for (const it of items) oriented.set(it.index, ensureOrientation(it.pts, it.depth % 2 === 0));

  // caps: each even-depth node => outer + its direct odd children as holes
  for (const it of items) {
    if (it.depth % 2 !== 0) continue;
    const outer = oriented.get(it.index);
    const holes = it.children.map((ch) => oriented.get(ch.index));
    mesh.addCap(outer, holes, height, true);  // top +Z
    mesh.addCap(outer, holes, 0, false);       // bottom -Z
  }
  // walls: every loop, full height. Oriented ring gives correct outward normal.
  for (const it of items) mesh.addWall(oriented.get(it.index), 0, height);
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Mode 2: relief heightfield (single watertight solid, flat bottom).  */
/* depth 0 top = baseH; depth 1 = baseH ± detailH (emboss/engrave);    */
/* deeper depths alternate back toward base.                            */
/* ------------------------------------------------------------------ */
export function buildRelief(loops, baseH, detailH, emboss) {
  const { items } = buildForest(loops);
  const mesh = new Mesh();
  const maxDepth = items.reduce((m, it) => Math.max(m, it.depth), 0);

  // top Z per depth. Even depth => "surface" level, odd => boundary (still gets a surface region)
  const dir = emboss ? 1 : -1;
  const topZ = (depth) => {
    if (depth === 0) return baseH;
    // each nesting level toggles between base and detail plane
    return depth % 2 === 1 ? baseH + dir * detailH : baseH;
  };

  const oriented = new Map();
  for (const it of items) oriented.set(it.index, ensureOrientation(it.pts, it.depth % 2 === 0));

  // Top surface: every node is a region with its own top plane.
  // outer = the node's loop (oriented so region interior is enclosed),
  // holes = its direct children (which have their own planes).
  for (const it of items) {
    const z = topZ(it.depth);
    // region ring must be CCW to face up regardless of solid/hole role here
    const outer = ensureOrientation(it.pts, true);
    const holes = it.children.map((ch) => ensureOrientation(ch.pts, false));
    mesh.addCap(outer, holes, z, true);
  }

  // Bottom: flat at 0, only the outermost (depth 0) silhouettes, holes = their depth-1? No.
  // In relief there are no through-holes; bottom is the full solid footprint =
  // union of all depth-0 regions (with no holes — details sit on top, not through).
  for (const it of items) {
    if (it.depth !== 0) continue;
    const outer = ensureOrientation(it.pts, true);
    mesh.addCap(outer, [], 0, false);
  }

  // Outer side walls: depth-0 loops, 0 -> baseH.
  for (const it of items) {
    if (it.depth !== 0) continue;
    mesh.addWall(ensureOrientation(it.pts, true), 0, baseH);
  }

  // Step walls at every internal boundary loop (depth>=1): between parent plane and this plane.
  const byIndex = new Map(items.map((it) => [it.index, it]));
  for (const it of items) {
    if (it.depth === 0) continue;
    const parent = byIndex.get(it.parent);
    const zParent = topZ(parent.depth);
    const zHere = topZ(it.depth);
    if (Math.abs(zParent - zHere) < EPS) continue;
    const lo = Math.min(zParent, zHere), hi = Math.max(zParent, zHere);
    // Raised island: wall like an outer prism (CCW). Pocket: hole-like wall (CW).
    // This keeps directed edges opposite to the adjoining caps => consistent winding.
    const raised = zHere > zParent;
    mesh.addWall(ensureOrientation(it.pts, raised), lo, hi);
  }
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Binary STL from mesh (normals computed from winding).               */
/* ------------------------------------------------------------------ */
export function meshToSTL(mesh) {
  const t = mesh.tris;
  const nTri = t.length / 9;
  const buf = new ArrayBuffer(84 + nTri * 50);
  const dv = new DataView(buf);
  // 80-byte header left zero
  dv.setUint32(80, nTri, true);
  let o = 84;
  for (let i = 0; i < t.length; i += 9) {
    const ax = t[i], ay = t[i + 1], az = t[i + 2];
    const bx = t[i + 3], by = t[i + 4], bz = t[i + 5];
    const cx = t[i + 6], cy = t[i + 7], cz = t[i + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
    dv.setFloat32(o + 12, ax, true); dv.setFloat32(o + 16, ay, true); dv.setFloat32(o + 20, az, true);
    dv.setFloat32(o + 24, bx, true); dv.setFloat32(o + 28, by, true); dv.setFloat32(o + 32, bz, true);
    dv.setFloat32(o + 36, cx, true); dv.setFloat32(o + 40, cy, true); dv.setFloat32(o + 44, cz, true);
    dv.setUint16(o + 48, 0, true);
    o += 50;
  }
  return buf;
}

/* ------------------------------------------------------------------ */
/* Bezier flattening (used by the PDF extractor).                      */
/* ------------------------------------------------------------------ */
export function flattenCubic(out, x0, y0, x1, y1, x2, y2, x3, y3, tol) {
  // adaptive subdivision by flatness
  const stack = [[x0, y0, x1, y1, x2, y2, x3, y3, 0]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [a0, b0, a1, b1, a2, b2, a3, b3, depth] = stack.pop();
    // distance of control points from the chord
    const dx = a3 - a0, dy = b3 - b0;
    const d1 = Math.abs((a1 - a3) * dy - (b1 - b3) * dx);
    const d2 = Math.abs((a2 - a3) * dy - (b2 - b3) * dx);
    if (depth > 18 || (d1 + d2) * (d1 + d2) < tol2 * (dx * dx + dy * dy)) {
      out.push([a3, b3]);
    } else {
      const a01 = (a0 + a1) / 2, b01 = (b0 + b1) / 2;
      const a12 = (a1 + a2) / 2, b12 = (b1 + b2) / 2;
      const a23 = (a2 + a3) / 2, b23 = (b2 + b3) / 2;
      const a012 = (a01 + a12) / 2, b012 = (b01 + b12) / 2;
      const a123 = (a12 + a23) / 2, b123 = (b12 + b23) / 2;
      const am = (a012 + a123) / 2, bm = (b012 + b123) / 2;
      stack.push([am, bm, a123, b123, a23, b23, a3, b3, depth + 1]);
      stack.push([a0, b0, a01, b01, a012, b012, am, bm, depth + 1]);
    }
  }
}
