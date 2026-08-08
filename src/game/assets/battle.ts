import backgroundUrl from '@/assets/game/battle/rado-ruins-ogaby.png'
import dragonUrl from '@/assets/game/battle/dragon-oga.png'
import dreckoUrl from '@/assets/game/battle/drecko-oga.png'
import golemUrl from '@/assets/game/battle/golem-oga.png'
import leoganUrl from '@/assets/game/battle/leogan-oga.png'
import lepidopteramUrl from '@/assets/game/battle/lepidopteram-oga.png'
import smudgeUrl from '@/assets/game/battle/smudge2-oga.png'
import torpionUrl from '@/assets/game/battle/torpion-oga.png'
import tankUrl from '@/assets/game/battle/tank-cc0.png'
import effectsUrl from '@/assets/game/battle/effects-original.png'
import effectsData from '@/assets/game/battle/effects-original.json'
import type { AtlasDefinition, AtlasFrame, AtlasJson } from '@/game/engine/atlas'
import type { BattleEnvironment, BattleWeaponKind } from '@/game/types'

export type BattleEffectSpriteKind =
  'shell' | 'missile' | 'laser' | 'impact' | 'explosion-medium' | 'explosion-heavy'

export const BATTLE_EFFECT_ATLAS_ID = 'battle-effects-original'

const BATTLE_EFFECT_FRAME_COUNT: Record<BattleEffectSpriteKind, number> = {
  shell: 4,
  missile: 4,
  laser: 4,
  impact: 4,
  'explosion-medium': 6,
  'explosion-heavy': 6
}

export interface BattleSpriteAsset {
  atlas: string
  frame: string
  width: number
  height: number
  scale: number
}

export interface BattleEnvironmentContext {
  location: 'world' | 'town' | 'room' | 'cave'
  mapId: string
  tile?: string
  regionId?: string
  final?: boolean
}

export interface BattleEnvironmentStyle {
  skyTop: string
  skyBottom: string
  horizon: string
  ground: string
  groundDark: string
  accent: string
}

export interface BattleTankVisual {
  chassis: 'tracked' | 'wheeled' | 'box'
  turret: 'short' | 'scout' | 'medical' | 'long' | 'siege' | 'missile' | 'wolf' | 'rail'
  hullLength: number
  hullHeight: number
  runningGearHeight: number
  barrelLength: number
  scale: number
}

export interface BattleMobLayout {
  centerX: number
  footY: number
  impactX: number
  impactY: number
}

export interface BattleFighterLayout {
  centerX: number
  footY: number
  muzzleX: number
  muzzleY: number
  impactX: number
  impactY: number
}

export const BATTLE_ENVIRONMENT_STYLES: Record<BattleEnvironment, BattleEnvironmentStyle> = {
  field: {
    skyTop: '#172631',
    skyBottom: '#53604f',
    horizon: '#27362e',
    ground: '#554536',
    groundDark: '#27231f',
    accent: '#9eb36a'
  },
  forest: {
    skyTop: '#111d1b',
    skyBottom: '#34483a',
    horizon: '#182a22',
    ground: '#2b3528',
    groundDark: '#151b17',
    accent: '#8ca95a'
  },
  mountain: {
    skyTop: '#1b2834',
    skyBottom: '#77828a',
    horizon: '#4b5660',
    ground: '#55575a',
    groundDark: '#272b30',
    accent: '#d8ddd8'
  },
  town: {
    skyTop: '#351a16',
    skyBottom: '#8b5033',
    horizon: '#4b2b22',
    ground: '#49352e',
    groundDark: '#211817',
    accent: '#e09a53'
  },
  cave: {
    skyTop: '#10131c',
    skyBottom: '#24293a',
    horizon: '#171a25',
    ground: '#282735',
    groundDark: '#11121a',
    accent: '#65b8c4'
  },
  desert: {
    skyTop: '#49302a',
    skyBottom: '#bf7541',
    horizon: '#8e5734',
    ground: '#9c6d43',
    groundDark: '#473329',
    accent: '#f0c06a'
  },
  final: {
    skyTop: '#090c12',
    skyBottom: '#202532',
    horizon: '#11151d',
    ground: '#20252d',
    groundDark: '#090c11',
    accent: '#d84b45'
  }
}

