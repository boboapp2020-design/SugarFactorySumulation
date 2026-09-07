'use strict';
/* =====================================================================
   Sugar Factory Manager v2.0 — ui-dept.js
   ส่วนติดต่อผู้ใช้ของ "18 แผนก": ดาว · ค่าพลังเครื่องจักร · เร่งเครื่อง
   (ถูกโหลดต่อจาก main.js — ใช้ตัวแปร state / UI / helper ร่วมกัน)
   ===================================================================== */

/* ---------- ชิ้นส่วนเล็ก ๆ ---------- */
function starRow(id) {
  const d = dept(id), n = dStar(state, id);
  let h = '<span class="stars">';
  for (let i = 1; i <= d.maxStar; i++) h += `<i class="${i <= n ? 'on' : ''}">★</i>`;
  return h + `</span><span class="star-n">${n}/${d.maxStar}</span>`;
}

function powerBar(id) {
  const x = state.dept[id];
  if (!x || dept(id).kind !== 'machine') return '';
  const p = x.power, cls = p < 25 ? 'low' : p < 50 ? 'mid' : '';
  const eff = Math.round(powerEff(p) * 100);
  const drain = drainPerHour(state, id);
  const hoursLeft = drain > 0 ? p / drain : 999;
  return `<div class="kv"><span class="k">ค่าพลังเครื่องจักร</span>
      <span class="v ${p < 25 ? 'bad' : p < 50 ? 'warn' : 'good'}">${Math.round(p)}%
        <small>(กำลังผลิต ${eff}%)</small></span></div>
    <div class="bar health ${cls}"><i style="width:${p}%"></i></div>
    <div class="tip">ลด ${(drain * 24).toFixed(1)}%/วัน — ${x.downH > 0 ? `<b class="bad">พังอยู่ อีก ${x.downH.toFixed(1)} ชม.</b>`
      : hoursLeft < 999 ? `เหลืออีกราว <b>${(hoursLeft / 24).toFixed(1)} วัน</b>ก่อนถึง 0 (พังทั้งสาย)` : 'ไม่ลด'}</div>`;
}

function overdriveRow(id) {
  if (dept(id).kind !== 'machine') return '';
  const cur = state.dept[id].od || 0;
  return `<div class="card compact od-card"><h3>⏫ เร่งอัตรากำลัง</h3>
    <div class="od-row">${OVERDRIVE.map((o, i) =>
      `<button class="od-btn ${i === cur ? 'on' : ''}" data-action="over" data-id="${id}" data-v="${i}" title="${o.tip}">${o.label}</button>`).join('')}</div>
    <div class="tip">${OVERDRIVE[cur].name} — ${OVERDRIVE[cur].tip}${cur > 0
      ? ` · ค่าพลังลดเร็วขึ้น <b>${Math.pow(OVERDRIVE[cur].v, 3).toFixed(1)} เท่า</b> · ขวัญกำลังใจพนักงานลดลง`
      : ''}</div></div>`;
}

/* ความสามารถของแผนกตามดาว: ปัจจุบัน → ถ้าอัปอีก 1 ดาว */
const DPARAM = {
  cap: { n: 'กำลังผลิต', u: ' ตัน/วัน' }, yardCap: { n: 'ความจุลาน', u: ' ตัน' },
  pi: { n: 'Preparation Index', u: '' }, polBag: { n: 'Pol % Bagasse', u: '%', lower: true },
  ret: { n: 'Retention หม้อใส', u: ' นาที', lower: true }, polFC: { n: 'Pol % Filter Cake', u: '%', lower: true },
  econ: { n: 'Steam economy', u: '' }, bx: { n: 'Brix น้ำเชื่อมสูงสุด', u: '%' },
  cv: { n: 'CV ผลึก', u: '%', lower: true }, ptyFM: { n: 'Final Molasses Purity', u: '', lower: true },
  loss: { n: 'น้ำตาลหกหาย', u: '%', lower: true }, whCap: { n: 'ความจุคลัง', u: ' ตัน' },
  ship: { n: 'กำลังส่งมอบ', u: ' ตัน/วัน' }, molCap: { n: 'ความจุถัง', u: ' ตัน' }, steam: { n: 'ไอน้ำ', u: ' ตัน/ชม.' },
  eff: { n: 'ประสิทธิภาพหม้อ', u: '', pct: true }, kwh: { n: 'ไฟฟ้า', u: ' kWh/ตันไอ' },
  rep: { n: 'เวลาซ่อม', u: '×', lower: true }, restore: { n: 'ค่าพลังที่ฟื้นต่อวันล้าง', u: '%' },
  wear: { n: 'อัตราสึกหรอ', u: '×', lower: true }, price: { n: 'ราคาขาย', u: '×' },
  order: { n: 'ออร์เดอร์เข้า', u: '×' }, time: { n: 'เวลาแก้เหตุ', u: '×', lower: true },
  cost_: { n: 'ค่าเสียหาย', u: '×', lower: true }, prob: { n: 'โอกาสเกิดเหตุ', u: '×', lower: true },
  morale: { n: 'ฟื้นขวัญกำลังใจ', u: '/วัน' }, ot: { n: 'เพดาน OT', u: '', pct: true },
  wage: { n: 'ค่าจ้าง', u: '/วัน', money: true, lower: true }, color: { n: 'สี ICUMSA', u: ' IU', lower: true },
  prem: { n: 'พรีเมียมคุณภาพ', u: '×' }, fix: { n: 'เวลาปิดข้อร้องเรียน', u: '×', lower: true },
  pond: { n: 'ความจุบ่อ', u: ' m³' }, rate: { n: 'อัตราบำบัด', u: ' m³/วัน' },
  bod: { n: 'BOD น้ำทิ้ง', u: ' mg/L', lower: true }, ccs: { n: 'CCS ที่เพิ่มได้', u: ' หน่วย' },
  trash: { n: 'สิ่งปนเปื้อน', u: '%', lower: true }, cut: { n: 'ตัด-ถึง-หีบ', u: ' ชม.', lower: true },
  trust: { n: 'ความเชื่อมั่นชาวไร่', u: '×' },
};
const fmtDP = (k, v) => {
  const m = DPARAM[k] || {};
  if (m.money) return '฿' + fmt(v);
  if (m.pct) return Math.round(v * 100) + '%';
  return (Math.abs(v) < 10 && !Number.isInteger(v) ? v.toFixed(2) : fmt(Math.round(v))) + (m.u || '');
};

