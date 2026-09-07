'use strict';
/* =====================================================================
   Sugar Factory Manager v0.4 — main.js
   UI: HUD, ป้ายบนแผนที่, แผงควบคุมสถานี, รายงานประจำวัน, อัปเกรดหลายขั้น
   ===================================================================== */

let state;
const UI = { tab: null, station: null, sellQty: 200, molQty: 500, missionsOpen: true, diff: 'normal', resumeSpeed: 1, bankAmt: 25_000_000, bankType: 'long' };
const SAVE_KEY = 'sfm_save_v6';

/* ป้ายบนแผนที่ (% ของภาพ 1536x1024) */
/* ป้ายอาคารยึดกับตำแหน่งอาคารจริงที่ scene.js วางไว้ (กึ่งกลางด้านบนของอาคาร) */
const PREV_STARS = {};

/* ============================ เวที: สเกลทั้งเกมให้พอดีหน้าต่าง ============================ */
const Stage = {
  s: 1, ox: 0, oy: 0, W: MAP_W, H: MAP_H,
  /* เวทีเต็มจอเสมอ: ขยายด้านกว้าง/สูงของเวทีให้สัดส่วนเท่าหน้าต่าง (ไม่มีแถบดำ) แล้วสเกลพอดี
     UI ยึดขอบเวที ส่วนแผนที่ขยายแบบ cover ให้เต็มพื้นที่ */
  fit() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w / h > MAP_W / MAP_H) { this.H = MAP_H; this.W = Math.round(MAP_H * w / h); }
    else { this.W = MAP_W; this.H = Math.round(MAP_W * h / w); }
    this.s = w / this.W; this.ox = 0; this.oy = 0;
    const st = document.getElementById('stage');
    st.style.width = this.W + 'px'; st.style.height = this.H + 'px';
    st.style.transform = `scale(${this.s.toFixed(4)})`;
  },
  toStage(cx, cy) { return [(cx - this.ox) / this.s, (cy - this.oy) / this.s]; },
};
function toggleFullscreen() {
  const d = document;
  if (!d.fullscreenElement) (d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => toast('เบราว์เซอร์ไม่อนุญาตเต็มจอ ลองกด F11')));
  else if (d.exitFullscreen) d.exitFullscreen();
}

/* ============================ กล้อง: ซูม/แพนแผนที่ ============================ */
const Cam = {
  z: 1, x: 0, y: 0, userMoved: false, drag: null,
  el() { return document.getElementById('world'); },
  view() { return { W: Stage.W, H: Stage.H }; },
  /* cover = แผนที่เต็มเวที (ค่าเริ่มต้น) · contain = เห็นทั้งแผนที่ (อาจมีขอบ) */
  fitZ(mode) { const { W, H } = this.view(); return mode === 'contain' ? Math.min(W / MAP_W, H / MAP_H) : Math.max(W / MAP_W, H / MAP_H); },
  fit(mode = 'cover') {
    const { W, H } = this.view();
    this.z = this.fitZ(mode);
    this.x = (W - MAP_W * this.z) / 2;
    /* ถ้าแผนที่สูงเกินเวที ให้ชิดบน (ด้านล่างมีแถบเมนูบังอยู่แล้ว ส่วนด้านบนมีหม้อไอน้ำ/โรงไฟฟ้า) */
    this.y = MAP_H * this.z > H ? 0 : (H - MAP_H * this.z) / 2;
    this.userMoved = mode !== 'cover'; this.apply();
  },
  clamp() {
    const { W, H } = this.view(), w = MAP_W * this.z, h = MAP_H * this.z;
    this.x = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, this.x));
    this.y = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, this.y));
  },
  apply() { this.clamp(); this.el().style.transform = `translate(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px) scale(${this.z.toFixed(4)})`; },
  zoomAt(factor, px, py) {
    const min = this.fitZ('cover'), max = 3 * min;
    const nz = Math.min(max, Math.max(min, this.z * factor));
    /* คงจุดใต้เมาส์ไว้ที่เดิม */
    this.x = px - (px - this.x) * (nz / this.z); this.y = py - (py - this.y) * (nz / this.z);
    this.z = nz; this.userMoved = true; this.apply();
  },
  onResize() { Stage.fit(); if (!this.userMoved) this.fit('cover'); else { this.z = Math.max(this.z, this.fitZ('cover')); this.apply(); } },
  bind() {
    const map = document.getElementById('map');
    Stage.fit();
    window.addEventListener('resize', () => this.onResize());
    map.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = Stage.toStage(e.clientX, e.clientY); this.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, px, py); }, { passive: false });
    map.addEventListener('mousedown', e => { if (e.button !== 0 || e.target.closest('button, input')) return; this.drag = { sx: e.clientX, sy: e.clientY, ox: this.x, oy: this.y }; map.classList.add('dragging'); });
    window.addEventListener('mousemove', e => { if (!this.drag) return; this.x = this.drag.ox + (e.clientX - this.drag.sx) / Stage.s; this.y = this.drag.oy + (e.clientY - this.drag.sy) / Stage.s; this.userMoved = true; this.apply(); });
    window.addEventListener('mouseup', () => { this.drag = null; map.classList.remove('dragging'); });
    /* touch */
    let pinch = null;
    map.addEventListener('touchstart', e => { if (e.touches.length === 2) { pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z: this.z }; } else if (e.touches.length === 1 && !e.target.closest('button')) this.drag = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, ox: this.x, oy: this.y }; }, { passive: true });
    map.addEventListener('touchmove', e => {
      if (pinch && e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const [px, py] = Stage.toStage((e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2); this.zoomAt(pinch.z * d / pinch.d / this.z, px, py); }
      else if (this.drag && e.touches.length === 1) { this.x = this.drag.ox + (e.touches[0].clientX - this.drag.sx) / Stage.s; this.y = this.drag.oy + (e.touches[0].clientY - this.drag.sy) / Stage.s; this.userMoved = true; this.apply(); }
    }, { passive: true });
    map.addEventListener('touchend', () => { this.drag = null; pinch = null; });
    document.addEventListener('fullscreenchange', () => setTimeout(() => this.onResize(), 50));
    this.fit('cover');
  },
};

/* ============================ init ============================ */
function init() {
  try { initInner(); } catch (e) {
    console.error(e);
    const ld = document.getElementById('loading');
    if (ld) ld.innerHTML = `<div class="ld-card"><div style="font-size:40px">⚠️</div><div>เกมเริ่มไม่สำเร็จ</div>
      <small>${String(e && e.message || e)}</small>
      <small>ลอง: เปิดผ่าน http://localhost:8765/ (รัน serve.ps1) · หรือกดปุ่มด้านล่างเพื่อล้างเซฟเก่า</small>
      <button class="btn primary" style="margin-top:12px" onclick="localStorage.clear();location.reload()">ล้างข้อมูลแล้วเริ่มใหม่</button></div>`;
  }
}
function initInner() {
  const loaded = loadGame();
  UI.hadSave = !!loaded;
  state = loaded || createInitialState();
  if (!state.player) state.player = { name: lsGet('sfm_player') || '' };
  AudioSys.init(); updateMusicBtn();
  const dl = parseFloat(lsGet('sfm_daylen')); if (dl >= 4) CONFIG.dayLengthSec = dl;
  setUiSize(lsGet('sfm_ui') || 'm');
  Cam.bind();
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);
  document.addEventListener('keydown', onKey);
  computeKPI(state);
  render();
  FX.init();
  /* ค่าเริ่มต้น = ฉาก 2D (โหมด 3D ถอดออกตามที่ผู้เล่นเลือก) */
  requestAnimationFrame(gameLoop);
  setSpeed(0);
  syncBottomNav();
  showSplash();
}

/* ============================ หน้าเริ่มเกม ============================ */
function heroSVG() {
  return `<svg class="hero" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="spSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a5a"/><stop offset=".45" stop-color="#6a4a8c"/><stop offset=".72" stop-color="#f08a4b"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
      <radialGradient id="spSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff5c8"/><stop offset=".5" stop-color="#ffcb5c"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
      <linearGradient id="spGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f7f2f"/><stop offset="1" stop-color="#1f4a1c"/></linearGradient>
      <linearGradient id="spHill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c3a66"/><stop offset="1" stop-color="#2a2140"/></linearGradient>
      <linearGradient id="spFac" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3444"/><stop offset="1" stop-color="#131a26"/></linearGradient>
      <radialGradient id="spPuff"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#spSky)"/>
    <g fill="#fff"><circle class="star" cx="180" cy="90" r="2"/><circle class="star s2" cx="420" cy="140" r="1.6"/><circle class="star s3" cx="760" cy="70" r="2.2"/><circle class="star s2" cx="1100" cy="120" r="1.8"/><circle class="star" cx="1380" cy="60" r="2"/><circle class="star s3" cx="1500" cy="180" r="1.5"/></g>
    <circle class="sun" cx="1180" cy="560" r="150" fill="url(#spSun)"/><circle cx="1180" cy="560" r="78" fill="#fff0b8" opacity=".95"/>
    <g fill="none" stroke="#2c3a58" stroke-width="3" opacity=".7"><path class="bird" d="M0 0 q8 -8 16 0 q8 -8 16 0" transform="translate(300 260)"/><path class="bird b2" d="M0 0 q8 -8 16 0 q8 -8 16 0" transform="translate(300 300)"/><path class="bird b3" d="M0 0 q8 -8 16 0 q8 -8 16 0" transform="translate(300 220)"/></g>
    <path d="M0 640 C 250 560, 480 600, 700 560 S 1150 520, 1600 590 L1600 900 L0 900 Z" fill="url(#spHill)"/>
    <!-- โรงงาน silhouette -->
    <g fill="url(#spFac)">
      <rect x="560" y="470" width="420" height="190"/><rect x="620" y="420" width="120" height="60"/><rect x="800" y="440" width="160" height="40"/>
      <rect x="590" y="280" width="34" height="200"/><rect x="890" y="250" width="40" height="230"/>
      <path d="M560 470 L 650 400 L 740 470 Z"/><path d="M780 470 L 860 410 L 940 470 Z"/>
      <rect x="990" y="520" width="180" height="140"/><rect x="380" y="540" width="180" height="120"/>
      <g fill="#ffd27a" opacity=".85"><rect x="600" y="520" width="18" height="24"/><rect x="640" y="520" width="18" height="24"/><rect x="680" y="520" width="18" height="24"/><rect x="720" y="520" width="18" height="24"/><rect x="820" y="560" width="18" height="24"/><rect x="860" y="560" width="18" height="24"/><rect x="1020" y="560" width="16" height="20"/><rect x="1060" y="560" width="16" height="20"/><rect x="420" y="580" width="16" height="20"/><rect x="470" y="580" width="16" height="20"/></g>
      <g fill="#d64545"><rect x="590" y="300" width="34" height="14"/><rect x="590" y="340" width="34" height="14"/><rect x="890" y="270" width="40" height="14"/><rect x="890" y="320" width="40" height="14"/></g>
    </g>
    <g><circle class="puff" cx="607" cy="275" r="26" fill="url(#spPuff)"/><circle class="puff d1" cx="607" cy="275" r="26" fill="url(#spPuff)"/><circle class="puff d2" cx="607" cy="275" r="26" fill="url(#spPuff)"/>
       <circle class="puff d1" cx="910" cy="245" r="30" fill="url(#spPuff)"/><circle class="puff" cx="910" cy="245" r="30" fill="url(#spPuff)"/><circle class="puff d2" cx="910" cy="245" r="30" fill="url(#spPuff)"/></g>
    <!-- พื้นและถนน -->
    <path d="M0 700 C 300 680, 600 690, 1600 660 L1600 900 L0 900 Z" fill="url(#spGround)"/>
    <path d="M0 800 C 400 780, 900 790, 1600 760" stroke="#3a3f47" stroke-width="46" fill="none"/><path d="M0 800 C 400 780, 900 790, 1600 760" stroke="#f5dc86" stroke-width="3" stroke-dasharray="30 26" fill="none" opacity=".8"/>
    <g class="truck"><rect x="0" y="760" width="90" height="34" rx="5" fill="#3a7d3a"/><rect x="4" y="742" width="82" height="20" rx="4" fill="#8cc152"/><rect x="92" y="768" width="34" height="28" rx="5" fill="#f0a830"/><circle cx="20" cy="798" r="9" fill="#222"/><circle cx="66" cy="798" r="9" fill="#222"/><circle cx="112" cy="798" r="9" fill="#222"/></g>
    <!-- ไร่อ้อยหน้า -->
    <g stroke="#7fd158" stroke-width="7" stroke-linecap="round" fill="none">
      ${Array.from({ length: 26 }, (_, i) => { const x = 20 + i * 62, h = 130 + (i % 4) * 30, c = ['', 'c2', 'c3'][i % 3]; return `<g class="cane ${c}"><path d="M${x} 900 L${x + 6} ${900 - h}"/><path d="M${x + 6} ${900 - h} q-22 -20 -40 -8"/><path d="M${x + 6} ${900 - h} q22 -24 44 -10"/><path d="M${x + 3} ${900 - h + 40} q-24 -10 -38 6"/><path d="M${x + 4} ${900 - h + 60} q26 -12 40 4"/></g>`; }).join('')}
    </g>
    <rect width="1600" height="900" fill="url(#gVig)" opacity=".5"/>
  </svg>`;
}
/* ป้ายเมนูบนสุด (ตกแต่ง — ฝังทับให้ตรงกับภาพ hero) */
const SP_NAV = ['หน้าแรก', 'เกี่ยวกับเกม', 'ฟีเจอร์', 'แกลเลอรี', 'ดาวน์โหลด'];

/* เติมตารางอันดับ (async — ดึงจาก Sheet/เครื่อง) */
function renderLeaderboard() {
  const el = document.getElementById('lbList'); if (!el) return;
  Leaderboard.fetchTop((rows, remote) => {
    if (!document.getElementById('lbList')) return;
    if (!rows || !rows.length) { el.innerHTML = '<div class="tip">ยังไม่มีคะแนน — เล่นจบฤดูกาลแล้วคะแนนจะมาปรากฏที่นี่</div>'; return; }
    el.innerHTML = `<div class="lb-row lb-head"><span class="lb-rank">#</span><span class="lb-name">ผู้จัดการ</span><span class="lb-grade">เกรด</span><span class="lb-score">คะแนน</span></div>`
      + rows.slice(0, 50).map((r, i) => `<div class="lb-row ${i < 3 ? 'top' : ''}">
        <span class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}</span>
        <span class="lb-name">${escapeHtml(String(r.name || 'ผู้เล่น'))}</span>
        <span class="lb-grade">${escapeHtml(String(r.grade || '-'))}</span>
        <span class="lb-score">${fmt(Math.round(r.score || 0))}</span></div>`).join('');
  });
}

function showSplash(pane) {
  const sp = document.getElementById('splash');
  const saved = UI.hadSave && !state.ended;
  const name = (state.player && state.player.name) || lsGet('sfm_player') || '';
  UI.spPane = pane || UI.spPane || 'home';
  /* ประกายไฟลอยขึ้นจากไร่ + ดาวกะพริบบนฟ้า (ทำให้ภาพนิ่งมีชีวิต) */
  let embers = '';
  for (let i = 0; i < 22; i++) {
    const x = (Math.random() * 100).toFixed(1), dur = (7 + Math.random() * 8).toFixed(1),
      delay = (-Math.random() * 12).toFixed(1), sz = (2 + Math.random() * 3).toFixed(1),
      drift = (Math.random() * 60 - 30).toFixed(0);
    embers += `<i style="left:${x}%;width:${sz}px;height:${sz}px;--dur:${dur}s;--delay:${delay}s;--drift:${drift}px"></i>`;
  }
  let stars = '';
  for (let i = 0; i < 26; i++) {
    const x = (Math.random() * 100).toFixed(1), y = (Math.random() * 46).toFixed(1),
      dur = (2 + Math.random() * 3).toFixed(1), delay = (-Math.random() * 4).toFixed(1);
    stars += `<b style="left:${x}%;top:${y}%;--dur:${dur}s;--delay:${delay}s"></b>`;
  }
  /* หิ่งห้อยเรืองแสงในไร่อ้อย (ล่างของจอ) */
  let flies = '';
  for (let i = 0; i < 14; i++) {
    const x = (Math.random() * 100).toFixed(1), y = (58 + Math.random() * 36).toFixed(1),
      dur = (5 + Math.random() * 6).toFixed(1), delay = (-Math.random() * 8).toFixed(1),
      mx = (Math.random() * 50 - 25).toFixed(0), my = (Math.random() * 30 - 15).toFixed(0);
    flies += `<u style="left:${x}%;top:${y}%;--dur:${dur}s;--delay:${delay}s;--mx:${mx}px;--my:${my}px"></u>`;
  }
  const navItems = [['home', '🏠 หน้าแรก'], ['manual', '📖 วิธีเล่น'], ['depts', '🏭 18 แผนก'], ['scoring', '🏅 การวัดผล'], ['ranking', '🏆 จัดอันดับ'], ['sound', '⚙️ ตั้งค่า']];
  const cur = navItems.some(([v]) => v === UI.spPane) ? UI.spPane : 'home';
  const nav = navItems.map(([v, t]) =>
    `<button class="sp-navbtn ${v === cur ? 'on' : ''}" data-action="spNav" data-v="${v}">${TR(t)}</button>`).join('');
  sp.innerHTML = `
    <div class="sp-bg${LANG === 'en' ? ' en' : ''}"></div>
    <div class="sp-fx" aria-hidden="true">
      <div class="sp-rays"></div>
      <div class="sp-stars">${stars}</div>
      <div class="sp-mist m1"></div><div class="sp-mist m2"></div>
      <div class="sp-flies">${flies}</div>
      <div class="sp-embers">${embers}</div>
      <div class="sp-glow"></div>
    </div>
    <header class="sp-nav">
      <div class="sp-brand2"><span class="sp-blogo">🏭</span><span class="sp-btxt">Sugar Factory<small>Manager</small></span></div>
      <nav class="sp-navmid">${nav}</nav>
      <button class="sp-lang" data-action="spNav" data-v="lang">🌐 ${LANG === 'en' ? 'EN' : 'ไทย'} ▾</button>
    </header>
    <div class="sp-loginbox pane-${UI.spPane}">${splashPane(UI.spPane, saved, name)}</div>`;
  translateBlocks(sp); translateDOM(sp);
  sp.classList.remove('hidden', 'fade');
  setTimeout(() => { const inp = document.getElementById('playerName'); if (inp && !name) inp.focus(); }, 80);
  sp.onkeydown = e => { if (e.key === 'Enter' && UI.spPane === 'home') { const b = sp.querySelector('.sp-btn'); if (b) b.click(); } };
  /* พารัลแลกซ์เบา ๆ ตามเมาส์ */
  sp.onmousemove = e => {
    const bg = sp.querySelector('.sp-bg'); if (!bg) return;
    const dx = (e.clientX / window.innerWidth - 0.5), dy = (e.clientY / window.innerHeight - 0.5);
    bg.style.transform = `translate(${(-dx * 7).toFixed(1)}px, ${(-dy * 5).toFixed(1)}px)`;
  };
}

