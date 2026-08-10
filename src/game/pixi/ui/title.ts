import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import { BATTLE_TANK_ASSET } from '@/game/assets/battle'
import { store } from '@/game/core/store'
import { TRACKS } from '@/game/data/story'
import type { GameState } from '@/game/types'
import { fitText, label, panel, uiButton, uiEdgeFor } from '@/game/pixi/ui/primitives'
import { UI_COLORS, bodyStyle, pixelStyle, utilityStyle } from '@/game/pixi/ui/theme'

const TITLE_MENU_ITEMS = ['开始新游戏', '继续冒险', '音乐室', '制作名单'] as const

export interface TitleScreenLayout {
  compact: boolean
  portrait: boolean
  edge: number
  contentX: number
  contentWidth: number
  logoY: number
  logoSize: number
  subtitleY: number
  menuX: number
  menuY: number
  menuWidth: number
  rowHeight: number
  rowGap: number
  menuHeight: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function pixelSize(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max) / 10) * 10
}

export function titleScreenLayout(width: number, height: number, scale: number): TitleScreenLayout {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const edge = uiEdgeFor(safeWidth, safeHeight)
  const portrait = safeWidth / safeHeight < 0.9
  const compact = safeWidth < 760 || safeHeight < 480
  const contentX = Math.round(
    portrait ? edge * 1.5 : Math.max(edge * 1.8, safeWidth * (compact ? 0.055 : 0.065))
  )
  const maxContentWidth = portrait
    ? safeWidth - contentX - edge * 1.5
    : Math.min(safeWidth * 0.43, 500 * scale)
  const contentWidth = Math.max(220, maxContentWidth)
  const logoSize = pixelSize(
    portrait ? safeHeight * 0.067 : 64 * scale,
    compact ? 40 : 50,
    compact ? 60 : 90
  )
  const logoY = Math.round(Math.max(edge * 1.8, safeHeight * (portrait ? 0.065 : 0.082)))
  const subtitleY = logoY + logoSize + Math.round(12 * scale)
  const rowHeight = Math.round(
    compact ? clamp(safeHeight * 0.108, 42, 52) : clamp(60 * scale, 56, 82)
  )
  const rowGap = Math.round(compact ? clamp(5 * scale, 4, 7) : clamp(8 * scale, 7, 11))
  const menuHeight = TITLE_MENU_ITEMS.length * rowHeight + (TITLE_MENU_ITEMS.length - 1) * rowGap
  const desiredMenuY = portrait
    ? safeHeight * 0.37
    : logoY + logoSize + Math.max(52, safeHeight * 0.105)
  const minimumMenuY = subtitleY + Math.round(42 * scale)
  const bottomReserve = portrait ? Math.max(edge * 2, safeHeight * 0.13) : Math.max(edge, 32)
  const menuY = Math.round(
    clamp(
      desiredMenuY,
      minimumMenuY,
      Math.max(minimumMenuY, safeHeight - bottomReserve - menuHeight)
    )
  )

  return {
    compact,
    portrait,
    edge,
    contentX,
    contentWidth,
    logoY,
    logoSize,
    subtitleY,
    menuX: contentX,
    menuY,
    menuWidth: contentWidth,
    rowHeight,
    rowGap,
    menuHeight
  }
}

function coverSprite(texture: Texture, width: number, height: number): Sprite {
  const sprite = new Sprite(texture)
  if (texture === Texture.EMPTY || texture.width <= 1 || texture.height <= 1) {
    sprite.visible = false
    return sprite
  }
  const scale = Math.max(width / texture.width, height / texture.height) * 1.04
  sprite.scale.set(scale)
  sprite.position.set(
    Math.round((width - texture.width * scale) / 2),
    Math.round((height - texture.height * scale) / 2)
  )
  return sprite
}

function titleShade(width: number, height: number): Graphics {
  const shade = new Graphics().rect(0, 0, width, height).fill({ color: 0x080707, alpha: 0.18 })
  const leftWidth = Math.min(width * 0.76, 980)
  const columns = 48
  for (let index = 0; index < columns; index++) {
    const progress = index / (columns - 1)
    const alpha = 0.66 * Math.pow(1 - progress, 2.1)
    const x = Math.floor((leftWidth * index) / columns)
    const nextX = Math.ceil((leftWidth * (index + 1)) / columns)
    shade.rect(x, 0, nextX - x + 1, height).fill({ color: 0x090707, alpha })
  }
  const bottomStart = height * 0.58
  const rows = 28
  for (let index = 0; index < rows; index++) {
    const progress = index / (rows - 1)
    const y = Math.floor(bottomStart + ((height - bottomStart) * index) / rows)
    const nextY = Math.ceil(bottomStart + ((height - bottomStart) * (index + 1)) / rows)
    shade.rect(0, y, width, nextY - y + 1).fill({ color: 0x070707, alpha: 0.08 + progress * 0.54 })
  }
  return shade
}

