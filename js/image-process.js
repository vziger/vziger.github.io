// image-process.js — photo of a drawing → clean closed silhouette contour.
// Pure canvas/typed-array processing, no external deps. Output matches the
// shape the geometry core consumes: centred, Y-up loops + raw dimensions.

/* ---------------- homography (4-point projective) ---------------- */
// Solve H (3x3) mapping dst points -> src points, so we can inverse-sample.
function solveHomography(dst, src) {
  // 8 equations, unknowns h11..h32 (h33 = 1)
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i], [u, v] = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = gauss(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
function gauss(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}
function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

/* ---------------- perspective warp ---------------- */
// corners: [TL,TR,BR,BL] in source px. Returns {data,w,h,H} (H maps dst->src).
function warp(srcData, sw, sh, corners, longSide) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const wq = (d(corners[0], corners[1]) + d(corners[3], corners[2])) / 2;
  const hq = (d(corners[0], corners[3]) + d(corners[1], corners[2])) / 2;
  const scale = longSide / Math.max(wq, hq);
  const outW = Math.max(8, Math.round(wq * scale));
  const outH = Math.max(8, Math.round(hq * scale));
  const dst = [[0, 0], [outW, 0], [outW, outH], [0, outH]];
  const H = solveHomography(dst, corners);
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const [u, v] = applyH(H, x + 0.5, y + 0.5);
      const o = (y * outW + x) * 4;
      // bilinear sample
      if (u < 0 || v < 0 || u >= sw - 1 || v >= sh - 1) { out[o + 3] = 255; out[o] = out[o + 1] = out[o + 2] = 255; continue; }
      const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0;
      for (let c = 0; c < 3; c++) {
        const p00 = srcData[(y0 * sw + x0) * 4 + c], p10 = srcData[(y0 * sw + x0 + 1) * 4 + c];
        const p01 = srcData[((y0 + 1) * sw + x0) * 4 + c], p11 = srcData[((y0 + 1) * sw + x0 + 1) * 4 + c];
        out[o + c] = (p00 * (1 - fx) + p10 * fx) * (1 - fy) + (p01 * (1 - fx) + p11 * fx) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, w: outW, h: outH, H };
}

/* ---------------- illumination-normalised gray + saturation ---------------- */
function grayAndSat(rgba, w, h) {
  const n = w * h;
  const gray = new Float32Array(n), sat = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    sat[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  // background estimate via coarse downsample + box blur, then divide
  const bg = estimateBackground(gray, w, h);
  const norm = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) norm[i] = Math.min(255, (gray[i] / (bg[i] || 1)) * 200);
  return { norm, sat };
}
function estimateBackground(gray, w, h) {
  // downscale by ~16, blur, upscale (nearest) — approximates local illumination
  const s = Math.max(1, Math.round(Math.max(w, h) / 40));
  const dw = Math.ceil(w / s), dh = Math.ceil(h / s);
  const small = new Float32Array(dw * dh);
  const cnt = new Float32Array(dw * dh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const di = (y / s | 0) * dw + (x / s | 0);
    small[di] += gray[y * w + x]; cnt[di]++;
  }
  for (let i = 0; i < small.length; i++) small[i] = small[i] / (cnt[i] || 1);
  // box blur on small (take max-ish/percentile to represent paper, use dilation-like)
  const blurred = boxBlur(small, dw, dh, 2);
  const bg = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bg[y * w + x] = blurred[(y / s | 0) * dw + (x / s | 0)];
  return bg;
}
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += src[y * w + xx]; c++; } }
    tmp[y * w + x] = s / c;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; c++; } }
    out[y * w + x] = s / c;
  }
  return out;
}

/* ---------------- Otsu threshold ---------------- */
function otsu(gray) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, max = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) { max = between; thr = t; }
  }
  return thr;
}

/* ---------------- morphology ---------------- */
function dilate(mask, w, h, r) { return morph(mask, w, h, r, true); }
function erode(mask, w, h, r) { return morph(mask, w, h, r, false); }
function morph(mask, w, h, r, isDilate) {
  // separable min/max
  const want = isDilate ? 1 : 0;
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let hit = false;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w && mask[y * w + xx] === want) { hit = true; break; } }
    tmp[y * w + x] = hit ? want : 1 - want;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let hit = false;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h && tmp[yy * w + x] === want) { hit = true; break; } }
    out[y * w + x] = hit ? want : 1 - want;
  }
  return out;
}

