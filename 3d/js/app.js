// app.js — UI controller. Two input front-ends (PDF, Photo) feed one shared
// scale → build → preview → STL pipeline.
import { extractContours } from './pdf-extract.js';
import { photoToLoops, detectPaperCorners } from './image-process.js';
import { buildSolid, buildRelief, meshToSTL, punchHole, unionDisc, circlePolygon } from './geometry.js';
import { pathsToLoops, loopsToPaths, pathToPolyline, makeNode, makePath, splitSegment, nearestSegment } from './pen-model.js';
import { Viewer } from './viewer.js';

const $ = (id) => document.getElementById(id);
const viewer = new Viewer($('view'));

// theme (dark default; choice remembered)
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  $('themeToggle').textContent = t === 'light' ? '🌙' : '☀️';
  viewer.setTheme(t);
}
let theme = localStorage.getItem('theme') || 'dark';
applyTheme(theme);
$('themeToggle').addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
  applyTheme(theme);
});

let source = null;      // { loops (centred, Y-up, raw units), w, h } — pristine, un-rotated
let penBackdrop = null; // { rgba, w, h, cx, cy } rectified photo for the Pen editor; null = no raster
let rotation = 0;       // 0..3 quarter-turns; a property of the loaded file
let fileName = 'model';
let lastSTL = null;

// keychain ring hole (Step 1). Position u,v = fraction of the model bbox (v from top).
const hole = { on: false, mode: 'lug', dia: 4, ring: 2.5, u: 0.5, v: 0.08 };
const holeView = { rect: null, drag: false };
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#4c9ffe';

function setStatus(msg, kind = '') { const el = $('status'); el.textContent = msg; el.className = 'status ' + kind; }
function num(id, def) { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : def; }
const nextFrame = () => new Promise((r) => setTimeout(r, 12));

/* ---------------- tabs ---------------- */
function selectTab(tab) {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
  $('pane-pdf').hidden = tab !== 'pdf';
  $('pane-photo').hidden = tab !== 'photo';
  $('pane-pen').hidden = tab !== 'pen';
  if (tab === 'pen') penActivate();
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.tab)));

/* ---------------- shared build ---------------- */
function syncControls() {
  const relief = document.querySelector('input[name=mode]:checked').value === 'relief';
  $('reliefRow').style.display = relief ? '' : 'none';
  $('reliefKindRow').style.display = relief ? '' : 'none';
  $('detailRow').style.display = relief ? '' : 'none';
  $('modeHint').textContent = relief
    ? 'База-силуэт + внутренние детали как выступы или канавки.'
    : 'Внешний контур залит, внутренние — сквозные отверстия.';
  const kind = document.querySelector('input[name=reliefKind]:checked')?.value || 'areas';
  const linesAvail = !!(source && source.lineLoops && source.lineLoops.length);
  $('reliefKindHint').textContent = (kind === 'lines' && !linesAvail)
    ? '«По линиям» — для фото: загрузите рисунок на вкладке «Фото».'
    : (kind === 'lines' ? 'Все штрихи рисунка подняты/утоплены на пластине-силуэте.' : '');
  $('detailRow').querySelector('label').textContent =
    (relief && kind === 'lines') ? 'Высота линий, мм' : 'Высота деталей, мм';
  // ring hole — available in both modes
  $('holeOpts').hidden = !hole.on;
  $('ringField').style.display = hole.mode === 'lug' ? '' : 'none';
}

// apply the loaded file's rotation (0..3 quarter-turns) — each CW step (x,y)->(y,-x)
function rotated(loops) {
  let out = loops;
  for (let i = 0; i < (rotation & 3); i++) out = out.map((lp) => lp.map(([x, y]) => [y, -x]));
  return out;
}

