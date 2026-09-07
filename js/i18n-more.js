'use strict';
/* Remaining drawer/panel headers & labels (caught by translateDOM) */
Object.assign(DICT_EN, {
  "🗓️ ฤดูกาล": "🗓️ Season", "วันที่": "Day", "วันหีบ": "Crush day", "วันล้างเครื่อง": "Cleaning day",
  "อ้อยหีบ": "Cane crushed", "ตัน": "t", "น้ำอ้อย MJ": "Mixed juice (MJ)", "น้ำใส": "Clear juice",
  "น้ำเชื่อม": "Syrup", "ผลผลิตน้ำตาล": "Sugar yield",
  "🎯 เป้าหมายฤดูกาล (🔥 โหมดยาก)": "🎯 Season Goals (🔥 Hard mode)",
  "🔎 คอขวดของทั้งโรงงาน (ตันอ้อย/วัน)": "🔎 Factory-wide Bottleneck (t cane/day)",
  "คอขวดตอนนี้คือ": "The current bottleneck is", "เงินสด (฿)": "Cash (฿)", "คำแนะนำเร่งด่วน": "Urgent advice",
  "🔗 สมดุลสายวัตถุดิบ": "🔗 Feedstock-line balance", "⚙️ ลูกหีบ": "⚙️ Milling", "ค่าพลังเครื่องจักร": "Machine condition",
  "แผงควบคุม →": "Control panel →", "🧪 ทำใส": "🧪 Clarification", "♨️ หม้อต้มระเหย": "♨️ Evaporator",
  "🍯 หม้อเคี่ยว": "🍯 Vacuum Pan", "🌀 หม้อปั่นแยกน้ำตาล": "🌀 Centrifugal", "📦 บรรจุน้ำตาล": "📦 Packing",
  "🔥 หม้อไอน้ำ": "🔥 Boiler", "⚡ ผลิตไฟฟ้า": "⚡ Power Generation", "🏬 คลังและการขาย": "🏬 Warehouse & Sales",
  "ขายทั้งหมด": "Sell all",
  "ส่งมอบออร์เดอร์และการขายสปอตใช้โควตาโหลดรถร่วมกัน — โควตาไม่พอคือสาเหตุ “ส่งสินค้าไม่ทัน”": "Order deliveries and spot sales share the truck-loading quota — insufficient quota is why deliveries run late",
  "🛢️ ถังกากน้ำตาล": "🛢️ Molasses Tank", "ขาย": "Sell", "วันนี้": "Today", "สะสม": "Cumulative", "เป้า": "Target",
  "อ้อย (Cane)": "Cane", "โรงหีบ (Milling House)": "Milling House",
  "สมดุลและการนำกลับ (Balance & Recovery)": "Balance & Recovery",
  "Pol อ้อย (ตัน)": "Cane Pol (t)", "Pol น้ำตาล (ตัน)": "Sugar Pol (t)",
  "สูญเสียใน filter cake %": "Loss in filter cake %", "สูญเสียในโมลาสสุดท้าย %": "Loss in final molasses %",
  "ไอน้ำและไฟฟ้า (Steam & Power)": "Steam & Power", "ไฟฟ้าขาย (kWh/ตันอ้อย)": "Power sold (kWh/t cane)",
  "บัญชีเวลา (Time Account)": "Time Account", "KPI เทียบเกณฑ์โลก": "KPI vs world benchmarks",
  "ค่าปัจจุบัน": "Current value", "kWh/ตันอ้อย": "kWh/t cane",
  "🟩 ระดับโลก · 🟨 ตามเกณฑ์ · 🟧 พอใช้ · 🟥 ต่ำกว่าเกณฑ์": "🟩 World-class · 🟨 On target · 🟧 Fair · 🟥 Below target",
  "สมดุล Pol (ตรวจว่าปิดหรือไม่)": "Pol balance (check if it closes)", "ประวัติ": "History",
  "🏦 เงินกู้": "🏦 Loans", "🏦 กู้เงินจากธนาคาร": "🏦 Borrow from bank", "งบวันล่าสุด": "Latest-day statement",
  "กำไร/วัน (฿)": "Profit/day (฿)", "ราคาน้ำตาล (฿/ตัน)": "Sugar price (฿/t)",
  "🧑‍💼 วินิจฉัยจาก KPI": "🧑‍💼 KPI Diagnosis", "📜 บันทึกเหตุการณ์": "📜 Event Log", "🔔 เหตุการณ์ล่าสุด": "🔔 Recent Events",
  "ยังไม่มีเหตุการณ์ — กดปุ่ม ▶ เริ่มหีบ เพื่อเดินเครื่อง": "No events yet — press ▶ Start Crushing to run the mill",
  "กก./ตัน": "kg/t", "เครื่องเสีย": "Breakdowns", "ครั้ง": "times", "ชื่อเสียง": "Reputation",
  "อัปเกรดที่ติดตั้ง": "Installed upgrades", "ยังไม่ได้ลงทุนแผนกใด ๆ": "No departments invested in yet",
  "💾 ส่งออกเซฟ (JSON)": "💾 Export save (JSON)", "เปิดแผง →": "Open panel →",
  "📊 ความสามารถตอนนี้": "📊 Current Capabilities", "🔬 คุณภาพน้ำตาล": "🔬 Sugar Quality",
  "🦺 ความปลอดภัย & ความพร้อมรับเหตุ (จป.)": "🦺 Safety & Emergency Readiness (SO)",
  "🌊 บ่อบำบัดน้ำเสีย": "🌊 Wastewater Treatment Pond", "⏫ เร่งอัตรากำลัง": "⏫ Overdrive",
  "🏅 ผลการบริหาร 8 ด้าน": "🏅 Management Results (8 areas)", "อัปเกรดครบทุกดาวแล้ว": "All stars upgraded",
});

