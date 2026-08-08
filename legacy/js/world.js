/* ============================================================
 * 探索系统：世界地图 / 城镇 / 洞窟 / 对话 / 商店 / 剧情事件
 * ============================================================ */
const World = (() => {

  const D = DATA;
  const townGrids = {};
  const caveGrids = {};
  const BOUNTY_REGION = {
    water:'pobb', ghost:'pobb', alien:'odo', bolt:'sold',
    waroo:'tarr', mystery:'eden', ark:'desert'
  };
  const PASSWORDS = ['3864', '2917', '7350', '5102'];

  /* ---------------- 地图构建 ---------------- */
  function buildTown(t) {
    if (townGrids[t.id]) return townGrids[t.id];
    const [w, h] = t.size;
    const grid = Array.from({length: h}, () => Array(w).fill(' '));
    for (let x = 0; x < w; x++) { grid[0][x] = '#'; grid[h-1][x] = '#'; }
    for (let y = 0; y < h; y++) { grid[y][0] = '#'; grid[y][w-1] = '#'; }
    for (const b of t.buildings) {
      for (let y = b.y; y < b.y + b.h; y++)
        for (let x = b.x; x < b.x + b.w; x++)
          if (grid[y] && grid[y][x] !== undefined) grid[y][x] = 'B';
      grid[b.door[1]][b.door[0]] = 'd';
    }
    grid[h - 2][Math.floor(w/2)] = 'E'; // 出口
    const map = grid.map(r => r.join(''));
    townGrids[t.id] = {map, npcs: t.npcs, buildings: t.buildings,
      exit: [Math.floor(w/2), h - 2], size: [w, h]};
    return townGrids[t.id];
  }

  function buildCave(c) {
    if (caveGrids[c.id]) return caveGrids[c.id];
    const [w, h] = c.size;
    const grid = Array.from({length: h}, () => Array(w).fill('#'));
    const conn = (x0, y0, x1, y1) => {
      let [x, y] = [x0, y0];
      while (x !== x1 || y !== y1) {
        grid[y][x] = ' ';
        if (x !== x1 && (y === y1 || Math.abs(x-x1) >= Math.abs(y-y1))) x += x1>x0?1:-1;
        else y += y1>y0?1:-1;
      }
      grid[y][x] = ' ';
    };
    for (const r of c.rooms) {
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++)
          grid[y][x] = ' ';
    }
    for (let i = 1; i < c.rooms.length; i++) {
      const a = c.rooms[i-1], b = c.rooms[i];
      conn(a.x + a.w - 1, a.y + Math.floor(a.h/2), b.x, b.y + Math.floor(b.h/2));
    }
    for (const ch of c.chests) grid[ch.y][ch.x] = 'I';
    for (const ev of c.events) grid[ev.y][ev.x] = 'X';
    for (const ex of c.exits) {
      grid[ex.y][ex.x] = ex.next || ex.prev ? 'E' : 'E';
    }
    const map = grid.map(r => r.join(''));
    caveGrids[c.id] = {map, size: [w, h], cave: c};
    return caveGrids[c.id];
  }

  /* ---------------- 状态切换 ---------------- */
  function enterTown(id) {
    const t = D.TOWNS.find(x => x.id === id);
    const g = buildTown(t);
    G.state.map = id;
    G.state.px = g.exit[0];
    G.state.py = g.exit[1] - 1;
    G.state.facing = 0;
    G.state.riding = false;
    G.state.anim = null;
    G.state.inTown = id;
    G.banner(t.name);
    AudioSys.playTrack('town');
  }

  function enterCave(id) {
    const c = D.CAVES.find(x => x.id === id);
    const g = buildCave(c);
    G.state.map = id;
    const exit = c.exits[0];
    G.state.px = exit.x;
    G.state.py = exit.y;
    G.state.facing = 2;
    G.state.riding = false;
    G.state.anim = null;
    G.banner(c.name);
    AudioSys.playTrack('cave');
  }

  function enterWorld(x, y) {
    G.state.map = 'world';
    G.state.px = x;
    G.state.py = y;
    G.state.anim = null;
    G.state.inTown = null;
    if (G.state.tanks.some(t => t.sp > 0)) G.state.riding = true;
    AudioSys.playTrack('field');
  }

  /* ---------------- 移动 ---------------- */
  const DIRS = [[0,-1],[0,1],[-1,0],[1,0]]; // 0上 1下 2左 3右

  function tileAt(map, x, y) {
    const grid = map === 'world' ? D.WORLD : (map.startsWith('c') || map.startsWith('noa') || map.startsWith('factory') || map.startsWith('clinic') || map.startsWith('puru'))
      ? buildCave(D.CAVES.find(c => c.id === map)).map
      : buildTown(D.TOWNS.find(t => t.id === map)).map;
    if (!grid || y < 0 || y >= grid.length || x < 0 || x >= grid[y].length) return '#';
    return grid[y][x];
  }

  function isWalkable(map, x, y) {
    const ch = tileAt(map, x, y);
    if (map === 'world') {
      const t = D.TILE[ch];
      if (!t || !t.w) return false;
      if (ch === 'H' && !G.state.flags.hell_open) return false;
      return true;
    }
    if (ch === 'B' || ch === '#') return false;
    const npc = currentNpcAt(x, y);
    if (npc) return false;
    return true;
  }

  function currentNpcAt(x, y) {
    if (G.state.map === 'world') return null;
    const town = D.TOWNS.find(t => t.id === G.state.map);
    if (town) return town.npcs.find(n => n.x === x && n.y === y) || null;
    return null;
  }

  function tryMove(dt) {
    const s = G.state;
    if (s.anim) {
      s.anim.t += dt / 0.13;
      if (s.anim.t >= 1) {
        s.px = s.anim.tx; s.py = s.anim.ty;
        s.anim = null;
        onArrive();
      }
      return;
    }
    const q = Eng.poll();
    for (const k of q) {
      if (k === 'up') { s.facing = 0; s.moved = true; }
      else if (k === 'down') { s.facing = 1; s.moved = true; }
      else if (k === 'left') { s.facing = 2; s.moved = true; }
      else if (k === 'right') { s.facing = 3; s.moved = true; }
      else if (k === 'a') { interact(); return; }
      else if (k === 'b') { G.openMenu(); return; }
      else if (k === 'm') { G.toggleMute(); return; }
    }
    const held = ['up','down','left','right'].find(k => Eng.isHeld(k));
    if (held) {
      const dir = DIRS[['up','down','left','right'].indexOf(held)];
      if (isWalkable(s.map, s.px + dir[0], s.py + dir[1])) {
        s.anim = {fx:s.px, fy:s.py, tx:s.px + dir[0], ty:s.py + dir[1], t:0};
      }
    }
  }

  function onArrive() {
    const s = G.state;
    const ch = tileAt(s.map, s.px, s.py);
    if (s.map === 'world') {
      if (ch === 'D') {
        const town = D.TOWNS.find(t => t.door[0] === s.px && t.door[1] === s.py);
        if (town) { enterTown(town.id); return; }
      }
      if (ch === 'C') {
        const cave = D.CAVES.find(c => c.exits[0] && c.exits[0].world[0] === s.px && c.exits[0].world[1] === s.py);
        if (cave) { enterCave(cave.id); return; }
      }
      if (ch === 'N') {
        if (!G.state.flags.hell_open) { G.say(['诺亚大楼的大门紧闭着。','恐怕只有通过地狱门才能抵达那里。']); return; }
        enterCave('noa1'); return;
      }
      if (ch === 'H') {
        if (G.state.flags.hell_open) return;
        G.say(['地狱门的终端发出幽光。','需要输入密码才能通过……']);
        return;
      }
      // 遇敌
      if (ch !== 't' && ch !== 'D') tryEncounter();
    } else if (s.map !== 'world' && (s.map.startsWith('noa') || ['cave1','factory','clinic','puru_cave'].includes(s.map))) {
      // 洞窟
      if (ch === 'I') { openChestAt(s.px, s.py); }
      else if (ch === 'X') { caveEventAt(s.px, s.py); }
      else if (ch === 'E') { caveExitAt(s.px, s.py); }
      else tryEncounter(0.05);
    }
    // 城镇：踩门/出口
    const town = D.TOWNS.find(t => t.id === s.map);
    if (town) {
      const g = buildTown(town);
      if (s.px === g.exit[0] && s.py === g.exit[1]) {
        enterWorld(town.door[0], town.door[1]);
        return;
      }
      const b = town.buildings.find(b => b.door[0] === s.px && b.door[1] === s.py);
      if (b) { enterBuilding(b); return; }
    }
  }

  /* ---------------- 交互 ---------------- */
  function facingTile() {
    const s = G.state;
    const d = DIRS[s.facing];
    return [s.px + d[0], s.py + d[1]];
  }

  function interact() {
    const s = G.state;
    if (s.anim) return;
    if (s.map === 'world') {
      const [x, y] = facingTile();
      const ch = tileAt('world', x, y);
      if (ch === 'H') { G.state.px = s.px; G.openPassword(); return; }
      if (ch === 'D') return; // 走过去即可
      return;
    }
    const town = D.TOWNS.find(t => t.id === s.map);
    if (town) {
      const [x, y] = facingTile();
      const npc = town.npcs.find(n => n.x === x && n.y === y);
      if (npc) { talkNpc(npc); return; }
      const b = town.buildings.find(b => b.door[0] === x && b.door[1] === y);
      if (b) { enterBuilding(b); return; }
      return;
    }
    // 洞窟
    const [x, y] = facingTile();
    const ch = tileAt(s.map, x, y);
    if (ch === 'I') { s.px = x; s.py = y; openChestAt(x, y); }
    else if (ch === 'X') { s.px = x; s.py = y; caveEventAt(x, y); }
    else if (ch === 'E') { s.px = x; s.py = y; caveExitAt(x, y); }
  }

  function caveExitAt(x, y) {
    const c = D.CAVES.find(c => c.id === G.state.map);
    if (!c) return;
    const ex = c.exits.find(e => e.x === x && e.y === y);
    if (!ex) return;
    if (ex.next) { enterCave(ex.next); return; }
    if (ex.prev) { enterCave(ex.prev); return; }
    if (ex.world) { enterWorld(ex.world[0], ex.world[1]); return; }
  }

  function caveEventAt(x, y) {
    const c = D.CAVES.find(c => c.id === G.state.map);
    if (!c) return;
    const ev = c.events.find(e => e.x === x && e.y === y);
    if (!ev) return;
    if (ev.type === 'tank') {
      const tank = D.TANKS.find(t => t.id === ev.tankId);
      if (G.state.tanks.some(t => t.tankId === ev.tankId)) { G.say(['这里已经空空如也。']); return; }
      G.addTank(ev.tankId);
      G.say(['你发现了『' + tank.name + '』！', '这辆战车虽然老旧，但还能开！', '（战车加入车库！）']);
      AudioSys.sfx('confirm');
      return;
    }
    if (ev.type === 'guard') {
      G.state.flags.factory_guard = true;
      G.startBattle(D.MONSTERS[ev.mob] ? [ev.mob, ev.mob] : ['robot', 'robot'], {
        boss: true, guard: true, text: ev.text || '守卫战车挡住了去路！'
      });
      return;
    }
    if (ev.type === 'boss') {
      const b = D.BOUNTIES.find(b => b.id === ev.bountyId);
      if (ev.bountyId === 'noa') {
        G.startBountyBattle('noa', {final: true});
      } else if (ev.bountyId === 'noa_guard') {
        G.state.flags.noa1_done = true;
        G.startBattle(['guard_bot', 'guard_bot'], {boss: true, text: ev.text});
      } else if (ev.bountyId === 'noa_laser') {
        G.state.flags.noa2_done = true;
        G.startBattle(['laser', 'laser'], {boss: true, text: ev.text});
      } else if (b) {
        G.startBountyBattle(b.id, {text: ev.text});
      }
      return;
    }
  }

  function openChestAt(x, y) {
    const c = D.CAVES.find(c => c.id === G.state.map);
    const chest = c && c.chests.find(ch => ch.x === x && ch.y === y);
    if (!chest) return;
    if (chest.done) return;
    chest.done = true;
    const grid = buildCave(c).map.map(r => r.split(''));
    grid[y][x] = ' ';
    caveGrids[c.id].map = grid.map(r => r.join(''));
    const it = D.ITEMS[chest.item] ? D.ITEMS[chest.item] : D.PARTS.main.find(p => p.id === chest.item) ||
      D.PARTS.engine.find(p => p.id === chest.item);
    if (D.ITEMS[chest.item]) G.addItem(chest.item);
    else G.addPart(chest.item);
    G.say(['获得『' + it.name + '』！']);
    AudioSys.sfx('cash');
  }

  function talkNpc(npc) {
    if (npc.talk.startsWith('story_')) { World.runStory(npc.talk); return; }
    const lines = D.DIALOGUE[npc.talk] || ['……'];
    G.say([npc.name + '：' + lines[0], ...lines.slice(1)]);
  }

  function enterBuilding(b) {
    AudioSys.sfx('confirm');
    G.state.shopTown = G.state.map;
    switch (b.type) {
      case 'weapon': G.openShop('weapon', b); break;
      case 'tankshop': G.openShop('tank', b); break;
      case 'modshop': G.openShop('mod', b); break;
      case 'inn': G.openShop('inn', b); break;
      case 'bounty': G.openShop('bounty', b); break;
      case 'story': World.runStory(b.story); break;
    }
  }

  /* ---------------- 遇敌 ---------------- */
  function regionOf(x, y) {
    for (const r of D.REGIONS) {
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r;
    }
    return D.REGIONS[0];
  }

  function tryEncounter(mult) {
    const s = G.state;
    if (s.anim) return;
    if (s.flags.no_encounter) return;
    let region;
    if (s.map === 'world') {
      const ch = D.WORLD[s.py][s.px];
      region = regionOf(s.px, s.py);
      const base = 0.075 * (D.TILE[ch].enc || 1) * (ch === 'r' ? 0.5 : 1);
      if (!Eng.chance(base)) return;
    } else {
      const c = D.CAVES.find(c => c.id === s.map);
      region = D.REGIONS.find(r => r.id === c.region) || D.REGIONS[0];
      if (!Eng.chance(0.055)) return;
    }
    // 区域赏金首随机遭遇
    const unkilled = D.BOUNTIES.filter(b => BOUNTY_REGION[b.id] === region.id && !G.state.bounties.killed[b.id] && !G.state.bounties.claimed[b.id]);
    if (unkilled.length && Eng.chance(0.09)) {
      G.startBountyBattle(unkilled[0].id);
      return;
    }
    const count = region.id === 'rado' ? Eng.ri(1, 2) : Eng.ri(1, 3);
    const mobs = [];
    for (let i = 0; i < count; i++) mobs.push(Eng.choice(region.mobs));
    G.startBattle(mobs, {});
  }

  /* ---------------- 剧情事件 ---------------- */
  const runStory = (() => {
    const stories = {};

    stories.story_rado_father = () => {
      const f = G.state.flags;
      if (f.kicked) {
        G.say(['老战：……工具带够了吗？','老战：要是在外面混不下去，就回来。']);
      } else {
        f.kicked = true;
        G.say(D.DIALOGUE.story_rado_father);
        G.sfx('confirm');
      }
    };

    stories.story_masaru_mecha = () => {
      const s = G.state;
      if (s.party[1].id) {
        G.say(['美娜：战车状态良好！记得常来麦镇补给！']);
        return;
      }
      G.say(D.DIALOGUE.story_masaru_mecha);
      s.party[1].id = 'mecha';
      G.sfx('levelup');
    };

    stories.story_pobb_wolf = () => {
      const s = G.state;
      const f = s.flags;
      if (s.party[2].id) {
        G.say(['红狼：哼，干得不错。']);
        return;
      }
      if (f.wolf_met) {
        G.say(['红狼：还愣着干什么？水怪等着你呢。']);
        return;
      }
      if (s.bounties.killed.water) {
        f.wolf_met = true;
        G.say(['红狼：……居然比我先一步。','红狼：有意思。小子，我跟你同行一阵。','（红狼 加入了队伍！）']);
        s.party[2].id = 'wolf';
        G.sfx('levelup');
      } else {
        G.say(['红狼：小子，你就是新来的猎人？','红狼：波布镇南边的湖里有水怪作乱。','红狼：有胆量的话，先去讨伐它再说。']);
      }
    };

    stories.rock_hospital = () => {
      const s = G.state;
      if (s.bounties.killed.marshal) {
        G.say(['医院里空无一人。马歇尔已经倒下了。']);
        return;
      }
      if (s.flags.marshal_fight) {
        G.say(['马歇尔：还没打够？再来！']);
        G.startBountyBattle('marshal', {text: '马歇尔从阴影中现身！'});
        return;
      }
      s.flags.marshal_fight = true;
      G.say(['医院深处传来咆哮声。','（你推开了锈迹斑斑的铁门……）']);
      G.startBountyBattle('marshal', {text: '马歇尔从阴影中现身！'});
    };

    stories.tarr_gomez = () => {
      const s = G.state;
      if (s.bounties.killed.gomez) {
        G.say(['藏身处一片狼藉。戈麦斯已经不在了。']);
        return;
      }
      if (!s.flags.gomez_fight) {
        s.flags.gomez_fight = true;
        if (s.party[2].id === 'wolf') {
          G.say(['红狼：……终于等到这一天了。','红狼：小子，这是我自己的战斗。','红狼：如果我输了，红狼战车就拜托你了。','（红狼独自走进了藏身处。你紧随其后……）']);
        } else {
          G.say(['藏身处大门轰然打开。','（戈麦斯的身影出现在阴影中……）']);
        }
        G.startBountyBattle('gomez', {text: '戈麦斯：杂碎，来送死了吗！'});
        return;
      }
      G.say(['藏身处大门紧闭。里面传来引擎的轰鸣。']);
    };

    return id => { if (stories[id]) stories[id](); };
  })();

  /* ---------------- 渲染 ---------------- */
  function render() {
    const s = G.state;
    if (s.map === 'world') renderWorld();
    else if (D.TOWNS.find(t => t.id === s.map)) renderTown();
    else renderCave();
    renderHUD();
  }

  function cam() {
    const s = G.state;
    const px = s.anim ? s.anim.fx + (s.anim.tx - s.anim.fx) * Math.min(1, s.anim.t) : s.px;
    const py = s.anim ? s.anim.fy + (s.anim.ty - s.anim.fy) * Math.min(1, s.anim.t) : s.py;
    const cx = Eng.clamp(Math.round(px) - 10, 0, Math.max(0, D.WORLD_W - 20));
    const cy = Eng.clamp(Math.round(py) - 8, 0, Math.max(0, D.WORLD_H - 15));
    return {px, py, cx, cy};
  }

  function renderWorld() {
    Eng.clear('#101418');
    const {px, py, cx, cy} = cam();
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 20; x++) {
        const wx = cx + x, wy = cy + y;
        if (wx >= 0 && wx < D.WORLD_W && wy >= 0 && wy < D.WORLD_H) {
          Eng.drawTile(D.WORLD[wy][wx], x, y, 16);
        }
      }
    }
    // 玩家
    const sx = (px - cx) * 16, sy = (py - cy) * 16;
    if (G.state.riding) {
      const tank = G.getActiveTank();
      if (tank) Eng.tankSprite(tank, sx - 24, sy - 22, 2, true);
    } else {
      Eng.sprite(D.SPR.hero, sx, sy - 12, 1);
    }
  }

  function renderTown() {
    Eng.clear('#0c1018');
    const town = D.TOWNS.find(t => t.id === G.state.map);
    const g = buildTown(town);
    const s = G.state;
    const px = s.anim ? s.anim.fx + (s.anim.tx - s.anim.fx) * Math.min(1, s.anim.t) : s.px;
    const py = s.anim ? s.anim.fy + (s.anim.ty - s.anim.fy) * Math.min(1, s.anim.t) : s.py;
    for (let y = 0; y < g.size[1]; y++) {
      for (let x = 0; x < g.size[0]; x++) {
        const ch = g.map[y][x];
        if (ch === 'B') {
          Eng.rect(x*16, y*16, 16, 16, '#6a4a32');
          Eng.rect(x*16, y*16, 16, 4, '#8a6240');
          Eng.rect(x*16+2, y*16+6, 12, 1, '#4a3420');
        } else if (ch === 'd') {
          Eng.rect(x*16, y*16, 16, 16, '#6a4a32');
          Eng.rect(x*16+4, y*16+6, 8, 10, '#3a2418');
        } else if (ch === '#') {
          Eng.rect(x*16, y*16, 16, 16, '#282c38');
          Eng.rect(x*16, y*16, 16, 2, '#3a4050');
        } else if (ch === 'E') {
          Eng.rect(x*16, y*16, 16, 16, '#282c38');
          Eng.rect(x*16+5, y*16+2, 6, 12, '#c8b070');
        } else {
          Eng.rect(x*16, y*16, 16, 16, '#3c3a30');
          if ((x+y) % 2 === 0) Eng.rect(x*16, y*16+12, 16, 4, '#3a382e');
        }
      }
    }
    for (const n of g.npcs) {
      Eng.sprite(D.SPR[n.sp] || D.SPR.npc_m, n.x*16, n.y*16 - 12, 1);
    }
    Eng.sprite(D.SPR.hero, px*16, py*16 - 12, 1);
  }

  function renderCave() {
    Eng.clear('#07070c');
    const c = D.CAVES.find(c => c.id === G.state.map);
    const g = buildCave(c);
    const s = G.state;
    const px = s.anim ? s.anim.fx + (s.anim.tx - s.anim.fx) * Math.min(1, s.anim.t) : s.px;
    const py = s.anim ? s.anim.fy + (s.anim.ty - s.anim.fy) * Math.min(1, s.anim.t) : s.py;
    const offX = Math.floor(Eng.clamp(px - 11, 0, Math.max(0, c.size[0] - 22)));
    const offY = Math.floor(Eng.clamp(py - 8, 0, Math.max(0, c.size[1] - 15)));
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 22; x++) {
        const wx = offX + x, wy = offY + y;
        const ch = wx >= 0 && wx < c.size[0] && wy >= 0 && wy < c.size[1] ? g.map[wy][wx] : '#';
        if (ch === '#') Eng.rect(x*16, y*16, 16, 16, '#181820');
        else if (ch === 'I') {
          Eng.rect(x*16, y*16, 16, 16, '#0d0d14');
          Eng.rect(x*16+3, y*16+4, 10, 7, '#b09048');
          Eng.rect(x*16+3, y*16+4, 10, 2, '#d8c070');
        } else if (ch === 'X') {
          Eng.rect(x*16, y*16, 16, 16, '#150d18');
          Eng.rect(x*16+2, y*16+6, 12, 4, '#a03040');
          Eng.rect(x*16+5, y*16+2, 6, 4, '#c04858');
        } else if (ch === 'E') {
          Eng.rect(x*16, y*16, 16, 16, '#0d0d14');
          Eng.rect(x*16+5, y*16+2, 6, 12, '#4058a0');
        } else {
          Eng.rect(x*16, y*16, 16, 16, '#10101c');
          if ((x+y) % 2 === 0) Eng.rect(x*16, y*16, 16, 1, '#141424');
        }
      }
    }
    Eng.sprite(D.SPR.hero, (px-offX)*16, (py-offY)*16 - 12, 1);
  }

  function renderHUD() {
    const s = G.state;
    const town = D.TOWNS.find(t => t.id === s.map);
    if (town) {
      Eng.text('— ' + town.name + ' —', 4, 2, '#e0d8a0', 11);
    }
    Eng.text('G ' + Eng.fmtG(G.state.gold), Eng.W - 4, 2, '#f8e048', 11, 'right');
    if (G.state.riding && s.map === 'world') {
      const t = G.getActiveTank();
      if (t) Eng.text(t.name, 4, Eng.H - 14, '#a8d8a8', 10);
    }
  }

  return { enterTown, enterCave, enterWorld, update: tryMove, render, runStory, tileAt, isWalkable };
})();
