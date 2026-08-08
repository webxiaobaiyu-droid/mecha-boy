/* Node 集成测试：模拟浏览器环境，跑通核心流程 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------- 浏览器桩 ---------- */
const noop = () => {};
const ctxStub = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return () => ({width: 8});
    if (!(k in t)) t[k] = noop;
    return t[k];
  },
  set(t, k, v) { t[k] = v; return true; }
});
const canvasStub = {getContext: () => ctxStub, width: 320, height: 240};

class FakeGain {
  constructor() { this.gain = {value: 0.5, setValueAtTime: noop, exponentialRampToValueAtTime: noop}; this.destination = {}; }
  connect() { return this.destination; }
}
class FakeOsc {
  constructor() { this.frequency = {value: 440, exponentialRampToValueAtTime: noop}; this.type = ''; }
  connect() {} start() {} stop() {}
}
class FakeAudioContext {
  constructor() { this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  createGain() { return new FakeGain(); }
  createOscillator() { return new FakeOsc(); }
  createBuffer(c, l) { return {getChannelData: () => new Float32Array(l)}; }
  createBufferSource() { return {buffer: null, connect: noop, start: noop, stop: noop}; }
  createBiquadFilter() { return {type: '', frequency: {value: 0}, connect: noop}; }
  resume() {}
}

global.window = globalThis;
global.document = {
  getElementById: () => canvasStub,
  querySelectorAll: () => []
};
const evHandlers = {};
global.addEventListener = (type, fn) => { (evHandlers[type] = evHandlers[type] || []).push(fn); };
global.localStorage = (() => {
  const m = {};
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; }
  };
})();
global.location = {search: ''};
global.AudioContext = FakeAudioContext;
global.setInterval = () => 0; // 音乐调度器 no-op

/* ---------- 加载游戏代码 ---------- */
const dir = path.join(__dirname, '..', 'js');
const files = ['data.js', 'audio.js', 'engine.js', 'world.js', 'battle.js', 'main.js'];
let code = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n;\n');
code += '\n;globalThis.__T = {DATA, Eng, G, World, Battle, AudioSys};';
vm.runInThisContext(code, {filename: 'game.js'});

const {DATA: D, Eng, G, World} = globalThis.__T;
let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', msg); }
}
function step(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log('FAIL[' + name + ']:', e.message); }
}

step('键盘映射', () => {
  Eng.init(canvasStub);
  const key = code => { for (const fn of evHandlers.keydown || []) fn({code, preventDefault: noop}); };
  key('KeyZ');
  assert(Eng.poll().includes('a'), 'Z 映射为确认');
  key('KeyW');
  assert(Eng.poll().includes('up'), 'W 映射为上');
  key('Escape');
  assert(Eng.poll().includes('b'), 'Esc 映射为取消');
  for (const k of ['a', 'up', 'b']) Eng.release(k);
});

