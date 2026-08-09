/* Vitest 集成测试：数据完整性 + 核心流程 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { store } from '../src/game/core/store'
import * as input from '../src/game/engine/input'
import * as audio from '../src/game/audio/audio'
import { DATA } from './test-data'
import { buildCaveGrid, buildRoomGrid, buildTownGrid } from '../src/game/engine/map-baker'
import { WORLD_CAVE_POSITIONS, WORLD_H, WORLD_TOWN_POSITIONS, WORLD_W } from '../src/game/data/maps'
import actorAtlas from '../src/assets/game/actors-common.json'

/* ---------------- 浏览器桩 ---------------- */
const noop = () => {}
const evHandlers: Record<string, ((e: any) => void)[]> = {}

class FakeGain {
  gain = { value: 0.5, setValueAtTime: noop, exponentialRampToValueAtTime: noop }
  connect() {
    return {}
  }
}
class FakeOsc {
  frequency = { value: 440, exponentialRampToValueAtTime: noop }
  type = ''
  connect() {}
  start() {}
  stop() {}
}
class FakeAudioContext {
  state = 'running'
  sampleRate = 44100
  currentTime = 0
  destination = {}
  createGain() {
    return new FakeGain()
  }
  createOscillator() {
    return new FakeOsc()
  }
  createBuffer(_c: number, l: number) {
    return { getChannelData: () => new Float32Array(l) }
  }
  createBufferSource() {
    return { buffer: null, connect: noop, start: noop, stop: noop }
  }
  createBiquadFilter() {
    return { type: '', frequency: { value: 0 }, connect: noop }
  }
  resume() {}
}

const fakeWindow: any = {
  addEventListener: (type: string, fn: (e: any) => void) => {
    ;(evHandlers[type] = evHandlers[type] || []).push(fn)
  },
  setInterval: () => 0,
  clearInterval: noop,
  AudioContext: FakeAudioContext,
  webkitAudioContext: undefined
}
;(globalThis as any).window = fakeWindow
;(globalThis as any).location = { search: '' }
;(globalThis as any).localStorage = (() => {
  const m: Record<string, string> = {}
  return {
    getItem: (k: string) => (k in m ? m[k] : null),
    setItem: (k: string, v: string) => {
      m[k] = String(v)
    },
    removeItem: (k: string) => {
      delete m[k]
    }
  }
})()

