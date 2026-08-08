import type { GameState, WeatherKind, WorldEnvironment } from '@/game/types'
import { hash } from '@/game/engine/tileart'
import { daylightProfile, weatherVisualIntensity } from '@/game/systems/environment'

export type AtmosphereBiome = 'field' | 'forest' | 'mountain' | 'desert' | 'town'

export interface AtmosphereViewport {
  width: number
  height: number
  cameraX: number
  cameraY: number
  tileSize: number
  biome: AtmosphereBiome
  groundTop?: number
  surfaceAt?: (x: number, y: number) => string | undefined
  wetSurface?: (surface: string | undefined) => boolean
}

interface LightPoint {
  x: number
  y: number
  kind?: 'lamp' | 'door' | 'stove' | 'screen'
}

const WEATHER_CLOUD: Record<WeatherKind, number> = {
  clear: 0,
  cloudy: 0.48,
  wind: 0.16,
  rain: 0.68,
  storm: 0.92
}

function mod(value: number, range: number): number {
  return ((value % range) + range) % range
}

function pixelRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
) {
  context.fillStyle = color
  context.fillRect(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height))
  )
}

function cloudCover(environment: WorldEnvironment): number {
  return WEATHER_CLOUD[environment.weather] * weatherVisualIntensity(environment)
}

function weatherSeed(environment: WorldEnvironment): number {
  return (environment.seed ^ Math.floor(environment.weatherStartedAt * 13)) >>> 0
}

export function drawWetGround(
  context: CanvasRenderingContext2D,
  state: GameState,
  viewport: AtmosphereViewport
) {
  const environment = state.environment
  if (environment.weather !== 'rain' && environment.weather !== 'storm') return
  const intensity = weatherVisualIntensity(environment)
  if (intensity < 0.08) return

  const { width, height, cameraX, cameraY, tileSize } = viewport
  const groundTop = viewport.groundTop || 0
  const x0 = Math.floor(cameraX / tileSize) - 1
  const y0 = Math.floor((cameraY + groundTop) / tileSize) - 1
  const x1 = Math.ceil((cameraX + width) / tileSize) + 1
  const y1 = Math.ceil((cameraY + height) / tileSize) + 1
  const seed = weatherSeed(environment) & 0xffff

  for (let wy = y0; wy <= y1; wy++) {
    for (let wx = x0; wx <= x1; wx++) {
      const surface = viewport.surfaceAt?.(wx, wy)
      if (viewport.wetSurface && !viewport.wetSurface(surface)) continue
      const chance = hash(wx, wy, seed + 811)
      if (chance < 0.74 + (1 - intensity) * 0.12) continue
      const puddleWidth = Math.max(
        5,
        Math.round(tileSize * (0.28 + hash(wx, wy, seed + 812) * 0.34))
      )
      const sx = wx * tileSize - cameraX + hash(wx, wy, seed + 813) * (tileSize - puddleWidth)
      const sy = wy * tileSize - cameraY + tileSize * (0.62 + hash(wx, wy, seed + 814) * 0.2)
      if (sy < groundTop || sy > height - 3) continue
      pixelRect(context, sx, sy, puddleWidth, 3, `rgba(20,35,43,${0.2 + intensity * 0.2})`)
      pixelRect(
        context,
        sx + 2,
        sy,
        Math.max(2, puddleWidth * 0.48),
        1,
        `rgba(151,190,196,${0.16 + intensity * 0.2})`
      )
      const ripple = mod(state.playtime * 1.6 + chance * 5, 1)
      if (ripple < 0.18) {
        const spread = 2 + Math.round(ripple * 18)
        pixelRect(
          context,
          sx + puddleWidth / 2 - spread,
          sy - 1,
          spread,
          1,
          'rgba(204,224,224,0.38)'
        )
        pixelRect(context, sx + puddleWidth / 2 + 1, sy - 1, spread, 1, 'rgba(204,224,224,0.3)')
      }
    }
  }
}