/* ---------- 数据完整性 ---------- */
step('世界地图尺寸', () => {
  assert(D.WORLD.length === 64, 'world height 64');
  assert(D.WORLD.every(r => r.length === 80), 'world width 80');
});
step('城镇数据', () => {
  for (const t of D.TOWNS) {
    assert(t.buildings.length >= 3, t.id + ' buildings');
    assert(t.door && D.WORLD[t.door[1]][t.door[0]] === 'D', t.id + ' door on world');
    for (const b of t.buildings) {
      assert(['weapon','tankshop','modshop','inn','bounty','story'].includes(b.type), t.id + ' ' + b.type);
    }
    for (const n of t.npcs) {
      assert(D.SPR[n.sp], t.id + ' npc sprite ' + n.sp);
      if (!n.talk.startsWith('story_')) assert(D.DIALOGUE[n.talk], t.id + ' dialogue ' + n.talk);
    }
  }
});
step('洞窟数据', () => {
  for (const c of D.CAVES) {
    assert(D.REGIONS.some(r => r.id === c.region), c.id + ' region');
    for (const ch of c.chests) {
      const it = D.ITEMS[ch.item] || D.PARTS.main.find(p => p.id === ch.item) || D.PARTS.engine.find(p => p.id === ch.item);
      assert(it, c.id + ' chest ' + ch.item);
    }
  }
});
step('怪物/区域数据', () => {
  for (const r of D.REGIONS) {
    for (const id of r.mobs) assert(D.MONSTERS[id], 'region ' + r.id + ' mob ' + id);
  }
  for (const id in D.MONSTERS) {
    const m = D.MONSTERS[id];
    assert(D.ETPL[m.tpl], 'mob tpl ' + id);
  }
});
step('赏金首数据', () => {
  for (const b of D.BOUNTIES) {
    assert(D.ETPL[b.tpl], 'bounty tpl ' + b.id);
    if (b.drop) {
      const p = D.PARTS.main.concat(D.PARTS.sub, D.PARTS.se, D.PARTS.engine, D.PARTS.c).find(x => x.id === b.drop.id);
      assert(p, 'bounty drop ' + b.id + ' -> ' + b.drop.id);
    }
  }
  assert(D.PASSWORDS.length === 4, '4 passwords');
});
step('战车数据', () => {
  for (const t of D.TANKS) {
    assert(D.TTPL[t.tpl], 'tank tpl ' + t.id);
    assert(t.sp > 0 && t.armorCap > 0 && t.speed > 0 && t.def > 0, 'tank stats ' + t.id);
    for (const k of ['main','sub','se','engine','c']) {
      if (t.parts[k]) {
        const list = k === 'main' ? D.PARTS.main : k === 'sub' ? D.PARTS.sub : k === 'se' ? D.PARTS.se : k === 'engine' ? D.PARTS.engine : D.PARTS.c;
        assert(list.some(p => p.id === t.parts[k]), 'tank part ' + t.id + ' ' + k + ' ' + t.parts[k]);
      }
    }
  }
});
step('商店数据', () => {
  const allMain = D.PARTS.main.map(p => p.id);
  const allSub = D.PARTS.sub.map(p => p.id);
  const allSe = D.PARTS.se.map(p => p.id);
  const allEng = D.PARTS.engine.map(p => p.id);
  const allC = D.PARTS.c.map(p => p.id);
  for (const tid in D.SHOPS) {
    const cfg = D.SHOPS[tid];
    if (cfg.weapon) {
      for (const id of cfg.weapon.items) assert(D.ITEMS[id], tid + ' item ' + id);
      for (const id of cfg.weapon.main) assert(allMain.includes(id), tid + ' main ' + id);
      for (const id of cfg.weapon.sub) assert(allSub.includes(id), tid + ' sub ' + id);
      for (const id of cfg.weapon.se) assert(allSe.includes(id), tid + ' se ' + id);
      for (const id of cfg.weapon.engine) assert(allEng.includes(id), tid + ' engine ' + id);
      for (const id of cfg.weapon.c) assert(allC.includes(id), tid + ' c ' + id);
    }
    if (cfg.tank && cfg.tank.sell) {
      for (const id of cfg.tank.sell) assert(D.TANKS.some(t => t.id === id), tid + ' sell tank ' + id);
    }
  }
});

/* ---------- 流程：开局 → 拉多南洞拿战车 → 遇敌战斗 → 胜利 ---------- */
step('新游戏与战车获取', () => {
  G.newGame();
  G.state.screen = 'world';
  G.state.px = 25; G.state.py = 43;
  G.state.flags.no_encounter = true;
  // 向南绕到南洞 (26,46)：下→下→下→右
  for (const seq of [['down',3],['right',1]]) {
    Eng.hold(seq[0]);
    for (let i = 0; i < seq[1] * 2; i++) World.update(0.2);
    Eng.release(seq[0]);
  }
  assert(G.state.map === 'cave1', '进入洞窟');
  assert(G.state.px === 2 && G.state.py === 12, '洞窟入口位置');
  // 直接移动到战车事件旁 (18,12)，再向右一步踩上事件格 (19,12)
  G.state.px = 18; G.state.py = 12; G.state.anim = null;
  Eng.hold('right');
  World.update(0.2); World.update(0.2);
  Eng.release('right');
  assert(G.state.tanks.length === 1 && G.state.tanks[0].tankId === 't1', '获得 NO.1 战车');
  // 出洞回到世界（回到事件点旁，再走到出口）
  G.state.px = 3; G.state.py = 12; G.state.anim = null;
  Eng.hold('left');
  World.update(0.2); World.update(0.2);
  Eng.release('left');
  assert(G.state.map === 'world', '返回世界地图');
});

step('徒步战斗与胜利', () => {
  G.state.riding = false;
  D.MONSTERS.rat.hp = 5; // 弱化以快速胜利
  G.startBattle(['rat'], {});
  assert(G.state.screen === 'battle', '进入战斗');
  // 等待 intro 后确认菜单 → 选目标 → 攻击
  let guard = 0;
  while (G.state.screen === 'battle' && guard < 300) {
    Eng.press('a');
    G.update(0.1);
    guard++;
  }
  // 胜利对话框推进
  guard = 0;
  while (G.state.dialog && guard < 200) { Eng.press('a'); G.update(0.1); guard++; }
  assert(G.state.screen === 'world', '战斗后回到世界');
  assert(G.state.party[0].xp > 0, '获得经验');
  D.MONSTERS.rat.hp = 45;
});

