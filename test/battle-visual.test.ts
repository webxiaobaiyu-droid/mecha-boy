import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/game/audio/audio', () => ({
  unlock: vi.fn(async () => true),
  playTrack: vi.fn(),
  stopTrack: vi.fn(),
  setMuted: vi.fn(),
  setMusicVolume: vi.fn(),
  setSfxVolume: vi.fn(),
  isMuted: vi.fn(() => false),
  sfx: vi.fn()
}))

import { store } from '@/game/core/store'
import * as input from '@/game/engine/input'
import { TANKS } from '@/game/data/equipment'
import { WORLD } from '@/game/data/maps'
import {
  BATTLE_EFFECT_DURATION,
  battleFighterLayout,
  battleMobLayout,
  battleTankVisualFor
} from '@/game/assets/battle'
import type { BattleWeaponKind } from '@/game/types'

function worldTilePosition(tile: string): [number, number] {
  for (let y = 0; y < WORLD.length; y++) {
    const x = WORLD[y].indexOf(tile)
    if (x >= 0) return [x, y]
  }
  throw new Error(`missing world tile: ${tile}`)
}

const forestPosition = worldTilePosition('f')
const mountainPosition = worldTilePosition('m')

function updateWithKey(key: string, dt = 0) {
  input.press(key)
  store.update(dt)
}

function beginPlayerTankBattle() {
  store.addTank('t4')
  store.state.riding = true
  store.startBattle(['sandworm'], {})
  const battle = store.state.battle!
  battle.mobs[0].spd = 0
  store.update(0.81)
  store.update(0)
  expect(battle.cmd?.mode).toBe('menu')
  return battle
}

function selectTankWeapon(menuIndex: number, targeted = true) {
  for (let i = 0; i < menuIndex; i++) updateWithKey('down')
  updateWithKey('a')
  if (targeted) updateWithKey('a')
}

function animationAction() {
  const action = store.state.battle!.pending.find((item) => item.kind === 'anim')
  expect(action?.kind).toBe('anim')
  if (!action || action.kind !== 'anim') throw new Error('missing battle animation action')
  return action
}

function consumeUntilEffect() {
  const battle = store.state.battle!
  let guard = 0
  while (!battle.effect && battle.pending.length && guard++ < 20) store.update(1)
  expect(battle.effect).toBeTruthy()
  return battle.effect!
}

