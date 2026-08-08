/* ============================================================
 * 渲染引擎：Canvas 像素绘制 / 输入 / 窗口 / 文字
 * ============================================================ */
const Eng = (() => {

  const D = DATA;
  const PAL = D.PAL;

  let cv = null, ctx = null;
  const W = 320, H = 240;

  const keys = new Set();
  const queue = [];
  const held = new Set();
  const MOVE_KEYS = {up:'up', down:'down', left:'left', right:'right'};
  const KEYMAP = {
    ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down',
    ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right',
    KeyZ:'a', KeyJ:'a', Enter:'a', NumpadEnter:'a', Space:'a',
    KeyX:'b', KeyK:'b', Escape:'b', Backspace:'b',
    KeyM:'m', KeyR:'r'
  };

  function init(canvas) {
    cv = canvas;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    window.addEventListener('keydown', e => {
      const k = KEYMAP[e.code];
      if (!k) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!held.has(k)) { held.add(k); queue.push(k); }
      keys.add(k);
    });
    window.addEventListener('keyup', e => {
      const k = KEYMAP[e.code];
      if (!k) return;
      keys.delete(k); held.delete(k);
    });
    // 触屏
    document.querySelectorAll('#touch .tbtn').forEach(btn => {
      const k = btn.dataset.k;
      const press = e => { e.preventDefault(); if (!held.has(k)) { held.add(k); queue.push(k); } };
      const release = () => held.delete(k);
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
    });
    // 防止页面滚动
    window.addEventListener('keydown', e => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    }, {passive: false});
  }

  /* ---------------- 输入 ---------------- */
  function poll() {
    const q = queue.slice();
    queue.length = 0;
    return q;
  }
  function isHeld(k) { return keys.has(k); }
  function press(k) { queue.push(k); } // 调试/测试用
  function hold(k) { keys.add(k); held.add(k); } // 调试/测试用
  function release(k) { keys.delete(k); held.delete(k); } // 调试/测试用

  /* ---------------- 基础绘制 ---------------- */
  function clear(color) { ctx.fillStyle = color || '#000'; ctx.fillRect(0, 0, W, H); }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawTile(ch, x, y, ts) {
    const t = D.TILE[ch];
    rect(x * ts, y * ts, ts, ts, t ? t.c : '#000');
    if (ch === 'm') {
      rect(x*ts+ts*0.2, y*ts+ts*0.15, ts*0.18, ts*0.5, '#787888');
      rect(x*ts+ts*0.55, y*ts+ts*0.1, ts*0.2, ts*0.6, '#6a6a78');
      rect(x*ts+ts*0.15, y*ts+ts*0.5, ts*0.7, ts*0.25, '#4c4c58');
    } else if (ch === 'f') {
      rect(x*ts+ts*0.15, y*ts+ts*0.2, ts*0.22, ts*0.5, '#2a7a30');
      rect(x*ts+ts*0.6, y*ts+ts*0.25, ts*0.22, ts*0.45, '#27742c');
      rect(x*ts+ts*0.3, y*ts+ts*0.05, ts*0.4, ts*0.25, '#38903c');
      rect(x*ts+ts*0.45, y*ts+ts*0.6, ts*0.25, ts*0.3, '#27742c');
    } else if (ch === 'w') {
      rect(x*ts+ts*0.1, y*ts+ts*0.25, ts*0.2, ts*0.12, 'rgba(255,255,255,0.25)');
      rect(x*ts+ts*0.55, y*ts+ts*0.55, ts*0.18, ts*0.1, 'rgba(255,255,255,0.2)');
    } else if (ch === 'D') {
      rect(x*ts+ts*0.25, y*ts+ts*0.15, ts*0.5, ts*0.7, '#c8b070');
      rect(x*ts+ts*0.38, y*ts+ts*0.35, ts*0.24, ts*0.3, '#5a4a28');
    } else if (ch === 'C' || ch === 'H' || ch === 'N') {
      rect(x*ts+ts*0.3, y*ts+ts*0.3, ts*0.4, ts*0.4, ch === 'H' ? '#8a7040' : ch === 'N' ? '#888' : '#504848');
      rect(x*ts+ts*0.2, y*ts+ts*0.6, ts*0.6, ts*0.15, '#333');
    } else if (ch === 's') {
      rect(x*ts+ts*0.2, y*ts+ts*0.4, ts*0.15, ts*0.08, 'rgba(255,255,255,0.3)');
      rect(x*ts+ts*0.55, y*ts+ts*0.65, ts*0.12, ts*0.06, 'rgba(255,255,255,0.25)');
    }
  }

  function sprite(rows, x, y, scale, pal) {
    scale = scale || 1;
    pal = pal || PAL;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(x + c * scale), Math.round(y + r * scale), scale, scale);
      }
    }
  }

  function tankSprite(tank, x, y, scale, faceRight) {
    const tpl = D.TTPL[tank.tpl] || D.TTPL.tank;
    const pal = Object.assign({}, PAL, tank.colors || {});
    const s = scale || 2;
    const rows = faceRight ? tpl : tpl.map(r => r.split('').reverse().join(''));
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(x + c * s), Math.round(y + r * s), s, s);
      }
    }
  }

  /* ---------------- 文字 ---------------- */
  function text(str, x, y, color, size, align, bold) {
    ctx.font = (bold ? 'bold ' : '') + (size || 12) + "px 'Courier New','PingFang SC','Microsoft YaHei',monospace";
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color || '#fff';
    ctx.fillText(str, x, y);
  }

  function textW(str, x, y, maxW, size) {
    // 简易中文按字符宽度换行
    const s = size || 12;
    ctx.font = s + "px 'Courier New','PingFang SC','Microsoft YaHei',monospace";
    const lines = [];
    let cur = '';
    for (const ch of str) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = ch; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* ---------------- 窗口 ---------------- */
  function window_(x, y, w, h, opts) {
    opts = opts || {};
    rect(x, y, w, h, opts.bg || '#101828');
    rect(x, y, w, 2, '#d0d8e8');
    rect(x, y, 2, h, '#d0d8e8');
    rect(x + w - 2, y, 2, h, '#384058');
    rect(x, y + h - 2, w, 2, '#384058');
    rect(x - 1, y - 1, w + 2, h + 2, '#000');
    rect(x - 1, y - 1, w + 2, 1, '#000');
    rect(x - 1, y - 1, 1, h + 2, '#000');
  }

  function cursor(x, y, on) {
    if (on === undefined) on = Math.floor(Date.now() / 380) % 2 === 0;
    if (on) text('▶', x, y, '#f8e048', 12);
  }

  /* ---------------- 工具 ---------------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const chance = p => Math.random() < p;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const choice = arr => arr[Math.floor(Math.random() * arr.length)];
  function fmtG(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return { W, H, init, poll, isHeld, press, hold, release, clear, rect, drawTile, sprite, tankSprite,
           text, textW, window_, cursor, rnd, ri, chance, clamp, choice, fmtG, PAL };
})();
