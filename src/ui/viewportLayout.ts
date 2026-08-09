export type TouchPlacement = 'hidden' | 'below' | 'sides'

export interface ViewportLayoutInput {
  width: number
  height: number
  touchPlacement: TouchPlacement
}

export interface ViewportLayout {
  viewportWidth: number
  viewportHeight: number
  uiScale: number
  uiX: number
  uiY: number
  uiWidth: number
  uiHeight: number
  controlSize: number
  controlGap: number
  sideReserve: number
  bottomReserve: number
}

const UI_WIDTH = 640
const UI_HEIGHT = 480

function dimension(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1
}

export function calculateViewportLayout(input: ViewportLayoutInput): ViewportLayout {
  const viewportWidth = dimension(input.width)
  const viewportHeight = dimension(input.height)
  const sideReserve = input.touchPlacement === 'sides' ? Math.min(148, viewportWidth * 0.18) : 0
  const bottomReserve = input.touchPlacement === 'below' ? Math.min(112, viewportHeight * 0.18) : 0
  const safeWidth = Math.max(1, viewportWidth - sideReserve * 2)
  const safeHeight = Math.max(1, viewportHeight - bottomReserve)
  const uiScale = Math.min(safeWidth / UI_WIDTH, safeHeight / UI_HEIGHT)
  const uiWidth = UI_WIDTH * uiScale
  const uiHeight = UI_HEIGHT * uiScale
  const controlSize = Math.max(38, Math.min(54, Math.min(viewportWidth, viewportHeight) * 0.12))
  return {
    viewportWidth,
    viewportHeight,
    uiScale,
    uiX: sideReserve + (safeWidth - uiWidth) / 2,
    uiY: (safeHeight - uiHeight) / 2,
    uiWidth,
    uiHeight,
    controlSize,
    controlGap: Math.max(4, Math.round(controlSize * 0.1)),
    sideReserve,
    bottomReserve
  }
}
