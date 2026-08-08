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

import { FIELD_MENU_ITEMS, store } from '@/game/core/store'
import * as input from '@/game/engine/input'
import { advanceEnvironmentMinutes } from '@/game/systems/environment'
import { availableHuntRegions, previewHunt } from '@/game/systems/hunting'

function openHuntMenu() {
  store.world.enterTown('rado')
  store.openMenu()
  store.menuSelect(FIELD_MENU_ITEMS.indexOf('巡猎'))
  expect(store.state.menu?.view).toBe('hunt')
}

function dispatchRegion(regionId: string, duration = 60) {
  openHuntMenu()
  const index = store.huntRegionsForUi().findIndex((region) => region.id === regionId)
  expect(index).toBeGreaterThanOrEqual(0)
  store.huntSelectRegion(index)
  store.huntSetDuration(duration)
  store.huntConfirm()
  store.update(0)
  expect(store.state.hunt?.regionId).toBe(regionId)
  let guard = 0
  while (store.state.dialog && guard++ < 12) {
    input.press('a')
    store.update(1)
  }
}

describe('自动巡猎任务', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    input.poll()
    saves.clear()
    store.newGame()
    store.state.screen = 'world'
    store.state.party[1].id = 'mecha'
    store.state.flags.region_rado = true
  })

  it('只开放已探索且派遣成员能力足够的区域', () => {
    store.state.flags.region_odo = true

    expect(availableHuntRegions(store.state).map((region) => region.id)).toEqual(['rado'])
    expect(previewHunt(store.state, 'rado', 60)).toMatchObject({
      canStart: true,
      tank: null,
      riskLabel: '低风险徒步'
    })
    expect(previewHunt(store.state, 'odo', 60)?.canStart).toBe(false)
  })

  it('派遣时锁定成员和战车并立即扣除预算消耗', () => {
    store.addTank('t1')
    store.assignTank('mecha', 't1')
    store.state.party[1].lv = 10
    store.state.flags.region_odo = true
    const tank = store.state.tanks[0]
    tank.armor = 500
    const armorBefore = tank.armor
    const mainBefore = tank.ammo.main

    dispatchRegion('odo', 120)

    const task = store.state.hunt!
    expect(task.memberId).toBe('mecha')
    expect(task.tankId).toBe('t1')
    expect(tank.armor).toBe(armorBefore - task.armorCost)
    expect(tank.ammo.main).toBe(mainBefore - task.mainAmmoCost)
    expect(store.assignTank('hero', 't1')).toBe(false)
    expect(store.tankOperational(tank)).toBe(false)

    store.state.screen = 'world'
    store.state.menu = null
    store.state.base = null
    store.startBattle(['rat'], {})
    expect(store.state.battle!.fighters.map((fighter) => fighter.member.id)).toEqual(['hero'])
  })

  it('返航后只奖励派遣成员，重复报告不能再次领奖', () => {
    dispatchRegion('rado')
    const task = { ...store.state.hunt! }
    const member = store.state.party[1]
    const goldBefore = store.state.gold
    const xpBefore = member.xp
    advanceEnvironmentMinutes(store.state.environment, task.durationMinutes)

    store.state.menu = null
    store.state.base = null
    openHuntMenu()
    store.huntConfirm()
    store.update(0)

    expect(store.state.hunt).toBeNull()
    expect(store.state.gold).toBe(goldBefore + task.gold)
    expect(member.xp).toBe(xpBefore + task.xp)
    const settledGold = store.state.gold
    const settledXp = member.xp
    let guard = 0
    while (store.state.dialog && guard++ < 10) {
      input.press('a')
      store.update(1)
    }

    store.state.hunt = task
    store.state.menu = null
    store.state.base = null
    openHuntMenu()
    store.huntConfirm()
    store.update(0)
    expect(store.state.gold).toBe(settledGold)
    expect(member.xp).toBe(settledXp)
    expect(store.state.hunt).toBeNull()
  })

  it('进行中的巡猎任务随存档恢复', () => {
    dispatchRegion('rado', 120)
    const taskId = store.state.hunt!.id
    expect(store.saveGame()).toBe(true)

    store.newGame()
    expect(store.state.hunt).toBeNull()
    expect(store.loadGame()).toBe(true)

    expect(store.state.hunt).toMatchObject({ id: taskId, regionId: 'rado', memberId: 'mecha' })
  })
})
