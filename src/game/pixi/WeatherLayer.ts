import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { GameState } from '@/game/types'
import { daylightProfile, weatherVisualIntensity } from '@/game/systems/environment'
import { clamp, createRadialTexture } from '@/game/pixi/helpers'

interface Particle {
  sprite: Sprite
  x: number
  y: number
  speed: number
  drift: number
  seed: number
}

export interface WeatherPresentation {
  outdoors: boolean
  focusX: number
  focusY: number
  groundY?: number
}

export class WeatherLayer extends Container {
  private shade = new Graphics()
  private warmth = new Graphics()
  private flash = new Graphics()
  private headlight = new Sprite(createRadialTexture())
  private particles = new Container()
  private pool: Particle[] = []
  private viewportWidth = 1
  private viewportHeight = 1

  constructor() {
    super()
    this.eventMode = 'none'
    this.headlight.anchor.set(0.5)
    this.headlight.blendMode = 'add'
    this.particles.eventMode = 'none'
    this.addChild(this.shade, this.warmth, this.headlight, this.particles, this.flash)
    for (let index = 0; index < 180; index++) {
      const sprite = new Sprite(Texture.WHITE)
      sprite.anchor.set(0.5)
      sprite.visible = false
      this.particles.addChild(sprite)
      this.pool.push({
        sprite,
        x: (index * 73.37) % 1200,
        y: (index * 41.91) % 800,
        speed: 0.7 + ((index * 17) % 31) / 31,
        drift: ((index * 29) % 23) / 23,
        seed: ((index * 47) % 101) / 101
      })
    }
  }

  resize(width: number, height: number) {
    this.viewportWidth = Math.max(1, width)
    this.viewportHeight = Math.max(1, height)
  }

  update(state: GameState, presentation: WeatherPresentation, dt: number) {
    const daylight = daylightProfile(state.environment)
    const outdoors = presentation.outdoors
    const darkness = outdoors ? daylight.darkness : Math.max(0.12, daylight.darkness * 0.42)

    this.shade
      .clear()
      .rect(0, 0, this.viewportWidth, this.viewportHeight)
      .fill({
        color: outdoors ? 0x071329 : 0x071018,
        alpha: darkness
      })
    this.warmth.clear()
    if (outdoors && daylight.warmth > 0.01) {
      this.warmth.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({
        color: 0xd96f3f,
        alpha: daylight.warmth * 0.14
      })
    }

    this.headlight.visible = darkness > 0.22
    this.headlight.position.set(presentation.focusX, presentation.focusY)
    const lightScale = clamp(Math.min(this.viewportWidth, this.viewportHeight) / 430, 1.2, 2.8)
    this.headlight.scale.set(lightScale * 1.45, lightScale)
    this.headlight.alpha = clamp(darkness * 1.15, 0, 0.72)

    const intensity = outdoors ? weatherVisualIntensity(state.environment) : 0
    const rain = state.environment.weather === 'rain' || state.environment.weather === 'storm'
    const dust = state.environment.weather === 'wind'
    const activeCount = rain
      ? Math.round(48 + intensity * 118)
      : dust
        ? Math.round(20 + intensity * 48)
        : 0
    const wind = state.environment.wind

    for (let index = 0; index < this.pool.length; index++) {
      const particle = this.pool[index]
      const sprite = particle.sprite
      sprite.visible = index < activeCount
      if (!sprite.visible) continue
      if (rain) {
        particle.x += (wind * 190 + particle.drift * 28) * dt
        particle.y += (530 + particle.speed * 430) * dt
        if (particle.y > this.viewportHeight + 30) {
          particle.y = -30 - particle.seed * 90
          particle.x = (particle.x + particle.seed * this.viewportWidth * 0.73) % this.viewportWidth
        }
        if (particle.x > this.viewportWidth + 40) particle.x -= this.viewportWidth + 80
        if (particle.x < -40) particle.x += this.viewportWidth + 80
        sprite.position.set(particle.x, particle.y)
        sprite.width = 1 + intensity * 1.4
        sprite.height = 10 + particle.speed * 18
        sprite.rotation = -wind * 0.22
        sprite.tint = state.environment.weather === 'storm' ? 0xc9d8de : 0xaebfc6
        sprite.alpha = 0.22 + intensity * 0.46
      } else {
        particle.x += (110 + Math.abs(wind) * 260 + particle.speed * 60) * Math.sign(wind || 1) * dt
        particle.y += Math.sin(state.playtime * 1.7 + particle.seed * 12) * 12 * dt
        if (particle.x > this.viewportWidth + 30) particle.x = -30
        if (particle.x < -30) particle.x = this.viewportWidth + 30
        particle.y =
          ((particle.y % this.viewportHeight) + this.viewportHeight) % this.viewportHeight
        sprite.position.set(particle.x, particle.y)
        sprite.width = 3 + particle.speed * 6
        sprite.height = 1 + particle.seed * 2
        sprite.rotation = 0
        sprite.tint = 0xb9a47e
        sprite.alpha = 0.1 + intensity * 0.24
      }
    }

    const stormPulse =
      state.environment.weather === 'storm'
        ? Math.max(0, Math.sin(state.playtime * 1.73 + 0.8) - 0.965) / 0.035
        : 0
    this.flash.clear()
    if (stormPulse > 0) {
      this.flash.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({
        color: 0xdde8ff,
        alpha: Math.min(0.62, stormPulse * intensity * 0.7)
      })
    }
  }
}
