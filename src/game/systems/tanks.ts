import { PARTS, TANKS } from '@/game/data/equipment'
import type { LimitedTankWeapon, PartKind, TankPartCondition, TankState } from '@/game/types'

export const TANK_PART_LABELS: Record<PartKind, string> = {
  main: '主炮',
  sub: '副炮',
  se: 'S-E',
  engine: '发动机',
  c: 'C装置'
}

export const PART_CONDITION_LABELS: Record<TankPartCondition, string> = {
  normal: '正常',
  damaged: '小破',
  broken: '大破'
}

const VALID_CONDITIONS: readonly TankPartCondition[] = ['normal', 'damaged', 'broken']

export function tankAmmoCapacity(tank: Pick<TankState, 'parts'>, kind: LimitedTankWeapon): number {
  const partId = tank.parts[kind]
  return partId ? PARTS[kind].find((part) => part.id === partId)?.ammo || 0 : 0
}

export function tankPartCondition(tank: TankState, kind: PartKind): TankPartCondition {
  return tank.condition?.[kind] || 'normal'
}

export function tankPartWorks(tank: TankState, kind: PartKind): boolean {
  return !!tank.parts[kind] && tankPartCondition(tank, kind) !== 'broken'
}

export function tankOperational(tank: TankState): boolean {
  return tank.sp > 0 && tankPartWorks(tank, 'engine') && tankPartWorks(tank, 'c')
}

export function tankLoadValue(tank: TankState): number {
  let weight = 0
  for (const kind of ['main', 'sub', 'se', 'c'] as PartKind[]) {
    const partId = tank.parts[kind]
    if (!partId) continue
    const part = PARTS[kind].find((item) => item.id === partId)
    if (part) weight += part.w
  }
  return weight + tank.armor * 0.004
}

export function tankLoadCapacity(tank: TankState): number {
  return PARTS.engine.find((engine) => engine.id === tank.parts.engine)?.load || 0
}

export function tankOverCapacity(tank: TankState): boolean {
  return tankLoadValue(tank) > tankLoadCapacity(tank)
}

export function normalizeTankRuntime(value: TankState): TankState {
  const definition = TANKS.find((tank) => tank.id === value.tankId)
  if (!definition) return value
  const sourceParts =
    value.parts && typeof value.parts === 'object' ? value.parts : definition.parts
  const partFor = (kind: PartKind) =>
    Object.prototype.hasOwnProperty.call(sourceParts, kind)
      ? sourceParts[kind]
      : definition.parts[kind]
  value.parts = {
    main: partFor('main'),
    sub: partFor('sub'),
    se: partFor('se'),
    engine: partFor('engine'),
    c: partFor('c')
  }
  const rawCondition = value.condition as Partial<Record<PartKind, TankPartCondition>> | undefined
  value.condition = Object.fromEntries(
    (['main', 'sub', 'se', 'engine', 'c'] as PartKind[]).map((kind) => {
      const condition = rawCondition?.[kind]
      return [
        kind,
        VALID_CONDITIONS.includes(condition as TankPartCondition) ? condition : 'normal'
      ]
    })
  ) as Record<PartKind, TankPartCondition>
  const rawAmmo = value.ammo as Partial<Record<LimitedTankWeapon, number>> | undefined
  const mainCapacity = tankAmmoCapacity(value, 'main')
  const seCapacity = tankAmmoCapacity(value, 'se')
  value.ammo = {
    main: Number.isFinite(rawAmmo?.main)
      ? Math.max(0, Math.min(mainCapacity, Math.floor(rawAmmo!.main!)))
      : mainCapacity,
    se: Number.isFinite(rawAmmo?.se)
      ? Math.max(0, Math.min(seCapacity, Math.floor(rawAmmo!.se!)))
      : seCapacity
  }
  value.armor = Math.max(0, Math.min(definition.armorCap, Number(value.armor) || 0))
  value.sp = Math.max(0, Math.min(definition.sp, Number(value.sp) || 0))
  return value
}

export function createTankRuntime(tankId: string): TankState {
  const definition = TANKS.find((tank) => tank.id === tankId)
  if (!definition) throw new Error(`Unknown tank: ${tankId}`)
  const tank: TankState = {
    tankId,
    garageSlot: null,
    armor: Math.min(100, definition.armorCap),
    sp: definition.sp,
    parts: { ...definition.parts },
    ammo: { main: 0, se: 0 },
    condition: { main: 'normal', sub: 'normal', se: 'normal', engine: 'normal', c: 'normal' }
  }
  tank.ammo.main = tankAmmoCapacity(tank, 'main')
  tank.ammo.se = tankAmmoCapacity(tank, 'se')
  return normalizeTankRuntime(tank)
}
