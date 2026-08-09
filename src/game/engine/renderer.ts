/* Legacy Canvas 离线预览渲染器。
   正式游戏循环使用 src/game/pixi；此模块仅保留 PNG 预览与旧视觉契约测试。 */

import { PAL, SPR, ETPL, TTPL } from '@/game/data/sprites'
import { WORLD, WORLD_W, WORLD_H, TOWNS, CAVES, ROOMS } from '@/game/data/maps'
import type {
  BattleEffect,
  BattleEnvironment,
  BattleMob,
  GameState,
  RoomDef,
  TankState
} from '@/game/types'
import {
  TS as ART_TILE_SIZE,
  hash,
  neighbors,
  drawWorldTile,
  drawTownTile,
  drawCaveTile,
  drawRoomTile,
  drawBuilding,
  drawDecor,
  drawFurniture,
  drawGarageBay,
  townDecor,
  DECOR_BLOCK
} from '@/game/engine/tileart'
import { TANKS as TANKS_DEF } from '@/game/data/equipment'
import { ACTOR_ASSETS } from '@/game/assets'
import {
  BATTLE_BACKGROUND,
  BATTLE_EFFECT_ATLAS_ID,
  BATTLE_ENVIRONMENT_STYLES,
  battleEffectFrame,
  battleAssetForMob,
  battleFighterLayout,
  battleMobLayout,
  battleTankVisualFor,
  type BattleEffectSpriteKind
} from '@/game/assets/battle'
import { atlasRegistry } from '@/game/engine/atlas'
import {
  overworldTankVisualFor,
  tankAimAngle,
  tankConditionFor,
  tankFacingAngle,
  type OverworldTankVisual
} from '@/game/assets/tanks'
import {
  drawBattleSkyAtmosphere,
  drawInteriorLighting,
  drawNightLights,
  drawOutdoorLighting,
  drawWeatherParticles,
  drawWetGround,
  type AtmosphereBiome,
  type AtmosphereViewport
} from '@/game/engine/atmosphere'
import { daylightProfile } from '@/game/systems/environment'
import { WORLD_GATES, worldGateUnlocked } from '@/game/systems/world-gates'

export const W = 640
export const H = 480
const VIEW_W = 20
const VIEW_H = 15
const DENSE_EXPLORATION_TILE_SIZE = 20
const COMPACT_EXPLORATION_TILE_SIZE = 28
const STANDARD_TILE_SIZE = ART_TILE_SIZE
const DENSE_CAVE_TILE_SIZE = 29
const ROOM_ENTITY_TYPES = new Set([
  'workbench',
  'shelf',
  'bed',
  'table',
  'tv',
  'stove',
  'sofa',
  'plant',
  'crate',
  'radio',
  'counter',
  'weaponrack',
  'tanklift',
  'locker',
  'bountyboard',
  'stairs',
  'stairs_down',
  'garageconsole',
  'vehiclelift'
])

let ctx: CanvasRenderingContext2D | null = null
let presentationScale = 1

export function setPresentationScale(scale: number) {
  presentationScale = Number.isFinite(scale) && scale > 0 ? scale : 1
}

export function explorationTileSizeForScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return STANDARD_TILE_SIZE
  if (scale < 0.72) return STANDARD_TILE_SIZE
  if (scale < 1) return COMPACT_EXPLORATION_TILE_SIZE
  return DENSE_EXPLORATION_TILE_SIZE
}

export function caveTileSizeForScale(scale: number): number {
  if (!Number.isFinite(scale) || scale < 1) return STANDARD_TILE_SIZE
  return DENSE_CAVE_TILE_SIZE
}

export function bindCanvas(canvas: HTMLCanvasElement) {
  ctx = canvas.getContext('2d')
  if (ctx) ctx.imageSmoothingEnabled = false
}

function c2d(): CanvasRenderingContext2D {
  if (!ctx) throw new Error('renderer not bound')
  return ctx
}

function fillPixelRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  context.fillRect(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height))
  )
}

export function clear(color?: string) {
  const c = c2d()
  c.fillStyle = color || '#000'
  c.fillRect(0, 0, W, H)
}

export function rect(x: number, y: number, w: number, h: number, color: string) {
  c2d().fillStyle = color
  c2d().fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

export function sprite(
  rows: string[],
  x: number,
  y: number,
  scale?: number,
  pal?: Record<string, string>
) {
  const s = scale || 1
  const p = pal || PAL
  const c = c2d()
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (ch === '.' || ch === ' ') continue
      const col = p[ch]
      if (!col) continue
      c.fillStyle = col
      c.fillRect(Math.round(x + i * s), Math.round(y + r * s), s, s)
    }
  }
}

export function tankSprite(
  tank: TankState,
  x: number,
  y: number,
  scale?: number,
  faceRight?: boolean
) {
  const tpl = TTPL[tank.tankDef?.tpl || 'tank'] || TTPL.tank
  const pal: Record<string, string> = Object.assign(
    {},
    PAL,
    {
      O: '#111412',
      N: '#2b2e2a',
      S: '#555c52',
      s: '#777d73'
    },
    tank.tankDef?.colors || {}
  )
  const s = scale || 2
  const rows = faceRight ? tpl : tpl.map((r) => r.split('').reverse().join(''))
  const c = c2d()
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (ch === '.' || ch === ' ') continue
      const col = pal[ch]
      if (!col) continue
      c.fillStyle = col
      c.fillRect(Math.round(x + i * s), Math.round(y + r * s), s, s)
    }
  }
}

function tankPalette(tank: TankState) {
  const def = tank.tankDef || TANKS_DEF.find((item) => item.id === tank.tankId)
  return {
    primary: def?.colors.X || '#596752',
    secondary: def?.colors.Y || '#333c31',
    outline: '#111613',
    metal: '#737c75',
    highlight: '#aeb8a7'
  }
}

function drawTankTracks(
  c: CanvasRenderingContext2D,
  visual: OverworldTankVisual,
  frame: number,
  palette: ReturnType<typeof tankPalette>
) {
  const halfBody = visual.bodyWidth / 2
  const halfLength = visual.bodyLength / 2
  const x1 = -halfBody - visual.trackWidth
  const x2 = halfBody
  c.fillStyle = palette.outline
  c.fillRect(x1 - 1, -halfLength - 1, visual.trackWidth + 2, visual.bodyLength + 2)
  c.fillRect(x2 - 1, -halfLength - 1, visual.trackWidth + 2, visual.bodyLength + 2)
  c.fillStyle = '#353b37'
  c.fillRect(x1, -halfLength, visual.trackWidth, visual.bodyLength)
  c.fillRect(x2, -halfLength, visual.trackWidth, visual.bodyLength)
  c.fillStyle = palette.metal
  const treadOffset = frame % 2 ? 2 : 0
  for (let y = -halfLength + treadOffset; y < halfLength; y += 5) {
    c.fillRect(x1, y, visual.trackWidth, 2)
    c.fillRect(x2, y, visual.trackWidth, 2)
  }
}

function drawTankWheels(
  c: CanvasRenderingContext2D,
  visual: OverworldTankVisual,
  frame: number,
  palette: ReturnType<typeof tankPalette>
) {
  const halfBody = visual.bodyWidth / 2
  const halfLength = visual.bodyLength / 2
  const wheelY = [-halfLength + 3, halfLength - 7]
  for (const y of wheelY) {
    for (const side of [-1, 1]) {
      const x = side < 0 ? -halfBody - visual.trackWidth : halfBody
      c.fillStyle = palette.outline
      c.fillRect(x - 1, y - 1, visual.trackWidth + 2, 7)
      c.fillStyle = '#3b403d'
      c.fillRect(x, y, visual.trackWidth, 5)
      c.fillStyle = frame % 2 ? palette.metal : '#202522'
      c.fillRect(x + 1, y + 1, Math.max(1, visual.trackWidth - 2), 3)
    }
  }
}

function drawTankHull(
  c: CanvasRenderingContext2D,
  visual: OverworldTankVisual,
  palette: ReturnType<typeof tankPalette>
) {
  const halfWidth = visual.bodyWidth / 2
  const halfLength = visual.bodyLength / 2
  c.fillStyle = palette.outline
  c.beginPath()
  c.moveTo(-halfWidth + 3, -halfLength - 1)
  c.lineTo(halfWidth - 3, -halfLength - 1)
  c.lineTo(halfWidth + 1, -halfLength + 4)
  c.lineTo(halfWidth + 1, halfLength + 1)
  c.lineTo(-halfWidth - 1, halfLength + 1)
  c.lineTo(-halfWidth - 1, -halfLength + 4)
  c.closePath()
  c.fill()

  c.fillStyle = palette.primary
  c.beginPath()
  c.moveTo(-halfWidth + 3, -halfLength + 1)
  c.lineTo(halfWidth - 3, -halfLength + 1)
  c.lineTo(halfWidth - 1, -halfLength + 4)
  c.lineTo(halfWidth - 1, halfLength - 1)
  c.lineTo(-halfWidth + 1, halfLength - 1)
  c.lineTo(-halfWidth + 1, -halfLength + 4)
  c.closePath()
  c.fill()

  c.fillStyle = palette.secondary
  c.fillRect(-halfWidth + 3, halfLength - 5, visual.bodyWidth - 6, 3)
  c.fillStyle = palette.highlight
  c.fillRect(-halfWidth + 4, -halfLength + 3, visual.bodyWidth - 8, 2)
}

