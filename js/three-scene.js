'use strict';
/* =====================================================================
   Sugar Factory Manager — three-scene.js  (โหมด 3D WebGL จริง ด้วย Three.js)

   วาดโรงงานเป็นโมเดล 3D มีแสงเงา ความลึก และแอนิเมชัน แล้ว "ฉาย" จุดบนสุด
   ของอาคารกลับเป็นพิกัด 1536×1024 เพื่อให้ป้ายชื่อ (HTML markers) เดิมยังตรง
   — ระบบซูม/แพน (Cam) และป้ายทั้งหมดใช้ได้เหมือนเดิมเพราะ canvas อยู่ใน #world

   หน่วยโลก 3D: worldX = (mapX-768)*U, worldZ = (mapY-512)*U, y = สูงขึ้น
   ===================================================================== */
const Three3D = {
  on: false, ready: false, U: 0.06,
  renderer: null, scene: null, camera: null, smoke: [], anims: [], t: 0, _built: false,

  /* ---- แปลงพิกัดแผนที่ 2D → โลก 3D ---- */
  wx(mx) { return (mx - 768) * this.U; },
  wz(my) { return (my - 512) * this.U; },
  wd(px) { return px * this.U; },

  available() { return typeof THREE !== 'undefined'; },

  init() {
    if (this.ready || !this.available()) return this.ready;
    const canvas = document.getElementById('c3d');
    if (!canvas) return false;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.setSize(1536, 1024, false);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    } catch (e) { console.warn('3D: WebGL ไม่พร้อม', e); return false; }

    const scn = this.scene = new THREE.Scene();
    scn.background = new THREE.Color('#8bb0d8');
    scn.fog = new THREE.Fog('#aac5de', 70, 165);

    /* กล้องเพอร์สเปกทีฟ มุมไอโซเมตริก อัตราส่วน 1536:1024 = 1.5 */
    const cam = this.camera = new THREE.PerspectiveCamera(32, 1536 / 1024, 1, 600);
    cam.position.set(40, 52, 82);
    cam.lookAt(0, 3, 3);

    /* ---- แสง 3 จุด: ฟ้า+พื้น (hemisphere), ดวงอาทิตย์ (directional+เงา), เติมอุ่น ---- */
    scn.add(new THREE.HemisphereLight('#cfe3ff', '#6b7a3f', 0.85));
    const sun = new THREE.DirectionalLight('#ffe6b8', 1.25);
    sun.position.set(-70, 110, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -80; sc.right = 80; sc.top = 60; sc.bottom = -60; sc.near = 20; sc.far = 320;
    sun.shadow.bias = -0.0004;
    scn.add(sun); scn.add(sun.target);
    const fill = new THREE.DirectionalLight('#ffd9a0', 0.35);
    fill.position.set(80, 40, -40); scn.add(fill);

    this.build();
    this.ready = true;
    this.resize();
    return true;
  },

  /* ---- คลังวัสดุ ---- */
  mat(color, rough = 0.85, metal = 0.0) {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: metal, flatShading: false });
  },

  box(g, cx, cz, w, d, h, color, opt = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, this.mat(color, opt.rough ?? 0.8, opt.metal ?? 0));
    m.position.set(cx, h / 2 + (opt.y || 0), cz);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m); return m;
  },
  roof(g, cx, cz, w, d, baseH, rh, color) {
    /* หลังคาปั้นหยาแบบง่าย: กล่องบางเอียง = พีระมิดกด */
    const geo = new THREE.ConeGeometry(Math.min(w, d) * 0.72, rh, 4);
    const m = new THREE.Mesh(geo, this.mat(color, 0.7));
    m.rotation.y = Math.PI / 4;
    m.scale.set(w / Math.min(w, d) * 0.98, 1, d / Math.min(w, d) * 0.98);
    m.position.set(cx, baseH + rh / 2, cz);
    m.castShadow = true; g.add(m); return m;
  },
  cyl(g, cx, cz, r, h, color, opt = {}) {
    const geo = new THREE.CylinderGeometry(r, r * (opt.taper || 1), h, 20);
    const m = new THREE.Mesh(geo, this.mat(color, opt.rough ?? 0.5, opt.metal ?? 0.35));
    m.position.set(cx, h / 2 + (opt.y || 0), cz);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    if (opt.top) { const t = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(opt.top, 0.5, 0.3)); t.position.set(cx, h + (opt.y || 0), cz); t.castShadow = true; g.add(t); }
    return m;
  },

  build() {
    if (this._built) return; this._built = true;
    const S = this.scene, U = this.U;

    /* ---- พื้นดิน (ไร่อ้อย) ---- */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(190, 140), this.mat('#6fa53c', 1));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
    S.add(ground);

    /* ---- ลานคอนกรีตโรงงาน ---- */
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(this.wd(1140), this.wd(720)), this.mat('#c3c9ce', 1));
    slab.rotation.x = -Math.PI / 2; slab.position.set(this.wx(956), 0.02, this.wz(634)); slab.receiveShadow = true;
    S.add(slab);

    /* ---- ถนน (แถบเทาเข้ม) ---- */
    const road = (mx, my, w, d) => {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(this.wd(w), this.wd(d)), this.mat('#6a6f74', 1));
      r.rotation.x = -Math.PI / 2; r.position.set(this.wx(mx), 0.04, this.wz(my)); r.receiveShadow = true; S.add(r);
    };
    road(905, 900, 1900, 90); road(905, 495, 900, 30); road(905, 830, 920, 30); road(886, 655, 30, 380);

    /* ---- บ่อบำบัด + แม่น้ำ (น้ำ) ---- */
    const water = (mx, my, w, d) => {
      const wt = new THREE.Mesh(new THREE.PlaneGeometry(this.wd(w), this.wd(d)), this.mat('#3f9fd6', 0.25, 0.1));
      wt.rotation.x = -Math.PI / 2; wt.position.set(this.wx(mx), 0.06, this.wz(my)); S.add(wt);
    };
    water(1462, 470, 180, 110); water(1360, 90, 380, 160);

    /* ---- อาคาร/ถังตามผังจริง (จาก SCENE.svgBoxes) ---- */
    const B = (typeof SCENE !== 'undefined' && SCENE.svgBoxes) || {};
    const rgb = { steel: '#c9d2d9', slate: '#8ea0b2', blue: '#7ba7cf', green: '#84b85a', red: '#c86b5a', brick: '#c98f68', rust: '#c58a52' };
    const put = (key, fn) => { const b = B[key]; if (b) fn(this.wx(b.left + b.w / 2), this.wz(b.top + b.h / 2), this.wd(b.w), this.wd(b.h), b); };

    /* สายวัตถุดิบ */
    put('promo', (x, z, w, d) => { this.box(S, x, z, w, d, 5, rgb.brick); this.roof(S, x, z, w, d, 5, 2.4, '#9a5b3a'); });
    put('harvest', (x, z, w, d) => { this.box(S, x, z, w, d, 5, rgb.steel); this.roof(S, x, z, w, d, 5, 2.2, '#7c878f'); });
    put('yard', (x, z, w, d) => { const p = this.box(S, x, z, w, d, 0.6, '#a97c42'); p.receiveShadow = true;
      for (let i = 0; i < 5; i++) this.box(S, x - w * 0.32 + (i % 3) * w * 0.3, z - d * 0.2 + Math.floor(i / 3) * d * 0.4, w * 0.22, d * 0.28, 1.6 + (i % 2) * 0.6, '#7fae3c', { y: 0.6 }); });

    /* สายการผลิต */
    put('mill', (x, z, w, d) => { this.box(S, x, z, w, d, 6.5, rgb.slate); this.roof(S, x, z, w, d, 6.5, 2.6, '#5f7486'); });
    put('clar', (x, z, w, d) => { this.cyl(S, x - w * 0.2, z, this.wd(34), 4.2, '#dfe6ec', { top: '#c2cdd4' }); this.cyl(S, x + w * 0.24, z, this.wd(28), 3.4, '#dfe6ec', { top: '#c2cdd4' }); });
    put('evap', (x, z, w, d) => { for (let i = 0; i < 5; i++) this.cyl(S, x - w * 0.4 + i * w * 0.2, z, this.wd(20), 7.5, '#e6ecf0', { top: '#cdd6dc' }); });
    put('pan', (x, z, w, d) => { for (let i = 0; i < 3; i++) this.cyl(S, x - w * 0.32 + i * w * 0.32, z, this.wd(30), 5.5, '#f2e4c4', { top: '#dcc79a', metal: 0.2 }); });
    put('fugal', (x, z, w, d) => { this.box(S, x, z, w, d, 5, rgb.green); this.roof(S, x, z, w, d, 5, 2, '#5c8034');
      this.cyl(S, x - w * 0.28, z + d * 0.6, this.wd(18), 2.2, '#c9b48a', { taper: 1, top: '#a8895c' }); });
    put('pack', (x, z, w, d) => { this.box(S, x, z, w, d, 4.5, rgb.steel); this.roof(S, x, z, w, d, 4.5, 1.8, '#7c878f'); });
    put('warehouse', (x, z, w, d) => { this.box(S, x, z, w, d, 7, rgb.blue); this.roof(S, x, z, w, d, 7, 2.6, '#43708f'); });
    put('molasses', (x, z, w, d) => { this.cyl(S, x - w * 0.2, z, this.wd(24), 5, '#caa96e', { top: '#a8895c', metal: 0.15 }); this.cyl(S, x + w * 0.26, z, this.wd(20), 4.2, '#caa96e', { top: '#a8895c', metal: 0.15 }); });

    /* พลังงาน + ปล่องควัน */
    put('boiler', (x, z, w, d) => {
      this.box(S, x, z, w, d, 8, rgb.red); this.roof(S, x, z, w, d, 8, 2, '#8f483d');
      [[-w * 0.22, 16], [w * 0.05, 17]].forEach(([dx, hh]) => {
        const c = this.cyl(S, x + dx, z - d * 0.2, this.wd(13), hh, '#e2e6e9', { metal: 0.2 });
        for (let k = 0; k < 3; k++) { const band = new THREE.Mesh(new THREE.CylinderGeometry(this.wd(13.4), this.wd(13.4), 1.1, 20), this.mat('#c0392b', 0.6)); band.position.set(x + dx, 3 + k * 5, z - d * 0.2); S.add(band); }
        this.smokeSrc(x + dx, hh + 0.5, z - d * 0.2, 'boiler');
      });
    });
    put('power', (x, z, w, d) => { this.box(S, x, z, w, d, 6, rgb.steel); this.roof(S, x, z, w, d, 6, 2, '#7c878f'); });

    /* ทีมสนับสนุน (อาคารเตี้ย) */
    ['maint', 'ert', 'hr', 'qc', 'office'].forEach(k => put(k, (x, z, w, d) => {
      const col = k === 'ert' ? rgb.red : k === 'office' ? rgb.rust : k === 'qc' ? rgb.blue : k === 'hr' ? rgb.brick : rgb.steel;
      this.box(S, x, z, w, d, 4, col); this.roof(S, x, z, w, d, 4, 1.5, '#6b757d');
    }));

    /* น้ำหอเก็บน้ำ + เสาส่งไฟ */
    this.cyl(S, this.wx(790), this.wz(452), this.wd(26), 8, '#b9c4cb', { taper: 0.5, top: '#9fb0bb' });

    /* ต้นไม้กระจาย (instanced) */
    this.scatterTrees();

    /* ---- ตำแหน่งจุดยึดป้าย (บนสุดของอาคาร) เก็บไว้ให้ projectAll ---- */
    this.anchors = {};
    const H = { promo: 7.5, harvest: 7.5, yard: 3.2, mill: 9.5, clar: 5.5, evap: 8.5, pan: 6.5, fugal: 7.5, pack: 6.8, warehouse: 10, molasses: 6, boiler: 11, power: 8.5, maint: 5.8, ert: 5.8, hr: 5.8, qc: 5.8, office: 5.8, water: 1.5 };
    for (const key in B) { const b = B[key]; this.anchors[key] = new THREE.Vector3(this.wx(b.left + b.w / 2), H[key] || 6, this.wz(b.top + b.h / 2)); }
    /* จำ lbl เดิม (2D) ไว้คืนตอนปิด 3D */
    this._lbl0 = {}; for (const key in B) this._lbl0[key] = B[key].lbl ? B[key].lbl.slice() : null;
    this._water0 = (typeof SCENE !== 'undefined' && SCENE.points && SCENE.points.water) ? { x: SCENE.points.water.x, y: SCENE.points.water.y } : null;
    /* จุดบ่อบำบัดใช้ svgBoxes.water; SCENE.points.water สำหรับ marker 'water' */
  },

  scatterTrees() {
    const S = this.scene, rnd = (a, b) => a + Math.random() * (b - a);
    const trunkMat = this.mat('#6b4a2a', 1), leafMat = this.mat('#3f8f34', 0.9);
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.2, 6);
    const leafGeo = new THREE.SphereGeometry(2.2, 8, 6);
    for (let i = 0; i < 60; i++) {
      const mx = rnd(0, 1536), my = rnd(60, 1000);
      const inSlab = mx > 380 && mx < 1530 && my > 250 && my < 1010;
      if (inSlab || (mx < 380 && my > 140 && my < 800)) { i--; continue; }
      const x = this.wx(mx), z = this.wz(my), s = rnd(0.7, 1.3);
      const g = new THREE.Group();
      const tr = new THREE.Mesh(trunkGeo, trunkMat); tr.position.y = 1.1; tr.castShadow = true; g.add(tr);
      const lf = new THREE.Mesh(leafGeo, leafMat); lf.position.y = 3.2; lf.scale.setScalar(rnd(0.8, 1.15)); lf.castShadow = true; g.add(lf);
      g.position.set(x, 0, z); g.scale.setScalar(s); S.add(g);
    }
  },

  /* ---- ควัน: sprite เนื้อนุ่ม ลอยขึ้นแล้วจาง ---- */
  _smokeTex: null,
  smokeTex() {
    if (this._smokeTex) return this._smokeTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(235,240,245,0.4)'); g.addColorStop(1, 'rgba(220,228,236,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return this._smokeTex = new THREE.CanvasTexture(c);
  },
  smokeSources: [],
  smokeSrc(x, y, z, key) { this.smokeSources.push({ x, y, z, key, acc: 0 }); },
  emitSmoke(src) {
    const mat = new THREE.SpriteMaterial({ map: this.smokeTex(), transparent: true, opacity: 0.5, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.position.set(src.x + (Math.random() - 0.5) * 1.5, src.y, src.z + (Math.random() - 0.5) * 1.5);
    sp.scale.setScalar(2.5);
    this.scene.add(sp);
    this.smoke.push({ sp, life: 0, max: 4.5, vy: 3.2 + Math.random() * 1.5, vx: 0.6 + Math.random() * 0.8 });
    if (this.smoke.length > 90) { const old = this.smoke.shift(); this.scene.remove(old.sp); }
  },

  update(dt) {
    this.t += dt;
    /* ควัน */
    for (const src of this.smokeSources) {
      const down = typeof state !== 'undefined' && state && state.dept && state.dept[src.key] && state.dept[src.key].downH > 0;
      const paused = typeof state !== 'undefined' && state && (state.speed === 0 || !state.started);
      if (down || paused) continue;
      src.acc += dt * 3.2;
      while (src.acc >= 1) { src.acc -= 1; this.emitSmoke(src); }
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const p = this.smoke[i]; p.life += dt;
      p.sp.position.y += p.vy * dt; p.sp.position.x += p.vx * dt;
      const k = p.life / p.max;
      p.sp.material.opacity = Math.max(0, 0.5 * (1 - k));
      p.sp.scale.setScalar(2.5 + k * 6);
      if (p.life >= p.max) { this.scene.remove(p.sp); this.smoke.splice(i, 1); }
    }
  },

  render(dt) {
    if (!this.on || !this.ready) return;
    this.update(dt || 0.016);
    this.renderer.render(this.scene, this.camera);
  },

  /* ---- ฉายจุดยึดอาคารกลับเป็นพิกัด 1536×1024 → ตั้งให้ป้ายเดิม ---- */
  projectAll() {
    if (!this.on || !this.ready || !this.anchors || typeof SCENE === 'undefined') return;
    const v = new THREE.Vector3();
    for (const key in this.anchors) {
      const p = SCENE.placed[key]; if (!p) continue;
      v.copy(this.anchors[key]).project(this.camera);
      p.lbl = [(v.x * 0.5 + 0.5) * 1536, (-v.y * 0.5 + 0.5) * 1024 - 8];
    }
    const wp = SCENE.points && SCENE.points.water;
    if (wp && this.anchors.water) { v.copy(this.anchors.water).project(this.camera); wp.x = (v.x * 0.5 + 0.5) * 1536; wp.y = (-v.y * 0.5 + 0.5) * 1024; }
  },

  resize() { if (this.renderer) { this.renderer.setSize(1536, 1024, false); this.camera.aspect = 1536 / 1024; this.camera.updateProjectionMatrix(); } },

  /* ---- เปิด/ปิดโหมด 3D ---- */
  setMode(on) {
    if (on && !this.ready && !this.init()) { toast && toast('เครื่องนี้ยังไม่รองรับ 3D (WebGL)'); return false; }
    this.on = !!on;
    const world = document.getElementById('world');
    if (world) world.classList.toggle('d3', this.on);
    if (this.on) { this.render(0); this.projectAll(); }
    else if (this._lbl0 && typeof SCENE !== 'undefined') {
      /* คืนตำแหน่งป้ายเดิมของโหมด 2D */
      for (const key in this._lbl0) { const p = SCENE.placed[key]; if (!p) continue; if (this._lbl0[key]) p.lbl = this._lbl0[key].slice(); else delete p.lbl; }
      if (this._water0 && SCENE.points && SCENE.points.water) { SCENE.points.water.x = this._water0.x; SCENE.points.water.y = this._water0.y; }
    }
    try { lsSet('sfm_3d', this.on ? '1' : '0'); } catch (e) {}
    return this.on;
  },
};
if (typeof window !== 'undefined') window.Three3D = Three3D;
