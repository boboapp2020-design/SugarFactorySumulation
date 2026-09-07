'use strict';
/* =====================================================================
   Sugar Factory Manager v2.0 — depts.js
   18 แผนก (ทีม) พร้อมกติกา "ดาว / ค่าพลังเครื่องจักร / การเร่งเครื่อง"

   แนวคิดหลัก
   ----------
   1) ทุกแผนกมี "ดาว" 0-5 (บางทีมเต็มที่ 3 ดาว) — อัปเกรดแล้วเก่งขึ้นถาวร
   2) แผนกที่เป็นเครื่องจักร (kind:'machine') มี "ค่าพลังเครื่องจักร" (power 0-100%)
      - เริ่มที่ 100% ทุกดาว แต่ยิ่งดาวมาก ค่าพลังยิ่งลดช้า
      - ค่าพลังต่ำ = ประสิทธิภาพต่ำ  ·  ค่าพลัง 0 = เครื่องพัง หยุดทั้งกระบวนการ
   3) "เร่งเครื่อง" (overdrive) เพิ่มกำลังผลิตทันทีโดยไม่ต้องลงทุน
      แต่ค่าพลังลดเร็วขึ้นแบบยกกำลังสาม (od³) + พนักงานเหนื่อย + เสี่ยงอุบัติเหตุ

   อ้างอิงตัวเลข: Peter Rein "Cane Sugar Engineering" (2007), benchmark ไทย/โลก,
   steam-brain (ชานอ้อย 28% ต่ออ้อย · ไอ 0.60-0.65 t/t อ้อย · ใช้เอง 28-35 kWh/tc),
   wastewater-expert (น้ำเสีย 0.3-1.5 m³/ตันอ้อย · BOD ดิบ 800-3,000 mg/L),
   cane-brain (ราคาอ้อย 890 ฿/t ที่ 10 CCS · +53.4 ฿/t ต่อ 1 CCS)
   ===================================================================== */

/* ---------- ระดับการเร่งเครื่อง ---------- */
const OVERDRIVE = [
  { v: 1.00, label: '100%', name: 'เดินปกติ',    tip: 'ค่าพลังลดตามปกติ' },
  { v: 1.10, label: '110%', name: 'เร่งเล็กน้อย', tip: 'กำลัง +10% · ค่าพลังลดเร็วขึ้น 1.3 เท่า' },
  { v: 1.25, label: '125%', name: 'เร่งปานกลาง', tip: 'กำลัง +25% · ค่าพลังลดเร็วขึ้น 2.0 เท่า · พนักงานเริ่มบ่น' },
  { v: 1.40, label: '140%', name: 'เร่งหนัก',    tip: 'กำลัง +40% · ค่าพลังลดเร็วขึ้น 2.7 เท่า · เสี่ยงอุบัติเหตุ' },
  { v: 1.50, label: '150%', name: 'เร่งสุดกำลัง', tip: 'กำลัง +50% · ค่าพลังลดเร็วขึ้น 3.4 เท่า · เสี่ยงมาก' },
];

/* ค่าพลังลดกี่ % ต่อชั่วโมง ที่เดินปกติ (ดาว 0-5) — ดาวมาก = ทนกว่า */
const POWER_DRAIN = [0.120, 0.100, 0.085, 0.070, 0.058, 0.048];

/* ---------- เกณฑ์ราคาอ้อย/ค่าใช้จ่าย (ระบบไทย) ---------- */
const ECON = {
  canePriceAt10CCS: 1180,   // ฿/ตัน (ราคาขั้นต้น + ค่าบำรุง ปรับให้สมดุลเกม)
  canePricePerCCS: 62,      // ฿/ตัน ต่อ 1 CCS เหนือ 10
  caneUpfront: 0.72,        // จ่ายทันที 72% ที่เหลือเป็นค่าอ้อยขั้นสุดท้าย
  canePayEveryDays: 7,      // จ่ายค่าอ้อยทุก 7 วัน
  wagePayEveryDays: 15,     // จ่ายค่าจ้างทุก 15 วัน
  sugarBasePrice: 18500,    // ฿/ตัน
  molassesPrice: 4200,
  ppaPrice: 3.2,            // ฿/kWh ไฟขายออก
  fuelOilPrice: 22000,
  limePrice: 4500,
  flocPrice: 320000,
  loanRateBase: 0.12,       // ดอกเบี้ยฐาน 12%/ปี (สินเชื่อฤดูการผลิต)
  loanRateStep: 0.03,       // +3%/ปี ทุกยอดกู้ 50 ล้าน (ความเสี่ยงเครดิต)
  loanRateStepAt: 50_000_000,
  creditCap: 400_000_000,   // วงเงินกู้สูงสุด
  /* ประเภทเงินกู้ (ผู้เล่นเลือกได้เมื่อกู้เอง) */
  shortTermDays: 30,        // ระยะสั้น: ครบกำหนดคืนใน 30 วัน
  shortRateMul: 0.80,       // ระยะสั้น ดอกถูกกว่า (0.8x) แต่ต้องคืนเร็ว
  longRateMul: 1.15,        // ระยะยาว ดอกแพงกว่า (1.15x) แต่ผ่อนได้ทั้งฤดู
  overdueRateMul: 1.7,      // ระยะสั้นเลยกำหนด = เบี้ยปรับดอกเบี้ยพุ่ง
};

