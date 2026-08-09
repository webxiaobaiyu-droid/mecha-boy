/* 32x32 场景瓦片渲染。室内与角色可使用图集，地形和建筑保留数据驱动绘制。 */

import type { RoomDef, TownDef } from '@/game/types'
import { atlasRegistry } from '@/game/engine/atlas'

export const TS = 32

const C = {
  grass: '#3f8f34',
  grassDK: '#2f7226',
  grassLT: '#54a542',
  grassL2: '#6fc258',
  grassL3: '#84d26a',
  dirt: '#a88654',
  dirtDK: '#8c6c3f',
  dirtLT: '#ba9a62',
  sand: '#d8c878',
  sandDK: '#bcaa60',
  sandLT: '#ecd88e',
  water: '#2c5cc4',
  waterDK: '#1c3f96',
  waterLT: '#4a7ad8',
  waterL2: '#6a96e8',
  foam: '#a8d0f0',
  stone: '#8b8b97',
  stoneDK: '#666674',
  stoneLT: '#a0a0ac',
  stoneEDGE: '#4c4c58',
  rock: '#7a7a86',
  rockDK: '#5a5a66',
  rockLT: '#8e8e9a',
  wood: '#8a5a34',
  woodDK: '#5f3d20',
  woodLT: '#a87448',
  wallCream: '#c9b896',
  wallGray: '#9ba0a8',
  wallTan: '#b09a74',
  wallDK: '#6e5c46',
  wallLT: '#d8c8a8',
  roofRed: '#b5503a',
  roofRedDK: '#8f3d2a',
  roofBrown: '#8a6238',
  roofBrownDK: '#6d4a28',
  roofSlate: '#5e7c92',
  roofSlateDK: '#48627a',
  roofGreen: '#6c8a48',
  roofGreenDK: '#55723a',
  door: '#4a2c16',
  doorDK: '#311c0c',
  frame: '#8a6a44',
  win: '#24337f',
  winLt: '#4658b8',
  winGlow: '#f8d878',
  metal: '#8b9099',
  metalDK: '#565c66',
  metalLT: '#acb2bc',
  red: '#d84438',
  redDK: '#a83028',
  gold: '#e8b838',
  white: '#e8e8e8'
}

export interface TileGfx {
  ctx: CanvasRenderingContext2D
  x: number
  y: number
  h: number
  n: Nbr
}

export interface Nbr {
  N: string
  S: string
  E: string
  W: string
  NE: string
  NW: string
  SE: string
  SW: string
}

export function neighbors(grid: string[], x: number, y: number): Nbr {
  const at = (xx: number, yy: number) =>
    yy >= 0 && yy < grid.length && xx >= 0 && xx < grid[yy].length ? grid[yy][xx] : '#'
  return {
    N: at(x, y - 1),
    S: at(x, y + 1),
    E: at(x + 1, y),
    W: at(x - 1, y),
    NE: at(x + 1, y - 1),
    NW: at(x - 1, y - 1),
    SE: at(x + 1, y + 1),
    SW: at(x - 1, y + 1)
  }
}

export function hash(x: number, y: number, seed = 0): number {
  let v = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed * 2246822519
  v = Math.imul(v ^ (v >>> 13), 1274126177)
  v ^= v >>> 16
  return ((v >>> 0) % 100000) / 100000
}

function smoothNoise(x: number, y: number, scale: number, seed: number) {
  const gx = Math.floor(x / scale),
    gy = Math.floor(y / scale)
  const tx0 = x / scale - gx,
    ty0 = y / scale - gy
  const tx = tx0 * tx0 * (3 - 2 * tx0)
  const ty = ty0 * ty0 * (3 - 2 * ty0)
  const n00 = hash(gx, gy, seed),
    n10 = hash(gx + 1, gy, seed)
  const n01 = hash(gx, gy + 1, seed),
    n11 = hash(gx + 1, gy + 1, seed)
  const north = n00 + (n10 - n00) * tx
  const south = n01 + (n11 - n01) * tx
  return north + (south - north) * ty
}

function P(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

function fill(ctx: CanvasRenderingContext2D, pts: [number, number][], c: string) {
  ctx.fillStyle = c
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fill()
}

const isW = (ch: string) => ch === 'w'
const isRoad = (ch: string) => ch === 'r' || ch === 't' || ch === 'D' || ch === 'G' || ch === 'F'

/* ================= 世界地图 ================= */

function grassTile(g: TileGfx, props: boolean) {
  const { ctx, x, y } = g
  const px = x * TS,
    py = y * TS
  const macro = smoothNoise(x, y, 7, 51)
  const meadow =
    macro < 0.34
      ? { base: '#3e7d36', dark: '#34702f', mid: '#46863b', light: '#519044', blade: '#65a14e' }
      : macro > 0.68
        ? { base: '#4a7f39', dark: '#3d6f32', mid: '#548840', light: '#60934a', blade: '#75a856' }
        : { base: '#438039', dark: '#376f31', mid: '#4a873d', light: '#579345', blade: '#6aa84f' }

  P(ctx, px, py, TS, TS, meadow.base)
  // 以世界坐标采样微地貌，色斑跨瓦片连续，不再暴露 32px 方格边界。
  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 8; cx++) {
      const gx = x * 8 + cx
      const gy = y * 8 + cy
      const field = smoothNoise(gx, gy, 19, 151)
      const grain = hash(gx, gy, 152)
      const color =
        field < 0.3
          ? meadow.dark
          : field > 0.71
            ? meadow.light
            : grain > 0.76
              ? meadow.mid
              : meadow.base
      if (color !== meadow.base) P(ctx, px + cx * 4, py + cy * 4, 4, 4, color)
      if (grain > 0.93) P(ctx, px + cx * 4 + 1, py + cy * 4 + 1, 2, 1, meadow.blade)
    }
  }

  // 更细的草叶、秆和地表亮点。
  const bladeCount = macro > 0.68 ? 7 : 10
  for (let i = 0; i < bladeCount; i++) {
    const bx = (px + (hash(x * 7 + i, y * 13, 1) * 28 + 2)) | 0
    const by = (py + (hash(x * 11, y * 7 + i, 2) * 28 + 2)) | 0
    P(ctx, bx, by, 1, 3, meadow.light)
    if (hash(x * 3 + i, y * 5, 3) > 0.6) P(ctx, bx, by, 1, 2, meadow.blade)
  }
  if (props) {
    const r = hash(x, y, 7)
    if (r > 0.86) flower(ctx, px, py, 0)
    else if (r > 0.82) bush(ctx, px, py, hash(x, y, 8))
    else if (r > 0.78) rockProp(ctx, px, py, hash(x, y, 9))
    else if (r > 0.75) stump(ctx, px, py)
  }
}

function flower(ctx: CanvasRenderingContext2D, px: number, py: number, v: number) {
  const fx = px + 6 + ((v * 18) | 0),
    fy = py + 8 + ((v * 14) | 0)
  const col = v > 0.5 ? '#f8e048' : v > 0.25 ? '#f0a0b0' : '#f0f8f8'
  P(ctx, fx + 2, fy, 1, 4, '#2f7226')
  P(ctx, fx, fy, 3, 3, col)
  P(ctx, fx + 1, fy + 1, 1, 1, '#f8f0d8')
}

function bush(ctx: CanvasRenderingContext2D, px: number, py: number, h: number) {
  const bx = px + 8 + ((h * 8) | 0),
    by = py + 14 + ((h * 8) | 0)
  P(ctx, bx + 4, by, 6, 4, '#8a6a44')
  P(ctx, bx, by - 3, 10, 6, C.grassDK)
  P(ctx, bx + 1, by - 4, 8, 4, '#3e8f34')
  P(ctx, bx + 2, by - 5, 4, 3, '#54a542')
}

function rockProp(ctx: CanvasRenderingContext2D, px: number, py: number, h: number) {
  const rx = px + 4 + ((h * 12) | 0),
    ry = py + 12 + ((h * 10) | 0)
  P(ctx, rx, ry, 10, 7, C.rockDK)
  P(ctx, rx + 2, ry - 2, 7, 4, C.rock)
  P(ctx, rx + 3, ry - 3, 4, 3, C.rockLT)
  P(ctx, rx, ry + 4, 10, 2, C.rockDK)
}

function stump(ctx: CanvasRenderingContext2D, px: number, py: number) {
  const sx = px + 9,
    sy = py + 16
  P(ctx, sx, sy, 10, 6, C.wood)
  P(ctx, sx + 1, sy + 1, 8, 4, C.woodLT)
  P(ctx, sx + 2, sy + 2, 6, 1, '#c9a46c')
  P(ctx, sx + 4, sy + 2, 1, 4, C.woodDK)
  P(ctx, sx + 7, sy + 2, 1, 3, C.woodDK)
  P(ctx, sx, sy + 5, 10, 1, C.woodDK)
}

function waterTile(g: TileGfx) {
  const { ctx, x, y, h, n } = g
  const px = x * TS,
    py = y * TS
  P(ctx, px, py, TS, TS, C.water)
  P(ctx, px, py, TS, 20, C.waterLT)
  P(ctx, px + 6, py + 18, 16, 10, C.water)
  P(ctx, px + 10, py + 21, 10, 6, C.waterDK)
  // 内部水波
  const w1 = hash(x, y, 4)
  P(ctx, px + 4 + ((w1 * 20) | 0), py + 7 + ((w1 * 10) | 0), 7, 1, C.waterL2)
  const w2 = hash(x, y, 5)
  P(ctx, px + 14 + ((w2 * 12) | 0), py + 15 + ((w2 * 8) | 0), 5, 1, C.waterL2)
  if (h > 0.65) P(ctx, px + 20, py + 4, 6, 1, C.foam)
  // 岸边（与陆地相接处铺沙 + 泡沫）
  const beach = (sx: number, sy: number, wd: number, hd: number, dir: 'N' | 'S' | 'E' | 'W') => {
    P(ctx, sx, sy, wd, hd, C.sand)
    if (dir === 'N' || dir === 'S')
      P(ctx, sx + 2, dir === 'N' ? sy + 3 : sy + hd - 4, wd - 4, 2, C.foam)
    else P(ctx, dir === 'W' ? sx + 3 : sx + wd - 5, sy + 2, 2, hd - 4, C.foam)
  }
  if (!isW(n.N)) beach(px, py, TS, 6, 'N')
  if (!isW(n.S)) beach(px, py + 26, TS, 6, 'S')
  if (!isW(n.W)) beach(px, py, 6, TS, 'W')
  if (!isW(n.E)) beach(px + 26, py, 6, TS, 'E')
  // 角落沙角
  if (!isW(n.N) && !isW(n.W) && !isW(n.NW))
    fill(
      ctx,
      [
        [px, py],
        [px + 8, py],
        [px, py + 8]
      ],
      C.sand
    )
  if (!isW(n.N) && !isW(n.E) && !isW(n.NE))
    fill(
      ctx,
      [
        [px + TS, py],
        [px + TS - 8, py],
        [px + TS, py + 8]
      ],
      C.sand
    )
  if (!isW(n.S) && !isW(n.W) && !isW(n.SW))
    fill(
      ctx,
      [
        [px, py + TS],
        [px + 8, py + TS],
        [px, py + TS - 8]
      ],
      C.sand
    )
  if (!isW(n.S) && !isW(n.E) && !isW(n.SE))
    fill(
      ctx,
      [
        [px + TS, py + TS],
        [px + TS - 8, py + TS],
        [px + TS, py + TS - 8]
      ],
      C.sand
    )
}

function sandTile(g: TileGfx) {
  const { ctx, x, y, h, n } = g
  const px = x * TS,
    py = y * TS
  P(ctx, px, py, TS, TS, C.sand)
  P(ctx, px, py, TS, 12, C.sandLT)
  // 沙纹
  for (let i = 0; i < 4; i++) {
    const yy = py + 6 + i * 6 + ((hash(x, y, i) * 2) | 0)
    P(ctx, px + 3, yy, 26, 1, C.sandDK)
  }
  if (h > 0.5) P(ctx, px + 6, py + 20, 8, 2, C.sandDK)
  // 与草地过渡的浅色边缘
  const fringe = (sx: number, sy: number, wd: number, hd: number) =>
    P(ctx, sx, sy, wd, hd, C.sandLT)
  if (n.N !== 's' && n.N !== 'r') fringe(px, py, TS, 4)
  if (n.S !== 's' && n.S !== 'r') fringe(px, py + 28, TS, 4)
  if (n.W !== 's' && n.W !== 'r') fringe(px, py, 4, TS)
  if (n.E !== 's' && n.E !== 'r') fringe(px + 28, py, 4, TS)
  // 点缀
  const r = hash(x, y, 6)
  if (r > 0.86) cactus(ctx, px, py)
  else if (r > 0.8) {
    P(ctx, px + 6 + ((hash(x, y, 11) * 16) | 0), py + 20, 4, 5, C.rockDK)
    P(ctx, px + 5 + ((hash(x, y, 11) * 16) | 0), py + 24, 6, 2, C.rockDK)
  }
}

function cactus(ctx: CanvasRenderingContext2D, px: number, py: number) {
  const cx = px + 13,
    cy = py + 10
  P(ctx, cx, cy, 5, 13, '#3f7a3a')
  P(ctx, cx, cy, 2, 13, '#57a04c')
  P(ctx, cx - 5, cy + 3, 5, 3, '#3f7a3a')
  P(ctx, cx - 5, cy + 3, 2, 3, '#57a04c')
  P(ctx, cx + 5, cy + 6, 5, 3, '#3f7a3a')
  P(ctx, cx + 5, cy + 6, 2, 3, '#57a04c')
  P(ctx, cx, cy + 10, 6, 1, C.gold)
}

