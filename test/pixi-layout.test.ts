import { describe, expect, it } from 'vitest'
import {
  BATTLE_VIEW_HEIGHT,
  BATTLE_VIEW_WIDTH,
  battleFighterAnchor,
  battleMobAnchor,
  battleViewportLayout,
  explorationTileSize,
  townBackdropMarginTiles
} from '../src/game/pixi/layout'

describe('Pixi full-screen layout', () => {
  it('uses the complete 16:9 battle composition on desktop', () => {
    const layout = battleViewportLayout(1280, 720)
    expect(layout).toEqual({
      portrait: false,
      scale: 1,
      visibleVirtualWidth: BATTLE_VIEW_WIDTH,
      visibleVirtualHeight: BATTLE_VIEW_HEIGHT
    })
  })

  it('covers portrait screens instead of letterboxing the battle', () => {
    const layout = battleViewportLayout(390, 844)
    expect(layout.portrait).toBe(true)
    expect(layout.scale * BATTLE_VIEW_HEIGHT).toBeCloseTo(844)
    expect(layout.scale * BATTLE_VIEW_WIDTH).toBeGreaterThan(390)

    const visibleLeft = (BATTLE_VIEW_WIDTH - layout.visibleVirtualWidth) / 2
    const visibleRight = visibleLeft + layout.visibleVirtualWidth
    const fighter = battleFighterAnchor(true, 0)
    const mob = battleMobAnchor(true, 0, 1)
    expect(fighter.x).toBeGreaterThanOrEqual(visibleLeft)
    expect(mob.x).toBeLessThanOrEqual(visibleRight)
  })

  it('keeps portrait town and cave tiles dense instead of fitting the entire map', () => {
    const townTile = explorationTileSize({
      viewportWidth: 390,
      viewportHeight: 844,
      mapWidth: 44,
      mapHeight: 26,
      kind: 'town'
    })
    const caveTile = explorationTileSize({
      viewportWidth: 390,
      viewportHeight: 844,
      mapWidth: 26,
      mapHeight: 17,
      kind: 'cave'
    })
    expect(townTile).toBe(38)
    expect(caveTile).toBe(40)
    expect(townTile).toBeLessThanOrEqual(40)
    expect(caveTile).toBeLessThanOrEqual(40)
  })

  it('caps large-screen exploration tiles so the source pixels stay dense', () => {
    expect(
      explorationTileSize({
        viewportWidth: 3840,
        viewportHeight: 2160,
        mapWidth: 44,
        mapHeight: 26,
        kind: 'town'
      })
    ).toBe(40)
    expect(
      explorationTileSize({
        viewportWidth: 3840,
        viewportHeight: 2160,
        mapWidth: 20,
        mapHeight: 15,
        kind: 'room'
      })
    ).toBe(44)
  })

  it('extends town ground far enough to cover ultrawide viewports without edge seams', () => {
    const viewportWidth = 3840
    const townWidth = 44
    const tilePixels = 40
    const margin = townBackdropMarginTiles(viewportWidth, townWidth, tilePixels)

    expect(margin).toBe(28)
    expect((townWidth + margin * 2) * tilePixels).toBeGreaterThanOrEqual(viewportWidth)
  })

  it('keeps the overworld dense while showing a useful mobile radius', () => {
    expect(
      explorationTileSize({
        viewportWidth: 1920,
        viewportHeight: 1080,
        mapWidth: 96,
        mapHeight: 72,
        kind: 'world'
      })
    ).toBe(32)
    expect(
      explorationTileSize({
        viewportWidth: 390,
        viewportHeight: 844,
        mapWidth: 96,
        mapHeight: 72,
        kind: 'world'
      })
    ).toBe(27)
  })
})