const TANK_VISUALS: Record<string, BattleTankVisual> = {
  t1: {
    chassis: 'tracked',
    turret: 'short',
    hullLength: 102,
    hullHeight: 22,
    runningGearHeight: 21,
    barrelLength: 28,
    scale: 3
  },
  t2: {
    chassis: 'wheeled',
    turret: 'scout',
    hullLength: 94,
    hullHeight: 24,
    runningGearHeight: 19,
    barrelLength: 22,
    scale: 3
  },
  t3: {
    chassis: 'box',
    turret: 'medical',
    hullLength: 100,
    hullHeight: 31,
    runningGearHeight: 19,
    barrelLength: 18,
    scale: 3
  },
  t4: {
    chassis: 'tracked',
    turret: 'long',
    hullLength: 110,
    hullHeight: 23,
    runningGearHeight: 22,
    barrelLength: 39,
    scale: 3
  },
  t5: {
    chassis: 'tracked',
    turret: 'siege',
    hullLength: 116,
    hullHeight: 25,
    runningGearHeight: 24,
    barrelLength: 36,
    scale: 3
  },
  t6: {
    chassis: 'tracked',
    turret: 'missile',
    hullLength: 112,
    hullHeight: 27,
    runningGearHeight: 23,
    barrelLength: 24,
    scale: 3
  },
  t7: {
    chassis: 'tracked',
    turret: 'wolf',
    hullLength: 116,
    hullHeight: 23,
    runningGearHeight: 22,
    barrelLength: 43,
    scale: 3
  },
  t8: {
    chassis: 'tracked',
    turret: 'rail',
    hullLength: 120,
    hullHeight: 25,
    runningGearHeight: 23,
    barrelLength: 48,
    scale: 3
  }
}

export const BATTLE_EFFECT_DURATION: Record<BattleWeaponKind, number> = {
  human: 0.28,
  main: 0.48,
  sub: 0.36,
  se: 0.62,
  enemy: 0.34,
  item: 0.5
}

export function battleEffectFrame(kind: BattleEffectSpriteKind, progress: number): string {
  const normalized = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  const count = BATTLE_EFFECT_FRAME_COUNT[kind]
  return `${kind}/${Math.min(count - 1, Math.floor(normalized * count))}`
}

export function resolveBattleEnvironment(context: BattleEnvironmentContext): BattleEnvironment {
  if (context.final || context.mapId.startsWith('noa')) return 'final'
  if (context.location === 'town' || context.location === 'room') return 'town'
  if (context.regionId === 'desert' || context.tile === 's' || context.mapId === 'base8')
    return 'desert'
  if (context.location === 'cave') return 'cave'
  if (context.tile === 'f') return 'forest'
  if (context.tile === 'm') return 'mountain'
  return 'field'
}

export function battleTankVisualFor(tankId: string): BattleTankVisual {
  return TANK_VISUALS[tankId] || TANK_VISUALS.t1
}

export function battleMobLayout(index: number, count: number, size: number): BattleMobLayout {
  const row = Math.floor(index / 3)
  const rowStart = row * 3
  const inRow = Math.min(3, count - rowStart)
  const col = index - rowStart
  const centerX = inRow === 1 ? 468 : inRow === 2 ? 414 + col * 120 : 356 + col * 104
  const footY = (size > 1 && count === 1 ? 302 : 278) + row * 58
  return {
    centerX,
    footY,
    impactX: centerX,
    impactY: footY - (size > 1 ? 68 : 46)
  }
}

export function battleFighterLayout(index: number, tankId?: string): BattleFighterLayout {
  const centerX = 98
  const footY = 215 + index * 65
  if (!tankId) {
    return {
      centerX,
      footY,
      muzzleX: centerX + 48,
      muzzleY: footY - 31,
      impactX: centerX,
      impactY: footY - 27
    }
  }

  const visual = battleTankVisualFor(tankId)
  const turretWidth =
    visual.turret === 'siege'
      ? 52
      : visual.turret === 'rail'
        ? 48
        : visual.turret === 'scout'
          ? 36
          : visual.turret === 'medical'
            ? 42
            : 44
  const turretHeight =
    visual.turret === 'siege'
      ? 24
      : visual.turret === 'medical' || visual.turret === 'missile'
        ? 22
        : 19
  const hullBottomOffset = visual.chassis === 'tracked' ? 5 : 7
  const pivotY = footY - visual.runningGearHeight + hullBottomOffset - visual.hullHeight + 5
  return {
    centerX,
    footY,
    muzzleX: centerX + turretWidth / 2 + visual.barrelLength + 4,
    muzzleY: pivotY - Math.round(turretHeight * 0.58),
    impactX: centerX,
    impactY: footY - 34
  }
}

function fullFrame(width: number, height: number): AtlasFrame {
  return {
    frame: { x: 0, y: 0, w: width, h: height },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: width, h: height },
    sourceSize: { w: width, h: height },
    duration: 0
  }
}