export function drawOutdoorLighting(
  context: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number
) {
  const environment = state.environment
  const light = daylightProfile(environment)
  if (light.darkness > 0.01) {
    pixelRect(context, 0, 0, width, height, `rgba(7,15,38,${light.darkness})`)
  }
  if (light.warmth > 0.01) {
    const alpha = light.warmth * (light.phase === 'dusk' ? 0.23 : 0.17)
    pixelRect(context, 0, 0, width, height, `rgba(139,61,34,${alpha})`)
  }
  const clouds = cloudCover(environment)
  if (clouds > 0.01) {
    pixelRect(context, 0, 0, width, height, `rgba(35,48,58,${clouds * 0.2})`)
    const direction = environment.wind < 0 ? -1 : 1
    const bandWidth = Math.round(width * 0.28)
    for (let i = 0; i < 3; i++) {
      const x =
        mod(
          i * (width * 0.47) + state.playtime * 5 * direction + weatherSeed(environment) * 0.01,
          width + bandWidth
        ) - bandWidth
      pixelRect(context, x, 0, bandWidth, height, `rgba(22,31,38,${clouds * 0.035})`)
    }
  }
}

function lightPool(
  context: CanvasRenderingContext2D,
  point: LightPoint,
  strength: number,
  scale = 1
) {
  const isScreen = point.kind === 'screen'
  const isStove = point.kind === 'stove'
  const color = isScreen ? '106,194,226' : isStove ? '255,132,47' : '255,194,82'
  pixelRect(
    context,
    point.x - 28 * scale,
    point.y - 13 * scale,
    56 * scale,
    26 * scale,
    `rgba(${color},${strength * 0.055})`
  )
  pixelRect(
    context,
    point.x - 19 * scale,
    point.y - 9 * scale,
    38 * scale,
    18 * scale,
    `rgba(${color},${strength * 0.075})`
  )
  pixelRect(
    context,
    point.x - 10 * scale,
    point.y - 5 * scale,
    20 * scale,
    10 * scale,
    `rgba(${color},${strength * 0.11})`
  )
  pixelRect(
    context,
    point.x - 3 * scale,
    point.y - 2 * scale,
    6 * scale,
    4 * scale,
    `rgba(${color},${strength * 0.34})`
  )
}

export function drawNightLights(
  context: CanvasRenderingContext2D,
  state: GameState,
  points: LightPoint[],
  scale = 1
) {
  const strength = daylightProfile(state.environment).lampStrength
  if (strength <= 0.02) return
  for (const point of points) lightPool(context, point, strength, scale)
}

export function drawInteriorLighting(
  context: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
  lights: LightPoint[]
) {
  const profile = daylightProfile(state.environment)
  if (profile.darkness > 0.01) {
    pixelRect(context, 0, 0, width, height, `rgba(22,18,33,${profile.darkness * 0.24})`)
  }
  if (profile.warmth > 0.01) {
    pixelRect(context, 0, 0, width, height, `rgba(123,67,44,${profile.warmth * 0.06})`)
  }
  const strength = Math.max(0.28, profile.lampStrength)
  for (const light of lights) lightPool(context, light, strength, 1.2)
}

