import { CAVES, ROOMS, TOWNS, WORLD } from '@/game/data/maps'

export type ExplorationScreen = 'world' | 'town' | 'cave' | 'room'

export interface ExplorationAudioContext {
  screen: ExplorationScreen
  map: string
  px: number
  py: number
}

export function townTrackFor(townId: string): string {
  return TOWNS.find((town) => town.id === townId)?.music || 'town'
}

export function worldTrackForPosition(x: number, y: number): string {
  return WORLD[y]?.[x] === 's' ? 'desert' : 'field'
}

export function explorationTrackFor(context: ExplorationAudioContext): string {
  if (context.screen === 'world' || context.map === 'world') {
    return worldTrackForPosition(context.px, context.py)
  }

  const town = TOWNS.find((item) => item.id === context.map)
  if (town) return town.music || 'town'

  const room = ROOMS.find((item) => item.id === context.map)
  if (room) return townTrackFor(room.town)

  if (CAVES.some((item) => item.id === context.map)) return 'cave'
  return 'field'
}
