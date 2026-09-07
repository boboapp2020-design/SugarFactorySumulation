'use strict';
/* =====================================================================
   Sugar Factory Manager v0.4 — fx.js
   ฉากโรงงาน 2.5D (SVG ทั้งหมด) + แอนิเมชันทุกอย่างขับด้วย rAF ลูปเดียวกับเกม

   ผังโรงงาน (พิกัด 1536x1024) เรียงตามสายผลิตจริง
     แถวบนสุด : หม้อไอน้ำ+ปล่อง (560-800) → โรงไฟฟ้า (860-1030) → เสาส่งไฟ
     แถวกลาง  : ลานอ้อย (55-340) → โรงหีบ (420-620) → ถังทำใส (700-800)
                → หม้อต้ม 5 ลูก (850-1090) → หม้อเคี่ยว A/B/C (1140-1340)
     แถวล่าง  : บ่อบำบัด (430-690) → โรงปั่น+รางเย็น (880-1100) → บรรจุ (1110-1190)
                → คลังน้ำตาล (1200-1480) → ลานตู้คอนเทนเนอร์/รถส่ง
     ล่างสุด   : สำนักงาน ธง ที่จอดรถ ถนนใหญ่
   ===================================================================== */

const SVGNS = 'http://www.w3.org/2000/svg';
const MAP_W = 1536, MAP_H = 1024;

/* ตำแหน่งหลัก 2 ชุด: ภาพต้นฉบับ (assets/factory-map.png) และฉาก SVG สำรอง */
const L_IMG = {
  stacks: [{ x: 1020, top: 118 }, { x: 1206, top: 104 }],
  evapTops: [[975, 392], [1035, 388], [1100, 394], [1232, 428], [1292, 432]],
  panTops: [[1232, 428], [1292, 432]],
  spark: { mill: { x: 690, y: 400 }, clar: { x: 890, y: 420 }, evap: { x: 1040, y: 430 }, pan: { x: 1240, y: 460 }, fugal: { x: 900, y: 660 }, boiler: { x: 1110, y: 240 } },
  ponds: [[500, 556], [690, 560]],
  workers: [[600, 470, 60, 14, 0, '#f4d35e'], [880, 480, -50, 13, 1, '#5cb3ff'], [920, 690, 60, 12, 2, '#e2725b'], [1200, 640, 55, 15, 3, '#b7f36b'], [800, 890, 50, 16, 1.5, '#ffffff'], [1130, 300, -45, 14, 2.5, '#f4d35e'], [1470, 720, 40, 11, 0.5, '#e8e8e8'], [300, 640, 50, 13, 2, '#f4d35e']],
  forklifts: [[1300, 700, 70, 9, 0], [1420, 560, -60, 11, 1.5], [1240, 790, 60, 8, 3]],
  flag: [940, 806],
  birdsY: 60,
};
const L_SVG = {
  stacks: [{ x: 566, top: 128 }, { x: 700, top: 116 }],
  evapTops: [[858, 520], [906, 520], [954, 520], [1002, 520], [1050, 520]],
  panTops: [[1108, 544], [1176, 558], [1244, 548]],
  spark: {
    mill: { x: 525, y: 524 }, clar: { x: 720, y: 540 }, evap: { x: 954, y: 540 }, pan: { x: 1176, y: 560 },
    fugal: { x: 990, y: 700 }, boiler: { x: 640, y: 340 }, power: { x: 925, y: 330 }, pack: { x: 1200, y: 730 },
  },
  ponds: [[1430, 452], [1500, 490]],
  workers: [[220, 730, 60, 13, 0, '#f4d35e'], [520, 620, 70, 16, 1, '#5cb3ff'], [830, 616, -60, 14, 2, '#e2725b'],
            [980, 800, 60, 12, 3, '#b7f36b'], [1330, 880, 50, 13, 3.5, '#ffffff'], [660, 470, -45, 15, 2.5, '#f4d35e'],
            [820, 900, 55, 17, 4, '#e8e8e8'], [1190, 640, 40, 11, 1.2, '#f4d35e'], [140, 500, 45, 12, 2.2, '#8fbf46']],
  forklifts: [[1240, 828, 90, 9, 0], [1470, 856, -80, 11, 1.5], [1150, 830, 60, 8, 3], [240, 700, -60, 10, 0.8]],
  flag: [1160, 950],
  birdsY: 96,
};
let L = L_SVG;

