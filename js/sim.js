'use strict';
/* =====================================================================
   Sugar Factory Manager v0.4 — sim.js
   เครื่องยนต์จำลองโรงงานน้ำตาลจริง เดินเป็นรายชั่วโมง

   กระแส = { m, B, P } (ตัน, ตัน Brix, ตัน Pol)
   สมดุล Pol ปิดทุกชั่วโมง:
     Pol อ้อย = น้ำตาล + ชานอ้อย + filter cake + โมลาสสุดท้าย + Undetermined
   ===================================================================== */

const rnd = Math.random;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RAW_SUGAR_BIN = 900;        // กองน้ำตาลรอบรรจุสูงสุด (ตัน) เกินนี้หม้อปั่นชะลอ

/* ---------- ตัวช่วยกระแส ---------- */
const strAdd = (a, b) => { a.m += b.m; a.B += b.B; a.P += b.P; };
const strTake = (a, frac) => { const o = { m: a.m * frac, B: a.B * frac, P: a.P * frac }; a.m -= o.m; a.B -= o.B; a.P -= o.P; return o; };
const pty = s => s.B > 1e-9 ? s.P / s.B * 100 : 0;
const brixPct = s => s.m > 1e-9 ? s.B / s.m * 100 : 0;

/* ---------- ตัวคูณ/ตัวบวกจากเหตุการณ์ ---------- */
function modSum(s, key) { let v = 0; for (const m of s.mods) if (m.key === key) v += m.amount; return v; }
function modMul(s, key) { return Math.max(0, 1 + modSum(s, key)); }

/* ---------- เงิน ---------- */
const COST_BUCKET = { caneCost: 'costCane', finalPayment: 'costCane', fixed: 'costFixed', labor: 'costLabor',
  repair: 'costRepair', cleanCost: 'costRepair', upgrade: 'costUpgrade', gridCost: 'costEnergy' };
/* จ่ายเงิน — เงินสดติดลบไม่ได้ ขาดเมื่อไรกู้อัตโนมัติ (ปัดขึ้นเป็นล้าน) */
function pay(s, amount, bucket) {
  s.cash -= amount;
  if (bucket && s.today[bucket] !== undefined) s.today[bucket] += amount;
  s.totals.cost += amount;
  s.totals[COST_BUCKET[bucket] || 'costOther'] += amount;
  if (s.cash < 0) borrow(s, Math.ceil(-s.cash / 1_000_000) * 1_000_000, { auto: true });
}
function logMsg(s, text, kind = 'info') {
  s.log.unshift({ day: s.day, text, kind });
  if (s.log.length > 120) s.log.length = 120;
}

/* ---------- หยุดเครื่อง ---------- */
function stopStation(s, key, hours, reason) {
  const st = s.stations[key];
  if (!st) return;
  st.downH = Math.max(st.downH, hours);
  if (st.power !== undefined) st.power = Math.max(st.power, 8);
  s.totals.breakdowns++;
  logMsg(s, `⚠️ ${STATION_META[key].name}หยุด ${hours.toFixed(0)} ชม. — ${reason}`, 'bad');
}

/* =====================================================================
   อ้อย
   ===================================================================== */
/* CCS ตามช่วงฤดู: ต้นฤดูต่ำ กลางฤดูสูงสุด ปลายฤดูตก (โค้งจริงของไทย) */
function seasonCCS(day) {
  const t = day / CONFIG.seasonDays;
  return 10.4 + 3.0 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t + 0.06) / 1.06)));
}

function mixProfile(s) {
  const mix = s.ctrl.caneMix;
  let tot = 0; for (const k in mix) tot += mix[k];
  if (tot <= 0) return { ccs: 0, trash: 5, burnt: 0, price: 1, cut: 12 };
  let ccs = 0, trash = 0, burnt = 0, price = 0, cut = 0;
  for (const k in mix) {
    const w = mix[k] / tot, src = CANE_SOURCES[k];
    ccs += w * src.ccs; trash += w * src.trash; burnt += w * (src.burnt ? 1 : 0);
    price += w * src.priceMult; cut += w * src.cutToCrush;
  }
  return { ccs, trash, burnt, price, cut };
}

/* สร้างล็อตอ้อยเข้าลาน */
function pushCane(s, tons, forceSrc, ageH = 0) {
  if (tons <= 0) return;
  const p = forceSrc
    ? { ccs: CANE_SOURCES[forceSrc].ccs, trash: CANE_SOURCES[forceSrc].trash, burnt: CANE_SOURCES[forceSrc].burnt ? 1 : 0, price: CANE_SOURCES[forceSrc].priceMult }
    : mixProfile(s);
  const trash = Math.max(0, p.trash + up(s, 'canedev', 'trashAdj'));
  const ccs = clamp(seasonCCS(s.day) + p.ccs + up(s, 'canedev', 'ccsAdj') + modSum(s, 'ccs') - 0.18 * Math.max(0, trash - 3), 6, 16);
  const pol = ccs + CONFIG.polOffsetCCS;
  const lot = {
    tons, pol, brix: pol * CONFIG.brixOverPol,
    fibre: 12.6 + 0.30 * trash,
    trash, burnt: p.burnt, ageH, price: p.price,
  };
  const last = s.yard.lots[s.yard.lots.length - 1];
  if (last && Math.abs(last.ageH - ageH) < 0.6 && Math.abs(last.pol - pol) < 0.25 && last.burnt === lot.burnt) {
    const T = last.tons + tons;
    last.pol = (last.pol * last.tons + pol * tons) / T;
    last.brix = (last.brix * last.tons + lot.brix * tons) / T;
    last.fibre = (last.fibre * last.tons + lot.fibre * tons) / T;
    last.trash = (last.trash * last.tons + trash * tons) / T;
    last.tons = T;
  } else s.yard.lots.push(lot);
}
function yardTons(s) { let t = 0; for (const l of s.yard.lots) t += l.tons; return t; }
function yardCCS(s) {
  let t = 0, p = 0;
  for (const l of s.yard.lots) { t += l.tons; p += l.tons * (l.pol - CONFIG.polOffsetCCS); }
  return t > 0 ? p / t : seasonCCS(s.day);
}
function oldestAgeH(s) { return s.yard.lots.length ? s.yard.lots[0].ageH : 0; }

/* ดึงอ้อยจากลานแบบเข้าก่อนออกก่อน คืนค่าเป็นกระแส + คุณสมบัติเฉลี่ย */
function drawCane(s, want) {
  let got = 0, pol = 0, brix = 0, fib = 0, trash = 0, age = 0;
  while (got < want - 1e-6 && s.yard.lots.length) {
    const lot = s.yard.lots[0];
    const take = Math.min(lot.tons, want - got);
    got += take;
    pol += take * lot.pol; brix += take * lot.brix; fib += take * lot.fibre;
    trash += take * lot.trash; age += take * lot.ageH;
    lot.tons -= take;
    if (lot.tons < 1e-6) s.yard.lots.shift();
  }
  if (got <= 0) return null;
  return { tons: got, pol: pol / got, brix: brix / got, fibre: fib / got, trash: trash / got, ageH: age / got };
}

/* เสื่อมสภาพอ้อยค้างลาน */
function ageCane(s, h) {
  for (let i = s.yard.lots.length - 1; i >= 0; i--) {
    const l = s.yard.lots[i];
    l.ageH += h;
    const rate = (l.ageH > 24 ? CONFIG.polDecayOld : CONFIG.polDecayFresh) * (l.burnt ? CONFIG.burntDecayMult : 1);
    l.pol = Math.max(3, l.pol - rate * h);
    l.brix = Math.max(l.pol * 1.02, l.brix - rate * 0.55 * h);
    l.tons *= (1 - CONFIG.weightLossPerH * h);
    if (l.ageH > CONFIG.caneRotHours) {
      s.today.rotDumped += l.tons;
      s.totals.caneRot += l.tons;
      pay(s, l.tons * CONFIG.caneDumpCost, 'dumpCost');
      s.reputation = clamp(s.reputation - 0.5, 0, 100);
      logMsg(s, `🗑️ ทิ้งอ้อยเน่า ${fmt(l.tons)} ตัน (ค้างลานเกิน ${CONFIG.caneRotHours} ชม.)`, 'bad');
      s.yard.lots.splice(i, 1);
    }
  }
}

/* =====================================================================
   สายวัตถุดิบ: ทีม 1 (หาอ้อย) → ทีม 2 (ตัด+ขน) → ทีม 3 (ลานอ้อย)
   ผลกระทบลูกโซ่ที่ออกแบบไว้ (อ้างอิง cane-brain / Peter Rein Ch.2)

   A) ทีม 2 ตัดไม่ทันทีม 1  → อ้อยที่หาไว้ค้างในไร่ ส่วนเกินถูกโรงงานอื่นแย่ง
                              ชาวไร่เสียความเชื่อมั่น (growerTrust ลด) → ทีม 1 หาอ้อยได้น้อยลง
   B) ทีม 3 รับไม่ทันทีม 2  → รถต่อคิว ชั่วโมงตัด-ถึง-หีบเพิ่ม (CCS −0.042/ชม.)
                              คิวยาวมาก รถบางส่วนหนีไปโรงงานอื่น + ชาวไร่ไม่พอใจ
   C) ลูกหีบช้ากว่าทีม 3     → อ้อยกองค้างลาน เสื่อมต่อ เกิน 96 ชม. ต้องทิ้ง
   D) ลูกหีบเร็วกว่าทีม 3    → อ้อยขาด เดินเครื่องเปล่า (noCaneH) เสีย Time Efficiency
   ===================================================================== */
function runSupply(s, h, P, space, millTpd) {
  const t = s.today;

  /* --- ทีม 1: หาอ้อย → กองรออยู่ในไร่ (standing) ---
     ถ้าอ้อยที่หาไว้ค้างอยู่มากแล้ว ทีมส่งเสริมจะชะลอการหาเพิ่ม (เหมือนของจริง)
     ผลคือกำลังของทีม 1 ที่เกินทีม 2 กลายเป็น "เงินลงทุนที่ไม่ได้ใช้" ไม่ใช่อ้อยหายวับ */
  const standCap = Math.max(1500, dCap(s, 'harvest') * 3);
  const slow = clamp(1 - s.field.standing / standCap, 0.15, 1);
  const found = P.promoTpd / 24 * h * slow;
  s.field.standing += found;
  t.found += found;

  /* --- ทีม 2: ตัดและขน → เข้าคิวหน้าโรงงาน ---
     "อย่าตัดล่วงหน้ามากกว่าคิวรถที่มีจริง" — คิวยาวแล้วทีมตัดจะชะลอ ไม่ตัดทิ้งไว้ให้เสื่อม */
  const qSoft = Math.max(600, P.yardCap * 0.5);
  const cutSlow = clamp(1 - (s.yard.queueTons - qSoft) / qSoft, 0.5, 1);   // floor 0.5: ตัดไม่หยุดกะทันหันเมื่อคิวยาว
  const cut = Math.min(s.field.standing, P.harvestTpd / 24 * h * cutSlow);
  s.field.standing -= cut;
  s.yard.queueTons += cut;
  t.harvested += cut;

  /* A) กองในไร่ล้น → อ้อยส่วนเกินถูกโรงงานอื่นแย่ง + ชาวไร่เสียความเชื่อมั่น */
  if (s.field.standing > standCap) {
    const lost = s.field.standing - standCap;
    s.field.standing = standCap;
    s.totals.caneLost += lost;
    s.growerTrust = clamp(s.growerTrust - lost / Math.max(1, P.promoTpd) * 2.0, 0, 100);
  }

  /* --- ทีม 3: รับเข้าลาน ---
     ลานที่เต็มเกิน 60% จะถือรถไว้ไม่ให้เกินกำลังหีบ (โรงงานจริงทำแบบนี้)
     ผลคือแทนที่อ้อยจะไปนอนเน่าในลาน มันไปรอเป็นคิวรถแทน — ผู้เล่นเห็นชั่วโมงคิวชัด ๆ */
  const yt = yardTons(s), fill = yt / Math.max(1, P.yardCap);
  /* กองในลานยิ่งสูง ยิ่งถือรถไว้ ให้กองระบายลงมาอยู่ราว 35% ของความจุ
     (โรงงานจริงคุมกองให้บาง เพราะอ้อยกองไว้ = CCS หายทุกชั่วโมง) */
  const hold = fill > 0.35 ? (millTpd || 0) / 24 * h * clamp(1.63 - fill * 1.8, 0.25, 1.05) : Infinity;
  const recvWant = P.recvTph * h;
  const recv = Math.min(s.yard.queueTons, recvWant, space, hold);
  if (recv > 0) receiveCane(s, recv, P, s.yard.queueH || 0);
  s.yard.queueTons -= recv;
  t.received += recv;

  /* B) คิวรถ: ชั่วโมงที่รถต้องรอ = ตันในคิว ÷ กำลังรับต่อชั่วโมง */
  const qh = P.recvTph > 1 ? s.yard.queueTons / P.recvTph : 48;
  s.yard.queueH = clamp(qh + modSum(s, 'queueH'), 0, 72);
  t.queueH = s.yard.queueH;

  /* คิวยาวเกิน 18 ชม. → รถบางส่วนหนีไปโรงงานอื่น และชาวไร่เสียความเชื่อมั่น */
  if (s.yard.queueH > 18 && s.yard.queueTons > 0) {
    const flee = s.yard.queueTons * Math.min(0.06, (s.yard.queueH - 18) / 400) * h;
    s.yard.queueTons -= flee;
    t.diverted += flee; s.totals.caneDiverted += flee;
    s.growerTrust = clamp(s.growerTrust - flee / Math.max(1, P.recvTph * 24) * 3.0, 0, 100);
  }
  t.rejected += Math.max(0, Math.min(s.yard.queueTons + recv, recvWant) - recv);

  /* ความเชื่อมั่นชาวไร่ฟื้นช้า ๆ เมื่อคิวสั้นและรับอ้อยได้ดี */
  if (s.yard.queueH < 8) s.growerTrust = clamp(s.growerTrust + 0.06 * h * dv(s, 'promo', 'trust'), 0, 100);
}

/* =====================================================================
   พารามิเตอร์กระบวนการที่คำนวณจากอัปเกรด + ค่าที่ตั้ง + เหตุการณ์
   ===================================================================== */
