// 3D Vietnamese Historical Relics Renderer for the Retro CRT TV
// Powered by Three.js inside the 1024x768 TV signal

import * as THREE from "three";
import { VIETNAM_RELICS } from "./vietnam-history-data.js";

export class RelicRenderer {
  constructor(canvas, width = 1024, height = 768) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;

    this.relicIndex = 0;
    this.autoRotate = true;
    this.wireframe = false;
    this.lightMode = 0; // 0: Museum spotlight, 1: Golden sunset, 2: Cyber neon

    this.rotX = 0.25;
    this.rotY = 0;
    this.targetRotX = 0.25;
    this.targetRotY = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;

    this.isDragging = false;
    this.lastPointer = { x: 0, y: 0 };

    this.setupScene();
    this.buildCurrentRelic();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#07090e");

    this.camera = new THREE.PerspectiveCamera(38, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0.4, 3.8);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    // Pedestal & Museum display room
    this.pedestalGroup = new THREE.Group();
    const pedGeo = new THREE.CylinderGeometry(1.3, 1.4, 0.2, 48);
    const pedMat = new THREE.MeshStandardMaterial({
      color: "#12141a",
      roughness: 0.6,
      metalness: 0.2
    });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.y = -1.1;
    this.pedestalGroup.add(pedestal);

    const ringGeo = new THREE.RingGeometry(1.28, 1.35, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: "#c99a38", side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.99;
    this.pedestalGroup.add(ring);
    this.scene.add(this.pedestalGroup);

    // Relic holder
    this.relicRoot = new THREE.Group();
    this.scene.add(this.relicRoot);

    // Lighting
    this.ambientLight = new THREE.AmbientLight("#22283a", 1.8);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.SpotLight("#fff5df", 120);
    this.keyLight.position.set(2.5, 4.5, 3.5);
    this.keyLight.angle = Math.PI / 5;
    this.keyLight.penumbra = 0.5;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight("#a2c2ff", 3.2);
    this.rimLight.position.set(-3.5, 2.5, -3);
    this.scene.add(this.rimLight);

    this.bottomGlow = new THREE.PointLight("#c48b29", 35, 4);
    this.bottomGlow.position.set(0, -0.9, 0);
    this.scene.add(this.bottomGlow);
  }

  buildCurrentRelic() {
    // Clear old relic
    while (this.relicRoot.children.length > 0) {
      const obj = this.relicRoot.children[0];
      this.relicRoot.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }

    const data = VIETNAM_RELICS[this.relicIndex];
    let meshGroup = new THREE.Group();

    switch (data.meshType) {
      case "drum":
        meshGroup = this.createDongSonDrum(data);
        break;
      case "urn_jar":
        meshGroup = this.createDaoThinhJar(data);
        break;
      case "dragon":
        meshGroup = this.createLyDragon(data);
        break;
      case "sword":
        meshGroup = this.createThuanThienSword(data);
        break;
      case "tripod_cauldron":
        meshGroup = this.createCuuDinh(data);
        break;
      case "gold_seal":
        meshGroup = this.createGoldSeal(data);
        break;
      case "tank":
        meshGroup = this.createTank390(data);
        break;
      default:
        meshGroup = this.createDongSonDrum(data);
    }

    this.relicRoot.add(meshGroup);
  }

  // --- PROCEDURAL RELIC MESH GENERATORS ---

