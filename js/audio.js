'use strict';
/* =====================================================================
   Sugar Factory Manager — audio.js
   เพลงประกอบและเสียงเอฟเฟกต์ สร้างด้วย Web Audio API (ไม่ต้องมีไฟล์เสียง)
   - เพลง: คอร์ด 8 บาร์วนซ้ำ (C–Am–F–G / C–Em–F–G) แพดนุ่ม + เบส + อาร์เปจจิโอเพนทาโทนิก + ไฮแฮตเบา
   - เอฟเฟกต์: คลิก, ดาวขึ้น, รับเงิน, เตือน
   เริ่มได้หลังผู้ใช้กดปุ่ม (นโยบาย autoplay ของเบราว์เซอร์)
   ===================================================================== */
const AudioSys = {
  ctx: null, master: null, music: null, sfx: null,
  enabled: true, volume: 0.5, started: false,
  bpm: 96, bar: 0, nextTime: 0, timer: null,
  /* หลายเพลง/หลายอารมณ์ สลับกันทุก ~16 บาร์ (chords = semitone สัมพัทธ์กับ C4) */
  tracks: [
    { name: 'รุ่งอรุณ',   bpm: 90,  pad: 'triangle', lead: 'sine',     hat: 1.0,
      chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2], [0, 4, 7], [-8, -5, -1], [-7, -3, 0], [-5, -1, 2]], penta: [0, 2, 4, 7, 9, 12, 14, 16] },
    { name: 'เดินเครื่อง', bpm: 110, pad: 'triangle', lead: 'square',   hat: 1.3,
      chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]], penta: [0, 2, 4, 7, 9, 12] },
    { name: 'เก็บเกี่ยว',  bpm: 122, pad: 'sawtooth', lead: 'triangle', hat: 1.5,
      chords: [[-7, -3, 0], [0, 4, 7], [-5, -1, 2], [-3, 0, 4]], penta: [0, 3, 5, 7, 10, 12, 15] },
    { name: 'พลบค่ำ',     bpm: 82,  pad: 'sine',     lead: 'sine',     hat: 0.6,
      chords: [[-3, 0, 4], [-8, -5, -1], [0, 4, 7], [-5, -1, 2]], penta: [0, 2, 3, 7, 9, 12, 14] },
    { name: 'ค่ำคืนโรงงาน', bpm: 100, pad: 'triangle', lead: 'triangle', hat: 0.9,
      chords: [[-5, -1, 2], [-10, -6, -3], [-7, -3, 0], [-3, 0, 4]], penta: [0, 2, 5, 7, 9, 12] },
  ],
  track: 0, barsInTrack: 0,
  chords: [[0, 4, 7]], penta: [0, 2, 4, 7, 9, 12, 14, 16], pad: 'triangle', lead: 'sine', hat: 1,
  seed: 7,

  setTrack(i) { const t = this.tracks[i]; if (!t) return; this.track = i; this.chords = t.chords; this.penta = t.penta; this.bpm = t.bpm; this.pad = t.pad; this.lead = t.lead; this.hat = t.hat; this.barsInTrack = 0; this.bar = 0; },
  nextTrack() { let i; do { i = Math.floor(Math.random() * this.tracks.length); } while (this.tracks.length > 1 && i === this.track); this.setTrack(i); },

  init() {
    try { this.enabled = lsGet('sfm_music') !== '0'; const v = parseFloat(lsGet('sfm_vol')); if (!isNaN(v)) this.volume = v; } catch (e) {}
  },
  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain(); this.music.gain.value = this.enabled ? 1 : 0; this.music.connect(this.master);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.4;
      lp.connect(this.music); this.musicIn = lp;
      return true;
    } catch (e) { return false; }
  },
  /* เริ่มเพลง (เรียกหลัง user gesture) */
  start() {
    if (!this.ensure() || this.started) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return; }
    this.started = true;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.setTrack(Math.floor(Math.random() * this.tracks.length));   // เริ่มด้วยเพลงสุ่ม
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 400);
    this.schedule();
  },
  rnd() { this.seed = (this.seed * 1103515245 + 12345) % 2147483648; return this.seed / 2147483648; },
  freq(semi) { return 261.63 * Math.pow(2, semi / 12); },
  schedule() {
    const ahead = 1.2;
    while (this.nextTime < this.ctx.currentTime + ahead) {
      const beat = 60 / this.bpm;
      this.playBar(this.nextTime, beat);
      this.nextTime += beat * 4;
      this.bar++;
      if (++this.barsInTrack >= 16) this.nextTrack();   // สลับเพลงทุก 16 บาร์
    }
  },
  playBar(t0, beat) {
    const ch = this.chords[this.bar % this.chords.length], ctx = this.ctx;
    /* แพด: 3 เสียงคอร์ด + detune (timbre ตามเพลง) */
    for (const semi of ch) for (const det of [-4, 4]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = this.pad || 'triangle'; o.frequency.value = this.freq(semi) ; o.detune.value = det;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.4); g.gain.setValueAtTime(0.05, t0 + beat * 3.4); g.gain.linearRampToValueAtTime(0, t0 + beat * 4);
      o.connect(g); g.connect(this.musicIn); o.start(t0); o.stop(t0 + beat * 4 + 0.05);
    }
    /* เบส */
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = this.freq(ch[0] - 24);
      const ts = t0 + i * beat * 2;
      g.gain.setValueAtTime(0, ts); g.gain.linearRampToValueAtTime(0.16, ts + 0.02); g.gain.exponentialRampToValueAtTime(0.001, ts + beat * 1.8);
      o.connect(g); g.connect(this.musicIn); o.start(ts); o.stop(ts + beat * 2);
    }
    /* อาร์เปจจิโอ/ทำนอง เพนทาโทนิก 8 โน้ตต่อบาร์ */
    for (let i = 0; i < 8; i++) {
      if (this.rnd() < 0.22) continue;
      const semi = ch[0] + this.penta[Math.floor(this.rnd() * this.penta.length)] + (this.rnd() < 0.3 ? 12 : 0);
      const ts = t0 + i * beat / 2;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = this.lead || (this.rnd() < 0.5 ? 'triangle' : 'sine'); o.frequency.value = this.freq(semi) * 2;
      g.gain.setValueAtTime(0, ts); g.gain.linearRampToValueAtTime(0.07, ts + 0.015); g.gain.exponentialRampToValueAtTime(0.001, ts + beat * 0.9);
      o.connect(g); g.connect(this.musicIn); o.start(ts); o.stop(ts + beat);
    }
    /* ไฮแฮตเบา (noise) ความหนักตามเพลง */
    const hv = this.hat == null ? 1 : this.hat;
    for (let i = 0; i < 8; i++) {
      const ts = t0 + i * beat / 2;
      this.noise(ts, (i % 2 === 0 ? 0.03 : 0.018) * hv, 0.05, 7000);
    }
  },
  noise(t, vol, dur, hp) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.musicIn); src.start(t);
  },

  /* ---------- เอฟเฟกต์ ---------- */
  tone(freq, dur, type = 'sine', vol = 0.25, when = 0, slide = 0) {
    if (this.paused) return;              /* หยุดเวลาแล้ว = เงียบสนิท ไม่มีแม้แต่เสียงเอฟเฟกต์ */
    if (!this.ensure()) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
  },
  click() { this.tone(880, 0.06, 'square', 0.06); },
  star() { [0, 4, 7, 12].forEach((s, i) => this.tone(523.25 * Math.pow(2, s / 12), 0.35, 'triangle', 0.2, i * 0.09)); },
  coin() { this.tone(1046, 0.12, 'square', 0.12); this.tone(1568, 0.25, 'square', 0.12, 0.09); },
  alert() { this.tone(220, 0.35, 'sawtooth', 0.12, 0, 0.7); this.tone(220, 0.35, 'sawtooth', 0.12, 0.4, 0.7); },
  day() { this.tone(659, 0.15, 'sine', 0.08); },

  toggle() {
    this.enabled = !this.enabled; lsSet('sfm_music', this.enabled ? '1' : '0');
    if (this.ensure()) { this.music.gain.setTargetAtTime(this.enabled ? 1 : 0, this.ctx.currentTime, 0.05); if (this.enabled) this.start(); }
  },
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); lsSet('sfm_vol', String(this.volume)); if (this.master) this.master.gain.setTargetAtTime(this.paused ? 0 : this.volume, this.ctx.currentTime, 0.05); },

  /* กดหยุดเวลา = เงียบสนิทจริง ๆ (ปิดเสียงทุกอย่างและหยุดตัวจับเวลาเพลง) */
  pauseAll() {
    this.paused = true;
    if (!this.ctx) return;
    if (this.master) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
    clearInterval(this.timer); this.timer = null;
    setTimeout(() => { if (this.paused && this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }, 160);
  },
  resumeAll() {
    if (!this.paused) return;
    this.paused = false;
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.06);
    if (this.started && !this.timer) {
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 400);
    }
  },
};
