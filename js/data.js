'use strict';
/* =====================================================================
   Sugar Factory Manager v2.0 — data.js
   ค่าคงที่ · เหตุการณ์ · เควส · state เริ่มต้น

   หลักการทางฟิสิกส์ (คงเดิม — ผ่านการตรวจกับไฟล์ออกแบบ 8,000 TCD แล้ว)
     ทุกกระแส = { m, B, P }  (ตัน, ตัน Brix, ตัน Pol)
     Purity = P/B×100 · สมดุล Pol ต้องปิดทุกชั่วโมง:
     Pol อ้อย = น้ำตาล + ชานอ้อย + filter cake + กากน้ำตาลสุดท้าย + undetermined

   กติกา v2.0
     · 18 แผนก (ดู depts.js) — ดาว 0-5 · ค่าพลังเครื่องจักร · เร่งเครื่อง
     · ฤดูกาล 130 วัน = หีบ 120 วัน + ล้างเครื่อง 10 วัน (เลือกวันหยุดเอง)
     · เงินตั้งต้น ฿50 ล้าน · เงินสดติดลบไม่ได้ → กู้อัตโนมัติ ยิ่งกู้ดอกยิ่งแพง
     · จ่ายค่าอ้อยทุก 7 วัน · ค่าจ้างทุก 15 วัน
     · ไม่มีระดับความยาก — ยากอย่างเดียว
   ===================================================================== */

const CONFIG = {
  /* --- ฤดูกาล --- */
  seasonDays: 130,               // เพดานปฏิทินทั้งฤดู
  crushDays: 120,                // เป้าหมายวันหีบ
  cleanBudget: 10,               // วันล้างเครื่องที่ให้มา (ใช้เกินได้ แต่กินวันหีบ)
  dayLengthSec: 12,
  speeds: [0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 5],
  startCash: 50_000_000,
  winProfit: 200_000_000,        // เกณฑ์ "ผ่าน" ของกำไรสุทธิทั้งฤดู
  /* --- งบกำไรขาดทุน (accrual) สำหรับ Financial Summary --- */
  plantBaseValue: 400_000_000,   // มูลค่าโรงงาน/เครื่องจักรตั้งต้น (สมมุติ) — ฐานคิดค่าเสื่อม
  assetLifeYears: 15,            // อายุการใช้งานเฉลี่ย (IAS 16 straight-line)
  corpTaxRate: 0.20,            // ภาษีเงินได้นิติบุคคลไทย 20% (คิดเฉพาะเมื่อ EBT เป็นบวก)
  caneTarget: 700_000,           // เป้าอ้อยเข้าหีบทั้งฤดู (ตัน) ~6,000 ต/วัน × 120 วัน — ใช้ให้คะแนนปริมาณการผลิต

  /* --- ราคาและต้นทุน --- */
  canePriceBase: 1180,           // ฿/ตัน ที่ 10 CCS
  canePricePerCCS: 70,          // ~6% ของราคาฐาน 1180 = step ต่อ CCS ตามจริง (สอน./OCSB)
  caneUpfront: 0.72,
  canePayEvery: 7,               // จ่ายค่าอ้อยทุก 7 วัน
  wagePayEvery: 15,              // จ่ายค่าจ้างทุก 15 วัน
  caneFinalDays: [65, 130],      // ค่าอ้อยขั้นสุดท้าย 2 งวด
  sugarBasePrice: 18500,
  molassesPrice: 4200,
  ppaPrice: 3.2,
  fuelOilPrice: 22000,
  limePrice: 4500,
  flocPrice: 320000,
  dailyFixedCost: 900_000,       // ค่าบริหาร ประกัน ค่าเสื่อม ต่อวัน (ไม่รวมค่าจ้าง)
  laborPerTonCane: 48,
  cleanDayCost: 1_400_000,       // ค่าใช้จ่ายวันหยุดล้างเครื่อง 1 วัน
  caneDumpCost: 350,
  waterFinePerM3: 600,

  /* --- องค์ประกอบอ้อย --- */
  polOffsetCCS: 1.6,
  brixOverPol: 1.168,

  /* --- ลูกหีบ (Rein Ch.5-7) --- */
  fibreInBagasse: 0.50,
  brixBagasse: 0.020,
  polBagPerPI: 0.097,            // PI +1 → Pol%Bag −0.097 (= Extraction +0.17%)
  imbRef: 280,                   // %fibre ที่เหมาะสม
  imbPer10: 0.085,

  /* --- ทำใส (Ch.8-10) --- */
  invRef: 0.057,
  filterCakePctCane: 3.5,
  limePerTonCane: 0.9,
  flocPerTonJuice: 3e-6,

  /* --- ต้ม-ระเหย (Ch.11-12) --- */
  enthalpySteam: 2.6,
  steamHeaters: 0.06,
  scalePerDay: 0.018,
  juicePerCane: 1.05,            // ตันน้ำอ้อยผสมต่อตันอ้อย
  syrupPerCane: 0.25,            // ตันน้ำเชื่อมต่อตันอ้อย (ที่ 65 Bx)
  volPerSyrup: 1.9,              // m³ มัสซิควีตต่อตันน้ำเชื่อม

  /* --- เคี่ยว-ปั่น (Ch.15-17) --- */
  ptyASugar: 99.3,
  brixASugar: 99.6,
  panWaterPerSyrup: 0.52,
  steamPerPanWater: 1.0,
  washRef: 3.0,
  washYieldPer1: 0.30,

  /* --- พลังงาน (Ch.13-14 + steam-brain) --- */
  kwhPerTonCane: 30,             // ค่าอ้างอิง (ค่าจริงมาจากทีมผลิตไฟฟ้า: 35 → 24 kWh/tc)
  gridBuyPrice: 4.2,             // ฿/kWh ซื้อไฟจากการไฟฟ้า (แพงกว่าราคาขาย 3.2)
  bagasseMoistRef: 48,
  bagasseYardCap: 8000,
  bagasseSellPrice: 800,

  undetBase: 0.9,

  /* --- อ้อยค้าง (cane-brain: CCS ลด 1.0 หน่วย/วัน กลางฤดู) --- */
  ccsLossPerHour: 0.042,
  polDecayFresh: 0.042,         // ตรงกับที่ UI โฆษณา (0.042/ชม. ≈ 1.0 CCS/วัน กลางฤดู · cane-brain)
  polDecayOld: 0.075,          // >24 ชม. เสื่อมเร็วกว่า ~1.8x
  burntDecayMult: 1.8,
  dextranAfterH: 24,
  caneRotHours: 96,
  weightLossPerH: 0.0006,

  waterPerTonCane: 0.55,         // m³ น้ำเสีย/ตันอ้อย (wastewater-expert 0.3-1.5)
  bodStandard: 20,               // มาตรฐานน้ำทิ้งไทย BOD ≤ 20 mg/L

  baseBreakChance: 0.006,
  orderChancePerDay: 0.42,
  maxOpenOrders: 4,
  maxAcceptedOrders: 4,
};

/* โปรไฟล์ความยากเดียว (ไม่มีให้เลือกแล้ว — ยากอย่างเดียวตามที่ผู้เล่นขอ) */
const HARD = {
  name: 'ยาก', cash: CONFIG.startCash, win: CONFIG.winProfit,
  evP: 1.55, emerP: 1.7, breakP: 1.35, priceVol: 1.6, caneMult: 1.00,
};
function diff() { return HARD; }

/* =====================================================================
   แหล่งอ้อย — ผู้เล่นจัดสัดส่วนคิวอ้อยเอง
   ===================================================================== */
const CANE_SOURCES = {
  freshNear: { name: 'อ้อยสดใกล้โรงงาน', icon: '🌱', ccs: +0.8, trash: 3.5, burnt: false, cutToCrush: 8,
               priceMult: 1.06, maxShare: 0.45, tip: 'CCS สูงสุด สิ่งปนเปื้อนน้อย แต่ปริมาณจำกัดและราคาสูง' },
  freshFar:  { name: 'อ้อยสดระยะไกล',   icon: '🚛', ccs: -0.1, trash: 5.0, burnt: false, cutToCrush: 18,
               priceMult: 1.00, maxShare: 1.00, tip: 'มาตรฐาน ตัดถึงหีบ 18 ชม. หาได้มาก' },
  mech:      { name: 'อ้อยรถตัด',       icon: '🚜', ccs: -0.4, trash: 9.5, burnt: false, cutToCrush: 12,
               priceMult: 0.97, maxShare: 0.60, tip: 'ส่งสม่ำเสมอ แต่ยอด-ใบปนมาก ทุก 1% trash ทำ CCS ลด 0.18' },
  burnt:     { name: 'อ้อยไฟไหม้',      icon: '🔥', ccs: -1.1, trash: 4.0, burnt: true,  cutToCrush: 14,
               priceMult: 0.92, maxShare: 0.70, tip: 'ราคาถูก แต่ CCS ต่ำ เสื่อมเร็ว 1.8 เท่า เกิน 24 ชม. เกิด dextran' },
};

/* =====================================================================
   ตัวแปลงค่า: ระบบเก่า up(s,'line','key') → ค่าจากแผนก (depts.js)
   เก็บไว้เพื่อให้แกนฟิสิกส์ที่ตรวจสอบแล้วใช้ต่อได้โดยไม่ต้องเขียนใหม่
   ===================================================================== */
