// app.js — UI controller. Two input front-ends (PDF, Photo) feed one shared
// scale → build → preview → STL pipeline.
import { extractContours } from './pdf-extract.js';
import { photoToLoops, detectPaperCorners } from './image-process.js';
import { buildSolid, buildRelief, meshToSTL } from './geometry.js';
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
let rotation = 0;       // 0..3 quarter-turns; a property of the loaded file
let fileName = 'model';
let lastSTL = null;

function setStatus(msg, kind = '') { const el = $('status'); el.textContent = msg; el.className = 'status ' + kind; }
function num(id, def) { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : def; }
const nextFrame = () => new Promise((r) => setTimeout(r, 12));

/* ---------------- tabs ---------------- */
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  const tab = t.dataset.tab;
  $('pane-pdf').hidden = tab !== 'pdf';
  $('pane-photo').hidden = tab !== 'photo';
}));

/* ---------------- shared build ---------------- */
function syncControls() {
  const relief = document.querySelector('input[name=mode]:checked').value === 'relief';
  $('reliefRow').style.display = relief ? '' : 'none';
  $('detailRow').style.display = relief ? '' : 'none';
  $('modeHint').textContent = relief
    ? 'База-силуэт + внутренние детали как выступы или канавки.'
    : 'Внешний контур залит, внутренние — сквозные отверстия.';
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
  const loops = rotated(source.loops).map((lp) => lp.map(([x, y]) => [x * scale, y * scale]));
  const baseH = num('base', 5);
  const mode = document.querySelector('input[name=mode]:checked').value;

  let mesh;
  if (mode === 'solid') mesh = buildSolid(loops, baseH);
  else mesh = buildRelief(loops, baseH, num('detail', 1.5), $('emboss').checked);

  viewer.setMesh(mesh.tris, fit);
  lastSTL = meshToSTL(mesh);

  const totH = mode === 'solid' ? baseH : baseH + ($('emboss').checked ? num('detail', 1.5) : 0);
  $('info').innerHTML =
    `Контуров: <b>${source.loops.length}</b> · Размер: <b>${widthMM.toFixed(1)}×${(srcH * scale).toFixed(1)}×${totH.toFixed(1)} мм</b> · ` +
    `Треугольников: <b>${(mesh.tris.length / 9) | 0}</b>`;
  $('download').disabled = false;
  setStatus('Готово', 'ok');
}

document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { syncControls(); rebuild(false); }));
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
    rebuild(fit);
  } catch (e) { console.error(e); setStatus('Ошибка PDF: ' + (e.message || e), 'err'); }
}
$('file').addEventListener('change', (e) => { rotation = 0; loadPDF(e.target.files[0], true); });
$('tol').addEventListener('change', () => { const f = $('file').files[0]; if (f) loadPDF(f, false); });
{
  const d = $('drop');
  ['dragover', 'dragenter'].forEach((ev) => d.addEventListener(ev, (e) => { e.preventDefault(); d.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => d.addEventListener(ev, (e) => { e.preventDefault(); d.classList.remove('over'); }));
  d.addEventListener('drop', (e) => { rotation = 0; loadPDF(e.dataTransfer.files[0]); });
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
  rotation = 0; // new photo resets orientation
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
    });
    if (!res.loops.length) { setStatus('Силуэт не найден — подвиньте углы или измените чувствительность', 'err'); return; }
    // map warped contour → source image coords for the overlay
    const H = res.H;
    photo.contourSrc = res.contour.map(([x, y]) => {
      const w = H[6] * x + H[7] * y + H[8];
      return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
    });
    redrawPhoto();
    source = { loops: res.loops, w: res.w, h: res.h };
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