/* ---------------- connected component (largest) + fill holes ---------------- */
function largestComponent(mask, w, h) {
  const lbl = new Int32Array(w * h).fill(0);
  let best = null, bestSize = 0, cur = 0;
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || lbl[i]) continue;
    cur++; let size = 0; stack.push(i); lbl[i] = cur;
    while (stack.length) {
      const p = stack.pop(); size++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && !lbl[p - 1]) { lbl[p - 1] = cur; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && !lbl[p + 1]) { lbl[p + 1] = cur; stack.push(p + 1); }
      if (y > 0 && mask[p - w] && !lbl[p - w]) { lbl[p - w] = cur; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] && !lbl[p + w]) { lbl[p + w] = cur; stack.push(p + w); }
    }
    if (size > bestSize) { bestSize = size; best = cur; }
  }
  const out = new Uint8Array(w * h);
  if (best) for (let i = 0; i < w * h; i++) out[i] = lbl[i] === best ? 1 : 0;
  return out;
}
function fillHoles(mask, w, h) {
  // flood background from border; anything not reached becomes filled
  const outside = new Uint8Array(w * h);
  const stack = [];
  const pushIf = (i) => { if (!mask[i] && !outside[i]) { outside[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { pushIf(x); pushIf((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { pushIf(y * w); pushIf(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p / w) | 0;
    if (x > 0) pushIf(p - 1); if (x < w - 1) pushIf(p + 1);
    if (y > 0) pushIf(p - w); if (y < h - 1) pushIf(p + w);
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = (mask[i] || !outside[i]) ? 1 : 0;
  return out;
}

/* ---------------- Moore-neighbour boundary trace ---------------- */
function traceBoundary(mask, w, h) {
  let start = -1;
  for (let i = 0; i < w * h; i++) if (mask[i]) { start = i; break; }
  if (start < 0) return [];
  const sx = start % w, sy = (start / w) | 0;
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
  const dy = [0, -1, -1, -1, 0, 1, 1, 1];
  const get = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const contour = [];
  let cx = sx, cy = sy, backtrack = 0;
  const maxSteps = w * h * 4;
  let steps = 0;
  do {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const dir = (backtrack + 1 + k) % 8;
      const nx = cx + dx[dir], ny = cy + dy[dir];
      if (get(nx, ny)) {
        contour.push([cx, cy]);
        backtrack = (dir + 4) % 8;
        cx = nx; cy = ny; found = true; break;
      }
    }
    if (!found) { contour.push([cx, cy]); break; }
  } while ((cx !== sx || cy !== sy) && ++steps < maxSteps);
  return contour;
}

/* ---------------- simplify (RDP) + smooth (Chaikin) ---------------- */
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let idx = -1, max = eps;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (idx !== -1) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function chaikin(pts, iters) {
  for (let it = 0; it < iters; it++) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25]);
      out.push([p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
    }
    pts = out;
  }
  return pts;
}

/* ---------------- trace every ink stroke into ribbon loops ---------------- */
function labelComponents(pred, w, h) {
  const labels = new Int32Array(w * h);
  const sizes = [0];
  let cur = 0; const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!pred(i) || labels[i]) continue;
    cur++; let size = 0; stack.push(i); labels[i] = cur;
    while (stack.length) {
      const p = stack.pop(); size++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && pred(p - 1) && !labels[p - 1]) { labels[p - 1] = cur; stack.push(p - 1); }
      if (x < w - 1 && pred(p + 1) && !labels[p + 1]) { labels[p + 1] = cur; stack.push(p + 1); }
      if (y > 0 && pred(p - w) && !labels[p - w]) { labels[p - w] = cur; stack.push(p - w); }
      if (y < h - 1 && pred(p + w) && !labels[p + w]) { labels[p + w] = cur; stack.push(p + w); }
    }
    sizes[cur] = size;
  }
  return { labels, count: cur, sizes };
}
function traceLabel(labels, w, h, target) {
  let start = -1;
  for (let i = 0; i < w * h; i++) if (labels[i] === target) { start = i; break; }
  if (start < 0) return [];
  const sx = start % w, sy = (start / w) | 0;
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1], dy = [0, -1, -1, -1, 0, 1, 1, 1];
  const get = (x, y) => x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x] === target;
  const contour = [];
  let cx = sx, cy = sy, backtrack = 0, steps = 0; const maxSteps = w * h * 4;
  do {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const dir = (backtrack + 1 + k) % 8, nx = cx + dx[dir], ny = cy + dy[dir];
      if (get(nx, ny)) { contour.push([cx, cy]); backtrack = (dir + 4) % 8; cx = nx; cy = ny; found = true; break; }
    }
    if (!found) { contour.push([cx, cy]); break; }
  } while ((cx !== sx || cy !== sy) && ++steps < maxSteps);
  return contour;
}

