import { describe, expect, it } from 'vitest'
import { calculateStageLayout, snapStageScale } from '../src/ui/stageLayout'
import { caveTileSizeForScale, explorationTileSizeForScale } from '../src/game/engine/renderer'

describe('stage scale calculation', () => {
  it.each([
    [1280, 720, 1.5],
    [1366, 768, 1.6],
    [1440, 900, 1.875],
    [1920, 1080, 2.25],
    [2560, 1440, 3]
  ])('uses the largest fine-step scale inside a %ix%i desktop viewport', (width, height, scale) => {
    const layout = calculateStageLayout({
      viewportWidth: width,
      viewportHeight: height,
      touchControls: false
    })

    expect(layout.scale).toBe(scale)
    expect(layout.scaleMode).toBe('continuous-fit')
    expect(layout.stageWidth).toBe(640 * scale)
    expect(layout.stageHeight).toBe(480 * scale)
    expect(layout.shellX + layout.shellWidth).toBeLessThanOrEqual(width)
    expect(layout.shellY + layout.shellHeight).toBeLessThanOrEqual(height)
  })

  it('centers a 1366x768 desktop stage on whole CSS pixels', () => {
    const layout = calculateStageLayout({
      viewportWidth: 1366,
      viewportHeight: 768,
      touchControls: false
    })

    expect(layout).toMatchObject({
      stageWidth: 1024,
      stageHeight: 768,
      shellX: 171,
      shellY: 0,
      stageX: 0,
      stageY: 0
    })
  })

  it('places portrait touch controls below the stage without overlap', () => {
    const layout = calculateStageLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      touchControls: true
    })

    expect(layout.scale).toBe(0.60625)
    expect(layout.scaleMode).toBe('continuous-fit')
    expect(layout.touchPlacement).toBe('below')
    expect(layout.stageWidth).toBe(388)
    expect(layout.stageHeight).toBe(291)
    expect(layout.shellHeight).toBe(
      layout.stageHeight + layout.stageControlGap + layout.controlsHeight
    )
    expect(layout.shellY + layout.shellHeight).toBeLessThanOrEqual(844)
  })

  it('places landscape touch controls in side gutters', () => {
    const layout = calculateStageLayout({
      viewportWidth: 844,
      viewportHeight: 390,
      touchControls: true
    })

    expect(layout.scale).toBe(0.8125)
    expect(layout.scaleMode).toBe('continuous-fit')
    expect(layout.touchPlacement).toBe('sides')
    expect(layout.stageX).toBe(148)
    expect(layout.shellWidth).toBeLessThanOrEqual(844)
    expect(layout.shellHeight).toBe(390)
  })

  it('uses compact controls to keep a 320px-wide phone pixel-snapped', () => {
    const layout = calculateStageLayout({
      viewportWidth: 320,
      viewportHeight: 568,
      touchControls: true
    })

    expect(layout).toMatchObject({
      scale: 0.5,
      scaleMode: 'continuous-fit',
      touchPlacement: 'below',
      stageWidth: 320,
      stageHeight: 240,
      shellWidth: 320,
      controlSize: 36,
      controlsHeight: 80
    })
    expect(layout.shellY + layout.shellHeight).toBeLessThanOrEqual(568)
  })

  it('falls back to an exact eighth-step only below the supported 0.5x viewport', () => {
    expect(snapStageScale(0.49)).toEqual({ scale: 0.375, mode: 'emergency-fit' })
    expect(snapStageScale(0.5)).toEqual({ scale: 0.5, mode: 'half-step' })

    const layout = calculateStageLayout({
      viewportWidth: 300,
      viewportHeight: 200,
      touchControls: false
    })
    expect(layout.scale).toBe(0.375)
    expect(layout.scaleMode).toBe('emergency-fit')
    expect(layout.shellWidth).toBeLessThanOrEqual(300)
    expect(layout.shellHeight).toBeLessThanOrEqual(200)
  })

  it('caps oversized displays without breaking half-step alignment', () => {
    const layout = calculateStageLayout({
      viewportWidth: 7680,
      viewportHeight: 4320,
      touchControls: false,
      maxScale: 4
    })

    expect(layout.scale).toBe(4)
    expect(layout.stageWidth).toBe(2560)
    expect(layout.stageHeight).toBe(1920)
  })

  it('keeps exploration readable on small touch stages while densifying desktop maps', () => {
    expect(explorationTileSizeForScale(0.60625)).toBe(32)
    expect(explorationTileSizeForScale(0.8125)).toBe(28)
    expect(explorationTileSizeForScale(1)).toBe(20)
    expect(explorationTileSizeForScale(1.9625)).toBe(20)
    expect(caveTileSizeForScale(0.8125)).toBe(32)
    expect(caveTileSizeForScale(1)).toBe(29)
    expect(caveTileSizeForScale(1.9625)).toBe(29)
  })
})