function roadTile(g: TileGfx) {
  const { ctx, x, y, n } = g
  const px = x * TS,
    py = y * TS
  // 桥：上下为水且道路连续
  const bridgeV = isW(n.N) && isW(n.S) && (isRoad(n.N) || isW(n.N)) && (isRoad(n.S) || isW(n.S))
  const bridgeH = isW(n.W) && isW(n.E)
  if (bridgeV || bridgeH) {
    P(ctx, px, py, TS, TS, C.woodDK)
    for (let i = 0; i < 6; i++)
      P(
        ctx,
        px + (bridgeV ? 2 : 0) + i * (bridgeV ? 4 : 0),
        py + (bridgeH ? 2 : 0) + i * (bridgeH ? 4 : 0),
        bridgeV ? 4 : TS - 4,
        bridgeH ? 4 : TS - 4,
        C.wood
      )
    P(ctx, px + 2, py + 2, TS - 4, 2, C.woodLT)
    P(ctx, px + 2, py + 28, TS - 4, 2, C.woodDK)
    P(ctx, px + 2, py + 2, 2, TS - 4, C.woodLT)
    P(ctx, px + 28, py + 2, 2, TS - 4, C.woodDK)
    return
  }
  P(ctx, px, py, TS, TS, C.dirt)
  // 与草地接壤的毛边
  if (!isRoad(n.N))
    for (let i = 0; i < 4; i++) P(ctx, px + i * 8 + ((hash(x, y, i) * 4) | 0), py, 5, 3, C.grass)
  if (!isRoad(n.S))
    for (let i = 0; i < 4; i++)
      P(ctx, px + i * 8 + ((hash(x, y, i + 9) * 4) | 0), py + 29, 5, 3, C.grass)
  if (!isRoad(n.W))
    for (let i = 0; i < 4; i++)
      P(ctx, px, py + i * 8 + ((hash(x, y, i + 19) * 4) | 0), 3, 5, C.grass)
  if (!isRoad(n.E))
    for (let i = 0; i < 4; i++)
      P(ctx, px + 29, py + i * 8 + ((hash(x, y, i + 29) * 4) | 0), 3, 5, C.grass)
  // 车辙
  if (isRoad(n.N) && isRoad(n.S)) {
    P(ctx, px + 6, py + 1, 3, 30, C.dirtDK)
    P(ctx, px + 22, py + 1, 3, 30, C.dirtDK)
  } else if (isRoad(n.W) && isRoad(n.E)) {
    P(ctx, px + 1, py + 6, 30, 3, C.dirtDK)
    P(ctx, px + 1, py + 22, 30, 3, C.dirtDK)
  }
  // 碎石
  for (let i = 0; i < 5; i++) {
    const sx = (px + (hash(x * 5 + i, y, 21) * 26 + 2)) | 0
    const sy = (py + (hash(x, y * 7 + i, 22) * 26 + 2)) | 0
    P(ctx, sx, sy, 2, 2, C.dirtLT)
    P(ctx, sx, sy + 1, 2, 1, C.dirtDK)
  }
}

function checkpointTile(g: TileGfx) {
  const { ctx, x, y } = g
  const px = x * TS,
    py = y * TS
  roadTile(g)
  // 两侧岗亭永久保留；动态栏杆由 Pixi 实体层根据存档状态叠加。
  P(ctx, px + 1, py + 5, 8, 22, '#343b3d')
  P(ctx, px + 2, py + 6, 6, 19, '#586062')
  P(ctx, px + 3, py + 8, 4, 5, '#91a3a0')
  P(ctx, px + 23, py + 5, 8, 22, '#343b3d')
  P(ctx, px + 24, py + 6, 6, 19, '#586062')
  P(ctx, px + 25, py + 8, 4, 5, '#91a3a0')
  P(ctx, px + 1, py + 25, 8, 3, '#202628')
  P(ctx, px + 23, py + 25, 8, 3, '#202628')
}

function fordTile(g: TileGfx) {
  const { ctx, x, y, h } = g
  const px = x * TS,
    py = y * TS
  waterTile(g)
  P(ctx, px, py + 12, TS, 9, '#587b72')
  P(ctx, px, py + 14, TS, 5, '#769185')
  for (let i = 0; i < 5; i++) {
    const sx = px + 2 + i * 7
    const sy = py + 13 + ((hash(x, y, i + 80) * 4) | 0)
    P(ctx, sx, sy, 5, 4, i % 2 ? '#777b72' : '#8b897a')
    P(ctx, sx, sy, 5, 1, '#a4a18e')
  }
  if (h > 0.4) {
    P(ctx, px + 2, py + 4, 2, 9, '#597746')
    P(ctx, px + 28, py + 19, 2, 10, '#597746')
  }
}

function forestTile(g: TileGfx) {
  const { ctx, x, y, h, n } = g
  const px = x * TS,
    py = y * TS
  P(ctx, px, py, TS, TS, C.grass)
  const edgeN = n.N !== 'f' && n.N !== 'r' && n.N !== 't' && n.N !== 'D'
  const edgeS = n.S !== 'f'
  const edgeW = n.W !== 'f' && n.W !== 'r' && n.W !== 't' && n.W !== 'D'
  const edgeE = n.E !== 'f'
  if (h > 0.5) {
    // 阔叶树
    const cx = px + 14,
      cy = py + 14
    fill(
      ctx,
      [
        [cx - 13, cy + 6],
        [cx - 9, cy - 4],
        [cx - 2, cy - 8],
        [cx + 6, cy - 3],
        [cx + 12, cy + 6],
        [cx, cy + 10]
      ],
      C.grassDK
    )
    fill(
      ctx,
      [
        [cx - 10, cy + 6],
        [cx - 7, cy - 2],
        [cx, cy - 6],
        [cx + 7, cy - 1],
        [cx + 10, cy + 6],
        [cx, cy + 9]
      ],
      '#4d9c3e'
    )
    fill(
      ctx,
      [
        [cx - 6, cy + 2],
        [cx - 3, cy - 4],
        [cx + 2, cy - 6],
        [cx + 6, cy - 2],
        [cx + 7, cy + 3],
        [cx, cy + 5]
      ],
      C.grassLT
    )
    P(ctx, cx - 1, cy + 9, 3, 6, '#6e4c28')
    if (edgeN) P(ctx, px, py, TS, 4, C.grass)
    if (edgeS) P(ctx, px, py + 28, TS, 4, C.grass)
    if (edgeW) P(ctx, px, py, 4, TS, C.grass)
    if (edgeE) P(ctx, px + 28, py, 4, TS, C.grass)
  } else {
    // 针叶树
    const cx = px + 15
    fill(
      ctx,
      [
        [cx - 12, py + 22],
        [cx - 6, py + 6],
        [cx, py + 2],
        [cx + 6, py + 6],
        [cx + 12, py + 22]
      ],
      C.grassDK
    )
    fill(
      ctx,
      [
        [cx - 9, py + 20],
        [cx - 4, py + 8],
        [cx, py + 5],
        [cx + 4, py + 8],
        [cx + 9, py + 20]
      ],
      '#2f7226'
    )
    fill(
      ctx,
      [
        [cx - 5, py + 12],
        [cx - 2, py + 8],
        [cx + 2, py + 10],
        [cx + 5, py + 14]
      ],
      C.grassLT
    )
    P(ctx, cx - 2, py + 22, 4, 7, '#6e4c28')
    if (edgeN) P(ctx, px, py, TS, 3, C.grass)
    if (edgeS) P(ctx, px, py + 29, TS, 3, C.grass)
  }
}

function mountainTile(g: TileGfx) {
  const { ctx, x, y, h, n } = g
  const px = x * TS,
    py = y * TS
  const joins = (ch: string) => ch === 'm'
  const openN = !joins(n.N)
  const openS = !joins(n.S)
  const openW = !joins(n.W)
  const openE = !joins(n.E)

  P(ctx, px, py, TS, TS, '#5a605f')
  // 台地使用 4px 岩层颗粒，同一片山体不再重复一座座独立三角山峰。
  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 8; cx++) {
      const gx = x * 8 + cx
      const gy = y * 8 + cy
      const field = smoothNoise(gx, gy, 13, 902)
      const grain = hash(gx, gy, 903)
      const color =
        field < 0.34 ? '#4a5050' : field > 0.7 ? '#747b76' : grain > 0.8 ? '#666c68' : '#5a605f'
      if (color !== '#5a605f') P(ctx, px + cx * 4, py + cy * 4, 4, 4, color)
    }
  }

  if (openN) {
    const leftY = 6 + Math.floor(hash(x, y, 904) * 5)
    const midY = 2 + Math.floor(hash(x * 2 + 1, y, 905) * 5)
    const rightY = 6 + Math.floor(hash(x + 1, y, 904) * 5)
    fill(
      ctx,
      [
        [px, py + leftY],
        [px + 16, py + midY],
        [px + TS, py + rightY],
        [px + TS, py + 17],
        [px, py + 17]
      ],
      '#858c86'
    )
    fill(
      ctx,
      [
        [px, py + leftY + 3],
        [px + 16, py + midY + 3],
        [px + TS, py + rightY + 3],
        [px + TS, py + 20],
        [px, py + 20]
      ],
      '#6d746f'
    )
    P(ctx, px + 2, py + 15, 11, 2, '#9ba097')
    P(ctx, px + 20, py + 14, 9, 2, '#474d4d')
    if (h > 0.7) {
      P(ctx, px + 10, py + midY + 1, 9, 3, '#e6e9ed')
      P(ctx, px + 13, py + midY, 5, 2, '#f7f8fa')
    }
  }

  if (openS) {
    const lip = openN ? 18 : 8 + Math.floor(hash(x, y, 906) * 4)
    P(ctx, px, py + lip, TS, TS - lip, '#484e4e')
    P(ctx, px, py + lip, TS, 3, '#888e87')
    P(ctx, px, py + lip + 3, TS, 2, '#343a3a')
    for (let i = 0; i < 4; i++) {
      const sx = px + 3 + Math.floor(hash(x * 7 + i, y, 907) * 25)
      const depth = 6 + Math.floor(hash(x, y * 5 + i, 908) * Math.max(7, TS - lip - 5))
      P(ctx, sx, py + lip + 4, 2, Math.min(depth, TS - lip - 5), i & 1 ? '#626963' : '#383e3e')
      if (i < 3) P(ctx, sx + 2, py + lip + 6 + i * 4, 5, 1, '#767d76')
    }
    P(ctx, px, py + 29, TS, 3, '#343640')
  } else {
    P(ctx, px + 3, py + 25, 12, 2, '#484a55')
    P(ctx, px + 18, py + 20, 10, 1, '#81877f')
  }

  if (openW) {
    P(ctx, px, py + (openN ? 10 : 3), 4, openS ? 21 : 27, '#3d3f49')
    P(ctx, px + 4, py + 13, 2, 12, '#858b84')
  }
  if (openE) {
    P(ctx, px + 28, py + (openN ? 10 : 3), 4, openS ? 21 : 27, '#393b45')
    P(ctx, px + 26, py + 14, 2, 11, '#757c76')
  }

  if (!openN && !openS) {
    const crackX = px + 6 + Math.floor(hash(x, y, 909) * 16)
    P(ctx, crackX, py + 7, 1, 9, '#41434d')
    P(ctx, crackX + 1, py + 15, 6, 1, '#41434d')
  }

  // 山体内部只在少数位置长出次级岩峰，保持山脉连续又避免平板。
  if (!openN && !openS && h > 0.78) {
    fill(
      ctx,
      [
        [px + 2, py + 27],
        [px + 8, py + 15],
        [px + 13, py + 20],
        [px + 21, py + 9],
        [px + 30, py + 27]
      ],
      '#424849'
    )
    fill(
      ctx,
      [
        [px + 10, py + 24],
        [px + 21, py + 11],
        [px + 26, py + 25]
      ],
      '#737a74'
    )
    P(ctx, px + 3, py + 27, 27, 2, '#343a3a')
  }
}

function townLotTile(g: TileGfx) {
  const { ctx, x, y, h } = g
  const px = x * TS,
    py = y * TS
  grassTile(g, false)
  if (h > 0.42) {
    // 房屋
    const roof = h > 0.7 ? C.roofRed : h > 0.56 ? C.roofBrown : C.roofSlate
    const roofDK = h > 0.7 ? C.roofRedDK : h > 0.56 ? C.roofBrownDK : C.roofSlateDK
    fill(
      ctx,
      [
        [px + 2, py + 16],
        [px + 6, py + 6],
        [px + 16, py + 3],
        [px + 26, py + 6],
        [px + 30, py + 16]
      ],
      roof
    )
    P(ctx, px + 5, py + 9, 22, 2, roofDK)
    P(ctx, px + 7, py + 14, 18, 1, roofDK)
    P(ctx, px + 8, py + 16, 16, 12, C.wallCream)
    P(ctx, px + 10, py + 18, 5, 4, C.win)
    P(ctx, px + 18, py + 18, 5, 4, C.win)
    P(ctx, px + 13, py + 24, 6, 4, C.doorDK)
    P(ctx, px + 3, py + 16, 2, 12, C.wallLT)
    P(ctx, px + 27, py + 16, 2, 12, C.wallLT)
    P(ctx, px + 11, py + 10, 3, 3, C.metalLT)
  } else {
    // 院落
    P(ctx, px + 1, py + 2, 30, 2, C.woodDK)
    P(ctx, px + 1, py + 28, 30, 2, C.woodDK)
    P(ctx, px + 1, py + 2, 2, 28, C.woodDK)
    P(ctx, px + 29, py + 2, 2, 28, C.woodDK)
    P(ctx, px + 1, py + 4, 30, 1, C.woodLT)
    if (h > 0.5) treeSmall(ctx, px, py)
    else if (h > 0.46) flower(ctx, px, py, hash(x, y, 30))
  }
}

function treeSmall(ctx: CanvasRenderingContext2D, px: number, py: number) {
  const cx = px + 15,
    cy = py + 18
  P(ctx, cx - 1, cy, 3, 6, '#6e4c28')
  fill(
    ctx,
    [
      [cx - 9, cy],
      [cx - 6, cy - 8],
      [cx, cy - 11],
      [cx + 6, cy - 8],
      [cx + 9, cy]
    ],
    C.grassDK
  )
  fill(
    ctx,
    [
      [cx - 6, cy],
      [cx - 4, cy - 6],
      [cx, cy - 8],
      [cx + 4, cy - 6],
      [cx + 6, cy]
    ],
    C.grassLT
  )
}

function gateTile(g: TileGfx) {
  const { ctx, x, y, n } = g
  const px = x * TS,
    py = y * TS
  P(ctx, px, py, TS, TS, C.dirt)
  // 石柱
  P(ctx, px + 2, py + 4, 6, 26, C.stoneDK)
  P(ctx, px + 3, py + 4, 4, 26, C.stone)
  P(ctx, px + 24, py + 4, 6, 26, C.stoneDK)
  P(ctx, px + 25, py + 4, 4, 26, C.stone)
  // 门楣
  P(ctx, px + 1, py + 2, 30, 4, C.stoneDK)
  P(ctx, px + 1, py + 2, 30, 2, C.stoneLT)
  // 路面车辙（接南北道路）
  if (isRoad(n.N) || isRoad(n.S)) {
    P(ctx, px + 10, py + 4, 3, 26, C.dirtDK)
    P(ctx, px + 19, py + 4, 3, 26, C.dirtDK)
  } else {
    P(ctx, px + 11, py + 4, 3, 26, C.dirtDK)
    P(ctx, px + 18, py + 4, 3, 26, C.dirtDK)
  }
  P(ctx, px + 8, py + 8, 16, 2, C.dirtLT)
}

