import { REGIONS } from '@/game/data/combat'
import { CAVES, ROOMS, TOWNS, WORLD_H, WORLD_W } from '@/game/data/maps'
import type { GameState, RegionDef, WorldMapLocation, WorldMapProgress } from '@/game/types'
import { regionAtWorld } from '@/game/systems/regions'
import {
  WORLD_GATES,
  worldGateNote,
  worldGateRequirement,
  worldGateUnlocked
} from '@/game/systems/world-gates'

export const WORLD_MAP_REVEAL_RADIUS = 3
export const WORLD_MAP_START: readonly [number, number] = [24, 59]

type WorldPoint = readonly [number, number]

function clampCoordinate(value: number, limit: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(limit - 1, Math.floor(value)))
}

function clampWorldPoint(point: WorldPoint): [number, number] {
  return [clampCoordinate(point[0], WORLD_W), clampCoordinate(point[1], WORLD_H)]
}

function emptyExplorationRows(): string[] {
  return Array.from({ length: WORLD_H }, () => '0'.repeat(WORLD_W))
}

function normalizeExplorationRows(value: unknown): string[] {
  if (!Array.isArray(value)) return emptyExplorationRows()
  return Array.from({ length: WORLD_H }, (_, y) => {
    const source = typeof value[y] === 'string' ? value[y] : ''
    let row = ''
    for (let x = 0; x < WORLD_W; x++) row += source[x] === '1' ? '1' : '0'
    return row
  })
}

export function isWorldTileExplored(
  progress: Pick<WorldMapProgress, 'explored'>,
  x: number,
  y: number
): boolean {
  return x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_H && progress.explored[y]?.[x] === '1'
}

/** 返回新的测绘状态，方便 Vue 精确追踪每次瓦片揭示。 */
export function revealWorldTiles(
  progress: WorldMapProgress,
  x: number,
  y: number,
  radius = WORLD_MAP_REVEAL_RADIUS
): WorldMapProgress {
  const [cx, cy] = clampWorldPoint([x, y])
  const safeRadius = Math.max(0, Math.floor(Number.isFinite(radius) ? radius : 0))
  const explored = normalizeExplorationRows(progress.explored)
  const rows = explored.slice()

  for (let ty = Math.max(0, cy - safeRadius); ty <= Math.min(WORLD_H - 1, cy + safeRadius); ty++) {
    const cells = rows[ty].split('')
    for (
      let tx = Math.max(0, cx - safeRadius);
      tx <= Math.min(WORLD_W - 1, cx + safeRadius);
      tx++
    ) {
      const dx = tx - cx
      const dy = ty - cy
      if (dx * dx + dy * dy <= safeRadius * safeRadius) cells[tx] = '1'
    }
    rows[ty] = cells.join('')
  }

  return { explored: rows, lastWorldX: cx, lastWorldY: cy }
}

export function createWorldMapProgress(
  point: WorldPoint = WORLD_MAP_START,
  radius = WORLD_MAP_REVEAL_RADIUS
): WorldMapProgress {
  const [x, y] = clampWorldPoint(point)
  return revealWorldTiles(
    { explored: emptyExplorationRows(), lastWorldX: x, lastWorldY: y },
    x,
    y,
    radius
  )
}

/**
 * 兼容旧存档：只恢复当前位置与已经到访城镇附近的少量瓦片，绝不按旧 region
 * 旗标整区解锁，避免把未走过的地形和地点名称泄露出来。
 */
export function normalizeWorldMapProgress(
  value: unknown,
  fallback: WorldPoint,
  legacyKnownPoints: readonly WorldPoint[] = []
): WorldMapProgress {
  const source = value && typeof value === 'object' ? (value as Partial<WorldMapProgress>) : null
  const hasStoredExploration = !!source && Array.isArray(source.explored)
  const fallbackPoint = clampWorldPoint(fallback)
  let progress: WorldMapProgress = {
    explored: normalizeExplorationRows(source?.explored),
    lastWorldX: fallbackPoint[0],
    lastWorldY: fallbackPoint[1]
  }

  progress = revealWorldTiles(progress, fallbackPoint[0], fallbackPoint[1])
  if (!hasStoredExploration) {
    for (const point of legacyKnownPoints) {
      progress = revealWorldTiles(progress, point[0], point[1], 1)
    }
  }
  return progress
}

export function caveWorldEntrance(caveId: string): [number, number] | null {
  const queue = [caveId]
  const visited = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const cave = CAVES.find((candidate) => candidate.id === id)
    if (!cave) continue
    const worldExit = cave.exits.find((exit) => exit.world)?.world
    if (worldExit) return clampWorldPoint(worldExit)
    for (const exit of cave.exits) {
      if (exit.next && !visited.has(exit.next)) queue.push(exit.next)
      if (exit.prev && !visited.has(exit.prev)) queue.push(exit.prev)
    }
  }
  return null
}

