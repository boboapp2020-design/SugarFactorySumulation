'use strict';
/* =====================================================================
   Leaderboard — บันทึก/จัดอันดับคะแนนผู้เล่น
   • เก็บในเครื่อง (localStorage) เสมอ — ใช้งานได้ทันที
   • ถ้าตั้งค่า Google Sheet (ผ่าน Apps Script Web App) จะบันทึก/ดึงอันดับส่วนกลางร่วมกัน
   วิธีเชื่อม Google Sheet: ดูไฟล์ SHEET_SETUP.md
   ===================================================================== */
const Leaderboard = {
  /* วาง URL ของ Google Apps Script Web App ที่ deploy แล้ว (ลงท้าย /exec)
     — เว้นว่างไว้ = ใช้เฉพาะในเครื่อง · ใส่ค่าแล้ว push = ทุกคนแข่งบนกระดานเดียวกัน */
  SHEET_URL: '',
  _seq: 0,

  /* URL ที่ใช้จริง: ค่าที่ฝังในโค้ด หรือค่าที่ผู้เล่นวางเองในหน้าตั้งค่า (localStorage) */
  url() {
    if (this.SHEET_URL) return this.SHEET_URL;
    try { return lsGet('sfm_sheet_url') || ''; } catch (e) { return ''; }
  },
  setUrl(u) { try { lsSet('sfm_sheet_url', (u || '').trim()); } catch (e) {} },
  isShared() { return !!this.url(); },

  /* บันทึกคะแนนตอนจบฤดู — e = { name, score, grade, profit, cane, sugar, days } */
  submit(e) {
    const entry = {
      name: String(e.name || 'ผู้เล่น').slice(0, 24),
      score: Math.round(e.score) || 0, grade: e.grade || '-',
      profit: Math.round(e.profit) || 0, cane: Math.round(e.cane) || 0,
      sugar: Math.round(e.sugar) || 0, days: e.days || 0, at: Date.now(),
    };
    try { const a = this.local(); a.push(entry); a.sort((x, y) => y.score - x.score); this.saveLocal(a.slice(0, 200)); } catch (_) {}
    const u = this.url();
    if (u) {
      const q = Object.entries({ action: 'add', name: entry.name, score: entry.score, grade: entry.grade,
        profit: entry.profit, cane: entry.cane, sugar: entry.sugar, days: entry.days })
        .map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
      this.jsonp(u + (u.includes('?') ? '&' : '?') + q);
    }
    return entry;
  },

  /* ดึงอันดับสูงสุด — cb(rows, isRemote) */
  fetchTop(cb) {
    const u = this.url();
    if (u) this.jsonp(u + (u.includes('?') ? '&' : '?') + 'action=top&limit=50',
      rows => cb(Array.isArray(rows) ? rows : this.local(), true),
      () => cb(this.local(), false));
    else cb(this.local(), false);
  },

  local() { try { return JSON.parse(lsGet('sfm_scores') || '[]'); } catch (_) { return []; } },
  saveLocal(a) { try { lsSet('sfm_scores', JSON.stringify(a)); } catch (_) {} },

  /* JSONP — เรียก Apps Script ข้ามโดเมนได้โดยไม่ติด CORS */
  jsonp(url, ok, err) {
    const cbName = '_lb_cb_' + (++this._seq);
    const s = document.createElement('script');
    let done = false;
    const cleanup = () => { try { delete window[cbName]; } catch (e) { window[cbName] = undefined; } s.remove(); };
    const timer = setTimeout(() => { if (!done) { done = true; cleanup(); err && err(); } }, 9000);
    window[cbName] = data => { if (done) return; done = true; clearTimeout(timer); cleanup(); ok && ok(data); };
    s.onerror = () => { if (done) return; done = true; clearTimeout(timer); cleanup(); err && err(); };
    s.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cbName;
    document.head.appendChild(s);
  },
};
