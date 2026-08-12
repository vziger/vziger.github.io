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
  // fit: recentre/zoom the camera to the model. The very first model always fits
  // (via _fitted); after that the camera angle is kept — even on a new file load —
  // unless a caller explicitly passes fit=true.
  setMesh(tris, fit = false) {
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
    const mat = new THREE.MeshStandardMaterial({ color: 0x6bb7ff, metalness: 0.1, roughness: 0.65, flatShading: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = -geo.boundingBox.min.y; // base sits on the grid
    this.scene.add(this.mesh);
    if (fit || !this._fitted) { this._fit(geo.boundingBox); this._fitted = true; }
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
