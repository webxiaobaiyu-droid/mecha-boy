/* 初始游戏状态工厂 */

import type { GameState, PartyMember, PartKind, TankState } from '@/game/types'
import { DEFAULT_HUMAN_WEAPON } from '@/game/data/equipment'
import { GROWTH } from '@/game/data/story'
import { createWorldEnvironment } from '@/game/systems/environment'
import { createTankRuntime } from '@/game/systems/tanks'
import { createWorldMapProgress } from '@/game/systems/world-map'

export function makeMember(id: string | null, name: string, cls: PartyMember['cls']): PartyMember {
  const b = GROWTH[cls].base
  return {
    id,
    name,
    cls,
    lv: 1,
    hp: b.hp,
    maxHp: b.hp,
    atk: b.atk,
    def: b.def,
    spd: b.spd,
    xp: 0,
    weaponId: DEFAULT_HUMAN_WEAPON[cls],
    tankId: null
  }
}

export function makeTank(tankId: string): TankState {
  return createTankRuntime(tankId)
}

export function createInitialState(): GameState {
  return {
    screen: 'title',
    map: 'world',
    px: 24,
    py: 59,
    facing: 0,
    anim: null,
    riding: false,
    inTown: null,
    base: null,
    party: [
      makeMember('hero', '阿雷', 'hero'),
      makeMember(null, '美娜', 'mecha'),
      makeMember(null, '红狼', 'wolf')
    ],
    gold: 300,
    inventory: { items: { med: 3, smoke: 1 }, parts: {}, weapons: {} },
    tanks: [],
    bounties: { killed: {}, claimed: {} },
    openedChests: {},
    flags: {},
    playtime: 0,
    environment: createWorldEnvironment(),
    worldMap: createWorldMapProgress([24, 59]),
    dialog: null,
    sleep: null,
    bannerText: '',
    bannerT: 0,
    menu: null,
    shop: null,
    pass: null,
    ending: null,
    intro: { idx: 0, t: 0 },
    titleMenu: 0,
    titleT: 0,
    jukebox: false,
    creditsOpen: false,
    jukeIdx: 0,
    goT: 0,
    battle: null,
    hunt: null
  }
}

export const PART_SLOTS: PartKind[] = ['main', 'sub', 'se', 'engine', 'c']
export const PART_SLOT_NAMES: Record<PartKind, string> = {
  main: '主炮',
  sub: '副炮',
  se: 'S-E',
  engine: '发动机',
  c: 'C装置'
}
