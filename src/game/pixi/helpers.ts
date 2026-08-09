import { Texture } from 'pixi.js'
import { CAVES, ROOMS, TOWNS, WORLD_H, WORLD_W } from '@/game/data/maps'
import type { GameState } from '@/game/types'

export const BASE_TILE_SIZE = 32

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function colorNumber(color: string | undefined, fallback = 0xffffff): number {
  if (!color) return fallback
  const normalized = color.trim().replace('#', '')
  if (/^[0-9a-f]{3}$/i.test(normalized)) {
    return Number.parseInt(
      normalized
        .split('')
        .map((part) => part + part)
        .join(''),
      16
    )
  }
  return /^[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized, 16) : fallback
}

export function movingPosition(state: GameState): { x: number; y: number } {
  if (!state.anim) return { x: state.px, y: state.py }
  const progress = clamp(state.anim.t, 0, 1)
  return {
    x: state.anim.fx + (state.anim.tx - state.anim.fx) * progress,
    y: state.anim.fy + (state.anim.ty - state.anim.fy) * progress
  }
}

export function mapSize(mapId: string): [number, number] {
  if (mapId === 'world') return [WORLD_W, WORLD_H]
  const map =
    TOWNS.find((item) => item.id === mapId) ||
    CAVES.find((item) => item.id === mapId) ||
    ROOMS.find((item) => item.id === mapId)
  return map?.size || [20, 15]
}

export function canvasTexture(canvas: HTMLCanvasElement): Texture {
  const texture = Texture.from(canvas)
  texture.source.scaleMode = 'nearest'
  return texture
}

export function createCanvas(
  width: number,
  height: number
): {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
} {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width))
  canvas.height = Math.max(1, Math.ceil(height))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable for texture generation')
  context.imageSmoothingEnabled = false
  return { canvas, context }
}

export function createGradientTexture(
  width: number,
  height: number,
  top: string,
  bottom: string
): Texture {
  const { canvas, context } = createCanvas(width, height)
  const gradient = context.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, top)
  gradient.addColorStop(1, bottom)
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
  return canvasTexture(canvas)
}

export function createRadialTexture(size = 256): Texture {
  const { canvas, context } = createCanvas(size, size)
  const center = size / 2
  const gradient = context.createRadialGradient(center, center, 0, center, center, center)
  gradient.addColorStop(0, 'rgba(255,231,159,0.72)')
  gradient.addColorStop(0.24, 'rgba(255,206,112,0.28)')
  gradient.addColorStop(1, 'rgba(255,184,72,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  return canvasTexture(canvas)
}
