/* 回合制战斗系统（徒步 + 战车） */

import type {
  BattleFighter,
  BattleMob,
  BattleOpts,
  BattleState,
  OrderEntry,
  Part,
  PendingAction,
  Screen,
  BattleWeaponKind,
  PartKind,
  TankState
} from '@/game/types'
import type { GameApi } from '@/game/core/api'
import { BOUNTIES, MONSTERS } from '@/game/data/combat'
import { findHumanWeapon, PARTS } from '@/game/data/equipment'
import { chance, rnd } from '@/game/utils'
import { playTrack, sfx } from '@/game/audio/audio'
import { explorationTrackFor } from '@/game/audio/cues'
import { poll } from '@/game/engine/input'
import {
  BATTLE_EFFECT_DURATION,
  battleFighterLayout,
  battleMobLayout,
  resolveBattleEnvironment
} from '@/game/assets/battle'
import { regionAtWorld } from '@/game/systems/regions'
import {
  PART_CONDITION_LABELS,
  TANK_PART_LABELS,
  tankAmmoCapacity,
  tankPartCondition,
  tankPartWorks
} from '@/game/systems/tanks'

type PlayerCommandId = 'human' | 'main' | 'sub' | 'se' | 'defend' | 'item' | 'run'

interface PlayerCommand {
  id: PlayerCommandId
  label: string
}

export class BattleSystem {
  private guarding = new WeakSet<BattleFighter>()

  constructor(private api: GameApi) {}

  private get s() {
    return this.api.state
  }

  start(mobIds: string[], opts: BattleOpts = {}) {
    const mobs: BattleMob[] = []
    let i = 0
    for (const id of mobIds) {
      const m = MONSTERS[id]
      if (!m) continue
      mobs.push({
        id,
        name: m.name,
        tpl: m.tpl,
        colors: m.c,
        hp: m.hp,
        maxHp: m.hp,
        atk: m.atk,
        def: m.def,
        spd: m.spd,
        xp: m.xp,
        gold: m.g,
        size: 1,
        x: 180 + (i % 3) * 52,
        y: 36 + Math.floor(i / 3) * 42,
        isBoss: !!opts.boss
      })
      i++
    }
    const st: BattleState = {
      mobs,
      opts,
      phase: 'intro',
      round: 0,
      environment: this.environmentFor(opts),
      order: [],
      qi: 0,
      pending: [],
      pendT: 0,
      cmd: null,
      log: [],
      introT: 0,
      effect: null,
      bounty: null,
      winQueued: false,
      done: false,
      fighters: []
    }
    this.s.battle = st
    st.fighters = this.s.party
      .filter((p) => p.id && p.id !== this.s.hunt?.memberId)
      .map((p) => {
        const tank = this.s.riding ? this.api.getTankByMember(p.id!) : null
        if (tank && this.api.tankOperational(tank)) {
          tank.tankDef = TANK_DEFS.find((definition) => definition.id === tank.tankId)
        }
        return { member: p, tank: tank && this.api.tankOperational(tank) ? tank : null }
      })
    if (opts.bountyId) {
      const b = BOUNTIES.find((x) => x.id === opts.bountyId)
      if (b) {
        st.bounty = b
        st.mobs = [
          {
            id: b.id,
            name: b.name,
            tpl: b.tpl,
            colors: b.c,
            hp: b.hp,
            maxHp: b.hp,
            atk: b.atk,
            def: b.def,
            spd: b.spd,
            xp: b.xp,
            gold: 0,
            size: b.size || 1,
            x: 220,
            y: 40,
            isBoss: true,
            bountyId: b.id
          }
        ]
      }
    }
    this.syncMobPositions(st)
    if (opts.text) st.pending.push({ kind: 'msg', text: opts.text, once: true })
    const bossTrack = st.bounty || opts.boss ? (opts.final ? 'last' : 'boss') : 'battle'
    playTrack(bossTrack)
  }

