import { describe, expect, it } from 'vitest'
import { makeMember } from '@/game/core/state'
import { GROWTH } from '@/game/data/story'
import { recruitLevelFor, recruitWithCatchUp } from '@/game/systems/growth'

describe('新队友成长衔接', () => {
  it('美娜至少以 Lv.2 加入，并保持在主角一级以内', () => {
    const hero = makeMember('hero', '阿雷', 'hero')
    const mecha = makeMember(null, '美娜', 'mecha')
    hero.lv = 3
    expect(recruitLevelFor(mecha, [hero, mecha])).toBe(2)

    hero.lv = 8
    expect(recruitLevelFor(mecha, [hero, mecha])).toBe(7)
  })

  it('红狼达到湖区最低等级，并能追平更高等级的主角', () => {
    const hero = makeMember('hero', '阿雷', 'hero')
    const wolf = makeMember(null, '红狼', 'wolf')
    expect(recruitLevelFor(wolf, [hero, wolf])).toBe(5)

    hero.lv = 9
    expect(recruitLevelFor(wolf, [hero, wolf])).toBe(9)
  })

  it('加入时按目标等级重建属性并恢复满血', () => {
    const hero = makeMember('hero', '阿雷', 'hero')
    const mecha = makeMember(null, '美娜', 'mecha')
    hero.lv = 6
    mecha.hp = 1

    const level = recruitWithCatchUp(mecha, [hero, mecha])
    const growth = GROWTH.mecha
    expect(level).toBe(5)
    expect(mecha).toMatchObject({
      id: 'mecha',
      lv: 5,
      hp: growth.base.hp + growth.up.hp * 4,
      maxHp: growth.base.hp + growth.up.hp * 4,
      atk: growth.base.atk + growth.up.atk * 4,
      def: growth.base.def + growth.up.def * 4,
      spd: growth.base.spd + growth.up.spd * 4,
      xp: 0
    })
  })
})
