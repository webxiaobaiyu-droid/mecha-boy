/* 离屏渲染预览：无 DOM 环境下把地图烘焙成 PNG，并保留 PPM 原始图。 */

import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'
import { bakeMap, bindCanvas, drawBattleScene, drawScene } from '../src/game/engine/renderer'
import {
  BATTLE_EFFECT_DURATION,
  battleFighterLayout,
  battleMobLayout
} from '../src/game/assets/battle'
import { createInitialState, makeTank } from '../src/game/core/state'
import { WORLD_GATE_POSITIONS, WORLD_H, WORLD_TOWN_POSITIONS, WORLD_W } from '../src/game/data/maps'
import { forceWeather, setWorldTime } from '../src/game/systems/environment'
import type {
  BattleEffect,
  BattleEnvironment,
  BattleWeaponKind,
  GameState
} from '../src/game/types'

interface FakeGradient {
  stops: [number, string][]
  _x0: number
  _y0: number
  _x1: number
  _y1: number
}

/* ---------------- 极简 Canvas2D shim ---------------- */
class FakeCanvas {
  private _w: number
  private _h: number
  data: Uint8ClampedArray
  constructor(w = 1, h = 1) {
    this._w = w
    this._h = h
    this.data = new Uint8ClampedArray(w * h * 4)
  }
  get width() {
    return this._w
  }
  set width(v: number) {
    this._w = v
    this.data = new Uint8ClampedArray(v * this._h * 4)
  }
  get height() {
    return this._h
  }
  set height(v: number) {
    this._h = v
    this.data = new Uint8ClampedArray(this._w * v * 4)
  }
  getContext() {
    return new FakeCtx(this)
  }
}

function parseColor(s: string): [number, number, number, number] {
  if (typeof s !== 'string') return [0, 0, 0, 255]
  if (s.startsWith('#')) {
    const v = parseInt(s.slice(1), 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255]
  }
  const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
  if (m) {
    const a = m[4] !== undefined ? Math.round(parseFloat(m[4]) * 255) : 255
    return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), a]
  }
  return [0, 0, 0, 255]
}