function titleMenuRow(
  text: string,
  width: number,
  height: number,
  fontSize: number,
  options: { active: boolean; disabled: boolean; onPress: () => void }
): { root: Container; marker: Graphics | null } {
  const root = new Container()
  const background = new Graphics()
  if (options.active) {
    background
      .poly([0, 0, width - 16, 0, width, height / 2, width - 16, height, 0, height, 10, height / 2])
      .fill({ color: 0x6f3025, alpha: 0.94 })
      .moveTo(18, 2)
      .lineTo(width - 24, 2)
      .stroke({ color: UI_COLORS.brassLight, width: 1, alpha: 0.76 })
      .moveTo(18, height - 2)
      .lineTo(width - 24, height - 2)
      .stroke({ color: UI_COLORS.warning, width: 2, alpha: 0.72 })
  } else {
    background
      .poly([12, 0, width - 12, 0, width, height / 2, width - 12, height, 12, height])
      .fill({ color: UI_COLORS.coal, alpha: options.disabled ? 0.36 : 0.62 })
      .moveTo(24, height - 1)
      .lineTo(width - 20, height - 1)
      .stroke({ color: UI_COLORS.steelDark, width: 1, alpha: 0.7 })
  }
  root.addChild(background)

  let marker: Graphics | null = null
  if (options.active) {
    marker = new Graphics()
      .poly([15, height / 2 - 8, 27, height / 2, 15, height / 2 + 8])
      .fill(UI_COLORS.brassLight)
    root.addChild(marker)
  }

  const copy = label(
    text,
    options.active ? 42 : 28,
    height / 2,
    pixelStyle(fontSize, {
      fill: options.disabled
        ? UI_COLORS.steelLight
        : options.active
          ? UI_COLORS.brassLight
          : UI_COLORS.text
    })
  )
  copy.anchor.set(0, 0.5)
  fitText(copy, width - (options.disabled ? 142 : 72))
  root.addChild(copy)

  if (options.disabled) {
    const status = label(
      '无存档',
      width - 24,
      height / 2,
      utilityStyle(Math.max(10, Math.round(fontSize * 0.48)), { fill: UI_COLORS.steelLight })
    )
    status.anchor.set(1, 0.5)
    root.addChild(status)
  }

  root.hitArea = new Rectangle(0, 0, width, height)
  if (!options.disabled) {
    root.eventMode = 'static'
    root.cursor = 'pointer'
    root.on('pointertap', (event) => {
      event.stopPropagation()
      options.onPress()
    })
  }
  return { root, marker }
}

function titleLogo(layout: TitleScreenLayout, scale: number): Container {
  const group = new Container()
  const logo = label(
    '荒原引擎',
    0,
    0,
    pixelStyle(layout.logoSize, {
      fill: 0xf2d98f,
      stroke: { color: 0x2a1512, width: Math.max(3, Math.round(5 * scale)) },
      dropShadow: {
        color: 0x090606,
        alpha: 0.9,
        blur: 0,
        angle: Math.PI / 4,
        distance: Math.max(3, Math.round(5 * scale))
      }
    })
  )
  fitText(logo, layout.contentWidth)
  group.addChild(logo)

  const lineY = layout.logoSize + Math.round(7 * scale)
  const accentWidth = Math.min(layout.contentWidth, Math.round(260 * scale))
  const line = new Graphics()
    .rect(0, lineY, Math.max(48, accentWidth * 0.36), Math.max(2, Math.round(3 * scale)))
    .fill(UI_COLORS.warning)
    .rect(
      Math.max(48, accentWidth * 0.36),
      lineY + Math.max(1, Math.round(scale)),
      accentWidth - Math.max(48, accentWidth * 0.36),
      1
    )
    .fill({ color: UI_COLORS.brassLight, alpha: 0.62 })
  group.addChild(line)

  const subtitle = label(
    '每一台旧机器，都有下一段路。',
    2,
    layout.subtitleY - layout.logoY,
    pixelStyle(pixelSize(16 * scale, 10, 20), { fill: UI_COLORS.paper })
  )
  fitText(subtitle, layout.contentWidth)
  group.addChild(subtitle)
  return group
}