function singleFrameAtlas(
  id: string,
  imageUrl: string,
  frame: string,
  width: number,
  height: number
): AtlasDefinition {
  const data: AtlasJson = {
    frames: { [frame]: fullFrame(width, height) },
    meta: { image: imageUrl, size: { w: width, h: height } }
  }
  return { id, imageUrl, data }
}

export const BATTLE_ATLASES: AtlasDefinition[] = [
  {
    id: BATTLE_EFFECT_ATLAS_ID,
    imageUrl: effectsUrl,
    data: effectsData as AtlasJson
  },
  singleFrameAtlas('battle-rado-ruins', backgroundUrl, 'scene', 640, 360),
  singleFrameAtlas('battle-dragon', dragonUrl, 'sprite', 112, 96),
  singleFrameAtlas('battle-drecko', dreckoUrl, 'sprite', 80, 48),
  singleFrameAtlas('battle-golem', golemUrl, 'sprite', 80, 96),
  singleFrameAtlas('battle-leogan', leoganUrl, 'sprite', 80, 48),
  singleFrameAtlas('battle-lepidopteram', lepidopteramUrl, 'sprite', 48, 64),
  singleFrameAtlas('battle-smudge', smudgeUrl, 'sprite', 48, 32),
  singleFrameAtlas('battle-torpion', torpionUrl, 'sprite', 64, 48),
  singleFrameAtlas('battle-tank', tankUrl, 'sprite', 45, 28)
]

export const BATTLE_BACKGROUND = { atlas: 'battle-rado-ruins', frame: 'scene' } as const

export const BATTLE_TANK_ASSET: BattleSpriteAsset = {
  atlas: 'battle-tank',
  frame: 'sprite',
  width: 45,
  height: 28,
  scale: 2
}

const ASSETS = {
  dragon: { atlas: 'battle-dragon', frame: 'sprite', width: 112, height: 96, scale: 1 },
  drecko: { atlas: 'battle-drecko', frame: 'sprite', width: 80, height: 48, scale: 1 },
  golem: { atlas: 'battle-golem', frame: 'sprite', width: 80, height: 96, scale: 1 },
  leogan: { atlas: 'battle-leogan', frame: 'sprite', width: 80, height: 48, scale: 1 },
  moth: { atlas: 'battle-lepidopteram', frame: 'sprite', width: 48, height: 64, scale: 1 },
  smudge: { atlas: 'battle-smudge', frame: 'sprite', width: 48, height: 32, scale: 2 },
  torpion: { atlas: 'battle-torpion', frame: 'sprite', width: 64, height: 48, scale: 1 },
  tank: { atlas: 'battle-tank', frame: 'sprite', width: 45, height: 28, scale: 2 }
} satisfies Record<string, BattleSpriteAsset>

const MOB_ASSET: Record<string, BattleSpriteAsset> = {
  rat: ASSETS.drecko,
  ant: ASSETS.torpion,
  dog: ASSETS.leogan,
  bug: ASSETS.torpion,
  scorp: ASSETS.torpion,
  giant_ant: ASSETS.torpion,
  spider: ASSETS.torpion,
  leech: ASSETS.smudge,
  beast: ASSETS.leogan,
  ironbug: ASSETS.torpion,
  robot: ASSETS.golem,
  turret: ASSETS.tank,
  mutwolf: ASSETS.leogan,
  mech_soldier: ASSETS.golem,
  tankbot: ASSETS.tank,
  killer: ASSETS.golem,
  armor: ASSETS.golem,
  giant: ASSETS.golem,
  biobeast: ASSETS.drecko,
  dragon: ASSETS.dragon,
  sandworm: ASSETS.smudge,
  vulture: ASSETS.moth,
  guard_bot: ASSETS.golem,
  laser: ASSETS.tank,
  noa_guard: ASSETS.golem,
  water: ASSETS.smudge,
  ghost: ASSETS.smudge,
  alien: ASSETS.torpion,
  bolt: ASSETS.tank,
  waroo: ASSETS.leogan,
  ark: ASSETS.drecko,
  puru: ASSETS.dragon
}

const TEMPLATE_ASSET: Record<string, BattleSpriteAsset> = {
  blob: ASSETS.smudge,
  bug: ASSETS.torpion,
  beast: ASSETS.leogan,
  bird: ASSETS.moth,
  bot: ASSETS.golem,
  tankbot: ASSETS.tank,
  worm: ASSETS.drecko,
  dragon: ASSETS.dragon
}

export function battleAssetForMob(id: string, template: string): BattleSpriteAsset | null {
  return MOB_ASSET[id] || TEMPLATE_ASSET[template] || null
}
