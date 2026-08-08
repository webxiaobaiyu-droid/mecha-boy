import { describe, expect, it } from 'vitest'
import { advanceEncounterPacing, encounterTriggers } from '@/game/systems/encounters'

describe('随机遇敌节奏', () => {
  it('战斗后先提供安全步数，再逐步恢复遇敌概率', () => {
    for (let steps = 0; steps < 5; steps++) {
      expect(advanceEncounterPacing(steps, 0.035, { safeZone: true }).chance).toBe(0)
    }

    const firstEligible = advanceEncounterPacing(5, 0.035, { safeZone: true })
    const later = advanceEncounterPacing(10, 0.035, { safeZone: true })
    expect(firstEligible.chance).toBeGreaterThan(0)
    expect(later.chance).toBeGreaterThan(firstEligible.chance)
  })

  it('公路降低随机概率，但不会无限推迟战斗', () => {
    const field = advanceEncounterPacing(7, 0.075, {})
    const road = advanceEncounterPacing(7, 0.075, { road: true })
    expect(road.chance).toBeLessThan(field.chance)

    const hardCap = advanceEncounterPacing(9, 0.075, { road: true })
    expect(hardCap).toMatchObject({ steps: 10, forced: true, chance: 1 })
    expect(encounterTriggers(hardCap, 0.999999)).toBe(true)
  })

  it('新手安全带不会连续爆战，长途又能稳定产生升级战斗', () => {
    let steps = 0
    let encounters = 0
    for (let travelled = 0; travelled < 39; travelled++) {
      const pacing = advanceEncounterPacing(steps, 0.035, { safeZone: true, road: true })
      steps = pacing.steps
      if (encounterTriggers(pacing, 1)) {
        encounters++
        steps = 0
      }
    }

    expect(encounters).toBe(3)
  })

  it('洞窟的新手窗口比普通危险区更宽松', () => {
    const safeCave = advanceEncounterPacing(0, 0.035, { cave: true, safeZone: true })
    const hostileCave = advanceEncounterPacing(0, 0.075, { cave: true })
    expect(safeCave.graceSteps).toBeGreaterThan(hostileCave.graceSteps)
    expect(safeCave.hardCap).toBeGreaterThan(hostileCave.hardCap)
  })
})
