import { PARTS, TANKS } from '@/game/data/equipment'
import type { MaintenanceWorkItem, PartKind, TankPartCondition, TankState } from '@/game/types'
import {
  PART_CONDITION_LABELS,
  TANK_PART_LABELS,
  tankAmmoCapacity,
  tankPartCondition
} from '@/game/systems/tanks'

export interface MaintenanceTotals {
  cost: number
  minutes: number
  selected: number
}

export interface MaintenanceResult extends MaintenanceTotals {
  lines: string[]
}

export const ARMOR_PLATE_COST = 1
export const ARMOR_PACK_SIZE = 50
export const ARMOR_PACK_COST = ARMOR_PLATE_COST * ARMOR_PACK_SIZE

function partRepairCost(price: number, condition: TankPartCondition): number {
  if (condition === 'broken') return Math.max(200, Math.ceil(price * 0.2))
  return Math.max(80, Math.ceil(price * 0.08))
}

export function diagnoseTank(tank: TankState): MaintenanceWorkItem[] {
  const definition = TANKS.find((item) => item.id === tank.tankId)
  if (!definition) return []
  const items: MaintenanceWorkItem[] = []
  const missingSp = Math.max(0, definition.sp - tank.sp)
  if (missingSp > 0) {
    items.push({
      id: 'chassis',
      kind: 'chassis',
      label: '底盘修复',
      detail: `SP ${tank.sp}/${definition.sp}，修复 ${missingSp}`,
      cost: missingSp * 2,
      minutes: Math.max(5, Math.ceil(missingSp / 40) * 5),
      selected: true
    })
  }
  const missingArmor = Math.max(0, definition.armorCap - tank.armor)
  if (missingArmor > 0) {
    items.push({
      id: 'armor',
      kind: 'armor',
      label: '装甲片补给',
      detail: `装甲 ${tank.armor}/${definition.armorCap}，补充 ${missingArmor}`,
      cost: missingArmor * ARMOR_PLATE_COST,
      minutes: Math.max(5, Math.ceil(missingArmor / 100) * 5),
      selected: true
    })
  }
  for (const kind of ['main', 'sub', 'se', 'engine', 'c'] as PartKind[]) {
    const partId = tank.parts[kind]
    const condition = tankPartCondition(tank, kind)
    if (!partId || condition === 'normal') continue
    const part = PARTS[kind].find((candidate) => candidate.id === partId)
    items.push({
      id: `part:${kind}`,
      kind: 'part',
      partKind: kind,
      label: `${TANK_PART_LABELS[kind]}维修`,
      detail: `${part?.name || partId} · ${PART_CONDITION_LABELS[condition]}`,
      cost: partRepairCost(part?.price || 0, condition),
      minutes: condition === 'broken' ? 35 : 15,
      selected: true
    })
  }
  for (const kind of ['main', 'se'] as const) {
    const partId = tank.parts[kind]
    if (!partId) continue
    const part = PARTS[kind].find((candidate) => candidate.id === partId)
    const capacity = tankAmmoCapacity(tank, kind)
    const missing = Math.max(0, capacity - tank.ammo[kind])
    if (!part || missing <= 0) continue
    items.push({
      id: `ammo:${kind}`,
      kind: 'ammo',
      ammoKind: kind,
      label: `${TANK_PART_LABELS[kind]}弹药`,
      detail: `${tank.ammo[kind]}/${capacity} 发，补充 ${missing} 发`,
      cost: missing * (part.ammoPrice || 1),
      minutes: Math.max(5, Math.ceil(missing / 4) * 5),
      selected: true
    })
  }
  return items
}

export function maintenanceTotals(items: MaintenanceWorkItem[]): MaintenanceTotals {
  return items.reduce<MaintenanceTotals>(
    (totals, item) => {
      if (!item.selected) return totals
      totals.cost += item.cost
      totals.minutes += item.minutes
      totals.selected++
      return totals
    },
    { cost: 0, minutes: 0, selected: 0 }
  )
}

export function executeMaintenance(
  tank: TankState,
  items: MaintenanceWorkItem[]
): MaintenanceResult {
  const definition = TANKS.find((item) => item.id === tank.tankId)
  const totals = maintenanceTotals(items)
  const lines: string[] = []
  if (!definition) return { ...totals, lines }
  for (const item of items) {
    if (!item.selected) continue
    if (item.kind === 'chassis') tank.sp = definition.sp
    else if (item.kind === 'armor') tank.armor = definition.armorCap
    else if (item.kind === 'part' && item.partKind) tank.condition[item.partKind] = 'normal'
    else if (item.kind === 'ammo' && item.ammoKind) {
      tank.ammo[item.ammoKind] = tankAmmoCapacity(tank, item.ammoKind)
    }
    lines.push(`${item.label}完成`)
  }
  return { ...totals, lines }
}

export function maintenanceTimeLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}