function rebuild(fit = false) {
  if (!source || !source.loops.length) { setStatus('Нет контура для сборки', 'warn'); return; }
  const widthMM = num('width', 80);
  const srcW = rotation & 1 ? source.h : source.w;   // odd turns swap W/H
  const srcH = rotation & 1 ? source.w : source.h;
  const scale = widthMM / (srcW || 1);
  const modelH = srcH * scale;
  let loops = rotated(source.loops).map((lp) => lp.map(([x, y]) => [x * scale, y * scale]));
  const baseH = num('base', 5);
  const mode = document.querySelector('input[name=mode]:checked').value;

  // ring hole position (model is centred at origin; v measured from top)
  const holeR = num('holeDia', 4) / 2;
  const hx = (hole.u - 0.5) * widthMM;
  const hy = (0.5 - hole.v) * modelH;
  const lugR = hole.mode === 'lug' ? holeR + num('holeRing', 2.5) : 0;

  let mesh;
  if (mode === 'solid') {
    if (hole.on) {
      try { loops = punchHole(loops, hx, hy, holeR, lugR); }
      catch (e) { console.error('hole:', e); }
    }
    mesh = buildSolid(loops, baseH);
  } else {
    const kind = document.querySelector('input[name=reliefKind]:checked')?.value || 'areas';
    const useLines = kind === 'lines' && source.lineLoops && source.lineLoops.length;
    let holes = [];
    if (hole.on) {
      try {
        if (lugR > holeR) loops = unionDisc(loops, hx, hy, lugR); // flat lug in relief
        holes = [circlePolygon(hx, hy, holeR)];
      } catch (e) { console.error('hole:', e); }
    }
    let reliefLoops = loops;
    if (useLines) {
      const lines = rotated(source.lineLoops).map((lp) => lp.map(([x, y]) => [x * scale, y * scale]));
      reliefLoops = [...loops, ...lines]; // silhouette plate + raised/recessed ink lines
    }
    mesh = buildRelief(reliefLoops, baseH, num('detail', 1.5), $('emboss').checked, holes);
  }

  viewer.setMesh(mesh.tris, fit);
  lastSTL = meshToSTL(mesh);

  const totH = mode === 'solid' ? baseH : baseH + ($('emboss').checked ? num('detail', 1.5) : 0);
  $('info').innerHTML =
    `Контуров: <b>${source.loops.length}</b> · Размер: <b>${widthMM.toFixed(1)}×${(srcH * scale).toFixed(1)}×${totH.toFixed(1)} мм</b> · ` +
    `Треугольников: <b>${(mesh.tris.length / 9) | 0}</b>`;
  $('download').disabled = false;
  setStatus('Готово', 'ok');
  if (hole.on) drawHoleView();
}

/* ---------------- ring-hole mini top-view + drag ---------------- */
function drawHoleView() {
  const cv = $('holeView'); if (!cv || !source) return;
  const ctx = cv.getContext('2d');
  const cw = cv.clientWidth || 240, ch = 150;
  cv.width = cw; cv.height = ch;
  ctx.clearRect(0, 0, cw, ch);
  const loops = rotated(source.loops);
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  for (const lp of loops) for (const [x, y] of lp) {
    if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y;
  }
  const bw = mxx - mnx || 1, bh = mxy - mny || 1, pad = 14;
  const s = Math.min((cw - 2 * pad) / bw, (ch - 2 * pad) / bh);
  const ox = (cw - bw * s) / 2, oy = (ch - bh * s) / 2;
  const toC = (x, y) => [(x - mnx) * s + ox, (mxy - y) * s + oy]; // Y-up → down
  holeView.rect = { ox, oy, s, bw, bh };

  const accent = cssVar('--accent');
  ctx.fillStyle = 'rgba(120,150,190,0.15)';
  ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
  for (const lp of loops) {
    ctx.beginPath();
    lp.forEach((p, i) => { const c = toC(p[0], p[1]); i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1]); });
    ctx.closePath(); ctx.stroke();
  }
  // marker
  const mc = toC(mnx + hole.u * bw, mxy - hole.v * bh);
  ctx.strokeStyle = accent; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(mc[0] - 11, mc[1]); ctx.lineTo(mc[0] + 11, mc[1]);
  ctx.moveTo(mc[0], mc[1] - 11); ctx.lineTo(mc[0], mc[1] + 11); ctx.stroke();
  ctx.beginPath(); ctx.arc(mc[0], mc[1], 7, 0, 7);
  ctx.fillStyle = accent; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
}
{
  const cv = $('holeView');
  const setFromEvent = (e) => {
    const r = holeView.rect; if (!r) return;
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (cv.width / rect.width);
    const y = (e.clientY - rect.top) * (cv.height / rect.height);
    hole.u = Math.max(0, Math.min(1, (x - r.ox) / (r.bw * r.s)));
    hole.v = Math.max(0, Math.min(1, (y - r.oy) / (r.bh * r.s)));
  };
  cv.addEventListener('pointerdown', (e) => { holeView.drag = true; cv.setPointerCapture(e.pointerId); setFromEvent(e); drawHoleView(); rebuild(false); });
  cv.addEventListener('pointermove', (e) => { if (holeView.drag) { setFromEvent(e); drawHoleView(); rebuild(false); } });
  cv.addEventListener('pointerup', () => { holeView.drag = false; });
}