function proc(s) {
  const c = s.ctrl;
  /* v2.0: "สภาพเครื่อง" คือค่าพลังเครื่องจักร (0-100) — ต่ำกว่า 70 ประสิทธิภาพเริ่มตก */
  const health = k => dPower(s, k);
  const wearPen = k => Math.min(0.3, Math.max(0, (70 - health(k)) / 150));

  const PI = clamp(up(s, 'prep', 'pi') + modSum(s, 'pi') - wearPen('mill') * 6, 70, 98);

  /* Imbibition: ผลตอบแทนลดลงเมื่อเกิน 300% (Rein Ch.7) */
  const imbEff = up(s, 'imb', 'imbEff');
  const x = clamp(c.imbibition, 150, 400);
  let imbGain;
  if (x <= CONFIG.imbRef) imbGain = CONFIG.imbPer10 * imbEff * (x - CONFIG.imbRef) / 10;
  else if (x <= 320) imbGain = CONFIG.imbPer10 * imbEff * (x - CONFIG.imbRef) / 10 * 0.75;
  else imbGain = CONFIG.imbPer10 * imbEff * (40 / 10 * 0.75 + (x - 320) / 10 * 0.25);

  /* Pol%Bagasse: ค่าฐานของชุดหีบตามดาว (ที่ PI ของดาวนั้นและ imbibition 280%)
     แล้วปรับด้วย PI ที่เปลี่ยนจากเหตุการณ์/ค่าพลัง และน้ำ imbibition ที่ตั้งไว้ */
  const polBagPct = clamp(
    dv(s, 'mill', 'polBag')
    - CONFIG.polBagPerPI * (PI - dv(s, 'mill', 'pi'))
    - imbGain
    + wearPen('mill') * 1.4,
    0.7, 4.5);

  /* inversion: โค้ง U ต่ำสุดที่ pH ~7.0-7.2 */
  const retMin = up(s, 'clar', 'retMin');
  const pH = clamp(c.pH + modSum(s, 'ph'), 5.5, 9.0);
  const alk = Math.pow(1.91, Math.max(0, pH - 7.0) / 0.2);
  const acid = Math.pow(10, Math.max(0, 6.8 - pH) * 1.15);
  const inversionPct = CONFIG.invRef * (retMin / 30) * Math.max(alk, acid);

  const polFCPct = Math.max(0.3, up(s, 'filter', 'polFC') + modSum(s, 'polFC'));

  /* หม้อต้ม: กำลังระเหยผูกกับกำลังของแผนก (ตันอ้อย/วัน) และลดตามตะกรัน
     น้ำที่ต้องระเหยต่อ 1 ตันอ้อย = น้ำอ้อยผสม 1.05 − น้ำเชื่อม 0.25 ≈ 0.80 ตัน */
  const scaleFac = 1 - clamp(s.dept.evap.scale || 0, 0, 0.62) * 0.55;
  const evapCapTph = dCap(s, 'evap') / 24 * (CONFIG.juicePerCane - CONFIG.syrupPerCane)
    * scaleFac * modMul(s, 'evapCap') * (1 - wearPen('evap') * 0.5);

  /* FM purity: จากรางเย็น + คุณภาพน้ำเชื่อม + เหตุการณ์ */
  const ptyFMBase = up(s, 'cryst', 'ptyFM') + modSum(s, 'ptyFM');

  /* พนักงาน: ขวัญกำลังใจต่ำ = ทำงานช้าลง (ทีม HR ช่วยพยุง) */
  const staffEff = clamp(0.86 + s.staffSat / 100 * 0.18, 0.80, 1.06) * dv(s, 'hr', 'eff');

  return {
    PI, polBagPct, imbGain, inversionPct, pH, polFCPct, evapCapTph, ptyFMBase, staffEff,
    millTph: dCap(s, 'mill') / 24 * modMul(s, 'millCap') * staffEff,
    clarTph: dCap(s, 'clar') / 24 * CONFIG.juicePerCane * modMul(s, 'clarCap'),
    panVolTph: dCap(s, 'pan') / 24 * CONFIG.syrupPerCane * CONFIG.volPerSyrup * modMul(s, 'panCap'),
    fugalVolTph: dCap(s, 'fugal') / 24 * CONFIG.syrupPerCane * CONFIG.volPerSyrup * modMul(s, 'fugalCap'),
    packTph: dCap(s, 'pack') / 24 * staffEff,
    recAdj: up(s, 'fugal', 'recAdj') + modSum(s, 'rec'),
    econ: up(s, 'evap', 'econ'),
    syrupBxMax: up(s, 'evap', 'bx'),
    boilerEff: clamp(up(s, 'boiler', 'eff') - wearPen('boiler') * 0.15, 0.3, 0.85),
    steamCapTph: up(s, 'boiler', 'steamCap') * modMul(s, 'steamCap'),
    kwhPerSteam: up(s, 'turbine', 'kwhPerSteam'),
    auxKwhPerTon: up(s, 'turbine', 'aux'),
    bagMoist: clamp(CONFIG.bagasseMoistRef + (up(s, 'boiler', 'moistAdj') || 0) + modSum(s, 'bagMoist')
      + 0.012 * (c.imbibition - CONFIG.imbRef), 40, 58),
    undetPct: Math.max(0.2, CONFIG.undetBase + up(s, 'auto', 'undetAdj') + modSum(s, 'undet')
      + Math.max(0, dOver(s, 'evap').v - 1) * 1.6),
    /* --- สายวัตถุดิบ ทีม 1-3 --- */
    promoTpd: dCap(s, 'promo') * modMul(s, 'promoCap') * (0.6 + s.growerTrust / 100 * 0.5),
    harvestTpd: dCap(s, 'harvest') * modMul(s, 'harvestCap') * staffEff,
    recvTph: dCap(s, 'yard') / 24 * modMul(s, 'recv') * staffEff,
    yardCap: up(s, 'yard', 'yardCap'),
    whCap: up(s, 'warehouse', 'whCap'),
    shipTpd: up(s, 'warehouse', 'ship') * modMul(s, 'ship'),
    wRate: up(s, 'wwt', 'wRate'),
  };
}

/* =====================================================================
   ค่าพลังเครื่องจักร — ลดตามการเดินเครื่องและการเร่งเครื่อง
   ค่าพลัง 0 = เครื่องพัง หยุดทั้งกระบวนการ ซ่อมอย่างน้อย 1 วัน
   (ลดลง 20% ต่อ 1 ดาวของทีมซ่อมบำรุง)
   ===================================================================== */
function drainPower(s, id, h, load) {
  const x = s.dept[id];
  if (!x || x.downH > 0) return;
  x.runH += h;
  const drop = drainPerHour(s, id) * h * clamp(0.35 + load, 0.35, 1.5);
  x.power = clamp(x.power - drop, 0, 100);
  if (x.power <= 0) breakMachine(s, id, 'ค่าพลังเครื่องจักรหมด');
}

function breakMachine(s, id, reason) {
  const x = s.dept[id];
  if (x.downH > 0) return;
  const hrs = repairHours(s);
  x.downH = hrs;
  x.power = 0;
  x.brokenDays++;
  s.totals.breakdowns++;
  s.todayBreaks = (s.todayBreaks || 0) + 1;
  const cost = 350_000 + rnd() * 450_000;
  pay(s, cost, 'repair');
  s.staffSat = clamp(s.staffSat - 2, 0, 100);
  logMsg(s, `💥 ${dept(id).name}พัง (${reason}) — หยุด ${hrs.toFixed(1)} ชม. ค่าซ่อม ฿${fmt(cost)}`, 'bad');
}

/* เครื่องที่พัง: เดินเวลาซ่อม เมื่อครบให้ค่าพลังกลับมาตามความสามารถทีมซ่อมบำรุง */
function tickRepairs(s, h) {
  for (const d of DEPTS) {
    const x = s.dept[d.id];
    if (x.downH > 0) {
      x.downH -= h;
      if (x.downH <= 0) {
        x.downH = 0;
        if (d.kind === 'machine' && x.power <= 0) {
          x.power = dv(s, 'maint', 'restore') * 0.85;
          logMsg(s, `🟢 ซ่อม${d.name}เสร็จ — ค่าพลังกลับมา ${Math.round(x.power)}%`, 'good');
        }
      }
    }
  }
}

/* สายการผลิตหยุดทั้งกระบวนการหรือไม่ (เครื่องใดเครื่องหนึ่งในสายพัง) */
function lineDown(s) { return LINE_IDS.find(id => s.dept[id].downH > 0) || null; }

/* =====================================================================
   เดินเครื่อง 1 ก้าว (dt = วินาทีจริง)
   ===================================================================== */
function stepSim(s, dt) {
  if (s.ended || s.speed === 0 || !s.started) return;   // ยังไม่กดเริ่มหีบ = เวลาไม่เดิน
  const hours = dt * s.speed * (24 / CONFIG.dayLengthSec);
  if (hours <= 0) return;
  runHours(s, Math.min(hours, 2));
  s.dayProgress += hours / 24;
  while (s.dayProgress >= 1) {
    s.dayProgress -= 1;
    endOfDay(s);
    if (s.ended) return;
    startDay(s);
  }
}