  update(dt: number) {
    const st = this.s.battle
    if (!st) return
    if (st.effect) {
      st.effect.elapsed = Math.min(st.effect.duration, st.effect.elapsed + dt)
      if (st.effect.elapsed >= st.effect.duration) st.effect = null
    }
    if (st.phase === 'intro') {
      st.introT += dt
      if (st.introT > 0.8) {
        st.phase = 'fight'
        this.nextRound()
      }
      return
    }
    if (st.phase === 'ended') return
    if (st.pending.length) {
      st.pendT -= dt
      if (st.pendT <= 0) {
        const p = st.pending.shift()!
        this.handlePending(p)
        if (p.kind !== 'end') st.pendT = p.delay || 0.55
      }
      return
    }
    if (st.phase === 'fight' && !st.cmd) this.advance()
    if (st.cmd && st.phase === 'fight') {
      const q = poll()
      for (const k of q) {
        if (!st.cmd || st.phase !== 'fight') break
        if (k === 'up' || k === 'left') {
          sfx('cursor')
          this.moveCmd(-1)
        } else if (k === 'down' || k === 'right') {
          sfx('cursor')
          this.moveCmd(1)
        } else if (k === 'a') {
          sfx('confirm')
          this.doCmd()
        } else if (k === 'b') {
          sfx('cancel')
          this.backCmd()
        }
      }
    }
  }

  private environmentFor(opts: BattleOpts) {
    const s = this.s
    const town = TOWNS.some((t) => t.id === s.map)
    const room = ROOMS.some((r) => r.id === s.map)
    const cave = CAVES.find((c) => c.id === s.map)
    const regionId = s.map === 'world' ? regionAtWorld(s.px, s.py).id : cave?.region
    return resolveBattleEnvironment({
      location: s.map === 'world' ? 'world' : town ? 'town' : room ? 'room' : 'cave',
      mapId: s.map,
      tile: s.map === 'world' ? WORLD[s.py]?.[s.px] : undefined,
      regionId,
      final: !!opts.final
    })
  }

  private syncMobPositions(st: BattleState) {
    st.mobs.forEach((mob, index) => {
      const layout = battleMobLayout(index, st.mobs.length, mob.size)
      mob.x = layout.impactX
      mob.y = layout.impactY
    })
  }

  /* ---------------- 回合 ---------------- */
  private nextRound() {
    const st = this.s.battle!
    this.guarding = new WeakSet<BattleFighter>()
    st.round++
    const all: OrderEntry[] = []
    for (const f of st.fighters) {
      if (f.member.hp > 0) {
        const tankSpeed = f.tank
          ? f.tank.tankDef!.speed * (this.api.tankOverweight(f.tank) ? 0.5 : 2)
          : 0
        all.push({ side: 'p', f, spd: f.member.spd + tankSpeed })
      }
    }
    for (const m of st.mobs) if (m.hp > 0) all.push({ side: 'e', m, spd: m.spd })
    all.sort((a, b) => b.spd - a.spd || Math.random() - 0.5)
    if (!all.length) return
    st.order = all
    st.qi = 0
    st.cmd = null
  }

  private advance() {
    const st = this.s.battle!
    if (st.done || st.phase !== 'fight') return
    while (st.qi < (st.order || []).length) {
      const cur = st.order[st.qi]
      if (cur.side === 'p' && cur.f!.member.hp <= 0) {
        st.qi++
        continue
      }
      if (cur.side === 'e' && cur.m!.hp <= 0) {
        st.qi++
        continue
      }
      if (cur.side === 'e') {
        this.enemyAct(cur)
        st.qi++
        return
      }
      this.cur = cur
      st.cmd = { mode: 'menu', idx: 0 }
      return
    }
    // 本回合结束：胜负已入 pending 则等待结算，否则进入下一回合
    if (st.mobs.every((m) => m.hp <= 0) || st.fighters.every((f) => f.member.hp <= 0)) return
    this.nextRound()
  }

  private cur: OrderEntry | null = null