function up(s, id, key) {
  const st = i => dStar(s, i);
  switch (id + '.' + key) {
    /* --- ลูกหีบ --- */
    case 'prep.pi':        return dv(s, 'mill', 'pi');
    case 'mill.tcd':       return dCap(s, 'mill');
    case 'mill.polBagAdj': return 0;
    case 'imb.imbEff':     return 0.72 + 0.046 * st('mill');       // ระบบน้ำ imbibition ดีขึ้นตามชุดหีบ
    /* --- ทำใส --- */
    case 'clar.retMin':    return dv(s, 'clar', 'ret');
    case 'clar.tpd':       return dCap(s, 'clar') * CONFIG.juicePerCane;
    case 'filter.polFC':   return dv(s, 'clar', 'polFC');
    /* --- หม้อต้ม --- */
    case 'evap.econ':      return dv(s, 'evap', 'econ');
    case 'evap.bx':        return dv(s, 'evap', 'bx');
    /* --- เคี่ยว-ปั่น --- */
    case 'pan.panVol':     return dCap(s, 'pan') * CONFIG.syrupPerCane * CONFIG.volPerSyrup;
    case 'fugal.fugalVol': return dCap(s, 'fugal') * CONFIG.syrupPerCane * CONFIG.volPerSyrup;
    case 'cryst.ptyFM':    return dv(s, 'fugal', 'ptyFM');
    /* ผลึกสม่ำเสมอ (CV ต่ำ) ปั่นได้สะอาดกว่า → recovery ดีขึ้น */
    case 'fugal.recAdj':   return (34 - dv(s, 'pan', 'cv')) * 0.06;
    /* --- พลังงาน --- */
    case 'boiler.eff':      return dv(s, 'boiler', 'eff');
    case 'boiler.steamCap': return dv(s, 'boiler', 'steam') * dOver(s, 'boiler').v * powerEff(dPower(s, 'boiler'));
    case 'boiler.moistAdj': return dv(s, 'boiler', 'moist') || 0;
    case 'turbine.kwhPerSteam': return dv(s, 'power', 'kwh') * dOver(s, 'power').v * powerEff(dPower(s, 'power'));
    /* ไฟที่โรงงานใช้เองต่อตันอ้อย — ทีมผลิตไฟฟ้าที่ดีกว่า (VFD, ควบคุมโหลด) กินไฟน้อยลง */
    case 'turbine.aux':         return dv(s, 'power', 'aux');
    /* --- ควบคุม/คุณภาพ --- */
    case 'auto.undetAdj':  return [0.9, 0.45, 0.15, -0.15][st('qc')];   // ทีมคุณภาพคุมความสูญเสียที่วัดไม่ได้
    /* --- โลจิสติกส์ --- */
    case 'yard.recvTpd':   return dCap(s, 'yard');
    case 'yard.yardCap':   return dv(s, 'yard', 'yardCap');
    case 'warehouse.whCap': return dv(s, 'wh', 'whCap');
    case 'warehouse.ship': return dv(s, 'wh', 'ship');
    case 'molTank.molCap': return dv(s, 'molasses', 'molCap');
    case 'packing.packTpd': return dCap(s, 'pack');
    case 'packing.packLoss': return dv(s, 'pack', 'loss');
    case 'wwt.wCap':       return dv(s, 'wwt', 'pond');
    case 'wwt.wRate':      return dv(s, 'wwt', 'rate');
    case 'wwt.bod':        return dv(s, 'wwt', 'bod');
    /* --- ทีมสนับสนุน --- */
    case 'maint.wear':      return dv(s, 'maint', 'wear');
    case 'maint.breakMult': return dv(s, 'maint', 'wear') * 0.9;
    case 'ert.ertTime':     return dv(s, 'ert', 'time');
    case 'ert.ertProb':     return dv(s, 'ert', 'prob');
    case 'ert.ertLoss':     return dv(s, 'ert', 'cost_');
    case 'sales.priceMult': return dv(s, 'sales', 'price') * dv(s, 'qc', 'prem');
    case 'sales.orderRate': return dv(s, 'sales', 'order') * (1 + st('qc') * 0.12);
    /* --- วัตถุดิบ --- */
    case 'canedev.ccsAdj':   return dv(s, 'promo', 'ccs');
    case 'canedev.trashAdj': return dv(s, 'harvest', 'trash') - 5.0;   // เทียบฐาน 5% ในตาราง CANE_SOURCES
    default: return 0;
  }
}

/* =====================================================================
   เหตุการณ์ — สาเหตุจริง · ผลกระทบเชิงปริมาณ · ทางเลือกให้ตัดสินใจ
   ===================================================================== */
