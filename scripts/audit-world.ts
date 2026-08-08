import {
  TILE,
  TOWNS,
  WORLD,
  WORLD_GATE_POSITIONS,
  WORLD_H,
  WORLD_TOWN_POSITIONS,
  WORLD_W
} from '../src/game/data/maps'

type Point = readonly [number, number]

const DIRECTIONS: readonly Point[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0]
]

const gateKeys = new Set(Object.values(WORLD_GATE_POSITIONS).map(([x, y]) => `${x},${y}`))

function shortestPath(
  start: Point,
  goal: Point,
  options: { blockedGates?: ReadonlySet<string>; allowedTiles?: ReadonlySet<string> } = {}
): Point[] | null {
  const startKey = start.join(',')
  const goalKey = goal.join(',')
  const queue: Point[] = [start]
  let cursor = 0
  const previous = new Map<string, string | null>([[startKey, null]])

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

    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) continue
      const nextKey = `${nx},${ny}`
      const tile = WORLD[ny][nx]
      if (
        previous.has(nextKey) ||
        !TILE[tile]?.w ||
        options.blockedGates?.has(nextKey) ||
        (options.allowedTiles && !options.allowedTiles.has(tile))
      )
        continue
      previous.set(nextKey, currentKey)
      queue.push([nx, ny])
    }
  }
  return null
}

function distance(path: Point[] | null): string {
  return path ? String(path.length - 1) : 'blocked'
}

const roadTiles = new Set(['D', 't', 'r', 'C', 'H', 'N', 'G', 'F'])
const allGatesLocked = new Set(gateKeys)

function lockedExcept(...openGateIds: Array<keyof typeof WORLD_GATE_POSITIONS>): Set<string> {
  const open = new Set(openGateIds.map((id) => WORLD_GATE_POSITIONS[id].join(',')))
  return new Set([...gateKeys].filter((key) => !open.has(key)))
}

console.log(`world ${WORLD_W}x${WORLD_H}; towns ${TOWNS.length}`)
for (const [from, to] of [
  ['rado', 'windpump'],
  ['windpump', 'masaru'],
  ['masaru', 'reed'],
  ['reed', 'pobb'],
  ['ashridge', 'odo'],
  ['odo', 'sold']
] as const) {
  const start = WORLD_TOWN_POSITIONS[from]
  const goal = WORLD_TOWN_POSITIONS[to]
  const open = shortestPath(start, goal)
  const locked = shortestPath(start, goal, { blockedGates: allGatesLocked })
  const road = shortestPath(start, goal, { allowedTiles: roadTiles })
  console.log(
    `${from} -> ${to}: open=${distance(open)} locked=${distance(locked)} road=${distance(road)}`
  )
}

const reachableLocked = TOWNS.filter((town) =>
  shortestPath(WORLD_TOWN_POSITIONS.rado, town.door, { blockedGates: allGatesLocked })
).map((town) => town.id)
console.log(`reachable with every gate locked: ${reachableLocked.join(', ')}`)

const lockedTideRoute = shortestPath(WORLD_TOWN_POSITIONS.reed, WORLD_TOWN_POSITIONS.pobb, {
  blockedGates: allGatesLocked
})
console.log(
  `locked tide crossings: ${
    lockedTideRoute
      ?.filter(([x]) => x === 72)
      .map(([x, y]) => `${x},${y}:${WORLD[y][x]}`)
      .join(' | ') || 'none'
  }`
)
const ford: Point = [72, 59]
console.log(
  `ford legs: reed=${distance(shortestPath(WORLD_TOWN_POSITIONS.reed, ford, { blockedGates: allGatesLocked }))} ` +
    `pobb=${distance(shortestPath(ford, WORLD_TOWN_POSITIONS.pobb, { blockedGates: allGatesLocked }))}`
)

for (const [label, from, to, openGateIds] of [
  ['normal southern exit', 'windpump', 'masaru', ['windbreak']],
  ['marshal sequence break', 'ashridge', 'odo', ['graypass']],
  ['tide bridge shortcut', 'reed', 'pobb', ['tidebridge']],
  ['north checkpoint shortcut', 'odo', 'sold', ['north_checkpoint']]
] as const) {
  const path = shortestPath(WORLD_TOWN_POSITIONS[from], WORLD_TOWN_POSITIONS[to], {
    blockedGates: lockedExcept(...openGateIds)
  })
  console.log(`${label}: ${distance(path)}`)
}