function runHours(s, h) {
  const t = s.today, P = proc(s);
  t.hours += h;
  t.pi = P.PI;
  t.bagMoist = P.bagMoist;

  tickRepairs(s, h);

  /* ---------------- วันหยุดล้างเครื่อง ----------------
     ทั้งโรงงานหยุดหีบ · ช่างล้างตะกรัน เปลี่ยนค้อน ตรวจเครื่อง
     ค่าพลังเครื่องจักรฟื้นตามความสามารถของทีมซ่อมบำรุง (55% → 100%)
     อ้อยยังทยอยเข้าลานได้บ้างและยังเสื่อมตามเวลา */
  if (s.cleanDay.active) {
    s.cleanDay.hoursLeft -= h;
    t.cleanH += h; s.totals.cleanH += h; s.totals.openH += h;
    const restore = dv(s, 'maint', 'restore');
    for (const id of MACHINE_IDS) {
      const x = s.dept[id];
      if (x.downH <= 0) x.power = clamp(x.power + (restore - x.power) * Math.min(1, h / 20), 0, 100);
    }
    s.dept.evap.scale = Math.max(0, (s.dept.evap.scale || 0) - h / 20 * 0.6);
    s.staffSat = clamp(s.staffSat + 0.25 * h, 0, 100);      // ได้พักบ้าง
    const space0 = Math.max(0, P.yardCap - yardTons(s));
    runSupply(s, h * 0.5, P, space0, 0);
    ageCane(s, h);
    if (s.cleanDay.hoursLeft <= 0) finishCleanDay(s);
    return;
  }

  /* สายการผลิตพัง = หยุดทั้งกระบวนการ (อ้อยยังเข้าลานและเสื่อม) */
  const downId = lineDown(s);
  if (downId) {
    t.downH += h; s.totals.downH += h; s.totals.openH += h;
    const space0 = Math.max(0, P.yardCap - yardTons(s));
    runSupply(s, h, P, space0, 0);
    ageCane(s, h);
    t.stoppedBy = dept(downId).name;
    return;
  }

  /* ---------------- 1. สายวัตถุดิบ ทีม 1 → 2 → 3 ---------------- */
  const space = Math.max(0, P.yardCap - yardTons(s));
  runSupply(s, h, P, space, Math.min(s.ctrl.crushTarget, P.millTph) * 24);
  ageCane(s, h);

  /* ---------------- 2. ลูกหีบ ---------------- */
  const millUp = s.dept.mill.downH <= 0;
  let cane = null;
  if (millUp) {
    /* สายท้ายเต็ม (น้ำอ้อยค้างเกิน ~8 ชม.) -> ลูกหีบต้องชะลอ เหมือนโรงงานจริงที่ลดอัตราหีบเมื่อหม้อต้ม/หม้อเคี่ยวตามไม่ทัน */
    const jam = s.buf.mj.m > P.clarTph * 6 || s.buf.cj.m > P.evapCapTph * 10 || s.buf.syrup.m > P.panVolTph / CONFIG.volPerSyrup * 8;
    const backlog = jam ? 0.35 : 1;
    t.throttled = jam;
    const rate = Math.min(s.ctrl.crushTarget, P.millTph) * backlog;
    cane = drawCane(s, rate * h);
  }
  if (cane) {
    const fibre = cane.tons * cane.fibre / 100;
    const bagasse = fibre / CONFIG.fibreInBagasse;
    const polBag = bagasse * P.polBagPct / 100;
    const brixBag = bagasse * CONFIG.brixBagasse;
    const imbWater = cane.tons * cane.fibre / 100 * s.ctrl.imbibition / 100;
    const canePol = cane.tons * cane.pol / 100;
    const caneBrix = cane.tons * cane.brix / 100;

    strAdd(s.buf.mj, {
      m: cane.tons + imbWater - bagasse,
      B: Math.max(0, caneBrix - brixBag),
      P: Math.max(0, canePol - polBag),
    });
    s.stock.bagasse += bagasse;

    t.milled += cane.tons; t.bagasse += bagasse; t.polBag += polBag;
    t.imbWater += imbWater; t.polCane += canePol; t.brixCane += caneBrix;
    t.fibreCane += fibre; t.rawJuice += cane.tons + imbWater - bagasse;
    t.trash = cane.trash; t.ageH = cane.ageH;
    s.totals.cane += cane.tons; s.totals.polCane += canePol;
    s.totals.polBag += polBag; s.totals.bagasse += bagasse;
    pay(s, cane.tons * CONFIG.laborPerTonCane, 'labor');
    t.waterIn += cane.tons * CONFIG.waterPerTonCane;
    s.water.level += cane.tons * CONFIG.waterPerTonCane;
    wear(s, 'mill', h, cane.tons / Math.max(1, P.millTph * h));
  } else if (millUp && yardTons(s) < 1) {
    t.noCaneH += h; s.totals.noCaneH += h;
  }

  /* ---------------- 3. ทำใส ---------------- */
  if (s.stations.clar.downH <= 0 && s.buf.mj.m > 0) {
    const inFlow = Math.min(s.buf.mj.m, P.clarTph * h);
    const feed = strTake(s.buf.mj, inFlow / s.buf.mj.m);
    const invPol = feed.P * P.inversionPct / 100;
    const fcMass = feed.m * CONFIG.filterCakePctCane / 100 * 0.42;
    const fcPol = fcMass * P.polFCPct / 100;
    const fcBrix = fcPol / 0.75;
    strAdd(s.buf.cj, {
      m: feed.m - fcMass,
      B: Math.max(0, feed.B - fcBrix),
      P: Math.max(0, feed.P - invPol - fcPol),
    });
    t.clarIn += feed.m; t.clearJuice += feed.m - fcMass;
    t.filterCake += fcMass; t.polFC += fcPol; t.inversion += invPol;
    s.totals.polFC += fcPol;
    const limeT = feed.m * CONFIG.limePerTonCane / 1000 * (1 + Math.max(0, s.ctrl.pH - 7) * 1.4);
    pay(s, (limeT * CONFIG.limePrice + feed.m * CONFIG.flocPerTonJuice * CONFIG.flocPrice) * modMul(s, 'chemCost'), 'chemicals');
    wear(s, 'clar', h, 0.7);
  }

  /* ---------------- 4. หม้อต้มระเหย ---------------- */
  let steamEvapNeed = 0, steamPanNeed = 0;
  if (s.stations.evap.downH <= 0 && s.buf.cj.m > 0) {
    const bx = clamp(s.ctrl.syrupBrix, 55, P.syrupBxMax);
    const feedAll = s.buf.cj;
    /* ปริมาณที่ระเหยได้ในชั่วโมงนี้ */
    const maxWater = P.evapCapTph * h;
    /* น้ำที่ต้องระเหยต่อ 1 ตันน้ำใส */
    const bxIn = brixPct(feedAll);
    const waterPerTon = bxIn > 0 ? 1 - bxIn / bx : 0;
    let inFlow = waterPerTon > 0.01 ? Math.min(feedAll.m, maxWater / waterPerTon) : feedAll.m;
    if (inFlow > 0) {
      const feed = strTake(feedAll, inFlow / feedAll.m);
      const syrupM = feed.B / (bx / 100);
      const water = Math.max(0, feed.m - syrupM);
      /* undetermined loss เกิดที่นี่ (รั่ว/entrainment/คอนเดนเสทปน) */
      const undet = feed.P * P.undetPct / 100;
      strAdd(s.buf.syrup, { m: syrupM, B: feed.B, P: Math.max(0, feed.P - undet) });
      t.evapIn += feed.m; t.waterEvap += water; t.syrup += syrupM;
      t.polUndet += undet; s.totals.polUndet += undet;
      steamEvapNeed = water / P.econ;
      s.dept.evap.scale = clamp((s.dept.evap.scale || 0) + CONFIG.scalePerDay / 24 * h
        * (1 + Math.max(0, s.ctrl.pH - 7.2) * 3) * modMul(s, 'scale'), 0, 0.62);
      wear(s, 'evap', h, 0.8);
    }
  }

  /* ---------------- 5. หม้อเคี่ยว + ปั่นแยก ---------------- */
  if (s.stations.pan.downH <= 0 && s.stations.fugal.downH <= 0 && s.buf.syrup.B > 0) {
    const ptyS = pty(s.buf.syrup);
    /* น้ำเชื่อมบริสุทธิ์ต่ำ -> ไล่โมลาสยากขึ้น */
    const ptyFM = clamp(P.ptyFMBase + Math.max(0, 84.5 - ptyS) * 0.16, 28, 48);
    /* ข้อจำกัดกำลัง: หม้อเคี่ยว (ปริมาตรมัสซิควีต) และหม้อปั่น · ถังกากน้ำตาลเต็ม -> ปั่น C ระบายไม่ได้ กำลังเหลือ 35%
       กองน้ำตาลรอบรรจุเต็ม (บรรจุไม่ทัน) -> หม้อปั่นชะลอ 50% */
    const volPerSyrup = CONFIG.volPerSyrup;
    const molCap = up(s, 'molTank', 'molCap');
    t.molFull = s.stock.molasses >= molCap * 0.995;
    t.packFull = s.rawSugar >= RAW_SUGAR_BIN * 0.98;
    const capBySyrup = Math.min(P.panVolTph, P.fugalVolTph) / volPerSyrup * h * (t.molFull ? 0.35 : 1) * (t.packFull ? 0.5 : 1);
    let inFlow = Math.min(s.buf.syrup.m, capBySyrup);
    t.panLimited = s.buf.syrup.m > capBySyrup * 1.05 && P.panVolTph <= P.fugalVolTph;
    t.fugalLimited = s.buf.syrup.m > capBySyrup * 1.05 && P.fugalVolTph < P.panVolTph;
    if (inFlow > 0) {
      const feed = strTake(s.buf.syrup, inFlow / s.buf.syrup.m);
      const x = clamp((pty(feed) - ptyFM) / (CONFIG.ptyASugar - ptyFM), 0, 0.95);
      /* น้ำล้าง: ล้างมากได้สีดีแต่ละลายน้ำตาลกลับ */
      const washPen = Math.max(0, s.ctrl.wash - CONFIG.washRef) * CONFIG.washYieldPer1 / 100;
      const recFac = 1 + P.recAdj / 100 - washPen;
      const sugarB = feed.B * x * clamp(recFac, 0.85, 1.05);
      const sugarM = sugarB / (CONFIG.brixASugar / 100);
      const sugarP = sugarB * CONFIG.ptyASugar / 100;
      const fmB = Math.max(0, feed.B - sugarB);
      const fmP = Math.max(0, feed.P - sugarP);
      const fmM = fmB / 0.84;

      /* น้ำตาลจากหม้อปั่นไปกองรอบรรจุ (สถานีบรรจุจะย้ายเข้าคลัง) */
      s.rawSugar += sugarM;
      const molSpace = Math.max(0, molCap - s.stock.molasses);
      s.stock.molasses += Math.min(fmM, molSpace);
      t.molOverflow += Math.max(0, fmM - molSpace);

      t.centIn += feed.m; t.sugar += sugarM; t.molasses += fmM; t.ptyFM = ptyFM;
      s.totals.sugar += sugarM; s.totals.molasses += fmM;
      s.totals.polSugar += sugarP; s.totals.polFM += fmP;
      s.totals.brixSyrup += feed.B; s.totals.polSyrup += feed.P;

      steamPanNeed = feed.m * CONFIG.panWaterPerSyrup * CONFIG.steamPerPanWater;
      wear(s, 'pan', h, 0.8); wear(s, 'fugal', h, 0.9);
    }
  }

  /* ---------------- 5b. สถานีบรรจุ: กองน้ำตาล -> ถุง -> คลัง ---------------- */
  if (s.rawSugar > 0 && s.dept.pack.downH <= 0) {
    const capH = P.packTph * h;
    const take = Math.min(s.rawSugar, capH);
    const lost = take * up(s, 'packing', 'packLoss') / 100;
    const net = take - lost;
    const space2 = Math.max(0, P.whCap - s.stock.sugar);
    const stored = Math.min(net, space2);
    t.overflow += net - stored;
    s.stock.sugar += stored; s.rawSugar -= take;
    t.packed += net; t.packLoss += lost;
    s.totals.polSugar -= lost * CONFIG.ptyASugar / 100 * 0.996;      // น้ำตาลที่หกหายไม่นับเป็นผลผลิต
    s.totals.sugar -= lost;
    if (take > 0) wear(s, 'pack', h, take / Math.max(0.1, capH));
    if (t.overflow > 0 && rnd() < 0.05) logMsg(s, `🚨 คลังเต็ม น้ำตาลล้น ${fmt(t.overflow)} ตัน`, 'bad');
  }

  /* ---------------- 6. หม้อไอน้ำ + ไฟฟ้า ---------------- */
  const steamNeed = steamEvapNeed + steamPanNeed + (cane ? cane.tons * CONFIG.steamHeaters : 0);
  let steamMade = 0;
  if (s.stations.boiler.downH <= 0) {
    const gcv = 18309 - 207.6 * P.bagMoist - 31.14 * (CONFIG.brixBagasse * 100);  // kJ/kg
    const steamPerBag = gcv / 1000 * P.boilerEff / CONFIG.enthalpySteam;          // ตันไอ/ตันชานอ้อย
    const capH = P.steamCapTph * h;
    const wantSteam = Math.min(steamNeed, capH);
    let bagNeed = wantSteam / Math.max(0.5, steamPerBag);
    const bagUse = Math.min(bagNeed, s.stock.bagasse);
    steamMade = bagUse * steamPerBag;
    s.stock.bagasse -= bagUse;
    t.bagasseUsed += bagUse;
    /* น้ำมันเตาเสริม */
    if (steamMade < steamNeed - 1e-6 && s.ctrl.useOil) {
      const need = Math.min(steamNeed, capH) - steamMade;
      const oil = need / 13.5;
      steamMade += need;
      t.oilUsed += oil;
      pay(s, oil * CONFIG.fuelOilPrice, 'fuelCost');
    }
    wear(s, 'boiler', h, steamMade / Math.max(0.1, capH));
  }
  t.steamMade += steamMade; t.steamUsed += Math.min(steamMade, steamNeed);
  s.totals.steam += steamMade;
  if (steamNeed > steamMade + 1e-6) t.steamShort = true;

  /* ทีม 12 ผลิตไฟฟ้า: กังหันปั่นไฟจากไอน้ำที่หม้อไอน้ำ (ทีม 11) ส่งมา
     - ปั่นได้เท่าไร = ไอน้ำ × kWh/ตันไอ ของกังหัน (ดาว + เร่งเครื่อง + ค่าพลัง)
     - โรงงานใช้เองเท่าไร = aux ของทีมนี้ (35 kWh/tc ที่ 0 ดาว → 24 ที่ 5 ดาว)
     - เหลือ = ขายเข้าระบบ ฿3.2/kWh · ขาด = ต้องซื้อจากการไฟฟ้า ฿4.2/kWh (แพงกว่า) */
  const kwh = steamMade * P.kwhPerSteam;
  const internal = (cane ? cane.tons : 0) * P.auxKwhPerTon;
  const net = kwh - internal;
  const exp = Math.max(0, net) * modMul(s, 'export');
  const buy = Math.max(0, -net);
  t.kwh += kwh; t.kwhInternal += internal; t.powerExport += exp; t.kwhBought += buy;
  s.totals.kwh += kwh; s.totals.kwhExport += exp; s.totals.kwhBought += buy;
  if (exp > 0) {
    const rev = exp * CONFIG.ppaPrice;
    s.cash += rev; t.powerRev += rev;
    s.totals.revenue += rev; s.totals.revPower += rev;
  }
  if (buy > 0) pay(s, buy * CONFIG.gridBuyPrice, 'gridCost');

  /* ---------------- 7. น้ำเสีย ---------------- */
  const treated = Math.min(s.water.level, P.wRate / 24 * h);
  s.water.level -= treated;
  if (s.water.level > s.water.cap) {
    const of = s.water.level - s.water.cap;
    s.water.level = s.water.cap;
    t.waterOverflow += of; s.totals.waterOverflow += of;
    pay(s, of * CONFIG.waterFinePerM3, 'waterFine');
    s.reputation = clamp(s.reputation - of * 0.004, 0, 100);
  }

  /* ---------------- 7b. เหตุฉุกเฉิน + เหตุการณ์ที่รอตัดสินใจ ---------------- */
  emergencyTick(s, h);
  for (let i = s.decisions.length - 1; i >= 0; i--) {
    const d = s.decisions[i]; d.elapsedH += h;
    if (d.elapsedH >= d.deadlineH) { const ev = EVENTS.find(e => e.id === d.evId); logMsg(s, `⏰ ${ev.name}: ไม่ได้ตัดสินใจทันเวลา ใช้ทางเลือกปริยาย`, 'bad'); decideEvent(s, d.evId, ev.defaultChoice || 0, true); }
  }

  /* ---------------- 8. เวลาเดินเครื่อง + ค่าพลังฝั่งผลิตไฟฟ้า ---------------- */
  if (kwh > 0) wear(s, 'power', h, clamp(kwh / Math.max(1, steamMade * 150), 0.4, 1.2));

  const anyDown = PROCESS_STATIONS.some(k => s.dept[k].downH > 0);
  if (anyDown) { t.downH += h; s.totals.downH += h; }
  else if (cane) { t.runH += h; s.totals.runH += h; }
  else if (!millUp) { t.downH += h; s.totals.downH += h; }
  s.totals.openH += h;

  /* ---------------- 9. ขวัญกำลังใจพนักงาน ----------------
     เร่งเครื่องหนัก + ทำงานต่อเนื่อง = เหนื่อย · ทีม HR ช่วยฟื้น */
  const fatigue = overdriveLoad(s) * 0.11 + (cane ? 0.035 : 0);
  const recover = dv(s, 'hr', 'morale') * 0.045;
  s.staffSat = clamp(s.staffSat + (recover - fatigue) * h, 0, 100);
}

/* รับอ้อยเข้าลาน + จ่ายค่าอ้อยขั้นต้น 70% */
/* อ้อยเข้าลาน: อายุตั้งต้น = ชั่วโมงตัด-ถึง-โรงงานของทีมเก็บเกี่ยว + เวลารอคิวหน้าโรงงาน
   ค่าอ้อยไม่จ่ายสดทั้งก้อน — สะสมไว้จ่ายทุก 7 วันตามระบบไทย */
function receiveCane(s, take, P, queueH = 0) {
  const t = s.today, mp = mixProfile(s);
  const transportH = dv(s, 'harvest', 'cut') * 0.55 + mp.cut * 0.20;
  pushCane(s, take, null, transportH + queueH);
  const ccs = yardCCS(s);
  const price = (CONFIG.canePriceBase + Math.max(0, ccs - 10) * CONFIG.canePricePerCCS + modSum(s, 'caneCostAdj'))
    * mp.price * s.market.canePriceMult * diff().caneMult;
  const total = take * price;
  s.payable.accrued += total * CONFIG.caneUpfront;      // ค้างจ่าย จ่ายจริงทุก 7 วัน
  s.payable.amount += total * (1 - CONFIG.caneUpfront); // ค่าอ้อยขั้นสุดท้าย
  t.caneAccrued += total;
}

/* =====================================================================
   เหตุฉุกเฉิน
   ===================================================================== */
function emergencyTick(s, h) {
  const E = s.emergency;
  if (!E) {
    /* สุ่มเกิด (ต่อชั่วโมง) ตามความยากและระดับทีมฉุกเฉิน */
    const mult = diff(s).emerP * up(s, 'ert', 'ertProb') * modMul(s, 'safety');
    for (const def of EMERGENCIES) {
      if (def.cond && !def.cond(s)) continue;
      const w = (def.weight ? def.weight(s) : 1) * (def.id === 'injury' ? clamp(1.7 - s.staffSat / 100, 0.5, 1.7) : 1);
      if (rnd() < def.p * mult * w * h / 24) { startEmergency(s, def); break; }
    }
    return;
  }
  const def = EMERGENCIES.find(d => d.id === E.id);
  E.elapsedH += h;
  if (E.choice === null) {
    if (def.ongoing) E.loss += def.ongoing(s, h) || 0;
    if (E.elapsedH >= E.deadlineH) { logMsg(s, `⏰ ${def.name}: ไม่มีคำสั่งการภายในเวลา — ระบบเลือกทางที่แย่ที่สุดให้`, 'bad'); chooseEmergency(s, def.options.length - 1, true); }
    return;
  }
  /* กำลังดำเนินการ */
  if (def.ongoing && E.id === 'bagasse_fire') E.loss += def.ongoing(s, h) * 0.3 || 0;
  if (E.elapsedH >= E.resolveAtH) finishEmergency(s);
}
function startEmergency(s, def) {
  s.emergency = { id: def.id, name: def.name, icon: def.icon, cause: def.cause, startDay: s.day, elapsedH: 0, deadlineH: def.deadlineH, choice: null, resolveAtH: 0, loss: 0, shown: false, station: null };
  if (def.onStart) def.onStart(s);
  logMsg(s, `🚨 เหตุฉุกเฉิน: ${def.name} — ${def.cause}`, 'bad');
}
function chooseEmergency(s, i, auto = false) {
  const E = s.emergency; if (!E || E.choice !== null) return;
  const def = EMERGENCIES.find(d => d.id === E.id), opt = def.options[i]; if (!opt) return;
  const teamLv = dStar(s, 'ert'), qcLv = dStar(s, 'qc');
  if (opt.needTeam && teamLv < opt.needTeam) { toast('ต้องมีทีมตอบสนองเหตุฉุกเฉินก่อน (อัปเกรดทีม 15)'); return; }
  if (opt.needQC && qcLv < opt.needQC) { toast('ต้องมีทีมคุณภาพก่อน (อัปเกรดทีม 17)'); return; }
  const tMult = up(s, 'ert', 'ertTime'), lMult = up(s, 'ert', 'ertLoss'), cMult = up(s, 'ert', 'ertLoss');
  E.choice = i; E.optLabel = opt.label; E.auto = auto;
  E.resolveAtH = E.elapsedH + Math.max(0.5, opt.hours * (opt.needTeam ? tMult : 1));
  if (opt.cost) pay(s, Math.round(opt.cost * (opt.needTeam ? cMult : 1)), 'penalty');
  if (opt.lossPct) { const loss = s.stock.bagasse * opt.lossPct * (opt.needTeam ? lMult : 1); s.stock.bagasse -= loss; E.loss += loss; }
  if (opt.boilerDownH) s.dept.boiler.downH = Math.max(s.dept.boiler.downH, opt.boilerDownH);
  if (opt.stationDownH && E.station) s.dept[E.station].downH = Math.max(s.dept[E.station].downH, opt.stationDownH);
  if (opt.orderRateHit) s.orderRateMult *= opt.orderRateHit;
  if (opt.water) s.water.level = Math.max(0, s.water.level * (1 + opt.water));
  if (opt.cust) s.custSat = clamp(s.custSat + opt.cust, 0, 100);
  if (opt.staff) s.staffSat = clamp(s.staffSat + opt.staff, 0, 100);
  if (opt.gov) s.complaints.gov += opt.gov;
  if (opt.labourComplaint) s.complaints.labour += opt.labourComplaint;
  if (opt.custComplaint) s.complaints.customer += opt.custComplaint;
  let rep = opt.rep || 0;
  if (opt.successP !== undefined) {
    const pOk = Math.min(0.95, opt.successP + qcLv * 0.13);       // ทีมคุณภาพยิ่งเก่ง ยิ่งเจรจาสำเร็จ
    if (rnd() > pOk) { rep = opt.failRep; E.result = 'เจรจาไม่สำเร็จ'; s.custSat = clamp(s.custSat - 8, 0, 100); s.complaints.customer++; }
    else E.result = 'เจรจาสำเร็จ';
  }
  if (opt.riskFine && rnd() < opt.riskFine) { pay(s, opt.fine, 'penalty'); E.result = `ถูกปรับ ฿${fmt(opt.fine)}`; rep -= 4; s.complaints.gov++; }
  E.rep = rep;
  s.reputation = clamp(s.reputation + rep, 0, 100);
  logMsg(s, `🛠️ ${def.name}: เลือก "${opt.label}"${opt.cost ? ` ฿${fmt(opt.cost)}` : ''}${E.result ? ' — ' + E.result : ''}`, rep >= 0 ? 'info' : 'bad');
  if (E.resolveAtH <= E.elapsedH + 0.01) finishEmergency(s);
}
function finishEmergency(s) {
  const E = s.emergency; if (!E) return;
  s.emergencies.push({ id: E.id, name: E.name, day: E.startDay, opt: E.optLabel, loss: Math.round(E.loss), rep: E.rep || 0, result: E.result || '' });
  logMsg(s, `✅ ${E.name} จบแล้ว${E.loss > 1 ? ` · ชานอ้อยเสียหาย ${fmt(E.loss)} ตัน` : ''}`, 'good');
  s.emergency = null;
}