const EVENTS = [
  /* ---------- สายวัตถุดิบ (ทีม 1-3) ---------- */
  { id: 'cutter_short', icon: '👷', name: 'คนตัดอ้อยไม่พอ', group: 'cane', p: 0.075,
    cause: 'แรงงานย้ายไปรับจ้างพืชอื่น / ค่าตัดที่โรงงานอื่นสูงกว่า',
    effect: 'กำลังตัดและขนลดลง 30% เป็นเวลา 3 วัน',
    apply: s => addMod(s, 'harvestCap', -0.30, 3, 'คนตัดอ้อยไม่พอ'),
    fix: 'อัปเกรดทีมเก็บเกี่ยวเป็นรถตัด หรือขึ้นค่าตัดชั่วคราว',
    choices: [
      { label: 'ขึ้นค่าตัด ฿120/ตัน 3 วัน', desc: 'กำลังตัดกลับมาเกือบเต็ม แต่ต้นทุนอ้อยเพิ่ม',
        apply: s => { addMod(s, 'harvestCap', -0.05, 3, 'ขึ้นค่าตัด'); addMod(s, 'caneCostAdj', 120, 3, 'ค่าตัดพิเศษ'); } },
      { label: 'เร่งใช้รถตัดแทนแรงงาน', desc: 'กำลังลด 12% แต่ trash เพิ่ม 3% (CCS ตก ~0.5)',
        apply: s => { addMod(s, 'harvestCap', -0.12, 3, 'ใช้รถตัดแทน'); addMod(s, 'trash', +3, 3, 'รถตัดล้วน'); } },
      { label: 'รับสภาพ ตัดได้เท่าที่ได้', desc: 'กำลังตัดลด 30% เต็ม ๆ 3 วัน ไม่เสียเงิน',
        apply: s => addMod(s, 'harvestCap', -0.30, 3, 'คนตัดไม่พอ') },
    ], defaultChoice: 2, deadlineH: 8 },

  { id: 'truck_short', icon: '🚛', name: 'รถขนอ้อยไม่พอ', group: 'cane', p: 0.07,
    cause: 'รถบรรทุกไปวิ่งงานอื่น / น้ำมันแพงผู้รับเหมาหยุดวิ่ง',
    effect: 'อ้อยเข้าโรงงานลด 25% และเวลารอคิวเพิ่ม 6 ชม. 2 วัน',
    apply: s => { addMod(s, 'harvestCap', -0.25, 2, 'รถขนอ้อยไม่พอ'); addMod(s, 'queueH', +6, 2, 'รถไม่พอ'); },
    fix: 'อัปเกรดทีมเก็บเกี่ยว (มีรถของโรงงานเอง)',
    choices: [
      { label: 'จ้างรถเสริมเหมาวัน ฿850k', desc: 'อ้อยเข้าปกติ ไม่กระทบคุณภาพ',
        apply: s => pay(s, 850_000, 'penalty') },
      { label: 'เพิ่มค่าน้ำมันให้ผู้รับเหมา ฿380k', desc: 'อ้อยเข้าลดแค่ 10%',
        apply: s => { pay(s, 380_000, 'penalty'); addMod(s, 'harvestCap', -0.10, 2, 'รถไม่พอ'); } },
      { label: 'รับสภาพ', desc: 'อ้อยเข้าลด 25% · คิวรอ +6 ชม. → CCS ตก',
        apply: s => { addMod(s, 'harvestCap', -0.25, 2, 'รถขนอ้อยไม่พอ'); addMod(s, 'queueH', +6, 2, 'รถไม่พอ'); } },
    ], defaultChoice: 2, deadlineH: 6 },

  { id: 'rain', icon: '🌧️', name: 'ฝนตกหนักในเขตส่งเสริม', group: 'cane', p: 0.06,
    cause: 'รถตัดและรถบรรทุกลงแปลงไม่ได้ ดินแฉะ',
    effect: 'อ้อยเข้าโรงงานลด 35% เป็นเวลา 2 วัน',
    apply: s => addMod(s, 'harvestCap', -0.35, 2, 'ฝนตกหนัก'),
    fix: 'สะสมอ้อยในลานไว้ล่วงหน้า',
    choices: [
      { label: 'จ้างรถตีนตะขาบลงแปลง ฿600k', desc: 'อ้อยเข้าได้ 90% แต่อ้อยเปียก CCS ลด 0.3',
        apply: s => { pay(s, 600_000, 'penalty'); addMod(s, 'harvestCap', -0.10, 2, 'ฝน'); addMod(s, 'ccs', -0.3, 2, 'อ้อยเปียก'); } },
      { label: 'รับสภาพ รอฝนหยุด', desc: 'อ้อยเข้าลด 35% เป็นเวลา 2 วัน',
        apply: s => addMod(s, 'harvestCap', -0.35, 2, 'ฝนตกหนัก') },
    ], defaultChoice: 1, deadlineH: 6 },

  { id: 'drought', icon: '☀️', name: 'ภัยแล้งในเขตส่งเสริม', group: 'cane', p: 0.045,
    cause: 'ฝนทิ้งช่วง อ้อยขาดน้ำ ผลผลิตต่อไร่ลดและชาวไร่ชะลอตัด',
    effect: 'อ้อยเข้าโรงงานลด 22% เป็นเวลา 4 วัน (แต่อ้อยเครียดน้ำ Brix สูงขึ้นเล็กน้อย CCS +0.2)',
    fix: 'ดูแลชาวไร่/สนับสนุนแหล่งน้ำ และกระจายพื้นที่รับซื้อ',
    apply: s => { addMod(s, 'harvestCap', -0.22, 4, 'ภัยแล้ง'); addMod(s, 'ccs', +0.2, 4, 'อ้อยเครียดน้ำ'); },
    choices: [
      { label: 'อุดหนุนค่าสูบน้ำให้ชาวไร่ประจำ ฿700k', desc: 'อ้อยเข้าลดแค่ 8% และผูกใจชาวไร่ (เชื่อมั่น +)',
        apply: s => { pay(s, 700_000, 'penalty'); addMod(s, 'harvestCap', -0.08, 4, 'ภัยแล้ง'); addMod(s, 'ccs', +0.2, 4, 'อ้อยเครียดน้ำ'); s.growerTrust = clamp(s.growerTrust + 5, 0, 100); } },
      { label: 'รับสภาพ รออ้อยแปลงอื่น', desc: 'อ้อยเข้าลด 22% เป็นเวลา 4 วัน',
        apply: s => { addMod(s, 'harvestCap', -0.22, 4, 'ภัยแล้ง'); addMod(s, 'ccs', +0.2, 4, 'อ้อยเครียดน้ำ'); } },
    ], defaultChoice: 1, deadlineH: 6 },

  { id: 'burnt_surge', icon: '🔥', name: 'อ้อยไฟไหม้ทะลักเข้าโรงงาน', group: 'cane', p: 0.055,
    cause: 'ชาวไร่เผาก่อนตัดเพราะแรงงานไม่พอ',
    effect: 'CCS ลด 0.8 หน่วย 2 วัน และเสี่ยงถูกภาครัฐเพ่งเล็งเรื่อง PM2.5',
    apply: s => addMod(s, 'ccs', -0.8, 2, 'อ้อยไฟไหม้ทะลัก'),
    fix: 'ลดสัดส่วนอ้อยไฟไหม้ในคิว และอัปเกรดทีมส่งเสริม',
    choices: [
      { label: 'ปฏิเสธอ้อยไฟไหม้เกินโควตา', desc: 'คุณภาพคงเดิม แต่อ้อยเข้าลด 20% 2 วัน และชาวไร่ไม่พอใจ',
        apply: s => { addMod(s, 'harvestCap', -0.20, 2, 'ปฏิเสธอ้อยไฟไหม้'); s.growerTrust = clamp(s.growerTrust - 6, 0, 100); } },
      { label: 'รับหมด แต่หักราคา 10%', desc: 'ได้อ้อยเต็ม ต้นทุนถูกลง แต่ CCS ลด 0.8 และรัฐจับตา',
        apply: s => { addMod(s, 'ccs', -0.8, 2, 'อ้อยไฟไหม้'); addMod(s, 'caneCostAdj', -110, 2, 'หักราคาอ้อยไฟไหม้'); s.govWatch = (s.govWatch || 0) + 1; } },
    ], defaultChoice: 1, deadlineH: 10 },

  /* ---------- โรงหีบ / โรงต้ม ---------- */
  { id: 'mill_choke', icon: '⚙️', name: 'ลูกหีบตัน (Mill choke)', group: 'process', p: 0.05,
    cause: 'ป้อนอ้อยเกินกำลัง ชานอ้อยอัดแน่นที่ trash plate',
    effect: 'ลูกหีบหยุด 3-6 ชม. ต้องรื้อออก',
    cond: s => dOver(s, 'mill').v > 1.2,
    apply: s => stopStation(s, 'mill', 3 + Math.random() * 3, 'ลูกหีบตัน'),
    fix: 'ลดระดับการเร่งเครื่องลูกหีบลงต่ำกว่า 125%' },
  { id: 'hammer_wear', icon: '🔨', name: 'ค้อน shredder สึก', group: 'process', p: 0.05,
    cause: 'ค้อนใช้งานเกิน 5-7 วันโดยไม่เปลี่ยน',
    effect: 'PI ลด 4 หน่วย → Extraction ลด 0.68% เป็นเวลา 3 วัน',
    apply: s => addMod(s, 'pi', -4, 3, 'ค้อน shredder สึก'),
    fix: 'หยุดล้างเครื่องเพื่อเปลี่ยนค้อน' },
  { id: 'ph_excursion', icon: '🧪', name: 'pH น้ำอ้อยแกว่ง', group: 'process', p: 0.05,
    cause: 'ปั๊มนมปูนสะดุด / อ้อยเปรี้ยวจากอ้อยค้างลาน',
    effect: 'pH หลุด ±0.5 เป็นเวลา 1 วัน → inversion เพิ่ม',
    cond: s => dStar(s, 'qc') < 2,
    apply: s => addMod(s, 'ph', (Math.random() < 0.5 ? -0.5 : 0.5), 1, 'pH แกว่ง'),
    fix: 'อัปเกรดทีมคุณภาพให้ควบคุม pH ต่อเนื่อง' },
  { id: 'mud_float', icon: '🫧', name: 'ตะกอนลอย (Mud float)', group: 'process', p: 0.03,
    cause: 'flocculant เกินขนาด หรืออากาศค้างใน flash tank',
    effect: 'undetermined loss +0.5% เป็นเวลา 2 วัน',
    apply: s => addMod(s, 'undet', +0.5, 2, 'ตะกอนลอย'),
    fix: 'ลด flocculant และตรวจ flash tank' },
  { id: 'scale_fast', icon: '🪨', name: 'ตะกรันหม้อต้มเกาะเร็ว', group: 'process', p: 0.05,
    cause: 'pH สูงเกิน 7.5 ทำให้ Ca ตกค้าง เกิด CaSO4/SiO2',
    effect: 'ค่า k ลดเร็วขึ้น 2.5 เท่า 3 วัน → Brix น้ำเชื่อมตก',
    cond: s => s.ctrl.pH > 7.5,
    apply: s => addMod(s, 'scale', +1.5, 3, 'ตะกรันเกาะเร็ว'),
    fix: 'ลด pH ลงที่ 7.0-7.2 แล้วหยุดล้างเครื่อง' },
  { id: 'vacuum_loss', icon: '🌡️', name: 'สุญญากาศตก', group: 'process', p: 0.035,
    cause: 'อากาศรั่วเข้าระบบ / ก๊าซที่ไม่ควบแน่นสะสม (NCG)',
    effect: 'กำลังระเหยลด 25% เป็นเวลา 1-2 วัน',
    apply: s => addMod(s, 'evapCap', -0.25, 1 + Math.round(Math.random()), 'สุญญากาศตก'),
    fix: 'ทดสอบรอยรั่วและเปิดวาล์วไล่ NCG' },
  { id: 'entrainment', icon: '💦', name: 'น้ำอ้อยกระเด็นตามไอ (Entrainment)', group: 'process', p: 0.035,
    cause: 'เร่งหม้อต้มจนระดับน้ำในหม้อสูงเกิน',
    effect: 'undetermined +0.8% เป็นเวลา 2 วัน',
    cond: s => dOver(s, 'evap').v > 1.2,
    apply: s => addMod(s, 'undet', +0.8, 2, 'entrainment'),
    fix: 'ลดการเร่งหม้อต้มและควบคุมระดับในหม้อ' },
  { id: 'false_grain', icon: '🧊', name: 'เกิดผลึกเทียม (False grain)', group: 'process', p: 0.04,
    cause: 'ดันความอิ่มตัวยิ่งยวดเกิน y>1.3 เพราะเร่งหม้อเคี่ยว',
    effect: 'กำลังหม้อปั่นลด 30% และ FM Purity +1.2 เป็นเวลา 2 วัน',
    cond: s => dOver(s, 'pan').v > 1.25,
    apply: s => { addMod(s, 'fugalCap', -0.30, 2, 'ผลึกเทียม'); addMod(s, 'ptyFM', +1.2, 2, 'ผลึกเทียม'); },
    fix: 'ลดการเร่งหม้อเคี่ยวและใช้ seeding แบบ slurry' },
  { id: 'screen_rupture', icon: '🕸️', name: 'ตะแกรงหม้อปั่นขาด', group: 'process', p: 0.03,
    cause: 'ตะแกรงล้าจากรอบการทำงานที่เร่งสูง',
    effect: 'recovery ลด 1.2% 1 วัน + ค่าซ่อม ฿360k',
    apply: s => { addMod(s, 'rec', -1.2, 1, 'ตะแกรงขาด'); pay(s, 360_000, 'repair'); },
    fix: 'เปลี่ยนตะแกรงตามรอบในวันล้างเครื่อง' },

  /* ---------- พลังงาน ---------- */
  { id: 'wet_bagasse', icon: '💧', name: 'ชานอ้อยเปียก', group: 'energy', p: 0.045,
    cause: 'ฝนตกใส่ลานชานอ้อย / imbibition สูงเกิน',
    effect: 'ความชื้นชานอ้อย +4% → ไอน้ำลด ~8% เป็นเวลา 3 วัน',
    apply: s => addMod(s, 'bagMoist', +4, 3, 'ชานอ้อยเปียก'),
    fix: 'ลด imbibition ชั่วคราวหรือเปิดใช้น้ำมันเตา' },
  { id: 'id_fan', icon: '🌬️', name: 'พัดลม ID trip', group: 'energy', p: 0.03,
    cause: 'ขี้เถ้าเกาะใบพัด / มอเตอร์ร้อนเกิน',
    effect: 'กำลังผลิตไอน้ำเหลือ 60% เป็นเวลา 1 วัน',
    apply: s => addMod(s, 'steamCap', -0.40, 1, 'พัดลม ID ขัดข้อง'),
    fix: 'ล้างใบพัดตามรอบ' },
  { id: 'grid_curtail', icon: '🔌', name: 'การไฟฟ้าสั่งลดรับซื้อ', group: 'energy', p: 0.03,
    cause: 'ระบบสายส่งภูมิภาคเต็ม',
    effect: 'ขายไฟได้ครึ่งเดียว 2 วัน',
    apply: s => addMod(s, 'export', -0.5, 2, 'สายส่งจำกัด'),
    fix: 'รับความเสี่ยงหรือลดการเดินหม้อไอน้ำ' },

  /* ---------- ตลาด / ส่งมอบ ---------- */
  { id: 'sugar_truck', icon: '🚚', name: 'รถขนน้ำตาลไม่พอ', group: 'market', p: 0.055,
    cause: 'ผู้รับเหมาขนส่งติดงานส่งออกที่ท่าเรือ',
    effect: 'ส่งมอบได้เพียง 50% เป็นเวลา 2 วัน',
    apply: s => addMod(s, 'ship', -0.50, 2, 'รถขนน้ำตาลไม่พอ'),
    fix: 'อัปเกรดโกดังและท่าโหลด หรือจ้างรถเสริม',
    choices: [
      { label: 'จ้างรถขนส่งภายนอก ฿700k', desc: 'ส่งมอบได้ปกติ ไม่เสียลูกค้า',
        apply: s => pay(s, 700_000, 'penalty') },
      { label: 'เลื่อนส่งมอบ แจ้งลูกค้าล่วงหน้า', desc: 'ส่งได้ 50% 2 วัน · ความพึงพอใจลูกค้า −6',
        apply: s => { addMod(s, 'ship', -0.50, 2, 'รถไม่พอ'); s.custSat = clamp(s.custSat - 6, 0, 100); } },
    ], defaultChoice: 1, deadlineH: 8 },
  { id: 'late_delivery', icon: '⏰', name: 'ส่งสินค้าไม่ทันกำหนด', group: 'market', p: 0.05,
    cause: 'น้ำตาลในคลังไม่พอ / โหลดรถไม่ทัน',
    cond: s => s.orders.some(o => o.status === 'accepted' && o.deadline - s.day <= 2 && s.stock.sugar < o.tons),
    effect: 'ลูกค้าเตือน — ถ้าไม่แก้จะเสียค่าปรับและความพึงพอใจ',
    apply: s => { s.custSat = clamp(s.custSat - 4, 0, 100); },
    fix: 'ขายสปอตน้อยลง เก็บสต็อกไว้ส่งออร์เดอร์ก่อน',
    choices: [
      { label: 'ซื้อน้ำตาลจากโรงงานเพื่อนบ้านมาส่ง', desc: 'จ่ายแพงกว่าราคาตลาด 15% แต่รักษาลูกค้าไว้ได้',
        apply: s => { const need = 400; const cost = Math.round(need * s.market.sugarPrice * 1.15); pay(s, cost, 'penalty'); s.stock.sugar += need; s.custSat = clamp(s.custSat + 2, 0, 100); } },
      { label: 'ขอเลื่อนกำหนดส่ง 3 วัน', desc: 'ลูกค้ายอม แต่ความพึงพอใจ −8 และออร์เดอร์ใหม่ลดลง',
        apply: s => { s.orders.filter(o => o.status === 'accepted').forEach(o => o.deadline += 3); s.custSat = clamp(s.custSat - 8, 0, 100); } },
    ], defaultChoice: 1, deadlineH: 10 },
  { id: 'price_drop', icon: '📉', name: 'ราคาน้ำตาลโลกดิ่ง', group: 'market', p: 0.04,
    cause: 'บราซิลผลิตล้นตลาด + ค่าเงินบาทแข็ง',
    effect: 'ราคาน้ำตาลลด 12% เป็นเวลา 5 วัน',
    apply: s => { s.market.sugarPrice = Math.round(s.market.sugarPrice * 0.88); },
    fix: 'ทำสัญญาระยะยาวไว้ล่วงหน้า (อัปเกรดทีมขาย)' },
  { id: 'price_up', icon: '📈', name: 'ราคาน้ำตาลพุ่ง', group: 'market', p: 0.04,
    cause: 'อินเดียจำกัดการส่งออก',
    effect: 'ราคาน้ำตาลขึ้น 14% ระยะสั้น',
    apply: s => { s.market.sugarPrice = Math.round(s.market.sugarPrice * 1.14); },
    fix: 'เป็นโอกาส — เร่งขายสต็อก',
    choices: [
      { label: 'เทขายสต็อกทันที', desc: 'ขายน้ำตาลในคลัง 60% ที่ราคาพุ่ง แต่เสี่ยงส่งออร์เดอร์ไม่ทัน',
        apply: s => { const tons = Math.floor(s.stock.sugar * 0.6); if (tons > 0) sellSpot(s, tons); } },
      { label: 'เก็บไว้ส่งออร์เดอร์ตามสัญญา', desc: 'ไม่ขายเพิ่ม รักษาความพึงพอใจลูกค้า +3',
        apply: s => { s.custSat = clamp(s.custSat + 3, 0, 100); } },
    ], defaultChoice: 1, deadlineH: 12 },

  /* ---------- แรงงาน / กำกับดูแล ---------- */
  { id: 'wage_protest', icon: '📢', name: 'พนักงานเรียกร้องค่าจ้าง', group: 'labour', p: 0.045,
    cause: 'ทำงานล่วงเวลาหนักติดต่อกัน / ขวัญกำลังใจต่ำ',
    cond: s => s.staffSat < 55,
    effect: 'ถ้าไม่แก้ ขวัญตกต่อเนื่องและเกิดข้อร้องเรียนแรงงาน',
    apply: s => { s.staffSat = clamp(s.staffSat - 8, 0, 100); s.complaints.labour++; },
    fix: 'อัปเกรดทีมทรัพยากรบุคคล หรือลดการเร่งเครื่อง',
    choices: [
      { label: 'จ่ายโบนัสพิเศษ ฿2.5 ล้าน', desc: 'ขวัญกำลังใจ +18 ยุติข้อเรียกร้อง',
        apply: s => { pay(s, 2_500_000, 'labor'); s.staffSat = clamp(s.staffSat + 18, 0, 100); } },
      { label: 'ลดการเร่งเครื่องทุกสถานีลง 1 ระดับ', desc: 'ขวัญ +10 แต่กำลังผลิตลด',
        apply: s => { for (const id of MACHINE_IDS) if (s.dept[id].od > 0) s.dept[id].od--; s.staffSat = clamp(s.staffSat + 10, 0, 100); } },
      { label: 'ไม่ตอบสนอง', desc: 'ขวัญ −12 · ข้อร้องเรียนแรงงาน +1 · เสี่ยงหยุดงาน',
        apply: s => { s.staffSat = clamp(s.staffSat - 12, 0, 100); s.complaints.labour++; } },
    ], defaultChoice: 2, deadlineH: 12 },
  { id: 'gov_pm25', icon: '🏛️', name: 'ภาครัฐตรวจเรื่องฝุ่นและอ้อยไฟไหม้', group: 'labour', p: 0.04,
    cause: 'สัดส่วนอ้อยไฟไหม้สูงเกินเพดานที่ราชการกำหนด',
    cond: s => (s.ctrl.caneMix.burnt || 0) > 0.25,
    effect: 'ถูกตักเตือน — ถ้าเพิกเฉยอาจถูกปรับ',
    apply: s => { s.complaints.gov++; },
    fix: 'ลดสัดส่วนอ้อยไฟไหม้ลงต่ำกว่า 25%',
    choices: [
      { label: 'ลดโควตาอ้อยไฟไหม้ทันที', desc: 'อ้อยเข้าลด 15% 3 วัน แต่ไม่มีข้อร้องเรียน',
        apply: s => { addMod(s, 'harvestCap', -0.15, 3, 'ลดอ้อยไฟไหม้'); s.ctrl.caneMix.burnt = Math.min(s.ctrl.caneMix.burnt, 0.20); } },
      { label: 'ยื่นแผนปรับปรุงและขอผ่อนผัน ฿900k', desc: 'จ่ายค่าที่ปรึกษา ไม่กระทบการผลิต',
        apply: s => pay(s, 900_000, 'penalty') },
      { label: 'เพิกเฉย', desc: 'ข้อร้องเรียนภาครัฐ +1 · เสี่ยงถูกปรับ ฿3 ล้าน',
        apply: s => { s.complaints.gov++; if (Math.random() < 0.5) pay(s, 3_000_000, 'penalty'); } },
    ], defaultChoice: 2, deadlineH: 14 },

  /* ---------- เหตุการณ์ท้าทายเพิ่มเติม (v2.4) ---------- */
  { id: 'competitor', icon: '🏭', name: 'โรงงานคู่แข่งเปิดรับซื้ออ้อยราคาสูง', group: 'cane', p: 0.05,
    cause: 'คู่แข่งข้างเคียงขึ้นราคาอ้อยเพื่อแย่งวัตถุดิบกลางฤดู',
    effect: 'ถ้าไม่สู้ราคา อ้อยเข้าโรงงานลด 25% และชาวไร่ไหลไปคู่แข่ง',
    apply: s => { addMod(s, 'harvestCap', -0.25, 3, 'คู่แข่งแย่งอ้อย'); s.growerTrust = clamp(s.growerTrust - 6, 0, 100); },
    fix: 'ขึ้นราคารับซื้อชั่วคราว หรือรักษาความสัมพันธ์ชาวไร่',
    choices: [
      { label: 'สู้ราคา +90 ฿/ตัน 3 วัน', desc: 'อ้อยเข้าปกติ ชาวไร่พอใจ แต่ต้นทุนอ้อยเพิ่ม',
        apply: s => { addMod(s, 'caneCostAdj', 90, 3, 'สู้ราคาคู่แข่ง'); s.growerTrust = clamp(s.growerTrust + 4, 0, 100); } },
      { label: 'จ่ายโบนัสความภักดีให้ชาวไร่ประจำ ฿1.2 ล้าน', desc: 'อ้อยลดแค่ 8% และผูกใจชาวไร่ระยะยาว',
        apply: s => { pay(s, 1_200_000, 'penalty'); addMod(s, 'harvestCap', -0.08, 3, 'คู่แข่ง'); s.growerTrust = clamp(s.growerTrust + 8, 0, 100); } },
      { label: 'ไม่สู้ ปล่อยไป', desc: 'อ้อยเข้าลด 25% 3 วัน · ความเชื่อมั่นชาวไร่ตก',
        apply: s => { addMod(s, 'harvestCap', -0.25, 3, 'คู่แข่งแย่งอ้อย'); s.growerTrust = clamp(s.growerTrust - 6, 0, 100); } },
    ], defaultChoice: 2, deadlineH: 10 },

  { id: 'big_order', icon: '📦', name: 'ออร์เดอร์ก้อนใหญ่จากผู้ส่งออก', group: 'market', p: 0.045,
    cause: 'ผู้ส่งออกต้องการน้ำตาลล็อตใหญ่ด่วน ราคาพรีเมียม',
    effect: 'โอกาสทำกำไรสูง แต่ถ้ารับแล้วส่งไม่ทันจะเสียค่าปรับหนัก',
    apply: s => {},
    fix: 'รับเฉพาะเมื่อมั่นใจว่ามีน้ำตาลพอส่ง',
    choices: [
      { label: 'รับออร์เดอร์ด่วน 1,500 ตัน (พรีเมียม +18%)', desc: 'ต้องส่งใน 8 วัน · ส่งไม่ทันปรับ ฿3 ล้าน + เสียชื่อเสียง',
        apply: s => { const price = Math.round(s.market.sugarPrice * up(s, 'sales', 'priceMult') * 1.18 / 50) * 50; s.orders.push({ id: 'BIG' + s.nextOrderId++, customer: 'ผู้ส่งออกต่างประเทศ', tons: 1500, price, status: 'accepted', deadline: s.day + 8, urgent: true, big: true }); toast('รับออร์เดอร์ใหญ่แล้ว — เตรียมน้ำตาลให้พอ!'); } },
      { label: 'ปฏิเสธ รักษาสต็อกไว้ขายปกติ', desc: 'ไม่เสี่ยง แต่พลาดโอกาสกำไรก้อนใหญ่', apply: s => {} },
    ], defaultChoice: 1, deadlineH: 12 },

  { id: 'oil_spike', icon: '🛢️', name: 'ราคาน้ำมันและสารเคมีพุ่ง', group: 'energy', p: 0.045,
    cause: 'ราคาพลังงานโลกสูงขึ้น กระทบน้ำมันเตาและปูน/สารเคมี',
    effect: 'ต้นทุนเดินเครื่องสูงขึ้น 5 วัน',
    apply: s => addMod(s, 'chemCost', 0.4, 5, 'ราคาน้ำมันพุ่ง'),
    fix: 'ลดพึ่งน้ำมันเตา ใช้ชานอ้อยให้คุ้ม',
    choices: [
      { label: 'ทำสัญญาล็อกราคาล่วงหน้า ฿800k', desc: 'จ่ายก่อน แต่กันต้นทุนพุ่งได้ทั้งช่วง',
        apply: s => pay(s, 800_000, 'penalty') },
      { label: 'รับความเสี่ยง ใช้ของแพงไปก่อน', desc: 'ค่าใช้จ่ายคงที่/สารเคมีเพิ่ม 40% เป็นเวลา 5 วัน',
        apply: s => addMod(s, 'chemCost', 0.4, 5, 'ราคาน้ำมันพุ่ง') },
    ], defaultChoice: 0, deadlineH: 12 },

  { id: 'audit', icon: '📋', name: 'หน่วยงานมาตรฐานเข้าตรวจโรงงาน', group: 'labour', p: 0.04,
    cause: 'ตรวจ GMP/ความปลอดภัยอาหารและสิ่งแวดล้อมประจำปี',
    effect: 'ผ่าน = ได้พรีเมียมคุณภาพ · ไม่ผ่าน = ถูกสั่งปรับปรุง',
    cond: s => dStar(s, 'qc') < 2,
    apply: s => { s.complaints.gov++; },
    fix: 'อัปเกรดทีมคุณภาพเพื่อผ่านง่าย',
    choices: [
      { label: 'เร่งจ้างที่ปรึกษาเตรียมเอกสาร ฿1.5 ล้าน', desc: 'ผ่านการตรวจแน่นอน ลูกค้าเชื่อมั่น +5',
        apply: s => { pay(s, 1_500_000, 'penalty'); s.custSat = clamp(s.custSat + 5, 0, 100); } },
      { label: 'ให้ทีมคุณภาพรับมือเอง', desc: 'ผ่าน 55% + ตามดาวทีมคุณภาพ · ไม่ผ่านถูกร้องเรียนภาครัฐ',
        apply: s => { if (Math.random() > 0.55 + dStar(s, 'qc') * 0.15) { s.complaints.gov++; s.custSat = clamp(s.custSat - 6, 0, 100); } else s.custSat = clamp(s.custSat + 3, 0, 100); } },
    ], defaultChoice: 1, deadlineH: 14 },

  { id: 'flood', icon: '🌊', name: 'น้ำหลากเข้าพื้นที่โรงงาน', group: 'cane', p: 0.03,
    cause: 'ฝนหนักต่อเนื่องทำให้น้ำท่วมลานและถนนขนส่ง',
    effect: 'อ้อยเข้าลด 40% และเสี่ยงเครื่องจักรเสียหาย 2 วัน',
    apply: s => addMod(s, 'harvestCap', -0.40, 2, 'น้ำท่วม'),
    fix: 'สูบน้ำและทำคันกั้น',
    choices: [
      { label: 'ระดมสูบน้ำ + คันกั้นชั่วคราว ฿900k', desc: 'อ้อยเข้าลดแค่ 15% ป้องกันเครื่องจักร',
        apply: s => { pay(s, 900_000, 'penalty'); addMod(s, 'harvestCap', -0.15, 2, 'น้ำท่วม (สูบน้ำ)'); } },
      { label: 'รอน้ำลด', desc: 'อ้อยเข้าลด 40% 2 วัน · เสี่ยงเครื่องเสีย',
        apply: s => { addMod(s, 'harvestCap', -0.40, 2, 'น้ำท่วม'); if (Math.random() < 0.3) { const k = ['mill', 'clar', 'pan'][Math.floor(Math.random() * 3)]; stopStation(s, k, 8, 'น้ำท่วมเครื่อง'); } } },
    ], defaultChoice: 0, deadlineH: 8 },
];

