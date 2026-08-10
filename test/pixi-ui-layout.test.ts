import { describe, expect, it } from 'vitest'
import { hudLayout } from '@/game/pixi/ui/hud'
import { battleUiLayout } from '@/game/pixi/ui/overlays'
import { listWindowRange, uiScaleFor } from '@/game/pixi/ui/primitives'
import { shouldShowTouchControls, touchControlLayout } from '@/game/pixi/ui/touch'
import { titleScreenLayout } from '@/game/pixi/ui/title'

describe('Pixi fullscreen UI layout', () => {
  it('anchors HUD panels to the real ultrawide viewport edges', () => {
    const width = 1720
    const height = 784
    const layout = hudLayout(width, height, uiScaleFor(width, height))

    expect(layout.edge).toBeLessThanOrEqual(24)
    expect(layout.moneyX + layout.moneyWidth + layout.edge).toBe(width)
    expect(layout.tankX + layout.tankWidth + layout.edge).toBe(width)
    expect(layout.leftWidth).toBeLessThan(width / 2)
  })

  it('keeps compact HUD panels inside a portrait viewport', () => {
    const width = 390
    const height = 844
    const layout = hudLayout(width, height, uiScaleFor(width, height))

    expect(layout.compact).toBe(true)
    expect(layout.leftWidth + layout.edge * 2).toBeLessThanOrEqual(width)
    expect(layout.moneyX).toBeGreaterThanOrEqual(layout.edge)
    expect(layout.moneyX + layout.moneyWidth).toBeLessThanOrEqual(width - layout.edge)
  })

  it('keeps portrait touch clusters within the viewport and reserves their height', () => {
    const width = 390
    const height = 844
    const layout = touchControlLayout(width, height)
    const dpadRight = layout.dpadX + layout.buttonSize * 3 + layout.gap * 2
    const actionRight = layout.actionX + layout.buttonSize * 2 + layout.gap

    expect(layout.portrait).toBe(true)
    expect(dpadRight).toBeLessThanOrEqual(width - layout.edge)
    expect(actionRight).toBeLessThanOrEqual(width - layout.edge)
    expect(layout.dpadY + layout.buttonSize * 2 + layout.gap).toBeLessThanOrEqual(
      height - layout.edge
    )
    expect(layout.bottomReserve).toBeGreaterThan(layout.buttonSize * 2)
  })

  it('moves landscape touch clusters to the sides without consuming bottom space', () => {
    const width = 844
    const height = 390
    const layout = touchControlLayout(width, height)

    expect(layout.portrait).toBe(false)
    expect(layout.bottomReserve).toBe(0)
    expect(layout.dpadX).toBe(layout.edge)
    expect(layout.actionX + layout.buttonSize * 2 + layout.gap).toBe(width - layout.edge)
    expect(layout.dpadY).toBeGreaterThanOrEqual(0)
  })

  it('shows virtual controls only on screens that need pad-style input', () => {
    for (const screen of [
      'intro',
      'world',
      'town',
      'cave',
      'room',
      'ending',
      'gameover'
    ] as const) {
      expect(shouldShowTouchControls(screen, false, 390)).toBe(true)
    }
    for (const screen of ['title', 'menu', 'shop', 'password', 'battle'] as const) {
      expect(shouldShowTouchControls(screen, false, 390)).toBe(false)
    }
    expect(shouldShowTouchControls('world', true, 390)).toBe(false)
    expect(shouldShowTouchControls('world', false, 1280)).toBe(false)
  })

  it('keeps every selected overflow row inside the reachable list window', () => {
    const total = 19
    const capacity = 5
    for (let selected = 0; selected < total; selected++) {
      const range = listWindowRange(total, selected, capacity)
      expect(range.end - range.start).toBe(capacity)
      expect(range.start).toBeLessThanOrEqual(selected)
      expect(range.end).toBeGreaterThan(selected)
    }
    expect(listWindowRange(total, 0, capacity)).toEqual({ start: 0, end: 5 })
    expect(listWindowRange(total, total - 1, capacity)).toEqual({ start: 14, end: 19 })
  })

  it('keeps the portrait battle command panel narrow enough to expose the battlefield', () => {
    const width = 390
    const height = 844
    const scale = uiScaleFor(width, height)
    const layout = battleUiLayout(width, height, scale, 0)

    expect(layout.portrait).toBe(true)
    expect(layout.commandWidth).toBeLessThanOrEqual(width * 0.6)
    expect(layout.edge + layout.commandWidth).toBeLessThan(width - layout.edge)
    expect(layout.lowerY).toBe(height - layout.edge)
  })

  it.each([
    [2048, 976],
    [3440, 1440],
    [844, 390],
    [390, 844],
    [320, 568]
  ])('keeps the title composition reachable at %ix%i', (width, height) => {
    const scale = uiScaleFor(width, height)
    const layout = titleScreenLayout(width, height, scale)

    expect(layout.contentX).toBeGreaterThanOrEqual(layout.edge)
    expect(layout.menuX + layout.menuWidth).toBeLessThanOrEqual(width - layout.edge)
    expect(layout.logoY).toBeGreaterThanOrEqual(layout.edge)
    expect(layout.menuY).toBeGreaterThan(layout.subtitleY)
    expect(layout.menuY + layout.menuHeight).toBeLessThanOrEqual(height - layout.edge)
    expect(layout.rowHeight).toBeGreaterThanOrEqual(42)
  })
})