function caveMouthTile(g: TileGfx) {
  const { ctx, x, y } = g
  const px = x * TS,
    py = y * TS
  P(ctx, px, py, TS, TS, C.stoneDK)
  P(ctx, px, py, TS, 4, C.stone)
  // 洞口
  fill(
    ctx,
    [
      [px + 6, py + 6],
      [px + 10, py + 26],
      [px + 22, py + 26],
      [px + 26, py + 6]
    ],
    '#0d0d14'
  )
  P(ctx, px + 8, py + 8, 16, 3, '#1a1a26')
  // 台阶
  for (let i = 0; i < 3; i++) P(ctx, px + 8 + i * 2, py + 21 + i * 3, 16 - i * 4, 3, C.stone)
  P(ctx, px + 6, py + 5, 20, 2, C.stoneLT)
}

function hellGateTile(g: TileGfx) {
  const { ctx, x, y, h } = g
  const px = x * TS,
    py = y * TS
  P(ctx, px, py, TS, TS, C.rockDK)
  P(ctx, px, py + 26, TS, 6, C.rock)
  P(ctx, px + 3, py + 3, 26, 24, C.metalDK)
  P(ctx, px + 3, py + 3, 26, 4, C.metal)
  P(ctx, px + 5, py + 8, 4, 16, C.metalLT)
  P(ctx, px + 12, py + 8, 4, 16, C.metalLT)
  P(ctx, px + 19, py + 8, 4, 16, C.metalLT)
  P(ctx, px + 11, py + 14, 10, 5, '#301018')
  if (h > 0.5) P(ctx, px + 13, py + 15, 6, 3, C.red)
  // 红色警示光
  P(ctx, px + 2, py + 2, 2, 2, '#f84848')
  P(ctx, px + 28, py + 2, 2, 2, '#f84848')
}

function noahTile(g: TileGfx) {
  const { ctx, x, y, h } = g
  const px = x * TS,
    py = y * TS
  P(ctx, px, py, TS, TS, '#20242e')
  P(ctx, px + 2, py + 2, 28, 28, '#2e333e')
  P(ctx, px + 2, py + 2, 28, 4, '#3a404c')
  for (let i = 0; i < 4; i++) {
    P(ctx, px + 6, py + 9 + i * 5, 6, 3, h > 0.5 ? C.winGlow : '#141822')
    P(ctx, px + 20, py + 9 + i * 5, 6, 3, h > 0.4 ? '#f84848' : '#141822')
  }
  P(ctx, px + 10, py + 27, 12, 3, C.metalDK)
}

/* ================= 城镇 ================= */

export function townPathAt(town: TownDef, x: number, y: number): boolean {
  if (town.paths?.length) {
    return town.paths.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h)
  }
  const [w, h] = town.size
  const ex = Math.floor(w / 2)
  if (x === ex && y >= 6 && y <= h - 3) return true
  for (const ry of [6, 12, 18]) if (y === ry && x >= 2 && x <= w - 3) return true
  for (const b of town.buildings) {
    const [dx, dy] = b.door
    const target = dy + 1 <= 6 ? 6 : dy + 1 <= 12 ? 12 : 18
    if (x === dx && y >= Math.min(dy + 1, target) && y <= Math.max(dy + 1, target)) return true
  }
  return false
}

function townPathKindAt(town: TownDef, x: number, y: number) {
  return (
    town.paths?.find((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h)?.kind || 'dirt'
  )
}

function frontierScrubTile(g: TileGfx) {
  const { ctx, x, y, h } = g
  const px = x * TS,
    py = y * TS
  P(ctx, px, py, TS, TS, '#68713d')
  if (h > 0.48) P(ctx, px + 3, py + 5, 14, 9, '#596334')
  if (h < 0.33) P(ctx, px + 15, py + 18, 14, 8, '#7f7b45')
  if (h > 0.78) P(ctx, px + 4, py + 23, 9, 5, '#4f5930')
  for (let i = 0; i < 6; i++) {
    const bx = px + 2 + Math.floor(hash(x * 7 + i, y * 13, 831) * 27)
    const by = py + 3 + Math.floor(hash(x * 11, y * 5 + i, 832) * 25)
    const dry = hash(x + i, y, 833) > 0.48
    P(ctx, bx, by, 1, dry ? 4 : 3, dry ? '#b19a56' : '#8a8848')
    if (dry) P(ctx, bx - 1, by + 2, 3, 1, '#8d783f')
  }
  const prop = hash(x, y, 834)
  if (prop > 0.9) rockProp(ctx, px, py, h)
  else if (prop > 0.865) {
    P(ctx, px + 8, py + 18, 13, 3, '#4a4c4d')
    P(ctx, px + 10, py + 15, 7, 4, '#73706a')
    P(ctx, px + 12, py + 16, 2, 2, '#b1693c')
  }
}

function farmlandTile(g: TileGfx, orientation: 'horizontal' | 'vertical') {
  const { ctx, x, y, h } = g
  const px = x * TS,
    py = y * TS
  const macro = smoothNoise(x, y, 5, 846)
  const base = macro > 0.62 ? '#7c8140' : macro < 0.34 ? '#60743b' : '#6e7d3d'
  const dark = macro > 0.62 ? '#656936' : '#4f6535'
  const light = macro > 0.62 ? '#a19548' : '#829044'
  P(ctx, px, py, TS, TS, base)

  // 成排作物与压实土沟，让地面从普通草坪变成可辨识的耕地。
  if (orientation === 'vertical') {
    for (let xx = 5; xx < TS; xx += 8) {
      P(ctx, px + xx, py, 2, TS, dark)
      P(ctx, px + xx + 2, py, 1, TS, light)
    }
  } else {
    for (let yy = 6; yy < TS; yy += 8) {
      P(ctx, px, py + yy, TS, 2, dark)
      P(ctx, px, py + yy + 2, TS, 1, light)
    }
  }

  const stalk = h > 0.52 ? '#d1b75b' : '#b89a49'
  for (let i = 0; i < 5; i++) {
    const sx = px + 3 + Math.floor(hash(x * 11 + i, y * 7, 847) * 25)
    const sy = py + 5 + Math.floor(hash(x * 5, y * 13 + i, 848) * 22)
    P(ctx, sx, sy, 1, 5, stalk)
    P(ctx, sx - 1, sy + 1, 3, 2, light)
  }
}

function townGround(g: TileGfx, town: TownDef) {
  const { x, y } = g
  const field = town.fields?.find(
    (item) => x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h
  )
  const edgeGround = town.id === 'rado' ? '#68713d' : field ? '#6e7d3d' : C.grass
  if (townPathAt(town, x, y)) {
    const { ctx } = g
    const px = x * TS,
      py = y * TS
    const kind = townPathKindAt(town, x, y)
    const base = kind === 'stone' ? '#77766f' : kind === 'metal' ? '#555b62' : C.dirt
    const light = kind === 'stone' ? '#929087' : kind === 'metal' ? '#727981' : C.dirtLT
    const dark = kind === 'stone' ? '#5a5954' : kind === 'metal' ? '#393f46' : C.dirtDK
    P(ctx, px, py, TS, TS, base)
    if (kind === 'stone') {
      P(ctx, px, py + 15, TS, 2, dark)
      P(ctx, px + (x & 1 ? 8 : 20), py, 2, 16, dark)
      P(ctx, px + (x & 1 ? 20 : 8), py + 17, 2, 15, dark)
      P(ctx, px + 2, py + 2, 12, 1, light)
    } else if (kind === 'metal') {
      P(ctx, px, py, TS, 3, light)
      P(ctx, px, py + 29, TS, 3, dark)
      P(ctx, px + 5, py + 7, 3, 3, dark)
      P(ctx, px + 24, py + 22, 3, 3, dark)
    }
    for (let i = 0; i < 6; i++) {
      const sx = (px + (hash(x * 3 + i, y * 5, 40) * 26 + 2)) | 0
      const sy = (py + (hash(x * 7, y * 3 + i, 41) * 26 + 2)) | 0
      if (kind === 'dirt') {
        P(ctx, sx, sy, 2, 1, light)
        P(ctx, sx, sy + 1, 1, 1, dark)
      }
    }
    // 与草地接壤
    if (!townPathAt(town, x, y - 1)) P(ctx, px, py, TS, 3, edgeGround)
    if (!townPathAt(town, x, y + 1)) P(ctx, px, py + 29, TS, 3, edgeGround)
    if (!townPathAt(town, x - 1, y)) P(ctx, px, py, 3, TS, edgeGround)
    if (!townPathAt(town, x + 1, y)) P(ctx, px + 29, py, 3, TS, edgeGround)
  } else {
    if (town.id === 'rado') frontierScrubTile(g)
    else if (field) farmlandTile(g, field.orientation)
    else grassTile(g, true)
    // 靠近建筑/道路的压边草
    if (townPathAt(town, x, y - 1)) P(g.ctx, x * TS, y * TS, TS, 3, edgeGround)
  }
}

/* ---------------- 建筑立面 ---------------- */

function buildingPal(b: TownDef['buildings'][number], h: number) {
  const type = b.type
  const hh = h
  switch (type) {
    case 'weapon':
      return {
        wall: '#8f959c',
        wallDK: '#6f747c',
        roof: C.roofBrown,
        roofDK: C.roofBrownDK,
        trim: '#565c66',
        accent: C.red,
        accent2: C.metalLT
      }
    case 'tankshop':
      return {
        wall: '#8a8e98',
        wallDK: '#6a6e78',
        roof: C.roofSlate,
        roofDK: C.roofSlateDK,
        trim: '#4c525c',
        accent: C.gold,
        accent2: '#c9cdd6'
      }
    case 'modshop':
      return {
        wall: '#7d828c',
        wallDK: '#5f646e',
        roof: '#4c4e58',
        roofDK: '#3a3c46',
        trim: '#444852',
        accent: '#f0a030',
        accent2: C.metalLT
      }
    case 'inn':
      return {
        wall: '#b09070',
        wallDK: '#8f6f50',
        roof: C.roofRed,
        roofDK: C.roofRedDK,
        trim: '#6e4c30',
        accent: C.winGlow,
        accent2: '#e8d8b8'
      }
    case 'bounty':
      return {
        wall: '#7a6a5a',
        wallDK: '#5e4f42',
        roof: '#4e3a30',
        roofDK: '#3a2a22',
        trim: '#45382e',
        accent: '#c8a858',
        accent2: '#e8e0c8'
      }
    case 'story':
      return b.story === 'rock_hospital'
        ? {
            wall: '#d8d8dc',
            wallDK: '#b8b8c0',
            roof: C.roofSlate,
            roofDK: C.roofSlateDK,
            trim: '#9a9aa2',
            accent: C.red,
            accent2: '#f0f0f4'
          }
        : {
            wall: '#565c66',
            wallDK: '#3e424c',
            roof: '#2e323c',
            roofDK: '#22262e',
            trim: '#323640',
            accent: C.red,
            accent2: '#787e88'
          }
    case 'home':
      return {
        wall: '#a89070',
        wallDK: '#8a6f50',
        roof: C.roofBrown,
        roofDK: C.roofBrownDK,
        trim: '#6e5a3e',
        accent: '#d8b858',
        accent2: '#c9b896'
      }
    default:
      return {
        wall: C.wallCream,
        wallDK: '#a99874',
        roof: hh > 0.6 ? C.roofRed : hh > 0.35 ? C.roofBrown : C.roofSlate,
        roofDK: hh > 0.6 ? C.roofRedDK : hh > 0.35 ? C.roofBrownDK : C.roofSlateDK,
        trim: '#8a744e',
        accent: '#7a6a52',
        accent2: C.wallLT
      }
  }
}

function garageDoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string
) {
  P(ctx, x - 3, y - 5, w + 6, h + 8, '#343943')
  P(ctx, x, y, w, h, '#69717b')
  P(ctx, x + 3, y + 3, w - 6, h - 6, '#535b66')
  for (let yy = y + 7; yy < y + h - 3; yy += 7) {
    P(ctx, x + 3, yy, w - 6, 2, '#353b45')
    P(ctx, x + 4, yy + 2, w - 8, 1, '#828a92')
  }
  P(ctx, x + Math.floor(w / 2) - 1, y + 3, 3, h - 7, '#858d96')
  P(ctx, x - 4, y - 8, w + 8, 5, accent)
  P(ctx, x + 4, y + h - 5, w - 8, 3, '#20252c')
  P(ctx, x + Math.floor(w / 2) - 3, y + h - 14, 7, 4, '#c5a34f')
}

function roofVent(ctx: CanvasRenderingContext2D, x: number, y: number, accent: string) {
  P(ctx, x, y, 16, 9, '#373c45')
  P(ctx, x + 2, y - 3, 12, 4, '#747c84')
  P(ctx, x + 3, y + 2, 10, 4, '#22272e')
  P(ctx, x + 5, y + 3, 2, 2, accent)
  P(ctx, x + 9, y + 3, 2, 2, accent)
}