const EVENT_GROUPS = { cane: 'วัตถุดิบ', process: 'กระบวนการผลิต', energy: 'พลังงาน', market: 'ตลาด/ส่งมอบ', labour: 'แรงงาน/กำกับดูแล' };

/* =====================================================================
   เหตุฉุกเฉิน — ต้องตัดสินใจภายในเวลา ทีมฉุกเฉินลดเวลา/ค่าเสียหาย/โอกาสเกิด
   ===================================================================== */
const EMERGENCIES = [
  { id: 'plant_fire', icon: '🔥', name: 'ไฟไหม้ในโรงงาน', p: 0.013,
    cause: 'ความร้อนสะสมในกองชานอ้อย + ประกายไฟจากสายพาน (ยิ่งเร่งหม้อไอน้ำยิ่งเสี่ยง)',
    fix: 'อัปเกรดทีมตอบสนองเหตุฉุกเฉิน · อย่ากองชานอ้อยสูงเกิน · ลดการเร่งหม้อไอน้ำ',
    cond: s => s.stock.bagasse > 600,
    weight: s => (1 + Math.max(0, s.stock.bagasse - 3000) / 3000)
      * (1 + Math.max(0, dOver(s, 'boiler').v - 1) * 3)
      * (1 + Math.max(0, (60 - dPower(s, 'boiler')) / 60)),
    deadlineH: 4,
    ongoing: (s, h) => { const loss = s.stock.bagasse * 0.05 * h; s.stock.bagasse -= loss; if (s.dept.boiler.downH < 1) s.dept.boiler.downH = 1; return loss; },
    options: [
      { label: 'ทีมฉุกเฉินของโรงงานเข้าดับ', needTeam: 1, cost: 150_000, hours: 24, lossPct: 0.08, rep: +1, fireDay: true,
        desc: 'ดับได้ใน 1 วัน (เร็วขึ้นตามดาวทีมฉุกเฉิน) — ถูกที่สุดถ้ามีทีม' },
      { label: 'เรียกดับเพลิงเทศบาล', cost: 1_200_000, hours: 24, lossPct: 0.14, rep: 0, fireDay: true,
        desc: 'จ่ายค่าบริการและค่าน้ำ ใช้เวลาประมาณ 1 วัน' },
      { label: 'กันเชื้อเพลิงแล้วปล่อยให้ไหม้จนดับเอง', cost: 0, hours: 40, lossPct: 0.45, rep: -8, boilerDownH: 30, gov: 1,
        desc: 'ไม่เสียเงิน แต่ชานอ้อยหายเกือบครึ่ง หม้อไอน้ำหยุด 30 ชม. และถูกร้องเรียนเรื่องควัน' },
    ] },
  { id: 'injury', icon: '🚑', name: 'อุบัติเหตุจากการทำงาน', p: 0.012,
    cause: 'เร่งเครื่องต่อเนื่อง พนักงานล้า / การ์ดเครื่องจักรไม่ครบ',
    fix: 'ลดการเร่งเครื่อง · อัปเกรดทีม HR เพิ่มขวัญกำลังใจ · ซ่อมเครื่องที่ค่าพลังต่ำ',
    weight: s => (1 + overdriveLoad(s) * 1.2) * (s.staffSat < 50 ? 1.6 : 1) * (MACHINE_IDS.some(k => dPower(s, k) < 35) ? 1.4 : 1),
    deadlineH: 2,
    onStart: s => { const k = MACHINE_IDS[Math.floor(Math.random() * MACHINE_IDS.length)]; s.emergency.station = k; s.dept[k].downH = Math.max(s.dept[k].downH, 2); },
    options: [
      { label: 'ส่งโรงพยาบาล หยุดสอบสวนหาสาเหตุ', cost: 320_000, hours: 8, rep: +3, stationDownH: 8, staff: +6,
        desc: 'ถูกต้องตามกฎหมายความปลอดภัย พนักงานเชื่อมั่น — เสียเวลาผลิต 8 ชม.' },
      { label: 'ปฐมพยาบาล แล้วเดินเครื่องต่อ', cost: 50_000, hours: 1, rep: -4, riskFine: 0.45, fine: 2_400_000, riskShutdownH: 24, staff: -12, labourComplaint: 1,
        desc: 'เร็วและถูก แต่เสี่ยงถูกกรมสวัสดิการฯ ปรับ ฿2.4 ล้าน + สั่งหยุดเครื่อง 24 ชม. (45%) ขวัญตกหนัก' },
    ] },
  { id: 'complaint', icon: '📣', name: 'ลูกค้าร้องเรียนคุณภาพน้ำตาล', p: 0.02,
    cause: 'สี ICUMSA สูง / ความชื้นเกิน / dextran จากอ้อยค้าง',
    fix: 'อัปเกรดทีมคุณภาพ · เพิ่มน้ำล้างผลึกให้ ≥ 3% (ลดสี ICUMSA) · คุม pH 7.0-7.2 · เร่งหีบอ้อยค้างก่อนเกิด dextran',
    weight: s => (s.ctrl.wash < 2.5 ? 1.8 : 1) * (s.ctrl.pH > 7.5 ? 1.4 : 1) * (1 + (s.qualityIssue || 0)),
    deadlineH: 12,
    options: [
      { label: 'ชดเชยและส่งล็อตใหม่ให้ฟรี', cost: 800_000, hours: 2, rep: +4, cust: +6,
        desc: 'ลูกค้าพอใจ ความพึงพอใจขึ้น แต่ต้องจ่ายค่าชดเชย' },
      { label: 'ให้ทีมคุณภาพเข้าตรวจสอบและเจรจา', needQC: 1, cost: 180_000, hours: 6, rep: 0, successP: 0.55, failRep: -6, cust: +3,
        desc: 'ถูกกว่า — โอกาสสำเร็จเพิ่มตามดาวทีมคุณภาพ ถ้าไม่สำเร็จเสียความพึงพอใจ' },
      { label: 'ปฏิเสธข้อร้องเรียน', cost: 0, hours: 0, rep: -10, orderRateHit: 0.8, cust: -14, custComplaint: 1,
        desc: 'ไม่เสียเงิน แต่ความพึงพอใจตกหนักและออร์เดอร์ใหม่ลด 20% ทั้งฤดู' },
    ] },
  { id: 'pond_overflow', icon: '🌊', name: 'บ่อบำบัดล้น / น้ำเสียเกินมาตรฐาน', p: 0.014,
    cause: 'ปริมาณน้ำเสียเกินกำลังบำบัด หรือ BOD สูงกว่ามาตรฐาน 20 mg/L',
    fix: 'อัปเกรดทีมบ่อบำบัด (ขยายบ่อ+ลด BOD) · ลดน้ำตาลรั่วลงราง · ทยอยขายเพื่อลดภาระ',
    cond: s => s.water.level > s.water.cap * 0.75 || up(s, 'wwt', 'bod') > CONFIG.bodStandard,
    weight: s => 1 + Math.max(0, s.water.level / s.water.cap - 0.75) * 6,
    deadlineH: 6,
    options: [
      { label: 'สูบไปบ่อสำรองและเร่งเติมอากาศ', needTeam: 1, cost: 600_000, hours: 10, rep: 0, water: -0.35,
        desc: 'ลดระดับน้ำในบ่อ 35% ไม่ถูกร้องเรียน (ต้องมีทีมฉุกเฉิน)' },
      { label: 'จ้างรถดูดน้ำเสียออกไปกำจัด ฿1.6 ล้าน', cost: 1_600_000, hours: 6, rep: 0, water: -0.55,
        desc: 'แพงแต่ปลอดภัย ลดน้ำในบ่อ 55%' },
      { label: 'ปล่อยลงลำน้ำสาธารณะ', cost: 0, hours: 1, rep: -12, water: -0.8, gov: 1, fine: 2_000_000, riskFine: 0.7,
        desc: 'ผิดกฎหมาย — เสี่ยงถูกกรมโรงงานปรับ ฿2 ล้าน (70%) และถูกร้องเรียนภาครัฐ' },
    ] },
];