/* =====================================================================
   นิยาม 18 แผนก
   kind: 'supply' = สายวัตถุดิบ (ทีม 1-3) · 'machine' = เครื่องจักร (มีค่าพลัง)
         'support' = ทีมสนับสนุน (ไม่มีค่าพลัง)
   cap  = กำลังต่อวันในหน่วย "ตันอ้อย/วัน" (ยกเว้นที่ระบุ) ใช้เทียบคอขวดได้ตรง ๆ
   ===================================================================== */
const DEPTS = [
  /* ------------------ 1-3 สายวัตถุดิบ ------------------ */
  {
    id: 'promo', no: 1, icon: '🌾', name: 'ทีมส่งเสริมหาอ้อย', short: 'ส่งเสริม',
    kind: 'supply', group: 'cane', maxStar: 5,
    role: 'หาอ้อยเข้าโรงงานให้ได้มากที่สุด ดูแลชาวไร่ ทำสัญญาส่งอ้อย',
    metric: 'อ้อยที่หาได้ (ตัน/วัน)',
    chain: 'ถ้าหาอ้อยได้มากกว่าที่ทีมเก็บเกี่ยวตัดไหว อ้อยส่วนเกินจะถูกโรงงานอื่นแย่งไป และชาวไร่เสียความเชื่อมั่น',
    levels: [
      { name: 'เจ้าหน้าที่ส่งเสริม 3 คน',            cost: 0,          cap: 1000,  ccs: 0.0, trust: 1.00 },
      { name: 'เพิ่มทีม 8 คน + รถลงพื้นที่',          cost: 700_000,  cap: 3000,  ccs: 0.15, trust: 1.05 },
      { name: 'สนับสนุนท่อนพันธุ์ + ปุ๋ยเครดิต',       cost: 1_100_000,  cap: 4000,  ccs: 0.35, trust: 1.10 },
      { name: 'โควตาเงินเกี๊ยว + นักวิชาการประจำเขต',   cost: 1_800_000,  cap: 6000,  ccs: 0.60, trust: 1.16 },
      { name: 'แปลงสาธิต + จ่ายเพิ่มตามคุณภาพ CCS',    cost: 2_600_000,  cap: 8000,  ccs: 0.90, trust: 1.22 },
      { name: 'ระบบส่งเสริมดิจิทัล + ชลประทานหยด',      cost: 3_900_000,  cap: 10000, ccs: 1.30, trust: 1.30 },
    ],
  },
  {
    id: 'harvest', no: 2, icon: '🚜', name: 'ทีมเก็บเกี่ยวและขนส่งอ้อย', short: 'เก็บเกี่ยว',
    kind: 'supply', group: 'cane', maxStar: 5,
    role: 'จัดคนตัด รถตัด และรถบรรทุกอ้อยเข้าโรงงาน',
    metric: 'ตัดและขนได้ (ตัน/วัน)',
    chain: 'ตัดไม่ทันทีมส่งเสริม = เสียอ้อยให้โรงอื่น · ตัดเกินที่ลานรับไหว = รถจอดรอ อ้อยค้างเสื่อมคุณภาพ',
    levels: [
      /* trash = %สิ่งปนเปื้อน · cut = ชั่วโมงตัดถึงหีบพื้นฐาน */
      { name: 'แรงงานตัดมือ 2 ชุด · รถ 15 คัน',        cost: 0,          cap: 1000,  trash: 4.0, cut: 22 },
      { name: 'แรงงาน 6 ชุด · รถ 40 คัน',              cost: 1_900_000,  cap: 3000,  trash: 4.5, cut: 18 },
      { name: 'รถตัด 2 คัน + รถบรรทุก 70 คัน',         cost: 3_300_000,  cap: 4000,  trash: 6.5, cut: 15 },
      { name: 'รถตัด 4 คัน + รถพ่วง 110 คัน',          cost: 5_500_000, cap: 6000,  trash: 7.5, cut: 12 },
      { name: 'รถตัด 7 คัน + GPS จัดคิวรถ',            cost: 8_300_000, cap: 8000,  trash: 6.0, cut: 10 },
      { name: 'รถตัด 10 คัน + ศูนย์ควบคุมขนส่ง',        cost: 12_100_000, cap: 10000, trash: 5.0, cut: 8 },
    ],
  },
  {
    id: 'yard', no: 3, icon: '🏗️', name: 'ทีมลานอ้อย', short: 'ลานอ้อย',
    kind: 'supply', group: 'cane', maxStar: 5,
    role: 'ชั่งน้ำหนัก จัดคิวรถ เทกองอ้อย ป้อนเข้าโต๊ะป้อนลูกหีบ',
    metric: 'รับรถอ้อยได้ (ตัน/วัน)',
    chain: 'รับไม่ทัน = รถต่อคิวยาว ชั่วโมงตัด-ถึง-หีบพุ่ง CCS ตกชั่วโมงละ 0.042 หน่วย เกิน 24 ชม. เกิด dextran และรถหนีไปโรงอื่น',
    levels: [
      { name: 'ลาน 2,500 ตัน · เครน 2 ตัว',            cost: 0,          cap: 1000,  yardCap: 2500 },
      { name: 'ขยายลาน 4,000 ตัน · เครน 3 ตัว',        cost: 1_400_000,  cap: 3000,  yardCap: 4000 },
      { name: 'โต๊ะป้อนคู่ + ชั่ง 2 ตัว',                cost: 2_500_000,  cap: 4000,  yardCap: 5500 },
      { name: 'ลาน 7,500 ตัน · เครน 5 ตัว',            cost: 4_100_000,  cap: 6000,  yardCap: 7500 },
      { name: 'คิวรถออนไลน์ + ชั่งอัตโนมัติ',            cost: 6_100_000, cap: 8000,  yardCap: 10000 },
      { name: 'ศูนย์จัดคิว 24 ชม. + ลาน 13,000 ตัน',    cost: 8_800_000, cap: 10000, yardCap: 13000 },
    ],
  },

  /* ------------------ 4-9 กระบวนการผลิต ------------------ */
  {
    id: 'mill', no: 4, icon: '⚙️', name: 'ลูกหีบ', short: 'ลูกหีบ',
    kind: 'machine', group: 'process', maxStar: 5,
    role: 'สับ-ย่อย-หีบอ้อย แยกน้ำอ้อยออกจากชานอ้อย',
    metric: 'กำลังหีบ (ตันอ้อย/วัน) · Pol%Bagasse',
    /* pi = Preparation Index · polBag = Pol%Bagasse ที่ imbibition 280% */
    levels: [
      { name: '4 ชุดหีบ · ใบมีดชุดเดียว',              cost: 0,          cap: 4000,  pi: 85, polBag: 2.60 },
      { name: '4 ชุด + Shredder',                    cost: 3_900_000,  cap: 5500,  pi: 88, polBag: 2.20 },
      { name: '5 ชุด + pressure feeder',              cost: 7_200_000, cap: 7000,  pi: 90, polBag: 1.90 },
      { name: '5 ชุด + ไฮดรอลิกแรงดันสูง',             cost: 11_600_000, cap: 8500,  pi: 92, polBag: 1.65 },
      { name: '6 ชุด + Donnelly chute',               cost: 17_100_000, cap: 10000, pi: 94, polBag: 1.45 },
      { name: '6 ชุด + Heavy-duty shredder 1,200 rpm', cost: 24_200_000, cap: 12000, pi: 96, polBag: 1.30 },
    ],
  },
  {
    id: 'clar', no: 5, icon: '🧪', name: 'ทำใส', short: 'ทำใส',
    kind: 'machine', group: 'process', maxStar: 5,
    role: 'ใส่ปูนขาว ให้ความร้อน ตกตะกอน แยกกากตะกอนออกจากน้ำอ้อย',
    metric: 'กำลังทำใส · Retention · Pol%Filter Cake',
    /* ret = นาทีที่น้ำอ้อยค้างในหม้อใส (ยิ่งนาน inversion ยิ่งมาก) */
    levels: [
      { name: 'Multi-tray Dorr',                     cost: 0,          cap: 4500,  ret: 150, polFC: 2.60 },
      { name: 'Dorr + flash tank',                   cost: 2_800_000,  cap: 6000,  ret: 110, polFC: 2.10 },
      { name: 'RapiDorr',                            cost: 5_500_000, cap: 7500,  ret: 75,  polFC: 1.60 },
      { name: 'SRI Rapid Clarifier',                 cost: 8_800_000, cap: 9000,  ret: 50,  polFC: 1.20 },
      { name: 'SRI Rapid + Belt press',              cost: 13_200_000, cap: 10500, ret: 38,  polFC: 0.90 },
      { name: 'SRI 2 ชุด + Belt press ล้างสองชั้น',    cost: 18_700_000, cap: 12500, ret: 30,  polFC: 0.70 },
    ],
  },
  {
    id: 'evap', no: 6, icon: '♨️', name: 'หม้อต้มระเหย', short: 'หม้อต้ม',
    kind: 'machine', group: 'process', maxStar: 5,
    role: 'ระเหยน้ำออกจากน้ำอ้อยใส ทำให้เข้มข้นเป็นน้ำเชื่อม',
    metric: 'กำลังระเหย · Steam economy · Brix น้ำเชื่อม',
    /* econ = kg น้ำที่ระเหยได้ต่อ kg ไอน้ำ · bx = Brix น้ำเชื่อมสูงสุด */
    levels: [
      { name: '3-effect Robert 4,400 m²',            cost: 0,          cap: 4200,  econ: 2.1, bx: 60 },
      { name: '4-effect Robert 5,200 m²',            cost: 5_000_000,  cap: 5800,  econ: 2.6, bx: 62 },
      { name: '5-effect Robert 6,200 m²',            cost: 8_800_000, cap: 7200,  econ: 3.0, bx: 64 },
      { name: '5-effect + Falling film 7,400 m²',    cost: 13_800_000, cap: 8800,  econ: 3.4, bx: 66 },
      { name: '5-effect FF + vapour bleeding',       cost: 19_300_000, cap: 10500, econ: 3.8, bx: 68 },
      { name: '6-effect FF + ล้างตะกรันอัตโนมัติ',     cost: 26_400_000, cap: 12500, econ: 4.3, bx: 70 },
    ],
  },
  {
    id: 'pan', no: 7, icon: '🍯', name: 'หม้อเคี่ยว', short: 'หม้อเคี่ยว',
    kind: 'machine', group: 'process', maxStar: 5,
    role: 'เคี่ยวน้ำเชื่อมให้เกิดผลึกน้ำตาล (A-B-C massecuite)',
    metric: 'กำลังเคี่ยว · ความสม่ำเสมอผลึก (CV)',
    /* cv = Coefficient of Variation ของผลึก ยิ่งต่ำยิ่งปั่นง่าย */
    levels: [
      { name: 'Batch pan 6 ลูก',                     cost: 0,          cap: 4000,  cv: 40 },
      { name: 'Batch pan 8 ลูก',                     cost: 4_100_000,  cap: 5500,  cv: 37 },
      { name: 'Batch 10 ลูก + เครื่องกวน',            cost: 7_700_000, cap: 7000,  cv: 34 },
      { name: 'เพิ่ม Continuous Vacuum Pan',          cost: 12_100_000, cap: 8500,  cv: 31 },
      { name: 'CVP 2 ชุด + seeding slurry อัตโนมัติ',  cost: 17_600_000, cap: 10000, cv: 28 },
      { name: 'CVP 3 ชุด + ควบคุม supersaturation',   cost: 24_800_000, cap: 12000, cv: 25 },
    ],
  },
  {
    id: 'fugal', no: 8, icon: '🌀', name: 'หม้อปั่นแยกน้ำตาล', short: 'หม้อปั่น',
    kind: 'machine', group: 'process', maxStar: 5,
    role: 'ปั่นแยกผลึกน้ำตาลออกจากกากน้ำตาล ล้างผลึกให้ขาว',
    metric: 'กำลังปั่น · Final Molasses Purity',
    /* ptyFM = Purity กากน้ำตาลสุดท้าย ยิ่งต่ำยิ่งดึงน้ำตาลออกได้หมด */
    levels: [
      { name: 'Batch 4 + Continuous 2 · รางเย็น 18 ชม.', cost: 0,          cap: 4000,  ptyFM: 37.5 },
      { name: 'Batch 6 + Continuous 3 · รางเย็น 24 ชม.', cost: 3_600_000,  cap: 5500,  ptyFM: 36.2 },
      { name: 'ตะแกรง 0.04 mm + Vertical crystallizer', cost: 6_600_000, cap: 7000,  ptyFM: 35.0 },
      { name: 'Batch 8 + ล้างอัตโนมัติ · รางเย็น 36 ชม.', cost: 10_500_000, cap: 8500,  ptyFM: 34.0 },
      { name: 'Continuous 6 ชุด · รางเย็น 48 ชม.',      cost: 15_400_000, cap: 10000, ptyFM: 33.2 },
      { name: 'ครบชุด + ควบคุมอัตราเย็น 0.5 °C/ชม.',    cost: 21_500_000, cap: 12000, ptyFM: 32.5 },
    ],
  },
  {
    id: 'pack', no: 9, icon: '📦', name: 'บรรจุน้ำตาล', short: 'บรรจุ',
    kind: 'machine', group: 'process', maxStar: 5,
    role: 'อบแห้ง คัดขนาด บรรจุกระสอบ/บิ๊กแบ็ก จัดพาเลทเข้าคลัง',
    metric: 'กำลังบรรจุ (ตันน้ำตาล/วัน) · น้ำตาลหกหาย %',
    unit: 'sugar',   // cap เป็นตันน้ำตาล/วัน ไม่ใช่ตันอ้อย
    levels: [
      { name: 'บรรจุมือ กระสอบ 50 กก.',                cost: 0,          cap: 500,  loss: 1.20 },
      { name: 'เครื่องบรรจุกึ่งอัตโนมัติ',              cost: 1_700_000,  cap: 700,  loss: 0.90 },
      { name: 'สายบรรจุอัตโนมัติ + เย็บถุง',            cost: 3_300_000,  cap: 900,  loss: 0.60 },
      { name: 'เพิ่มเครื่องอบ fluid-bed + คัดขนาด',      cost: 5_500_000, cap: 1100, loss: 0.40 },
      { name: 'หุ่นยนต์จัดพาเลท + Big bag',            cost: 8_300_000, cap: 1300, loss: 0.25 },
      { name: 'สายบรรจุคู่ + ห้องปลอดฝุ่น',             cost: 11_600_000, cap: 1550, loss: 0.12 },
    ],
  },

  /* ------------------ 10 คลังและส่งมอบ ------------------ */
  {
    id: 'wh', no: 10, icon: '🏬', name: 'โกดังสินค้าและส่งมอบ', short: 'คลัง',
    kind: 'support', group: 'process', maxStar: 5,
    role: 'เก็บน้ำตาล จัด FIFO โหลดรถ/ตู้คอนเทนเนอร์ ส่งมอบลูกค้า',
    metric: 'ความจุคลัง (ตัน) · กำลังส่งมอบ (ตัน/วัน)',
    levels: [
      { name: 'โกดัง 3,000 ตัน · รถ 25 คัน/วัน',        cost: 0,          whCap: 3000,  ship: 700 },
      { name: 'โกดัง 5,000 ตัน · รถ 35 คัน/วัน',        cost: 1_700_000,  whCap: 5000,  ship: 1000 },
      { name: 'โกดัง 8,000 ตัน + WMS บาร์โค้ด',         cost: 3_600_000,  whCap: 8000,  ship: 1400 },
      { name: 'โกดัง 12,000 ตัน + ท่าโหลด 4 ช่อง',      cost: 6_100_000, whCap: 12000, ship: 1800 },
      { name: 'ไซโล 17,000 ตัน + สายพานโหลด',          cost: 9_400_000, whCap: 17000, ship: 2300 },
      { name: 'ไซโล 24,000 ตัน + ลานตู้คอนเทนเนอร์',     cost: 13_800_000, whCap: 24000, ship: 3000 },
    ],
  },

  /* ------------------ ถังกากน้ำตาล (ที่เก็บ อัปเกรดแยก) ------------------ */
  {
    id: 'molasses', no: 0, icon: '🛢️', name: 'ถังเก็บกากน้ำตาล', short: 'ถังโมลาส',
    kind: 'support', group: 'process', maxStar: 5,
    role: 'เก็บกากน้ำตาลจากหม้อปั่นไว้รอขาย · ถังใหญ่เก็บได้มาก รอขายตอนราคาดี',
    metric: 'ความจุถัง (ตัน)',
    chain: 'ถังเต็ม = ปั่น C ระบายกากไม่ได้ กำลังหม้อปั่นเหลือ 35% · ต้องรีบขายหรือขยายถัง',
    /* molCap = ความจุถัง (ตัน) */
    levels: [
      { name: 'ถัง 2 ใบ 2,700 ตัน',      cost: 0,          molCap: 2700 },
      { name: 'ถัง 3 ใบ 4,500 ตัน',      cost: 1_200_000,  molCap: 4500 },
      { name: 'ถัง 4 ใบ 7,000 ตัน',      cost: 2_400_000,  molCap: 7000 },
      { name: 'ถัง 5 ใบ 10,000 ตัน',     cost: 4_200_000,  molCap: 10000 },
      { name: 'ถังใหญ่ 14,000 ตัน',      cost: 6_600_000,  molCap: 14000 },
      { name: 'ฟาร์มถัง 19,000 ตัน',     cost: 9_500_000,  molCap: 19000 },
    ],
  },

  /* ------------------ 11-12 พลังงาน ------------------ */
  {
    id: 'boiler', no: 11, icon: '🔥', name: 'หม้อไอน้ำ', short: 'หม้อไอน้ำ',
    kind: 'machine', group: 'energy', maxStar: 5, fireRisk: 1.0,
    role: 'เผาชานอ้อยผลิตไอน้ำป้อนกระบวนการผลิตและป้อนกังหันของทีมผลิตไฟฟ้า',
    metric: 'ไอน้ำ (ตัน/ชม.) · ประสิทธิภาพหม้อ',
    chain: 'ไอน้ำไม่พอ = ทั้งโรงงานช้าลงทันที (หม้อต้มระเหยและหม้อเคี่ยวต้องใช้ไอ) และกังหันไม่มีไอไปปั่นไฟ',
    unit: 'steam',   // cap เป็น "ตันอ้อย/วัน ที่ไอน้ำเลี้ยงไหว" (process ใช้ไอ ~0.50 ตัน/ตันอ้อย)
    levels: [
      { name: '21 bar ไม่มี economizer',              cost: 0,          steam: 90,  cap: 4320,  eff: 0.60 },
      { name: '21 bar + economizer',                 cost: 3_300_000,  steam: 120, cap: 5760,  eff: 0.65 },
      { name: '45 bar + air preheater',              cost: 7_200_000,  steam: 150, cap: 7200,  eff: 0.69 },
      { name: '45 bar + ควบคุมอัตโนมัติ',              cost: 11_600_000, steam: 185, cap: 8880,  eff: 0.73 },
      { name: '67 bar + ESP ดักฝุ่น',                  cost: 17_100_000, steam: 220, cap: 10560, eff: 0.76 },
      { name: '67 bar + bagasse dryer + CEMS',        cost: 23_700_000, steam: 260, cap: 12480, eff: 0.79, moist: -4 },
    ],
  },
  {
    id: 'power', no: 12, icon: '⚡', name: 'ผลิตไฟฟ้า', short: 'โรงไฟฟ้า',
    kind: 'machine', group: 'energy', maxStar: 5, fireRisk: 0.6,
    role: 'กังหันไอน้ำ-เครื่องกำเนิดไฟฟ้า จ่ายไฟให้โรงงานใช้เอง ที่เหลือขายเข้าระบบ',
    metric: 'ไฟที่ปั่นได้ (kWh/ตันไอ) · ไฟที่โรงงานใช้เอง (kWh/ตันอ้อย)',
    chain: 'ปั่นไฟไม่พอใช้เอง = ต้องซื้อไฟจากการไฟฟ้าแพงกว่าราคาขาย · ปั่นได้เหลือ = ขายเป็นรายได้ที่สอง',
    unit: 'power',
    /* kwh = ไฟที่ปั่นได้ต่อตันไอน้ำ · aux = ไฟที่โรงงานใช้เองต่อตันอ้อย (เกณฑ์จริง 28-35 kWh/tc) */
    levels: [
      { name: 'Back-pressure 21 bar · มอเตอร์เก่า',    cost: 0,          kwh: 55,  aux: 35 },
      { name: 'Back-pressure 45 bar',                cost: 3_900_000,  kwh: 78,  aux: 33 },
      { name: 'Condensing-extraction 45 bar',        cost: 7_700_000,  kwh: 98,  aux: 31 },
      { name: 'CE 67 bar + เปลี่ยนเป็นมอเตอร์ VFD',    cost: 12_100_000, kwh: 118, aux: 29 },
      { name: 'CE 67 bar + ระบบขายไฟ SPP',            cost: 17_600_000, kwh: 135, aux: 26 },
      { name: 'CE 2 ชุด + ควบคุมโหลดอัตโนมัติ',        cost: 24_200_000, kwh: 152, aux: 24 },
    ],
  },

  /* ------------------ 13-18 ทีมสนับสนุน ------------------ */
  {
    id: 'maint', no: 13, icon: '🛠️', name: 'ทีมซ่อมบำรุง', short: 'ซ่อมบำรุง',
    kind: 'support', group: 'support', maxStar: 5,
    role: 'ซ่อมเครื่องจักร ประเมินว่าควรหยุดล้างเครื่องเมื่อไร ฟื้นค่าพลังเครื่องจักร',
    metric: 'เวลาซ่อม −20%/ดาว · ค่าพลังที่ฟื้นได้ต่อการล้างเครื่อง 1 วัน',
    /* rep = ตัวคูณเวลาซ่อม · restore = ค่าพลังที่ฟื้นได้ (%) ต่อวันล้างเครื่อง · wear = ตัวคูณการสึกหรอ */
    levels: [
      { name: 'ซ่อมเมื่อเสีย (Breakdown)',             cost: 0,          rep: 1.00, restore: 55,  wear: 1.00 },
      { name: 'บำรุงรักษาตามแผน (Preventive)',         cost: 2_200_000,  rep: 0.80, restore: 65,  wear: 0.88 },
      { name: 'ตรวจสภาพด้วยการสั่นสะเทือน',            cost: 4_400_000,  rep: 0.60, restore: 75,  wear: 0.77 },
      { name: 'ทีมช่างกะกลางคืน + อะไหล่สำรองครบ',      cost: 7_200_000, rep: 0.40, restore: 85,  wear: 0.66 },
      { name: 'RCM + วิเคราะห์น้ำมันหล่อลื่น',           cost: 10_500_000, rep: 0.20, restore: 93,  wear: 0.56 },
      { name: 'Predictive Maintenance (AI + IoT)',    cost: 14_900_000, rep: 0.10, restore: 100, wear: 0.46 },
    ],
  },
  {
    id: 'sales', no: 14, icon: '💼', name: 'ทีมการขายและการตลาด', short: 'ขาย/ตลาด',
    kind: 'support', group: 'support', maxStar: 5,
    role: 'หาลูกค้า ทำสัญญา ดูแลความสัมพันธ์ ต่อรองราคา',
    metric: 'ราคาขาย · จำนวนออร์เดอร์ที่เข้ามา',
    levels: [
      { name: 'ขายผ่านคนกลางรายเดียว',                cost: 0,          price: 1.00, order: 1.0 },
      { name: 'พนักงานขาย 3 คน',                      cost: 1_900_000,  price: 1.04, order: 1.3 },
      { name: 'ทีมขาย + ออกงานแสดงสินค้า',             cost: 3_900_000,  price: 1.08, order: 1.6 },
      { name: 'สัญญาระยะยาวกับโรงงานอาหาร',            cost: 6_600_000, price: 1.12, order: 2.0 },
      { name: 'ตัวแทนส่งออก + แบรนด์ของโรงงาน',        cost: 9_900_000, price: 1.16, order: 2.4 },
      { name: 'เทรดเดอร์ต่างประเทศ + ป้องกันความเสี่ยงราคา', cost: 14_300_000, price: 1.20, order: 3.0 },
    ],
  },
  {
    id: 'ert', no: 15, icon: '🚨', name: 'ทีมตอบสนองเหตุฉุกเฉิน', short: 'ฉุกเฉิน',
    kind: 'support', group: 'support', maxStar: 3,
    role: 'ดับเพลิง · อุบัติเหตุจากการทำงาน · บ่อบำบัดล้น/น้ำเสียเกินค่า',
    metric: 'เวลาแก้ไข · ค่าใช้จ่ายเมื่อเกิดเหตุ · โอกาสเกิดเหตุ',
    /* time = ตัวคูณเวลาแก้ไข · cost = ตัวคูณค่าเสียหาย · prob = ตัวคูณโอกาสเกิด */
    levels: [
      { name: 'ไม่มีทีม (เรียกหน่วยงานภายนอก)',         cost: 0,          time: 1.00, cost_: 1.00, prob: 1.00 },
      { name: 'ทีมดับเพลิงอาสา 8 คน + จป.วิชาชีพ',       cost: 3_300_000,  time: 0.70, cost_: 0.75, prob: 0.82 },
      { name: 'รถดับเพลิง + ห้องพยาบาล + รถพยาบาล',      cost: 7_500_000,  time: 0.48, cost_: 0.55, prob: 0.64 },
      { name: 'ศูนย์ฉุกเฉิน 24 ชม. + ดับเพลิงอัตโนมัติ',   cost: 13_000_000, time: 0.28, cost_: 0.36, prob: 0.46 },
    ],
  },
  {
    id: 'hr', no: 16, icon: '🧑‍💼', name: 'ทีมทรัพยากรบุคคล', short: 'ทรัพยากรบุคคล',
    kind: 'support', group: 'support', maxStar: 3,
    role: 'ดูแล OT ค่าจ้าง สวัสดิการ ที่พัก และขวัญกำลังใจพนักงาน',
    metric: 'ขวัญกำลังใจ · เพดาน OT · ค่าจ้างต่อวัน',
    /* morale = ขวัญที่ฟื้นต่อวัน · ot = เพดานเร่งงานที่พนักงานรับได้ · wage = ค่าจ้าง/วัน · eff = ประสิทธิภาพคน */
    levels: [
      { name: 'จ้างรายวัน ไม่มีสวัสดิการ',              cost: 0,          morale: 1.0, ot: 0.10, wage: 420_000,   eff: 1.00 },
      { name: 'ประกันสังคม + ที่พักคนงาน',              cost: 2_800_000,  morale: 2.2, ot: 0.25, wage: 700_000,   eff: 1.05 },
      { name: 'โบนัสตามผลงาน + รถรับส่ง + คลินิก',      cost: 6_100_000, morale: 3.4, ot: 0.40, wage: 1_050_000, eff: 1.10 },
      { name: 'สวัสดิการเต็มรูปแบบ + พัฒนาทักษะ',        cost: 10_500_000, morale: 4.8, ot: 0.55, wage: 1_500_000, eff: 1.16 },
    ],
  },
  {
    id: 'qc', no: 17, icon: '🔬', name: 'ทีมคุณภาพ', short: 'คุณภาพ',
    kind: 'support', group: 'support', maxStar: 3,
    role: 'ควบคุมคุณภาพน้ำตาล หาใบรับรอง แก้ข้อร้องเรียนลูกค้า แนะนำเมื่อคุณภาพตก',
    metric: 'สี ICUMSA · ราคาพรีเมียม · ความเร็วในการปิดข้อร้องเรียน',
    /* color = ปรับสี ICUMSA · prem = พรีเมียมราคา · fix = ตัวคูณเวลาปิดข้อร้องเรียน · advice = ให้คำแนะนำ */
    levels: [
      { name: 'ห้องแล็บพื้นฐาน · ตรวจ Pol/Brix',        cost: 0,          color: 0,    prem: 1.00, fix: 1.00, advice: 0 },
      { name: 'เพิ่มเครื่องวัดสี + ควบคุม pH ต่อเนื่อง',   cost: 2_500_000,  color: -150, prem: 1.03, fix: 0.75, advice: 1 },
      { name: 'ISO 9001 + GMP/HACCP',                  cost: 5_500_000, color: -300, prem: 1.07, fix: 0.55, advice: 2 },
      { name: 'ISO/IEC 17025 + FSSC 22000',            cost: 9_400_000, color: -450, prem: 1.11, fix: 0.35, advice: 3 },
    ],
  },
  {
    id: 'wwt', no: 18, icon: '🌊', name: 'ทีมบ่อบำบัด', short: 'บ่อบำบัด',
    kind: 'support', group: 'support', maxStar: 5,
    role: 'ควบคุมปริมาณและคุณภาพน้ำทิ้ง ไม่ให้ล้นบ่อหรือ BOD เกินมาตรฐาน',
    metric: 'ความจุบ่อ (m³) · อัตราบำบัด (m³/วัน) · BOD น้ำทิ้ง',
    /* pond = ความจุ m³ · rate = บำบัด m³/วัน · bod = BOD น้ำทิ้ง mg/L (มาตรฐานไทย ≤ 20) */
    levels: [
      { name: 'บ่อผึ่ง 3 บ่อ 6,000 m³',                cost: 0,          pond: 6000,  rate: 1300,  bod: 60 },
      { name: 'เพิ่มเครื่องเติมอากาศผิวน้ำ',             cost: 1_700_000,  pond: 9000,  rate: 2400,  bod: 42 },
      { name: 'บ่อไร้อากาศ + บ่อเติมอากาศ',             cost: 3_600_000,  pond: 13000, rate: 3400,  bod: 30 },
      { name: 'UASB + ผลิตก๊าซชีวภาพ',                 cost: 6_100_000, pond: 18000, rate: 4600,  bod: 22 },
      { name: 'UASB + Activated sludge',              cost: 8_800_000, pond: 24000, rate: 6000,  bod: 15 },
      { name: 'ครบวงจร + นำน้ำกลับใช้ (near ZLD)',      cost: 12_700_000, pond: 32000, rate: 7600,  bod: 8 },
    ],
  },
];

