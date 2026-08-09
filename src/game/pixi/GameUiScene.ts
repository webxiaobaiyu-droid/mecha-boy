import { Container } from 'pixi.js'
import type { GameState } from '@/game/types'
import { BATTLE_BACKGROUND } from '@/game/assets/battle'
import { store } from '@/game/core/store'
import { pixiAssets } from '@/game/pixi/assets'
import { renderHud } from '@/game/pixi/ui/hud'
import { renderMenu } from '@/game/pixi/ui/menu'
import {
  renderBanner,
  renderBattleUi,
  renderDialog,
  renderEnding,
  renderGameOver,
  renderIntro,
  renderPassword,
  renderSleep,
  renderTitle
} from '@/game/pixi/ui/overlays'
import { uiScaleFor } from '@/game/pixi/ui/primitives'
import { renderShop } from '@/game/pixi/ui/shop'
import { shouldShowTouchControls, TouchControls } from '@/game/pixi/ui/touch'

function destroyChildren(layer: Container) {
  for (const child of layer.removeChildren()) child.destroy({ children: true })
}

function replaceLayer(layer: Container, content: Container) {
  destroyChildren(layer)
  layer.addChild(content)
}

function tankSignature(state: GameState): string {
  return state.tanks
    .map((tank) =>
      [
        tank.tankId,
        tank.garageSlot,
        tank.sp,
        tank.armor,
        tank.ammo.main,
        tank.ammo.se,
        ...Object.values(tank.parts),
        ...Object.values(tank.condition)
      ].join(':')
    )
    .join('|')
}

function hudSignature(state: GameState): string {
  return [
    state.screen,
    state.map,
    state.px,
    state.py,
    state.gold,
    state.riding,
    state.environment.day,
    state.environment.minute,
    state.environment.weather,
    state.flags.tutorial_step,
    tankSignature(state)
  ].join('|')
}

function screenSignature(state: GameState): string {
  if (state.screen === 'title') {
    return [
      'title',
      state.titleMenu,
      Number(state.jukebox),
      Number(state.creditsOpen),
      state.jukeIdx,
      Number(store.hasSave())
    ].join('|')
  }
  if (state.screen === 'intro') return `intro|${state.intro.idx}`
  if (state.screen === 'password') {
    return `password|${state.pass?.pos}|${state.pass?.digits.join('')}`
  }
  if (state.screen === 'ending') return `ending|${state.ending?.idx}`
  if (state.screen === 'gameover') return `gameover|${state.goT > 1.2}`
  if (state.screen === 'battle') {
    const battle = state.battle
    return JSON.stringify({
      screen: state.screen,
      phase: battle?.phase,
      round: battle?.round,
      cmd: battle?.cmd,
      fighters: battle?.fighters.map((fighter) => ({
        id: fighter.member.id,
        hp: fighter.member.hp,
        tank: fighter.tank ? [fighter.tank.tankId, fighter.tank.sp, fighter.tank.armor] : null
      })),
      mobs: battle?.mobs.map((mob) => [mob.id, mob.hp]),
      log: battle?.log.slice(-3),
      items: state.inventory.items
    })
  }
  if (state.screen === 'menu') {
    return JSON.stringify({
      menu: state.menu,
      party: state.party,
      gold: state.gold,
      inventory: state.inventory,
      tanks: tankSignature(state),
      bounties: state.bounties,
      flags: state.flags,
      map: state.map,
      base: state.base,
      inTown: state.inTown,
      worldMap: state.worldMap,
      hunt: state.hunt,
      minute: state.environment.minute
    })
  }
  if (state.screen === 'shop') {
    return JSON.stringify({
      shop: state.shop,
      party: state.party,
      gold: state.gold,
      inventory: state.inventory,
      tanks: tankSignature(state),
      bounties: state.bounties,
      flags: state.flags,
      hunt: state.hunt,
      minute: state.environment.minute
    })
  }
  return state.screen
}

function dialogSignature(state: GameState): string {
  const dialog = state.dialog
  if (!dialog) return 'none'
  return `${dialog.idx}|${Math.floor(dialog.reveal)}|${dialog.texts.join('\u001f')}`
}

function sleepSignature(state: GameState): string {
  const sleep = state.sleep
  return sleep
    ? `${sleep.source}|${sleep.phase}|${sleep.settled}|${sleep.t.toFixed(2)}|${state.environment.day}|${state.environment.minute}`
    : 'none'
}

