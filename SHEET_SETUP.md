# เชื่อมกระดานอันดับกับ Google Sheet (ฟรี ไม่ต้องมีเซิร์ฟเวอร์)

เกมบันทึกคะแนนในเครื่อง (localStorage) ได้อยู่แล้ว ถ้าอยากให้ **ผู้เล่นทุกคนแข่งบนกระดานเดียวกัน** ให้เชื่อม Google Sheet ตามนี้ (ทำครั้งเดียว ~5 นาที)

## ขั้นตอน

1. เปิด Google Sheet ของคุณ → เมนู **ส่วนขยาย (Extensions) → Apps Script**
2. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดข้างล่างนี้ลงไป → กด **บันทึก** (ไอคอนแผ่นดิสก์)
3. กด **Deploy → New deployment**
   - Select type (เฟือง) → **Web app**
   - **Execute as:** Me (อีเมลคุณ)
   - **Who has access:** **Anyone** ← สำคัญ ต้องเลือกอันนี้
   - กด **Deploy** → อนุญาตสิทธิ์ (Authorize) ให้เรียบร้อย
4. คัดลอก **Web app URL** (ลงท้ายด้วย `/exec`)
5. เอา URL ไปวางในเกม: หน้าแรก → **🏆 จัดอันดับ** → ช่อง "เชื่อม Google Sheet" → **บันทึก URL**
   - หรือส่ง URL มาให้ฝังในโค้ด (`js/leaderboard.js` → `SHEET_URL`) เพื่อให้ทุกเครื่องใช้กระดานเดียวกันอัตโนมัติ

> หมายเหตุ: ถ้าแก้โค้ด Apps Script ภายหลัง ต้อง **Deploy → Manage deployments → แก้ไข (ดินสอ) → Version: New version → Deploy** ทุกครั้ง URL ถึงจะอัปเดต

## โค้ด Apps Script (วางทั้งหมด)

```javascript
// กระดานอันดับ Sugar Factory Manager — บันทึก/ดึงคะแนนผ่าน JSONP
function doGet(e) {
  var cb = (e && e.parameter && e.parameter.callback) || 'callback';
  var out;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Scores');
    if (!sh) { sh = ss.insertSheet('Scores'); }
    if (sh.getLastRow() === 0) {
      sh.appendRow(['at', 'name', 'score', 'grade', 'profit', 'cane', 'sugar', 'days']);
    }
    var a = (e && e.parameter) || {};
    if (a.action === 'add') {
      sh.appendRow([
        new Date(),
        String(a.name || '').substring(0, 24),
        Number(a.score) || 0,
        String(a.grade || ''),
        Number(a.profit) || 0,
        Number(a.cane) || 0,
        Number(a.sugar) || 0,
        Number(a.days) || 0
      ]);
      out = { ok: true };
    } else { // action=top
      var limit = Number(a.limit) || 50;
      var rows = sh.getDataRange().getValues();
      var data = rows.slice(1).map(function (r) {
        return { name: r[1], score: Number(r[2]) || 0, grade: r[3],
                 profit: Number(r[4]) || 0, cane: Number(r[5]) || 0,
                 sugar: Number(r[6]) || 0, days: r[7] };
      }).sort(function (x, y) { return y.score - x.score; }).slice(0, limit);
      out = data;
    }
  } catch (err) {
    out = { error: String(err) };
  }
  return ContentService
    .createTextOutput(cb + '(' + JSON.stringify(out) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
```

## โครงข้อมูลในชีต (แท็บ `Scores` สร้างอัตโนมัติ)

| at | name | score | grade | profit | cane | sugar | days |
|----|------|-------|-------|--------|------|-------|------|
| วันเวลา | ชื่อผู้จัดการ | คะแนนรวม 0-1000 | เกรด S-F | กำไรสุทธิ | อ้อยหีบ (ตัน) | น้ำตาล (ตัน) | จำนวนวัน |

เกมส่งคะแนนอัตโนมัติทุกครั้งที่ปิดฤดูกาล และดึง 50 อันดับสูงสุดมาแสดงในหน้า 🏆 จัดอันดับ