describe('数据完整性', () => {
  it('世界地图尺寸', () => {
    expect(DATA.WORLD.length).toBe(WORLD_H)
    expect(DATA.WORLD.every((r) => r.length === WORLD_W)).toBe(true)
    expect([WORLD_W, WORLD_H]).toEqual([96, 72])
  })
  it('城镇数据', () => {
    for (const t of DATA.TOWNS) {
      expect(t.buildings.length).toBeGreaterThanOrEqual(3)
      expect(DATA.WORLD[t.door[1]][t.door[0]]).toBe('D')
      for (const b of t.buildings) {
        expect([
          'weapon',
          'tankshop',
          'modshop',
          'inn',
          'bounty',
          'story',
          'house',
          'home'
        ]).toContain(b.type)
      }
      for (const n of t.npcs) {
        expect(DATA.SPR[n.sp]).toBeTruthy()
        if (!n.talk.startsWith('story_')) expect(DATA.DIALOGUE[n.talk]).toBeTruthy()
      }
    }
  })
  it('洞窟数据', () => {
    for (const c of DATA.CAVES) {
      expect(DATA.REGIONS.some((r) => r.id === c.region)).toBe(true)
    }
  })
  it('房间数据', () => {
    for (const r of DATA.ROOMS) {
      expect(DATA.TOWNS.some((t) => t.id === r.town)).toBe(true)
      expect(r.exit[0]).toBeGreaterThanOrEqual(0)
      expect(r.exit[0]).toBeLessThan(r.size[0])
      expect(r.exit[1]).toBeGreaterThanOrEqual(0)
      expect(r.exit[1]).toBeLessThan(r.size[1])
      for (const n of r.npcs || []) {
        expect(DATA.SPR[n.sp]).toBeTruthy()
        if (!n.talk.startsWith('story_')) expect(DATA.DIALOGUE[n.talk]).toBeTruthy()
      }
    }
  })

  it('拉多角色图集包含四方向三帧且禁止旋转帧', () => {
    for (const actor of ['hero', 'father', 'shopkeep', 'npc_m', 'npc_w', 'npc_old', 'kid']) {
      for (const direction of ['up', 'down', 'left', 'right']) {
        for (let frame = 0; frame < 3; frame++) {
          const item =
            actorAtlas.frames[`${actor}/${direction}/${frame}` as keyof typeof actorAtlas.frames]
          expect(item, `${actor}/${direction}/${frame}`).toBeTruthy()
          expect(item.rotated).toBe(false)
          expect(item.sourceSize).toEqual({ w: 16, h: 24 })
        }
      }
    }
  })

  it('拉多镇的可进入建筑都有对应室内，门口可从镇门抵达', () => {
    const town = DATA.TOWNS.find((t) => t.id === 'rado')!
    const grid = buildTownGrid(town).map
    const start: [number, number] = [Math.floor(town.size[0] / 2), town.size[1] - 2]
    const reachable = flood(grid, start, (ch) => ch !== '#' && ch !== 'B')
    const rooms = new Map(DATA.ROOMS.map((room) => [room.id, room]))

    for (const building of town.buildings.filter((b) => b.roomId)) {
      const room = rooms.get(building.roomId!)
      expect(room, building.roomId).toBeTruthy()
      expect(room!.door).toEqual(building.door)
      expect(reachable.has(key(building.door[0], building.door[1])), building.name).toBe(true)
    }
  })

  it('拉多服务室内的柜台和出口之间存在可交互路径', () => {
    for (const room of DATA.ROOMS.filter((r) => r.town === 'rado' && r.service)) {
      const grid = buildRoomGrid(room).map
      const reachable = flood(
        grid,
        [room.exit[0], room.exit[1] - 1],
        (ch) => ch !== '#' && ch !== 'B'
      )
      const npc = room.npcs![0]
      const interactionTiles = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0]
      ].map(([dx, dy]) => key(npc.x + dx, npc.y + dy))
      expect(
        interactionTiles.some((tile) => reachable.has(tile)),
        room.id
      ).toBe(true)
    }
  })

  it('每个洞窟出口、宝箱与事件都处在同一个可达区域', () => {
    for (const cave of DATA.CAVES) {
      const grid = buildCaveGrid(cave).map
      const first = cave.exits[0]
      const reachable = flood(
        grid,
        [first.x, first.y],
        (ch) => !['#', '~', 'O', '^', 'B'].includes(ch)
      )
      const targets = [...cave.exits, ...cave.chests, ...cave.events]
      for (const target of targets) {
        expect(reachable.has(key(target.x, target.y)), `${cave.id}:${target.x},${target.y}`).toBe(
          true
        )
      }
    }
  })
  it('怪物/区域/赏金首数据', () => {
    for (const r of DATA.REGIONS) {
      for (const id of r.mobs) expect(DATA.MONSTERS[id]).toBeTruthy()
    }
    for (const id in DATA.MONSTERS) {
      expect(DATA.ETPL[DATA.MONSTERS[id].tpl]).toBeTruthy()
    }
    for (const b of DATA.BOUNTIES) {
      expect(DATA.ETPL[b.tpl]).toBeTruthy()
    }
    expect(DATA.PASSWORDS.length).toBe(4)
  })
  it('战车/商店数据', () => {
    const allIds = DATA.allParts().map((p) => p.id)
    for (const t of DATA.TANKS) {
      expect(DATA.TTPL[t.tpl]).toBeTruthy()
      for (const k of ['main', 'sub', 'se', 'engine', 'c']) {
        if (t.parts[k]) expect(allIds).toContain(t.parts[k])
      }
    }
    for (const tid in DATA.SHOPS) {
      const cfg = DATA.SHOPS[tid]
      for (const id of cfg.weapon.human) expect(DATA.HUMAN_WEAPONS[id]).toBeTruthy()
      for (const id of cfg.weapon.items) expect(DATA.ITEMS[id]).toBeTruthy()
      for (const list of [
        cfg.weapon.main,
        cfg.weapon.sub,
        cfg.weapon.se,
        cfg.weapon.engine,
        cfg.weapon.c
      ]) {
        for (const id of list) expect(allIds).toContain(id)
      }
    }
  })
})

function key(x: number, y: number) {
  return `${x},${y}`
}

type MoveDirection = 'up' | 'down' | 'left' | 'right'

const MOVE_DIRECTIONS: { key: MoveDirection; dx: number; dy: number; facing: number }[] = [
  { key: 'up', dx: 0, dy: -1, facing: 0 },
  { key: 'down', dx: 0, dy: 1, facing: 1 },
  { key: 'left', dx: -1, dy: 0, facing: 2 },
  { key: 'right', dx: 1, dy: 0, facing: 3 }
]

function findPath(
  grid: string[],
  start: [number, number],
  goals: [number, number][],
  blocked = new Set<string>()
): MoveDirection[] | null {
  const goalKeys = new Set(goals.map(([x, y]) => key(x, y)))
  const startKey = key(start[0], start[1])
  const queue: [number, number][] = [start]
  const seen = new Set([startKey])
  const previous = new Map<string, { from: string; direction: MoveDirection }>()

  while (queue.length) {
    const [x, y] = queue.shift()!
    const currentKey = key(x, y)
    if (goalKeys.has(currentKey)) {
      const path: MoveDirection[] = []
      let cursor = currentKey
      while (cursor !== startKey) {
        const step = previous.get(cursor)!
        path.push(step.direction)
        cursor = step.from
      }
      return path.reverse()
    }

    for (const direction of MOVE_DIRECTIONS) {
      const nx = x + direction.dx
      const ny = y + direction.dy
      const nextKey = key(nx, ny)
      const tile = grid[ny]?.[nx]
      if (tile === undefined || ['#', 'B', '~', 'O', '^'].includes(tile)) continue
      if (blocked.has(nextKey) || seen.has(nextKey)) continue
      seen.add(nextKey)
      previous.set(nextKey, { from: currentKey, direction: direction.key })
      queue.push([nx, ny])
    }
  }

  return null
}

