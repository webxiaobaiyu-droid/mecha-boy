import { describe, expect, it } from 'vitest'
import {
  overworldTankSignature,
  overworldTankVisualFor,
  tankAimAngle,
  tankConditionFor,
  tankFacingAngle
} from '@/game/assets/tanks'

describe('战车探索视觉契约', () => {
  it('八辆战车拥有不同的俯视底盘与炮塔签名', () => {
    const ids = Array.from({ length: 8 }, (_, index) => `t${index + 1}`)
    const signatures = ids.map(overworldTankSignature)

    expect(new Set(signatures).size).toBe(ids.length)
    expect(ids.map((id) => overworldTankVisualFor(id).mount)).toEqual([
      'standard',
      'scout',
      'medical',
      'long',
      'siege',
      'missile',
      'wolf',
      'rail'
    ])
  })

  it('上下左右使用四个明确且互不相同的正交角度', () => {
    const angles = [0, 1, 2, 3].map(tankFacingAngle)
    expect(angles).toEqual([0, Math.PI, -Math.PI / 2, Math.PI / 2])
    expect(new Set(angles).size).toBe(4)
  })

  it('SP 比例稳定映射为完好、受损、危急和瘫痪状态', () => {
    expect(tankConditionFor(100, 100)).toBe('healthy')
    expect(tankConditionFor(60, 100)).toBe('damaged')
    expect(tankConditionFor(25, 100)).toBe('critical')
    expect(tankConditionFor(0, 100)).toBe('disabled')
  })

  it('炮塔瞄准角随目标高低变化，并限制在侧视可读范围', () => {
    expect(tankAimAngle(0, 0, 100, -10)).toBeLessThan(0)
    expect(tankAimAngle(0, 0, 100, 10)).toBeGreaterThan(0)
    expect(tankAimAngle(0, 0, 1, -100)).toBe(-0.28)
    expect(tankAimAngle(0, 0, 1, 100)).toBe(0.28)
  })
})