/* ---------- เดินเกมย้อนหลังตอนกลับมาเล่น (offline progress) ---------- */
function simulateOffline(s, realSeconds) {
  const hours = Math.min(48, realSeconds * (24 / CONFIG.dayLengthSec) * 0.5);   // ออฟไลน์เดินครึ่งความเร็ว สูงสุด 2 วัน
  if (hours < 1) return null;
  const before = { cash: s.cash, sugar: s.totals.sugar, day: s.day, rep: s.reputation, breaks: s.totals.breakdowns };
  const savedSpeed = s.speed; s.speed = 1;
  let left = hours;
  while (left > 0 && !s.ended) {
    const h = Math.min(2, left); left -= h;
    runHours(s, h);
    s.dayProgress += h / 24;
    while (s.dayProgress >= 1) { s.dayProgress -= 1; endOfDay(s); if (s.ended) break; startDay(s); }
    /* เหตุที่ต้องตัดสินใจระหว่างออฟไลน์ -> ผู้ช่วยเลือกทางปริยาย, เหตุฉุกเฉิน -> ทีมจัดการทางที่ปลอดภัยที่สุด */
    for (const d of s.decisions.slice()) { const ev = EVENTS.find(e => e.id === d.evId); decideEvent(s, d.evId, ev.defaultChoice || 0, true); }
    if (s.emergency && s.emergency.choice === null) chooseEmergency(s, 0, true) || chooseEmergency(s, 1, true);
  }
  /* ระบายน้ำตาลที่ผลิตระหว่างออฟไลน์ (เหลือ 25% ของคลังไว้ส่งออร์เดอร์) ให้เงินสดสะท้อนผลผลิตจริง */
  const keep = up(s, 'warehouse', 'whCap') * 0.25;
  if (s.stock.sugar > keep) sellSpot(s, Math.floor(s.stock.sugar - keep));
  s.speed = savedSpeed;
  return { hours, cashDelta: s.cash - before.cash, sugar: s.totals.sugar - before.sugar, days: s.day - before.day, repDelta: s.reputation - before.rep, breaks: s.totals.breakdowns - before.breaks };
}

/* ---------- ตัดสินใจเหตุการณ์ ---------- */
function decideEvent(s, evId, choiceIdx, auto = false) {
  const i = s.decisions.findIndex(d => d.evId === evId); if (i < 0) return;
  const ev = EVENTS.find(e => e.id === evId), ch = ev.choices[choiceIdx]; if (!ch) return;
  s.decisions.splice(i, 1);
  ch.apply(s);
  s.decisionsDone.push({ evId, day: s.day, label: ch.label, auto });
  logMsg(s, `${ev.icon} ${ev.name}: ${auto ? '(อัตโนมัติ) ' : ''}${ch.label}`, auto ? 'bad' : 'info');
}

/* ---------- เควส ---------- */
function activeQuests(s) { return QUESTS.filter(q => !s.questsDone.includes(q.id)).slice(0, 3); }
function updateQuests(s) {
  let done = null;
  for (const q of activeQuests(s)) {
    const r = q.check(s);
    const ok = r.lower ? r.cur <= r.target : r.cur >= r.target;
    if (ok) {
      s.questsDone.push(q.id);
      s.cash += q.reward.cash; s.totals.revenue += q.reward.cash;
      s.reputation = clamp(s.reputation + (q.reward.rep || 0), 0, 100);
      s.questLog.push({ id: q.id, day: s.day });
      logMsg(s, `🏅 เควสสำเร็จ: ${q.title} — รางวัล ฿${fmtM(q.reward.cash)}${q.reward.rep ? ` ชื่อเสียง +${q.reward.rep}` : ''}`, 'good');
      done = q; break;                 // ทีละเควส เพื่อให้เห็นรางวัลชัด
    }
  }
  if (done) s.newQuestDone = done;
  return done;
}

/* ---------- สึกหรอและโอกาสเสีย ---------- */
/* การเดินเครื่อง 1 ชั่วโมง: ลดค่าพลัง + โอกาสขัดข้องแบบสุ่ม
   ค่าพลังยิ่งต่ำ ยิ่งขัดข้องง่าย · เร่งเครื่องยิ่งแรง ยิ่งเสี่ยง */
function wear(s, key, h, load) {
  const st = s.dept[key];
  if (!st || st.downH > 0) return;
  drainPower(s, key, h, load);
  if (st.downH > 0) return;                       // พังไปแล้วจากค่าพลังหมด
  const hp = 1 + Math.max(0, 62 - st.power) / 11;
  const odRisk = 1 + Math.max(0, dOver(s, key).v - 1) * 2.5;
  const p = CONFIG.baseBreakChance * up(s, 'maint', 'breakMult') * diff().breakP * hp * odRisk * h / 24;
  if (rnd() < p) {
    const hrs = repairHours(s) * (st.power < 40 ? 0.50 : 0.25);
    st.downH = Math.max(st.downH, hrs);
    st.power = clamp(st.power - 12, 0, 100);
    s.totals.breakdowns++; s.todayBreaks = (s.todayBreaks || 0) + 1;
    pay(s, 320000 + rnd() * 300000, 'repair');
    logMsg(s, `⚠️ ${dept(key).name}ขัดข้อง หยุด ${hrs.toFixed(1)} ชม.`, 'bad');
  }
}

/* =====================================================================
   จบวัน / เริ่มวัน
   ===================================================================== */
/* ปรับความพึงพอใจรายวัน — แยกปัจจัยให้ชัดตามที่ออกแบบ
   • ลูกค้า  : ส่งมอบทันเวลา + คุณภาพน้ำตาล
   • พนักงาน : รายได้/ค่าจ้าง (ปันผลวันจ่าย) + สวัสดิการ (ทีมบุคคล) − อุบัติเหตุ/เครื่องพัง − ภาระหนี้
              (ภาระเร่งเครื่อง/ความเหนื่อยล้าคิดต่อเนื่องรายชั่วโมงใน runHours อยู่แล้ว)
   • ชาวไร่  : รับซื้อไว (คิวสั้น) + จัดรถตัด/ขนส่งทัน — คิดต่อเนื่องใน runSupply/runHours อยู่แล้ว */
function updateSatisfaction(s, t) {
  /* --- ลูกค้า: ส่งมอบทันเวลา (บวกทันทีตอนส่งใน deliverOrder อีกด้วย) + คุณภาพ --- */
  let cust = 0;
  if ((s.todayDelivered || 0) > 0)  cust += 1.0 + 0.4 * s.todayDelivered;   // ส่งมอบได้ตรงเวลา = ขึ้นชัดเจน
  else if ((s.todaySold || 0) > 0)  cust += 0.3;                            // มีการขายหน้าโรงงานบ้าง
  else                              cust -= 0.35;                           // ไม่มีการส่งมอบเลย
  cust -= s.qualityIssue * 0.6;                                             // คุณภาพมีปัญหา (สี/ความบริสุทธิ์)
  if (s.qualityIssue < 0.3)         cust += 0.3;                            // คุณภาพดีสม่ำเสมอ
  s.custSat = clamp(s.custSat + cust, 0, 100);

  /* --- พนักงาน: สวัสดิการ − อุบัติเหตุ − ภาระหนี้ (ค่าจ้างเพิ่มขวัญในวันจ่าย) --- */
  let staff = (dStar(s, 'hr') - 2) * 0.18;                     // สวัสดิการจากทีมบุคคล (ดาวสูง=ขวัญดี, ต่ำ=ตก)
  if ((s.todayBreaks || 0) > 0)  staff -= 0.3 * s.todayBreaks; // อุบัติเหตุ/เครื่องพัง = เสี่ยง/เครียด
  if (s.loan > 150_000_000)      staff -= 0.5;                 // บริษัทฝืดเคือง กระทบสวัสดิการ/ขวัญ
  s.staffSat = clamp(s.staffSat + staff, 0, 100);
}

function endOfDay(s) {
  const t = s.today;
  pay(s, CONFIG.dailyFixedCost, 'fixed');
  s.wagesAccrued += dv(s, 'hr', 'wage');            // ค่าจ้างสะสม จ่ายจริงทุก 15 วัน
  /* ตลาดฟื้นจากการเทขาย */
  s.market.pressure = (s.market.pressure || 0) * 0.7;
  settleContracts(s);
  settleDaily(s);
  checkTier(s);

  /* ---------- นับวันหีบ (วันล้างเครื่องนับตอนสั่งหยุด) ---------- */
  if (t.milled > 0 && t.cleanH < 12) s.crushDaysDone++;

  /* ---------- รอบการจ่ายเงินตามระบบไทย ---------- */
  if (s.day % CONFIG.canePayEvery === 0 && s.payable.accrued > 0) {
    const amt = s.payable.accrued; s.payable.accrued = 0;
    pay(s, amt, 'caneCost');
    logMsg(s, `🌾 จ่ายค่าอ้อยงวด ${CONFIG.canePayEvery} วัน ฿${fmt(amt)}`, 'info');
  }
  if (s.day % CONFIG.wagePayEvery === 0 && s.wagesAccrued > 0) {
    const amt = s.wagesAccrued; s.wagesAccrued = 0;
    pay(s, amt, 'labor');
    s.staffSat = clamp(s.staffSat + 1.5, 0, 100);     // รายได้: ได้ค่าจ้างตรงงวด = ขวัญกำลังใจดีขึ้น
    logMsg(s, `👷 จ่ายค่าจ้างพนักงานงวด ${CONFIG.wagePayEvery} วัน ฿${fmt(amt)}`, 'info');
  }

  /* ---------- ดอกเบี้ยเงินกู้ (คิดแยกตามก้อน · ยิ่งกู้มาก อัตรายิ่งสูง) ---------- */
  s.debts = s.debts || [];
  if (s.debts.length) {
    let interest = 0;
    for (const d of s.debts) { const i = d.principal * debtRate(s, d) / 365; d.principal += i; interest += i; }
    s.loan = s.debts.reduce((a, d) => a + d.principal, 0);
    s.loanInterestPaid += interest;
    s.totals.costInterest += interest;
    t.interest = interest;
    /* ระยะสั้นเลยกำหนดคืน = เบี้ยปรับดอกเบี้ยพุ่ง */
    for (const d of s.debts) {
      if (d.type === 'short' && !d.overdue && s.day > d.dueDay) {
        d.overdue = true;
        logMsg(s, `⚠️ เงินกู้ระยะสั้น ฿${fmt(Math.round(d.principal))} เลยกำหนดคืน — ดอกเบี้ยถูกปรับขึ้น ${ECON.overdueRateMul}x`, 'bad');
        if (typeof toast === 'function') toast(`⚠️ เงินกู้ระยะสั้นเลยกำหนด! ดอกเบี้ยพุ่งขึ้น ${ECON.overdueRateMul}x — รีบชำระหนี้`, 5000);
      }
    }
  } else if (s.loan > 0) {   // เผื่อเซฟเก่าที่ยังไม่มี debts
    const interest = s.loan * loanRate(s) / 365;
    s.loan += interest; s.loanInterestPaid += interest; s.totals.costInterest += interest; t.interest = interest;
  }

  /* ---------- คุณภาพน้ำตาลวันนี้ (ใช้กับความพึงพอใจลูกค้า) ---------- */
  s.qualityIssue = clamp((oldestAgeH(s) > 30 ? 0.6 : 0) + (s.ctrl.pH > 7.6 ? 0.4 : 0) + (t.ptyFM > 38 ? 0.4 : 0)
    - dStar(s, 'qc') * 0.25, 0, 2);

  /* ---------- ปรับความพึงพอใจ 3 ฝ่ายตามปัจจัยที่กำหนด ---------- */
  updateSatisfaction(s, t);
  if (s.staffSat < 35 && rnd() < 0.25) { s.complaints.labour++; logMsg(s, '📣 พนักงานยื่นข้อร้องเรียนเรื่องภาระงาน', 'bad'); }

  /* ราคากากน้ำตาลเดินสุ่ม (ผู้เล่นเลือกเวลาขายเอง) */
  { const p = s.market.molPrice; s.market.molPrice = Math.round(clamp(p + (CONFIG.molassesPrice - p) * 0.05 + (rnd() - 0.5) * 0.06 * p, 2500, 7500) / 10) * 10; }
  /* ชานอ้อยล้นลาน -> ขายเป็นเชื้อเพลิงชีวมวล */
  if (s.stock.bagasse > CONFIG.bagasseYardCap) {
    const sur = s.stock.bagasse - CONFIG.bagasseYardCap;
    s.stock.bagasse = CONFIG.bagasseYardCap;
    const rev = sur * CONFIG.bagasseSellPrice;
    s.cash += rev; t.powerRev += rev; s.totals.revenue += rev; s.totals.revPower += rev;
  }

  /* ค่าอ้อยขั้นสุดท้าย */
  if (CONFIG.caneFinalDays.includes(s.day) && s.payable.amount > 0) {
    const share = s.payable.nextIdx === 0 ? 0.5 : 1.0;
    const amt = s.payable.amount * share;
    pay(s, amt, 'finalPayment');
    s.payable.amount -= amt; s.payable.nextIdx++;
    logMsg(s, `🏦 จ่ายค่าอ้อยขั้นสุดท้ายงวดที่ ${s.payable.nextIdx} ฿${fmt(amt)}`, 'bad');
  }

  /* ยอดขายที่ทำระหว่างวัน */
  t.salesRev = s.pendingSales || 0; s.pendingSales = 0;
  s.totals.revSugar += t.salesRev;
  t.molassesRev = s.pendingMol || 0; s.pendingMol = 0;

  /* ออร์เดอร์ครบกำหนด */
  for (const o of s.orders) {
    if (o.status === 'open' && s.day >= o.expires) o.status = 'expired';
    if (o.status === 'accepted' && s.day >= o.deadline) {
      if (s.stock.sugar >= o.tons) { deliverOrder(s, o.id); continue; }
      const pen = Math.round(o.tons * o.price * 0.08);
      pay(s, pen, 'penalty');
      s.reputation = clamp(s.reputation - 8, 0, 100);
      s.custSat = clamp(s.custSat - 9, 0, 100);
      s.complaints.customer++;
      s.totals.ordersFailed++; o.status = 'failed';
      logMsg(s, `❌ ส่ง ${o.id} ไม่ทัน ค่าปรับ ฿${fmt(pen)} · ความพึงพอใจลูกค้า −9 · ข้อร้องเรียน +1`, 'bad');
    }
  }
  if (rnd() < CONFIG.orderChancePerDay * up(s, 'sales', 'orderRate') * (s.orderRateMult || 1) * (0.6 + s.reputation / 120)) createOrder(s);

  computeKPI(s);
  computeScore(s);
  updateQuests(s);
  s.history.push({
    day: s.day, cash: s.cash, sugar: t.sugar, milled: t.milled,
    recovery: s.kpi.recovery, ext: s.kpi.extraction, ptyFM: t.ptyFM || 0,
    steamOnCane: s.kpi.steamOnCane, price: s.market.sugarPrice, stock: s.stock.sugar,
    profit: dayProfit(t), timeEff: s.kpi.timeEff, kwhTc: s.kpi.kwhPerTc,
  });
  if (s.history.length > 200) s.history.shift();

  s.yesterday = t;
  s.hints = buildHints(s);

  /* ราคาน้ำตาลเดินสุ่มแบบดึงกลับค่ากลาง */
  const p0 = s.market.sugarPrice;
  s.market.sugarPrice = Math.round(clamp(p0 + (CONFIG.sugarBasePrice - p0) * 0.04 + (rnd() - 0.5) * 0.035 * diff().priceVol * p0, 11000, 29000) / 10) * 10;

  /* จบวันล้างเครื่องที่ค้างอยู่ (เผื่อกรณีวันเปลี่ยนก่อนครบ 24 ชม.) */
  if (s.cleanDay.active && s.cleanDay.hoursLeft <= 0) finishCleanDay(s);

  s.day++;
  /* จบฤดู: ครบ 130 วันตามปฏิทิน หรือหีบครบ 120 วัน */
  if (s.day > CONFIG.seasonDays || s.crushDaysDone >= CONFIG.crushDays) { s.ended = true; settleSeason(s); }
}

