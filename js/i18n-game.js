'use strict';
/* In-game strings: factory-map station markers, prep brief, toasts (main.js) */
Object.assign(DICT_EN, {
  /* --- station marker sub-status & tips --- */
  "หาอ้อย": "Sourcing", "ต/ว": "t/d", "เชื่อมั่น": "Trust",
  "อ้อยรอตัดในไร่": "Standing cane", "เสียให้โรงอื่นแล้ว": "Lost to rivals",
  "ตัด+ขน": "Cut+haul", "ตัด-ถึง-หีบพื้นฐาน": "Base cut-to-crush",
  "อ้อย": "Cane", "คิว": "Queue", "ลาน": "Yard", "เก่าสุด": "Oldest",
  "รถหนีคิวแล้ว": "Trucks left queue", "ต/ชม.": "t/h", "ตะกรัน": "Scale",
  "ระเหยน้ำวันนี้": "Water evap. today", "คอขวด": "bottleneck", "น้ำตาล": "Sugar",
  "บรรจุ": "Packed", "ต": "t", "รอ": "Waiting", "กำลังบรรจุ": "Packing",
  "ตันน้ำตาล/วัน": "t sugar/day", "หกหาย": "Spill", "คลัง": "Store", "รอส่ง": "to ship",
  "โควตาโหลดรถวันนี้เหลือ": "Truck-load quota left today",
  "ไอน้ำไม่พอ!": "Steam short!", "ไอ": "Steam", "ชานอ้อย": "Bagasse",
  "มีความเสี่ยงไฟไหม้": "fire risk", "ขายไฟ": "Export", "รายได้ไฟวันนี้": "Power revenue today",
  "คลิกเพื่อขายกากน้ำตาล": "Click to sell molasses", "พลังต่ำสุด": "Min condition", "ล้าง": "Clean",
  "ออร์เดอร์ใหม่": "New orders", "เหตุ": "Incidents", "ขวัญ": "Morale",
  "พบปัญหา": "Issue found", "บ่อ": "Pond",
});

/* --- factory-map building names (scene.js) --- */
Object.assign(DICT_EN, {
  "ส่งเสริมหาอ้อย": "Cane Sourcing", "คลังและส่งมอบ": "Warehouse & Dispatch", "ขาย/การตลาด": "Sales / Marketing",
});

/* --- prep brief (main.js showPrepBrief) --- */
Object.assign(DICT_EN, {
  "ก่อนเปิดหีบ": "Before Crushing Starts",
  "วันหีบยังไม่เดิน คุณมีเวลาเตรียมตัวเต็มที่ — ลงทุนแผนกที่ต้องการ ตั้งค่ากระบวนการ แล้วค่อยกด": "The crush hasn't started — take all the time you need to prepare: invest in departments, tune the process, then press",
  "กำลังของสายวัตถุดิบตอนนี้": "Current feedstock-line capacity",
  "ทั้งสี่ควรใกล้เคียงกัน — ตอนนี้ทุกแผนกอยู่ที่ 0 ดาว (1,000 ตัน/วัน) ซึ่งน้อยมาก": "All four should be close — right now every department is at 0 stars (1,000 t/day), which is very low",
  "เงินและกำหนดจ่าย": "Cash & Payment Schedule", "เงินสดตั้งต้น": "Starting cash",
  "ค่าอ้อย": "Cane payment", "ทุก": "every", "ค่าจ้างพนักงาน": "Wages",
  "เงินสดติดลบไม่ได้ — ขาดเมื่อไรจะกู้อัตโนมัติ ดอกเบี้ยเพิ่มตามยอดหนี้": "Cash can't go negative — if you run short the system auto-borrows; interest rises with the debt",
  "เริ่มปรับปรุงโรงงาน": "Start improving the factory", "ไปหน้าอัปเกรดแผนก": "Go to department upgrades",
  /* --- toasts --- */
  "เบราว์เซอร์ไม่อนุญาตเต็มจอ ลองกด F11": "Browser blocked fullscreen — try pressing F11",
  "ยินดีต้อนรับ ผู้จัดการ": "Welcome, Manager", "🧊 มุมมอง 3D": "🧊 3D view", "🗺️ มุมมอง 2D": "🗺️ 2D view",
  "เปิดหีบแล้ว! เวลาเริ่มเดิน": "Crushing started! The clock is running",
  "กำลังหยุดล้างเครื่องอยู่": "Cleaning shutdown in progress", "บันทึกแล้ว": "Saved",
  "ตัดสินใจเหตุการณ์ก่อน แล้วเวลาจะเดินต่อ": "Resolve the event first, then time resumes",
  "ตั้งค่าชุด": "Applied preset", "เน้นคุณภาพ": "Quality-focused", "สมดุล": "Balanced", "เน้นปริมาณ": "Throughput-focused",
});

/* --- confirm dialogs (main.js showConfirm) --- */
Object.assign(DICT_EN, {
  "⚠️ ยืนยัน": "⚠️ Confirm", "ตกลง": "OK", "ยกเลิก": "Cancel",
  "🆕 เริ่มฤดูใหม่": "🆕 New Season",
  "เริ่มฤดูใหม่? เกมที่ค้างอยู่จะถูกล้าง": "Start a new season? Your current game will be cleared.",
  "เริ่มฤดูใหม่? ข้อมูลเดิมจะหายไป": "Start a new season? Existing data will be lost.",
  "🧽 หยุดล้างเครื่อง 1 วัน": "🧽 Cleaning Shutdown — 1 Day",
  "หยุดล้างเครื่อง 1 วัน?": "Stop for a 1-day cleaning shutdown?", "เหลือโควตา": "quota left", "ค่าใช้จ่าย": "cost",
  "ใช้โควตาวันล้างเครื่องหมดแล้ว — หยุดเพิ่มจะกินวันหีบ ยืนยันหรือไม่?": "Cleaning-day quota is used up — stopping again eats into crush days. Confirm?",
});