// hole controls
$('holeOn').addEventListener('change', (e) => { hole.on = e.target.checked; syncControls(); rebuild(false); });
document.querySelectorAll('input[name=holeMode]').forEach((r) =>
  r.addEventListener('change', () => { hole.mode = document.querySelector('input[name=holeMode]:checked').value; syncControls(); rebuild(false); }));
['holeDia', 'holeRing'].forEach((id) => $(id).addEventListener('change', () => rebuild(false)));

document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { syncControls(); rebuild(false); }));
document.querySelectorAll('input[name=reliefKind]').forEach((r) => r.addEventListener('change', () => { syncControls(); rebuild(false); }));
['emboss', 'engrave', 'base', 'detail', 'width'].forEach((id) => $(id).addEventListener('change', () => rebuild(false)));
$('regen').addEventListener('click', () => rebuild(false));

// Rotate 90°. On the Photo tab this rotates the LOADED IMAGE itself (and re-runs
// detection); on the PDF tab there is no image, so it rotates the contour.
function rotateSource(cw) {
  if (!$('pane-photo').hidden && photo.rgba) { rotatePhoto(cw); return; }
  if (!source || !source.loops.length) return;
  rotation = (rotation + (cw ? 1 : 3)) & 3;
  rebuild(false);
}
document.querySelectorAll('.rot-btn').forEach((b) =>
  b.addEventListener('click', () => rotateSource(b.dataset.rot === 'cw')));