/* =====================================================================
   เงินกู้ — เงินสดติดลบไม่ได้ ขาดเมื่อไรกู้อัตโนมัติ
   อัตราดอกเบี้ยฐาน 8%/ปี +2%/ปี ทุกยอดกู้ 50 ล้าน (ความเสี่ยงเครดิต)
   ===================================================================== */
function loanRate(s) {
  return ECON.loanRateBase + Math.floor(s.loan / ECON.loanRateStepAt) * ECON.loanRateStep;
}
/* วงเงินกู้สูงสุดจากธนาคาร (เครดิตของโรงงาน) */
function creditLimit(s) { return ECON.creditCap || 400_000_000; }
function creditLeft(s) { return Math.max(0, creditLimit(s) - s.loan); }
function typeRateMul(type) { return type === 'short' ? ECON.shortRateMul : type === 'long' ? ECON.longRateMul : 1.0; }
/* อัตราดอกเบี้ยจริงของเงินกู้ก้อนหนึ่ง (ฐานตามยอดหนี้รวม × ตัวคูณประเภท × เบี้ยปรับถ้าเลยกำหนด) */
function debtRate(s, d) { return loanRate(s) * (d.rateMul || 1) * (d.overdue ? (ECON.overdueRateMul || 1.7) : 1); }

/* กู้เงิน — opts = { auto, type:'short'|'long'|'auto' } */
function borrow(s, amount, opts) {
  s.debts = s.debts || [];
  opts = opts || {};
  const auto = !!opts.auto;
  const type = opts.type || (auto ? 'auto' : 'long');
  if (amount <= 0) return 0;
  if (!auto) amount = Math.min(amount, creditLeft(s));       // กู้เองห้ามเกินวงเงิน (auto ปล่อยได้เสมอ กันเงินสดค้างลบ)
  if (amount <= 0) { if (!auto && typeof toast === 'function') toast('วงเงินกู้เต็มแล้ว — ต้องชำระหนี้ก่อน'); return 0; }
  const rateMul = typeRateMul(type);
  if (auto) {   // เงินกู้อัตโนมัติรวมเป็นก้อนเดียว ไม่แตกเป็นหลายรายการ
    let d = s.debts.find(x => x.type === 'auto');
    if (d) d.principal += amount;
    else s.debts.push({ id: ++s._debtSeq, type: 'auto', principal: amount, rateMul, takenDay: s.day, dueDay: 0, overdue: false });
  } else {
    s.debts.push({ id: ++s._debtSeq, type, principal: amount, rateMul, takenDay: s.day, dueDay: type === 'short' ? s.day + ECON.shortTermDays : 0, overdue: false });
  }
  s.loan += amount;
  s.cash += amount;
  s.totals.maxLoan = Math.max(s.totals.maxLoan, s.loan);
  const rate = (loanRate(s) * rateMul * 100).toFixed(1);
  if (auto) {
    logMsg(s, `🏦 เงินสดไม่พอ — กู้อัตโนมัติจากธนาคาร ฿${fmt(amount)} (หนี้รวม ฿${fmt(Math.round(s.loan))} · ดอกเบี้ย ${rate}%/ปี)`, 'bad');
    if (s._loanNotifyDay !== s.day && typeof toast === 'function') {   // แจ้งเตือนเด่น ๆ วันละครั้ง กันสแปม
      s._loanNotifyDay = s.day;
      toast(`🏦 เงินสดติดลบ! ระบบกู้เงินจากธนาคารให้อัตโนมัติ ฿${fmt(amount)} · ดอกเบี้ย ${rate}%/ปี (ยิ่งกู้มาก ดอกยิ่งสูง)`, 5200);
    }
  } else {
    const dueTxt = type === 'short' ? ` · ครบกำหนดคืนวันที่ ${s.day + ECON.shortTermDays}` : '';
    logMsg(s, `🏦 กู้${type === 'short' ? 'ระยะสั้น' : 'ระยะยาว'} ฿${fmt(amount)} · ดอกเบี้ย ${rate}%/ปี${dueTxt} (หนี้รวม ฿${fmt(Math.round(s.loan))})`, 'info');
    if (typeof toast === 'function') toast(`🏦 อนุมัติเงินกู้${type === 'short' ? 'ระยะสั้น' : 'ระยะยาว'} ฿${fmt(amount)} · ดอกเบี้ย ${rate}%/ปี`, 4200);
  }
  return amount;
}
/* ชำระหนี้ด้วยเงินสดที่เหลือ (ผู้เล่นกดเอง หรืออัตโนมัติเมื่อเงินเหลือเยอะ) */
function repayLoan(s, amount) {
  s.debts = s.debts || [];
  let amt = Math.min(amount, s.loan, s.cash);
  if (amt <= 0) return 0;
  const paid = amt;
  s.cash -= amt;
  /* ชำระก้อนที่แพงสุด/เลยกำหนดก่อน */
  s.debts.sort((a, b) => ((b.overdue ? 5 : 0) + (b.rateMul || 1)) - ((a.overdue ? 5 : 0) + (a.rateMul || 1)));
  for (const d of s.debts) { if (amt <= 0) break; const p = Math.min(amt, d.principal); d.principal -= p; amt -= p; }
  s.debts = s.debts.filter(d => d.principal > 1);
  s.loan = s.debts.reduce((a, d) => a + d.principal, 0);
  logMsg(s, `🏦 ชำระหนี้ ฿${fmt(Math.round(paid))} — หนี้คงเหลือ ฿${fmt(Math.round(s.loan))}`, 'good');
  return paid;
}

/* =====================================================================
   วันหยุดล้างเครื่อง — ผู้เล่นเลือกเองว่าจะหยุดวันไหน (งบ 10 วัน)
   ===================================================================== */
function startCleanDay(s) {
  if (s.cleanDay.active || s.ended) return false;
  s.cleanDay.active = true;
  s.cleanDay.hoursLeft = 24 * (1 - s.dayProgress);
  s.cleanDaysUsed++;
  s.cleaning.count++; s.totals.cleanings++;
  pay(s, CONFIG.cleanDayCost, 'cleanCost');
  const over = s.cleanDaysUsed >= CONFIG.cleanBudget;
  logMsg(s, `🧽 เริ่มหยุดล้างเครื่อง (วันที่ ${s.cleanDaysUsed + 1}/${CONFIG.cleanBudget}${over ? ' — เกินงบ กินวันหีบ' : ''}) ฿${fmt(CONFIG.cleanDayCost)}`, over ? 'bad' : 'info');
  return true;
}
function finishCleanDay(s) {
  s.cleanDay.active = false; s.cleanDay.hoursLeft = 0;
  s.dept.evap.scale = 0.02;
  s.mods = s.mods.filter(m => m.key !== 'pi' && m.key !== 'scale');
  logMsg(s, '🟢 ล้างเครื่องเสร็จ — เปลี่ยนค้อน ล้างตะกรัน ตรวจเครื่องครบ ทุกสถานีกลับมาเดินเครื่อง', 'good');
}

/* คำแนะนำจากทีมซ่อมบำรุง: ควรหยุดล้างเครื่องหรือยัง */
function maintAdvice(s) {
  const worst = MACHINE_IDS.map(id => ({ id, p: dPower(s, id) })).sort((a, b) => a.p - b.p)[0];
  const left = CONFIG.cleanBudget - s.cleanDaysUsed;
  const daysLeft = CONFIG.seasonDays - s.day;
  if (worst.p <= 25) return { lvl: 'bad', text: `⚠️ ${dept(worst.id).name}เหลือค่าพลัง ${Math.round(worst.p)}% — ควรหยุดล้างเครื่องทันที ไม่งั้นพังทั้งสาย`, urge: 2 };
  if (worst.p <= 45) return { lvl: 'warn', text: `${dept(worst.id).name}เหลือ ${Math.round(worst.p)}% — ควรวางแผนหยุดล้างใน 1-2 วันนี้ (เหลือโควตา ${left} วัน)`, urge: 1 };
  if (left > 0 && daysLeft < left * 1.5) return { lvl: 'warn', text: `เหลือโควตาล้างเครื่อง ${left} วัน แต่เหลือเวลาอีก ${daysLeft} วัน — ใช้ให้หมดจะคุ้มกว่า`, urge: 1 };
  return { lvl: 'good', text: `เครื่องจักรยังดี ต่ำสุดคือ${dept(worst.id).name} ${Math.round(worst.p)}% — ยังไม่จำเป็นต้องหยุด (เหลือโควตา ${left} วัน)`, urge: 0 };
}

/* =====================================================================
   การกระทำของผู้เล่นต่อแผนก
   ===================================================================== */
/* อัปเกรด 1 ดาว — ค่าพลังเครื่องจักรกลับมา 100% เพราะเปลี่ยนของใหม่ */
/* ลงทุนอัปเกรด — เงินสดไม่พอก็ลงทุนได้ ระบบจะกู้ส่วนที่ขาดให้ (โรงงานจริงก็กู้มาลงทุน)
   แต่ยิ่งกู้มาก ดอกเบี้ยยิ่งแพง จึงเป็นการตัดสินใจจริง ๆ ว่าจะเร่งขยายกำลังหรือรอเก็บเงิน */
function buyDept(s, id) {
  const d = dept(id), x = s.dept[id];
  if (!d || !x) return false;
  if (x.star >= d.maxStar) { toast('แผนกนี้อัปเกรดเต็มแล้ว'); return false; }
  const cost = d.levels[x.star + 1].cost;
  const credit = Math.max(0, cost - s.cash);
  if (credit > 0 && s.loan + credit > 400_000_000) { toast('วงเงินกู้เต็มแล้ว — ต้องขายน้ำตาลปิดหนี้ก่อน'); return false; }
  pay(s, cost, 'upgrade');
  if (credit > 0) logMsg(s, `🏦 ลงทุนด้วยเงินกู้ ฿${fmt(credit)} — ดอกเบี้ยตอนนี้ ${(loanRate(s) * 100).toFixed(1)}%/ปี`, 'warn');
  x.star++;
  if (d.kind === 'machine') x.power = 100;
  if (id === 'wwt') { s.water.cap = dv(s, 'wwt', 'pond'); s.water.bod = dv(s, 'wwt', 'bod'); }
  if (id === 'hr') s.staffSat = clamp(s.staffSat + 8, 0, 100);
  if (id === 'promo') s.growerTrust = clamp(s.growerTrust + 6, 0, 100);
  if (id === 'qc' || id === 'sales') s.custSat = clamp(s.custSat + 4, 0, 100);
  logMsg(s, `⭐ ${d.name} → ${x.star} ดาว: ${d.levels[x.star].name} (฿${fmt(cost)})`, 'good');
  autoTune(s);
  return true;
}

/* ตั้งระดับการเร่งเครื่อง */
function setOverdrive(s, id, level) {
  const x = s.dept[id];
  if (!x || dept(id).kind !== 'machine') return;
  x.od = clamp(Math.round(level), 0, OVERDRIVE.length - 1);
  autoTune(s);
}

/* ซ่อมด่วนนอกรอบ: จ่ายเงิน หยุดเครื่องชั่วคราว แล้วค่าพลังกลับมา */
function quickRepair(s, id) {
  const x = s.dept[id], d = dept(id);
  if (!x || d.kind !== 'machine') return false;
  if (x.power > 95) { toast('ค่าพลังยังเต็มอยู่'); return false; }
  const gap = 100 - x.power;
  const cost = Math.round(gap * 42_000 * (2 - dv(s, 'maint', 'rep')));
  if (s.cash < cost) { toast(`เงินสดไม่พอ ต้องใช้ ฿${fmt(cost)}`); return false; }
  pay(s, cost, 'repair');
  const hrs = Math.max(1.5, gap / 100 * repairHours(s));
  x.downH = Math.max(x.downH, hrs);
  x.power = Math.min(100, dv(s, 'maint', 'restore') + 8);
  logMsg(s, `🔧 ซ่อมด่วน${d.name} ฿${fmt(cost)} — หยุด ${hrs.toFixed(1)} ชม. ค่าพลังกลับมา ${Math.round(x.power)}%`, 'info');
  return true;
}

/* =====================================================================
   คะแนน 7 ด้าน (0-100)
   ===================================================================== */
function computeScore(s) {
  const K = s.kpi, T = s.totals;
  const profit = s.cash - s.loan - CONFIG.startCash;
  const complaintsTotal = s.complaints.customer + s.complaints.labour + s.complaints.gov;

  /* ประสิทธิภาพการบริหาร: เดินเครื่องต่อเนื่อง + คอขวดสมดุล + ไม่เสียอ้อย + ปริมาณอ้อยเข้าหีบ */
  const caneIn = Math.max(1, T.cane + T.caneLost + T.caneDiverted + T.caneRot);
  const caneKeep = T.cane / caneIn;
  const bn = bottleneckSpread(s);
  const output = clamp(T.cane / CONFIG.caneTarget * 100, 0, 100);   // ปริมาณอ้อยเข้าหีบเทียบเป้า 700,000 ตัน
  // --- ประสิทธิภาพการบริหาร: ผ่อนโทษคอขวด (ให้เต็มถ้า bn ≤ 0.06 แล้วค่อยๆ ลด) ---
  const mgmt = clamp(
    (K.timeEff || 0) * 0.34 + output * 0.22 + caneKeep * 100 * 0.20
    + clamp(100 - Math.max(0, bn - 0.06) * 160, 0, 100) * 0.14
    + clamp(100 - s.loan / 2_000_000, 0, 100) * 0.10, 0, 100);

  // --- คุณภาพการผลิต: แก้บั๊ก undet (0 ต้องได้เต็ม ไม่ใช่ตกไป fallback 3.5) + ผ่อนเพดานให้เอื้อมถึง ---
  const undetV = (typeof K.undet === 'number') ? K.undet : 3.5;
  const production = clamp(
    clamp((K.recovery   - 74) / 13 * 100, 0, 100) * 0.45 +   // เต็มที่ recovery ≥ 87
    clamp((K.extraction - 92) /  5 * 100, 0, 100) * 0.30 +   // เต็มที่ extraction ≥ 97
    clamp((K.bhr        - 78) / 13 * 100, 0, 100) * 0.15 +   // เต็มที่ bhr ≥ 91
    clamp((4.0 - undetV) / 3.2 * 100, 0, 100) * 0.10, 0, 100); // เต็มที่ undet ≤ 0.8

  s.score = {
    mgmt,
    profit: clamp(profit / CONFIG.winProfit * 100, 0, 120),
    production,
    custSat: s.custSat,
    staffSat: s.staffSat,
    growerSat: s.growerTrust,
    complaints: clamp(100 - complaintsTotal * 5, 0, 100),   // เดิม *7 → *5 : ร้องเรียน 1-2 ครั้งไม่ทำให้ S หลุด
    _profitValue: profit,
    _complaintsTotal: complaintsTotal,
    _caneCrushed: T.cane,
    _caneTarget: CONFIG.caneTarget,
    _output: output,
  };
  /* คะแนนรวมสเกล 0–1000 (ระบบ Ranking) = ผลรวมถ่วงน้ำหนักตามลำดับความสำคัญใน SCORE_SPEC (Σw = 1000) */
  s.score.overall = SCORE_SPEC.reduce((sum, sp) => sum + clamp(s.score[sp.key] || 0, 0, 100) / 100 * sp.w, 0);
  s.score.grade = gradeOf(s.score.overall);
  return s.score;
}