export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  b: TownDef['buildings'][number],
  h: number,
  townId?: string
) {
  const x0 = b.x * TS,
    y0 = b.y * TS
  const w = b.w * TS,
    hh = b.h * TS
  const pal = buildingPal(b, h)
  const roofH = b.h <= 3 ? 36 : 48
  const frontier = townId === 'rado'
  const sideDepth = 9 + Math.floor(h * 8)
  // 东南向长投影和接地暗部把建筑从地表中抬起，同时保留脚底碰撞位置。
  fill(
    ctx,
    [
      [x0 + 8, y0 + 13],
      [x0 + w + sideDepth + 10, y0 + 24],
      [x0 + w + sideDepth + 10, y0 + hh + 12],
      [x0 + 10, y0 + hh + 6]
    ],
    'rgba(18,20,18,0.22)'
  )
  P(ctx, x0 + 5, y0 + hh - 2, w + sideDepth + 7, 10, 'rgba(20,20,18,0.34)')
  // 屋顶
  fill(
    ctx,
    [
      [x0 - 5, y0 + roofH],
      [x0 + 9, y0 + 9],
      [x0 + w / 2, y0],
      [x0 + w - 9, y0 + 9],
      [x0 + w + 5, y0 + roofH]
    ],
    pal.roofDK
  )
  fill(
    ctx,
    [
      [x0 - 4, y0 + roofH],
      [x0 + 8, y0 + 8],
      [x0 + w / 2, y0 - 1],
      [x0 + w - 8, y0 + 8],
      [x0 + w + 4, y0 + roofH]
    ],
    pal.roof
  )
  // 屋檐下缘和高光脊线形成清楚的厚度，不让屋顶像贴在墙上的色块。
  P(ctx, x0 - 5, y0 + roofH - 2, w + 10, 6, '#332b2a')
  P(ctx, x0 - 3, y0 + roofH - 2, w + 6, 2, pal.trim)
  P(ctx, x0 + w / 2 - 2, y0, 4, roofH - 5, 'rgba(240,220,170,0.18)')
  P(ctx, x0 + w / 2 - 1, y0 - 3, 2, 8, '#2c2020')
  // 屋瓦横线
  for (let i = 1; i < roofH / 6; i++) {
    const yy = y0 + i * 6
    const span = ((yy - y0) / roofH) * (w / 2)
    P(ctx, x0 + w / 2 - span, yy, span * 2, 1, pal.roofDK)
  }
  // 屋顶板缝、铆钉与补丁；拉多镇使用更明显的废土修补痕迹。
  for (let i = 1; i < b.w * 2; i++) {
    const xx = x0 + Math.floor((i * w) / (b.w * 2))
    const top = y0 + 8 + (Math.abs(xx - (x0 + w / 2)) * (roofH - 8)) / (w / 2)
    P(ctx, xx, top, 1, Math.max(1, y0 + roofH - top), 'rgba(46,34,31,0.32)')
  }
  if (frontier) {
    for (let i = 0; i < Math.max(3, b.w - 2); i++) {
      const rx = x0 + 16 + Math.floor(hash(b.x * 17 + i, b.y * 29, 812) * Math.max(8, w - 48))
      const ry = y0 + 12 + Math.floor(hash(b.x * 31, b.y * 13 + i, 813) * Math.max(6, roofH - 23))
      const rw = 8 + Math.floor(hash(b.x + i, b.y, 814) * 13)
      P(ctx, rx, ry, rw, 5, pal.roofDK)
      P(ctx, rx + 1, ry + 1, Math.max(2, rw - 3), 2, pal.trim)
      P(ctx, rx + 2, ry + 4, 1, 1, '#c39456')
      P(ctx, rx + rw - 3, ry + 4, 1, 1, '#c39456')
    }
    roofVent(ctx, x0 + Math.floor(w * 0.72), y0 + roofH - 20, pal.accent)
    if (b.type === 'home' || b.type === 'tankshop' || b.type === 'modshop') {
      const pipeX = x0 + 18
      P(ctx, pipeX, y0 + 5, 7, roofH + 14, '#414750')
      P(ctx, pipeX + 2, y0 + 4, 3, roofH + 12, '#818991')
      P(ctx, pipeX - 3, y0 + 2, 13, 5, '#2b3038')
      P(ctx, pipeX - 1, y0 + 1, 9, 2, '#737b84')
    }
  }
  // 墙体
  P(ctx, x0, y0 + roofH, w, hh - roofH, pal.wallDK)
  P(ctx, x0 + 1, y0 + roofH + 1, w - 2, hh - roofH - 2, pal.wall)
  // 右侧墙面使用更暗的透视面，并把屋檐和地基一起向外推出。
  fill(
    ctx,
    [
      [x0 + w, y0 + roofH],
      [x0 + w + sideDepth, y0 + roofH + 6],
      [x0 + w + sideDepth, y0 + hh + 4],
      [x0 + w, y0 + hh]
    ],
    pal.wallDK
  )
  P(ctx, x0 + w + 2, y0 + roofH + 10, sideDepth - 3, 2, pal.trim)
  P(ctx, x0 + w + sideDepth - 3, y0 + roofH + 7, 2, hh - roofH - 7, '#51493f')
  // 底部收边
  P(ctx, x0, y0 + hh - 5, w, 5, pal.wallDK)
  P(ctx, x0, y0 + hh - 2, w, 2, pal.trim)
  P(ctx, x0 - 3, y0 + hh, w + sideDepth + 6, 4, '#4d4b45')
  P(ctx, x0 - 1, y0 + hh, w + sideDepth + 2, 1, '#8f8c7f')
  // 墙线
  for (let i = 1; i < 3; i++) {
    const yy = y0 + roofH + i * ((hh - roofH) / 3)
    P(ctx, x0 + 3, yy, w - 6, 1, pal.wallDK)
  }
  // 板材接缝、墙脚污渍和局部修补，避免整面墙只有一块纯色。
  for (let xx = x0 + 28; xx < x0 + w - 12; xx += 32) {
    P(ctx, xx, y0 + roofH + 2, 1, hh - roofH - 8, 'rgba(55,46,38,0.25)')
    for (let yy = y0 + roofH + 8; yy < y0 + hh - 8; yy += 18) P(ctx, xx - 1, yy, 3, 1, pal.trim)
  }
  if (frontier) {
    for (let i = 0; i < b.w + 2; i++) {
      const sx = x0 + 6 + Math.floor(hash(b.x * 11 + i, b.y * 17, 821) * Math.max(6, w - 16))
      const sy =
        y0 +
        roofH +
        8 +
        Math.floor(hash(b.x * 23, b.y * 19 + i, 822) * Math.max(4, hh - roofH - 24))
      P(ctx, sx, sy, 2, 5 + Math.floor(hash(i, b.x, 823) * 8), 'rgba(104,61,37,0.34)')
      P(ctx, sx + 2, sy + 1, 1, 3, 'rgba(208,142,78,0.28)')
    }
    P(ctx, x0 + 5, y0 + hh - 12, w - 10, 3, 'rgba(48,40,34,0.38)')
  }
  // 门
  const [dx, dy] = b.door
  const dpx = dx * TS,
    dpy = dy * TS
  P(ctx, dpx + 5, dpy - 4, 22, 4, pal.trim)
  P(ctx, dpx + 1, dpy - 10, 30, 5, '#332c2b')
  P(ctx, dpx + 3, dpy - 9, 26, 2, pal.accent)
  P(ctx, dpx + 4, dpy - 5, 3, 6, pal.trim)
  P(ctx, dpx + 25, dpy - 5, 3, 6, pal.trim)
  P(ctx, dpx + 7, dpy, 18, 26, C.frame)
  P(ctx, dpx + 9, dpy + 2, 14, 24, C.door)
  P(ctx, dpx + 9, dpy + 2, 14, 3, C.doorDK)
  P(ctx, dpx + 15, dpy + 2, 2, 24, C.doorDK)
  P(ctx, dpx + 20, dpy + 14, 2, 2, '#d0aa58')
  if (frontier) {
    P(ctx, dpx + 2, dpy - 9, 28, 5, '#343943')
    P(ctx, dpx, dpy - 7, 32, 3, pal.accent)
    P(ctx, dpx + 3, dpy - 4, 2, 4, '#282d34')
    P(ctx, dpx + 27, dpy - 4, 2, 4, '#282d34')
  }
  // 门台阶
  P(ctx, dpx + 4, dpy + 27, 24, 3, C.stone)
  P(ctx, dpx + 1, dpy + 30, 30, 2, C.stoneDK)
  // 窗
  const winY = y0 + roofH + Math.floor((hh - roofH) / 3) + 2
  if (b.w >= 5) {
    for (const wx of [b.x + 1, b.x + b.w - 2]) {
      const wpx = wx * TS
      P(ctx, wpx + 7, winY, 18, 14, C.win)
      P(ctx, wpx + 5, winY - 3, 22, 4, '#3d3935')
      P(ctx, wpx + 5, winY + 14, 22, 5, '#4a4741')
      P(ctx, wpx + 7, winY, 18, 3, C.winLt)
      P(ctx, wpx + 15, winY, 2, 14, '#1a2448')
      P(ctx, wpx + 7, winY + 6, 18, 1, '#1a2448')
      P(ctx, wpx + 5, winY - 1, 22, 2, pal.trim)
      P(ctx, wpx + 5, winY + 15, 22, 2, pal.trim)
      if (frontier) {
        P(ctx, wpx + 4, winY - 4, 24, 3, '#3d424a')
        P(ctx, wpx + 3, winY + 17, 26, 3, '#555c63')
        P(ctx, wpx + 5, winY + 20, 22, 2, '#2d3238')
      }
    }
  }
  // 招牌
  const signY = y0 + roofH - 8
  P(ctx, dpx + 14, y0 + 4, 3, roofH - 12, pal.trim)
  P(ctx, dpx - 1, signY - 3, 34, 14, '#2c2220')
  P(ctx, dpx + 1, signY - 1, 30, 10, pal.accent)
  P(ctx, dpx + 3, signY, 26, 2, pal.accent2)
  buildingSign(ctx, b.type, dpx + 10, signY + 1)
  // 类型专属
  if (b.type === 'weapon') {
    // 展示橱窗
    const gx = b.x * TS + 7,
      gy = winY + 18
    P(ctx, gx, gy, 18, 12, '#2a3040')
    P(ctx, gx + 2, gy + 2, 14, 8, '#161c28')
    P(ctx, gx + 4, gy + 4, 10, 2, C.metalLT)
    P(ctx, gx + 4, gy + 8, 7, 1, C.metalLT)
    if (frontier) {
      const awningX = x0 + 24,
        awningW = Math.max(56, w - 48)
      P(ctx, awningX, winY - 10, awningW, 7, '#3a4048')
      for (let x = awningX + 2; x < awningX + awningW - 2; x += 12)
        P(ctx, x, winY - 9, 6, 5, pal.accent)
      P(ctx, awningX - 3, winY - 4, awningW + 6, 3, '#242930')
      P(ctx, x0 + w - 30, y0 + roofH + 8, 4, hh - roofH - 14, '#4f565f')
      P(ctx, x0 + w - 34, y0 + roofH + 14, 12, 3, '#252a31')
    }
  } else if (b.type === 'tankshop' || b.type === 'home') {
    // 大尺寸检修车库，与住宅门保持独立，能读出战车工房的功能。
    const gy = y0 + roofH + 12
    const garageH = Math.max(30, hh - roofH - 20)
    if (b.type === 'tankshop' && w >= 256) {
      garageDoor(ctx, x0 + 16, gy, 66, garageH, pal.accent)
      garageDoor(ctx, x0 + w - 82, gy, 66, garageH, pal.accent)
      P(ctx, x0 + 12, gy - 18, w - 24, 4, '#2b3038')
      for (let x = x0 + 20; x < x0 + w - 20; x += 24) P(ctx, x, gy - 22, 3, 12, '#6f7780')
    } else {
      const garageW = Math.min(70, Math.max(50, w - 104))
      garageDoor(ctx, x0 + 14, gy, garageW, garageH, pal.accent)
    }
  } else if (b.type === 'modshop') {
    // 排气管
    const ex1 = b.x * TS + 7,
      ex2 = b.x * TS + b.w * TS - 15
    P(ctx, ex1, y0 + roofH + 2, 6, hh - roofH - 6, C.metal)
    P(ctx, ex1 + 1, y0 + roofH + 2, 2, hh - roofH - 6, C.metalLT)
    P(ctx, ex2, y0 + roofH + 2, 6, hh - roofH - 6, C.metal)
    P(ctx, ex2 + 1, y0 + roofH + 2, 2, hh - roofH - 6, C.metalLT)
    P(ctx, ex1 - 2, y0 + roofH + 8, 10, 2, C.metalDK)
    P(ctx, ex2 - 2, y0 + roofH + 8, 10, 2, C.metalDK)
  } else if (b.type === 'inn') {
    // 暖色窗光
    for (const wx of [b.x + 1, b.x + b.w - 2]) {
      const wpx = wx * TS
      P(ctx, wpx + 9, winY + 2, 14, 10, 'rgba(248,216,120,0.55)')
    }
    if (frontier) {
      const porchX = x0 + 18
      P(ctx, porchX, dpy - 16, w - 36, 7, '#4c352a')
      P(ctx, porchX + 3, dpy - 14, w - 42, 4, pal.accent)
      P(ctx, porchX + 5, dpy - 9, 4, 36, '#5e4633')
      P(ctx, x0 + w - 27, dpy - 9, 4, 36, '#5e4633')
      P(ctx, porchX + 2, dpy + 25, w - 40, 4, '#3a2c25')
    }
  } else if (b.type === 'bounty') {
    // 悬赏海报
    for (let i = 0; i < 3; i++) {
      const px0 = b.x * TS + 8 + i * 12
      P(ctx, px0, winY + 2, 8, 11, '#e8e0c8')
      P(ctx, px0 + 1, winY + 4, 6, 6, '#5a4a3a')
      P(ctx, px0 + 2, winY + 4, 3, 2, '#8a6a4a')
    }
    if (frontier) {
      P(ctx, x0 + w - 24, y0 + roofH - 20, 3, 24, '#363c44')
      P(ctx, x0 + w - 31, y0 + roofH - 20, 17, 3, '#646c74')
      P(ctx, x0 + w - 28, y0 + roofH - 25, 11, 5, pal.accent)
      P(ctx, x0 + 18, dpy + 4, 3, 22, '#4c3528')
      P(ctx, x0 + 9, dpy + 2, 21, 16, '#d8c89b')
      P(ctx, x0 + 12, dpy + 5, 15, 2, '#694833')
      P(ctx, x0 + 12, dpy + 9, 11, 1, '#694833')
      P(ctx, x0 + 12, dpy + 13, 13, 1, '#694833')
    }
  } else if (b.type === 'story') {
    if (b.story === 'rock_hospital') {
      // 医院红十字
      const rx = b.x * TS + Math.floor((b.w * TS) / 2) - 9,
        ry = y0 + roofH - 6
      P(ctx, rx, ry + 5, 18, 5, C.red)
      P(ctx, rx + 5, ry, 8, 14, C.red)
    } else {
      // 藏身处警示条
      for (let i = 0; i < 4; i++) P(ctx, b.x * TS + i * 16, y0 + roofH, 8, 4, C.gold)
    }
  }
}