class FakeCtx {
  private cv: FakeCanvas
  fillStyle: string | FakeGradient = '#000'
  font = ''
  textAlign = 'left'
  textBaseline = 'top'
  imageSmoothingEnabled = true
  globalAlpha = 1
  filter = 'none'
  private path: [number, number][] = []
  constructor(cv: FakeCanvas) {
    this.cv = cv
  }
  save() {}
  restore() {}
  translate(_x: number, _y: number) {}
  scale(_x: number, _y: number) {}
  rotate(_angle: number) {}
  private blend(x: number, y: number, c: [number, number, number, number]) {
    if (x < 0 || y < 0 || x >= this.cv.width || y >= this.cv.height) return
    const i = (y * this.cv.width + x) * 4
    const d = this.cv.data
    const a = c[3] / 255
    if (a >= 1) {
      d[i] = c[0]
      d[i + 1] = c[1]
      d[i + 2] = c[2]
      d[i + 3] = 255
    } else {
      d[i] = Math.round(d[i] * (1 - a) + c[0] * a)
      d[i + 1] = Math.round(d[i + 1] * (1 - a) + c[1] * a)
      d[i + 2] = Math.round(d[i + 2] * (1 - a) + c[2] * a)
      d[i + 3] = 255
    }
  }
  fillRect(x: number, y: number, w: number, h: number) {
    const x0 = Math.round(x),
      y0 = Math.round(y)
    const x1 = Math.round(x + w),
      y1 = Math.round(y + h)
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        if (this.fillStyle && typeof this.fillStyle === 'object') {
          const g = this.fillStyle
          const t = g._y1 !== g._y0 ? (yy - g._y0) / (g._y1 - g._y0) : 0
          const [c1, s1] = g.stops[0] || [0, '#000']
          const [c2, s2] = g.stops[g.stops.length - 1] || [1, '#000']
          const k = Math.max(0, Math.min(1, (t - c1) / (c2 - c1 || 1)))
          const a = parseColor(s1),
            b = parseColor(s2)
          this.blend(xx, yy, [
            Math.round(a[0] + (b[0] - a[0]) * k),
            Math.round(a[1] + (b[1] - a[1]) * k),
            Math.round(a[2] + (b[2] - a[2]) * k),
            255
          ])
        } else {
          this.blend(xx, yy, parseColor(this.fillStyle as string))
        }
      }
    }
  }
  clearRect(x: number, y: number, w: number, h: number) {
    this.fillStyle = 'rgba(0,0,0,0)'
    this.fillRect(x, y, w, h)
  }
  beginPath() {
    this.path = []
  }
  moveTo(x: number, y: number) {
    this.path.push([x, y])
  }
  lineTo(x: number, y: number) {
    this.path.push([x, y])
  }
  closePath() {
    if (this.path.length) this.path.push(this.path[0])
  }
  fill() {
    if (this.path.length < 3) return
    const c = parseColor(typeof this.fillStyle === 'string' ? this.fillStyle : '#000')
    const pts = this.path
    const minX = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0]))))
    const maxX = Math.min(this.cv.width - 1, Math.ceil(Math.max(...pts.map((p) => p[0]))))
    const minY = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))))
    const maxY = Math.min(this.cv.height - 1, Math.ceil(Math.max(...pts.map((p) => p[1]))))
    const inside = (x: number, y: number) => {
      let hit = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0],
          yi = pts[i][1],
          xj = pts[j][0],
          yj = pts[j][1]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
      }
      return hit
    }
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        if (inside(xx + 0.5, yy + 0.5)) this.blend(xx, yy, c)
      }
    }
  }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    const stops: [number, string][] = []
    return {
      addColorStop: (o: number, s: string) => {
        stops.push([o, s])
      },
      get stops() {
        return stops
      },
      _x0: x0,
      _y0: y0,
      _x1: x1,
      _y1: y1
    }
  }
  drawImage(
    src: FakeCanvas,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ) {
    for (let yy = 0; yy < dh; yy++) {
      const syy = Math.floor((yy / dh) * sh + sy)
      for (let xx = 0; xx < dw; xx++) {
        const sxx = Math.floor((xx / dw) * sw + sx)
        if (sxx < 0 || syy < 0 || sxx >= src.width || syy >= src.height) continue
        const i = (syy * src.width + sxx) * 4
        const d = src.data
        const ox = Math.round(dx) + xx,
          oy = Math.round(dy) + yy
        this.blend(ox, oy, [d[i], d[i + 1], d[i + 2], d[i + 3]])
      }
    }
  }
  fillText() {}
  measureText(s: string) {
    return { width: s.length * 8 }
  }
}

;(globalThis as unknown as { document: { createElement: (tag: string) => unknown } }).document = {
  createElement: (tag: string) => {
    if (tag === 'canvas') return new FakeCanvas(1, 1)
    return { getContext: () => null }
  }
}
;(globalThis as unknown as { HTMLCanvasElement: typeof FakeCanvas }).HTMLCanvasElement = FakeCanvas