// All ink strokes (foreground) + their enclosed holes, as simplified ribbon loops.
function inkLineLoops(ink, w, h, tol, detail, minArea) {
  const smooth = detail > 66 ? 0 : 1;
  const out = [];
  const emit = (labels, count, sizes) => {
    for (let L = 1; L <= count; L++) {
      if (sizes[L] < minArea) continue;
      let ring = traceLabel(labels, w, h, L);
      if (ring.length < 6) continue;
      ring = chaikin(rdp(ring, tol), smooth);
      if (ring.length >= 3) out.push(ring);
    }
  };
  const fg = labelComponents((i) => ink[i] === 1, w, h);
  emit(fg.labels, fg.count, fg.sizes);
  // enclosed background = holes inside strokes (e.g. the loop of an outline)
  const outside = new Uint8Array(w * h), st = [];
  const push = (i) => { if (!ink[i] && !outside[i]) { outside[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (st.length) { const p = st.pop(), x = p % w, y = (p / w) | 0; if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w); }
  const bg = labelComponents((i) => !ink[i] && !outside[i], w, h);
  emit(bg.labels, bg.count, bg.sizes);
  return out;
}

/* ---------------- auto paper-corner detection ---------------- */
export function detectPaperCorners(rgba, w, h) {
  // largest bright, low-saturation region ≈ the sheet
  // paper is the bright, near-white region; use an adaptive brightness cutoff
  let vmax = 0;
  for (let i = 0; i < w * h; i++) {
    const v = (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 3;
    if (v > vmax) vmax = v;
  }
  const vThr = Math.max(170, vmax * 0.8);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const v = (r + g + b) / 3, s = Math.max(r, g, b) - Math.min(r, g, b);
    mask[i] = (v > vThr && s < 45) ? 1 : 0;
  }
  const big = largestComponent(mask, w, h);
  let area = 0; for (let i = 0; i < big.length; i++) area += big[i];
  const inset = 0.04;
  if (area < w * h * 0.12) { // detection failed → inset image corners
    return [[w * inset, h * inset], [w * (1 - inset), h * inset], [w * (1 - inset), h * (1 - inset)], [w * inset, h * (1 - inset)]];
  }
  // extreme points: minimise/maximise x±y to get 4 corners
  let tl = null, tr = null, br = null, bl = null;
  let tlS = Infinity, brS = -Infinity, trS = -Infinity, blS = Infinity;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!big[y * w + x]) continue;
    const a = x + y, d = x - y;
    if (a < tlS) { tlS = a; tl = [x, y]; }
    if (a > brS) { brS = a; br = [x, y]; }
    if (d > trS) { trS = d; tr = [x, y]; }
    if (d < blS) { blS = d; bl = [x, y]; }
  }
  // nudge each corner slightly toward the centroid to stay inside the sheet
  const quad = [tl, tr, br, bl];
  const cxq = (tl[0] + tr[0] + br[0] + bl[0]) / 4, cyq = (tl[1] + tr[1] + br[1] + bl[1]) / 4;
  return quad.map(([x, y]) => [x + (cxq - x) * 0.02, y + (cyq - y) * 0.02]);
}

/* ---------------- orchestrator ---------------- */
/**
 * @param {Uint8ClampedArray} rgba  source image pixels
 * @param {number} sw @param {number} sh
 * @param {object} opts { corners:[TL,TR,BR,BL], sensitivity:-60..60, detail:0..100, longSide }
 * @returns {{loops:number[][][], w:number, h:number, contour:number[][], warpW:number, warpH:number, H:number[], mask:Uint8Array}}
 */
