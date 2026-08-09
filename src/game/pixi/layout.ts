export const BATTLE_VIEW_WIDTH = 1280
export const BATTLE_VIEW_HEIGHT = 720

export interface BattleViewportLayout {
  portrait: boolean
  scale: number
  visibleVirtualWidth: number
  visibleVirtualHeight: number
}

export function battleViewportLayout(width: number, height: number): BattleViewportLayout {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const portrait = safeWidth / safeHeight < 1.45
  const scale = portrait
    ? Math.max(safeWidth / BATTLE_VIEW_WIDTH, safeHeight / BATTLE_VIEW_HEIGHT)
    : Math.min(safeWidth / BATTLE_VIEW_WIDTH, safeHeight / BATTLE_VIEW_HEIGHT)
  return {
    portrait,
    scale,
    visibleVirtualWidth: safeWidth / scale,
    visibleVirtualHeight: safeHeight / scale
  }
}

export function battleFighterAnchor(portrait: boolean, index: number) {
  return {
    x: portrait ? 490 + index * 10 : 86 + index * 6,
    y: portrait ? 300 + index * 132 : 300 + index * 148
  }
}

export function battleMobAnchor(portrait: boolean, index: number, count: number) {
  const columns = Math.min(3, count)
  const column = index % columns
  const row = Math.floor(index / columns)
  return {
    x: portrait
      ? count === 1
        ? 720
        : 620 + column * 100
      : count === 1
        ? 1162
        : 930 + column * 150,
    y: portrait ? 330 + row * 122 : 344 + row * 126
  }
}

export type ExplorationMapKind = 'world' | 'town' | 'cave' | 'room'

export interface ExplorationTileLayoutInput {
  viewportWidth: number
  viewportHeight: number
  mapWidth: number
  mapHeight: number
  kind: ExplorationMapKind
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function explorationTileSize(input: ExplorationTileLayoutInput): number {
  const width = Math.max(1, input.viewportWidth)
  const height = Math.max(1, input.viewportHeight)
  const narrow = width < 720
  if (input.kind === 'world') {
    return narrow ? clamp(Math.floor(width / 14), 22, 32) : 32
  }
  if (input.kind === 'room') {
    const fittedWidth = Math.floor(width / (input.mapWidth + 2))
    const fittedHeight = Math.ceil(height / input.mapHeight)
    return clamp(Math.max(fittedWidth, fittedHeight), narrow ? 24 : 32, 56)
  }
  if (input.kind === 'cave') {
    const fittedHeight = Math.ceil(height / input.mapHeight)
    return clamp(Math.max(narrow ? 28 : 36, fittedHeight), narrow ? 28 : 36, 56)
  }
  const fittedHeight = Math.ceil(height / input.mapHeight)
  return clamp(Math.max(narrow ? 28 : 34, fittedHeight), narrow ? 28 : 48, 56)
}