const DEPT_BY_ID = Object.fromEntries(DEPTS.map(d => [d.id, d]));
const MACHINE_IDS = DEPTS.filter(d => d.kind === 'machine').map(d => d.id);
const SUPPLY_IDS = DEPTS.filter(d => d.kind === 'supply').map(d => d.id);
/* สายการผลิตหลัก เรียงตามลำดับการไหลของน้ำอ้อย */
const LINE_IDS = ['mill', 'clar', 'evap', 'pan', 'fugal', 'pack'];

const DEPT_GROUPS = {
  cane: { name: '🌾 สายวัตถุดิบ (ทีม 1-3)', tip: 'หาอ้อย → ตัดและขน → ลานอ้อย · ต้องสมดุลกัน ไม่งั้นอ้อยเสื่อมหรือหลุดมือ' },
  process: { name: '🏭 สายการผลิต (ทีม 4-10)', tip: 'ลูกหีบ → ทำใส → หม้อต้ม → หม้อเคี่ยว → หม้อปั่น → บรรจุ → คลัง' },
  energy: { name: '⚡ พลังงาน (ทีม 11-12)', tip: 'ชานอ้อย → ไอน้ำ → ไฟฟ้า · ไอไม่พอทั้งโรงงานช้าลง' },
  support: { name: '🤝 ทีมสนับสนุน (ทีม 13-18)', tip: 'ซ่อมบำรุง ขาย ฉุกเฉิน บุคคล คุณภาพ บ่อบำบัด' },
};

