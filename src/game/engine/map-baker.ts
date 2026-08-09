import { CAVES, ROOMS, TOWNS, WORLD, WORLD_H, WORLD_W } from '@/game/data/maps'
import type { CaveGrid, RoomDef, RoomGrid, TownGrid } from '@/game/types'
import {
  DECOR_BLOCK,
  TS,
  drawBuilding,
  drawCaveTile,
  drawDecor,
  drawFurniture,
  drawGarageBay,
  drawRoomTile,
  drawTownTile,
  drawWorldTile,
  hash,
  neighbors,
  townDecor
} from '@/game/engine/tileart'

const FALLBACK_VIEW_WIDTH = 20
const FALLBACK_VIEW_HEIGHT = 15

export const DYNAMIC_ROOM_ENTITY_TYPES = new Set([
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

export const townGrids = new Map<string, TownGrid>()
export const caveGrids = new Map<string, CaveGrid>()
export const roomGrids = new Map<string, RoomGrid>()

const bakedMaps = new Map<string, HTMLCanvasElement>()

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable for map texture generation')
  context.imageSmoothingEnabled = false
  return { canvas, context }
}

export function invalidateMap(mapId: string) {
  bakedMaps.delete(mapId)
  bakedMaps.delete(`${mapId}:ground`)
}

export function buildTownGrid(town: (typeof TOWNS)[number]): TownGrid {
  const cached = townGrids.get(town.id)
  if (cached) return cached
  const [width, height] = town.size
  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(' '))
  for (let x = 0; x < width; x++) {
    grid[0][x] = '#'
    grid[height - 1][x] = '#'
  }
  for (let y = 0; y < height; y++) {
    grid[y][0] = '#'
    grid[y][width - 1] = '#'
  }
  for (const building of town.buildings) {
    for (let y = building.y; y < building.y + building.h; y++) {
      for (let x = building.x; x < building.x + building.w; x++) {
        if (grid[y]?.[x] !== undefined) grid[y][x] = 'B'
      }
    }
    if (building.open !== false) grid[building.door[1]][building.door[0]] = 'd'
  }
  grid[height - 2][Math.floor(width / 2)] = 'E'
  const result: TownGrid = {
    map: grid.map((row) => row.join('')),
    npcs: town.npcs,
    buildings: town.buildings,
    exit: [Math.floor(width / 2), height - 2],
    size: [width, height]
  }
  townGrids.set(town.id, result)
  return result
}

export function buildCaveGrid(cave: (typeof CAVES)[number]): CaveGrid {
  const cached = caveGrids.get(cave.id)
  if (cached) return cached
  const [width, height] = cave.size
  const hasLayout =
    cave.layout?.length === height && cave.layout.every((row) => row.length === width)
  const grid: string[][] = hasLayout
    ? cave.layout!.map((row) => [...row].map((character) => (character === '.' ? ' ' : character)))
    : Array.from({ length: height }, () => Array(width).fill('#'))

  const connect = (startX: number, startY: number, endX: number, endY: number) => {
    let x = startX
    let y = startY
    while (x !== endX || y !== endY) {
      grid[y][x] = ' '
      if (x !== endX && (y === endY || Math.abs(x - endX) >= Math.abs(y - endY))) {
        x += endX > startX ? 1 : -1
      } else {
        y += endY > startY ? 1 : -1
      }
    }
    grid[y][x] = ' '
  }

  if (!hasLayout) {
    for (const room of cave.rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) grid[y][x] = ' '
      }
    }
    for (let index = 1; index < cave.rooms.length; index++) {
      const previous = cave.rooms[index - 1]
      const current = cave.rooms[index]
      connect(
        previous.x + previous.w - 1,
        previous.y + Math.floor(previous.h / 2),
        current.x,
        current.y + Math.floor(current.h / 2)
      )
    }
  }
  for (const chest of cave.chests) grid[chest.y][chest.x] = 'I'
  for (const event of cave.events) grid[event.y][event.x] = 'X'
  for (const exit of cave.exits) grid[exit.y][exit.x] = 'E'
  const result: CaveGrid = {
    map: grid.map((row) => row.join('')),
    size: [width, height],
    cave
  }
  caveGrids.set(cave.id, result)
  return result
}