  /* ---------------- 玩家命令 ---------------- */
  private weaponLabel(tank: TankState, kind: 'main' | 'sub' | 'se', label: string): string {
    const partId = tank.parts[kind]
    if (!partId) return `${label} --`
    const condition = tankPartCondition(tank, kind)
    if (condition === 'broken') return `${label} [大破]`
    if (kind === 'sub') return `${label} ∞${condition === 'damaged' ? ' [小破]' : ''}`
    return `${label} ${tank.ammo[kind]}/${tankAmmoCapacity(tank, kind)}${
      condition === 'damaged' ? ' [小破]' : ''
    }`
  }

  private playerCommands(): PlayerCommand[] {
    const f = this.cur!.f!
    const tank = f.tank
    return tank
      ? [
          { id: 'main', label: this.weaponLabel(tank, 'main', '主炮') },
          { id: 'sub', label: this.weaponLabel(tank, 'sub', '副炮') },
          { id: 'se', label: this.weaponLabel(tank, 'se', 'S-E') },
          { id: 'defend', label: '防御' },
          { id: 'item', label: '道具' },
          { id: 'run', label: '逃跑' }
        ]
      : [
          {
            id: 'human',
            label: findHumanWeapon(f.member.weaponId)?.name || '徒手攻击'
          },
          { id: 'defend', label: '防御' },
          { id: 'item', label: '道具' },
          { id: 'run', label: '逃跑' }
        ]
  }

  menuItems(): string[] {
    return this.cur ? this.playerCommands().map((command) => command.label) : []
  }

  commandHelp(): string {
    const st = this.s.battle
    if (!this.cur || !st?.cmd || st.cmd.mode !== 'menu') return ''
    const command = this.playerCommands()[st.cmd.idx]
    const tank = this.cur.f?.tank
    if (!command) return ''
    if (command.id === 'main') return '主炮｜高威力单体炮击，炮弹有限，留给重甲与赏金首。'
    if (command.id === 'sub') return '副炮｜无限弹药的低成本扫射，可同时攻击全部杂兵。'
    if (command.id === 'se') return 'S-E｜强力特殊武器，多数可攻击全体，但弹仓小、补给贵。'
    if (command.id === 'human') {
      const member = this.cur.f!.member
      const weapon = findHumanWeapon(member.weaponId)
      return weapon
        ? `${weapon.name}｜总攻击 ${member.atk + weapon.atk} · ${weapon.all ? '攻击全体' : '攻击单体'}`
        : `徒手攻击｜总攻击 ${member.atk} · 攻击单体`
    }
    if (command.id === 'defend') return '防御｜本回合受到的伤害减半。'
    if (command.id === 'item') return '道具｜使用药箱、修理箱、手榴弹或烟雾弹。'
    if (tank && (!tankPartWorks(tank, 'engine') || !tankPartWorks(tank, 'c'))) {
      return '逃跑｜发动机或 C 装置大破，战车无法自行撤离。'
    }
    return '逃跑｜普通遭遇有机会脱离，赏金首战无法逃跑。'
  }

