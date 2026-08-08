import { REGIONS } from '@/game/data/combat'
import { CAVES } from '@/game/data/maps'
import type { GameState, RegionDef } from '@/game/types'

const VEHICLE_LABELS: Record<RegionDef['vehicle'], string> = {
  optional: '战车可选',
  recommended: '建议乘车',
  required: '必须乘车'
}

function distanceToAnchor(region: RegionDef, x: number, y: number): number {
  const dx = x - region.anchor[0]
  const dy = y - region.anchor[1]
  return dx * dx + dy * dy
}

export function regionAtWorld(x: number, y: number): RegionDef {
  const candidates = REGIONS.filter(
    (region) => x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1
  )
  const pool = candidates.length ? candidates : REGIONS
  return [...pool].sort(
    (left, right) => distanceToAnchor(left, x, y) - distanceToAnchor(right, x, y)
  )[0]
}

export function regionForLocation(map: string, x: number, y: number): RegionDef | null {
  if (map === 'world') return regionAtWorld(x, y)
  const cave = CAVES.find((item) => item.id === map)
  return cave ? REGIONS.find((region) => region.id === cave.region) || null : null
}

export function currentRegion(state: Pick<GameState, 'map' | 'px' | 'py'>): RegionDef | null {
  return regionForLocation(state.map, state.px, state.py)
}

export function dangerPips(region: RegionDef): string {
  return `${'◆'.repeat(region.dangerLevel)}${'◇'.repeat(5 - region.dangerLevel)}`
}

export function recommendedLevelLabel(region: RegionDef): string {
  return `Lv.${region.recommendedLevel[0]}-${region.recommendedLevel[1]}`
}

export function vehicleRecommendationLabel(region: RegionDef): string {
  return VEHICLE_LABELS[region.vehicle]
}