function drawTankMount(
  c: CanvasRenderingContext2D,
  visual: OverworldTankVisual,
  palette: ReturnType<typeof tankPalette>
) {
  const turretX = -visual.turretWidth / 2
  const turretY = -visual.turretLength / 2 + visual.deckOffset
  const barrelWidth = visual.mount === 'rail' ? 4 : visual.mount === 'siege' ? 4 : 2

  if (visual.mount === 'missile') {
    c.fillStyle = palette.outline
    c.fillRect(turretX - 1, turretY - 1, visual.turretWidth + 2, visual.turretLength + 2)
    c.fillStyle = palette.secondary
    c.fillRect(turretX + 1, turretY + 1, visual.turretWidth - 2, visual.turretLength - 2)
    for (let col = 0; col < 3; col++) {
      c.fillStyle = col === 2 ? '#a74e38' : '#242a26'
      c.fillRect(turretX + 2 + col * 4, turretY + 2, 3, visual.turretLength - 4)
    }
    return
  }

  if (visual.mount !== 'medical') {
    c.fillStyle = palette.outline
    c.fillRect(
      -barrelWidth / 2 - 1,
      turretY - visual.barrelLength,
      barrelWidth + 2,
      visual.barrelLength + 3
    )
    c.fillStyle = visual.mount === 'rail' ? '#6ec8cf' : palette.metal
    c.fillRect(
      -barrelWidth / 2,
      turretY - visual.barrelLength,
      barrelWidth,
      visual.barrelLength + 2
    )
  }

  c.fillStyle = palette.outline
  c.fillRect(turretX - 1, turretY - 1, visual.turretWidth + 2, visual.turretLength + 2)
  c.fillStyle = visual.mount === 'medical' ? '#d9ddd6' : palette.secondary
  c.fillRect(turretX + 1, turretY + 1, visual.turretWidth - 2, visual.turretLength - 2)
  c.fillStyle = palette.primary
  c.fillRect(turretX + 2, turretY + 2, Math.max(2, visual.turretWidth - 4), 2)

  if (visual.mount === 'medical') {
    c.fillStyle = '#c73535'
    c.fillRect(-1, turretY + 2, 3, visual.turretLength - 4)
    c.fillRect(-4, turretY + visual.turretLength / 2 - 1, 9, 3)
  } else if (visual.mount === 'scout') {
    c.fillStyle = '#bad6ce'
    c.fillRect(-2, turretY + 2, 4, 3)
  } else if (visual.mount === 'wolf') {
    c.fillStyle = '#f0d6aa'
    c.fillRect(-4, turretY + 2, 3, 2)
    c.fillRect(2, turretY + 2, 3, 2)
    c.fillStyle = '#78181b'
    c.fillRect(-2, turretY + 6, 5, 2)
  } else if (visual.mount === 'rail') {
    c.fillStyle = '#d8f5ec'
    c.fillRect(-3, turretY + 2, 6, 2)
  } else if (visual.mount === 'siege') {
    c.fillStyle = '#8d7c55'
    c.fillRect(turretX + 2, turretY + visual.turretLength - 4, visual.turretWidth - 4, 2)
  }
}

function drawTankWear(
  c: CanvasRenderingContext2D,
  tank: TankState,
  centerX: number,
  centerY: number,
  time: number,
  scale = 1
) {
  const def = tank.tankDef || TANKS_DEF.find((item) => item.id === tank.tankId)
  const condition = tankConditionFor(tank.sp, def?.sp || tank.sp)
  if (condition === 'healthy') return

  const pixelRect = (x: number, y: number, width: number, height: number) => {
    c.fillRect(
      Math.round(x),
      Math.round(y),
      Math.max(1, Math.round(width)),
      Math.max(1, Math.round(height))
    )
  }

  c.fillStyle = '#d8c8a0'
  pixelRect(centerX - 6 * scale, centerY - 2 * scale, 5 * scale, scale)
  pixelRect(centerX + 1 * scale, centerY + 4 * scale, 4 * scale, scale)
  c.fillStyle = '#3b2f2a'
  pixelRect(centerX - 3 * scale, centerY + 1 * scale, scale, 4 * scale)

  if (condition !== 'critical' && condition !== 'disabled') return
  const flicker = Math.floor(time * 10) % 3
  c.fillStyle = '#ba321f'
  pixelRect(centerX - 5 * scale, centerY - 9 * scale, 6 * scale, 6 * scale)
  c.fillStyle = '#f0802f'
  pixelRect(centerX - (3 + flicker) * scale, centerY - (11 + flicker) * scale, 4 * scale, 6 * scale)
  c.fillStyle = '#ffd267'
  pixelRect(centerX - 2 * scale, centerY - (10 + flicker) * scale, 2 * scale, 3 * scale)

  const smokeCount = condition === 'disabled' ? 5 : 3
  for (let i = 0; i < smokeCount; i++) {
    const phase = (time * (0.55 + i * 0.07) + i * 0.23) % 1
    const drift = Math.round(Math.sin(time * 2.1 + i * 1.7) * 4 * scale)
    const size = Math.max(2, Math.round((3 + phase * 4) * scale))
    c.fillStyle = i % 2 ? 'rgba(88,91,86,0.9)' : 'rgba(35,38,36,0.94)'
    pixelRect(
      centerX - 3 * scale + drift - size / 2,
      centerY - 12 * scale - phase * 22 * scale,
      size,
      size
    )
  }
}

function drawOverworldTank(
  tank: TankState,
  centerX: number,
  centerY: number,
  facing: number,
  frame: number,
  time: number,
  scale = 1
) {
  const c = c2d()
  const visual = overworldTankVisualFor(tank.tankId)
  const palette = tankPalette(tank)
  const angle = tankFacingAngle(facing)

  c.fillStyle = 'rgba(0,0,0,0.38)'
  c.fillRect(
    Math.round(centerX - 14 * scale),
    Math.round(centerY + 10 * scale),
    28 * scale,
    5 * scale
  )
  c.save()
  c.translate(Math.round(centerX), Math.round(centerY))
  c.rotate(angle)
  c.scale(scale, scale)
  if (visual.chassis === 'tracked') drawTankTracks(c, visual, frame, palette)
  else drawTankWheels(c, visual, frame, palette)
  drawTankHull(c, visual, palette)

  if (visual.chassis === 'box') {
    c.fillStyle = '#d8ddd6'
    c.fillRect(-visual.bodyWidth / 2 + 3, -visual.bodyLength / 2 + 5, visual.bodyWidth - 6, 6)
  }
  drawTankMount(c, visual, palette)
  c.restore()
  drawTankWear(c, tank, centerX, centerY, time, scale)
}

export function text(
  str: string,
  x: number,
  y: number,
  color?: string,
  size?: number,
  align?: CanvasTextAlign,
  bold?: boolean
) {
  const c = c2d()
  c.font =
    (bold ? 'bold ' : '') +
    (size || 12) +
    "px 'Courier New','PingFang SC','Microsoft YaHei',monospace"
  c.textAlign = align || 'left'
  c.textBaseline = 'top'
  c.fillStyle = '#000'
  c.fillText(str, x + 1, y + 1)
  c.fillStyle = color || '#fff'
  c.fillText(str, x, y)
}

export function textW(str: string, maxW: number, size?: number): string[] {
  const s = size || 12
  const c = c2d()
  c.font = s + "px 'Courier New','PingFang SC','Microsoft YaHei',monospace"
  const lines: string[] = []
  let cur = ''
  for (const ch of str) {
    const test = cur + ch
    if (c.measureText(test).width > maxW && cur) {
      lines.push(cur)
      cur = ch
    } else cur = test
  }
  if (cur) lines.push(cur)
  return lines
}

/* ---------------- 地图预烘焙 ---------------- */

const baked = new Map<string, HTMLCanvasElement>()

function mkCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  return { c, g }
}

export function invalidateMap(mapId: string) {
  baked.delete(mapId)
}

function bakeWorld(): HTMLCanvasElement {
  const { c, g } = mkCanvas(WORLD_W * ART_TILE_SIZE, WORLD_H * ART_TILE_SIZE)
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      drawWorldTile({ ctx: g, x, y, h: hash(x, y), n: neighbors(WORLD, x, y) }, WORLD[y][x])
    }
  }
  return c
}

function bakeTown(town: (typeof TOWNS)[number]): HTMLCanvasElement {
  const [w, h] = town.size
  const grid = townGrids.get(town.id)?.map || buildTownGrid(town).map
  const { c, g } = mkCanvas(w * ART_TILE_SIZE, h * ART_TILE_SIZE)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      drawTownTile({ ctx: g, x, y, h: hash(x, y, 101), n: neighbors(grid, x, y) }, grid[y][x], town)
    }
  }
  // 建筑立面
  for (const b of town.buildings) {
    drawBuilding(g, b, hash(b.x, b.y, 202), town.id)
  }
  // 低矮装饰烘焙到底图；有高度的物件在实体层按脚底排序。
  const decors = [...townDecor(town), ...(town.decor || [])]
  for (const d of decors) {
    if (!DECOR_BLOCK.has(d.t)) drawDecor(g, d.t, d.x, d.y, hash(d.x, d.y, 303), 0, 0, town.id)
  }
  return c
}

function bakeCave(cave: (typeof CAVES)[number]): HTMLCanvasElement {
  const [w, h] = cave.size
  const grid = caveGrids.get(cave.id)?.map || buildCaveGrid(cave).map
  const { c, g } = mkCanvas(w * ART_TILE_SIZE, h * ART_TILE_SIZE)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      drawCaveTile({ ctx: g, x, y, h: hash(x, y, 404), n: neighbors(grid, x, y) }, grid[y][x])
    }
  }
  return c
}

function bakeRoom(room: RoomDef): HTMLCanvasElement {
  const [w, h] = room.size
  const grid = roomGrids.get(room.id)?.map || buildRoomGrid(room).map
  const { c, g } = mkCanvas(w * ART_TILE_SIZE, h * ART_TILE_SIZE)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      drawRoomTile({ ctx: g, x, y, h: hash(x, y, 505), n: neighbors(grid, x, y) }, grid[y][x], room)
    }
  }
  for (const [index, slot] of (room.garageSlots || []).entries()) drawGarageBay(g, slot, index)
  const bakedFurniture = (room.furniture || []).filter((f) => !ROOM_ENTITY_TYPES.has(f.t))
  for (const f of bakedFurniture) drawFurniture(g, f, hash(f.x, f.y, 606), 0, 0, room.town)
  for (const d of room.decor || []) drawDecor(g, d.t, d.x, d.y, hash(d.x, d.y, 707))
  return c
}

export function bakeMap(mapId: string): HTMLCanvasElement {
  const hit = baked.get(mapId)
  if (hit) return hit
  let c: HTMLCanvasElement
  if (mapId === 'world') c = bakeWorld()
  else {
    const town = TOWNS.find((t) => t.id === mapId)
    if (town) c = bakeTown(town)
    else {
      const cave = CAVES.find((x) => x.id === mapId)
      if (cave) c = bakeCave(cave)
      else {
        const room = ROOMS.find((x) => x.id === mapId)
        if (room) c = bakeRoom(room)
        else c = mkCanvas(VIEW_W * ART_TILE_SIZE, VIEW_H * ART_TILE_SIZE).c
      }
    }
  }
  baked.set(mapId, c)
  return c
}

/* ---------------- 相机 ---------------- */

function cam(state: GameState, w: number, h: number, tileSize = STANDARD_TILE_SIZE) {
  const px = state.anim
    ? state.anim.fx + (state.anim.tx - state.anim.fx) * Math.min(1, state.anim.t)
    : state.px
  const py = state.anim
    ? state.anim.fy + (state.anim.ty - state.anim.fy) * Math.min(1, state.anim.t)
    : state.py
  const cameraX = clamp(Math.round(px * tileSize - W / 2), 0, Math.max(0, w * tileSize - W))
  const cameraY = clamp(Math.round(py * tileSize - H * 0.53), 0, Math.max(0, h * tileSize - H))
  return { px, py, cameraX, cameraY }
}

function blit(mapId: string, cameraX: number, cameraY: number, tileSize = STANDARD_TILE_SIZE) {
  const canvas = bakeMap(mapId)
  const c = c2d()
  const renderScale = tileSize / ART_TILE_SIZE
  c.imageSmoothingEnabled = false
  c.drawImage(
    canvas,
    cameraX / renderScale,
    cameraY / renderScale,
    W / renderScale,
    H / renderScale,
    0,
    0,
    W,
    H
  )
}

