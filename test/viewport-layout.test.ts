import { describe, expect, it } from 'vitest'
import { calculateViewportLayout } from '../src/ui/viewportLayout'

describe('full-screen viewport layout', () => {
  it('uses the full desktop viewport while centering the readable UI safe area', () => {
    const layout = calculateViewportLayout({
      width: 1280,
      height: 720,
      touchPlacement: 'hidden'
    })
    expect(layout).toMatchObject({
      viewportWidth: 1280,
      viewportHeight: 720,
      uiScale: 1.5,
      uiWidth: 960,
      uiHeight: 720,
      uiX: 160,
      uiY: 0
    })
  })

  it('reserves the bottom touch band without changing the full-screen canvas size', () => {
    const layout = calculateViewportLayout({
      width: 390,
      height: 844,
      touchPlacement: 'below'
    })
    expect(layout.viewportWidth).toBe(390)
    expect(layout.viewportHeight).toBe(844)
    expect(layout.bottomReserve).toBe(112)
    expect(layout.uiY + layout.uiHeight).toBeLessThanOrEqual(844 - layout.bottomReserve)
    expect(layout.controlSize).toBeGreaterThanOrEqual(44)
  })

  it('reserves side controls in short landscape viewports', () => {
    const layout = calculateViewportLayout({
      width: 844,
      height: 390,
      touchPlacement: 'sides'
    })
    expect(layout.sideReserve).toBeCloseTo(148)
    expect(layout.uiX).toBeGreaterThanOrEqual(layout.sideReserve)
    expect(layout.uiX + layout.uiWidth).toBeLessThanOrEqual(844 - layout.sideReserve)
  })

  it('normalizes invalid viewport dimensions', () => {
    const layout = calculateViewportLayout({
      width: Number.NaN,
      height: -20,
      touchPlacement: 'hidden'
    })
    expect(layout.viewportWidth).toBe(1)
    expect(layout.viewportHeight).toBe(1)
    expect(layout.uiScale).toBeGreaterThan(0)
  })
})
