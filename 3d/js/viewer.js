// viewer.js — three.js preview of the generated solid.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

// Grid colours per theme (axis = centre lines, line = the rest). Edit here.
const GRID = {
  size: 400, divisions: 40,
  dark:  { axis: 0x3a6ea5, line: 0x2a2f3a, opacity: 0.85 },
  light: { axis: 0x2f7ff0, line: 0xc3ccd8, opacity: 0.55 },
};
function makeGrid(light) {
  const c = light ? GRID.light : GRID.dark;
  const g = new THREE.GridHelper(GRID.size, GRID.divisions, c.axis, c.line);
  g.material.opacity = c.opacity; g.material.transparent = true;
  return g;
}

export class Viewer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    this.camera.position.set(60, 80, 120);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(40, 120, 80);
    this.scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dir2.position.set(-60, 40, -40);
    this.scene.add(dir2);

    this.grid = makeGrid(false); // dark default; setTheme recolours on init
    this.scene.add(this.grid);

    this.mesh = null;
    this._resize();
    addEventListener('resize', () => this._resize());
    const loop = () => { this.controls.update(); this.renderer.render(this.scene, this.camera); requestAnimationFrame(loop); };
    loop();
  }

  _resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // tris: flat array (9 floats/triangle) in model space (x right, y up, z thickness)
  // reframe: on a NEW file load, keep the current viewing ANGLE but move the camera
  // distance/target so the model is always in frame (never an empty preview). The
  // very first model does a full _fit (default 3/4 view). Plain option tweaks pass
  // reframe=false and keep the camera exactly as the user left it.
  setMesh(tris, reframe = false, baseH = null, detailH = null) {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    const n = tris.length / 3;
    const pos = new Float32Array(n * 3);
    // remap (x,y,z) -> (x, z, -y) so thickness stands up on the grid
    for (let i = 0; i < tris.length; i += 3) {
      pos[i] = tris[i];
      pos[i + 1] = tris[i + 2];
      pos[i + 2] = -tris[i + 1];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    geo.computeBoundingBox();

    // Shade by SIGNED height around the plate top (baseH): raised details (above)
    // get LIGHTER than the base, recesses (below) get DARKER — so embossed tops pop
    // and engraved floors read deep. Contrast is referenced to the relief depth
    // (detailH) so shallow grooves still reach dark. Height = pos[i+1] in mm.
    let minH = Infinity, maxH = -Infinity;
    for (let i = 1; i < pos.length; i += 3) { if (pos[i] < minH) minH = pos[i]; if (pos[i] > maxH) maxH = pos[i]; }
    const top = (baseH != null) ? baseH : maxH;   // "base colour" plane
    const ref = Math.max(detailH || (maxH - minH) || 1, 1e-3); // depth that reaches full dark/light
    // linear-space components: three converts sRGB→linear for material.color, but
    // vertex colours are taken as-is, so convert here or the tint reads washed out
    const bc = new THREE.Color(0x6bb7ff);
    const base = [bc.r, bc.g, bc.b];
    const DARK = 0.4, LIGHT = 1.3; // brightness at full recess / full relief
    const col = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const h = pos[v * 3 + 1];
      const d = Math.min(1, Math.abs(h - top) / ref);
      const f = h >= top ? 1 + (LIGHT - 1) * d : 1 - (1 - DARK) * d;
      col[v * 3] = base[0] * f; col[v * 3 + 1] = base[1] * f; col[v * 3 + 2] = base[2] * f;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.65, flatShading: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = -geo.boundingBox.min.y; // base sits on the grid
    this.scene.add(this.mesh);
    if (!this._fitted) { this._fit(geo.boundingBox); this._fitted = true; }
    else if (reframe) { this._reframe(geo.boundingBox); }
  }

  _fit(box) {
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    center.y -= box.min.y; // mesh is offset so its base sits on the grid
    const radius = Math.max(size.x, size.y, size.z) || 50;
    const dist = radius * 2.4;
    this.camera.position.set(center.x + dist * 0.6, center.y + dist * 0.7, center.z + dist);
    this.camera.near = radius / 100; this.camera.far = radius * 100; this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    const g = Math.max(size.x, size.z) * 2.2;
    this.grid.scale.setScalar(Math.max(1, g / 400));
  }

  // recentre + reset scale to the current model, keeping the camera angle.
  // With no model yet: recentre on the origin at the default distance, keep angle.
  resetView() {
    if (this.mesh) {
      this.mesh.geometry.computeBoundingBox();
      this._reframe(this.mesh.geometry.boundingBox);
      return;
    }
    const dist = Math.hypot(60, 80, 120);
    let dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(60, 80, 120);
    dir.normalize();
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(dir.multiplyScalar(dist));
    this.grid.scale.setScalar(1);
  }

  // reset the camera to the default 3/4 view (angle + framing).
  // With no model yet: restore the initial camera pose.
  fitView() {
    if (this.mesh) {
      this.mesh.geometry.computeBoundingBox();
      this._fit(this.mesh.geometry.boundingBox);
      return;
    }
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(60, 80, 120);
    this.camera.near = 0.1; this.camera.far = 5000; this.camera.updateProjectionMatrix();
    this.grid.scale.setScalar(1);
  }

  // keep the current view direction, but re-fit distance + target to a new model
  _reframe(box) {
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    center.y -= box.min.y; // mesh base sits on the grid
    const radius = Math.max(size.x, size.y, size.z) || 50;
    const dist = radius * 2.4;
    let dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0.6, 0.7, 1); // fallback if degenerate
    dir.normalize();
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.camera.near = radius / 100; this.camera.far = radius * 100; this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.grid.scale.setScalar(Math.max(1, Math.max(size.x, size.z) * 2.2 / 400));
  }

  // recolour the grid for light/dark so it stays visible on either background
  setTheme(t) {
    const light = t === 'light';
    const s = this.grid.scale.x;
    this.scene.remove(this.grid);
    this.grid.geometry.dispose(); this.grid.material.dispose();
    this.grid = makeGrid(light);
    this.grid.scale.setScalar(s);
    this.scene.add(this.grid);
  }
}