/* =====================================================================
   ระดับโรงงาน — ปลดล็อกจากน้ำตาลสะสม ทำให้ออร์เดอร์ใหญ่ขึ้นและได้พรีเมียม
   ===================================================================== */
const TIERS = [
  { name: 'โรงงานชุมชน',       icon: '🏘️', minSugar: 0,     orderMult: 1.0, premium: 0.00, export: false },
  { name: 'โรงงานระดับจังหวัด', icon: '🏭', minSugar: 8000,  orderMult: 1.3, premium: 0.02, export: false },
  { name: 'โรงงานระดับประเทศ',  icon: '🏙️', minSugar: 20000, orderMult: 1.6, premium: 0.04, export: true },
  { name: 'ผู้ส่งออกน้ำตาล',    icon: '🚢', minSugar: 35000, orderMult: 2.0, premium: 0.06, export: true },
  { name: 'ผู้นำตลาดโลก',      icon: '🌍', minSugar: 50000, orderMult: 2.5, premium: 0.08, export: true },
];
function tierOf(s) {
  let t = TIERS[0], i = 0;
  TIERS.forEach((T, k) => { if (s.totals.sugar >= T.minSugar) { t = T; i = k; } });
  return Object.assign({ index: i }, t);
}

/* =====================================================================
   ตัวชี้วัดผลงาน 8 ด้าน (แสดงสด + ใช้ตัดเกรดตอนจบฤดู)
   ===================================================================== */