/* ---------------- 场景绘制 ---------------- */

export function drawScene(state: GameState) {
  if (state.map === 'world') drawWorld(state)
  else if (TOWNS.find((t) => t.id === state.map)) drawTown(state)
  else if (CAVES.find((c) => c.id === state.map)) drawCave(state)
  else drawRoom(state)
}

function worldBiome(state: GameState): AtmosphereBiome {
  const tile = WORLD[state.py]?.[state.px]
  if (tile === 's') return 'desert'
  if (tile === 'f') return 'forest'
  if (tile === 'm') return 'mountain'
  return 'field'
}

function worldWetSurface(surface: string | undefined): boolean {
  return !!surface && ['.', 'r', 't', 'D', 's', 'H', 'N', 'C'].includes(surface)
}

function townWetSurface(surface: string | undefined): boolean {
  return surface !== undefined && !['#', 'B', '~', 'O', '^'].includes(surface)
}

function mapAtmosphereViewport(
  cameraX: number,
  cameraY: number,
  tileSize: number,
  surfaceAt: AtmosphereViewport['surfaceAt'],
  wetSurface: AtmosphereViewport['wetSurface'],
  biome: AtmosphereBiome
): AtmosphereViewport {
  return {
    width: W,
    height: H,
    cameraX,
    cameraY,
    tileSize,
    surfaceAt,
    wetSurface,
    biome
  }
}

function shiftRow(row: string, amount: number): string {
  if (!amount) return row
  const pad = '.'.repeat(Math.abs(amount))
  return amount > 0
    ? (pad + row).slice(0, row.length)
    : (row.slice(-amount) + pad).slice(0, row.length)
}

function setPixel(row: string, x: number, value: string): string {
  if (x < 0 || x >= row.length) return row
  return row.slice(0, x) + value + row.slice(x + 1)
}

function legRow(width: number, color: string, left: number, right: number): string {
  const row = Array<string>(width).fill('.')
  for (const start of [left, right]) {
    if (start >= 0 && start < width) row[start] = color
    if (start + 1 >= 0 && start + 1 < width) row[start + 1] = color
  }
  return row.join('')
}

const heroPoseCache = new Map<string, string[]>()

function heroPose(facing: number, frame: number): string[] {
  const key = facing + ':' + frame
  const cached = heroPoseCache.get(key)
  if (cached) return cached

  const pose = SPR.hero.slice()
  const width = pose[0].length

  if (facing === 0) {
    // 背面：用头发覆盖正面的五官区域，保持原有配色与轮廓。
    for (let y = 4; y <= 7; y++) pose[y] = pose[y].replace(/[TK]/g, 'H')
  } else if (facing === 2 || facing === 3) {
    // 侧面：头发偏向行进方向，只保留近侧眼睛并补一个鼻尖像素。
    const shift = facing === 2 ? -1 : 1
    for (let y = 0; y <= 3; y++) pose[y] = shiftRow(pose[y], shift)
    pose[6] = pose[6].replace(/K/g, 'T')
    pose[6] = setPixel(pose[6], facing === 2 ? 4 : width - 5, 'K')
    pose[7] = setPixel(pose[7], facing === 2 ? 2 : width - 3, 'T')
  }

  const legColor = pose[pose.length - 1].match(/[^.\s]/)?.[0] || 'T'
  const gait = [
    { upper: [2, width - 5], lower: [1, width - 4] },
    { upper: [3, width - 5], lower: [3, width - 5] },
    { upper: [4, width - 6], lower: [5, width - 7] }
  ][frame]
  pose[pose.length - 2] = legRow(width, legColor, gait.upper[0], gait.upper[1])
  pose[pose.length - 1] = legRow(width, legColor, gait.lower[0], gait.lower[1])

  heroPoseCache.set(key, pose)
  return pose
}

function currentWalkFrame(state: GameState): number {
  if (!state.anim) return 1
  return Math.min(2, Math.floor(Math.min(0.999, state.anim.t) * 3))
}

const ACTOR_DIRECTIONS = ['up', 'down', 'left', 'right'] as const

function drawAtlasActor(
  spriteId: string,
  facing: number,
  frame: number,
  footX: number,
  footY: number,
  scale = 2
) {
  const asset = ACTOR_ASSETS[spriteId]
  if (!asset) return false
  const direction = ACTOR_DIRECTIONS[facing] || 'down'
  return atlasRegistry.drawFrame(
    c2d(),
    asset.atlas,
    `${asset.sprite}/${direction}/${frame}`,
    footX,
    footY,
    { scale, anchor: asset.anchor }
  )
}

function drawActor(state: GameState, sx: number, sy: number, tileSize = STANDARD_TILE_SIZE) {
  if (state.riding) {
    const convoyTankIds = new Set(
      state.party
        .filter((member) => member.id && member.id !== state.hunt?.memberId)
        .map((member) => member.tankId)
        .filter((tankId): tankId is string => !!tankId)
    )
    const leadTankId = state.party.find(
      (member) => member.id && member.id !== state.hunt?.memberId
    )?.tankId
    const convoy = state.tanks.filter(
      (item) =>
        item.garageSlot === null &&
        item.tankId !== state.hunt?.tankId &&
        convoyTankIds.has(item.tankId)
    )
    const tank =
      convoy.find((item) => item.tankId === leadTankId && item.sp > 0) ||
      convoy.find((item) => item.sp > 0) ||
      convoy[0]
    if (tank) {
      if (!tank.tankDef) tank.tankDef = TANKS_DEF.find((t) => t.id === tank.tankId)
      drawOverworldTank(
        tank,
        sx + tileSize / 2,
        sy + tileSize / 2,
        state.facing,
        currentWalkFrame(state),
        state.playtime
      )
      return
    }
  }
  const frame = currentWalkFrame(state)
  const actorScale = tileSize < 28 ? 1 : 2
  const bob = state.anim && frame === 1 ? -actorScale : 0
  if (
    drawAtlasActor('hero', state.facing, frame, sx + tileSize / 2, sy + tileSize + bob, actorScale)
  )
    return
  const rows = heroPose(state.facing, frame)
  const sw = rows[0].length * actorScale
  sprite(rows, sx + (tileSize - sw) / 2, sy + tileSize - rows.length * actorScale + bob, actorScale)
}

type SceneNpc = { x: number; y: number; sp: string }

function drawNpc(n: SceneNpc, cameraX: number, cameraY: number, tileSize = STANDARD_TILE_SIZE) {
  const actorScale = tileSize < 28 ? 1 : 2
  if (
    drawAtlasActor(
      n.sp,
      1,
      1,
      n.x * tileSize - cameraX + tileSize / 2,
      n.y * tileSize - cameraY + tileSize,
      actorScale
    )
  )
    return
  const rows = SPR[n.sp] || SPR.npc_m
  const sw = rows[0].length * actorScale
  sprite(
    rows,
    n.x * tileSize - cameraX + (tileSize - sw) / 2,
    n.y * tileSize - cameraY + tileSize - rows.length * actorScale,
    actorScale
  )
}

function drawMapScale(
  tileSize: number,
  cameraX: number,
  cameraY: number,
  draw: (artCameraX: number, artCameraY: number) => void
) {
  const c = c2d()
  const renderScale = tileSize / ART_TILE_SIZE
  c.save()
  c.scale(renderScale, renderScale)
  draw(cameraX / renderScale, cameraY / renderScale)
  c.restore()
}

function drawActorLayer(
  state: GameState,
  npcs: SceneNpc[],
  cameraX: number,
  cameraY: number,
  px: number,
  py: number,
  decors: { x: number; y: number; t: string }[] = [],
  extras: { footY: number; draw: () => void }[] = [],
  townId?: string,
  tileSize = STANDARD_TILE_SIZE
) {
  const actors: { footY: number; draw: () => void }[] = npcs.map((n) => ({
    footY: n.y + 1,
    draw: () => drawNpc(n, cameraX, cameraY, tileSize)
  }))
  for (const d of decors) {
    if (!DECOR_BLOCK.has(d.t)) continue
    actors.push({
      footY: d.y + 1,
      draw: () =>
        drawMapScale(tileSize, cameraX, cameraY, (artCameraX, artCameraY) =>
          drawDecor(c2d(), d.t, d.x, d.y, hash(d.x, d.y, 303), artCameraX, artCameraY, townId)
        )
    })
  }
  actors.push(...extras)
  actors.push({
    footY: py + 1,
    draw: () => drawActor(state, px * tileSize - cameraX, py * tileSize - cameraY, tileSize)
  })
  actors.sort((a, b) => a.footY - b.footY)
  for (const actor of actors) actor.draw()
}

function waterShimmer(cameraX: number, cameraY: number, t: number, tileSize: number) {
  const c = c2d()
  const x0 = Math.max(0, Math.floor(cameraX / tileSize))
  const y0 = Math.max(0, Math.floor(cameraY / tileSize))
  const x1 = Math.min(WORLD_W, Math.ceil((cameraX + W) / tileSize))
  const y1 = Math.min(WORLD_H, Math.ceil((cameraY + H) / tileSize))
  for (let wy = y0; wy < y1; wy++) {
    for (let wx = x0; wx < x1; wx++) {
      if (WORLD[wy][wx] !== 'w') continue
      const sp = hash(wx, wy, 91)
      const phase = (t * (0.6 + sp * 0.9) + sp * 6.28) % 1
      if (phase < 0.22) {
        const lx = wx * tileSize - cameraX + 2 + ((sp * Math.max(4, tileSize - 6)) | 0)
        const ly =
          wy * tileSize - cameraY + 3 + ((hash(wx, wy, 92) * Math.max(4, tileSize - 8)) | 0)
        c.fillStyle = 'rgba(255,255,255,0.35)'
        c.fillRect(lx, ly, Math.max(3, Math.round(tileSize * 0.16)), 1)
      }
    }
  }
}

export function drawWorld(state: GameState) {
  clear('#101418')
  const tileSize = explorationTileSizeForScale(presentationScale)
  const { px, py, cameraX, cameraY } = cam(state, WORLD_W, WORLD_H, tileSize)
  const atmosphere = mapAtmosphereViewport(
    cameraX,
    cameraY,
    tileSize,
    (x, y) => WORLD[y]?.[x],
    worldWetSurface,
    worldBiome(state)
  )
  blit('world', cameraX, cameraY, tileSize)
  drawWetGround(c2d(), state, atmosphere)
  waterShimmer(cameraX, cameraY, state.playtime, tileSize)
  drawWorldGateStates(c2d(), state, cameraX, cameraY, tileSize)
  drawActor(state, px * tileSize - cameraX, py * tileSize - cameraY, tileSize)
  drawOutdoorLighting(c2d(), state, W, H)
  const worldLights: { x: number; y: number; kind: 'door' }[] = []
  const lightX0 = Math.max(0, Math.floor(cameraX / tileSize) - 1)
  const lightY0 = Math.max(0, Math.floor(cameraY / tileSize) - 1)
  const lightX1 = Math.min(WORLD_W, Math.ceil((cameraX + W) / tileSize) + 1)
  const lightY1 = Math.min(WORLD_H, Math.ceil((cameraY + H) / tileSize) + 1)
  for (let y = lightY0; y < lightY1; y++) {
    for (let x = lightX0; x < lightX1; x++) {
      if (!['D', 'C', 'G', 'H', 'N'].includes(WORLD[y]?.[x])) continue
      worldLights.push({
        x: x * tileSize - cameraX + tileSize / 2,
        y: y * tileSize - cameraY + tileSize / 2,
        kind: 'door'
      })
    }
  }
  drawNightLights(c2d(), state, worldLights, tileSize / ART_TILE_SIZE)
  drawWeatherParticles(c2d(), state, atmosphere)
}