export function photoToLoops(rgba, sw, sh, opts = {}) {
  const corners = opts.corners || [[0, 0], [sw, 0], [sw, sh], [0, sh]];
  const longSide = opts.longSide || 800;
  const sens = opts.sensitivity || 0;
  const detail = opts.detail ?? 50;

  const W = warp(rgba, sw, sh, corners, longSide);
  const { norm, sat } = grayAndSat(W.data, W.w, W.h);
  const n = W.w * W.h;

  // Primary cue = the dark OUTLINE, not the colour fill. Biasing below Otsu
  // catches the black marker while leaving the white paper (and pale shadows)
  // outside. The silhouette is then the region ENCLOSED by that outline, so the
  // sheet around the drawing is never captured.
  const inkThr = Math.min(200, Math.max(30, Math.round(otsu(norm) * 0.78) + sens));
  const ink = new Uint8Array(n);
  for (let i = 0; i < n; i++) ink[i] = norm[i] < inkThr ? 1 : 0;

  // colour mask — only a fallback bridge when the outline is badly broken
  const satThr = Math.max(18, 40 - sens * 0.4);
  const drawn = new Uint8Array(n);
  for (let i = 0; i < n; i++) drawn[i] = (ink[i] || sat[i] > satThr) ? 1 : 0;

  const baseR = Math.max(2, Math.round(longSide / 200));

  // Fill the interior enclosed by a boundary mask, then erode back by the same
  // radius so the silhouette hugs the outline instead of inflating into paper.
  const silhouette = (boundary, r) => {
    let m = dilate(boundary, W.w, W.h, r);   // bridge gaps in the outline
    m = fillHoles(m, W.w, W.h);              // flood the enclosed interior
    m = largestComponent(m, W.w, W.h);
    m = erode(m, W.w, W.h, r);               // shrink back to the line
    m = largestComponent(m, W.w, W.h);
    let a = 0, b = 0; for (let i = 0; i < n; i++) { a += m[i]; b += boundary[i]; }
    return { m, ratio: b ? a / b : 0 };
  };

  // Prefer the black-outline interior. If little gets filled (outline leaks to
  // the border), widen the bridge, then fall back to colour-assisted.
  let res = silhouette(ink, baseR);
  if (res.ratio < 1.8) res = silhouette(ink, baseR * 2);
  if (res.ratio < 1.8) res = silhouette(drawn, baseR);
  let mask = res.m;

  let contour = traceBoundary(mask, W.w, W.h);
  if (contour.length < 8) return { loops: [], w: 0, h: 0, contour: [], warpW: W.w, warpH: W.h, H: W.H, mask };

  const eps = 0.8 + (100 - detail) * 0.06;    // higher detail → smaller epsilon
  contour = rdp(contour, eps);
  const smoothIters = detail > 66 ? 1 : (detail > 33 ? 2 : 3);
  contour = chaikin(contour, smoothIters);

  // centre + Y-up
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const [x, y] of contour) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
  const loop = contour.map(([x, y]) => [x - cx, -(y - cy)]);

  const result = { loops: [loop], w: maxx - minx, h: maxy - miny, contour, warpW: W.w, warpH: W.h, H: W.H, mask };
  if (opts.lines) {
    const minArea = Math.max(8, Math.round((longSide / 90) ** 2));
    // keep only ink well INSIDE the silhouette: drops background strokes AND the
    // boundary outline (already represented by the plate edge), and pulls lines
    // away from the edge so ribbons stay disjoint => clean manifold.
    const clip = erode(mask, W.w, W.h, Math.max(2, Math.round(longSide / 110)));
    let inkInside = new Uint8Array(ink.length);
    for (let i = 0; i < ink.length; i++) inkInside[i] = (ink[i] && clip[i]) ? 1 : 0;
    // morphological "open" removes 1px spurs/whiskers that make thin ribbons non-manifold
    inkInside = dilate(erode(inkInside, W.w, W.h, 1), W.w, W.h, 1);
    const raw = inkLineLoops(inkInside, W.w, W.h, eps, detail, minArea);
    result.lineLoops = raw.map((lp) => lp.map(([x, y]) => [x - cx, -(y - cy)]));
  }
  return result;
}