/* =====================================================================
   ตัวช่วยอ่านค่า
   ===================================================================== */
function dept(id) { return DEPT_BY_ID[id]; }
function dStar(s, id) { return (s.dept[id] && s.dept[id].star) || 0; }
function dLv(s, id) { const d = dept(id); return d.levels[Math.min(dStar(s, id), d.levels.length - 1)]; }
/* ค่าพารามิเตอร์ของแผนกตามดาวปัจจุบัน */
function dv(s, id, key) { const L = dLv(s, id); return L ? L[key] : undefined; }
function dMaxStar(id) { return dept(id).maxStar; }
function dNextCost(s, id) {
  const d = dept(id), st = dStar(s, id);
  return st >= d.maxStar ? null : d.levels[st + 1].cost;
}
function dOver(s, id) { const o = (s.dept[id] && s.dept[id].od) || 0; return OVERDRIVE[Math.min(o, OVERDRIVE.length - 1)]; }
function dPower(s, id) { const x = s.dept[id]; return x && x.power !== undefined ? x.power : 100; }

/* ประสิทธิภาพจากค่าพลัง: 100% → 1.00 · 50% → 0.725 · 0% → เครื่องพัง */
function powerEff(p) { return 0.45 + 0.55 * Math.max(0, Math.min(100, p)) / 100; }