  // 1. Trống đồng Ngọc Lũ (Đông Sơn Bronze Drum)
  createDongSonDrum(data) {
    const group = new THREE.Group();

    // Drum Tympanum Texture (14-pointed solar star & birds)
    const tympCanvas = document.createElement("canvas");
    tympCanvas.width = tympCanvas.height = 1024;
    const ctx = tympCanvas.getContext("2d");
    const cx = 512, cy = 512;

    // Bronze Patina base
    ctx.fillStyle = "#3a4a35";
    ctx.fillRect(0, 0, 1024, 1024);

    // Decorative relief rings
    ctx.strokeStyle = "#cbb279";
    ctx.lineWidth = 4;

    for (let r = 70; r <= 480; r += 26) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Central Sun: 14 Rays
    ctx.fillStyle = "#e0c78d";
    ctx.beginPath();
    const rays = 14;
    const rInner = 28, rOuter = 82;
    for (let i = 0; i < rays * 2; i++) {
      const angle = (i * Math.PI) / rays - Math.PI / 2;
      const rad = i % 2 === 0 ? rOuter : rInner;
      const x = cx + Math.cos(angle) * rad;
      const y = cy + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // 16 Flying Lac Birds (Chim Lạc) flying counter-clockwise
    ctx.fillStyle = "#e0c78d";
    const birdRadius = 310;
    const numBirds = 16;
    for (let i = 0; i < numBirds; i++) {
      const a = (i * 2 * Math.PI) / numBirds;
      const bx = cx + Math.cos(a) * birdRadius;
      const by = cy + Math.sin(a) * birdRadius;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a - Math.PI / 2);
      // Bird shape
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(24, -4);
      ctx.lineTo(12, 10);
      ctx.lineTo(4, 2);
      ctx.lineTo(-8, 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Feathers & Dancers in concentric ring
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = "#cbb279";
    for (let i = 0; i < 28; i++) {
      const a = (i * 2 * Math.PI) / 28;
      const fx = cx + Math.cos(a) * 210;
      const fy = cy + Math.sin(a) * 210;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText("▲", -6, 0);
      ctx.restore();
    }

    const tympTex = new THREE.CanvasTexture(tympCanvas);

    // Drum Bronze Material
    const drumMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.primaryColor),
      roughness: 0.38,
      metalness: 0.72,
      wireframe: this.wireframe
    });

