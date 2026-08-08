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

import { store } from '@/game/core/store'
import * as input from '@/game/engine/input'
import { diagnoseTank, executeMaintenance, maintenanceTotals } from '@/game/systems/maintenance'

describe('战车工房维修流程', () => {
  beforeEach(() => {
    input.poll()
    store.newGame()
    store.state.screen = 'world'
    store.addTank('t1')
  })

  it('诊断按底盘、装甲、部件和有限弹药生成独立工项', () => {
    const tank = store.state.tanks[0]
    tank.sp -= 80
    tank.armor -= 30
    tank.condition.sub = 'damaged'
    tank.condition.engine = 'broken'
    tank.ammo.main -= 3
    tank.ammo.se = 0

    const items = diagnoseTank(tank)

    expect(items.map((item) => item.id)).toEqual([
      'chassis',
      'armor',
      'part:sub',
      'part:engine',
      'ammo:main',
      'ammo:se'
    ])
    expect(maintenanceTotals(items)).toMatchObject({ selected: 6 })
    expect(maintenanceTotals(items).cost).toBeGreaterThan(0)
    expect(maintenanceTotals(items).minutes).toBeGreaterThan(0)
  })

  it('执行工单只处理勾选项目', () => {
    const tank = store.state.tanks[0]
    tank.sp -= 50
    tank.condition.sub = 'damaged'
    tank.ammo.main -= 2
    const items = diagnoseTank(tank)
    for (const item of items) item.selected = item.id !== 'part:sub'

    const result = executeMaintenance(tank, items)

    expect(tank.sp).toBe(420)
    expect(tank.ammo.main).toBe(18)
    expect(tank.condition.sub).toBe('damaged')
    expect(result.lines).not.toContain('副炮维修完成')
  })

  it('接车、诊断、工单和结算会扣费并推进世界时间', () => {
    const tank = store.state.tanks[0]
    tank.sp -= 40
    tank.ammo.main -= 1
    const beforeGold = 10_000
    const beforeMinute = store.state.environment.minute
    store.state.gold = beforeGold
    store.world.enterRoom('rado_tank')
    store.openShop('tank', { name: '老乔战车工房' })

    input.press('a')
    store.update(0)
    expect(store.state.shop?.maintenance?.phase).toBe('diagnosis')
    const items = store.state.shop!.maintenance!.items
    const totals = maintenanceTotals(items)

    input.press('a')
    store.update(0)
    expect(store.state.shop?.maintenance?.phase).toBe('workorder')
    store.shopSelect(items.length)
    input.press('a')
    store.update(0)

    expect(store.state.shop?.maintenance?.phase).toBe('result')
    expect(store.state.gold).toBe(beforeGold - totals.cost)
    expect(store.state.environment.minute).toBe(beforeMinute + totals.minutes)
    expect(tank.sp).toBe(420)
    expect(tank.ammo.main).toBe(18)
    expect(store.state.flags.tutorial_maintenance_done).toBe(true)
  })
})