export class GameUiScene extends Container {
  private hudLayer = new Container()
  private screenLayer = new Container()
  private bannerLayer = new Container()
  private dialogLayer = new Container()
  private sleepLayer = new Container()
  private touch = new TouchControls()
  private screenWidth = 1
  private screenHeight = 1
  private uiScale = 1
  private signatures = {
    hud: '',
    screen: '',
    banner: '',
    dialog: '',
    sleep: ''
  }

  constructor() {
    super()
    this.eventMode = 'passive'
    this.addChild(
      this.hudLayer,
      this.screenLayer,
      this.bannerLayer,
      this.dialogLayer,
      this.sleepLayer,
      this.touch
    )
  }

  resize(width: number, height: number) {
    this.screenWidth = Math.max(1, width)
    this.screenHeight = Math.max(1, height)
    this.uiScale = uiScaleFor(this.screenWidth, this.screenHeight)
    for (const key of Object.keys(this.signatures) as Array<keyof typeof this.signatures>) {
      this.signatures[key] = ''
    }
  }

  update(state: GameState) {
    const touchVisible = shouldShowTouchControls(state.screen, !!state.sleep, this.screenWidth)
    const bottomReserve = this.touch.sync(this.screenWidth, this.screenHeight, touchVisible)

    const nextHud = `${this.screenWidth}:${this.screenHeight}:${hudSignature(state)}`
    if (nextHud !== this.signatures.hud) {
      this.signatures.hud = nextHud
      replaceLayer(
        this.hudLayer,
        renderHud(state, this.screenWidth, this.screenHeight, this.uiScale)
      )
    }

    const nextScreen = `${this.screenWidth}:${this.screenHeight}:${bottomReserve}:${screenSignature(state)}`
    if (nextScreen !== this.signatures.screen) {
      this.signatures.screen = nextScreen
      replaceLayer(this.screenLayer, this.renderScreen(state, bottomReserve))
    }

    const nextBanner = `${state.bannerT > 0}|${state.bannerText}`
    if (nextBanner !== this.signatures.banner) {
      this.signatures.banner = nextBanner
      replaceLayer(
        this.bannerLayer,
        renderBanner(state, this.screenWidth, this.screenHeight, this.uiScale)
      )
    }

    const nextDialog = `${this.screenWidth}:${this.screenHeight}:${bottomReserve}:${dialogSignature(state)}`
    if (nextDialog !== this.signatures.dialog) {
      this.signatures.dialog = nextDialog
      replaceLayer(
        this.dialogLayer,
        renderDialog(state, this.screenWidth, this.screenHeight, this.uiScale, bottomReserve)
      )
    }

    const nextSleep = `${this.screenWidth}:${this.screenHeight}:${sleepSignature(state)}`
    if (nextSleep !== this.signatures.sleep) {
      this.signatures.sleep = nextSleep
      replaceLayer(
        this.sleepLayer,
        renderSleep(state, this.screenWidth, this.screenHeight, this.uiScale)
      )
    }
  }

  private renderScreen(state: GameState, bottomReserve: number): Container {
    if (state.screen === 'title') {
      return renderTitle(
        state,
        this.screenWidth,
        this.screenHeight,
        this.uiScale,
        pixiAssets.texture(BATTLE_BACKGROUND.atlas, BATTLE_BACKGROUND.frame)
      )
    }
    if (state.screen === 'intro') {
      return renderIntro(state, this.screenWidth, this.screenHeight, this.uiScale)
    }
    if (state.screen === 'menu') {
      return renderMenu(state, this.screenWidth, this.screenHeight, this.uiScale, bottomReserve)
    }
    if (state.screen === 'shop') {
      return renderShop(state, this.screenWidth, this.screenHeight, this.uiScale, bottomReserve)
    }
    if (state.screen === 'password') {
      return renderPassword(state, this.screenWidth, this.screenHeight, this.uiScale)
    }
    if (state.screen === 'battle') {
      return renderBattleUi(state, this.screenWidth, this.screenHeight, this.uiScale, bottomReserve)
    }
    if (state.screen === 'ending') {
      return renderEnding(state, this.screenWidth, this.screenHeight, this.uiScale)
    }
    if (state.screen === 'gameover') {
      return renderGameOver(state, this.screenWidth, this.screenHeight, this.uiScale)
    }
    return new Container()
  }
}
