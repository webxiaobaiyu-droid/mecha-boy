import { describe, expect, it } from 'vitest'
import { MONSTERS, REGIONS } from '../src/game/data/combat'
import { WORLD_GATE_POSITIONS } from '../src/game/data/maps'
import { regionAtWorld, regionForLocation } from '../src/game/systems/regions'

describe('区域危险与新手安全带', () => {
  it('每个城镇或地标锚点都归入自己的区域', () => {
    for (const region of REGIONS) {
      expect(regionAtWorld(...region.anchor).id).toBe(region.id)
    }
  })

  it('拉多镇周边只生成低阶怪物且保持小规模遭遇', () => {
    const rado = REGIONS.find((region) => region.id === 'rado')!
    const lowThreatMobs = new Set(['rat', 'ant', 'dog'])
    expect(rado.safeZone).toBe(true)
    expect(rado.encounterRate).toBeLessThanOrEqual(0.04)
    expect(rado.maxGroup).toBe(1)
    expect(rado.mobs.every((mob) => lowThreatMobs.has(mob))).toBe(true)
    expect(Math.max(...rado.mobs.map((mob) => MONSTERS[mob].atk))).toBeLessThanOrEqual(8)

    for (let y = rado.anchor[1] - 4; y <= rado.anchor[1] + 4; y++) {
      for (let x = rado.anchor[0] - 4; x <= rado.anchor[0] + 4; x++) {
        expect(regionAtWorld(x, y).id).toBe('rado')
      }
    }
  })

  it('麦镇农垦带作为第一段战车战区不会生成大型敌群', () => {
    const rado = REGIONS.find((region) => region.id === 'rado')!
    const masaru = REGIONS.find((region) => region.id === 'masaru')!

    expect(masaru.maxGroup).toBe(2)
    expect(Math.min(...masaru.mobs.map((mob) => MONSTERS[mob].atk))).toBeGreaterThan(
      Math.max(...rado.mobs.map((mob) => MONSTERS[mob].atk))
    )
  })

  it('只有真正越过关口才切换到下一阶段敌群', () => {
    const windbreak = WORLD_GATE_POSITIONS.windbreak
    const tidebridge = WORLD_GATE_POSITIONS.tidebridge

    expect(regionAtWorld(windbreak[0] - 1, windbreak[1]).id).toBe('rado')
    expect(regionAtWorld(...windbreak).id).toBe('masaru')
    expect(regionAtWorld(tidebridge[0] - 1, tidebridge[1]).id).toBe('masaru')
    expect(regionAtWorld(...tidebridge).id).toBe('pobb')
  })

  it('推荐路线的危险和等级需求单调上升', () => {
    const route = ['rado', 'masaru', 'pobb', 'rock', 'odo', 'sold', 'tarr', 'eden', 'desert', 'noa']
    const regions = route.map((id) => REGIONS.find((region) => region.id === id)!)
    for (let index = 1; index < regions.length; index++) {
      expect(regions[index].dangerLevel).toBeGreaterThanOrEqual(regions[index - 1].dangerLevel)
      expect(regions[index].recommendedLevel[0]).toBeGreaterThanOrEqual(
        regions[index - 1].recommendedLevel[0]
      )
    }
  })

  it('洞窟沿用所属区域的威胁信息', () => {
    expect(regionForLocation('cave1', 2, 12)?.id).toBe('rado')
    expect(regionForLocation('factory', 2, 2)?.id).toBe('pobb')
    expect(regionForLocation('rado', 0, 0)).toBeNull()
  })
})