function titleMenu(state: GameState, layout: TitleScreenLayout, scale: number) {
  const group = new Container()
  const rail = new Graphics()
    .moveTo(-12 * scale, 0)
    .lineTo(-12 * scale, layout.menuHeight)
    .stroke({ color: UI_COLORS.steel, width: Math.max(1, 2 * scale), alpha: 0.56 })
    .moveTo(-12 * scale, 0)
    .lineTo(-12 * scale, layout.rowHeight)
    .stroke({ color: UI_COLORS.warning, width: Math.max(2, 3 * scale), alpha: 0.92 })
  group.addChild(rail)

  const fontSize = pixelSize(layout.rowHeight * 0.37, 20, 30)
  let activeMarker: Graphics | null = null
  TITLE_MENU_ITEMS.forEach((item, index) => {
    const row = titleMenuRow(item, layout.menuWidth, layout.rowHeight, fontSize, {
      active: state.titleMenu === index,
      disabled: index === 1 && !store.hasSave(),
      onPress: () => store.titleChoose(index)
    })
    row.root.position.set(0, index * (layout.rowHeight + layout.rowGap))
    group.addChild(row.root)
    if (row.marker) activeMarker = row.marker
  })
  return { group, activeMarker }
}

export class TitleScreen extends Container {
  private readonly backdrop: Sprite
  private readonly dust = new Graphics()
  private readonly logoGroup: Container
  private readonly menuGroup: Container
  private readonly tankGroup = new Container()
  private readonly activeMarker: Graphics | null
  private readonly backdropBaseX: number
  private readonly backdropBaseY: number
  private readonly logoBaseX: number
  private readonly menuBaseY: number
  private readonly tankBaseY: number
  private readonly widthPixels: number
  private readonly heightPixels: number
  private readonly motionScale: number
  private readonly reducedMotion: boolean

  constructor(
    state: GameState,
    width: number,
    height: number,
    scale: number,
    titleTexture: Texture,
    tankTexture: Texture
  ) {
    super()
    const layout = titleScreenLayout(width, height, scale)
    this.widthPixels = width
    this.heightPixels = height
    this.motionScale = scale
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    this.backdrop = coverSprite(titleTexture, width, height)
    this.backdropBaseX = this.backdrop.x
    this.backdropBaseY = this.backdrop.y
    this.addChild(this.backdrop, titleShade(width, height), this.dust)

    this.logoGroup = titleLogo(layout, scale)
    this.logoBaseX = layout.contentX
    this.logoGroup.position.set(this.logoBaseX, layout.logoY)
    this.addChild(this.logoGroup)

    const menu = titleMenu(state, layout, scale)
    this.menuGroup = menu.group
    this.activeMarker = menu.activeMarker
    this.menuBaseY = layout.menuY
    this.menuGroup.position.set(layout.menuX, this.menuBaseY)

    this.tankBaseY = height * 0.91
    if (!layout.portrait && width > 700 && tankTexture !== Texture.EMPTY) {
      const tankScale = clamp(height / 90, 4.2, 12)
      const shadow = new Graphics()
        .ellipse(0, 0, BATTLE_TANK_ASSET.width * tankScale * 0.54, 12 * scale)
        .fill({ color: UI_COLORS.black, alpha: 0.68 })
      shadow.position.set(width * 0.79, this.tankBaseY - 2 * scale)
      const tank = new Sprite(tankTexture)
      tank.anchor.set(0.5, 1)
      tank.scale.set(tankScale)
      tank.position.set(width * 0.79, this.tankBaseY)
      tank.tint = 0xd9bd7c
      this.tankGroup.addChild(shadow, tank)
      this.addChild(this.tankGroup)
    }

    if (state.creditsOpen || state.jukebox) {
      this.addChild(
        new Graphics().rect(0, 0, width, height).fill({ color: UI_COLORS.black, alpha: 0.48 })
      )
      this.menuGroup.visible = false
      if (state.creditsOpen) this.addChild(this.buildCredits(width, height, scale, layout.edge))
      else this.addChild(this.buildJukebox(state, width, height, scale, layout.edge))
    } else {
      this.addChild(this.menuGroup)
    }
  }

  animate(time: number) {
    const t = this.reducedMotion ? 2 : Math.max(0, time)
    const introLogo = this.reducedMotion ? 1 : 1 - Math.pow(1 - clamp(t / 0.72, 0, 1), 3)
    const introMenu = this.reducedMotion ? 1 : 1 - Math.pow(1 - clamp((t - 0.18) / 0.72, 0, 1), 3)
    this.logoGroup.alpha = introLogo
    this.logoGroup.x = this.logoBaseX - (1 - introLogo) * 24 * this.motionScale
    this.menuGroup.alpha = introMenu
    this.menuGroup.y = this.menuBaseY + (1 - introMenu) * 18 * this.motionScale
    this.tankGroup.alpha = clamp((t - 0.3) / 0.85, 0, 1)
    this.tankGroup.y = (1 - this.tankGroup.alpha) * 10 * this.motionScale

    const driftX = this.reducedMotion ? 0 : Math.sin(t * 0.11) * 4 * this.motionScale
    const driftY = this.reducedMotion ? 0 : Math.cos(t * 0.08) * 2 * this.motionScale
    this.backdrop.position.set(this.backdropBaseX + driftX, this.backdropBaseY + driftY)
    if (this.activeMarker) {
      this.activeMarker.alpha = this.reducedMotion ? 1 : 0.72 + Math.sin(t * 5.4) * 0.28
    }
    this.drawDust(t)
  }