/* w = น้ำหนักคะแนน (แต้มเต็มของแต่ละด้าน · รวมทุกด้าน = 1000 สำหรับระบบ Ranking)
   ลำดับความสำคัญตามที่ออกแบบ: กำไร > ประสิทธิภาพโรงงาน = คุณภาพการผลิต > คุณภาพอ้อย/ชาวไร่ > ลูกค้า > พนักงาน > อื่นๆ */
const SCORE_SPEC = [
  { key: 'profit',     icon: '💰', name: 'กำไร',                w: 260, tip: 'กำไรสุทธิทั้งฤดูเทียบเป้า ฿200 ล้าน (สำคัญอันดับ 1)' },
  { key: 'mgmt',       icon: '🎯', name: 'ประสิทธิภาพโรงงาน',   w: 170, tip: 'ปริมาณอ้อยเข้าหีบ (เป้า 700,000 ต) · เดินเครื่องต่อเนื่อง · คอขวดสมดุล · ไม่เสียอ้อย · หนี้น้อย' },
  { key: 'production', icon: '🏭', name: 'คุณภาพการผลิตน้ำตาล',  w: 170, tip: 'Recovery · Extraction · BHR · Undetermined loss' },
  { key: 'growerSat',  icon: '🌾', name: 'คุณภาพอ้อย/ชาวไร่',    w: 110, tip: 'ราคารับซื้อ · ลดคิวรอ · ไม่เสียอ้อยให้คู่แข่ง · ดูแลชาวไร่ประจำ' },
  { key: 'custSat',    icon: '🤝', name: 'ความพึงพอใจลูกค้า',    w: 90,  tip: 'ส่งครบ ตรงเวลา คุณภาพคงที่' },
  { key: 'staffSat',   icon: '👷', name: 'ความพึงพอใจพนักงาน',   w: 80,  tip: 'ค่าจ้าง สวัสดิการ ภาระ OT' },
  { key: 'safety',     icon: '🦺', name: 'ความปลอดภัย',          w: 70,  tip: 'เร่งเครื่องพอดี · ซ่อมบำรุงพร้อม · ทีมฉุกเฉิน · ไม่มีอุบัติเหตุ/ไฟไหม้' },
  { key: 'complaints', icon: '📣', name: 'ข้อร้องเรียน',         w: 50,  tip: 'ลูกค้า · แรงงาน · ภาครัฐ (ยิ่งน้อยยิ่งดี)', lower: true },
];