function deptCapabilityHTML(id) {
  const d = dept(id), star = dStar(state, id);
  const cur = d.levels[star], nxt = star < d.maxStar ? d.levels[star + 1] : null;
  const keys = Object.keys(cur).filter(k => k !== 'name' && k !== 'cost' && DPARAM[k]);
  return `<div class="card"><h3>📊 ความสามารถตอนนี้</h3>
    <div class="kv"><span class="k">อุปกรณ์/ทีม</span><span class="v">${cur.name}</span></div>
    ${keys.map(k => {
      const a = cur[k], b = nxt ? nxt[k] : null;
      const lower = (DPARAM[k] || {}).lower;
      const better = b !== null && (lower ? b < a : b > a);
      return `<div class="cap-row"><span class="k">${DPARAM[k].n}</span>
        <span class="cap-now">${fmtDP(k, a)}</span>
        ${b !== null && b !== a ? `<span class="cap-arrow ${better ? 'up' : 'dn'}">→</span><span class="cap-next ${better ? 'up' : 'dn'}">${fmtDP(k, b)}</span>` : ''}</div>`;
    }).join('')}
    ${d.kind === 'machine' ? `<div class="cap-row"><span class="k">ค่าพลังลดต่อวัน</span>
      <span class="cap-now">${(POWER_DRAIN[Math.min(star, 5)] * 24).toFixed(1)}%</span>
      ${star < d.maxStar ? `<span class="cap-arrow up">→</span><span class="cap-next up">${(POWER_DRAIN[Math.min(star + 1, 5)] * 24).toFixed(1)}%</span>` : ''}</div>` : ''}
    <div class="tip">${d.chain || d.role}</div></div>`;
}

/* ข้อความสรุปว่าอัปอีก 1 ดาวได้อะไร */
function deptDiffText(id, fromStar) {
  const d = dept(id);
  const a = d.levels[fromStar], b = d.levels[fromStar + 1];
  if (!b) return '';
  const out = [];
  for (const k of Object.keys(b)) {
    if (k === 'name' || k === 'cost' || !DPARAM[k] || b[k] === a[k]) continue;
    const lower = (DPARAM[k] || {}).lower, better = lower ? b[k] < a[k] : b[k] > a[k];
    out.push(`<b class="${better ? 'up' : 'dn'}">${DPARAM[k].n} ${fmtDP(k, a[k])}→${fmtDP(k, b[k])}</b>`);
  }
  return out.join(' · ');
}

/* การ์ดอัปเกรดของแผนก */
function deptUpgradeHTML(id) {
  const d = dept(id), star = dStar(state, id), max = star >= d.maxStar;
  const cost = max ? 0 : d.levels[star + 1].cost;
  const afford = state.cash >= cost;
  return `<div class="card up-card"><h3>${d.icon} อัปเกรด${d.name}</h3>
    <div class="up-stars">${starRow(id)}</div>
    ${max ? '<div class="tip good">อัปเกรดครบทุกดาวแล้ว</div>' : `
      <div class="up-next"><b>ดาวถัดไป:</b> ${d.levels[star + 1].name}</div>
      <div class="up-diff">${deptDiffText(id, star)}</div>
      <button class="btn ${afford ? 'primary' : 'credit'}" data-action="buy" data-id="${id}">
        ⭐ อัปเป็น ${star + 1} ดาว · ฿${fmtM(cost)}${afford ? '' : ` 🏦 กู้เพิ่ม ฿${fmtM(cost - state.cash)}`}</button>
      ${afford ? '' : `<div class="tip warnrow">เงินสดไม่พอ — ระบบจะกู้ส่วนที่ขาดให้ ดอกเบี้ยจะขึ้นเป็น ${((ECON.loanRateBase + Math.floor((state.loan + cost - state.cash) / ECON.loanRateStepAt) * ECON.loanRateStep) * 100).toFixed(1)}%/ปี</div>`}
      ${d.kind === 'machine' ? '<div class="tip">อัปเกรดแล้วค่าพลังเครื่องจักรกลับมา 100% เพราะเปลี่ยนของใหม่</div>' : ''}`}
  </div>`;
}

/* ---------- แผงควบคุมแผนก ---------- */
function deptPanel(id) {
  const d = dept(id), s = state, x = s.dept[id];
  if (!d || !x) return '<div class="card">ไม่พบแผนกนี้</div>';
  const head = `<div class="card dept-head"><h3>${d.icon} ${d.no ? 'ทีมที่ ' + d.no + ' — ' : ''}${d.name}</h3>
    <div class="up-stars">${starRow(id)}</div>
    <div class="tip">${d.role}</div>
    <div class="kv"><span class="k">ตัวชี้วัด</span><span class="v">${d.metric}</span></div></div>`;

  let extra = '';
  if (d.kind === 'machine') {
    extra += `<div class="card"><h3>⚙️ สภาพเครื่อง</h3>${powerBar(id)}
      <div class="row">
        <button class="btn sm" data-action="quickRepair" data-id="${id}">🔧 ซ่อมด่วน (จ่ายเงิน + หยุดชั่วคราว)</button>
        <button class="btn sm" data-action="cleanDay">🧽 หยุดล้างเครื่อง 1 วัน</button></div>
      <div class="tip">การหยุดล้างเครื่องฟื้นค่าพลังทุกเครื่องพร้อมกันถึง <b>${dv(s, 'maint', 'restore')}%</b> (ตามดาวทีมซ่อมบำรุง)</div></div>`
      + overdriveRow(id);
  }

  /* แผงเฉพาะแผนก */
  if (id === 'promo' || id === 'harvest' || id === 'yard') extra += supplyChainCard() + caneMixCard();
  if (id === 'mill') extra += millControlCard();
  if (id === 'clar') extra += clarControlCard();
  if (id === 'evap') extra += evapControlCard();
  if (id === 'fugal') extra += fugalControlCard();
  if (id === 'wh') extra += warehouseCard();
  if (id === 'molasses') extra += molassesCard();
  if (id === 'boiler') extra += boilerCard();
  if (id === 'power') extra += powerCard();
  if (id === 'maint') extra += maintCard();
  if (id === 'sales') extra += salesCard();
  if (id === 'hr') extra += hrCard();
  if (id === 'qc') extra += qcCard();
  if (id === 'ert') extra += ertCard();
  if (id === 'wwt') extra += wwtCard();

  return head + deptCapabilityHTML(id) + deptUpgradeHTML(id) + extra +
    `<div class="row"><button class="btn sm" data-action="tab" data-tab="upgrades">← ทุกแผนก</button>
     <button class="btn sm" data-action="tab" data-tab="production">ดูคอขวดสายการผลิต</button></div>`;
}

