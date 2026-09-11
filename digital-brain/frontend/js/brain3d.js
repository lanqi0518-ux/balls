/**
 * brain3d.js — Three.js visualisation of the digital brain.
 *
 *   * Cortical hull: a translucent, slightly noisy "brain-shaped" mesh
 *   * Region blobs: one per anatomical region, colour-coded, pulsing with
 *                   real-time activation streamed from the backend.
 *   * Interaction: orbit controls, hover tooltip, click-to-select.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * BrainScene manages the whole 3D visualisation.
 * Backend region positions are (x, y, z) in a millimetre-ish space where:
 *   x = left–right         (Three.js x)
 *   y = anterior–posterior (Three.js z, with anterior = +z)
 *   z = superior–inferior  (Three.js y, with superior = +y)
 *
 * We rotate the backend coordinate into Three.js on ingest.
 */
export class BrainScene {
  constructor(container, { onRegionSelect } = {}) {
    this.container = container;
    this.onRegionSelect = onRegionSelect || (() => {});
    this.regions = new Map(); // name -> { mesh, meta, data }
    this.selectedName = null;
    this.hoveredName = null;

    this._initScene();
    this._buildCorticalHull();
    this._addLights();
    this._addStarfield();
    this._addInteraction();
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._animate();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05070d, 0.0035);

    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 4000);
    this.camera.position.set(160, 70, 200);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 100;
    this.controls.maxDistance = 500;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.35;

    // Tooltip element
    this.tooltip = document.createElement("div");
    this.tooltip.className = "brain-tooltip";
    this.tooltip.style.display = "none";
    this.container.appendChild(this.tooltip);
  }

  _addLights() {
    this.scene.add(new THREE.AmbientLight(0x223045, 0.7));
    const key = new THREE.DirectionalLight(0x9fd6ff, 0.9);
    key.position.set(200, 300, 200);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xc084fc, 0.4);
    rim.position.set(-200, -150, -100);
    this.scene.add(rim);
    const bottom = new THREE.DirectionalLight(0x38bdf8, 0.25);
    bottom.position.set(0, -300, 0);
    this.scene.add(bottom);
  }

  /**
   * Build a stylised, anatomically-plausible cerebral hull:
   *   1) an ellipsoid roughly matching brain proportions
   *   2) displaced vertex-by-vertex with 3D noise to give the appearance of
   *      gyri and sulci (fissures)
   *   3) split into two hemispheres via a longitudinal fissure
   *   4) rendered translucent so the region blobs inside are visible
   */
  _buildCorticalHull() {
    const geo = new THREE.SphereGeometry(90, 96, 64);
    // Squash to brain proportions (longer front-back, shorter top-bottom)
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // scale: x = left-right (0.85), y = top-bottom (0.85), z = front-back (1.15)
      let sx = x * 0.9;
      let sy = y * 0.85;
      let sz = z * 1.15;
      // Add pseudo-random ridges (fake gyri)
      const noise = this._noise3(sx * 0.06, sy * 0.06, sz * 0.06) * 5;
      const ridges = Math.sin(sx * 0.11) * Math.cos(sy * 0.12) * Math.sin(sz * 0.09) * 3.5;
      const disp = noise + ridges;
      const len = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      sx += (sx / len) * disp;
      sy += (sy / len) * disp;
      sz += (sz / len) * disp;
      // Longitudinal fissure: push slightly inward near x=0
      const fissure = Math.max(0, 1 - Math.abs(sx) / 12) * (1 - Math.abs(sy) / 100);
      sx += (sx >= 0 ? 1 : -1) * fissure * 1.5;
      // Tilt slightly (occipital lower)
      const tilt = -0.06;
      const yr = sy * Math.cos(tilt) - sz * Math.sin(tilt);
      const zr = sy * Math.sin(tilt) + sz * Math.cos(tilt);
      pos.setXYZ(i, sx, yr, zr);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshPhongMaterial({
      color: 0x3b4a6b,
      emissive: 0x1a2540,
      specular: 0x4a5c85,
      shininess: 25,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      flatShading: false,
    });
    const brain = new THREE.Mesh(geo, mat);
    this.scene.add(brain);
    this.brainHull = brain;

    // Wireframe overlay for that MRI look
    const wireGeo = new THREE.EdgesGeometry(geo, 25);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x5a7599,
      transparent: true,
      opacity: 0.35,
    });
    const wire = new THREE.LineSegments(wireGeo, wireMat);
    this.scene.add(wire);
    this.brainWireframe = wire;

    // Brainstem (small cylinder trailing down)
    const stemGeo = new THREE.CylinderGeometry(8, 5, 40, 16, 8, true);
    const stemMat = new THREE.MeshPhongMaterial({
      color: 0x2a3550,
      emissive: 0x090c14,
      shininess: 10,
      transparent: true, opacity: 0.35,
    });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(0, -55, -10);
    stem.rotation.x = 0.15;
    this.scene.add(stem);

    // Central axis reference (subtle)
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -85, 0),
      new THREE.Vector3(0, 85, 0),
    ]);
    const axisMat = new THREE.LineBasicMaterial({
      color: 0x1e2a3f,
      transparent: true, opacity: 0.4,
    });
    this.scene.add(new THREE.Line(axisGeo, axisMat));
  }

  _addStarfield() {
    // Ambient particles — subtle "neural dust"
    const N = 250;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 300 + Math.random() * 400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 1.4,
      transparent: true,
      opacity: 0.35,
      sizeAttenuation: true,
    });
    this.scene.add(new THREE.Points(geo, mat));
  }

  /**
   * Convert a backend region position (x, y, z) to Three.js coords.
   * Backend: x=L/R, y=A/P, z=S/I  →  Three.js: (x, z, y)
   */
  _backendToScene(pos) {
    // Backend coords: x=L/R, y=A/P (front=positive), z=S/I (up=positive).
    // Three.js: x=L/R, y=up/down, z=front/back (with -z = front by convention,
    // but our camera looks from +z, so we treat +z as front for authoring).
    // Scale roughly to fit inside a hull of extent ~[100, 90, 115].
    const [x, y, z] = pos;
    return new THREE.Vector3(x * 0.9, z * 0.9, y * 0.9);
  }

  updateRegions(regionStates) {
    for (const r of regionStates) {
      if (!this.regions.has(r.name)) {
        this._addRegion(r);
      }
      const entry = this.regions.get(r.name);
      entry.data = r;
      // Sphere radius range: 7–14 (readable but non-overlapping).
      const size = 7 + Math.pow(r.activation, 0.6) * 7;
      entry.core.scale.setScalar(size / entry.baseSize);
      entry.core.material.opacity = 0.85 + r.activation * 0.15;
      entry.glow.material.opacity = 0.15 + r.activation * 0.45;
      entry.glow.scale.setScalar((size * 2.4) / entry.baseSize);
      entry.pulseTarget = r.activation;
    }
    this._updateLegend(regionStates);
  }

  _addRegion(meta) {
    const color = new THREE.Color(meta.color);
    const scenePos = this._backendToScene(meta.position);

    // Core sphere (solid, colored)
    const baseSize = 10;
    const coreGeo = new THREE.SphereGeometry(baseSize, 24, 20);
    const coreMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);

    // Outer glow (large translucent sphere)
    const glowGeo = new THREE.SphereGeometry(baseSize, 24, 20);
    const glowMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.scale.setScalar(2.2);

    // Group both
    const group = new THREE.Group();
    group.add(glow);
    group.add(core);
    group.position.copy(scenePos);
    group.userData.regionName = meta.name;
    this.scene.add(group);

    // Label sprite (small text)
    const labelSprite = this._makeLabel(meta.zh_name || meta.display_name, color);
    labelSprite.position.set(0, baseSize + 8, 0);
    labelSprite.visible = false;
    group.add(labelSprite);

    this.regions.set(meta.name, {
      mesh: group,
      core,
      glow,
      label: labelSprite,
      meta,
      data: meta,
      baseSize,
      pulseTarget: meta.activation || 0,
      pulseCurrent: meta.activation || 0,
    });
  }

  _makeLabel(text, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.font = "600 22px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(5, 7, 13, 0.85)";
    ctx.strokeStyle = `#${color.getHexString()}`;
    ctx.lineWidth = 1.5;
    const w = ctx.measureText(text).width + 24;
    const x = (canvas.width - w) / 2;
    ctx.fillRect(x, 12, w, 40);
    ctx.strokeRect(x + 0.5, 12.5, w - 1, 39);
    ctx.fillStyle = "#e8edf5";
    ctx.fillText(text, canvas.width / 2, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(50, 12.5, 1);
    return sprite;
  }

  _updateLegend(regionStates) {
    const legendEl = document.getElementById("brain-legend");
    if (!legendEl) return;
    if (legendEl.children.length === 0) {
      for (const r of regionStates) {
        const item = document.createElement("div");
        item.className = "legend-item";
        item.dataset.name = r.name;
        item.style.color = r.color;
        item.innerHTML = `
          <span class="legend-swatch" style="background:${r.color}"></span>
          <span class="legend-name">${r.zh_name || r.display_name}</span>
          <span class="legend-bar"><span class="legend-bar-fill" style="width:0%"></span></span>
        `;
        item.addEventListener("click", () => this.select(r.name));
        legendEl.appendChild(item);
      }
    }
    for (const r of regionStates) {
      const item = legendEl.querySelector(`.legend-item[data-name="${r.name}"]`);
      if (item) {
        const fill = item.querySelector(".legend-bar-fill");
        if (fill) fill.style.width = `${(r.activation * 100).toFixed(0)}%`;
        item.classList.toggle("selected", r.name === this.selectedName);
      }
    }
  }

  _addInteraction() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getIntersects = (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, this.camera);
      const targets = [];
      for (const entry of this.regions.values()) {
        entry.core.userData.regionName = entry.meta.name;
        targets.push(entry.core);
      }
      return { hits: raycaster.intersectObjects(targets), rect };
    };

    this.renderer.domElement.addEventListener("mousemove", (e) => {
      const { hits, rect } = getIntersects(e);
      if (hits.length) {
        const name = hits[0].object.userData.regionName;
        this.hoveredName = name;
        const entry = this.regions.get(name);
        entry.label.visible = true;
        this.tooltip.style.display = "block";
        this.tooltip.style.left = `${e.clientX - rect.left + 12}px`;
        this.tooltip.style.top = `${e.clientY - rect.top + 12}px`;
        this.tooltip.innerHTML = `
          <div class="tt-title" style="color:${entry.meta.color}">${entry.meta.display_name}</div>
          <div class="tt-title mono" style="font-size:11px; color: var(--text-muted); margin-bottom:4px">${entry.meta.zh_name || ""}</div>
          <div class="tt-role">${entry.meta.role_zh || entry.meta.role}</div>
          <div class="tt-act">activation ${(entry.data.activation * 100).toFixed(0)}%</div>
        `;
        this.renderer.domElement.style.cursor = "pointer";
      } else {
        this.tooltip.style.display = "none";
        if (this.hoveredName && this.hoveredName !== this.selectedName) {
          const e2 = this.regions.get(this.hoveredName);
          if (e2) e2.label.visible = false;
        }
        this.hoveredName = null;
        this.renderer.domElement.style.cursor = "";
      }
    });

    this.renderer.domElement.addEventListener("click", (e) => {
      const { hits } = getIntersects(e);
      if (hits.length) {
        const name = hits[0].object.userData.regionName;
        this.select(name);
        this.controls.autoRotate = false;
      }
    });

    this.renderer.domElement.addEventListener("dblclick", () => {
      this.controls.autoRotate = true;
    });
  }

  select(name) {
    if (this.selectedName && this.regions.has(this.selectedName)) {
      const prev = this.regions.get(this.selectedName);
      prev.label.visible = false;
    }
    this.selectedName = name;
    if (this.regions.has(name)) {
      const entry = this.regions.get(name);
      entry.label.visible = true;
      this.onRegionSelect(entry.data);
    }
    this._updateLegendSelection();
  }

  _updateLegendSelection() {
    const legendEl = document.getElementById("brain-legend");
    if (!legendEl) return;
    for (const item of legendEl.querySelectorAll(".legend-item")) {
      item.classList.toggle("selected", item.dataset.name === this.selectedName);
    }
  }

  _resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    // Smoothly interpolate pulses toward target activation and add a subtle
    // breathing wobble proportional to activation.
    for (const entry of this.regions.values()) {
      entry.pulseCurrent += (entry.pulseTarget - entry.pulseCurrent) * 0.15;
      const t = performance.now() * 0.001;
      const baseScale = entry.core.scale.x || 1;
      const wobble = 1 + entry.pulseCurrent * 0.08 * Math.sin(t * (2 + entry.pulseCurrent * 3));
      entry.glow.scale.setScalar((baseScale * 2.3) * wobble);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Tiny deterministic 3D "noise" using layered sines.
  _noise3(x, y, z) {
    return (
      Math.sin(x * 1.3 + y * 0.7 + z * 1.1) +
      Math.sin(x * 2.1 - z * 1.9) +
      Math.sin(y * 1.7 + z * 2.3) +
      Math.sin(x * 0.4 - y * 1.5 + z * 0.9)
    ) * 0.25;
  }
}