function splashPane(pane, saved, name) {
  if (pane === 'manual') return `
    <div class="sp-head"><h2>📖 ${TR('คู่มือผู้จัดการโรงงาน')}</h2><button class="sp-x" data-action="spPane" data-v="home">✕</button></div>
    <div class="sp-scroll">
      <h3>1 · เป้าหมาย</h3>
      <p>คุณมีเวลา <b>130 วัน</b> แบ่งเป็นวันหีบ 120 วัน และโควตาวันหยุดล้างเครื่อง 10 วัน (จะหยุดวันไหนก็ได้)
         ทุนตั้งต้น ฿50 ล้าน วัดผล 8 ด้าน: การบริหาร · กำไร · ประสิทธิภาพการผลิต · ความพึงพอใจลูกค้า · ความพึงพอใจพนักงาน · ความพึงพอใจชาวไร่ · ความปลอดภัย · ข้อร้องเรียน</p>

      <h3>2 · สายวัตถุดิบ ทีม 1-3 (สำคัญที่สุด)</h3>
      <p>ทีมส่งเสริม <b>หาอ้อย</b> → ทีมเก็บเกี่ยว <b>ตัดและขน</b> → ทีมลานอ้อย <b>รับเข้าลาน</b> → ลูกหีบ
         ทั้งสามต้องมีกำลังใกล้เคียงกัน มิฉะนั้น:</p>
      <ul>
        <li>ตัดไม่ทันที่หาไว้ → อ้อยส่วนเกินหลุดไปโรงงานอื่น ชาวไร่เสียความเชื่อมั่น</li>
        <li>ลานรับไม่ทัน → รถต่อคิว ชั่วโมงตัด-ถึง-หีบเพิ่ม <b>CCS ตกชั่วโมงละ 0.042 หน่วย</b> เกิน 24 ชม. เกิด dextran</li>
        <li>คิวเกิน 18 ชม. → รถหนีไปโรงงานอื่น</li>
        <li>ลูกหีบเร็วกว่าลาน → เดินเครื่องเปล่า เสีย Time Efficiency</li>
      </ul>

      <h3>3 · ค่าพลังเครื่องจักร และการเร่งเครื่อง</h3>
      <p>เครื่องจักรทุกตัวเริ่มที่ <b>ค่าพลัง 100%</b> และลดลงทุกชั่วโมงที่เดินเครื่อง
         ยิ่งอัปเกรดดาวมาก ค่าพลังยิ่งลดช้า · ค่าพลังต่ำ = กำลังผลิตต่ำ · <b>ค่าพลัง 0 = พังทั้งกระบวนการ</b> ซ่อมอย่างน้อย 1 วัน
         (ลดลง 20% ต่อ 1 ดาวของทีมซ่อมบำรุง)</p>
      <p><b>เร่งเครื่อง</b> เพิ่มกำลังได้ทันทีโดยไม่ต้องลงทุน แต่ค่าพลังลดเร็วขึ้นแบบยกกำลังสาม
         (150% → เร็วขึ้น 3.4 เท่า) แถมพนักงานเหนื่อยและเสี่ยงอุบัติเหตุ</p>

      <h3>4 · เงินและการกู้</h3>
      <p>เงินสด<b>ติดลบไม่ได้</b> — ขาดเมื่อไรระบบกู้ให้อัตโนมัติ ดอกเบี้ยฐาน 12%/ปี และ <b>+3% ทุกยอดกู้ 50 ล้าน</b>
         (ลงทุนด้วยเงินกู้ได้) · จ่ายค่าอ้อยทุก 7 วัน · ค่าจ้างพนักงานทุก 15 วัน · ค่าอ้อยขั้นสุดท้ายวันที่ 65 และ 130</p>

      <h3>5 · ปุ่มลัด</h3>
      <p><code>Space</code> หยุด/เดินต่อ (หยุดแล้วเสียงเงียบสนิท) · <code>1-7</code> ความเร็ว 0.25x–5x · <code>M</code> เปิด/ปิดเพลง · <code>Esc</code> ปิดลิ้นชัก</p>
      <p class="sp-note">ตัวเลขทั้งหมดอ้างอิง Peter Rein “Cane Sugar Engineering”, benchmark โรงงานไทย/โลก และค่าจริงจากรายงานประจำวัน</p>
    </div>
    <div class="sp-actions"><button class="sp-btn" data-action="spPane" data-v="home">เข้าใจแล้ว</button></div>`;

  if (pane === 'depts') return `
    <div class="sp-head"><h2>🏭 ${TR('18 แผนกในโรงงาน')}</h2><button class="sp-x" data-action="spPane" data-v="home">✕</button></div>
    <div class="sp-scroll">
      <p>โรงงานมี <b>18 แผนก</b> ที่ต้องบริหารและอัปเกรดเป็นดาว — สายวัตถุดิบต้องสมดุลกัน เครื่องจักรมีค่าพลังที่ลดลงเรื่อย ๆ ทีมสนับสนุนช่วยลดความเสี่ยงและเพิ่มรายได้</p>
      ${Object.keys(DEPT_GROUPS).map(g => `
        <h3>${TR(DEPT_GROUPS[g].name)}</h3>
        <p class="sp-note" style="margin:2px 0 6px">${TR(DEPT_GROUPS[g].tip)}</p>
        ${DEPTS.filter(d => d.group === g).map(d => `
          <div class="sp-deptrow"><span class="sp-dept-ic">${d.icon}</span>
            <div><b>${d.no ? d.no + '. ' : ''}${TR(d.name)}</b> <span class="sp-dept-star">${'★'.repeat(d.maxStar)}<small> ${TR('เต็ม')} ${d.maxStar} ${TR('ดาว')}</small></span>
              <div>${TR(d.role)}</div></div></div>`).join('')}`).join('')}
    </div>
    <div class="sp-actions"><button class="sp-btn" data-action="spPane" data-v="home">เข้าใจแล้ว</button></div>`;

  if (pane === 'scoring') return `
    <div class="sp-head"><h2>🏅 ${TR('การวัดผล 8 ด้าน')}</h2><button class="sp-x" data-action="spPane" data-v="home">✕</button></div>
    <div class="sp-scroll">
      <p>ตอนจบฤดู (130 วัน) เกมให้เกรด <b>S–F</b> จาก <b>คะแนนรวมถ่วงน้ำหนัก เต็ม 1,000 แต้ม</b> (สำหรับระบบ Ranking แข่งขัน) — เรียงตามความสำคัญ:</p>
      ${SCORE_SPEC.map((s, i) => `<div class="sp-deptrow"><span class="sp-dept-ic">${s.icon}</span>
        <div><b>${i + 1}. ${TR(s.name)}</b> <small style="color:var(--gold-2)">${TR('น้ำหนัก')} ${s.w} ${TR('แต้ม')}</small>${s.lower ? ` <small>${TR('(ยิ่งน้อยยิ่งดี)')}</small>` : ''}<div>${TR(s.tip)}</div></div></div>`).join('')}
      <h3>เกณฑ์เกรด (คะแนนรวมถ่วงน้ำหนัก เต็ม 1,000)</h3>
      <div class="sp-grades">
        ${[['S', '945+', '#ffe08a'], ['A+', '890–944', '#a8f0b0'], ['A', '810–889', '#7be08a'], ['B+', '750–809', '#9ad0ff'], ['B', '670–749', '#5cb3ff'], ['C+', '610–669', '#ffd07a'], ['C', '540–609', '#ffb547'], ['F', '< 540', '#ff6b6b']]
          .map(([g, t, c]) => `<span class="sp-grade" style="border-color:${c};color:${c}">${g}<small>${t}</small></span>`).join('')}
      </div>
      <p class="sp-note">การบริหารรวม <b>ปริมาณอ้อยเข้าหีบ</b> (เป้า 700,000 ตัน) เข้าไปด้วย · เป้ากำไรสุทธิ ฿200 ล้าน · โหมดยากอย่างเดียว · เงินสดติดลบไม่ได้ (กู้ได้ แต่ดอกยิ่งกู้ยิ่งแพง)</p>
    </div>
    <div class="sp-actions"><button class="sp-btn" data-action="spPane" data-v="home">เข้าใจแล้ว</button></div>`;

  if (pane === 'ranking') {
    setTimeout(renderLeaderboard, 30);
    const shared = Leaderboard.isShared();
    return `
    <div class="sp-head"><h2>🏆 ${TR('อันดับผู้จัดการโรงงาน')}</h2><button class="sp-x" data-action="spPane" data-v="home">✕</button></div>
    <div class="sp-scroll">
      <p>${TR('อันดับจาก')} <b>${TR('คะแนนรวม (เต็ม 1,000)')}</b> ${TR('ตอนปิดฤดูกาล')} · ${shared ? TR('🌐 กระดานส่วนกลาง — แข่งกับทุกคนที่เล่น') : TR('💾 บันทึกในเครื่องนี้')}</p>
      <div id="lbList" class="lb-list"><div class="tip">${TR('กำลังโหลด…')}</div></div>
    </div>
    <div class="sp-actions"><button class="sp-btn" data-action="spPane" data-v="home">${TR('กลับหน้าแรก')}</button></div>`;
  }

  if (pane === 'sound') return `
    <div class="sp-head"><h2>🔊 ${TR('ตั้งค่าเสียง')}</h2><button class="sp-x" data-action="spPane" data-v="home">✕</button></div>
    <div class="sp-scroll">
      <div class="sp-row"><span>${TR('เพลงประกอบ')}</span>
        <button class="sp-toggle ${AudioSys.enabled ? 'on' : ''}" data-action="spMusic">${AudioSys.enabled ? TR('เปิด') : TR('ปิด')}</button></div>
      <div class="sp-row"><span>${TR('ระดับเสียง')}</span>
        <span class="sp-vol">${[0, 0.2, 0.5, 0.8, 1].map(v => `<button class="sp-vbtn ${Math.abs(AudioSys.volume - v) < 0.01 ? 'on' : ''}" data-action="spVol" data-v="${v}">${Math.round(v * 100)}%</button>`).join('')}</span></div>
      <div class="sp-row"><span>${TR('ขนาดตัวหนังสือ')}</span>
        <span class="sp-vol">${[['s', 'ปกติ'], ['m', 'ใหญ่'], ['l', 'ใหญ่มาก']].map(([v, t]) => `<button class="sp-vbtn ${(lsGet('sfm_ui') || 'm') === v ? 'on' : ''}" data-action="spUi" data-v="${v}">${TR(t)}</button>`).join('')}</span></div>
      <p class="sp-note">${TR('เพลงสร้างสดด้วย Web Audio ไม่มีไฟล์เสียง · เมื่อกดหยุดเวลาในเกม เสียงทั้งหมดจะเงียบสนิท')}</p>
    </div>
    <div class="sp-actions"><button class="sp-btn" data-action="spPane" data-v="home">${TR('เสร็จสิ้น')}</button></div>`;

  return `
    <div class="sp-badge ${saved ? 'save' : 'new'}">🌱 ${saved
      ? `${TR('เปิดฤดูกาลหีบ')} · ${TR('วันที่')} ${state.day}/${CONFIG.seasonDays} · ${TR('เหลืออีก')} ${Math.max(0, CONFIG.seasonDays - state.day + 1)} ${TR('วัน')}`
      : TR(`ฤดูกาลใหม่ · 130 วัน · 18 แผนก · ทุน ฿50 ล้าน`)}</div>
    <h2 class="sp-welcome">${saved ? `${TR('ยินดีต้อนรับกลับ')}<br><span>${TR('สู่โรงงานของคุณ')}</span>` : `${TR('ลงชื่อเข้าโรงงาน')}<br><span>${TR('บริหารในแบบของคุณ')}</span>`}</h2>
    <p class="sp-cardsub">${TR('เข้าสู่ระบบเพื่อจัดการโรงงานน้ำตาล')}</p>
    <div class="sp-field"><span class="sp-fico">👤</span>
      <input class="sp-input" id="playerName" maxlength="24" placeholder="${TR('ชื่อผู้จัดการโรงงาน')}" value="${escapeHtml(name)}" autocomplete="off"></div>
    <div class="sp-actions">
      ${saved ? `<button class="sp-btn" data-action="splashContinue">▶ ${TR('เล่นต่อ')} · ${TR('วันที่')} ${state.day}</button>
                 <button class="sp-btn alt" data-action="splashNew">${TR('เริ่มฤดูใหม่ (ล้างเกมเดิม)')}</button>`
              : `<button class="sp-btn" data-action="splashNew">${TR('🏭 เริ่มบริหารโรงงาน')}</button>`}
    </div>
    <div class="sp-or"><span>${TR('หรือ')}</span></div>
    <div class="sp-links">
      <button class="sp-link" data-action="spPane" data-v="manual">${TR('📖 คู่มือการเล่น')}</button>
      <button class="sp-link" data-action="spPane" data-v="sound">${TR('⚙️ ตั้งค่าเสียง')}</button>
    </div>
    <div class="sp-foot">${TR('เริ่มต้นทุกแผนกที่ 0 ดาว · วันหีบยังไม่เดินจนกว่าจะกด “เริ่มหีบ” — ใช้เวลาปรับปรุงและเร่งเครื่องยิ่งขึ้นได้')}</div>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function readPlayerName() {
  const inp = document.getElementById('playerName');
  let n = inp ? inp.value.trim() : '';
  if (!n) n = 'ผู้จัดการ';
  lsSet('sfm_player', n);
  return n;
}
function startGame(fresh) {
  const name = readPlayerName();
  if (fresh) { lsDel(SAVE_KEY); state = createInitialState(); computeKPI(state); computeScore(state); FX.clear(); closeDrawer(); }
  state.player = { name };
  AudioSys.start(); AudioSys.star();
  const sp = document.getElementById('splash');
  sp.classList.add('fade'); setTimeout(() => sp.classList.add('hidden'), 650);
  render(); saveGame();
  /* v2.0: เกมไม่เดินจนกว่าจะกด "เริ่มหีบ" — ให้เวลาปรับปรุงแผนกก่อน */
  setSpeed(0);
  if (!lsGet('sfm_tut_done_v7')) showTutorial();
  else if (!state.started) showPrepBrief();
  toast(`ยินดีต้อนรับ ผู้จัดการ${name}`);
}

/* หน้าบรีฟก่อนเริ่มหีบ */
function showPrepBrief() {
  const chain = capChain(state).slice(0, 4);
  showModal(`<h2>🗓️ ก่อนเปิดหีบ</h2>
    <p class="tip">วันหีบยังไม่เดิน คุณมีเวลาเตรียมตัวเต็มที่ — ลงทุนแผนกที่ต้องการ ตั้งค่ากระบวนการ แล้วค่อยกด <b>เริ่มหีบ</b></p>
    <div class="card"><h3>กำลังของสายวัตถุดิบตอนนี้</h3>
      ${chain.map(c => `<div class="kv"><span class="k">${TR(c.name)}</span><span class="v">${fmt(Math.round(c.tpd))} ${TR('ตัน/วัน')}</span></div>`).join('')}
      <div class="tip">ทั้งสี่ควรใกล้เคียงกัน — ตอนนี้ทุกแผนกอยู่ที่ 0 ดาว (1,000 ตัน/วัน) ซึ่งน้อยมาก</div></div>
    <div class="card"><h3>เงินและกำหนดจ่าย</h3>
      <div class="kv"><span class="k">เงินสดตั้งต้น</span><span class="v">฿${fmtM(state.cash)}</span></div>
      <div class="kv"><span class="k">ค่าอ้อย</span><span class="v">ทุก ${CONFIG.canePayEvery} วัน</span></div>
      <div class="kv"><span class="k">ค่าจ้างพนักงาน</span><span class="v">ทุก ${CONFIG.wagePayEvery} วัน</span></div>
      <div class="tip">เงินสดติดลบไม่ได้ — ขาดเมื่อไรจะกู้อัตโนมัติ ดอกเบี้ยเพิ่มตามยอดหนี้</div></div>
    <div class="row"><button class="btn primary" data-action="closeModal">เริ่มปรับปรุงโรงงาน</button>
      <button class="btn" data-action="tab" data-tab="upgrades">⬆️ ไปหน้าอัปเกรดแผนก</button></div>`);
}

/* ============================ game loop ============================ */
let lastTs = 0, saveAcc = 0, liveAcc = 0;
function gameLoop(ts) {
  const dt = Math.min(0.1, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  if (typeof Three3D !== 'undefined' && Three3D.on) Three3D.render(dt);   // เรนเดอร์ฉาก 3D ทุกเฟรม
  if (!state.ended && state.speed > 0) {
    const prevDay = state.day;
    stepSim(state, dt);
    if (state.day !== prevDay) onNewDay(prevDay);
    saveAcc += dt;
    if (saveAcc > 6) { saveAcc = 0; saveGame(); }
  }
  /* อัปเดตหน้าจอสด: HUD ทุก 0.25 วิ · ป้ายอาคารทุก 0.5 วิ · ลิ้นชักทุก 1 วิ
     และ "ไม่" วาดทับขณะเมาส์อยู่บนปุ่ม/ลิ้นชัก เพื่อไม่ให้ปุ่มหายไปใต้เมาส์ตอนกำลังกด */
  liveAcc += dt; markAcc += dt; drawerAcc += dt;
  /* เหตุฉุกเฉินใหม่ -> หยุดเกม เปิดหน้าต่างให้ตัดสินใจ */
  const modalHidden = document.getElementById('modal').classList.contains('hidden');
  if (state.emergency && !state.emergency.shown) { state.emergency.shown = true; UI.resumeSpeed = state.speed || 1; setSpeed(0); AudioSys.alert(); showEmergencyModal(); renderStatic(); }
  else if (modalHidden) {
    const pend = state.decisions.find(d => !d.shown);
    if (pend) { pend.shown = true; UI.resumeSpeed = state.speed || 1; setSpeed(0); AudioSys.day(); showDecisionModal(pend); }
    else if (state.newQuestDone) { const q = state.newQuestDone; state.newQuestDone = null; AudioSys.star(); showQuestToast(q); renderMissions(); }
    else if (state.newTier) { const T = state.newTier; state.newTier = null; AudioSys.star(); showModal(`<div class="tut-step">เลื่อนระดับโรงงาน</div><h2>${T.icon} ${T.name}</h2><p>น้ำตาลสะสมถึง ${fmt(T.minSugar)} ตัน — ลูกค้ารายใหญ่ขึ้น ออร์เดอร์ใหญ่ขึ้น ${Math.round((T.orderMult - 1) * 100)}% ราคาพรีเมียม +${Math.round(T.premium * 100)}%${T.export ? ' และเปิดสัญญาส่งออกต่างประเทศ' : ''}</p><div class="modal-actions"><button class="btn primary" data-action="closeModal">ยอดเยี่ยม</button></div>`); }
  }
  if (liveAcc > 0.25) { liveAcc = 0; renderHUD(); renderEmergencyBanner(); }
  if (markAcc > 0.5) { markAcc = 0; if (typeof Three3D !== 'undefined' && Three3D.on) Three3D.projectAll(); if (!document.querySelector('#markers:hover')) renderMarkers(); }
  if (drawerAcc > 1.0) { drawerAcc = 0; if (UI.tab && !document.querySelector('#drawer:hover') && !document.querySelector('#drawer input:focus')) renderDrawerLive(); }
  requestAnimationFrame(gameLoop);
}
let markAcc = 0, drawerAcc = 0;

function onNewDay(prevDay) {
  dayFlash(state.day);
  renderStatic();
  if (state.newEvents && state.newEvents.length) { showEventBanner(state.newEvents); if (state.newEvents.some(e => e.group !== 'market')) AudioSys.alert(); }
  else AudioSys.day();
  if (state.ended) { setSpeed(0); showSeasonEnd(); }
  saveGame();
}

/* ============================ input ============================ */
function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action, d = el.dataset;
  if (typeof AudioSys !== 'undefined' && !['splashNew', 'splashContinue', 'music'].includes(a)) AudioSys.click();
  switch (a) {
    case 'music': AudioSys.toggle(); updateMusicBtn(); break;
    case 'uiSize': setUiSize(d.v); renderDrawer(); break;
    case 'speed': setSpeed(+d.v); break;
    case 'zoom': { const { W, H } = Cam.view(); if (d.z === 'fit') Cam.fit('cover'); else Cam.zoomAt(d.z === 'in' ? 1.25 : 0.8, W / 2, H / 2); break; }
    case 'fullscreen': toggleFullscreen(); break;
    case 'goHome': { setSpeed(0); saveGame(); UI.hadSave = true; closeDrawer(); closeModal(); showSplash('home'); break; }
    case 'toggle3d': { const on = Three3D.setMode(!Three3D.on); update3dBtn(); if (on) { Three3D.projectAll(); toast('🧊 มุมมอง 3D'); } else toast('🗺️ มุมมอง 2D'); renderMarkers(); break; }
    case 'splashNew': {
      const doNew = () => { if (UI.hadSave) { UI.hadSave = false; showSplash(); return; } startGame(true); };
      if (UI.hadSave && !state.ended) showConfirm('เริ่มฤดูใหม่? เกมที่ค้างอยู่จะถูกล้าง', doNew, { title: '🆕 เริ่มฤดูใหม่' });
      else doNew();
      break;
    }
    case 'spPane': showSplash(d.v); break;
    case 'spNav': {
      if (d.v === 'lang') { setLang(LANG === 'en' ? 'th' : 'en'); toast(LANG === 'en' ? 'Switched to English' : 'เปลี่ยนเป็นภาษาไทย'); syncBottomNav(); if (typeof render === 'function' && state && state.started) render(); showSplash(UI.spPane); break; }
      showSplash(d.v);   // home / manual / depts / scoring / sound — เปิดเนื้อหาจริง
      break;
    }
    case 'spMusic': AudioSys.toggle(); updateMusicBtn(); showSplash('sound'); break;
    case 'spVol': AudioSys.setVolume(+d.v); showSplash('sound'); break;
    case 'spUi': setUiSize(d.v); showSplash('sound'); break;
    /* --- v2.0: เริ่มหีบ / หยุดล้างเครื่อง / เร่งเครื่อง / ซ่อมด่วน / ชำระหนี้ --- */
    case 'startCrush': {
      if (state.started) break;
      state.started = true;
      logMsg(state, `🚩 เปิดหีบฤดูกาล — ${CONFIG.crushDays} วันหีบ + ${CONFIG.cleanBudget} วันล้างเครื่อง`, 'good');
      setSpeed(1); AudioSys.day(); closeModal(); render();
      toast('เปิดหีบแล้ว! เวลาเริ่มเดิน');
      break;
    }
    case 'cleanDay': {
      if (state.cleanDay.active) { toast('กำลังหยุดล้างเครื่องอยู่'); break; }
      const left = CONFIG.cleanBudget - state.cleanDaysUsed;
      const msg = left > 0
        ? `หยุดล้างเครื่อง 1 วัน? (เหลือโควตา ${left} วัน) ค่าใช้จ่าย ฿${fmtM(CONFIG.cleanDayCost)}`
        : `ใช้โควตาวันล้างเครื่องหมดแล้ว — หยุดเพิ่มจะกินวันหีบ ยืนยันหรือไม่?`;
      showConfirm(msg, () => { startCleanDay(state); renderStatic(); }, { title: '🧽 หยุดล้างเครื่อง 1 วัน' });
      break;
    }
    case 'over': setOverdrive(state, d.id, +d.v); renderDrawer(); renderMarkers(); break;
    case 'quickRepair': if (quickRepair(state, d.id)) { AudioSys.click(); renderDrawer(); renderMarkers(); } break;
    case 'repay': { const amt = d.v === 'all' ? state.cash : +d.v; if (repayLoan(state, amt) > 0) AudioSys.coin(); if (UI._bankOpen) showBankModal(); renderDrawer(); saveGame(); break; }
    case 'openBank': { UI._bankOpen = true; AudioSys.click(); showBankModal(); break; }
    case 'bankType': UI.bankType = d.v; showBankModal(); break;
    case 'bankAmt': UI.bankAmt = +d.v; showBankModal(); break;
    case 'bankBorrow': { const got = borrow(state, UI.bankAmt, { type: UI.bankType }); if (got > 0) { AudioSys.coin(); showBankModal(); renderDrawer(); saveGame(); } break; }
    case 'closeModalBtn': UI._bankOpen = false; closeModal(); break;
    case 'emerChoice': { const before = state.emergency && state.emergency.choice; chooseEmergency(state, +d.i); if (state.emergency === null || state.emergency.choice !== before) { closeModal(); setSpeed(UI.resumeSpeed || 1); } renderStatic(); break; }
    case 'emerShow': if (state.emergency) showEmergencyModal(); else if (state.decisions[0]) { UI.resumeSpeed = state.speed || 1; setSpeed(0); showDecisionModal(state.decisions[0]); } break;
    case 'decide': decideEvent(state, d.ev, +d.i); closeModal(); setSpeed(UI.resumeSpeed || 1); renderStatic(); break;
    case 'acceptContract': acceptContract(state, d.id); renderDrawer(); break;
    case 'declineContract': declineContract(state, d.id); renderDrawer(); break;
    case 'splashContinue': startGame(false); setTimeout(offlineCatchUp, 700); break;
    case 'playPause': playPause(); break;
    case 'cycleSpeed': { const seq = CONFIG.speeds.slice(1).concat([0]); const i = seq.indexOf(state.speed); setSpeed(seq[(i + 1) % seq.length]); break; }
    case 'dayLen': CONFIG.dayLengthSec = +d.v; lsSet('sfm_daylen', d.v); updateDayLenTxt(); renderDrawer(); break;
    case 'vol': AudioSys.setVolume(+d.v); renderDrawer(); break;
    case 'tab': openTab(d.tab); break;
    case 'station': openStation(d.key); break;
    case 'closeDrawer': closeDrawer(); break;
    case 'maint': scheduleMaintenance(state, d.key); renderDrawer(); break;
    case 'accept': acceptOrder(state, d.id); renderDrawer(); break;
    case 'reject': rejectOrder(state, d.id); renderDrawer(); break;
    case 'deliver': { const before = state.totals.ordersDone; deliverOrder(state, d.id); if (state.totals.ordersDone > before) AudioSys.coin(); renderDrawer(); break; }
    case 'sell': { const b = state.stock.sugar; sellSpot(state, UI.sellQty); if (state.stock.sugar < b) AudioSys.coin(); renderDrawer(); break; }
    case 'sellAll': { const b = state.stock.sugar; sellSpot(state, state.stock.sugar); if (state.stock.sugar < b) AudioSys.coin(); renderDrawer(); break; }
    case 'sellMol': { const b = state.stock.molasses; sellMolasses(state, UI.molQty); if (state.stock.molasses < b) AudioSys.coin(); renderDrawer(); break; }
    case 'sellMolAll': { const b = state.stock.molasses; sellMolasses(state, state.stock.molasses); if (state.stock.molasses < b) AudioSys.coin(); renderDrawer(); break; }
    case 'buy': {
      const before = dStar(state, d.id);
      buyUpgrade(state, d.id);
      const after = dStar(state, d.id);
      if (after > before) {
        AudioSys.star(); renderMarkers();
        const D = dept(d.id), ch = deptDiffText(d.id, before).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        toast(`⭐ ${D.name} → ${after} ดาว · ${ch || D.levels[after].name}`);
        const bld = SCENE.buildings.find(b => (b.dept || b.key) === d.id);
        if (bld) floatAt(bld.key, '⭐'.repeat(Math.min(3, after)));
      }
      renderDrawer(); break;
    }
    case 'preset': applyPreset(d.p); renderDrawer(); break;
    case 'closeModal': closeModal(); break;
    case 'tutorial': showTutorial(); break;
    case 'tutNext': tutorialStep(+d.step); break;
    case 'toggleMissions': UI.missionsOpen = !UI.missionsOpen; document.getElementById('missions').classList.toggle('collapsed', !UI.missionsOpen); break;
    case 'newGame': showConfirm('เริ่มฤดูใหม่? ข้อมูลเดิมจะหายไป', () => { lsDel(SAVE_KEY); const nm = state.player; state = createInitialState(); state.player = nm; computeKPI(state); FX.clear(); closeModal(); closeDrawer(); setSpeed(0); UI.hadSave = false; render(); showSplash(); }, { title: '🆕 เริ่มฤดูใหม่' }); break;
    case 'confirmYes': { const cb = UI._confirmYes; UI._confirmYes = null; closeModal(); if (cb) cb(); break; }
    case 'confirmNo': { UI._confirmYes = null; closeModal(); break; }
    case 'save': saveGame(); toast('บันทึกแล้ว'); break;
    case 'export': exportSave(); break;
  }
}

function onInput(e) {
  const el = e.target, id = el.id;
  if (!id) return;
  const c = state.ctrl;
  const num = +el.value;
  switch (id) {
    case 'cCrush': c.crushTarget = num; break;
    case 'cImb': c.imbibition = num; break;
    case 'cPH': c.pH = num / 10; break;
    case 'cBrix': c.syrupBrix = num; break;
    case 'cWash': c.wash = num / 10; break;
    case 'cOil': c.useOil = el.checked; break;
    case 'cAuto': c.autoTune = el.checked; if (c.autoTune) autoTune(state); break;
    case 'sellQty': UI.sellQty = num; return;
    case 'molQty': UI.molQty = num; return;
    case 'bankRange': UI.bankAmt = Math.round(num / 1_000_000) * 1_000_000; showBankModal(); return;
    default:
      if (id.startsWith('mix_')) { setMix(id.slice(4), num / 100); }
      else return;
  }
  renderDrawer();
  saveGame();
}

/* สัดส่วนอ้อย: ปรับตัวหนึ่งแล้วเกลี่ยตัวที่เหลือให้รวมเป็น 100% */
function setMix(key, val) {
  const mix = state.ctrl.caneMix;
  const cap = CANE_SOURCES[key].maxShare;
  val = Math.min(val, cap);
  const others = Object.keys(mix).filter(k => k !== key);
  const restOld = others.reduce((a, k) => a + mix[k], 0);
  const restNew = 1 - val;
  mix[key] = val;
  if (restOld > 1e-6) others.forEach(k => { mix[k] = mix[k] / restOld * restNew; });
  else others.forEach(k => { mix[k] = restNew / others.length; });
  /* บังคับเพดานของแต่ละแหล่ง */
  for (const k of others) {
    const c2 = CANE_SOURCES[k].maxShare;
    if (mix[k] > c2) { const ex = mix[k] - c2; mix[k] = c2; const rest2 = others.filter(o => o !== k && mix[o] < CANE_SOURCES[o].maxShare); rest2.forEach(o => mix[o] += ex / rest2.length); }
  }
}

function applyPreset(p) {
  const c = state.ctrl, P = proc(state);
  if (p === 'yield') { c.imbibition = 300; c.pH = 7.1; c.syrupBrix = Math.min(66, P.syrupBxMax); c.wash = 3.4; c.crushTarget = Math.round(P.millTph * 0.85); }
  if (p === 'balanced') { c.imbibition = 270; c.pH = 7.1; c.syrupBrix = Math.min(65, P.syrupBxMax); c.wash = 3.0; c.crushTarget = Math.round(P.millTph * 0.92); }
  if (p === 'throughput') { c.imbibition = 245; c.pH = 7.0; c.syrupBrix = Math.min(63, P.syrupBxMax); c.wash = 2.6; c.crushTarget = Math.round(P.millTph); }
  toast('ตั้งค่าชุด "' + ({ yield: 'เน้นคุณภาพ', balanced: 'สมดุล', throughput: 'เน้นปริมาณ' })[p] + '" แล้ว');
}

function onKey(e) {
  if (e.target && e.target.matches && e.target.matches('input, textarea')) return;
  if (e.key === ' ') { e.preventDefault(); playPause(); }
  if (e.key >= '1' && e.key <= '8') setSpeed(CONFIG.speeds[+e.key]);
  if (e.key === 'Escape') closeDrawer();
  if (e.key === 'm' || e.key === 'M') { AudioSys.toggle(); updateMusicBtn(); }
}
function updateMusicBtn() { const b = document.getElementById('btnMusic'); if (b) b.textContent = AudioSys.enabled ? '🔊' : '🔇'; }
function update3dBtn() { const b = document.getElementById('btn3d'); if (b) { const on = typeof Three3D !== 'undefined' && Three3D.on; b.textContent = on ? '🗺️ 2D' : '🧊 3D'; b.classList.toggle('on', on); } }
function setUiSize(v) { const st = document.getElementById('stage'); st.classList.remove('ui-s', 'ui-l'); if (v === 's' || v === 'l') st.classList.add('ui-' + v); lsSet('sfm_ui', v); }

function setSpeed(v) {
  const wasPaused = state.speed === 0;
  state.speed = v;
  /* หยุด = เงียบสนิทและทุกอย่างหยุดจริง */
  if (v === 0) AudioSys.pauseAll();
  else if (wasPaused) AudioSys.resumeAll();
  document.querySelectorAll('#timeCtrl .sb-row button').forEach(b => b.classList.toggle('active', +b.dataset.v === v));
  if (v > 0) UI.lastSpeed = v;
  updatePlayBtn();
  updateDayLenTxt();
}

/* ปุ่มเดียว: เริ่ม / หยุด / เดินต่อ */
function playPause() {
  /* มีเหตุการณ์รอตัดสินใจ → เวลาต้องหยุดจนกว่าจะเลือก */
  if ((state.emergency || state.decisions.some(d => d.shown)) && !document.getElementById('modal').classList.contains('hidden')) {
    toast('ตัดสินใจเหตุการณ์ก่อน แล้วเวลาจะเดินต่อ'); return;
  }
  if (!state.ended && !state.started) {
    state.started = true;
    logMsg(state, `🚩 เปิดหีบฤดูกาล — ${CONFIG.crushDays} วันหีบ + ${CONFIG.cleanBudget} วันล้างเครื่อง`, 'good');
    setSpeed(1); AudioSys.day(); closeModal(); render();
    toast('เปิดหีบแล้ว! เวลาเริ่มเดิน');
  } else if (state.speed > 0) setSpeed(0);
  else setSpeed(UI.lastSpeed || 1);
}
function updatePlayBtn() {
  const bt = document.getElementById('btnTime'); if (!bt) return;
  const ic = document.getElementById('btnPlayIcon'), lb = document.getElementById('btnPlayLabel');
  const paused = !state.started || state.speed === 0;
  bt.classList.toggle('paused', paused);
  if (!ic || !lb) return;
  if (!state.started) { ic.textContent = '🚩'; lb.textContent = TR('เริ่มหีบ'); }
  else if (state.speed === 0) { ic.textContent = '▶'; lb.textContent = TR('เดินต่อ'); }
  else { ic.textContent = '⏸'; lb.textContent = TR('หยุด') + ' · ' + state.speed + 'x'; }
  document.querySelectorAll('#timeCtrl .sb-row button').forEach(b => b.classList.toggle('active', +b.dataset.v === state.speed));
}

/* ป้ายใต้ปุ่ม: 1 วันหีบ (24 ชม.ในเกม) ใช้เวลาจริงเท่าไรที่ความเร็วปัจจุบัน */
function updateDayLenTxt() {
  const el = document.getElementById('btnDayTxt'); if (!el) return;
  const sp = state ? state.speed : 1;
  if (!sp) { el.textContent = TR('1 วันหีบ =') + ' ' + TR('หยุดอยู่'); return; }
  const sec = CONFIG.dayLengthSec / sp;
  const num = n => n.toFixed(1).replace(/\.0$/, '');
  el.textContent = TR('1 วันหีบ =') + ' ' + (sec >= 90 ? num(sec / 60) + ' ' + TR('นาที') : (sec >= 10 ? Math.round(sec) : num(sec)) + ' ' + TR('วิ'));
}

function openTab(tab) { UI.tab = tab; UI.station = null; renderDrawer(); }
function openStation(key) {
  /* ทุกสถานีเปิดแผงของแผนกตัวเอง (ถังโมลาส บรรจุ คลัง แยกกันหมด) */
  UI.tab = 'production';
  UI.station = key;
  renderDrawer();
}
function closeDrawer() {
  UI.tab = null; UI.station = null;
  document.getElementById('drawer').classList.add('hidden');
  document.getElementById('app').classList.remove('drawer-open');
  document.querySelectorAll('#bottomNav button').forEach(b => b.classList.remove('active'));
}

/* ============================ save ============================ */
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function saveGame() { state.savedAt = Date.now(); lsSet(SAVE_KEY, JSON.stringify(state)); }
/* กลับมาเล่นต่อ: เดินโรงงานย้อนหลังตามเวลาที่หายไป (สูงสุด 2 วันในเกม) แล้วสรุปให้ดู */
function offlineCatchUp() {
  if (!state.savedAt || state.ended) return;
  const sec = (Date.now() - state.savedAt) / 1000;
  if (sec < 300) return;
  const r = simulateOffline(state, sec);
  if (!r) return;
  computeKPI(state); render(); saveGame();
  showModal(`<div class="tut-step">ยินดีต้อนรับกลับ</div><h2>🏭 โรงงานเดินต่อระหว่างที่คุณไม่อยู่</h2>
    <p>ผู้ช่วยอัตโนมัติดูแลให้ ${r.hours.toFixed(0)} ชั่วโมงในเกม (${r.days} วัน) ที่ครึ่งความเร็ว</p>
    <div class="kpi-grid"><div class="kpi"><div class="k">น้ำตาลที่ผลิตได้</div><div class="v">${fmt(r.sugar)} <small>ตัน</small></div></div>
    <div class="kpi"><div class="k">เงินสดเปลี่ยน</div><div class="v ${r.cashDelta >= 0 ? 'up' : 'dn'}">${r.cashDelta >= 0 ? '+' : ''}฿${fmtM(r.cashDelta)}</div></div>
    <div class="kpi"><div class="k">เครื่องเสีย</div><div class="v">${r.breaks} ครั้ง</div></div>
    <div class="kpi"><div class="k">ชื่อเสียง</div><div class="v">${r.repDelta >= 0 ? '+' : ''}${r.repDelta.toFixed(0)}</div></div></div>
    <div class="tip">เหตุการณ์ที่ต้องตัดสินใจระหว่างนั้น ผู้ช่วยเลือกทางปริยายให้ (ดูในบันทึกเหตุการณ์)</div>
    <div class="modal-actions"><button class="btn primary" data-action="closeModal">เดินเครื่องต่อ</button></div>`);
}
function loadGame() {
  try {
    const raw = lsGet(SAVE_KEY); if (!raw) return null;
    const s = JSON.parse(raw); if (s.version !== 6) return null;
    const base = createInitialState();
    for (const k in base) if (s[k] === undefined) s[k] = base[k];
    s.ctrl = Object.assign({}, base.ctrl, s.ctrl);
    for (const k in base.dept) s.dept[k] = Object.assign({}, base.dept[k], (s.dept && s.dept[k]) || {});
    s.stations = s.dept;
    s.complaints = Object.assign({}, base.complaints, s.complaints);
    s.cleanDay = Object.assign({}, base.cleanDay, s.cleanDay);
    s.yard = Object.assign({}, base.yard, s.yard); s.field = Object.assign({}, base.field, s.field);
    s.payable = Object.assign({}, base.payable, s.payable);
    s.totals = Object.assign({}, base.totals, s.totals);
    s.today = Object.assign({}, base.today, s.today || {});
    s.speed = 0;                        // รอผู้เล่นกด "เล่นต่อ" ที่หน้าเริ่มเกม
    return s;
  } catch (e) { return null; }
}
function exportSave() {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `sugar-factory-day${state.day}.json`; a.click();
}

/* ============================ render ============================ */
function render() { renderStatic(); renderLive(); }
function renderStatic() { renderMissions(); renderEvents(); if (UI.tab) renderDrawer(); renderLive(); }
function renderLive() { renderHUD(); renderMarkers(); }

function clockStr(p) {
  const mins = Math.floor(p * 1440);
  return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
}

function renderHUD() {
  const s = state, K = s.kpi, t = s.today;
  const profit = netWorth(s) - CONFIG.startCash;
  const recLv = kpiLevel(KPI_SPEC[1], K.recovery);
  const spend = t.caneCost + t.labor + t.chemicals + t.fixed + t.repair + t.fuelCost + t.cleanCost + t.penalty + t.waterFine + t.dumpCost;
  const h = s.history, prevCash = h.length ? h[h.length - 1].cash : CONFIG.startCash;
  const chg = prevCash ? (s.cash - prevCash) / Math.abs(prevCash) * 100 : 0;
  const mw = (t.hours > 0 ? t.powerExport / t.hours / 1000 : 0);
  /* 6 ช่อง: วันที่/วันหีบ · เงินทุน+หนี้ · น้ำตาลวันนี้ · ไฟฟ้า · ลูกค้า · พนักงาน */
  document.getElementById('hudChips').innerHTML = `
    <div class="chip" style="width:196px" title="วันหีบ ${s.crushDaysDone}/${CONFIG.crushDays} · วันล้างเครื่อง ${s.cleanDaysUsed}/${CONFIG.cleanBudget} · รายจ่ายวันนี้ ฿${fmt(Math.round(spend))}"><span class="ic" style="background:#3b5bdb">📅</span><div><div class="lbl">${TR('วันที่')} <b>${s.day} / ${CONFIG.seasonDays}</b></div>
      <div class="val" style="font-size:14px;font-weight:500">${s.cleanDay.active ? TR('🧽 ล้างเครื่อง') : s.started ? `${TR('หีบ')} ${s.crushDaysDone}/${CONFIG.crushDays}` : TR('ยังไม่เปิดหีบ')} · ${clockStr(s.dayProgress)}</div></div></div>
    <div class="chip" style="width:246px" title="กำไรสุทธิ ฿${fmtM(profit)} / เป้า ฿${fmtM(CONFIG.winProfit)} · ค่าอ้อยค้างจ่าย ฿${fmtM(s.payable.accrued + s.payable.amount)} · ค่าจ้างค้างจ่าย ฿${fmtM(s.wagesAccrued)}"><span class="ic" style="background:#2f9e44">💵</span><div><div class="lbl">${TR('เงินสด')}${s.loan > 0 ? ` · หนี้ ฿${fmtM(s.loan)}` : ''}</div>
      <div class="val ${s.loan > 0 ? 'dn' : ''}">฿ ${fmt(Math.round(s.cash))} <small class="${chg >= 0 ? 'up' : 'dn'}">${chg >= 0 ? '▲' : '▼'}${Math.abs(chg).toFixed(1)}%</small></div></div></div>
    <div class="chip" style="width:172px" title="คลัง ${fmt(Math.round(s.stock.sugar))} ตัน · Recovery ${(K.recovery || 0).toFixed(1)}% · Extraction ${(K.extraction || 0).toFixed(1)}%"><span class="ic" style="background:#5c7cfa">🧊</span><div><div class="lbl">${TR('น้ำตาลวันนี้')}</div>
      <div class="val">${fmt(t.sugar, 0)} <small>${TR('ตัน')}</small></div></div></div>
    <div class="chip" style="width:170px" title="ขายไฟ ${fmt(K.kwhPerTc || 0, 0)} kWh/ตันอ้อย · ชานอ้อย ${fmt(Math.round(s.stock.bagasse))} ตัน"><span class="ic" style="background:#f08c00">⚡</span><div><div class="lbl">${TR('ไฟฟ้า')}</div>
      <div class="val">${mw.toFixed(1)} MW<span class="meter"><i style="width:${Math.min(100, mw * 6)}%"></i></span></div></div></div>
    <div class="chip" style="width:150px" title="ส่งตรงเวลาและคุณภาพคงที่ · สำเร็จ ${s.totals.ordersDone} / พลาด ${s.totals.ordersFailed} · ข้อร้องเรียน ${s.complaints.customer}"><span class="ic" style="background:#e8590c">${s.custSat >= 70 ? '😊' : s.custSat >= 50 ? '😐' : '😟'}</span><div><div class="lbl">${TR('ลูกค้า')}</div>
      <div class="val ${s.custSat < 55 ? 'dn' : ''}">${Math.round(s.custSat)}%</div></div></div>
    <div class="chip" style="width:150px" title="ขวัญกำลังใจพนักงาน · ภาระเร่งเครื่อง ${(overdriveLoad(s) * 100).toFixed(0)}% · ข้อร้องเรียนแรงงาน ${s.complaints.labour}"><span class="ic" style="background:#7048e8">${s.staffSat >= 70 ? '💪' : s.staffSat >= 50 ? '😓' : '😡'}</span><div><div class="lbl">${TR('พนักงาน')}</div>
      <div class="val ${s.staffSat < 50 ? 'dn' : ''}">${Math.round(s.staffSat)}%</div></div></div>
    <div class="chip" style="width:150px" title="ความพึงพอใจชาวไร่ · ราคารับซื้อ ลดคิวรอ ไม่เสียอ้อยให้คู่แข่ง · มีผลต่อปริมาณอ้อยเข้าโรงงานและคะแนน"><span class="ic" style="background:#2f9e44">${s.growerTrust >= 70 ? '🌾' : s.growerTrust >= 50 ? '😐' : '😠'}</span><div><div class="lbl">${TR('ชาวไร่')}</div>
      <div class="val ${s.growerTrust < 50 ? 'dn' : ''}">${Math.round(s.growerTrust)}%</div></div></div>
    <div class="chip" style="width:150px" title="ดัชนีความปลอดภัย · เร่งเครื่องหนัก/เครื่องทรุด/ขวัญต่ำ = เสี่ยง · ทีมฉุกเฉิน+ซ่อมบำรุง+การ์ดเครื่อง = ดี · ต่ำ = อุบัติเหตุ/ไฟไหม้บ่อยขึ้น"><span class="ic" style="background:#e8730c">${(s.safety ?? 90) >= 70 ? '🦺' : (s.safety ?? 90) >= 45 ? '⚠️' : '🚨'}</span><div><div class="lbl">${TR('ความปลอดภัย')}</div>
      <div class="val ${(s.safety ?? 90) < 50 ? 'dn' : ''}">${Math.round(s.safety ?? 90)}%</div></div></div>`;
  const l3 = document.querySelector('#hud .logo .l3');
  if (l3 && s.player && s.player.name) l3.innerHTML = `${TR('ผู้จัดการ')} <b>${escapeHtml(s.player.name)}</b>${s.started ? '' : ' · ' + TR('ยังไม่เปิดหีบ')}`;
  updatePlayBtn();
  const bad = (s.hints || []).filter(x => x.lvl === 'bad' || x.lvl === 'warn').length;
  const badge = document.getElementById('hintBadge'); badge.textContent = bad; badge.classList.toggle('show', bad > 0);
  const open = s.orders.filter(o => o.status === 'open').length;
  const ob = document.getElementById('orderBadge'); ob.textContent = open; ob.classList.toggle('show', open > 0);
}

/* แผงเควส: 3 เควสที่กำลังทำ พร้อมแถบความคืบหน้าและรางวัล */
function questProgress(q) {
  const r = q.check(state);
  const pct = r.lower ? (r.cur <= r.target ? 100 : Math.max(0, Math.min(100, (1 - (r.cur - r.target) / Math.max(1, r.target)) * 100))) : Math.min(100, r.cur / r.target * 100);
  const fv = v => r.money ? '฿' + fmtM(v) : fmt(v, r.decimals || 0);
  return { r, pct, text: `${fv(r.cur)} / ${fv(r.target)} ${TR(r.unit)}` };
}
function renderMissions() {
  const s = state, qs = activeQuests(s);
  document.getElementById('missionList').innerHTML = qs.map(q => {
    const p = questProgress(q);
    return `<li class="quest"><div class="q-head"><span>${q.icon} ${TR(q.title)}</span><b>฿${fmtM(q.reward.cash)}</b></div>
      <div class="q-desc">${TR(q.desc)}</div>
      <div class="q-bar"><i style="width:${p.pct.toFixed(0)}%"></i></div><div class="q-prog">${p.text}</div></li>`;
  }).join('') || '<li>ทำเควสครบทุกข้อแล้ว 🏆</li>';
  /* ภารกิจรายวัน */
  const daily = (s.daily && s.daily.tasks) || [];
  if (daily.length) document.getElementById('missionList').innerHTML += `<li class="daily"><div class="q-head"><span>📅 ${TR('ภารกิจวันนี้')}</span></div>${daily.map(t => `<div class="d-row ${t.done ? 'done' : ''}"><span class="cb ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</span><span class="d-txt">${TR(t.text)}</span><b>+฿${fmtM(t.reward)}</b></div>`).join('')}</li>`;
  translateDOM(document.getElementById('missionList'));
  const sum = document.querySelector('#missions h3 .sum');
  if (sum) sum.textContent = `${s.questsDone.length}/${QUESTS.length}`;
}
function showQuestToast(q) {
  showModal(`<div class="tut-step">เควสสำเร็จ</div><h2>🏅 ${q.icon} ${q.title}</h2><p>${q.desc}</p>
    <div class="kpi-grid"><div class="kpi"><div class="k">รางวัลเงิน</div><div class="v up">+฿${fmtM(q.reward.cash)}</div></div>
    <div class="kpi"><div class="k">ชื่อเสียง</div><div class="v">${q.reward.rep ? '+' + q.reward.rep : '-'}</div></div></div>
    ${activeQuests(state).length ? `<div class="tip">เควสถัดไป: ${activeQuests(state).map(x => x.icon + ' ' + x.title).join(' · ')}</div>` : ''}
    <div class="modal-actions"><button class="btn primary" data-action="closeModal">เยี่ยม!</button></div>`);
}

function stStatus(key) {
  const id = (STATION_META[key] && STATION_META[key].dept) || key;
  const st = state.dept[id];
  if (!st) return { cls: '', txt: '—' };
  if (st.downH > 0) return { cls: 'down', txt: `พัง ${st.downH.toFixed(1)} ชม.` };
  if (st.power !== undefined && dept(id).kind === 'machine') {
    if (st.power < 25) return { cls: 'down', txt: `พลัง ${Math.round(st.power)}%` };
    if (st.power < 50) return { cls: 'idle', txt: `พลัง ${Math.round(st.power)}%` };
  }
  return { cls: '', txt: 'เดินเครื่อง' };
}

/* ป้ายอาคาร: เลข ชื่อ ดาวอัปเกรด (0-5) และค่าสด 1 บรรทัด — ยึดกึ่งกลางด้านบนของอาคารที่วางจริง */
let lastMarkersHTML = '';
/* ป้ายอาคาร: เลขทีม ชื่อ ดาว และค่าสด 1 บรรทัด — ยึดกึ่งกลางด้านบนของกรอบอาคาร */
function markerInfo(b) {
  const s = state, t = s.today, K = s.kpi, P = proc(s);
  const hrs = Math.max(0.05, t.hours);
  const id = b.dept, x = s.dept[id], D = dept(id);
  let sub = '', vcls = '', dot = '', alert = false, tip = D ? D.role : '';
  if (x && D && D.kind === 'machine') {
    if (x.downH > 0) { dot = 'down'; alert = true; }
    else if (x.power < 25) dot = 'down';
    else if (x.power < 50) dot = 'idle';
  }
  switch (b.key) {
    case 'promo':
      sub = `หาอ้อย ${fmt(Math.round(dCap(s, 'promo')))} ต/ว · เชื่อมั่น ${Math.round(s.growerTrust)}%`;
      vcls = s.growerTrust < 45 ? 'bad' : s.growerTrust < 65 ? 'warn' : '';
      tip = `อ้อยรอตัดในไร่ ${fmt(Math.round(s.field.standing))} ตัน · เสียให้โรงอื่นแล้ว ${fmt(Math.round(s.totals.caneLost))} ตัน`; break;
    case 'harvest':
      sub = `ตัด+ขน ${fmt(Math.round(dCap(s, 'harvest')))} ต/ว · trash ${dv(s, 'harvest', 'trash').toFixed(1)}%`;
      tip = `ตัด-ถึง-หีบพื้นฐาน ${dv(s, 'harvest', 'cut')} ชม.`; break;
    case 'yard': {
      const yt = yardTons(s), pc = yt / P.yardCap, age = oldestAgeH(s);
      sub = `อ้อย ${fmt(Math.round(yt))} ตัน · คิว ${s.yard.queueH.toFixed(0)} ชม.`;
      vcls = (age > 24 || s.yard.queueH > 18) ? 'bad' : (pc > 0.8 || s.yard.queueH > 10) ? 'warn' : '';
      dot = vcls === 'bad' ? 'down' : vcls === 'warn' ? 'idle' : '';
      alert = age > CONFIG.dextranAfterH;
      tip = `ลาน ${fmt(Math.round(yt))}/${fmt(P.yardCap)} ตัน · CCS ${yardCCS(s).toFixed(1)} · เก่าสุด ${age.toFixed(0)} ชม. · รถหนีคิวแล้ว ${fmt(Math.round(s.totals.caneDiverted))} ตัน`; break;
    }
    case 'mill':
      sub = `${fmt(K.tch || 0, 0)} ต/ชม. · Ext ${(K.extraction || 0).toFixed(1)}%`;
      tip = `PI ${(K.pi || 0).toFixed(0)} · Pol%Bagasse ${(K.polBagPct || 0).toFixed(2)}%`; break;
    case 'clar':
      sub = `pH ${s.ctrl.pH.toFixed(1)} · Pol FC ${(K.lossFC || 0).toFixed(2)}%`; break;
    case 'evap': {
      const sc = Math.round((s.dept.evap.scale || 0) * 100);
      sub = `Bx ${s.ctrl.syrupBrix} · ตะกรัน ${sc}%`;
      if (sc > 40) vcls = 'bad'; else if (sc > 25) vcls = 'warn';
      tip = `ระเหยน้ำวันนี้ ${fmt(Math.round(t.waterEvap))} ตัน`; break;
    }
    case 'pan':
      sub = `FM Pty ${(K.ptyFM || 0).toFixed(1)}${t.panLimited ? ' ⚠ คอขวด' : ''}`;
      vcls = K.ptyFM > 36 ? 'bad' : K.ptyFM > 34 ? 'warn' : '';
      if (t.panLimited && !dot) dot = 'idle';
      tip = `BHR ${(K.bhr || 0).toFixed(1)}%`; break;
    case 'fugal':
      sub = `น้ำตาล ${fmt(Math.round(t.sugar))} ต/ว${t.fugalLimited ? ' ⚠ คอขวด' : ''}`;
      if (t.fugalLimited && !dot) dot = 'idle';
      tip = `Overall Recovery ${(K.recovery || 0).toFixed(1)}%`; break;
    case 'pack': {
      const pr = s.rawSugar / RAW_SUGAR_BIN;
      sub = `บรรจุ ${fmt(Math.round(t.packed))} ต · รอ ${fmt(Math.round(s.rawSugar))}`;
      if (t.packFull) { vcls = 'bad'; dot = 'down'; alert = true; }
      else if (pr > 0.6) { vcls = 'warn'; if (!dot) dot = 'idle'; }
      tip = `กำลังบรรจุ ${fmt(Math.round(dCap(s, 'pack')))} ตันน้ำตาล/วัน · หกหาย ${dv(s, 'pack', 'loss')}%`; break;
    }
    case 'warehouse': {
      const pc = s.stock.sugar / P.whCap;
      const acc = s.orders.filter(o => o.status === 'accepted').length;
      sub = `คลัง ${fmt(Math.round(s.stock.sugar))} ต (${Math.round(pc * 100)}%)${acc ? ' · รอส่ง ' + acc : ''}`;
      vcls = pc > 0.9 ? 'bad' : pc > 0.7 ? 'warn' : '';
      dot = pc > 0.9 ? 'down' : pc > 0.7 ? 'idle' : '';
      alert = pc > 0.92;
      tip = `โควตาโหลดรถวันนี้เหลือ ${fmt(Math.round(Math.max(0, P.shipTpd - (s.todayShipped || 0))))} ตัน`; break;
    }
    case 'boiler':
      sub = t.steamShort ? 'ไอน้ำไม่พอ!' : `ไอ ${fmt(t.steamMade / hrs, 0)} ต/ชม. · ชานอ้อย ${fmt(Math.round(s.stock.bagasse))}`;
      if (t.steamShort) { dot = 'down'; alert = true; vcls = 'bad'; }
      tip = `Steam on cane ${(K.steamOnCane || 0).toFixed(0)}% · ⚠ มีความเสี่ยงไฟไหม้`; break;
    case 'power':
      sub = `ขายไฟ ${(t.powerExport / hrs / 1000).toFixed(1)} MW · ${fmt(K.kwhPerTc || 0, 0)} kWh/tc`;
      tip = `รายได้ไฟวันนี้ ฿${fmt(Math.round(t.powerRev))}`; break;
    case 'molasses': {
      const mc = up(s, 'molTank', 'molCap'), pc = s.stock.molasses / mc;
      sub = `${fmt(Math.round(s.stock.molasses))}/${fmt(mc)} ต · ฿${fmt(s.market.molPrice)}`;
      vcls = pc > 0.95 ? 'bad' : pc > 0.75 ? 'warn' : '';
      alert = !!t.molFull; tip = 'คลิกเพื่อขายกากน้ำตาล'; break;
    }
    case 'maint': {
      const worst = Math.min.apply(null, MACHINE_IDS.map(k => s.dept[k].power));
      sub = `พลังต่ำสุด ${Math.round(worst)}% · ล้าง ${s.cleanDaysUsed}/${CONFIG.cleanBudget}`;
      vcls = worst < 25 ? 'bad' : worst < 50 ? 'warn' : ''; alert = worst < 20; break;
    }
    case 'office': {
      const open = s.orders.filter(o => o.status === 'open').length;
      sub = `ออร์เดอร์ใหม่ ${open} · ลูกค้า ${Math.round(s.custSat)}%`;
      vcls = s.custSat < 55 ? 'bad' : open ? 'warn' : ''; break;
    }
    case 'ert':
      sub = `เหตุ ${s.emergencies.length} ครั้ง`;
      vcls = dStar(s, 'ert') === 0 ? 'warn' : ''; break;
    case 'hr':
      sub = `ขวัญ ${Math.round(s.staffSat)}%`;
      vcls = s.staffSat < 50 ? 'bad' : s.staffSat < 70 ? 'warn' : ''; break;
    case 'qc':
      sub = s.qualityIssue > 0.8 ? 'พบปัญหา' : 'ปกติ';
      vcls = s.qualityIssue > 0.8 ? 'bad' : ''; break;
    case 'water': {
      const pc = s.water.level / s.water.cap, bod = up(s, 'wwt', 'bod');
      sub = `บ่อ ${Math.round(pc * 100)}% · BOD ${bod}`;
      vcls = (pc > 0.85 || bod > CONFIG.bodStandard) ? 'bad' : pc > 0.7 ? 'warn' : '';
      alert = pc > 0.9; break;
    }
  }
  return { sub, vcls, dot, alert, tip };
}

function renderMarkers() {
  const s = state;
  if (typeof SCENE === 'undefined' || !SCENE.ready) { document.getElementById('markers').innerHTML = ''; return; }
  const cleaning = s.cleanDay && s.cleanDay.active;
  const parts = [];
  for (const b of SCENE.buildings) {
    const p = SCENE.placed[b.key]; if (!p) continue;
    const info = markerInfo(b);
    const dot = cleaning ? 'idle' : info.dot;
    const [cx, cy] = p.lbl ? p.lbl : [p.left + p.w / 2, p.top];
    const stars = b.noStar ? -1 : SCENE.stars(s, b.key);
    const prev = PREV_STARS[b.key]; PREV_STARS[b.key] = stars;
    const popIdx = prev !== undefined && stars > prev ? stars - 1 : -1;
    const D = dept(b.dept);
    const num = b.n > 0 ? b.n + '. ' : '';
    parts.push(`<button class="marker bld-label ${b.compact ? 'mk-sm' : ''} ${info.alert && !cleaning ? 'alert' : ''}" style="left:${cx.toFixed(0)}px;top:${(cy - 6).toFixed(0)}px" data-action="station" data-key="${b.key}" title="${info.tip}"><span class="dot ${dot}"></span><span class="mk-name">${num}${D ? D.icon : ''} ${TR(b.name)}</span>${stars < 0 ? '' : SCENE.starsHTML(stars, popIdx, SCENE.starMax(b.key))}${info.sub ? `<span class="mk-val ${b.compact ? 'sm' : ''} ${info.vcls}">${info.sub}</span>` : ''}</button>`);
  }
  const html = parts.join('');
  if (html !== lastMarkersHTML) { lastMarkersHTML = html; document.getElementById('markers').innerHTML = html; }
}


function renderEvents() {
  /* ย้ายไปอยู่ในแท็บรายงานแล้ว — เหลือไว้กันโค้ดเดิมเรียก (no-op ถ้าไม่มีกล่อง) */
  const el = document.getElementById('eventList'); if (!el) return;
  el.innerHTML = state.log.slice(0, 3).map(l => `<li class="${l.kind}"><b>D${l.day}</b><span>${l.text}</span></li>`).join('');
}

/* ตัวเลขลอยเหนืออาคาร (พิกัดเวที) */
function floatAt(key, text, neg = false) {
  const p = SCENE.placed[key]; if (!p) return;
  const [wx, wy] = p.lbl ? p.lbl : [p.left + p.w / 2, p.top];
  const x = Cam.x + wx * Cam.z, y = Cam.y + (wy - 30) * Cam.z;
  const el = document.createElement('div'); el.className = 'float' + (neg ? ' neg' : ''); el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = 'translateX(-50%)';
  document.getElementById('floats').appendChild(el); setTimeout(() => el.remove(), 1700);
}
function dayFlash(day) {
  const el = document.getElementById('dayFlash');
  el.textContent = 'วันที่ ' + day;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

/* ---------- เหตุฉุกเฉิน ---------- */
function showEmergencyModal() {
  const E = state.emergency; if (!E) return;
  const def = EMERGENCIES.find(d => d.id === E.id), teamLv = dStar(state, 'ert'), qcLv = dStar(state, 'qc');
  const left = Math.max(0, E.deadlineH - E.elapsedH);
  const opts = def.options.map((o, i) => {
    const locked = (o.needTeam && teamLv < o.needTeam) || (o.needQC && qcLv < o.needQC);
    return `<button class="emer-opt ${locked ? 'locked' : ''}" data-action="emerChoice" data-i="${i}" ${locked ? 'disabled' : ''}>
      <b>${TR(o.label)}</b>${o.cost ? ` <span class="cost">฿${fmtM(o.cost)}</span>` : ` <span class="cost free">${TR('ฟรี')}</span>`}
      <span class="d">${TR(o.desc)}${o.hours ? ` · ${TR('ใช้เวลา ~')}${Math.max(1, Math.round(o.hours * (o.needTeam ? up(state, 'ert', 'ertTime') : 1)))} ${TR('ชม.')}` : ''}</span>
      ${locked ? `<span class="d lock">🔒 ${TR('ต้องมี')}${o.needQC ? TR('ทีมคุณภาพ (ทีม 17)') : TR('ทีมตอบสนองเหตุฉุกเฉิน (ทีม 15)')} ${TR('อย่างน้อย')} ${o.needQC || o.needTeam} ${TR('ดาว')}</span>` : ''}</button>`;
  }).join('');
  showModal(`<h2 style="color:#ff8a8a">🚨 ${TR('เหตุฉุกเฉิน')}: ${TR(def.name)}</h2>
    <p><u style="text-decoration:none;color:var(--gold)">${TR('สาเหตุ')}</u> ${TR(def.cause)}${E.station ? ` · ${TR('ที่')} ${TR(STATION_META[E.station].name)}` : ''}</p>
    ${def.fix ? `<div class="ev-advice">💡 <b>${TR('คำแนะนำ')}:</b> ${TR(def.fix)}</div>` : ''}
    <p class="tip">${TR('ต้องตัดสินใจภายใน')} <b class="dn">${left.toFixed(1)} ${TR('ชม.')}</b> ${TR('(เวลาในเกม) ไม่เช่นนั้นระบบจะเลือกทางที่แย่ที่สุด')} · ${TR('ทีมฉุกเฉิน')} ${teamLv} ${TR('ดาว')} · ${TR('ทีมคุณภาพ')} ${qcLv} ${TR('ดาว')}</p>
    <div class="emer-opts">${opts}</div>`);
}
function showDecisionModal(d) {
  const ev = EVENTS.find(e => e.id === d.evId); if (!ev) return;
  const left = Math.max(0, d.deadlineH - d.elapsedH), def = ev.choices[ev.defaultChoice || 0];
  showModal(`<h2>${ev.icon} ${TR(ev.name)}</h2>
    <p><u style="text-decoration:none;color:var(--gold)">${TR('สถานการณ์')}</u> ${TR(ev.cause)}</p>
    ${ev.effect ? `<p class="ev-effect">⚠️ ${TR('ผลกระทบ')}: ${TR(ev.effect)}</p>` : ''}
    ${ev.fix ? `<div class="ev-advice">💡 <b>${TR('คำแนะนำ')}:</b> ${TR(ev.fix)}</div>` : ''}
    <p class="tip">${TR('ตัดสินใจภายใน')} <b>${left.toFixed(1)} ${TR('ชม.')}</b> ${TR('(เวลาในเกม) ไม่เช่นนั้นระบบใช้')} "${TR(def.label)}"</p>
    <div class="emer-opts">${ev.choices.map((c, i) => `<button class="emer-opt dec" data-action="decide" data-ev="${ev.id}" data-i="${i}"><b>${TR(c.label)}</b><span class="d">${TR(c.desc)}</span></button>`).join('')}</div>`);
}
function renderEmergencyBanner() {
  let b = document.getElementById('emerBanner');
  const E = state.emergency;
  if (!E) {
    const d = state.decisions[0];
    if (!d) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('button'); b.id = 'emerBanner'; b.dataset.action = 'emerShow'; document.getElementById('stage').appendChild(b); }
    const ev = EVENTS.find(e => e.id === d.evId);
    b.className = 'decision waiting';
    b.innerHTML = `${ev.icon} <b>${TR(ev.name)}</b> — ${TR('รอตัดสินใจ อีก')} ${Math.max(0, d.deadlineH - d.elapsedH).toFixed(1)} ${TR('ชม.')} <span class="act">${TR('คลิกเพื่อเลือก')}</span>`;
    return;
  }
  if (b) b.className = '';
  if (!b) { b = document.createElement('button'); b.id = 'emerBanner'; b.dataset.action = 'emerShow'; document.getElementById('stage').appendChild(b); }
  const def = EMERGENCIES.find(d => d.id === E.id);
  b.innerHTML = E.choice === null
    ? `${def.icon} <b>${TR(def.name)}</b> — ${TR('รอคำสั่งการ อีก')} ${Math.max(0, E.deadlineH - E.elapsedH).toFixed(1)} ${TR('ชม.')} <span class="act">${TR('คลิกเพื่อตัดสินใจ')}</span>`
    : `${def.icon} <b>${TR(def.name)}</b> — ${TR('กำลังแก้ไข')}: ${TR(E.optLabel)} (${TR('เหลือ')} ${Math.max(0, E.resolveAtH - E.elapsedH).toFixed(1)} ${TR('ชม.')})`;
  b.classList.toggle('waiting', E.choice === null);
}
function showEventBanner(evs) {
  showModal(`<h2>📢 เหตุการณ์วันที่ ${state.day - 1}</h2>
    ${evs.map(e => `<div class="ev"><span class="ic">${e.icon}</span><div>
      <b>${e.name}</b>
      <span><u>สาเหตุ</u> ${e.cause}</span>
      <span><u>ผลกระทบ</u> ${e.effect}</span>
      <span class="fix"><u>ทางแก้</u> ${e.fix}</span></div></div>`).join('')}
    <div class="modal-actions"><button class="btn primary" data-action="closeModal">รับทราบ</button></div>`);
}

/* แปลปุ่มเมนูล่าง (HTML คงที่) ตามภาษา */
function syncBottomNav() {
  const m = { overview: ['📊', 'Overview', 'ภาพรวม'], production: ['🏭', 'Production', 'การผลิต'], kpi: ['🎯', 'KPI', 'KPI'],
    orders: ['📋', 'Orders', 'คำสั่งซื้อ'], finance: ['💰', 'Finance', 'การเงิน'], upgrades: ['⬆️', 'Upgrade', 'อัปเกรด'],
    advisor: ['🧑‍💼', 'Advisor', 'ที่ปรึกษา'], reports: ['📈', 'Report', 'รายงาน'] };
  document.querySelectorAll('#bottomNav button[data-tab]').forEach(b => {
    const t = m[b.dataset.tab]; if (!t) return;
    const badge = b.querySelector('.nav-badge');
    b.innerHTML = `<span>${t[0]}</span>${LANG === 'en' ? t[1] : t[2]}` + (badge ? badge.outerHTML : '');
  });
}

/* ============================ Drawer ============================ */
const TAB_TITLES = {
  overview: '📊 ภาพรวม', production: '🏭 การผลิต', kpi: '🎯 รายงานประจำวัน',
  orders: '📋 คำสั่งซื้อ', finance: '💰 การเงิน', upgrades: '⬆️ ลงทุนและอัปเกรด',
  advisor: '🧑‍💼 ที่ปรึกษา', reports: '📈 รายงานฤดูกาล', settings: '⚙️ ตั้งค่า',
};

function renderDrawer() {
  const dr = document.getElementById('drawer');
  dr.classList.remove('hidden');
  document.getElementById('app').classList.add('drawer-open');
  document.querySelectorAll('#bottomNav button').forEach(b => b.classList.toggle('active', b.dataset.tab === UI.tab));
  let title = TR(TAB_TITLES[UI.tab] || '');
  if (UI.station && STATION_META[UI.station]) title = `🏭 ${TR(STATION_META[UI.station].name)} (${STATION_META[UI.station].en})`;
  document.getElementById('drawerTitle').textContent = title;
  const body = document.getElementById('drawerBody');
  const sc = body.scrollTop;
  body.innerHTML = drawerHTML();
  translateDOM(body);
  body.scrollTop = sc;
  if (UI.tab === 'overview' || UI.tab === 'finance' || UI.tab === 'reports') drawCharts();
}
/* อัปเดตเฉพาะตัวเลขสด ๆ โดยไม่ทำลาย input ที่กำลังลาก */
function renderDrawerLive() {
  if (document.activeElement && document.activeElement.matches('input[type=range]')) return;
  const body = document.getElementById('drawerBody');
  if (!body) return;
  if (UI.tab === 'upgrades' || UI.tab === 'settings') return;
  const sc = body.scrollTop;
  body.innerHTML = drawerHTML();
  translateDOM(body);
  body.scrollTop = sc;
  if (UI.tab === 'overview' || UI.tab === 'finance' || UI.tab === 'reports') drawCharts();
}

function drawerHTML() {
  switch (UI.tab) {
    case 'overview': return viewOverview();
    case 'production': return UI.station ? stationPanel(UI.station) : viewProduction();
    case 'kpi': return viewKPI();
    case 'orders': return viewOrders();
    case 'finance': return viewFinance();
    case 'upgrades': return viewUpgrades();
    case 'advisor': return viewAdvisor();
    case 'reports': return viewReports();
    case 'settings': return viewSettings();
  }
  return '';
}

/* ---------- ชิ้นส่วน UI ---------- */
function healthBar(key) {
  const st = state.dept[key];
  if (!st || st.power === undefined) return '';
  const cls = st.power < 25 ? 'low' : st.power < 50 ? 'mid' : '';
  return `<div class="kv"><span class="k">ค่าพลังเครื่องจักร</span>
    <span class="v ${st.power < 25 ? 'bad' : st.power < 50 ? 'warn' : 'good'}">${Math.round(st.power)}%</span></div>
    <div class="bar health ${cls}"><i style="width:${st.power}%"></i></div>`;
}
function maintBtn(key) {
  const st = state.dept[key];
  if (!st) return '';
  if (st.downH > 0) return `<button class="btn sm danger" disabled>พังอยู่ ${st.downH.toFixed(1)} ชม.</button>`;
  return `<button class="btn sm" data-action="quickRepair" data-id="${key}">🔧 ซ่อมด่วน</button>`;
}
function stTag(key) { const st = stStatus(key); return `<span class="st ${st.cls}">${st.txt}</span>`; }
function slider(id, label, min, max, step, val, disp, tip) {
  const locked = state.ctrl.autoTune;
  return `<div class="ctrl ${locked ? 'locked' : ''}"><div class="ctrl-head"><span>${label}</span><b>${disp}</b></div>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" ${locked ? 'disabled' : ''}>
    ${tip ? `<div class="tip">${tip}</div>` : ''}</div>`;
}
function autoCard() {
  const on = state.ctrl.autoTune;
  return `<div class="card auto-card"><label class="chk"><input type="checkbox" id="cAuto" ${on ? 'checked' : ''}> 🤖 ผู้ช่วยตั้งค่ากระบวนการ ${on ? '(เปิด)' : '(ปิด — ปรับเองทุกค่า)'}</label>
    <div class="tip">${on ? 'ผู้ช่วยปรับ pH, imbibition, Brix, น้ำล้าง และอัตราหีบให้พอดีกับคอขวด — คุณโฟกัสที่การลงทุนแผนก การเร่งเครื่อง และการตัดสินใจ' : 'ปิดผู้ช่วยแล้ว ทุกค่าอยู่ในมือคุณ'}</div></div>`;
}
function kpiChip(specKey) {
  const spec = KPI_SPEC.find(x => x.k === specKey);
  const v = state.kpi[specKey];
  const lv = kpiLevel(spec, v);
  return `<span class="kchip kpi-${lv}">${spec.name} ${v === undefined || !isFinite(v) ? '-' : v.toFixed(1)}${spec.unit === '%' ? '%' : ''}</span>`;
}
/* แผงรายสถานี = แผงแผนก (ui-dept.js) */
function stationPanel(key) {
  const id = (STATION_META[key] && STATION_META[key].dept) || key;
  return deptPanel(DEPT_BY_ID[id] ? id : 'mill');
}
function viewOverview() {
  const s = state, t = s.today, K = s.kpi;
  return startBar() + `<div class="flow">
      <div>อ้อยหีบ<b>${fmt(t.milled)}</b>ตัน</div><div>น้ำอ้อย MJ<b>${fmt(t.rawJuice)}</b>ตัน</div>
      <div>น้ำใส<b>${fmt(t.clearJuice)}</b>ตัน</div><div>น้ำเชื่อม<b>${fmt(t.syrup)}</b>ตัน</div>
      <div>น้ำตาล<b>${fmt(t.sugar, 1)}</b>ตัน</div><div>โมลาส<b>${fmt(t.molasses, 1)}</b>ตัน</div></div>
    <div class="kchips">${['extraction', 'recovery', 'bhr', 'ptyFM', 'steamOnCane', 'timeEff'].map(kpiChip).join('')}</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="k">ผลผลิตน้ำตาล</div><div class="v">${fmt(K.yieldKgPerTon || 0, 0)} <small>กก./ตันอ้อย</small></div></div>
      <div class="kpi"><div class="k">กำไรวันล่าสุด</div><div class="v ${lastProfit() >= 0 ? 'up' : 'dn'}">฿${fmtM(lastProfit())}</div></div>
      <div class="kpi"><div class="k">อ้อยหีบสะสม</div><div class="v">${fmt(s.totals.cane)} <small>ตัน</small></div></div>
      <div class="kpi"><div class="k">น้ำตาลสะสม</div><div class="v">${fmt(s.totals.sugar)} <small>ตัน</small></div></div></div>
    ${scoreCardHTML()}
    <div class="card"><h3>🎯 เป้าหมายฤดูกาล (🔥 โหมดยาก)</h3>${seasonGoals(s).map(m => `<div class="kv"><span class="k"><span class="cb ${m.done ? 'done' : ''}" style="width:16px;height:16px;font-size:11px">${m.done ? '✓' : ''}</span> ${m.text}</span></div>`).join('')}</div>
    ${bottleneckHTML()}
    <div class="chart-title">Overall Recovery (%)</div><canvas class="chart" data-chart="recovery"></canvas>
    <div class="chart-title">เงินสด (฿)</div><canvas class="chart" data-chart="cash"></canvas>
    <div class="card"><h3>คำแนะนำเร่งด่วน</h3>${(s.hints || []).slice(0, 4).map(h => `<div class="hint ${h.lvl}">${h.text}</div>`).join('')}</div>`;
}
function lastProfit() { const h = state.history; return h.length ? h[h.length - 1].profit : 0; }

/* ---------- รายงานประจำวัน (ผังเดียวกับโรงงานจริง) ---------- */
function viewKPI() {
  const s = state, K = s.kpi, t = s.today, T = s.totals;
  const row = (name, today, todate, target) =>
    `<tr><td>${name}</td><td>${today}</td><td>${todate}</td><td class="tgt">${target || ''}</td></tr>`;
  const kpiRow = spec => {
    const v = K[spec.k];
    const lv = kpiLevel(spec, v);
    return `<tr class="kpi-${lv}"><td>${spec.name}</td><td>-</td>
      <td><b>${v === undefined || !isFinite(v) ? '-' : v.toFixed(2)}</b> ${spec.unit}</td>
      <td class="tgt">${spec.hi ? '≥' : '≤'} ${spec.good}</td></tr>`;
  };
  const polTot = T.polCane || 1;
  return `<div class="card"><h3>รายงานประจำวัน — วันที่ ${s.day}</h3>
      <table class="rep"><thead><tr><th>รายการ</th><th>วันนี้</th><th>สะสม</th><th>เป้า</th></tr></thead><tbody>
      <tr class="sec"><td colspan="4">อ้อย (Cane)</td></tr>
      ${row('อ้อยหีบ (ตัน)', fmt(t.milled), fmt(T.cane), '')}
      ${row('อัตราหีบ (ตัน/ชม.)', fmt(K.tch || 0, 1), '', fmt(proc(s).millTph, 0))}
      ${row('CCS', (K.ccs || 0).toFixed(2), '', '')}
      ${row('Pol % Cane', t.milled > 0 ? (t.polCane / t.milled * 100).toFixed(2) : '-', '', '')}
      ${row('Fibre % Cane', t.milled > 0 ? (t.fibreCane / t.milled * 100).toFixed(2) : '-', '', '12-14')}
      ${row('Trash %', (t.trash || 0).toFixed(1), '', '< 5')}
      ${row('อ้อยค้างลาน (ชม.)', oldestAgeH(s).toFixed(0), '', '< 24')}

      <tr class="sec"><td colspan="4">โรงหีบ (Milling House)</td></tr>
      ${row('Preparation Index', (K.pi || 0).toFixed(0), '', '≥ 92')}
      ${row('Imbibition % Fibre', fmt(s.ctrl.imbibition), '', '250-300')}
      ${row('Bagasse % Cane', t.milled > 0 ? (t.bagasse / t.milled * 100).toFixed(1) : '-', (K.bagPctCane || 0).toFixed(1), '25-30')}
      ${row('Pol % Bagasse', proc(s).polBagPct.toFixed(2), (K.polBagPct || 0).toFixed(2), '≤ 2.0')}
      ${row('Extraction % Pol', '-', (K.extraction || 0).toFixed(2), '≥ 96.5')}

      <tr class="sec"><td colspan="4">สมดุลและการนำกลับ (Balance &amp; Recovery)</td></tr>
      ${row('Pol อ้อย (ตัน)', fmt(t.polCane, 1), fmt(T.polCane, 0), '')}
      ${row('Pol น้ำตาล (ตัน)', '-', fmt(T.polSugar, 0), '')}
      ${row('Overall Recovery %', '-', (K.recovery || 0).toFixed(2), '≥ 84')}
      ${row('BHR %', '-', (K.bhr || 0).toFixed(2), '≥ 88')}
      ${row('Purity น้ำเชื่อม', '-', (K.ptySyrup || 0).toFixed(2), '≥ 84')}
      ${row('Final Molasses Purity', (t.ptyFM || 0).toFixed(2), '', '≤ 33')}
      <tr class="loss"><td>สูญเสียในชานอ้อย %</td><td>-</td><td>${(K.lossBag || 0).toFixed(2)}</td><td class="tgt">≤ 3.0</td></tr>
      <tr class="loss"><td>สูญเสียใน filter cake %</td><td>-</td><td>${(K.lossFC || 0).toFixed(2)}</td><td class="tgt">≤ 0.33</td></tr>
      <tr class="loss"><td>สูญเสียในโมลาสสุดท้าย %</td><td>-</td><td>${(K.lossFM || 0).toFixed(2)}</td><td class="tgt">≤ 7.7</td></tr>
      <tr class="loss"><td>Undetermined Loss %</td><td>-</td><td>${(K.undet || 0).toFixed(2)}</td><td class="tgt">≤ 2.5</td></tr>

      <tr class="sec"><td colspan="4">ไอน้ำและไฟฟ้า (Steam &amp; Power)</td></tr>
      ${row('ไอน้ำผลิต (ตัน)', fmt(t.steamMade), fmt(T.steam), '')}
      ${row('Steam on Cane %', '-', (K.steamOnCane || 0).toFixed(1), '≤ 50')}
      ${row('ไฟฟ้าผลิต (MWh)', fmt(t.kwh / 1000, 1), fmt(T.kwh / 1000, 0), '')}
      ${row('ไฟฟ้าขาย (kWh/ตันอ้อย)', '-', (K.kwhPerTc || 0).toFixed(1), '≥ 22')}
      ${row('ชานอ้อยคงเหลือ (ตัน)', fmt(s.stock.bagasse), '', '')}

      <tr class="sec"><td colspan="4">บัญชีเวลา (Time Account)</td></tr>
      ${row('ชม. เดินเครื่อง', t.runH.toFixed(1), T.runH.toFixed(0), '')}
      ${row('ชม. หยุดเสีย', t.downH.toFixed(1), T.downH.toFixed(0), '')}
      ${row('ชม. หยุดรออ้อย', t.noCaneH.toFixed(1), T.noCaneH.toFixed(0), '')}
      ${row('Overall Time Efficiency %', '-', (K.timeEff || 0).toFixed(1), '≥ 90')}
      </tbody></table></div>

    <div class="card"><h3>KPI เทียบเกณฑ์โลก</h3>
      <table class="rep"><thead><tr><th>KPI</th><th></th><th>ค่าปัจจุบัน</th><th>เป้า</th></tr></thead>
      <tbody>${KPI_SPEC.map(kpiRow).join('')}</tbody></table>
      <div class="tip">🟩 ระดับโลก · 🟨 ตามเกณฑ์ · 🟧 พอใช้ · 🟥 ต่ำกว่าเกณฑ์</div></div>

    <div class="card"><h3>สมดุล Pol (ตรวจว่าปิดหรือไม่)</h3>
      <div class="bal">
        <div class="bal-row"><span>น้ำตาล</span><i style="width:${(T.polSugar / polTot * 100).toFixed(1)}%;background:#4cd47a"></i><b>${(T.polSugar / polTot * 100).toFixed(2)}%</b></div>
        <div class="bal-row"><span>ชานอ้อย</span><i style="width:${(T.polBag / polTot * 100).toFixed(1)}%;background:#c99a52"></i><b>${(T.polBag / polTot * 100).toFixed(2)}%</b></div>
        <div class="bal-row"><span>โมลาส</span><i style="width:${(T.polFM / polTot * 100).toFixed(1)}%;background:#b06a22"></i><b>${(T.polFM / polTot * 100).toFixed(2)}%</b></div>
        <div class="bal-row"><span>Filter cake</span><i style="width:${(T.polFC / polTot * 100).toFixed(1)}%;background:#8b8f94"></i><b>${(T.polFC / polTot * 100).toFixed(2)}%</b></div>
        <div class="bal-row"><span>Undetermined</span><i style="width:${(K.undet || 0).toFixed(1)}%;background:#ff5c5c"></i><b>${(K.undet || 0).toFixed(2)}%</b></div>
      </div>
      <div class="tip">รวมต้องได้ 100% ของ Pol ในอ้อย — ทุกจุดที่บาน คือเงินที่ไหลออกจากโรงงาน</div></div>`;
}

/* ---------- ออร์เดอร์ ---------- */
function viewOrders() {
  const s = state;
  const open = s.orders.filter(o => o.status === 'open');
  const acc = s.orders.filter(o => o.status === 'accepted');
  const hist = s.orders.filter(o => ['delivered', 'failed', 'expired', 'rejected'].includes(o.status)).slice(-8).reverse();
  const card = (o, actions) => `<div class="order ${o.urgent ? 'urgent' : ''}">
      <div class="o-head"><span>${o.id} · ${o.customer} ${o.urgent ? '<span class="tag urgent">ด่วน</span>' : ''}</span><span>฿${fmtM(o.tons * o.price)}</span></div>
      <div class="o-meta"><b>${fmt(o.tons)} ตัน</b> @ ฿${fmt(o.price)}/ตัน (${o.price > s.market.sugarPrice ? '+' : ''}${Math.round((o.price / s.market.sugarPrice - 1) * 100)}% เทียบตลาด) · ส่งภายในวันที่ <b>${o.deadline}</b></div>
      <div class="row">${actions}</div></div>`;
  return `<div class="tip">คลัง ${fmt(s.stock.sugar)} ตัน · ราคาตลาด ฿${fmt(s.market.sugarPrice)} · ส่งไม่ทันปรับ 8% และชื่อเสียง −8</div>
    <div class="grp">ออร์เดอร์ใหม่ (${open.length})</div>
    ${open.map(o => card(o, `<button class="btn primary sm" data-action="accept" data-id="${o.id}">รับงาน</button><button class="btn sm" data-action="reject" data-id="${o.id}">ปฏิเสธ</button>`)).join('') || '<div class="tip">ยังไม่มีออร์เดอร์ใหม่</div>'}
    <div class="grp">กำลังดำเนินการ (${acc.length})</div>
    ${acc.map(o => card(o, `<button class="btn good sm" data-action="deliver" data-id="${o.id}" ${s.stock.sugar < o.tons ? 'disabled' : ''}>🚚 ส่งมอบ</button>${s.stock.sugar < o.tons ? `<span class="tip">ขาดอีก ${fmt(o.tons - s.stock.sugar)} ตัน</span>` : ''}`)).join('') || '<div class="tip">ไม่มีออร์เดอร์ที่รับไว้</div>'}
    <div class="grp">ประวัติ</div>
    ${hist.map(o => `<div class="kv"><span class="k">${o.id} ${o.customer} ${fmt(o.tons)} ตัน</span>
      <span class="v"><span class="tag ${o.status === 'delivered' ? 'ok' : o.status === 'failed' ? 'fail' : ''}">${({ delivered: 'ส่งแล้ว', failed: 'ไม่ทัน', expired: 'หมดอายุ', rejected: 'ปฏิเสธ' })[o.status]}</span></span></div>`).join('') || '<div class="tip">-</div>'}`;
}

/* ---------- การเงิน ---------- */
function viewFinance() {
  const s = state, t = s.yesterday && s.yesterday.hours > 0 ? s.yesterday : s.today;
  const rev = t.salesRev + t.molassesRev + t.powerRev;
  const cost = t.caneCost + t.labor + t.chemicals + t.fixed + t.repair + t.fuelCost + t.dumpCost + t.waterFine + t.penalty + t.finalPayment + t.cleanCost;
  const r = (k, v, cls) => `<tr><td>${k}</td><td class="${cls || ''}">฿${fmt(v)}</td></tr>`;
  return `<div class="kpi-grid">
      <div class="kpi"><div class="k">เงินสด</div><div class="v ${s.cash < 0 ? 'dn' : ''}">฿${fmtM(s.cash)}</div></div>
      <div class="kpi"><div class="k">กำไรสะสม</div><div class="v ${netWorth(s) - CONFIG.startCash >= 0 ? 'up' : 'dn'}">฿${fmtM(netWorth(s) - CONFIG.startCash)}</div></div>
      <div class="kpi"><div class="k">หนี้เงินกู้</div><div class="v ${s.loan > 0 ? 'dn' : 'up'}">฿${fmtM(s.loan)}</div></div>
      <div class="kpi"><div class="k">ค่าอ้อยค้างจ่าย</div><div class="v dn">฿${fmtM(s.payable.accrued + s.payable.amount)}</div></div>
      <div class="kpi"><div class="k">ค่าจ้างค้างจ่าย</div><div class="v dn">฿${fmtM(s.wagesAccrued)}</div></div>
      <div class="kpi"><div class="k">มูลค่าสต๊อกน้ำตาล</div><div class="v">฿${fmtM(s.stock.sugar * s.market.sugarPrice)}</div></div></div>
    ${loanCard()}
    <div class="card"><h3>งบวันล่าสุด</h3><table class="fin">
      ${r('ขายน้ำตาล', t.salesRev, 'up')}${r('ขายกากน้ำตาล (ขายเอง)', t.molassesRev, 'up')}${r('ขายไฟฟ้า + ชานอ้อย', t.powerRev, 'up')}
      <tr class="total"><td>รวมรายรับ</td><td class="up">฿${fmt(rev)}</td></tr>
      ${r('ค่าอ้อยขั้นต้น', t.caneCost, 'dn')}${r('ค่าแรง', t.labor, 'dn')}${r('ปูนขาว/สารเคมี', t.chemicals, 'dn')}
      ${r('ค่าใช้จ่ายคงที่ (เงินเดือน/ดอกเบี้ย/บริหาร)', t.fixed, 'dn')}${r('ซ่อมบำรุง', t.repair, 'dn')}${r('วันหยุดล้างเครื่อง', t.cleanCost, 'dn')}
      ${r('น้ำมันเตา', t.fuelCost, 'dn')}${r('กำจัดอ้อยเน่า', t.dumpCost, 'dn')}${r('ค่าปรับน้ำเสีย', t.waterFine, 'dn')}
      ${r('ค่าปรับ/ค่าเสียหายจากเหตุการณ์', t.penalty, 'dn')}${r('ค่าอ้อยขั้นสุดท้าย', t.finalPayment, 'dn')}${r('ดอกเบี้ยเงินกู้', t.interest || 0, 'dn')}
      <tr class="total"><td>รวมรายจ่าย</td><td class="dn">฿${fmt(cost)}</td></tr>
      <tr class="total"><td>กำไรสุทธิ</td><td class="${rev - cost >= 0 ? 'up' : 'dn'}">฿${fmt(rev - cost)}</td></tr></table>
      <div class="tip">ค่าอ้อยสะสมจ่ายทุก ${CONFIG.canePayEvery} วัน · ค่าจ้างทุก ${CONFIG.wagePayEvery} วัน · ค่าอ้อยขั้นสุดท้ายวันที่ ${CONFIG.caneFinalDays.join(' และ ')}</div></div>
    <div class="chart-title">กำไร/วัน (฿)</div><canvas class="chart" data-chart="profit"></canvas>
    <div class="chart-title">ราคาน้ำตาล (฿/ตัน)</div><canvas class="chart" data-chart="price"></canvas>`;
}

/* การ์ดเงินกู้ */
function loanCard() {
  const s = state;
  const rate = loanRate(s) * 100;
  const nextTier = ECON.loanRateStepAt - (s.loan % ECON.loanRateStepAt);
  return `<div class="card"><h3>🏦 เงินกู้</h3>
    <div class="kv"><span class="k">หนี้คงเหลือ</span><span class="v ${s.loan > 0 ? 'bad' : 'good'}">฿${fmt(Math.round(s.loan))}</span></div>
    <div class="kv"><span class="k">อัตราดอกเบี้ยปัจจุบัน</span><span class="v ${rate > 10 ? 'bad' : ''}">${rate.toFixed(1)}% ต่อปี</span></div>
    <div class="kv"><span class="k">ดอกเบี้ยจ่ายสะสม</span><span class="v dn">฿${fmt(Math.round(s.totals.costInterest))}</span></div>
    <div class="kv"><span class="k">วงเงินคงเหลือ</span><span class="v">฿${fmtM(creditLeft(s))} / ฿${fmtM(creditLimit(s))}</span></div>
    <div class="row" style="margin-top:8px">
      <button class="btn primary sm" data-action="openBank">🏦 กู้เงินจากธนาคาร</button>
      ${s.loan > 0 ? `<button class="btn sm" data-action="repay" data-v="all" ${s.cash < 1 ? 'disabled' : ''}>ชำระเท่าที่มีเงินสด</button>` : ''}</div>
    ${s.loan > 0 ? `<div class="tip">กู้เพิ่มอีก ฿${fmtM(nextTier)} ดอกเบี้ยฐานจะขึ้นเป็น ${(rate + ECON.loanRateStep * 100).toFixed(1)}%</div>`
      : '<div class="tip good">ไม่มีหนี้ — เงินสดติดลบเมื่อไรระบบจะกู้ให้อัตโนมัติทีละ ฿1 ล้าน</div>'}
    <div class="tip">ดอกเบี้ยฐาน ${(ECON.loanRateBase * 100).toFixed(0)}%/ปี และเพิ่ม ${(ECON.loanRateStep * 100).toFixed(0)}%/ปี ทุกยอดกู้ ฿${fmtM(ECON.loanRateStepAt)} (ความเสี่ยงเครดิต)</div></div>`;
}

/* ============================ ธนาคาร (เลือกจำนวน + ระยะสั้น/ยาว) ============================ */
function showBankModal() {
  const s = state;
  const amounts = [10, 25, 50, 100].map(m => m * 1_000_000);
  const left = creditLeft(s);
  if (UI.bankAmt > left) UI.bankAmt = Math.min(UI.bankAmt, Math.max(0, left));
  const amt = UI.bankAmt, type = UI.bankType;
  const projRate = (loanRate({ loan: s.loan + amt }) * typeRateMul(type) * 100);      // ดอกเบี้ยหลังกู้ก้อนนี้
  const canBorrow = amt > 0 && amt <= left;
  const typeBtn = (v, name, sub) => `<button class="bank-type ${type === v ? 'on' : ''}" data-action="bankType" data-v="${v}"><b>${name}</b><span>${sub}</span></button>`;
  const amtBtn = a => `<button class="bank-amt ${amt === a ? 'on' : ''} ${a > left ? 'off' : ''}" data-action="bankAmt" data-v="${a}" ${a > left ? 'disabled' : ''}>฿${fmtM(a)}</button>`;
  const debts = (s.debts || []).filter(d => d.principal > 1);
  showModal(`<div class="bank-modal">
    <h2>🏦 ธนาคารสินเชื่อโรงงาน</h2>
    <div class="bank-status">
      <div><span class="k">หนี้คงเหลือ</span><b class="${s.loan > 0 ? 'dn' : 'up'}">฿${fmtM(s.loan)}</b></div>
      <div><span class="k">วงเงินคงเหลือ</span><b>฿${fmtM(left)}</b></div>
      <div><span class="k">ดอกเบี้ยฐานปัจจุบัน</span><b>${(loanRate(s) * 100).toFixed(1)}%/ปี</b></div>
    </div>
    <div class="bank-sec-t">1 · เลือกประเภทเงินกู้</div>
    <div class="bank-types">
      ${typeBtn('short', 'ระยะสั้น', `ดอกเบี้ย ${(ECON.shortRateMul * 100).toFixed(0)}% ของฐาน · คืนใน ${ECON.shortTermDays} วัน`)}
      ${typeBtn('long', 'ระยะยาว', `ดอกเบี้ย ${(ECON.longRateMul * 100).toFixed(0)}% ของฐาน · ผ่อนทั้งฤดู`)}
    </div>
    <div class="bank-note">${type === 'short'
      ? `💡 ระยะสั้น: ดอกถูกกว่า แต่ต้อง<b>คืนภายใน ${ECON.shortTermDays} วัน</b> (ครบวันที่ ${s.day + ECON.shortTermDays}) มิฉะนั้นดอกเบี้ยพุ่ง ${ECON.overdueRateMul}x`
      : `💡 ระยะยาว: ดอกแพงกว่าเล็กน้อย แต่<b>ไม่มีกำหนดคืน</b> ผ่อนได้ยาวทั้งฤดู เหมาะกับการลงทุนขยายกำลัง`}</div>
    <div class="bank-sec-t">2 · จำนวนเงินที่จะกู้</div>
    <div class="bank-amts">${amounts.map(amtBtn).join('')}</div>
    <input class="bank-range" id="bankRange" type="range" min="1000000" max="${Math.max(1_000_000, left)}" step="1000000" value="${Math.min(amt, left) || 1_000_000}" ${left < 1 ? 'disabled' : ''}>
    <div class="bank-preview">
      กู้ <b>฿${fmtM(amt)}</b> แบบ<b>${type === 'short' ? 'ระยะสั้น' : 'ระยะยาว'}</b> · ดอกเบี้ยประมาณ <b class="${projRate > 14 ? 'dn' : 'up'}">${projRate.toFixed(1)}%/ปี</b>
      ${type === 'short' ? ` · ครบกำหนดวันที่ <b>${s.day + ECON.shortTermDays}</b>` : ''}
    </div>
    <div class="bank-actions">
      <button class="btn primary" data-action="bankBorrow" ${canBorrow ? '' : 'disabled'}>✅ กู้เงิน ฿${fmtM(amt)}</button>
      <button class="btn" data-action="closeModalBtn">ปิด</button>
    </div>
    ${debts.length ? `<div class="bank-sec-t">เงินกู้ที่มีอยู่</div>
      <div class="bank-list">${debts.map(d => `<div class="bank-row ${d.overdue ? 'overdue' : ''}">
        <span>${d.type === 'short' ? '⏱️ ระยะสั้น' : d.type === 'long' ? '📅 ระยะยาว' : '🤖 อัตโนมัติ'}${d.overdue ? ' · เลยกำหนด!' : d.type === 'short' ? ` · ครบวันที่ ${d.dueDay}` : ''}</span>
        <b>฿${fmtM(d.principal)}</b><small>${(debtRate(s, d) * 100).toFixed(1)}%/ปี</small></div>`).join('')}</div>
      <div class="bank-actions"><button class="btn sm" data-action="repay" data-v="10000000" ${s.cash < 1 ? 'disabled' : ''}>ชำระ ฿10M</button>
        <button class="btn sm primary" data-action="repay" data-v="all" ${s.cash < 1 ? 'disabled' : ''}>ชำระเท่าที่มีเงินสด (฿${fmtM(s.cash)})</button></div>` : ''}
  </div>`);
}

function viewAdvisor() {
  const s = state;
  return `<div class="card"><h3>🧑‍💼 วินิจฉัยจาก KPI</h3>
      ${(s.hints || []).map(h => `<div class="hint ${h.lvl}">${h.text}</div>`).join('')}</div>
    <div class="card"><h3>📜 บันทึกเหตุการณ์</h3>
      <ul class="log">${s.log.map(l => `<li class="${l.kind}"><b>D${l.day}</b><span>${l.text}</span></li>`).join('') || '<li>-</li>'}</ul></div>`;
}

/* ---------- รายงานฤดูกาล ---------- */
function viewReports() {
  const s = state, T = s.totals, K = s.kpi;
  return `<div class="card"><h3>🔔 เหตุการณ์ล่าสุด</h3>
      <ul class="log">${s.log.slice(0, 30).map(l => `<li class="${l.kind}"><b>D${l.day}</b><span>${l.text}</span></li>`).join('') || '<li class="info"><span>ยังไม่มีเหตุการณ์ — กดปุ่ม ▶ เริ่มหีบ เพื่อเดินเครื่อง</span></li>'}</ul></div>
    <div class="kpi-grid">
      <div class="kpi"><div class="k">อ้อยหีบรวม</div><div class="v">${fmt(T.cane)} <small>ตัน</small></div></div>
      <div class="kpi"><div class="k">น้ำตาลรวม</div><div class="v">${fmt(T.sugar)} <small>ตัน</small></div></div>
      <div class="kpi"><div class="k">ผลผลิตเฉลี่ย</div><div class="v">${fmt(K.yieldKgPerTon || 0, 0)} <small>กก./ตัน</small></div></div>
      <div class="kpi"><div class="k">ไฟฟ้าขายรวม</div><div class="v">${fmt(T.kwhExport / 1000, 0)} <small>MWh</small></div></div>
      <div class="kpi"><div class="k">เครื่องเสีย</div><div class="v">${T.breakdowns} <small>ครั้ง</small></div></div>
      <div class="kpi"><div class="k">อ้อยเน่าทิ้ง</div><div class="v">${fmt(T.caneRot)} <small>ตัน</small></div></div>
      <div class="kpi"><div class="k">ออร์เดอร์สำเร็จ/พลาด</div><div class="v">${T.ordersDone}/${T.ordersFailed}</div></div>
      <div class="kpi"><div class="k">ชื่อเสียง</div><div class="v">${Math.round(s.reputation)}%</div></div></div>
    <div class="chart-title">Overall Recovery (%)</div><canvas class="chart" data-chart="recovery"></canvas>
    <div class="chart-title">Extraction % Pol</div><canvas class="chart" data-chart="ext"></canvas>
    <div class="chart-title">Final Molasses Purity</div><canvas class="chart" data-chart="ptyFM"></canvas>
    <div class="chart-title">Steam on Cane (%)</div><canvas class="chart" data-chart="steam"></canvas>
    <div class="chart-title">Time Efficiency (%)</div><canvas class="chart" data-chart="timeEff"></canvas>
    <div class="card"><h3>อัปเกรดที่ติดตั้ง</h3>
      ${DEPTS.filter(d => dStar(s, d.id) > 0).map(d =>
        `<div class="kv"><span class="k">${d.icon} ${d.name}</span><span class="v">${dStar(s, d.id)} ดาว — ${d.levels[dStar(s, d.id)].name}</span></div>`).join('') || '<div class="tip">ยังไม่ได้ลงทุนแผนกใด ๆ</div>'}</div>
    <div class="row"><button class="btn" data-action="export">💾 ส่งออกเซฟ (JSON)</button></div>`;
}

function viewSettings() {
  const dl = CONFIG.dayLengthSec, ui = lsGet('sfm_ui') || 'm';
  const pick = (v, cur) => v === cur ? 'primary' : '';
  return `<div class="card"><h3>🔊 เสียง</h3>
      <div class="row"><button class="btn sm" data-action="music">${AudioSys.enabled ? '🔊 เพลงเปิด (กดปิด)' : '🔇 เพลงปิด (กดเปิด)'}</button>
        <span class="tip">ระดับเสียง</span>${[0.2, 0.5, 0.8, 1].map(v => `<button class="btn sm ${Math.abs(AudioSys.volume - v) < 0.01 ? 'primary' : ''}" data-action="vol" data-v="${v}">${Math.round(v * 100)}%</button>`).join('')}</div>
      <div class="tip">เพลงสร้างสดด้วย Web Audio (ไม่มีไฟล์เสียง) · กด M เพื่อเปิด/ปิด</div></div>
    <div class="card"><h3>⏱️ ความไวของเกม</h3>
      <div class="tip">ความยาว 1 วันในเกม ที่ความเร็ว 1x</div>
      <div class="row">${[6, 12, 20, 30, 45].map(v => `<button class="btn sm ${pick(v, dl)}" data-action="dayLen" data-v="${v}">${v} วินาที</button>`).join('')}</div>
      <div class="tip">ปุ่มความเร็ว 0.25x – 5x อยู่ใต้ปุ่มความเร็ว · คีย์ 1–7 (1 = 0.25x, 7 = 5x) · Space = หยุด/เดินต่อ</div>
      <div class="tip">ตอนนี้ 1 วันหีบ = ${(dl).toFixed(0)} วินาทีที่ 1x → เร็วสุด ${(dl / 5).toFixed(1)} วินาที · ช้าสุด ${(dl / 0.25).toFixed(0)} วินาที</div></div>
    <div class="card"><h3>🔠 ขนาดตัวหนังสือ</h3>
      <div class="row"><button class="btn sm ${pick('s', ui)}" data-action="uiSize" data-v="s">ปกติ</button><button class="btn sm ${pick('m', ui)}" data-action="uiSize" data-v="m">ใหญ่</button><button class="btn sm ${pick('l', ui)}" data-action="uiSize" data-v="l">ใหญ่มาก</button></div></div>
    <div class="card"><h3>บันทึก / เริ่มใหม่</h3>
      <div class="row"><button class="btn" data-action="save">💾 บันทึก</button>
      <button class="btn" data-action="export">📤 ส่งออก JSON</button>
      <button class="btn danger" data-action="newGame">🔄 เริ่มฤดูใหม่</button></div></div>
    <div class="card"><h3>คีย์ลัด</h3><div class="kv">
      <span class="k">Space</span><span class="v">หยุด/เดินต่อ</span>
      <span class="k">1-7</span><span class="v">ความเร็ว 0.25x - 5x</span>
      <span class="k">M</span><span class="v">เปิด/ปิดเพลง</span>
      <span class="k">Esc</span><span class="v">ปิดลิ้นชัก</span></div></div>
    <div class="card"><h3>สมการที่ใช้จำลอง</h3><div class="kv">
      <span class="k">CCS</span><span class="v">(Pol − (Bx−Pol)×0.4) × 0.74</span>
      <span class="k">Extraction</span><span class="v">100 − Pol ในชานอ้อย ÷ Pol อ้อย</span>
      <span class="k">Pol%Bagasse</span><span class="v">1.80 − 0.097×(PI−92) − imbibition</span>
      <span class="k">Inversion</span><span class="v">f(pH, retention) โค้ง U ต่ำสุด pH 7.0-7.2</span>
      <span class="k">น้ำระเหย</span><span class="v">MJ × (1 − Bx_in / Bx_out)</span>
      <span class="k">น้ำตาล</span><span class="v">Bx × (Pty − PtyFM) ÷ (99.3 − PtyFM)</span>
      <span class="k">BHR</span><span class="v">(Pty_s − Pty_FM) ÷ ((100−Pty_FM)×Pty_s) × 10⁴</span>
      <span class="k">GCV ชานอ้อย</span><span class="v">18,309 − 207.6×ความชื้น − 31.14×Bx</span></div>
      <div class="tip">อ้างอิง Peter Rein "Cane Sugar Engineering" (2007) และไฟล์ออกแบบโรงงาน 8,000 TCD</div></div>`;
}

/* ============================ charts ============================ */
function drawCharts() {
  const h = state.history.slice(-60);
  document.querySelectorAll('canvas.chart').forEach(cv => {
    const type = cv.dataset.chart;
    const M = {
      cash: ['cash', '#f5b942'], profit: ['profit', '#5cb3ff'], price: ['price', '#ff9a5c'],
      recovery: ['recovery', '#4cd47a'], ext: ['ext', '#b7f36b'], ptyFM: ['ptyFM', '#ff6fb5'],
      steam: ['steamOnCane', '#ffd27a'], timeEff: ['timeEff', '#9ad4ff'], sugar: ['sugar', '#4cd47a'],
    }[type] || ['cash', '#f5b942'];
    lineChart(cv, [h.map(x => x[M[0]] || 0)], [M[1]], h.map(x => x.day));
  });
}
function lineChart(cv, series, colors, labels) {
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 440, H = cv.clientHeight || 140;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const all = series.flat().filter(v => isFinite(v));
  if (all.length < 2) { ctx.fillStyle = '#7d8798'; ctx.font = '13px Kanit, sans-serif'; ctx.fillText('ยังไม่มีข้อมูล', 14, H / 2); return; }
  let min = Math.min(...all), max = Math.max(...all);
  if (min > 0) min = min * 0.92;
  if (max === min) max = min + 1;
  const pad = { l: 52, r: 10, t: 10, b: 20 };
  const x = i => pad.l + (i / Math.max(1, series[0].length - 1)) * (W - pad.l - pad.r);
  const y = v => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.fillStyle = '#8b96a8';
  ctx.font = '11px Kanit, sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i <= 3; i++) {
    const v = min + (max - min) * i / 3, yy = y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
    ctx.fillText(shortNum(v), pad.l - 6, yy + 4);
  }
  ctx.textAlign = 'center';
  if (labels.length) { ctx.fillText('D' + labels[0], x(0) + 10, H - 5); ctx.fillText('D' + labels[labels.length - 1], x(labels.length - 1) - 10, H - 5); }
  series.forEach((d, si) => {
    ctx.beginPath(); d.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
    ctx.strokeStyle = colors[si]; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineTo(x(d.length - 1), y(min)); ctx.lineTo(x(0), y(min)); ctx.closePath();
    ctx.fillStyle = colors[si] + '30'; ctx.fill();
  });
}
function shortNum(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(0) + 'k';
  return a >= 10 ? Math.round(v).toString() : v.toFixed(1);
}

/* ============================ modal ============================ */
function showModal(html, cls) { const c = document.getElementById('modalCard'); c.innerHTML = html; c.classList.toggle('light', cls === 'light'); c.classList.toggle('big', cls === 'big'); translateBlocks(c); translateDOM(c); document.getElementById('modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); document.getElementById('modalCard').classList.remove('light', 'big'); }

/* กล่องยืนยันกลางจอ (แทน confirm() ของเบราว์เซอร์ ที่เด้งมุมบน) */
function showConfirm(msg, onYes, opts) {
  opts = opts || {};
  UI._confirmYes = onYes || null;
  showModal(`<div class="confirm-box">
    <h2>${opts.title || '⚠️ ยืนยัน'}</h2>
    <p class="confirm-msg">${msg}</p>
    <div class="confirm-actions">
      <button class="btn primary" data-action="confirmYes">${opts.yes || 'ตกลง'}</button>
      <button class="btn" data-action="confirmNo">${opts.no || 'ยกเลิก'}</button>
    </div></div>`);
}

function showSeasonEnd() {
  const s = state, R = s.finalReport;
  if (!R) { settleSeason(s); return showSeasonEnd(); }
  /* บันทึกคะแนนลงกระดานอันดับ (ครั้งเดียวต่อฤดู) */
  if (!s._scoreLogged && typeof Leaderboard !== 'undefined') {
    s._scoreLogged = true;
    Leaderboard.submit({ name: (s.player && s.player.name) || 'ผู้จัดการ', score: R.total, grade: R.grade,
      profit: R.profit, cane: R.caneTotal, sugar: R.sugarTotal, days: R.days });
  }
  const K = R.kpi, T = s.totals;
  const SC = SCORE_SPEC.map(sp => [sp.icon + ' ' + TR(sp.name), sp.key, sp.w]);
  const bar = (name, v, w) => `<div class="sc-row"><span>${name} <small style="color:#c9a94a">(นน.${w})</small></span><div class="sc-bar"><i style="width:${v.toFixed(0)}%;background:${v >= 70 ? '#4cd47a' : v >= 45 ? '#ffb547' : '#ff5c5c'}"></i></div><b>${Math.round(v / 100 * w)}/${w}</b></div>`;
  const revTot = R.revenue.sugar + R.revenue.molasses + R.revenue.power;
  const costTot = Object.values(R.cost).reduce((a, b) => a + b, 0);
  showModal(`<h2>${s.bankrupt ? '💸 โรงงานล้มละลาย' : '🏁 รายงานปิดหีบฤดูกาล ' + R.days + ' วัน'}</h2>
    <div class="tip" style="text-align:center;margin-top:-6px">ผู้จัดการโรงงาน: <b>${escapeHtml((s.player && s.player.name) || 'ผู้จัดการ')}</b></div>
    <div class="grade-wrap"><div class="grade">${R.grade}</div><div class="grade-sub">คะแนนรวม ${R.total.toFixed(0)}/1000</div></div>
    <div class="kpi-grid">
      <div class="kpi"><div class="k">กำไรสุทธิทั้งฤดู</div><div class="v ${R.profit >= 0 ? 'up' : 'dn'}">฿${fmtM(R.profit)}</div></div>
      <div class="kpi"><div class="k">อ้อยหีบรวม (เฉลี่ย/วัน)</div><div class="v">${fmt(R.caneTotal)} <small>ตัน (${fmt(R.avgTcd, 0)} TCD)</small></div></div>
      <div class="kpi"><div class="k">น้ำตาลผลิตรวม</div><div class="v">${fmt(T.sugar)} <small>ตัน</small></div></div>
      <div class="kpi"><div class="k">น้ำตาลค้างคลังตอนปิดหีบ</div><div class="v">${fmt(R.leftSugar)} <small>ตัน → ขาย ฿${fmtM(R.leftRev)} @฿${fmt(R.closePrice)}</small></div></div>
      <div class="kpi"><div class="k">ผลผลิต</div><div class="v">${fmt(K.yieldKgPerTon || 0, 0)} <small>กก./ตันอ้อย</small></div></div>
      <div class="kpi"><div class="k">ไฟฟ้าขาย</div><div class="v">${fmt(R.kwhExport / 1000, 0)} <small>MWh</small></div></div></div>

    <div class="two-col">
      <div class="card"><h3>รายรับ ฿${fmtM(revTot)}</h3><table class="fin">
        <tr><td>น้ำตาล</td><td>฿${fmtM(R.revenue.sugar)}</td></tr>
        <tr><td>กากน้ำตาล</td><td>฿${fmtM(R.revenue.molasses)}</td></tr>
        <tr><td>ไฟฟ้า + ชานอ้อย</td><td>฿${fmtM(R.revenue.power)}</td></tr></table></div>
      <div class="card"><h3>รายจ่าย ฿${fmtM(costTot)}</h3><table class="fin">
        <tr><td>ค่าอ้อย (ขั้นต้น+สุดท้าย)</td><td>฿${fmtM(R.cost.cane)}</td></tr>
        <tr><td>ค่าใช้จ่ายคงที่</td><td>฿${fmtM(R.cost.fixed)}</td></tr>
        <tr><td>ค่าแรง</td><td>฿${fmtM(R.cost.labor)}</td></tr>
        <tr><td>ซ่อม/ล้างเครื่อง</td><td>฿${fmtM(R.cost.repair)}</td></tr>
        <tr><td>ลงทุนอัปเกรด</td><td>฿${fmtM(R.cost.upgrade)}</td></tr>
        <tr><td>ดอกเบี้ยเงินกู้</td><td>฿${fmtM(R.cost.interest || 0)}</td></tr>
        <tr><td>อื่น ๆ (เคมี/น้ำมัน/ค่าปรับ)</td><td>฿${fmtM(R.cost.other)}</td></tr></table></div>
    </div>

    ${(() => {
      /* งบกำไรขาดทุนแบบ accrual (IAS 1/16) — CapEx ไม่ใช่ค่าใช้จ่าย คิดเป็นค่าเสื่อมราคาเท่านั้น */
      const revenue = R.revenue.sugar + R.revenue.molasses + R.revenue.power;
      const opex = R.cost.cane + R.cost.fixed + R.cost.labor + R.cost.repair + R.cost.other;   // ต้นทุนดำเนินงาน (ไม่รวม CapEx/ดอกเบี้ย/ภาษี)
      const capex = R.cost.upgrade || 0, interest = R.cost.interest || 0;
      const yearFrac = (R.days || 130) / 365;
      const dep = (CONFIG.plantBaseValue + capex) / CONFIG.assetLifeYears * yearFrac;           // ค่าเสื่อมราคา straight-line ปันตามวัน
      const ebitda = revenue - opex;
      const ebit = ebitda - dep;
      const ebt = ebit - interest;
      const tax = Math.max(0, ebt) * CONFIG.corpTaxRate;                                        // ภาษี 20% เฉพาะกำไร
      const net = ebt - tax;
      const cashFlow = net + dep + tax - capex;   // กระแสเงินสด: บวกกลับค่าเสื่อม+ภาษีค้างจ่าย หัก CapEx จริง
      const sgn = v => (v >= 0 ? 'up' : 'dn');
      const M = v => `฿${fmtM(v)}`;
      return `<div class="card fin-card"><h3>📊 งบกำไรขาดทุน (Financial Summary)</h3>
        <div class="fin-row"><span>รายได้รวม (Revenue)</span><span>${M(revenue)}</span></div>
        <div class="fin-row sub"><span>− ต้นทุนดำเนินงาน (อ้อย/แรงงาน/เคมี/ซ่อม/คงที่)</span><span class="dn">${M(opex)}</span></div>
        <div class="fin-row"><span><b>EBITDA</b> <small>กำไรก่อนดอกเบี้ย ภาษี ค่าเสื่อม</small></span><b class="${sgn(ebitda)}">${M(ebitda)}</b></div>
        <div class="fin-row sub"><span>− ค่าเสื่อมราคา (D&A · โรงงาน+อัปเกรด ÷ ${CONFIG.assetLifeYears} ปี)</span><span class="dn">${M(dep)}</span></div>
        <div class="fin-row"><span><b>EBIT</b> <small>กำไรจากการดำเนินงาน</small></span><b class="${sgn(ebit)}">${M(ebit)}</b></div>
        <div class="fin-row sub"><span>− ดอกเบี้ยจ่าย (Finance cost)</span><span class="dn">${M(interest)}</span></div>
        <div class="fin-row"><span><b>EBT</b> <small>กำไรก่อนภาษี</small></span><b class="${sgn(ebt)}">${M(ebt)}</b></div>
        <div class="fin-row sub"><span>− ภาษีเงินได้นิติบุคคล ${(CONFIG.corpTaxRate * 100).toFixed(0)}%</span><span class="dn">${M(tax)}</span></div>
        <div class="fin-row total"><span><b>Net Profit</b> <small>กำไรสุทธิทางบัญชี (หลังภาษี)</small></span><b class="${sgn(net)}">${M(net)}</b></div>
        <div class="fin-bridge">
          <div class="fin-row sub"><span>🔄 กระทบยอดเป็นเงินสด: กำไรสุทธิ + ค่าเสื่อม ${M(dep)} + ภาษีค้างจ่าย ${M(tax)} − เงินลงทุน CapEx ${M(capex)}</span></div>
          <div class="fin-row"><span><b>= กระแสเงินสดสุทธิ</b> <small>ตัวที่ใช้ตัดเกรด/เงื่อนไขผ่าน</small></span><b class="${sgn(cashFlow)}">${M(cashFlow)}</b></div>
        </div>
        <div class="tip">CapEx อัปเกรด ${M(capex)} เป็นการ<b>ลงทุนซื้อสินทรัพย์</b> (ขึ้นงบดุล) ไม่ใช่ค่าใช้จ่าย — งบกำไรขาดทุนรับรู้แค่<b>ค่าเสื่อมราคา</b>ทีละน้อย · กำไรทางบัญชีจึงต่างจากกระแสเงินสด: ปีที่ลงทุนหนัก เงินสดหดแต่กำไรทางบัญชียังดี เพราะสินทรัพย์ทยอยตัดค่าเสื่อมในฤดูถัดไป</div></div>`;
    })()}

    <div class="card"><h3>คะแนนรายด้าน (ถ่วงน้ำหนัก เต็ม 1,000)</h3>${SC.map(([n, k, w]) => bar(n, R.scores[k], w)).join('')}</div>
    <div class="card"><h3>KPI ปิดฤดู</h3><div class="kchips">
      ${['extraction', 'recovery', 'bhr', 'ptyFM', 'undet', 'steamOnCane', 'kwhPerTc', 'timeEff'].map(k => { const sp = KPI_SPEC.find(x => x.k === k); return `<span class="kchip kpi-${kpiLevel(sp, K[k])}">${sp.name} ${(K[k] || 0).toFixed(1)}${sp.unit === '%' ? '%' : ''}</span>`; }).join('')}</div>
      <div class="tip">🔥 โหมดยาก · หีบ ${R.crushDays}/${CONFIG.crushDays} วัน · ล้างเครื่อง ${R.cleanDays}/${CONFIG.cleanBudget} วัน · เครื่องพัง ${T.breakdowns} ครั้ง · หยุดรวม ${T.downH.toFixed(0)} ชม. · เหตุฉุกเฉิน ${(s.emergencies || []).length} ครั้ง · ออร์เดอร์สำเร็จ ${T.ordersDone}/พลาด ${T.ordersFailed}</div>
      <div class="tip">เสียอ้อยไปทั้งหมด ${fmt(Math.round(R.caneLost))} ตัน (ตัดไม่ทัน + รถหนีคิว + เน่าทิ้ง) · กู้เงินสูงสุด ฿${fmtM(R.maxLoan)} · ดอกเบี้ยจ่าย ฿${fmtM(R.interest)}
        · ข้อร้องเรียน ลูกค้า ${R.complaints.customer} · แรงงาน ${R.complaints.labour} · ภาครัฐ ${R.complaints.gov}</div></div>
    <div class="card"><h3>บทวิเคราะห์ผู้จัดการ</h3>${R.verdicts.map(v => `<div class="hint ${v.startsWith('บริหาร') ? 'good' : 'warn'}">${v}</div>`).join('')}</div>
    <div class="modal-actions"><button class="btn" data-action="tab" data-tab="reports" onclick="closeModal()">ดูกราฟทั้งฤดู</button>
      <button class="btn primary" data-action="newGame">เริ่มฤดูใหม่</button></div>`, 'big');
}

/* ============================ tutorial ============================ */
const TUT = [
  { t: 'ยินดีต้อนรับ ผู้จัดการโรงงาน', b: 'คุณมี <b>130 วัน</b> = วันหีบ 120 วัน + โควตาหยุดล้างเครื่อง 10 วัน และทุน <b>฿50 ล้าน</b> เป้าหมายคือกำไร ฿200 ล้าน พร้อมคะแนนดีทั้ง 8 ด้าน (การบริหาร · กำไร · ประสิทธิภาพการผลิต · ลูกค้า · พนักงาน · ชาวไร่ · ความปลอดภัย · ข้อร้องเรียน)<br><br>เวลายังไม่เดินจนกว่าคุณจะกด <b>🚩 เริ่มหีบ</b> — ใช้ช่วงนี้ปรับปรุงแผนกก่อนได้เต็มที่', a: 'ถัดไป' },
  { t: 'สายวัตถุดิบ ทีม 1-3 คือหัวใจ', b: 'ทีมส่งเสริม <b>หาอ้อย</b> → ทีมเก็บเกี่ยว <b>ตัดและขน</b> → ทีมลานอ้อย <b>รับเข้าลาน</b> → ลูกหีบ<br>ทั้งสามต้องมีกำลังใกล้เคียงกัน มิฉะนั้น:<br>• ตัดไม่ทันที่หาไว้ → อ้อยหลุดไปโรงงานอื่น ชาวไร่เสียความเชื่อมั่น<br>• ลานรับไม่ทัน → รถต่อคิว <b>CCS ตกชั่วโมงละ 0.042 หน่วย</b> เกิน 24 ชม. เกิด dextran<br>ดูแถบ “คอขวดของทั้งโรงงาน” ในแท็บการผลิตได้ตลอด', a: 'ถัดไป' },
  { t: 'ค่าพลังเครื่องจักร และการเร่งเครื่อง', b: 'เครื่องจักรทุกตัวเริ่มที่ <b>ค่าพลัง 100%</b> และลดลงทุกชั่วโมงที่เดินเครื่อง · ค่าพลังต่ำ = กำลังผลิตต่ำ · <b>ถึง 0 = พังทั้งกระบวนการ</b> ซ่อมอย่างน้อย 1 วัน (ลด 20% ต่อ 1 ดาวของทีมซ่อมบำรุง)<br><br>ทางเลือกคือ <b>อัปเกรดดาว</b> (ทนขึ้นถาวร) หรือ <b>เร่งเครื่อง</b> (กำลังเพิ่มทันที แต่ค่าพลังลดเร็วขึ้นถึง 3.4 เท่า พนักงานเหนื่อย และเสี่ยงอุบัติเหตุ/ไฟไหม้)<br>ใช้โควตาหยุดล้างเครื่อง 10 วันให้คุ้ม — ทีมซ่อมบำรุงจะคอยประเมินให้', a: 'ถัดไป' },
  { t: 'เงินสดติดลบไม่ได้ — แต่กู้ได้', b: 'ขาดเงินเมื่อไรระบบจะกู้ให้อัตโนมัติ ดอกเบี้ยฐาน 12%/ปี และ <b>+3% ทุกยอดกู้ ฿50 ล้าน</b><br>คุณ<b>ลงทุนด้วยเงินกู้ได้</b> — การกู้มาขยายกำลังตั้งแต่ต้นฤดูมักคุ้มกว่ารอเก็บเงิน เพราะกำลังที่เพิ่มจะทำงานให้ครบ 120 วัน<br><br>จ่ายค่าอ้อยทุก 7 วัน · ค่าจ้างทุก 15 วัน · ค่าอ้อยขั้นสุดท้ายวันที่ 65 และ 130', a: 'เริ่มบริหารโรงงาน' },
];
function showTutorial() { tutorialStep(0); }
function tutorialStep(i) {
  if (i >= TUT.length) { lsSet('sfm_tut_done_v7', '1'); closeModal(); if (!state.started) showPrepBrief(); return; }
  const s = TUT[i];
  showModal(`<div class="tut-step">${TR('คู่มือ')} ${i + 1}/${TUT.length}</div><h2>${TR(s.t)}</h2><p>${s.b}</p>
    <div class="modal-actions">${i > 0 ? `<button class="btn" data-action="tutNext" data-step="${i - 1}">${TR('ย้อนกลับ')}</button>` : ''}
    <button class="btn" data-action="tutNext" data-step="${TUT.length}">${TR('ข้าม')}</button>
    <button class="btn primary" data-action="tutNext" data-step="${i + 1}">${TR(s.a)}</button></div>`);
}

/* ============================ toast ============================ */
let toastTimer;
function toast(msg, ms) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2200);
}

window.addEventListener('resize', () => { if (UI.tab) drawCharts(); });
document.addEventListener('DOMContentLoaded', init);