/* กำลังผลิตจริงของแผนก (ตัน/วัน) = ฐานตามดาว × เร่งเครื่อง × ค่าพลัง */
function dCap(s, id) {
  const x = s.dept[id];
  if (!x) return 0;
  const d = dept(id);
  if (x.downH > 0) return 0;
  const base = dv(s, id, 'cap') || 0;
  if (d.kind !== 'machine') return base;
  return base * dOver(s, id).v * powerEff(x.power);
}

/* ค่าพลังที่ลดต่อชั่วโมง */
function drainPerHour(s, id) {
  const st = dStar(s, id);
  const od = dOver(s, id).v;
  const wearMult = dv(s, 'maint', 'wear');
  return POWER_DRAIN[Math.min(st, POWER_DRAIN.length - 1)] * Math.pow(od, 3) * wearMult;
}

/* เวลาซ่อมเมื่อค่าพลังถึง 0 (ชั่วโมง) — อย่างน้อย 1 วัน ลด 20% ต่อดาวทีมซ่อมบำรุง */
function repairHours(s) {
  return Math.max(2.4, 24 * dv(s, 'maint', 'rep'));
}

/* ระดับการเร่งเครื่องรวมทั้งโรงงาน (0 = ไม่เร่งเลย) ใช้คิดขวัญกำลังใจและความเสี่ยง */
function overdriveLoad(s) {
  let sum = 0;
  for (const id of MACHINE_IDS) sum += Math.max(0, dOver(s, id).v - 1);
  return sum;   // 0 .. 4.0 (8 เครื่อง × 0.5)
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    DEPTS, DEPT_BY_ID, DEPT_GROUPS, MACHINE_IDS, SUPPLY_IDS, LINE_IDS, OVERDRIVE, POWER_DRAIN, ECON,
    dept, dStar, dLv, dv, dMaxStar, dNextCost, dOver, dPower, powerEff, dCap, drainPerHour, repairHours, overdriveLoad,
  });
}
