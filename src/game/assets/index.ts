import actorsUrl from '@/assets/game/actors-common.png'
import actorsData from '@/assets/game/actors-common.json'
import radoInteriorsUrl from '@/assets/game/third-party/pixel-art-wasteland/tileset8sorted.png'
import type { AtlasDefinition, AtlasJson } from '@/game/engine/atlas'
import { atlasRegistry } from '@/game/engine/atlas'
import { BATTLE_ATLASES } from '@/game/assets/battle'

function atlasFrame(x: number, y: number, w: number, h: number) {
  return {
    frame: { x, y, w, h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w, h },
    sourceSize: { w, h },
    duration: 0
  }
}

const radoInteriorsData: AtlasJson = {
  frames: {
    'cabinet/drawers': atlasFrame(0, 0, 8, 8),
    'cabinet/books': atlasFrame(8, 0, 8, 8),
    'cabinet/basin': atlasFrame(16, 0, 8, 8),
    'cabinet/tools': atlasFrame(32, 0, 8, 8),
    'cabinet/plain': atlasFrame(40, 0, 8, 8),
    'cabinet/light': atlasFrame(56, 0, 8, 8),
    'prop/plant-red': atlasFrame(72, 0, 16, 8),
    'prop/plant': atlasFrame(88, 0, 8, 8),
    'prop/crate': atlasFrame(0, 8, 8, 8),
    'prop/stove': atlasFrame(8, 8, 8, 8),
    'prop/fireplace': atlasFrame(16, 8, 8, 8),
    'prop/bin': atlasFrame(24, 8, 8, 8),
    'prop/barrel': atlasFrame(32, 8, 8, 8),
    'prop/plant-pot': atlasFrame(40, 8, 8, 8),
    'prop/plant-flower': atlasFrame(48, 8, 8, 8),
    'prop/bench': atlasFrame(56, 8, 16, 8),
    'prop/sofa': atlasFrame(72, 8, 16, 8),
    'prop/fridge-top': atlasFrame(120, 0, 8, 8),
    'prop/fridge-bottom': atlasFrame(120, 8, 8, 8),
    'counter/top-left': atlasFrame(0, 16, 8, 8),
    'counter/top-mid': atlasFrame(8, 16, 8, 8),
    'counter/top-right': atlasFrame(16, 16, 8, 8),
    'counter/bottom-left': atlasFrame(0, 24, 8, 8),
    'counter/bottom-mid': atlasFrame(8, 24, 8, 8),
    'counter/bottom-right': atlasFrame(16, 24, 8, 8),
    'table/top-left': atlasFrame(32, 16, 8, 8),
    'table/top-mid': atlasFrame(40, 16, 8, 8),
    'table/top-right': atlasFrame(48, 16, 8, 8),
    'table/bottom-left': atlasFrame(32, 24, 8, 8),
    'table/bottom-mid': atlasFrame(40, 24, 8, 8),
    'table/bottom-right': atlasFrame(48, 24, 8, 8),
    'bed/top': atlasFrame(88, 16, 8, 8),
    'bed/bottom': atlasFrame(88, 24, 8, 8),
    'floor/wood': atlasFrame(0, 96, 8, 8),
    'floor/carpet': atlasFrame(0, 104, 8, 8),
    'floor/metal': atlasFrame(0, 112, 8, 8),
    'floor/stone': atlasFrame(8, 120, 8, 8)
  },
  meta: { image: 'tileset8sorted.png', size: { w: 128, h: 128 } }
}

export const GAME_ATLASES: AtlasDefinition[] = [
  { id: 'actors-common', imageUrl: actorsUrl, data: actorsData as AtlasJson },
  { id: 'rado-interiors', imageUrl: radoInteriorsUrl, data: radoInteriorsData },
  ...BATTLE_ATLASES
]

export const ACTOR_ASSETS: Record<
  string,
  { atlas: string; sprite: string; anchor: [number, number] }
> = {
  hero: { atlas: 'actors-common', sprite: 'hero', anchor: [8, 24] },
  father: { atlas: 'actors-common', sprite: 'father', anchor: [8, 24] },
  shopkeep: { atlas: 'actors-common', sprite: 'shopkeep', anchor: [8, 24] },
  npc_m: { atlas: 'actors-common', sprite: 'npc_m', anchor: [8, 24] },
  npc_w: { atlas: 'actors-common', sprite: 'npc_w', anchor: [8, 24] },
  npc_old: { atlas: 'actors-common', sprite: 'npc_old', anchor: [8, 24] },
  kid: { atlas: 'actors-common', sprite: 'kid', anchor: [8, 24] }
}

export function preloadGameAssets() {
  return atlasRegistry.preload(GAME_ATLASES)
}