function drawRain(
  context: CanvasRenderingContext2D,
  state: GameState,
  viewport: AtmosphereViewport,
  intensity: number
) {
  const environment = state.environment
  const seed = weatherSeed(environment) & 0xffff
  const count = Math.round(30 + intensity * (environment.weather === 'storm' ? 86 : 62))
  const direction = environment.wind < 0 ? -1 : 1
  const slant = Math.max(1, Math.round(Math.abs(environment.wind) * 3)) * direction
  const spanX = viewport.width + 120
  const spanY = viewport.height + 40
  const rainColor =
    environment.weather === 'storm' ? 'rgba(205,226,235,0.72)' : 'rgba(185,214,220,0.58)'

  for (let i = 0; i < count; i++) {
    const speed = 182 + hash(i, seed, 901) * 132
    const x = mod(hash(i, seed, 902) * spanX + state.playtime * environment.wind * 74, spanX) - 60
    const y = mod(hash(i, seed, 903) * spanY + state.playtime * speed, spanY) - 20
    const segments = 2 + Math.round(hash(i, seed, 904) * 2 + intensity)
    for (let segment = 0; segment < segments; segment++) {
      pixelRect(context, x + segment * slant, y + segment * 2, 1, 2, rainColor)
    }
  }

  for (let i = 0; i < Math.round(6 + intensity * 12); i++) {
    const phase = mod(state.playtime * (1.7 + hash(i, seed, 910)) + hash(i, seed, 911) * 4, 1)
    if (phase > 0.13) continue
    const x = hash(i, seed, 912) * viewport.width
    const y =
      (viewport.groundTop || 0) + hash(i, seed, 913) * (viewport.height - (viewport.groundTop || 0))
    const wx = Math.floor((viewport.cameraX + x) / viewport.tileSize)
    const wy = Math.floor((viewport.cameraY + y) / viewport.tileSize)
    const surface = viewport.surfaceAt?.(wx, wy)
    if (viewport.wetSurface && !viewport.wetSurface(surface)) continue
    pixelRect(context, x - 3, y, 3, 1, 'rgba(210,230,232,0.48)')
    pixelRect(context, x + 1, y, 3, 1, 'rgba(210,230,232,0.38)')
    pixelRect(context, x, y - 2, 1, 2, 'rgba(230,240,241,0.42)')
  }
}

function windPalette(biome: AtmosphereBiome, leaf: boolean): string {
  if (biome === 'desert') return leaf ? 'rgba(129,83,42,0.78)' : 'rgba(235,197,122,0.58)'
  if (biome === 'forest') return leaf ? 'rgba(113,137,62,0.86)' : 'rgba(205,192,139,0.48)'
  if (biome === 'town') return leaf ? 'rgba(152,109,57,0.82)' : 'rgba(222,205,164,0.47)'
  return leaf ? 'rgba(138,151,70,0.84)' : 'rgba(228,213,154,0.5)'
}

function drawWind(
  context: CanvasRenderingContext2D,
  state: GameState,
  viewport: AtmosphereViewport,
  intensity: number
) {
  const environment = state.environment
  const seed = weatherSeed(environment) & 0xffff
  const direction = environment.wind < 0 ? -1 : 1
  const count = Math.round(16 + intensity * 30)
  const spanX = viewport.width + 160
  for (let i = 0; i < count; i++) {
    const speed = 72 + hash(i, seed, 930) * 92
    const x = mod(hash(i, seed, 931) * spanX + state.playtime * speed, spanX)
    const sx = direction > 0 ? x - 80 : viewport.width + 80 - x
    const sy = hash(i, seed, 932) * viewport.height + Math.sin(state.playtime * 2 + i) * 8
    const leaf = i % 4 === 0 && viewport.biome !== 'desert'
    const length = leaf ? 3 + (i % 3) : 8 + Math.round(hash(i, seed, 933) * 18)
    const color = windPalette(viewport.biome, leaf)
    if (leaf) {
      pixelRect(context, sx, sy, length, 2, color)
      pixelRect(context, sx + direction * 2, sy + 2, 2, 2, color)
    } else {
      pixelRect(context, sx, sy, length, 1, color)
      if (i % 3 === 0) pixelRect(context, sx + direction * 5, sy + 3, length * 0.55, 1, color)
    }
  }

  const gustColor = windPalette(viewport.biome, false)
  for (let gust = 0; gust < 4; gust++) {
    const travel = mod(
      hash(gust, seed, 940) * (viewport.width + 260) + state.playtime * (94 + gust * 13),
      viewport.width + 260
    )
    const startX = direction > 0 ? travel - 180 : viewport.width + 180 - travel
    const startY = 44 + hash(gust, seed, 941) * Math.max(80, viewport.height - 88)
    for (let segment = 0; segment < 6; segment++) {
      const offset = segment * 25 * direction
      pixelRect(
        context,
        startX + offset,
        startY + ((segment + gust) % 3) * 2,
        12 + ((segment + gust) % 3) * 5,
        1,
        gustColor
      )
    }
  }
}