const FX = {
  on: true, last: 0, acc: {}, parts: [], smoke: [], sparks: [], maxParts: 170,
  paths: {}, layers: {}, anims: [], animTime: 0,

  init() {
    const g = id => document.getElementById(id);
    this.layers = { smoke: g('fxSmoke'), steam: g('fxSteam'), flow: g('fxFlow'), trucks: g('fxTrucks'), spark: g('fxSpark') };
    for (const id of ['truckIn', 'truckOut', 'shipOut', 'f_cane', 'f_mill', 'f_clar', 'f_evap', 'f_pan', 'f_cent', 'f_pack', 'f_wh', 'f_bag', 'f_boiler', 'f_steam'])
      this.paths[id] = document.getElementById(id);
    /* ฉากประกอบจากภาพอาคาร (scene.js) -> เมื่อพร้อมค่อยสร้างแอนิเมชันตามตำแหน่งอาคารจริง
       ถ้าไม่มีภาพที่ดิน -> วาดฉาก SVG เอง */
    const useSvg = () => { this.imageMode = false; L = L_SVG; this.scenery(); this.rebuildAnim(); };
    const useScene = () => { this.imageMode = true; const sc = document.getElementById('scenery'); if (sc) sc.style.display = 'none'; L = this.buildLayoutFromScene(); this.routePaths(); this.rebuildAnim(); };
    document.addEventListener('scene:ready', () => (typeof SCENE !== 'undefined' && SCENE.mode === 'image') ? useScene() : useSvg());
    const hideLoading = () => { const ld = document.getElementById('loading'); if (ld) ld.classList.add('hide'); };
    if (typeof SCENE !== 'undefined') {
      SCENE.load().then(hideLoading).catch(e => { console.error('scene load failed', e); useSvg(); hideLoading(); });
      /* กันจอมืดค้าง: ถ้าโหลดนานเกิน 12 วิ ให้เปิดฉากเท่าที่มีไปก่อน */
      setTimeout(() => { if (!SCENE.ready) { const t = document.getElementById('ldTxt'); if (t) t.textContent = 'โหลดภาพช้า… เปิดฉากเท่าที่มีก่อน'; setTimeout(hideLoading, 800); } }, 12000);
    } else useSvg();
    this.layout();
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.layout(); });
    if (window.ResizeObserver) new ResizeObserver(() => this.layout()).observe(document.getElementById('map'));
    requestAnimationFrame(ts => this.loop(ts));
  },

  /* ทุกชั้นอยู่ใน #world ขนาด 1536x1024 คงที่ กล้อง (Cam ใน main.js) เป็นคนย่อ/ขยาย */
  layout() {
    document.getElementById('fx').setAttribute('preserveAspectRatio', 'none');
    if (typeof Cam !== 'undefined') Cam.onResize();
  },

  /* ---------- อัตราปล่อยอนุภาค (ต่อวินาที) จากตัวเลขจริงในเกม ---------- */
  rates() {
    if (typeof state === 'undefined' || !state) return {};
    const s = state, t = s.today, S = s.stations;
    /* หยุดเกมอยู่ก็ยังมีชีวิต: รถวิ่งช้า ๆ ควันบาง ๆ */
    if (s.speed === 0) return { truckIn: 0.08, shipOut: 0.03, smoke: 0.5, steam: 0.6 };
    const cleaning = s.cleaning && s.cleaning.activeH > 0;
    const run = k => !cleaning && S[k] && S[k].downH <= 0;
    /* ประมาณ "ตัน/วัน" จากวันนี้ ถ้าวันนี้เพิ่งเริ่ม (<1 ชม.) ใช้ยอดเมื่อวานแทน เพื่อไม่ให้ภาพหยุดนิ่งตอนเปลี่ยนวัน */
    const y = s.yesterday || {};
    const fresh = t.hours < 1 && y.hours > 0;
    const prog = Math.max(0.06, s.dayProgress || 0.06);
    const D = k => fresh ? (y[k] || 0) : (t[k] || 0) / prog;      // ตัน/วันที่คาดการณ์
    const f = v => Math.min(3.4, v / 1600);
    const sp = Math.min(2, 0.6 + s.speed * 0.25);
    return {
      truckIn: Math.min(0.9, (D('received') / 6000 + 0.08)) * sp,
      truckOut: 0,
      shipOut: Math.min(0.3, (D('sugar') / 2500 + s.orders.filter(o => o.status === 'accepted').length * 0.04)) * sp,
      f_cane: run('mill') ? f(D('milled')) : 0,
      f_mill: run('clar') ? f(D('rawJuice')) : 0,
      f_clar: run('evap') ? f(D('clearJuice')) : 0,
      f_evap: run('pan') ? f(D('syrup') * 3) : 0,
      f_pan: run('fugal') ? f(D('centIn') * 3) : 0,
      f_cent: run('fugal') ? f(D('sugar') * 6) : 0,
      f_pack: f(D('sugar') * 5),
      f_wh: f(D('sugar') * 4),
      f_bag: run('mill') ? f(D('bagasse') * 2.5) : 0,
      f_boiler: run('boiler') && D('bagasseUsed') > 0 ? f(D('bagasseUsed') * 2.5) : 0,
      f_steam: run('boiler') ? f(D('steamMade') * 1.5) : 0,
      smoke: run('boiler') ? 1.4 + Math.min(2.2, D('bagasseUsed') / 2500) : 0.25,
      steam: run('evap') ? 2.4 : 0,
    };
  },

  loop(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000 || 0);
    this.last = ts;
    /* กดหยุด = ทุกอย่างหยุดจริง ไม่มีควัน ไม่มีคน ไม่มีรถวิ่ง */
    const paused = typeof state !== 'undefined' && state && (state.speed === 0 || !state.started);
    if (this.on && !document.hidden && !paused) this.tick(dt);
    requestAnimationFrame(t => this.loop(t));
  },

  tick(dt) {
    const R = this.rates();
    for (const key of Object.keys(R)) {
      if (!R[key]) continue;
      this.acc[key] = (this.acc[key] || 0) + R[key] * dt;
      while (this.acc[key] >= 1) {
        this.acc[key] -= 1;
        if (key === 'smoke') this.emitSmoke();
        else if (key === 'steam') this.emitSteam();
        else if (key === 'truckIn' || key === 'truckOut' || key === 'shipOut') this.emitTruck(key);
        else this.emitFlow(key);
      }
    }
    /* อนุภาคบนเส้นทาง */
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += p.sp * dt;
      if (p.t >= 1) { p.el.remove(); this.parts.splice(i, 1); continue; }
      const path = this.paths[p.path];
      if (!path) { p.el.remove(); this.parts.splice(i, 1); continue; }
      const len = path.getTotalLength();
      const pt = path.getPointAtLength(p.t * len);
      if (p.rot) {
        const pt2 = path.getPointAtLength(Math.min(len, p.t * len + 6));
        const ang = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
        const flip = p.flip ? -1 : 1;
        p.el.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${ang * 0.35}) scale(${(p.sc || 1) * flip} ${p.sc || 1})`);
      } else {
        p.el.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
        const fade = p.t < 0.08 ? p.t / 0.08 : p.t > 0.9 ? (1 - p.t) / 0.1 : 1;
        p.el.setAttribute('opacity', fade);
      }
    }
    /* ควัน/ไอน้ำ */
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      s.life += dt;
      if (s.life > s.max) { s.el.remove(); this.smoke.splice(i, 1); continue; }
      const k = s.life / s.max;
      s.el.setAttribute('cx', s.x + s.drift * k * 60);
      s.el.setAttribute('cy', s.y - k * s.rise);
      s.el.setAttribute('r', s.r0 + k * s.grow);
      s.el.setAttribute('opacity', (1 - k) * s.alpha);
    }
    /* ประกายไฟ */
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      if (s.life > 0.6) { s.el.remove(); this.sparks.splice(i, 1); continue; }
      const k = s.life / 0.6;
      s.el.setAttribute('cx', s.x + s.vx * k * 40);
      s.el.setAttribute('cy', s.y + s.vy * k * 40 + k * k * 30);
      s.el.setAttribute('opacity', 1 - k);
    }
    this.emitBreakSparks(dt);
    this.animateScene(dt);
    this.lightAcc = (this.lightAcc || 0) + dt;
    if (this.lightAcc > 0.25) { this.lightAcc = 0; this.updateLight(); this.syncBelts(); }
  },

  syncBelts() {
    if (!this.belts || typeof state === 'undefined' || !state) return;
    const S = state.stations, cleaning = state.cleaning && state.cleaning.activeH > 0;
    const on = (k, v) => !cleaning && state.speed > 0 && S[k].downH <= 0 && v > 0;
    const set = (l, o) => { if (l) l.style.display = o ? '' : 'none'; };
    set(this.belts[0], on('mill', state.today.milled));
    set(this.belts[1], on('mill', state.today.bagasse));
    set(this.belts[2], on('fugal', state.today.sugar));
    set(this.belts[3], on('fugal', state.today.sugar));
  },

  emitFlow(key) {
    if (this.parts.length > this.maxParts) return;
    const style = FLOW_STYLE[key] || { c: '#ffd27a', r: 4, sp: 0.35 };
    if (key === 'f_cane') {                                 // ลำอ้อยบนสายพานเข้าลูกหีบ
      const use = document.createElementNS(SVGNS, 'use');
      use.setAttribute('href', '#caneMini'); this.layers.flow.appendChild(use);
      this.parts.push({ el: use, path: key, t: 0, sp: style.sp * 0.9, rot: true, sc: 1 });
      return;
    }
    const el = document.createElementNS(SVGNS, 'circle');
    el.setAttribute('r', style.r * (0.8 + Math.random() * 0.5));
    el.setAttribute('fill', style.c);
    el.setAttribute('opacity', 0);
    this.layers.flow.appendChild(el);
    this.parts.push({ el, path: key, t: 0, sp: style.sp * (0.85 + Math.random() * 0.3) });
  },

  /* ลำอ้อยเข้าโรงงาน (มัดอ้อยเคลื่อนตามถนน) · รถน้ำตาลออกจากคลัง */
  emitTruck(key) {
    if (key === 'truckOut') return;                       // ไม่มีรถเปล่าแล้ว (อ้อยมาเป็นลำ)
    const use = document.createElementNS(SVGNS, 'use');
    const sprite = key === 'truckIn' ? '#caneBundle' : '#sugarTruck';
    use.setAttribute('href', sprite);
    this.layers.trucks.appendChild(use);
    this.parts.push({ el: use, path: key, t: 0, sp: (key === 'truckIn' ? 0.06 : 0.075) + Math.random() * 0.03, rot: true, sc: (key === 'truckIn' ? 1.0 : 1.25) + Math.random() * 0.25 });
  },

  emitSmoke() {
    const st = L.stacks[Math.floor(Math.random() * L.stacks.length)];
    if (st.key && state && state.stations[st.key] && state.stations[st.key].downH > 0) return;
    this.puff(st.x + (Math.random() - 0.5) * 8, st.top, { r0: 9, grow: 40, rise: 120, max: 4.0, alpha: 0.44, drift: 0.5 + Math.random() * 0.6 });
  },
  emitSteam() {
    const v = L.evapTops[Math.floor(Math.random() * L.evapTops.length)];
    if (v[2] && state && state.stations[v[2]] && state.stations[v[2]].downH > 0) return;
    this.puff(v[0] + (Math.random() - 0.5) * 10, v[1], { r0: 6, grow: 26, rise: 70, max: 2.4, alpha: 0.4, drift: (Math.random() - 0.2) * 0.7 }, 'steam');
  },
  puff(x, y, o, layer = 'smoke') {
    if (this.smoke.length > 120) return;
    const el = document.createElementNS(SVGNS, 'circle');
    el.setAttribute('cx', x); el.setAttribute('cy', y); el.setAttribute('r', o.r0);
    el.setAttribute('fill', 'url(#smokeG)');
    this.layers[layer].appendChild(el);
    this.smoke.push({ el, x, y, life: 0, ...o });
  },

  breakAcc: 0,
  emitBreakSparks(dt) {
    if (typeof state === 'undefined' || !state) return;
    const down = Object.keys(L.spark).filter(k => state.stations[k] && state.stations[k].downH > 0);
    if (!down.length) return;
    this.breakAcc += dt * 14;
    while (this.breakAcc >= 1) {
      this.breakAcc -= 1;
      const p = L.spark[down[Math.floor(Math.random() * down.length)]];
      const el = document.createElementNS(SVGNS, 'circle');
      el.setAttribute('r', 1.6 + Math.random() * 2.2);
      el.setAttribute('fill', Math.random() < 0.4 ? '#fff2b0' : '#ff9a3c');
      el.setAttribute('cx', p.x); el.setAttribute('cy', p.y);
      this.layers.spark.appendChild(el);
      this.sparks.push({ el, x: p.x, y: p.y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.2, life: 0 });
    }
  },

  /* =====================================================================
     ฉากนิ่ง
     ===================================================================== */
  scenery() {
    const root = document.getElementById('scenery');
    const lights = document.getElementById('nightLights');
    if (!root || root.childNodes.length) return;
    let seed = 20260905;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const el = (tag, attrs, parent) => {
      const e = document.createElementNS(SVGNS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      (parent || root).appendChild(e); return e;
    };

    /* ---- gradients ---- */
    const defs = el('defs', {});
    const lg = (id, stops, x2 = 1, y2 = 0) => { const g = el('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, defs); stops.forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, g)); };
    const rg = (id, stops, cx = '.36', cy = '.3') => { const g = el('radialGradient', { id, cx, cy }, defs); stops.forEach(([o, c, op]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': op === undefined ? 1 : op }, g)); };
    lg('wSteel', [[0, '#fdfefe'], [.28, '#dee6ec'], [.68, '#a6b2bb'], [1, '#7c888f']]);
    lg('wWarm', [[0, '#fff8e8'], [.3, '#eedcb6'], [.72, '#bd9f6d'], [1, '#8e7448']]);
    lg('wDark', [[0, '#94a0aa'], [.4, '#74818b'], [1, '#4d5860']]);
    lg('wBrick', [[0, '#f6e3cd'], [.4, '#e0bf9c'], [1, '#a9835d']]);
    rg('tTop', [[0, '#ffffff'], [.5, '#e6edf2'], [1, '#a9b4bc']]);
    rg('tTopWarm', [[0, '#fffaf0'], [.5, '#f2dfbd'], [1, '#b89a6c']]);
    rg('gLamp', [[0, '#ffe9ae', 1], [.45, '#ffd677', .45], [1, '#ffc94d', 0]], '.5', '.5');
    rg('gBag', [[0, '#ffffff'], [.6, '#f4efe2'], [1, '#d8cdb4']]);

    const ROOFS = {
      steel: ['#e7eef3', '#b2bec6', '#8b969e'], teal: ['#8ad2ce', '#529f9c', '#3d7c79'],
      slate: ['#9db2c6', '#68829a', '#4d6478'], blue: ['#98c4e4', '#5a8fb5', '#43708f'],
      rust: ['#e7b27c', '#b47f4d', '#8d5f37'], green: ['#a8d277', '#74a648', '#578034'],
      red: ['#e99586', '#b86355', '#8f483d'], brick: ['#e8b48c', '#bb7f57', '#8f5c3b'],
    };
    const SX = 13, SY = 9;
    const box = (x, yb, w, d, H, roof = 'steel', opt = {}) => {
      const [rl, rm, rd] = ROOFS[roof] || ROOFS.steel;
      const g = el('g', { filter: 'url(#fShadow)' });
      const top = yb - H;
      el('path', { d: `M${x + w} ${top} l${SX} ${-SY} v${H} l${-SX} ${SY} z`, fill: 'url(#wDark)', opacity: .95 }, g);
      el('rect', { x, y: top, width: w, height: H, fill: opt.wall || 'url(#wSteel)', stroke: '#69747c', 'stroke-width': 2 }, g);
      for (let i = 1; i * 13 < w; i++) el('line', { x1: x + i * 13, y1: top + 2, x2: x + i * 13, y2: yb - 2, stroke: '#8d98a1', 'stroke-width': 1, opacity: .35 }, g);
      el('rect', { x, y: yb - H * 0.22, width: w, height: H * 0.1, fill: rm, opacity: .55 }, g);
      el('path', { d: `M${x} ${top} l${SX} ${-SY} h${w} l${-SX} ${SY} z`, fill: rl, opacity: .95 }, g);
      el('rect', { x, y: top - d, width: w, height: d, rx: 3, fill: rm, stroke: rd, 'stroke-width': 2 }, g);
      el('rect', { x: x + 4, y: top - d + 4, width: w - 8, height: Math.max(4, d * 0.34), rx: 2, fill: rl, opacity: .9 }, g);
      for (let i = 1; i * 24 < w; i++) el('line', { x1: x + i * 24, y1: top - d + 2, x2: x + i * 24, y2: top - 2, stroke: rd, 'stroke-width': 1.3, opacity: .4 }, g);
      el('rect', { x: x + w * 0.12, y: top - d - 5, width: w * 0.76, height: 7, rx: 3, fill: rd, opacity: .8 }, g);
      for (let i = 0; i < Math.max(1, Math.floor(w / 70)); i++) el('rect', { x: x + 18 + i * 70, y: top - d - 12, width: 22, height: 8, rx: 2, fill: '#98a4ad', stroke: rd, 'stroke-width': 1 }, g);
      if (opt.doors !== false) {
        const n = Math.max(1, Math.floor(w / 58)), ww = Math.min(30, (w - 28) / n - 6);
        for (let i = 0; i < n; i++) {
          const bx = x + 14 + i * (w - 24) / n, by = top + H * 0.3, hh = H * 0.46;
          el('rect', { x: bx, y: by, width: ww, height: hh, rx: 2, fill: opt.win || '#5f7d94', opacity: .8 }, g);
          el('rect', { x: bx, y: by, width: ww, height: hh * 0.4, rx: 2, fill: '#dff0fb', opacity: .28 }, g);
          if (lights) el('rect', { x: bx, y: by, width: ww, height: hh, rx: 2, fill: '#ffd98a' }, lights);
        }
      }
      if (opt.label) {
        el('rect', { x: x + w / 2 - opt.label.length * 4.2 - 8, y: top + 6, width: opt.label.length * 8.4 + 16, height: 16, rx: 4, fill: '#1d2731', opacity: .75 }, g);
        el('text', { x: x + w / 2, y: top + 18, 'text-anchor': 'middle', 'font-family': 'Kanit, sans-serif', 'font-size': 11, fill: '#fff' }, g).textContent = opt.label;
      }
      el('rect', { x: x - 2, y: yb - 5, width: w + 4, height: 6, rx: 2, fill: '#5d6870', opacity: .55 }, g);
      return g;
    };
    const tank = (cx, cyb, r, H, warm) => {
      const g = el('g', { filter: 'url(#fShadowSm)' });
      el('ellipse', { cx: cx + 6, cy: cyb + 4, rx: r * 1.1, ry: r * 0.42, fill: '#0d2030', opacity: .3 }, g);
      el('rect', { x: cx - r, y: cyb - H, width: r * 2, height: H, fill: warm ? 'url(#wWarm)' : 'url(#wSteel)' }, g);
      el('ellipse', { cx, cy: cyb, rx: r, ry: r * 0.34, fill: warm ? '#a98b5c' : '#8b969f' }, g);
      for (let i = 1; i <= 2; i++) el('rect', { x: cx - r, y: cyb - H * i / 3, width: r * 2, height: 4, fill: '#000', opacity: .12 }, g);
      el('rect', { x: cx + r - 4, y: cyb - H, width: 3, height: H, fill: '#6f7c86', opacity: .8 }, g);
      for (let y = cyb - H + 6; y < cyb - 4; y += 9) el('line', { x1: cx + r - 7, y1: y, x2: cx + r - 1, y2: y, stroke: '#6f7c86', 'stroke-width': 1.4, opacity: .7 }, g);
      el('ellipse', { cx, cy: cyb - H, rx: r, ry: r * 0.36, fill: warm ? 'url(#tTopWarm)' : 'url(#tTop)', stroke: warm ? '#8a7550' : '#7d8790', 'stroke-width': 2 }, g);
      el('ellipse', { cx, cy: cyb - H, rx: r * 0.34, ry: r * 0.12, fill: warm ? '#c9b48a' : '#b7c1c9' }, g);
      return g;
    };
    const stack = (cx, cyb, r, H) => {
      const g = el('g', { filter: 'url(#fShadowSm)' });
      el('ellipse', { cx: cx + 5, cy: cyb + 2, rx: r * 1.3, ry: r * 0.5, fill: '#0d2030', opacity: .32 }, g);
      el('rect', { x: cx - r, y: cyb - H, width: r * 2, height: H, fill: 'url(#wSteel)' }, g);
      for (let i = 0; i < 4; i++) el('rect', { x: cx - r, y: cyb - H + 10 + i * (H / 4.6), width: r * 2, height: H / 12, fill: '#c0392b', opacity: .92 }, g);
      el('ellipse', { cx, cy: cyb - H, rx: r, ry: r * 0.42, fill: '#4f5a63', stroke: '#39424a', 'stroke-width': 2 }, g);
      return g;
    };
    /* รางเย็นแนวนอน (C-crystallizer) */
    const drum = (x, y, w, h) => {
      const g = el('g', { filter: 'url(#fShadowSm)' });
      el('rect', { x, y, width: w, height: h, rx: h / 2, fill: 'url(#wWarm)', stroke: '#8a7550', 'stroke-width': 2 }, g);
      for (let i = 1; i < 5; i++) el('line', { x1: x + i * w / 5, y1: y + 2, x2: x + i * w / 5, y2: y + h - 2, stroke: '#8a7550', 'stroke-width': 1.5, opacity: .5 }, g);
      el('rect', { x: x + 6, y: y + h, width: 6, height: 12, fill: '#6f7c86' }, g); el('rect', { x: x + w - 12, y: y + h, width: 6, height: 12, fill: '#6f7c86' }, g);
      return g;
    };

    /* ================= ผังโรงงาน v2.0 : 18 แผนก =================
       ซ้าย: ไร่อ้อย → เก็บเกี่ยว → ลานอ้อย
       กลาง: ลูกหีบ → ทำใส → หม้อต้ม → หม้อเคี่ยว
       ล่างกลาง: หม้อปั่น → บรรจุ → คลัง
       บน: หม้อไอน้ำ + โรงไฟฟ้า · ล่างสุด: อาคารทีมสนับสนุน */

    /* --- 11 หม้อไอน้ำ + 12 โรงไฟฟ้า (แถวบน) --- */
    box(520, 340, 240, 130, 58, 'red', { win: '#77909f', label: 'หม้อไอน้ำ' });
    stack(566, 296, 13, 168); stack(700, 292, 15, 176);
    box(830, 330, 190, 110, 48, 'steel', { label: 'โรงไฟฟ้า' });
    /* กองชานอ้อยข้างหม้อไอน้ำ */
    (() => {
      const px = 428, py = 352, gp = el('g', { filter: 'url(#fShadow)' });
      el('ellipse', { cx: px, cy: py, rx: 74, ry: 19, fill: '#7c5620', opacity: .45 }, gp);
      el('path', { d: `M${px - 70} ${py} q8 -42 32 -54 q21 -10 44 -2 q29 14 36 56 z`, fill: 'url(#gPile)' }, gp);
      el('path', { d: `M${px - 42} ${py - 6} q10 -32 32 -42 q17 -8 30 4 q-28 10 -62 38 z`, fill: '#e8bd78', opacity: .55 }, gp);
      el('ellipse', { cx: px, cy: py, rx: 70, ry: 15, fill: '#c49a58', opacity: .8 }, gp);
    })();
    /* เสาส่งไฟฟ้าออกจากโรงไฟฟ้า */
    [[1090, 250], [1230, 232]].forEach(([x, y]) => {
      el('path', { d: `M${x} ${y} l-22 72 M${x} ${y} l22 72 M${x - 16} ${y + 33} h32 M${x - 9} ${y + 55} h18 M${x - 19} ${y + 61} l38 -28 M${x - 19} ${y + 33} l38 28 M${x - 27} ${y + 11} h54`, stroke: '#78838c', 'stroke-width': 4.2, fill: 'none' });
    });
    el('path', { d: 'M1020 300 C 1050 276, 1068 262, 1090 254 M1068 252 C 1130 268, 1160 244, 1196 236', stroke: '#6d777f', 'stroke-width': 2.4, fill: 'none', opacity: .6 });

    /* --- หอเก็บน้ำ --- */
    (() => {
      const g = el('g', { filter: 'url(#fShadowSm)' }), cx = 790, cy = 452;
      el('path', { d: `M${cx - 19} ${cy + 70} L${cx - 8} ${cy} M${cx + 19} ${cy + 70} L${cx + 8} ${cy} M${cx - 14} ${cy + 37} h28 M${cx - 17} ${cy + 56} h34`, stroke: '#7c888f', 'stroke-width': 5, fill: 'none' }, g);
      el('ellipse', { cx, cy, rx: 28, ry: 11, fill: '#b9c4cb' }, g);
      el('rect', { x: cx - 28, y: cy - 24, width: 56, height: 24, fill: 'url(#wSteel)' }, g);
      el('ellipse', { cx, cy: cy - 24, rx: 28, ry: 11, fill: 'url(#tTop)', stroke: '#7d8790', 'stroke-width': 2 }, g);
      el('path', { d: `M${cx - 28} ${cy - 24} q28 -20 56 0`, fill: '#5a8fb5', stroke: '#43708f', 'stroke-width': 2 }, g);
    })();

    /* --- 1 ไร่อ้อย / ทีมส่งเสริม (ซ้ายล่าง) --- */
    box(48, 880, 152, 76, 30, 'brick', { win: '#8fb6cf', label: 'ส่งเสริมชาวไร่' });
    /* แปลงอ้อยสาธิตหน้าอาคาร */
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const x = 34 + c * 28, y = 984 + r * 16;
      el('path', { d: `M${x} ${y} l3 -20 M${x + 3} ${y - 20} q-9 -7 -16 -3 M${x + 3} ${y - 20} q9 -8 17 -4`, stroke: '#7fd158', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' });
    }

    /* --- 2 ทีมเก็บเกี่ยวและขนส่ง (ซ้ายล่าง ถัดจากทีม 1) --- */
    box(256, 880, 160, 74, 28, 'steel', { label: 'เก็บเกี่ยว-ขนส่ง' });
    /* รถตัดอ้อยจอด */
    [[250, 972], [334, 978]].forEach(([x, y]) => {
      const g = el('g', { filter: 'url(#fShadowSm)' });
      el('rect', { x, y: y - 18, width: 46, height: 16, rx: 4, fill: '#d98324' }, g);
      el('rect', { x: x + 30, y: y - 30, width: 16, height: 14, rx: 3, fill: '#cfe3f2', opacity: .9 }, g);
      el('circle', { cx: x + 10, cy: y + 1, r: 6, fill: '#242628' }, g);
      el('circle', { cx: x + 38, cy: y + 1, r: 6, fill: '#242628' }, g);
    });

    /* --- 3 ลานอ้อย (ซ้ายล่าง) --- */
    el('rect', { x: 56, y: 524, width: 300, height: 190, rx: 8, fill: '#8b8378', opacity: .55 });
    box(60, 712, 118, 56, 24, 'blue', { doors: false, label: 'ชั่งน้ำหนัก' });
    /* กองอ้อยในลาน */
    const piles = [[74, 560], [172, 556], [258, 564], [86, 604], [184, 608], [70, 648], [168, 652], [92, 694], [192, 698]];
    piles.forEach(([x, y], i) => {
      const w = 80 + (i % 3) * 10, h = 17, g = el('g', { filter: 'url(#fShadowSm)' });
      el('rect', { x, y: y - h, width: w, height: h, rx: 4, fill: '#6d9a30' }, g);
      el('rect', { x, y: y - h - 11, width: w, height: 13, rx: 5, fill: '#8fbf46', stroke: '#6d9a30', 'stroke-width': 1.5 }, g);
      for (let k = 1; k * 9 < w; k++) el('line', { x1: x + k * 9, y1: y - h - 11, x2: x + k * 9, y2: y - h + 2, stroke: '#79a637', 'stroke-width': 1.2, opacity: .8 }, g);
    });

    /* --- 4 ลูกหีบ --- */
    box(430, 530, 190, 108, 50, 'slate', { label: 'ลูกหีบ' });
    /* --- 5 ทำใส --- */
    tank(690, 520, 30, 44); tank(752, 520, 26, 38);
    /* --- 6 หม้อต้มระเหย --- */
    L.evapTops.forEach(([x]) => tank(x, 520, 21, 72));
    /* --- 7 หม้อเคี่ยว --- */
    L.panTops.forEach(([x, y], i) => tank(x, [524, 532, 518][i], [32, 29, 27][i], [56, 50, 44][i], true));

    /* ป้ายชื่อบนพื้นหน้าอุปกรณ์ */
    const floorLabel = (x, y, txt) => {
      el('rect', { x: x - txt.length * 4.2 - 8, y: y - 10, width: txt.length * 8.4 + 16, height: 16, rx: 4, fill: '#1d2731', opacity: .7 });
      el('text', { x, y: y + 2, 'text-anchor': 'middle', 'font-family': 'Kanit, sans-serif', 'font-size': 11, fill: '#fff' }).textContent = txt;
    };
    floorLabel(722, 542, 'ทำใส'); floorLabel(935, 542, 'หม้อต้มระเหย'); floorLabel(1175, 552, 'หม้อเคี่ยว A-B-C');

    /* --- 8 หม้อปั่นแยก + รางเย็น --- */
    box(880, 750, 220, 100, 44, 'green', { label: 'หม้อปั่นแยก' });
    drum(890, 676, 190, 24); drum(910, 712, 170, 22);
    floorLabel(985, 742, 'รางเย็น C');

    /* --- ถังกากน้ำตาล (ข้างหม้อปั่น) --- */
    tank(1150, 600, 22, 44, true); tank(1196, 606, 20, 38, true);
    floorLabel(1173, 622, 'ถังกากน้ำตาล');

    /* --- 9 บรรจุ --- */
    box(1140, 750, 120, 62, 28, 'steel', { label: 'บรรจุ' });
    /* --- 10 คลังและส่งมอบ --- */
    box(1300, 790, 220, 130, 56, 'blue', { label: 'คลังน้ำตาล' });

    /* --- อาคารทีมสนับสนุน (แถวล่าง) --- */
    box(430, 950, 130, 66, 28, 'steel', { label: 'ซ่อมบำรุง' });
    box(600, 950, 120, 66, 28, 'red', { label: 'ฉุกเฉิน' });
    box(760, 950, 120, 66, 28, 'brick', { win: '#a9d3ef', label: 'บุคคล' });
    box(920, 950, 120, 66, 28, 'blue', { win: '#cfe3f2', label: 'ห้องแล็บ' });
    box(1080, 950, 160, 66, 28, 'rust', { win: '#a9d3ef', wall: 'url(#wBrick)', label: 'สำนักงานขาย' });

    /* สายพานลำเลียง */
    const belt = (x1, y1, x2, y2) => {
      const g = el('g', { filter: 'url(#fShadowSm)' });
      const ang = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
      const gg = el('g', { transform: `translate(${x1} ${y1}) rotate(${ang * 180 / Math.PI})` }, g);
      for (let i = 22; i < len; i += 46) el('path', { d: `M${i} 8 l-6 34 M${i} 8 l6 34`, stroke: '#7c888f', 'stroke-width': 4, fill: 'none' }, gg);
      el('rect', { x: 0, y: -8, width: len, height: 18, rx: 4, fill: '#9aa6ae', stroke: '#6f7c86', 'stroke-width': 2 }, gg);
      el('rect', { x: 0, y: -6, width: len, height: 7, rx: 3, fill: '#4e5a63' }, gg);
    };
    belt(356, 606, 430, 578);        // ลานอ้อย -> ลูกหีบ
    belt(500, 490, 452, 372);        // ลูกหีบ -> กองชานอ้อย
    belt(1100, 732, 1178, 748);      // หม้อปั่น -> บรรจุ
    belt(1260, 790, 1330, 800);      // บรรจุ -> คลัง

    /* ขาตั้งท่อ */
    [[648, 552], [800, 556], [1096, 556], [1120, 646], [1128, 700], [1256, 760], [502, 396], [534, 358]].forEach(([x, y]) => {
      el('rect', { x: x - 2.5, y, width: 5, height: 16, rx: 2, fill: '#6f7c86', opacity: .9 });
      el('rect', { x: x - 6, y: y + 15, width: 12, height: 3, rx: 1.5, fill: '#5d6870', opacity: .7 });
    });

    /* รั้ว */
    const fence = pts => {
      el('polyline', { points: pts, fill: 'none', stroke: '#9aa6ae', 'stroke-width': 3, opacity: .85 });
      const arr = pts.split(' ').map(p => p.split(',').map(Number));
      for (let i = 0; i < arr.length - 1; i++) {
        const [ax, ay] = arr[i], [bx, by] = arr[i + 1], n = Math.floor(Math.hypot(bx - ax, by - ay) / 34);
        for (let k = 0; k <= n; k++) { const t = k / Math.max(1, n); el('rect', { x: ax + (bx - ax) * t - 1.5, y: ay + (by - ay) * t - 12, width: 3, height: 14, fill: '#8d99a1', opacity: .9 }); }
      }
    };
    fence('398,300 1500,264 1520,878'); fence('44,150 44,760 372,772');

    /* เสาไฟ */
    [[420, 420], [660, 412], [900, 400], [1150, 392], [1380, 384], [420, 800], [700, 812], [980, 824], [1280, 840], [250, 748]].forEach(([x, y]) => {
      el('rect', { x: x - 2, y: y - 46, width: 4, height: 48, fill: '#7c888f' });
      el('path', { d: `M${x} ${y - 46} q10 -6 16 2`, stroke: '#7c888f', 'stroke-width': 3.5, fill: 'none' });
      el('ellipse', { cx: x + 17, cy: y - 43, rx: 5, ry: 3, fill: '#c9d3da' });
      if (lights) { el('circle', { cx: x + 17, cy: y - 42, r: 26, fill: 'url(#gLamp)' }, lights); el('ellipse', { cx: x + 17, cy: y - 42, rx: 4, ry: 2.6, fill: '#fff6d2' }, lights); }
    });

    /* กระสอบน้ำตาล / ตู้คอนเทนเนอร์ / รถจอด */
    const bagStack = (x, y, cols, rows) => {
      const g = el('g', { filter: 'url(#fShadowSm)' });
      el('rect', { x: x - 4, y: y + 2, width: cols * 15 + 8, height: 5, rx: 2, fill: '#8a6a3d' }, g);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
        el('rect', { x: x + c * 15 + (r % 2 ? 3 : 0), y: y - (r + 1) * 11, width: 14, height: 10, rx: 3, fill: 'url(#gBag)', stroke: '#c2b79b', 'stroke-width': .8 }, g);
    };
    bagStack(1316, 812, 4, 4); bagStack(1390, 820, 5, 3); bagStack(1462, 828, 3, 4); bagStack(1150, 812, 3, 3);
    [[1310, 942, '#c0522e'], [1382, 952, '#2f6fa8'], [1454, 962, '#4d8a4a']].forEach(([x, y, c]) => {
      const g = el('g', { filter: 'url(#fShadowSm)' });
      el('path', { d: `M${x + 62} ${y - 26} l10 -7 v26 l-10 7 z`, fill: c, opacity: .7 }, g);
      el('rect', { x, y: y - 26, width: 62, height: 26, rx: 2, fill: c, stroke: '#00000033', 'stroke-width': 2 }, g);
      el('path', { d: `M${x} ${y - 26} l10 -7 h62 l-10 7 z`, fill: '#ffffff', opacity: .25 }, g);
      for (let i = 1; i < 8; i++) el('line', { x1: x + i * 7.5, y1: y - 24, x2: x + i * 7.5, y2: y - 2, stroke: '#00000022', 'stroke-width': 1.6 }, g);
    });
    [[96, 742, '#truckSprite'], [190, 748, '#truckSprite'], [278, 752, '#truckSprite'], [1336, 856, '#sugarTruck']].forEach(([x, y, sp]) => el('use', { href: sp, transform: `translate(${x} ${y}) scale(1.05)` }));
    [[1256, 1000, '#d64545'], [1290, 1006, '#2f6fa8'], [1324, 1012, '#eceff1'], [1358, 1016, '#3f8f4f']].forEach(([x, y, c]) => {
      const g = el('g', { filter: 'url(#fShadowSm)' });
      el('rect', { x: x - 15, y: y - 9, width: 30, height: 12, rx: 5, fill: c }, g);
      el('path', { d: `M${x - 9} ${y - 9} q3 -8 9 -8 h4 q5 0 7 8 z`, fill: '#cfe3f2', opacity: .9 }, g);
      el('circle', { cx: x - 8, cy: y + 4, r: 3.4, fill: '#242628' }, g); el('circle', { cx: x + 8, cy: y + 4, r: 3.4, fill: '#242628' }, g);
    });

    /* =================================================================
       รายละเอียดโรงงานให้แน่นและสมจริงขึ้น: ท่อ · ถังเคมี · พาเลท · วาล์ว ·
       ตู้ไฟ · หัวดับเพลิง · ฝาท่อ · กรวยจราจร · คราบน้ำมัน · พุ่มไม้ · หญ้า
       (วางบนพื้นคอนกรีตช่องว่างระหว่างสถานี — ไม่แตะเรขาคณิตเดิม)
       ================================================================= */
    const shSm = { filter: 'url(#fShadowSm)' };
    /* ท่อลอยบนขาตั้ง (pipe rack) */
    const pipeRack = (x1, y1, x2, y2, cols = ['#b7c1c8', '#9aa6ae', '#d4a04a']) => {
      const g = el('g', shSm);
      const ang = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
      const gg = el('g', { transform: `translate(${x1} ${y1}) rotate(${ang * 180 / Math.PI})` }, g);
      for (let i = 16; i < len - 6; i += 40) { el('rect', { x: i - 2, y: -2, width: 4, height: 20, fill: '#5d6870' }, gg); el('rect', { x: i - 7, y: 16, width: 14, height: 4, rx: 1.5, fill: '#4e5a63' }, gg); }
      cols.forEach((c, k) => el('rect', { x: 0, y: -6 - k * 6, width: len, height: 5, rx: 2.5, fill: c, stroke: '#00000022', 'stroke-width': .8 }, gg));
      return g;
    };
    /* ถังเคมี/น้ำมัน (barrel) */
    const barrel = (x, y, c = '#d8a83c') => { const g = el('g', shSm); el('ellipse', { cx: x, cy: y + 12, rx: 9, ry: 3, fill: '#0d2030', opacity: .28 }, g); el('rect', { x: x - 8, y: y - 12, width: 16, height: 24, rx: 3, fill: c }, g); el('rect', { x: x - 8, y: y - 12, width: 6, height: 24, rx: 3, fill: '#ffffff', opacity: .18 }, g); el('ellipse', { cx: x, cy: y - 12, rx: 8, ry: 2.6, fill: c, stroke: '#00000030', 'stroke-width': 1 }, g); for (const yy of [y - 4, y + 4]) el('line', { x1: x - 8, y1: yy, x2: x + 8, y2: yy, stroke: '#00000030', 'stroke-width': 1.4 }, g); return g; };
    const barrelCluster = (x, y, c) => { barrel(x, y, c); barrel(x + 17, y + 3, c); barrel(x + 8, y - 12, c); };
    /* พาเลทกระสอบ */
    const pallet = (x, y, c = 'url(#gBag)') => { const g = el('g', shSm); el('rect', { x: x - 2, y: y + 8, width: 40, height: 5, rx: 1.5, fill: '#8a6a3d' }, g); for (let r = 0; r < 2; r++) for (let cc = 0; cc < 3; cc++) el('rect', { x: x + cc * 12 + (r % 2 ? 3 : 0), y: y - r * 9, width: 11, height: 8, rx: 2, fill: c, stroke: '#c2b79b', 'stroke-width': .7 }, g); return g; };
    /* ลังไม้ */
    const crate = (x, y, s = 20, c = '#c69b5e') => { const g = el('g', shSm); el('rect', { x, y, width: s, height: s, rx: 2, fill: c, stroke: '#8a6a3d', 'stroke-width': 1.5 }, g); el('path', { d: `M${x} ${y} l${s} ${s} M${x + s} ${y} l${-s} ${s}`, stroke: '#8a6a3d', 'stroke-width': 1.2, opacity: .6 }, g); return g; };
    /* วาล์ว/มือหมุน บนท่อ */
    const valve = (x, y) => { const g = el('g', shSm); el('rect', { x: x - 2, y, width: 4, height: 12, fill: '#6f7c86' }, g); el('circle', { cx: x, cy: y - 3, r: 6, fill: 'none', stroke: '#c0392b', 'stroke-width': 2.6 }, g); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; el('line', { x1: x, y1: y - 3, x2: x + Math.cos(a) * 6, y2: y - 3 + Math.sin(a) * 6, stroke: '#c0392b', 'stroke-width': 2 }, g); } return g; };
    /* ตู้ไฟ/ตู้ควบคุม */
    const ebox = (x, y) => { const g = el('g', shSm); el('rect', { x, y, width: 18, height: 24, rx: 2, fill: '#d9b23c', stroke: '#8a6f1e', 'stroke-width': 1.5 }, g); el('rect', { x: x + 3, y: y + 3, width: 12, height: 9, rx: 1, fill: '#3a3f47' }, g); el('rect', { x: x + 4, y: y + 16, width: 10, height: 3, fill: '#8a6f1e' }, g); return g; };
    /* หัวดับเพลิง */
    const hydrant = (x, y) => { const g = el('g', shSm); el('rect', { x: x - 3, y: y - 10, width: 6, height: 12, rx: 2, fill: '#d64545' }, g); el('circle', { cx: x, cy: y - 12, r: 4, fill: '#e05a5a' }, g); el('rect', { x: x - 6, y: y - 8, width: 12, height: 3, rx: 1.5, fill: '#b83636' }, g); el('rect', { x: x - 5, y: y + 2, width: 10, height: 3, rx: 1, fill: '#8f2d2d' }, g); return g; };
    /* ฝาท่อระบายน้ำ */
    const grate = (x, y) => { const g = el('g', {}); el('rect', { x: x - 9, y: y - 6, width: 18, height: 12, rx: 2, fill: '#5c666e', stroke: '#3f474d', 'stroke-width': 1 }, g); for (let k = 1; k < 5; k++) el('line', { x1: x - 9 + k * 3.6, y1: y - 6, x2: x - 9 + k * 3.6, y2: y + 6, stroke: '#3a4147', 'stroke-width': 1 }, g); return g; };
    /* กรวยจราจร */
    const cone = (x, y) => { const g = el('g', shSm); el('ellipse', { cx: x, cy: y + 2, rx: 7, ry: 2.4, fill: '#0d2030', opacity: .25 }, g); el('path', { d: `M${x} ${y - 14} L${x + 6} ${y + 2} L${x - 6} ${y + 2} Z`, fill: '#f2792b' }, g); el('rect', { x: x - 4.5, y: y - 6, width: 9, height: 3, fill: '#fff', opacity: .85 }, g); return g; };
    /* คราบน้ำมัน */
    const stain = (x, y, r = 16) => el('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.5, fill: '#2a2f36', opacity: .12 });
    /* พุ่มไม้ */
    const bush = (x, y, s = 1) => { const g = el('g', shSm); el('ellipse', { cx: x + 4, cy: y + 4 * s, rx: 16 * s, ry: 6 * s, fill: '#245018', opacity: .3 }, g); [[0, 0, 11], [-9, 2, 8], [9, 1, 8], [0, -6, 8]].forEach(([dx, dy, r]) => el('circle', { cx: x + dx * s, cy: y + dy * s, r: r * s, fill: 'url(#gTree)' }, g)); el('circle', { cx: x - 4 * s, cy: y - 6 * s, r: 4 * s, fill: '#93e06a', opacity: .4 }, g); return g; };
    /* กอหญ้า */
    const grass = (x, y) => { const g = el('g', {}); for (let k = -2; k <= 2; k++) el('path', { d: `M${x + k * 3} ${y} q${k} -8 ${k * 1.5} -13`, stroke: '#6ca63a', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }, g); return g; };

    /* ---- ท่อเชื่อมสถานี (เหนือถนนวงใน) ---- */
    pipeRack(636, 470, 660, 480);          // ลูกหีบ → ทำใส
    pipeRack(792, 476, 838, 478);          // ทำใส → หม้อต้ม
    pipeRack(1072, 480, 1090, 486);        // หม้อต้ม → หม้อเคี่ยว
    pipeRack(1176, 548, 1090, 640);        // หม้อเคี่ยว → หม้อปั่น
    pipeRack(1100, 700, 1140, 712);        // หม้อปั่น → บรรจุ
    pipeRack(640, 342, 636, 420);          // หม้อไอน้ำ → ลูกหีบ (ไอน้ำ)
    pipeRack(1218, 580, 1128, 582, ['#caa96e', '#a8895c']); // ปั่น → ถังโมลาส

    /* ---- พร็อพบนพื้นคอนกรีตในช่องว่าง ---- */
    barrelCluster(690, 400, '#3f8f4f'); barrelCluster(940, 392, '#d8a83c'); barrelCluster(1150, 700, '#4d7db5');
    pallet(700, 620); pallet(760, 626); pallet(980, 632, '#e6d2a8');
    crate(560, 632, 22, '#c69b5e'); crate(586, 640, 16, '#b98a4e'); crate(1290, 620, 20, '#a9c0d0');
    valve(672, 552); valve(824, 548); valve(1108, 556); valve(1150, 648);
    ebox(468, 470); ebox(1310, 470); ebox(806, 340); ebox(700, 640);
    hydrant(430, 500); hydrant(1300, 640); hydrant(880, 760); hydrant(410, 878);
    [[520, 460], [900, 470], [1120, 620], [640, 800], [1000, 810], [1300, 700], [500, 560]].forEach(([x, y]) => grate(x, y));
    [[500, 636], [1284, 604], [908, 640], [1150, 676], [420, 862]].forEach(([x, y]) => cone(x, y));
    [[540, 470], [960, 470], [1120, 700], [700, 800], [1280, 700], [640, 560]].forEach(([x, y]) => stain(x, y, 14 + rand() * 10));
    /* กระสอบน้ำตาลเพิ่มหน้าคลัง */
    pallet(1300, 620, 'url(#gBag)'); pallet(1352, 628, 'url(#gBag)'); crate(1420, 640, 22, '#c9b48a');

    /* ---- รถ/โฟล์คลิฟต์จอดเพิ่ม ---- */
    [[708, 806, '#truckSprite'], [1258, 806, '#sugarTruck'], [332, 760, '#truckSprite'], [1440, 900, '#tankerTruck'], [430, 300, '#tankerTruck']].forEach(([x, y, sp]) => el('use', { href: sp, transform: `translate(${x} ${y}) scale(1)` }));

    /* ---- พุ่มไม้/หญ้ารอบขอบโรงงาน ---- */
    [[400, 300], [1512, 262], [1516, 660], [388, 820], [408, 480], [1360, 560], [1360, 470]].forEach(([x, y]) => bush(x + rand() * 20 - 10, y, 0.8 + rand() * 0.5));
    for (let i = 0; i < 40; i++) { const x = rand() * 1536, y = 120 + rand() * 900; if (x > 400 && x < 1510 && y > 300 && y < 990) continue; if (Math.abs(y - (1004 - (x + 40) * 0.145)) < 70) continue; grass(x, y); }

    /* ---- รายละเอียดบนหลังคา (ท่อระบาย/แอร์) ของอาคารหลัก ---- */
    const roofProp = (x, y, w) => { const g = el('g', shSm); el('rect', { x, y, width: w, height: 12, rx: 2, fill: '#9aa6ae', stroke: '#6f7c86', 'stroke-width': 1 }, g); for (let k = 0; k < 3; k++) el('rect', { x: x + 3 + k * (w - 6) / 3, y: y + 2, width: (w - 6) / 3 - 3, height: 8, fill: '#5d6870' }, g); el('rect', { x: x + w + 3, y: y - 6, width: 5, height: 18, rx: 2, fill: '#b7c1c8' }, g); return g; };
    roofProp(486, 400, 30); roofProp(636, 232, 34); roofProp(1360, 640, 30); roofProp(940, 720, 26);

    /* ---- รายละเอียดอาคาร: ถังน้ำบนหลังคา · บันไดผนัง · แอร์ · ป้าย · ป้อมยาม ---- */
    const roofTank = (x, y, r = 12) => { const g = el('g', shSm); el('ellipse', { cx: x, cy: y + r * 1.6, rx: r * 0.9, ry: r * 0.4, fill: '#0d2030', opacity: .22 }, g); for (let k = 0; k < 4; k++) el('rect', { x: x - r + 2 + k * (r * 2 - 4) / 3, y: y + r * 0.5, width: 2, height: r * 1.1, fill: '#7c868e' }, g); el('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.55, fill: '#b9c2c9' }, g); el('rect', { x: x - r, y: y, width: r * 2, height: r * 0.9, fill: '#9aa4ac' }, g); el('ellipse', { cx: x, cy: y + r * 0.9, rx: r, ry: r * 0.5, fill: '#8a949c' }, g); el('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.55, fill: 'none', stroke: '#d6dde2', 'stroke-width': 1, opacity: .5 }, g); return g; };
    const wallLadder = (x, y, h = 40) => { const g = el('g', {}); el('rect', { x: x - 5, y, width: 3, height: h, rx: 1, fill: '#8a939b' }, g); el('rect', { x: x + 2, y, width: 3, height: h, rx: 1, fill: '#8a939b' }, g); for (let k = 1; k * 7 < h; k++) el('line', { x1: x - 4, y1: y + k * 7, x2: x + 4, y2: y + k * 7, stroke: '#6f7982', 'stroke-width': 1.6 }, g); return g; };
    const acUnit = (x, y) => { const g = el('g', shSm); el('rect', { x, y, width: 22, height: 15, rx: 2, fill: '#c3cad0', stroke: '#8b949b', 'stroke-width': 1 }, g); el('circle', { cx: x + 11, cy: y + 7.5, r: 5.5, fill: 'none', stroke: '#7d868d', 'stroke-width': 1.4 }, g); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.5; el('line', { x1: x + 11, y1: y + 7.5, x2: x + 11 + Math.cos(a) * 5, y2: y + 7.5 + Math.sin(a) * 5, stroke: '#9aa2a8', 'stroke-width': 1.3 }, g); } return g; };
    const signboard = (x, y, txt, c = '#2f6fb0') => { const g = el('g', shSm); el('rect', { x: x - 1.5, y: y, width: 3, height: 26, fill: '#6f7c86' }, g); el('rect', { x: x - 26, y: y - 15, width: 52, height: 17, rx: 3, fill: c, stroke: '#ffffff', 'stroke-width': 1, 'stroke-opacity': .4 }, g); el('text', { x, y: y - 3, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 700, fill: '#ffffff', 'font-family': 'sans-serif' }, g).textContent = txt; return g; };
    const guardHouse = (x, y) => { const g = el('g', shSm); el('rect', { x, y, width: 34, height: 30, rx: 3, fill: '#e5d8bf', stroke: '#b7a583', 'stroke-width': 1.5 }, g); el('rect', { x, y: y - 8, width: 34, height: 9, rx: 2, fill: '#c0392b' }, g); el('rect', { x: x + 5, y: y + 5, width: 14, height: 13, rx: 1.5, fill: '#9fd0ef', stroke: '#7d868d', 'stroke-width': 1 }, g); el('rect', { x: x + 23, y: y + 4, width: 7, height: 22, rx: 1, fill: '#7a8590' }, g); return g; };
    roofTank(560, 320, 13); roofTank(1088, 236, 11); roofTank(880, 700, 12); roofTank(1300, 560, 10);
    wallLadder(452, 356, 44); wallLadder(1128, 300, 40); wallLadder(806, 640, 42);
    acUnit(504, 372); acUnit(1148, 262); acUnit(916, 700);
    signboard(470, 300, 'โรงหีบ', '#3a7d3a'); signboard(1090, 210, 'หม้อต้ม', '#b5651d'); signboard(360, 900, 'ทางเข้า', '#2f6fb0');
    guardHouse(300, 926);

    /* ต้นไม้ */
    const inSlab = (x, y) => x > 380 && x < 1530 && y > 250 && y < 1020;
    const onRoad = (x, y) => Math.abs(y - (1004 - (x + 40) * 0.145)) < 76;
    let placed = 0;
    for (let i = 0; i < 1100 && placed < 118; i++) {
      const x = rand() * 1536, y = 120 + rand() * 904;
      if (inSlab(x, y) || onRoad(x, y) || (x < 380 && y > 140 && y < 790)) continue;
      const r = 13 + rand() * 12, g = el('g', {});
      el('ellipse', { cx: x + 7, cy: y + r * 0.55, rx: r * 1.05, ry: r * 0.45, fill: '#25501c', opacity: .32 }, g);
      el('rect', { x: x - 2.5, y: y - 4, width: 5, height: r * 0.7, fill: '#6b4b2a' }, g);
      if (rand() < 0.22) for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; el('path', { d: `M${x} ${y - r * 0.5} q${Math.cos(a) * r * 0.9} ${Math.sin(a) * r * 0.5 - 6} ${Math.cos(a) * r * 1.5} ${Math.sin(a) * r * 0.8}`, stroke: '#3f8f3a', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, g); }
      else { el('circle', { cx: x, cy: y - r * 0.35, r, fill: 'url(#gTree)' }, g); el('circle', { cx: x - r * 0.32, cy: y - r * 0.62, r: r * 0.34, fill: '#93e06a', opacity: .42 }, g); }
      placed++;
    }
  },

  /* =====================================================================
     ของที่ขยับ — ลงทะเบียนไว้ใน anims แล้วขับใน animateScene()
     ===================================================================== */
  /* สร้างตารางตำแหน่ง (ปล่อง ไอน้ำ คนงาน โฟล์คลิฟต์ ประกายไฟ) จากอาคารที่วางจริง */
  buildLayoutFromScene() {
    const out = { stacks: [], evapTops: [], panTops: [], spark: {}, ponds: [], workers: [], forklifts: [], fans: [], lamps: [], flag: null, birdsY: 40 };
    for (const b of SCENE.buildings) {
      const p = SCENE.placed[b.key]; if (!p) continue;
      const P = (sx, sy) => p.missing ? SCENE.at(b.key, sx / 1536, sy / 1024) : SCENE.pt(b.key, sx, sy);
      (b.smoke || []).forEach(([x, y]) => { const q = P(x, y); out.stacks.push({ x: q[0], top: q[1], key: b.key }); });
      (b.steam || []).forEach(([x, y]) => { const q = P(x, y); out.evapTops.push([q[0], q[1], b.key]); });
      (b.fans || []).forEach(([x, y]) => { const q = P(x, y); out.fans.push([q[0], q[1], b.key]); });
      (b.lamps || []).forEach(([x, y]) => { const q = P(x, y); out.lamps.push([q[0], q[1]]); });
      (b.workers || []).forEach(([x, y, dx], i) => { const q = P(x, y); out.workers.push([q[0], q[1], dx * b.s * 3, 11 + i * 2, i * 1.3, ['#f4d35e', '#5cb3ff', '#e2725b', '#b7f36b', '#ffffff'][(i + b.n) % 5]]); });
      if (b.forklift) { const q = P(b.forklift[0], b.forklift[1]); out.forklifts.push([q[0], q[1], b.forklift[2] * b.s * 3, 9 + b.n, b.n * 0.7]); }
      const c = SCENE.at(b.key, 0.5, 0.55);
      if (state && state.stations[b.key]) out.spark[b.key] = { x: c[0], y: c[1] };
    }
    if (!out.stacks.length) out.stacks.push({ x: 900, top: 200 });
    if (!out.evapTops.length) out.evapTops.push([400, 600]);
    out.lake = SCENE.points.water;
    return out;
  },

  /* วาดเส้นทางของไหลระหว่างอาคาร (ท่อ) จากตำแหน่งจริง */
  routePaths() {
    const A = (k, fx, fy) => SCENE.placed[k] ? SCENE.at(k, fx, fy) : null;
    const seg = (id, a, b, bend = 0) => {
      const el = this.paths[id]; if (!el || !a || !b) return;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + bend;
      el.setAttribute('d', `M ${a[0].toFixed(0)} ${a[1].toFixed(0)} Q ${mx.toFixed(0)} ${my.toFixed(0)} ${b[0].toFixed(0)} ${b[1].toFixed(0)}`);
    };
    seg('f_cane', A('yard', 0.9, 0.55), A('mill', 0.12, 0.55), -30);
    seg('f_mill', A('mill', 0.9, 0.6), A('clar', 0.1, 0.6), -30);
    seg('f_clar', A('clar', 0.3, 0.95), A('evap', 0.75, 0.15), 40);
    seg('f_evap', A('evap', 0.9, 0.6), A('pan', 0.1, 0.6), -25);
    seg('f_pan', A('pan', 0.92, 0.6), A('fugal', 0.08, 0.6), -25);
    seg('f_cent', A('fugal', 0.9, 0.65), A('pack', 0.1, 0.65), -20);
    seg('f_pack', A('pack', 0.5, 0.9), A('pack', 0.95, 0.85), 10);
    seg('f_wh', A('pack', 0.95, 0.85), [1480, 800], 10);
    seg('f_bag', A('mill', 0.6, 0.15), A('boiler', 0.3, 0.9), -40);
    seg('f_boiler', A('boiler', 0.6, 0.9), A('boiler', 0.9, 0.5), -20);
    seg('f_steam', A('boiler', 0.9, 0.5), A('power', 0.1, 0.6), -30);
    /* วาดท่อจริงให้เห็น (เส้นเทาใต้อนุภาค) */
    let pipes = document.getElementById('fxPipes');
    if (!pipes) { pipes = document.createElementNS(SVGNS, 'g'); pipes.id = 'fxPipes'; const fx = document.getElementById('fx'); fx.insertBefore(pipes, fx.firstChild.nextSibling); }
    pipes.innerHTML = '';
    for (const id of ['f_cane', 'f_mill', 'f_clar', 'f_evap', 'f_pan', 'f_cent', 'f_bag', 'f_steam']) {
      const d = this.paths[id] && this.paths[id].getAttribute('d'); if (!d || d === 'M 0 0') continue;
      const a = document.createElementNS(SVGNS, 'path'); a.setAttribute('d', d); a.setAttribute('fill', 'none'); a.setAttribute('stroke', '#5f6b76'); a.setAttribute('stroke-width', 9); a.setAttribute('stroke-linecap', 'round'); a.setAttribute('opacity', .85); pipes.appendChild(a);
      const b = document.createElementNS(SVGNS, 'path'); b.setAttribute('d', d); b.setAttribute('fill', 'none'); b.setAttribute('stroke', '#c9d3db'); b.setAttribute('stroke-width', 4); b.setAttribute('stroke-linecap', 'round'); pipes.appendChild(b);
    }
  },

  rebuildAnim() {
    const root = document.getElementById('sceneryAnim');
    if (root) while (root.firstChild) root.removeChild(root.firstChild);
    this.anims = []; this.belts = null;
    this.sceneryAnim();
  },

  sceneryAnim() {
    const root = document.getElementById('sceneryAnim');
    if (!root || root.childNodes.length) return;
    const el = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); (parent || root).appendChild(e); return e; };
    const A = this.anims = []; this.animTime = 0;
    const svgOnly = !this.imageMode;      // ของที่ผูกกับอาคารที่วาดเอง ไม่ต้องมีเมื่อใช้ภาพต้นฉบับ

    /* สายพานวิ่ง */
    const belt = (x1, y1, x2, y2, color, sp) => {
      const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, len = Math.hypot(x2 - x1, y2 - y1);
      const g = el('g', { transform: `translate(${x1} ${y1}) rotate(${ang})` });
      const line = el('line', { x1: 2, y1: -2.5, x2: len - 2, y2: -2.5, stroke: color, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-dasharray': '10 14' }, g);
      A.push({ t: 'dash', el: line, sp, period: 24 }); return line;
    };
    if (svgOnly) this.belts = [belt(340, 452, 420, 426, '#9ccc4f', 22), belt(545, 302, 486, 252, '#d8a95e', 20), belt(1100, 672, 1200, 712, '#fff6e0', 18), belt(1190, 790, 1250, 800, '#fff6e0', 18)];

    /* พัดลมระบายอากาศบนอาคาร (จากภาพ) */
    (L.fans || []).forEach(([cx, cy, key], i) => {
      const g = el('g', {}); el('circle', { cx, cy, r: 7, fill: 'rgba(200,210,220,.35)' }, g);
      const sp = el('g', {}, g);
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2, px = cx + Math.cos(a) * 3.5, py = cy + Math.sin(a) * 3.5; el('ellipse', { cx: px, cy: py, rx: 4, ry: 1.8, fill: '#f4f8fb', opacity: .85, transform: `rotate(${a * 180 / Math.PI} ${px} ${py})` }, sp); }
      A.push({ t: 'rot', el: sp, cx, cy, sp: 500 + i * 60, station: key });
    });
    /* ไฟส่องสว่างกะพริบเล็กน้อย (โคมในลาน) */
    (L.lamps || []).forEach(([cx, cy], i) => { const b = el('circle', { cx, cy, r: 4, fill: '#fff4c2', opacity: .8 }); A.push({ t: 'blink', el: b, period: 3.5 + i * 0.4, phase: i }); });
    /* ประกายน้ำในทะเลสาบ */
    if (L.lake) for (let i = 0; i < 7; i++) { const s2 = el('ellipse', { cx: L.lake.x - 150 + i * 50, cy: L.lake.y - 20 + (i % 3) * 22, rx: 9, ry: 2.4, fill: '#ffffff', opacity: .3 }); A.push({ t: 'shimmer', el: s2, period: 2.4 + i * 0.3, phase: i * 0.6 }); }

    /* เครื่องเติมอากาศบ่อบำบัด */
    (L.ponds || []).forEach(([cx, cy], i) => {
      const g = el('g', {});
      for (let k = 0; k < 2; k++) { const w = el('ellipse', { cx, cy, rx: 8, ry: 3.5, fill: 'none', stroke: '#e6f7ff', 'stroke-width': 2 }, g); A.push({ t: 'ripple', el: w, period: 3, phase: k * 1.5 + i * 0.7, rx: [8, 46], ry: [3.5, 20] }); }
      const rot = el('g', {}, g);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, px = cx + Math.cos(a) * 16, py = cy + Math.sin(a) * 7; el('ellipse', { cx: px, cy: py, rx: 7, ry: 3.2, fill: '#f2fbff', opacity: .9, transform: `rotate(${a * 180 / Math.PI} ${px} ${py})` }, rot); }
      el('circle', { cx, cy, r: 5, fill: '#c8d6de', stroke: '#8ea6b4', 'stroke-width': 1.5 }, rot);
      A.push({ t: 'rot', el: rot, cx, cy, sp: 150 + i * 30 });
    });
    /* ล้อลูกหีบ */
    if (svgOnly) [[432, 430, 13], [608, 430, 13]].forEach(([cx, cy, r], i) => {
      const g = el('g', {});
      el('circle', { cx, cy, r, fill: '#b8c2ca', stroke: '#6f7c86', 'stroke-width': 2.5 }, g);
      const sp = el('g', {}, g);
      el('path', { d: `M${cx - r + 3} ${cy} h${2 * r - 6} M${cx} ${cy - r + 3} v${2 * r - 6}`, stroke: '#6f7c86', 'stroke-width': 2.5 }, sp);
      A.push({ t: 'rot', el: sp, cx, cy, sp: 240 + i * 40, station: 'mill' });
    });
    /* กังหันโรงไฟฟ้า */
    if (svgOnly) (() => { const cx = 945, cy = 262, g = el('g', {}); el('circle', { cx, cy, r: 17, fill: '#cfd8de', stroke: '#7c888f', 'stroke-width': 2.5 }, g); const sp = el('g', {}, g); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; el('path', { d: `M${cx} ${cy} l${Math.cos(a) * 14} ${Math.sin(a) * 14}`, stroke: '#8e99a3', 'stroke-width': 4, 'stroke-linecap': 'round' }, sp); } el('circle', { cx, cy, r: 4, fill: '#6f7c86' }, sp); A.push({ t: 'rot', el: sp, cx, cy, sp: 400, station: 'boiler' }); })();
    /* พัดลมหลังคาหม้อไอน้ำ */
    if (svgOnly) [[600, 96], [660, 92], [760, 96]].forEach(([cx, cy], i) => {
      const g = el('g', {}); el('circle', { cx, cy, r: 11, fill: '#aeb9c1', stroke: '#7c888f', 'stroke-width': 2 }, g);
      const sp = el('g', {}, g);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2, px = cx + Math.cos(a) * 5, py = cy + Math.sin(a) * 5; el('ellipse', { cx: px, cy: py, rx: 5.5, ry: 2.6, fill: '#eef4f8', transform: `rotate(${a * 180 / Math.PI} ${px} ${py})` }, sp); }
      A.push({ t: 'rot', el: sp, cx, cy, sp: 620 + i * 90, station: 'boiler' });
    });
    /* ไฟยอดปล่อง */
    L.stacks.forEach((s, i) => { const b = el('circle', { cx: s.x, cy: s.top - 4, r: 3.6, fill: '#ff5c5c' }); A.push({ t: 'blink', el: b, period: 1.8, phase: i * 0.9 }); });
    /* รางเย็น C หมุน (แถบเลื่อน) */
    if (svgOnly) [[1130, 596, 170], [1150, 636, 150]].forEach(([x, y, w], i) => {
      const l = el('line', { x1: x + 10, y1: y + 13, x2: x + w - 10, y2: y + 13, stroke: '#8a7550', 'stroke-width': 3, 'stroke-dasharray': '6 10', opacity: .6 });
      A.push({ t: 'dash', el: l, sp: 6 + i * 2, period: 16 });
    });

    /* โฟล์คลิฟต์ (คลัง/บรรจุ) */
    const forklift = (x, y, dx, period, phase) => {
      const g = el('g', { filter: 'url(#fShadowSm)' });
      el('rect', { x: -10, y: -10, width: 20, height: 16, rx: 3, fill: '#f0a830', stroke: '#b87c14', 'stroke-width': 1.5 }, g);
      el('rect', { x: -6, y: -18, width: 11, height: 9, rx: 2, fill: '#3a4750', opacity: .8 }, g);
      el('rect', { x: 8, y: -24, width: 3.5, height: 22, fill: '#8e99a3' }, g); el('rect', { x: 9, y: -8, width: 9, height: 3, fill: '#8e99a3' }, g);
      el('rect', { x: 10, y: -19, width: 12, height: 10, rx: 2, fill: 'url(#gBag)', stroke: '#c2b79b', 'stroke-width': .8 }, g);
      /* คนขับ + ไฟหมุนเตือน */
      el('circle', { cx: -2, cy: -13.5, r: 2.4, fill: '#f2c9a0' }, g);
      el('path', { d: 'M-4.3 -14.4 q2.3 -3 4.6 0 z', fill: '#ffd34d' }, g);
      el('rect', { x: -7.5, y: -13, width: 3, height: 5, rx: 1, fill: '#2f6fb0' }, g);          // พนักพิงเบาะ
      el('circle', { cx: -7, cy: -20, r: 1.5, fill: '#ff8c2b' }, g);                             // ไฟเตือน
      el('circle', { cx: -5, cy: 6, r: 3.6, fill: '#242628' }, g); el('circle', { cx: 6, cy: 6, r: 3.6, fill: '#242628' }, g);
      el('circle', { cx: -5, cy: 6, r: 1.4, fill: '#5b636b' }, g); el('circle', { cx: 6, cy: 6, r: 1.4, fill: '#5b636b' }, g);   // ดุมล้อ
      A.push({ t: 'move', el: g, x, y, dx, dy: dx * 0.12, period, phase, flip: true });
    };
    L.forklifts.forEach(f => forklift(...f));

    /* คนงาน */
    const worker = (x, y, dx, period, phase, shirt, hat) => {
      hat = hat || '#ffd34d';
      const g = el('g', {});
      const body = el('g', { transform: 'scale(1.6)' }, g);            // คนตัวใหญ่ขึ้นให้เห็นชัด
      el('ellipse', { cx: 0, cy: 8, rx: 4.8, ry: 2, fill: '#0d2030', opacity: .28 }, body);
      /* ขา + รองเท้าบูท */
      el('rect', { x: -2.6, y: 2, width: 5.2, height: 6, rx: 1.6, fill: '#37506f' }, body);
      el('rect', { x: -2.7, y: 6.6, width: 2.4, height: 2.6, rx: .7, fill: '#1c2836' }, body);
      el('rect', { x: 0.3, y: 6.6, width: 2.4, height: 2.6, rx: .7, fill: '#1c2836' }, body);
      /* แขน (สีเสื้อ) */
      el('rect', { x: -4.3, y: -5.4, width: 1.7, height: 6.2, rx: .8, fill: shirt }, body);
      el('rect', { x: 2.6, y: -5.4, width: 1.7, height: 6.2, rx: .8, fill: shirt }, body);
      el('circle', { cx: -3.45, cy: 1, r: 1, fill: '#f2c9a0' }, body); el('circle', { cx: 3.45, cy: 1, r: 1, fill: '#f2c9a0' }, body);
      /* ลำตัว + เสื้อกั๊กสะท้อนแสง (เปิดหน้าอกให้เห็นสีเสื้อ) */
      el('rect', { x: -3, y: -6, width: 6, height: 9, rx: 2, fill: shirt }, body);
      el('rect', { x: -3, y: -5.4, width: 1.7, height: 8, rx: .9, fill: '#f5c518' }, body);
      el('rect', { x: 1.3, y: -5.4, width: 1.7, height: 8, rx: .9, fill: '#f5c518' }, body);
      el('rect', { x: -3, y: -2.7, width: 6, height: 1, fill: '#eef4fa', opacity: .92 }, body);   // แถบสะท้อนแสง
      /* หัว + หมวกนิรภัย + ปีกหมวก */
      el('circle', { cx: 0, cy: -8.5, r: 3.2, fill: '#f2c9a0' }, body);
      el('rect', { x: -4.7, y: -9.4, width: 9.4, height: 1.3, rx: .6, fill: hat, opacity: .9 }, body);   // ปีกหมวก
      el('path', { d: 'M-4.2 -9.6 q4.2 -4.8 8.4 0 z', fill: hat }, body);
      el('rect', { x: -0.5, y: -12.6, width: 1, height: 1.6, fill: hat }, body);                          // สันหมวก
      A.push({ t: 'move', el: g, x, y, dx, dy: dx * 0.1, period, phase, bob: 1.6 });
    };
    /* คนงานทั่วไป + หัวหน้างานหมวกขาว (ทุก ๆ 3 คน) */
    L.workers.forEach((w, i) => worker(w[0], w[1], w[2], w[3], w[4], w[5], i % 3 === 2 ? '#eef2f5' : '#ffd34d'));

    /* ธง */
    if (L.flag) (() => { const [x, y] = L.flag, g = el('g', {}); el('rect', { x: x - 1.6, y: y - 62, width: 3.2, height: 62, fill: '#9aa6ae' }, g); const f = el('path', { d: `M${x + 2} ${y - 60} q14 5 28 0 v20 q-14 5 -28 0 z`, fill: '#d64545' }, g); A.push({ t: 'flag', el: f, x: x + 2, y: y - 60 }); })();
    /* นก */
    for (let i = 0; i < 5; i++) { const g = el('g', { opacity: .5 }); el('path', { d: 'M-9 0 q5 -5 9 0 q4 -5 9 0', stroke: '#3c4a58', 'stroke-width': 2, fill: 'none' }, g); A.push({ t: 'bird', el: g, y: L.birdsY + i * 26, period: 26 + i * 5, phase: i * 4.5 }); }
    /* ผิวน้ำ */
    if (svgOnly) for (let i = 0; i < 8; i++) { const s = el('ellipse', { cx: 1170 + i * 46, cy: 36 + (i % 3) * 24, rx: 9, ry: 2.4, fill: '#ffffff', opacity: .3 }); A.push({ t: 'shimmer', el: s, period: 2.4 + i * 0.3, phase: i * 0.6 }); }
    /* ใบอ้อยไหว */
    if (svgOnly) for (let i = 0; i < 18; i++) { const x = 30 + i * 86, y = 130 + (i % 4) * 15, g = el('g', { opacity: .5 }); el('path', { d: `M${x} ${y} q6 -14 2 -26 M${x} ${y} q-7 -13 -3 -25 M${x} ${y} q1 -16 0 -28`, stroke: '#8fd155', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }, g); A.push({ t: 'sway', el: g, cx: x, cy: y, amp: 4, period: 2.8 + (i % 5) * 0.4, phase: i * 0.4 }); }
    if (svgOnly) for (let i = 0; i < 8; i++) { const x = 24 + i * 34, y = 880 + (i % 3) * 26, g = el('g', { opacity: .45 }); el('path', { d: `M${x} ${y} q6 -14 2 -26 M${x} ${y} q-7 -13 -3 -25`, stroke: '#7cbf46', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' }, g); A.push({ t: 'sway', el: g, cx: x, cy: y, amp: 5, period: 3 + (i % 4) * 0.5, phase: i * 0.7 }); }
  },

  animateScene(dt) {
    const A = this.anims; if (!A) return;
    this.animTime += dt;
    const T = this.animTime;
    const S = (typeof state !== 'undefined' && state) ? state.stations : null;
    const cleaning = state && state.cleaning && state.cleaning.activeH > 0;
    const paused = !state || cleaning;                 // คน/รถยังเดินแม้เกมหยุดชั่วคราว (ฉากมีชีวิตตลอด)
    const tri = (p, ph = 0) => { const k = ((T + ph) / p) % 1; return k < 0.5 ? k * 2 : 2 - k * 2; };
    for (const a of A) {
      switch (a.t) {
        case 'rot':
          if (paused && a.station) break;
          if (a.station && S && S[a.station] && S[a.station].downH > 0) break;
          a.ang = (a.ang || 0) + a.sp * dt;
          a.el.setAttribute('transform', `rotate(${a.ang % 360} ${a.cx} ${a.cy})`); break;
        case 'dash':
          if (paused) break;
          a.off = ((a.off || 0) - a.sp * dt) % a.period;
          a.el.setAttribute('stroke-dashoffset', a.off.toFixed(2)); break;
        case 'ripple': { const k = ((T + a.phase) / a.period) % 1; a.el.setAttribute('rx', (a.rx[0] + (a.rx[1] - a.rx[0]) * k).toFixed(1)); a.el.setAttribute('ry', (a.ry[0] + (a.ry[1] - a.ry[0]) * k).toFixed(1)); a.el.setAttribute('opacity', (0.85 * (1 - k)).toFixed(2)); break; }
        case 'move': {
          if (paused) break;
          const k = tri(a.period, a.phase), px = a.x + a.dx * k, py = a.y + a.dy * k;
          const bob = a.bob ? -Math.abs(Math.sin(T * 7 + a.phase)) * a.bob : 0;
          const dir = ((T + a.phase) / a.period % 1) < 0.5 ? 1 : -1;
          const flip = a.flip && ((a.dx < 0) !== (dir < 0)) ? -1 : 1;
          a.el.setAttribute('transform', `translate(${px.toFixed(1)} ${(py + bob).toFixed(1)}) scale(${flip} 1)`); break;
        }
        case 'blink': a.el.setAttribute('opacity', (0.15 + 0.85 * Math.pow(Math.abs(Math.sin(Math.PI * (T + a.phase) / a.period)), 3)).toFixed(2)); break;
        case 'bird': { const k = ((T + a.phase) / a.period) % 1; a.el.setAttribute('transform', `translate(${(-40 + k * 1620).toFixed(0)} ${(a.y - k * 40).toFixed(0)}) scale(1 ${(1 + Math.sin(T * 9 + a.phase) * 0.35).toFixed(2)})`); break; }
        case 'shimmer': { const k = Math.sin(Math.PI * 2 * (T + a.phase) / a.period); a.el.setAttribute('opacity', (0.18 + 0.3 * (k * 0.5 + 0.5)).toFixed(2)); a.el.setAttribute('rx', (9 + k * 4).toFixed(1)); break; }
        case 'sway': a.el.setAttribute('transform', `rotate(${(Math.sin(Math.PI * 2 * (T + a.phase) / a.period) * a.amp).toFixed(2)} ${a.cx} ${a.cy})`); break;
        case 'flag': { const w = Math.sin(T * 2.6) * 5, w2 = Math.sin(T * 2.6 + 1.1) * 5; a.el.setAttribute('d', `M${a.x} ${a.y} q14 ${5 + w} 28 ${w2} v20 q-14 ${5 - w} -28 ${-w2} z`); break; }
      }
    }
  },

  /* แสงตามเวลาในเกม */
  updateLight() {
    const tint = document.getElementById('nightTint'), sun = document.getElementById('sunGlow'), lights = document.getElementById('nightLights');
    if (!tint || typeof state === 'undefined' || !state) return;
    const p = state.dayProgress || 0;
    const K = [[0, .34, '#12224a', .05, 1], [.22, .30, '#1b2b52', .10, 1], [.30, .10, '#6a4b2a', .55, .35], [.40, 0, '#12224a', .42, 0], [.62, 0, '#12224a', .50, 0], [.74, .10, '#8a4a1e', .80, .25], [.82, .22, '#4a3560', .35, .75], [.90, .34, '#12224a', .08, 1], [1, .34, '#12224a', .05, 1]];
    let i = 0; while (i < K.length - 2 && p > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1], t = (p - a[0]) / Math.max(1e-6, b[0] - a[0]), mix = (u, v) => u + (v - u) * t;
    tint.setAttribute('opacity', mix(a[1], b[1]).toFixed(3)); tint.setAttribute('fill', t < 0.5 ? a[2] : b[2]);
    if (sun) sun.setAttribute('opacity', mix(a[3], b[3]).toFixed(3));
    if (lights) lights.setAttribute('opacity', mix(a[4], b[4]).toFixed(3));
  },

  clear() {
    for (const p of this.parts) p.el.remove();
    for (const s of this.smoke) s.el.remove();
    for (const s of this.sparks) s.el.remove();
    this.parts = []; this.smoke = []; this.sparks = []; this.acc = {};
  },
};

/* สีของไหลแต่ละช่วง */
const FLOW_STYLE = {
  f_cane:   { c: '#9ccc4f', r: 5,   sp: 0.30 },
  f_mill:   { c: '#a8b84a', r: 4.5, sp: 0.32 },
  f_clar:   { c: '#d9c46a', r: 4.5, sp: 0.32 },
  f_evap:   { c: '#e0a94a', r: 4.5, sp: 0.30 },
  f_pan:    { c: '#c9832f', r: 5,   sp: 0.26 },
  f_cent:   { c: '#fff4d6', r: 4.5, sp: 0.30 },
  f_pack:   { c: '#ffffff', r: 4.5, sp: 0.34 },
  f_wh:     { c: '#ffffff', r: 4,   sp: 0.32 },
  f_bag:    { c: '#c99a52', r: 4,   sp: 0.30 },
  f_boiler: { c: '#d8a95e', r: 4,   sp: 0.34 },
  f_steam:  { c: '#eaf6ff', r: 3.5, sp: 0.40 },
};