function save(cv: FakeCanvas, name: string) {
  mkdirSync('preview', { recursive: true })
  const header = `P6\n${cv.width} ${cv.height}\n255\n`
  const rgb = Buffer.alloc(cv.width * cv.height * 3)
  for (let i = 0; i < cv.width * cv.height; i++) {
    rgb[i * 3] = cv.data[i * 4]
    rgb[i * 3 + 1] = cv.data[i * 4 + 1]
    rgb[i * 3 + 2] = cv.data[i * 4 + 2]
  }
  writeFileSync('preview/' + name + '.ppm', Buffer.concat([Buffer.from(header), rgb]))
  writeFileSync('preview/' + name + '.png', encodePng(cv))
  console.log('saved', name, cv.width, 'x', cv.height)
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

function pngChunk(type: string, data: Buffer): Buffer {
  const typeData = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  let crc = 0xffffffff
  for (const byte of Buffer.concat([typeData, data]))
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([length, typeData, data, checksum])
}

function encodePng(cv: FakeCanvas): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(cv.width, 0)
  header.writeUInt32BE(cv.height, 4)
  header[8] = 8
  header[9] = 6
  const stride = cv.width * 4
  const scanlines = Buffer.alloc((stride + 1) * cv.height)
  const pixels = Buffer.from(cv.data)
  for (let y = 0; y < cv.height; y++) {
    const outputOffset = y * (stride + 1)
    scanlines[outputOffset] = 0
    pixels.copy(scanlines, outputOffset + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function cameraPreview(
  map: FakeCanvas,
  mapSize: [number, number],
  tileSize: number,
  player: [number, number]
) {
  const output = new FakeCanvas(640, 480)
  const context = output.getContext()
  const renderScale = tileSize / 32
  const cameraX = Math.max(
    0,
    Math.min(Math.round(player[0] * tileSize - 320), Math.max(0, mapSize[0] * tileSize - 640))
  )
  const cameraY = Math.max(
    0,
    Math.min(
      Math.round(player[1] * tileSize - 480 * 0.53),
      Math.max(0, mapSize[1] * tileSize - 480)
    )
  )
  context.drawImage(
    map,
    cameraX / renderScale,
    cameraY / renderScale,
    640 / renderScale,
    480 / renderScale,
    0,
    0,
    640,
    480
  )
  return output
}

function roomScenePreview() {
  const output = new FakeCanvas(640, 480)
  bindCanvas(output as unknown as HTMLCanvasElement)
  const state = createInitialState()
  state.screen = 'room'
  state.map = 'rado_home'
  state.px = 10
  state.py = 12
  state.facing = 1
  state.inTown = 'rado'
  drawScene(state)
  return output
}

function weatherScenePreview(
  map: 'world' | 'rado',
  minute: number,
  weather: GameState['environment']['weather'],
  playtime = 5.4
) {
  const output = new FakeCanvas(640, 480)
  bindCanvas(output as unknown as HTMLCanvasElement)
  const state = createInitialState()
  state.screen = map === 'world' ? 'world' : 'town'
  state.map = map
  state.px = map === 'world' ? WORLD_TOWN_POSITIONS.rado[0] : 22
  state.py = map === 'world' ? WORLD_TOWN_POSITIONS.rado[1] : 22
  state.facing = 1
  state.inTown = map === 'world' ? null : 'rado'
  state.playtime = playtime
  setWorldTime(state.environment, minute)
  forceWeather(state.environment, weather)
  drawScene(state)
  return output
}

function gateScenePreview(open: boolean) {
  const output = new FakeCanvas(640, 480)
  bindCanvas(output as unknown as HTMLCanvasElement)
  const state = createInitialState()
  const gate = WORLD_GATE_POSITIONS.windbreak
  state.screen = 'world'
  state.map = 'world'
  state.px = gate[0] - 1
  state.py = gate[1]
  state.facing = 3
  state.flags.gate_windbreak_open = open
  drawScene(state)
  return output
}

const worldMap = bakeMap('world') as unknown as FakeCanvas
const radoMap = bakeMap('rado') as unknown as FakeCanvas
const masaruMap = bakeMap('masaru') as unknown as FakeCanvas
const caveMap = bakeMap('cave1') as unknown as FakeCanvas
const homeMap = bakeMap('rado_home') as unknown as FakeCanvas

save(worldMap, 'world')
save(radoMap, 'rado')
save(masaruMap, 'masaru')
save(caveMap, 'cave1')
save(homeMap, 'rado_home')
save(cameraPreview(worldMap, [WORLD_W, WORLD_H], 20, WORLD_TOWN_POSITIONS.rado), 'world-camera')
save(cameraPreview(radoMap, [44, 26], 20, [22, 24]), 'rado-camera')
save(cameraPreview(caveMap, [26, 17], 29, [2, 12]), 'cave1-camera')
save(roomScenePreview(), 'rado-home-camera')
save(weatherScenePreview('rado', 12 * 60, 'clear'), 'weather-rado-day')
save(weatherScenePreview('rado', 18 * 60 + 15, 'wind'), 'weather-rado-dusk-wind')
save(weatherScenePreview('rado', 22 * 60, 'clear'), 'weather-rado-night')
save(weatherScenePreview('rado', 14 * 60, 'rain'), 'weather-rado-rain')
save(weatherScenePreview('world', 22 * 60, 'storm', 8.1), 'weather-world-night-storm')
save(gateScenePreview(false), 'gate-windbreak-locked')
save(gateScenePreview(true), 'gate-windbreak-open')

function battlePreviewState(
  environment: BattleEnvironment,
  weaponKind?: Extract<BattleWeaponKind, 'main' | 'sub' | 'se'>
): GameState {
  const target = battleMobLayout(0, 2, 1)
  const source = battleFighterLayout(0)
  const effect: BattleEffect | null = weaponKind
    ? {
        weaponKind,
        fromX: source.muzzleX,
        fromY: source.muzzleY,
        toX: target.impactX,
        toY: target.impactY,
        dmg: 45,
        hit: true,
        duration: BATTLE_EFFECT_DURATION[weaponKind],
        elapsed: BATTLE_EFFECT_DURATION[weaponKind] * 0.42
      }
    : null

  return {
    playtime: 0,
    environment: createInitialState().environment,
    battle: {
      mobs: [
        {
          id: 'm1',
          name: 'x',
          tpl: 'blob',
          colors: { X: '#e83838', Y: '#f0a030' },
          hp: 10,
          maxHp: 10,
          atk: 1,
          def: 1,
          spd: 1,
          xp: 1,
          gold: 1,
          size: 1,
          x: 180,
          y: 40,
          isBoss: false
        },
        {
          id: 'm2',
          name: 'x',
          tpl: 'bot',
          colors: { X: '#8a8a96', Y: '#d8d8d8' },
          hp: 10,
          maxHp: 10,
          atk: 1,
          def: 1,
          spd: 1,
          xp: 1,
          gold: 1,
          size: 2,
          x: 244,
          y: 56,
          isBoss: false
        }
      ],
      fighters: [
        {
          member: {
            id: 'hero',
            name: '阿雷',
            cls: 'hero' as const,
            lv: 1,
            hp: 10,
            maxHp: 10,
            atk: 1,
            def: 1,
            spd: 1,
            xp: 0,
            tankId: 't1'
          },
          tank: makeTank('t1')
        },
        {
          member: {
            id: 'mecha',
            name: '美娜',
            cls: 'mecha' as const,
            lv: 1,
            hp: 10,
            maxHp: 10,
            atk: 1,
            def: 1,
            spd: 1,
            xp: 0,
            tankId: 't4'
          },
          tank: makeTank('t4')
        },
        {
          member: {
            id: 'wolf',
            name: '红狼',
            cls: 'wolf' as const,
            lv: 1,
            hp: 10,
            maxHp: 10,
            atk: 1,
            def: 1,
            spd: 1,
            xp: 0,
            tankId: 't7'
          },
          tank: makeTank('t7')
        }
      ],
      opts: {},
      phase: 'fight' as const,
      round: 0,
      order: [],
      qi: 0,
      pending: [],
      pendT: 0,
      cmd: null,
      log: [],
      environment,
      effect,
      bounty: null,
      winQueued: false,
      done: false,
      introT: 0
    }
  } as unknown as GameState
}

import * as renderer from '../src/game/engine/renderer'

function saveBattlePreview(name: string, state: GameState) {
  const canvas = new FakeCanvas(640, 480)
  renderer.bindCanvas(canvas)
  drawBattleScene(state)
  save(canvas, name)
}

for (const environment of [
  'field',
  'forest',
  'mountain',
  'town',
  'cave',
  'desert',
  'final'
] as const) {
  saveBattlePreview(`battle-${environment}`, battlePreviewState(environment))
}

for (const weaponKind of ['main', 'sub', 'se'] as const) {
  saveBattlePreview(`battle-${weaponKind}`, battlePreviewState('field', weaponKind))
}

saveBattlePreview('battle', battlePreviewState('field'))

const weatherBattle = battlePreviewState('town')
weatherBattle.map = 'rado'
weatherBattle.screen = 'battle'
weatherBattle.playtime = 8.1
setWorldTime(weatherBattle.environment, 22 * 60)
forceWeather(weatherBattle.environment, 'storm')
saveBattlePreview('weather-battle-night-storm', weatherBattle)