function moveOneTile(direction: MoveDirection) {
  input.hold(direction)
  store.world.tryMove(0.2)
  store.world.tryMove(0.2)
  input.release(direction)
}

function walkPath(path: MoveDirection[]) {
  for (const direction of path) moveOneTile(direction)
}

function directionBetween(from: [number, number], to: [number, number]): MoveDirection | null {
  return (
    MOVE_DIRECTIONS.find(
      (direction) => from[0] + direction.dx === to[0] && from[1] + direction.dy === to[1]
    )?.key || null
  )
}

function flood(
  grid: string[],
  start: [number, number],
  walkable: (tile: string) => boolean
): Set<string> {
  const seen = new Set<string>()
  const queue: [number, number][] = [start]
  while (queue.length) {
    const [x, y] = queue.shift()!
    const k = key(x, y)
    if (seen.has(k) || y < 0 || y >= grid.length || x < 0 || x >= grid[y].length) continue
    if (!walkable(grid[y][x])) continue
    seen.add(k)
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
  return seen
}

describe('键盘映射', () => {
  it('方向/确认/取消', () => {
    input.init()
    for (const fn of evHandlers.keydown || []) fn({ code: 'KeyZ', preventDefault: noop })
    expect(input.poll()).toContain('a')
    for (const fn of evHandlers.keydown || []) fn({ code: 'KeyW', preventDefault: noop })
    expect(input.poll()).toContain('up')
    for (const fn of evHandlers.keydown || []) fn({ code: 'Escape', preventDefault: noop })
    expect(input.poll()).toContain('b')
    for (const k of ['a', 'up', 'b']) input.release(k)
  })
})

describe('核心流程', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    input.poll()
    store.newGame()
    store.state.screen = 'world'
    store.state.flags.no_encounter = true
  })

  it('新游戏与读档保持响应式状态引用', () => {
    const stateRef = store.state
    store.state.gold = 12345
    expect(store.saveGame()).toBe(true)
    store.newGame()
    expect(store.state).toBe(stateRef)
    expect(store.loadGame()).toBe(true)
    expect(store.state).toBe(stateRef)
    expect(store.state.gold).toBe(12345)
  })

  it('标题制作名单可打开并用确认或取消关闭', () => {
    input.poll()
    store.state.screen = 'title'
    store.state.titleMenu = 3
    store.state.creditsOpen = false

    input.press('a')
    store.update(0.1)
    expect(store.state.creditsOpen).toBe(true)
    expect(store.state.titleMenu).toBe(0)

    input.press('b')
    store.update(0.1)
    expect(store.state.creditsOpen).toBe(false)
    expect(store.state.titleMenu).toBe(0)

    store.state.titleMenu = 3
    input.press('a')
    store.update(0.1)
    input.press('a')
    store.update(0.1)
    expect(store.state.creditsOpen).toBe(false)
  })

  it('全灭后损失一半金币并在自宅二楼床边复苏', () => {
    store.state.gold = 1001
    store.state.party[1].id = 'mecha'
    store.state.party[0].hp = 0
    store.state.party[1].hp = 0
    store.state.party[0].xp = 77
    store.state.inventory.items.med = 4
    store.state.flags.water_dead = true
    store.addTank('t1')
    const tank = store.state.tanks[0]
    tank.sp = 0
    tank.armor = 13
    tank.condition.engine = 'broken'

    store.gameOver()
    expect(store.state.screen).toBe('gameover')
    store.update(1.1)
    input.press('a')
    store.update(0.01)

    expect(store.state.screen).toBe('room')
    expect(store.state.map).toBe('rado_home_upper')
    expect([store.state.px, store.state.py, store.state.facing]).toEqual([5, 5, 0])
    expect(store.state.gold).toBe(501)
    expect(store.state.party[0].hp).toBe(store.state.party[0].maxHp)
    expect(store.state.party[1].hp).toBe(store.state.party[1].maxHp)
    expect(store.state.party[0].xp).toBe(77)
    expect(store.state.inventory.items.med).toBe(4)
    expect(store.state.flags.water_dead).toBe(true)
    expect(tank).toMatchObject({
      garageSlot: 0,
      sp: 0,
      armor: 13,
      condition: { engine: 'broken' }
    })
    expect(store.state.battle).toBeNull()
    expect(store.state.riding).toBe(false)
    expect(store.state.party[0].tankId).toBeNull()
    expect(store.state.dialog?.texts.join('')).toContain('500G')
  })

  it('进入子菜单时重置选择索引', () => {
    store.openMenu()
    store.menuSelect(5)
    expect(store.state.menu?.view).toBe('options')
    expect(store.state.menu?.idx).toBe(0)
  })

  it('战车分配保持唯一，并在抢占座驾时交换原战车', () => {
    store.state.party[1].id = 'mecha'
    store.addTank('t1')
    store.addTank('t4')
    expect(store.state.party[0].tankId).toBe('t1')
    expect(store.state.party[1].tankId).toBe('t4')

    expect(store.assignTank('mecha', 't1')).toBe(true)
    expect(store.state.party[1].tankId).toBe('t1')
    expect(store.state.party[0].tankId).toBe('t4')
    expect(
      new Set(
        store.state.party
          .filter((p) => p.id)
          .map((p) => p.tankId)
          .filter(Boolean)
      ).size
    ).toBe(2)

    expect(store.assignTank('hero', null)).toBe(false)
    expect(store.state.party[0].tankId).toBe('t4')

    store.world.enterRoom('rado_garage')
    expect(store.assignTank('hero', null)).toBe(true)
    expect(store.state.party[0].tankId).toBeNull()
    expect(store.state.tanks.find((tank) => tank.tankId === 't4')?.garageSlot).toBe(0)
  })

  it('第四辆战车自动进入首个空位，八辆车可唯一占满八个实体车位', () => {
    store.state.party[1].id = 'mecha'
    store.state.party[2].id = 'wolf'
    for (let index = 1; index <= 8; index++) store.addTank(`t${index}`)

    expect(store.state.party.map((member) => member.tankId)).toEqual(['t1', 't2', 't3'])
    expect(store.state.tanks.find((tank) => tank.tankId === 't4')?.garageSlot).toBe(0)
    expect(
      store.state.tanks.filter((tank) => tank.garageSlot !== null).map((tank) => tank.garageSlot)
    ).toEqual([0, 1, 2, 3, 4])

    store.world.enterRoom('rado_garage')
    expect(store.parkTankAtSlot('hero', 5)).toBe(true)
    expect(store.parkTankAtSlot('mecha', 6)).toBe(true)
    expect(store.parkTankAtSlot('wolf', 7)).toBe(true)
    expect(new Set(store.state.tanks.map((tank) => tank.garageSlot)).size).toBe(8)
    expect(store.state.tanks.every((tank) => tank.garageSlot !== null)).toBe(true)
  })

  it('野外不能调用库内战车，到车库后换车会让旧车原位回填', () => {
    store.addTank('t1')
    store.addTank('t2')
    const first = store.state.tanks.find((tank) => tank.tankId === 't1')!
    const parked = store.state.tanks.find((tank) => tank.tankId === 't2')!
    expect([first.garageSlot, parked.garageSlot]).toEqual([null, 0])

    expect(store.assignTank('hero', 't2')).toBe(false)
    expect(store.state.party[0].tankId).toBe('t1')
    expect([first.garageSlot, parked.garageSlot]).toEqual([null, 0])

    store.world.enterRoom('rado_garage')
    expect(store.assignTank('hero', 't2')).toBe(true)
    expect(store.state.party[0].tankId).toBe('t2')
    expect([first.garageSlot, parked.garageSlot]).toEqual([0, null])
    expect(store.serviceableTanksForUi().map((tank) => tank.tankId)).toEqual(['t2'])
  })

  it('停放车辆占据地图碰撞格，空车位仍可通行和交互', () => {
    store.addTank('t1')
    store.world.enterRoom('rado_garage')
    expect(store.parkTankAtSlot('hero', 0)).toBe(true)
    const room = DATA.ROOMS.find((candidate) => candidate.id === 'rado_garage')!
    const occupied = room.garageSlots![0]
    const empty = room.garageSlots![1]

    expect(store.world.isWalkable(room.id, occupied.x, occupied.y)).toBe(false)
    expect(store.world.isWalkable(room.id, empty.x, empty.y)).toBe(true)
    store.state.px = occupied.x - 1
    store.state.py = occupied.y
    store.state.facing = 3
    input.press('a')
    store.world.tryMove(0.1)
    expect(store.state.screen).toBe('menu')
    expect(store.state.menu).toMatchObject({ view: 'garage', garageSlot: 0 })
  })

  it('旧存档中的重复或无效座驾分配会被清理', () => {
    store.state.party[1].id = 'mecha'
    store.addTank('t1')
    store.state.party[1].tankId = 't1'
    store.state.party[2].tankId = 'missing'
    expect(store.saveGame()).toBe(true)
    expect(store.loadGame()).toBe(true)

    expect(store.state.party[0].tankId).toBe('t1')
    expect(store.state.party[1].tankId).toBeNull()
    expect(store.state.party[2].tankId).toBeNull()
  })

  it('旧存档缺少车辆位置时，已分配车辆随队，其余车辆依次迁入车位', () => {
    store.addTank('t1')
    store.addTank('t2')
    store.addTank('t3')
    expect(store.saveGame()).toBe(true)
    const raw = JSON.parse(localStorage.getItem('mmw_save_v1')!)
    for (const tank of raw.tanks) delete tank.garageSlot
    localStorage.setItem('mmw_save_v1', JSON.stringify(raw))

    expect(store.loadGame()).toBe(true)
    expect(store.state.tanks.map((tank) => tank.garageSlot)).toEqual([null, 0, 1])
    expect(store.state.party[0].tankId).toBe('t1')
  })

  it('天气与世界时间随存档恢复，旧存档自动补齐', () => {
    store.state.environment.day = 3
    store.state.environment.minute = 22 * 60 + 15
    store.state.environment.weather = 'rain'
    store.state.environment.wind = -0.72
    store.state.environment.intensity = 0.81
    expect(store.saveGame()).toBe(true)

    store.state.environment.weather = 'clear'
    expect(store.loadGame()).toBe(true)
    expect(store.state.environment).toMatchObject({
      day: 3,
      minute: 22 * 60 + 15,
      weather: 'rain',
      wind: -0.72,
      intensity: 0.81
    })

    const legacy = JSON.parse(localStorage.getItem('mmw_save_v1')!)
    delete legacy.environment
    localStorage.setItem('mmw_save_v1', JSON.stringify(legacy))
    expect(store.loadGame()).toBe(true)
    expect(store.state.environment).toMatchObject({ day: 1, minute: 8 * 60, weather: 'clear' })
  })

  it('旧存档自动补齐人员武器与武器仓库', () => {
    expect(store.saveGame()).toBe(true)
    const legacy = JSON.parse(localStorage.getItem('mmw_save_v1')!)
    for (const member of legacy.party) delete member.weaponId
    delete legacy.inventory.weapons
    localStorage.setItem('mmw_save_v1', JSON.stringify(legacy))

    expect(store.loadGame()).toBe(true)
    expect(store.state.party.map((member) => member.weaponId)).toEqual([
      'sling',
      'pistol',
      'magnum'
    ])
    expect(store.state.inventory.weapons).toEqual({})
  })

  it('野外菜单不能存档或领取赏金', () => {
    localStorage.removeItem('mmw_save_v1')
    store.state.bounties.killed.water = true
    const gold = store.state.gold

    store.openMenu()
    store.menuSelect(3)
    input.press('a')
    store.update(0.1)
    expect(store.state.bounties.claimed.water).not.toBe(true)
    expect(store.state.gold).toBe(gold)
    input.press('b')
    store.update(0.1)

    store.menuSelect(4)
    expect(store.hasSave()).toBe(false)
    expect(store.state.dialog?.texts[0]).toContain('宿屋')
  })

  it('新游戏 → 拉多南洞拿战车 → 返回世界', () => {
    const [caveX, caveY] = WORLD_CAVE_POSITIONS.cave1
    store.world.enterWorld(caveX, caveY - 1)
    input.hold('down')
    store.world.tryMove(0.2)
    store.world.tryMove(0.2)
    input.release('down')
    expect(store.state.map).toBe('cave1')
    expect(store.state.px).toBe(2)
    store.state.px = 18
    store.state.py = 12
    store.state.anim = null
    input.hold('right')
    store.world.tryMove(0.2)
    store.world.tryMove(0.2)
    input.release('right')
    expect(store.state.tanks.length).toBe(1)
    expect(store.state.tanks[0].tankId).toBe('t1')
    expect(store.state.tanks[0]).toMatchObject({
      sp: 330,
      armor: 80,
      ammo: { main: 6, se: 2 },
      condition: { sub: 'damaged' }
    })
    expect(store.state.party[0].tankId).toBe('t1')
    expect(store.state.riding).toBe(true)
    expect(store.state.flags.encounter_steps).toBe(0)
    expect(store.state.dialog?.texts.at(-1)).toContain('进入战车')
    store.state.px = 3
    store.state.py = 12
    store.state.anim = null
    input.hold('left')
    store.world.tryMove(0.2)
    store.world.tryMove(0.2)
    input.release('left')
    expect(store.state.map).toBe('world')
  })

  it('拉多安全带先提供安全步数，并在最长距离保底触发单怪战', () => {
    store.state.flags.no_encounter = false
    store.state.map = 'world'
    store.state.px = WORLD_TOWN_POSITIONS.rado[0]
    store.state.py = WORLD_TOWN_POSITIONS.rado[1] + 2
    store.state.riding = true
    store.addTank('t1')
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
    const worldWithEncounter = store.world as unknown as { tryEncounter(): void }

    for (let step = 0; step < 12; step++) worldWithEncounter.tryEncounter()
    expect(store.state.screen).toBe('world')
    expect(store.state.flags.encounter_steps).toBe(12)

    worldWithEncounter.tryEncounter()
    expect(store.state.screen).toBe('battle')
    expect(store.state.battle?.mobs).toHaveLength(1)
    expect(store.state.flags.encounter_steps).toBe(0)
  })

  it('开局房间：走出大门回到拉多镇', () => {
    const room = DATA.ROOMS.find((room) => room.id === 'rado_home')!
    store.world.enterRoom(room.id)
    expect(store.state.map).toBe('rado_home')

    const exitDirection = directionBetween([store.state.px, store.state.py], room.exit)
    expect(exitDirection).not.toBeNull()
    moveOneTile(exitDirection!)

    expect(store.state.map).toBe(room.town)
    expect([store.state.px, store.state.py]).toEqual(room.door)
  })

  it('开局房间：只有与父亲交互后才触发赶出剧情', () => {
    const room = DATA.ROOMS.find((room) => room.id === 'rado_home')!
    const father = room.npcs?.find((npc) => npc.talk === 'rado_home_father')
    expect(father).toBeTruthy()

    store.world.enterRoom(room.id)
    expect(store.state.flags.kicked).toBeUndefined()
    expect(store.state.dialog).toBeNull()

    const grid = buildRoomGrid(room).map
    const npcTiles = new Set((room.npcs || []).map((npc) => key(npc.x, npc.y)))
    const interactionTiles = MOVE_DIRECTIONS.map(
      (direction) => [father!.x - direction.dx, father!.y - direction.dy] as [number, number]
    ).filter(([x, y]) => {
      const tile = grid[y]?.[x]
      return (
        tile !== undefined && !['#', 'B', '~', 'O', '^'].includes(tile) && !npcTiles.has(key(x, y))
      )
    })
    const path = findPath(grid, [store.state.px, store.state.py], interactionTiles, npcTiles)
    expect(path).not.toBeNull()
    walkPath(path!)

    const facing = directionBetween([store.state.px, store.state.py], [father!.x, father!.y])
    expect(facing).not.toBeNull()
    input.press(facing!)
    store.world.tryMove(0.1)
    input.press('a')
    store.world.tryMove(0.1)

    expect(store.state.flags.kicked).toBe(true)
    expect(store.state.dialog?.texts).toEqual(DATA.DIALOGUE.story_rado_father)
  })

  it('开局房间：贴右墙楼梯可从左侧双向交互', () => {
    store.world.enterRoom('rado_home', [16, 9])

    input.press('right')
    store.world.tryMove(0.1)
    input.release('right')
    input.press('a')
    store.world.tryMove(0.1)

    expect(store.state.map).toBe('rado_home_upper')
    expect([store.state.px, store.state.py]).toEqual([16, 10])

    input.press('right')
    store.world.tryMove(0.1)
    input.release('right')
    input.press('a')
    store.world.tryMove(0.1)

    expect(store.state.map).toBe('rado_home')
    expect([store.state.px, store.state.py]).toEqual([16, 10])
  })

  it('洞窟宝箱状态随存档恢复，新游戏重置且不修改地图定义', () => {
    const cave = DATA.CAVES.find((c) => c.id === 'cave1')!
    const chest = cave.chests.find((ch) => ch.x === 6 && ch.y === 5)!
    const chestKey = `${cave.id}:${chest.x},${chest.y}`

    store.world.enterCave(cave.id)
    expect(buildCaveGrid(cave).map[chest.y][chest.x]).toBe('I')
    store.state.px = chest.x - 1
    store.state.py = chest.y
    store.state.anim = null
    input.hold('right')
    store.world.tryMove(0.2)
    store.world.tryMove(0.2)
    input.release('right')

    expect(store.state.openedChests[chestKey]).toBe(true)
    expect(buildCaveGrid(cave).map[chest.y][chest.x]).toBe(' ')
    expect(Object.prototype.hasOwnProperty.call(chest, 'done')).toBe(false)
    expect(store.saveGame()).toBe(true)

    store.newGame()
    store.state.flags.no_encounter = true
    expect(store.state.openedChests).toEqual({})
    store.world.enterCave(cave.id)
    expect(buildCaveGrid(cave).map[chest.y][chest.x]).toBe('I')

    expect(store.loadGame()).toBe(true)
    expect(store.state.map).toBe(cave.id)
    expect(store.state.openedChests[chestKey]).toBe(true)
    expect(buildCaveGrid(cave).map[chest.y][chest.x]).toBe(' ')
  })

  it('拉多武器店：进入室内、与店主交谈并返回室内', () => {
    store.world.enterTown('rado')
    store.state.px = 16
    store.state.py = 6
    store.state.facing = 0
    input.press('a')
    store.world.tryMove(0.1)
    expect(store.state.screen).toBe('room')
    expect(store.state.map).toBe('rado_weapon')

    store.state.px = 10
    store.state.py = 7
    store.state.facing = 0
    input.press('a')
    store.world.tryMove(0.1)
    expect(store.state.dialog).toBeTruthy()
    input.press('a')
    store.update(0.1)
    expect(store.state.screen).toBe('shop')
    expect(store.state.shop?.type).toBe('weapon')
    expect(store.state.shop?.town).toBe('rado')

    input.press('b')
    store.update(0.1)
    expect(store.state.screen).toBe('room')
    expect(store.state.map).toBe('rado_weapon')
  })

  it('徒步战斗与胜利', () => {
    store.state.riding = false
    const originalRatHp = DATA.MONSTERS.rat.hp
    DATA.MONSTERS.rat.hp = 5
    const gold0 = store.state.gold
    store.startBattle(['rat'], {})
    expect(store.state.screen).toBe('battle')
    let guard = 0
    while (store.state.screen === 'battle' && guard < 300) {
      input.press('a')
      store.update(0.1)
      guard++
    }
    guard = 0
    while (store.state.dialog && guard < 200) {
      input.press('a')
      store.update(0.1)
      guard++
    }
    expect(store.state.screen).toBe('world')
    expect(store.state.party[0].xp).toBeGreaterThan(0)
    expect(store.state.gold).toBe(gold0 + DATA.MONSTERS.rat.g)
    DATA.MONSTERS.rat.hp = originalRatHp
  })

  it('战车战斗（多目标）', () => {
    store.state.riding = true
    store.addTank('t1')
    const originalRatHp = DATA.MONSTERS.rat.hp
    DATA.MONSTERS.rat.hp = 5
    store.startBattle(['rat', 'rat'], {})
    let guard = 0
    while (store.state.screen === 'battle' && guard < 400) {
      input.press('a')
      store.update(0.1)
      guard++
    }
    guard = 0
    while (store.state.dialog && guard < 200) {
      input.press('a')
      store.update(0.1)
      guard++
    }
    expect(store.state.screen).toBe('world')
    DATA.MONSTERS.rat.hp = originalRatHp
  })

  it('红狼在湖区剧情后按主角等级加入', () => {
    store.state.party[0].lv = 8
    store.state.bounties.killed.water = true

    store.world.runStory('story_pobb_wolf')

    expect(store.state.party[2]).toMatchObject({ id: 'wolf', lv: 8, xp: 0 })
    expect(store.state.dialog?.texts.at(-1)).toContain('Lv.8')
  })

  it('赏金首战斗并领取', () => {
    store.addTank('t1')
    store.state.riding = true
    DATA.BOUNTIES[0].hp = 8
    store.startBountyBattle('water', {})
    let guard = 0
    while (store.state.screen === 'battle' && guard < 400) {
      input.press('a')
      store.update(0.1)
      guard++
    }
    guard = 0
    while (store.state.dialog && guard < 200) {
      input.press('a')
      store.update(0.1)
      guard++
    }
    expect(store.state.bounties.killed.water).toBe(true)
    DATA.BOUNTIES[0].hp = 700
    const gold0 = store.state.gold
    store.state.bounties.killed.water = true
    store.world.enterTown('rado')
    store.openShop('bounty', { name: '情报屋' })
    input.press('a')
    store.update(0.1)
    guard = 0
    while (store.state.dialog && guard < 100) {
      input.press('a')
      store.update(0.1)
      guard++
    }
    expect(store.state.gold).toBe(gold0 + 1000)
    expect(store.state.bounties.claimed.water).toBe(true)
  })

  it('武器店买卖', () => {
    const gold0 = store.state.gold
    const med0 = store.state.inventory.items.med || 0
    store.world.enterTown('rado')
    store.openShop('weapon', { name: '武器店' })
    input.press('a')
    store.update(0.1)
    expect(store.state.inventory.items.med).toBe(med0 + 1)
    expect(store.state.gold).toBe(gold0 - 80)
    for (let i = 0; i < 6; i++) {
      input.press('right')
      store.update(0.1)
    }
    input.press('a')
    store.update(0.1)
    expect(store.state.inventory.items.med).toBe(med0)
    input.press('b')
    store.update(0.1)
  })

  it('人用武器可以购买、换装并把旧武器退回仓库', () => {
    store.state.gold = 1000
    store.world.enterTown('rado')
    store.openShop('weapon', { name: '武器店' })
    store.shopSelect(2)
    input.press('a')
    store.update(0.1)
    expect(store.state.inventory.weapons.pistol).toBe(1)
    expect(store.state.gold).toBe(760)

    input.press('b')
    store.update(0.1)
    store.openMenu()
    store.menuSelect(8)
    expect(store.state.menu?.view).toBe('equipment')
    store.menuUse(0)
    store.update(0.1)
    expect(store.state.menu?.view).toBe('weaponassign')
    const pistolIndex = store
      .humanWeaponChoicesForUi('hero')
      .findIndex((weapon) => weapon.id === 'pistol')
    store.menuUse(pistolIndex)
    store.update(0.1)

    expect(store.state.party[0].weaponId).toBe('pistol')
    expect(store.state.inventory.weapons.pistol).toBe(0)
    expect(store.state.inventory.weapons.sling).toBe(1)
    expect(store.state.menu?.view).toBe('equipment')
  })

  it('改造工房换装', () => {
    store.addTank('t1')
    store.world.enterTown('odo')
    store.openShop('mod', { name: '改造工房' })
    const tank = store.state.tanks[0]
    const before = tank.parts.main
    store.addPart('gun55')
    input.press('a')
    store.update(0.1) // 更换装备
    input.press('a')
    store.update(0.1) // 主炮
    input.press('down')
    store.update(0.1) // 55 炮
    input.press('a')
    store.update(0.1) // 换装
    expect(tank.parts.main).toBe('gun55')
    expect(store.state.inventory.parts[before]).toBe(1)
  })

  it('改造工房拒绝底盘不存在的槽位，并计算真实载重', () => {
    store.addTank('t2')
    const tank = store.state.tanks[0]
    expect(store.tankLoad(tank)).toBeCloseTo(5.9)
    expect(store.tankOverweight(tank)).toBe(false)
    store.world.enterTown('odo')
    store.openShop('mod', { name: '改造工房' })

    input.press('a')
    store.update(0.1)
    input.press('down')
    store.update(0.1)
    input.press('down')
    store.update(0.1)
    input.press('a')
    store.update(0.1)

    expect(store.state.shop?.tab).toBe(1)
    expect(store.state.shop?.msg).toContain('没有S-E槽位')
  })

  it('C 装置命中加成参与战斗判定', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const attackOnce = (cDevice: string) => {
      store.newGame()
      store.state.screen = 'world'
      store.state.flags.no_encounter = true
      store.addTank('t1')
      store.state.tanks[0].parts.c = cDevice
      store.state.riding = true
      store.startBattle(['rat'], {})
      store.update(0.9)
      store.update(0.01)
      input.press('a')
      store.update(0.01)
      input.press('a')
      store.update(0.01)
      return store.state.battle!.mobs[0].hp
    }

    const hpWithBasicC = attackOnce('c0')
    const hpWithSolomon = attackOnce('sol2')
    random.mockRestore()
    expect(hpWithBasicC).toBe(DATA.MONSTERS.rat.hp)
    expect(hpWithSolomon).toBeLessThan(DATA.MONSTERS.rat.hp)
  })

  it('宿屋收费并只恢复人员，战车损伤必须到工房维修', () => {
    store.addTank('t1')
    const tank = store.state.tanks[0]
    store.state.party[0].hp = 1
    tank.sp -= 50
    tank.armor = 10
    tank.ammo.main = 1
    tank.condition.sub = 'broken'
    store.state.gold = 100
    store.world.enterRoom('rado_inn')
    store.openShop('inn', { name: '拉多宿屋' })

    input.press('a')
    store.update(0.1)

    expect(store.state.gold).toBe(80)
    expect(store.state.sleep?.phase).toBe('fadeout')
    expect(store.state.party[0].hp).toBe(1)
    let guard = 0
    while (store.state.sleep && guard++ < 12) store.update(1)
    expect(store.state.party[0].hp).toBe(store.state.party[0].maxHp)
    expect(tank.sp).toBe(DATA.TANKS.find((t) => t.id === 't1')!.sp - 50)
    expect(tank.armor).toBe(10)
    expect(tank.ammo.main).toBe(1)
    expect(tank.condition.sub).toBe('broken')
    expect(store.hasSave()).toBe(true)
  })

  it('诺亚楼层楼梯按对应坐标双向往返', () => {
    store.world.enterCave('noa1')
    store.state.px = 21
    store.state.py = 11
    input.hold('right')
    store.world.tryMove(0.2)
    store.world.tryMove(0.2)
    input.release('right')
    expect(store.state.map).toBe('noa2')
    expect([store.state.px, store.state.py]).toEqual([2, 2])

    store.state.px = 3
    store.state.py = 2
    store.state.anim = null
    input.hold('left')
    store.world.tryMove(0.2)
    store.world.tryMove(0.2)
    input.release('left')
    expect(store.state.map).toBe('noa1')
    expect([store.state.px, store.state.py]).toEqual([22, 11])
  })

  it('NO.8 可从世界地图进入军械基地后正常取得', () => {
    const cave = DATA.CAVES.find((cave) => cave.id === 'base8')!
    const entrance = cave.exits.find((exit) => exit.world)!
    const tankEvent = cave.events.find((event) => event.type === 'tank' && event.tankId === 't8')!
    const guardTiles = new Set(
      cave.events.filter((event) => event.type === 'guard').map((event) => key(event.x, event.y))
    )

    expect(DATA.WORLD[entrance.world![1]][entrance.world![0]]).toBe('C')
    const worldApproach = MOVE_DIRECTIONS.find((direction) => {
      const x = entrance.world![0] - direction.dx
      const y = entrance.world![1] - direction.dy
      return DATA.WORLD[y]?.[x] && store.world.isWalkable('world', x, y)
    })!
    store.world.enterWorld(
      entrance.world![0] - worldApproach.dx,
      entrance.world![1] - worldApproach.dy
    )
    moveOneTile(worldApproach.key)

    expect(store.state.map).toBe(cave.id)
    expect([store.state.px, store.state.py]).toEqual([entrance.x, entrance.y])

    const path = findPath(
      buildCaveGrid(cave).map,
      [store.state.px, store.state.py],
      [[tankEvent.x, tankEvent.y]],
      guardTiles
    )
    expect(path).not.toBeNull()
    walkPath(path!)

    expect(store.state.screen).toBe('cave')
    expect([store.state.px, store.state.py]).toEqual([tankEvent.x, tankEvent.y])
    expect(store.state.tanks.some((tank) => tank.tankId === 't8')).toBe(true)
  })

  it('宿屋存档读档', () => {
    store.state.gold = 12345
    expect(store.saveGame()).toBe(true)
    store.state.gold = 1
    expect(store.loadGame()).toBe(true)
    expect(store.state.gold).toBe(12345)
  })

  it('地狱门密码', () => {
    store.world.enterWorld(...WORLD_CAVE_POSITIONS.hell_gate)
    store.openPassword()
    const seq = [
      'up',
      'up',
      'up',
      'right',
      'up',
      'up',
      'up',
      'up',
      'up',
      'up',
      'up',
      'up',
      'right',
      'up',
      'up',
      'up',
      'up',
      'up',
      'up',
      'right',
      'up',
      'up',
      'up',
      'up'
    ]
    for (const k of seq) {
      input.press(k)
      store.update(0.1)
    }
    input.press('a')
    store.update(0.1)
    expect(store.state.flags.pass0).toBe(true)
    expect(store.state.screen).toBe('world')
  })

  it('城镇门与世界往返', () => {
    store.world.enterWorld(...WORLD_TOWN_POSITIONS.rado)
    input.hold('down')
    store.world.tryMove(0.2)
    store.world.tryMove(0.2)
    input.release('down')
    input.hold('up')
    store.world.tryMove(0.2)
    store.world.tryMove(0.2)
    input.release('up')
    expect(store.state.map).toBe('rado')
  })
})

/* 防止未使用的引用告警 */
void audio
