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
      // Inner opaque core — the actual vessel body.
      const tubeGeo = new THREE.TubeGeometry(curve, 128, R, 12, false);
      const mat = new THREE.MeshBasicMaterial({
        color: v.color,
        transparent: true,
        opacity: v.kind === "artery" ? 0.92 : 0.72,
      });
      const tube = new THREE.Mesh(tubeGeo, mat);
      tube.renderOrder = 2;
      vesselGroup.add(tube);

      // Emissive middle sleeve — additive-blended for a warm halo (this
      // is what bloom will pick up and turn into a soft red glow).
      const halo1 = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 128, R * 2.2, 12, false),
        new THREE.MeshBasicMaterial({
          color: v.color, transparent: true,
          opacity: v.kind === "artery" ? 0.28 : 0.18,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      halo1.renderOrder = 1;
      vesselGroup.add(halo1);

      // Outer soft glow — very wide, low opacity for atmospheric bleed.
      const halo2 = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 96, R * 4.5, 8, false),
        new THREE.MeshBasicMaterial({
          color: v.color, transparent: true,
          opacity: v.kind === "artery" ? 0.08 : 0.05,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      halo2.renderOrder = 0;
      vesselGroup.add(halo2);

      this.vesselCurves.push({ curve, kind: v.kind, radius: R, color: v.color });

      // Seed 3–5 pulses per vessel — hot bright emissive spheres that
      // travel along the curve. These are what the eye reads as "living
      // blood cells being pumped through arteries."
      const N = v.kind === "artery" ? 4 : 2;
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
          speed: (v.kind === "artery" ? 0.16 : 0.10) + Math.random() * 0.05,
          phase: i / N + Math.random() * 0.02,
          size,
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
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  updateRegions(regionStates) {
    for (const r of regionStates) {
      if (!this.regions.has(r.name)) {
        this._addRegion(r);
      }
      const entry = this.regions.get(r.name);
      entry.data = r;
      // Region cores sit INSIDE the cerebrum as small luminous cortex
      // markers, not as giant balls that eclipse the anatomy. Scale
      // range is now roughly 3–6 units against a ~100-unit brain.
      const size = 3.0 + Math.pow(r.activation, 0.7) * 3.0;
      entry.core.scale.setScalar(size / entry.baseSize);
      entry.core.material.opacity = 0.9 + r.activation * 0.1;
      entry.glow.material.opacity = 0.20 + r.activation * 0.35;
      entry.glow.scale.setScalar((size * 2.2) / entry.baseSize);
      entry.pulseTarget = r.activation;
    }
    this._updateLegend(regionStates);
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
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloomPass) this.bloomPass.setSize(w, h);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const t = performance.now() * 0.001;

    for (const entry of this.regions.values()) {
      entry.pulseCurrent += (entry.pulseTarget - entry.pulseCurrent) * 0.15;
      const baseScale = entry.core.scale.x || 1;
      const wobble = 1 + entry.pulseCurrent * 0.08 * Math.sin(t * (2 + entry.pulseCurrent * 3));
      entry.glow.scale.setScalar((baseScale * 2.3) * wobble);
    }

    // Blood-cell pulses stream along vessels. Speed constant per-pulse;
    // phase wraps every ~7 s so pulses feel like a heart-driven pump.
    if (this.vesselPulses) {
      for (const p of this.vesselPulses) {
        p.phase = (p.phase + p.speed * 0.006) % 1;
        const pt = p.curve.getPoint(p.phase);
        p.mesh.position.copy(pt);
        const throb = 0.85 + 0.35 * Math.sin(t * 4 + p.phase * 6.28);
        p.mesh.scale.setScalar(throb);
        p.mesh.material.opacity = 0.75 + 0.2 * Math.sin(t * 3 + p.phase * 5.0);
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
