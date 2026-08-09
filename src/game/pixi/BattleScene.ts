import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import {
  BATTLE_BACKGROUND,
  BATTLE_EFFECT_ATLAS_ID,
  BATTLE_ENVIRONMENT_STYLES,
  battleAssetForMob,
  battleEffectFrame,
  battleFighterLayout,
  battleTankVisualFor
} from '@/game/assets/battle'
import { ACTOR_ASSETS } from '@/game/assets'
import type {
  BattleEffect,
  BattleEnvironment,
  BattleFighter,
  BattleMob,
  BattleState,
  GameState,
  TankState
} from '@/game/types'
import { pixiAssets } from '@/game/pixi/assets'
import { clamp, colorNumber, createGradientTexture, createRadialTexture } from '@/game/pixi/helpers'
import type { WeatherPresentation } from '@/game/pixi/WeatherLayer'
import {
  BATTLE_VIEW_HEIGHT as VIEW_HEIGHT,
  BATTLE_VIEW_WIDTH as VIEW_WIDTH,
  battleFighterAnchor,
  battleMobAnchor,
  battleViewportLayout
} from '@/game/pixi/layout'

const HORIZON_Y = 420

function polygon(graphics: Graphics, points: number[], color: number, alpha = 1) {
  graphics.poly(points).fill({ color, alpha })
}

function actorFrame(spriteId: string): Texture {
  const asset = ACTOR_ASSETS[spriteId] || ACTOR_ASSETS.hero
  return pixiAssets.texture(asset.atlas, `${asset.sprite}/right/1`)
}

function fighterSpriteId(fighter: BattleFighter): string {
  if (fighter.member.cls === 'mecha') return 'npc_w'
  if (fighter.member.cls === 'wolf') return 'npc_m'
  return 'hero'
}

function isOutdoor(environment: BattleEnvironment): boolean {
  return environment !== 'cave' && environment !== 'final'
}

export class BattleScene extends Container {
  private letterbox = new Graphics()
  private content = new Container()
  private background = new Container()
  private combatants = new Container()
  private effectLayer = new Container()
  private foreground = new Container()
  private environmentKey = ''
  private gradients = new Map<BattleEnvironment, Texture>()
  private muzzleTexture = createRadialTexture(128)
  private screenWidth = 1
  private screenHeight = 1
  private sceneScale = 1
  private portrait = false

  constructor() {
    super()
    this.eventMode = 'none'
    this.combatants.sortableChildren = true
    this.addChild(this.letterbox)
    this.content.addChild(this.background, this.combatants, this.effectLayer, this.foreground)
    this.addChild(this.content)
  }

  resize(width: number, height: number) {
    this.screenWidth = Math.max(1, width)
    this.screenHeight = Math.max(1, height)
    const layout = battleViewportLayout(this.screenWidth, this.screenHeight)
    this.portrait = layout.portrait
    this.sceneScale = layout.scale
    this.scale.set(1)
    this.position.set(0, 0)
    this.content.pivot.set(VIEW_WIDTH / 2, VIEW_HEIGHT / 2)
    this.content.scale.set(this.sceneScale)
    this.content.position.set(this.screenWidth / 2, this.screenHeight / 2)
    this.paintLetterbox()
  }