function buildingSign(ctx: CanvasRenderingContext2D, type: string, x: number, y: number) {
  switch (type) {
    case 'weapon':
      P(ctx, x + 2, y, 3, 8, '#2c2220')
      P(ctx, x + 6, y, 3, 8, '#2c2220')
      break
    case 'tankshop':
      P(ctx, x + 3, y + 1, 8, 6, '#2c2220')
      P(ctx, x + 6, y - 1, 2, 9, '#2c2220')
      break
    case 'modshop':
      P(ctx, x + 2, y + 2, 10, 4, '#2c2220')
      P(ctx, x + 6, y, 2, 8, '#2c2220')
      break
    case 'inn':
      P(ctx, x + 4, y + 1, 6, 6, '#2c2220')
      P(ctx, x + 6, y, 2, 8, '#2c2220')
      break
    case 'bounty':
      P(ctx, x + 2, y + 1, 10, 6, '#2c2220')
      P(ctx, x + 2, y + 2, 10, 1, '#e8e0c8')
      P(ctx, x + 2, y + 4, 10, 1, '#e8e0c8')
      break
    case 'story':
      P(ctx, x + 4, y + 2, 6, 4, '#2c2220')
      break
    case 'home':
      P(ctx, x + 3, y + 1, 2, 6, '#2c2220')
      P(ctx, x + 8, y + 1, 2, 6, '#2c2220')
      P(ctx, x + 3, y + 5, 7, 2, '#2c2220')
      break
    default:
      P(ctx, x + 5, y + 2, 4, 4, '#2c2220')
  }
}

/* ---------------- 装饰物 ---------------- */

function drawRadoDecorAsset(
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  offsetX: number,
  offsetY: number
) {
  const footX = x * TS + TS / 2 - offsetX
  const footY = (y + 1) * TS - offsetY
  const interiorFrame = t === 'barrel' ? 'prop/barrel' : t === 'crate' ? 'prop/crate' : null
  if (interiorFrame) {
    return atlasRegistry.drawFrame(ctx, 'rado-interiors', interiorFrame, footX, footY, {
      scale: 3,
      anchor: [4, 8],
      filter: 'saturate(0.8) brightness(0.9)'
    })
  }
  return false
}

export function drawDecor(
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  _h: number,
  offsetX = 0,
  offsetY = 0,
  townId?: string
) {
  if (townId === 'rado' && drawRadoDecorAsset(ctx, t, x, y, offsetX, offsetY)) return
  const px = x * TS - offsetX,
    py = y * TS - offsetY
  switch (t) {
    case 'tree': {
      const cx = px + 16,
        cy = py + 20
      P(ctx, cx - 3, cy, 7, 9, '#6e4c28')
      P(ctx, cx - 1, cy, 3, 9, '#8a6238')
      fill(
        ctx,
        [
          [cx - 13, cy + 1],
          [cx - 9, cy - 9],
          [cx - 2, cy - 14],
          [cx + 5, cy - 9],
          [cx + 12, cy + 1],
          [cx, cy + 6]
        ],
        C.grassDK
      )
      fill(
        ctx,
        [
          [cx - 10, cy + 1],
          [cx - 7, cy - 7],
          [cx, cy - 11],
          [cx + 6, cy - 7],
          [cx + 9, cy + 1],
          [cx, cy + 5]
        ],
        '#4d9c3e'
      )
      fill(
        ctx,
        [
          [cx - 6, cy - 3],
          [cx - 4, cy - 8],
          [cx + 1, cy - 10],
          [cx + 5, cy - 6],
          [cx + 6, cy - 1],
          [cx, cy + 1]
        ],
        C.grassLT
      )
      break
    }
    case 'tree2':
      treeSmall(ctx, px, py)
      break
    case 'lamp': {
      P(ctx, px + 15, py + 10, 3, 18, '#3a3a44')
      P(ctx, px + 15, py + 8, 3, 3, '#2c2c34')
      P(ctx, px + 11, py + 5, 11, 4, '#4c4c58')
      P(ctx, px + 12, py + 5, 9, 2, '#f8e8a0')
      P(ctx, px + 13, py + 6, 7, 1, '#f0d060')
      break
    }
    case 'well': {
      P(ctx, px + 8, py + 12, 17, 14, C.stone)
      P(ctx, px + 8, py + 12, 17, 4, C.stoneLT)
      P(ctx, px + 8, py + 24, 17, 2, C.stoneDK)
      P(ctx, px + 11, py + 16, 11, 9, '#20242e')
      P(ctx, px + 6, py + 10, 21, 4, C.wood)
      P(ctx, px + 6, py + 10, 21, 2, C.woodLT)
      P(ctx, px + 15, py + 2, 3, 9, C.woodDK)
      P(ctx, px + 15, py + 1, 3, 2, C.woodLT)
      break
    }
    case 'sign': {
      P(ctx, px + 15, py + 12, 3, 16, '#4a3a26')
      P(ctx, px + 8, py + 6, 17, 9, C.wood)
      P(ctx, px + 8, py + 6, 17, 2, C.woodLT)
      P(ctx, px + 8, py + 13, 17, 2, C.woodDK)
      P(ctx, px + 11, py + 9, 11, 3, '#e8e0c8')
      P(ctx, px + 11, py + 9, 11, 1, '#8a6a4a')
      break
    }
    case 'crate':
      P(ctx, px + 8, py + 14, 17, 13, C.wood)
      P(ctx, px + 8, py + 14, 17, 3, C.woodLT)
      P(ctx, px + 8, py + 25, 17, 2, C.woodDK)
      P(ctx, px + 10, py + 16, 13, 9, C.woodDK)
      P(ctx, px + 10, py + 16, 1, 9, C.woodLT)
      P(ctx, px + 22, py + 16, 1, 9, C.woodLT)
      break
    case 'barrel':
      P(ctx, px + 11, py + 12, 11, 15, C.wood)
      P(ctx, px + 9, py + 14, 15, 2, C.metalDK)
      P(ctx, px + 9, py + 23, 15, 2, C.metalDK)
      P(ctx, px + 11, py + 12, 11, 2, C.woodLT)
      P(ctx, px + 11, py + 25, 11, 2, C.woodDK)
      break
    case 'flower':
    case 'flower2':
      for (let i = 0; i < 4; i++) {
        const fx = px + 8 + ((hash(x * 5 + i, y * 9 + i, 50) * 14) | 0)
        const fy = py + 15 + ((hash(x * 9, y * 5 + i, 51) * 10) | 0)
        P(ctx, fx + 1, fy, 1, 4, '#2f7226')
        P(
          ctx,
          fx,
          fy,
          3,
          3,
          t === 'flower' ? (i % 2 ? '#f0a0b0' : '#f8e048') : i % 2 ? '#f0f8f8' : '#d84438'
        )
      }
      break
    case 'campfire':
      P(ctx, px + 8, py + 24, 17, 3, '#3d3026')
      P(ctx, px + 10, py + 22, 13, 3, '#6f4930')
      fill(
        ctx,
        [
          [px + 12, py + 23],
          [px + 14, py + 14],
          [px + 17, py + 19],
          [px + 20, py + 12],
          [px + 22, py + 23]
        ],
        '#d75a2c'
      )
      P(ctx, px + 15, py + 18, 5, 6, '#f1b73f')
      break
    case 'bench':
      P(ctx, px + 5, py + 18, 23, 3, C.woodLT)
      P(ctx, px + 5, py + 21, 23, 2, C.woodDK)
      P(ctx, px + 7, py + 23, 2, 5, C.woodDK)
      P(ctx, px + 24, py + 23, 2, 5, C.woodDK)
      P(ctx, px + 5, py + 16, 23, 2, C.wood)
      break
    case 'cart': {
      P(ctx, px + 5, py + 16, 23, 9, C.wood)
      P(ctx, px + 5, py + 16, 23, 3, C.woodLT)
      P(ctx, px + 5, py + 23, 23, 2, C.woodDK)
      P(ctx, px + 8, py + 25, 7, 7, C.metalDK)
      P(ctx, px + 9, py + 26, 5, 5, C.metal)
      P(ctx, px + 19, py + 25, 7, 7, C.metalDK)
      P(ctx, px + 20, py + 26, 5, 5, C.metal)
      break
    }
    case 'rock':
      P(ctx, px + 6, py + 18, 16, 10, C.rockDK)
      P(ctx, px + 8, py + 15, 12, 7, C.rock)
      P(ctx, px + 10, py + 13, 7, 5, C.rockLT)
      P(ctx, px + 6, py + 26, 16, 2, C.rockDK)
      break
    case 'stump':
      stump(ctx, px, py)
      break
    case 'cactus':
      cactus(ctx, px, py)
      break
    case 'fence':
      P(ctx, px + 1, py + 16, 30, 3, C.wood)
      P(ctx, px + 1, py + 22, 30, 3, C.wood)
      for (let i = 0; i < 4; i++) P(ctx, px + 3 + i * 8, py + 13, 3, 14, C.woodDK)
      break
    case 'poster':
      P(ctx, px + 6, py + 14, 21, 14, C.wood)
      P(ctx, px + 8, py + 16, 17, 10, '#e8e0c8')
      P(ctx, px + 10, py + 18, 13, 6, '#5a4a3a')
      P(ctx, px + 11, py + 18, 6, 2, '#8a6a4a')
      break
    case 'watertower': {
      P(ctx, px + 9, py + 6, 15, 14, C.metal)
      P(ctx, px + 9, py + 6, 15, 3, C.metalLT)
      P(ctx, px + 9, py + 16, 15, 2, C.metalDK)
      P(ctx, px + 12, py + 20, 9, 6, C.metalDK)
      P(ctx, px + 13, py + 26, 7, 3, C.metal)
      P(ctx, px + 9, py + 9, 15, 2, C.metalDK)
      P(ctx, px + 14, py + 8, 5, 2, C.metalLT)
      break
    }
    case 'silo': {
      P(ctx, px + 7, py + 8, 19, 19, '#9c8f72')
      P(ctx, px + 9, py + 8, 15, 19, '#b7a785')
      P(ctx, px + 9, py + 11, 15, 2, '#786f60')
      P(ctx, px + 9, py + 18, 15, 2, '#786f60')
      fill(
        ctx,
        [
          [px + 5, py + 9],
          [px + 16, py + 1],
          [px + 28, py + 9]
        ],
        '#6b5540'
      )
      P(ctx, px + 15, py + 21, 4, 6, '#4f4134')
      P(ctx, px + 8, py + 27, 17, 2, '#514a3e')
      break
    }
    case 'pump': {
      P(ctx, px + 5, py + 19, 23, 8, '#575d61')
      P(ctx, px + 8, py + 15, 15, 7, '#788086')
      P(ctx, px + 10, py + 16, 11, 3, '#9aa2a7')
      P(ctx, px + 23, py + 11, 3, 13, '#4a5055')
      P(ctx, px + 24, py + 10, 6, 3, '#969da1')
      P(ctx, px + 4, py + 24, 7, 5, '#33383c')
      P(ctx, px + 22, py + 24, 7, 5, '#33383c')
      P(ctx, px + 12, py + 18, 5, 3, '#cf9d3e')
      break
    }
    case 'hay': {
      P(ctx, px + 5, py + 18, 23, 10, '#a77f34')
      P(ctx, px + 7, py + 14, 19, 13, '#c7a247')
      P(ctx, px + 9, py + 16, 15, 2, '#e2bd5b')
      P(ctx, px + 9, py + 22, 15, 2, '#8f6a2c')
      P(ctx, px + 15, py + 14, 2, 13, '#755327')
      break
    }
    case 'tractor': {
      P(ctx, px + 4, py + 20, 25, 7, '#6a4c2c')
      P(ctx, px + 8, py + 14, 17, 9, '#b44f30')
      P(ctx, px + 17, py + 9, 8, 8, '#58656b')
      P(ctx, px + 18, py + 10, 6, 5, '#8eb0b4')
      P(ctx, px + 7, py + 25, 8, 7, '#2f3435')
      P(ctx, px + 9, py + 27, 4, 3, '#737878')
      P(ctx, px + 22, py + 24, 7, 7, '#2f3435')
      P(ctx, px + 24, py + 26, 3, 3, '#737878')
      P(ctx, px + 3, py + 17, 9, 3, '#d07a38')
      break
    }
    case 'plant':
      P(ctx, px + 13, py + 20, 7, 7, '#8a4a3a')
      P(ctx, px + 13, py + 20, 7, 2, '#a86048')
      P(ctx, px + 15, py + 10, 3, 11, '#2f7226')
      P(ctx, px + 11, py + 12, 11, 4, '#4d9c3e')
      P(ctx, px + 13, py + 9, 7, 4, '#54a542')
      break
    case 'memorial': {
      P(ctx, px + 4, py + 23, 25, 6, '#565861')
      P(ctx, px + 6, py + 20, 21, 4, '#777a84')
      P(ctx, px + 7, py + 11, 18, 10, '#48515a')
      P(ctx, px + 9, py + 8, 13, 5, '#66717b')
      P(ctx, px + 15, py + 5, 6, 5, '#3c444c')
      P(ctx, px + 20, py + 6, 12, 3, '#89919a')
      P(ctx, px + 5, py + 27, 23, 2, '#34363d')
      P(ctx, px + 10, py + 24, 13, 2, C.gold)
      break
    }
    case 'scrap': {
      P(ctx, px + 5, py + 21, 23, 7, '#3c4147')
      P(ctx, px + 8, py + 15, 9, 7, '#687079')
      P(ctx, px + 18, py + 11, 6, 11, '#8b6d42')
      P(ctx, px + 7, py + 12, 2, 10, '#9ba1a8')
      P(ctx, px + 13, py + 18, 14, 2, '#a84a38')
      P(ctx, px + 21, py + 8, 2, 8, '#b7bdc3')
      break
    }
    case 'oil': {
      ctx.fillStyle = 'rgba(29,31,35,0.65)'
      ctx.fillRect(px + 4, py + 20, 24, 7)
      ctx.fillRect(px + 9, py + 17, 14, 12)
      P(ctx, px + 11, py + 19, 8, 2, 'rgba(92,108,116,0.55)')
      break
    }
  }
}

/* ================= 洞窟 ================= */

