'use strict';
/* =====================================================================
   i18n — สลับภาษา ไทย/English
   ใช้ dictionary แปลจากข้อความไทย (คีย์) → อังกฤษ · TR(s) แปลตามภาษาที่เลือก
   Phase 1: เมนู · ชื่อ 18 แผนก · ป้าย HUD · ชื่อมิติคะแนน · ปุ่มหลัก · หน้าแรก
   ===================================================================== */
let LANG = 'th';
try { LANG = (lsGet('sfm_lang') === 'en') ? 'en' : 'th'; } catch (e) {}

function setLang(l) { LANG = (l === 'en') ? 'en' : 'th'; try { lsSet('sfm_lang', LANG); } catch (e) {} }

/* แปลข้อความไทย 1 คำ/วลี → อังกฤษ (ถ้าไม่มีในดิกก็คืนไทยเดิม) */
function TR(s) { return (LANG === 'en' && DICT_EN[s]) ? DICT_EN[s] : s; }

const DICT_EN = {
  /* --- เมนูนำทางหน้าแรก --- */
  '🏠 หน้าแรก': '🏠 Home', '📖 วิธีเล่น': '📖 How to Play', '🏭 18 แผนก': '🏭 18 Depts',
  '🏅 การวัดผล': '🏅 Scoring', '🏆 จัดอันดับ': '🏆 Ranking', '⚙️ ตั้งค่า': '⚙️ Settings',

  /* --- ป้าย HUD --- */
  'ลูกค้า': 'Customers', 'พนักงาน': 'Staff', 'ชาวไร่': 'Growers', 'ความปลอดภัย': 'Safety',
  'เงินสด': 'Cash', 'น้ำตาลวันนี้': "Today's Sugar", 'ไฟฟ้า': 'Power',

  /* --- ชื่อ 8 มิติคะแนน --- */
  'กำไร': 'Profit', 'ประสิทธิภาพโรงงาน': 'Factory Efficiency', 'คุณภาพการผลิตน้ำตาล': 'Sugar Production Quality',
  'คุณภาพอ้อย/ชาวไร่': 'Cane Quality / Growers', 'ความพึงพอใจลูกค้า': 'Customer Satisfaction',
  'ความพึงพอใจพนักงาน': 'Staff Satisfaction', 'ข้อร้องเรียน': 'Complaints',

  /* --- ชื่อ 18 แผนก (name) --- */
  'ทีมส่งเสริมหาอ้อย': 'Cane Promotion Team', 'ทีมเก็บเกี่ยวและขนส่งอ้อย': 'Harvest & Transport Team',
  'ทีมลานอ้อย': 'Cane Yard Team', 'ลูกหีบ': 'Milling', 'ทำใส': 'Clarification',
  'หม้อต้มระเหย': 'Evaporator', 'หม้อเคี่ยว': 'Vacuum Pan', 'หม้อปั่นแยกน้ำตาล': 'Centrifugal',
  'บรรจุน้ำตาล': 'Packing', 'โกดังสินค้าและส่งมอบ': 'Warehouse & Dispatch', 'ถังเก็บกากน้ำตาล': 'Molasses Tank',
  'หม้อไอน้ำ': 'Boiler', 'ผลิตไฟฟ้า': 'Power Generation', 'ทีมซ่อมบำรุง': 'Maintenance Team',
  'ทีมการขายและการตลาด': 'Sales & Marketing Team', 'ทีมความปลอดภัย & ฉุกเฉิน (จป.)': 'Safety & Emergency Team (SO)',
  'ทีมทรัพยากรบุคคล': 'Human Resources Team', 'ทีมคุณภาพ': 'Quality Team', 'ทีมบ่อบำบัด': 'Wastewater Team',

  /* --- short --- */
  'ส่งเสริม': 'Promotion', 'เก็บเกี่ยว': 'Harvest', 'ลานอ้อย': 'Yard', 'หม้อต้ม': 'Evaporator',
  'หม้อปั่น': 'Centrifugal', 'บรรจุ': 'Packing', 'คลัง': 'Warehouse', 'ถังโมลาส': 'Molasses',
  'หม้อไอน้ำ': 'Boiler', 'โรงไฟฟ้า': 'Power', 'ซ่อมบำรุง': 'Maintenance', 'ขาย/ตลาด': 'Sales',
  'จป./ฉุกเฉิน': 'Safety/ER', 'ทรัพยากรบุคคล': 'HR', 'คุณภาพ': 'Quality', 'บ่อบำบัด': 'Wastewater',

  /* --- ปุ่ม/หน้าแรก --- */
  '🏭 เริ่มบริหารโรงงาน': '🏭 Start Managing', 'เริ่มบริหารโรงงาน': 'Start Managing',
  'เริ่มฤดูใหม่ (ล้างเกมเดิม)': 'New Season (clear save)', 'กลับหน้าแรก': 'Back to Home', 'เข้าใจแล้ว': 'Got it',
  'เริ่มหีบ': 'Start Crushing', 'หยุด': 'Pause', 'เดินต่อ': 'Resume',
  'ชื่อโรงงาน / ผู้จัดการ': 'Factory / Manager name', 'ชื่อโรงงาน': 'Factory name',

  /* --- ป้าย/คำทั่วไปในโมดัลเหตุการณ์-ฉุกเฉิน-แผนก --- */
  'เหตุฉุกเฉิน': 'Emergency', 'สาเหตุ': 'Cause', 'สถานการณ์': 'Situation', 'ผลกระทบ': 'Impact',
  'คำแนะนำ': 'Advice', 'ฟรี': 'Free', 'ชม.': 'h', 'ดาว': 'stars', 'ที่': 'at',
  'ใช้เวลา ~': 'takes ~', 'ต้องมี': 'requires ', 'อย่างน้อย': 'at least',
  'ทีมคุณภาพ (ทีม 17)': 'Quality Team (Dept 17)', 'ทีมตอบสนองเหตุฉุกเฉิน (ทีม 15)': 'Emergency Team (Dept 15)',
  'ทีมฉุกเฉิน': 'Emergency team', 'ทีมคุณภาพ': 'Quality team',
  'ต้องตัดสินใจภายใน': 'Decide within', 'ตัดสินใจภายใน': 'Decide within',
  '(เวลาในเกม) ไม่เช่นนั้นระบบจะเลือกทางที่แย่ที่สุด': '(game time), or the system picks the worst option',
  '(เวลาในเกม) ไม่เช่นนั้นระบบใช้': '(game time), otherwise the system uses',
  'รอตัดสินใจ อีก': 'awaiting decision, in', 'คลิกเพื่อเลือก': 'click to choose',
  'รอคำสั่งการ อีก': 'awaiting orders, in', 'คลิกเพื่อตัดสินใจ': 'click to decide',
  'กำลังแก้ไข': 'resolving', 'เหลือ': 'left',
  'ตัวชี้วัด': 'Metric', 'อุปกรณ์/ทีม': 'Equipment / team', 'ดาวถัดไป': 'Next star',
  'ภารกิจวันนี้': "Today's Tasks", 'ตัน/วัน': 't/day', 'อัปเกรด': 'Upgrade ',
};