/* ---------- การ์ดเสริมรายแผนก ---------- */
function supplyChainCard() {
  const s = state, P = proc(s);
  const rows = [
    { n: '1 · หาอ้อย', v: dCap(s, 'promo'), id: 'promo' },
    { n: '2 · ตัด+ขน', v: dCap(s, 'harvest'), id: 'harvest' },
    { n: '3 · ลานอ้อย', v: dCap(s, 'yard'), id: 'yard' },
    { n: '4 · ลูกหีบ', v: dCap(s, 'mill'), id: 'mill' },
  ];
  const mx = Math.max(...rows.map(r => r.v), 1);
  return `<div class="card"><h3>🔗 สมดุลสายวัตถุดิบ</h3>
    ${rows.map(r => `<div class="bn-row"><span class="bn-name">${r.n}</span>
      <span class="bn-bar"><i style="width:${r.v / mx * 100}%" class="${r.v === Math.min(...rows.map(q => q.v)) ? 'min' : ''}"></i></span>
      <span class="bn-val">${fmt(Math.round(r.v))}</span></div>`).join('')}
    <div class="kv"><span class="k">อ้อยรอตัดในไร่</span><span class="v">${fmt(Math.round(s.field.standing))} ตัน</span></div>
    <div class="kv"><span class="k">รถรอคิวหน้าโรงงาน</span><span class="v ${s.yard.queueH > 18 ? 'bad' : s.yard.queueH > 10 ? 'warn' : ''}">${fmt(Math.round(s.yard.queueTons))} ตัน · รอ ${s.yard.queueH.toFixed(1)} ชม.</span></div>
    <div class="kv"><span class="k">อ้อยในลาน</span><span class="v">${fmt(Math.round(yardTons(s)))} / ${fmt(P.yardCap)} ตัน · เก่าสุด ${oldestAgeH(s).toFixed(0)} ชม.</span></div>
    <div class="kv"><span class="k">ความเชื่อมั่นชาวไร่</span><span class="v ${s.growerTrust < 45 ? 'bad' : s.growerTrust < 65 ? 'warn' : 'good'}">${Math.round(s.growerTrust)}%</span></div>
    <div class="kv"><span class="k">เสียอ้อยไปแล้ว</span><span class="v ${s.totals.caneLost + s.totals.caneDiverted > 2000 ? 'bad' : ''}">ตัดไม่ทัน ${fmt(Math.round(s.totals.caneLost))} · รถหนีคิว ${fmt(Math.round(s.totals.caneDiverted))} · เน่าทิ้ง ${fmt(Math.round(s.totals.caneRot))} ตัน</span></div>
    <div class="tip">CCS ตกชั่วโมงละ 0.042 หน่วยตั้งแต่ตัด · เกิน 24 ชม. เกิด dextran ทำให้ทำใสยากและปั่นไม่ออก</div></div>`;
}

function caneMixCard() {
  const c = state.ctrl.caneMix;
  return `<div class="card"><h3>🌾 สัดส่วนคิวอ้อย</h3>
    ${Object.entries(CANE_SOURCES).map(([k, src]) => `
      <div class="ctrl"><div class="ctrl-head"><span>${src.icon} ${src.name}</span><b>${Math.round((c[k] || 0) * 100)}%</b></div>
        <input type="range" id="mix_${k}" min="0" max="100" step="5" value="${Math.round((c[k] || 0) * 100)}">
        <div class="tip">${src.tip}</div></div>`).join('')}
    <div class="tip">อ้อยไฟไหม้เกิน 25% เสี่ยงถูกภาครัฐตรวจเรื่อง PM2.5</div></div>`;
}

function millControlCard() {
  const s = state, c = s.ctrl, P = proc(s);
  return `<div class="card"><h3>⚙️ ตั้งค่าการหีบ</h3>
    ${slider('cCrush', 'อัตราหีบเป้าหมาย', 20, Math.max(60, Math.ceil(P.millTph * 1.05)), 5, Math.round(c.crushTarget), fmt(Math.round(c.crushTarget)) + ' ตัน/ชม.',
      `กำลังเครื่องตอนนี้ ${fmt(Math.round(P.millTph))} ตัน/ชม. (${fmt(Math.round(P.millTph * 24))} ตัน/วัน)`)}
    ${slider('cImb', 'น้ำ Imbibition', 150, 400, 10, c.imbibition, c.imbibition + '% ต่อไฟเบอร์',
      'จุดเหมาะสม 280% · ต่ำกว่า 250% extraction ตกเร็ว · เกิน 320% ชานอ้อยชื้น ไอน้ำตก')}
    <div class="kv"><span class="k">Preparation Index</span><span class="v">${P.PI.toFixed(0)}</span></div>
    <div class="kv"><span class="k">Pol % Bagasse</span><span class="v ${P.polBagPct > 2.4 ? 'bad' : P.polBagPct > 2.0 ? 'warn' : 'good'}">${P.polBagPct.toFixed(2)}%</span></div>
    <div class="tip">PI +1 หน่วย = Extraction +0.17% (Rein Ch.4)</div></div>`;
}

function clarControlCard() {
  const s = state, c = s.ctrl, P = proc(s);
  return `<div class="card"><h3>🧪 ตั้งค่าการทำใส</h3>
    ${slider('cPH', 'pH น้ำอ้อย', 60, 85, 1, Math.round(c.pH * 10), c.pH.toFixed(1),
      'จุดต่ำสุดของ inversion อยู่ที่ pH 7.0-7.2 · ต่ำกว่านี้กรดทำลายน้ำตาล สูงกว่านี้สีขึ้นและเกิดตะกรัน')}
    <div class="kv"><span class="k">Inversion loss</span><span class="v ${P.inversionPct > 0.12 ? 'bad' : ''}">${P.inversionPct.toFixed(3)}% ของ Pol</span></div>
    <div class="kv"><span class="k">Pol % Filter Cake</span><span class="v">${P.polFCPct.toFixed(2)}%</span></div></div>`;
}