function caveWall(g: TileGfx) {
  const { ctx, x, y, h, n } = g
  const px = x * TS,
    py = y * TS
  const openN = n.N !== '#'
  const openS = n.S !== '#'
  const openW = n.W !== '#'
  const openE = n.E !== '#'

  P(ctx, px, py, TS, TS, '#171821')
  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      const grain = hash(x * 4 + cx, y * 4 + cy, 60)
      const color = grain > 0.72 ? '#242631' : grain < 0.22 ? '#11121a' : '#1b1d27'
      P(ctx, px + cx * 8, py + cy * 8, 8, 8, color)
      if (grain > 0.84) P(ctx, px + cx * 8 + 2, py + cy * 8 + 2, 4, 2, '#30323e')
    }
  }

  // 面向玩家的南侧墙体绘制完整崖面；连成片的墙不再像纯色黑砖。
  if (openS) {
    const lip = 7 + Math.floor(hash(x, y, 61) * 4)
    P(ctx, px, py + lip, TS, TS - lip, '#292b36')
    P(ctx, px, py + lip, TS, 3, '#555865')
    P(ctx, px, py + lip + 3, TS, 2, '#11131b')
    for (let i = 0; i < 4; i++) {
      const sx = px + 3 + Math.floor(hash(x * 9 + i, y * 3, 62) * 25)
      const length = 5 + Math.floor(hash(x * 5, y * 7 + i, 63) * 12)
      P(ctx, sx, py + lip + 5, 2, length, i & 1 ? '#343743' : '#1c1e28')
      P(ctx, sx + 2, py + lip + 7 + i * 3, 4, 1, '#444753')
    }
    P(ctx, px, py + 29, TS, 3, '#0e1017')
  }

  if (openN) {
    P(ctx, px, py, TS, 3, '#4c4f5c')
    P(ctx, px + 4, py + 3, 10, 2, '#2e303b')
    P(ctx, px + 20, py + 3, 8, 1, '#666976')
  }
  if (openW) {
    P(ctx, px, py + 3, 3, 26, '#4b4e5a')
    P(ctx, px + 3, py + 8, 2, 15, '#242630')
  }
  if (openE) {
    P(ctx, px + 29, py + 3, 3, 26, '#0d0f16')
    P(ctx, px + 27, py + 10, 2, 14, '#343641')
  }
  if (h > 0.62) P(ctx, px + 5, py + 21, 9, 3, '#253021')
}

function caveFloor(g: TileGfx) {
  const { ctx, x, y, h, n } = g
  const px = x * TS,
    py = y * TS
  P(ctx, px, py, TS, TS, '#343640')
  // 4px 石英颗粒与跨格噪声，压低原来一整块地砖的感觉。
  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 8; cx++) {
      const gx = x * 8 + cx
      const gy = y * 8 + cy
      const field = smoothNoise(gx, gy, 12, 70)
      const grain = hash(gx, gy, 71)
      const color =
        field < 0.3 ? '#2b2d37' : field > 0.72 ? '#41434e' : grain > 0.86 ? '#3b3d47' : '#343640'
      if (color !== '#343640') P(ctx, px + cx * 4, py + cy * 4, 4, 4, color)
    }
  }

  // 细裂缝使用折线形态，不再是孤立的水平线。
  const crackX = px + 4 + Math.floor(hash(x, y, 72) * 18)
  const crackY = py + 8 + Math.floor(hash(x, y, 73) * 15)
  if (h > 0.38) {
    P(ctx, crackX, crackY, 8, 1, '#22242d')
    P(ctx, crackX + 7, crackY, 1, 5, '#22242d')
    P(ctx, crackX + 8, crackY + 4, 5, 1, '#22242d')
  }

  for (let i = 0; i < 6; i++) {
    const sx = (px + (hash(x * 7 + i, y * 3, 74) * 27 + 2)) | 0
    const sy = (py + (hash(x * 3, y * 7 + i, 75) * 27 + 2)) | 0
    P(ctx, sx, sy, 2, 2, '#484a55')
    P(ctx, sx, sy, 2, 1, '#5b5d68')
  }

  // 墙脚环境遮蔽让可行走区与岩壁之间产生明确深度。
  if (n.N === '#') {
    P(ctx, px, py, TS, 4, 'rgba(6,7,12,0.58)')
    P(ctx, px + 2, py + 4, TS - 4, 3, 'rgba(8,9,15,0.34)')
  }
  if (n.W === '#') P(ctx, px, py, 4, TS, 'rgba(7,8,13,0.34)')
  if (n.E === '#') P(ctx, px + 29, py, 3, TS, 'rgba(8,9,14,0.24)')
  if (n.S === '#') P(ctx, px, py + 30, TS, 2, '#50525d')
}

function caveCrystal(g: TileGfx) {
  caveFloor(g)
  const px = g.x * TS,
    py = g.y * TS
  const cx = px + 16,
    cy = py + 27
  P(g.ctx, px + 2, py + 5, 28, 24, 'rgba(45,104,196,0.08)')
  P(g.ctx, px + 6, py + 9, 20, 19, 'rgba(72,139,230,0.13)')
  fill(
    g.ctx,
    [
      [cx, cy],
      [cx - 7, cy - 9],
      [cx - 2, cy - 18],
      [cx + 3, cy - 10],
      [cx + 8, cy - 14],
      [cx + 9, cy]
    ],
    '#315ba8'
  )
  fill(
    g.ctx,
    [
      [cx - 2, cy - 4],
      [cx - 5, cy - 9],
      [cx - 2, cy - 15],
      [cx + 1, cy - 9]
    ],
    '#78a9ef'
  )
  fill(
    g.ctx,
    [
      [cx + 3, cy - 3],
      [cx + 4, cy - 10],
      [cx + 7, cy - 12],
      [cx + 7, cy - 3]
    ],
    '#4b7ed0'
  )
  P(g.ctx, px + 7, py + 27, 20, 2, '#252631')
  P(g.ctx, px + 4, py + 8, 2, 2, '#87b9f7')
  P(g.ctx, px + 26, py + 13, 1, 1, '#c4ddff')
  P(g.ctx, px + 10, py + 4, 1, 1, '#8dbcf4')
}

function caveBones(g: TileGfx) {
  caveFloor(g)
  const px = g.x * TS,
    py = g.y * TS
  P(g.ctx, px + 7, py + 21, 18, 3, '#c2bda6')
  P(g.ctx, px + 11, py + 16, 10, 7, '#d6d0b7')
  P(g.ctx, px + 13, py + 18, 2, 2, '#33332f')
  P(g.ctx, px + 18, py + 18, 2, 2, '#33332f')
  P(g.ctx, px + 5, py + 15, 9, 2, '#aaa58f')
  P(g.ctx, px + 20, py + 24, 8, 2, '#aaa58f')
}

function caveStalagmite(g: TileGfx) {
  caveFloor(g)
  const px = g.x * TS,
    py = g.y * TS
  fill(
    g.ctx,
    [
      [px + 6, py + 27],
      [px + 11, py + 12],
      [px + 15, py + 27]
    ],
    '#292a34'
  )
  fill(
    g.ctx,
    [
      [px + 13, py + 27],
      [px + 20, py + 6],
      [px + 26, py + 27]
    ],
    '#353640'
  )
  fill(
    g.ctx,
    [
      [px + 20, py + 27],
      [px + 25, py + 16],
      [px + 29, py + 27]
    ],
    '#24252e'
  )
  P(g.ctx, px + 18, py + 10, 3, 10, '#52535e')
  P(g.ctx, px + 7, py + 27, 21, 2, '#1c1d24')
}

function caveWater(g: TileGfx) {
  const { ctx, x, y, h, n } = g
  const px = x * TS,
    py = y * TS
  P(ctx, px, py, TS, TS, '#142a43')
  for (let yy = 0; yy < TS; yy += 4) {
    const band = (y * 8 + yy / 4) & 1
    P(ctx, px, py + yy, TS, 4, band ? '#1b3b5b' : '#1e4264')
  }
  P(ctx, px + 3 + ((h * 11) | 0), py + 8, 12, 1, '#4f7fa2')
  P(ctx, px + 13, py + 18, 14, 2, '#2d6389')
  P(ctx, px + 5, py + 26, 9, 1, '#6b91ad')
  if (n.N !== '~') {
    P(ctx, px, py, TS, 4, '#5d5b5a')
    P(ctx, px + 3, py + 4, 26, 2, '#7192a8')
    P(ctx, px + 8, py + 6, 8, 1, '#a1b9c8')
  }
  if (n.S !== '~') {
    P(ctx, px, py + 29, TS, 3, '#4b4b4b')
    P(ctx, px + 5, py + 28, 9, 1, '#7799ad')
  }
  if (n.W !== '~') {
    P(ctx, px, py, 3, TS, '#555456')
    P(ctx, px + 3, py + 5, 1, 18, '#61849c')
  }
  if (n.E !== '~') {
    P(ctx, px + 29, py, 3, TS, '#45464b')
    P(ctx, px + 28, py + 10, 1, 15, '#557b96')
  }
}

function caveRubble(g: TileGfx) {
  caveFloor(g)
  const { ctx, x, y, h } = g
  const px = x * TS,
    py = y * TS
  const rocks = [
    [3, 18, 13, 10],
    [13, 11, 14, 16],
    [5 + ((h * 6) | 0), 6, 10, 12]
  ]
  for (const [rx, ry, rw, rh] of rocks) {
    P(ctx, px + rx, py + ry, rw, rh, '#20212a')
    P(ctx, px + rx + 2, py + ry + 1, Math.max(2, rw - 5), Math.max(2, rh - 5), '#4a4b56')
    P(ctx, px + rx + 3, py + ry + 2, Math.max(1, rw - 8), 2, '#656672')
  }
}

function caveRail(g: TileGfx) {
  caveFloor(g)
  const { ctx, x, y } = g
  const px = x * TS,
    py = y * TS
  for (let xx = 0; xx < TS; xx += 8) {
    P(ctx, px + xx + 1, py + 5, 5, 23, '#614426')
    P(ctx, px + xx + 2, py + 6, 3, 20, '#8b6336')
  }
  P(ctx, px, py + 8, TS, 3, '#858b92')
  P(ctx, px, py + 10, TS, 2, '#3f444b')
  P(ctx, px, py + 22, TS, 3, '#858b92')
  P(ctx, px, py + 24, TS, 2, '#3f444b')
}

function chestTile(g: TileGfx) {
  const { ctx, x, y, h } = g
  const px = x * TS,
    py = y * TS
  caveFloor(g)
  P(ctx, px + 5, py + 10, 23, 15, C.woodDK)
  P(ctx, px + 5, py + 10, 23, 5, C.wood)
  P(ctx, px + 5, py + 14, 23, 2, C.gold)
  P(ctx, px + 8, py + 21, 18, 3, C.wood)
  P(ctx, px + 15, py + 13, 3, 11, C.gold)
  if (h > 0.5) P(ctx, px + 8, py + 11, 8, 2, C.woodLT)
}

function eventTile(g: TileGfx) {
  const { ctx, x, y } = g
  const px = x * TS,
    py = y * TS
  caveFloor(g)
  P(ctx, px + 4, py + 4, 24, 24, '#1a0f22')
  fill(
    ctx,
    [
      [px + 16, py + 7],
      [px + 19, py + 15],
      [px + 25, py + 16],
      [px + 19, py + 19],
      [px + 16, py + 25],
      [px + 13, py + 19],
      [px + 7, py + 16],
      [px + 13, py + 15]
    ],
    C.red
  )
  P(ctx, px + 15, py + 15, 3, 3, '#ff9090')
}

function exitTile(g: TileGfx) {
  const { ctx, x, y } = g
  const px = x * TS,
    py = y * TS
  caveFloor(g)
  P(ctx, px + 6, py + 6, 20, 20, '#0d0d14')
  for (let i = 0; i < 4; i++) {
    P(ctx, px + 7 + i * 4, py + 18 + i * 2, 18 - i * 4, 3, '#4e5460')
    P(ctx, px + 7 + i * 4, py + 17 + i * 2, 18 - i * 4, 1, '#6a7280')
  }
  ctx.fillStyle = 'rgba(248,232,160,0.35)'
  ctx.fillRect(px + 10, py + 2, 12, 12)
  P(ctx, px + 12, py + 4, 8, 2, '#f8e8a0')
}

/* ================= 室内 ================= */

function roomFloor(g: TileGfx, floor = 'wood') {
  const { ctx, x, y, h } = g
  const px = x * TS,
    py = y * TS
  if (floor === 'metal') {
    const base = h > 0.5 ? '#535b63' : '#4b535b'
    P(ctx, px, py, TS, TS, base)
    for (let sy = 0; sy < TS; sy += 8) {
      P(ctx, px, py + sy + 7, TS, 1, '#30373e')
      const stagger = ((y * 4 + sy / 8) & 1) * 8
      for (let sx = stagger; sx < TS; sx += 16) {
        P(ctx, px + sx, py + sy, 1, 8, '#343b42')
        P(ctx, px + sx + 1, py + sy + 1, 1, 6, 'rgba(130,142,151,0.28)')
      }
    }
    for (const [rx, ry] of [
      [4, 4],
      [12, 12],
      [20, 4],
      [28, 20]
    ]) {
      P(ctx, px + rx, py + ry, 2, 2, '#7b858e')
      P(ctx, px + rx + 1, py + ry + 1, 1, 1, '#252c32')
    }
    if (h > 0.62) P(ctx, px + 7, py + 25, 9, 1, 'rgba(185,196,202,0.22)')
    return
  }
  if (floor === 'stone') {
    P(ctx, px, py, TS, TS, h > 0.5 ? '#7b7770' : '#716d67')
    for (let sy = 0; sy < TS; sy += 8) {
      P(ctx, px, py + sy + 7, TS, 1, '#504d49')
      const stagger = ((y * 4 + sy / 8) & 1) * 8
      for (let sx = stagger; sx < TS; sx += 16) P(ctx, px + sx, py + sy, 1, 8, '#55524e')
    }
    P(ctx, px + 4 + ((h * 13) | 0), py + 5, 5, 1, '#928d84')
    P(ctx, px + 20, py + 22 + ((h * 4) | 0), 4, 1, '#5b5752')
    if (h > 0.68) {
      P(ctx, px + 10, py + 12, 1, 3, '#4b4845')
      P(ctx, px + 11, py + 14, 4, 1, '#4b4845')
    }
    return
  }
  const base = h > 0.5 ? '#946d43' : '#89633b'
  P(ctx, px, py, TS, TS, base)
  for (let sy = 0; sy < TS; sy += 8) {
    P(ctx, px, py + sy + 7, TS, 1, '#684824')
    P(ctx, px, py + sy, TS, 1, 'rgba(196,148,89,0.22)')
    const stagger = ((y * 4 + sy / 8) & 1) * 8
    for (let sx = stagger; sx < TS; sx += 16) P(ctx, px + sx, py + sy, 1, 8, '#74502b')
  }
  const grainX = 3 + ((h * 17) | 0)
  const grainY = 3 + ((hash(x, y, 1711) * 24) | 0)
  P(ctx, px + grainX, py + grainY, 7, 1, h > 0.5 ? '#b18455' : '#5f4225')
  P(ctx, px + ((grainX + 13) % 25), py + ((grainY + 11) % 27), 4, 1, '#aa7d4b')
}

