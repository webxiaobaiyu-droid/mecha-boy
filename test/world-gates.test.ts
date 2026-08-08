import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const saves = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => saves.get(key) || null,
  setItem: (key: string, value: string) => saves.set(key, value),
  removeItem: (key: string) => saves.delete(key)
}

import { store } from '@/game/core/store'
import { WORLD, WORLD_GATE_POSITIONS } from '@/game/data/maps'
import * as input from '@/game/engine/input'
import {
  WORLD_GATES,
  worldGateAt,
  worldGateRequirement,
  worldGateUnlocked
} from '@/game/systems/world-gates'
import { createWorldMapProgress, knownWorldLocations } from '@/game/systems/world-map'

function press(key: string, dt = 0) {
  input.press(key)
  store.update(dt)
}

function dismissDialog() {
  let guard = 0
  while (store.state.dialog && guard++ < 20) press('a', 1)
  expect(guard).toBeLessThan(20)
}

function triggerGateBattle(gateId: string) {
  const gate = WORLD_GATES.find((candidate) => candidate.id === gateId)!
  store.addTank('t1')
  const tank = store.state.tanks[0]
  tank.armor = tank.sp
  store.world.enterWorld(gate.position[0] - 1, gate.position[1])

  input.hold('right')
  store.world.tryMove(0.2)
  input.release('right')
  expect(store.state.dialog?.texts).toEqual(gate.lockedText)
  expect(store.state.flags[gate.unlockFlag]).not.toBe(true)
  dismissDialog()
  expect(store.state.screen).toBe('battle')
  expect(store.state.battle?.opts.completionFlag).toBe(gate.unlockFlag)
  return gate
}

describe('世界关口与永久路线', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    input.poll()
    saves.clear()
    store.newGame()
    store.state.screen = 'world'
    store.state.flags.no_encounter = true
    store.state.dialog = null
    store.state.menu = null
  })

  it('每个关口都占据唯一 G 瓦片，未解锁时真实阻挡移动', () => {
    expect(WORLD_GATES).toHaveLength(Object.keys(WORLD_GATE_POSITIONS).length)
    expect(new Set(WORLD_GATES.map((gate) => gate.position.join(','))).size).toBe(
      WORLD_GATES.length
    )

    for (const gate of WORLD_GATES) {
      const [x, y] = gate.position
      expect(WORLD[y][x], gate.name).toBe('G')
      expect(worldGateAt(x, y)).toBe(gate)
      expect(worldGateUnlocked(store.state, gate)).toBe(false)
      expect(store.world.isWalkable('world', x, y)).toBe(false)
      expect(worldGateRequirement(gate).length).toBeGreaterThan(4)
    }
  })

  it('撞上裂风山口触发守卫战，尝试逃跑不会提前开放路线', () => {
    const gate = triggerGateBattle('windbreak')
    let guard = 0
    while (!store.state.battle?.cmd && guard++ < 40) store.update(1)
    expect(store.state.battle?.cmd?.mode).toBe('menu')

    for (let index = 0; index < 5; index++) press('down')
    press('a')

    expect(store.state.battle?.pending).toContainEqual(
      expect.objectContaining({ kind: 'msg', text: '无法逃跑！' })
    )
    expect(store.state.flags[gate.unlockFlag]).not.toBe(true)
    expect(store.world.isWalkable('world', ...gate.position)).toBe(false)
  })

  it('击破守卫后永久开放关口，并把开放状态写入存档', () => {
    const gate = triggerGateBattle('windbreak')
    const battle = store.state.battle!
    battle.mobs[0].hp = 1
    battle.mobs[0].maxHp = 1
    battle.mobs[0].spd = 0

    let guard = 0
    while (store.state.screen === 'battle' && guard++ < 160) press('a', 1)
    expect(guard).toBeLessThan(160)
    expect(store.state.flags[gate.unlockFlag]).toBe(true)
    expect(store.world.isWalkable('world', ...gate.position)).toBe(true)
    expect(store.state.dialog).toBeNull()

    expect(store.saveGame()).toBe(true)
    delete store.state.flags[gate.unlockFlag]
    expect(store.loadGame()).toBe(true)
    expect(store.state.flags[gate.unlockFlag]).toBe(true)
    expect(worldGateUnlocked(store.state, gate)).toBe(true)
  })

  it('水怪与马歇尔的讨伐记录会开放对应捷径，并在首次通过时固化旗标', () => {
    for (const [gateId, bountyId] of [
      ['sluice', 'water'],
      ['graypass', 'marshal']
    ] as const) {
      const gate = WORLD_GATES.find((candidate) => candidate.id === gateId)!
      expect(worldGateUnlocked(store.state, gate)).toBe(false)
      store.state.bounties.killed[bountyId] = true
      expect(worldGateUnlocked(store.state, gate)).toBe(true)
      expect(store.world.isWalkable('world', ...gate.position)).toBe(true)

      store.world.enterWorld(gate.position[0] - 1, gate.position[1])
      input.hold('right')
      store.world.tryMove(0.2)
      input.release('right')
      expect(store.state.flags[gate.unlockFlag]).toBe(true)
      expect(store.state.anim).toMatchObject({ tx: gate.position[0], ty: gate.position[1] })
    }
  })

  it('地图只展示已测绘关口，并明确区分封锁与开放状态', () => {
    const gate = WORLD_GATES.find((candidate) => candidate.id === 'tidebridge')!
    const hidden = createWorldMapProgress([gate.position[0] - 1, gate.position[1]], 0)
    expect(
      knownWorldLocations(hidden, store.state).some((location) => location.kind === 'gate')
    ).toBe(false)

    const discovered = createWorldMapProgress(gate.position, 0)
    const locked = knownWorldLocations(discovered, store.state)
    expect(locked).toContainEqual(
      expect.objectContaining({
        id: `gate:${gate.id}`,
        kind: 'gate',
        status: 'locked',
        note: expect.stringContaining('击破守卫')
      })
    )
    expect(locked.filter((location) => location.kind === 'gate')).toHaveLength(1)

    store.state.flags[gate.unlockFlag] = true
    expect(knownWorldLocations(discovered, store.state)).toContainEqual(
      expect.objectContaining({
        id: `gate:${gate.id}`,
        status: 'open',
        note: expect.stringContaining(gate.route)
      })
    )
  })
})