function evapControlCard() {
  const s = state, c = s.ctrl, P = proc(s);
  return `<div class="card"><h3>♨️ ตั้งค่าการระเหย</h3>
    ${slider('cBrix', 'Brix น้ำเชื่อมเป้าหมาย', 55, P.syrupBxMax, 1, Math.min(c.syrupBrix, P.syrupBxMax), Math.min(c.syrupBrix, P.syrupBxMax) + '%',
      `ดาวปัจจุบันทำได้สูงสุด ${P.syrupBxMax}% · Brix สูง = หม้อเคี่ยวทำงานเบาลง แต่ต้องใช้ไอมากกว่า`)}
    <div class="kv"><span class="k">กำลังระเหย</span><span class="v">${fmt(Math.round(P.evapCapTph))} ตันน้ำ/ชม.</span></div>
    <div class="kv"><span class="k">ตะกรัน</span><span class="v ${(s.dept.evap.scale || 0) > 0.35 ? 'bad' : ''}">${Math.round((s.dept.evap.scale || 0) * 100)}%</span></div>
    <div class="tip">ตะกรันสะสมทุกวัน ล้างได้เฉพาะวันหยุดล้างเครื่อง · pH เกิน 7.2 ทำให้เกาะเร็วขึ้น</div></div>`;
}

function fugalControlCard() {
  const s = state, c = s.ctrl, P = proc(s);
  return `<div class="card"><h3>🌀 ตั้งค่าการปั่น</h3>
    ${slider('cWash', 'น้ำล้างผลึก', 15, 55, 1, Math.round(c.wash * 10), c.wash.toFixed(1) + '%',
      'มาตรฐาน 3.0% · ล้างมากได้สีดีแต่ทุก 1% ที่เกิน 3% ทำ yield หาย 0.30% · ล้างน้อยสี ICUMSA สูง ลูกค้าร้องเรียน')}
    <div class="kv"><span class="k">Final Molasses Purity</span><span class="v ${P.ptyFMBase > 36 ? 'bad' : P.ptyFMBase > 34 ? 'warn' : 'good'}">${P.ptyFMBase.toFixed(1)}</span></div>
    <div class="tip">FM Purity คือหัวใจของ Boiling House Recovery — ต่ำกว่า 35 คือเกณฑ์ที่ดี</div></div>`;
}

function warehouseCard() {
  const s = state, P = proc(s);
  const left = Math.max(0, P.shipTpd - (s.todayShipped || 0));
  return `<div class="card"><h3>🏬 คลังและการขาย</h3>
    <div class="kv"><span class="k">น้ำตาลในคลัง</span><span class="v">${fmt(Math.round(s.stock.sugar))} / ${fmt(P.whCap)} ตัน</span></div>
    <div class="bar stock"><i style="width:${Math.min(100, s.stock.sugar / P.whCap * 100)}%"></i></div>
    <div class="kv"><span class="k">โควตาโหลดรถวันนี้</span><span class="v ${left < 100 ? 'warn' : ''}">เหลือ ${fmt(Math.round(left))} / ${fmt(Math.round(P.shipTpd))} ตัน</span></div>
    <div class="row"><input class="num" type="number" id="sellQty" min="0" step="50" value="${UI.sellQty}"> ตัน
      <button class="btn primary sm" data-action="sell">ขายตลาดจร ฿${fmt(spotPrice(s))}</button>
      <button class="btn sm" data-action="sellAll">ขายทั้งหมด</button></div>
    <div class="tip">ส่งมอบออร์เดอร์และการขายสปอตใช้โควตาโหลดรถร่วมกัน — โควตาไม่พอคือสาเหตุ “ส่งสินค้าไม่ทัน”</div></div>`;
}

function molassesCard() {
  const s = state, cap = up(s, 'molTank', 'molCap');
  return `<div class="card"><h3>🛢️ ถังกากน้ำตาล</h3>
    <div class="kv"><span class="k">ในถัง</span><span class="v ${s.stock.molasses > cap * 0.9 ? 'bad' : ''}">${fmt(Math.round(s.stock.molasses))} / ${fmt(cap)} ตัน</span></div>
    <div class="bar stock"><i style="width:${Math.min(100, s.stock.molasses / cap * 100)}%"></i></div>
    <div class="kv"><span class="k">ราคาวันนี้</span><span class="v ${s.market.molPrice > CONFIG.molassesPrice * 1.1 ? 'good' : ''}">฿${fmt(s.market.molPrice)}/ตัน</span></div>
    <div class="row"><input class="num" type="number" id="molQty" min="0" step="50" value="${UI.molQty}"> ตัน
      <button class="btn primary sm" data-action="sellMol">ขาย</button>
      <button class="btn sm" data-action="sellMolAll">ขายทั้งหมด</button></div>
    <div class="tip">ถังเต็ม = ปั่น C ระบายไม่ได้ กำลังหม้อปั่นเหลือ 35%</div></div>`;
}

/* ---- ทีม 11 หม้อไอน้ำ : เผาชานอ้อย → ไอน้ำ ---- */
function boilerCard() {
  const s = state, t = s.yesterday, P = proc(s);
  const hrs = Math.max(0.05, t.hours || 1);
  const need = t.steamNeed || 0, made = t.steamMade || 0;
  return `<div class="card"><h3>🔥 การผลิตไอน้ำ</h3>
    <div class="kv"><span class="k">กำลังผลิตไอน้ำสูงสุด</span><span class="v">${fmt(Math.round(P.steamCapTph))} ตัน/ชม.</span></div>
    <div class="kv"><span class="k">ไอน้ำที่ผลิตเมื่อวาน</span><span class="v ${t.steamShort ? 'bad' : 'good'}">${fmt(Math.round(made))} ตัน${t.steamShort ? ' — ไม่พอใช้!' : ''}</span></div>
    <div class="kv"><span class="k">ประสิทธิภาพหม้อ</span><span class="v">${Math.round(P.boilerEff * 100)}%</span></div>
    <div class="kv"><span class="k">ชานอ้อยคงเหลือ</span><span class="v ${s.stock.bagasse < 300 ? 'bad' : ''}">${fmt(Math.round(s.stock.bagasse))} ตัน</span></div>
    <div class="kv"><span class="k">ความชื้นชานอ้อย</span><span class="v">${P.bagMoist.toFixed(1)}%</span></div>
    <div class="kv"><span class="k">Steam on Cane</span><span class="v ${(s.kpi.steamOnCane || 0) > 55 ? 'warn' : 'good'}">${(s.kpi.steamOnCane || 0).toFixed(0)}% (เกณฑ์ ≤ 50%)</span></div>
    <label class="chk"><input type="checkbox" id="cOil" ${s.ctrl.useOil ? 'checked' : ''}> ใช้น้ำมันเตาเสริมเมื่อไอน้ำไม่พอ (฿${fmt(CONFIG.fuelOilPrice)}/ตัน)</label>
    <div class="tip">ไอน้ำถูกใช้ 2 ทาง: <b>กระบวนการผลิต</b> (หม้อต้มระเหย + หม้อเคี่ยว) และ <b>ป้อนกังหันของทีม 12</b>
      — ไอไม่พอ ทั้งโรงงานช้าลงและปั่นไฟไม่ได้</div>
    <div class="tip">GCV ชานอ้อย = 18,309 − 207.6×ความชื้น − 31.14×Brix (kJ/kg) · ⚠️ กองชานอ้อยเสี่ยง <b>ไฟไหม้</b> ตามการเร่งเครื่องและค่าพลังที่ต่ำ</div>
    <div class="row"><button class="btn sm" data-action="station" data-key="power">⚡ ไปทีมผลิตไฟฟ้า →</button></div></div>`;
}