function roomWall(g: TileGfx) {
  const { ctx, x, y, h, n } = g
  const px = x * TS,
    py = y * TS
  const openN = n.N !== '#'
  const openS = n.S !== '#'
  const openW = n.W !== '#'
  const openE = n.E !== '#'

  P(ctx, px, py, TS, TS, '#28231f')

  if (openS && !openN) {
    // 后墙：完整砖面、墙脚梁和少量修补痕迹，形成明确的竖向墙面。
    P(ctx, px, py, TS, 24, '#67533f')
    for (let sy = 0; sy < 24; sy += 8) {
      P(ctx, px, py + sy + 7, TS, 1, '#43362d')
      const stagger = ((y * 3 + sy / 8) & 1) * 8
      for (let sx = stagger; sx < TS; sx += 16) P(ctx, px + sx, py + sy, 1, 8, '#4d4034')
    }
    P(ctx, px, py, TS, 3, '#927454')
    P(ctx, px, py + 24, TS, 5, '#3a3029')
    P(ctx, px, py + 24, TS, 2, '#9a7952')
    P(ctx, px, py + 29, TS, 3, '#1c1917')
    if (h > 0.76) {
      P(ctx, px + 6, py + 9, 13, 7, '#554637')
      P(ctx, px + 7, py + 10, 11, 2, '#806548')
    }
    return
  }

  if (openW || openE) {
    // 侧墙使用纵向立柱和内侧收边，不再把横木板旋转后机械重复。
    P(ctx, px, py, TS, TS, '#4a3b31')
    for (let sy = 0; sy < TS; sy += 8) {
      P(ctx, px + 5, py + sy + 7, 22, 1, '#302823')
      const stagger = ((y * 4 + sy / 8) & 1) * 7
      P(ctx, px + 6 + stagger, py + sy, 1, 8, '#5a493a')
      P(ctx, px + 20 + stagger / 2, py + sy, 1, 8, '#332b26')
    }
    P(ctx, px + 3, py, 5, TS, '#2d2926')
    P(ctx, px + 8, py, 2, TS, '#76604a')
    P(ctx, px + 24, py, 5, TS, '#302a25')
    if (openE) {
      P(ctx, px + 27, py, 5, TS, '#8d704f')
      P(ctx, px + 27, py, 2, TS, '#b08a5e')
    }
    if (openW) {
      P(ctx, px, py, 5, TS, '#8d704f')
      P(ctx, px + 3, py, 2, TS, '#b08a5e')
    }
    if (h > 0.72) P(ctx, px + 13, py + 12, 6, 10, '#3a312b')
    return
  }

  if (openN) {
    // 下方是切面墙：顶部压条、内部支撑和深色外侧，避免出现一整条亮木框。
    P(ctx, px, py, TS, 7, '#a47d53')
    P(ctx, px, py, TS, 2, '#c09663')
    P(ctx, px, py + 7, TS, 25, '#352c27')
    P(ctx, px, py + 9, TS, 3, '#5c4939')
    for (let sx = 4; sx < TS; sx += 12) {
      P(ctx, px + sx, py + 12, 4, 20, '#493a30')
      P(ctx, px + sx + 1, py + 13, 1, 18, '#715944')
    }
    P(ctx, px, py + 29, TS, 3, '#171514')
    return
  }

  // 封闭角落和内部墙芯。
  P(ctx, px + 4, py, 24, TS, '#3c322b')
  P(ctx, px + 7, py, 4, TS, '#6c5542')
  P(ctx, px + 22, py, 3, TS, '#211d1a')
}

function roomExit(g: TileGfx, floor = 'wood') {
  const { ctx, x, y } = g
  const px = x * TS,
    py = y * TS
  roomFloor(g, floor)
  P(ctx, px + 5, py + 3, 22, 26, C.frame)
  P(ctx, px + 8, py + 6, 16, 23, '#20242e')
  P(ctx, px + 8, py + 6, 16, 4, C.door)
  P(ctx, px + 6, py + 1, 20, 3, C.woodDK)
  P(ctx, px + 12, py + 8, 3, 19, C.metalLT)
  ctx.fillStyle = 'rgba(240,220,140,0.3)'
  ctx.fillRect(px + 10, py + 8, 12, 18)
}

/* ---------------- 家具 ---------------- */

export function drawGarageBay(
  ctx: CanvasRenderingContext2D,
  slot: NonNullable<RoomDef['garageSlots']>[number],
  index: number
) {
  const left = (slot.x - 2) * TS + 4
  const top = (slot.y - 2) * TS + 4
  const width = TS * 5 - 8
  const height = TS * 5 - 8
  P(ctx, left, top, width, height, index % 2 ? 'rgba(31,38,42,0.18)' : 'rgba(19,24,27,0.22)')

  const line = '#b58b35'
  const worn = '#705b32'
  for (let y = top + 12; y < top + height - 9; y += 14) {
    P(ctx, left, y, 3, 8, (y / 14 + index) % 3 ? line : worn)
    P(ctx, left + width - 3, y, 3, 8, (y / 14 + index + 1) % 3 ? line : worn)
  }
  P(ctx, left, top, 22, 3, line)
  P(ctx, left + width - 22, top, 22, 3, line)
  P(ctx, left, top + height - 3, 22, 3, worn)
  P(ctx, left + width - 22, top + height - 3, 22, 3, worn)

  const stopY = slot.facing === 0 ? top + height - 28 : top + 21
  P(ctx, left + 39, stopY + 3, 31, 7, 'rgba(8,10,11,0.42)')
  P(ctx, left + width - 70, stopY + 3, 31, 7, 'rgba(8,10,11,0.42)')
  P(ctx, left + 39, stopY, 31, 6, '#575e60')
  P(ctx, left + width - 70, stopY, 31, 6, '#575e60')
  P(ctx, left + 43, stopY + 1, 23, 2, '#899092')
  P(ctx, left + width - 66, stopY + 1, 23, 2, '#899092')

  const oilX = left + 70 + ((index * 17) % 23)
  const oilY = top + 78 + ((index * 11) % 19)
  P(ctx, oilX, oilY, 17, 6, 'rgba(12,15,16,0.25)')
  P(ctx, oilX + 4, oilY - 3, 9, 11, 'rgba(12,15,16,0.2)')
  P(ctx, left + 9, top + 8, 27, 20, '#1a2023')
  P(ctx, left + 11, top + 10, 23, 16, '#414a4d')
  ctx.font = "bold 13px 'Courier New',monospace"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#f0cf67'
  ctx.fillText(String(index + 1).padStart(2, '0'), left + 22, top + 11)
}

