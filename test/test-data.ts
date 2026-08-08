/* 供测试引用的数据聚合 */

export * from '../src/game/data/sprites'
export * from '../src/game/data/maps'
export * from '../src/game/data/combat'
export * from '../src/game/data/equipment'
export * from '../src/game/data/story'
export * from '../src/game/data/events'

import { SPR, ETPL, TTPL } from '../src/game/data/sprites'
import { WORLD, TOWNS, CAVES, ROOMS } from '../src/game/data/maps'
import { MONSTERS, REGIONS, BOUNTIES } from '../src/game/data/combat'
import { HUMAN_WEAPONS, TANKS, ITEMS, SHOPS, allParts } from '../src/game/data/equipment'
import { DIALOGUE, PASSWORDS } from '../src/game/data/story'
import { EVENTS } from '../src/game/data/events'

export const DATA = {
  SPR,
  ETPL,
  TTPL,
  WORLD,
  TOWNS,
  CAVES,
  ROOMS,
  MONSTERS,
  REGIONS,
  BOUNTIES,
  TANKS,
  ITEMS,
  HUMAN_WEAPONS,
  SHOPS,
  DIALOGUE,
  EVENTS,
  PASSWORDS,
  allParts
}