/* ---- ทีม 12 ผลิตไฟฟ้า : ไอน้ำ → ไฟใช้เอง + ไฟขาย ---- */
function powerCard() {
  const s = state, t = s.yesterday, P = proc(s);
  const gen = t.kwh || 0, used = t.kwhInternal || 0, exp = t.powerExport || 0, bought = t.kwhBought || 0;
  const bal = gen - used;
  return `<div class="card"><h3>⚡ สมดุลไฟฟ้าของโรงงาน (เมื่อวาน)</h3>
    <div class="kv"><span class="k">กังหันปั่นไฟได้</span><span class="v">${fmt(Math.round(gen / 1000))} MWh <small>(${Math.round(P.kwhPerSteam)} kWh/ตันไอ)</small></span></div>
    <div class="kv"><span class="k">โรงงานใช้เอง</span><span class="v">${fmt(Math.round(used / 1000))} MWh <small>(${P.auxKwhPerTon} kWh/ตันอ้อย)</small></span></div>
    <div class="kv"><span class="k">คงเหลือ</span><span class="v ${bal >= 0 ? 'good' : 'bad'}">${bal >= 0 ? '+' : ''}${fmt(Math.round(bal / 1000))} MWh</span></div>
    <div class="bar stock"><i style="width:${Math.min(100, gen > 0 ? used / gen * 100 : 100)}%;background:${bal >= 0 ? 'linear-gradient(90deg,#4cd47a,#b7f36b)' : 'linear-gradient(90deg,#ff5c5c,#ff8f5c)'}"></i></div>
    <div class="tip">แถบคือสัดส่วนที่โรงงานใช้เอง — ถ้าเต็มแถบแปลว่าปั่นไม่พอใช้ ต้องซื้อไฟเพิ่ม</div>
    ${exp > 0 ? `<div class="kv"><span class="k">🟢 ขายเข้าระบบ</span><span class="v good">${fmt(Math.round(exp))} kWh × ฿${CONFIG.ppaPrice} = ฿${fmt(Math.round(exp * CONFIG.ppaPrice))}</span></div>` : ''}
    ${bought > 0 ? `<div class="kv"><span class="k">🔴 ซื้อจากการไฟฟ้า</span><span class="v bad">${fmt(Math.round(bought))} kWh × ฿${CONFIG.gridBuyPrice} = ฿${fmt(Math.round(bought * CONFIG.gridBuyPrice))}</span></div>` : ''}
    <div class="kv"><span class="k">ไฟขายสะสมทั้งฤดู</span><span class="v">${fmt(Math.round(s.totals.kwhExport / 1000))} MWh · ฿${fmtM(s.totals.revPower)}</span></div>
    <div class="kv"><span class="k">ค่าไฟที่ซื้อสะสม</span><span class="v ${s.totals.costEnergy > 0 ? 'bad' : 'good'}">฿${fmtM(s.totals.costEnergy || 0)}</span></div>
    <div class="kv"><span class="k">ไฟขายต่อตันอ้อย</span><span class="v ${(s.kpi.kwhPerTc || 0) >= 60 ? 'good' : (s.kpi.kwhPerTc || 0) > 0 ? 'warn' : 'bad'}">${(s.kpi.kwhPerTc || 0).toFixed(0)} kWh/tc <small>(cogen ที่ดี 60-130)</small></span></div>
    <div class="tip">อัปเกรดทีมนี้ได้ <b>สองต่อ</b>: ปั่นไฟได้มากขึ้นต่อตันไอ (55 → 152) และโรงงานกินไฟน้อยลง (35 → 24 kWh/ตันอ้อย)
      — ที่ 0 ดาวมักปั่นไม่พอใช้ ต้องซื้อไฟแพงกว่าราคาขาย</div>
    <div class="row"><button class="btn sm" data-action="station" data-key="boiler">🔥 ไปหม้อไอน้ำ (ต้นทางไอ) →</button></div></div>`;
}

function maintCard() {
  const s = state, adv = maintAdvice(s);
  return `<div class="card"><h3>🛠️ ศูนย์ซ่อมบำรุง</h3>
    <div class="advice ${adv.lvl}">${adv.text}</div>
    <div class="kv"><span class="k">วันล้างเครื่องที่ใช้ไป</span><span class="v ${s.cleanDaysUsed > CONFIG.cleanBudget ? 'bad' : ''}">${s.cleanDaysUsed} / ${CONFIG.cleanBudget} วัน</span></div>
    <div class="kv"><span class="k">วันหีบสะสม</span><span class="v">${s.crushDaysDone} / ${CONFIG.crushDays} วัน</span></div>
    <button class="btn primary" data-action="cleanDay" ${s.cleanDay.active ? 'disabled' : ''}>
      ${s.cleanDay.active ? `🧽 กำลังล้างเครื่อง (เหลือ ${s.cleanDay.hoursLeft.toFixed(1)} ชม.)` : `🧽 หยุดล้างเครื่อง 1 วัน · ฿${fmtM(CONFIG.cleanDayCost)}`}</button>
    <div class="tip">ล้าง 1 วัน ฟื้นค่าพลังทุกเครื่องขึ้นไปถึง <b>${dv(s, 'maint', 'restore')}%</b> · ล้างตะกรันหม้อต้ม · เปลี่ยนค้อน shredder</div>
    <h3 style="margin-top:12px">ค่าพลังเครื่องจักรทั้งหมด</h3>
    ${MACHINE_IDS.map(id => {
      const x = s.dept[id], p = x.power;
      return `<div class="bn-row"><span class="bn-name">${dept(id).short}</span>
        <span class="bn-bar"><i class="${p < 25 ? 'min' : ''}" style="width:${p}%"></i></span>
        <span class="bn-val ${p < 25 ? 'bad' : p < 50 ? 'warn' : ''}">${Math.round(p)}%</span>
        <button class="btn sm" data-action="quickRepair" data-id="${id}">ซ่อม</button></div>`;
    }).join('')}
    <div class="tip">เวลาซ่อมเมื่อเครื่องพัง: <b>${repairHours(s).toFixed(1)} ชม.</b> (ลด 20% ต่อ 1 ดาวของทีมนี้)</div></div>`;
}