/* เกรด 8 ระดับ (เต็ม 1000) — S ทำได้จริงถ้าเล่นดีรอบด้าน ไม่ต้องเพอร์เฟกต์ 100 ทุกช่อง
   S 945+ · A+ 890-944 · A 810-889 · B+ 750-809 · B 670-749 · C+ 610-669 · C 540-609 · F <540 */
function gradeOf(t) {
  return t >= 945 ? 'S' : t >= 890 ? 'A+' : t >= 810 ? 'A' : t >= 750 ? 'B+'
    : t >= 670 ? 'B' : t >= 610 ? 'C+' : t >= 540 ? 'C' : 'F';
}

/* ความไม่สมดุลของคอขวด 0 (สมดุลดี) → 1 (ต่างกันมาก) */
function bottleneckSpread(s) {
  const caps = capChain(s).map(c => c.tpd).filter(v => v > 0);
  if (!caps.length) return 1;
  const mn = Math.min(...caps), mx = Math.max(...caps);
  return mx > 0 ? clamp(1 - mn / mx, 0, 1) : 1;
}

/* กำลังของทั้งสายเป็น "ตันอ้อย/วัน" ใช้หาคอขวดและแสดงผล */
function capChain(s) {
  const sugarPerCane = Math.max(0.06, (s.totals.cane > 500 ? s.totals.sugar / s.totals.cane : 0.105));
  return [
    { id: 'promo',   name: 'หาอ้อย',     tpd: dCap(s, 'promo') },
    { id: 'harvest', name: 'ตัด+ขน',     tpd: dCap(s, 'harvest') },
    { id: 'yard',    name: 'ลานอ้อย',    tpd: dCap(s, 'yard') },
    { id: 'mill',    name: 'ลูกหีบ',     tpd: dCap(s, 'mill') },
    { id: 'clar',    name: 'ทำใส',       tpd: dCap(s, 'clar') },
    { id: 'evap',    name: 'หม้อต้ม',    tpd: dCap(s, 'evap') },
    { id: 'pan',     name: 'หม้อเคี่ยว',  tpd: dCap(s, 'pan') },
    { id: 'fugal',   name: 'หม้อปั่น',    tpd: dCap(s, 'fugal') },
    { id: 'pack',    name: 'บรรจุ',      tpd: dCap(s, 'pack') / sugarPerCane },
    { id: 'boiler',  name: 'หม้อไอน้ำ',  tpd: up(s, 'boiler', 'steamCap') * 24 / 0.50 },
  ];
}

function dayProfit(t) {
  return (t.salesRev + t.molassesRev + t.powerRev)
    - (t.caneCost + t.labor + t.chemicals + t.fixed + t.repair + t.fuelCost
      + t.dumpCost + t.waterFine + t.penalty + t.finalPayment + t.cleanCost);
}

/* ปิดหีบ: จ่ายค่าอ้อยค้าง ขายน้ำตาลที่เหลือทั้งหมด แล้วสรุปรายงานฤดูกาล */
function settleSeason(s) {
  if (s.payable.amount > 0) { pay(s, s.payable.amount, 'finalPayment'); s.payable.amount = 0; }
  const leftSugar = s.stock.sugar;
  const closePrice = Math.round(s.market.sugarPrice * up(s, 'sales', 'priceMult') * 0.96);
  const leftRev = leftSugar * closePrice;
  s.cash += leftRev; s.totals.revenue += leftRev; s.totals.revSugar += leftRev;
  s.stock.sugar = 0;
  if (s.stock.molasses > 0) { const mr = s.stock.molasses * s.market.molPrice; s.cash += mr; s.totals.revenue += mr; s.totals.revMolasses += mr; s.stock.molasses = 0; }
  /* ปิดหนี้ด้วยเงินที่เหลือ */
  if (s.loan > 0 && s.cash > 0) repayLoan(s, s.cash);
  computeKPI(s);
  computeScore(s);
  const T = s.totals, K = s.kpi;
  const profit = s.cash - s.loan - CONFIG.startCash;
  const days = Math.max(1, s.day - 1);
  const scores = {
    mgmt: s.score.mgmt,
    profit: Math.min(100, s.score.profit),
    production: s.score.production,
    custSat: s.score.custSat,
    staffSat: s.score.staffSat,
    growerSat: s.score.growerSat,
    complaints: s.score.complaints,
  };
  const total = SCORE_SPEC.reduce((sum, sp) => sum + clamp(scores[sp.key] || 0, 0, 100) / 100 * sp.w, 0);   // 0–1000 ถ่วงน้ำหนัก
  const grade = gradeOf(total);
  const verdicts = [];
  verdicts.push(`อ้อยเข้าหีบทั้งฤดู ${fmt(Math.round(T.cane))} ตัน (เป้า ${fmt(CONFIG.caneTarget)} = ${Math.round(T.cane / CONFIG.caneTarget * 100)}% ของเป้าปริมาณ)`);
  if (s.loan > 0) verdicts.push(`ปิดฤดูโดยยังมีหนี้ ฿${fmt(s.loan)} — ดอกเบี้ยจ่ายไปทั้งฤดู ฿${fmt(T.costInterest)}`);
  if (s.crushDaysDone < CONFIG.crushDays) verdicts.push(`หีบได้ ${s.crushDaysDone}/${CONFIG.crushDays} วัน — เสียวันหีบไปกับการหยุดซ่อมและล้างเครื่อง ${s.cleanDaysUsed} วัน`);
  if (T.caneLost + T.caneDiverted > 3000) verdicts.push(`เสียอ้อยให้โรงงานอื่น ${fmt(T.caneLost + T.caneDiverted)} ตัน — ทีม 1-3 ไม่สมดุลกัน`);
  if (bottleneckSpread(s) > 0.4) verdicts.push(`คอขวดต่างกันมาก (${Math.round(bottleneckSpread(s) * 100)}%) — ลงทุนกระจุกที่บางแผนกแล้วแผนกอื่นตามไม่ทัน`);
  if (s.staffSat < 55) verdicts.push(`ความพึงพอใจพนักงาน ${Math.round(s.staffSat)} — เร่งเครื่องหนักเกินไปและสวัสดิการไม่พอ`);
  if (s.complaints.gov > 0) verdicts.push(`ถูกภาครัฐร้องเรียน ${s.complaints.gov} ครั้ง — ความเสี่ยงด้านใบอนุญาตในฤดูหน้า`);
  if (K.extraction < 95.5) verdicts.push('Extraction ต่ำ — น้ำตาลค้างในชานอ้อยมาก ควรลงทุนเตรียมอ้อย (PI) และ imbibition');
  if (K.ptyFM > 35.5) verdicts.push(`FM Purity ${K.ptyFM.toFixed(1)} สูง — รางเย็น C ยังไม่ดีพอ น้ำตาลไหลออกทางโมลาส ${(K.lossFM || 0).toFixed(1)}% ของ Pol อ้อย`);
  if (K.undet > 3) verdicts.push(`Undetermined loss ${K.undet.toFixed(1)}% สูงกว่าเกณฑ์ 2.5% — ระบบควบคุมอัตโนมัติและการคุม pH จะช่วย`);
  if (K.steamOnCane > 55) verdicts.push(`Steam on cane ${K.steamOnCane.toFixed(0)}% — หม้อต้มยัง effect น้อย เปลืองชานอ้อยที่ควรเป็นไฟฟ้าขาย`);
  if (K.timeEff < 88) verdicts.push(`Time efficiency ${K.timeEff.toFixed(0)}% — เครื่องเสีย ${T.breakdowns} ครั้ง หยุดรวม ${T.downH.toFixed(0)} ชม. ควรลงทุนบำรุงรักษา`);
  if (T.caneRot > 500) verdicts.push(`ทิ้งอ้อยเน่า ${fmt(T.caneRot)} ตัน — รับอ้อยเกินกำลังหีบ`);
  if (T.ordersFailed > T.ordersDone * 0.3) verdicts.push('ส่งออร์เดอร์ไม่ทันบ่อย — รับงานให้พอดีกับกำลังผลิต');
  if (!verdicts.length) verdicts.push('บริหารได้ครบทุกมิติ ทุก KPI อยู่ในเกณฑ์ที่ดี');
  s.finalReport = {
    profit, grade, total, scores, verdicts, leftSugar, closePrice, leftRev, days,
    crushDays: s.crushDaysDone, cleanDays: s.cleanDaysUsed,
    loan: s.loan, interest: T.costInterest, maxLoan: T.maxLoan,
    complaints: Object.assign({}, s.complaints),
    caneLost: T.caneLost + T.caneDiverted + T.caneRot,
    caneTotal: T.cane, sugarTotal: T.sugar, molassesTotal: T.molasses,
    avgTcd: T.cane / days, kwhExport: T.kwhExport,
    revenue: { sugar: T.revSugar, molasses: T.revMolasses, power: T.revPower },
    cost: { cane: T.costCane, fixed: T.costFixed, labor: T.costLabor, repair: T.costRepair, upgrade: T.costUpgrade, interest: T.costInterest, other: T.costOther },
    kpi: Object.assign({}, K),
  };
}

/* ผู้ช่วยอัตโนมัติ (โหมดเล่นง่าย): ปรับค่ากระบวนการให้อยู่ในช่วงที่ดี ขายน้ำตาลเมื่อคลังใกล้เต็ม จองซ่อมเมื่อเครื่องทรุด
   ผู้เล่นเหลือแค่ตัดสินใจเรื่องอ้อย ออร์เดอร์ และการลงทุนอัปเกรด */
function autoTune(s) {
  if (!s.ctrl.autoTune) return;
  const c = s.ctrl, P = proc(s);
  c.pH = 7.1; c.imbibition = 270; c.syrupBrix = Math.min(65, P.syrupBxMax); c.wash = 3.0;
  /* อัตราหีบ 95% ของกำลังลูกหีบ แต่ไม่เกินสิ่งที่สายท้ายรับได้ */
  c.crushTarget = Math.round(Math.min(P.millTph * 0.95,
    P.panVolTph / CONFIG.volPerSyrup / CONFIG.syrupPerCane,
    P.fugalVolTph / CONFIG.volPerSyrup / CONFIG.syrupPerCane,
    P.evapCapTph / (CONFIG.juicePerCane - CONFIG.syrupPerCane),
    P.clarTph / CONFIG.juicePerCane) / 5) * 5;
  const cap = up(s, 'warehouse', 'whCap');
  if (s.stock.sugar > cap * 0.7) sellSpot(s, Math.floor(s.stock.sugar - cap * 0.25));
  const mcap = up(s, 'molTank', 'molCap');
  if (s.stock.molasses > mcap * 0.7) sellMolasses(s, Math.floor(s.stock.molasses - mcap * 0.2));
  c.useOil = s.today.steamShort && s.stock.bagasse < 300;
}

function startDay(s) {
  s.today = emptyDay();
  s.newEvents = [];
  s.todaySold = 0; s.todayDelivered = 0; s.todayBreaks = 0; s.todayMolSold = 0; s.todayShipped = 0;
  rollDaily(s);
  autoTune(s);
  /* ผู้เล่นสั่งหยุดล้างเครื่องไว้ → เริ่มตอนขึ้นวันใหม่ */
  if (s.cleanDay.queued && !s.cleanDay.active) { s.cleanDay.queued = false; startCleanDay(s); }
  for (const ev of EVENTS) {
    if (ev.cond && !ev.cond(s)) continue;
    if (rnd() < ev.p * diff().evP) {
      if (ev.choices) {
        /* เหตุการณ์ที่ต้องตัดสินใจ -> เข้าคิวรอผู้เล่น (เกินเวลาแล้วใช้ตัวเลือกปริยาย) */
        if (!s.decisions.some(d => d.evId === ev.id)) s.decisions.push({ evId: ev.id, day: s.day, elapsedH: 0, deadlineH: ev.deadlineH || 8, shown: false });
        logMsg(s, `${ev.icon} ${ev.name} — รอการตัดสินใจ`, 'event');
      } else {
        ev.apply(s);
        s.newEvents.push(ev);
        logMsg(s, `${ev.icon} ${ev.name} — ${ev.effect}`, 'event');
      }
    }
  }
  s.mods = s.mods.map(m => ({ ...m, daysLeft: m.daysLeft - 1 })).filter(m => m.daysLeft > 0);
}

/* =====================================================================
   KPI — ตามรายงานประจำวันของโรงงานจริง
   ===================================================================== */
function computeKPI(s) {
  const T = s.totals, t = s.today;
  const ext = T.polCane > 0 ? (T.polCane - T.polBag) / T.polCane * 100 : 0;
  const rec = T.polCane > 0 ? T.polSugar / T.polCane * 100 : 0;
  const ptySyr = T.brixSyrup > 0 ? T.polSyrup / T.brixSyrup * 100 : 0;
  const ptyFM = t.ptyFM || (s.yesterday && s.yesterday.ptyFM) || 0;
  const bhr = (ptySyr > 0 && ptyFM > 0) ? (ptySyr - ptyFM) / ((100 - ptyFM) * ptySyr) * 10000 : 0;
  const lossBag = T.polCane > 0 ? T.polBag / T.polCane * 100 : 0;
  const lossFC = T.polCane > 0 ? T.polFC / T.polCane * 100 : 0;
  const lossFM = T.polCane > 0 ? T.polFM / T.polCane * 100 : 0;
  const undet = Math.max(0, 100 - rec - lossBag - lossFC - lossFM);
  s.kpi = {
    extraction: ext,
    recovery: rec,
    bhr,
    ptySyrup: ptySyr,
    ptyFM,
    yieldKgPerTon: T.cane > 0 ? T.sugar / T.cane * 1000 : 0,
    polBagPct: T.bagasse > 0 ? T.polBag / T.bagasse * 100 : 0,
    bagPctCane: T.cane > 0 ? T.bagasse / T.cane * 100 : 0,
    lossBag, lossFC, lossFM, undet,
    steamOnCane: T.cane > 0 ? T.steam / T.cane * 100 : 0,
    kwhPerTc: T.cane > 0 ? T.kwhExport / T.cane : 0,
    timeEff: T.openH > 0 ? T.runH / T.openH * 100 : 0,
    ccs: t.milled > 0 ? (t.polCane / t.milled * 100 - CONFIG.polOffsetCCS) : yardCCS(s),
    pi: t.pi || 0,
    tch: t.hours > 0 ? t.milled / t.hours : 0,
    imbPctFibre: s.ctrl.imbibition,
  };
}

