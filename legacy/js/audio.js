/* ============================================================
 * 芯片音乐引擎 —— Web Audio 实时合成
 * 方波 ×2 + 三角波 ×1 + 噪声 ×1 的 FC 式音源
 * ============================================================ */
const AudioSys = (() => {

  let ctx = null, master = null, noiseBuf = null;
  let current = null;       // {name, timer, step, chans}
  let muted = false;

  const NOTE_FREQ = {};
  const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  for (let oct = 1; oct <= 6; oct++) {
    for (let i = 0; i < 12; i++) {
      const midi = (oct + 1) * 12 + i;
      NOTE_FREQ[NAMES[i] + oct] = 440 * Math.pow(2, (midi - 69) / 12);
    }
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  /* ---------------- 音色 ---------------- */
  function osc(type, freq, dur, vol, when, dest, slide) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(dest);
    o.start(when); o.stop(when + dur + 0.02);
  }

  function noise(dur, vol, when, dest, freq) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq || 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(when); s.stop(when + dur + 0.02);
  }

  /* ---------------- 曲目数据 ---------------- */
  const TR = {
    title: {
      bpm: 80,
      sq1: "A4 - C5 - E5 - G5 - E5 - C5 - A4 - - - F4 - A4 - C5 - E5 - D5 - C5 - B4 - - - A4 - C5 - E5 - G5 - A5 - G5 - E5 - D5 - - -",
      sq2: "A3 - - - E3 - - - F3 - - - E3 - - - D3 - - - C3 - - - G3 - - - E3 - - -",
      tri: "A2 - - - E2 - - - F2 - - - E2 - - - D2 - - - C2 - - - B1 - - - E2 - - -",
      noi: ". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ."
    },
    town: {
      bpm: 116,
      sq1: "E4 G4 C5 G4 E4 G4 C5 G4 D4 F4 A4 F4 D4 F4 A4 F4 C4 E4 G4 E4 C4 E4 G4 E4 B3 D4 G4 D4 B3 D4 G4 D4",
      sq2: "C4 - - - G3 - - - A3 - - - E3 - - - F3 - - - C4 - - - G3 - - - G3 - - -",
      tri: "C3 - - - G2 - - - F2 - - - C3 - - - G2 - - - E3 - - - F3 - - - G2 - - -",
      noi: "K . H . S . H . K . H . S . H . K . H . S . H . K . H . S . H ."
    },
    field: {
      bpm: 142,
      sq1: "A4 A4 C5 A4 E5 E5 A5 E5 F4 F4 A4 F4 C5 C5 E5 C5 G4 G4 B4 G4 D5 D5 F5 D5 A4 A4 C5 A4 E5 E5 A5 -",
      sq2: "A3 C4 E4 - A3 C4 E4 - F3 A3 C4 - F3 A3 C4 - G3 B3 D4 - G3 B3 D4 - A3 C4 E4 - E3 G3 B3 -",
      tri: "A2 A2 A2 A2 F2 F2 F2 F2 G2 G2 G2 G2 E2 E2 E2 E2",
      noi: "K H S H K H S H K H S H K H S H K H S H K H S H K H S H K H S H"
    },
    cave: {
      bpm: 88,
      sq1: "E4 - - - F4 - - - E4 - - - C4 - - - D4 - - - E4 - - - C4 - - - B3 - - -",
      sq2: "A3 - - - A3 - - - G#3 - - - G#3 - - - B3 - - - B3 - - - A3 - - - E3 - - -",
      tri: "E2 - - - F2 - - - E2 - - - C2 - - - D2 - - - E2 - - - A1 - - - B1 - - -",
      noi: "H . . . . . . . H . . . . . . . H . . . . . . . H . . . . . . ."
    },
    battle: {
      bpm: 156,
      sq1: "E5 G5 B5 G5 E5 G5 B5 G5 D5 F#5 A5 F#5 D5 F#5 A5 F#5 C5 E5 G5 E5 C5 E5 G5 E5 B4 D5 F#5 D5 B4 D5 F#5 D5",
      sq2: "E4 - B4 - E4 - B4 - D4 - A4 - D4 - A4 - C4 - G4 - C4 - G4 - B3 - F#4 - B3 - F#4 -",
      tri: "E2 E2 E2 E2 D2 D2 D2 D2 C2 C2 C2 C2 B1 B1 B1 B1",
      noi: "K H S H K H S H K H S H K H S H K H S H K H S H K H S H K H S H"
    },
    boss: {
      bpm: 144,
      sq1: "D5 D5 F5 D5 A#4 D5 F5 D5 D5 D5 F5 D5 C5 A#4 C5 D5 F5 F5 A#4 F5 C5 F5 A#4 F5 E5 E5 G5 E5 A#4 E5 G5 E5",
      sq2: "D4 - A4 - D4 - A4 - C4 - G#4 - C4 - G#4 - A#3 - F4 - A#3 - F4 - B3 - F4 - B3 - F4 -",
      tri: "D2 D2 D2 D2 C2 C2 C2 C2 A#1 A#1 A#1 A#1 B1 B1 B1 B1",
      noi: "K . S . K . S . K . S . K . S . K . S . K . S . K . S . K . S ."
    },
    shop: {
      bpm: 132,
      sq1: "C5 E5 G5 E5 F5 A5 G5 E5 D5 F5 A5 F5 G5 B5 A5 F5 E5 G5 C6 G5 E5 G5 C6 G5 D5 F5 B5 F5 D5 F5 B5 F5",
      sq2: "C4 - G4 - F4 - C4 - G4 - E4 - A4 - F4 - G4 - G4 - C4 - G4 - A4 - F4 - B4 - G4 -",
      tri: "C3 - - - G2 - - - F2 - - - C3 - - - G2 - - - E3 - - - F3 - - - G2 - - -",
      noi: "K . H . S . H . K . H . S . H . K . H . S . H . K . H . S . H ."
    },
    inn: {
      bpm: 72,
      sq1: "F4 - A4 - C5 - A4 - G4 - B4 - D5 - B4 - A4 - C5 - E5 - C5 - G4 - B4 - D5 - B4 - F4 - A4 - C5 - A4 - E4 - G4 - B4 - G4 - C4 - E4 - G4 - E4 - C4 - E4 - G4 - -",
      sq2: "A3 - - - F3 - - - G3 - - - E3 - - - F3 - - - C4 - - - D3 - - - G3 - - -",
      tri: "F2 - - - C3 - - - G2 - - - C3 - - - A2 - - - E3 - - - G2 - - - C3 - - -",
      noi: ". . . . . . . . . . . . . . . ."
    },
    last: {
      bpm: 120,
      sq1: "E5 - E5 G5 A5 - A5 G5 E5 D5 - D5 F#5 A5 - G5 F#5 E5 - C5 E5 G5 - B4 - E5 D5 - B4 D5 E5 - - -",
      sq2: "E4 - - - B3 - - - D4 - - - A3 - - - C4 - - - G3 - - - B3 - - - B3 - - -",
      tri: "E2 E2 E2 E2 B1 B1 B1 B1 C2 C2 C2 C2 G1 G1 G1 G1",
      noi: "K . S . K . S . K . S . K . S . K . S . K . S . K . S . K . S ."
    },
    ending: {
      bpm: 76,
      sq1: "A4 - C5 - E5 - - - D5 - C5 - B4 - - - C5 - E5 - A5 - G5 E5 D5 - C5 - B4 - - - A4 - C5 - E5 - - - F5 - E5 - D5 - - - E5 - G#4 - B4 - - - A4 - - - -",
      sq2: "A3 - - - F#3 - - - G3 - - - E3 - - - F3 - - - C4 - - - B3 - - - E3 - - -",
      tri: "A2 - - - F#2 - - - G2 - - - E2 - - - F2 - - - C3 - - - B1 - - - E2 - - -",
      noi: ". . . . . . . . . . . . . . . ."
    }
  };

  /* ---------------- 播放器 ---------------- */
  function parseNote(tok) {
    if (tok === '-' || tok === '.' ) return null;
    const m = tok.match(/^([A-G][#]?)(\d)$/);
    if (!m) return null;
    return NOTE_FREQ[m[1] + m[2]];
  }

  function playTrack(name) {
    if (!ensure()) return;
    stopTrack();
    const t = TR[name];
    if (!t) return;
    const stepDur = 60 / t.bpm / 4;
    const sq1 = t.sq1.split(' ').filter(x => x !== '');
    const sq2 = t.sq2.split(' ').filter(x => x !== '');
    const tri = t.tri.split(' ').filter(x => x !== '');
    const noi = t.noi.split(' ').filter(x => x !== '');
    const chans = [
      {notes: sq1, type: 'square', vol: 0.09},
      {notes: sq2, type: 'square', vol: 0.06},
      {notes: tri, type: 'triangle', vol: 0.16},
      {notes: noi, type: 'noise', vol: 0.10}
    ];
    const start = ctx.currentTime + 0.06;
    let step = 0;
    let timer = setInterval(() => {
      if (!ctx) return;
      const tNow = ctx.currentTime;
      const horizon = tNow + 0.18;
      while (start + step * stepDur < horizon) {
        const when = start + step * stepDur;
        for (let c = 0; c < 4; c++) {
          const ch = chans[c];
          const tok = ch.notes[step % ch.notes.length];
          if (c === 3) {
            if (tok === 'K') { osc('sine', 120, 0.14, 0.30, when, master, 40); noise(0.05, 0.05, when, master, 400); }
            else if (tok === 'S') { noise(0.12, 0.12, when, master, 1800); osc('triangle', 220, 0.06, 0.05, when, master); }
            else if (tok === 'H') { noise(0.03, 0.04, when, master, 6000); }
          } else {
            const f = parseNote(tok);
            if (f) osc(ch.type, f, stepDur * 0.92, ch.vol, when, master);
          }
        }
        step++;
      }
    }, 40);
    current = {name, timer};
  }

  function stopTrack() {
    if (current && current.timer) { clearInterval(current.timer); current = null; }
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
  }
  function isMuted() { return muted; }

  /* ---------------- 音效 ---------------- */
  function sfx(kind) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    switch (kind) {
      case 'cursor': osc('square', 500, 0.05, 0.08, t, master); break;
      case 'confirm': osc('square', 660, 0.07, 0.09, t, master); osc('square', 990, 0.09, 0.09, t + 0.05, master); break;
      case 'cancel': osc('square', 440, 0.07, 0.08, t, master); osc('square', 330, 0.09, 0.08, t + 0.06, master); break;
      case 'shot': osc('square', 900, 0.10, 0.10, t, master, 150); noise(0.08, 0.08, t, master, 2500); break;
      case 'boom': osc('sine', 90, 0.35, 0.30, t, master, 35); noise(0.25, 0.12, t, master, 900); break;
      case 'hit': osc('square', 180, 0.08, 0.10, t, master, 90); noise(0.05, 0.07, t, master, 1500); break;
      case 'heal': osc('triangle', 523, 0.12, 0.12, t, master); osc('triangle', 659, 0.12, 0.12, t + 0.1, master); osc('triangle', 784, 0.18, 0.12, t + 0.2, master); break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => osc('square', f, 0.1, 0.09, t + i * 0.08, master));
        break;
      case 'cash':
        [1200, 1500, 1200, 1800].forEach((f, i) => osc('square', f, 0.06, 0.08, t + i * 0.06, master));
        break;
      case 'victory':
        [660, 880, 990, 1320].forEach((f, i) => osc('square', f, 0.14, 0.10, t + i * 0.12, master));
        break;
      case 'gameover':
        [392, 330, 262, 196].forEach((f, i) => osc('triangle', f, 0.4, 0.14, t + i * 0.35, master));
        break;
      case 'alarm':
        osc('square', 220, 0.12, 0.12, t, master);
        osc('square', 220, 0.12, 0.12, t + 0.16, master);
        break;
      case 'step': break;
      default: break;
    }
  }

  return { ensure, playTrack, stopTrack, setMuted, isMuted, sfx, TR };
})();