/* =====================================================================
   ภารกิจรายวัน
   ===================================================================== */
const DAILY_POOL = [
  { id: 'd_crush',   text: s => `หีบอ้อยวันนี้ ≥ ${fmt(Math.round(dCap(s, 'mill') * 0.85 / 100) * 100)} ตัน`, check: (s, t) => t.milled >= dCap(s, 'mill') * 0.85, reward: 500_000 },
  { id: 'd_sell',    text: () => 'ขายน้ำตาลวันนี้ ≥ 300 ตัน', check: (s, t) => (s.todaySold || 0) >= 300, reward: 400_000 },
  { id: 'd_deliver', text: () => 'ส่งมอบออร์เดอร์วันนี้ 1 รายการ', check: (s, t) => (s.todayDelivered || 0) >= 1, reward: 600_000 },
  { id: 'd_nobreak', text: () => 'ไม่มีเครื่องพังทั้งวัน', check: (s, t) => (s.todayBreaks || 0) === 0 && t.milled > 0, reward: 400_000 },
  { id: 'd_mol',     text: () => 'ขายกากน้ำตาลวันนี้ ≥ 200 ตัน', check: (s, t) => (s.todayMolSold || 0) >= 200, reward: 300_000 },
  { id: 'd_steam',   text: () => 'ไอน้ำพอทั้งวัน (ไม่ขาดไอ)', check: (s, t) => !t.steamShort && t.milled > 0, reward: 300_000 },
  { id: 'd_yard',    text: () => 'อ้อยค้างลานไม่เกิน 24 ชม. ตลอดวัน', check: (s, t) => oldestAgeH(s) <= 24 && t.milled > 0, reward: 400_000 },
  { id: 'd_power',   text: () => 'ทุกเครื่องจักรมีค่าพลังเหลือ ≥ 40%', check: s => MACHINE_IDS.every(k => dPower(s, k) >= 40), reward: 450_000 },
  { id: 'd_staff',   text: () => 'ความพึงพอใจพนักงาน ≥ 65', check: s => s.staffSat >= 65, reward: 350_000 },
];

/* =====================================================================
   เควส
   ===================================================================== */
const QUESTS = [
  { id: 'q_balance3', title: 'สมดุลสายวัตถุดิบ', desc: 'อัปเกรดทีม 1-3 ให้กำลังต่างกันไม่เกิน 1 ระดับ', icon: '🔗', reward: { cash: 3_000_000, rep: 3 },
    check: s => { const a = [dStar(s, 'promo'), dStar(s, 'harvest'), dStar(s, 'yard')]; return { cur: (Math.max(...a) - Math.min(...a) <= 1 && Math.min(...a) >= 1) ? 1 : 0, target: 1, unit: '' }; } },
  { id: 'q_first_sugar', title: 'น้ำตาลล็อตแรก', desc: 'ผลิตน้ำตาลสะสมให้ครบ 1,000 ตัน', icon: '🧊', reward: { cash: 2_000_000, rep: 2 },
    check: s => ({ cur: s.totals.sugar, target: 1000, unit: 'ตัน' }) },
  { id: 'q_first_order', title: 'ลูกค้ารายแรก', desc: 'ส่งมอบออร์เดอร์สำเร็จ 1 รายการ', icon: '📦', reward: { cash: 1_500_000, rep: 3 },
    check: s => ({ cur: s.totals.ordersDone, target: 1, unit: 'รายการ' }) },
  { id: 'q_maint2', title: 'ช่างพร้อมรบ', desc: 'อัปเกรดทีมซ่อมบำรุงถึง 2 ดาว', icon: '🛠️', reward: { cash: 3_000_000, rep: 2 },
    check: s => ({ cur: dStar(s, 'maint'), target: 2, unit: 'ดาว' }) },
  { id: 'q_clean1', title: 'หยุดล้างครั้งแรก', desc: 'หยุดล้างเครื่อง 1 วัน เพื่อฟื้นค่าพลังเครื่องจักร', icon: '🧽', reward: { cash: 2_000_000, rep: 1 },
    check: s => ({ cur: s.cleanDaysUsed, target: 1, unit: 'วัน' }) },
  { id: 'q_ext95', title: 'สกัดให้เกลี้ยง', desc: 'Extraction % Pol สะสม ≥ 95.0%', icon: '⚙️', reward: { cash: 4_000_000, rep: 2 },
    check: s => ({ cur: s.kpi.extraction || 0, target: 95, unit: '%', decimals: 1 }) },
  { id: 'q_sugar10k', title: 'หมื่นตันแรก', desc: 'ผลิตน้ำตาลสะสมครบ 10,000 ตัน', icon: '🏭', reward: { cash: 5_000_000, rep: 3 },
    check: s => ({ cur: s.totals.sugar, target: 10000, unit: 'ตัน' }) },
  { id: 'q_ert', title: 'พร้อมรับเหตุ', desc: 'ตั้งทีมตอบสนองเหตุฉุกเฉิน (1 ดาวขึ้นไป)', icon: '🚨', reward: { cash: 2_500_000, rep: 3 },
    check: s => ({ cur: dStar(s, 'ert'), target: 1, unit: 'ดาว' }) },
  { id: 'q_fm35', title: 'รีดน้ำตาลจากโมลาส', desc: 'Final Molasses Purity ≤ 35.0', icon: '🍯', reward: { cash: 6_000_000, rep: 3 },
    check: s => ({ cur: s.kpi.ptyFM || 99, target: 35, unit: '', decimals: 1, lower: true }) },
  { id: 'q_staff70', title: 'พนักงานอยู่กับเรา', desc: 'ความพึงพอใจพนักงาน ≥ 70 หลังวันที่ 20', icon: '👷', reward: { cash: 4_000_000, rep: 3 },
    check: s => ({ cur: s.day > 20 ? s.staffSat : 0, target: 70, unit: '' }) },
  { id: 'q_orders5', title: 'ลูกค้าประจำ', desc: 'ส่งมอบออร์เดอร์สำเร็จ 5 รายการ', icon: '🤝', reward: { cash: 4_000_000, rep: 5 },
    check: s => ({ cur: s.totals.ordersDone, target: 5, unit: 'รายการ' }) },
  { id: 'q_power', title: 'โรงไฟฟ้าชีวมวล', desc: 'ขายไฟฟ้าสะสม 3,000 MWh', icon: '⚡', reward: { cash: 4_000_000, rep: 2 },
    check: s => ({ cur: s.totals.kwhExport / 1000, target: 3000, unit: 'MWh' }) },
  { id: 'q_noloan', title: 'ปลอดหนี้', desc: 'ปิดหนี้เงินกู้ให้เหลือ ฿0 หลังวันที่ 40', icon: '🏦', reward: { cash: 6_000_000, rep: 3 },
    check: s => ({ cur: (s.day > 40 && s.loan <= 0) ? 1 : 0, target: 1, unit: '' }) },
  { id: 'q_recovery84', title: 'โรงงานมาตรฐานไทย', desc: 'Overall Recovery สะสม ≥ 84%', icon: '📊', reward: { cash: 10_000_000, rep: 5 },
    check: s => ({ cur: s.kpi.recovery || 0, target: 84, unit: '%', decimals: 1 }) },
  { id: 'q_stars', title: 'แผนกห้าดาว', desc: 'ทำแผนกใดแผนกหนึ่งให้ครบ 5 ดาว', icon: '⭐', reward: { cash: 8_000_000, rep: 4 },
    check: s => ({ cur: Math.max(0, ...DEPTS.filter(d => d.maxStar === 5).map(d => dStar(s, d.id))), target: 5, unit: 'ดาว' }) },
  { id: 'q_sugar40k', title: 'สี่หมื่นตัน', desc: 'ผลิตน้ำตาลสะสมครบ 40,000 ตัน', icon: '🏆', reward: { cash: 12_000_000, rep: 5 },
    check: s => ({ cur: s.totals.sugar, target: 40000, unit: 'ตัน' }) },
];