/* --- SVG factory illustration labels (fx.js) --- */
Object.assign(DICT_EN, {
  "ส่งเสริมชาวไร่": "Grower Promotion", "เก็บเกี่ยว-ขนส่ง": "Harvest & Haul", "ชั่งน้ำหนัก": "Weighbridge",
  "หม้อเคี่ยว A-B-C": "Pans A-B-C", "หม้อปั่นแยก": "Centrifugals", "รางเย็น C": "C-Crystallizer",
  "ถังกากน้ำตาล": "Molasses Tank", "คลังน้ำตาล": "Sugar Warehouse", "ฉุกเฉิน": "Emergency",
  "บุคคล": "HR", "ห้องแล็บ": "Lab", "สำนักงานขาย": "Sales Office",
  "โรงหีบ": "Mill House", "ทางเข้า": "Entrance", "โรงงานน้ำตาล": "Sugar Factory",
});

/* --- Splash card / sound / ranking panes (main.js) --- */
Object.assign(DICT_EN, {
  "เปิดฤดูกาลหีบ": "Season open", "เหลืออีก": "left", "วัน": "days",
  "ฤดูกาลใหม่ · 130 วัน · 18 แผนก · ทุน ฿50 ล้าน": "New season · 130 days · 18 depts · ฿50M capital",
  "ยินดีต้อนรับกลับ": "Welcome back", "สู่โรงงานของคุณ": "to your factory",
  "ลงชื่อเข้าโรงงาน": "Sign in to your factory", "บริหารในแบบของคุณ": "Manage it your way",
  "เข้าสู่ระบบเพื่อจัดการโรงงานน้ำตาล": "Sign in to manage your sugar factory",
  "ชื่อผู้จัดการโรงงาน": "Factory manager name", "เล่นต่อ": "Continue", "หรือ": "or",
  "📖 คู่มือการเล่น": "📖 Player Guide", "⚙️ ตั้งค่าเสียง": "⚙️ Sound Settings",
  "เริ่มต้นทุกแผนกที่ 0 ดาว · วันหีบยังไม่เดินจนกว่าจะกด “เริ่มหีบ” — ใช้เวลาปรับปรุงและเร่งเครื่องยิ่งขึ้นได้": "Every department starts at 0 stars · crushing days don't run until you press “Start Crushing” — take your time to improve and push machines harder",
  "ตั้งค่าเสียง": "Sound Settings", "เพลงประกอบ": "Music", "เปิด": "On", "ปิด": "Off",
  "ระดับเสียง": "Volume", "ขนาดตัวหนังสือ": "Text size", "ปกติ": "Normal", "ใหญ่": "Large", "ใหญ่มาก": "X-Large",
  "เพลงสร้างสดด้วย Web Audio ไม่มีไฟล์เสียง · เมื่อกดหยุดเวลาในเกม เสียงทั้งหมดจะเงียบสนิท": "Music is generated live with Web Audio — no sound files · pausing the in-game clock silences everything",
  "เสร็จสิ้น": "Done", "อันดับผู้จัดการโรงงาน": "Factory Manager Rankings",
  "อันดับจาก": "Ranked by", "คะแนนรวม (เต็ม 1,000)": "total score (out of 1,000)", "ตอนปิดฤดูกาล": "at season end",
  "🌐 กระดานส่วนกลาง — แข่งกับทุกคนที่เล่น": "🌐 Global board — compete with all players",
  "💾 บันทึกในเครื่องนี้": "💾 Saved on this device", "กำลังโหลด…": "Loading…",
});

/* --- misc static / HUD --- */
Object.assign(DICT_EN, {
  "กำลังประกอบโรงงานจากภาพ…": "Assembling factory from images…",
  "หีบ": "Crush", "🧽 ล้างเครื่อง": "🧽 Cleaning", "ยังไม่เปิดหีบ": "Not started",
  "ผู้จัดการ": "Manager", "รายการ": "items",
  "1 วันหีบ =": "1 crush day =", "หยุดอยู่": "paused", "นาที": "min", "วิ": "s",
});

/* --- Splash pane headers & score/dept row labels --- */
Object.assign(DICT_EN, {
  "คู่มือผู้จัดการโรงงาน": "Factory Manager Guide", "18 แผนกในโรงงาน": "The 18 Departments",
  "การวัดผล 8 ด้าน": "Scoring — 8 Areas", "เต็ม": "max", "น้ำหนัก": "weight", "แต้ม": "pts",
  "(ยิ่งน้อยยิ่งดี)": "(lower is better)",
});
