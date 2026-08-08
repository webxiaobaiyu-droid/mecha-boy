import { describe, expect, it } from 'vitest'
import {
  advanceEnvironmentMinutes,
  createWorldEnvironment,
  dayPhaseForMinute,
  daylightProfile,
  forceWeather,
  formatWorldTime,
  normalizeWorldEnvironment,
  restUntilMorning,
  setWorldTime,
  weatherVisualIntensity
} from '../src/game/systems/environment'

describe('世界时间与天气', () => {
  it('以连续时间划分黎明、白天、黄昏和夜间', () => {
    expect(dayPhaseForMinute(4 * 60 + 59)).toBe('night')
    expect(dayPhaseForMinute(5 * 60)).toBe('dawn')
    expect(dayPhaseForMinute(7 * 60)).toBe('day')
    expect(dayPhaseForMinute(17 * 60)).toBe('dusk')
    expect(dayPhaseForMinute(20 * 60)).toBe('night')

    const environment = createWorldEnvironment()
    setWorldTime(environment, 22 * 60 + 7)
    expect(formatWorldTime(environment)).toBe('22:07')
    expect(daylightProfile(environment).darkness).toBeGreaterThan(0.5)
    expect(daylightProfile(environment).lampStrength).toBeGreaterThan(0.8)
  })

  it('同一种子与时间输入产生相同天气序列', () => {
    const first = createWorldEnvironment()
    const second = createWorldEnvironment()
    advanceEnvironmentMinutes(first, 3 * 1440 + 317)
    advanceEnvironmentMinutes(second, 3 * 1440 + 317)
    expect(first).toEqual(second)
    expect(first.day).toBe(4)
    expect(first.nextWeatherAt).toBeGreaterThan((first.day - 1) * 1440 + first.minute)
  })

  it('强制天气可立即预览，雨势会从过渡中逐渐增强', () => {
    const environment = createWorldEnvironment()
    forceWeather(environment, 'rain', 0.8)
    expect(environment.weather).toBe('rain')
    expect(weatherVisualIntensity(environment)).toBeCloseTo(0.8)
    expect(Math.abs(environment.wind)).toBeGreaterThan(0.3)
  })

  it('休息会推进到下一个清晨，并在跨日期间继续演进天气', () => {
    const environment = createWorldEnvironment()
    setWorldTime(environment, 21 * 60 + 30)
    const seedBefore = environment.seed
    restUntilMorning(environment)
    expect(environment.day).toBe(2)
    expect(environment.minute).toBe(7 * 60)
    expect(environment.seed).not.toBe(seedBefore)
  })

  it('旧存档缺少环境字段时补全，损坏数值会被限制', () => {
    expect(normalizeWorldEnvironment(undefined)).toEqual(createWorldEnvironment())
    const normalized = normalizeWorldEnvironment({
      day: -4,
      minute: 9999,
      weather: 'acid',
      nextWeatherAt: -1,
      wind: 7,
      intensity: -2
    })
    expect(normalized.day).toBe(1)
    expect(normalized.minute).toBeGreaterThanOrEqual(0)
    expect(normalized.minute).toBeLessThan(1440)
    expect(normalized.weather).toBe('clear')
    expect(normalized.wind).toBe(1)
    expect(normalized.intensity).toBe(0)
  })
})
