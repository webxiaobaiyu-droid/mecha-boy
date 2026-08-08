import { MONSTERS, REGIONS } from '@/game/data/combat'
import type { GameState, HuntTask, PartyMember, RegionDef, TankState } from '@/game/types'
import { tankOperational } from '@/game/systems/tanks'

export const HUNT_DURATIONS = [60, 120, 240] as const

export interface HuntPreview {
  region: RegionDef
  member: PartyMember | null
  tank: TankState | null
  durationMinutes: number
  xp: number
  gold: number
  armorCost: number
  mainAmmoCost: number
  seAmmoCost: number
  riskLabel: string
  canStart: boolean
  reason: string
}

export function absoluteWorldMinute(state: Pick<GameState, 'environment'>): number {
  return (state.environment.day - 1) * 24 * 60 + state.environment.minute
}

function huntCandidates(state: GameState): Array<{ member: PartyMember; tank: TankState | null }> {
  return state.party
    .slice(1)
    .filter((member) => member.id && member.id !== state.hunt?.memberId)
    .map((member) => {
      const tank = member.tankId
        ? state.tanks.find((candidate) => candidate.tankId === member.tankId) || null
        : null
      return { member, tank: tank && tankOperational(tank) ? tank : null }
    })
}

function hunterForRegion(
  state: GameState,
  region: RegionDef
): { member: PartyMember; tank: TankState | null } | null {
  const candidates = huntCandidates(state)
    .filter(({ member, tank }) => {
      if (tank) return member.lv + 4 >= region.recommendedLevel[1]
      return !!region.safeZone && member.lv >= region.recommendedLevel[0]
    })
    .sort((left, right) => {
      if (!!left.tank !== !!right.tank) return left.tank ? -1 : 1
      return left.member.lv - right.member.lv
    })
  return candidates[0] || null
}

export function availableHuntRegions(state: GameState): RegionDef[] {
  return REGIONS.filter(
    (region) =>
      !!state.flags[`region_${region.id}`] &&
      region.id !== 'noa' &&
      !!hunterForRegion(state, region)
  )
}

export function previewHunt(
  state: GameState,
  regionId: string,
  durationMinutes: number
): HuntPreview | null {
  const region = REGIONS.find((candidate) => candidate.id === regionId)
  if (!region) return null
  const assignment = hunterForRegion(state, region)
  const duration = HUNT_DURATIONS.includes(durationMinutes as (typeof HUNT_DURATIONS)[number])
    ? durationMinutes
    : HUNT_DURATIONS[0]
  const hours = duration / 60
  const monsters = region.mobs.map((id) => MONSTERS[id]).filter(Boolean)
  const averageXp = monsters.reduce((sum, monster) => sum + monster.xp, 0) / monsters.length || 0
  const averageGold = monsters.reduce((sum, monster) => sum + monster.g, 0) / monsters.length || 0
  const encounters = hours * (2 + region.dangerLevel)
  const tankFactor = assignment?.tank ? 1 : 0.62
  const xp = Math.max(0, Math.round(averageXp * encounters * 0.72 * tankFactor))
  const gold = Math.max(0, Math.round(averageGold * encounters * 0.64 * tankFactor))
  const armorCost = assignment?.tank ? Math.ceil(hours * region.dangerLevel * 8) : 0
  const mainAmmoCost = assignment?.tank && region.dangerLevel >= 2 ? Math.ceil(hours) : 0
  const seAmmoCost = assignment?.tank && region.dangerLevel >= 4 ? Math.ceil(hours / 2) : 0
  let reason = ''
  if (!state.flags[`region_${region.id}`]) reason = '该区域尚未完成实地探索。'
  else if (!assignment) reason = '没有能力足够且处于空闲状态的非队长成员。'
  else if (assignment.tank) {
    const reserve = Math.ceil(assignment.tank.armor * 0.2)
    if (assignment.tank.armor - armorCost < reserve) reason = '装甲余量不足以满足安全返航线。'
    else if (assignment.tank.ammo.main < mainAmmoCost) reason = '主炮弹药不足。'
    else if (assignment.tank.ammo.se < seAmmoCost) reason = 'S-E 弹药不足。'
  }
  return {
    region,
    member: assignment?.member || null,
    tank: assignment?.tank || null,
    durationMinutes: duration,
    xp,
    gold,
    armorCost,
    mainAmmoCost,
    seAmmoCost,
    riskLabel: assignment?.tank ? '受控' : '低风险徒步',
    canStart: !!assignment && !reason,
    reason
  }
}

export function createHuntTask(state: GameState, preview: HuntPreview, serial: number): HuntTask {
  if (!preview.member || !preview.canStart) throw new Error('Hunt preview is not dispatchable')
  const startedAt = absoluteWorldMinute(state)
  return {
    id: `hunt-${serial}-${Math.floor(startedAt)}`,
    regionId: preview.region.id,
    memberId: preview.member.id!,
    tankId: preview.tank?.tankId || null,
    startedAt,
    endsAt: startedAt + preview.durationMinutes,
    durationMinutes: preview.durationMinutes,
    xp: preview.xp,
    gold: preview.gold,
    armorCost: preview.armorCost,
    mainAmmoCost: preview.mainAmmoCost,
    seAmmoCost: preview.seAmmoCost,
    claimed: false
  }
}

export function huntRemainingMinutes(state: GameState): number {
  if (!state.hunt) return 0
  return Math.max(0, Math.ceil(state.hunt.endsAt - absoluteWorldMinute(state)))
}

export function normalizeHuntTask(value: unknown, state: GameState): HuntTask | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const task = value as Partial<HuntTask>
  if (
    typeof task.id !== 'string' ||
    typeof task.regionId !== 'string' ||
    !REGIONS.some((region) => region.id === task.regionId) ||
    typeof task.memberId !== 'string' ||
    !state.party.some((member) => member.id === task.memberId) ||
    !Number.isFinite(task.startedAt) ||
    !Number.isFinite(task.endsAt)
  ) {
    return null
  }
  const tankId =
    typeof task.tankId === 'string' && state.tanks.some((tank) => tank.tankId === task.tankId)
      ? task.tankId
      : null
  return {
    id: task.id,
    regionId: task.regionId,
    memberId: task.memberId,
    tankId,
    startedAt: task.startedAt!,
    endsAt: Math.max(task.startedAt!, task.endsAt!),
    durationMinutes: Math.max(1, Number(task.durationMinutes) || 60),
    xp: Math.max(0, Math.floor(Number(task.xp) || 0)),
    gold: Math.max(0, Math.floor(Number(task.gold) || 0)),
    armorCost: Math.max(0, Math.floor(Number(task.armorCost) || 0)),
    mainAmmoCost: Math.max(0, Math.floor(Number(task.mainAmmoCost) || 0)),
    seAmmoCost: Math.max(0, Math.floor(Number(task.seAmmoCost) || 0)),
    claimed: !!task.claimed
  }
}
