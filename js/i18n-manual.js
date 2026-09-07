'use strict';
/* Manual / tutorial / scoring block paragraphs — matched by translateBlocks (normalized innerHTML) */
Object.assign(DICT_BLOCK, {
  "1 · เป้าหมาย": "1 · Objective",
  "คุณมีเวลา <b>130 วัน</b> แบ่งเป็นวันหีบ 120 วัน และโควตาวันหยุดล้างเครื่อง 10 วัน (จะหยุดวันไหนก็ได้) ทุนตั้งต้น ฿50 ล้าน วัดผล 8 ด้าน: การบริหาร · กำไร · ประสิทธิภาพการผลิต · ความพึงพอใจลูกค้า · ความพึงพอใจพนักงาน · ความพึงพอใจชาวไร่ · ความปลอดภัย · ข้อร้องเรียน": "You have <b>130 days</b>: 120 crushing days plus a 10-day cleaning-shutdown quota (stop on any days you choose). Starting capital ฿50M. You are scored on 8 areas: Management · Profit · Production Efficiency · Customer Satisfaction · Staff Satisfaction · Grower Satisfaction · Safety · Complaints.",
  "2 · สายวัตถุดิบ ทีม 1-3 (สำคัญที่สุด)": "2 · The Feedstock Chain, Depts 1-3 (most important)",
  "ทีมส่งเสริม <b>หาอ้อย</b> → ทีมเก็บเกี่ยว <b>ตัดและขน</b> → ทีมลานอ้อย <b>รับเข้าลาน</b> → ลูกหีบ ทั้งสามต้องมีกำลังใกล้เคียงกัน มิฉะนั้น:": "Promotion team <b>sources cane</b> → Harvest team <b>cuts and hauls</b> → Yard team <b>receives into the yard</b> → Milling. All three must have balanced capacity, otherwise:",
  "ตัดไม่ทันที่หาไว้ → อ้อยส่วนเกินหลุดไปโรงงานอื่น ชาวไร่เสียความเชื่อมั่น": "Can't cut as fast as you source → surplus cane goes to rival mills and growers lose confidence",
  "ลานรับไม่ทัน → รถต่อคิว ชั่วโมงตัด-ถึง-หีบเพิ่ม <b>CCS ตกชั่วโมงละ 0.042 หน่วย</b> เกิน 24 ชม. เกิด dextran": "Yard can't keep up → trucks queue, cut-to-crush time rises, <b>CCS drops 0.042 units per hour</b>, and past 24 h dextran forms",
  "คิวเกิน 18 ชม. → รถหนีไปโรงงานอื่น": "Queue over 18 h → trucks defect to other mills",
  "ลูกหีบเร็วกว่าลาน → เดินเครื่องเปล่า เสีย Time Efficiency": "Milling faster than the yard → the mill runs empty, hurting Time Efficiency",
  "3 · ค่าพลังเครื่องจักร และการเร่งเครื่อง": "3 · Machine Condition and Overdrive",
  "เครื่องจักรทุกตัวเริ่มที่ <b>ค่าพลัง 100%</b> และลดลงทุกชั่วโมงที่เดินเครื่อง ยิ่งอัปเกรดดาวมาก ค่าพลังยิ่งลดช้า · ค่าพลังต่ำ = กำลังผลิตต่ำ · <b>ค่าพลัง 0 = พังทั้งกระบวนการ</b> ซ่อมอย่างน้อย 1 วัน (ลดลง 20% ต่อ 1 ดาวของทีมซ่อมบำรุง)": "Every machine starts at <b>100% condition</b> and drops each hour it runs. The more stars you upgrade, the slower it drops · low condition = low output · <b>0 condition = the whole process breaks down</b>, needing at least 1 day of repair (decay reduced 20% per Maintenance Team star).",
  "<b>เร่งเครื่อง</b> เพิ่มกำลังได้ทันทีโดยไม่ต้องลงทุน แต่ค่าพลังลดเร็วขึ้นแบบยกกำลังสาม (150% → เร็วขึ้น 3.4 เท่า) แถมพนักงานเหนื่อยและเสี่ยงอุบัติเหตุ": "<b>Overdrive</b> boosts output instantly with no investment, but condition decays faster on a cubic curve (150% → 3.4x faster), and it tires staff and raises accident risk.",
  "4 · เงินและการกู้": "4 · Cash and Loans",
  "เงินสด<b>ติดลบไม่ได้</b> — ขาดเมื่อไรระบบกู้ให้อัตโนมัติ ดอกเบี้ยฐาน 12%/ปี และ <b>+3% ทุกยอดกู้ 50 ล้าน</b> (ลงทุนด้วยเงินกู้ได้) · จ่ายค่าอ้อยทุก 7 วัน · ค่าจ้างพนักงานทุก 15 วัน · ค่าอ้อยขั้นสุดท้ายวันที่ 65 และ 130": "Cash <b>cannot go negative</b> — whenever you run short the system auto-borrows. Base rate 12%/yr, <b>+3% for every ฿50M borrowed</b> (you may invest with borrowed money) · cane paid every 7 days · wages every 15 days · final cane payment on days 65 and 130.",
  "5 · ปุ่มลัด": "5 · Shortcuts",
  "<code>Space</code> หยุด/เดินต่อ (หยุดแล้วเสียงเงียบสนิท) · <code>1-7</code> ความเร็ว 0.25x–5x · <code>M</code> เปิด/ปิดเพลง · <code>Esc</code> ปิดลิ้นชัก": "<code>Space</code> pause/resume (paused = fully silent) · <code>1-7</code> speed 0.25x–5x · <code>M</code> toggle music · <code>Esc</code> close drawer",
  "ตัวเลขทั้งหมดอ้างอิง Peter Rein “Cane Sugar Engineering”, benchmark โรงงานไทย/โลก และค่าจริงจากรายงานประจำวัน": "All figures reference Peter Rein's “Cane Sugar Engineering”, Thai/global mill benchmarks, and actual values from the daily report.",
  "โรงงานมี <b>18 แผนก</b> ที่ต้องบริหารและอัปเกรดเป็นดาว — สายวัตถุดิบต้องสมดุลกัน เครื่องจักรมีค่าพลังที่ลดลงเรื่อย ๆ ทีมสนับสนุนช่วยลดความเสี่ยงและเพิ่มรายได้": "The factory has <b>18 departments</b> to manage and upgrade with stars — the feedstock chain must stay balanced, machines have a condition that steadily declines, and support teams cut risk and raise revenue.",
  "🌾 สายวัตถุดิบ (ทีม 1-3)": "🌾 Raw Material Line (Teams 1-3)",
  "หาอ้อย → ตัดและขน → ลานอ้อย · ต้องสมดุลกัน ไม่งั้นอ้อยเสื่อมหรือหลุดมือ": "Source cane → cut and haul → cane yard · keep them balanced or cane degrades or slips away",
  "🏭 สายการผลิต (ทีม 4-10)": "🏭 Production Line (Teams 4-10)",
  "ลูกหีบ → ทำใส → หม้อต้ม → หม้อเคี่ยว → หม้อปั่น → บรรจุ → คลัง": "Mill → clarification → evaporator → pan → centrifugal → packing → warehouse",
  "⚡ พลังงาน (ทีม 11-12)": "⚡ Energy (Teams 11-12)",
  "ชานอ้อย → ไอน้ำ → ไฟฟ้า · ไอไม่พอทั้งโรงงานช้าลง": "Bagasse → steam → power · insufficient steam slows the whole mill",
  "🤝 ทีมสนับสนุน (ทีม 13-18)": "🤝 Support Teams (Teams 13-18)",
  "ซ่อมบำรุง ขาย ฉุกเฉิน บุคคล คุณภาพ บ่อบำบัด": "Maintenance, sales, emergency, HR, quality, treatment ponds",
  "ตอนจบฤดู (130 วัน) เกมให้เกรด <b>S–F</b> จาก <b>คะแนนรวมถ่วงน้ำหนัก เต็ม 1,000 แต้ม</b> (สำหรับระบบ Ranking แข่งขัน) — เรียงตามความสำคัญ:": "At season end (130 days) the game awards a grade of <b>S–F</b> from a <b>weighted total out of 1,000 points</b> (for the competitive Ranking system) — ordered by importance:",
  "เกณฑ์เกรด (คะแนนรวมถ่วงน้ำหนัก เต็ม 1,000)": "Grade thresholds (weighted total out of 1,000)",
  "การบริหารรวม <b>ปริมาณอ้อยเข้าหีบ</b> (เป้า 700,000 ตัน) เข้าไปด้วย · เป้ากำไรสุทธิ ฿200 ล้าน · โหมดยากอย่างเดียว · เงินสดติดลบไม่ได้ (กู้ได้ แต่ดอกยิ่งกู้ยิ่งแพง)": "Management also factors in <b>cane crushed</b> (target 700,000 t) · net-profit target ฿200M · hard mode only · cash cannot go negative (borrowing allowed, but the more you borrow the pricier it gets).",
  "เข้าสู่ระบบเพื่อจัดการโรงงานน้ำตาล": "Sign in to manage your sugar factory",
});

