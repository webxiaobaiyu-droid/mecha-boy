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
import { WORLD_CAVE_POSITIONS, WORLD_H, WORLD_TOWN_POSITIONS, WORLD_W } from '@/game/data/maps'
import {
  buildWorldMapViewModel,
  caveWorldEntrance,
  createWorldMapProgress,
  isWorldTileExplored,
  knownWorldLocations,
  knownWorldRegions,
  normalizeWorldMapProgress,
  regionExplorationStats,
  revealWorldTiles,
  worldMapPositionForState,
  worldPositionForLocation
} from '@/game/systems/world-map'

function exploredCount(progress: ReturnType<typeof createWorldMapProgress>): number {
  return progress.explored.reduce(
    (total, row) => total + [...row].filter((cell) => cell === '1').length,
    0
  )
}

describe('世界地图测绘', () => {
  const rado = WORLD_TOWN_POSITIONS.rado
  const pobb = WORLD_TOWN_POSITIONS.pobb
  const odo = WORLD_TOWN_POSITIONS.odo

  beforeEach(() => {
    input.poll()
    saves.clear()
    store.newGame()
    store.state.screen = 'world'
    store.state.base = null
    store.state.dialog = null
    store.state.menu = null
  })

  it('以世界瓦片为探索单位，只揭示当前位置的圆形视野', () => {
    const start: [number, number] = [rado[0], rado[1] + 1]
    const progress = createWorldMapProgress(start)

    expect(progress.explored).toHaveLength(WORLD_H)
    expect(progress.explored.every((row) => row.length === WORLD_W)).toBe(true)
    expect(isWorldTileExplored(progress, ...start)).toBe(true)
    expect(isWorldTileExplored(progress, start[0] + 3, start[1])).toBe(true)
    expect(isWorldTileExplored(progress, start[0] + 3, start[1] + 3)).toBe(false)
    expect(isWorldTileExplored(progress, ...odo)).toBe(false)
    expect(exploredCount(progress)).toBeLessThan(WORLD_W * WORLD_H * 0.02)
  })

  it('移动揭图不改变旧状态，也不会把整个区域一次性点亮', () => {
    const before = createWorldMapProgress([rado[0], rado[1] + 1], 0)
    const after = revealWorldTiles(before, rado[0], rado[1], 1)

    expect(after).not.toBe(before)
    expect(before.explored).not.toBe(after.explored)
    expect(isWorldTileExplored(before, ...rado)).toBe(false)
    expect(isWorldTileExplored(after, ...rado)).toBe(true)
    expect(knownWorldRegions(after).map((region) => region.id)).toEqual(['rado'])
    const stats = regionExplorationStats(after, knownWorldRegions(after)[0])
    expect(stats.explored).toBeLessThan(stats.total)
    expect(stats.percent).toBeLessThan(2)
  })

  it('地点名称必须等入口瓦片被探索后才出现', () => {
    const hidden = createWorldMapProgress([rado[0] - 1, rado[1]], 0)
    expect(knownWorldLocations(hidden).some((location) => location.id === 'rado')).toBe(false)

    const townKnown = revealWorldTiles(hidden, ...rado, 0)
    expect(knownWorldLocations(townKnown)).toContainEqual(
      expect.objectContaining({ id: 'rado', name: '拉多镇', kind: 'town' })
    )
    expect(knownWorldLocations(townKnown).some((location) => location.name === '麦镇')).toBe(false)

    const caveKnown = revealWorldTiles(townKnown, ...WORLD_CAVE_POSITIONS.cave1, 0)
    expect(knownWorldLocations(caveKnown)).toContainEqual(
      expect.objectContaining({
        name: '拉多镇南侧洞窟',
        kind: 'cave',
        x: WORLD_CAVE_POSITIONS.cave1[0],
        y: WORLD_CAVE_POSITIONS.cave1[1]
      })
    )
  })

  it('城镇、房间和多层洞窟都定位到对应的世界入口', () => {
    expect(worldPositionForLocation('world', ...pobb)).toEqual(pobb)
    expect(worldPositionForLocation('rado', 3, 3)).toEqual(rado)
    expect(worldPositionForLocation('rado_home_upper', 5, 5)).toEqual(rado)
    expect(caveWorldEntrance('noa3')).toEqual(WORLD_CAVE_POSITIONS.noa)
    expect(worldPositionForLocation('noa3', 13, 12)).toEqual(WORLD_CAVE_POSITIONS.noa)

    const state = store.state
    state.map = 'rado_home'
    state.px = 8
    state.py = 6
    expect(worldMapPositionForState(state)).toEqual(rado)
  })

  it('旧存档只迁移当前位置和已知城镇附近，不会默认全图开放', () => {
    const migrated = normalizeWorldMapProgress(undefined, pobb, [rado])
    const locations = knownWorldLocations(migrated)

    expect(isWorldTileExplored(migrated, ...pobb)).toBe(true)
    expect(isWorldTileExplored(migrated, ...rado)).toBe(true)
    expect(isWorldTileExplored(migrated, ...odo)).toBe(false)
    expect(locations.map((location) => location.name)).toContain('拉多镇')
    expect(locations.map((location) => location.name)).toContain('波布镇')
    expect(locations.map((location) => location.name)).not.toContain('奥多镇')
    expect(exploredCount(migrated)).toBeLessThan(WORLD_W * WORLD_H * 0.03)
  })

  it('视图模型只提供已发现区域与地点，不泄露其余名称', () => {
    const state = store.state
    state.map = 'world'
    state.px = rado[0]
    state.py = rado[1]
    state.worldMap = createWorldMapProgress(rado, 0)
    const model = buildWorldMapViewModel(state)

    expect(model.currentRegion.id).toBe('rado')
    expect(model.regions.map((region) => region.name)).toEqual(['拉多近郊'])
    expect(model.locations.map((location) => location.name)).toEqual(['拉多镇'])
    expect(model.selectedLocations.map((location) => location.name)).toEqual(['拉多镇'])
  })

  it('探索记录随存档恢复，缺少记录的旧档按最小范围迁移', () => {
    const savedPosition: [number, number] = [rado[0], rado[1] - 3]
    store.world.enterWorld(...savedPosition)
    expect(store.saveGame()).toBe(true)
    const saved = JSON.parse(saves.get('mmw_save_v1')!)
    const knownBefore = saved.worldMap.explored.join('')

    store.state.worldMap = createWorldMapProgress([3, 3], 0)
    expect(store.loadGame()).toBe(true)
    expect(store.state.worldMap.explored.join('')).toBe(knownBefore)
    expect(worldMapPositionForState(store.state)).toEqual(savedPosition)

    delete saved.worldMap
    saved.flags.town_pobb = true
    saves.set('mmw_save_v1', JSON.stringify(saved))
    expect(store.loadGame()).toBe(true)
    expect(isWorldTileExplored(store.state.worldMap, ...pobb)).toBe(true)
    expect(isWorldTileExplored(store.state.worldMap, ...odo)).toBe(false)
  })

  it('菜单可用方向键切换已发现区域并用取消键返回', () => {
    for (let y = rado[1]; y >= 32; y--) {
      store.state.worldMap = revealWorldTiles(store.state.worldMap, rado[0], y)
    }
    store.openMenu()
    store.menuSelect(FIELD_MENU_ITEMS.indexOf('地图'))
    expect(store.state.menu?.view).toBe('map')
    expect(store.worldMapForUi().regions.length).toBeGreaterThan(1)
    const first = store.state.menu?.mapRegion

    input.press('right')
    store.update(0)
    expect(store.state.menu?.mapRegion).not.toBe(first)

    input.press('b')
    store.update(0)
    expect(store.state.menu).toMatchObject({
      view: 'root',
      idx: FIELD_MENU_ITEMS.indexOf('地图')
    })
  })
})
