import { Application, Graphics, Rectangle } from 'pixi.js'
import type { GameState } from '@/game/types'
import { ExplorationScene } from '@/game/pixi/ExplorationScene'
import { BattleScene } from '@/game/pixi/BattleScene'
import { WeatherLayer, type WeatherPresentation } from '@/game/pixi/WeatherLayer'
import { pixiAssets } from '@/game/pixi/assets'
import { preloadGameAssets } from '@/game/assets'
import { GameUiScene } from '@/game/pixi/GameUiScene'

export class PixiGameRenderer {
  private app = new Application()
  private background = new Graphics()
  private exploration = new ExplorationScene()
  private battle = new BattleScene()
  private weather = new WeatherLayer()
  private ui = new GameUiScene()
  private width = 0
  private height = 0
  private initialized = false

  async init(canvas: HTMLCanvasElement, resizeTarget: HTMLElement) {
    await this.app.init({
      canvas,
      resizeTo: resizeTarget,
      autoDensity: true,
      resolution: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
      antialias: false,
      backgroundColor: 0x05070a,
      backgroundAlpha: 1,
      preference: 'webgl',
      powerPreference: 'high-performance',
      autoStart: false
    })
    this.app.stop()
    this.app.stage.eventMode = 'static'
    this.app.stage.addChild(this.background, this.exploration, this.battle, this.weather, this.ui)
    await Promise.all([preloadGameAssets(), pixiAssets.preload()])
    this.resize(true)
    this.initialized = true
  }

  update(state: GameState, dt: number) {
    if (!this.initialized) return
    this.resize(false)
    let presentation: WeatherPresentation = {
      outdoors: false,
      focusX: this.width / 2,
      focusY: this.height / 2
    }
    const battleActive = state.screen === 'battle' && !!state.battle
    this.battle.visible = battleActive
    this.exploration.visible = !battleActive && this.exploration.supports(state)
    if (battleActive) presentation = this.battle.update(state)
    else if (this.exploration.visible) presentation = this.exploration.update(state, dt)

    this.weather.visible = battleActive || this.exploration.visible
    if (this.weather.visible) this.weather.update(state, presentation, dt)
    this.ui.update(state)
    this.app.render()
  }

  destroy() {
    if (!this.initialized) return
    this.initialized = false
    this.app.destroy({ removeView: false }, { children: true })
  }

  private resize(force: boolean) {
    const width = Math.max(1, Math.round(this.app.screen.width))
    const height = Math.max(1, Math.round(this.app.screen.height))
    if (!force && width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.background.clear().rect(0, 0, width, height).fill(0x05070a)
    this.app.stage.hitArea = new Rectangle(0, 0, width, height)
    this.exploration.resize(width, height)
    this.battle.resize(width, height)
    this.weather.resize(width, height)
    this.ui.resize(width, height)
  }
}