export function worldPositionForLocation(map: string, x: number, y: number): [number, number] {
  if (map === 'world') return clampWorldPoint([x, y])
  const town = TOWNS.find((candidate) => candidate.id === map)
  if (town) return clampWorldPoint(town.door)
  const room = ROOMS.find((candidate) => candidate.id === map)
  if (room) {
    const roomTown = TOWNS.find((candidate) => candidate.id === room.town)
    if (roomTown) return clampWorldPoint(roomTown.door)
  }
  const cave = CAVES.find((candidate) => candidate.id === map)
  if (cave) {
    const region = REGIONS.find((candidate) => candidate.id === cave.region)
    return caveWorldEntrance(cave.id) || clampWorldPoint(region?.anchor || WORLD_MAP_START)
  }
  return clampWorldPoint(WORLD_MAP_START)
}

export function worldMapPositionForState(
  state: Pick<GameState, 'map' | 'px' | 'py' | 'worldMap'>
): [number, number] {
  if (state.map === 'world') return worldPositionForLocation(state.map, state.px, state.py)
  const resolved = worldPositionForLocation(state.map, state.px, state.py)
  if (resolved[0] !== WORLD_MAP_START[0] || resolved[1] !== WORLD_MAP_START[1]) return resolved
  return clampWorldPoint([state.worldMap.lastWorldX, state.worldMap.lastWorldY])
}

export function knownWorldRegions(progress: Pick<WorldMapProgress, 'explored'>): RegionDef[] {
  const known = new Set<string>()
  for (let y = 0; y < WORLD_H && known.size < REGIONS.length; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      if (isWorldTileExplored(progress, x, y)) known.add(regionAtWorld(x, y).id)
    }
  }
  return REGIONS.filter((region) => known.has(region.id))
}

function locationRegionId(x: number, y: number): string {
  return regionAtWorld(x, y).id
}

export function knownWorldLocations(
  progress: Pick<WorldMapProgress, 'explored'>,
  state?: Pick<GameState, 'flags' | 'bounties'>
): WorldMapLocation[] {
  const locations: WorldMapLocation[] = []
  for (const town of TOWNS) {
    const [x, y] = town.door
    if (!isWorldTileExplored(progress, x, y)) continue
    locations.push({
      id: town.id,
      name: town.name,
      kind: town.kind || 'town',
      x,
      y,
      regionId: locationRegionId(x, y),
      note:
        town.kind === 'village'
          ? '村落 · 休整与基础补给'
          : town.kind === 'tribe'
            ? '部落 · 路线情报与支线补给'
            : '主城 · 完整补给与剧情据点'
    })
  }
  for (const cave of CAVES) {
    for (const [exitIndex, exit] of cave.exits.entries()) {
      if (!exit.world) continue
      const [x, y] = exit.world
      if (!isWorldTileExplored(progress, x, y)) continue
      locations.push({
        id: `${cave.id}:${exitIndex}`,
        name: cave.name,
        kind: 'cave',
        x,
        y,
        regionId: locationRegionId(x, y),
        note: '洞窟 · 地下探索与战车线索'
      })
    }
  }
  for (const gate of WORLD_GATES) {
    const [x, y] = gate.position
    if (!isWorldTileExplored(progress, x, y)) continue
    const open = state ? worldGateUnlocked(state, gate) : false
    locations.push({
      id: `gate:${gate.id}`,
      name: gate.name,
      kind: 'gate',
      x,
      y,
      regionId: gate.regionId,
      status: open ? 'open' : 'locked',
      note: state ? worldGateNote(state, gate) : `封锁中 · ${worldGateRequirement(gate)}`
    })
  }
  return locations
}

export function regionExplorationStats(
  progress: Pick<WorldMapProgress, 'explored'>,
  region: RegionDef
): { explored: number; total: number; percent: number } {
  let explored = 0
  let total = 0
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      if (regionAtWorld(x, y).id !== region.id) continue
      total++
      if (isWorldTileExplored(progress, x, y)) explored++
    }
  }
  return { explored, total, percent: total ? Math.round((explored / total) * 100) : 0 }
}

export interface WorldMapViewModel {
  position: [number, number]
  currentRegion: RegionDef
  regions: RegionDef[]
  selectedRegion: RegionDef
  selectedIndex: number
  locations: WorldMapLocation[]
  selectedLocations: WorldMapLocation[]
  exploration: ReturnType<typeof regionExplorationStats>
}

export function buildWorldMapViewModel(
  state: Pick<GameState, 'map' | 'px' | 'py' | 'worldMap' | 'flags' | 'bounties'>,
  selectedRegionId?: string
): WorldMapViewModel {
  const position = worldMapPositionForState(state)
  const currentRegion = regionAtWorld(position[0], position[1])
  const regions = knownWorldRegions(state.worldMap)
  const selectedRegion =
    regions.find((region) => region.id === selectedRegionId) ||
    regions.find((region) => region.id === currentRegion.id) ||
    regions[0] ||
    currentRegion
  const selectedIndex = Math.max(
    0,
    regions.findIndex((region) => region.id === selectedRegion.id)
  )
  const locations = knownWorldLocations(state.worldMap, state)
  return {
    position,
    currentRegion,
    regions,
    selectedRegion,
    selectedIndex,
    locations,
    selectedLocations: locations.filter((location) => location.regionId === selectedRegion.id),
    exploration: regionExplorationStats(state.worldMap, selectedRegion)
  }
}
