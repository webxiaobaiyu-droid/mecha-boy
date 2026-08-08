import type { DayPhase, WeatherKind, WorldEnvironment } from '@/game/types'

export const GAME_MINUTES_PER_SECOND = 1
export const MINUTES_PER_DAY = 24 * 60
export const MORNING_MINUTE = 7 * 60

const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'cloudy', 'wind', 'rain', 'storm']

const WEATHER_WEIGHTS: Record<WeatherKind, readonly [WeatherKind, number][]> = {
  clear: [
    ['clear', 30],
    ['cloudy', 28],
    ['wind', 25],
    ['rain', 14],
    ['storm', 3]
  ],
  cloudy: [
    ['clear', 20],
    ['cloudy', 22],
    ['wind', 18],
    ['rain', 32],
    ['storm', 8]
  ],
  wind: [
    ['clear', 30],
    ['cloudy', 25],
    ['wind', 20],
    ['rain', 20],
    ['storm', 5]
  ],
  rain: [
    ['clear', 12],
    ['cloudy', 38],
    ['wind', 18],
    ['rain', 22],
    ['storm', 10]
  ],
  storm: [
    ['clear', 10],
    ['cloudy', 45],
    ['wind', 20],
    ['rain', 25]
  ]
}

const WEATHER_LABELS: Record<WeatherKind, string> = {
  clear: '晴',
  cloudy: '多云',
  wind: '大风',
  rain: '降雨',
  storm: '雷雨'
}

const WEATHER_BANNERS: Record<WeatherKind, string> = {
  clear: '云层散去了',
  cloudy: '云层正在聚集',
  wind: '荒野起风了',
  rain: '雨势渐起',
  storm: '雷云压低了'
}

export interface EnvironmentUpdate {
  weatherChanged: boolean
  phaseChanged: boolean
  weather: WeatherKind
  phase: DayPhase
}

