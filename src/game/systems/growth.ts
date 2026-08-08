import { GROWTH } from '@/game/data/story'
import type { MemberClass, PartyMember } from '@/game/types'

const RECRUIT_LEVEL_FLOOR: Partial<Record<MemberClass, number>> = {
  mecha: 2,
  wolf: 5
}

export function recruitLevelFor(member: PartyMember, party: PartyMember[]): number {
  const highestActiveLevel = Math.max(
    1,
    ...party
      .filter((candidate) => candidate !== member && candidate.id)
      .map((candidate) => candidate.lv)
  )
  const catchUpLevel = member.cls === 'mecha' ? highestActiveLevel - 1 : highestActiveLevel
  return Math.max(member.lv, RECRUIT_LEVEL_FLOOR[member.cls] || 1, catchUpLevel)
}

export function recruitWithCatchUp(member: PartyMember, party: PartyMember[]): number {
  const level = recruitLevelFor(member, party)
  const growth = GROWTH[member.cls]
  member.id = member.cls
  member.lv = level
  member.maxHp = growth.base.hp + growth.up.hp * (level - 1)
  member.hp = member.maxHp
  member.atk = growth.base.atk + growth.up.atk * (level - 1)
  member.def = growth.base.def + growth.up.def * (level - 1)
  member.spd = growth.base.spd + growth.up.spd * (level - 1)
  member.xp = 0
  return level
}
