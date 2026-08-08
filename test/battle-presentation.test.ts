import { describe, expect, it } from 'vitest'
import {
  BATTLE_ATLASES,
  BATTLE_EFFECT_ATLAS_ID,
  BATTLE_EFFECT_DURATION,
  battleEffectFrame,
  battleFighterLayout,
  battleTankVisualFor,
  resolveBattleEnvironment
} from '../src/game/assets/battle'

describe('battle presentation contract', () => {
  it('resolves battle scenery from the current environment', () => {
    expect(resolveBattleEnvironment({ location: 'world', mapId: 'world', tile: '.' })).toBe('field')
    expect(resolveBattleEnvironment({ location: 'town', mapId: 'rado' })).toBe('town')
    expect(resolveBattleEnvironment({ location: 'room', mapId: 'rado_home' })).toBe('town')
    expect(resolveBattleEnvironment({ location: 'cave', mapId: 'cave1', regionId: 'rado' })).toBe(
      'cave'
    )
    expect(resolveBattleEnvironment({ location: 'world', mapId: 'world', tile: 's' })).toBe(
      'desert'
    )
    expect(resolveBattleEnvironment({ location: 'world', mapId: 'world', tile: 'f' })).toBe(
      'forest'
    )
    expect(resolveBattleEnvironment({ location: 'world', mapId: 'world', tile: 'm' })).toBe(
      'mountain'
    )
    expect(resolveBattleEnvironment({ location: 'cave', mapId: 'noa1', final: true })).toBe('final')
  })

  it('gives all eight tanks a distinct battle silhouette signature', () => {
    const visuals = Array.from({ length: 8 }, (_, index) => battleTankVisualFor(`t${index + 1}`))
    const signatures = visuals.map(
      (visual) =>
        `${visual.chassis}:${visual.turret}:${visual.hullLength}:${visual.hullHeight}:${visual.barrelLength}`
    )

    expect(new Set(signatures).size).toBe(8)
    expect(visuals.every((visual) => visual.hullLength >= 94 && visual.barrelLength > 0)).toBe(true)
    expect(visuals[0]).toMatchObject({
      chassis: 'tracked',
      turret: 'short',
      hullLength: 102,
      runningGearHeight: 21
    })
  })

  it('anchors tank projectiles at the end of the raised cannon barrel', () => {
    const human = battleFighterLayout(0)
    const tank = battleFighterLayout(0, 't1')

    expect(tank.muzzleX).toBeGreaterThan(human.muzzleX)
    expect(tank.muzzleY).toBeLessThan(human.muzzleY)
    expect(tank.impactY).toBeLessThan(human.impactY)
  })

  it('keeps main gun, sub gun and S-E effects visibly different in timing', () => {
    expect(BATTLE_EFFECT_DURATION.sub).toBeLessThan(BATTLE_EFFECT_DURATION.main)
    expect(BATTLE_EFFECT_DURATION.main).toBeLessThan(BATTLE_EFFECT_DURATION.se)
  })

  it('selects bounded frames for every original battle effect animation', () => {
    expect(battleEffectFrame('shell', -1)).toBe('shell/0')
    expect(battleEffectFrame('shell', 0.26)).toBe('shell/1')
    expect(battleEffectFrame('missile', Number.NaN)).toBe('missile/0')
    expect(battleEffectFrame('impact', 1)).toBe('impact/3')
    expect(battleEffectFrame('explosion-medium', 0.5)).toBe('explosion-medium/3')
    expect(battleEffectFrame('explosion-heavy', 2)).toBe('explosion-heavy/5')
  })

  it('registers the complete original battle-effects atlas', () => {
    const atlas = BATTLE_ATLASES.find((definition) => definition.id === BATTLE_EFFECT_ATLAS_ID)

    expect(atlas?.data.meta.size).toEqual({ w: 384, h: 176 })
    expect(Object.keys(atlas?.data.frames || {})).toHaveLength(28)
    expect(atlas?.data.frames['shell/0']?.frame).toEqual({ x: 0, y: 0, w: 16, h: 8 })
    expect(atlas?.data.frames['explosion-heavy/5']?.frame).toEqual({
      x: 320,
      y: 112,
      w: 64,
      h: 64
    })
  })
})