export interface DaylightProfile {
  phase: DayPhase
  darkness: number
  warmth: number
  lampStrength: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function absoluteMinute(environment: WorldEnvironment): number {
  return (environment.day - 1) * MINUTES_PER_DAY + environment.minute
}

function random(environment: WorldEnvironment): number {
  environment.seed = (Math.imul(environment.seed >>> 0, 1664525) + 1013904223) >>> 0
  return environment.seed / 4294967296
}

function weatherIntensity(kind: WeatherKind, roll: number): number {
  switch (kind) {
    case 'storm':
      return 0.86 + roll * 0.14
    case 'rain':
      return 0.56 + roll * 0.28
    case 'wind':
      return 0.68 + roll * 0.28
    case 'cloudy':
      return 0.36 + roll * 0.24
    default:
      return 0.12 + roll * 0.12
  }
}

function windStrength(kind: WeatherKind, roll: number): number {
  switch (kind) {
    case 'storm':
      return 0.78 + roll * 0.22
    case 'wind':
      return 0.72 + roll * 0.28
    case 'rain':
      return 0.38 + roll * 0.34
    case 'cloudy':
      return 0.22 + roll * 0.28
    default:
      return 0.1 + roll * 0.2
  }
}

function chooseWeather(environment: WorldEnvironment): WeatherKind {
  const entries = WEATHER_WEIGHTS[environment.weather]
  let roll = random(environment) * entries.reduce((sum, item) => sum + item[1], 0)
  for (const [weather, weight] of entries) {
    roll -= weight
    if (roll <= 0) return weather
  }
  return entries[entries.length - 1][0]
}

function scheduleWeather(environment: WorldEnvironment, changeAt: number): boolean {
  const previous = environment.weather
  const next = chooseWeather(environment)
  const direction = random(environment) < 0.5 ? -1 : 1
  environment.wind = direction * windStrength(next, random(environment))
  environment.intensity = weatherIntensity(next, random(environment))
  environment.nextWeatherAt = changeAt + 150 + Math.round(random(environment) * 210)
  if (next !== previous) {
    environment.weather = next
    environment.weatherStartedAt = changeAt
    return true
  }
  return false
}

export function createWorldEnvironment(): WorldEnvironment {
  return {
    day: 1,
    minute: 8 * 60,
    weather: 'clear',
    weatherStartedAt: 7 * 60,
    nextWeatherAt: 10 * 60 + 30,
    seed: 0x4d4d5732,
    wind: 0.18,
    intensity: 0.18
  }
}

export function normalizeWorldEnvironment(value: unknown): WorldEnvironment {
  const fallback = createWorldEnvironment()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  const raw = value as Partial<WorldEnvironment>
  const day = Number.isFinite(raw.day) ? Math.max(1, Math.floor(raw.day!)) : fallback.day
  const minute = Number.isFinite(raw.minute)
    ? ((raw.minute! % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
    : fallback.minute
  const now = (day - 1) * MINUTES_PER_DAY + minute
  const weather = WEATHER_KINDS.includes(raw.weather as WeatherKind)
    ? (raw.weather as WeatherKind)
    : fallback.weather
  return {
    day,
    minute,
    weather,
    weatherStartedAt: Number.isFinite(raw.weatherStartedAt)
      ? Math.min(now, raw.weatherStartedAt!)
      : now - 30,
    nextWeatherAt:
      Number.isFinite(raw.nextWeatherAt) && raw.nextWeatherAt! > now
        ? raw.nextWeatherAt!
        : now + 180,
    seed: Number.isFinite(raw.seed) ? raw.seed! >>> 0 : fallback.seed,
    wind: Number.isFinite(raw.wind) ? clamp(raw.wind!, -1, 1) : fallback.wind,
    intensity: Number.isFinite(raw.intensity)
      ? clamp(raw.intensity!, 0, 1)
      : weatherIntensity(weather, 0.5)
  }
}

export function dayPhaseForMinute(minute: number): DayPhase {
  const normalized = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  if (normalized < 5 * 60 || normalized >= 20 * 60) return 'night'
  if (normalized < 7 * 60) return 'dawn'
  if (normalized < 17 * 60) return 'day'
  return 'dusk'
}

export function daylightProfile(environment: WorldEnvironment): DaylightProfile {
  const minute = environment.minute
  const phase = dayPhaseForMinute(minute)
  let darkness = 0
  let warmth = 0
  if (phase === 'dawn') {
    const progress = (minute - 5 * 60) / (2 * 60)
    darkness = (1 - progress) * 0.52
    warmth = Math.sin(progress * Math.PI) * 0.72
  } else if (phase === 'dusk') {
    const progress = (minute - 17 * 60) / (3 * 60)
    darkness = progress * 0.56
    warmth = Math.sin(progress * Math.PI) * 0.8
  } else if (phase === 'night') {
    const midnightDistance = Math.min(minute, MINUTES_PER_DAY - minute)
    darkness = 0.54 - Math.min(1, midnightDistance / (5 * 60)) * 0.05
  }
  return {
    phase,
    darkness: clamp(darkness, 0, 0.56),
    warmth,
    lampStrength: clamp(darkness * 1.65 + (environment.weather === 'storm' ? 0.18 : 0), 0, 1)
  }
}

export function weatherVisualIntensity(environment: WorldEnvironment): number {
  const age = absoluteMinute(environment) - environment.weatherStartedAt
  return environment.intensity * clamp(age / 15, 0, 1)
}

export function advanceEnvironmentMinutes(
  environment: WorldEnvironment,
  minutes: number
): EnvironmentUpdate {
  const previousPhase = dayPhaseForMinute(environment.minute)
  const current = absoluteMinute(environment) + Math.max(0, Number.isFinite(minutes) ? minutes : 0)
  let weatherChanged = false
  let guard = 0
  while (current >= environment.nextWeatherAt && guard++ < 32) {
    const changeAt = environment.nextWeatherAt
    weatherChanged = scheduleWeather(environment, changeAt) || weatherChanged
  }
  environment.day = Math.floor(current / MINUTES_PER_DAY) + 1
  environment.minute = current % MINUTES_PER_DAY
  const phase = dayPhaseForMinute(environment.minute)
  return {
    weatherChanged,
    phaseChanged: phase !== previousPhase,
    weather: environment.weather,
    phase
  }
}

export function advanceWorldEnvironment(
  environment: WorldEnvironment,
  seconds: number
): EnvironmentUpdate {
  return advanceEnvironmentMinutes(environment, Math.max(0, seconds) * GAME_MINUTES_PER_SECOND)
}

export function restUntilMorning(environment: WorldEnvironment): EnvironmentUpdate {
  const current = absoluteMinute(environment)
  const todayMorning = (environment.day - 1) * MINUTES_PER_DAY + MORNING_MINUTE
  const target = current < todayMorning ? todayMorning : todayMorning + MINUTES_PER_DAY
  return advanceEnvironmentMinutes(environment, target - current)
}

export function forceWeather(
  environment: WorldEnvironment,
  weather: WeatherKind,
  intensity = weatherIntensity(weather, 0.72)
) {
  const now = absoluteMinute(environment)
  environment.weather = weather
  environment.weatherStartedAt = now - 30
  environment.nextWeatherAt = now + 240
  environment.intensity = clamp(intensity, 0, 1)
  const direction = environment.wind < 0 ? -1 : 1
  environment.wind = direction * windStrength(weather, 0.72)
}

export function setWorldTime(environment: WorldEnvironment, minute: number) {
  if (!Number.isFinite(minute)) return
  environment.minute = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const now = absoluteMinute(environment)
  if (environment.nextWeatherAt <= now) environment.nextWeatherAt = now + 180
  if (environment.weatherStartedAt > now) environment.weatherStartedAt = now - 30
}

export function parseDebugTime(value: string | null): number | null {
  if (!value) return null
  const named: Record<string, number> = {
    dawn: 5 * 60 + 45,
    day: 12 * 60,
    dusk: 18 * 60 + 15,
    night: 22 * 60
  }
  if (value in named) return named[value]
  const match = value.match(/^(\d{1,2})(?::(\d{1,2}))?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2] || 0)
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function weatherLabel(weather: WeatherKind): string {
  return WEATHER_LABELS[weather]
}

export function weatherBanner(weather: WeatherKind): string {
  return WEATHER_BANNERS[weather]
}

export function formatWorldTime(environment: WorldEnvironment): string {
  const total = Math.floor(environment.minute)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
