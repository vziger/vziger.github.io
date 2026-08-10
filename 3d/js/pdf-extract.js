// pdf-extract.js — extract closed vector contours from a PDF page.
// Walks pdf.js operator list with a CTM stack, skips clip paths,
// flattens beziers, returns model-space loops (Y-up, millimetres, centred).

import * as pdfjsLib from '../vendor/pdf.mjs';
import { Mat, flattenCubic } from './geometry.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.mjs', import.meta.url).href;

const OPS = pdfjsLib.OPS;

// Paint operators that actually ink a path (=> keep geometry).
const FILL_STROKE = new Set([
  OPS.stroke, OPS.closeStroke, OPS.fill, OPS.eoFill,
  OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);
const CLIP = new Set([OPS.clip, OPS.eoClip]);

/**
 * @param {ArrayBuffer} buffer  PDF bytes
 * @param {object} opts { widthMM, tol }  tol = flatten tolerance in PDF points
 * @returns {Promise<{loops:number[][][], widthMM:number, heightMM:number, count:number}>}
 */
export async function extractContours(buffer, opts = {}) {
  const tol = opts.tol ?? 0.15;
  const doc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const opList = await page.getOperatorList();

  let ctm = viewport.transform.slice();
  const stack = [];
  const loops = [];            // completed device-space loops
  let pending = [];            // subpaths built for the current path: [{pts}]
  let cur = null;              // current device point
  let startPt = null;         // device start of current subpath

  const push = (p) => { if (cur) { pending[pending.length - 1].pts.push(p); } cur = p; };
  const newSub = (p) => { pending.push({ pts: [p] }); cur = p; startPt = p; };
  const closeSub = () => { if (startPt) cur = startPt; };

  const flushPathAsGeometry = () => {
    for (const sp of pending) {
      const pts = dedupe(sp.pts);
      if (pts.length >= 3) loops.push(pts);
    }
    pending = []; cur = null; startPt = null;
  };
  const dropPath = () => { pending = []; cur = null; startPt = null; };

  const fn = opList.fnArray, ar = opList.argsArray;
  for (let i = 0; i < fn.length; i++) {
    const op = fn[i];
    switch (op) {
      case OPS.save: stack.push(ctm.slice()); break;
      case OPS.restore: ctm = stack.pop() || viewport.transform.slice(); break;
      case OPS.transform: ctm = Mat.mul(ctm, ar[i]); break;

      case OPS.constructPath: {
        const segOps = ar[i][0];
        const c = ar[i][1];
        let k = 0;
        const T = (x, y) => Mat.pt(ctm, x, y);
        for (const s of segOps) {
          switch (s) {
            case OPS.moveTo: { const p = T(c[k], c[k + 1]); k += 2; newSub(p); break; }
            case OPS.lineTo: { const p = T(c[k], c[k + 1]); k += 2; push(p); break; }
            case OPS.curveTo: {
              const p1 = T(c[k], c[k + 1]), p2 = T(c[k + 2], c[k + 3]), p3 = T(c[k + 4], c[k + 5]); k += 6;
              curve(push, cur, p1, p2, p3, tol); break;
            }
            case OPS.curveTo2: { // first control == current point
              const p2 = T(c[k], c[k + 1]), p3 = T(c[k + 2], c[k + 3]); k += 4;
              curve(push, cur, cur, p2, p3, tol); break;
            }
            case OPS.curveTo3: { // second control == end point
              const p1 = T(c[k], c[k + 1]), p3 = T(c[k + 2], c[k + 3]); k += 4;
              curve(push, cur, p1, p3, p3, tol); break;
            }
            case OPS.rectangle: {
              const x = c[k], y = c[k + 1], w = c[k + 2], h = c[k + 3]; k += 4;
              newSub(T(x, y)); push(T(x + w, y)); push(T(x + w, y + h)); push(T(x, y + h)); closeSub();
              break;
            }
            case OPS.closePath: closeSub(); break;
            default: break;
          }
        }
        break;
      }

      default:
        // A path is inked only by a fill/stroke op => keep it. A clip path is
        // always finalised by endPath (`W n`), which drops it, as does a bare `n`.
        if (FILL_STROKE.has(op)) flushPathAsGeometry();
        else if (op === OPS.endPath || CLIP.has(op)) dropPath();
        break;
    }
  }

  page.cleanup(); doc.destroy();

  if (!loops.length) return { loops: [], w: 0, h: 0, count: 0 };

  // centre + Y-up, in raw PDF points (caller scales to target width)
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const lp of loops) for (const [x, y] of lp) {
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  const wDev = maxx - minx || 1, hDev = maxy - miny || 1;
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
  const norm = loops.map((lp) => lp.map(([x, y]) => [x - cx, -(y - cy)]));

  return { loops: norm, w: wDev, h: hDev, count: norm.length };
}

function curve(push, p0, p1, p2, p3, tol) {
  const out = [];
  flattenCubic(out, p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], tol);
  for (const p of out) push(p);
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > 1e-4 || Math.abs(q[1] - p[1]) > 1e-4) out.push(p);
  }
  // drop closing duplicate
  if (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4) out.pop();
  }
  return out;
}