function salesCard() {
  const s = state;
  const open = s.orders.filter(o => o.status === 'open').length;
  const acc = s.orders.filter(o => o.status === 'accepted').length;
  return `<div class="card"><h3>💼 การขายและลูกค้า</h3>
    <div class="kv"><span class="k">ความพึงพอใจลูกค้า</span><span class="v ${s.custSat < 55 ? 'bad' : s.custSat < 70 ? 'warn' : 'good'}">${Math.round(s.custSat)}/100</span></div>
    <div class="kv"><span class="k">ราคาที่ขายได้</span><span class="v">฿${fmt(spotPrice(s))}/ตัน (×${up(s, 'sales', 'priceMult').toFixed(2)})</span></div>
    <div class="kv"><span class="k">ออร์เดอร์</span><span class="v">รอรับ ${open} · รับแล้ว ${acc} · สำเร็จ ${s.totals.ordersDone} · พลาด ${s.totals.ordersFailed}</span></div>
    <div class="kv"><span class="k">ข้อร้องเรียนลูกค้า</span><span class="v ${s.complaints.customer ? 'bad' : 'good'}">${s.complaints.customer} ครั้ง</span></div>
    <div class="row"><button class="btn sm" data-action="tab" data-tab="orders">📋 ไปหน้าคำสั่งซื้อ</button></div></div>`;
}

function hrCard() {
  const s = state;
  return `<div class="card"><h3>🧑‍💼 พนักงาน</h3>
    <div class="kv"><span class="k">ความพึงพอใจพนักงาน</span><span class="v ${s.staffSat < 50 ? 'bad' : s.staffSat < 70 ? 'warn' : 'good'}">${Math.round(s.staffSat)}/100</span></div>
    <div class="bar stock"><i style="width:${s.staffSat}%"></i></div>
    <div class="kv"><span class="k">ค่าจ้าง</span><span class="v">฿${fmt(dv(s, 'hr', 'wage'))}/วัน · จ่ายทุก ${CONFIG.wagePayEvery} วัน</span></div>
    <div class="kv"><span class="k">ค้างจ่ายสะสม</span><span class="v">฿${fmtM(s.wagesAccrued)}</span></div>
    <div class="kv"><span class="k">ภาระการเร่งเครื่อง</span><span class="v ${overdriveLoad(s) > dv(s, 'hr', 'ot') * 4 ? 'bad' : ''}">${(overdriveLoad(s) * 100).toFixed(0)}% (เพดานที่รับไหว ${Math.round(dv(s, 'hr', 'ot') * 400)}%)</span></div>
    <div class="kv"><span class="k">ข้อร้องเรียนแรงงาน</span><span class="v ${s.complaints.labour ? 'bad' : 'good'}">${s.complaints.labour} ครั้ง</span></div>
    <div class="tip">ขวัญกำลังใจต่ำ = ทำงานช้าลงจริง (สูงสุด −14%) และเสี่ยงอุบัติเหตุมากขึ้น</div></div>`;
}

function qcCard() {
  const s = state;
  return `<div class="card"><h3>🔬 คุณภาพน้ำตาล</h3>
    <div class="kv"><span class="k">สัญญาณปัญหาคุณภาพ</span><span class="v ${s.qualityIssue > 0.8 ? 'bad' : s.qualityIssue > 0.3 ? 'warn' : 'good'}">${s.qualityIssue.toFixed(1)}</span></div>
    <div class="kv"><span class="k">อ้อยเก่าสุดในลาน</span><span class="v ${oldestAgeH(s) > 24 ? 'bad' : ''}">${oldestAgeH(s).toFixed(0)} ชม.${oldestAgeH(s) > 24 ? ' (เกิด dextran)' : ''}</span></div>
    <div class="kv"><span class="k">pH น้ำอ้อย</span><span class="v ${s.ctrl.pH > 7.6 || s.ctrl.pH < 6.6 ? 'warn' : 'good'}">${s.ctrl.pH.toFixed(1)}</span></div>
    <div class="kv"><span class="k">สี ICUMSA น้ำตาลที่ผลิต</span><span class="v ${(s.icumsaColor ?? 160) > 150 ? 'bad' : (s.icumsaColor ?? 160) > 100 ? 'warn' : 'good'}">${s.icumsaColor ?? '—'} IU ${(s.icumsaColor ?? 160) <= 45 ? '(เกรดพรีเมียม)' : (s.icumsaColor ?? 160) <= 150 ? '(ผ่าน มอก.56)' : '(สีสูง เสี่ยงถูกปฏิเสธ)'}</span></div>
    <div class="kv"><span class="k">พรีเมียมจากใบรับรอง</span><span class="v good">×${dv(s, 'qc', 'prem').toFixed(2)}</span></div>
    <div class="kv"><span class="k">ทีมคุณภาพลดสีได้</span><span class="v good">${dv(s, 'qc', 'color')} IU · ปิดข้อร้องเรียน ×${dv(s, 'qc', 'fix').toFixed(2)}</span></div>
    <div class="advice ${s.qualityIssue > 0.8 ? 'bad' : 'good'}">${qcAdvice()}</div></div>`;
}
function qcAdvice() {
  const s = state;
  if (dStar(s, 'qc') === 0) return 'ยังไม่มีทีมคุณภาพที่แข็งแรง — อัปเกรดเพื่อให้มีคนคอยเตือนและแก้ข้อร้องเรียน';
  if (oldestAgeH(s) > 24) return 'ทีมคุณภาพ: อ้อยค้างเกิน 24 ชม. เกิด dextran ทำให้ทำใสยากและสีน้ำตาลขึ้น — เร่งหีบหรือลดการรับอ้อย';
  if (s.ctrl.wash < 2.5) return 'ทีมคุณภาพ: น้ำล้างต่ำเกินไป สี ICUMSA จะสูง ลูกค้ามีสิทธิ์ปฏิเสธล็อต';
  if (s.ctrl.pH > 7.6) return 'ทีมคุณภาพ: pH สูงเกิน 7.6 ทำให้สีน้ำตาลขึ้นและเกิดตะกรันเร็ว';
  return 'ทีมคุณภาพ: ค่าคุณภาพอยู่ในเกณฑ์ ทุกล็อตผ่านสเปก';
}