function drawWorldGateStates(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cameraX: number,
  cameraY: number,
  tileSize: number
) {
  const scale = tileSize / ART_TILE_SIZE
  for (const gate of WORLD_GATES) {
    const x = gate.position[0] * tileSize - cameraX
    const y = gate.position[1] * tileSize - cameraY
    if (x + tileSize < 0 || y + tileSize < 0 || x > W || y > H) continue
    const open = worldGateUnlocked(state, gate)
    ctx.fillStyle = open ? '#75c277' : '#d45d4d'
    ctx.fillRect(
      Math.round(x + 4 * scale),
      Math.round(y + 4 * scale),
      Math.max(2, Math.round(3 * scale)),
      Math.max(2, Math.round(3 * scale))
    )
    ctx.fillRect(
      Math.round(x + 25 * scale),
      Math.round(y + 4 * scale),
      Math.max(2, Math.round(3 * scale)),
      Math.max(2, Math.round(3 * scale))
    )
    if (open) continue
    ctx.fillStyle = '#3b2724'
    ctx.fillRect(
      Math.round(x + 8 * scale),
      Math.round(y + 14 * scale),
      Math.round(17 * scale),
      Math.max(2, Math.round(4 * scale))
    )
    ctx.fillStyle = '#e2b85f'
    for (let stripe = 0; stripe < 4; stripe++) {
      ctx.fillRect(
        Math.round(x + (9 + stripe * 4) * scale),
        Math.round(y + 14 * scale),
        Math.max(1, Math.round(2 * scale)),
        Math.max(1, Math.round(2 * scale))
      )
    }
  }
}

export function drawTown(state: GameState) {
  clear('#0c1018')
  const town = TOWNS.find((t) => t.id === state.map)
  if (!town) return
  const tileSize = explorationTileSizeForScale(presentationScale)
  const { px, py, cameraX, cameraY } = cam(state, town.size[0], town.size[1], tileSize)
  blit(town.id, cameraX, cameraY, tileSize)
  const decors = [...townDecor(town), ...(town.decor || [])]
  const townGrid = buildTownGrid(town).map
  const atmosphere = mapAtmosphereViewport(
    cameraX,
    cameraY,
    tileSize,
    (x, y) => townGrid[y]?.[x],
    townWetSurface,
    'town'
  )
  drawWetGround(c2d(), state, atmosphere)
  drawActorLayer(state, town.npcs, cameraX, cameraY, px, py, decors, [], town.id, tileSize)
  drawOutdoorLighting(c2d(), state, W, H)
  const townLights = [
    ...decors
      .filter((decor) => decor.t === 'lamp')
      .map((decor) => ({
        x: decor.x * tileSize - cameraX + tileSize * 0.5,
        y: decor.y * tileSize - cameraY + tileSize * 0.28,
        kind: 'lamp' as const
      })),
    ...town.buildings
      .filter((building) => building.open !== false)
      .map((building) => ({
        x: building.door[0] * tileSize - cameraX + tileSize * 0.5,
        y: building.door[1] * tileSize - cameraY + tileSize * 0.48,
        kind: 'door' as const
      }))
  ]
  drawNightLights(c2d(), state, townLights, tileSize / ART_TILE_SIZE)
  drawWeatherParticles(c2d(), state, atmosphere)
}

export function drawCave(state: GameState) {
  clear('#07070c')
  const cave = CAVES.find((c) => c.id === state.map)
  if (!cave) return
  const tileSize = caveTileSizeForScale(presentationScale)
  const { px, py, cameraX, cameraY } = cam(state, cave.size[0], cave.size[1], tileSize)
  blit(cave.id, cameraX, cameraY, tileSize)
  drawActor(state, px * tileSize - cameraX, py * tileSize - cameraY, tileSize)
}

export function drawRoom(state: GameState) {
  clear('#0a0a10')
  const room = ROOMS.find((r) => r.id === state.map)
  if (!room) return
  const { px, py, cameraX, cameraY } = cam(state, room.size[0], room.size[1])
  blit(room.id, cameraX, cameraY)
  const furniture = (room.furniture || [])
    .filter((f) => ROOM_ENTITY_TYPES.has(f.t))
    .map((f) => ({
      footY: f.y + f.h,
      draw: () => drawFurniture(c2d(), f, hash(f.x, f.y, 606), cameraX, cameraY, room.town)
    }))
  const parkedTanks = (room.garageSlots || []).flatMap((slot, index) => {
    const tank = state.tanks.find((candidate) => candidate.garageSlot === index)
    if (!tank) return []
    return [
      {
        footY: slot.y + 1,
        draw: () =>
          drawOverworldTank(
            tank,
            slot.x * ART_TILE_SIZE - cameraX + ART_TILE_SIZE / 2,
            slot.y * ART_TILE_SIZE - cameraY + ART_TILE_SIZE / 2,
            slot.facing,
            0,
            state.playtime,
            2
          )
      }
    ]
  })
  drawActorLayer(
    state,
    room.npcs || [],
    cameraX,
    cameraY,
    px,
    py,
    [],
    [...furniture, ...parkedTanks]
  )
  const roomLights = (room.furniture || [])
    .filter((item) => item.t === 'stove' || item.t === 'tv')
    .map((item) => ({
      x: (item.x + item.w / 2) * ART_TILE_SIZE - cameraX,
      y: (item.y + item.h / 2) * ART_TILE_SIZE - cameraY,
      kind: item.t === 'tv' ? ('screen' as const) : ('stove' as const)
    }))
  drawInteriorLighting(c2d(), state, W, H, roomLights)
}

/* ---------------- 战斗场景 ---------------- */

function fillBattlePolygon(points: [number, number][], color: string) {
  const c = c2d()
  c.fillStyle = color
  c.beginPath()
  c.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1])
  c.closePath()
  c.fill()
}

function battleAtmosphereBiome(environment: BattleEnvironment): AtmosphereBiome {
  if (environment === 'forest') return 'forest'
  if (environment === 'mountain') return 'mountain'
  if (environment === 'desert') return 'desert'
  if (environment === 'town') return 'town'
  return 'field'
}

function drawBattleSky(state: GameState, environment: BattleEnvironment, horizonY = 296) {
  const c = c2d()
  const style = BATTLE_ENVIRONMENT_STYLES[environment]
  const sky = c.createLinearGradient(0, 0, 0, horizonY)
  sky.addColorStop(0, style.skyTop)
  sky.addColorStop(1, style.skyBottom)
  c.fillStyle = sky
  c.fillRect(0, 0, W, horizonY)
  const floor = c.createLinearGradient(0, horizonY, 0, H)
  floor.addColorStop(0, style.ground)
  floor.addColorStop(1, style.groundDark)
  c.fillStyle = floor
  c.fillRect(0, horizonY, W, H - horizonY)
  drawBattleSkyAtmosphere(c, state, horizonY, battleAtmosphereBiome(environment))
}

function drawFieldBattleBackdrop(state: GameState) {
  const c = c2d()
  const style = BATTLE_ENVIRONMENT_STYLES.field
  drawBattleSky(state, 'field', 294)
  for (let i = 0; i < 18; i++) {
    const x = (i * 83 + 31) % W
    const y = 34 + ((i * 47) % 146)
    c.fillStyle = i % 3 ? '#83908a' : '#b7b8a6'
    c.fillRect(x, y, i % 4 === 0 ? 3 : 2, 2)
  }
  fillBattlePolygon(
    [
      [0, 294],
      [0, 246],
      [74, 226],
      [142, 258],
      [218, 220],
      [292, 250],
      [382, 218],
      [462, 252],
      [544, 224],
      [640, 250],
      [640, 294]
    ],
    style.horizon
  )
  fillBattlePolygon(
    [
      [0, 294],
      [0, 272],
      [88, 256],
      [166, 278],
      [252, 248],
      [332, 276],
      [424, 252],
      [520, 277],
      [590, 254],
      [640, 270],
      [640, 294]
    ],
    '#1d2924'
  )
  fillBattlePolygon(
    [
      [190, 480],
      [454, 480],
      [367, 294],
      [302, 294]
    ],
    '#3d352f'
  )
  fillBattlePolygon(
    [
      [246, 480],
      [392, 480],
      [348, 294],
      [320, 294]
    ],
    '#4b4036'
  )
  for (let y = 330; y < H; y += 42) {
    const widen = (y - 292) * 0.28
    c.fillStyle = 'rgba(171,158,124,0.22)'
    fillPixelRect(c, 322 - widen / 2, y, Math.max(3, widen), y > 410 ? 4 : 2)
  }
  for (let i = 0; i < 20; i++) {
    const x = (i * 97 + 18) % W
    const y = 306 + ((i * 31) % 158)
    c.fillStyle = i % 4 === 0 ? style.accent : '#68764e'
    c.fillRect(x, y, 2, 7 + (i % 3) * 3)
    c.fillRect(x - 2, y + 2, 3, 2)
  }
  for (const x of [34, 602]) {
    c.fillStyle = '#171b18'
    c.fillRect(x, 245, 5, 83)
    c.fillRect(x - 13, 250, 31, 4)
    c.fillRect(x + 1, 250, 2, 79)
  }
}

