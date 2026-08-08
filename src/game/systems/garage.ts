import type { GameState, TankState } from '@/game/types'

export const GARAGE_ROOM_ID = 'rado_garage'
export const GARAGE_CAPACITY = 8

export function validGarageSlot(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < GARAGE_CAPACITY
}

export function garageTankAtSlot(state: Pick<GameState, 'tanks'>, slot: number): TankState | null {
  return state.tanks.find((tank) => tank.garageSlot === slot) || null
}

export function firstFreeGarageSlot(
  state: Pick<GameState, 'tanks'>,
  preferred?: number
): number | null {
  const used = new Set(state.tanks.map((tank) => tank.garageSlot).filter(validGarageSlot))
  if (validGarageSlot(preferred) && !used.has(preferred)) return preferred
  for (let slot = 0; slot < GARAGE_CAPACITY; slot++) if (!used.has(slot)) return slot
  return null
}

export function convoyTanks(state: Pick<GameState, 'party' | 'tanks' | 'hunt'>): TankState[] {
  const assigned = new Set(
    state.party
      .filter((member) => member.id && member.id !== state.hunt?.memberId)
      .map((member) => member.tankId)
      .filter((tankId): tankId is string => !!tankId)
  )
  return state.tanks.filter(
    (tank) =>
      tank.garageSlot === null && assigned.has(tank.tankId) && tank.tankId !== state.hunt?.tankId
  )
}

/**
 * Migrates old saves and repairs invalid/duplicate locations. Party assignments win;
 * every unassigned vehicle is then placed in one unique physical bay.
 */
export function normalizeGarageLocations(state: Pick<GameState, 'party' | 'tanks'>) {
  const assigned = new Set(
    state.party.map((member) => member.tankId).filter((tankId): tankId is string => !!tankId)
  )
  const used = new Set<number>()
  const pending: TankState[] = []

  for (const tank of state.tanks) {
    if (assigned.has(tank.tankId)) {
      tank.garageSlot = null
    } else if (validGarageSlot(tank.garageSlot) && !used.has(tank.garageSlot)) {
      used.add(tank.garageSlot)
    } else {
      pending.push(tank)
    }
  }

  for (const tank of pending) {
    let slot = 0
    while (slot < GARAGE_CAPACITY && used.has(slot)) slot++
    tank.garageSlot = slot < GARAGE_CAPACITY ? slot : null
    if (slot < GARAGE_CAPACITY) used.add(slot)
  }
}
