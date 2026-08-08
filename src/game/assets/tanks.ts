export type TankCondition = 'healthy' | 'damaged' | 'critical' | 'disabled'

export type TankChassis = 'tracked' | 'wheeled' | 'box'
export type TankMount =
  'standard' | 'scout' | 'medical' | 'long' | 'siege' | 'missile' | 'wolf' | 'rail'

export interface OverworldTankVisual {
  chassis: TankChassis
  mount: TankMount
  bodyWidth: number
  bodyLength: number
  trackWidth: number
  turretWidth: number
  turretLength: number
  barrelLength: number
  deckOffset: number
}

const OVERWORLD_TANK_VISUALS: Record<string, OverworldTankVisual> = {
  t1: {
    chassis: 'tracked',
    mount: 'standard',
    bodyWidth: 16,
    bodyLength: 24,
    trackWidth: 4,
    turretWidth: 10,
    turretLength: 10,
    barrelLength: 6,
    deckOffset: 1
  },
  t2: {
    chassis: 'wheeled',
    mount: 'scout',
    bodyWidth: 14,
    bodyLength: 22,
    trackWidth: 4,
    turretWidth: 8,
    turretLength: 8,
    barrelLength: 5,
    deckOffset: 2
  },
  t3: {
    chassis: 'box',
    mount: 'medical',
    bodyWidth: 18,
    bodyLength: 26,
    trackWidth: 4,
    turretWidth: 12,
    turretLength: 12,
    barrelLength: 4,
    deckOffset: 3
  },
  t4: {
    chassis: 'tracked',
    mount: 'long',
    bodyWidth: 18,
    bodyLength: 26,
    trackWidth: 4,
    turretWidth: 12,
    turretLength: 10,
    barrelLength: 10,
    deckOffset: 2
  },
  t5: {
    chassis: 'tracked',
    mount: 'siege',
    bodyWidth: 20,
    bodyLength: 26,
    trackWidth: 5,
    turretWidth: 14,
    turretLength: 12,
    barrelLength: 8,
    deckOffset: 3
  },
  t6: {
    chassis: 'tracked',
    mount: 'missile',
    bodyWidth: 18,
    bodyLength: 24,
    trackWidth: 5,
    turretWidth: 14,
    turretLength: 12,
    barrelLength: 3,
    deckOffset: 2
  },
  t7: {
    chassis: 'tracked',
    mount: 'wolf',
    bodyWidth: 18,
    bodyLength: 28,
    trackWidth: 4,
    turretWidth: 12,
    turretLength: 12,
    barrelLength: 11,
    deckOffset: 0
  },
  t8: {
    chassis: 'tracked',
    mount: 'rail',
    bodyWidth: 20,
    bodyLength: 28,
    trackWidth: 4,
    turretWidth: 14,
    turretLength: 12,
    barrelLength: 12,
    deckOffset: 1
  }
}

export function overworldTankVisualFor(tankId: string): OverworldTankVisual {
  return OVERWORLD_TANK_VISUALS[tankId] || OVERWORLD_TANK_VISUALS.t1
}

export function tankFacingAngle(facing: number): number {
  return [0, Math.PI, -Math.PI / 2, Math.PI / 2][facing] ?? 0
}

export function tankAimAngle(fromX: number, fromY: number, toX: number, toY: number): number {
  const angle = Math.atan2(toY - fromY, toX - fromX)
  return Math.max(-0.28, Math.min(0.28, angle))
}

export function tankConditionFor(sp: number, maxSp: number): TankCondition {
  if (sp <= 0) return 'disabled'
  const ratio = sp / Math.max(1, maxSp)
  if (ratio <= 0.25) return 'critical'
  if (ratio <= 0.6) return 'damaged'
  return 'healthy'
}

export function overworldTankSignature(tankId: string): string {
  const visual = overworldTankVisualFor(tankId)
  return [
    visual.chassis,
    visual.mount,
    visual.bodyWidth,
    visual.bodyLength,
    visual.trackWidth,
    visual.turretWidth,
    visual.turretLength,
    visual.barrelLength,
    visual.deckOffset
  ].join(':')
}