  private confirmCmd() {
    const st = this.s.battle!
    const f = this.cur!.f!
    const command = this.playerCommands()[st.cmd!.idx]
    if (!command) return
    if (st.opts.requiredWeapon && command.id !== st.opts.requiredWeapon) {
      this.queueMsg(`本次训练要求使用${TANK_PART_LABELS[st.opts.requiredWeapon]}。`)
      return
    }
    const tank = f.tank
    if (command.id === 'run') {
      if (st.bounty || st.opts.boss) this.queueMsg('无法逃跑！')
      else if (chance(0.65)) {
        this.queueMsg('成功逃跑了！')
        st.pending.push({ kind: 'end', win: false, fled: true })
      } else this.queueMsg('逃跑失败！')
      st.qi++
      st.cmd = null
      return
    }
    if (command.id === 'defend') {
      this.guarding.add(f)
      this.queueMsg(f.member.name + ' 摆出防御姿态。')
      st.qi++
      st.cmd = null
      return
    }
    if (command.id === 'item') {
      st.cmd = { mode: 'item', idx: 0 }
      return
    }
    const alive = st.mobs.filter((m) => m.hp > 0)
    if (!alive.length) return
    if (tank && (command.id === 'main' || command.id === 'sub' || command.id === 'se')) {
      const type = command.id
      const part = PARTS[type].find((candidate) => candidate.id === tank.parts[type])
      if (!part) {
        this.queueMsg(`没有装备${TANK_PART_LABELS[type]}。`)
        return
      }
      const condition = tankPartCondition(tank, type)
      if (condition === 'broken') {
        this.queueMsg(`${TANK_PART_LABELS[type]}已经大破，必须回工房维修。`)
        return
      }
      if (type !== 'sub' && tank.ammo[type] <= 0) {
        this.queueMsg(`${TANK_PART_LABELS[type]}弹药耗尽。`)
        return
      }
      if (part.all) {
        if (type !== 'sub') tank.ammo[type]--
        this.recordWeaponUse(type)
        for (const m of st.mobs) if (m.hp > 0) this.attackTarget(tank, m, type)
        st.qi++
        st.cmd = null
        return
      }
      st.cmd = { mode: 'target', type, idx: 0 }
      return
    }
    const humanWeapon = findHumanWeapon(f.member.weaponId)
    if (humanWeapon?.all) {
      for (const mob of st.mobs) if (mob.hp > 0) this.attackTarget(f.member, mob, 'human')
      st.qi++
      st.cmd = null
      return
    }
    st.cmd = { mode: 'target', type: 'human', idx: 0 }
  }

  private targetNext(dir: number) {
    const st = this.s.battle!
    const alive = st.mobs.map((m, i) => ({ m, i })).filter((x) => x.m.hp > 0)
    if (!alive.length) return
    let idx = alive.findIndex((x) => x.i === st.cmd!.idx)
    idx = (idx + dir + alive.length) % alive.length
    st.cmd!.idx = alive[idx].i
  }

  private confirmTarget() {
    const st = this.s.battle!
    const f = this.cur!.f!
    const aliveIdx = st.mobs.map((m, i) => ({ m, i })).filter((x) => x.m.hp > 0)
    if (!aliveIdx.length) return
    const pick = aliveIdx.find((x) => x.i === st.cmd!.idx) || aliveIdx[0]
    st.cmd!.idx = pick.i
    const target = st.mobs[st.cmd!.idx]
    if (!target || target.hp <= 0) return
    const attackType = st.cmd!.type
    if (attackType === 'human') this.attackTarget(f.member, target, attackType)
    else if (attackType === 'main' || attackType === 'sub' || attackType === 'se') {
      if (attackType !== 'sub') {
        if (f.tank!.ammo[attackType] <= 0) {
          this.queueMsg(`${TANK_PART_LABELS[attackType]}弹药耗尽。`)
          st.cmd = { mode: 'menu', idx: 0 }
          return
        }
        f.tank!.ammo[attackType]--
      }
      this.recordWeaponUse(attackType)
      this.attackTarget(f.tank!, target, attackType)
    }
    st.qi++
    st.cmd = null
  }

