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

function press(key: string, dt = 0) {
  input.press(key)
  store.update(dt)
}

function openTraining() {
  store.world.enterRoom('rado_tank')
  store.openShop('tank', { name: '老乔战车工房' })
  press('a')
  expect(store.state.screen).toBe('battle')
  let guard = 0
  while (!store.state.battle?.cmd && guard++ < 30) store.update(1)
  expect(store.state.battle?.cmd?.mode).toBe('menu')
}

function finishTraining(menuIndex: number, targeted: boolean) {
  const battle = store.state.battle!
  battle.mobs.forEach((mob) => {
    mob.hp = 1
    mob.maxHp = 1
  })
  for (let i = 0; i < menuIndex; i++) press('down')
  press('a')
  if (targeted) press('a')
  let guard = 0
  while (store.state.screen === 'battle' && guard++ < 80) store.update(1)
  while (store.state.dialog && guard++ < 120) press('a', 1)
}

describe('战车武器实操教学', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    input.poll()
    store.newGame()
    store.state.screen = 'world'
    store.addTank('t1')
    const tank = store.state.tanks[0]
    tank.armor = 500
    store.state.flags.tutorial_step = 6
  })

  it('副炮训练拒绝错误武器，三段训练依次推进且不发放报酬', () => {
    const startGold = store.state.gold
    const startXp = store.state.party[0].xp

    openTraining()
    press('a')
    expect(store.state.battle!.qi).toBe(0)
    expect(store.state.battle!.cmd?.mode).toBe('menu')
    expect(store.state.battle!.pending.at(-1)).toMatchObject({
      kind: 'msg',
      text: '本次训练要求使用副炮。'
    })
    finishTraining(1, false)
    expect(store.state.flags.tutorial_step).toBe(7)
    expect(store.state.screen).toBe('room')

    openTraining()
    finishTraining(0, true)
    expect(store.state.flags.tutorial_step).toBe(8)

    openTraining()
    finishTraining(2, false)
    expect(store.state.flags.tutorial_step).toBe(9)
    expect(store.state.gold).toBe(startGold)
    expect(store.state.party[0].xp).toBe(startXp)
  })

  it('自宅睡眠完成前不结算，清晨只恢复人员且不重置后续教学', () => {
    const tank = store.state.tanks[0]
    store.state.flags.tutorial_step = 3
    store.state.party[0].hp = 1
    tank.sp = 300
    tank.armor = 17
    tank.ammo.main = 2
    tank.condition.sub = 'damaged'

    store.beginSleep('home')
    store.update(0.5)
    expect(store.state.party[0].hp).toBe(1)
    expect(store.state.flags.tutorial_step).toBe(3)

    let guard = 0
    while (store.state.sleep && guard++ < 12) store.update(1)

    expect(store.state.party[0].hp).toBe(store.state.party[0].maxHp)
    expect(store.state.environment.minute).toBe(7 * 60)
    expect(store.state.flags.tutorial_step).toBe(4)
    expect(tank).toMatchObject({
      sp: 300,
      armor: 17,
      ammo: { main: 2 },
      condition: { sub: 'damaged' }
    })

    store.beginSleep('home')
    guard = 0
    while (store.state.sleep && guard++ < 12) store.update(1)
    expect(store.state.flags.tutorial_step).toBe(4)
  })
})