describe('战斗视觉与规则契约', () => {
  beforeEach(() => {
    input.poll()
    store.newGame()
    store.state.screen = 'world'
    store.state.flags.no_encounter = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
    input.poll()
  })

  it.each([
    ['world', 25, 43, {}, 'field'],
    ['rado', 1, 1, {}, 'town'],
    ['rado_home', 1, 1, {}, 'town'],
    ['cave1', 1, 1, {}, 'cave'],
    ['world', 3, 3, {}, 'desert'],
    ['world', forestPosition[0], forestPosition[1], {}, 'forest'],
    ['world', mountainPosition[0], mountainPosition[1], {}, 'mountain'],
    ['base8', 1, 1, {}, 'desert'],
    ['noa1', 1, 1, {}, 'final'],
    ['world', 25, 43, { final: true }, 'final']
  ] as const)('%s 的战斗环境解析为 %s', (map, px, py, opts, expected) => {
    store.state.map = map
    store.state.px = px
    store.state.py = py
    store.startBattle(['rat'], opts)
    expect(store.state.battle!.environment).toBe(expected)
  })

  it('八辆战车的底盘、颜色与炮塔组合均不相同', () => {
    const signatures = TANKS.map((tank) => {
      const visual = battleTankVisualFor(tank.id)
      return `${tank.tpl}|${tank.colors.X}|${tank.colors.Y}|${visual.turret}|${visual.barrelLength}`
    })
    expect(new Set(signatures).size).toBe(TANKS.length)
    expect(TANKS.map((tank) => battleTankVisualFor(tank.id).turret)).toEqual([
      'short',
      'scout',
      'medical',
      'long',
      'siege',
      'missile',
      'wolf',
      'rail'
    ])
  })

  it.each([
    ['main', 0],
    ['sub', 1],
    ['se', 2]
  ] as const)('%s 使用显式弹道动作并造成伤害', (weaponKind, menuIndex) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const battle = beginPlayerTankBattle()
    if (weaponKind === 'se') battle.fighters[0].tank!.parts.se = 'drill'
    const hpBefore = battle.mobs[0].hp
    selectTankWeapon(menuIndex)

    const action = animationAction()
    const source = battleFighterLayout(0, battle.fighters[0].tank?.tankId)
    const target = battleMobLayout(0, 1, battle.mobs[0].size)
    expect(action).toMatchObject({
      weaponKind,
      fromX: source.muzzleX,
      fromY: source.muzzleY,
      tx: target.impactX,
      ty: target.impactY,
      hit: true
    })
    expect(action.dmg).toBeGreaterThan(0)
    expect(action.delay).toBe(BATTLE_EFFECT_DURATION[weaponKind as BattleWeaponKind])
    expect(battle.mobs[0].hp).toBeLessThan(hpBefore)
    expect(battle.qi).toBe(1)

    const effect = consumeUntilEffect()
    expect(effect).toMatchObject({
      weaponKind,
      fromX: action.fromX,
      fromY: action.fromY,
      toX: action.tx,
      toY: action.ty,
      hit: true,
      dmg: action.dmg,
      elapsed: 0,
      duration: BATTLE_EFFECT_DURATION[weaponKind as BattleWeaponKind]
    })
  })

  it('未命中仍产生显式落空弹道且不扣血', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const battle = beginPlayerTankBattle()
    battle.mobs[0].spd = 100
    const hpBefore = battle.mobs[0].hp
    selectTankWeapon(0)
    const action = animationAction()
    expect(action).toMatchObject({ weaponKind: 'main', hit: false, dmg: 0 })
    expect(battle.mobs[0].hp).toBe(hpBefore)
    expect(consumeUntilEffect().hit).toBe(false)
  })

  it('徒步和战车攻击日志包含完整动作主体', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    store.state.riding = false
    store.startBattle(['sandworm'], {})
    store.state.battle!.mobs[0].spd = 0
    store.update(0.81)
    store.update(0)
    updateWithKey('a')
    updateWithKey('a')
    expect(store.state.battle!.pending[0]).toMatchObject({
      kind: 'msg',
      text: '阿雷用猎人弹弓攻击！'
    })

    store.newGame()
    store.state.screen = 'world'
    const battle = beginPlayerTankBattle()
    selectTankWeapon(0)
    expect(battle.pending[0]).toMatchObject({
      kind: 'msg',
      text: '阿雷的105毫米炮开火！'
    })
    store.update(0)
    expect(battle.log.at(-1)).toBe('阿雷的105毫米炮开火！')
  })

  it('敌方攻击携带敌我双方的物理坐标', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    store.state.party[0].spd = 0
    store.startBattle(['rat'], {})
    const battle = store.state.battle!
    battle.mobs[0].spd = 100
    store.update(0.81)
    store.update(0)
    const action = animationAction()
    const target = battleFighterLayout(0)
    expect(action).toMatchObject({
      weaponKind: 'enemy',
      fromX: battle.mobs[0].x,
      fromY: battle.mobs[0].y,
      tx: target.impactX,
      ty: target.impactY,
      hit: true
    })
    expect(action.dmg).toBeGreaterThan(0)
  })

  it('手榴弹使用独立道具弹道', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    store.state.inventory.items = { bomb: 1 }
    store.startBattle(['sandworm'], {})
    const battle = store.state.battle!
    battle.mobs[0].spd = 0
    store.update(0.81)
    store.update(0)
    const hpBefore = battle.mobs[0].hp
    updateWithKey('down')
    updateWithKey('down')
    updateWithKey('a')
    updateWithKey('a')
    const action = animationAction()
    expect(action).toMatchObject({ weaponKind: 'item', hit: true, dmg: 200 })
    expect(battle.mobs[0].hp).toBe(hpBefore - 200)
  })

  it('一次玩家行动只推进一个行动位并交还回合控制', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const battle = beginPlayerTankBattle()
    selectTankWeapon(0)
    expect(battle.qi).toBe(1)
    expect(battle.cmd).toBeNull()

    let guard = 0
    while ((battle.pending.length || battle.effect) && guard++ < 30) store.update(1)
    store.update(0)
    expect(battle.qi).toBe(2)
    expect(
      battle.pending.some((action) => action.kind === 'anim' && action.weaponKind === 'enemy')
    ).toBe(true)

    guard = 0
    while ((battle.pending.length || battle.effect) && guard++ < 30) store.update(1)
    store.update(0)
    expect(battle.round).toBe(2)
    expect(battle.phase).toBe('fight')
    store.update(0)
    expect(battle.cmd?.mode).toBe('menu')
  })

  it('全体 S-E 只消耗一个行动位但为每个目标创建动作', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    store.addTank('t4')
    store.state.riding = true
    store.startBattle(['sandworm', 'sandworm'], {})
    const battle = store.state.battle!
    battle.mobs.forEach((mob) => {
      mob.spd = 0
    })
    store.update(0.81)
    store.update(0)
    updateWithKey('down')
    updateWithKey('down')
    updateWithKey('a')
    const actions = battle.pending.filter((action) => action.kind === 'anim')
    expect(actions).toHaveLength(2)
    expect(actions.every((action) => action.kind === 'anim' && action.weaponKind === 'se')).toBe(
      true
    )
    expect(battle.mobs.every((mob) => mob.hp < mob.maxHp)).toBe(true)
    expect(battle.qi).toBe(1)
    expect(battle.cmd).toBeNull()
  })

  it('霰弹枪使用人员攻击动作同时打击全部目标', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    store.state.riding = false
    store.state.party[0].weaponId = 'shotgun'
    store.startBattle(['rat', 'ant'], {})
    const battle = store.state.battle!
    battle.mobs.forEach((mob) => {
      mob.spd = 0
    })
    store.update(0.81)
    store.update(0)
    updateWithKey('a')

    const actions = battle.pending.filter((action) => action.kind === 'anim')
    expect(actions).toHaveLength(2)
    expect(actions.every((action) => action.kind === 'anim' && action.weaponKind === 'human')).toBe(
      true
    )
    expect(battle.mobs.every((mob) => mob.hp < mob.maxHp)).toBe(true)
    expect(battle.qi).toBe(1)
    expect(battle.cmd).toBeNull()
  })
})
