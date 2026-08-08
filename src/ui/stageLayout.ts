export const LOGICAL_STAGE_WIDTH = 640
export const LOGICAL_STAGE_HEIGHT = 480
export const HALF_SCALE_STEP = 0.5

const EMERGENCY_SCALE_STEP = 0.125
const CONTINUOUS_SCALE_UNITS = 160
const DEFAULT_MAX_SCALE = 4
const NORMAL_CONTROL_SIZE = 44
const COMPACT_CONTROL_SIZE = 36
const MIN_CONTROL_SIZE = 20

export type TouchPlacement = 'hidden' | 'below' | 'sides'
export type StageScaleMode = 'half-step' | 'continuous-fit' | 'emergency-fit'

export interface StageLayoutInput {
  viewportWidth: number
  viewportHeight: number
  touchControls: boolean
  maxScale?: number
}

export interface StageLayout {
  scale: number
  scaleMode: StageScaleMode
  stageWidth: number
  stageHeight: number
  shellWidth: number
  shellHeight: number
  shellX: number
  shellY: number
  stageX: number
  stageY: number
  touchPlacement: TouchPlacement
  controlSize: number
  controlGap: number
  controlsHeight: number
  stageControlGap: number
}

interface ControlMetrics {
  size: number
  gap: number
  height: number
  stageGap: number
  directionalWidth: number
  actionWidth: number
  totalWidth: number
  sideBand: number
}

interface ScaleChoice {
  scale: number
  mode: StageScaleMode
}

interface LayoutCandidate extends ScaleChoice {
  placement: Exclude<TouchPlacement, 'hidden'>
}

function dimension(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.floor(value))
}

function controlMetrics(viewportWidth: number, viewportHeight: number): ControlMetrics {
  const compact = Math.min(viewportWidth, viewportHeight) <= 360
  const desiredSize = compact ? COMPACT_CONTROL_SIZE : NORMAL_CONTROL_SIZE
  const gap = compact ? 3 : 4
  const minimumGroupGap = compact ? 10 : 16
  const maxSizeForWidth = Math.floor((viewportWidth - minimumGroupGap - gap * 3) / 5)
  const size = Math.max(MIN_CONTROL_SIZE, Math.min(desiredSize, maxSizeForWidth))
  const height = size * 2 + gap + (compact ? 5 : 8)
  const stageGap = compact ? 0 : 8
  const directionalWidth = size * 3 + gap * 2
  const actionWidth = size * 2 + gap

  return {
    size,
    gap,
    height,
    stageGap,
    directionalWidth,
    actionWidth,
    totalWidth: directionalWidth + actionWidth + minimumGroupGap,
    sideBand: Math.max(directionalWidth, actionWidth) + stageGap
  }
}

export function snapStageScale(rawScale: number, maxScale = DEFAULT_MAX_SCALE): ScaleChoice {
  if (!Number.isFinite(rawScale) || rawScale <= 0) {
    return { scale: 0, mode: 'emergency-fit' }
  }

  const cappedScale = Math.min(rawScale, Math.max(HALF_SCALE_STEP, maxScale))
  const halfStepScale =
    Math.floor((cappedScale + Number.EPSILON) / HALF_SCALE_STEP) * HALF_SCALE_STEP
  if (halfStepScale >= HALF_SCALE_STEP) {
    return { scale: halfStepScale, mode: 'half-step' }
  }

  const emergencyScale = Math.floor(cappedScale / EMERGENCY_SCALE_STEP) * EMERGENCY_SCALE_STEP
  return {
    scale: emergencyScale > 0 ? emergencyScale : cappedScale,
    mode: 'emergency-fit'
  }
}

function scaleForSpace(width: number, height: number, maxScale?: number): ScaleChoice {
  if (width <= 0 || height <= 0) return { scale: 0, mode: 'emergency-fit' }
  const rawScale = Math.min(width / LOGICAL_STAGE_WIDTH, height / LOGICAL_STAGE_HEIGHT)
  if (rawScale < HALF_SCALE_STEP) return snapStageScale(rawScale, maxScale)
  return fitContinuousStageScale(rawScale, maxScale)
}

