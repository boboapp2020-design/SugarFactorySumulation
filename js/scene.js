'use strict';
/* =====================================================================
   Sugar Factory Manager — scene.js
   ประกอบฉากโรงงานจากภาพอาคารของผู้ใช้ใน assets/Building/
     - ที่ดิน.png            = พื้นหลัง 1536x1024
     - <ชื่ออาคาร>.png       = อาคารแยกชิ้น (พื้นขาว / ลายตาราง / โปร่งใส ได้ทั้งหมด)
   ตอนโหลด: ลบพื้นหลังด้วย flood-fill จากขอบภาพ -> ตัดกรอบเนื้อหา -> วางบนที่ดิน
   ตามจุดยึด (ax, ay = กึ่งกลางด้านล่างของอาคาร) และสัดส่วน s
   อาคารที่ยังไม่มีไฟล์ จะขึ้นกรอบ "รอภาพ" ไว้ให้ก่อน
   ===================================================================== */

const SCENE = {
  /* 'svg'   = ฉากที่เกมวาดเอง (fx.js) — ค่าเริ่มต้น
     'image' = ประกอบจากภาพอาคารใน assets/Building/ */
  mode: 'svg',
  dir: 'assets/Building/',
  land: 'ที่ดิน.png',
  /* กรอบอาคารในฉาก SVG (พิกัดตามที่ fx.js วาด) ใช้ยึดป้ายชื่อ+ดาว · lbl = ตำแหน่งป้ายถ้าไม่อยากไว้บนสุด */
  svgBoxes: {
    /* --- สายวัตถุดิบ (ซ้าย) --- */
    promo:   { left: 40,   top: 796, w: 168, h: 84 },
    harvest: { left: 248,  top: 796, w: 176, h: 84 },
    yard:    { left: 56,   top: 524, w: 300, h: 190, lbl: [206, 626] },
    /* --- สายการผลิต (กลาง) --- */
    mill:    { left: 430,  top: 422, w: 190, h: 108 },
    clar:    { left: 660,  top: 462, w: 130, h: 58 },
    evap:    { left: 837,  top: 448, w: 234, h: 72 },
    pan:     { left: 1076, top: 468, w: 200, h: 76 },
    fugal:   { left: 880,  top: 650, w: 220, h: 100 },
    pack:    { left: 1140, top: 688, w: 120, h: 62 },
    warehouse: { left: 1300, top: 660, w: 220, h: 130 },
    /* --- พลังงาน (บน) --- */
    boiler:  { left: 520,  top: 210, w: 240, h: 130, lbl: [640, 214] },
    power:   { left: 830,  top: 222, w: 190, h: 108, lbl: [925, 226] },
    /* --- ถังกากน้ำตาล --- */
    molasses: { left: 1128, top: 556, w: 90, h: 50 },
    /* --- ทีมสนับสนุน (แถวล่าง) --- */
    maint:   { left: 430,  top: 884, w: 130, h: 66 },
    ert:     { left: 600,  top: 884, w: 120, h: 66 },
    hr:      { left: 760,  top: 884, w: 120, h: 66 },
    qc:      { left: 920,  top: 884, w: 120, h: 66 },
    office:  { left: 1080, top: 884, w: 160, h: 66 },
    water:   { left: 1372, top: 384, w: 176, h: 46 },
  },
  /* ax, ay = จุดยึดกึ่งกลางด้านล่างบนที่ดิน (ใช้เฉพาะโหมดภาพ)
     dept = แผนกที่อาคารนี้แทน · compact = ป้ายแบบสั้น (ไอคอน+ชื่อ ไม่มีบรรทัดค่า) */
  buildings: [
    { key: 'promo',   n: 1,  name: 'ส่งเสริมหาอ้อย', dept: 'promo',   file: 'ที่ดิน.png',     ax: 124,  ay: 880, s: 0.14 },
    { key: 'harvest', n: 2,  name: 'เก็บเกี่ยว-ขนส่ง', dept: 'harvest', file: 'ลานอ้อย.png',   ax: 336,  ay: 880, s: 0.14 },
    { key: 'yard',    n: 3,  name: 'ลานอ้อย',       dept: 'yard',    file: 'ลานอ้อย.png',   ax: 205,  ay: 714, s: 0.22,
      workers: [[560, 720, 90]], forklift: [1350, 520, 70] },
    { key: 'mill',    n: 4,  name: 'ลูกหีบ',        dept: 'mill',    file: 'ลูกหีบ.png',    ax: 525,  ay: 530, s: 0.22,
      smoke: [[832, 24]], workers: [[720, 730, 80]] },
    { key: 'clar',    n: 5,  name: 'ทำใส',          dept: 'clar',    file: 'ทำใส.png',      ax: 725,  ay: 520, s: 0.18,
      steam: [[330, 105], [520, 150]] },
    { key: 'evap',    n: 6,  name: 'หม้อต้ม',       dept: 'evap',    file: 'หม้อต้ม.png',   ax: 954,  ay: 520, s: 0.20,
      steam: [[490, 185], [640, 225], [790, 265]] },
    { key: 'pan',     n: 7,  name: 'หม้อเคี่ยว',     dept: 'pan',     file: 'หม้อเคี่ยว.png', ax: 1176, ay: 544, s: 0.20,
      steam: [[620, 300], [850, 385]] },
    { key: 'fugal',   n: 8,  name: 'หม้อปั่นแยก',    dept: 'fugal',   file: 'หม้อปั่น.png',   ax: 990,  ay: 750, s: 0.20,
      steam: [[560, 250], [730, 300]], workers: [[520, 900, 80]] },
    { key: 'pack',    n: 9,  name: 'บรรจุน้ำตาล',    dept: 'pack',    file: 'บรรจุ.png',     ax: 1200, ay: 750, s: 0.12 },
    { key: 'warehouse', n: 10, name: 'คลังและส่งมอบ', dept: 'wh',    file: 'คลัง.png',      ax: 1410, ay: 790, s: 0.18,
      forklift: [1000, 720, 60] },
    { key: 'boiler',  n: 11, name: 'หม้อไอน้ำ',      dept: 'boiler',  file: 'หม้อไอน้ำ.png',  ax: 640,  ay: 340, s: 0.20,
      smoke: [[700, 60], [900, 60]] },
    { key: 'power',   n: 12, name: 'ผลิตไฟฟ้า',      dept: 'power',   file: 'โรงไฟฟ้า.png',   ax: 925,  ay: 330, s: 0.18 },
    { key: 'maint',   n: 13, name: 'ซ่อมบำรุง',      dept: 'maint',   file: 'ซ่อมบำรุง.png',  ax: 495,  ay: 950, s: 0.12, compact: true },
    { key: 'office',  n: 14, name: 'ขาย/การตลาด',    dept: 'sales',   file: 'สำนักงาน.png',   ax: 1160, ay: 950, s: 0.13, compact: true },
    { key: 'ert',     n: 15, name: 'ทีมฉุกเฉิน',     dept: 'ert',     file: 'ซ่อมบำรุง.png',  ax: 660,  ay: 950, s: 0.11, compact: true },
    { key: 'hr',      n: 16, name: 'บุคคล',          dept: 'hr',      file: 'สำนักงาน.png',   ax: 820,  ay: 950, s: 0.11, compact: true },
    { key: 'qc',      n: 17, name: 'คุณภาพ',         dept: 'qc',      file: 'สำนักงาน.png',   ax: 980,  ay: 950, s: 0.11, compact: true },
    { key: 'water',   n: 18, name: 'บ่อบำบัด',       dept: 'wwt',     file: 'ที่ดิน.png',     ax: 1460, ay: 520, s: 0.12, compact: true },
    /* ถังกากน้ำตาล = สถานีเก็บของแยกต่างหาก อัปเกรดความจุได้เอง */
    { key: 'molasses', n: 0, name: 'ถังกากน้ำตาล',   dept: 'molasses', file: 'ถังโมลาส.png',   ax: 1173, ay: 606, s: 0.12, compact: true },
  ],
  /* จุดที่ไม่ใช่อาคาร */
  points: { water: { x: 1460, y: 460 }, gate: { x: 300, y: 860 } },

  placed: {},      // key -> { left, top, w, h, s, bbox, missing }
  ready: false,

  url(f) { return this.dir + encodeURIComponent(f); },

  /* ---------- โหลดทุกอาคาร ---------- */
  async load() {
    const host = document.getElementById('buildings');
    if (!host) return;
    host.innerHTML = '';
    if (this.mode === 'svg') {
      /* ฉากวาดเอง: ไม่โหลดภาพ ใช้กรอบอาคารที่ fx.js วาดเป็นตำแหน่งป้าย */
      const img = document.getElementById('mapImg'); if (img) img.style.display = 'none';
      const svg = document.getElementById('mapSvg'); if (svg) svg.style.display = '';
      for (const b of this.buildings) {
        const bx = this.svgBoxes[b.key]; if (!bx) continue;
        this.placed[b.key] = Object.assign({ s: 1, bbox: { x: 0, y: 0, w: bx.w, h: bx.h }, el: null, missing: false }, bx);
      }
      this.ready = true;
      document.dispatchEvent(new CustomEvent('scene:ready'));
      return;
    }
    /* โหลดทีละอาคาร (กันเครื่องช้า) และไม่ให้อาคารเดียวที่พังทำให้ทั้งฉากไม่ขึ้น */
    for (const b of this.buildings) {
      try { await this.loadOne(b, host); } catch (e) { console.error('scene:', b.file, e); if (!this.placed[b.key]) this.placePlaceholder(b, host); }
    }
    /* วาดหลังก่อน หน้าหลัง (ตาม ay) */
    [...host.children].sort((a, b) => (+a.dataset.ay) - (+b.dataset.ay)).forEach(c => host.appendChild(c));
    this.ready = true;
    document.dispatchEvent(new CustomEvent('scene:ready'));
  },

  async loadOne(b, host) {
    let img = null;
    try { img = await this.loadImage(this.url(b.file)); } catch (e) { img = null; }
    if (!img) { this.placePlaceholder(b, host); return; }
    const status = document.getElementById('ldTxt'); if (status) status.textContent = 'กำลังลบพื้นหลัง ' + b.name + '…';
    try {
      /* เปิดจาก file:// อ่าน pixel ไม่ได้ (tainted canvas) -> ใช้ภาพตรง ๆ แบบ multiply ให้พื้นขาวกลืนกับพื้น */
      if (location.protocol === 'file:') throw new Error('file-protocol');
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, cv.width, cv.height);
      if (!this.hasAlpha(data)) this.removeBackground(data);
      const bbox = this.bbox(data);
      ctx.putImageData(data, 0, 0);
      const out = document.createElement('canvas');
      out.width = bbox.w; out.height = bbox.h;
      out.getContext('2d').drawImage(cv, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h);
      this.place(b, host, out, bbox);
    } catch (e) {
      /* fallback: วางภาพเดิมทั้งใบ ผสมแบบ multiply (พื้นขาวจะโปร่ง) */
      console.warn('scene: ใช้ภาพแบบ multiply สำหรับ', b.file, e && e.message);
      img.className = 'bld raw';
      this.place(b, host, img, { x: 0, y: 0, w: img.width, h: img.height });
    }
  },

  place(b, host, el, bbox) {
    const w = bbox.w * b.s, h = bbox.h * b.s;
    const left = b.ax - w / 2, top = b.ay - h;
    el.classList.add('bld');
    el.dataset.key = b.key; el.dataset.ay = b.ay;
    el.style.cssText += `;left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px`;
    host.appendChild(el);
    this.placed[b.key] = { left, top, w, h, s: b.s, bbox, el, missing: false };
  },

  placePlaceholder(b, host) {
    const w = 1400 * b.s * 0.9, h = 900 * b.s * 0.9;
    const left = b.ax - w / 2, top = b.ay - h;
    const d = document.createElement('div');
    d.className = 'bld placeholder';
    d.dataset.key = b.key; d.dataset.ay = b.ay;
    d.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px`;
    d.innerHTML = `<span>${b.n}. ${b.name}</span><small>รอภาพ ${b.file}</small>`;
    host.appendChild(d);
    this.placed[b.key] = { left, top, w, h, s: b.s, bbox: { x: 0, y: 0, w: 1400, h: 900 }, el: d, missing: true };
  },

  loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  },

  hasAlpha(d) {
    const a = d.data; let n = 0;
    for (let i = 3; i < a.length; i += 4 * 61) if (a[i] < 250) n++;
    return n > 40;
  },

  /* ลบพื้นหลังด้วย flood-fill จากขอบ: พื้นขาว หรือลายตารางเทา (ไม่กินสีขาวที่อยู่ในตัวอาคาร) */
  removeBackground(imgData) {
    const { width: W, height: H, data: d } = imgData;
    /* ดูมุมภาพว่าเป็นขาวหรือเทา */
    const corner = (x, y) => { const i = (y * W + x) * 4; return (d[i] + d[i + 1] + d[i + 2]) / 3; };
    const avg = (corner(2, 2) + corner(W - 3, 2) + corner(2, H - 3) + corner(W - 3, H - 3)) / 4;
    const grey = avg < 232;
    const isBg = i => {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (grey) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn <= 18 && mn >= 112; }
      return r >= 228 && g >= 228 && b >= 228 && Math.max(r, g, b) - Math.min(r, g, b) <= 14;
    };
    /* flood-fill แบบเร็ว: stack เป็น Int32Array, ทำเครื่องหมายตอน push เพื่อไม่ซ้ำ */
    const seen = new Uint8Array(W * H);
    const stack = new Int32Array(W * H);
    let sp = 0;
    const push = p => { if (!seen[p]) { seen[p] = 1; if (isBg(p * 4)) stack[sp++] = p; } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (sp > 0) {
      const p = stack[--sp];
      d[p * 4 + 3] = 0;
      const x = p % W;
      if (x > 0) push(p - 1);
      if (x < W - 1) push(p + 1);
      if (p >= W) push(p - W);
      if (p < W * (H - 1)) push(p + W);
    }
    /* ลบขอบขาวบาง ๆ ที่ติดอยู่ (anti-alias): pixel ทึบที่ติดกับโปร่งใสและสว่างมาก -> โปร่งครึ่ง */
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x, i = p * 4;
      if (d[i + 3] === 0) continue;
      const nb = d[(p - 1) * 4 + 3] === 0 || d[(p + 1) * 4 + 3] === 0 || d[(p - W) * 4 + 3] === 0 || d[(p + W) * 4 + 3] === 0;
      if (nb && (d[i] + d[i + 1] + d[i + 2]) / 3 > (grey ? 150 : 215)) d[i + 3] = 110;
    }
  },

  bbox(imgData) {
    const { width: W, height: H, data: d } = imgData;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (d[(y * W + x) * 4 + 3] > 30) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 <= x0) return { x: 0, y: 0, w: W, h: H };
    const pad = 4;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  },

  /* ---------- พิกัดช่วย ---------- */
  /* แปลงจุดในภาพต้นฉบับของอาคาร -> พิกัดบนที่ดิน */
  pt(key, sx, sy) {
    const p = this.placed[key]; if (!p) return null;
    return [p.left + (sx - p.bbox.x) * p.s, p.top + (sy - p.bbox.y) * p.s];
  },
  /* จุดตามสัดส่วนของกรอบอาคาร (fx, fy ใน 0..1) */
  at(key, fx, fy) {
    const p = this.placed[key]; if (!p) return [0, 0];
    return [p.left + p.w * fx, p.top + p.h * fy];
  },
  building(key) { return this.buildings.find(b => b.key === key); },

  /* ---------- ดาวอัปเกรด 0-5 ต่ออาคาร ---------- */
  stars(s, key) {
    const b = this.building(key); if (!b || !b.dept) return 0;
    const d = DEPT_BY_ID[b.dept]; if (!d) return 0;
    return dStar(s, b.dept);      /* จำนวนดาวจริงของแผนก (ไม่แปลงสเกล) */
  },
  starMax(key) {
    const b = this.building(key); if (!b || !b.dept) return 5;
    const d = DEPT_BY_ID[b.dept]; return d ? d.maxStar : 5;   /* จำนวนช่องดาวเท่ากับดาวเต็มของแผนก (ทีม 3 ดาว = 3 ช่อง) */
  },
  starsHTML(n, popIdx = -1, max = 5) {
    let h = '';
    for (let i = 0; i < max; i++) h += `<i class="star ${i < n ? 'on' : ''} ${i === popIdx ? 'pop' : ''}">★</i>`;
    return `<span class="stars">${h}</span>`;
  },
};