function ertCard() {
  const s = state;
  const saf = Math.round(s.safety ?? 90);
  return `<div class="card"><h3>🦺 ความปลอดภัย & ความพร้อมรับเหตุ (จป.)</h3>
    <div class="kv"><span class="k">ดัชนีความปลอดภัย</span><span class="v ${saf < 45 ? 'bad' : saf < 70 ? 'warn' : 'good'}">${saf}%</span></div>
    <div class="bar stock"><i style="width:${saf}%;background:${saf < 45 ? '#ff5c5c' : saf < 70 ? '#ffb547' : '#4cd47a'}"></i></div>
    <div class="kv"><span class="k">เวลาแก้เหตุ</span><span class="v good">×${dv(s, 'ert', 'time').toFixed(2)}</span></div>
    <div class="kv"><span class="k">ค่าเสียหาย</span><span class="v good">×${dv(s, 'ert', 'cost_').toFixed(2)}</span></div>
    <div class="kv"><span class="k">โอกาสเกิดเหตุ</span><span class="v good">×${dv(s, 'ert', 'prob').toFixed(2)}</span></div>
    <div class="kv"><span class="k">เหตุที่เกิดแล้ว</span><span class="v">${s.emergencies.length} ครั้ง</span></div>
    <div class="tip">งาน <b>จป./คปอ.</b> + รับเหตุ: 🔥 ไฟไหม้/ฝุ่นระเบิด · 🚑 อุบัติเหตุ/ที่อับอากาศ · 🌡️ หม้อไอน้ำ · ☁️ SO₂ · 🌊 บ่อบำบัดล้น
      — ยิ่งดาวสูง <b>ดัชนีความปลอดภัยยิ่งขึ้น</b> เกิดเหตุน้อยลง แก้เร็วขึ้น (ดาว 0 = ผิดกฎหมาย จป./คปอ. บังคับตามกฎหมาย)</div>
    ${s.emergencies.slice(-4).reverse().map(e => `<div class="kv"><span class="k">วันที่ ${e.day} · ${e.name}</span><span class="v">${e.opt}</span></div>`).join('')}</div>`;
}

function wwtCard() {
  const s = state, P = proc(s);
  const pct = s.water.level / s.water.cap * 100;
  const bod = up(s, 'wwt', 'bod');
  return `<div class="card"><h3>🌊 บ่อบำบัดน้ำเสีย</h3>
    <div class="kv"><span class="k">ระดับน้ำในบ่อ</span><span class="v ${pct > 80 ? 'bad' : pct > 60 ? 'warn' : 'good'}">${fmt(Math.round(s.water.level))} / ${fmt(s.water.cap)} m³ (${Math.round(pct)}%)</span></div>
    <div class="bar stock"><i style="width:${Math.min(100, pct)}%"></i></div>
    <div class="kv"><span class="k">อัตราบำบัด</span><span class="v">${fmt(Math.round(P.wRate))} m³/วัน</span></div>
    <div class="kv"><span class="k">BOD น้ำทิ้ง</span><span class="v ${bod > CONFIG.bodStandard ? 'bad' : 'good'}">${bod} mg/L ${bod > CONFIG.bodStandard ? `(เกินมาตรฐาน ${CONFIG.bodStandard})` : '(ผ่านมาตรฐาน)'}</span></div>
    <div class="kv"><span class="k">น้ำล้นสะสม</span><span class="v ${s.totals.waterOverflow > 0 ? 'bad' : 'good'}">${fmt(Math.round(s.totals.waterOverflow))} m³</span></div>
    <div class="kv"><span class="k">ข้อร้องเรียนภาครัฐ</span><span class="v ${s.complaints.gov ? 'bad' : 'good'}">${s.complaints.gov} ครั้ง</span></div>
    <div class="tip">มาตรฐานน้ำทิ้งไทย BOD ≤ 20 mg/L · ล้นบ่อปรับ ฿${fmt(CONFIG.waterFinePerM3)}/m³ และถูกร้องเรียน</div></div>`;
}

/* ---------- คอขวดทั้งสาย ---------- */
function bottleneckHTML() {
  const rows = capChain(state);
  const mn = Math.min(...rows.map(r => r.tpd));
  const mx = Math.max(...rows.map(r => r.tpd), 1);
  const worst = rows.find(r => r.tpd === mn);
  return `<div class="card"><h3>🔎 คอขวดของทั้งโรงงาน (ตันอ้อย/วัน)</h3>
    ${rows.map(r => `<div class="bn-row"><span class="bn-name">${r.name}</span>
      <span class="bn-bar"><i class="${r.tpd === mn ? 'min' : ''}" style="width:${Math.max(2, r.tpd / mx * 100)}%"></i></span>
      <span class="bn-val">${fmt(Math.round(r.tpd))}</span>
      <button class="btn sm" data-action="station" data-key="${r.id}">→</button></div>`).join('')}
    <div class="tip">คอขวดตอนนี้คือ <b>${worst.name}</b> ที่ ${fmt(Math.round(mn))} ตัน/วัน — ทั้งโรงงานเดินได้เท่านี้
      ไม่ว่าจะอัปเกรดแผนกอื่นแค่ไหน · ความไม่สมดุล ${Math.round(bottleneckSpread(state) * 100)}%</div></div>`;
}

/* ---------- หน้าอัปเกรดรวมทั้ง 18 แผนก ---------- */
function viewUpgrades() {
  const s = state;
  const groups = ['cane', 'process', 'energy', 'support'];
  return `<div class="card"><h3>💰 เงินสด ฿${fmtM(s.cash)}${s.loan > 0 ? ` · หนี้ ฿${fmtM(s.loan)}` : ''}</h3>
      <div class="tip">อัปเกรดทีละ 1 ดาว · เครื่องจักรที่อัปเกรดจะได้ค่าพลังคืน 100%</div></div>`
    + bottleneckHTML()
    + groups.map(g => `<h2 class="grp">${DEPT_GROUPS[g].name}</h2>
        <div class="tip grp-tip">${DEPT_GROUPS[g].tip}</div>
        ${DEPTS.filter(d => d.group === g).map(d => deptRowHTML(d)).join('')}`).join('');
}