export function fitContinuousStageScale(
  rawScale: number,
  maxScale = DEFAULT_MAX_SCALE
): ScaleChoice {
  if (!Number.isFinite(rawScale) || rawScale <= 0) {
    return { scale: 0, mode: 'continuous-fit' }
  }

  const cappedScale = Math.min(rawScale, Math.max(1 / CONTINUOUS_SCALE_UNITS, maxScale))
  const scaleUnits = Math.floor((cappedScale + Number.EPSILON) * CONTINUOUS_SCALE_UNITS)

  return {
    scale: scaleUnits > 0 ? scaleUnits / CONTINUOUS_SCALE_UNITS : cappedScale,
    mode: 'continuous-fit'
  }
}

function touchScaleForSpace(width: number, height: number, maxScale?: number): ScaleChoice {
  if (width <= 0 || height <= 0) return { scale: 0, mode: 'continuous-fit' }
  const rawScale = Math.min(width / LOGICAL_STAGE_WIDTH, height / LOGICAL_STAGE_HEIGHT)
  return fitContinuousStageScale(rawScale, maxScale)
}

function chooseTouchCandidate(
  below: LayoutCandidate,
  sides: LayoutCandidate,
  preferSides: boolean
): LayoutCandidate {
  if (below.scale !== sides.scale) return below.scale > sides.scale ? below : sides
  return preferSides ? sides : below
}

export function calculateStageLayout(input: StageLayoutInput): StageLayout {
  const viewportWidth = dimension(input.viewportWidth)
  const viewportHeight = dimension(input.viewportHeight)
  const controls = controlMetrics(viewportWidth, viewportHeight)

  let touchPlacement: TouchPlacement = 'hidden'
  let scaleChoice = scaleForSpace(viewportWidth, viewportHeight, input.maxScale)

  if (input.touchControls) {
    const belowScale = touchScaleForSpace(
      viewportWidth,
      viewportHeight - controls.height - controls.stageGap,
      input.maxScale
    )
    const sidesScale = touchScaleForSpace(
      viewportWidth - controls.sideBand * 2,
      viewportHeight,
      input.maxScale
    )
    const selected = chooseTouchCandidate(
      { ...belowScale, placement: 'below' },
      { ...sidesScale, placement: 'sides' },
      viewportWidth > viewportHeight
    )
    touchPlacement = selected.placement
    scaleChoice = selected
  }

  const stageWidth = Math.round(LOGICAL_STAGE_WIDTH * scaleChoice.scale)
  const stageHeight = Math.round(LOGICAL_STAGE_HEIGHT * scaleChoice.scale)

  let shellWidth = stageWidth
  let shellHeight = stageHeight
  let stageX = 0

  if (touchPlacement === 'below') {
    shellWidth = Math.min(viewportWidth, Math.max(stageWidth, controls.totalWidth))
    shellHeight = stageHeight + controls.stageGap + controls.height
    stageX = Math.floor((shellWidth - stageWidth) / 2)
  } else if (touchPlacement === 'sides') {
    shellWidth = stageWidth + controls.sideBand * 2
    shellHeight = stageHeight
    stageX = controls.sideBand
  }

  const shellX = Math.max(0, Math.floor((viewportWidth - shellWidth) / 2))
  const shellY = Math.max(0, Math.floor((viewportHeight - shellHeight) / 2))

  return {
    scale: scaleChoice.scale,
    scaleMode: scaleChoice.mode,
    stageWidth,
    stageHeight,
    shellWidth,
    shellHeight,
    shellX,
    shellY,
    stageX,
    stageY: 0,
    touchPlacement,
    controlSize: controls.size,
    controlGap: controls.gap,
    controlsHeight: controls.height,
    stageControlGap: controls.stageGap
  }
}