const KPI_SPEC = [
  { k: 'extraction',   name: 'Extraction % Pol',        unit: '%',      poor: 94,  good: 96,   great: 97.5, hi: true },
  { k: 'recovery',     name: 'Overall Recovery',        unit: '%',      poor: 80,  good: 84,   great: 87,   hi: true },
  { k: 'bhr',          name: 'Boiling House Recovery',  unit: '%',      poor: 84,  good: 88,   great: 91,   hi: true },
  { k: 'yieldKgPerTon',name: 'ผลผลิตน้ำตาล',            unit: 'กก./ตันอ้อย', poor: 95, good: 105, great: 112, hi: true },
  { k: 'polBagPct',    name: 'Pol % Bagasse',           unit: '%',      poor: 2.5, good: 2.0,  great: 1.5,  hi: false },
  { k: 'ptyFM',        name: 'Final Molasses Purity',   unit: '',       poor: 38,  good: 35,   great: 33,   hi: false },
  { k: 'undet',        name: 'Undetermined Loss',       unit: '%',      poor: 4.0, good: 2.5,  great: 1.5,  hi: false },
  { k: 'steamOnCane',  name: 'Steam on Cane',           unit: '%',      poor: 60,  good: 50,   great: 45,   hi: false },
  { k: 'kwhPerTc',     name: 'ไฟฟ้าขายได้',              unit: 'kWh/ตันอ้อย', poor: 8, good: 22, great: 40,  hi: true },
  { k: 'timeEff',      name: 'Overall Time Efficiency', unit: '%',      poor: 85,  good: 90,   great: 95,   hi: true },
];
function kpiLevel(spec, v) {
  if (v === undefined || v === null || !isFinite(v) || v === 0) return 'none';
  if (spec.hi) return v >= spec.great ? 'great' : v >= spec.good ? 'good' : v >= spec.poor ? 'ok' : 'bad';
  return v <= spec.great ? 'great' : v <= spec.good ? 'good' : v <= spec.poor ? 'ok' : 'bad';
}

/* =====================================================================
   ออร์เดอร์และการขาย
   ===================================================================== */
const CUSTOMERS = ['สยามเทรด', 'Global Sugar', 'เครื่องดื่มไทย', 'ขนมหวานภูเก็ต', 'Asia Food Export', 'ตลาดกลางน้ำตาล', 'นมข้นสยาม', 'Pacific Trading'];

function createOrder(s, opt = {}) {
  const open = s.orders.filter(o => o.status === 'open').length;
  if (open >= CONFIG.maxOpenOrders && !opt.urgent) return;
  const urgent = !!opt.urgent;
  const cap = up(s, 'warehouse', 'whCap');
  const tons = Math.min(Math.round(cap * 0.55 / 50) * 50,
    Math.round((urgent ? 200 + Math.round(rnd() * 7) * 50 : 150 + Math.round(rnd() * 11) * 50) * tierOf(s).orderMult / 50) * 50);
  const days = urgent ? 3 + Math.round(rnd() * 2) : 6 + Math.round(rnd() * 9);
  const prem = (urgent ? 1.20 + rnd() * 0.14 : 1.03 + rnd() * 0.16) * (0.95 + s.reputation / 100 * 0.14) * (1 + tierOf(s).premium);
  const price = Math.round(s.market.sugarPrice * up(s, 'sales', 'priceMult') * prem / 50) * 50;
  s.orders.push({
    id: 'OD' + String(s.nextOrderId++).padStart(3, '0'),
    customer: CUSTOMERS[Math.floor(rnd() * CUSTOMERS.length)],
    tons, price, urgent, deadline: s.day + days, expires: s.day + (urgent ? 1 : 3), status: 'open',
  });
}
function acceptOrder(s, id) {
  const o = s.orders.find(x => x.id === id);
  if (!o || o.status !== 'open') return;
  if (s.orders.filter(x => x.status === 'accepted').length >= CONFIG.maxAcceptedOrders) { toast('รับได้สูงสุด ' + CONFIG.maxAcceptedOrders + ' ออร์เดอร์'); return; }
  o.status = 'accepted';
  logMsg(s, `📝 รับออร์เดอร์ ${o.id} ${fmt(o.tons)} ตัน @฿${fmt(o.price)}`, 'info');
}
function rejectOrder(s, id) { const o = s.orders.find(x => x.id === id); if (o && o.status === 'open') o.status = 'rejected'; }
/* น้ำตาลที่ยังส่งออกจากคลังได้ในวันนี้ (จำกัดด้วยกำลังโหลดของทีมโกดัง) */
function shipLeft(s) {
  return Math.max(0, proc(s).shipTpd - (s.todayShipped || 0));
}
function ship(s, tons) { s.todayShipped = (s.todayShipped || 0) + tons; }

function deliverOrder(s, id) {
  const o = s.orders.find(x => x.id === id);
  if (!o || o.status !== 'accepted' || s.stock.sugar < o.tons) { toast('น้ำตาลในคลังไม่พอ'); return; }
  if (shipLeft(s) < o.tons) { toast(`วันนี้โหลดรถได้อีกแค่ ${fmt(Math.floor(shipLeft(s)))} ตัน — อัปเกรดโกดังและท่าโหลด`); return; }
  ship(s, o.tons);
  s.stock.sugar -= o.tons;
  const rev = o.tons * o.price;
  s.cash += rev; s.pendingSales = (s.pendingSales || 0) + rev; s.totals.revenue += rev;
  s.totals.ordersDone++; o.status = 'delivered'; s.todayDelivered = (s.todayDelivered || 0) + 1;
  s.reputation = clamp(s.reputation + (o.urgent ? 7 : 4), 0, 100);
  s.custSat = clamp(s.custSat + (o.urgent ? 4 : 3), 0, 100);   // ส่งมอบทันเวลา = ลูกค้าพอใจขึ้นทันที
  logMsg(s, `✅ ส่ง ${o.id} ${fmt(o.tons)} ตัน รับ ฿${fmt(rev)} · ลูกค้าพอใจ +${o.urgent ? 4 : 3}`, 'good');
}
function sellMolasses(s, tons) {
  tons = clamp(Math.floor(tons), 0, s.stock.molasses);
  if (tons <= 0) return;
  const rev = tons * s.market.molPrice;
  s.stock.molasses -= tons; s.cash += rev; s.todayMolSold = (s.todayMolSold || 0) + tons;
  s.pendingMol = (s.pendingMol || 0) + rev; s.totals.revenue += rev; s.totals.revMolasses += rev;
  logMsg(s, `🛢️ ขายกากน้ำตาล ${fmt(tons)} ตัน @฿${fmt(s.market.molPrice)} = ฿${fmt(rev)}`, 'good');
}
/* ราคาตลาดจรที่ได้จริง: ยิ่งเทขายมาก ตลาดยิ่งอิ่ม (pressure) ราคาตก แล้วฟื้นวันละ 30% */
function spotPrice(s) {
  const sat = Math.min(0.35, (s.market.pressure || 0) * 0.06);
  return Math.round(s.market.sugarPrice * up(s, 'sales', 'priceMult') * (1 + tierOf(s).premium) * 0.97 * (1 - sat));
}
function marketSaturation(s) { return Math.min(0.35, (s.market.pressure || 0) * 0.06); }
function sellSpot(s, tons) {
  tons = clamp(Math.floor(tons), 0, Math.min(s.stock.sugar, Math.floor(shipLeft(s))));
  if (tons <= 0) { toast('วันนี้โหลดรถส่งน้ำตาลเต็มโควตาแล้ว — อัปเกรดทีมโกดังและส่งมอบ'); return; }
  ship(s, tons);
  const price = spotPrice(s);
  const rev = tons * price;
  s.stock.sugar -= tons; s.cash += rev;
  s.market.pressure = (s.market.pressure || 0) + tons / 2000;
  s.todaySold = (s.todaySold || 0) + tons;
  s.pendingSales = (s.pendingSales || 0) + rev; s.totals.revenue += rev;
  logMsg(s, `💰 ขายตลาดจร ${fmt(tons)} ตัน @฿${fmt(price)}${marketSaturation(s) > 0.05 ? ` (ตลาดอิ่ม −${Math.round(marketSaturation(s) * 100)}%)` : ''}`, 'good');
}

/* ---------- สัญญาระยะยาว ---------- */
function offerContract(s) {
  if (s.contractOffers.length >= 2) return;
  const T = tierOf(s), exportC = T.export && rnd() < 0.5;
  const weeks = 4 + Math.round(rnd() * 6);
  const tons = Math.round((600 + rnd() * 900) * T.orderMult / 50) * 50;      // ต่อสัปดาห์
  const prem = (exportC ? 1.18 : 1.06) + rnd() * 0.08;
  s.contractOffers.push({
    id: 'CT' + String(s.nextContractId++).padStart(2, '0'),
    customer: exportC ? ['Mitsui Sugar (JP)', 'Wilmar (SG)', 'ED&F Man (UK)', 'Al Khaleej (UAE)'][Math.floor(rnd() * 4)] : CUSTOMERS[Math.floor(rnd() * CUSTOMERS.length)],
    tons, weeks, price: Math.round(s.market.sugarPrice * prem / 50) * 50, export: exportC, tariff: exportC ? 0.04 : 0, expires: s.day + 3,
  });
}
function acceptContract(s, id) {
  const i = s.contractOffers.findIndex(c => c.id === id); if (i < 0) return;
  if (s.contracts.length >= 3) { toast('รับสัญญาได้สูงสุด 3 ฉบับ'); return; }
  const c = s.contractOffers.splice(i, 1)[0];
  s.contracts.push(Object.assign(c, { startDay: s.day, nextDue: s.day + 7, weeksLeft: c.weeks, delivered: 0, missed: 0 }));
  logMsg(s, `📃 ทำสัญญา ${c.id} ${c.customer}: ${fmt(c.tons)} ตัน/สัปดาห์ × ${c.weeks} สัปดาห์ @฿${fmt(c.price)}${c.export ? ' (ส่งออก ภาษี 4%)' : ''}`, 'info');
}
function declineContract(s, id) { s.contractOffers = s.contractOffers.filter(c => c.id !== id); }
function settleContracts(s) {
  for (let i = s.contracts.length - 1; i >= 0; i--) {
    const c = s.contracts[i];
    if (s.day < c.nextDue) continue;
    if (s.stock.sugar >= c.tons) {
      const gross = c.tons * c.price, tax = Math.round(gross * (c.tariff || 0)), rev = gross - tax;
      s.stock.sugar -= c.tons; s.cash += rev; s.pendingSales = (s.pendingSales || 0) + rev; s.totals.revenue += rev;
      if (tax) { s.totals.cost += tax; s.totals.costOther += tax; }
      c.delivered++; s.reputation = clamp(s.reputation + 2, 0, 100); s.custSat = clamp(s.custSat + 2, 0, 100); s.todayDelivered = (s.todayDelivered || 0) + 1;
      logMsg(s, `📃 ส่งตามสัญญา ${c.id} ${fmt(c.tons)} ตัน รับ ฿${fmt(rev)}${tax ? ` (หักภาษีส่งออก ฿${fmt(tax)})` : ''}`, 'good');
    } else {
      const pen = Math.round(c.tons * c.price * 0.15);
      pay(s, pen, 'penalty'); c.missed++; s.reputation = clamp(s.reputation - 6, 0, 100);
      logMsg(s, `❌ ส่งตามสัญญา ${c.id} ไม่ทัน ปรับ ฿${fmt(pen)} (พลาดครั้งที่ ${c.missed})`, 'bad');
      if (c.missed >= 2) { s.contracts.splice(i, 1); logMsg(s, `📃 ${c.customer} ยกเลิกสัญญา ${c.id}`, 'bad'); continue; }
    }
    c.weeksLeft--; c.nextDue += 7;
    if (c.weeksLeft <= 0) { s.contracts.splice(i, 1); s.reputation = clamp(s.reputation + 4, 0, 100); logMsg(s, `🏁 สัญญา ${c.id} ครบกำหนด ชื่อเสียง +4`, 'good'); }
  }
  s.contractOffers = s.contractOffers.filter(c => s.day < c.expires);
  if (rnd() < 0.14 * up(s, 'sales', 'orderRate')) offerContract(s);
}

/* ---------- ภารกิจรายวัน ---------- */
function rollDaily(s) {
  const pool = DAILY_POOL.slice().sort(() => rnd() - 0.5).slice(0, 2);
  s.daily = { day: s.day, tasks: pool.map(p => ({ id: p.id, text: p.text(s), reward: p.reward, done: false })) };
  s.todaySold = 0; s.todayDelivered = 0; s.todayBreaks = 0; s.todayMolSold = 0;
}
function settleDaily(s) {
  if (!s.daily || !s.daily.tasks) return;
  for (const t of s.daily.tasks) {
    const def = DAILY_POOL.find(p => p.id === t.id);
    if (def && def.check(s, s.today)) { t.done = true; s.cash += t.reward; s.totals.revenue += t.reward; logMsg(s, `📅 ภารกิจรายวันสำเร็จ: ${t.text} +฿${fmt(t.reward)}`, 'good'); }
  }
}

/* ---------- ระดับโรงงาน ---------- */
function checkTier(s) {
  const T = tierOf(s);
  if (T.index > (s.tierIndex || 0)) { s.tierIndex = T.index; s.newTier = T; logMsg(s, `${T.icon} เลื่อนระดับเป็น "${T.name}" — ออร์เดอร์ใหญ่ขึ้น ${Math.round((T.orderMult - 1) * 100)}% ราคาพรีเมียม +${Math.round(T.premium * 100)}%${T.export ? ' เปิดสัญญาส่งออก' : ''}`, 'good'); }
}

/* =====================================================================
   ซ่อมบำรุงและอัปเกรด
   ===================================================================== */
function scheduleMaintenance(s, key) { quickRepair(s, key); }
function buyUpgrade(s, id) { if (buyDept(s, id)) updateQuests(s); }

/* =====================================================================
   ที่ปรึกษา — วินิจฉัยจาก KPI จริง
   ===================================================================== */