/* =====================================================================
   สถานีบนแผนที่ → แผนกที่เกี่ยวข้อง
   ===================================================================== */
const STATION_META = {
  field:     { name: 'ไร่อ้อย / ส่งเสริม', en: 'Cane Development', dept: 'promo' },
  harvest:   { name: 'เก็บเกี่ยว-ขนส่ง',   en: 'Harvest & Haulage', dept: 'harvest' },
  yard:      { name: 'ลานอ้อย',           en: 'Cane Yard',        dept: 'yard' },
  mill:      { name: 'ลูกหีบ',            en: 'Milling',          dept: 'mill' },
  clar:      { name: 'ทำใส',              en: 'Clarification',    dept: 'clar' },
  evap:      { name: 'หม้อต้มระเหย',       en: 'Evaporation',      dept: 'evap' },
  pan:       { name: 'หม้อเคี่ยว',         en: 'Pan Boiling',      dept: 'pan' },
  fugal:     { name: 'หม้อปั่นแยก',        en: 'Centrifugal',      dept: 'fugal' },
  pack:      { name: 'บรรจุน้ำตาล',        en: 'Packing',          dept: 'pack' },
  warehouse: { name: 'โกดังและส่งมอบ',     en: 'Warehouse',        dept: 'wh' },
  boiler:    { name: 'หม้อไอน้ำ',          en: 'Boiler',           dept: 'boiler' },
  power:     { name: 'ผลิตไฟฟ้า',          en: 'Power House',      dept: 'power' },
  maint:     { name: 'ทีมซ่อมบำรุง',       en: 'Maintenance',      dept: 'maint' },
  office:    { name: 'ขายและการตลาด',      en: 'Sales & Marketing', dept: 'sales' },
  ert:       { name: 'ทีมฉุกเฉิน',         en: 'Emergency Response', dept: 'ert' },
  hr:        { name: 'ทรัพยากรบุคคล',      en: 'Human Resources',  dept: 'hr' },
  qc:        { name: 'ทีมคุณภาพ',          en: 'Quality',          dept: 'qc' },
  water:     { name: 'บ่อบำบัด',           en: 'Wastewater',       dept: 'wwt' },
  molasses:  { name: 'ถังกากน้ำตาล',       en: 'Molasses Tank',    dept: 'molasses' },
};
const PROCESS_STATIONS = ['mill', 'clar', 'evap', 'pan', 'fugal', 'boiler', 'pack', 'power'];

function addMod(s, key, amount, days, label) { s.mods.push({ key, amount, daysLeft: days, label }); }

/* =====================================================================
   state เริ่มต้น
   ===================================================================== */
function createInitialState() {
  const st = {
    version: 6,
    day: 1, dayProgress: 0, speed: 0, ended: false, bankrupt: false, started: false,
    cash: CONFIG.startCash,
    loan: 0, loanInterestPaid: 0, debts: [], _debtSeq: 0,
    crushDaysDone: 0, cleanDaysUsed: 0,
    cleanDay: { active: false, hoursLeft: 0, queued: false },

    emergency: null, emergencies: [], orderRateMult: 1,
    decisions: [], decisionsDone: [], questsDone: [], questLog: [],
    contracts: [], contractOffers: [], nextContractId: 1, tierIndex: 0,
    daily: { day: 0, tasks: [] },
    todaySold: 0, todayDelivered: 0, todayBreaks: 0, todayMolSold: 0,
    savedAt: 0,

    /* --- ตัวชี้วัดความสัมพันธ์ --- */
    reputation: 50,
    custSat: 70,          // ความพึงพอใจลูกค้า (เริ่มต้น 70%)
    staffSat: 70,         // ความพึงพอใจพนักงาน (เริ่มต้น 70%)
    growerTrust: 70,      // ความพึงพอใจ/ความเชื่อมั่นของชาวไร่ (เริ่มต้น 70%)
    safety: 90,           // ดัชนีความปลอดภัย 0-100 (สูง=ปลอดภัย) — คุมโอกาสเกิดอุบัติเหตุ/ไฟไหม้
    complaints: { customer: 0, labour: 0, gov: 0 },
    govWatch: 0, qualityIssue: 0,

    /* --- 18 แผนก --- */
    dept: Object.fromEntries(DEPTS.map(d => [d.id, {
      star: 0, od: 0, power: 100, downH: 0, runH: 0, brokenDays: 0,
    }])),

    ctrl: {
      crushTarget: 0,     // ตั้งอัตโนมัติจากกำลังลูกหีบตอนเริ่มเกม
      caneMix: { freshNear: 0.20, freshFar: 0.45, mech: 0.20, burnt: 0.15 },
      imbibition: 250,
      pH: 7.1,
      syrupBrix: 62,
      wash: 3.0,
      useOil: false,
      autoTune: true,
    },

    yard: { lots: [], rejected: 0, queueTons: 0, queueH: 0 },
    field: { standing: 0 },      // อ้อยที่หาไว้แล้วแต่ยังไม่ได้ตัด (ตัน)
    buf: { mj: { m: 0, B: 0, P: 0 }, cj: { m: 0, B: 0, P: 0 }, syrup: { m: 0, B: 0, P: 0 } },
    rawSugar: 0,
    stock: { sugar: 0, molasses: 0, bagasse: 1500, oil: 0 },
    market: { sugarPrice: CONFIG.sugarBasePrice, molPrice: CONFIG.molassesPrice, canePriceMult: 1.0, pressure: 0 },

    /* alias ให้โค้ดเดิมที่อ้าง s.stations ยังทำงาน (ชี้ไปที่ s.dept เดียวกัน) */
    cleaning: { daysSince: 0, count: 0, activeH: 0 },
    water: { level: 0, cap: 6000, bod: 60 },

    payable: { amount: 0, nextIdx: 0, accrued: 0 },
    wagesAccrued: 0,
    mods: [], orders: [], nextOrderId: 1,
    log: [],
    hints: [{ lvl: 'info', text: 'ยังไม่เริ่มเดินเครื่อง — ปรับปรุงแผนกและตั้งค่าให้พร้อมก่อน แล้วค่อยกดเริ่มหีบ' }],
    today: emptyDay(), yesterday: emptyDay(), newEvents: [], pendingSales: 0, pendingMol: 0,
    history: [], kpi: {}, score: {}, finalReport: null,
    totals: {
      cane: 0, sugar: 0, molasses: 0, bagasse: 0,
      polCane: 0, polSugar: 0, polBag: 0, polFC: 0, polFM: 0, polUndet: 0,
      brixSyrup: 0, polSyrup: 0,
      revenue: 0, cost: 0, steam: 0, kwh: 0, kwhExport: 0, kwhBought: 0,
      revSugar: 0, revMolasses: 0, revPower: 0,
      costCane: 0, costFixed: 0, costLabor: 0, costRepair: 0, costUpgrade: 0, costOther: 0, costInterest: 0, costEnergy: 0,
      ordersDone: 0, ordersFailed: 0, breakdowns: 0, cleanings: 0,
      runH: 0, downH: 0, noCaneH: 0, cleanH: 0, openH: 0,
      caneRot: 0, caneLost: 0, caneDiverted: 0, waterOverflow: 0,
      maxLoan: 0,
    },
  };
  st.stations = st.dept;                       // alias
  st.water.cap = dv(st, 'wwt', 'pond');
  st.water.bod = dv(st, 'wwt', 'bod');
  st.ctrl.crushTarget = dCap(st, 'mill') / 24;
  return st;
}

function emptyDay() {
  return {
    hours: 0, runH: 0, downH: 0, noCaneH: 0, cleanH: 0,
    found: 0, harvested: 0, received: 0, rejected: 0, milled: 0, rotDumped: 0, diverted: 0,
    polCane: 0, brixCane: 0, fibreCane: 0, ccs: 0, trash: 0, ageH: 0, queueH: 0,
    bagasse: 0, polBag: 0, imbWater: 0, pi: 0, rawJuice: 0, throttled: false,
    clarIn: 0, clearJuice: 0, filterCake: 0, polFC: 0, inversion: 0,
    evapIn: 0, waterEvap: 0, syrup: 0, syrupBrixPct: 0, polUndet: 0,
    centIn: 0, sugar: 0, molasses: 0, ptyFM: 0, packed: 0, packLoss: 0,
    molFull: false, packFull: false, panLimited: false, fugalLimited: false, molOverflow: 0, overflow: 0,
    steam: 0, steamNeed: 0, steamShort: false, kwh: 0, kwhExport: 0, bagasseUsed: 0, oilUsed: 0, bagMoist: 48,
    waterIn: 0, waterTreated: 0, waterOverflow: 0,
    steamMade: 0, steamUsed: 0, kwhInternal: 0, powerExport: 0, kwhBought: 0, gridCost: 0, caneAccrued: 0, stoppedBy: '',
    caneCost: 0, labor: 0, chemicals: 0, fixed: 0, repair: 0, fuelCost: 0,
    dumpCost: 0, waterFine: 0, penalty: 0, finalPayment: 0, cleanCost: 0, interest: 0,
    salesRev: 0, molassesRev: 0, powerRev: 0, sold: 0,
  };
}
