import { describe, expect, it } from 'vitest'
import {
  CAVES,
  ROOMS,
  TILE,
  TOWNS,
  WORLD,
  WORLD_GATE_POSITIONS,
  WORLD_H,
  WORLD_TOWN_POSITIONS,
  WORLD_W
} from '../src/game/data/maps'
import { buildRoomGrid, buildTownGrid, roomGrids, townGrids } from '../src/game/engine/renderer'

type Point = [number, number]

const CARDINALS: Point[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0]
]

interface WorldPathOptions {
  allowedTiles?: ReadonlySet<string>
  blocked?: ReadonlySet<string>
}

function shortestWorldPath(
  start: Point,
  goal: Point,
  options: WorldPathOptions = {}
): Point[] | null {
  const queue: Point[] = [start]
  let cursor = 0
  const previous = new Map<string, string | null>([[start.join(','), null]])
  const goalKey = goal.join(',')

  while (cursor < queue.length) {
    const [x, y] = queue[cursor++]
    const currentKey = `${x},${y}`
    if (currentKey === goalKey) {
      const path: Point[] = []
      let key: string | null = currentKey
      while (key) {
        const [pathX, pathY] = key.split(',').map(Number)
        path.push([pathX, pathY])
        key = previous.get(key) ?? null
      }
      return path.reverse()
    }

    for (const [dx, dy] of CARDINALS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) continue
      const tile = WORLD[ny][nx]
      const nextKey = `${nx},${ny}`
      if (
        previous.has(nextKey) ||
        !TILE[tile]?.w ||
        options.blocked?.has(nextKey) ||
        (options.allowedTiles && !options.allowedTiles.has(tile))
      )
        continue
      previous.set(nextKey, currentKey)
      queue.push([nx, ny])
    }
  }

  return null
}

describe('authored room layouts', () => {
  it('keeps walls, furniture collision, exit and father route in one grid', () => {
    roomGrids.clear()
    const room = ROOMS.find((item) => item.id === 'rado_home')!
    const grid = buildRoomGrid(room)

    expect(grid.size).toEqual([20, 15])
    expect(grid.map[1][9]).toBe('#')
    expect(grid.map[5][9]).toBe(' ')
    expect(grid.map[2][2]).toBe('B')
    expect(grid.map[room.exit[1]][room.exit[0]]).toBe('E')

    const stairs = room.furniture!.find((item) => item.t === 'stairs')!
    expect(stairs.x + stairs.w).toBe(room.size[0] - 1)
    const upperLinks = room.links!.filter((link) => link.target === 'rado_home_upper')
    expect(upperLinks).toHaveLength(3)
    for (const link of upperLinks) {
      expect(link.x).toBe(stairs.x)
      expect(link.y).toBeGreaterThanOrEqual(stairs.y)
      expect(link.y).toBeLessThan(stairs.y + stairs.h)
      expect(grid.map[link.y][link.x]).toBe('B')
    }
    const downStairs = room.furniture!.find((item) => item.t === 'stairs_down')!
    const garageLinks = room.links!.filter((link) => link.target === 'rado_garage')
    expect(garageLinks).toHaveLength(3)
    expect(downStairs.x).toBe(1)
    for (const link of garageLinks) {
      expect(link.x).toBe(downStairs.x + downStairs.w - 1)
      expect(grid.map[link.y][link.x]).toBe('B')
    }

    const start: [number, number] = [room.exit[0], room.exit[1] - 1]
    const father = room.npcs![0]
    const targets = new Set([
      `${father.x - 1},${father.y}`,
      `${father.x + 1},${father.y}`,
      `${father.x},${father.y - 1}`,
      `${father.x},${father.y + 1}`
    ])
    const queue: [number, number][] = [start]
    const seen = new Set([start.join(',')])
    let reachable = false
    while (queue.length) {
      const [x, y] = queue.shift()!
      if (targets.has(`${x},${y}`)) {
        reachable = true
        break
      }
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0]
      ]) {
        const nx = x + dx
        const ny = y + dy
        const key = `${nx},${ny}`
        const tile = grid.map[ny]?.[nx]
        if (seen.has(key) || tile === undefined || tile === '#' || tile === 'B') continue
        seen.add(key)
        queue.push([nx, ny])
      }
    }
    expect(reachable).toBe(true)
  })

  it('defines eight unique reachable parking bays in the home garage', () => {
    roomGrids.clear()
    const room = ROOMS.find((item) => item.id === 'rado_garage')!
    const grid = buildRoomGrid(room)

    expect(room.size).toEqual([30, 20])
    expect(room.garageSlots).toHaveLength(8)
    expect(new Set(room.garageSlots!.map((slot) => `${slot.x},${slot.y}`)).size).toBe(8)
    const start: [number, number] = [26, 16]
    const queue: [number, number][] = [start]
    const seen = new Set([start.join(',')])
    while (queue.length) {
      const [x, y] = queue.shift()!
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0]
      ]) {
        const nx = x + dx
        const ny = y + dy
        const tile = grid.map[ny]?.[nx]
        const key = `${nx},${ny}`
        if (seen.has(key) || tile === undefined || tile === '#' || tile === 'B') continue
        seen.add(key)
        queue.push([nx, ny])
      }
    }
    for (const slot of room.garageSlots!) {
      expect(grid.map[slot.y][slot.x]).toBe(' ')
      expect(
        [
          `${slot.x - 1},${slot.y}`,
          `${slot.x + 1},${slot.y}`,
          `${slot.x},${slot.y - 1}`,
          `${slot.x},${slot.y + 1}`
        ].some((position) => seen.has(position))
      ).toBe(true)
    }
  })
})

