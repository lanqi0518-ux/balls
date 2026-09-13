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
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

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
    this._buildVasculature();
    this._buildDustMotes();
    this._buildAuraShell();
    this._addLights();
    this._addStarfield();
    this._initPostprocessing();
    this._addInteraction();
    this._applyMobileTweaks();
    this._resize();
    window.addEventListener("resize", () => this._resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this._resize(), 100));
    if (typeof ResizeObserver !== "undefined") {
      try {
        const ro = new ResizeObserver(() => this._resize());
        ro.observe(this.container);
      } catch {}
    }
    setTimeout(() => this._resize(), 300);
    setTimeout(() => this._resize(), 1200);
    this._animate();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05070d, 0.0032);

    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 4000);
    this.camera.position.set(170, 90, 220);
    this.camera.lookAt(0, 0, 0);

    // Mobile is much happier at 1x DPR — retina phones otherwise render
    // at ~9x pixel budget which pins the GPU and stalls scrolling.
    this._isMobile = window.matchMedia("(max-width: 800px)").matches;
    const maxDpr = this._isMobile ? 1 : 2;
    this.renderer = new THREE.WebGLRenderer({ antialias: !this._isMobile, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
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

  /**
   * On phones the translucent cerebrum shell hides the region cores
   * inside it, and the cores themselves are too small to read at ~360px
   * width.  Make the shell thinner, bump the core base size, and pull
   * the camera in so the anatomy fills the panel.
   */
  _applyMobileTweaks() {
    if (!this._isMobile) return;
    try {
      if (this.cerebrum && this.cerebrum.material) {
        this.cerebrum.material.opacity = 0.22;
        this.cerebrum.material.transmission = 0.35;
        this.cerebrum.material.emissiveIntensity = 0.28;
        this.cerebrum.material.needsUpdate = true;
      }
      if (this.cerebrumWireframe && this.cerebrumWireframe.material) {
        this.cerebrumWireframe.material.opacity = 0.18;
      }
      this._regionBaseSize = 6;
      this._regionSizeGain = 4.5;
      this.camera.position.set(150, 70, 180);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) {
        this.controls.minDistance = 90;
        this.controls.autoRotateSpeed = 0.5;
      }
    } catch {}
  }

  _addLights() {
    this.scene.add(new THREE.AmbientLight(0x2b3555, 0.55));
    const key = new THREE.DirectionalLight(0xc9ddff, 1.15);
    key.position.set(200, 320, 220);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xf0abfc, 0.65);
    rim.position.set(-220, -140, -110);
    this.scene.add(rim);
    const bottom = new THREE.DirectionalLight(0x60a5fa, 0.32);
    bottom.position.set(0, -320, 0);
    this.scene.add(bottom);
    // Warm point-source planted inside the brain — subtle so the exterior
    // gyri/sulci still read as folds instead of a soft glowing cloud.
    const core = new THREE.PointLight(0xffb6e8, 0.55, 160, 1.6);
    core.position.set(0, -6, 0);
    this.scene.add(core);
    this.coreLight = core;
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

    // Cortex material — a translucent tissue look. We deliberately keep
    // opacity moderate and transmission low so the mesh reads AS the
    // brain surface (with visible gyri/sulci and vessel channels), not as
    // a blurry cloud. Sheen and clearcoat provide the wet-tissue rim.
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xa89ab8,
      emissive: 0x2a1a3f,
      emissiveIntensity: 0.35,
      roughness: 0.55,
      metalness: 0.02,
      transmission: 0.15,
      thickness: 2.5,
      ior: 1.4,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      clearcoat: 0.75,
      clearcoatRoughness: 0.35,
      sheen: 0.4,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(0xffa8d6),
    });
    const cerebrum = new THREE.Mesh(geo, mat);
    this.scene.add(cerebrum);
    this.cerebrum = cerebrum;

    // Fine wireframe overlay traces the folds — looks like MRI surface lines.
    const wireGeo = new THREE.EdgesGeometry(geo, 22);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xb98cc6,
      transparent: true,
      opacity: 0.34,
    });
    const wire = new THREE.LineSegments(wireGeo, wireMat);
    this.scene.add(wire);
    this.cerebrumWireframe = wire;

    // A back-side inner shell painted with a fresnel-emissive shader so
    // the brain appears lit from inside — a cortical bioluminescence.
    const innerGeo = geo.clone();
    const innerMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uTime: { value: 0 },
        uWarm: { value: new THREE.Color(0xff9fd6) },
        uCool: { value: new THREE.Color(0x6ee7ff) },
      },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vPos;
        void main() {
          vN = normalize(normalMatrix * normal);
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vN;
        varying vec3 vPos;
        uniform float uTime;
        uniform vec3 uWarm;
        uniform vec3 uCool;
        void main() {
          // Fresnel-only inner glow — only shows at grazing angles so
          // the front face still shows crisp exterior detail.
          float rim = pow(1.0 - abs(vN.z), 3.5);
          float pulse = 0.6 + 0.4 * sin(uTime * 0.9 + vPos.y * 0.05);
          vec3 col = mix(uCool, uWarm, 0.5 + 0.5 * sin(uTime * 0.4 + vPos.x * 0.04));
          gl_FragColor = vec4(col, rim * pulse * 0.28);
        }
      `,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.scale.setScalar(0.985);
    this.scene.add(inner);
    this.cerebrumInner = inner;
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
  //  Vasculature — Circle of Willis + major cerebral arteries +
  //                superior sagittal sinus. Rendered as glowing tubes
  //                with pulsating blood-cell dots traveling along them.
  //                Anatomical accuracy is stylised — we're not passing
  //                a neurosurgery board, we're going for MRA-render vibe.
  // -----------------------------------------------------------------

  _buildVasculature() {
    this.vesselCurves = [];              // { curve, kind, radius, color }
    this.vesselPulses = [];              // { curve, mesh, speed, phase, size }
    /**
     * Per-vessel handles so we can animate each tube's brightness with
     * its own systolic wave.  Every vessel gets a random phase offset so
     * the whole tree pulses organically rather than in lock-step.
     *   { core, halo1, halo2, baseCoreOp, baseHalo1Op, baseHalo2Op,
     *     phase, kind, color, wavePos, waveActive, curve }
     */
    this.vesselShells = [];

    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    // -- ARTERIES (bright rose-red, more prominent) --------------------
    // Coordinates chosen so tubes sit ON the outer cortical surface —
    // visible from every camera angle rather than buried inside the mesh.
    // Cerebrum bbox ≈ x±50 · y±55 · z-84..+95.
    const arteries = [
      // Basilar artery — vertical along brainstem, feeding upward.
      {
        color: 0xff5675, radius: 0.75, kind: "artery",
        points: [
          V( 0, -70, -34), V( 0, -60, -34), V( 0, -50, -34),
          V( 0, -42, -30), V( 0, -34, -26),
        ],
      },
      // Anterior Cerebral Artery, LEFT — up through longitudinal fissure
      // then over the top of the frontal lobe.
      {
        color: 0xff5675, radius: 0.7, kind: "artery",
        points: [
          V( 0, -34, -26), V(-2, -20, -8), V(-3, -2, 14),
          V(-4, 20, 34), V(-5, 40, 50), V(-4, 52, 60),
        ],
      },
      // Anterior Cerebral Artery, RIGHT — mirrored.
      {
        color: 0xff5675, radius: 0.7, kind: "artery",
        points: [
          V( 0, -34, -26), V( 2, -20, -8), V( 3, -2, 14),
          V( 4, 20, 34), V( 5, 40, 50), V( 4, 52, 60),
        ],
      },
      // Middle Cerebral Artery, LEFT — sylvian fissure sweep across the
      // lateral surface, up the temporal lobe.
      {
        color: 0xff4a72, radius: 0.8, kind: "artery",
        points: [
          V( 0, -34, -24), V(-10, -32, -14), V(-24, -26,  0),
          V(-40, -14, 12), V(-52,  0, 20), V(-54, 16, 22),
          V(-46, 30, 22), V(-30, 40, 20),
        ],
      },
      // Middle Cerebral Artery, RIGHT — mirrored.
      {
        color: 0xff4a72, radius: 0.8, kind: "artery",
        points: [
          V( 0, -34, -24), V( 10, -32, -14), V( 24, -26,  0),
          V( 40, -14, 12), V( 52,  0, 20), V( 54, 16, 22),
          V( 46, 30, 22), V( 30, 40, 20),
        ],
      },
      // Posterior Cerebral Artery, LEFT — wrapping toward occipital.
      {
        color: 0xff5675, radius: 0.65, kind: "artery",
        points: [
          V( 0, -34, -26), V(-8, -30, -42), V(-18, -20, -58),
          V(-26,  -4, -68), V(-30, 14, -66), V(-28, 30, -60),
        ],
      },
      // Posterior Cerebral Artery, RIGHT — mirrored.
      {
        color: 0xff5675, radius: 0.65, kind: "artery",
        points: [
          V( 0, -34, -26), V( 8, -30, -42), V( 18, -20, -58),
          V( 26,  -4, -68), V( 30, 14, -66), V( 28, 30, -60),
        ],
      },
    ];

    // -- VENOUS SINUSES (deeper violet-crimson, thicker) ---------------
    const veins = [
      // Superior sagittal sinus — runs along the crown midline, front→back.
      {
        color: 0x9b3c7b, radius: 1.0, kind: "vein",
        points: [
          V( 0, 52, 60), V( 0, 58, 40), V( 0, 62, 18),
          V( 0, 64, -2), V( 0, 62, -22), V( 0, 56, -42), V( 0, 46, -58),
        ],
      },
      // Transverse sinus, LEFT — wrapping around back-of-head from midline.
      {
        color: 0x9b3c7b, radius: 0.9, kind: "vein",
        points: [
          V( 0, 46, -58), V(-12, 32, -64), V(-28, 14, -68),
          V(-38, -6, -60), V(-42, -22, -46),
        ],
      },
      // Transverse sinus, RIGHT — mirrored.
      {
        color: 0x9b3c7b, radius: 0.9, kind: "vein",
        points: [
          V( 0, 46, -58), V( 12, 32, -64), V( 28, 14, -68),
          V( 38, -6, -60), V( 42, -22, -46),
        ],
      },
      // A few visible cortical veins draping down each side — pure
      // "MRA render" decoration but sells the effect of a vascular tree.
      {
        color: 0x8b3670, radius: 0.55, kind: "vein",
        points: [ V(-42, 34, 20), V(-40, 12, 24), V(-36, -6, 22), V(-30, -22, 16) ],
      },
      {
        color: 0x8b3670, radius: 0.55, kind: "vein",
        points: [ V( 42, 34, 20), V( 40, 12, 24), V( 36, -6, 22), V( 30, -22, 16) ],
      },
      {
        color: 0x8b3670, radius: 0.5, kind: "vein",
        points: [ V(-28, 44, 42), V(-32, 32, 30), V(-38, 20, 12), V(-40,  6, -6) ],
      },
      {
        color: 0x8b3670, radius: 0.5, kind: "vein",
        points: [ V( 28, 44, 42), V( 32, 32, 30), V( 38, 20, 12), V( 40,  6, -6) ],
      },
    ];

    const vesselGroup = new THREE.Group();
    vesselGroup.userData.__vessels = true;
    this.vesselGroup = vesselGroup;
    this.scene.add(vesselGroup);

    const addVessel = (v) => {
      const curve = new THREE.CatmullRomCurve3(v.points, false, "catmullrom", 0.5);
      // Effective radius: arteries thicker + more visible than veins.
      const R = v.radius * (v.kind === "artery" ? 1.8 : 1.7);
      const baseCoreOp  = v.kind === "artery" ? 0.92 : 0.72;
      const baseHalo1Op = v.kind === "artery" ? 0.28 : 0.18;
      const baseHalo2Op = v.kind === "artery" ? 0.08 : 0.05;

      const tubeGeo = new THREE.TubeGeometry(curve, 128, R, 12, false);
      const mat = new THREE.MeshBasicMaterial({
        color: v.color,
        transparent: true,
        opacity: baseCoreOp,
      });
      const tube = new THREE.Mesh(tubeGeo, mat);
      tube.renderOrder = 2;
      vesselGroup.add(tube);

      const halo1 = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 128, R * 2.2, 12, false),
        new THREE.MeshBasicMaterial({
          color: v.color, transparent: true,
          opacity: baseHalo1Op,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      halo1.renderOrder = 1;
      vesselGroup.add(halo1);

      const halo2 = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 96, R * 4.5, 8, false),
        new THREE.MeshBasicMaterial({
          color: v.color, transparent: true,
          opacity: baseHalo2Op,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      halo2.renderOrder = 0;
      vesselGroup.add(halo2);

      this.vesselCurves.push({ curve, kind: v.kind, radius: R, color: v.color });
      this.vesselShells.push({
        core: tube, halo1, halo2,
        baseCoreOp, baseHalo1Op, baseHalo2Op,
        phase: Math.random() * Math.PI * 2,
        kind: v.kind,
        color: v.color,
        curve,
        // Per-vessel randomized systolic bias so no two beats overlap perfectly.
        heartOffset: Math.random() * 0.4,
      });

      // Seed pulses per vessel — hot bright emissive spheres that
      // travel along the curve. These are the visible blood cells.
      const N = v.kind === "artery" ? 5 : 3;
      for (let i = 0; i < N; i++) {
        const pulseColor = v.kind === "artery" ? 0xfff0f5 : 0xffcce6;
        const size = R * (v.kind === "artery" ? 1.9 : 1.5);
        const geo = new THREE.SphereGeometry(size, 14, 10);
        const mat = new THREE.MeshBasicMaterial({
          color: pulseColor,
          transparent: true,
          opacity: 1.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 3;
        vesselGroup.add(mesh);
        this.vesselPulses.push({
          curve,
          mesh,
          baseSpeed: (v.kind === "artery" ? 0.16 : 0.10) + Math.random() * 0.05,
          phase: i / N + Math.random() * 0.02,
          size,
          kind: v.kind,
        });
      }

      // Systolic waves — larger, brighter blooms that fire from the
      // start of each vessel at heartbeat intervals and race down its
      // length.  These carry the felt "beat" of thinking.  Each vessel
      // gets a small pool; only one is visible at a time (opacity=0 else).
      const WAVE_POOL = v.kind === "artery" ? 2 : 1;
      for (let i = 0; i < WAVE_POOL; i++) {
        const waveSize = R * (v.kind === "artery" ? 3.2 : 2.4);
        const geo = new THREE.SphereGeometry(waveSize, 18, 14);
        const mat = new THREE.MeshBasicMaterial({
          color: v.kind === "artery" ? 0xffffff : 0xffdae8,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 4;
        vesselGroup.add(mesh);
        this.vesselWaves = this.vesselWaves || [];
        this.vesselWaves.push({
          curve,
          mesh,
          waveSize,
          kind: v.kind,
          progress: 1,     // start "done" so it doesn't fire immediately
          nextFireAt: 0.4 + Math.random() * 1.8,
          duration: v.kind === "artery" ? 0.9 : 1.3,
        });
      }
    };

    arteries.forEach(addVessel);
    veins.forEach(addVessel);
  }

  // Tiny floating "dust motes" — mystical suspended particles that
  // drift around the whole brain, catching bloom.
  _buildDustMotes() {
    const N = 480;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // Distribute in a shell around the brain, biased toward the halo zone.
      const r = 80 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3    ] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.72;
      positions[i * 3 + 2] = r * Math.cos(phi);
      const roll = Math.random();
      // A few color families so the field feels layered.
      if (roll < 0.55) {
        colors[i * 3] = 0.42; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0;   // cyan
      } else if (roll < 0.82) {
        colors[i * 3] = 0.94; colors[i * 3 + 1] = 0.67; colors[i * 3 + 2] = 0.99; // magenta
      } else {
        colors[i * 3] = 1.0;  colors[i * 3 + 1] = 0.86; colors[i * 3 + 2] = 0.68; // gold
      }
      sizes[i] = 0.9 + Math.random() * 1.6;
      seed[i] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 1.6,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dust = new THREE.Points(geo, mat);
    dust.userData.__seed = seed;
    this.dustMotes = dust;
    this.scene.add(dust);
  }

  // A big, faintly-glowing aura sphere behind the brain — becomes the
  // "halo" that bloom lights up around the whole cortex.
  _buildAuraShell() {
    const geo = new THREE.SphereGeometry(120, 48, 32);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(0x6ee7ff) },
        uColorB: { value: new THREE.Color(0xf0abfc) },
        uColorC: { value: new THREE.Color(0xffd28a) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPos;
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        void main() {
          float lat = normalize(vPos).y;
          float lon = atan(vPos.z, vPos.x);
          float band1 = sin(lat * 3.2 + uTime * 0.15) * 0.5 + 0.5;
          float band2 = sin(lon * 2.0 + uTime * 0.10) * 0.5 + 0.5;
          vec3 mixCol = mix(uColorA, uColorB, band1);
          mixCol = mix(mixCol, uColorC, band2 * 0.35);
          // Tightened rim so the aura sits close to the horizon and
          // doesn't wash the whole scene into a pastel fog.
          float rim = pow(1.0 - abs(vNormal.z), 2.6);
          gl_FragColor = vec4(mixCol, rim * 0.16);
        }
      `,
    });
    const aura = new THREE.Mesh(geo, mat);
    this.auraShell = aura;
    this.scene.add(aura);
  }

  _initPostprocessing() {
    // EffectComposer chain: render → strong bloom → output tone-mapping.
    // This is what makes the vessels + region cores actually feel magical
    // instead of just "colored spheres in the dark".
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, this._isMobile ? 1 : 2));
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    // Bloom kept intentionally moderate — enough to make vessels and region
    // cores glow, low enough that cortical folds and vessel geometry
    // aren't washed out into a soft cotton-ball haze.
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      /* strength */  0.55,
      /* radius   */  0.55,
      /* threshold*/  0.42,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
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

  updateRegions(regionStates, extraMetrics) {
    let sumAct = 0;
    let nAct = 0;
    for (const r of regionStates) {
      if (!this.regions.has(r.name)) {
        this._addRegion(r);
      }
      const entry = this.regions.get(r.name);
      entry.data = r;
      // Region cores sit INSIDE the cerebrum as small luminous cortex
      // markers, not as giant spheres that eclipse the anatomy. Scale
      // range is now roughly 3-6 units against a ~100-unit brain
      // (bigger on mobile so 14 dots are all readable at 360px).
      const baseUnits = this._isMobile ? 4.5 : 3.0;
      const gainUnits = this._isMobile ? 4.0 : 3.0;
      const size = baseUnits + Math.pow(r.activation, 0.7) * gainUnits;
      entry.core.scale.setScalar(size / entry.baseSize);
      entry.core.material.opacity = 0.9 + r.activation * 0.1;
      entry.glow.material.opacity = (this._isMobile ? 0.30 : 0.20) + r.activation * 0.35;
      entry.glow.scale.setScalar((size * (this._isMobile ? 2.6 : 2.2)) / entry.baseSize);
      entry.pulseTarget = r.activation;
      sumAct += r.activation;
      nAct++;
    }
    this._updateLegend(regionStates, extraMetrics || {});

    // Fallback engagement drive when the backend hasn't published a
    // `engagement` scalar of its own — use mean cortical activation.
    if (this.engagement == null && nAct > 0) {
      this._engagementFromRegions = sumAct / nAct;
    }
  }

  /** Drive the vessel heartbeat externally.  `x` is a 0..1 "thinking
   *  intensity" scalar (typically brain.engagement from the backend). */
  setEngagement(x) {
    if (!Number.isFinite(x)) return;
    x = Math.max(0, Math.min(1, x));
    // Smooth EMA so the pulse doesn't twitch on every tick.
    if (this.engagement == null) this.engagement = x;
    this.engagement += (x - this.engagement) * 0.12;
  }

  _addRegion(meta) {
    const color = new THREE.Color(meta.color);
    // Slightly boost hue for bloom — but only 8% toward white so the
    // color still reads as the region's own hue rather than overblowing.
    const hot = color.clone().lerp(new THREE.Color(0xffffff), 0.08);
    const scenePos = this._backendToScene(meta.position);

    // baseSize of 4 = 8-unit diameter cores inside a ~100-unit cerebrum.
    // Small enough to read as cortical markers, big enough to notice.
    const baseSize = 4;
    const coreGeo = new THREE.SphereGeometry(baseSize, 20, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: hot, transparent: true, opacity: 0.95,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);

    const glowGeo = new THREE.SphereGeometry(baseSize, 20, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.30,
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

  _updateLegend(regionStates, extraMetrics) {
    const legendEl = document.getElementById("brain-legend");
    if (!legendEl) return;
    if (!this._sparkBuffers) this._sparkBuffers = new Map();
    const SPARK_LEN = 96;

    if (legendEl.children.length === 0) {
      for (const r of regionStates) {
        const item = document.createElement("div");
        item.className = "cortex-tile";
        item.dataset.name = r.name;
        item.style.color = r.color;
        item.style.setProperty("--tile-color", r.color);
        item.innerHTML = `
          <div class="cortex-tile-head">
            <span class="cortex-tile-dot" style="background:${r.color}"></span>
            <span class="cortex-tile-name">${r.display_name}</span>
            <span class="cortex-tile-pct mono">0%</span>
          </div>
          <canvas class="cortex-tile-spark" width="220" height="28"></canvas>
          <div class="cortex-tile-metric mono">—</div>
        `;
        item.addEventListener("click", () => this.select(r.name));
        legendEl.appendChild(item);
        this._sparkBuffers.set(r.name, new Float32Array(SPARK_LEN));
      }
    }

    for (const r of regionStates) {
      const item = legendEl.querySelector(`.cortex-tile[data-name="${r.name}"]`);
      if (!item) continue;
      item.classList.toggle("selected", r.name === this.selectedName);

      let buf = this._sparkBuffers.get(r.name);
      if (!buf) {
        buf = new Float32Array(SPARK_LEN);
        this._sparkBuffers.set(r.name, buf);
      }
      buf.copyWithin(0, 1);
      buf[SPARK_LEN - 1] = r.activation;

      const pctEl = item.querySelector(".cortex-tile-pct");
      const metricEl = item.querySelector(".cortex-tile-metric");
      const canvas = item.querySelector(".cortex-tile-spark");
      if (pctEl) pctEl.textContent = `${(r.activation * 100).toFixed(0)}%`;

      if (metricEl) {
        const m = extraMetrics[r.name];
        if (m && m.label) {
          metricEl.textContent = `${m.label} ${m.value}`;
          metricEl.style.opacity = "0.9";
        } else {
          metricEl.textContent = `${r.neurons_active}/${r.neurons_total} neurons`;
          metricEl.style.opacity = "0.55";
        }
      }

      const hot = r.activation > 0.55;
      item.classList.toggle("cortex-tile-hot", hot);
      const glow = Math.min(1, r.activation * 1.4);
      item.style.setProperty("--tile-glow", glow.toFixed(3));

      if (canvas) this._drawCortexSparkline(canvas, buf, r.color, r.activation);
    }
  }

  _drawCortexSparkline(canvas, buf, color, act) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    const targetW = Math.max(1, Math.round(cssW * dpr));
    const targetH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    const n = buf.length;
    const step = w / (n - 1);
    const yFor = (v) => h - 2 - Math.max(0, Math.min(1, v)) * (h - 4);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < n; i++) ctx.lineTo(i * step, yFor(buf[i]));
    ctx.lineTo(w, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, this._hexToRgba(color, 0.55));
    grad.addColorStop(1, this._hexToRgba(color, 0.02));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = i * step;
      const y = yFor(buf[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6 * dpr;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 * dpr * Math.min(1, 0.3 + act);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const hx = w - 1.5 * dpr;
    const hy = yFor(buf[n - 1]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(hx, hy, 2.2 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  _hexToRgba(hex, a) {
    if (!hex || hex[0] !== "#") return `rgba(200,200,255,${a})`;
    const s = hex.length === 4
      ? hex.slice(1).split("").map((c) => c + c).join("")
      : hex.slice(1);
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
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
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloomPass) this.bloomPass.setSize(w, h);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    // Cap mobile to ~30fps — halves GPU/CPU cost with zero perceptible
    // difference on the ambient brain motion.
    if (this._isMobile) {
      const now = performance.now();
      if (this._lastFrameAt && now - this._lastFrameAt < 33) return;
      this._lastFrameAt = now;
    }
    const t = performance.now() * 0.001;

    for (const entry of this.regions.values()) {
      entry.pulseCurrent += (entry.pulseTarget - entry.pulseCurrent) * 0.15;
      const baseScale = entry.core.scale.x || 1;
      const wobble = 1 + entry.pulseCurrent * 0.08 * Math.sin(t * (2 + entry.pulseCurrent * 3));
      entry.glow.scale.setScalar((baseScale * 2.3) * wobble);
    }

    // ---- Vasculature is ALIVE.  Every vessel visibly pulsates. ----
    // Brain engagement (0..1, set from outside via setEngagement) drives
    // the heart rate: idle brain -> ~55 bpm feel, thinking hard -> ~110.
    const eng = this.engagement != null
        ? this.engagement
        : (this._engagementFromRegions ?? 0.5);
    const heartHz = 0.9 + eng * 1.4;          // ~0.9-2.3 Hz systole
    const dt = (this._lastFrameT != null) ? Math.min(0.1, t - this._lastFrameT) : 0.016;
    this._lastFrameT = t;

    // Per-vessel systolic modulation of core + halos.  Every vessel
    // breathes at heartHz + its own phase offset so the whole tree
    // reads as an organic vascular tree, not a synchronised light show.
    if (this.vesselShells) {
      const twoPi = Math.PI * 2;
      for (const s of this.vesselShells) {
        // sinusoidal pulse rectified into [0..1]
        const raw = Math.sin(t * heartHz * twoPi + s.phase);
        const pulse = Math.max(0, raw);
        // Extra emphasis on the SYSTOLIC half — pulse^2 sharpens the beat.
        const beat = pulse * pulse;
        const swing = 0.55 + 0.9 * eng;       // how loud the beat is
        s.core.material.opacity  = Math.min(1, s.baseCoreOp  * (1 + beat * 0.35 * swing));
        s.halo1.material.opacity = Math.min(1, s.baseHalo1Op * (1 + beat * 1.9  * swing));
        s.halo2.material.opacity = Math.min(1, s.baseHalo2Op * (1 + beat * 2.5  * swing));
        // Subtle thickness bloom so the halo LOOKS to expand with each beat.
        const grow = 1 + beat * 0.18 * swing;
        s.halo1.scale.setScalar(grow);
        s.halo2.scale.setScalar(1 + beat * 0.28 * swing);
      }
    }

    // Traveling blood cells: speed is a base + heart-rate boost.
    if (this.vesselPulses) {
      for (const p of this.vesselPulses) {
        const spd = p.baseSpeed * (0.7 + eng * 1.2);
        p.phase = (p.phase + spd * 0.006) % 1;
        const pt = p.curve.getPoint(p.phase);
        p.mesh.position.copy(pt);
        const throb = 0.85 + 0.35 * Math.sin(t * (4 + eng * 3) + p.phase * 6.28);
        p.mesh.scale.setScalar(throb);
        p.mesh.material.opacity = 0.75 + 0.2 * Math.sin(t * 3 + p.phase * 5.0);
      }
    }

    // Systolic waves: bright blobs that fire at the start of each vessel
    // in rhythm with the heart, then race along the curve.  This is what
    // sells the "血管在思考时候的律动" — every vessel visibly beats.
    if (this.vesselWaves) {
      // Approx how long between beats.  eng=0 -> 1.1s, eng=1 -> ~0.45s.
      const beatInterval = 0.6 + (1 - eng) * 0.9;
      for (const w of this.vesselWaves) {
        if (w.progress >= 1) {
          w.nextFireAt -= dt;
          if (w.nextFireAt <= 0) {
            w.progress = 0;
            w.nextFireAt = beatInterval * (0.85 + Math.random() * 0.4);
          }
          w.mesh.material.opacity = 0;
        } else {
          const durScaled = w.duration * (0.6 + (1 - eng) * 0.8);
          w.progress = Math.min(1, w.progress + dt / durScaled);
          const pt = w.curve.getPoint(w.progress);
          w.mesh.position.copy(pt);
          // Envelope: fast rise, gentle tail — mimics blood-pressure wave
          const env = w.progress < 0.15
              ? w.progress / 0.15
              : Math.pow(1 - (w.progress - 0.15) / 0.85, 1.5);
          w.mesh.material.opacity = env * (w.kind === "artery" ? 0.95 : 0.55);
          w.mesh.scale.setScalar(0.7 + env * 1.6);
        }
      }
    }

    // Aura shell drifts in color with time.
    if (this.auraShell) {
      this.auraShell.material.uniforms.uTime.value = t;
      this.auraShell.rotation.y = t * 0.03;
    }
    if (this.cerebrumInner) {
      this.cerebrumInner.material.uniforms.uTime.value = t;
    }

    // Dust motes gently orbit and pulse in brightness so the whole space
    // feels alive — not just the brain surface.
    if (this.dustMotes) {
      this.dustMotes.rotation.y = t * 0.02;
      this.dustMotes.rotation.x = Math.sin(t * 0.05) * 0.05;
      this.dustMotes.material.opacity = 0.68 + 0.18 * Math.sin(t * 0.6);
    }

    // Cerebrum breathes ever so slightly with the collective activation.
    if (this.cerebrum) {
      let mean = 0.4;
      let n = 0;
      for (const e of this.regions.values()) { mean += e.pulseCurrent; n++; }
      if (n) mean = mean / (n + 1);
      const breathe = 1 + 0.008 * Math.sin(t * 1.2) + mean * 0.02;
      this.cerebrum.scale.setScalar(breathe);
    }

    this.controls.update();
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