function buildHints(s) {
  const h = [], K = s.kpi, t = s.yesterday, P = proc(s);
  const add = (lvl, text) => h.push({ lvl, text });

  /* --- การเงิน --- */
  if (s.loan > 0) add(s.loan > 60_000_000 ? 'bad' : 'warn', `หนี้เงินกู้ ฿${fmtM(s.loan)} ดอกเบี้ย ${(loanRate(s) * 100).toFixed(1)}%/ปี — ขายน้ำตาลปิดหนี้ก่อนดอกทบ`);
  if (s.cash < 3_000_000) add('warn', 'เงินสดใกล้หมด — ขายน้ำตาล/กากน้ำตาล ไม่งั้นระบบจะกู้ให้อัตโนมัติ');
  const dueCane = CONFIG.canePayEvery - (s.day % CONFIG.canePayEvery || CONFIG.canePayEvery);
  if (s.payable.accrued > s.cash && dueCane <= 2) add('bad', `อีก ${dueCane} วันต้องจ่ายค่าอ้อย ฿${fmtM(s.payable.accrued)} แต่เงินสดมี ฿${fmtM(s.cash)}`);
  if (s.payable.amount > s.cash * 1.5 && s.day < 65) add('warn', `ค่าอ้อยขั้นสุดท้ายค้างจ่าย ฿${fmtM(s.payable.amount)} ครบกำหนดวันที่ 65 และ 130`);

  /* --- สายวัตถุดิบ ทีม 1-3 --- */
  const c1 = dCap(s, 'promo'), c2 = dCap(s, 'harvest'), c3 = dCap(s, 'yard'), c4 = dCap(s, 'mill');
  if (c2 < c1 * 0.8) add('bad', `ทีมส่งเสริมหาอ้อยได้ ${fmt(c1)} ต/ว แต่ทีมเก็บเกี่ยวตัดได้แค่ ${fmt(c2)} — อ้อยส่วนเกินหลุดไปโรงอื่นแล้ว ${fmt(s.totals.caneLost)} ตัน`);
  if (c3 < c2 * 0.8) add('bad', `ลานอ้อยรับได้ ${fmt(c3)} ต/ว แต่ตัดเข้ามา ${fmt(c2)} — รถต่อคิว ${s.yard.queueH.toFixed(0)} ชม. CCS ตกชั่วโมงละ 0.042 หน่วย`);
  if (c4 < c3 * 0.8) add('warn', `ลูกหีบหีบได้ ${fmt(c4)} ต/ว น้อยกว่าที่ลานรับเข้ามา ${fmt(c3)} — อ้อยกองค้างจะเสื่อม`);
  if (c1 < c4 * 0.85) add('warn', `หาอ้อยได้แค่ ${fmt(c1)} ต/ว แต่ลูกหีบรับได้ ${fmt(c4)} — เดินเครื่องไม่เต็มกำลัง อัปเกรดทีมส่งเสริม`);
  if (s.growerTrust < 45) add('bad', `ความเชื่อมั่นชาวไร่ ${Math.round(s.growerTrust)}% — อ้อยเข้าน้อยลงจริง ต้องลดคิวรอและอัปเกรดทีมส่งเสริม`);
  if (s.yard.queueH > 18) add('bad', `รถอ้อยรอคิว ${s.yard.queueH.toFixed(0)} ชม. — เกิน 18 ชม. รถเริ่มหนีไปโรงงานอื่น (เสียแล้ว ${fmt(s.totals.caneDiverted)} ตัน)`);

  /* --- ค่าพลังเครื่องจักร / วันล้างเครื่อง --- */
  const adv = maintAdvice(s);
  if (adv.urge > 0) add(adv.lvl === 'bad' ? 'bad' : 'warn', '🛠️ ทีมซ่อมบำรุง: ' + adv.text);
  for (const id of MACHINE_IDS) {
    const od = dOver(s, id);
    if (od.v >= 1.4) add('warn', `${dept(id).name}เร่งเครื่อง ${od.label} — ค่าพลังลดเร็วขึ้น ${Math.pow(od.v, 3).toFixed(1)} เท่า และเสี่ยงอุบัติเหตุ`);
  }
  if (s.staffSat < 50) add('bad', `ความพึงพอใจพนักงาน ${Math.round(s.staffSat)} — ทำงานช้าลงและเสี่ยงอุบัติเหตุ ลดการเร่งเครื่องหรืออัปเกรดทีม HR`);
  if (s.custSat < 55) add('warn', `ความพึงพอใจลูกค้า ${Math.round(s.custSat)} — ส่งให้ตรงเวลาและอัปเกรดทีมคุณภาพ`);

  /* --- โรงหีบ --- */
  if (K.polBagPct > 2.4) add('bad', `Pol%Bagasse ${K.polBagPct.toFixed(2)}% สูงเกินเกณฑ์ 2.0 — เพิ่ม imbibition หรืออัปเกรดระบบเตรียมอ้อย (PI ตอนนี้ ${K.pi.toFixed(0)})`);
  else if (K.polBagPct > 2.0) add('warn', `Pol%Bagasse ${K.polBagPct.toFixed(2)}% ยังเกินเป้า 2.0 — PI +1 หน่วยจะลดได้ 0.10`);
  if (s.ctrl.imbibition < 240) add('warn', `Imbibition ${s.ctrl.imbibition}% ต่ำกว่า 250% — ต่ำกว่านี้ extraction จะไต่ขึ้นเร็วถ้าเพิ่มน้ำ`);
  if (s.ctrl.imbibition > 330) add('warn', `Imbibition ${s.ctrl.imbibition}% เกิน 320% ผลตอบแทนลดลงแล้ว แถมชานอ้อยชื้นขึ้นทำให้ไอน้ำตก`);
  if (s.ctrl.crushTarget > P.millTph * 0.95) add('warn', 'ตั้งอัตราหีบเกิน 95% ของกำลังเครื่อง เสี่ยงลูกหีบตันและเกิด entrainment');

  /* --- ทำใส --- */
  if (s.ctrl.pH < 6.6) add('bad', `pH ${s.ctrl.pH.toFixed(1)} ต่ำเกินไป เกิด inversion ทำลายน้ำตาลถาวร — ปรับขึ้นมาที่ 7.0-7.2`);
  if (s.ctrl.pH > 7.6) add('warn', `pH ${s.ctrl.pH.toFixed(1)} สูงเกินไป สีน้ำตาลขึ้นและเกิดตะกรันในหม้อต้มเร็ว`);

  /* --- หม้อต้ม --- */
  if (s.dept.evap.scale > 0.35) add('warn', `ตะกรันหม้อต้ม ${Math.round(s.dept.evap.scale * 100)}% — กำลังระเหยตกแล้ว หยุดล้างเครื่องจะล้างตะกรันให้`);
  if (t && t.syrup > 0 && brixPctOf(t) < 60) add('warn', 'Brix น้ำเชื่อมต่ำกว่า 60% — กำลังระเหยไม่พอ หม้อเคี่ยวจะต้องทำงานหนักขึ้น');

  /* --- โรงต้ม --- */
  if (K.ptyFM > 36) add('bad', `Final Molasses Purity ${K.ptyFM.toFixed(1)} สูง — น้ำตาลไหลออกทางโมลาส อัปเกรดรางเย็น C คือทางแก้ที่ตรงที่สุด`);
  if (t && t.panLimited) add('warn', 'หม้อเคี่ยวเป็นคอขวด น้ำเชื่อมค้าง — ขยายหม้อเคี่ยวหรือลดอัตราหีบ');
  if (t && t.fugalLimited) add('warn', 'หม้อปั่นเป็นคอขวด — ขยายหม้อปั่นหรือลดอัตราหีบ');
  if (dOver(s, 'pan').v > 1.25) add('warn', `เร่งหม้อเคี่ยว ${dOver(s, 'pan').label} เสี่ยงเกิดผลึกเทียม (false grain) ทำให้ปั่นไม่ออก`);
  if (s.ctrl.wash < 2.3) add('warn', 'น้ำล้างต่ำกว่า 2.3% สีน้ำตาลจะสูง ลูกค้าอาจปฏิเสธ');
  if (s.ctrl.wash > 4.2) add('warn', `น้ำล้าง ${s.ctrl.wash.toFixed(1)}% มากเกินไป ทุก 1% ที่เกิน 3% ทำ yield หาย 0.30%`);

  /* --- พลังงาน --- */
  if (t && t.steamShort) add('bad', 'ไอน้ำไม่พอ — ลด imbibition, ลดอัตราหีบ, หรือเปิดน้ำมันเตาเสริม');
  if (s.stock.bagasse < 200) add('warn', `ชานอ้อยเหลือ ${fmt(s.stock.bagasse)} ตัน ใกล้หมด หม้อไอน้ำจะเดินไม่ได้`);
  if (K.steamOnCane > 55) add('warn', `Steam on Cane ${K.steamOnCane.toFixed(0)}% สูงเกินเกณฑ์ 50% — เพิ่ม effect หม้อต้มหรือทำ vapour bleeding`);
  if (K.kwhPerTc < 10 && s.day > 10) add('info', `ขายไฟได้แค่ ${K.kwhPerTc.toFixed(0)} kWh/ตันอ้อย — อัปเกรดกังหันเป็นรายได้ที่สอง`);

  /* --- วัตถุดิบ --- */
  const yt = yardTons(s), ycap = P.yardCap;
  if (yt / ycap > 0.85) add('warn', `ลานอ้อยเต็ม ${Math.round(yt / ycap * 100)}% อ้อยค้างเสื่อม CCS ทุกชั่วโมง`);
  if (oldestAgeH(s) > 24) add('bad', `อ้อยล็อตเก่าสุดค้างมา ${oldestAgeH(s).toFixed(0)} ชม. เกิน 24 ชม. เกิด dextran แล้ว — เร่งหีบ`);
  if (yt < 100 && s.day > 2) add('warn', 'ลานอ้อยเกือบหมด โรงหีบจะหยุดรออ้อย — เพิ่มอัตรารับอ้อย');
  if (s.ctrl.caneMix.burnt > 0.35) add('warn', `อ้อยไฟไหม้ ${Math.round(s.ctrl.caneMix.burnt * 100)}% ของคิว CCS ต่ำและเสื่อมเร็ว 1.8 เท่า`);
  if (s.ctrl.caneMix.mech > 0.5) add('info', `อ้อยรถตัด ${Math.round(s.ctrl.caneMix.mech * 100)}% มี trash 9.5% ทำ CCS ลดราว 1.2 หน่วย`);

  /* --- เครื่องจักร --- */
  for (const k of PROCESS_STATIONS) {
    const st = s.stations[k];
    if (st.downH > 0) add('bad', `${STATION_META[k].name}หยุดอยู่ อีก ${st.downH.toFixed(0)} ชม.`);
    else if (st.power < 25) add('bad', `${STATION_META[k].name}ค่าพลังเหลือ ${Math.round(st.power)}% — ถึง 0 จะพังทั้งสาย ควรหยุดล้างเครื่องหรือซ่อมด่วน`);
    else if (st.power < 50) add('warn', `${STATION_META[k].name}ค่าพลัง ${Math.round(st.power)}% ประสิทธิภาพเริ่มตกแล้ว`);
  }
  if (s.water.level / s.water.cap > 0.8) add('warn', `บ่อบำบัด ${Math.round(s.water.level / s.water.cap * 100)}% ล้นแล้วปรับ ฿2,200/m³`);

  /* --- ถังกากน้ำตาล --- */
  const mc = up(s, 'molTank', 'molCap'), mp = s.stock.molasses / mc;
  if (t && t.molFull) add('bad', 'ถังกากน้ำตาลเต็ม ปั่น C ระบายไม่ได้ กำลังปั่นเหลือ 35% — ขายกากน้ำตาลทันที');
  else if (mp > 0.8) add('warn', `ถังกากน้ำตาล ${Math.round(mp * 100)}% ใกล้เต็ม ราคาตอนนี้ ฿${fmt(s.market.molPrice)}/ตัน`);
  if (s.market.molPrice > CONFIG.molassesPrice * 1.15 && s.stock.molasses > 500) add('good', `ราคากากน้ำตาล ฿${fmt(s.market.molPrice)} สูงกว่าปกติ จังหวะขาย`);

  /* --- คลัง / ตลาด --- */
  const wh = s.stock.sugar / P.whCap;
  if (wh > 0.85) add('bad', `คลังน้ำตาล ${Math.round(wh * 100)}% ใกล้เต็ม ผลิตแล้วจะล้นทิ้ง — ขายออก`);
  if (s.market.sugarPrice > CONFIG.sugarBasePrice * 1.1 && s.stock.sugar > 200) add('good', `ราคาน้ำตาล ฿${fmt(s.market.sugarPrice)} สูงกว่าปกติ จังหวะระบายสต๊อก`);
  for (const o of s.orders) {
    if (o.status === 'accepted' && o.deadline - s.day <= 2 && s.stock.sugar < o.tons)
      add('bad', `${o.id} ต้องส่ง ${fmt(o.tons)} ตันใน ${o.deadline - s.day} วัน แต่คลังมี ${fmt(s.stock.sugar)} ตัน`);
  }

  if (!h.length) add('good', 'เดินเครื่องได้ดี ทุก KPI อยู่ในเกณฑ์ — พิจารณาลงทุนแก้คอขวดถัดไป');
  return h.slice(0, 8);
}
function brixPctOf(t) { return t.syrup > 0 ? (t.syrupBrixPct || state.ctrl.syrupBrix) : 0; }

/* =====================================================================
   เป้าหมายฤดูกาล / ภารกิจ / คะแนน
   ===================================================================== */
function netWorth(s) { return s.cash - s.loan + s.stock.sugar * s.market.sugarPrice * 0.92 + s.stock.molasses * s.market.molPrice * 0.9 - s.payable.amount - s.payable.accrued - s.wagesAccrued; }
function seasonGoals(s) {
  const K = s.kpi;
  return [
    { text: `กำไรสุทธิ ฿${fmtM(netWorth(s) - CONFIG.startCash)} / ฿${fmtM(CONFIG.winProfit)}`, done: netWorth(s) - CONFIG.startCash >= CONFIG.winProfit },
    { text: `หีบครบ ${s.crushDaysDone} / ${CONFIG.crushDays} วัน`, done: s.crushDaysDone >= CONFIG.crushDays },
    { text: `Overall Recovery ${(K.recovery || 0).toFixed(1)}% / 84%`, done: (K.recovery || 0) >= 84 },
    { text: `Time Efficiency ${(K.timeEff || 0).toFixed(0)}% ≥ 90%`, done: (K.timeEff || 0) >= 90 },
    { text: `ความพึงพอใจลูกค้า ${Math.round(s.custSat)} และพนักงาน ${Math.round(s.staffSat)} ≥ 70`, done: s.custSat >= 70 && s.staffSat >= 70 },
    { text: `ข้อร้องเรียนรวม ${s.complaints.customer + s.complaints.labour + s.complaints.gov} ครั้ง (ยิ่งน้อยยิ่งดี)`, done: (s.complaints.customer + s.complaints.labour + s.complaints.gov) <= 2 },
  ];
}
function buildMissions(s) {
  const K = s.kpi, out = [];
  out.push({ text: `กำไรสะสม ฿${fmtM(netWorth(s) - CONFIG.startCash)} / ฿${fmtM(CONFIG.winProfit)}`, done: netWorth(s) - CONFIG.startCash >= CONFIG.winProfit });
  out.push({ text: `Extraction ${(K.extraction || 0).toFixed(1)}% / 96%`, done: (K.extraction || 0) >= 96 });
  out.push({ text: `Recovery ${(K.recovery || 0).toFixed(1)}% / 84%`, done: (K.recovery || 0) >= 84 });
  const acc = s.orders.find(o => o.status === 'accepted');
  if (acc) out.push({ text: `ส่ง ${acc.customer} ${fmt(Math.min(s.stock.sugar, acc.tons))}/${fmt(acc.tons)} ตัน (D${acc.deadline})`, done: s.stock.sugar >= acc.tons });
  return out;
}
function seasonScore(s) {
  const profit = netWorth(s) - CONFIG.startCash;
  const g = seasonGoals(s).filter(x => x.done).length;
  let grade = 'F';
  if (!s.bankrupt) {
    if (profit >= CONFIG.winProfit && g >= 4) grade = 'S';
    else if (profit >= CONFIG.winProfit && g >= 3) grade = 'A';
    else if (profit >= CONFIG.winProfit) grade = 'B';
    else if (profit >= CONFIG.winProfit * 0.6) grade = 'C';
    else if (profit > 0) grade = 'D';
  }
  return { profit, grade, goals: g };
}

/* =====================================================================
   format
   ===================================================================== */
function fmt(n, d = 0) {
  if (n === undefined || n === null || !isFinite(n)) return '-';
  return Number(n).toLocaleString('th-TH', { maximumFractionDigits: d, minimumFractionDigits: d });
}
function fmtM(n) {
  if (!isFinite(n)) return '-';
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' ล้าน';
  if (a >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  return fmt(n);
}
function pct(x) { return Math.round(x * 100) + '%'; }