function drawForestBattleBackdrop(state: GameState) {
  const c = c2d()
  const style = BATTLE_ENVIRONMENT_STYLES.forest
  drawBattleSky(state, 'forest', 286)
  fillBattlePolygon(
    [
      [0, 286],
      [0, 212],
      [66, 188],
      [126, 218],
      [196, 174],
      [268, 214],
      [346, 168],
      [420, 210],
      [502, 180],
      [570, 214],
      [640, 184],
      [640, 286]
    ],
    style.horizon
  )
  for (let i = 0; i < 10; i++) {
    const x = i * 72 - 20
    const trunkTop = 118 + (i % 3) * 24
    c.fillStyle = i % 2 ? '#253528' : '#1d2a22'
    c.fillRect(x + 24, trunkTop, 12 + (i % 2) * 5, 178 - trunkTop)
    c.fillRect(x + 12, trunkTop + 44, 18, 7)
    c.fillRect(x + 31, trunkTop + 70, 19, 6)
    c.fillStyle = i % 2 ? '#263f2d' : '#1c3326'
    c.fillRect(x, trunkTop - 28, 66, 28)
    c.fillRect(x + 10, trunkTop - 43, 48, 19)
    c.fillStyle = '#395238'
    c.fillRect(x + 8, trunkTop - 23, 20, 6)
  }
  const floor = c.createLinearGradient(0, 286, 0, H)
  floor.addColorStop(0, style.ground)
  floor.addColorStop(1, style.groundDark)
  c.fillStyle = floor
  c.fillRect(0, 286, W, H - 286)
  for (let i = 0; i < 24; i++) {
    const x = (i * 91 + 17) % W
    const y = 302 + ((i * 43) % 166)
    c.fillStyle = i % 4 === 0 ? style.accent : i % 2 ? '#48583a' : '#222d24'
    c.fillRect(x, y, 3 + (i % 3) * 3, 3)
    if (i % 5 === 0) c.fillRect(x + 2, y - 7, 2, 8)
  }
}

function drawMountainBattleBackdrop(state: GameState) {
  const c = c2d()
  const style = BATTLE_ENVIRONMENT_STYLES.mountain
  drawBattleSky(state, 'mountain', 288)
  fillBattlePolygon(
    [
      [0, 288],
      [0, 238],
      [92, 118],
      [158, 220],
      [254, 92],
      [338, 224],
      [432, 110],
      [520, 218],
      [594, 142],
      [640, 204],
      [640, 288]
    ],
    style.horizon
  )
  fillBattlePolygon(
    [
      [58, 164],
      [92, 118],
      [119, 160],
      [101, 151],
      [89, 163],
      [78, 151]
    ],
    '#d7d8d2'
  )
  fillBattlePolygon(
    [
      [216, 142],
      [254, 92],
      [292, 154],
      [266, 140],
      [253, 153],
      [240, 136]
    ],
    '#e5e4da'
  )
  fillBattlePolygon(
    [
      [398, 152],
      [432, 110],
      [466, 158],
      [442, 146],
      [430, 158],
      [419, 143]
    ],
    '#d7d8d2'
  )
  fillBattlePolygon(
    [
      [0, 288],
      [0, 268],
      [106, 226],
      [194, 272],
      [310, 220],
      [398, 270],
      [512, 224],
      [640, 266],
      [640, 288]
    ],
    '#333b42'
  )
  const floor = c.createLinearGradient(0, 288, 0, H)
  floor.addColorStop(0, style.ground)
  floor.addColorStop(1, style.groundDark)
  c.fillStyle = floor
  c.fillRect(0, 288, W, H - 288)
  for (let i = 0; i < 15; i++) {
    const x = (i * 103 + 11) % W
    const y = 308 + ((i * 37) % 154)
    c.fillStyle = i % 3 ? '#676a69' : '#34383b'
    c.fillRect(x, y, 18 + (i % 4) * 7, 4)
    c.fillRect(x + 5, y - 5, 8 + (i % 3) * 4, 5)
    if (i % 4 === 0) {
      c.fillStyle = style.accent
      c.fillRect(x + 4, y - 7, 12, 2)
    }
  }
}

function drawTownBattleBackdrop(state: GameState) {
  const c = c2d()
  const drawn = atlasRegistry.drawFrame(c, BATTLE_BACKGROUND.atlas, BATTLE_BACKGROUND.frame, 0, 0)
  if (!drawn) {
    const style = BATTLE_ENVIRONMENT_STYLES.town
    drawBattleSky(state, 'town', 304)
    fillBattlePolygon(
      [
        [0, 304],
        [0, 218],
        [66, 218],
        [66, 154],
        [138, 154],
        [138, 238],
        [216, 238],
        [216, 180],
        [314, 180],
        [314, 236],
        [410, 236],
        [410, 142],
        [506, 142],
        [506, 222],
        [580, 222],
        [580, 188],
        [640, 188],
        [640, 304]
      ],
      style.horizon
    )
    for (const x of [36, 86, 245, 278, 445, 478, 602]) {
      c.fillStyle = '#b76e3d'
      c.fillRect(x, 208 + (x % 3) * 16, 13, 9)
      c.fillStyle = '#251916'
      c.fillRect(x + 4, 208 + (x % 3) * 16, 5, 9)
    }
  } else {
    c.fillStyle = 'rgba(28,13,10,0.18)'
    c.fillRect(0, 0, W, 360)
  }
  const style = BATTLE_ENVIRONMENT_STYLES.town
  const floor = c.createLinearGradient(0, 326, 0, H)
  floor.addColorStop(0, 'rgba(67,45,37,0.84)')
  floor.addColorStop(1, style.groundDark)
  c.fillStyle = floor
  c.fillRect(0, 326, W, H - 326)
  c.fillStyle = 'rgba(224,145,76,0.3)'
  c.fillRect(0, 326, W, 2)
  for (let i = 0; i < 11; i++) {
    const x = 12 + i * 61
    const y = 352 + (i % 3) * 39
    c.fillStyle = i % 2 ? '#604338' : '#302625'
    c.fillRect(x, y, 38 + (i % 4) * 8, 3)
    c.fillRect(x + 8, y + 3, 3, 8)
  }
}

function drawCaveBattleBackdrop() {
  const c = c2d()
  const style = BATTLE_ENVIRONMENT_STYLES.cave
  clear(style.groundDark)
  const wall = c.createLinearGradient(0, 0, 0, 330)
  wall.addColorStop(0, style.skyTop)
  wall.addColorStop(1, style.skyBottom)
  c.fillStyle = wall
  c.fillRect(0, 0, W, 330)
  for (let i = 0; i < 12; i++) {
    const x = i * 58 - 18
    const w = 34 + (i % 3) * 18
    c.fillStyle = i % 2 ? '#303448' : '#1b1e2b'
    c.fillRect(x, 72 + (i % 4) * 25, w, 150 + (i % 3) * 38)
    c.fillStyle = '#3d4052'
    c.fillRect(x + 5, 82 + (i % 4) * 25, 4, 92)
  }
  fillBattlePolygon(
    [
      [0, 0],
      [640, 0],
      [640, 38],
      [600, 82],
      [566, 31],
      [526, 105],
      [475, 44],
      [430, 94],
      [378, 34],
      [326, 112],
      [278, 38],
      [224, 90],
      [174, 28],
      [122, 104],
      [74, 42],
      [32, 88],
      [0, 46]
    ],
    '#0c0e16'
  )
  const floor = c.createLinearGradient(0, 296, 0, H)
  floor.addColorStop(0, style.ground)
  floor.addColorStop(1, style.groundDark)
  c.fillStyle = floor
  c.fillRect(0, 296, W, H - 296)
  for (let i = 0; i < 8; i++) {
    const x = 36 + i * 84
    c.fillStyle = i % 2 ? '#4b4d5f' : '#343645'
    c.fillRect(x, 325 + (i % 3) * 34, 48 + (i % 3) * 12, 3)
    c.fillRect(x + 12, 328 + (i % 3) * 34, 4, 10)
  }
  for (const [x, y] of [
    [230, 264],
    [264, 286],
    [576, 250]
  ] as [number, number][]) {
    c.fillStyle = '#2e7180'
    c.fillRect(x, y, 8, 38)
    c.fillRect(x - 7, y + 12, 7, 26)
    c.fillStyle = style.accent
    c.fillRect(x + 2, y + 4, 3, 25)
    c.fillRect(x - 5, y + 16, 2, 15)
  }
}

function drawDesertBattleBackdrop(state: GameState) {
  const c = c2d()
  const style = BATTLE_ENVIRONMENT_STYLES.desert
  drawBattleSky(state, 'desert', 298)
  if (daylightProfile(state.environment).phase === 'day') {
    c.fillStyle = '#e5aa5d'
    c.fillRect(486, 62, 48, 40)
    c.fillRect(492, 56, 36, 52)
    c.fillStyle = '#f1c875'
    c.fillRect(493, 62, 34, 39)
  }
  fillBattlePolygon(
    [
      [0, 298],
      [0, 246],
      [92, 218],
      [188, 255],
      [286, 204],
      [398, 250],
      [500, 218],
      [640, 252],
      [640, 298]
    ],
    style.horizon
  )
  fillBattlePolygon(
    [
      [0, 298],
      [0, 270],
      [104, 252],
      [214, 283],
      [350, 246],
      [478, 276],
      [566, 250],
      [640, 270],
      [640, 298]
    ],
    '#b97b43'
  )
  for (let i = 0; i < 17; i++) {
    const x = (i * 79 + 14) % W
    const y = 316 + ((i * 37) % 144)
    const width = 22 + (i % 5) * 13
    c.fillStyle = i % 2 ? '#bc8048' : '#765137'
    c.fillRect(x, y, width, y > 405 ? 4 : 2)
  }
  c.fillStyle = '#3b3026'
  c.fillRect(72, 242, 5, 61)
  c.fillRect(56, 258, 20, 5)
  c.fillRect(77, 250, 18, 5)
  c.fillStyle = '#88704a'
  c.fillRect(510, 260, 4, 38)
  c.fillRect(498, 268, 16, 4)
}

function drawFinalBattleBackdrop() {
  const c = c2d()
  const style = BATTLE_ENVIRONMENT_STYLES.final
  clear(style.skyTop)
  c.fillStyle = '#171c24'
  c.fillRect(0, 0, W, 306)
  for (let x = 0; x < W; x += 80) {
    c.fillStyle = x % 160 ? '#202630' : '#191e27'
    c.fillRect(x + 3, 8, 73, 286)
    c.fillStyle = '#343b47'
    c.fillRect(x + 3, 8, 73, 4)
    c.fillRect(x + 72, 8, 4, 286)
    c.fillStyle = '#0d1016'
    c.fillRect(x + 13, 32, 48, 3)
    c.fillRect(x + 13, 260, 48, 3)
  }
  c.fillStyle = '#090c11'
  c.fillRect(0, 116, W, 20)
  c.fillRect(0, 212, W, 12)
  for (let x = 22; x < W; x += 96) {
    c.fillStyle = style.accent
    c.fillRect(x, 54, 20, 10)
    c.fillStyle = '#ffb15d'
    c.fillRect(x + 5, 56, 10, 6)
  }
  c.fillStyle = '#48505c'
  c.fillRect(0, 290, W, 8)
  const floor = c.createLinearGradient(0, 298, 0, H)
  floor.addColorStop(0, style.ground)
  floor.addColorStop(1, style.groundDark)
  c.fillStyle = floor
  c.fillRect(0, 298, W, H - 298)
  for (const x of [76, 154, 232, 310, 388, 466, 544]) {
    fillBattlePolygon(
      [
        [310, 298],
        [330, 298],
        [x + 18, 480],
        [x - 18, 480]
      ],
      '#3a4049'
    )
  }
  for (const y of [326, 358, 399, 448]) {
    c.fillStyle = y % 2 ? '#3d444f' : '#292f38'
    c.fillRect(0, y, W, y > 420 ? 5 : 3)
  }
  for (let x = 0; x < W; x += 48) {
    c.fillStyle = x % 96 ? '#d5a33e' : '#272119'
    c.fillRect(x, 298, 28, 6)
  }
}