  private attackTarget(
    src: {
      atk?: number
      name?: string
      weaponId?: string | null
      parts?: Record<string, string | null>
    },
    target: BattleMob,
    type: Extract<BattleWeaponKind, 'human' | 'main' | 'sub' | 'se'>
  ) {
    const st = this.s.battle!
    let atk: number
    let log: string
    let weapon: Pick<Part, 'name' | 'atk' | 'acc' | 'all'> | null = null
    let weaponCondition = tankPartCondition(src as TankState, type === 'human' ? 'main' : type)
    const fighterIndex = Math.max(
      0,
      st.fighters.findIndex((f) => f.member === src || f.tank === src)
    )
    const source = battleFighterLayout(
      fighterIndex,
      type === 'human' ? undefined : st.fighters[fighterIndex]?.tank?.tankId
    )
    if (type === 'human') {
      weaponCondition = 'normal'
      weapon = findHumanWeapon(src.weaponId) || null
      atk = (src.atk || 0) + (weapon?.atk || 0)
      const attackerName = src.name || '我方'
      log = weapon ? `${attackerName}用${weapon.name}攻击！` : `${attackerName}挥拳攻击！`
    } else {
      const ptype = type === 'main' ? PARTS.main : type === 'sub' ? PARTS.sub : PARTS.se
      weapon = ptype.find((p) => p.id === (src.parts as Record<string, string>)[type]) || null
      if (!weapon) return
      atk = Math.round((weapon.atk || 0) * (weaponCondition === 'damaged' ? 0.78 : 1))
      const driverName = st.fighters[fighterIndex]?.member.name || '战车'
      log = `${driverName}的${weapon.name}开火！`
    }
    const tank = type === 'human' ? null : (src as TankState)
    const cDevice = type === 'human' ? null : PARTS.c.find((p) => p.id === src.parts?.c)
    const cCondition = tank ? tankPartCondition(tank, 'c') : 'normal'
    const cAccuracy = (cDevice?.acc || 0) * (cCondition === 'damaged' ? 0.5 : 1)
    const conditionPenalty = weaponCondition === 'damaged' ? 0.1 : 0
    const acc =
      0.88 + ((weapon?.acc || 0) + cAccuracy) / 100 - target.spd * 0.008 - conditionPenalty
    this.queueMsg(log)
    sfx('shot')
    if (!chance(Math.max(0.35, acc))) {
      sfx('cancel')
      st.pending.push({
        kind: 'anim',
        weaponKind: type,
        fromX: source.muzzleX,
        fromY: source.muzzleY,
        tx: target.x,
        ty: target.y,
        dmg: 0,
        hit: false,
        delay: BATTLE_EFFECT_DURATION[type]
      })
      this.queueMsg('没有命中！')
      return
    }
    let dmg = Math.max(1, Math.round(atk * rnd(0.92, 1.12) - target.def * 0.5))
    const crit = chance(0.08)
    if (crit) dmg = Math.round(dmg * 1.8)
    dmg = Math.min(dmg, target.hp)
    target.hp -= dmg
    st.pending.push({
      kind: 'anim',
      weaponKind: type,
      fromX: source.muzzleX,
      fromY: source.muzzleY,
      tx: target.x,
      ty: target.y,
      dmg,
      hit: true,
      delay: BATTLE_EFFECT_DURATION[type]
    })
    this.queueMsg(crit ? '会心一击！' + dmg + ' 伤害！' : dmg + ' 伤害！')
    if (target.hp <= 0) {
      this.queueMsg(target.name + ' 被击倒了！')
      if (!st.winQueued && st.mobs.every((m) => m.hp <= 0)) {
        st.winQueued = true
        st.pending.push({ kind: 'end', win: true })
      }
    }
  }

  private queueMsg(text: string) {
    this.s.battle!.pending.push({ kind: 'msg', text })
  }

  private recordWeaponUse(type: 'main' | 'sub' | 'se') {
    const key = `tutorial_weapon_${type}`
    const current = this.s.flags[key]
    this.s.flags[key] = (typeof current === 'number' ? current : 0) + 1
  }

  /* ---------------- 敌人 AI ---------------- */
  private enemyAct(cur: OrderEntry) {
    const st = this.s.battle!
    const m = cur.m!
    if (st.opts.tutorialStage) {
      this.queueMsg(`${m.name}正在重新定位。`)
      return
    }
    const targets = st.fighters.filter((f) => f.member.hp > 0)
    if (!targets.length) return
    const t = targets[Math.floor(Math.random() * targets.length)]
    if (m.isBoss && chance(0.3)) {
      this.queueMsg(m.name + ' 发动了特殊攻击！！')
      for (const f of st.fighters) {
        if (f.member.hp <= 0) continue
        const def = f.tank && f.tank.armor > 0 ? f.tank.tankDef!.def : f.member.def
        const dmg = Math.max(1, Math.round(m.atk * rnd(0.75, 0.95) - def * 0.4))
        this.damageParty(f, dmg, m)
      }
      return
    }
    this.queueMsg(m.name + ' 扑了上来！')
    const viaTank = !!(t.tank && t.tank.sp > 0 && t.tank.armor > 0)
    const dmg = Math.max(
      1,
      Math.round(m.atk * rnd(0.9, 1.1) - (viaTank ? t.tank!.tankDef!.def : t.member.def) * 0.5)
    )
    this.damageParty(t, dmg, m)
  }