describe('authored town layouts', () => {
  it('keeps 麦镇 distinct from the generated town template and preserves entrances', () => {
    townGrids.clear()
    const town = TOWNS.find((item) => item.id === 'masaru')!
    const grid = buildTownGrid(town)

    expect(town.authored).toBe(true)
    expect(town.paths).toHaveLength(8)
    expect(town.buildings.map((building) => building.name)).not.toEqual(
      expect.arrayContaining(['武器店', '战车店', '宿屋', '情报屋'])
    )
    expect(grid.map[grid.exit[1]][grid.exit[0]]).toBe('E')
    for (const building of town.buildings) {
      if (building.open !== false) {
        expect(grid.map[building.door[1]][building.door[0]]).toBe('d')
      }
    }
    const occupied = new Set([
      ...town.npcs.map((npc) => `${npc.x},${npc.y}`),
      ...town.buildings.map((building) => `${building.door[0]},${building.door[1]}`),
      `${grid.exit[0]},${grid.exit[1]}`
    ])
    const decorKeys = new Set<string>()
    for (const decor of town.decor || []) {
      expect(grid.map[decor.y][decor.x]).not.toBe('B')
      const key = `${decor.x},${decor.y}`
      expect(occupied.has(key)).toBe(false)
      expect(decorKeys.has(key)).toBe(false)
      decorKeys.add(key)
    }
  })
})