function drawBattleBackdrop(state: GameState, environment: BattleEnvironment) {
  switch (environment) {
    case 'forest':
      drawForestBattleBackdrop(state)
      break
    case 'mountain':
      drawMountainBattleBackdrop(state)
      break
    case 'town':
      drawTownBattleBackdrop(state)
      break
    case 'cave':
      drawCaveBattleBackdrop()
      break
    case 'desert':
      drawDesertBattleBackdrop(state)
      break
    case 'final':
      drawFinalBattleBackdrop()
      break
    default:
      drawFieldBattleBackdrop(state)
  }
  const c = c2d()
  c.fillStyle =
    environment === 'cave' || environment === 'final' || environment === 'forest'
      ? 'rgba(2,4,8,0.2)'
      : 'rgba(10,8,7,0.14)'
  c.fillRect(0, 0, 174, 350)
}

function fallbackBattleMob(
  mob: BattleMob,
  centerX: number,
  footY: number,
  selected: boolean,
  renderAlive: boolean
) {
  const tpl = ETPL[mob.tpl] || ETPL.beast
  const scale = mob.size > 1 ? 4 : 3
  const width = tpl[0].length * scale
  const height = tpl.length * scale
  const top = footY - height
  const c = c2d()
  c.save()
  if (!renderAlive) {
    c.globalAlpha = 0.35
    c.filter = 'grayscale(1)'
  }
  sprite(tpl, centerX - width / 2, top, scale, Object.assign({}, PAL, mob.colors))
  c.restore()
  if (selected) text('▼', centerX, Math.max(6, top - 34), '#f4c15d', 14, 'center', true)
  return { top, width }
}

function drawBattleMob(
  mob: BattleMob,
  index: number,
  count: number,
  selected: boolean,
  renderAlive: boolean
) {
  const { centerX, footY } = battleMobLayout(index, count, mob.size)
  const asset = battleAssetForMob(mob.id, mob.tpl)
  const c = c2d()
  let top: number
  let visualWidth: number

  c.fillStyle = renderAlive ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.24)'
  const shadowW = asset ? Math.min(190, asset.width * (asset.scale + (mob.size > 1 ? 1 : 0))) : 92
  c.fillRect(Math.round(centerX - shadowW * 0.42), footY - 4, Math.round(shadowW * 0.84), 7)

  if (
    asset &&
    atlasRegistry.drawFrame(c, asset.atlas, asset.frame, centerX, footY, {
      scale: asset.scale + (mob.size > 1 ? 1 : 0),
      anchor: [asset.width / 2, asset.height],
      alpha: renderAlive ? 1 : 0.32,
      filter: renderAlive ? undefined : 'grayscale(1)'
    })
  ) {
    const scale = asset.scale + (mob.size > 1 ? 1 : 0)
    top = footY - asset.height * scale
    visualWidth = asset.width * scale
    if (selected) text('▼', centerX, Math.max(6, top - 34), '#f4c15d', 14, 'center', true)
  } else {
    const fallback = fallbackBattleMob(mob, centerX, footY, selected, renderAlive)
    top = fallback.top
    visualWidth = fallback.width
  }

  const labelW = Math.max(92, Math.min(176, visualWidth + 16))
  const labelY = Math.max(8, top - 20)
  c.fillStyle = 'rgba(13,10,10,0.82)'
  c.fillRect(centerX - labelW / 2, labelY, labelW, 17)
  text(mob.name, centerX, labelY + 1, renderAlive ? '#f5e4c8' : '#77706a', 10, 'center', true)
  const barX = centerX - labelW / 2 + 4
  const barY = labelY + 13
  const barW = labelW - 8
  const ratio = clamp(mob.hp / Math.max(1, mob.maxHp), 0, 1)
  c.fillStyle = '#241615'
  c.fillRect(barX, barY, barW, 3)
  c.fillStyle = ratio > 0.5 ? '#72b44c' : ratio > 0.2 ? '#d29a42' : '#c74b3e'
  c.fillRect(barX, barY, Math.round(barW * ratio), 3)
}

function fillCanvasPolygon(c: CanvasRenderingContext2D, points: [number, number][], color: string) {
  c.fillStyle = color
  c.beginPath()
  c.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1])
  c.closePath()
  c.fill()
}

function drawBattleTankWheel(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  hub: string
) {
  c.fillStyle = '#101412'
  c.fillRect(x - radius + 2, y - radius, radius * 2 - 4, radius * 2)
  c.fillRect(x - radius, y - radius + 2, radius * 2, radius * 2 - 4)
  c.fillStyle = '#343a36'
  c.fillRect(x - radius + 3, y - radius + 2, radius * 2 - 6, radius * 2 - 4)
  c.fillRect(x - radius + 2, y - radius + 3, radius * 2 - 4, radius * 2 - 6)
  c.fillStyle = hub
  c.fillRect(x - 3, y - 3, 6, 6)
  c.fillStyle = '#171b19'
  c.fillRect(x - 1, y - 1, 2, 2)
}

function drawBattleTankChassis(tank: TankState, centerX: number, footY: number) {
  const c = c2d()
  const visual = battleTankVisualFor(tank.tankId)
  const palette = tankPalette(tank)
  const half = visual.hullLength / 2
  const left = Math.round(centerX - half)
  const right = Math.round(centerX + half)
  const gearTop = footY - visual.runningGearHeight
  const gearCenterY = Math.round(gearTop + visual.runningGearHeight * 0.54)

  c.fillStyle = 'rgba(0,0,0,0.5)'
  fillPixelRect(c, left - 4, footY - 5, visual.hullLength + 8, 7)

  if (visual.chassis === 'tracked') {
    fillCanvasPolygon(
      c,
      [
        [left + 8, gearTop - 2],
        [right - 8, gearTop - 2],
        [right + 2, gearTop + 6],
        [right - 3, footY - 2],
        [left + 3, footY - 2],
        [left - 2, gearTop + 6]
      ],
      palette.outline
    )
    fillCanvasPolygon(
      c,
      [
        [left + 9, gearTop + 1],
        [right - 9, gearTop + 1],
        [right - 2, gearTop + 7],
        [right - 6, footY - 5],
        [left + 6, footY - 5],
        [left + 2, gearTop + 7]
      ],
      '#29302c'
    )
    const wheelCount = visual.hullLength >= 114 ? 6 : 5
    const wheelStep = (visual.hullLength - 24) / (wheelCount - 1)
    for (let i = 0; i < wheelCount; i++) {
      drawBattleTankWheel(c, left + 12 + i * wheelStep, gearCenterY, 7, palette.metal)
    }
    c.fillStyle = palette.metal
    for (let x = left + 8; x < right - 5; x += 12) {
      c.fillRect(Math.round(x), gearTop, 8, 2)
      c.fillRect(Math.round(x + 2), footY - 4, 8, 2)
    }
  } else {
    c.fillStyle = palette.outline
    c.fillRect(left + 5, gearTop + 2, visual.hullLength - 10, 10)
    const wheelCount = visual.chassis === 'box' ? 3 : 4
    const wheelStep = (visual.hullLength - 26) / (wheelCount - 1)
    for (let i = 0; i < wheelCount; i++) {
      drawBattleTankWheel(c, left + 13 + i * wheelStep, gearCenterY + 2, 9, palette.metal)
    }
  }

  const hullBottom = gearTop + (visual.chassis === 'tracked' ? 5 : 7)
  const hullTop = hullBottom - visual.hullHeight
  if (visual.chassis === 'box') {
    fillCanvasPolygon(
      c,
      [
        [left + 4, hullTop + 5],
        [left + 13, hullTop - 7],
        [right - 8, hullTop - 7],
        [right + 2, hullTop + 3],
        [right - 2, hullBottom],
        [left + 2, hullBottom]
      ],
      palette.outline
    )
    fillCanvasPolygon(
      c,
      [
        [left + 7, hullTop + 5],
        [left + 15, hullTop - 4],
        [right - 10, hullTop - 4],
        [right - 1, hullTop + 4],
        [right - 5, hullBottom - 3],
        [left + 5, hullBottom - 3]
      ],
      '#d6d8d1'
    )
    c.fillStyle = '#b93131'
    c.fillRect(centerX - 3, hullTop, 6, 14)
    c.fillRect(centerX - 8, hullTop + 5, 16, 5)
  } else {
    fillCanvasPolygon(
      c,
      [
        [left + 2, hullTop + 8],
        [left + 17, hullTop],
        [right - 18, hullTop],
        [right + 3, hullTop + 9],
        [right - 3, hullBottom],
        [left + 5, hullBottom]
      ],
      palette.outline
    )
    fillCanvasPolygon(
      c,
      [
        [left + 7, hullTop + 8],
        [left + 19, hullTop + 3],
        [right - 19, hullTop + 3],
        [right - 2, hullTop + 10],
        [right - 7, hullBottom - 3],
        [left + 8, hullBottom - 3]
      ],
      palette.primary
    )
  }

  c.fillStyle = palette.secondary
  c.fillRect(left + 14, hullTop + 11, visual.hullLength - 31, 7)
  c.fillStyle = palette.highlight
  c.fillRect(left + 19, hullTop + 4, visual.hullLength - 43, 2)
  c.fillStyle = palette.outline
  c.fillRect(left + 18, hullBottom - 5, visual.hullLength - 36, 2)
  c.fillStyle = '#d7c66e'
  c.fillRect(right - 8, hullTop + 9, 5, 4)
  c.fillStyle = '#252b27'
  c.fillRect(left + 8, hullTop + 8, 4, 9)
  c.fillStyle = palette.metal
  for (let x = left + 22; x < right - 20; x += 18) c.fillRect(x, hullTop + 13, 2, 2)
}