  private damageParty(f: BattleFighter, dmg: number, source: BattleMob) {
    const st = this.s.battle!
    const fighterIndex = Math.max(0, st.fighters.indexOf(f))
    const target = battleFighterLayout(fighterIndex, f.tank?.tankId)
    if (this.guarding.has(f)) dmg = Math.max(1, Math.floor(dmg / 2))
    const tank = f.tank
    if (tank && tank.sp > 0) {
      const armorBefore = tank.armor
      if (tank.armor > 0) {
        tank.armor -= dmg
        if (tank.armor < 0) {
          tank.sp += tank.armor
          tank.armor = 0
        }
      } else {
        tank.sp -= dmg
      }
      const penetrated = armorBefore <= 0 || dmg > armorBefore
      if (penetrated && tank.sp > 0) this.maybeDamageTankPart(tank, dmg)
      if (tank.sp <= 0) {
        tank.sp = 0
        this.queueMsg(f.member.name + ' 的战车瘫痪了！')
        f.tank = null
      } else if (!tankPartWorks(tank, 'engine') || !tankPartWorks(tank, 'c')) {
        this.queueMsg(`${f.member.name} 的战车失去行动能力！`)
        f.tank = null
      }
      st.pending.push({
        kind: 'anim',
        weaponKind: 'enemy',
        fromX: source.x,
        fromY: source.y,
        tx: target.impactX,
        ty: target.impactY,
        dmg,
        hit: true,
        delay: BATTLE_EFFECT_DURATION.enemy
      })
      this.queueMsg(f.member.name + ' 的战车受到 ' + dmg + ' 伤害。')
    } else {
      f.member.hp -= dmg
      st.pending.push({
        kind: 'anim',
        weaponKind: 'enemy',
        fromX: source.x,
        fromY: source.y,
        tx: target.impactX,
        ty: target.impactY,
        dmg,
        hit: true,
        delay: BATTLE_EFFECT_DURATION.enemy
      })
      if (f.member.hp <= 0) {
        f.member.hp = 0
        this.queueMsg(f.member.name + ' 倒下了！')
      } else {
        this.queueMsg(f.member.name + ' 受到 ' + dmg + ' 伤害。')
      }
    }
    if (st.fighters.every((x) => x.member.hp <= 0)) {
      st.pending.push({ kind: 'end', win: false })
    }
  }

  private maybeDamageTankPart(tank: TankState, damage: number) {
    const probability = Math.min(0.42, 0.08 + damage / 900)
    if (!chance(probability)) return
    const candidates = (['main', 'sub', 'se', 'engine', 'c'] as PartKind[]).filter(
      (kind) => tank.parts[kind] && tankPartCondition(tank, kind) !== 'broken'
    )
    if (!candidates.length) return
    const kind = candidates[Math.floor(Math.random() * candidates.length)]
    const previous = tankPartCondition(tank, kind)
    const next = previous === 'normal' ? 'damaged' : 'broken'
    tank.condition[kind] = next
    this.queueMsg(`${TANK_PART_LABELS[kind]}受到冲击：${PART_CONDITION_LABELS[next]}！`)
  }