/* ---------------- PDF front-end ---------------- */
async function loadPDF(file, fit = true) {
  if (!file) return;
  fileName = (file.name || 'model').replace(/\.pdf$/i, '');
  $('dropHint').textContent = file.name;
  setStatus('Разбор PDF…');
  await nextFrame();
  try {
    const buf = await file.arrayBuffer();
    const res = await extractContours(buf, { tol: num('tol', 0.15) });
    if (!res.count) { setStatus('В PDF не найдено векторных контуров', 'err'); return; }
    source = { loops: res.loops, w: res.w, h: res.h };
    penBackdrop = null; // PDF: no raster, Pen editor shows contour on the grid
    rebuild(fit);
  } catch (e) { console.error(e); setStatus('Ошибка PDF: ' + (e.message || e), 'err'); }
}
$('file').addEventListener('change', (e) => { rotation = 0; hole.u = 0.5; hole.v = 0.08; loadPDF(e.target.files[0], true); });
$('tol').addEventListener('change', () => { const f = $('file').files[0]; if (f) loadPDF(f, false); });
{
  const d = $('drop');
  ['dragover', 'dragenter'].forEach((ev) => d.addEventListener(ev, (e) => { e.preventDefault(); d.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => d.addEventListener(ev, (e) => { e.preventDefault(); d.classList.remove('over'); }));
  d.addEventListener('drop', (e) => { rotation = 0; hole.u = 0.5; hole.v = 0.08; loadPDF(e.dataTransfer.files[0]); });
}

/* ---------------- Photo front-end ---------------- */
const photo = { img: null, rgba: null, sw: 0, sh: 0, corners: null, contourSrc: null };
const pc = $('photoCanvas');
const pctx = pc.getContext('2d');
let viewScale = 1, viewOX = 0, viewOY = 0; // image→canvas mapping

function imgToCanvas(p) { return [p[0] * viewScale + viewOX, p[1] * viewScale + viewOY]; }
function canvasToImg(x, y) { return [(x - viewOX) / viewScale, (y - viewOY) / viewScale]; }

function fitCanvas() {
  const maxW = pc.clientWidth || 300, maxH = 360;
  viewScale = Math.min(maxW / photo.sw, maxH / photo.sh);
  const cw = Math.round(photo.sw * viewScale), ch = Math.round(photo.sh * viewScale);
  pc.width = cw; pc.height = ch; viewOX = 0; viewOY = 0;
}
function redrawPhoto() {
  if (!photo.img) return;
  pctx.clearRect(0, 0, pc.width, pc.height);
  pctx.drawImage(photo.img, 0, 0, pc.width, pc.height);
  // silhouette overlay
  if (photo.contourSrc && photo.contourSrc.length) {
    pctx.beginPath();
    photo.contourSrc.forEach((p, i) => { const c = imgToCanvas(p); i ? pctx.lineTo(c[0], c[1]) : pctx.moveTo(c[0], c[1]); });
    pctx.closePath();
    pctx.fillStyle = 'rgba(76,159,254,0.28)'; pctx.fill();
    pctx.lineWidth = 2; pctx.strokeStyle = '#4c9ffe'; pctx.stroke();
  }
  // crop quad + handles
  if (photo.corners) {
    pctx.beginPath();
    photo.corners.forEach((p, i) => { const c = imgToCanvas(p); i ? pctx.lineTo(c[0], c[1]) : pctx.moveTo(c[0], c[1]); });
    pctx.closePath();
    pctx.lineWidth = 1.5; pctx.strokeStyle = '#ffd479'; pctx.setLineDash([5, 4]); pctx.stroke(); pctx.setLineDash([]);
    for (const p of photo.corners) {
      const c = imgToCanvas(p);
      pctx.beginPath(); pctx.arc(c[0], c[1], 8, 0, 7); pctx.fillStyle = '#ffd479'; pctx.fill();
      pctx.strokeStyle = '#1a1f27'; pctx.lineWidth = 2; pctx.stroke();
    }
  }
}

async function loadPhoto(file) {
  if (!file) return;
  rotation = 0; hole.u = 0.5; hole.v = 0.08; // new photo resets orientation + hole
  fileName = (file.name || 'model').replace(/\.[^.]+$/, '');
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    // read pixels at native (capped) resolution
    const cap = 1600, s = Math.min(1, cap / Math.max(img.width, img.height));
    const sw = Math.round(img.width * s), sh = Math.round(img.height * s);
    const off = Object.assign(document.createElement('canvas'), { width: sw, height: sh });
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0, sw, sh);
    photo.img = img; photo.sw = sw; photo.sh = sh;
    photo.rgba = octx.getImageData(0, 0, sw, sh).data;
    photo.corners = detectPaperCorners(photo.rgba, sw, sh);
    photo.contourSrc = null;
    $('photoHint').textContent = file.name;
    fitCanvas(); redrawPhoto();
    processPhoto(true); // new photo → fit camera once
  };
  img.src = url;
}
$('photoFile').addEventListener('change', (e) => loadPhoto(e.target.files[0]));
{
  const d = $('photoDrop');
  ['dragover', 'dragenter'].forEach((ev) => d.addEventListener(ev, (e) => { e.preventDefault(); d.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => d.addEventListener(ev, (e) => { e.preventDefault(); d.classList.remove('over'); }));
  d.addEventListener('drop', (e) => loadPhoto(e.dataTransfer.files[0]));
}

async function processPhoto(fit = false) {
  if (!photo.rgba) { setStatus('Сначала выберите фото', 'warn'); return; }
  setStatus('Распознаю силуэт…');
  await nextFrame();
  try {
    const res = photoToLoops(photo.rgba, photo.sw, photo.sh, {
      corners: photo.corners,
      sensitivity: num('sens', 0),
      detail: num('detail2', 50),
      lines: true,
    });
    if (!res.loops.length) { setStatus('Силуэт не найден — подвиньте углы или измените чувствительность', 'err'); return; }
    // map warped contour → source image coords for the overlay
    const H = res.H;
    photo.contourSrc = res.contour.map(([x, y]) => {
      const w = H[6] * x + H[7] * y + H[8];
      return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
    });
    redrawPhoto();
    source = { loops: res.loops, w: res.w, h: res.h, lineLoops: res.lineLoops || [] };
    // rectified photo aligned with the centred loops (for the Pen editor backdrop)
    penBackdrop = res.warpRGBA
      ? { rgba: res.warpRGBA, w: res.warpW, h: res.warpH, cx: res.cx, cy: res.cy }
      : null;
    rebuild(fit);
  } catch (e) { console.error(e); setStatus('Ошибка обработки: ' + (e.message || e), 'err'); }
}
// Rotate the loaded photo itself by 90° (pixels + crop frame), then re-detect.
// Camera is kept (processPhoto(false)).
function rotatePhoto(cw) {
  const { rgba, sw, sh } = photo;
  const nw = sh, nh = sw;
  const out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx = cw ? y : sw - 1 - y;
      const sy = cw ? sh - 1 - x : x;
      const o = (y * nw + x) * 4, s = (sy * sw + sx) * 4;
      out[o] = rgba[s]; out[o + 1] = rgba[s + 1]; out[o + 2] = rgba[s + 2]; out[o + 3] = 255;
    }
  }
  // displayable rotated source (redrawPhoto draws photo.img — a canvas is fine)
  const cnv = Object.assign(document.createElement('canvas'), { width: nw, height: nh });
  cnv.getContext('2d').putImageData(new ImageData(out, nw, nh), 0, 0);
  photo.img = cnv; photo.rgba = out; photo.sw = nw; photo.sh = nh;
  photo.corners = photo.corners.map(([px, py]) => (cw ? [sh - py, px] : [py, sw - px]));
  photo.contourSrc = null;
  fitCanvas(); redrawPhoto();
  processPhoto(false);
}
$('recognize').addEventListener('click', () => processPhoto(false));
$('sens').addEventListener('change', () => processPhoto(false));
$('detail2').addEventListener('change', () => processPhoto(false));