function deptRowHTML(d) {
  const s = state, star = dStar(s, d.id), max = star >= d.maxStar;
  const cost = max ? 0 : d.levels[star + 1].cost;
  const afford = s.cash >= cost;
  const x = s.dept[d.id];
  const pw = d.kind === 'machine'
    ? `<span class="dr-pw ${x.power < 25 ? 'bad' : x.power < 50 ? 'warn' : ''}">⚡${Math.round(x.power)}%</span>` : '';
  return `<div class="card dept-row">
    <div class="dr-top">
      <span class="dr-no">${d.no || '🛢️'}</span>
      <span class="dr-ic">${d.icon}</span>
      <span class="dr-name">${d.name}${pw}</span>
      <span class="dr-stars">${starRow(d.id)}</span>
    </div>
    <div class="dr-lv">${d.levels[star].name}</div>
    ${max ? '<div class="tip good">ครบทุกดาวแล้ว</div>' : `<div class="dr-diff">${deptDiffText(d.id, star)}</div>`}
    <div class="row">
      ${max ? '' : `<button class="btn ${afford ? 'primary' : 'credit'} sm" data-action="buy" data-id="${d.id}" title="${afford ? '' : `เงินสดขาด ฿${fmtM(cost - s.cash)} — ระบบจะกู้ให้`}">⭐ ${star + 1} ดาว · ฿${fmtM(cost)}${afford ? '' : ' 🏦'}</button>`}
      <button class="btn sm" data-action="station" data-key="${d.id}">เปิดแผง →</button>
    </div></div>`;
}

/* ---------- หน้าการผลิต ---------- */
function viewProduction() {
  const s = state;
  return startBar() + bottleneckHTML() + supplyChainCard()
    + `<h2 class="grp">🏭 สายการผลิตและพลังงาน</h2>`
    + [...LINE_IDS, 'boiler', 'power'].map(id => deptSummary(id)).join('')
    + warehouseCard() + molassesCard();
}

function deptSummary(id) {
  const s = state, d = dept(id), x = s.dept[id];
  const st = x.downH > 0 ? `<span class="st bad">พัง ${x.downH.toFixed(1)} ชม.</span>`
    : x.power < 25 ? '<span class="st warn">ใกล้พัง</span>' : '<span class="st good">เดินเครื่อง</span>';
  return `<div class="card compact"><h3>${d.icon} ${d.name} ${starRow(id)} ${st}</h3>
    <div class="kv"><span class="k">${d.levels[dStar(s, id)].name}</span><span class="v">${fmt(Math.round(dCap(s, id)))} ${d.unit === 'sugar' ? 'ตันน้ำตาล' : 'ตันอ้อย'}/วัน</span></div>
    ${powerBar(id)}
    <div class="row"><button class="btn sm" data-action="station" data-key="${id}">แผงควบคุม →</button>
      <span class="od-mini">${OVERDRIVE.map((o, i) => `<button class="od-btn sm ${i === (x.od || 0) ? 'on' : ''}" data-action="over" data-id="${id}" data-v="${i}">${o.label}</button>`).join('')}</span>
    </div></div>`;
}

/* แถบเริ่มหีบ / สถานะฤดูกาล */
function startBar() {
  const s = state;
  if (!s.started) {
    return `<div class="card start-card"><h3>🚩 ยังไม่เปิดหีบ</h3>
      <div class="tip">เวลายังไม่เดิน — ใช้โอกาสนี้ปรับปรุงแผนกให้พร้อมก่อน เมื่อกดเปิดหีบแล้วนาฬิกาจะเริ่มนับ 130 วัน</div>
      <button class="btn primary big" data-action="startCrush">▶ เริ่มหีบ (เปิดฤดูกาล)</button></div>`;
  }
  const adv = maintAdvice(s);
  return `<div class="card"><h3>🗓️ ฤดูกาล</h3>
    <div class="kv"><span class="k">วันที่</span><span class="v">${s.day} / ${CONFIG.seasonDays}</span></div>
    <div class="kv"><span class="k">วันหีบ</span><span class="v">${s.crushDaysDone} / ${CONFIG.crushDays}</span></div>
    <div class="kv"><span class="k">วันล้างเครื่อง</span><span class="v ${s.cleanDaysUsed > CONFIG.cleanBudget ? 'bad' : ''}">${s.cleanDaysUsed} / ${CONFIG.cleanBudget}</span></div>
    <div class="advice ${adv.lvl}">${adv.text}</div>
    <button class="btn ${adv.urge ? 'primary' : ''}" data-action="cleanDay" ${s.cleanDay.active ? 'disabled' : ''}>
      ${s.cleanDay.active ? `🧽 กำลังล้างเครื่อง (${s.cleanDay.hoursLeft.toFixed(1)} ชม.)` : `🧽 หยุดล้างเครื่อง 1 วัน · ฿${fmtM(CONFIG.cleanDayCost)}`}</button></div>`;
}

/* ---------- คะแนน 8 ด้าน ---------- */
function scoreCardHTML() {
  const sc = computeScore(state);
  return `<div class="card"><h3>🏅 ผลการบริหาร 8 ด้าน</h3>
    ${SCORE_SPEC.map(sp => {
      const v = Math.min(100, sc[sp.key] || 0);
      const cls = v >= 75 ? 'good' : v >= 50 ? 'warn' : 'bad';
      const pts = Math.round(v / 100 * sp.w);
      return `<div class="sc-row"><span class="sc-name">${sp.icon} ${sp.name} <small style="color:var(--gold-2)">(นน.${sp.w})</small></span>
        <span class="sc-bar"><i class="${cls}" style="width:${v}%"></i></span>
        <span class="sc-val ${cls}">${pts}/${sp.w}</span></div>
        <div class="tip sc-tip">${sp.tip}</div>`;
    }).join('')}
    <div class="kv"><span class="k">คะแนนรวม (Ranking)</span><span class="v">${Math.round(sc.overall)}/1000</span></div>
    <div class="kv"><span class="k">กำไรสุทธิตอนนี้</span><span class="v ${sc._profitValue >= 0 ? 'good' : 'bad'}">฿${fmtM(sc._profitValue)} (เป้า ฿${fmtM(CONFIG.winProfit)})</span></div>
    <div class="kv"><span class="k">อ้อยเข้าหีบ</span><span class="v">${fmt(Math.round(sc._caneCrushed || 0))} / ${fmt(sc._caneTarget || CONFIG.caneTarget)} ตัน (${Math.round(sc._output || 0)}%)</span></div>
    <div class="kv"><span class="k">เกรดตอนนี้</span><span class="v ${sc.overall >= 670 ? 'good' : sc.overall >= 540 ? 'warn' : 'bad'}">${sc.grade || '-'} · ${Math.round(sc.overall)} คะแนน</span></div>
    <div class="kv"><span class="k">ข้อร้องเรียนรวม</span><span class="v ${sc._complaintsTotal ? 'bad' : 'good'}">ลูกค้า ${state.complaints.customer} · แรงงาน ${state.complaints.labour} · ภาครัฐ ${state.complaints.gov}</span></div></div>`;
}