  private drawDust(time: number) {
    this.dust.clear()
    const startX = this.widthPixels * 0.34
    const spanX = this.widthPixels * 0.72
    for (let index = 0; index < 22; index++) {
      const seedX = ((index * 47 + 13) % 101) / 101
      const seedY = ((index * 71 + 29) % 103) / 103
      const speed = 5 + (index % 5) * 3
      const x = startX + ((seedX * spanX + time * speed) % spanX)
      const y = this.heightPixels * (0.15 + seedY * 0.65) + Math.sin(time * 0.7 + index) * 3
      const size = Math.max(1, Math.round((1 + (index % 3)) * this.motionScale * 0.7))
      this.dust.rect(Math.round(x), Math.round(y), size * (index % 4 === 0 ? 2 : 1), size).fill({
        color: index % 3 === 0 ? UI_COLORS.brassLight : UI_COLORS.paper,
        alpha: 0.1 + (index % 4) * 0.045
      })
    }
  }

  private buildCredits(width: number, height: number, scale: number, edge: number): Container {
    const cardWidth = Math.min(width - edge * 2, 720 * scale)
    const cardHeight = Math.min(height - edge * 2, 500 * scale)
    const card = panel(cardWidth, cardHeight, {
      title: '制作名单与素材许可',
      accent: UI_COLORS.warning,
      label: 'CREDITS'
    })
    card.position.set((width - cardWidth) / 2, (height - cardHeight) / 2)
    const copy = [
      '企划、程序与原创角色图集：荒原引擎项目贡献者',
      '',
      '废土背景：CraftPix.net 2D Game Assets / OGA-BY 3.0',
      '敌人素材：Ctske / CC BY 4.0',
      '城镇、室内与战车素材：CodeManu、FisherG、mishonis / CC0',
      '中文像素字体：Fusion Pixel / SIL OFL 1.1',
      '',
      '完整来源与许可证见仓库 THIRD_PARTY_ASSETS.md。'
    ].join('\n')
    const text = label(
      copy,
      24 * scale,
      56 * scale,
      bodyStyle(13 * scale, {
        fill: UI_COLORS.text,
        wordWrap: true,
        wordWrapWidth: cardWidth - 48 * scale,
        lineHeight: 24 * scale
      })
    )
    card.addChild(text)
    const back = uiButton('返回', Math.min(180 * scale, cardWidth - 48), 42 * scale, {
      active: true,
      onPress: () => store.closeTitleOverlay()
    })
    back.position.set(cardWidth - back.width - 24 * scale, cardHeight - 62 * scale)
    card.addChild(back)
    return card
  }

  private buildJukebox(
    state: GameState,
    width: number,
    height: number,
    scale: number,
    edge: number
  ): Container {
    const names = Object.keys(TRACKS)
    const cardWidth = Math.min(width - edge * 2, 520 * scale)
    const cardHeight = Math.min(height - edge * 2, 500 * scale)
    const card = panel(cardWidth, cardHeight, {
      title: '音乐室 / 车载磁带库',
      accent: UI_COLORS.info,
      label: 'AUDIO'
    })
    card.position.set(width - edge - cardWidth, (height - cardHeight) / 2)
    const listY = 48 * scale
    const rowHeight = Math.min(38 * scale, (cardHeight - listY - 54 * scale) / names.length)
    names.forEach((name, index) => {
      const row = uiButton(TRACKS[name], cardWidth - 28 * scale, rowHeight, {
        active: state.jukeIdx === index,
        dense: true,
        value: String(index + 1).padStart(2, '0'),
        onPress: () => store.jukeboxSelect(index)
      })
      row.position.set(14 * scale, listY + index * rowHeight)
      card.addChild(row)
    })
    const back = uiButton('返回', Math.min(160 * scale, cardWidth - 28 * scale), 38 * scale, {
      active: true,
      value: 'B',
      onPress: () => store.closeTitleOverlay()
    })
    back.position.set(cardWidth - back.width - 14 * scale, cardHeight - back.height - 12 * scale)
    card.addChild(back)
    return card
  }
}