function drawTankTurret(tank: TankState, centerX: number, footY: number, aimAngle = 0, recoil = 0) {
  const c = c2d()
  const visual = battleTankVisualFor(tank.tankId)
  const palette = tankPalette(tank)
  const gearTop = footY - visual.runningGearHeight
  const hullTop = gearTop + (visual.chassis === 'tracked' ? 5 : 7) - visual.hullHeight
  const pivotY = hullTop + 5
  const siege = visual.turret === 'siege'
  const scout = visual.turret === 'scout'
  const wolf = visual.turret === 'wolf'
  const rail = visual.turret === 'rail'
  const medical = visual.turret === 'medical'
  const missile = visual.turret === 'missile'
  const turretWidth = siege ? 52 : rail ? 48 : scout ? 36 : medical ? 42 : 44
  const turretHeight = siege ? 24 : medical || missile ? 22 : 19
  const barrelY = -Math.round(turretHeight * 0.58)

  c.save()
  c.translate(centerX, pivotY)
  c.rotate(aimAngle)
  c.translate(-recoil, 0)

  if (missile) {
    c.fillStyle = palette.outline
    c.fillRect(-23, -25, 47, 25)
    c.fillStyle = palette.secondary
    c.fillRect(-20, -22, 41, 19)
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        c.fillStyle = col === 2 ? '#a64a34' : '#171c19'
        c.fillRect(-15 + col * 13, -18 + row * 9, 9, 5)
      }
    }
    c.fillStyle = palette.metal
    c.fillRect(-4, 0, 8, 5)
  } else {
    const barrelStart = turretWidth / 2 - 2
    const barrelThickness = rail ? 8 : siege ? 9 : 7
    c.fillStyle = palette.outline
    c.fillRect(
      barrelStart,
      barrelY - Math.floor(barrelThickness / 2),
      visual.barrelLength + 6,
      barrelThickness
    )
    c.fillStyle = rail ? '#669ca1' : palette.metal
    c.fillRect(
      barrelStart + 2,
      barrelY - Math.floor(barrelThickness / 2) + 2,
      visual.barrelLength + 2,
      barrelThickness - 4
    )
    if (siege || rail) {
      c.fillStyle = palette.outline
      c.fillRect(
        barrelStart + visual.barrelLength,
        barrelY - Math.floor(barrelThickness / 2) - 3,
        8,
        barrelThickness + 6
      )
      c.fillStyle = rail ? '#c8f4ef' : palette.metal
      c.fillRect(barrelStart + visual.barrelLength + 2, barrelY - 3, 4, 6)
    }

    fillCanvasPolygon(
      c,
      [
        [-turretWidth / 2 - 2, 1],
        [-turretWidth / 2 + 4, -turretHeight + 5],
        [-turretWidth / 2 + 13, -turretHeight],
        [turretWidth / 2 - 7, -turretHeight],
        [turretWidth / 2 + 4, -turretHeight + 8],
        [turretWidth / 2 + 1, 2]
      ],
      palette.outline
    )
    fillCanvasPolygon(
      c,
      [
        [-turretWidth / 2 + 2, -2],
        [-turretWidth / 2 + 7, -turretHeight + 7],
        [-turretWidth / 2 + 15, -turretHeight + 3],
        [turretWidth / 2 - 8, -turretHeight + 3],
        [turretWidth / 2, -turretHeight + 9],
        [turretWidth / 2 - 2, -2]
      ],
      medical ? '#d6d8d1' : palette.primary
    )
    c.fillStyle = medical ? '#b93131' : palette.secondary
    c.fillRect(-turretWidth / 2 + 9, -8, turretWidth - 15, 5)
    c.fillStyle = palette.outline
    c.fillRect(turretWidth / 2 - 3, barrelY - 6, 7, 12)
    c.fillStyle = palette.metal
    c.fillRect(turretWidth / 2 - 1, barrelY - 4, 4, 8)

    c.fillStyle = palette.outline
    c.fillRect(-12, -turretHeight - 6, 18, 7)
    c.fillStyle = medical ? '#d6d8d1' : palette.secondary
    c.fillRect(-9, -turretHeight - 4, 13, 4)
    c.fillStyle = palette.highlight
    c.fillRect(-7, -turretHeight - 3, 7, 1)

    if (wolf) {
      c.fillStyle = '#f0d7b2'
      c.fillRect(-13, -13, 5, 3)
      c.fillRect(4, -13, 5, 3)
      c.fillStyle = '#6e1518'
      c.fillRect(-5, -7, 10, 3)
    } else if (rail) {
      c.fillStyle = '#d9f4ec'
      c.fillRect(-4, -13, 12, 3)
    } else if (siege) {
      c.fillStyle = '#8d7b53'
      c.fillRect(-15, -12, 14, 4)
    } else if (scout) {
      c.fillStyle = '#c6ded5'
      c.fillRect(-3, -turretHeight - 10, 5, 5)
    } else if (medical) {
      c.fillStyle = '#b93131'
      c.fillRect(-2, -16, 5, 13)
      c.fillRect(-6, -12, 13, 5)
    }
  }
  c.restore()
}

function drawBattleFighter(state: GameState, index: number) {
  const fighter = state.battle!.fighters[index]
  const layout = battleFighterLayout(index, fighter.tank?.tankId)
  const { centerX, footY } = layout
  const c = c2d()
  if (fighter.tank && fighter.tank.sp > 0) {
    const tank = fighter.tank
    if (!tank.tankDef) tank.tankDef = TANKS_DEF.find((t) => t.id === tank.tankId)
    tank.sx = layout.impactX
    tank.sy = layout.impactY
    const effect = state.battle!.effect
    const firing =
      effect &&
      Math.abs(effect.fromX - layout.muzzleX) <= 2 &&
      Math.abs(effect.fromY - layout.muzzleY) <= 2
        ? effect
        : null
    const target = state.battle!.mobs.find((mob) => mob.hp > 0)
    const targetX = firing?.toX ?? target?.x
    const targetY = firing?.toY ?? target?.y
    const aimAngle =
      targetX !== undefined && targetY !== undefined
        ? tankAimAngle(centerX, layout.muzzleY, targetX, targetY)
        : 0
    const recoilStrength = firing
      ? firing.weaponKind === 'main'
        ? 5
        : firing.weaponKind === 'sub'
          ? 2
          : firing.weaponKind === 'se'
            ? 3
            : 0
      : 0
    const recoil = firing
      ? Math.round(recoilStrength * (1 - Math.min(1, firing.elapsed / firing.duration)))
      : 0
    drawBattleTankChassis(tank, centerX, footY)
    drawTankTurret(tank, centerX, footY, aimAngle, recoil)
    drawTankWear(c, tank, centerX, footY - 37, state.playtime, 1.25)
    return
  }

  const bob = state.battle!.phase === 'intro' ? 0 : Math.floor(state.playtime * 4 + index) & 1
  if (fighter.member.id === 'hero' && drawAtlasActor('hero', 3, 1, centerX, footY - bob)) return
  const rows =
    fighter.member.id === 'mecha' ? SPR.mecha : fighter.member.id === 'wolf' ? SPR.wolf : SPR.hero
  const scale = 3
  sprite(rows, centerX - (rows[0].length * scale) / 2, footY - rows.length * scale - bob, scale)
}

function effectPoint(effect: BattleEffect, progress: number, arc = 0) {
  const t = clamp(progress, 0, 1)
  return {
    x: effect.fromX + (effect.toX - effect.fromX) * t,
    y: effect.fromY + (effect.toY - effect.fromY) * t - arc * 4 * t * (1 - t)
  }
}

function drawEffectTrail(effect: BattleEffect, progress: number, color: string, arc = 0, size = 3) {
  const c = c2d()
  for (let i = 0; i < 7; i++) {
    const t = progress - i * 0.025
    if (t < 0 || t > 1) continue
    const p = effectPoint(effect, t, arc)
    c.fillStyle = i < 2 ? color : i < 5 ? '#d0b77a' : '#625b51'
    c.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size)
  }
}

function drawPixelBlast(x: number, y: number, phase: number, scale: number, core = '#fff0b0') {
  const c = c2d()
  const pulse = Math.sin(clamp(phase, 0, 1) * Math.PI)
  const radius = Math.max(4, Math.round(((5 + pulse * 25) * scale) / 2) * 2)
  c.fillStyle = '#7e241d'
  fillPixelRect(c, x - radius, y - 4, radius * 2, 8)
  fillPixelRect(c, x - 4, y - radius, 8, radius * 2)
  c.fillStyle = '#e45225'
  fillPixelRect(c, x - radius * 0.65, y - radius * 0.65, radius * 1.3, radius * 1.3)
  c.fillStyle = '#ffae3d'
  fillPixelRect(c, x - radius * 0.38, y - radius * 0.38, radius * 0.76, radius * 0.76)
  c.fillStyle = core
  fillPixelRect(c, x - radius * 0.16, y - radius * 0.16, radius * 0.32, radius * 0.32)
}

function drawMissDust(x: number, y: number, phase: number) {
  const c = c2d()
  const rise = Math.round(phase * 18)
  const spread = 5 + Math.round(phase * 15)
  c.fillStyle = '#9a8b78'
  c.fillRect(x - spread, y - rise, 9, 7)
  c.fillRect(x + spread - 7, y - rise - 6, 7, 7)
  c.fillStyle = '#5c574f'
  c.fillRect(x - 4, y - rise - 12, 8, 8)
}

function drawDamage(effect: BattleEffect, progress: number) {
  if (!effect.hit || effect.dmg <= 0 || progress < 0.58) return
  const lift = Math.round((progress - 0.58) * 40)
  text(String(effect.dmg), effect.toX, effect.toY - 38 - lift, '#fff1bf', 14, 'center', true)
}

const BATTLE_EFFECT_ANCHORS: Record<BattleEffectSpriteKind, [number, number]> = {
  shell: [8, 4],
  missile: [12, 6],
  laser: [12, 4],
  impact: [16, 16],
  'explosion-medium': [24, 24],
  'explosion-heavy': [32, 32]
}

function drawBattleEffectSprite(
  kind: BattleEffectSpriteKind,
  x: number,
  y: number,
  progress: number,
  scale = 1,
  flipX = false
) {
  return atlasRegistry.drawFrame(
    c2d(),
    BATTLE_EFFECT_ATLAS_ID,
    battleEffectFrame(kind, progress),
    x,
    y,
    {
      anchor: BATTLE_EFFECT_ANCHORS[kind],
      scale,
      flipX
    }
  )
}