/* corner dragging (pointer = mouse + touch) */
let drag = -1;
pc.addEventListener('pointerdown', (e) => {
  if (!photo.corners) return;
  const rect = pc.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (pc.width / rect.width);
  const y = (e.clientY - rect.top) * (pc.height / rect.height);
  let best = -1, bd = 22;
  photo.corners.forEach((p, i) => { const c = imgToCanvas(p); const d = Math.hypot(c[0] - x, c[1] - y); if (d < bd) { bd = d; best = i; } });
  if (best >= 0) { drag = best; pc.setPointerCapture(e.pointerId); }
});
pc.addEventListener('pointermove', (e) => {
  if (drag < 0) return;
  const rect = pc.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (pc.width / rect.width);
  const y = (e.clientY - rect.top) * (pc.height / rect.height);
  const p = canvasToImg(x, y);
  photo.corners[drag] = [Math.max(0, Math.min(photo.sw, p[0])), Math.max(0, Math.min(photo.sh, p[1]))];
  redrawPhoto();
});
pc.addEventListener('pointerup', () => { if (drag >= 0) { drag = -1; processPhoto(); } });
addEventListener('resize', () => { if (photo.img) { fitCanvas(); redrawPhoto(); } });

/* ---------------- Pen editor (vector contour) ---------------- */
// paths live in model space (centred-ish, Y-up, source units). Canvas is Y-down.
// Step 2: view + move existing anchors/handles. Full authoring tools → Step 3.
const pen = {
  paths: [],            // [{ nodes:[{x,y,cIn,cOut,smooth}], closed }]
  scale: 1, ox: 0, oy: 0,
  drag: null,           // { kind:'node'|'in'|'out'|'pan', pi, ni, sx, sy, moved, ... }
  bg: null,             // offscreen backdrop canvas (warp raster)
  tool: 'edit',         // 'edit' | 'add' | 'del'
  active: null,         // index of the open path being drawn (add mode), or null
  undo: [], redo: [],   // history stacks of deep-cloned pen.paths
};
const clonePaths = (ps) => ps.map((p) => ({
  closed: p.closed,
  nodes: p.nodes.map((n) => ({ x: n.x, y: n.y, cIn: n.cIn ? [...n.cIn] : null, cOut: n.cOut ? [...n.cOut] : null, smooth: !!n.smooth })),
}));
function penHistory() {           // snapshot BEFORE a mutation
  pen.undo.push(clonePaths(pen.paths));
  if (pen.undo.length > 60) pen.undo.shift();
  pen.redo.length = 0;
  penUpdateUndoBtns();
}
function penUpdateUndoBtns() {
  $('penUndo').disabled = !pen.undo.length;
  $('penRedo').disabled = !pen.redo.length;
}
function penUndo() {
  if (!pen.undo.length) return;
  pen.redo.push(clonePaths(pen.paths));
  pen.paths = pen.undo.pop();
  pen.active = null;
  penUpdateUndoBtns(); penDraw(); penSync();
}
function penRedo() {
  if (!pen.redo.length) return;
  pen.undo.push(clonePaths(pen.paths));
  pen.paths = pen.redo.pop();
  pen.active = null;
  penUpdateUndoBtns(); penDraw(); penSync();
}
const penCv = $('penCanvas');
const HIT = 10;         // px pick radius

const m2c = (x, y) => [x * pen.scale + pen.ox, -y * pen.scale + pen.oy];
const c2m = (cx, cy) => [(cx - pen.ox) / pen.scale, -(cy - pen.oy) / pen.scale];
function penEvt(e) {
  const r = penCv.getBoundingClientRect();
  return [(e.clientX - r.left) * (penCv.width / r.width),
          (e.clientY - r.top) * (penCv.height / r.height)];
}

function penContentBBox() {
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  const eat = (x, y) => { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; };
  for (const p of pen.paths) for (const n of p.nodes) eat(n.x, n.y);
  if (!isFinite(mnx) && source) for (const lp of source.loops) for (const [x, y] of lp) eat(x, y);
  if (!isFinite(mnx)) return { mnx: -50, mny: -50, mxx: 50, mxy: 50 };
  return { mnx, mny, mxx, mxy };
}