  private moveCmd(d: number) {
    const st = this.s.battle!
    const items = this.playerCommands()
    if (st.cmd!.mode === 'menu')
      st.cmd!.idx = Math.max(0, Math.min(items.length - 1, st.cmd!.idx + d))
    else if (st.cmd!.mode === 'target') this.targetNext(d)
    else if (st.cmd!.mode === 'item') {
      const list = this.usableItems()
      st.cmd!.idx = (st.cmd!.idx + d + list.length) % Math.max(1, list.length)
    }
  }

  private backCmd() {
    const st = this.s.battle!
    if (st.cmd!.mode === 'target' || st.cmd!.mode === 'item') st.cmd = { mode: 'menu', idx: 0 }
  }

  private usableItems(): string[] {
    const inv = this.s.inventory.items
    return Object.keys(inv).filter(
      (k) => inv[k] > 0 && (ITEMS[k].hp || ITEMS[k].dmg || ITEMS[k].smoke || ITEMS[k].repair)
    )
  }

  private doCmd() {
    const st = this.s.battle!
    if (st.cmd!.mode === 'menu') this.confirmCmd()
    else if (st.cmd!.mode === 'target') this.confirmTarget()
    else if (st.cmd!.mode === 'item') this.useItem()
  }

  private useItem() {
    const st = this.s.battle!
    const list = this.usableItems()
    if (!list.length) return
    const id = list[st.cmd!.idx % list.length]
    const it = ITEMS[id]
    const f = this.cur!.f!
    this.s.inventory.items[id]--
    if (it.smoke) {
      if (st.bounty || st.opts.boss) {
        this.queueMsg('烟雾弹对强大的敌人无效！')
        this.s.inventory.items[id]++
      } else {
        this.queueMsg('烟雾弥漫……成功逃跑了！')
        st.pending.push({ kind: 'end', win: false, fled: true })
      }
    } else if (it.hp) {
      const target = st.fighters
        .filter((x) => x.member.hp > 0 && x.member.hp < x.member.maxHp)
        .sort((a, b) => a.member.hp / a.member.maxHp - b.member.hp / b.member.maxHp)[0]
      if (target) {
        target.member.hp = Math.min(target.member.maxHp, target.member.hp + it.hp)
        this.queueMsg('使用' + it.name + '，' + target.member.name + ' 恢复了 ' + it.hp + ' HP！')
        sfx('heal')
      } else {
        this.queueMsg('没有需要回复的伙伴。')
        this.s.inventory.items[id]++
      }
    } else if (it.repair) {
      const tank = f.tank
      if (tank) {
        tank.sp = Math.min(tank.tankDef!.sp, tank.sp + it.repair)
        this.queueMsg('使用' + it.name + '，战车 SP 恢复了 ' + it.repair + '！')
      } else {
        this.queueMsg('当前没有战车。')
        this.s.inventory.items[id]++
      }
    } else if (it.dmg) {
      const alive = st.mobs.filter((m) => m.hp > 0)
      if (alive.length) {
        const t = alive[Math.floor(Math.random() * alive.length)]
        const d = Math.min(t.hp, it.dmg)
        t.hp -= d
        const source = battleFighterLayout(Math.max(0, st.fighters.indexOf(f)), f.tank?.tankId)
        this.queueMsg('扔出' + it.name + '！' + d + ' 伤害！')
        st.pending.push({
          kind: 'anim',
          weaponKind: 'item',
          fromX: source.muzzleX,
          fromY: source.muzzleY,
          tx: t.x,
          ty: t.y,
          dmg: d,
          hit: true,
          delay: BATTLE_EFFECT_DURATION.item
        })
        sfx('boom')
        if (t.hp <= 0) {
          this.queueMsg(t.name + ' 被击倒了！')
          if (!st.winQueued && st.mobs.every((m) => m.hp <= 0)) {
            st.winQueued = true
            st.pending.push({ kind: 'end', win: true })
          }
        }
      }
    }
    st.qi++
    st.cmd = null
  }

