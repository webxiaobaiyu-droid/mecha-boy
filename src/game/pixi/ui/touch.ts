import { Container, Graphics, Rectangle, Text } from 'pixi.js'
import type { Screen } from '@/game/types'
import * as input from '@/game/engine/input'
import { label } from '@/game/pixi/ui/primitives'
import { UI_COLORS, displayStyle, utilityStyle } from '@/game/pixi/ui/theme'

export interface TouchControlLayout {
  buttonSize: number
  gap: number
  edge: number
  portrait: boolean
  dpadX: number
  dpadY: number
  actionX: number
  actionY: number
  bottomReserve: number
}

export function touchControlLayout(width: number, height: number): TouchControlLayout {
  const portrait = width <= height
  const shortEdge = Math.min(width, height)
  const buttonSize = Math.round(Math.max(46, Math.min(66, shortEdge * 0.13)))
  const gap = Math.round(Math.max(5, Math.min(10, buttonSize * 0.13)))
  const edge = Math.round(Math.max(10, Math.min(24, shortEdge * 0.026)))
  const clusterHeight = buttonSize * 2 + gap
  const dpadWidth = buttonSize * 3 + gap * 2
  const actionWidth = buttonSize * 2 + gap
  const dpadX = edge
  const actionX = Math.max(edge, width - edge - actionWidth)
  const dpadY = portrait
    ? Math.max(edge, height - edge - clusterHeight)
    : Math.round((height - clusterHeight) / 2)
  const actionY = portrait
    ? Math.max(edge, height - edge - buttonSize)
    : Math.round((height - buttonSize) / 2)

  return {
    buttonSize,
    gap,
    edge,
    portrait,
    dpadX: Math.min(dpadX, Math.max(edge, width - edge - dpadWidth)),
    dpadY,
    actionX,
    actionY,
    bottomReserve: portrait ? clusterHeight + edge + 8 : 0
  }
}

export function touchInputAvailable(width: number): boolean {
  if (width <= 768) return true
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true
  return (
    typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches
  )
}

export const VIRTUAL_TOUCH_SCREENS: ReadonlySet<Screen> = new Set([
  'intro',
  'world',
  'town',
  'cave',
  'room',
  'ending',
  'gameover'
])

export function shouldShowTouchControls(screen: Screen, sleeping: boolean, width: number): boolean {
  return !sleeping && VIRTUAL_TOUCH_SCREENS.has(screen) && touchInputAvailable(width)
}

function directionButton(symbol: string, key: string, size: number, held: Set<string>): Container {
  const root = new Container()
  const face = new Graphics()
    .roundRect(0, 0, size, size, 5)
    .fill({ color: UI_COLORS.coal, alpha: 0.9 })
    .roundRect(2, 2, size - 4, size - 4, 4)
    .stroke({ color: UI_COLORS.steelLight, width: 1, alpha: 0.68 })
    .moveTo(8, size - 6)
    .lineTo(size - 8, size - 6)
    .stroke({ color: UI_COLORS.black, width: 2, alpha: 0.72 })
  const icon = label(
    symbol,
    size / 2,
    size / 2,
    displayStyle(Math.max(15, size * 0.3), {
      fill: UI_COLORS.paper,
      align: 'center'
    })
  )
  icon.anchor.set(0.5)
  root.addChild(face, icon)
  root.hitArea = new Rectangle(0, 0, size, size)
  root.eventMode = 'static'
  root.cursor = 'pointer'

  const release = () => {
    if (!held.delete(key)) return
    input.release(key)
    root.alpha = 1
    root.scale.set(1)
  }
  root.on('pointerdown', (event) => {
    event.stopPropagation()
    if ('button' in event && event.pointerType === 'mouse' && event.button !== 0) return
    if (!held.has(key)) {
      held.add(key)
      input.press(key)
      input.hold(key)
    }
    root.alpha = 0.76
    root.scale.set(0.98)
  })
  root.on('pointerup', release)
  root.on('pointerupoutside', release)
  root.on('pointercancel', release)
  return root
}

function actionButton(copy: string, key: string, size: number, primary: boolean): Container {
  const root = new Container()
  const face = new Graphics()
    .circle(size / 2, size / 2, size / 2)
    .fill({ color: primary ? 0x402520 : UI_COLORS.coal, alpha: 0.92 })
    .circle(size / 2, size / 2, size / 2 - 2)
    .stroke({ color: primary ? UI_COLORS.warning : UI_COLORS.brass, width: 2, alpha: 0.92 })
    .circle(size / 2, size / 2, size / 2 - 6)
    .stroke({ color: UI_COLORS.steelLight, width: 1, alpha: 0.32 })
  const text = label(
    copy,
    size / 2,
    size / 2,
    utilityStyle(Math.max(15, size * 0.3), {
      fill: primary ? UI_COLORS.brassLight : UI_COLORS.paper,
      align: 'center'
    })
  )
  text.anchor.set(0.5)
  root.addChild(face, text)
  root.hitArea = new Rectangle(0, 0, size, size)
  root.eventMode = 'static'
  root.cursor = 'pointer'
  root.on('pointerdown', (event) => {
    event.stopPropagation()
    if ('button' in event && event.pointerType === 'mouse' && event.button !== 0) return
    input.press(key)
    root.alpha = 0.76
    root.scale.set(0.98)
  })
  const release = () => {
    root.alpha = 1
    root.scale.set(1)
  }
  root.on('pointerup', release)
  root.on('pointerupoutside', release)
  root.on('pointercancel', release)
  return root
}

export class TouchControls extends Container {
  private held = new Set<string>()
  private layoutKey = ''
  private reserve = 0

  constructor() {
    super()
    this.zIndex = 1000
  }

  sync(width: number, height: number, enabled: boolean): number {
    this.visible = enabled
    if (!enabled) {
      this.releaseAll()
      return 0
    }
    const layout = touchControlLayout(width, height)
    const key = `${width}:${height}:${layout.buttonSize}`
    this.reserve = layout.bottomReserve
    if (key !== this.layoutKey) {
      this.layoutKey = key
      this.rebuild(layout)
    }
    return this.reserve
  }

  override destroy(options?: Parameters<Container['destroy']>[0]) {
    this.releaseAll()
    super.destroy(options)
  }

  private rebuild(layout: TouchControlLayout) {
    this.releaseAll()
    for (const child of this.removeChildren()) child.destroy({ children: true })
    const { buttonSize: size, gap } = layout
    const dpad = new Container()
    dpad.position.set(layout.dpadX, layout.dpadY)
    const directions = [
      ['▲', 'up', size + gap, 0],
      ['◀', 'left', 0, size + gap],
      ['▼', 'down', size + gap, size + gap],
      ['▶', 'right', (size + gap) * 2, size + gap]
    ] as const
    for (const [symbol, key, x, y] of directions) {
      const button = directionButton(symbol, key, size, this.held)
      button.position.set(x, y)
      dpad.addChild(button)
    }

    const action = new Container()
    action.position.set(layout.actionX, layout.actionY)
    const b = actionButton('B', 'b', size, false)
    const a = actionButton('A', 'a', size, true)
    a.position.x = size + gap
    action.addChild(b, a)

    const mode = label(
      'TOUCH',
      layout.edge,
      layout.edge,
      utilityStyle(8, {
        fill: UI_COLORS.steelLight
      })
    )
    mode.alpha = 0.7
    this.addChild(dpad, action, mode)
  }

  private releaseAll() {
    for (const key of this.held) input.release(key)
    this.held.clear()
  }
}

export function isTextNode(value: unknown): value is Text {
  return value instanceof Text
}
