/* ============================================================
 * 重装机兵：荒野的赏金猎人 —— 主控
 * ============================================================ */

const G = (() => {

  const D = DATA;
  const SAVE_KEY = 'mmw_save_v1';

  const INTRO = [
    '大破坏之后一百年。',
    '曾经辉煌的文明化为废土，',
    '怪物在荒野横行，人类蜷缩在小镇里苟活。',
    '传说，这一切的元凶是超级电脑「诺亚」——',
    '它认为只要人类存在，地球就注定毁灭。',
    '而在这样的时代，',
    '有一群人以讨伐怪物为生。',
    '人们敬畏地称他们为——',
    '赏金猎人。',
    '',
    '你，就是其中之一。'
  ];

  const ENDING = [
    '诺亚沉默了。',
    '主电脑的灯光一盏盏熄灭，',
    '大楼的震动逐渐平息。',
    '「……为什么。」',
    '它的声音最后响起。',
    '「为什么，人类要阻止我拯救地球？」',
    '没有人回答它。',
    '因为答案，或许连人类自己也不知道。',
    '',
    '数日后，废土的阳光照常升起。',
    '没有人在意是谁摧毁了诺亚。',
    '你回到拉多镇，父亲的修理店还亮着灯。',
    '老战：回来了？……战车没坏吧。',
    '你笑了。',
    '',
    '从此，荒野上多了一个传说。',
    '一个开着红色战车、四处讨伐赏金首的猎人，',
    '会在最危险的地方出现。',
    '',
    '「重装机兵：荒野的赏金猎人」',
    '—— 完 ——',
    '',
    '感谢游玩。致敬 1991 年 FC 经典《Metal Max》。'
  ];

  let state = null;
  let dialogQueue = [];
  let lastT = 0;

  /* ---------------- 初始状态 ---------------- */
  function makeMember(id, name, cls) {
    const b = D.GROWTH[cls].base;
    return {id, name, cls, lv: 1, hp: b.hp, maxHp: b.hp, atk: b.atk, def: b.def, spd: b.spd, xp: 0, tankId: null};
  }

  function makeTank(tankId) {
    const t = D.TANKS.find(x => x.id === tankId);
    return {
      tankId,
      armor: Math.min(100, t.armorCap),
      sp: t.sp,
      parts: Object.assign({main: t.parts.main, sub: t.parts.sub, se: t.parts.se, engine: t.parts.engine, c: t.parts.c})
    };
  }

  function newGame() {
    state = {
      screen: 'intro',
      map: 'world',
      px: 26, py: 44, facing: 0, anim: null, riding: false, inTown: null,
      party: [
        makeMember('hero', '阿雷', 'hero'),
        makeMember(null, '美娜', 'mecha'),
        makeMember(null, '红狼', 'wolf')
      ],
      gold: 300,
      inventory: {items: {med: 3, smoke: 1}, parts: {}},
      tanks: [],
      bounties: {killed: {}, claimed: {}},
      flags: {},
      playtime: 0,
      intro: {idx: 0, t: 0}
    };
    dialogQueue = [];
    AudioSys.playTrack('title');
  }

  /* ---------------- 存档 ---------------- */
  function saveGame() {
    if (!state || state.screen === 'title') return false;
    const s = {
      map: state.map, px: state.px, py: state.py, facing: state.facing, riding: state.riding,
      party: state.party, gold: state.gold, inventory: state.inventory, tanks: state.tanks,
      bounties: state.bounties, flags: state.flags, playtime: state.playtime
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; }
    catch (e) { return false; }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      s.screen = 'world';
      s.anim = null;
      s.inTown = s.map !== 'world' && D.TOWNS.find(t => t.id === s.map) ? s.map : null;
      if (s.map === 'world' && s.tanks && s.tanks.some(t => t.sp > 0)) s.riding = true;
      state = s;
      AudioSys.playTrack(s.map === 'world' ? 'field' : (s.inTown ? 'town' : 'cave'));
      return true;
    } catch (e) { return false; }
  }

  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  /* ---------------- 对话 ---------------- */
  function say(texts, cb) {
    if (!Array.isArray(texts)) texts = [texts];
    if (state.dialog) { dialogQueue.push({texts, cb}); return; }
    state.dialog = {texts, idx: 0, cb: cb || null, reveal: 0, wait: 0};
  }

  function dialogNext() {
    const d = state.dialog;
    d.reveal = 9999;
    if (d.idx < d.texts.length - 1) {
      d.idx++;
      d.reveal = 0;
      AudioSys.sfx('cursor');
    } else {
      const cb = d.cb;
      state.dialog = null;
      if (cb) cb();
      if (dialogQueue.length) {
        const next = dialogQueue.shift();
        state.dialog = {texts: next.texts, idx: 0, cb: next.cb || null, reveal: 0, wait: 0};
      }
    }
  }

  function banner(text) {
    state.bannerText = text;
    state.bannerT = 2.0;
  }

  /* ---------------- 道具/部件/战车 ---------------- */
  function addItem(id, n) {
    n = n || 1;
    state.inventory.items[id] = (state.inventory.items[id] || 0) + n;
  }
  function addPart(id, n) {
    n = n || 1;
    state.inventory.parts[id] = (state.inventory.parts[id] || 0) + n;
  }
  function addTank(tankId) {
    if (state.tanks.some(t => t.tankId === tankId)) return;
    state.tanks.push(makeTank(tankId));
    // 分配给没有战车的成员
    const empty = state.party.find(m => m.id && !m.tankId);
    if (empty) empty.tankId = tankId;
  }

  function getTankByMember(memberId) {
    const m = state.party.find(x => x.id === memberId);
    if (!m || !m.tankId) return null;
    return state.tanks.find(t => t.tankId === m.tankId) || null;
  }
  function getActiveTank() {
    const hero = state.party[0];
    if (hero.tankId) {
      const t = state.tanks.find(x => x.tankId === hero.tankId);
      if (t && t.sp > 0) return t;
    }
    return state.tanks.find(t => t.sp > 0) || state.tanks[0] || null;
  }

  function tankLoad(tank) {
    const td = D.TANKS.find(t => t.id === tank.tankId);
    let w = 0;
    for (const k of ['main', 'sub', 'se', 'engine', 'c']) {
      const pid = tank.parts[k];
      if (!pid) continue;
      const list = k === 'main' ? D.PARTS.main : k === 'sub' ? D.PARTS.sub : k === 'se' ? D.PARTS.se : k === 'engine' ? D.PARTS.engine : D.PARTS.c;
      const p = list.find(x => x.id === pid);
      if (p) w += p.w;
    }
    w += tank.armor * 0.004;
    return w;
  }
  function tankOverweight(tank) {
    const td = D.TANKS.find(t => t.id === tank.tankId);
    const eng = D.PARTS.engine.find(e => e.id === tank.parts.engine);
    return tankLoad(tank) > (eng ? eng.load : 0);
  }

  /* ---------------- 战斗入口 ---------------- */
  function startBattle(mobs, opts) {
    state.screen = 'battle';
    state.base = state.map === 'world' ? 'world' : (D.TOWNS.find(t => t.id === state.map) ? 'town' : 'cave');
    Battle.start(mobs, opts || {});
  }
  function startBountyBattle(id, opts) {
    const b = D.BOUNTIES.find(x => x.id === id);
    if (!b) return;
    state.screen = 'battle';
    state.base = state.map === 'world' ? 'world' : (D.TOWNS.find(t => t.id === state.map) ? 'town' : 'cave');
    Battle.start([], Object.assign({bountyId: id}, opts || {}));
  }

  /* ---------------- 升级 ---------------- */
  function gainXP(xp) {
    const msgs = [];
    for (const m of state.party) {
      if (!m.id) continue;
      m.xp += xp;
      let ups = 0;
      while (m.xp >= D.xpNeed(m.lv)) {
        m.xp -= D.xpNeed(m.lv);
        m.lv++;
        const u = D.GROWTH[m.cls].up;
        m.maxHp += u.hp; m.atk += u.atk; m.def += u.def; m.spd += u.spd;
        m.hp = m.maxHp;
        ups++;
      }
      if (ups) msgs.push(m.name + ' 升到了 ' + m.lv + ' 级！');
    }
    return msgs;
  }

  /* ---------------- 结束/失败 ---------------- */
  function gameOver() {
    state.screen = 'gameover';
    AudioSys.playTrack(null);
    AudioSys.sfx('gameover');
  }

  function doEnding() {
    state.flags.noa_dead = true;
    state.flags.ending_seen = true;
    state.screen = 'ending';
    state.ending = {idx: 0, t: 0, done: false};
    saveGame();
    AudioSys.playTrack('ending');
  }

  /* ---------------- 音乐 ---------------- */
  function toggleMute() {
    AudioSys.setMuted(!AudioSys.isMuted());
  }
  const sfx = kind => AudioSys.sfx(kind);

  /* ============================================================
   * 界面：菜单 / 商店 / 密码
   * ============================================================ */

  function openMenu() {
    if (state.screen !== 'world' && state.screen !== 'town' && state.screen !== 'cave') return;
    state.base = state.screen;
    state.screen = 'menu';
    state.menu = {view: 'root', idx: 0};
    AudioSys.sfx('confirm');
  }

  const MENU_ITEMS = ['状态', '道具', '战车', '赏金', '记录', '设置'];

  function menuAct() {
    const m = state.menu;
    const sel = MENU_ITEMS[m.idx];
    if (sel === '状态') m.view = 'status';
    else if (sel === '道具') m.view = 'items';
    else if (sel === '战车') m.view = 'tanks';
    else if (sel === '赏金') m.view = 'bounty';
    else if (sel === '记录') { saveGame(); say(['存档完成。']); state.screen = state.base; state.menu = null; }
    else if (sel === '设置') m.view = 'options';
    AudioSys.sfx('confirm');
  }

  function openShop(type, building) {
    state.base = state.screen;
    state.screen = 'shop';
    state.shop = {type, name: building.name, town: state.map, tab: 0, idx: 0, msg: '', msgT: 0};
    AudioSys.playTrack('shop');
    AudioSys.sfx('confirm');
  }

  function openPassword() {
    state.base = state.screen;
    state.screen = 'password';
    state.pass = {pos: 0, digits: [0, 0, 0, 0]};
    AudioSys.sfx('confirm');
  }

  /* ============================================================
   * 主循环
   * ============================================================ */

  function update(dt) {
    if (!state) return;
    state.playtime += dt;
    if (state.bannerT > 0) state.bannerT -= dt;
    if (state.dialog) { updateDialog(dt); return; }
    switch (state.screen) {
      case 'title': updateTitle(dt); break;
      case 'intro': updateIntro(dt); break;
      case 'world': case 'town': case 'cave': World.update(dt); break;
      case 'battle':
        Battle.update(dt);
        break;
      case 'menu': updateMenu(dt); break;
      case 'shop': updateShop(dt); break;
      case 'password': updatePassword(dt); break;
      case 'ending': updateEnding(dt); break;
      case 'gameover': updateGameOver(dt); break;
    }
  }

  function updateTitle(dt) {
    state.titleT = (state.titleT || 0) + dt;
    const q = Eng.poll();
    for (const k of q) {
      if (state.jukebox) {
        const names = Object.keys(D.TRACKS);
        if (state.jukeIdx === undefined) state.jukeIdx = 0;
        if (k === 'up' || k === 'left') { state.jukeIdx = (state.jukeIdx + names.length - 1) % names.length; AudioSys.playTrack(names[state.jukeIdx]); AudioSys.sfx('cursor'); }
        if (k === 'down' || k === 'right') { state.jukeIdx = (state.jukeIdx + 1) % names.length; AudioSys.playTrack(names[state.jukeIdx]); AudioSys.sfx('cursor'); }
        if (k === 'a') { AudioSys.playTrack(names[state.jukeIdx]); AudioSys.sfx('confirm'); }
        if (k === 'b') { state.jukebox = false; state.titleMenu = 0; AudioSys.sfx('cancel'); }
        continue;
      }
      if (k === 'up' || k === 'left') { state.titleMenu = state.titleMenu === undefined ? 0 : (state.titleMenu + 2) % 3; AudioSys.sfx('cursor'); }
      if (k === 'down' || k === 'right') { state.titleMenu = state.titleMenu === undefined ? 0 : (state.titleMenu + 1) % 3; AudioSys.sfx('cursor'); }
      if (k === 'a') {
        const sel = state.titleMenu === undefined ? 0 : state.titleMenu;
        AudioSys.sfx('confirm');
        if (sel === 0) {
          if (hasSave()) {
            say(['已有存档。', '开始新游戏将覆盖存档，确定吗？'], () => newGame());
          } else newGame();
        } else if (sel === 1) {
          if (!loadGame()) say(['没有找到存档。']);
        } else if (sel === 2) {
          state.titleMenu = undefined;
          state.jukebox = true;
          AudioSys.playTrack('title');
        }
      }
      if (k === 'b' && state.jukebox) { state.jukebox = false; state.titleMenu = undefined; }
    }
  }

  function updateIntro(dt) {
    const it = state.intro;
    it.t += dt;
    const q = Eng.poll();
    for (const k of q) {
      if (k === 'a') {
        it.idx++;
        it.t = 0;
        AudioSys.sfx('cursor');
        if (it.idx >= INTRO.length) {
          startWorld();
        }
      }
    }
  }

  function startWorld() {
    state.screen = 'world';
    state.px = 25; state.py = 43;
    AudioSys.playTrack('field');
    say(['老战：……回来了？不，是离家出走。','老战：听着，小子。废土上能相信的只有战车和伙伴。','老战：南边的洞窟里，有一辆老战车。要当赏金猎人，就去开走它。','（拉多镇南侧洞窟……）']);
  }

  function updateDialog(dt) {
    const d = state.dialog;
    if (d.wait > 0) { d.wait -= dt; return; }
    d.reveal += dt * 40;
    const q = Eng.poll();
    for (const k of q) {
      if (k === 'a') { dialogNext(); return; }
      if (k === 'b') { dialogNext(); return; }
    }
  }

  function updateMenu(dt) {
    const m = state.menu;
    const q = Eng.poll();
    for (const k of q) {
      if (m.view === 'root') {
        if (k === 'up' || k === 'left') { m.idx = (m.idx + 5) % 6; AudioSys.sfx('cursor'); }
        if (k === 'down' || k === 'right') { m.idx = (m.idx + 1) % 6; AudioSys.sfx('cursor'); }
        if (k === 'a') menuAct();
        if (k === 'b') { closeMenu(); return; }
      } else {
        menuSubview(k);
      }
    }
  }

  function closeMenu() {
    state.screen = state.base;
    state.menu = null;
    AudioSys.sfx('cancel');
  }

  function menuSubview(k) {
    const m = state.menu;
    const view = m.view;
    if (view === 'status') {
      if (k === 'b' || k === 'a') { m.view = 'root'; AudioSys.sfx('cancel'); }
    } else if (view === 'items') {
      const ids = Object.keys(state.inventory.items).filter(id => state.inventory.items[id] > 0);
      if (k === 'b') { m.view = 'root'; AudioSys.sfx('cancel'); return; }
      if (k === 'up') { m.idx = (m.idx + ids.length - 1) % Math.max(1, ids.length); AudioSys.sfx('cursor'); }
      if (k === 'down') { m.idx = (m.idx + 1) % Math.max(1, ids.length); AudioSys.sfx('cursor'); }
      if (k === 'a' && ids.length) {
        const id = ids[m.idx];
        const it = D.ITEMS[id];
        if (it.hp) {
          const target = state.party.filter(x => x.id && x.hp < x.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          if (target) { target.hp = Math.min(target.maxHp, target.hp + it.hp); state.inventory.items[id]--; AudioSys.sfx('heal'); say([target.name + ' 恢复了 ' + it.hp + ' HP。']); }
          else say(['HP 已经全满。']);
        } else if (it.repair) {
          const tank = getActiveTank();
          if (tank && tank.sp < D.TANKS.find(t => t.id === tank.tankId).sp) {
            tank.sp = Math.min(D.TANKS.find(t => t.id === tank.tankId).sp, tank.sp + it.repair);
            state.inventory.items[id]--;
            AudioSys.sfx('heal');
            say(['战车 SP 恢复了 ' + it.repair + '。']);
          } else say(['战车状态良好。']);
        }
      }
    } else if (view === 'tanks') {
      if (k === 'b') { m.view = 'root'; AudioSys.sfx('cancel'); return; }
      const opts = ['乘降战车', ...state.party.filter(x => x.id).map(x => x.name + ' 的战车'), '返回'];
      if (k === 'up') { m.idx = (m.idx + opts.length - 1) % opts.length; AudioSys.sfx('cursor'); }
      if (k === 'down') { m.idx = (m.idx + 1) % opts.length; AudioSys.sfx('cursor'); }
      if (k === 'a') {
        if (m.idx === 0) {
          state.riding = !state.riding;
          AudioSys.sfx('confirm');
        } else if (m.idx === opts.length - 1) { m.view = 'root'; m.idx = 2; AudioSys.sfx('cancel'); }
        else {
          const members = state.party.filter(x => x.id);
          const member = members[m.idx - 1];
          if (member) {
            m.assignMember = member.name;
            m.view = 'tankassign';
            m.idx = 0;
          }
        }
      }
    } else if (view === 'tankassign') {
      if (k === 'b') { m.view = 'tanks'; m.idx = 0; AudioSys.sfx('cancel'); return; }
      const member = state.party.find(x => x.name === m.assignMember);
      const owned = state.tanks.map(t => t.tankId);
      const opts = ['徒步', ...owned.map(id => D.TANKS.find(t => t.id === id).name)];
      if (k === 'up') { m.idx = (m.idx + opts.length - 1) % opts.length; AudioSys.sfx('cursor'); }
      if (k === 'down') { m.idx = (m.idx + 1) % opts.length; AudioSys.sfx('cursor'); }
      if (k === 'a') {
        member.tankId = m.idx === 0 ? null : owned[m.idx - 1];
        AudioSys.sfx('confirm');
        m.view = 'tanks'; m.idx = 1;
      }
    } else if (view === 'bounty') {
      if (k === 'b') { m.view = 'root'; AudioSys.sfx('cancel'); return; }
      if (k === 'a') { claimAll(); }
    } else if (view === 'options') {
      if (k === 'b') { m.view = 'root'; AudioSys.sfx('cancel'); return; }
      if (k === 'a') {
        if (m.idx === 0) toggleMute();
        else if (m.idx === 1) {
          state.screen = 'title';
          state.menu = null;
          state.titleMenu = 0;
          state.titleT = 0;
          AudioSys.playTrack('title');
        }
      }
      if (k === 'up' || k === 'left') { m.idx = (m.idx + 1) % 2; AudioSys.sfx('cursor'); }
      if (k === 'down' || k === 'right') { m.idx = (m.idx + 1) % 2; AudioSys.sfx('cursor'); }
    }
  }

  function claimAll() {
    const s = state;
    let total = 0;
    for (const b of D.BOUNTIES) {
      if (s.bounties.killed[b.id] && !s.bounties.claimed[b.id]) {
        s.bounties.claimed[b.id] = true;
        total += b.gold;
      }
    }
    if (total) { s.gold += total; AudioSys.sfx('cash'); say(['领取了 ' + Eng.fmtG(total) + 'G 赏金！']); }
    else say(['没有可领取的赏金。']);
  }

  /* ---------------- 商店 ---------------- */
  function shopList() {
    const sh = state.shop;
    if (sh.type === 'weapon') {
      const cfg = D.SHOPS[sh.town].weapon;
      const tabs = ['道具', '主炮', '副炮', 'S-E', '发动机', 'C装置', '卖出', '退出'];
      if (sh.tab < 6) {
        if (sh.tab === 0) return {list: cfg.items.map(id => ({id, name: D.ITEMS[id].name, price: D.ITEMS[id].price})), kind: 'item'};
        const pkey = ['main', 'sub', 'se', 'engine', 'c'][sh.tab - 1];
        return {list: cfg[pkey].map(id => ({id, name: D.PARTS[pkey].find(p => p.id === id).name, price: D.PARTS[pkey].find(p => p.id === id).price})), kind: 'part', pkey};
      }
      if (sh.tab === 6) {
        const list = [];
        for (const id in state.inventory.items) if (state.inventory.items[id] > 0) list.push({id, name: D.ITEMS[id].name, price: Math.floor(D.ITEMS[id].price / 2), kind: 'item'});
        for (const id in state.inventory.parts) if (state.inventory.parts[id] > 0) {
          const p = allParts().find(x => x.id === id);
          if (p) list.push({id, name: p.name, price: Math.floor(p.price / 2), kind: 'part'});
        }
        return {list, kind: 'sell'};
      }
      return {list: [], kind: 'none'};
    }
    if (sh.type === 'tank') {
      const cfg = D.SHOPS[sh.town].tank;
      const list = cfg.sell.filter(id => !state.tanks.some(t => t.tankId === id)).map(id => {
        const t = D.TANKS.find(x => x.id === id);
        return {id, name: t.name, price: t.price};
      });
      return {list, kind: 'tank'};
    }
    if (sh.type === 'mod') {
      const tanks = state.tanks;
      if (!tanks.length) return {list: [], kind: 'none'};
      if (!sh.tankSel) sh.tankSel = 0;
      const tank = tanks[sh.tankSel];
      return {list: tanks.map((t, i) => ({id: i, name: D.TANKS.find(x => x.id === t.tankId).name, price: 0, cur: i === sh.tankSel})), kind: 'modsel'};
    }
    return {list: [], kind: 'none'};
  }

  function allParts() {
    return D.PARTS.main.concat(D.PARTS.sub, D.PARTS.se, D.PARTS.engine, D.PARTS.c);
  }

  function updateShop(dt) {
    const sh = state.shop;
    if (sh.msgT > 0) sh.msgT -= dt;
    const q = Eng.poll();
    const lst = shopList();
    const list = lst.list;
    for (const k of q) {
      if (sh.type === 'weapon') {
        const tabs = ['道具', '主炮', '副炮', 'S-E', '发动机', 'C装置', '卖出', '退出'];
        if (k === 'left') { sh.tab = (sh.tab + 7) % 8; sh.idx = 0; AudioSys.sfx('cursor'); }
        if (k === 'right') { sh.tab = (sh.tab + 1) % 8; sh.idx = 0; AudioSys.sfx('cursor'); }
        if (k === 'up') { sh.idx = (sh.idx + Math.max(1, list.length) - 1) % Math.max(1, list.length); AudioSys.sfx('cursor'); }
        if (k === 'down') { sh.idx = (sh.idx + 1) % Math.max(1, list.length); AudioSys.sfx('cursor'); }
        if (k === 'a') {
          if (sh.tab === 7) { closeShop(); return; }
          if (sh.tab === 6) {
            const it = list[sh.idx];
            if (it) {
              if (it.kind === 'item') { state.inventory.items[it.id]--; state.gold += it.price; sh.msg = '卖出 ' + it.name + '，+'+Eng.fmtG(it.price)+'G'; }
              else { state.inventory.parts[it.id]--; state.gold += it.price; sh.msg = '卖出 ' + it.name + '，+'+Eng.fmtG(it.price)+'G'; }
              AudioSys.sfx('cash'); sh.msgT = 1.2;
            }
          } else if (sh.tab === 0) {
            const it = list[sh.idx];
            if (it && state.gold >= it.price) { state.gold -= it.price; addItem(it.id); AudioSys.sfx('cash'); sh.msg = '购入 ' + it.name; sh.msgT = 1.2; }
            else if (it) { sh.msg = '资金不足！'; sh.msgT = 1.2; }
          } else {
            const it = list[sh.idx];
            if (it && state.gold >= it.price) { state.gold -= it.price; addPart(it.id); AudioSys.sfx('cash'); sh.msg = '购入 ' + it.name; sh.msgT = 1.2; }
            else if (it) { sh.msg = '资金不足！'; sh.msgT = 1.2; }
          }
        }
        if (k === 'b') { closeShop(); return; }
      } else if (sh.type === 'tank') {
        const opts = ['修理战车', '补给装甲片', '购买战车', '退出'];
        if (k === 'up') { sh.idx = (sh.idx + 3) % 4; AudioSys.sfx('cursor'); }
        if (k === 'down') { sh.idx = (sh.idx + 1) % 4; AudioSys.sfx('cursor'); }
        if (k === 'a') {
          if (sh.idx === 0) {
            const cost = state.tanks.reduce((s, t) => {
              const td = D.TANKS.find(x => x.id === t.tankId);
              return s + (td.sp - t.sp) + (td.armorCap - t.armor) * 2;
            }, 0);
            if (!state.tanks.length) { sh.msg = '没有战车。'; sh.msgT = 1.2; }
            else if (state.gold >= cost) {
              state.gold -= cost;
              for (const t of state.tanks) {
                const td = D.TANKS.find(x => x.id === t.tankId);
                t.sp = td.sp; t.armor = td.armorCap;
              }
              AudioSys.sfx('heal');
              sh.msg = '全部战车修理完毕！-' + Eng.fmtG(cost) + 'G'; sh.msgT = 1.5;
            } else { sh.msg = '资金不足（需 ' + Eng.fmtG(cost) + 'G）'; sh.msgT = 1.5; }
          } else if (sh.idx === 1) {
            let cost = 0;
            for (const t of state.tanks) {
              const td = D.TANKS.find(x => x.id === t.tankId);
              cost += (td.armorCap - t.armor) * 2;
            }
            if (!state.tanks.length) { sh.msg = '没有战车。'; sh.msgT = 1.2; }
            else if (state.gold >= cost) {
              state.gold -= cost;
              for (const t of state.tanks) {
                const td = D.TANKS.find(x => x.id === t.tankId);
                t.armor = td.armorCap;
              }
              AudioSys.sfx('cash');
              sh.msg = '装甲片补给完毕！-' + Eng.fmtG(cost) + 'G'; sh.msgT = 1.5;
            } else { sh.msg = '资金不足（需 ' + Eng.fmtG(cost) + 'G）'; sh.msgT = 1.5; }
          } else if (sh.idx === 2) {
            const it = list[sh.idx];
            if (it && state.gold >= it.price) {
              state.gold -= it.price;
              addTank(it.id);
              AudioSys.sfx('levelup');
              sh.msg = '购入 ' + it.name + '！'; sh.msgT = 1.5;
            } else if (it) { sh.msg = '资金不足！'; sh.msgT = 1.2; }
          } else { closeShop(); return; }
        }
        if (k === 'b') { closeShop(); return; }
      } else if (sh.type === 'mod') {
        updateMod(k);
      } else if (sh.type === 'inn') {
        if (k === 'up' || k === 'down') { sh.idx = (sh.idx + 1) % 2; AudioSys.sfx('cursor'); }
        if (k === 'a') {
          if (sh.idx === 0) {
            AudioSys.sfx('heal');
            for (const m of state.party) { if (m.id) m.hp = m.maxHp; }
            for (const t of state.tanks) {
              const td = D.TANKS.find(x => x.id === t.tankId);
              t.sp = td.sp; t.armor = td.armorCap;
            }
            saveGame();
            say(['一夜好眠。全队 HP 与战车完全回复。', '（存档完成）'], () => { closeShop(); });
          } else closeShop();
        }
        if (k === 'b') { closeShop(); return; }
      } else if (sh.type === 'bounty') {
        if (k === 'a') { claimAll(); }
        if (k === 'b') { closeShop(); return; }
      }
    }
  }

  function updateMod(k) {
    const sh = state.shop;
    const tanks = state.tanks;
    if (!tanks.length) { if (k === 'b') closeShop(); return; }
    if (sh.tab === undefined) sh.tab = 0;
    if (k === 'b') {
      if (sh.tab === 0) { closeShop(); return; }
      sh.tab = 0; sh.idx = 0; AudioSys.sfx('cancel'); return;
    }
    if (sh.tab === 0) {
      // 战车选择 + 功能选择
      const opts = ['更换装备', '装甲涂层', '查看状态'];
      if (k === 'up') { sh.tankSel = (sh.tankSel + tanks.length - 1) % tanks.length; AudioSys.sfx('cursor'); }
      if (k === 'down') { sh.tankSel = (sh.tankSel + 1) % tanks.length; AudioSys.sfx('cursor'); }
      if (k === 'left') { sh.idx = (sh.idx + 2) % 3; AudioSys.sfx('cursor'); }
      if (k === 'right') { sh.idx = (sh.idx + 1) % 3; AudioSys.sfx('cursor'); }
      if (k === 'a') {
        if (sh.idx === 0) sh.tab = 1;
        else if (sh.idx === 1) sh.tab = 3;
        else sh.tab = 4;
        sh.idx = 0;
        AudioSys.sfx('confirm');
      }
    } else if (sh.tab === 1) {
      const slots = ['主炮', '副炮', 'S-E', '发动机', 'C装置'];
      if (k === 'up') { sh.idx = (sh.idx + 4) % 5; AudioSys.sfx('cursor'); }
      if (k === 'down') { sh.idx = (sh.idx + 1) % 5; AudioSys.sfx('cursor'); }
      if (k === 'a') {
        sh.slot = ['main','sub','se','engine','c'][sh.idx];
        sh.tab = 2; sh.idx = 0;
        AudioSys.sfx('confirm');
      }
    } else if (sh.tab === 2) {
      const tank = tanks[sh.tankSel];
      const pkey = sh.slot;
      const list = D.PARTS[pkey];
      const owned = Object.keys(state.inventory.parts).filter(id => list.some(p => p.id === id));
      const cur = tank.parts[pkey];
      const all = [cur, ...owned.filter(id => id !== cur)];
      if (k === 'up') { sh.idx = (sh.idx + Math.max(1, all.length) - 1) % Math.max(1, all.length); AudioSys.sfx('cursor'); }
      if (k === 'down') { sh.idx = (sh.idx + 1) % Math.max(1, all.length); AudioSys.sfx('cursor'); }
      if (k === 'a' && all.length) {
        const newId = all[sh.idx];
        if (newId !== cur) {
          state.inventory.parts[newId]--;
          if (cur) addPart(cur);
          tank.parts[pkey] = newId;
          AudioSys.sfx('confirm');
          sh.msg = '换装完成！'; sh.msgT = 1.2;
        }
        sh.tab = 1; sh.idx = ['main','sub','se','engine','c'].indexOf(pkey);
      }
    } else if (sh.tab === 3) {
      // 装甲涂层
      const tank = tanks[sh.tankSel];
      const td = D.TANKS.find(x => x.id === tank.tankId);
      if (k === 'a') {
        if (tank.armor >= td.armorCap) { sh.msg = '装甲已满。'; sh.msgT = 1.2; }
        else if (state.gold >= 150) {
          state.gold -= 150;
          tank.armor = Math.min(td.armorCap, tank.armor + 50);
          AudioSys.sfx('cash');
          sh.msg = '+50 装甲片（' + tank.armor + '/' + td.armorCap + '）'; sh.msgT = 1.2;
        } else { sh.msg = '资金不足！'; sh.msgT = 1.2; }
      }
    } else if (sh.tab === 4) {
      if (k === 'a') { sh.tab = 0; AudioSys.sfx('cancel'); }
    }
  }

  function closeShop() {
    state.screen = state.base;
    state.shop = null;
    AudioSys.playTrack(state.map === 'world' ? 'field' : (D.TOWNS.find(t => t.id === state.map) ? 'town' : 'cave'));
    AudioSys.sfx('cancel');
  }

  /* ---------------- 密码 ---------------- */
  function updatePassword(dt) {
    const p = state.pass;
    const q = Eng.poll();
    for (const k of q) {
      if (k === 'left') { p.pos = (p.pos + 3) % 4; AudioSys.sfx('cursor'); }
      if (k === 'right') { p.pos = (p.pos + 1) % 4; AudioSys.sfx('cursor'); }
      if (k === 'up') { p.digits[p.pos] = (p.digits[p.pos] + 1) % 10; AudioSys.sfx('cursor'); }
      if (k === 'down') { p.digits[p.pos] = (p.digits[p.pos] + 9) % 10; AudioSys.sfx('cursor'); }
      if (k === 'a') {
        const code = p.digits.join('');
        const idx = D.PASSWORDS.indexOf(code);
        if (idx >= 0 && !state.flags['pass' + idx]) {
          state.flags['pass' + idx] = true;
          const done = [0,1,2,3].every(i => state.flags['pass' + i]);
          if (done) {
            state.flags.hell_open = true;
            AudioSys.sfx('levelup');
            state.screen = state.base;
            state.pass = null;
            say(['「密码认证通过——第 ' + (idx + 1) + ' 终端。」','「……全部密码已确认。」','「地狱门，开启。」']);
          } else {
            AudioSys.sfx('confirm');
            state.screen = state.base;
            state.pass = null;
            say(['「密码认证通过——第 ' + (idx + 1) + ' 终端。」','（还剩 ' + (4 - [0,1,2,3].filter(i => state.flags['pass' + i]).length) + ' 个终端需要认证。）']);
          }
        } else {
          AudioSys.sfx('alarm');
          say(['「密码错误。警告：防御系统启动中……」','（好在守卫没有发现你。）']);
        }
      }
      if (k === 'b') {
        state.screen = state.base;
        state.pass = null;
        AudioSys.sfx('cancel');
      }
    }
  }

  /* ---------------- 结局/游戏结束 ---------------- */
  function updateEnding(dt) {
    const e = state.ending;
    e.t += dt;
    const q = Eng.poll();
    for (const k of q) {
      if (k === 'a' && e.t > 0.5) {
        e.idx++;
        e.t = 0;
        if (e.idx >= ENDING.length) {
          state.screen = 'title';
          state.titleMenu = 0;
          state.titleT = 0;
          state.ending = null;
          AudioSys.playTrack('title');
        }
      }
    }
  }

  function updateGameOver(dt) {
    state.goT = (state.goT || 0) + dt;
    const q = Eng.poll();
    for (const k of q) {
      if ((k === 'a' || k === 'b') && state.goT > 1) {
        state.screen = 'title';
        state.titleMenu = 0;
        state.titleT = 0;
        state.goT = 0;
        AudioSys.playTrack('title');
      }
    }
  }

  /* ============================================================
   * 渲染
   * ============================================================ */

  function render() {
    if (!state) return;
    switch (state.screen) {
      case 'title': renderTitle(); break;
      case 'intro': renderIntro(); break;
      case 'world': case 'town': case 'cave':
        World.render();
        if (state.dialog) renderDialog();
        renderBanner();
        break;
      case 'battle':
        Battle.render();
        if (state.dialog) renderDialog();
        break;
      case 'menu':
        World.render();
        renderMenu();
        if (state.dialog) renderDialog();
        break;
      case 'shop':
        World.render();
        renderShop();
        if (state.dialog) renderDialog();
        break;
      case 'password':
        World.render();
        renderPassword();
        if (state.dialog) renderDialog();
        break;
      case 'ending': renderEnding(); break;
      case 'gameover': renderGameOver(); break;
    }
  }

  function renderTitle() {
    Eng.clear('#0a0a14');
    // 背景星空
    const t = state.titleT || 0;
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + Math.sin(t * 0.4 + i) * 8) % 320;
      const y = (i * 53 + Math.cos(t * 0.3 + i) * 6) % 180;
      Eng.rect(x, y, 2, 2, i % 3 ? '#2a2a44' : '#404064');
    }
    // 地平线废土
    Eng.rect(0, 176, 320, 64, '#141418');
    for (let i = 0; i < 8; i++) Eng.rect(10 + i * 44, 176, 22, 4 + (i % 3) * 3, '#1c1c26');
    Eng.rect(0, 196, 320, 2, '#242430');
    // 标题
    Eng.text('重装机兵', 160, 44, '#e0c878', 34, 'center', true);
    Eng.text('荒野的赏金猎人', 160, 84, '#a0d0a0', 14, 'center');
    Eng.text('— METAL MAX TRIBUTE —', 160, 104, '#707088', 9, 'center');
    const menu = ['开始新游戏', '继续冒险', '音乐室'];
    const sel = state.titleMenu === undefined ? 0 : state.titleMenu;
    menu.forEach((m, i) => {
      Eng.text(m, 160, 142 + i * 18, sel === i ? '#f8e048' : '#b8b8c8', 13, 'center');
      Eng.cursor(115, 142 + i * 18, sel === i);
    });
    if (state.jukebox) renderJukebox();
    if (state.dialog) renderDialog();
    Eng.text('方向键选择  Z 确认  M 静音', 160, 226, '#5a5a74', 9, 'center');
  }

  function renderJukebox() {
    Eng.window_(30, 30, 260, 170);
    Eng.text('音乐室', 160, 36, '#f8e048', 14, 'center', true);
    const names = Object.keys(D.TRACKS);
    if (state.jukeIdx === undefined) state.jukeIdx = 0;
    if (state.titleMenu === undefined) state.titleMenu = 0;
    // 简化：用上下键在 title 选择音乐
    const lines = names.map(n => D.TRACKS[n]);
    lines.forEach((n, i) => {
      if (i < 9) Eng.text((state.jukeIdx === i ? '▶' : ' ') + n, 46, 56 + i * 15, state.jukeIdx === i ? '#f8e048' : '#c8c8d8', 11);
    });
    Eng.text('A 播放  B 返回', 160, 194, '#8890a0', 10, 'center');
  }

  function renderIntro() {
    Eng.clear('#000');
    const it = state.intro;
    const shown = INTRO.slice(0, it.idx + 1);
    shown.forEach((ln, i) => {
      Eng.text(ln, 160, 70 + i * 16, '#c8c8d8', 13, 'center');
    });
    if (it.idx >= INTRO.length - 1) Eng.text('— 按 Z 开始 —', 160, 200, '#f8e048', 12, 'center');
  }

  function renderDialog() {
    const d = state.dialog;
    Eng.window_(4, 158, 312, 78);
    const full = d.texts[d.idx];
    const n = Math.floor(d.reveal);
    const shown = full.slice(0, n);
    const lines = Eng.textW(shown, 12, 166, 290, 12);
    lines.forEach((ln, i) => Eng.text(ln, 12, 168 + i * 15, '#f0f0f8', 12));
    if (n >= full.length) {
      if (d.idx < d.texts.length - 1) Eng.text('▼', 304, 226, '#f8e048', 10);
      else Eng.text('▼', 304, 226, '#f8e048', 10);
    }
  }

  function renderBanner() {
    if (state.bannerT > 0) {
      const a = state.bannerT;
      const alpha = Math.min(1, a * 2);
      Eng.window_(70, 108, 180, 26);
      Eng.text(state.bannerText, 160, 114, '#f8e8b0', 13, 'center', true);
    }
  }

  function renderMenu() {
    const m = state.menu;
    const view = m.view;
    // 左菜单
    Eng.window_(4, 30, 120, 130);
    Eng.text('菜单', 10, 36, '#f8e048', 12, undefined, true);
    MENU_ITEMS.forEach((it, i) => {
      const on = view === 'root' && m.idx === i;
      Eng.text(it, 22, 54 + i * 16, on ? '#f8e048' : '#d0d0d8', 12);
      if (on) Eng.cursor(10, 54 + i * 16, true);
    });
    if (view === 'root') return;
    // 子视图
    if (view === 'status') {
      Eng.window_(128, 30, 188, 170);
      Eng.text('状态', 134, 36, '#f8e048', 12, undefined, true);
      let y = 52;
      for (const p of state.party) {
        if (!p.id) continue;
        Eng.text(p.name + ' Lv.' + p.lv, 134, y, '#fff', 11);
        Eng.text('HP ' + p.hp + '/' + p.maxHp, 134, y + 13, '#78d878', 10);
        Eng.text('攻' + p.atk + ' 防' + p.def + ' 速' + p.spd, 134, y + 25, '#a8b8c8', 10);
        Eng.text('EXP ' + p.xp + '/' + D.xpNeed(p.lv), 134, y + 37, '#c8a8e8', 10);
        y += 52;
      }
      Eng.text('B 返回', 134, 190, '#8890a0', 10);
    } else if (view === 'items') {
      Eng.window_(128, 30, 188, 170);
      Eng.text('道具', 134, 36, '#f8e048', 12, undefined, true);
      const ids = Object.keys(state.inventory.items).filter(id => state.inventory.items[id] > 0);
      ids.forEach((id, i) => {
        const it = D.ITEMS[id];
        const on = m.idx === i;
        Eng.text(it.name + ' ×' + state.inventory.items[id], 142, 54 + i * 16, on ? '#f8e048' : '#d0d0d8', 11);
        if (on) Eng.cursor(134, 54 + i * 16, true);
      });
      if (!ids.length) Eng.text('（空）', 142, 54, '#8890a0', 11);
      Eng.text('B 返回', 134, 190, '#8890a0', 10);
    } else if (view === 'tanks') {
      Eng.window_(128, 30, 188, 170);
      Eng.text('战车', 134, 36, '#f8e048', 12, undefined, true);
      const opts = ['【' + (state.riding ? '乘坐中' : '徒步中') + '】乘降切换', ...state.party.filter(x => x.id).map(x => x.name + '：' + (x.tankId ? D.TANKS.find(t => t.id === x.tankId).name : '徒步')), '返回'];
      opts.forEach((it, i) => {
        const on = m.idx === i;
        Eng.text(it.length > 13 ? it.slice(0, 12) + '…' : it, 142, 54 + i * 16, on ? '#f8e048' : '#d0d0d8', 11);
        if (on) Eng.cursor(134, 54 + i * 16, true);
      });
      if (m.view === 'tankassign') {
        Eng.window_(60, 90, 200, 110);
        const member = state.party.find(x => x.name === m.assignMember);
        const owned = state.tanks.map(t => t.tankId);
        const opts2 = ['徒步', ...owned.map(id => D.TANKS.find(t => t.id === id).name)];
        Eng.text(member.name + ' 的座驾', 160, 96, '#f8e048', 11, 'center');
        opts2.forEach((it, i) => {
          const on = m.idx === i;
          Eng.text(it, 160, 112 + i * 14, on ? '#f8e048' : '#d0d0d8', 11, 'center');
        });
      }
    } else if (view === 'bounty') {
      Eng.window_(128, 30, 188, 170);
      Eng.text('赏金榜（按 Z 领取）', 134, 36, '#f8e048', 10, undefined, true);
      let y = 52;
      for (const b of D.BOUNTIES) {
        const killed = state.bounties.killed[b.id];
        const claimed = state.bounties.claimed[b.id];
        const st = claimed ? '已领取' : killed ? '可领取!' : '未讨伐';
        const col = claimed ? '#707078' : killed ? '#f8e048' : '#c0c0d0';
        Eng.text(b.name + ' ' + Eng.fmtG(b.gold) + 'G', 134, y, col, 10);
        Eng.text(st, 280, y, killed && !claimed ? '#78e878' : '#8890a0', 10, 'right');
        y += 13;
        if (y > 190) break;
      }
    } else if (view === 'options') {
      Eng.window_(128, 30, 188, 170);
      Eng.text('设置', 134, 36, '#f8e048', 12, undefined, true);
      const opts = ['音乐：' + (AudioSys.isMuted() ? '关闭' : '开启'), '返回标题画面'];
      opts.forEach((it, i) => {
        const on = m.idx === i;
        Eng.text(it, 142, 54 + i * 20, on ? '#f8e048' : '#d0d0d8', 12);
        if (on) Eng.cursor(134, 54 + i * 20, true);
      });
      Eng.text('B 返回', 134, 190, '#8890a0', 10);
    }
  }

  function renderShop() {
    const sh = state.shop;
    Eng.window_(4, 8, 312, 96);
    Eng.text(sh.name, 12, 14, '#f8e048', 13, undefined, true);
    Eng.text('G ' + Eng.fmtG(state.gold), 308, 14, '#f8e048', 11, 'right');
    if (sh.type === 'weapon') {
      const tabs = ['道具', '主炮', '副炮', 'S-E', '发动机', 'C装置', '卖出', '退出'];
      Eng.text(tabs.map((t, i) => sh.tab === i ? '▸' + t : t).join('  '), 12, 32, '#c8d0d8', 10);
      const lst = shopList();
      lst.list.forEach((it, i) => {
        if (i > 6) return;
        const on = sh.idx === i;
        Eng.text(it.name, 20, 52 + i * 12, on ? '#f8e048' : '#d0d0d8', 11);
        Eng.text(Eng.fmtG(it.price) + 'G', 190, 52 + i * 12, '#a0e0a0', 10);
        if (on) Eng.cursor(10, 52 + i * 12, true);
      });
    } else if (sh.type === 'tank') {
      const opts = ['修理战车', '补给装甲片', '购买战车', '退出'];
      opts.forEach((it, i) => {
        const on = sh.idx === i;
        Eng.text(it, 24, 48 + i * 16, on ? '#f8e048' : '#d0d0d8', 12);
        if (on) Eng.cursor(12, 48 + i * 16, true);
      });
      if (sh.idx === 2) {
        const lst = shopList();
        let y = 116;
        lst.list.forEach(it => {
          Eng.text(it.name + ' ' + Eng.fmtG(it.price) + 'G', 20, y, '#d0d0d8', 11);
          y += 14;
        });
      }
    } else if (sh.type === 'mod') {
      renderModShop();
    } else if (sh.type === 'inn') {
      Eng.text('宿屋老板：要休息一晚吗？', 12, 48, '#d0d0d8', 12);
      const opts = ['睡觉（回复并存档）', '算了'];
      opts.forEach((it, i) => {
        const on = sh.idx === i;
        Eng.text(it, 24, 76 + i * 16, on ? '#f8e048' : '#d0d0d8', 12);
        if (on) Eng.cursor(12, 76 + i * 16, true);
      });
    } else if (sh.type === 'bounty') {
      Eng.text('—— 悬赏榜 ——  Z 领取全部', 12, 48, '#f8e048', 11);
      let y = 66;
      for (const b of D.BOUNTIES) {
        const killed = state.bounties.killed[b.id];
        const claimed = state.bounties.claimed[b.id];
        const st = claimed ? '✓已领' : killed ? '★可领' : '·';
        Eng.text(st + ' ' + b.name + ' ' + Eng.fmtG(b.gold) + 'G', 14, y, claimed ? '#788088' : killed ? '#f8e048' : '#c8c8d8', 10);
        Eng.text(b.loc, 150, y, '#7888a0', 9);
        y += 13;
      }
    }
    if (sh.msg && sh.msgT > 0) {
      Eng.window_(90, 200, 140, 24);
      Eng.text(sh.msg, 160, 206, '#f8e8b0', 11, 'center');
    }
    if (sh.type === 'bounty' || sh.type === 'mod') {
      Eng.text('B 返回', 308, 226, '#8890a0', 10, 'right');
    }
  }

  function renderModShop() {
    const sh = state.shop;
    const tanks = state.tanks;
    if (!tanks.length) { Eng.text('还没有战车。去洞窟里找找吧。', 12, 48, '#d0d0d8', 12); return; }
    const tank = tanks[sh.tankSel || 0];
    const td = D.TANKS.find(x => x.id === tank.tankId);
    Eng.text('选择战车：' + td.name, 12, 48, '#f8e048', 11);
    Eng.text('装甲 ' + tank.armor + '/' + td.armorCap + '  SP ' + tank.sp + '/' + td.sp, 12, 62, '#a8d8a8', 10);
    const load = tankLoad(tank);
    const eng = D.PARTS.engine.find(e => e.id === tank.parts.engine);
    const over = tankOverweight(tank);
    Eng.text('载重 ' + load.toFixed(1) + '/' + eng.load + 't' + (over ? ' [超重!]' : ''), 12, 74, over ? '#f07070' : '#c8d0d8', 10);
    if (sh.tab === 0) {
      const opts = ['更换装备', '装甲涂层（150G/+50）', '查看状态'];
      opts.forEach((it, i) => {
        const on = sh.idx === i;
        Eng.text(it, 24, 96 + i * 18, on ? '#f8e048' : '#d0d0d8', 12);
        if (on) Eng.cursor(12, 96 + i * 18, true);
      });
      tanks.forEach((t, i) => {
        Eng.text((i === (sh.tankSel || 0) ? '▶' : ' ') + D.TANKS.find(x => x.id === t.tankId).name, 170, 50 + i * 14, '#c8c8d8', 10);
      });
    } else if (sh.tab === 1) {
      const slots = ['主炮', '副炮', 'S-E', '发动机', 'C装置'];
      Eng.text('选择改造部位：', 12, 96, '#c8d0d8', 11);
      slots.forEach((s, i) => {
        const pid = tank.parts[['main','sub','se','engine','c'][i]];
        const p = allParts().find(x => x.id === pid);
        const on = sh.idx === i;
        Eng.text(s + '：' + (p ? p.name : '无'), 24, 112 + i * 14, on ? '#f8e048' : '#d0d0d8', 11);
        if (on) Eng.cursor(12, 112 + i * 14, true);
      });
    } else if (sh.tab === 2) {
      const pkey = sh.slot;
      const list = D.PARTS[pkey];
      const owned = Object.keys(state.inventory.parts).filter(id => list.some(p => p.id === id));
      const cur = tank.parts[pkey];
      const all = [cur, ...owned.filter(id => id !== cur)];
      Eng.text('选择' + {main:'主炮',sub:'副炮',se:'S-E',engine:'发动机',c:'C装置'}[pkey] + '：', 12, 96, '#c8d0d8', 11);
      all.forEach((id, i) => {
        const p = list.find(x => x.id === id);
        if (!p) return;
        const on = sh.idx === i;
        Eng.text((id === cur ? '◆' : ' ') + p.name + (p.atk ? ' 攻' + p.atk : p.load ? ' 载' + p.load : p.acc ? ' 命+' + p.acc : '') + (p.all ? '[全]' : ''), 20, 112 + i * 13, on ? '#f8e048' : '#d0d0d8', 10);
        if (on) Eng.cursor(10, 112 + i * 13, true);
      });
    } else if (sh.tab === 3) {
      Eng.text('装甲涂层：当前 ' + tank.armor + '/' + td.armorCap, 12, 100, '#d0d0d8', 12);
      Eng.text('按 Z 购买（150G / +50）', 12, 120, '#a8c8a8', 11);
      Eng.text('按 B 返回', 12, 140, '#8890a0', 10);
    } else if (sh.tab === 4) {
      let y = 100;
      Eng.text('装备一览：', 12, 100, '#f8e048', 11);
      y = 116;
      for (const k of ['main','sub','se','engine','c']) {
        const p = allParts().find(x => x.id === tank.parts[k]);
        Eng.text({main:'主炮',sub:'副炮',se:'S-E',engine:'发动机',c:'C装置'}[k] + ' ' + (p ? p.name : '无'), 16, y, '#d0d0d8', 10);
        y += 13;
      }
      Eng.text('按 Z/B 返回', 12, 190, '#8890a0', 10);
    }
  }

  function renderPassword() {
    Eng.window_(70, 70, 180, 96);
    Eng.text('地狱门终端', 160, 78, '#f8e048', 13, 'center', true);
    Eng.text('请输入 4 位密码', 160, 98, '#c8d0d8', 11, 'center');
    const p = state.pass;
    const code = p.digits.join('');
    const entered = [0,1,2,3].filter(i => state.flags['pass' + i]).length;
    Eng.text('已认证 ' + entered + '/4', 160, 112, '#a8c8a8', 10, 'center');
    code.split('').forEach((ch, i) => {
      const on = p.pos === i;
      Eng.window_(96 + i * 36, 128, 30, 26);
      Eng.text(ch, 111 + i * 36, 132, on ? '#f8e048' : '#ffffff', 16, 'center', true);
    });
    Eng.text('↑↓改数字 ←→移动  Z确定', 160, 158, '#8890a0', 9, 'center');
  }

  function renderEnding() {
    Eng.clear('#05050a');
    const e = state.ending;
    const shown = ENDING.slice(0, e.idx + 1);
    const startY = Math.max(30, 118 - shown.length * 8);
    shown.forEach((ln, i) => {
      if (!ln) return;
      Eng.text(ln, 160, startY + i * 16, ln.includes('完') || ln.includes('致敬') ? '#e8c878' : '#c8c8d8', 13, 'center');
    });
    if (e.idx >= ENDING.length - 1) Eng.text('— 按 Z 返回标题 —', 160, 220, '#f8e048', 11, 'center');
  }

  function renderGameOver() {
    Eng.clear('#0a0505');
    Eng.text('游 戏 结 束', 160, 100, '#d84848', 24, 'center', true);
    Eng.text('战车报废了……但传说不会结束。', 160, 140, '#a8a8b8', 11, 'center');
    if (state.goT > 1.2) Eng.text('— 按 Z 返回标题 —', 160, 180, '#f8e048', 11, 'center');
  }

  /* ---------------- 主循环 ---------------- */
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function boot(canvas) {
    Eng.init(canvas);
    window.__G = G; // 调试/自动化测试句柄
    state = {
      screen: 'title',
      titleMenu: 0,
      titleT: 0
    };
    AudioSys.playTrack('title');
    const params = new URLSearchParams(location.search);
    const dbg = params.get('debug');
    if (dbg) {
      newGame();
      state.screen = 'world';
      state.intro = null;
      state.party[1].id = 'mecha';
      state.party[2].id = 'wolf';
      addTank('t1');
      addTank('t4');
      addTank('t7');
      state.gold = 999999;
      state.riding = true;
      if (dbg === 'battle') startBountyBattle('water', {});
      else if (dbg === 'boss') startBountyBattle('noa', {final: true});
      else if (dbg === 'menu') openMenu();
      else if (dbg === 'shop') { World.enterTown('odo'); openShop('mod', {name: '改造工房'}); }
      else if (dbg === 'weapon') { World.enterTown('sold'); openShop('weapon', {name: '武器店'}); }
      else if (dbg === 'bounty') { World.enterTown('pobb'); openShop('bounty', {name: '情报屋'}); }
      else if (dbg === 'pass') { World.enterWorld(52, 4); openPassword(); }
      else if (dbg === 'town') World.enterTown('rado');
      else if (dbg === 'cave') World.enterCave('cave1');
      else { AudioSys.playTrack('field'); }
    }
    requestAnimationFrame(frame);
  }

  const api = {
    boot, newGame, loadGame, saveGame, hasSave, say, banner, sfx, toggleMute,
    addItem, addPart, addTank, getTankByMember, getActiveTank, tankLoad, tankOverweight,
    startBattle, startBountyBattle, gainXP, gameOver, doEnding,
    openMenu, openShop, openPassword, getTankOfMember: getTankByMember, update, render
  };
  Object.defineProperty(api, 'state', { get: () => state, enumerable: true });
  return api;
})();

/* ---------------- 启动 ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  const cv = document.getElementById('game');
  G.boot(cv);
});