function drawLightning(
  context: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
  intensity: number
) {
  if (state.environment.weather !== 'storm') return
  const cycle = 8 + (weatherSeed(state.environment) % 7)
  const phase = mod(state.playtime + (weatherSeed(state.environment) % 13), cycle)
  let flash = 0
  if (phase < 0.07) flash = 1 - phase / 0.07
  else if (phase > 0.15 && phase < 0.21) flash = 1 - (phase - 0.15) / 0.06
  if (flash > 0) {
    pixelRect(context, 0, 0, width, height, `rgba(218,232,255,${flash * intensity * 0.34})`)
  }
}

export function drawWeatherParticles(
  context: CanvasRenderingContext2D,
  state: GameState,
  viewport: AtmosphereViewport
) {
  const environment = state.environment
  const intensity = weatherVisualIntensity(environment)
  if (environment.weather === 'rain' || environment.weather === 'storm') {
    drawRain(context, state, viewport, intensity)
  } else if (environment.weather === 'wind' || Math.abs(environment.wind) > 0.68) {
    drawWind(context, state, viewport, intensity)
  }
  drawLightning(context, state, viewport.width, viewport.height, intensity)
}

export function drawBattleSkyAtmosphere(
  context: CanvasRenderingContext2D,
  state: GameState,
  horizonY: number,
  biome: AtmosphereBiome
) {
  const environment = state.environment
  const profile = daylightProfile(environment)
  const seed = weatherSeed(environment) & 0xffff
  if (profile.phase === 'night') {
    const visibleStars = environment.weather === 'clear' || environment.weather === 'wind'
    if (visibleStars) {
      for (let i = 0; i < 30; i++) {
        const x = hash(i, seed, 950) * 640
        const y = 18 + hash(i, seed, 951) * Math.max(24, horizonY - 54)
        const bright = i % 7 === 0
        pixelRect(context, x, y, bright ? 2 : 1, bright ? 2 : 1, bright ? '#d9e5da' : '#7e96a5')
      }
      const moonX = environment.day % 2 ? 518 : 96
      pixelRect(context, moonX - 12, 48, 24, 24, '#d8ddd0')
      pixelRect(context, moonX - 16, 54, 32, 12, '#d8ddd0')
      pixelRect(context, moonX + 5, 48, 8, 13, '#aab4b0')
      pixelRect(context, moonX + 9, 50, 6, 11, '#182a3d')
    }
  } else if (profile.phase === 'dawn' || profile.phase === 'dusk') {
    const progress =
      profile.phase === 'dawn'
        ? (environment.minute - 5 * 60) / 120
        : (environment.minute - 17 * 60) / 180
    const sunX = profile.phase === 'dawn' ? 84 + progress * 110 : 548 - progress * 100
    const sunY = 82 + Math.abs(progress - 0.5) * 30
    pixelRect(context, sunX - 12, sunY - 10, 24, 20, '#e78a45')
    pixelRect(context, sunX - 16, sunY - 5, 32, 10, '#f0a957')
  }

  const clouds = cloudCover(environment)
  if (clouds <= 0.03) return
  const direction = environment.wind < 0 ? -1 : 1
  const cloudColor = profile.phase === 'night' ? 'rgba(28,38,53,0.88)' : 'rgba(62,72,76,0.72)'
  const count = environment.weather === 'storm' ? 8 : 5
  for (let i = 0; i < count; i++) {
    const span = 760
    const base = hash(i, seed, 960) * span
    const x =
      mod(base + state.playtime * (5 + Math.abs(environment.wind) * 8) * direction, span) - 60
    const y = 24 + hash(i, seed, 961) * Math.max(30, horizonY * 0.52)
    const width = 48 + hash(i, seed, 962) * 70
    pixelRect(context, x, y, width, 13, cloudColor)
    pixelRect(context, x + 13, y - 7, width * 0.55, 9, cloudColor)
    pixelRect(context, x + width * 0.38, y + 10, width * 0.48, 6, cloudColor)
  }

  if (biome === 'desert' && environment.weather === 'wind') {
    pixelRect(
      context,
      0,
      horizonY - 42,
      640,
      42,
      `rgba(179,129,70,${weatherVisualIntensity(environment) * 0.16})`
    )
  }
}