/* Translate static markup already in the DOM (loading overlay, header logo SVG, etc.).
   Idempotent: JS-rendered regions are re-translated at render time via TR(). */
try { if (typeof translateDOM === 'function') { translateDOM(document.body); translateBlocks(document.body); } } catch (e) {}

/* --- Welcome tutorial paragraphs (main.js TUT) --- */
Object.assign(DICT_BLOCK, {
  "คุณมี <b>130 วัน</b> = วันหีบ 120 วัน + โควตาหยุดล้างเครื่อง 10 วัน และทุน <b>฿50 ล้าน</b> เป้าหมายคือกำไร ฿200 ล้าน พร้อมคะแนนดีทั้ง 8 ด้าน (การบริหาร · กำไร · ประสิทธิภาพการผลิต · ลูกค้า · พนักงาน · ชาวไร่ · ความปลอดภัย · ข้อร้องเรียน)<br><br>เวลายังไม่เดินจนกว่าคุณจะกด <b>🚩 เริ่มหีบ</b> — ใช้ช่วงนี้ปรับปรุงแผนกก่อนได้เต็มที่":
    "You have <b>130 days</b> = 120 crushing days + a 10-day cleaning-shutdown quota, and <b>฿50M</b> capital. The goal is ฿200M profit with good scores across all 8 areas (Management · Profit · Production Efficiency · Customers · Staff · Growers · Safety · Complaints)<br><br>The clock doesn't run until you press <b>🚩 Start Crushing</b> — use this time to improve departments first.",
  "ทีมส่งเสริม <b>หาอ้อย</b> → ทีมเก็บเกี่ยว <b>ตัดและขน</b> → ทีมลานอ้อย <b>รับเข้าลาน</b> → ลูกหีบ<br>ทั้งสามต้องมีกำลังใกล้เคียงกัน มิฉะนั้น:<br>• ตัดไม่ทันที่หาไว้ → อ้อยหลุดไปโรงงานอื่น ชาวไร่เสียความเชื่อมั่น<br>• ลานรับไม่ทัน → รถต่อคิว <b>CCS ตกชั่วโมงละ 0.042 หน่วย</b> เกิน 24 ชม. เกิด dextran<br>ดูแถบ “คอขวดของทั้งโรงงาน” ในแท็บการผลิตได้ตลอด":
    "Promotion team <b>sources cane</b> → Harvest team <b>cuts and hauls</b> → Yard team <b>receives it</b> → Milling<br>All three need balanced capacity, or:<br>• Can't cut what you sourced → cane goes to rival mills and growers lose trust<br>• Yard can't keep up → trucks queue, <b>CCS drops 0.042 units per hour</b>, and past 24 h dextran forms<br>Watch the “Factory-wide Bottleneck” bar in the Production tab anytime.",
  "เครื่องจักรทุกตัวเริ่มที่ <b>ค่าพลัง 100%</b> และลดลงทุกชั่วโมงที่เดินเครื่อง · ค่าพลังต่ำ = กำลังผลิตต่ำ · <b>ถึง 0 = พังทั้งกระบวนการ</b> ซ่อมอย่างน้อย 1 วัน (ลด 20% ต่อ 1 ดาวของทีมซ่อมบำรุง)<br><br>ทางเลือกคือ <b>อัปเกรดดาว</b> (ทนขึ้นถาวร) หรือ <b>เร่งเครื่อง</b> (กำลังเพิ่มทันที แต่ค่าพลังลดเร็วขึ้นถึง 3.4 เท่า พนักงานเหนื่อย และเสี่ยงอุบัติเหตุ/ไฟไหม้)<br>ใช้โควตาหยุดล้างเครื่อง 10 วันให้คุ้ม — ทีมซ่อมบำรุงจะคอยประเมินให้":
    "Every machine starts at <b>100% condition</b> and drops each hour it runs · low condition = low output · <b>reaching 0 = the whole process breaks down</b>, needing at least 1 day of repair (reduced 20% per Maintenance Team star)<br><br>Your options: <b>upgrade stars</b> (permanently more durable) or <b>overdrive</b> (instant power, but condition decays up to 3.4x faster, tires staff, and risks accidents/fire)<br>Make the 10-day cleaning-shutdown quota count — the Maintenance Team keeps assessing for you.",
  "ขาดเงินเมื่อไรระบบจะกู้ให้อัตโนมัติ ดอกเบี้ยฐาน 12%/ปี และ <b>+3% ทุกยอดกู้ ฿50 ล้าน</b><br>คุณ<b>ลงทุนด้วยเงินกู้ได้</b> — การกู้มาขยายกำลังตั้งแต่ต้นฤดูมักคุ้มกว่ารอเก็บเงิน เพราะกำลังที่เพิ่มจะทำงานให้ครบ 120 วัน<br><br>จ่ายค่าอ้อยทุก 7 วัน · ค่าจ้างทุก 15 วัน · ค่าอ้อยขั้นสุดท้ายวันที่ 65 และ 130":
    "Whenever you run short the system auto-borrows: base rate 12%/yr, plus <b>+3% for every ฿50M borrowed</b><br>You <b>may invest with borrowed money</b> — borrowing to expand capacity early in the season usually beats waiting to save up, because the added capacity works all 120 days<br><br>Cane paid every 7 days · wages every 15 days · final cane payment on days 65 and 130.",
});
Object.assign(DICT_EN, {
  "ยินดีต้อนรับ ผู้จัดการโรงงาน": "Welcome, Factory Manager",
  "สายวัตถุดิบ ทีม 1-3 คือหัวใจ": "The Feedstock Chain (Depts 1-3) Is the Heart",
  "ค่าพลังเครื่องจักร และการเร่งเครื่อง": "Machine Condition & Overdrive",
  "เงินสดติดลบไม่ได้ — แต่กู้ได้": "Cash Can't Go Negative — But You Can Borrow",
  "คู่มือ": "Guide", "ถัดไป": "Next", "ย้อนกลับ": "Back", "ข้าม": "Skip",
});