  /* ---------------- 队列处理 ---------------- */
  private handlePending(p: PendingAction) {
    const st = this.s.battle!
    switch (p.kind) {
      case 'msg':
        st.log.push(p.text)
        if (st.log.length > 4) st.log.shift()
        break
      case 'anim': {
        st.effect = {
          weaponKind: p.weaponKind,
          fromX: p.fromX,
          fromY: p.fromY,
          toX: p.tx,
          toY: p.ty,
          hit: p.hit,
          dmg: p.dmg,
          elapsed: 0,
          duration: BATTLE_EFFECT_DURATION[p.weaponKind]
        }
        if (p.hit) sfx('hit')
        break
      }
      case 'end':
        st.phase = 'ended'
        if (p.fled) {
          this.endBattleToMap()
          return
        }
        if (p.win) this.onVictory()
        else this.api.gameOver()
        break
    }
  }

  private endBattleToMap() {
    const s = this.s
    const m = s.map
    const fallback: Screen =
      m === 'world' ? 'world' : TOWNS.some((t) => t.id === m) ? 'town' : 'cave'
    const target = s.base && ['world', 'town', 'cave', 'room'].includes(s.base) ? s.base : fallback
    playTrack(
      explorationTrackFor({
        screen: target as 'world' | 'town' | 'cave' | 'room',
        map: s.map,
        px: s.px,
        py: s.py
      })
    )
    s.battle = null
    s.screen = target as Screen
    if (target !== 'world') s.riding = false
    s.base = null
  }

  private onVictory() {
    const st = this.s.battle!
    const s = this.s
    sfx('victory')
    let xp = 0,
      gold = 0
    if (!st.opts.noRewards) {
      for (const m of st.mobs) {
        xp += m.xp
        gold += m.gold
      }
    }
    const msg: string[] = st.opts.noRewards
      ? ['训练完成！', '老乔记录了本次武器操作。训练战不发放经验与金钱。']
      : ['战斗胜利！']
    const dropPart = st.bounty && st.bounty.drop ? st.bounty.drop : null
    if (dropPart) {
      this.api.addPart(dropPart.id, dropPart.n || 1)
      const p = allParts().find((x) => x.id === dropPart.id)
      msg.push('获得『' + (p ? p.name : dropPart.id) + '』！')
    }
    if (st.bounty) {
      s.bounties.killed[st.bounty.id] = true
      msg.push('赏金首『' + st.bounty.name + '』讨伐确认！')
      msg.push('回情报屋可领取 ' + fmtG(st.bounty.gold) + 'G！')
    }
    if (gold > 0) {
      s.gold += gold
      msg.push('获得 ' + fmtG(gold) + 'G')
    }
    if (st.opts.completionMessage) msg.push(st.opts.completionMessage)
    const lv = this.api.gainXP(xp)
    for (const m of lv) msg.push(m)
    this.api.say(msg, () => {
      if (st.opts.final) {
        this.api.doEnding()
        return
      }
      if (st.bounty && st.bounty.id === 'gomez') {
        s.flags.gomez_done = true
        if (!s.tanks.some((t) => t.tankId === 't7')) this.api.addTank('t7')
        const wolf = s.party.find((p) => p.id === 'wolf')
        if (wolf) {
          this.api.say([
            '红狼：……谢了，小子。',
            '红狼：戈麦斯倒下了，但诺亚还在。',
            '红狼：这辆 NO.7 和我的命，陪你打完最后一仗。',
            '（红狼战车 NO.7 加入车队。）'
          ])
        }
      }
      if (st.opts.completionFlag) s.flags[st.opts.completionFlag] = true
      if (st.bounty?.id === 'water' && s.flags.tutorial_step === 11) {
        s.flags.tutorial_step = 12
      }
      if (st.opts.tutorialNextStep !== undefined) {
        s.flags.tutorial_step = st.opts.tutorialNextStep
      }
      this.endBattleToMap()
    })
  }
}

import { ITEMS, TANKS as TANK_DEFS, allParts } from '@/game/data/equipment'
import { fmtG } from '@/game/utils'
import { CAVES, ROOMS, TOWNS, WORLD } from '@/game/data/maps'
