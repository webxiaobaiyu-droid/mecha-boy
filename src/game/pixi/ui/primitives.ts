import { Container, Graphics, Rectangle, Text, type TextStyleOptions } from 'pixi.js'
import { UI_COLORS, bodyStyle, displayStyle, utilityStyle } from '@/game/pixi/ui/theme'

export interface PanelOptions {
  title?: string
  alpha?: number
  accent?: number
  inset?: boolean
  label?: string
}

export interface UiButtonOptions {
  active?: boolean
  disabled?: boolean
  detail?: string
  value?: string
  onPress?: () => void
  dense?: boolean
}

export interface ListWindowRange {
  start: number
  end: number
}

export function listWindowRange(
  total: number,
  selected: number,
  capacity: number
): ListWindowRange {
  const safeTotal = Math.max(0, Math.floor(total))
  if (safeTotal === 0) return { start: 0, end: 0 }
  const count = Math.max(1, Math.min(safeTotal, Math.floor(capacity)))
  const focus = Math.max(0, Math.min(safeTotal - 1, Math.floor(selected)))
  const start = Math.max(0, Math.min(safeTotal - count, focus - Math.floor(count / 2)))
  return { start, end: start + count }
}

export function uiScaleFor(width: number, height: number): number {
  return Math.max(0.78, Math.min(1.45, Math.min(width / 1280, height / 720)))
}

export function uiEdgeFor(width: number, height: number): number {
  return Math.round(Math.max(10, Math.min(28, Math.min(width, height) * 0.025)))
}

export function label(
  text: string,
  x: number,
  y: number,
  style: TextStyleOptions = bodyStyle(14)
): Text {
  const node = new Text({ text, style })
  node.position.set(Math.round(x), Math.round(y))
  node.resolution = 2
  return node
}

export function fitText(node: Text, maxWidth: number, minScale = 0.72) {
  if (node.width <= maxWidth || node.width <= 0) return node
  const scale = Math.max(minScale, maxWidth / node.width)
  node.scale.set(scale)
  return node
}

export function panel(width: number, height: number, options: PanelOptions = {}): Container {
  const root = new Container()
  const accent = options.accent ?? UI_COLORS.brass
  const background = new Graphics()
  background
    .rect(3, 3, width - 6, height - 6)
    .fill({ color: UI_COLORS.soot, alpha: options.alpha ?? 0.94 })
    .rect(0, 0, width, height)
    .stroke({ color: UI_COLORS.black, width: 3, alpha: 0.98 })
    .rect(3, 3, width - 6, height - 6)
    .stroke({ color: UI_COLORS.steel, width: 1, alpha: 0.88 })
    .rect(7, 7, width - 14, height - 14)
    .stroke({ color: options.inset ? UI_COLORS.steelDark : accent, width: 1, alpha: 0.36 })
  background
    .moveTo(10, 3)
    .lineTo(Math.min(width - 16, 88), 3)
    .stroke({ color: accent, width: 3 })
  background
    .moveTo(width - 58, height - 3)
    .lineTo(width - 10, height - 3)
    .stroke({ color: UI_COLORS.steelLight, width: 2, alpha: 0.42 })
  for (const [x, y] of [
    [8, 8],
    [width - 8, 8],
    [8, height - 8],
    [width - 8, height - 8]
  ]) {
    background.circle(x, y, 1.6).fill(UI_COLORS.steelLight)
    background.circle(x, y, 0.7).fill(UI_COLORS.black)
  }
  root.addChild(background)

  if (options.title) {
    const title = label(options.title, 16, 11, displayStyle(15, { fill: UI_COLORS.paper }))
    fitText(title, width - 32)
    root.addChild(title)
    const divider = new Graphics()
      .moveTo(14, 35)
      .lineTo(width - 14, 35)
      .stroke({ color: UI_COLORS.steel, width: 1, alpha: 0.72 })
      .moveTo(14, 35)
      .lineTo(Math.min(width - 14, 72), 35)
      .stroke({ color: accent, width: 2 })
    root.addChild(divider)
  }

  if (options.label) {
    const tag = label(options.label.toUpperCase(), width - 12, 8, utilityStyle(9))
    tag.anchor.set(1, 0)
    root.addChild(tag)
  }
  return root
}

export function uiButton(
  text: string,
  width: number,
  height: number,
  options: UiButtonOptions = {}
): Container {
  const root = new Container()
  const active = !!options.active
  const disabled = !!options.disabled
  const background = new Graphics()
  background.rect(0, 0, width, height).fill({
    color: active ? 0x3b3325 : UI_COLORS.gunmetal,
    alpha: disabled ? 0.38 : active ? 0.98 : 0.82
  })
  background
    .moveTo(0, height - 1)
    .lineTo(width, height - 1)
    .stroke({ color: UI_COLORS.steelDark, width: 1, alpha: 0.82 })
  if (active) {
    background.rect(0, 0, 5, height).fill(UI_COLORS.brass)
    background
      .moveTo(8, 2)
      .lineTo(width - 6, 2)
      .stroke({ color: UI_COLORS.brassLight, width: 1, alpha: 0.5 })
  }
  root.addChild(background)

  const fontSize = options.dense ? 12 : 14
  const copy = label(
    text,
    active ? 17 : 11,
    options.dense ? 5 : 7,
    bodyStyle(fontSize, {
      fill: disabled ? UI_COLORS.steelLight : active ? UI_COLORS.brassLight : UI_COLORS.text
    })
  )
  fitText(copy, width - (options.value ? 100 : 24))
  root.addChild(copy)

  if (options.detail) {
    const detail = label(
      options.detail,
      active ? 17 : 11,
      height - 15,
      utilityStyle(9, {
        fill: disabled ? UI_COLORS.steel : UI_COLORS.muted
      })
    )
    fitText(detail, width - 24)
    root.addChild(detail)
  }
  if (options.value) {
    const value = label(
      options.value,
      width - 11,
      Math.max(5, (height - fontSize) / 2 - 1),
      utilityStyle(11, {
        fill: active ? UI_COLORS.brassLight : UI_COLORS.success,
        align: 'right'
      })
    )
    value.anchor.set(1, 0)
    fitText(value, 88)
    root.addChild(value)
  }

  root.hitArea = new Rectangle(0, 0, width, height)
  if (options.onPress && !disabled) {
    root.eventMode = 'static'
    root.cursor = 'pointer'
    root.on('pointertap', (event) => {
      event.stopPropagation()
      options.onPress?.()
    })
  } else {
    root.eventMode = 'none'
  }
  return root
}

export function progressBar(
  width: number,
  value: number,
  color: number = UI_COLORS.success,
  height = 8
): Container {
  const root = new Container()
  const progress = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const graphic = new Graphics()
    .rect(0, 0, width, height)
    .fill(UI_COLORS.black)
    .rect(1, 1, width - 2, height - 2)
    .fill(UI_COLORS.steelDark)
  if (progress > 0) graphic.rect(2, 2, Math.max(1, (width - 4) * progress), height - 4).fill(color)
  root.addChild(graphic)
  return root
}

export function sectionTitle(text: string, width: number): Container {
  const root = new Container()
  const copy = label(text, 0, 0, utilityStyle(10, { fill: UI_COLORS.brassLight }))
  root.addChild(copy)
  const line = new Graphics()
    .moveTo(0, 18)
    .lineTo(width, 18)
    .stroke({ color: UI_COLORS.steel, width: 1, alpha: 0.5 })
    .moveTo(0, 18)
    .lineTo(Math.min(46, width), 18)
    .stroke({ color: UI_COLORS.brass, width: 2 })
  root.addChild(line)
  return root
}