step('战车战斗', () => {
  G.state.riding = true;
  D.MONSTERS.rat.hp = 5;
  G.startBattle(['rat', 'rat'], {});
  let guard = 0;
  while (G.state.screen === 'battle' && guard < 400) {
    Eng.press('a');
    G.update(0.1);
    guard++;
  }
  guard = 0;
  while (G.state.dialog && guard < 200) { Eng.press('a'); G.update(0.1); guard++; }
  assert(G.state.screen === 'world', '战车战斗结束');
  D.MONSTERS.rat.hp = 45;
});

step('赏金首战斗', () => {
  D.BOUNTIES[0].hp = 8; // 水怪弱化
  G.startBountyBattle('water', {});
  let guard = 0;
  while (G.state.screen === 'battle' && guard < 400) {
    Eng.press('a');
    G.update(0.1);
    guard++;
  }
  guard = 0;
  while (G.state.dialog && guard < 200) { Eng.press('a'); G.update(0.1); guard++; }
  assert(G.state.screen === 'world', '赏金首战后回世界');
  assert(G.state.bounties.killed.water === true, '水怪讨伐标记');
  D.BOUNTIES[0].hp = 800;
});

step('赏金领取', () => {
  const gold0 = G.state.gold;
  G.state.bounties.killed.water = true;
  World.enterTown('rado');
  G.openShop('bounty', {name: '情报屋'});
  Eng.press('a'); G.update(0.1);
  guard = 0;
  while (G.state.dialog && guard < 100) { Eng.press('a'); G.update(0.1); guard++; }
  assert(G.state.gold === gold0 + 1000, '领取 1000G');
  assert(G.state.bounties.claimed.water === true, '水怪已领取');
  G.state.bounties.killed.water = false;
  G.state.bounties.claimed.water = false;
});

step('武器店买卖', () => {
  const gold0 = G.state.gold;
  const med0 = G.state.inventory.items.med || 0;
  G.openShop('weapon', {name: '武器店'});
  Eng.press('a'); G.update(0.1); // 买第一个（药箱）
  assert(G.state.inventory.items.med === med0 + 1, '买到药箱');
  assert(G.state.gold === gold0 - 80, '扣款 80G');
  // 跳到卖出页（tab 6）：右×6
  for (let i = 0; i < 6; i++) { Eng.press('right'); G.update(0.1); }
  Eng.press('a'); G.update(0.1);
  assert(G.state.inventory.items.med === med0, '卖出药箱');
  Eng.press('b'); G.update(0.1); // 关闭商店
});

step('改造工房换装', () => {
  World.enterTown('odo');
  G.openShop('mod', {name: '改造工房'});
  const tank = G.state.tanks[0];
  const before = tank.parts.main;
  // 先给库存一个 55 炮
  G.addPart('gun55');
  // tab0: A 进入换装 → slot0 主炮 → 选第二个（55炮）
  Eng.press('a'); G.update(0.1);       // 更换装备
  Eng.press('a'); G.update(0.1);       // 主炮
  Eng.press('down'); G.update(0.1);    // 选 55 炮
  Eng.press('a'); G.update(0.1);       // 换装
  assert(tank.parts.main === 'gun55', '主炮换成 55 毫米炮');
  assert(G.state.inventory.parts.gun55 === undefined || G.state.inventory.parts.gun55 === 0, '库存移除');
  assert(G.state.inventory.parts[before] === 1, '旧炮回库存');
  Eng.press('b'); G.update(0.1); // 返回 tab0
});

step('宿屋存档', () => {
  G.state.gold = 12345;
  const ok = G.saveGame();
  assert(ok, '存档成功');
  G.state.gold = 1;
  assert(G.loadGame(), '读档成功');
  assert(G.state.gold === 12345, '读档后金币恢复');
});

step('密码门', () => {
  World.enterWorld(52, 4);
  G.openPassword();
  // 输入 3864
  const seq = ['up','up','up','right','up','up','up','up','up','up','up','up','right','up','up','up','up','up','up','right','up','up','up','up'];
  for (const k of seq) { Eng.press(k); G.update(0.1); }
  Eng.press('a'); G.update(0.1);
  assert(G.state.flags.pass0 === true, '密码 3864 认证');
  assert(G.state.screen === 'world', '密码后回世界');
});

step('城镇门与世界往返', () => {
  World.enterWorld(25, 42);
  Eng.hold('down');
  World.update(0.2); World.update(0.2);
  Eng.release('down');
  Eng.hold('up');
  World.update(0.2); World.update(0.2);
  Eng.release('up');
  assert(G.state.map === 'rado', '从门口进入拉多镇');
  // 从出口离开
  G.state.px = 11; G.state.py = 12; G.state.anim = null;
  Eng.hold('down');
  World.update(0.2); World.update(0.2);
  Eng.release('down');
  assert(G.state.map === 'world', '离开拉多镇');
});

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