function penFit() {
  const cw = penCv.clientWidth || 300, ch = 360;
  penCv.width = cw; penCv.height = ch;
  const b = penContentBBox();
  const bw = (b.mxx - b.mnx) || 100, bh = (b.mxy - b.mny) || 100, pad = 24;
  pen.scale = Math.min((cw - 2 * pad) / bw, (ch - 2 * pad) / bh);
  const cx = (b.mnx + b.mxx) / 2, cy = (b.mny + b.mxy) / 2;
  pen.ox = cw / 2 - cx * pen.scale;
  pen.oy = ch / 2 + cy * pen.scale;   // note Y flip
}

function penBuildBg() {
  pen.bg = null;
  if (!penBackdrop) return;
  const { rgba, w, h } = penBackdrop;
  const cnv = Object.assign(document.createElement('canvas'), { width: w, height: h });
  cnv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
  pen.bg = cnv;
}

function penDraw() {
  const ctx = penCv.getContext('2d');
  const cw = penCv.width, ch = penCv.height;
  ctx.clearRect(0, 0, cw, ch);

  // backdrop (rectified photo): warp pixel (u,v) → canvas ((u-cx)*s+ox,(v-cy)*s+oy)
  if (pen.bg && penBackdrop) {
    const { w, h, cx, cy } = penBackdrop;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(pen.bg, (-cx) * pen.scale + pen.ox, (-cy) * pen.scale + pen.oy, w * pen.scale, h * pen.scale);
    ctx.globalAlpha = 1;
  }

  const accent = cssVar('--accent');
  for (const p of pen.paths) {
    if (p.nodes.length < 2) continue;
    const poly = pathToPolyline(p, penTol());
    ctx.beginPath();
    poly.forEach((pt, i) => { const c = m2c(pt[0], pt[1]); i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1]); });
    if (p.closed) ctx.closePath();
    ctx.lineWidth = 2; ctx.strokeStyle = accent; ctx.stroke();

    // handles
    ctx.strokeStyle = 'rgba(150,170,200,0.7)'; ctx.lineWidth = 1;
    for (const n of p.nodes) {
      const a = m2c(n.x, n.y);
      for (const h of [n.cIn, n.cOut]) {
        if (!h) continue;
        const c = m2c(h[0], h[1]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
        ctx.beginPath(); ctx.arc(c[0], c[1], 4, 0, 7); ctx.fillStyle = '#cbd5e6'; ctx.fill();
      }
    }
    // anchors (squares)
    for (const n of p.nodes) {
      const a = m2c(n.x, n.y);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(a[0] - 4, a[1] - 4, 8, 8); ctx.fill(); ctx.stroke();
    }
  }
}

// flatten tolerance scaled to content so segment counts stay sane across units
function penTol() {
  const b = penContentBBox();
  return Math.max(b.mxx - b.mnx, b.mxy - b.mny) * 0.0015 || 0.1;
}

// paths → source.loops → 3D. Editing with the pen redefines the silhouette,
// so photo lineLoops are dropped (relief "по линиям" no longer applies).
function penSync() {
  const loops = pathsToLoops(pen.paths, penTol());
  if (!loops.length) return;
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  for (const lp of loops) for (const [x, y] of lp) {
    if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y;
  }
  source = { loops, w: mxx - mnx, h: mxy - mny };
  rebuild(false);
}

function penImport() {
  if (!source || !source.loops.length) { setStatus('Нет контура — загрузите PDF или фото', 'warn'); return; }
  const b = { mnx: Infinity, mxx: -Infinity, mny: Infinity, mxy: -Infinity };
  for (const lp of source.loops) for (const [x, y] of lp) {
    if (x < b.mnx) b.mnx = x; if (x > b.mxx) b.mxx = x; if (y < b.mny) b.mny = y; if (y > b.mxy) b.mxy = y;
  }
  const eps = Math.max(b.mxx - b.mnx, b.mxy - b.mny) * 0.003;
  pen.paths = loopsToPaths(source.loops, eps);
  penFit(); penDraw();
}

function penActivate() {
  penBuildBg();
  if (!pen.paths.length && source && source.loops.length) penImport();
  else { penFit(); penDraw(); }
}

// hit test: handles first (on top), then anchors
function penPick(cx, cy) {
  for (let pi = 0; pi < pen.paths.length; pi++) {
    const ns = pen.paths[pi].nodes;
    for (let ni = 0; ni < ns.length; ni++) {
      for (const kind of ['cIn', 'cOut']) {
        const h = ns[ni][kind];
        if (!h) continue;
        const c = m2c(h[0], h[1]);
        if (Math.hypot(c[0] - cx, c[1] - cy) <= HIT) return { kind: kind === 'cIn' ? 'in' : 'out', pi, ni };
      }
    }
    for (let ni = 0; ni < ns.length; ni++) {
      const c = m2c(ns[ni].x, ns[ni].y);
      if (Math.hypot(c[0] - cx, c[1] - cy) <= HIT) return { kind: 'node', pi, ni };
    }
  }
  return null;
}

