import {
  TILE,
  WORLD,
  WORLD_CAVE_POSITIONS,
  WORLD_H,
  WORLD_TOWN_POSITIONS,
  WORLD_W
} from '@/game/data/maps'

export const WORLD_LAYOUT_VERSION = 2

const LEGACY_LANDMARKS: Array<[[number, number], [number, number]]> = [
  [[25, 42], WORLD_TOWN_POSITIONS.rado],
  [[41, 32], WORLD_TOWN_POSITIONS.masaru],
  [[60, 28], WORLD_TOWN_POSITIONS.pobb],
  [[31, 22], WORLD_TOWN_POSITIONS.rock],
  [[40, 17], WORLD_TOWN_POSITIONS.odo],
  [[47, 12], WORLD_TOWN_POSITIONS.sold],
  [[35, 9], WORLD_TOWN_POSITIONS.tarr],
  [[56, 10], WORLD_TOWN_POSITIONS.eden],
  [[26, 46], WORLD_CAVE_POSITIONS.cave1],
  [[33, 40], WORLD_CAVE_POSITIONS.north_relay],
  [[71, 27], WORLD_CAVE_POSITIONS.factory],
  [[33, 24], WORLD_CAVE_POSITIONS.clinic],
  [[64, 16], WORLD_CAVE_POSITIONS.puru_cave],
  [[15, 12], WORLD_CAVE_POSITIONS.base8],
  [[52, 4], WORLD_CAVE_POSITIONS.hell_gate],
  [[52, 2], WORLD_CAVE_POSITIONS.noa]
]

function nearestWalkable(x: number, y: number): [number, number] {
  const cx = Math.max(0, Math.min(WORLD_W - 1, Math.round(x)))
  const cy = Math.max(0, Math.min(WORLD_H - 1, Math.round(y)))
  for (let radius = 0; radius <= 12; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const dx = radius - Math.abs(dy)
      for (const tx of dx === 0 ? [cx] : [cx - dx, cx + dx]) {
        const ty = cy + dy
        if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) continue
        const tile = WORLD[ty][tx]
        if (TILE[tile]?.w && tile !== 'H') return [tx, ty]
      }
    }
  }
  return WORLD_TOWN_POSITIONS.rado
}

/** 把 80×64 旧世界中的野外存档迁移到扩建后的 96×72 路网。 */
export function migrateLegacyWorldPosition(x: number, y: number): [number, number] {
  const sourceX = Number.isFinite(x) ? x : 25
  const sourceY = Number.isFinite(y) ? y : 42
  const nearest = [...LEGACY_LANDMARKS].sort((left, right) => {
    const leftDistance = Math.hypot(sourceX - left[0][0], sourceY - left[0][1])
    const rightDistance = Math.hypot(sourceX - right[0][0], sourceY - right[0][1])
    return leftDistance - rightDistance
  })[0]
  const distance = Math.hypot(sourceX - nearest[0][0], sourceY - nearest[0][1])
  if (distance <= 14) {
    return nearestWalkable(
      nearest[1][0] + (sourceX - nearest[0][0]),
      nearest[1][1] + (sourceY - nearest[0][1])
    )
  }
  return nearestWalkable((sourceX / 79) * (WORLD_W - 1), (sourceY / 63) * (WORLD_H - 1))
}