    const topMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.primaryColor),
      map: tympTex,
      roughness: 0.35,
      metalness: 0.65,
      wireframe: this.wireframe
    });

    // Profile of Dong Son Drum (Lathe Geometry)
    const points = [];
    points.push(new THREE.Vector2(0, 0.48)); // center top
    points.push(new THREE.Vector2(0.92, 0.48)); // rim top
    points.push(new THREE.Vector2(0.94, 0.44)); // rim edge
    points.push(new THREE.Vector2(0.85, 0.22)); // bulge upper
    points.push(new THREE.Vector2(0.68, 0.0)); // waist inward
    points.push(new THREE.Vector2(0.68, -0.22)); // waist cylinder
    points.push(new THREE.Vector2(0.88, -0.52)); // base flare
    points.push(new THREE.Vector2(0.92, -0.56)); // base rim
    points.push(new THREE.Vector2(0.82, -0.56)); // base inner hollow

    const drumGeo = new THREE.LatheGeometry(points, 48);
    const drumMesh = new THREE.Mesh(drumGeo, drumMat);
    group.add(drumMesh);

    // Top cap with textured star
    const capGeo = new THREE.CircleGeometry(0.92, 48);
    const capMesh = new THREE.Mesh(capGeo, topMat);
    capMesh.rotation.x = -Math.PI / 2;
    capMesh.position.y = 0.482;
    group.add(capMesh);

    // 4 Twin Handles (Quai kép hình thừng bện)
    const handleGeo = new THREE.TorusGeometry(0.12, 0.026, 16, 24, Math.PI);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const h = new THREE.Mesh(handleGeo, drumMat);
      h.position.set(Math.cos(angle) * 0.78, 0.12, Math.sin(angle) * 0.78);
      h.rotation.y = angle;
      h.rotation.z = Math.PI / 2;
      group.add(h);
    }

    return group;
  }

  // 2. Thạp đồng Đào Thịnh
  createDaoThinhJar(data) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.primaryColor),
      roughness: 0.42,
      metalness: 0.68,
      wireframe: this.wireframe
    });

    const points = [];
    points.push(new THREE.Vector2(0, 0.75)); // knob
    points.push(new THREE.Vector2(0.1, 0.75));
    points.push(new THREE.Vector2(0.08, 0.7));
    points.push(new THREE.Vector2(0.48, 0.58)); // lid rim
    points.push(new THREE.Vector2(0.44, 0.52)); // neck
    points.push(new THREE.Vector2(0.65, 0.2)); // upper belly
    points.push(new THREE.Vector2(0.68, -0.1)); // main belly
    points.push(new THREE.Vector2(0.48, -0.55)); // lower base
    points.push(new THREE.Vector2(0.42, -0.6));
    points.push(new THREE.Vector2(0, -0.6));

    const geo = new THREE.LatheGeometry(points, 36);
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    // 4 Fertility Statuettes on the lid
    const statMat = new THREE.MeshStandardMaterial({ color: "#7a6e4d", roughness: 0.35, metalness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const sGroup = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.08, 8, 8), statMat);
      b1.position.set(-0.02, 0.04, 0);
      const b2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.08, 8, 8), statMat);
      b2.position.set(0.02, 0.04, 0);
      sGroup.add(b1, b2);
      sGroup.position.set(Math.cos(a) * 0.32, 0.62, Math.sin(a) * 0.32);
      group.add(sGroup);
    }
    return group;
  }

  // 3. Tượng Rồng thời Lý (Lý Dynasty Dragon)
  createLyDragon(data) {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.primaryColor),
      roughness: 0.55,
      metalness: 0.25,
      wireframe: this.wireframe
    });

    // Sinusoidal curving spine
    const curvePoints = [];
    const segments = 60;
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const x = (u - 0.5) * 1.8;
      const y = Math.sin(u * Math.PI * 4) * 0.28 + Math.cos(u * Math.PI * 2) * 0.1;
      const z = Math.cos(u * Math.PI * 3) * 0.15;
      curvePoints.push(new THREE.Vector3(x, y, z));
    }
    const spline = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeo = new THREE.TubeGeometry(spline, 64, 0.12, 16, false);
    const bodyMesh = new THREE.Mesh(tubeGeo, stoneMat);
    group.add(bodyMesh);

    // Dragon Head (Đầu Rồng ngậm ngọc)
    const headGroup = new THREE.Group();
    const headGeo = new THREE.ConeGeometry(0.18, 0.45, 12);
    const headMesh = new THREE.Mesh(headGeo, stoneMat);
    headMesh.rotation.z = -Math.PI / 3;
    headGroup.add(headMesh);

    // Flaming crest (Mào lửa)
    const flameGeo = new THREE.TorusGeometry(0.18, 0.03, 8, 16, Math.PI * 1.3);
    const flameMesh = new THREE.Mesh(flameGeo, new THREE.MeshStandardMaterial({ color: "#d97d2e", roughness: 0.3, metalness: 0.6 }));
    flameMesh.position.set(0.05, 0.18, 0);
    headGroup.add(flameMesh);

    // Sacred Pearl (Ngọc minh châu)
    const pearl = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 24, 24),
      new THREE.MeshStandardMaterial({ color: "#fff3cf", emissive: "#ffbe42", emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.9 })
    );
    pearl.position.set(0.28, -0.05, 0);
    headGroup.add(pearl);

    headGroup.position.copy(curvePoints[segments]);
    group.add(headGroup);

    return group;
  }

  // 4. Bảo Kiếm Thuận Thiên (Sacred Sword of Lê Lợi)
  createThuanThienSword(data) {
    const group = new THREE.Group();

    // Steel Blade
    const bladeGeo = new THREE.BoxGeometry(0.1, 1.3, 0.022);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: "#dce6f2",
      metalness: 0.95,
      roughness: 0.15,
      wireframe: this.wireframe
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.25;
    group.add(blade);

    // Blade Tip
    const tipGeo = new THREE.ConeGeometry(0.071, 0.22, 4);
    tipGeo.rotateY(Math.PI / 4);
    const tip = new THREE.Mesh(tipGeo, bladeMat);
    tip.position.y = 0.98;
    group.add(tip);

    // Crossguard (Chuôi kiếm đầu rồng vàng)
    const guardMat = new THREE.MeshStandardMaterial({
      color: "#f5c338",
      metalness: 0.88,
      roughness: 0.28,
      wireframe: this.wireframe
    });
    const guardGeo = new THREE.CylinderGeometry(0.06, 0.04, 0.38, 16);
    guardGeo.rotateZ(Math.PI / 2);
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = -0.42;
    group.add(guard);

    // Hilt / Handle (Cán kiếm)
    const hiltGeo = new THREE.CylinderGeometry(0.038, 0.042, 0.38, 16);
    const hiltMat = new THREE.MeshStandardMaterial({ color: "#241e17", roughness: 0.8 });
    const hilt = new THREE.Mesh(hiltGeo, hiltMat);
    hilt.position.y = -0.62;
    group.add(hilt);

    // Pommel (Đốc kiếm đính ngọc)
    const pommelGeo = new THREE.SphereGeometry(0.075, 16, 16);
    const pommel = new THREE.Mesh(pommelGeo, guardMat);
    pommel.position.y = -0.82;
    group.add(pommel);

    // Glowing inscription "THUẬN THIÊN"
    const runeLight = new THREE.PointLight("#62c2ff", 8, 1.2);
    runeLight.position.set(0, 0.1, 0.05);
    group.add(runeLight);

    group.rotation.z = Math.PI / 6;
    return group;
  }

  // 5. Cửu Đỉnh Huế (Cao Đỉnh)
  createCuuDinh(data) {
    const group = new THREE.Group();
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.primaryColor),
      metalness: 0.82,
      roughness: 0.45,
      wireframe: this.wireframe
    });

    // Cauldron Bowl
    const bowlGeo = new THREE.SphereGeometry(0.72, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.75);
    const bowl = new THREE.Mesh(bowlGeo, bronzeMat);
    bowl.position.y = 0.1;
    group.add(bowl);

    // Rim
    const rimGeo = new THREE.TorusGeometry(0.72, 0.05, 16, 36);
    rimGeo.rotateX(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, bronzeMat);
    rim.position.y = 0.38;
    group.add(rim);

    // 2 Upright Loop Handles (Tai Đỉnh)
    const handleGeo = new THREE.TorusGeometry(0.22, 0.045, 12, 24, Math.PI);
    const h1 = new THREE.Mesh(handleGeo, bronzeMat);
    h1.position.set(0.68, 0.52, 0);
    h1.rotation.y = Math.PI / 2;
    const h2 = new THREE.Mesh(handleGeo, bronzeMat);
    h2.position.set(-0.68, 0.52, 0);
    h2.rotation.y = Math.PI / 2;
    group.add(h1, h2);

    // 3 Cylindrical Legs (Chân Vạc)
    const legGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.65, 16);
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      const leg = new THREE.Mesh(legGeo, bronzeMat);
      leg.position.set(Math.cos(a) * 0.48, -0.42, Math.sin(a) * 0.48);
      group.add(leg);
    }
    return group;
  }

  // 6. Kim Ấn Hoàng Đế Chi Bảo
  createGoldSeal(data) {
    const group = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.primaryColor),
      metalness: 0.92,
      roughness: 0.22,
      wireframe: this.wireframe
    });

    // Seal Base (Thân ấn vuông)
    const baseGeo = new THREE.BoxGeometry(0.9, 0.38, 0.9);
    const baseMesh = new THREE.Mesh(baseGeo, goldMat);
    baseMesh.position.y = -0.3;
    group.add(baseMesh);

    // Dragon Handle (Quai rồng cuộn)
    const dragonCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.25, -0.1, 0),
      new THREE.Vector3(-0.15, 0.32, 0),
      new THREE.Vector3(0.05, 0.42, 0),
      new THREE.Vector3(0.28, 0.18, 0)
    ]);
    const dGeo = new THREE.TubeGeometry(dragonCurve, 32, 0.085, 16, false);
    const dMesh = new THREE.Mesh(dGeo, goldMat);
    group.add(dMesh);

    // Dragon Head on Seal
    const dHead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 8), goldMat);
    dHead.position.set(0.35, 0.25, 0);
    dHead.rotation.z = -Math.PI / 3;
    group.add(dHead);

    return group;
  }

  // 7. Xe Tăng Số Hiệu 390
  createTank390(data) {
    const group = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.primaryColor),
      roughness: 0.65,
      metalness: 0.4,
      wireframe: this.wireframe
    });

    // Hull (Thân xe tăng)
    const hullGeo = new THREE.BoxGeometry(1.2, 0.35, 0.7);
    const hull = new THREE.Mesh(hullGeo, armorMat);
    group.add(hull);

    // Turret (Tháp pháo tròn T-59)
    const turretGeo = new THREE.SphereGeometry(0.32, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const turret = new THREE.Mesh(turretGeo, armorMat);
    turret.position.set(0.1, 0.22, 0);
    group.add(turret);

    // Cannon Barrel (Nòng pháo 100mm)
    const cannonGeo = new THREE.CylinderGeometry(0.032, 0.038, 0.95, 12);
    cannonGeo.rotateZ(-Math.PI / 2);
    const cannon = new THREE.Mesh(cannonGeo, armorMat);
    cannon.position.set(0.68, 0.3, 0);
    group.add(cannon);

    // Treads / Wheels (Bánh xích)
    const wheelMat = new THREE.MeshStandardMaterial({ color: "#181a1d", roughness: 0.8 });
    const wheelGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.12, 16);
    wheelGeo.rotateX(Math.PI / 2);

    for (let side = -1; side <= 1; side += 2) {
      for (let w = -0.45; w <= 0.45; w += 0.22) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(w, -0.2, side * 0.38);
        group.add(wheel);
      }
    }

    // National Flag on Antenna
    const antGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.65, 8);
    const ant = new THREE.Mesh(antGeo, new THREE.MeshBasicMaterial({ color: "#999" }));
    ant.position.set(-0.15, 0.58, 0.15);
    group.add(ant);

    const flagGeo = new THREE.PlaneGeometry(0.24, 0.16);
    const flagMat = new THREE.MeshBasicMaterial({ color: "#e61c24", side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(-0.27, 0.78, 0.15);
    group.add(flag);

    return group;
  }

  // --- INTERACTION CONTROLS ---

  nextRelic() {
    this.relicIndex = (this.relicIndex + 1) % VIETNAM_RELICS.length;
    this.buildCurrentRelic();
  }

  prevRelic() {
    this.relicIndex = (this.relicIndex - 1 + VIETNAM_RELICS.length) % VIETNAM_RELICS.length;
    this.buildCurrentRelic();
  }

  toggleWireframe() {
    this.wireframe = !this.wireframe;
    this.buildCurrentRelic();
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
  }

  setLightMode(mode) {
    this.lightMode = mode % 3;
    if (this.lightMode === 0) {
      this.keyLight.color.set("#fff5df");
      this.rimLight.color.set("#a2c2ff");
    } else if (this.lightMode === 1) {
      this.keyLight.color.set("#ff7a29");
      this.rimLight.color.set("#ffd285");
    } else {
      this.keyLight.color.set("#29ffc2");
      this.rimLight.color.set("#ff29a2");
    }
  }

  handlePointerDown(x, y) {
    this.isDragging = true;
    this.lastPointer = { x, y };
  }

  handlePointerMove(x, y) {
    if (!this.isDragging) return;
    const dx = x - this.lastPointer.x;
    const dy = y - this.lastPointer.y;
    this.targetRotY += dx * 0.008;
    this.targetRotX += dy * 0.008;
    this.targetRotX = Math.max(-0.6, Math.min(0.9, this.targetRotX));
    this.lastPointer = { x, y };
  }

  handlePointerUp() {
    this.isDragging = false;
  }

  handleWheel(deltaY) {
    this.targetZoom += deltaY * 0.001;
    this.targetZoom = Math.max(0.65, Math.min(1.8, this.targetZoom));
  }

  // --- RENDER LOOP ---

  render(t, dt) {
    if (this.autoRotate && !this.isDragging) {
      this.targetRotY += dt * 0.0006;
    }

    // Smooth spring physics for rotation & zoom
    this.rotX += (this.targetRotX - this.rotX) * 0.12;
    this.rotY += (this.targetRotY - this.rotY) * 0.12;
    this.zoom += (this.targetZoom - this.zoom) * 0.12;

    this.relicRoot.rotation.x = this.rotX;
    this.relicRoot.rotation.y = this.rotY;
    this.relicRoot.scale.set(this.zoom, this.zoom, this.zoom);
    this.pedestalGroup.rotation.y = this.rotY * 0.4;

    this.renderer.render(this.scene, this.camera);
  }
}