export function buildRoomGrid(room: RoomDef): RoomGrid {
  const cached = roomGrids.get(room.id)
  if (cached) return cached
  const [width, height] = room.size
  const hasLayout =
    room.layout?.length === height && room.layout.every((row) => row.length === width)
  const grid: string[][] = hasLayout
    ? room.layout!.map((row) => [...row].map((character) => (character === '.' ? ' ' : character)))
    : Array.from({ length: height }, () => Array(width).fill(' '))
  if (!hasLayout) {
    for (let x = 0; x < width; x++) {
      grid[0][x] = '#'
      grid[height - 1][x] = '#'
    }
    for (let y = 0; y < height; y++) {
      grid[y][0] = '#'
      grid[y][width - 1] = '#'
    }
  }
  for (const furniture of room.furniture || []) {
    if (!DYNAMIC_ROOM_ENTITY_TYPES.has(furniture.t)) continue
    for (let y = furniture.y; y < furniture.y + furniture.h; y++) {
      for (let x = furniture.x; x < furniture.x + furniture.w; x++) {
        if (grid[y]?.[x] !== undefined && grid[y][x] !== 'E') grid[y][x] = 'B'
      }
    }
  }
  grid[room.exit[1]][room.exit[0]] = 'E'
  const result: RoomGrid = {
    map: grid.map((row) => row.join('')),
    size: [width, height],
    room
  }
  roomGrids.set(room.id, result)
  return result
}

function bakeWorld(): HTMLCanvasElement {
  const { canvas, context } = makeCanvas(WORLD_W * TS, WORLD_H * TS)
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      drawWorldTile({ ctx: context, x, y, h: hash(x, y), n: neighbors(WORLD, x, y) }, WORLD[y][x])
    }
  }
  return canvas
}

function bakeTown(town: (typeof TOWNS)[number], includeStructures: boolean): HTMLCanvasElement {
  const [width, height] = town.size
  const grid = buildTownGrid(town).map
  const { canvas, context } = makeCanvas(width * TS, height * TS)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      drawTownTile(
        { ctx: context, x, y, h: hash(x, y, 101), n: neighbors(grid, x, y) },
        grid[y][x],
        town
      )
    }
  }
  if (includeStructures) {
    for (const building of town.buildings) {
      drawBuilding(context, building, hash(building.x, building.y, 202), town.id)
    }
  }
  for (const decor of [...townDecor(town), ...(town.decor || [])]) {
    if (!DECOR_BLOCK.has(decor.t)) {
      drawDecor(context, decor.t, decor.x, decor.y, hash(decor.x, decor.y, 303), 0, 0, town.id)
    }
  }
  return canvas
}

function bakeCave(cave: (typeof CAVES)[number]): HTMLCanvasElement {
  const [width, height] = cave.size
  const grid = buildCaveGrid(cave).map
  const { canvas, context } = makeCanvas(width * TS, height * TS)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      drawCaveTile({ ctx: context, x, y, h: hash(x, y, 404), n: neighbors(grid, x, y) }, grid[y][x])
    }
  }
  return canvas
}

function bakeRoom(room: RoomDef): HTMLCanvasElement {
  const [width, height] = room.size
  const grid = buildRoomGrid(room).map
  const { canvas, context } = makeCanvas(width * TS, height * TS)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      drawRoomTile(
        { ctx: context, x, y, h: hash(x, y, 505), n: neighbors(grid, x, y) },
        grid[y][x],
        room
      )
    }
  }
  for (const [index, slot] of (room.garageSlots || []).entries()) {
    drawGarageBay(context, slot, index)
  }
  for (const furniture of room.furniture || []) {
    if (!DYNAMIC_ROOM_ENTITY_TYPES.has(furniture.t)) {
      drawFurniture(context, furniture, hash(furniture.x, furniture.y, 606), 0, 0, room.town)
    }
  }
  for (const decor of room.decor || []) {
    drawDecor(context, decor.t, decor.x, decor.y, hash(decor.x, decor.y, 707))
  }
  return canvas
}

export function bakeMap(
  mapId: string,
  options: { includeStructures?: boolean } = {}
): HTMLCanvasElement {
  const includeStructures = options.includeStructures !== false
  const cacheKey = includeStructures ? mapId : `${mapId}:ground`
  const cached = bakedMaps.get(cacheKey)
  if (cached) return cached
  const town = TOWNS.find((item) => item.id === mapId)
  const cave = CAVES.find((item) => item.id === mapId)
  const room = ROOMS.find((item) => item.id === mapId)
  const canvas =
    mapId === 'world'
      ? bakeWorld()
      : town
        ? bakeTown(town, includeStructures)
        : cave
          ? bakeCave(cave)
          : room
            ? bakeRoom(room)
            : makeCanvas(FALLBACK_VIEW_WIDTH * TS, FALLBACK_VIEW_HEIGHT * TS).canvas
  bakedMaps.set(cacheKey, canvas)
  return canvas
}