function drawBattleEffect(effect: BattleEffect) {
  const c = c2d()
  const progress = clamp(effect.elapsed / Math.max(0.001, effect.duration), 0, 1)
  const flight = clamp(progress / 0.66, 0, 1)
  const impact = clamp((progress - 0.56) / 0.44, 0, 1)
  const missX = effect.toX + 36
  const missY = effect.toY - 12

  if (effect.weaponKind === 'human') {
    drawEffectTrail(effect, flight, '#f7f1d5', 5, 3)
    if (progress < 0.18) {
      c.fillStyle = '#fff1a6'
      c.fillRect(effect.fromX - 2, effect.fromY - 4, 12, 8)
    }
    if (impact > 0) {
      if (effect.hit) {
        if (!drawBattleEffectSprite('impact', effect.toX, effect.toY, impact, 0.8))
          drawPixelBlast(effect.toX, effect.toY, impact, 0.45)
      } else drawMissDust(missX, missY, impact)
    }
  } else if (effect.weaponKind === 'main') {
    drawEffectTrail(effect, flight, '#f4d06b', 18, 6)
    const shell = effectPoint(effect, flight, 18)
    if (!drawBattleEffectSprite('shell', shell.x, shell.y, flight)) {
      c.fillStyle = '#292c2b'
      fillPixelRect(c, shell.x - 6, shell.y - 3, 12, 6)
      c.fillStyle = '#e8c56c'
      fillPixelRect(c, shell.x + 3, shell.y - 2, 5, 4)
    }
    if (progress < 0.15) drawPixelBlast(effect.fromX, effect.fromY, progress / 0.15, 0.35)
    if (impact > 0) {
      if (effect.hit) {
        if (!drawBattleEffectSprite('explosion-medium', effect.toX, effect.toY, impact, 1.25))
          drawPixelBlast(effect.toX, effect.toY, impact, 1.05)
      } else drawMissDust(missX + 8, missY, impact)
    }
  } else if (effect.weaponKind === 'sub') {
    for (let i = 0; i < 3; i++) {
      const burst = clamp(progress * 1.45 - i * 0.18, 0, 1)
      if (burst <= 0 || burst >= 1) continue
      const shifted = {
        ...effect,
        fromY: effect.fromY + (i - 1) * 5,
        toY: effect.toY + (i - 1) * 4
      }
      drawEffectTrail(shifted, burst, i === 1 ? '#fff4a2' : '#efbd45', 0, 3)
    }
    if (impact > 0) {
      if (effect.hit) {
        for (let i = -1; i <= 1; i++) {
          if (
            !drawBattleEffectSprite(
              'impact',
              effect.toX + i * 10,
              effect.toY + i * 4,
              clamp(impact - Math.abs(i) * 0.08, 0, 1),
              0.65
            )
          )
            drawPixelBlast(effect.toX + i * 9, effect.toY + i * 4, impact, 0.3)
        }
      } else drawMissDust(missX, missY, impact)
    }
  } else if (effect.weaponKind === 'se') {
    drawEffectTrail(effect, flight, '#ff7840', 82, 5)
    const missile = effectPoint(effect, flight, 82)
    if (!drawBattleEffectSprite('missile', missile.x, missile.y, flight)) {
      c.fillStyle = '#e8e3cf'
      fillPixelRect(c, missile.x - 7, missile.y - 3, 12, 6)
      c.fillStyle = '#d3412f'
      fillPixelRect(c, missile.x + 5, missile.y - 2, 5, 4)
      c.fillStyle = '#ffb348'
      fillPixelRect(c, missile.x - 12, missile.y - 2, 5, 4)
    }
    if (impact > 0) {
      if (effect.hit) {
        if (!drawBattleEffectSprite('explosion-heavy', effect.toX, effect.toY, impact, 1.45))
          drawPixelBlast(effect.toX, effect.toY, impact, 1.55, '#fff8d0')
      } else drawMissDust(missX + 16, missY - 4, impact)
    }
  } else if (effect.weaponKind === 'enemy') {
    const jagged = { ...effect, fromY: effect.fromY - 8, toY: effect.toY + 3 }
    drawEffectTrail(jagged, flight, '#ff6a58', -16, 5)
    drawEffectTrail(effect, clamp(flight - 0.06, 0, 1), '#b52432', 10, 3)
    const laser = effectPoint(jagged, flight, -16)
    drawBattleEffectSprite('laser', laser.x, laser.y, flight, 1, true)
    if (impact > 0 && !drawBattleEffectSprite('impact', effect.toX, effect.toY, impact, 1.1, true))
      drawPixelBlast(effect.toX, effect.toY, impact, 0.7, '#ffd5c5')
  } else {
    const grenade = effectPoint(effect, flight, 88)
    c.fillStyle = '#171d1b'
    fillPixelRect(c, grenade.x - 4, grenade.y - 4, 8, 8)
    c.fillStyle = '#7f9a62'
    fillPixelRect(c, grenade.x - 2, grenade.y - 2, 4, 4)
    c.fillStyle = '#f2c05d'
    fillPixelRect(c, grenade.x - 7, grenade.y - 7, 3, 3)
    if (
      impact > 0 &&
      !drawBattleEffectSprite('explosion-medium', effect.toX, effect.toY, impact, 1.35)
    )
      drawPixelBlast(effect.toX, effect.toY, impact, 1.15)
  }
  drawDamage(effect, progress)
}

export function drawBattleScene(state: GameState) {
  const battle = state.battle
  if (!battle) return
  drawBattleBackdrop(state, battle.environment)
  const outdoor =
    battle.environment !== 'cave' &&
    battle.environment !== 'final' &&
    (state.map === 'world' || TOWNS.some((town) => town.id === state.map))
  const battleGroundTop =
    battle.environment === 'town'
      ? 326
      : battle.environment === 'forest'
        ? 286
        : battle.environment === 'mountain'
          ? 288
          : battle.environment === 'desert'
            ? 298
            : 294
  const battleAtmosphere: AtmosphereViewport = {
    width: W,
    height: H,
    cameraX: 0,
    cameraY: 0,
    tileSize: 40,
    biome: battleAtmosphereBiome(battle.environment),
    groundTop: battleGroundTop
  }
  if (outdoor) drawWetGround(c2d(), state, battleAtmosphere)
  for (let i = 0; i < battle.mobs.length; i++) {
    const mob = battle.mobs[i]
    const selected = battle.cmd?.mode === 'target' && battle.cmd.idx === i && mob.hp > 0
    const queuedImpact = battle.pending.some(
      (action) => action.kind === 'anim' && action.hit && action.tx === mob.x && action.ty === mob.y
    )
    const activeImpact =
      !!battle.effect &&
      battle.effect.hit &&
      battle.effect.toX === mob.x &&
      battle.effect.toY === mob.y &&
      battle.effect.elapsed < battle.effect.duration * 0.9
    drawBattleMob(mob, i, battle.mobs.length, selected, mob.hp > 0 || queuedImpact || activeImpact)
  }
  for (let i = 0; i < battle.fighters.length; i++) drawBattleFighter(state, i)

  const c = c2d()
  if (outdoor) {
    drawOutdoorLighting(c, state, W, H)
    if (battle.environment === 'town') {
      drawNightLights(
        c,
        state,
        [
          { x: 82, y: 220, kind: 'door' },
          { x: 260, y: 226, kind: 'door' },
          { x: 462, y: 208, kind: 'door' },
          { x: 606, y: 230, kind: 'door' }
        ],
        1.35
      )
    }
    drawWeatherParticles(c, state, battleAtmosphere)
  }
  if (battle.phase === 'intro') {
    c.fillStyle = `rgba(10,7,7,${Math.max(0, 0.64 - battle.introT * 0.7)})`
    c.fillRect(0, 0, W, 350)
  }
  if (battle.effect) drawBattleEffect(battle.effect)
}

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

/* 城镇/洞窟/室内网格缓存（由 world 系统填充，渲染共享） */
import type { CaveGrid, RoomGrid, TownGrid } from '@/game/types'

export const townGrids = new Map<string, TownGrid>()
export const caveGrids = new Map<string, CaveGrid>()
export const roomGrids = new Map<string, RoomGrid>()

export function buildTownGrid(town: (typeof TOWNS)[number]): TownGrid {
  if (townGrids.has(town.id)) return townGrids.get(town.id)!
  const [w, h] = town.size
  const grid: string[][] = Array.from({ length: h }, () => Array(w).fill(' '))
  for (let x = 0; x < w; x++) {
    grid[0][x] = '#'
    grid[h - 1][x] = '#'
  }
  for (let y = 0; y < h; y++) {
    grid[y][0] = '#'
    grid[y][w - 1] = '#'
  }
  for (const b of town.buildings) {
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++)
        if (grid[y] && grid[y][x] !== undefined) grid[y][x] = 'B'
    if (b.open !== false) grid[b.door[1]][b.door[0]] = 'd'
  }
  grid[h - 2][Math.floor(w / 2)] = 'E'
  const g: TownGrid = {
    map: grid.map((r) => r.join('')),
    npcs: town.npcs,
    buildings: town.buildings,
    exit: [Math.floor(w / 2), h - 2],
    size: [w, h]
  }
  townGrids.set(town.id, g)
  return g
}

export function buildCaveGrid(cave: (typeof CAVES)[number]): CaveGrid {
  if (caveGrids.has(cave.id)) return caveGrids.get(cave.id)!
  const [w, h] = cave.size
  const hasLayout = cave.layout?.length === h && cave.layout.every((row) => row.length === w)
  const grid: string[][] = hasLayout
    ? cave.layout!.map((row) => [...row].map((ch) => (ch === '.' ? ' ' : ch)))
    : Array.from({ length: h }, () => Array(w).fill('#'))
  const conn = (x0: number, y0: number, x1: number, y1: number) => {
    let x = x0,
      y = y0
    while (x !== x1 || y !== y1) {
      grid[y][x] = ' '
      if (x !== x1 && (y === y1 || Math.abs(x - x1) >= Math.abs(y - y1))) x += x1 > x0 ? 1 : -1
      else y += y1 > y0 ? 1 : -1
    }
    grid[y][x] = ' '
  }
  if (!hasLayout) {
    for (const r of cave.rooms) {
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y][x] = ' '
    }
    for (let i = 1; i < cave.rooms.length; i++) {
      const a = cave.rooms[i - 1],
        b = cave.rooms[i]
      conn(a.x + a.w - 1, a.y + Math.floor(a.h / 2), b.x, b.y + Math.floor(b.h / 2))
    }
  }
  for (const ch of cave.chests) grid[ch.y][ch.x] = 'I'
  for (const ev of cave.events) grid[ev.y][ev.x] = 'X'
  for (const ex of cave.exits) grid[ex.y][ex.x] = 'E'
  const g: CaveGrid = { map: grid.map((r) => r.join('')), size: [w, h], cave }
  caveGrids.set(cave.id, g)
  return g
}

export function buildRoomGrid(room: RoomDef): RoomGrid {
  if (roomGrids.has(room.id)) return roomGrids.get(room.id)!
  const [w, h] = room.size
  const hasLayout = room.layout?.length === h && room.layout.every((row) => row.length === w)
  const grid: string[][] = hasLayout
    ? room.layout!.map((row) => [...row].map((ch) => (ch === '.' ? ' ' : ch)))
    : Array.from({ length: h }, () => Array(w).fill(' '))
  if (!hasLayout) {
    for (let x = 0; x < w; x++) {
      grid[0][x] = '#'
      grid[h - 1][x] = '#'
    }
    for (let y = 0; y < h; y++) {
      grid[y][0] = '#'
      grid[y][w - 1] = '#'
    }
  }
  for (const f of room.furniture || []) {
    if (!ROOM_ENTITY_TYPES.has(f.t)) continue
    for (let y = f.y; y < f.y + f.h; y++)
      for (let x = f.x; x < f.x + f.w; x++)
        if (grid[y] && grid[y][x] !== undefined && grid[y][x] !== 'E') grid[y][x] = 'B'
  }
  grid[room.exit[1]][room.exit[0]] = 'E'
  const g: RoomGrid = { map: grid.map((r) => r.join('')), size: [w, h], room }
  roomGrids.set(room.id, g)
  return g
}