export function drawFurniture(
  ctx: CanvasRenderingContext2D,
  f: { x: number; y: number; w: number; h: number; t: string },
  h: number,
  offsetX = 0,
  offsetY = 0,
  _townId?: string
) {
  const px = f.x * TS - offsetX,
    py = f.y * TS - offsetY
  const w = f.w * TS,
    hh = f.h * TS
  switch (f.t) {
    case 'counter': {
      P(ctx, px, py + 8, w, hh - 8, '#59432e')
      P(ctx, px, py + 5, w, 7, '#8f704a')
      P(ctx, px, py + 5, w, 2, '#b08a58')
      for (let x = 7; x < w; x += 18) P(ctx, px + x, py + 15, 2, hh - 18, '#3f3024')
      break
    }
    case 'weaponrack': {
      P(ctx, px + 3, py + 3, w - 6, hh - 6, '#4c3828')
      P(ctx, px + 6, py + 7, w - 12, 3, '#765638')
      P(ctx, px + 6, py + hh - 11, w - 12, 3, '#765638')
      for (let x = 10; x < w - 8; x += 14) {
        P(ctx, px + x, py + 10, 3, hh - 22, '#b5bbc2')
        P(ctx, px + x - 2, py + 15, 7, 3, '#343a40')
      }
      break
    }
    case 'tanklift': {
      P(ctx, px + 5, py + hh - 13, w - 10, 8, '#252b31')
      P(ctx, px + 8, py + hh - 16, w - 16, 4, '#d29a34')
      for (let x = 12; x < w - 10; x += 18) P(ctx, px + x, py + hh - 12, 8, 3, '#69717a')
      P(ctx, px + 8, py + 8, 7, hh - 24, '#606a73')
      P(ctx, px + w - 15, py + 8, 7, hh - 24, '#606a73')
      break
    }
    case 'locker': {
      P(ctx, px + 4, py + 2, w - 8, hh - 4, '#56616a')
      P(ctx, px + 6, py + 4, w - 12, 3, '#7b8790')
      for (let x = 10; x < w - 8; x += 14) {
        P(ctx, px + x, py + 7, 2, hh - 13, '#343b42')
        P(ctx, px + x + 5, py + 13, 3, 2, '#b5bbc2')
      }
      break
    }
    case 'bountyboard': {
      P(ctx, px + 2, py + 2, w - 4, hh - 4, '#5b4028')
      P(ctx, px + 6, py + 6, w - 12, hh - 12, '#927046')
      for (let i = 0; i < 5; i++) {
        const ox = 9 + (i % 3) * 18,
          oy = 9 + Math.floor(i / 3) * 18
        P(ctx, px + ox, py + oy, 13, 15, '#ded2b4')
        P(ctx, px + ox + 3, py + oy + 3, 7, 6, '#514538')
        P(ctx, px + ox + 2, py + oy + 11, 9, 1, '#7b6650')
      }
      break
    }
    case 'garageconsole': {
      P(ctx, px + 5, py + 12, w - 10, hh - 14, '#2c3438')
      P(ctx, px + 8, py + 4, w - 16, 22, '#59656a')
      P(ctx, px + 11, py + 7, w - 22, 14, '#10181a')
      P(ctx, px + 14, py + 10, w - 28, 3, '#5bc58a')
      P(ctx, px + 14, py + 16, 7, 3, '#d9a642')
      P(ctx, px + w - 23, py + 16, 7, 3, '#c84e42')
      P(ctx, px + 10, py + 29, w - 20, 5, '#768086')
      P(ctx, px + 14, py + 37, 7, 7, '#c49c43')
      P(ctx, px + w - 21, py + 37, 7, 7, '#55666b')
      break
    }
    case 'vehiclelift': {
      P(ctx, px + 2, py + 2, w - 4, hh - 3, '#20272a')
      P(ctx, px + 7, py + 6, w - 14, hh - 23, '#4d585d')
      P(ctx, px + 11, py + 9, w - 22, hh - 29, '#69757a')
      for (let y = 16; y < hh - 25; y += 11) {
        P(ctx, px + 12, py + y, w - 24, 3, y % 22 ? '#364044' : '#899397')
      }
      P(ctx, px + 5, py + 4, 7, hh - 12, '#171d20')
      P(ctx, px + w - 12, py + 4, 7, hh - 12, '#171d20')
      for (let y = 9; y < hh - 14; y += 18) {
        P(ctx, px + 5, py + y, 7, 9, '#c59b36')
        P(ctx, px + w - 12, py + y, 7, 9, '#c59b36')
      }
      P(ctx, px + 8, py + hh - 18, w - 16, 13, '#262d30')
      for (let x = 12; x < w - 12; x += 14) {
        P(ctx, px + x, py + hh - 15, 8, 3, '#8b9598')
        P(ctx, px + x, py + hh - 9, 8, 3, '#111719')
      }
      P(ctx, px + 14, py + 13, 18, 10, '#182023')
      P(ctx, px + 17, py + 16, 12, 4, '#67c88a')
      break
    }
    case 'stairs_down': {
      P(ctx, px + 2, py + 2, w - 4, hh - 3, 'rgba(10,12,14,0.6)')
      P(ctx, px + 6, py + 5, w - 12, hh - 10, '#171b1d')
      const steps = Math.max(5, Math.floor((hh - 16) / 9))
      for (let step = 0; step < steps; step++) {
        const inset = step * 2
        const stepY = py + 8 + step * 9
        P(ctx, px + 8 + inset, stepY, Math.max(8, w - 16 - inset * 2), 5, '#6f5942')
        P(ctx, px + 9 + inset, stepY, Math.max(6, w - 18 - inset * 2), 2, '#a88657')
      }
      P(ctx, px + 3, py + 1, 4, hh - 5, '#9a7650')
      P(ctx, px + w - 7, py + 1, 4, hh - 5, '#5b4738')
      P(ctx, px + 2, py, w - 4, 4, '#66503d')
      break
    }
    case 'stairs': {
      P(ctx, px + 4, py + 3, w - 8, hh - 4, 'rgba(28,23,20,0.48)')
      P(ctx, px + 7, py + 5, w - 14, hh - 10, '#25221f')
      const steps = Math.max(4, Math.min(10, Math.floor((w - 14) / 4)))
      const rise = Math.max(5, Math.floor((hh - 20) / steps))
      for (let step = 0; step < steps; step++) {
        const inset = step * 2
        const stepY = py + hh - 12 - step * rise
        P(ctx, px + 8 + inset, stepY, Math.max(8, w - 16 - inset * 2), 5, '#816345')
        P(ctx, px + 9 + inset, stepY, Math.max(6, w - 18 - inset * 2), 2, '#b28a5a')
      }
      P(ctx, px + 5, py + 3, 4, hh - 7, '#b08a5b')
      P(ctx, px + 9, py + 5, 2, hh - 11, '#594536')
      P(ctx, px + w - 9, py + 3, 4, hh - 7, '#5b4738')
      P(ctx, px + w - 11, py + 5, 2, hh - 11, '#9a7650')
      P(ctx, px + 3, py + hh - 7, w - 6, 6, '#332922')
      P(ctx, px + 7, py + 1, w - 14, 4, '#66503d')
      break
    }
    case 'rug': {
      P(ctx, px + 4, py + 7, w - 4, hh - 5, 'rgba(42,28,23,0.35)')
      P(ctx, px + 2, py + 2, w - 4, hh - 6, '#68372f')
      P(ctx, px + 4, py + 4, w - 8, hh - 10, '#934838')
      P(ctx, px + 7, py + 7, w - 14, hh - 16, '#a9553d')
      for (let x = 10; x < w - 9; x += 12) {
        P(ctx, px + x, py + 9, 5, hh - 20, x % 24 ? '#7f3b34' : '#c06b49')
        P(ctx, px + x + 2, py + 11, 1, hh - 24, 'rgba(230,164,91,0.35)')
      }
      for (let x = 4; x < w - 4; x += 6) {
        P(ctx, px + x, py, 2, 4, '#d2a15a')
        P(ctx, px + x, py + hh - 5, 2, 4, '#d2a15a')
      }
      break
    }
    case 'bed': {
      P(ctx, px + 5, py + 9, w - 4, hh - 7, 'rgba(38,28,23,0.32)')
      P(ctx, px, py + 5, w, hh - 9, '#353b38')
      P(ctx, px + 3, py + 8, w - 6, hh - 15, '#d9d5c8')
      P(ctx, px + 4, py + 9, 25, hh - 17, '#ece8dc')
      P(ctx, px + 30, py + 9, w - 34, hh - 17, '#758456')
      P(ctx, px + 32, py + 12, w - 38, 3, '#95a36e')
      P(ctx, px + 32, py + 22, w - 38, 2, '#5f7046')
      for (let x = 38; x < w - 7; x += 18) P(ctx, px + x, py + 14, 2, hh - 25, '#839160')
      P(ctx, px + 7, py + 12, 18, 12, '#f1eee3')
      P(ctx, px + 10, py + 14, 12, 2, '#cbc8bc')
      P(ctx, px, py + 3, w, 4, '#4f5651')
      P(ctx, px + 3, py + 2, w - 6, 2, '#8a938c')
      P(ctx, px + 1, py + hh - 8, 4, 8, '#272d2a')
      P(ctx, px + w - 5, py + hh - 8, 4, 8, '#272d2a')
      break
    }
    case 'workbench': {
      P(ctx, px + 6, py + 7, w - 4, hh - 3, 'rgba(37,27,23,0.34)')
      P(ctx, px + 2, py + 2, w - 4, hh - 14, '#45423a')
      P(ctx, px + 5, py + 5, w - 10, hh - 20, '#5a5142')
      for (let y = 9; y < hh - 20; y += 8) {
        for (let x = 9; x < w - 8; x += 9) P(ctx, px + x, py + y, 2, 2, '#2d302d')
      }
      const tools = ['#b8c0bd', '#d0a143', '#9a5d3d', '#6e9da0']
      for (let i = 0; i < Math.max(5, Math.floor(w / 28)); i++) {
        const tx = px + 13 + i * 25
        const ty = py + 9 + (i % 2) * 5
        P(ctx, tx, ty, 3, 17 + (i % 3) * 4, tools[i % tools.length])
        P(ctx, tx - 3, ty + 3, 9, 3, '#252925')
        if (i % 2 === 0) P(ctx, tx + 3, ty + 14, 8, 3, tools[i % tools.length])
      }
      P(ctx, px, py + hh - 18, w, 7, '#8d6239')
      P(ctx, px, py + hh - 18, w, 2, '#c28c50')
      P(ctx, px + 4, py + hh - 11, w - 8, 11, '#4b3528')
      for (let x = 8; x < w - 7; x += 27) {
        P(ctx, px + x, py + hh - 9, 23, 7, '#65452f')
        P(ctx, px + x + 3, py + hh - 7, 12, 1, '#9a7049')
        P(ctx, px + x + 18, py + hh - 7, 2, 2, '#d0a24d')
      }
      P(ctx, px + w / 2 - 8, py + hh - 24, 16, 8, '#838b88')
      P(ctx, px + w / 2 - 5, py + hh - 22, 10, 4, '#333a39')
      break
    }
    case 'shelf': {
      P(ctx, px + 5, py + 6, w - 3, hh - 2, 'rgba(38,28,22,0.34)')
      P(ctx, px + 1, py + 1, w - 2, hh - 4, '#3f2c24')
      P(ctx, px + 4, py + 4, w - 8, hh - 10, '#5a3d2b')
      P(ctx, px + 2, py, 5, hh, '#51331f')
      P(ctx, px + w - 7, py, 5, hh, '#51331f')
      for (let sy = 14; sy < hh; sy += 16) {
        P(ctx, px + 2, py + sy, w - 4, 4, '#755033')
        P(ctx, px + 5, py + sy, w - 10, 1, '#b17b47')
        for (let x = 10; x < w - 12; x += 18) {
          const item = (x / 2 + sy + Math.floor(h * 10)) % 4
          const color = ['#a5533d', '#536f82', '#72834d', '#b58a47'][item]
          P(ctx, px + x, py + sy - 10, 7 + (item % 3), 9, color)
          P(ctx, px + x + 1, py + sy - 9, 2, 7, 'rgba(225,205,151,0.28)')
          if (item === 3) P(ctx, px + x + 2, py + sy - 13, 3, 4, '#b7bec0')
        }
      }
      break
    }
    case 'table': {
      P(ctx, px + 7, py + 16, w - 6, hh - 10, 'rgba(45,30,23,0.3)')
      P(ctx, px + 3, py + 9, w - 6, 9, '#704a32')
      P(ctx, px + 4, py + 9, w - 8, 2, '#b17b51')
      P(ctx, px + 6, py + 14, w - 12, 2, '#4c3326')
      P(ctx, px + 7, py + 18, 5, hh - 20, '#4b3429')
      P(ctx, px + w - 12, py + 18, 5, hh - 20, '#4b3429')
      for (let x = 15; x < w - 14; x += 20) P(ctx, px + x, py + 12, 11, 1, '#8f6040')
      P(ctx, px + w / 2 - 13, py + 3, 11, 6, '#d4d3c7')
      P(ctx, px + w / 2 - 10, py + 5, 6, 2, '#7a8b8d')
      P(ctx, px + w / 2 + 3, py + 5, 8, 4, '#bd723d')
      P(ctx, px + w / 2 + 5, py + 3, 2, 3, '#c3c9c7')
      break
    }
    case 'tv': {
      P(ctx, px + w / 2 - 6, py + 8, 14, 10, '#3a3030')
      P(ctx, px + w / 2 - 4, py + 10, 10, 6, '#7ab8d8')
      P(ctx, px + w / 2 - 6, py + 18, 14, 2, C.woodDK)
      P(ctx, px + w / 2 - 2, py + 20, 6, 4, C.woodDK)
      P(ctx, px + w / 2 - 4, py + 11, 4, 2, '#c8e8f8')
      break
    }
    case 'stove': {
      P(ctx, px + 7, py + 8, w - 6, hh - 3, 'rgba(35,30,27,0.36)')
      P(ctx, px + 4, py + 6, w - 8, hh - 9, '#424a4d')
      P(ctx, px + 6, py + 8, w - 12, 7, '#687276')
      for (let x = 11; x < w - 11; x += 16) {
        P(ctx, px + x, py + 9, 9, 5, '#23292b')
        P(ctx, px + x + 2, py + 10, 5, 2, '#b36c35')
      }
      P(ctx, px + 8, py + 19, w - 16, hh - 30, '#252b2d')
      P(ctx, px + 11, py + 22, w - 22, hh - 37, '#576166')
      P(ctx, px + 14, py + 25, w - 28, 3, '#d47431')
      P(ctx, px + 9, py + hh - 9, 8, 6, '#262c2d')
      P(ctx, px + w - 17, py + hh - 9, 8, 6, '#262c2d')
      P(ctx, px + 10, py, 6, 8, '#596368')
      P(ctx, px + 11, py, 4, 2, '#8c9597')
      break
    }
    case 'sofa': {
      P(ctx, px + 6, py + 10, w - 3, hh - 4, 'rgba(43,28,24,0.35)')
      P(ctx, px + 1, py + 8, w - 2, hh - 12, '#62382f')
      P(ctx, px + 4, py + 4, w - 8, 15, '#8a4d3e')
      P(ctx, px + 6, py + 6, w - 12, 3, '#ad6a50')
      P(ctx, px + 5, py + 18, w - 10, hh - 26, '#955441')
      const cushions = Math.max(2, Math.floor(w / 30))
      const cushionW = Math.floor((w - 14) / cushions)
      for (let i = 0; i < cushions; i++) {
        const cx = px + 7 + i * cushionW
        P(ctx, cx, py + 20, cushionW - 3, hh - 30, i % 2 ? '#87483b' : '#9d5944')
        P(ctx, cx + 2, py + 22, cushionW - 7, 2, '#b86d50')
        P(ctx, cx + cushionW - 4, py + 21, 1, hh - 33, '#5f332d')
      }
      P(ctx, px, py + 13, 6, hh - 19, '#704035')
      P(ctx, px + w - 6, py + 13, 6, hh - 19, '#704035')
      P(ctx, px + 3, py + hh - 7, w - 6, 5, '#492a27')
      break
    }
    case 'poster': {
      P(ctx, px + 4, py + 2, 24, 18, '#e8e0c8')
      P(ctx, px + 6, py + 4, 20, 14, '#c8c8b8')
      P(ctx, px + 8, py + 6, 16, 8, '#5a4a3a')
      P(ctx, px + 4, py + 2, 24, 2, '#a89880')
      break
    }
    case 'plant': {
      P(ctx, px + 12, py + 20, 9, 8, '#8a4a3a')
      P(ctx, px + 12, py + 20, 9, 2, '#a86048')
      P(ctx, px + 15, py + 8, 3, 13, '#2f7226')
      P(ctx, px + 9, py + 10, 15, 5, '#4d9c3e')
      P(ctx, px + 12, py + 6, 9, 5, '#54a542')
      break
    }
    case 'radio': {
      P(ctx, px + 10, py + 16, 13, 9, '#5a4634')
      P(ctx, px + 11, py + 17, 11, 5, '#7a6248')
      P(ctx, px + 19, py + 18, 2, 3, C.gold)
      P(ctx, px + 13, py + 12, 2, 5, C.metal)
      P(ctx, px + 17, py + 11, 1, 6, C.metal)
      break
    }
    default:
      P(ctx, px + 2, py + 2, w - 4, hh - 4, C.wood)
      P(ctx, px + 2, py + 2, w - 4, 2, C.woodLT)
      P(ctx, px + 2, py + hh - 4, w - 4, 2, C.woodDK)
  }
}

/* ---------------- 城镇装饰生成 ---------------- */

export function townDecor(town: TownDef): { x: number; y: number; t: string }[] {
  if (town.authored) return []
  const [w, h] = town.size
  const rnd = mulberry32(0x9e3779b9 ^ ((town.variant || 0) * 7919))
  const out: { x: number; y: number; t: string }[] = []
  const used = new Set<string>()
  const add = (x: number, y: number, t: string) => {
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return
    if (x === Math.floor(w / 2) && y === h - 2) return
    if (townPathAt(town, x, y)) return
    if (town.buildings.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) return
    if (town.npcs.some((n) => n.x === x && n.y === y)) return
    const k = x + ',' + y
    if (used.has(k)) return
    used.add(k)
    out.push({ x, y, t })
  }
  // 边界树
  for (let x = 2; x < w - 2; x += 2) {
    add(x, 1, 'tree')
    add(x + (rnd() > 0.5 ? 1 : 0), h - 2, 'tree2')
  }
  for (let y = 3; y < h - 2; y += 2) {
    add(1, y, 'tree2')
    add(w - 2, y + (rnd() > 0.5 ? 1 : 0), 'tree')
  }
  // 主路路灯
  const ex = Math.floor(w / 2)
  for (const yy of [7, 13, 19]) {
    add(ex + 3, yy, 'lamp')
    add(ex - 3, yy, 'lamp')
  }
  // 空地装饰
  for (let i = 0; i < 14; i++) {
    const x = 3 + Math.floor(rnd() * (w - 6))
    const y = 19 + Math.floor(rnd() * 3)
    const roll = rnd()
    add(
      x,
      y,
      roll > 0.85
        ? 'flower'
        : roll > 0.7
          ? 'flower2'
          : roll > 0.55
            ? 'bench'
            : roll > 0.4
              ? 'rock'
              : roll > 0.25
                ? 'stump'
                : 'tree2'
    )
  }
  add(ex - 5, 20, 'well')
  add(ex + 6, 22, 'sign')
  // 商店旁木箱
  for (const b of town.buildings) {
    if (['weapon', 'tankshop', 'modshop', 'inn'].includes(b.type)) {
      add(b.x + b.w + 1, b.y + Math.floor(b.h / 2), 'crate')
      add(b.x - 1, b.y + Math.floor(b.h / 2), 'barrel')
    }
  }
  // 角落水塔
  add(w - 3, 4, 'watertower')
  return out
}

export const DECOR_BLOCK = new Set([
  'tree',
  'tree2',
  'lamp',
  'well',
  'sign',
  'crate',
  'barrel',
  'bench',
  'cart',
  'rock',
  'stump',
  'cactus',
  'watertower',
  'silo',
  'pump',
  'hay',
  'tractor',
  'fence',
  'poster',
  'campfire',
  'plant',
  'memorial',
  'scrap'
])

export function townDecorAt(town: TownDef, x: number, y: number): string | null {
  const all = [...townDecor(town), ...(town.decor || [])]
  for (const d of all) if (d.x === x && d.y === y && DECOR_BLOCK.has(d.t)) return d.t
  return null
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------------- 统一入口 ---------------- */

export function drawWorldTile(g: TileGfx, ch: string) {
  switch (ch) {
    case '.':
      grassTile(g, true)
      break
    case ',':
      grassTile(g, false)
      if (g.h > 0.6) P(g.ctx, g.x * TS + 6, g.y * TS + 8, 8, 6, C.grassDK)
      break
    case 'f':
      forestTile(g)
      break
    case 'm':
      mountainTile(g)
      break
    case 'w':
      waterTile(g)
      break
    case 's':
      sandTile(g)
      break
    case 'r':
      roadTile(g)
      break
    case 't':
      townLotTile(g)
      break
    case 'D':
      gateTile(g)
      break
    case 'C':
      caveMouthTile(g)
      break
    case 'G':
      checkpointTile(g)
      break
    case 'F':
      fordTile(g)
      break
    case 'H':
      hellGateTile(g)
      break
    case 'N':
      noahTile(g)
      break
    default:
      grassTile(g, true)
      break
  }
}

export function drawTownTile(g: TileGfx, ch: string, town: TownDef) {
  if (ch === 'E') {
    gateTile(g)
    return
  }
  townGround(g, town)
}

export function drawCaveTile(g: TileGfx, ch: string) {
  switch (ch) {
    case '#':
      caveWall(g)
      break
    case '~':
      caveWater(g)
      break
    case 'O':
      caveRubble(g)
      break
    case '=':
      caveRail(g)
      break
    case 'c':
      caveCrystal(g)
      break
    case 's':
      caveBones(g)
      break
    case '^':
      caveStalagmite(g)
      break
    case 'I':
      chestTile(g)
      break
    case 'X':
      eventTile(g)
      break
    case 'E':
      exitTile(g)
      break
    default:
      caveFloor(g)
      break
  }
}

export function drawRoomTile(g: TileGfx, ch: string, room: RoomDef) {
  switch (ch) {
    case '#':
      roomWall(g)
      break
    case 'E':
      roomExit(g, room.floor)
      break
    case 'B':
      roomFloor(g, room.floor)
      P(g.ctx, g.x * TS + 4, g.y * TS + 4, 24, 24, 'rgba(0,0,0,0.25)')
      break
    default:
      roomFloor(g, room.floor)
      break
  }
}
