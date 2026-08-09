import { Container, Graphics } from 'pixi.js'
import { overworldTankVisualFor, tankConditionFor, tankFacingAngle } from '@/game/assets/tanks'
import { TANKS } from '@/game/data/equipment'
import type { TankState } from '@/game/types'
import { colorNumber } from '@/game/pixi/helpers'

export class TankActor extends Container {
  private tankId = ''
  private condition = ''
  private treadLeft = new Graphics()
  private treadRight = new Graphics()
  private hull = new Graphics()
  private turret = new Graphics()
  private barrel = new Graphics()
  private damage = new Graphics()

  constructor() {
    super()
    this.addChild(this.treadLeft, this.treadRight, this.hull, this.barrel, this.turret, this.damage)
  }

  sync(tank: TankState, facing: number, moving: boolean, time: number) {
    const def = tank.tankDef || TANKS.find((item) => item.id === tank.tankId)
    const condition = tankConditionFor(tank.sp, def?.sp || tank.sp || 1)
    if (tank.tankId !== this.tankId || condition !== this.condition) {
      this.tankId = tank.tankId
      this.condition = condition
      this.redraw(tank)
    }
    this.rotation = tankFacingAngle(facing)
    const treadPulse = moving ? Math.floor(time * 12) % 2 : 0
    this.treadLeft.y = treadPulse
    this.treadRight.y = -treadPulse
    this.damage.alpha = condition === 'healthy' ? 0 : 0.5 + Math.sin(time * 5) * 0.16
  }

  private redraw(tank: TankState) {
    const visual = overworldTankVisualFor(tank.tankId)
    const def = tank.tankDef || TANKS.find((item) => item.id === tank.tankId)
    const primary = colorNumber(def?.colors.X, 0x596752)
    const secondary = colorNumber(def?.colors.Y, 0x333c31)
    const halfWidth = visual.bodyWidth / 2
    const halfLength = visual.bodyLength / 2
    const trackX = halfWidth + visual.trackWidth

    this.treadLeft
      .clear()
      .roundRect(-trackX, -halfLength, visual.trackWidth, visual.bodyLength, 2)
      .fill(0x151a18)
      .rect(-trackX + 1, -halfLength + 2, Math.max(1, visual.trackWidth - 2), visual.bodyLength - 4)
      .fill(0x4a514d)
    this.treadRight
      .clear()
      .roundRect(halfWidth, -halfLength, visual.trackWidth, visual.bodyLength, 2)
      .fill(0x151a18)
      .rect(
        halfWidth + 1,
        -halfLength + 2,
        Math.max(1, visual.trackWidth - 2),
        visual.bodyLength - 4
      )
      .fill(0x4a514d)

    this.hull
      .clear()
      .roundRect(-halfWidth - 1, -halfLength + 1, visual.bodyWidth + 2, visual.bodyLength - 2, 3)
      .fill(0x101513)
      .roundRect(-halfWidth, -halfLength + 2, visual.bodyWidth, visual.bodyLength - 4, 2)
      .fill(primary)
      .rect(-halfWidth + 3, -halfLength + 4, visual.bodyWidth - 6, 3)
      .fill(0x9aa795)
      .rect(-halfWidth + 2, halfLength - 6, visual.bodyWidth - 4, 3)
      .fill(secondary)

    const turretWidth = visual.turretWidth
    const turretLength = visual.turretLength
    this.turret
      .clear()
      .roundRect(
        -turretWidth / 2 - 1,
        -turretLength / 2 - visual.deckOffset - 1,
        turretWidth + 2,
        turretLength + 2,
        3
      )
      .fill(0x101513)
      .roundRect(
        -turretWidth / 2,
        -turretLength / 2 - visual.deckOffset,
        turretWidth,
        turretLength,
        2
      )
      .fill(secondary)
      .rect(-turretWidth / 2 + 2, -turretLength / 2 - visual.deckOffset + 2, turretWidth - 4, 2)
      .fill(0x9aa795)

    this.barrel
      .clear()
      .rect(
        -2,
        -turretLength / 2 - visual.deckOffset - visual.barrelLength,
        4,
        visual.barrelLength + 3
      )
      .fill(0x111614)
      .rect(
        -1,
        -turretLength / 2 - visual.deckOffset - visual.barrelLength,
        2,
        visual.barrelLength + 2
      )
      .fill(0x737c75)

    this.damage.clear()
    if (this.condition === 'damaged' || this.condition === 'critical') {
      this.damage
        .circle(-5, -halfLength - 3, this.condition === 'critical' ? 5 : 3)
        .fill({ color: 0x202522, alpha: 0.75 })
        .circle(-3, -halfLength - 8, this.condition === 'critical' ? 3 : 2)
        .fill({ color: 0x59605c, alpha: 0.48 })
    } else if (this.condition === 'disabled') {
      this.damage
        .circle(0, -4, 7)
        .fill({ color: 0x080a09, alpha: 0.86 })
        .rect(-6, -2, 12, 2)
        .fill(0xd34a3a)
    }
  }
}