  update(state: GameState): WeatherPresentation {
    const battle = state.battle
    if (!battle) {
      this.visible = false
      return { outdoors: false, focusX: this.screenWidth / 2, focusY: this.screenHeight / 2 }
    }
    this.visible = true
    if (battle.environment !== this.environmentKey) {
      this.environmentKey = battle.environment
      this.buildBackground(battle.environment)
    }
    this.drawCombatants(state)
    this.drawEffect(battle.effect, battle)

    const effect = battle.effect
    const progress = effect ? clamp(effect.elapsed / Math.max(0.001, effect.duration), 0, 1) : 0
    const impactShake = effect?.hit
      ? Math.sin(progress * Math.PI) * Math.min(14, 3 + effect.dmg * 0.025)
      : 0
    this.content.position.set(
      this.screenWidth / 2 + Math.sin(state.playtime * 89) * impactShake * this.sceneScale,
      this.screenHeight / 2 + Math.cos(state.playtime * 73) * impactShake * this.sceneScale * 0.55
    )
    const bossZoom = battle.bounty && battle.phase === 'intro' ? 1.025 : 1
    this.content.scale.set(this.sceneScale * bossZoom)

    const intro = this.foreground.getChildByLabel('intro') as Graphics | undefined
    if (intro) {
      intro.clear()
      if (battle.phase === 'intro') {
        intro.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT).fill({
          color: 0x080809,
          alpha: Math.max(0, 0.58 - battle.introT * 0.68)
        })
      }
    }
    const fitScale = this.sceneScale
    return {
      outdoors: isOutdoor(battle.environment),
      focusX: this.screenWidth / 2,
      focusY: this.screenHeight * 0.58,
      groundY: this.screenHeight / 2 + (HORIZON_Y - VIEW_HEIGHT / 2) * fitScale
    }
  }

  private paintLetterbox(environment?: BattleEnvironment) {
    const style = environment ? BATTLE_ENVIRONMENT_STYLES[environment] : null
    this.letterbox
      .clear()
      .rect(0, 0, this.screenWidth, this.screenHeight)
      .fill(colorNumber(style?.skyTop, 0x0b1118))
      .rect(0, this.screenHeight * 0.59, this.screenWidth, this.screenHeight * 0.41)
      .fill({ color: colorNumber(style?.groundDark, 0x11161a), alpha: 0.94 })
      .rect(0, this.screenHeight * 0.59, this.screenWidth, 2)
      .fill({ color: colorNumber(style?.accent, 0x657064), alpha: 0.42 })
  }

  private buildBackground(environment: BattleEnvironment) {
    for (const child of this.background.removeChildren()) child.destroy({ children: true })
    for (const child of this.foreground.removeChildren()) child.destroy({ children: true })
    const style = BATTLE_ENVIRONMENT_STYLES[environment]
    this.paintLetterbox(environment)
    let gradient = this.gradients.get(environment)
    if (!gradient) {
      gradient = createGradientTexture(8, HORIZON_Y, style.skyTop, style.skyBottom)
      this.gradients.set(environment, gradient)
    }
    const sky = new Sprite(gradient)
    sky.width = VIEW_WIDTH
    sky.height = HORIZON_Y
    this.background.addChild(sky)

    const silhouettes = new Graphics()
    const floor = new Graphics()
    this.drawEnvironment(environment, silhouettes)
    floor
      .rect(0, HORIZON_Y, VIEW_WIDTH, VIEW_HEIGHT - HORIZON_Y)
      .fill(colorNumber(style.ground))
      .rect(0, HORIZON_Y + 170, VIEW_WIDTH, VIEW_HEIGHT - HORIZON_Y - 170)
      .fill({ color: colorNumber(style.groundDark), alpha: 0.72 })
    this.drawGroundDetails(environment, floor)
    this.background.addChild(silhouettes, floor)

    const vignette = new Graphics()
    vignette
      .rect(0, 0, 90, VIEW_HEIGHT)
      .fill({ color: 0x030405, alpha: 0.34 })
      .rect(VIEW_WIDTH - 90, 0, 90, VIEW_HEIGHT)
      .fill({ color: 0x030405, alpha: 0.34 })
      .rect(0, 0, VIEW_WIDTH, 22)
      .fill({ color: 0x030405, alpha: 0.42 })
    const intro = new Graphics({ label: 'intro' })
    this.foreground.addChild(vignette, intro)
  }

  private drawEnvironment(environment: BattleEnvironment, graphics: Graphics) {
    const style = BATTLE_ENVIRONMENT_STYLES[environment]
    const horizon = colorNumber(style.horizon)
    if (
      environment === 'town' &&
      pixiAssets.has(BATTLE_BACKGROUND.atlas, BATTLE_BACKGROUND.frame)
    ) {
      const scene = new Sprite(pixiAssets.texture(BATTLE_BACKGROUND.atlas, BATTLE_BACKGROUND.frame))
      scene.scale.set(2)
      scene.alpha = 0.82
      this.background.addChild(scene)
      graphics.rect(0, 0, VIEW_WIDTH, HORIZON_Y).fill({ color: 0x321b17, alpha: 0.2 })
      return
    }
    if (environment === 'forest') {
      polygon(
        graphics,
        [
          0,
          HORIZON_Y,
          0,
          270,
          170,
          220,
          310,
          285,
          470,
          205,
          640,
          278,
          820,
          196,
          990,
          272,
          1140,
          218,
          1280,
          260,
          1280,
          HORIZON_Y
        ],
        horizon
      )
      for (let index = 0; index < 17; index++) {
        const x = index * 82 - 46
        const trunkTop = 160 + (index % 4) * 34
        graphics
          .rect(x + 34, trunkTop, 18 + (index % 2) * 8, HORIZON_Y - trunkTop)
          .fill(index % 2 ? 0x1d2a22 : 0x17231d)
          .circle(x + 40, trunkTop - 12, 54 + (index % 3) * 9)
          .fill(index % 2 ? 0x243b2b : 0x1b3225)
      }
      return
    }
    if (environment === 'mountain') {
      polygon(
        graphics,
        [
          0,
          HORIZON_Y,
          0,
          342,
          180,
          126,
          320,
          344,
          500,
          84,
          680,
          350,
          866,
          138,
          1042,
          330,
          1170,
          190,
          1280,
          314,
          1280,
          HORIZON_Y
        ],
        horizon
      )
      polygon(graphics, [116, 202, 180, 126, 240, 220, 188, 192, 164, 224], 0xd7d8d2)
      polygon(graphics, [414, 208, 500, 84, 588, 218, 520, 182, 486, 222], 0xe5e4da)
      polygon(graphics, [802, 212, 866, 138, 938, 222, 878, 196, 852, 226], 0xd7d8d2)
      return
    }
    if (environment === 'cave') {
      graphics.rect(0, 0, VIEW_WIDTH, HORIZON_Y).fill(0x181c29)
      for (let index = 0; index < 18; index++) {
        const x = index * 78 - 34
        const height = 90 + (index % 5) * 44
        polygon(
          graphics,
          [x, 0, x + 66, 0, x + 42, height, x + 22, height * 0.62],
          index % 2 ? 0x0b0e16 : 0x111520
        )
      }
      for (const [x, y] of [
        [430, 340],
        [520, 382],
        [1090, 328]
      ] as [number, number][]) {
        polygon(graphics, [x, HORIZON_Y, x + 18, y, x + 34, HORIZON_Y], 0x2d7180)
        polygon(graphics, [x + 12, HORIZON_Y, x + 20, y + 18, x + 25, HORIZON_Y], 0x65b8c4)
      }
      return
    }
    if (environment === 'desert') {
      graphics.circle(1010, 120, 56).fill(0xf0c06a)
      polygon(
        graphics,
        [
          0,
          HORIZON_Y,
          0,
          350,
          170,
          292,
          352,
          360,
          540,
          280,
          760,
          354,
          980,
          292,
          1280,
          350,
          1280,
          HORIZON_Y
        ],
        horizon
      )
      polygon(
        graphics,
        [
          0,
          HORIZON_Y,
          0,
          388,
          230,
          348,
          460,
          404,
          710,
          334,
          960,
          394,
          1140,
          346,
          1280,
          378,
          1280,
          HORIZON_Y
        ],
        0xb97b43
      )
      return
    }
    if (environment === 'final') {
      graphics.rect(0, 0, VIEW_WIDTH, HORIZON_Y).fill(0x171c24)
      for (let x = 0; x < VIEW_WIDTH; x += 128) {
        graphics
          .rect(x + 6, 16, 116, HORIZON_Y - 32)
          .fill(x % 256 ? 0x202630 : 0x191e27)
          .rect(x + 24, 64, 76, 5)
          .rect(x + 24, 340, 76, 5)
          .fill(0x0d1016)
          .rect(x + 42, 110, 34, 14)
          .fill(x % 256 ? 0xd84b45 : 0xffa34f)
      }
      return
    }
    polygon(
      graphics,
      [
        0,
        HORIZON_Y,
        0,
        350,
        180,
        294,
        370,
        344,
        570,
        276,
        760,
        346,
        990,
        286,
        1280,
        340,
        1280,
        HORIZON_Y
      ],
      horizon
    )
    for (let index = 0; index < 11; index++) {
      const x = index * 126 + 22
      graphics
        .rect(x, 330, 8, 90)
        .fill(0x171b18)
        .rect(x - 20, 340, 48, 6)
        .fill(0x171b18)
    }
  }

  private drawGroundDetails(environment: BattleEnvironment, graphics: Graphics) {
    const style = BATTLE_ENVIRONMENT_STYLES[environment]
    for (let index = 0; index < 30; index++) {
      const x = (index * 149 + 31) % VIEW_WIDTH
      const y = HORIZON_Y + 28 + ((index * 71) % 244)
      const perspective = clamp((y - HORIZON_Y) / (VIEW_HEIGHT - HORIZON_Y), 0.1, 1)
      const width = Math.round((10 + (index % 5) * 9) * perspective)
      graphics.rect(x, y, width, Math.max(2, Math.round(4 * perspective))).fill({
        color: index % 3 ? colorNumber(style.groundDark) : colorNumber(style.accent),
        alpha: index % 3 ? 0.52 : 0.42
      })
    }
    if (environment !== 'cave' && environment !== 'final') {
      for (const y of [470, 560, 655]) {
        graphics.rect(0, y, VIEW_WIDTH, y > 600 ? 4 : 2).fill({ color: 0x101315, alpha: 0.28 })
      }
    }
  }

  private drawCombatants(state: GameState) {
    const battle = state.battle
    if (!battle) return
    for (const child of this.combatants.removeChildren()) child.destroy({ children: true })
    for (let index = 0; index < battle.mobs.length; index++) {
      const mob = battle.mobs[index]
      const selected = battle.cmd?.mode === 'target' && battle.cmd.idx === index && mob.hp > 0
      this.combatants.addChild(
        this.createMob(mob, index, battle.mobs.length, selected, state.playtime, battle.effect)
      )
    }
    for (let index = 0; index < battle.fighters.length; index++) {
      const fighterEffect =
        battle.effect &&
        this.fighterEffectIndex(battle, battle.effect.fromX, battle.effect.fromY) === index
          ? battle.effect
          : null
      this.combatants.addChild(this.createFighter(battle.fighters[index], index, fighterEffect))
    }
  }

  private createMob(
    mob: BattleMob,
    index: number,
    count: number,
    selected: boolean,
    time: number,
    effect: BattleEffect | null
  ): Container {
    const group = new Container()
    const { x: fullScreenX, y: fullScreenY } = this.mobAnchor(index, count)
    group.position.set(fullScreenX, fullScreenY)
    group.zIndex = fullScreenY
    const asset = battleAssetForMob(mob.id, mob.tpl)
    const shadow = new Graphics()
      .ellipse(0, 2, Math.max(42, 56 * mob.size), Math.max(10, 15 * mob.size))
      .fill({ color: 0x050607, alpha: 0.46 })
    group.addChild(shadow)
    if (asset) {
      const sprite = new Sprite(pixiAssets.texture(asset.atlas, asset.frame))
      sprite.anchor.set(0.5, 1)
      sprite.scale.set(asset.scale * 2 * (mob.size > 1 ? 1.08 : 1))
      sprite.y = Math.sin(time * 2.4 + mob.x * 0.1) * (mob.isBoss ? 2 : 1)
      sprite.alpha = mob.hp > 0 ? 1 : 0.16
      const hit =
        !!effect &&
        effect.hit &&
        effect.toX === mob.x &&
        effect.toY === mob.y &&
        effect.elapsed / Math.max(0.001, effect.duration) > 0.58 &&
        effect.elapsed < effect.duration * 0.78
      sprite.tint = hit && Math.floor(effect.elapsed * 36) % 2 === 0 ? 0xffffff : 0xf3eee2
      if (hit) group.x += Math.sin(effect.elapsed * 92) * Math.min(12, 3 + effect.dmg * 0.02)
      group.addChild(sprite)
    } else {
      const body = new Graphics()
        .roundRect(-42 * mob.size, -72 * mob.size, 84 * mob.size, 72 * mob.size, 12)
        .fill(colorNumber(mob.colors.X))
        .circle(-16 * mob.size, -46 * mob.size, 7 * mob.size)
        .circle(16 * mob.size, -46 * mob.size, 7 * mob.size)
        .fill(colorNumber(mob.colors.Y))
      group.addChild(body)
    }
    if (selected) {
      const reticle = new Graphics()
      const pulse = 1 + Math.sin(time * 8) * 0.08
      reticle
        .circle(0, -54 * mob.size, 58 * mob.size * pulse)
        .stroke({ color: 0xf4d36a, width: 3, alpha: 0.9 })
        .moveTo(-72 * mob.size, -54 * mob.size)
        .lineTo(-46 * mob.size, -54 * mob.size)
        .moveTo(46 * mob.size, -54 * mob.size)
        .lineTo(72 * mob.size, -54 * mob.size)
        .stroke({ color: 0xf4d36a, width: 3, alpha: 0.9 })
      group.addChild(reticle)
    }
    return group
  }

  private createFighter(
    fighter: BattleFighter,
    index: number,
    effect: BattleEffect | null
  ): Container {
    const group = new Container()
    // The left gutter keeps the convoy silhouettes visible above the status panel.
    const { x: fullScreenX, y: fullScreenY } = this.fighterAnchor(index)
    group.position.set(fullScreenX, fullScreenY)
    group.zIndex = fullScreenY
    if (fighter.tank) {
      group.addChild(this.createBattleTank(fighter.tank, effect))
      return group
    }
    const shadow = new Graphics().ellipse(0, 0, 44, 13).fill({ color: 0x030405, alpha: 0.5 })
    const sprite = new Sprite(actorFrame(fighterSpriteId(fighter)))
    sprite.anchor.set(0.5, 1)
    sprite.scale.set(4)
    group.addChild(shadow, sprite)
    return group
  }

  private createBattleTank(tank: TankState, effect: BattleEffect | null): Container {
    const group = new Container()
    const visual = battleTankVisualFor(tank.tankId)
    const primary = colorNumber(tank.tankDef?.colors.X, 0x596752)
    const secondary = colorNumber(tank.tankDef?.colors.Y, 0x333c31)
    const scale = 1.72
    const length = visual.hullLength * scale
    const hullHeight = visual.hullHeight * scale
    const gearHeight = visual.runningGearHeight * scale
    const firing = effect && ['main', 'sub', 'se'].includes(effect.weaponKind)
    const effectProgress = effect ? effect.elapsed / Math.max(effect.duration, 0.001) : 1
    const recoil = firing ? Math.sin(clamp(effectProgress, 0, 1) * Math.PI) * 10 : 0
    group.x = -recoil
    const shadow = new Graphics()
      .ellipse(0, 4, length * 0.58, 18)
      .fill({ color: 0x030405, alpha: 0.52 })
    const wheels = new Graphics()
      .roundRect(-length / 2, -gearHeight, length, gearHeight, gearHeight / 2)
      .fill(0x121716)
      .roundRect(-length / 2 + 5, -gearHeight + 5, length - 10, gearHeight - 10, gearHeight / 2)
      .fill(0x404743)
    for (let x = -length / 2 + 18; x < length / 2 - 8; x += 28) {
      wheels.circle(x, -gearHeight / 2, gearHeight * 0.31).fill(0x1c2220)
      wheels.circle(x, -gearHeight / 2, gearHeight * 0.14).fill(0x788078)
    }
    const hull = new Graphics()
      .poly([
        -length / 2 + 9,
        -gearHeight,
        -length / 2 + 25,
        -gearHeight - hullHeight,
        length / 2 - 30,
        -gearHeight - hullHeight,
        length / 2,
        -gearHeight - 8,
        length / 2 - 8,
        -gearHeight
      ])
      .fill(0x111614)
      .poly([
        -length / 2 + 14,
        -gearHeight - 3,
        -length / 2 + 28,
        -gearHeight - hullHeight + 4,
        length / 2 - 32,
        -gearHeight - hullHeight + 4,
        length / 2 - 7,
        -gearHeight - 10,
        length / 2 - 13,
        -gearHeight - 3
      ])
      .fill(primary)
      .rect(-length / 2 + 34, -gearHeight - hullHeight + 9, length * 0.42, 6)
      .fill(0x9aa795)
    const turretWidth = visual.turret === 'siege' ? 90 : visual.turret === 'rail' ? 78 : 70
    const turretY = -gearHeight - hullHeight + 2
    const turret = new Graphics()
      .roundRect(-24, turretY - 38, turretWidth, 38, 8)
      .fill(0x111614)
      .roundRect(-20, turretY - 34, turretWidth - 8, 31, 6)
      .fill(secondary)
      .rect(-12, turretY - 29, turretWidth - 26, 5)
      .fill(0x9aa795)
    const barrel = new Graphics()
      .rect(turretWidth - 25, turretY - 26, visual.barrelLength * 1.75, 10)
      .fill(0x101514)
      .rect(turretWidth - 22, turretY - 24, visual.barrelLength * 1.75, 5)
      .fill(0x747d76)
    group.addChild(shadow, wheels, hull, barrel, turret)
    return group
  }

  private fighterAnchor(index: number) {
    return battleFighterAnchor(this.portrait, index)
  }

  private mobAnchor(index: number, count: number) {
    return battleMobAnchor(this.portrait, index, count)
  }

  private fighterEffectIndex(battle: BattleState, x: number, y: number): number {
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < battle.fighters.length; index++) {
      const fighter = battle.fighters[index]
      const layout = battleFighterLayout(index, fighter.tank?.tankId)
      const distance = Math.hypot(layout.muzzleX - x, layout.muzzleY - y)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    }
    return bestIndex
  }

  private effectPoint(
    battle: BattleState,
    x: number,
    y: number,
    role: 'source' | 'target'
  ): { x: number; y: number } {
    if (x < 280) {
      const index = this.fighterEffectIndex(battle, x, y)
      const fighter = battle.fighters[index]
      const anchor = this.fighterAnchor(index)
      return fighter?.tank
        ? {
            x: anchor.x + (role === 'source' ? 126 : 0),
            y: anchor.y - (role === 'source' ? 82 : 54)
          }
        : {
            x: anchor.x + (role === 'source' ? 52 : 0),
            y: anchor.y - (role === 'source' ? 56 : 42)
          }
    }
    let mobIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < battle.mobs.length; index++) {
      const mob = battle.mobs[index]
      const distance = Math.hypot(mob.x - x, mob.y - y)
      if (distance < bestDistance) {
        bestDistance = distance
        mobIndex = index
      }
    }
    const mob = battle.mobs[mobIndex]
    const anchor = this.mobAnchor(mobIndex, battle.mobs.length)
    return {
      x: anchor.x,
      y: anchor.y - (mob?.size && mob.size > 1 ? 116 : 78)
    }
  }

  private drawEffect(effect: BattleEffect | null, battle: BattleState) {
    for (const child of this.effectLayer.removeChildren()) child.destroy({ children: true })
    if (!effect) return
    const progress = clamp(effect.elapsed / Math.max(0.001, effect.duration), 0, 1)
    const source = this.effectPoint(battle, effect.fromX, effect.fromY, 'source')
    const target = this.effectPoint(battle, effect.toX, effect.toY, 'target')
    const fromX = source.x
    const fromY = source.y
    const toX = target.x
    const toY = target.y
    const arc = effect.weaponKind === 'item' || effect.weaponKind === 'se' ? 110 : 0
    const x = fromX + (toX - fromX) * progress
    const y = fromY + (toY - fromY) * progress - Math.sin(progress * Math.PI) * arc
    const trail = new Graphics()
    const trailProgress = Math.max(0, progress - 0.09)
    const trailX = fromX + (toX - fromX) * trailProgress
    const trailY = fromY + (toY - fromY) * trailProgress - Math.sin(trailProgress * Math.PI) * arc
    if (progress < 0.78) {
      trail
        .moveTo(fromX, fromY)
        .lineTo(x, y)
        .stroke({ color: 0x2f3937, width: effect.weaponKind === 'main' ? 9 : 5, alpha: 0.22 })
        .moveTo(trailX, trailY)
        .lineTo(x, y)
        .stroke({
          color:
            effect.weaponKind === 'se'
              ? 0xe85c42
              : effect.weaponKind === 'sub'
                ? 0xf4d36a
                : 0xffe6a1,
          width: effect.weaponKind === 'main' ? 7 : 4,
          alpha: 0.88
        })
        .circle(x, y, effect.weaponKind === 'main' ? 8 : 5)
        .fill(0xfff2c2)
      this.effectLayer.addChild(trail)
    }
    if (progress > 0.58) {
      const blastProgress = clamp((progress - 0.58) / 0.42, 0, 1)
      const kind = effect.dmg > 180 ? 'explosion-heavy' : effect.hit ? 'explosion-medium' : 'impact'
      const texture = pixiAssets.texture(
        BATTLE_EFFECT_ATLAS_ID,
        battleEffectFrame(kind, blastProgress)
      )
      const blast = new Sprite(texture)
      blast.anchor.set(0.5)
      blast.position.set(toX, toY)
      blast.scale.set(effect.dmg > 180 ? 4.2 : 3)
      blast.alpha = effect.hit ? 1 : 0.62
      blast.blendMode = 'add'
      this.effectLayer.addChild(blast)
      if (effect.hit && effect.dmg > 0) {
        const damage = new Text({
          text: String(effect.dmg),
          style: {
            fontFamily: 'Courier New, monospace',
            fontSize: 30,
            fontWeight: '800',
            fill: 0xffe2a4,
            stroke: { color: 0x2c1010, width: 5 }
          }
        })
        damage.anchor.set(0.5)
        damage.position.set(toX, toY - 78 - blastProgress * 40)
        damage.alpha = 1 - blastProgress * 0.45
        this.effectLayer.addChild(damage)
      }
    }
    if (progress < 0.2) {
      const flash = new Sprite(this.muzzleTexture)
      flash.anchor.set(0.5)
      flash.position.set(fromX, fromY)
      flash.scale.set(1.2 + (0.2 - progress) * 3)
      flash.blendMode = 'add'
      this.effectLayer.addChild(flash)
    }
  }
}