describe('非线性世界路网', () => {
  const rado = TOWNS.find((town) => town.id === 'rado')!
  const windpump = TOWNS.find((town) => town.id === 'windpump')!
  const masaru = TOWNS.find((town) => town.id === 'masaru')!
  const reed = TOWNS.find((town) => town.id === 'reed')!
  const pobb = TOWNS.find((town) => town.id === 'pobb')!
  const ashridge = TOWNS.find((town) => town.id === 'ashridge')!
  const odo = TOWNS.find((town) => town.id === 'odo')!
  const sold = TOWNS.find((town) => town.id === 'sold')!
  const roadTiles = new Set(['D', 't', 'r', 'C', 'H', 'N', 'G', 'F'])
  const gateEntries = Object.entries(WORLD_GATE_POSITIONS)
  const allGatesLocked = new Set(gateEntries.map(([, point]) => point.join(',')))

  function lockedExcept(...gateIds: string[]): Set<string> {
    const open = new Set(gateIds.map((id) => WORLD_GATE_POSITIONS[id].join(',')))
    return new Set([...allGatesLocked].filter((key) => !open.has(key)))
  }

  it('扩展为 96×72，并把第二主城放到足以形成成长旅程的距离', () => {
    const path = shortestWorldPath(rado.door, masaru.door)

    expect([WORLD_W, WORLD_H]).toEqual([96, 72])
    expect(rado.door).toEqual(WORLD_TOWN_POSITIONS.rado)
    expect(masaru.door).toEqual(WORLD_TOWN_POSITIONS.masaru)
    expect(path).not.toBeNull()
    expect(path!.length - 1).toBeGreaterThanOrEqual(34)
    expect(path!.length - 1).toBeLessThanOrEqual(42)
  })

  it('拉多盆地必须击破裂风守卫，或以马歇尔路线进行高风险提前破局', () => {
    const locked = shortestWorldPath(windpump.door, masaru.door, { blocked: allGatesLocked })
    const normalRoute = shortestWorldPath(windpump.door, masaru.door, {
      blocked: lockedExcept('windbreak')
    })
    const sequenceBreak = shortestWorldPath(windpump.door, masaru.door, {
      blocked: lockedExcept('graypass')
    })

    expect(locked).toBeNull()
    expect(normalRoute).not.toBeNull()
    expect(normalRoute).toContainEqual(WORLD_GATE_POSITIONS.windbreak)
    expect(sequenceBreak).not.toBeNull()
    expect(sequenceBreak).toContainEqual(WORLD_GATE_POSITIONS.graypass)
    expect(sequenceBreak!.length).toBeGreaterThan(normalRoute!.length * 2)
  })

  it('断潮桥封锁时保留危险浅滩，击破守卫后形成显著捷径', () => {
    const fordRoute = shortestWorldPath(reed.door, pobb.door, { blocked: allGatesLocked })
    const bridgeRoute = shortestWorldPath(reed.door, pobb.door, {
      blocked: lockedExcept('tidebridge')
    })

    expect(fordRoute).not.toBeNull()
    expect(fordRoute!.some(([x, y]) => WORLD[y][x] === 'F')).toBe(true)
    expect(bridgeRoute).not.toBeNull()
    expect(bridgeRoute).toContainEqual(WORLD_GATE_POSITIONS.tidebridge)
    expect(fordRoute!.length - bridgeRoute!.length).toBeGreaterThanOrEqual(20)
  })

  it('灰脊关和北部军管哨分别支持赏金首解锁与长距离绕行', () => {
    const graypassLocked = shortestWorldPath(ashridge.door, odo.door, {
      blocked: allGatesLocked
    })
    const graypassOpen = shortestWorldPath(ashridge.door, odo.door, {
      blocked: lockedExcept('graypass')
    })
    const checkpointDetour = shortestWorldPath(odo.door, sold.door, {
      blocked: allGatesLocked
    })
    const checkpointOpen = shortestWorldPath(odo.door, sold.door, {
      blocked: lockedExcept('north_checkpoint')
    })

    expect(graypassLocked).toBeNull()
    expect(graypassOpen).toContainEqual(WORLD_GATE_POSITIONS.graypass)
    expect(checkpointDetour).not.toBeNull()
    expect(checkpointOpen).toContainEqual(WORLD_GATE_POSITIONS.north_checkpoint)
    expect(checkpointDetour!.length - checkpointOpen!.length).toBeGreaterThanOrEqual(10)
  })

  it('公路中段连接可选补给驿站', () => {
    const highway = shortestWorldPath(rado.door, masaru.door, { allowedTiles: roadTiles })
    const relay = CAVES.find((cave) => cave.id === 'north_relay')!
    const relayEntrance = relay.exits.find((exit) => exit.world)!.world!
    const relayPath = shortestWorldPath(rado.door, relayEntrance, { allowedTiles: roadTiles })

    expect(highway).not.toBeNull()
    expect(highway).toContainEqual(WORLD_GATE_POSITIONS.windbreak)
    expect(WORLD[relayEntrance[1]][relayEntrance[0]]).toBe('C')
    expect(relayPath).not.toBeNull()
    expect(relay.chests.map((chest) => chest.item)).toEqual(['repair', 'gun55'])
  })

  it('所有主城、村落和部落入口唯一，并在关口开放后连接正式路网', () => {
    const entrances = TOWNS.map((town) => town.door.join(','))
    const mapDoors: string[] = []
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (WORLD[y][x] === 'D') mapDoors.push(`${x},${y}`)
      }
    }

    expect(new Set(entrances).size).toBe(TOWNS.length)
    expect(new Set(mapDoors)).toEqual(new Set(entrances))
    for (const town of TOWNS) {
      expect(
        shortestWorldPath(rado.door, town.door, { allowedTiles: roadTiles }),
        town.name
      ).not.toBeNull()
    }
    expect(TOWNS.filter((town) => town.kind === 'village').map((town) => town.name)).toEqual([
      '风泵村',
      '灰脊矿村'
    ])
    expect(TOWNS.filter((town) => town.kind === 'tribe').map((town) => town.name)).toEqual([
      '苇潮部落'
    ])

    const majorTowns = TOWNS.filter((town) => !town.kind)
    for (let left = 0; left < majorTowns.length; left++) {
      for (let right = left + 1; right < majorTowns.length; right++) {
        const a = majorTowns[left].door
        const b = majorTowns[right].door
        expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])).toBeGreaterThanOrEqual(20)
      }
    }
  })
})
