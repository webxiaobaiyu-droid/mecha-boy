/* ============================================================
 * 回合制战斗系统（徒步 + 战车）
 * ============================================================ */
const Battle = (() => {

  const D = DATA;
  let st = null;

  /* ---------------- 初始化 ---------------- */
  function start(mobIds, opts) {
    opts = opts || {};
    const mobs = [];
    let i = 0;
    for (const id of mobIds) {
      const m = D.MONSTERS[id];
      if (!m) continue;
      const dx = 180 + (i % 3) * 52, dy = 36 + Math.floor(i / 3) * 42;
      mobs.push({
        def: m, id: id, name: m.name, tpl: m.tpl, colors: m.c,
        hp: m.hp, maxHp: m.hp, atk: m.atk, def: m.def, spd: m.spd,
        xp: m.xp, gold: m.gold, size: 1, x: dx, y: dy,
        isBoss: !!opts.boss
      });
      i++;
    }
    st = {
      mobs, opts, phase: 'intro', round: 0,
      order: [], qi: 0, pending: [], pendT: 0,
      cmd: null, mi: 0, ti: 0, itemIdx: 0,
      log: [], introT: 0, endT: 0,
      activeMember: null, done: false
    };
    // 队伍战斗者
    st.fighters = G.state.party.filter(p => p.id).map(p => {
      const tank = G.state.riding ? G.getTankByMember(p.id) : null;
      if (tank && tank.sp > 0) tank.tankDef = D.TANKS.find(t => t.id === tank.tankId);
      return {member: p, tank: tank && tank.sp > 0 ? tank : null};
    });
    st.anyTank = st.fighters.some(f => f.tank);
    G.state.flags.inBattle = true;
    if (opts.bountyId) {
      st.bounty = D.BOUNTIES.find(b => b.id === opts.bountyId);
      if (st.bounty) {
        st.mobs = [{
          def: st.bounty, id: st.bounty.id, name: st.bounty.name,
          tpl: st.bounty.tpl, colors: st.bounty.c,
          hp: st.bounty.hp, maxHp: st.bounty.hp,
          atk: st.bounty.atk, def: st.bounty.def, spd: st.bounty.spd,
          xp: st.bounty.xp, gold: 0, size: st.bounty.size || 1,
          x: 220, y: 40, isBoss: true, bountyId: st.bounty.id
        }];
      }
    }
    if (opts.text) {
      st.pending.push({kind: 'msg', text: opts.text, once: true});
    }
    const bossTrack = st.bounty || opts.boss ? (opts.final ? 'last' : 'boss') : 'battle';
    AudioSys.playTrack(bossTrack);
  }

  /* ---------------- 行动队列 ---------------- */
  function queueMsg(text) { st.pending.push({kind: 'msg', text}); }
  function queueAnim(anim) { st.pending.push({kind: 'anim', ...anim}); }

  function nextRound() {
    st.round++;
    const all = [];
    for (const f of st.fighters) {
      if (f.member.hp > 0) {
        all.push({side: 'p', f, spd: f.member.spd + (f.tank ? f.tank.tankDef.speed * 2 : 0)});
      }
    }
    for (const m of st.mobs) if (m.hp > 0) all.push({side: 'e', m, spd: m.spd});
    all.sort((a, b) => b.spd - a.spd || Math.random() - 0.5);
    if (!all.length) return; // 胜负已在 pending 中，等待结算
    st.order = all;
    st.qi = 0;
    st.cmd = null;
    advance();
  }

  function advance() {
    if (st.done) return;
    if (!st.order || !st.order.length) return;
    const cur = st.order[st.qi];
    if (!cur) { nextRound(); return; }
    if (cur.side === 'p' && cur.f.member.hp <= 0) { st.qi++; advance(); return; }
    if (cur.side === 'e' && cur.m.hp <= 0) { st.qi++; advance(); return; }
    if (cur.side === 'e') {
      enemyAct(cur);
      st.qi++;
      if (!st.done) advance();
    } else {
      st.cur = cur;
      st.cmd = {mode: 'menu', idx: 0};
    }
  }

  /* ---------------- 玩家命令 ---------------- */
  function playerMenu() {
    const f = st.cur.f;
    const tank = f.tank;
    const items = tank ? ['主炮', '副炮', 'S-E', '防御', '道具', '逃跑'] : ['攻击', '防御', '道具', '逃跑'];
    return items;
  }

  function confirmCmd() {
    const f = st.cur.f;
    const items = playerMenu();
    const sel = items[st.cmd.idx];
    const tank = f.tank;
    if (sel === '逃跑') {
      if (st.bounty || st.opts.boss) { queueMsg('无法逃跑！'); }
      else if (Eng.chance(0.65)) { queueMsg('成功逃跑了！'); st.pending.push({kind: 'end', win: false, fled: true}); }
      else { queueMsg('逃跑失败！'); }
      st.qi++;
      if (!st.done) advance();
      return;
    }
    if (sel === '防御') {
      f.guard = true;
      queueMsg(f.member.name + ' 摆出防御姿态。');
      st.qi++;
      if (!st.done) advance();
      return;
    }
    if (sel === '道具') {
      st.cmd = {mode: 'item', idx: 0};
      return;
    }
    // 攻击类：选目标
    const alive = st.mobs.filter(m => m.hp > 0);
    if (!alive.length) return;
    if (tank && sel === 'S-E') {
      const part = D.PARTS.se.find(p => p.id === tank.parts.se);
      if (!part) { queueMsg('没有装备 S-E 武器。'); return; }
      if (part.all) {
        for (const m of st.mobs) if (m.hp > 0) attackTarget(tank, m, 'se');
        st.qi++;
        if (!st.done) advance();
        return;
      }
      st.cmd = {mode: 'target', type: 'se', idx: 0};
      return;
    }
    if (tank) {
      const type = sel === '主炮' ? 'main' : 'sub';
      const part = D.PARTS[type === 'main' ? 'main' : 'sub'].find(p => p.id === tank.parts[type]);
      if (!part) { queueMsg(type === 'main' ? '没有装备主炮。' : '没有装备副炮。'); return; }
      st.cmd = {mode: 'target', type, idx: 0};
      return;
    }
    st.cmd = {mode: 'target', type: 'human', idx: 0};
  }

  function targetNext(dir) {
    const alive = st.mobs.map((m, i) => ({m, i})).filter(x => x.m.hp > 0);
    if (!alive.length) return;
    let idx = alive.findIndex(x => x.i === st.cmd.idx);
    idx = (idx + dir + alive.length) % alive.length;
    st.cmd.idx = alive[idx].i;
  }

  function confirmTarget() {
    const f = st.cur.f;
    const aliveIdx = st.mobs.map((m, i) => ({m, i})).filter(x => x.m.hp > 0);
    if (!aliveIdx.length) return;
    const pick = aliveIdx.find(x => x.i === st.cmd.idx) || aliveIdx[0];
    st.cmd.idx = pick.i;
    const target = st.mobs[st.cmd.idx];
    if (!target || target.hp <= 0) return;
    if (st.cmd.type === 'human') {
      attackTarget(f.member, target, 'human');
    } else {
      attackTarget(f.tank, target, st.cmd.type);
    }
    st.qi++;
    if (!st.done) advance();
  }

  function attackTarget(src, target, type) {
    let atk, name, weapon = null;
    if (type === 'human') {
      atk = src.atk;
      name = src.name + ' 发动攻击！';
      weapon = null;
    } else {
      const ptype = type === 'main' ? D.PARTS.main : type === 'sub' ? D.PARTS.sub : D.PARTS.se;
      weapon = ptype.find(p => p.id === src.parts[type]);
      if (!weapon) return;
      atk = weapon.atk;
      name = src.name + ' 的' + weapon.name + '开火！';
    }
    const acc = 0.88 + (weapon && weapon.acc ? weapon.acc / 100 : 0) +
      (type !== 'human' && src.parts && src.parts.c ? (D.PARTS.c.find(c => c.id === src.parts.c) || {}).acc / 100 : 0) -
      target.spd * 0.008;
    queueMsg(name);
    if (!Eng.chance(Math.max(0.35, acc))) {
      AudioSys.sfx('cancel');
      queueMsg('没有命中！');
      return;
    }
    let dmg = Math.max(1, Math.round(atk * Eng.rnd(0.92, 1.12) - target.def * 0.5));
    const crit = Eng.chance(0.08);
    if (crit) dmg = Math.round(dmg * 1.8);
    dmg = Math.min(dmg, target.hp);
    target.hp -= dmg;
    queueAnim({kind: 'hit', tx: target.x, ty: target.y, dmg, crit});
    if (crit) queueMsg('会心一击！' + dmg + ' 伤害！');
    else queueMsg(dmg + ' 伤害！');
    if (target.hp <= 0) {
      queueMsg(target.name + ' 被击倒了！');
      if (!st.winQueued && st.mobs.every(m => m.hp <= 0)) {
        st.winQueued = true;
        st.pending.push({kind: 'end', win: true});
      }
    }
  }

  /* ---------------- 敌人 AI ---------------- */
  function enemyAct(cur) {
    const m = cur.m;
    const targets = st.fighters.filter(f => f.member.hp > 0);
    if (!targets.length) return;
    const t = Eng.choice(targets);
    const viaTank = !!(t.tank && t.tank.sp > 0 && t.tank.armor > 0);
    if (m.isBoss && Eng.chance(0.3)) {
      queueMsg(m.name + ' 发动了特殊攻击！！');
      for (const f of st.fighters) {
        if (f.member.hp <= 0) continue;
        const dmg = Math.max(1, Math.round(m.atk * Eng.rnd(0.75, 0.95) - (f.tank && f.tank.armor > 0 ? f.tank.tankDef.def : f.member.def) * 0.4));
        damageParty(f, dmg);
      }
      return;
    }
    queueMsg(m.name + ' 扑了上来！');
    const dmg = Math.max(1, Math.round(m.atk * Eng.rnd(0.9, 1.1) - (viaTank ? t.tank.tankDef.def : t.member.def) * 0.5));
    damageParty(t, dmg);
  }

  function damageParty(f, dmg) {
    const tank = f.tank;
    if (tank && tank.sp > 0) {
      if (tank.armor > 0) {
        tank.armor -= dmg;
        if (tank.armor < 0) {
          tank.sp += tank.armor;
          tank.armor = 0;
        }
      } else {
        tank.sp -= dmg;
      }
      if (tank.sp <= 0) {
        tank.sp = 0;
        queueMsg(f.member.name + ' 的战车瘫痪了！');
        f.tank = null;
        st.anyTank = st.fighters.some(x => x.tank && x.tank.sp > 0);
      }
      queueAnim({kind: 'hit', tx: (f.tank ? f.tank.sx : 30), ty: (f.tank ? f.tank.sy : 90), dmg});
      queueMsg(f.member.name + ' 的战车受到 ' + dmg + ' 伤害。');
    } else {
      f.member.hp -= dmg;
      queueAnim({kind: 'hit', tx: 30, ty: 90 + (st.fighters.indexOf(f) % 3) * 28, dmg});
      if (f.member.hp <= 0) {
        f.member.hp = 0;
        queueMsg(f.member.name + ' 倒下了！');
      } else {
        queueMsg(f.member.name + ' 受到 ' + dmg + ' 伤害。');
      }
    }
    if (st.fighters.every(x => x.member.hp <= 0)) {
      st.pending.push({kind: 'end', win: false});
    }
  }

  /* ---------------- 更新 ---------------- */
  function update(dt) {
    if (!st) return;
    if (st.phase === 'intro') {
      st.introT += dt;
      if (st.introT > 0.8) {
        st.phase = 'fight';
        nextRound();
      }
      return;
    }
    if (st.phase === 'ended') return;
    // 处理队列
    if (st.pending.length) {
      st.pendT -= dt;
      if (st.pendT <= 0) {
        const p = st.pending.shift();
        handlePending(p);
        if (p.kind !== 'end') st.pendT = p.delay || 0.55;
      }
      return;
    }
    // 等待玩家命令
    if (st.cmd && st.phase === 'fight') {
      const q = Eng.poll();
      for (const k of q) {
        if (k === 'up' || k === 'left') { AudioSys.sfx('cursor'); moveCmd(-1); }
        else if (k === 'down' || k === 'right') { AudioSys.sfx('cursor'); moveCmd(1); }
        else if (k === 'a') { AudioSys.sfx('confirm'); doCmd(); }
        else if (k === 'b') { AudioSys.sfx('cancel'); backCmd(); }
        else if (k === 'm') { G.toggleMute(); }
      }
    }
  }

  function moveCmd(d) {
    const items = playerMenu();
    if (st.cmd.mode === 'menu') st.cmd.idx = Eng.clamp(st.cmd.idx + d, 0, items.length - 1);
    else if (st.cmd.mode === 'target') targetNext(d);
    else if (st.cmd.mode === 'item') {
      const list = usableItems();
      st.cmd.idx = (st.cmd.idx + d + list.length) % list.length;
    }
  }

  function backCmd() {
    if (st.cmd.mode === 'target' || st.cmd.mode === 'item') st.cmd = {mode: 'menu', idx: 0};
    else if (st.cmd.mode === 'menu') { /* 不能取消整个回合 */ }
  }

  function usableItems() {
    const inv = G.state.inventory.items;
    return Object.keys(inv).filter(k => inv[k] > 0 && (D.ITEMS[k].hp || D.ITEMS[k].dmg || D.ITEMS[k].smoke || D.ITEMS[k].repair));
  }

  function doCmd() {
    if (st.cmd.mode === 'menu') confirmCmd();
    else if (st.cmd.mode === 'target') confirmTarget();
    else if (st.cmd.mode === 'item') useItem();
  }

  function useItem() {
    const list = usableItems();
    if (!list.length) return;
    const id = list[st.cmd.idx];
    const it = D.ITEMS[id];
    const f = st.cur.f;
    G.state.inventory.items[id]--;
    if (it.smoke) {
      if (st.bounty || st.opts.boss) { queueMsg('烟雾弹对强大的敌人无效！'); G.state.inventory.items[id]++; return; }
      queueMsg('烟雾弥漫……成功逃跑了！');
      st.pending.push({kind: 'end', win: false, fled: true});
    } else if (it.hp) {
      const target = st.fighters.filter(x => x.member.hp > 0 && x.member.hp < x.member.maxHp)
        .sort((a, b) => a.member.hp / a.member.maxHp - b.member.hp / b.member.maxHp)[0];
      if (target) {
        target.member.hp = Math.min(target.member.maxHp, target.member.hp + it.hp);
        queueMsg('使用' + it.name + '，' + target.member.name + ' 恢复了 ' + it.hp + ' HP！');
        AudioSys.sfx('heal');
      } else {
        queueMsg('没有需要回复的伙伴。');
        G.state.inventory.items[id]++;
      }
    } else if (it.repair) {
      const tank = f.tank;
      if (tank) {
        tank.sp = Math.min(tank.tankDef.sp, tank.sp + it.repair);
        queueMsg('使用' + it.name + '，战车 SP 恢复了 ' + it.repair + '！');
      } else {
        queueMsg('当前没有战车。');
        G.state.inventory.items[id]++;
      }
    } else if (it.dmg) {
      const alive = st.mobs.filter(m => m.hp > 0);
      if (alive.length) {
        const t = alive[st.cmd.idx >= 0 && st.mobs[st.cmd.idx] && st.mobs[st.cmd.idx].hp > 0 ? st.cmd.idx : 0];
        const d = Math.min(t.hp, it.dmg);
        t.hp -= d;
        queueMsg('扔出' + it.name + '！' + d + ' 伤害！');
        AudioSys.sfx('boom');
        if (t.hp <= 0) queueMsg(t.name + ' 被击倒了！');
      }
    }
    st.qi++;
    if (!st.done) advance();
  }

  /* ---------------- 队列处理 ---------------- */
  function handlePending(p) {
    switch (p.kind) {
      case 'msg':
        st.log.push(p.text);
        if (st.log.length > 3) st.log.shift();
        break;
      case 'anim':
        st.flash = {x: p.tx, y: p.ty, t: 0.18};
        AudioSys.sfx('hit');
        break;
      case 'end':
        st.phase = 'ended';
        if (p.fled) {
          AudioSys.playTrack(G.state.map === 'world' ? 'field' : 'town');
          G.state.flags.inBattle = false;
          G.state.screen = G.state.map === 'world' ? 'world' : (D.TOWNS.find(t => t.id === G.state.map) ? 'town' : 'cave');
          st = null;
          return;
        }
        if (p.win) {
          onVictory();
        } else {
          G.state.flags.inBattle = false;
          G.gameOver();
        }
        break;
    }
  }

  function onVictory() {
    AudioSys.sfx('victory');
    const s = G.state;
    let xp = 0, gold = 0;
    for (const m of st.mobs) { xp += m.xp; gold += m.gold; }
    const msg = ['战斗胜利！'];
    const dropPart = st.bounty && st.bounty.drop ? st.bounty.drop : null;
    if (dropPart) {
      G.addPart(dropPart.id, dropPart.n || 1);
      const p = (D.PARTS.main.concat(D.PARTS.sub, D.PARTS.se, D.PARTS.engine, D.PARTS.c)).find(x => x.id === dropPart.id);
      msg.push('获得『' + p.name + '』！');
    }
    if (st.bounty) {
      s.bounties.killed[st.bounty.id] = true;
      msg.push('赏金首『' + st.bounty.name + '』讨伐确认！');
      msg.push('回情报屋可领取 ' + Eng.fmtG(st.bounty.gold) + 'G！');
    }
    if (gold > 0) {
      s.gold += gold;
      msg.push('获得 ' + Eng.fmtG(gold) + 'G');
    }
    const lv = G.gainXP(xp);
    for (const m of lv) msg.push(m);
    G.say(msg, () => {
      s.flags.inBattle = false;
      if (st.opts && st.opts.final) {
        G.doEnding();
        return;
      }
      if (st.bounty && st.bounty.id === 'gomez') {
        G.state.flags.gomez_done = true;
        if (!G.state.tanks.some(t => t.tankId === 't7')) G.addTank('t7');
        const wolf = G.state.party.find(p => p.id === 'wolf');
        if (wolf) {
          wolf.id = null;
          G.say(['红狼：……谢了，小子。','红狼：我该走了。这辆战车，就托付给你了。','（红狼离开了队伍。红狼战车 NO.7 留给了你。）']);
        }
      }
      if (st.opts && st.opts.guard) G.state.flags.factory_guard_done = true;
      AudioSys.playTrack(s.map === 'world' ? 'field' : (D.TOWNS.find(t => t.id === s.map) ? 'town' : 'cave'));
      s.screen = s.map === 'world' ? 'world' : (D.TOWNS.find(t => t.id === s.map) ? 'town' : 'cave');
      st = null;
    });
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    if (!st) return;
    Eng.clear('#101018');
    // 背景
    Eng.rect(0, 150, Eng.W, 90, '#20242e');
    Eng.rect(0, 150, Eng.W, 4, '#2e3440');
    Eng.rect(0, 168, Eng.W, 1, '#161a22');
    // 敌方
    for (const m of st.mobs) {
      if (m.hp <= 0) {
        Eng.sprite(D.ETPL[m.tpl], m.x, m.y, 1, Object.assign({}, D.PAL, m.colors));
        continue;
      }
      const sc = m.size > 1 ? 2 : 1;
      Eng.sprite(D.ETPL[m.tpl], m.x - 12 * sc, m.y, sc, Object.assign({}, D.PAL, m.colors));
      Eng.text(m.name, m.x - 20, m.y - 12, m.isBoss ? '#f8d060' : '#d0d0d8', 10, 'center');
    }
    // 我方
    st.fighters.forEach((f, i) => {
      const x = 22, y = 96 + i * 28;
      if (f.tank && f.tank.sp > 0) {
        f.tank.sx = x + 12;
        f.tank.sy = y - 8;
        Eng.tankSprite(f.tank, x + 12, y - 8, 2, false);
      } else {
        Eng.sprite(D.SPR[f.member.id === 'mecha' ? 'mecha' : f.member.id === 'wolf' ? 'wolf' : 'hero'], x + 24, y - 6, 1);
      }
    });
    // 闪烁
    if (st.flash) {
      st.flash.t -= 1/60;
      Eng.rect(st.flash.x - 8, st.flash.y - 8, 64, 40, 'rgba(255,255,255,0.7)');
      if (st.flash.t <= 0) st.flash = null;
    }
    // 底部窗口
    // 我方状态
    Eng.window_(4, 178, 148, 58);
    st.fighters.forEach((f, i) => {
      const y = 184 + i * 14;
      if (i > 2 || f.member.hp <= 0 && !f.tank) return;
      const nm = f.member.name;
      const hpTxt = f.tank && f.tank.sp > 0 ? '战车' + f.tank.armor : f.member.hp + '/' + f.member.maxHp;
      Eng.text(nm, 12, y, '#ffffff', 10);
      Eng.text(hpTxt, 66, y, '#78d878', 10);
    });
    // 战斗信息
    Eng.window_(154, 178, 162, 58);
    st.log.slice(-3).forEach((ln, i) => {
      Eng.text(ln.length > 14 ? ln.slice(0, 13) + '…' : ln, 162, 184 + i * 14, '#e8e8f0', 10);
    });
    // 命令菜单
    if (st.cmd && st.phase === 'fight') {
      if (st.cmd.mode === 'menu') {
        const items = playerMenu();
        const mw = 96, mh = items.length * 14 + 10;
        const mx = Eng.W - mw - 12, my = 178 - mh - 4;
        Eng.window_(mx, my, mw, mh);
        items.forEach((it, i) => {
          Eng.text(it, mx + 14, my + 5 + i * 14, st.cmd.idx === i ? '#f8e048' : '#d0d0d8', 11);
          Eng.cursor(mx + 3, my + 5 + i * 14, st.cmd.idx === i);
        });
      } else if (st.cmd.mode === 'target') {
        Eng.window_(Eng.W - 150, 30, 146, st.mobs.length * 16 + 10);
        st.mobs.forEach((m, i) => {
          const on = st.cmd.idx === i;
          Eng.text((m.hp > 0 ? '' : '✕') + m.name, Eng.W - 138, 36 + i * 16, on ? '#f8e048' : m.hp > 0 ? '#e0e0e0' : '#606060', 11);
          if (on && m.hp > 0) Eng.cursor(Eng.W - 146, 36 + i * 16, true);
        Eng.text('HP ' + m.hp, Eng.W - 138, 44 + i * 14, '#88d088', 9);
        });
      } else if (st.cmd.mode === 'item') {
        const list = usableItems();
        if (!list.length) { Eng.text('没有可用道具。', 10, 150, '#d0d0d0', 11); return; }
        const mw = 170, mh = list.length * 14 + 10;
        Eng.window_(Eng.W - mw - 8, 178 - mh - 4, mw, mh);
        list.forEach((id, i) => {
          const it = D.ITEMS[id];
          const on = st.cmd.idx === i;
          Eng.text(it.name + ' ×' + G.state.inventory.items[id], Eng.W - mw + 14, 178 - mh + 4 + i * 14, on ? '#f8e048' : '#d0d0d8', 11);
          if (on) Eng.cursor(Eng.W - mw + 3, 178 - mh + 4 + i * 14, true);
        });
      }
    }
  }

  return { start, update, render };
})();