// --- editing ops used by the tools ---
function penNearestSeg(cx, cy) {
  const [mx, my] = c2m(cx, cy);
  let best = null;
  for (let pi = 0; pi < pen.paths.length; pi++) {
    const r = nearestSegment(pen.paths[pi], mx, my);
    if (r && (!best || r.dist < best.dist)) best = { pi, i: r.i, t: r.t, dist: r.dist };
  }
  return (best && best.dist * pen.scale <= HIT) ? best : null;
}
function penDelete(hit) {
  const p = pen.paths[hit.pi], n = p.nodes[hit.ni];
  if (hit.kind === 'node') {
    p.nodes.splice(hit.ni, 1);
    if (p.nodes.length < 2) pen.paths.splice(hit.pi, 1);
    pen.active = null;
  } else {
    if (hit.kind === 'in') n.cIn = null; else n.cOut = null;
    n.smooth = false;
  }
}
function penAddDown(cx, cy, mx, my, hit) {
  // 1) click the first node of the open active path → close it
  if (pen.active != null) {
    const ap = pen.paths[pen.active];
    if (ap && !ap.closed && ap.nodes.length >= 2) {
      const f = m2c(ap.nodes[0].x, ap.nodes[0].y);
      if (Math.hypot(f[0] - cx, f[1] - cy) <= HIT) {
        penHistory(); ap.closed = true; pen.active = null; penDraw(); penSync(); return;
      }
    }
  }
  if (hit) return; // clicking an existing node/handle in add mode: no-op (avoid dupes)
  // 2) click on a segment → insert a point that preserves the curve
  const seg = penNearestSeg(cx, cy);
  if (seg) { penHistory(); splitSegment(pen.paths[seg.pi], seg.i, seg.t); penDraw(); penSync(); return; }
  // 3) append a node to the active/open path (start a new one if needed), then
  //    drag pulls symmetric handles (a smooth node) like a real pen tool
  penHistory();
  let ap;
  if (pen.active != null && pen.paths[pen.active] && !pen.paths[pen.active].closed) ap = pen.paths[pen.active];
  else { ap = makePath([], false); pen.paths.push(ap); pen.active = pen.paths.length - 1; }
  ap.nodes.push(makeNode(mx, my));
  pen.drag = { kind: 'newhandle', pi: pen.active, ni: ap.nodes.length - 1, moved: false };
  penDraw();
}

// --- two-pointer pan+pinch (touch) ---
const ptrs = new Map();
let gesture = null;
function gestureStart() {
  const [a, b] = [...ptrs.values()];
  gesture = {
    mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
    dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    scale: pen.scale, ox: pen.ox, oy: pen.oy,
  };
  pen.drag = null; // cancel any single-pointer action
}
function gestureMove() {
  const [a, b] = [...ptrs.values()];
  const nmx = (a.x + b.x) / 2, nmy = (a.y + b.y) / 2;
  const ndist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const f = ndist / gesture.dist;
  pen.scale = gesture.scale * f;
  // keep the start midpoint anchored, then apply its screen translation
  pen.ox = nmx - (gesture.mx - gesture.ox) * f;
  pen.oy = nmy - (gesture.my - gesture.oy) * f;
  penDraw();
}

let spaceDown = false; // desktop: hold Space to pan in any tool

penCv.addEventListener('pointerdown', (e) => {
  penCv.setPointerCapture(e.pointerId);
  const [cx, cy] = penEvt(e);
  ptrs.set(e.pointerId, { x: cx, y: cy });
  if (ptrs.size === 2) { gestureStart(); return; }
  if (ptrs.size > 2) return;

  const hit = penPick(cx, cy);
  const [mx, my] = c2m(cx, cy);
  const panMode = spaceDown || e.button === 1;
  if (panMode) { pen.drag = { kind: 'pan', sx: cx, sy: cy, ox: pen.ox, oy: pen.oy }; return; }

  if (pen.tool === 'del') {
    if (hit) { penHistory(); penDelete(hit); penDraw(); penSync(); }
    else pen.drag = { kind: 'pan', sx: cx, sy: cy, ox: pen.ox, oy: pen.oy };
    return;
  }
  if (pen.tool === 'add') { penAddDown(cx, cy, mx, my, hit); return; }
  // edit tool
  if (hit) { penHistory(); pen.drag = { ...hit, moved: false }; }
  else pen.drag = { kind: 'pan', sx: cx, sy: cy, ox: pen.ox, oy: pen.oy };
});

