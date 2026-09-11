/**
 * brain3d.js — Three.js visualisation of the digital brain.
 *
 *   * Cerebrum: an anatomically-shaped, translucent cortical mesh with a
 *               longitudinal fissure, frontal / temporal / occipital lobes,
 *               and noise-displaced cortical folds (gyri + sulci).
 *   * Cerebellum: two ridged lobes tucked under the occipital pole.
 *   * Brainstem: a tapered stem descending from the base.
 *   * Region blobs: one per anatomical region, colour-coded, pulsing with
 *                   real-time activation streamed from the backend.
 *   * Interaction: orbit controls, hover tooltip, click-to-select.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * Backend region positions are (x, y, z) in a millimetre-ish space where:
 *   x = left–right         (Three.js x)
 *   y = anterior–posterior (Three.js z, with anterior = +z)
 *   z = superior–inferior  (Three.js y, with superior = +y)
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
    this._buildAnatomy();
    this._addLights();
    this._addStarfield();
    this._addInteraction();
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._animate();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05070d, 0.0032);

    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 4000);
    this.camera.position.set(170, 90, 220);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 110;
    this.controls.maxDistance = 520;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.35;

    this.tooltip = document.createElement("div");
    this.tooltip.className = "brain-tooltip";
    this.tooltip.style.display = "none";
    this.container.appendChild(this.tooltip);
  }

  _addLights() {
    this.scene.add(new THREE.AmbientLight(0x2a3550, 0.75));
    const key = new THREE.DirectionalLight(0xc0ddff, 0.9);
    key.position.set(200, 320, 220);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xd8b4fe, 0.4);
    rim.position.set(-220, -140, -110);
    this.scene.add(rim);
    const bottom = new THREE.DirectionalLight(0x60a5fa, 0.28);
    bottom.position.set(0, -320, 0);
    this.scene.add(bottom);
  }

  // -----------------------------------------------------------------
  //  Anatomy
  // -----------------------------------------------------------------

  _buildAnatomy() {
    this._buildCerebrum();
    this._buildCerebellum();
    this._buildBrainstem();
  }

  /**
   * Cerebrum: one closed mesh reshaped from a high-res sphere into a
   * two-hemisphere brain silhouette. We add a deep longitudinal fissure
   * along the sagittal midplane, forward-projecting frontal lobes, an
   * overhanging occipital pole, temporal-lobe bulges on the flanks, and
   * multi-octave noise displacement approximating gyri and sulci.
   */
  _buildCerebrum() {
    const R = 55;
    const geo = new THREE.SphereGeometry(R, 192, 128);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const ux = x / R, uy = y / R, uz = z / R;

      // 1) Anisotropic ellipsoid: L/R narrower, front-back longer.
      x = ux * 50;
      y = uy * 52;
      z = uz * 80;

      // 2) Frontal-lobe forward bulge (+z) — rounder and slightly taller.
      if (uz > 0) {
        const t = uz;
        z += Math.pow(t, 1.4) * 14;
        y += Math.pow(t, 2) * 4;
      }

      // 3) Occipital taper + lift (real brains overhang cerebellum).
      if (uz < -0.35) {
        const t = Math.min(1, (-uz - 0.35) / 0.65);
        x *= (1 - t * 0.18);
        y *= (1 - t * 0.14);
        y += t * 6;
        z -= t * 4;
      }

      // 4) Temporal-lobe bulges — outward + downward on the mid-lower flank.
      {
        const midlow = Math.max(0, 1 - Math.abs(uy + 0.32) * 2.6) *
                       Math.max(0, 1 - Math.abs(uz)        * 1.4);
        x += Math.sign(ux || 1) * midlow * 11;
        y -= midlow * 7;
      }

      // 5) Base flattening — bottom is flatter (skull-base support).
      if (uy < -0.7) {
        const t = Math.min(1, (-uy - 0.7) / 0.3);
        y = y * (1 - t) + (-52 * 0.82) * t;
      }

      // 6) Longitudinal fissure along x = 0. Deep on top, shallow on base.
      const distFromMid = Math.abs(x);
      const fissureShape = Math.max(0, 1 - distFromMid / 9) *
                           Math.max(0, 1 - Math.abs(z) / 95);
      const topWeight = Math.max(0, Math.min(1, (uy + 0.15) * 1.6));
      const fissureDepth = fissureShape * topWeight;
      // Groove: press downward.
      y -= fissureDepth * 6.0;
      // Push away from midline (widens the crease).
      x += Math.sign(x || 1) * fissureDepth * 2.8;

      // 7) Cortical folds — gyri (outward) and sulci (inward) via multi-
      // octave sines. Sulci are exaggerated so the surface reads as folded.
      const nx = x * 0.11, ny = y * 0.11, nz = z * 0.095;
      const fold = (
        Math.sin(nx * 1.9 + ny * 1.3 + 0.7) * 0.55 +
        Math.sin(nx * 2.7 - nz * 1.8 + 1.2) * 0.35 +
        Math.sin(ny * 2.4 + nz * 2.1 + 2.5) * 0.25 +
        Math.sin(nx * 3.9 + nz * 3.2 + 4.1) * 0.16 +
        Math.sin(nx * 5.1 + ny * 4.8 - nz * 4.5) * 0.09
      );
      const sulci = -Math.max(0, -fold) * 4.8;
      const gyri  =  Math.max(0,  fold) * 2.2;
      const disp = sulci + gyri;
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      x += (x / len) * disp;
      y += (y / len) * disp;
      z += (z / len) * disp;

      // 8) Slight forward tilt (occipital lower than frontal).
      const tilt = -0.04;
      const yr = y * Math.cos(tilt) - z * Math.sin(tilt);
      const zr = y * Math.sin(tilt) + z * Math.cos(tilt);
      pos.setXYZ(i, x, yr, zr);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshPhongMaterial({
      color: 0xb8a8c8,
      emissive: 0x2b1f35,
      specular: 0x6f5f80,
      shininess: 28,
      transparent: true,
      opacity: 0.30,
      side: THREE.DoubleSide,
      flatShading: false,
    });
    const cerebrum = new THREE.Mesh(geo, mat);
    this.scene.add(cerebrum);
    this.cerebrum = cerebrum;

    // Fine wireframe overlay traces the folds — looks like MRI surface lines.
    const wireGeo = new THREE.EdgesGeometry(geo, 22);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x7a6890,
      transparent: true,
      opacity: 0.28,
    });
    const wire = new THREE.LineSegments(wireGeo, wireMat);
    this.scene.add(wire);
    this.cerebrumWireframe = wire;
  }

  /**
   * Cerebellum: two smaller ridged lobes at the posterior-inferior position
   * (behind and below the occipital cortex). The ridges approximate the
   * cerebellar folia — parallel bands running roughly left-to-right.
   */
  _buildCerebellum() {
    const buildLobe = (side, seedOffset) => {
      const geo = new THREE.SphereGeometry(22, 96, 72);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const ux = x / 22, uy = y / 22, uz = z / 22;

        // Squash: wider L-R + top-bottom, shorter front-back.
        x = ux * 20;
        y = uy * 14;
        z = uz * 18;

        // Parallel folia — dense ridges running along x, with slight z-wobble.
        const ridge = Math.sin(z * 1.05 + Math.sin(x * 0.35 + seedOffset) * 0.6);
        const jitter = Math.sin(x * 0.7 + seedOffset) *
                       Math.sin(y * 0.9 + seedOffset * 0.5) * 0.35;
        const foliaDisp = -Math.abs(ridge + jitter) * 1.35;
        const len = Math.sqrt(x * x + y * y + z * z) || 1;
        x += (x / len) * foliaDisp;
        y += (y / len) * foliaDisp;
        z += (z / len) * foliaDisp;

        // Flatten the medial side (touches the vermis / midline).
        if (side < 0 && x > -1.5) {
          x -= (x + 1.5) * 0.7;
        } else if (side > 0 && x < 1.5) {
          x -= (x - 1.5) * 0.7;
        }
        pos.setXYZ(i, x, y, z);
      }
      geo.computeVertexNormals();

      const mat = new THREE.MeshPhongMaterial({
        color: 0xa79db8,
        emissive: 0x241a30,
        specular: 0x62526f,
        shininess: 22,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        flatShading: false,
      });
      const lobe = new THREE.Mesh(geo, mat);
      lobe.position.set(side * 14, -34, -60);
      lobe.rotation.x = 0.15;
      lobe.rotation.z = side * -0.05;
      return lobe;
    };

    this.cerebellumL = buildLobe(-1, 0.0);
    this.cerebellumR = buildLobe(+1, 3.7);
    this.scene.add(this.cerebellumL);
    this.scene.add(this.cerebellumR);

    // A soft vermis (central ridge) bridging the two lobes.
    const vermisGeo = new THREE.SphereGeometry(8, 32, 24);
    const vp = vermisGeo.attributes.position;
    for (let i = 0; i < vp.count; i++) {
      const x = vp.getX(i), y = vp.getY(i), z = vp.getZ(i);
      vp.setXYZ(i, x * 0.55, y * 0.9, z * 1.2);
    }
    vermisGeo.computeVertexNormals();
    const vermisMat = new THREE.MeshPhongMaterial({
      color: 0x9c92b0, emissive: 0x1d1428,
      transparent: true, opacity: 0.5, shininess: 18,
    });
    const vermis = new THREE.Mesh(vermisGeo, vermisMat);
    vermis.position.set(0, -34, -60);
    this.scene.add(vermis);
  }

  /**
   * Brainstem: tapered cylinder descending from base of the cerebrum,
   * angled slightly backward.
   */
  _buildBrainstem() {
    const geo = new THREE.CylinderGeometry(7, 4.5, 46, 24, 12, true);
    const pos = geo.attributes.position;
    // Add slight noise so it's not perfectly smooth.
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const bump = Math.sin(y * 0.4) * 0.35 + Math.sin(x * 0.5 + z * 0.3) * 0.25;
      const len = Math.sqrt(x * x + z * z) || 1;
      pos.setXYZ(i, x + (x / len) * bump, y, z + (z / len) * bump);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshPhongMaterial({
      color: 0x8f85a5,
      emissive: 0x1b1428,
      specular: 0x4f4560,
      shininess: 18,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const stem = new THREE.Mesh(geo, mat);
    stem.position.set(0, -55, -32);
    stem.rotation.x = 0.28;
    this.scene.add(stem);
    this.brainstem = stem;
  }

  _addStarfield() {
    const N = 260;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 320 + Math.random() * 420;
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
      opacity: 0.32,
      sizeAttenuation: true,
    });
    this.scene.add(new THREE.Points(geo, mat));
  }

  // -----------------------------------------------------------------
  //  Region markers (one glowing sphere per BrainRegion)
  // -----------------------------------------------------------------

  /**
   * Convert a backend region position (x, y, z) to Three.js coords.
   * Backend: x=L/R, y=A/P (front=+), z=S/I (up=+)  →  Three.js (x, z, y).
   */
  _backendToScene(pos) {
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

    const baseSize = 10;
    const coreGeo = new THREE.SphereGeometry(baseSize, 24, 20);
    const coreMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);

    const glowGeo = new THREE.SphereGeometry(baseSize, 24, 20);
    const glowMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.scale.setScalar(2.2);

    const group = new THREE.Group();
    group.add(glow);
    group.add(core);
    group.position.copy(scenePos);
    group.userData.regionName = meta.name;
    this.scene.add(group);

    const labelSprite = this._makeLabel(meta.display_name, color);
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
          <span class="legend-name">${r.display_name}</span>
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
          <div class="tt-role">${entry.meta.role}</div>
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
}