penCv.addEventListener('pointermove', (e) => {
  if (ptrs.has(e.pointerId)) { const [cx, cy] = penEvt(e); ptrs.set(e.pointerId, { x: cx, y: cy }); }
  if (gesture) { if (ptrs.size >= 2) gestureMove(); return; }
  if (!pen.drag) return;
  const [cx, cy] = penEvt(e);
  const d = pen.drag;
  if (d.kind === 'pan') { pen.ox = d.ox + (cx - d.sx); pen.oy = d.oy + (cy - d.sy); penDraw(); return; }
  const [mx, my] = c2m(cx, cy);
  const node = pen.paths[d.pi].nodes[d.ni];
  d.moved = true;
  if (d.kind === 'node') {
    const dx = mx - node.x, dy = my - node.y;
    node.x = mx; node.y = my;
    if (node.cIn) { node.cIn[0] += dx; node.cIn[1] += dy; }   // handles follow the anchor
    if (node.cOut) { node.cOut[0] += dx; node.cOut[1] += dy; }
  } else if (d.kind === 'newhandle') {
    node.cOut = [mx, my];
    node.cIn = [2 * node.x - mx, 2 * node.y - my]; // mirror
    node.smooth = true;
  } else { // 'in' | 'out' handle
    if (d.kind === 'in') node.cIn = [mx, my]; else node.cOut = [mx, my];
    if (e.altKey) node.smooth = false;             // Alt breaks into a corner
    else if (node.smooth) {                         // mirror the opposite handle
      const other = d.kind === 'in' ? 'cOut' : 'cIn';
      node[other] = [2 * node.x - mx, 2 * node.y - my];
    }
  }
  penDraw();
});

function penEndPointer(e) {
  ptrs.delete(e.pointerId);
  if (gesture && ptrs.size < 2) gesture = null;
  const d = pen.drag;
  if (!d) return;
  pen.drag = null;
  if (d.kind === 'pan') return;
  if ((d.kind === 'node' || d.kind === 'in' || d.kind === 'out') && !d.moved) {
    pen.undo.pop(); penUpdateUndoBtns(); return; // click without drag: discard the snapshot
  }
  penSync();
}
penCv.addEventListener('pointerup', penEndPointer);
penCv.addEventListener('pointercancel', penEndPointer);

penCv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [cx, cy] = penEvt(e);
  const [mx, my] = c2m(cx, cy);
  const f = Math.exp(-e.deltaY * 0.0015);
  pen.scale *= f;
  pen.ox = cx - mx * pen.scale;          // zoom toward the cursor
  pen.oy = cy + my * pen.scale;
  penDraw();
}, { passive: false });

// tool switch (finishes the current open path)
document.querySelectorAll('input[name=penTool]').forEach((r) =>
  r.addEventListener('change', () => { pen.tool = document.querySelector('input[name=penTool]:checked').value; pen.active = null; penDraw(); }));

$('penUndo').addEventListener('click', penUndo);
$('penRedo').addEventListener('click', penRedo);
$('penImport').addEventListener('click', () => { penHistory(); pen.paths = []; pen.active = null; penImport(); penSync(); });
$('penClear').addEventListener('click', () => { penHistory(); pen.paths = []; pen.active = null; penFit(); penDraw(); });
document.querySelectorAll('.pen-edit').forEach((b) =>
  b.addEventListener('click', () => { pen.paths = []; pen.active = null; pen.undo.length = pen.redo.length = 0; penUpdateUndoBtns(); selectTab('pen'); }));
addEventListener('resize', () => { if (!$('pane-pen').hidden) { penFit(); penDraw(); } });

// keyboard (only while the Pen pane is open)
addEventListener('keydown', (e) => {
  if ($('pane-pen').hidden) return;
  if (e.code === 'Space') { spaceDown = true; return; }
  const meta = e.ctrlKey || e.metaKey;
  if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? penRedo() : penUndo(); return; }
  if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); penRedo(); return; }
  const setTool = (t) => { pen.tool = t; document.querySelector(`input[name=penTool][value=${t}]`).checked = true; pen.active = null; penDraw(); };
  if (e.key === 'v' || e.key === 'V') setTool('edit');
  else if (e.key === 'p' || e.key === 'P') setTool('add');
  else if (e.key === 'd' || e.key === 'D') setTool('del');
  else if (e.key === 'Escape' || e.key === 'Enter') { pen.active = null; penDraw(); }
});
addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });

/* ---------------- download ---------------- */
$('download').addEventListener('click', () => {
  if (!lastSTL) return;
  const blob = new Blob([lastSTL], { type: 'model/stl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fileName + '.stl'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

syncControls();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
