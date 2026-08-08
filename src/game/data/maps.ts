/* 地图数据：地形 / 世界地图生成 / 城镇 / 洞窟 */

import type { CaveDef, RoomDef, TownDef } from '@/game/types'

export const TILE: Record<string, { c: string; w: boolean; enc?: number }> = {
  ' ': { c: '#000000', w: true },
  '.': { c: '#3a8a30', w: true },
  ',': { c: '#327a28', w: true },
  r: { c: '#a08050', w: true },
  f: { c: '#1e5c22', w: true, enc: 1.6 },
  m: { c: '#5a5a66', w: false },
  w: { c: '#2850b8', w: false },
  s: { c: '#c8b878', w: true, enc: 1.4 },
  t: { c: '#8a8a8a', w: true },
  D: { c: '#a0a0a0', w: true },
  C: { c: '#2a2a30', w: true },
  H: { c: '#6a5a3a', w: true },
  N: { c: '#40404a', w: true },
  G: { c: '#7d4d40', w: true },
  F: { c: '#8c7650', w: true, enc: 1.35 },
  I: { c: '#ffd700', w: true }
}

export const WORLD_W = 96
export const WORLD_H = 72

export const WORLD_TOWN_POSITIONS: Record<string, [number, number]> = {
  rado: [24, 58],
  windpump: [36, 52],
  masaru: [48, 46],
  reed: [66, 47],
  pobb: [82, 38],
  rock: [22, 32],
  ashridge: [31, 32],
  odo: [50, 26],
  tarr: [35, 13],
  sold: [68, 17],
  eden: [85, 11]
}

export const WORLD_CAVE_POSITIONS: Record<string, [number, number]> = {
  cave1: [25, 64],
  north_relay: [33, 56],
  factory: [90, 38],
  clinic: [25, 34],
  puru_cave: [90, 17],
  base8: [15, 14],
  hell_gate: [62, 5],
  noa: [62, 2]
}

export const WORLD_GATE_POSITIONS: Record<string, [number, number]> = {
  windbreak: [43, 50],
  tidebridge: [72, 43],
  sluice: [72, 32],
  graypass: [40, 28],
  north_checkpoint: [61, 20]
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

export function buildWorld(): string[] {
  const rnd = mulberry32(20260802)
  const g: string[][] = Array.from({ length: WORLD_H }, () => Array(WORLD_W).fill('.'))
  // 东部海洋与波布镇南侧大湖。
  for (let y = 6; y < 66; y++) for (let x = 93; x < WORLD_W; x++) g[y][x] = 'w'
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++) {
      const dx = x - 82,
        dy = y - 49
      if ((dx * dx) / 100 + (dy * dy) / 49 < 1 && g[y][x] === '.') g[y][x] = 'w'
    }
  // 西北大沙漠
  for (let y = 2; y < 27; y++)
    for (let x = 2; x < 31; x++) {
      if (g[y][x] === '.') g[y][x] = 's'
    }
  // 山地
  const mts: [number, number, number][] = [
    [9, 40, 10],
    [60, 3, 8],
    [18, 66, 7],
    [38, 42, 6],
    [76, 62, 7],
    [11, 16, 7],
    [38, 25, 6],
    [61, 25, 5]
  ]
  for (const [cx, cy, rad] of mts) {
    for (let y = 0; y < WORLD_H; y++)
      for (let x = 0; x < WORLD_W; x++) {
        const dx = (x - cx) / (rad * 1.12)
        const dy = (y - cy) / (rad * 0.86)
        const d = Math.hypot(dx, dy)
        const edgeNoise =
          Math.sin((x + cx * 3) * 1.37) * 0.07 + Math.cos((y - cy * 2) * 1.71) * 0.06
        if (d < 0.96 + edgeNoise) g[y][x] = 'm'
      }
  }
  // 森林
  const frs: [number, number, number][] = [
    [40, 50, 6],
    [69, 45, 6],
    [25, 23, 5],
    [77, 16, 5],
    [55, 55, 5]
  ]
  for (const [cx, cy, rad] of frs) {
    for (let y = 0; y < WORLD_H; y++)
      for (let x = 0; x < WORLD_W; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d < rad && rnd() < 0.7) g[y][x] = 'f'
      }
  }
  // 三条自然屏障制造真实的区域拓扑；连续起伏的轮廓避免出现矩形关卡墙。
  // 南部盆地东侧只能走裂风山口，北侧则可挑战马歇尔后从灰脊关提前破局。
  for (let y = 28; y < WORLD_H; y++) {
    const ridgeX = 43 + Math.round(Math.sin((y - 50) * 0.32) * 2)
    for (let x = ridgeX - 1; x <= ridgeX + 1; x++) g[y][x] = 'm'
  }
  for (let x = 0; x <= 55; x++) {
    const ridgeY = 28 + Math.round(Math.sin((x - 40) * 0.3) * 2)
    for (let y = ridgeY - 1; y <= ridgeY + 1; y++) g[y][x] = 'm'
  }
  for (let y = 19; y <= 21; y++) for (let x = 45; x <= 78; x++) g[y][x] = 'm'

  // 主城、村落与部落都占据 3×3 世界瓦片，中心为入口。
  for (const key in WORLD_TOWN_POSITIONS) {
    const [tx, ty] = WORLD_TOWN_POSITIONS[key]
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        g[ty + dy][tx + dx] = 't'
      }
    g[ty][tx] = 'D'
  }

  // 道路
  const road = (x0: number, y0: number, x1: number, y1: number) => {
    let x = x0,
      y = y0
    while (x !== x1 || y !== y1) {
      if (x !== x1 && (y === y1 || Math.abs(x - x1) >= Math.abs(y - y1))) x += x1 > x0 ? 1 : -1
      else y += y1 > y0 ? 1 : -1
      if (
        g[y][x] === '.' ||
        g[y][x] === ',' ||
        g[y][x] === 's' ||
        g[y][x] === 'm' ||
        g[y][x] === 'f'
      )
        g[y][x] = 'r'
    }
  }
  const town = WORLD_TOWN_POSITIONS
  const cave = WORLD_CAVE_POSITIONS
  const gate = WORLD_GATE_POSITIONS

  // 南部新手环：主路经过风泵村与裂风山口；西线可以提前窥见更危险的灰岭。
  road(...town.rado, 30, 55)
  road(30, 55, ...town.windpump)
  road(...town.windpump, ...gate.windbreak)
  road(...gate.windbreak, ...town.masaru)
  road(...town.rado, 24, 64)
  road(24, 64, ...cave.cave1)
  road(...town.windpump, 34, 55)
  road(34, 55, ...cave.north_relay)
  road(...town.windpump, 32, 43)
  road(32, 43, ...town.ashridge)
  road(...town.ashridge, ...town.rock)

  // 中部形成三角回环：灰岭主关、麦镇东线和波布水闸捷径互相回接。
  road(...town.ashridge, ...gate.graypass)
  road(...gate.graypass, ...town.odo)
  road(...town.masaru, 54, 36)
  road(54, 36, ...town.odo)
  road(...town.masaru, 57, 44)
  road(57, 44, ...town.reed)
  road(...town.reed, 69, 44)
  road(69, 44, ...gate.tidebridge)
  road(...gate.tidebridge, 77, 41)
  road(77, 41, ...town.pobb)
  road(...town.pobb, 77, 34)
  road(77, 34, ...gate.sluice)
  road(...gate.sluice, 61, 29)
  road(61, 29, ...town.odo)

  // 南侧浅滩是不锁门的危险绕路，比断潮桥远得多。
  road(...town.reed, 69, 56)
  road(69, 56, 69, 59)
  road(69, 59, 71, 59)
  road(71, 59, 72, 59)
  road(72, 59, 92, 59)
  road(92, 59, 92, 40)
  road(92, 40, ...town.pobb)

  // 北部军管区：正门有守卫，东西两侧仍保留长距离高危绕行。
  road(...town.odo, 57, 22)
  road(57, 22, ...gate.north_checkpoint)
  road(...gate.north_checkpoint, ...town.sold)
  road(...town.pobb, 82, 23)
  road(82, 23, 78, 18)
  road(78, 18, ...town.sold)
  road(...town.odo, 44, 20)
  road(44, 20, ...town.tarr)
  road(...town.tarr, 52, 15)
  road(52, 15, ...town.sold)
  road(...town.sold, ...town.eden)
  road(...town.tarr, 25, 14)
  road(25, 14, ...cave.base8)
  road(...town.eden, 72, 8)
  road(72, 8, ...cave.hell_gate)
  road(...town.tarr, 48, 8)
  road(48, 8, ...cave.hell_gate)
  road(...cave.hell_gate, ...cave.noa)

  // 洞窟支路。
  road(...town.pobb, ...cave.factory)
  road(...town.rock, ...cave.clinic)
  road(...town.eden, ...cave.puru_cave)

  // 断潮河贯穿大陆，只保留剧情关口、南侧浅滩和后期北部军道的明确过河点。
  const riverAnchors = [0, 8, 17, 32, 43, 59, WORLD_H - 1]
  for (let segment = 0; segment < riverAnchors.length - 1; segment++) {
    const startY = riverAnchors[segment]
    const endY = riverAnchors[segment + 1]
    const direction = segment % 2 === 0 ? 1 : -1
    for (let y = startY; y <= endY; y++) {
      const progress = (y - startY) / Math.max(1, endY - startY)
      const riverX = 72 + Math.round(Math.sin(progress * Math.PI) * 2 * direction)
      for (let x = riverX - 1; x <= riverX + 1; x++) g[y][x] = 'w'
    }
  }
  for (const y of [8, 17, 32, 43, 59]) {
    g[y][71] = 'r'
    g[y][73] = 'r'
  }
  g[8][72] = 'r'
  g[17][72] = 'r'
  g[59][72] = 'F'

  // 世界特殊入口与动态关口最后落点，避免被道路覆盖。
  g[cave.cave1[1]][cave.cave1[0]] = 'C'
  g[cave.north_relay[1]][cave.north_relay[0]] = 'C'
  g[cave.factory[1]][cave.factory[0]] = 'C'
  g[cave.clinic[1]][cave.clinic[0]] = 'C'
  g[cave.puru_cave[1]][cave.puru_cave[0]] = 'C'
  g[cave.base8[1]][cave.base8[0]] = 'C'
  g[cave.hell_gate[1]][cave.hell_gate[0]] = 'H'
  g[cave.noa[1]][cave.noa[0]] = 'N'
  for (const [x, y] of Object.values(WORLD_GATE_POSITIONS)) g[y][x] = 'G'

  // 草地差异
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++) {
      if (g[y][x] === '.' && rnd() < 0.18) g[y][x] = ','
    }
  return g.map((row) => row.join(''))
}

export const WORLD: string[] = buildWorld()

type Bld = TownDef['buildings'][number]

const bld = (x: number, y: number, type: string, name: string, opts: Partial<Bld> = {}): Bld => ({
  x,
  y,
  w: opts.w || 6,
  h: opts.h || 4,
  type,
  name,
  door: opts.door || [x + Math.floor((opts.w || 6) / 2), y + (opts.h || 4) - 1],
  story: opts.story,
  open: opts.open,
  roomId: opts.roomId
})

const houses = (): Bld[] => [
  bld(2, 14, 'house', '民宅', { w: 5, h: 3, open: false }),
  bld(9, 14, 'house', '民宅', { w: 5, h: 3, open: false }),
  bld(17, 14, 'house', '民宅', { w: 4, h: 3, open: false }),
  bld(24, 14, 'house', '民宅', { w: 4, h: 3, open: false }),
  bld(30, 14, 'house', '民宅', { w: 5, h: 3, open: false }),
  bld(37, 14, 'house', '民宅', { w: 5, h: 3, open: false }),
  bld(18, 8, 'house', '民宅', { w: 4, h: 3, open: false }),
  bld(24, 8, 'house', '民宅', { w: 5, h: 3, open: false }),
  bld(31, 8, 'house', '民宅', { w: 5, h: 3, open: false })
]

export const TOWNS: TownDef[] = [
  {
    id: 'rado',
    name: '拉多镇',
    door: WORLD_TOWN_POSITIONS.rado,
    size: [44, 26],
    variant: 1,
    authored: true,
    paths: [
      // 战车店前的钢板检修坪、中央石砌广场，再到镇门的土路。
      { x: 24, y: 6, w: 5, h: 4, kind: 'metal' },
      { x: 17, y: 11, w: 10, h: 6, kind: 'stone' },
      { x: 7, y: 14, w: 30, h: 2, kind: 'stone' },
      { x: 21, y: 7, w: 3, h: 18, kind: 'dirt' },
      { x: 5, y: 7, w: 34, h: 2, kind: 'dirt' },
      { x: 5, y: 6, w: 2, h: 17, kind: 'dirt' },
      { x: 15, y: 5, w: 2, h: 4, kind: 'dirt' },
      { x: 36, y: 5, w: 2, h: 18, kind: 'dirt' },
      { x: 5, y: 21, w: 34, h: 2, kind: 'dirt' }
    ],
    npcs: [
      { x: 12, y: 11, sp: 'npc_old', name: '修理匠', talk: 'rado_old' },
      { x: 31, y: 13, sp: 'npc_w', name: '取水的妇人', talk: 'rado_woman' },
      { x: 17, y: 16, sp: 'kid', name: '追车的小孩', talk: 'rado_kid' },
      { x: 25, y: 16, sp: 'npc_m', name: '年轻猎人', talk: 'rado_man' },
      { x: 24, y: 22, sp: 'npc_w', name: '镇门守卫', talk: 'rado_woman2' }
    ],
    buildings: [
      bld(2, 2, 'home', '老战的修理店', { w: 8, h: 5, door: [6, 6], roomId: 'rado_home' }),
      bld(13, 2, 'weapon', '铁蜥蜴武器店', { w: 6, h: 4, door: [16, 5], roomId: 'rado_weapon' }),
      bld(22, 2, 'tankshop', '老乔战车工房', { w: 9, h: 5, door: [26, 6], roomId: 'rado_tank' }),
      bld(34, 2, 'inn', '公路之星宿屋', { w: 7, h: 4, door: [37, 5], roomId: 'rado_inn' }),
      bld(3, 10, 'bounty', '猎人情报所', { w: 7, h: 4, door: [6, 13], roomId: 'rado_bounty' }),
      bld(34, 10, 'house', '水塔管理员之家', { w: 7, h: 4, door: [37, 13], open: false }),
      bld(2, 18, 'house', '猎人旧居', { w: 6, h: 4, door: [6, 21], open: false }),
      bld(11, 18, 'house', '镇民住宅', { w: 6, h: 4, door: [14, 21], open: false }),
      bld(29, 18, 'house', '镇民住宅', { w: 6, h: 4, door: [32, 21], open: false }),
      bld(37, 18, 'house', '封存仓库', { w: 5, h: 4, door: [39, 21], open: false })
    ],
    decor: [
      { x: 11, y: 3, t: 'tree' },
      { x: 20, y: 3, t: 'tree2' },
      { x: 32, y: 4, t: 'tree2' },
      { x: 41, y: 8, t: 'watertower' },
      { x: 13, y: 14, t: 'well' },
      { x: 19, y: 13, t: 'memorial' },
      { x: 30, y: 15, t: 'cart' },
      { x: 18, y: 10, t: 'lamp' },
      { x: 26, y: 10, t: 'lamp' },
      { x: 18, y: 17, t: 'lamp' },
      { x: 26, y: 17, t: 'lamp' },
      { x: 13, y: 16, t: 'bench' },
      { x: 31, y: 9, t: 'sign' },
      { x: 10, y: 7, t: 'barrel' },
      { x: 11, y: 8, t: 'crate' },
      { x: 30, y: 8, t: 'crate' },
      { x: 40, y: 8, t: 'barrel' },
      { x: 28, y: 12, t: 'scrap' },
      { x: 33, y: 16, t: 'oil' },
      { x: 10, y: 19, t: 'flower' },
      { x: 19, y: 20, t: 'flower2' },
      { x: 27, y: 20, t: 'flower' },
      { x: 1, y: 8, t: 'tree' },
      { x: 42, y: 15, t: 'tree' },
      { x: 1, y: 16, t: 'tree2' },
      { x: 42, y: 23, t: 'tree2' }
    ]
  },
  {
    id: 'windpump',
    name: '风泵村',
    kind: 'village',
    door: WORLD_TOWN_POSITIONS.windpump,
    size: [32, 20],
    variant: 9,
    authored: true,
    paths: [
      { x: 15, y: 4, w: 3, h: 15, kind: 'dirt' },
      { x: 3, y: 7, w: 26, h: 2, kind: 'dirt' },
      { x: 3, y: 15, w: 26, h: 2, kind: 'stone' }
    ],
    npcs: [
      { x: 10, y: 7, sp: 'npc_old', name: '守泵人', talk: 'windpump_keeper' },
      { x: 19, y: 12, sp: 'npc_m', name: '公路猎人', talk: 'windpump_hunter' },
      { x: 25, y: 15, sp: 'npc_w', name: '补给商', talk: 'windpump_trader' }
    ],
    buildings: [
      bld(2, 2, 'weapon', '叶轮补给铺', { w: 7, h: 4, door: [5, 5] }),
      bld(12, 2, 'inn', '风泵旅舍', { w: 8, h: 4, door: [16, 5] }),
      bld(23, 2, 'house', '守泵人小屋', { w: 6, h: 4, door: [26, 5], open: false }),
      bld(3, 10, 'bounty', '旧路情报棚', { w: 8, h: 4, door: [7, 13] }),
      bld(22, 10, 'house', '蓄水仓', { w: 7, h: 4, door: [25, 13], open: false })
    ],
    decor: [
      { x: 10, y: 3, t: 'watertower' },
      { x: 20, y: 7, t: 'pump' },
      { x: 4, y: 8, t: 'barrel' },
      { x: 27, y: 8, t: 'crate' },
      { x: 12, y: 16, t: 'sign' },
      { x: 20, y: 16, t: 'lamp' }
    ]
  },
  {
    id: 'masaru',
    name: '麦镇',
    music: 'harvest',
    door: WORLD_TOWN_POSITIONS.masaru,
    size: [44, 26],
    variant: 2,
    authored: true,
    paths: [
      // 麦镇围绕中央粮仓广场展开：东西向石街接镇门，北侧是农机维修场。
      { x: 20, y: 4, w: 4, h: 20, kind: 'stone' },
      { x: 4, y: 16, w: 36, h: 4, kind: 'stone' },
      { x: 4, y: 8, w: 13, h: 2, kind: 'dirt' },
      { x: 27, y: 8, w: 13, h: 2, kind: 'dirt' },
      { x: 27, y: 3, w: 12, h: 5, kind: 'metal' },
      { x: 4, y: 21, w: 36, h: 2, kind: 'dirt' },
      { x: 4, y: 8, w: 2, h: 14, kind: 'dirt' },
      { x: 38, y: 8, w: 2, h: 15, kind: 'dirt' }
    ],
    fields: [
      { x: 1, y: 6, w: 18, h: 4, orientation: 'vertical' },
      { x: 25, y: 7, w: 18, h: 4, orientation: 'horizontal' },
      { x: 1, y: 16, w: 18, h: 8, orientation: 'vertical' },
      { x: 25, y: 16, w: 18, h: 8, orientation: 'horizontal' }
    ],
    npcs: [
      { x: 8, y: 6, sp: 'npc_w', name: '机械师·美娜', talk: 'story_masaru_mecha' },
      { x: 16, y: 12, sp: 'npc_old', name: '粮仓管理员', talk: 'masaru_old' },
      { x: 23, y: 18, sp: 'npc_m', name: '农夫', talk: 'masaru_farmer' },
      { x: 28, y: 18, sp: 'npc_w', name: '灌渠工', talk: 'masaru_woman' },
      { x: 34, y: 21, sp: 'kid', name: '小孩', talk: 'masaru_kid' },
      { x: 7, y: 9, sp: 'shopkeep', name: '武器店主', talk: 'shop_weapon' },
      { x: 16, y: 9, sp: 'shopkeep', name: '战车店主', talk: 'shop_tank' }
    ],
    buildings: [
      bld(2, 2, 'home', '麦穗机械铺', { w: 7, h: 4, door: [5, 5], open: false }),
      bld(11, 2, 'weapon', '风车武器店', { w: 7, h: 4, door: [14, 5] }),
      bld(21, 2, 'tankshop', '谷仓战车店', { w: 8, h: 5, door: [25, 6] }),
      bld(31, 2, 'inn', '麦田宿屋', { w: 9, h: 5, door: [35, 6] }),
      bld(2, 11, 'bounty', '巡田情报所', { w: 7, h: 4, door: [5, 14] }),
      bld(11, 11, 'house', '水泵站宿舍', { w: 6, h: 4, door: [14, 14], open: false }),
      bld(27, 11, 'house', '农场住宅', { w: 7, h: 4, door: [30, 14], open: false }),
      bld(35, 11, 'house', '旧磨坊', { w: 5, h: 4, door: [37, 14], open: false }),
      bld(2, 20, 'house', '南侧民宅', { w: 7, h: 3, door: [5, 22], open: false }),
      bld(31, 20, 'house', '封存谷仓', { w: 7, h: 3, door: [34, 22], open: false })
    ],
    decor: [
      { x: 18, y: 6, t: 'silo' },
      { x: 25, y: 10, t: 'pump' },
      { x: 29, y: 5, t: 'tractor' },
      { x: 30, y: 7, t: 'crate' },
      { x: 40, y: 7, t: 'barrel' },
      { x: 10, y: 8, t: 'well' },
      { x: 18, y: 9, t: 'lamp' },
      { x: 25, y: 9, t: 'lamp' },
      { x: 32, y: 9, t: 'lamp' },
      { x: 18, y: 17, t: 'lamp' },
      { x: 25, y: 17, t: 'lamp' },
      { x: 32, y: 17, t: 'lamp' },
      { x: 10, y: 18, t: 'hay' },
      { x: 15, y: 18, t: 'fence' },
      { x: 17, y: 18, t: 'fence' },
      { x: 29, y: 18, t: 'fence' },
      { x: 31, y: 18, t: 'fence' },
      { x: 11, y: 22, t: 'flower' },
      { x: 15, y: 22, t: 'flower2' },
      { x: 28, y: 22, t: 'flower' },
      { x: 39, y: 22, t: 'tree2' },
      { x: 1, y: 8, t: 'tree' },
      { x: 1, y: 17, t: 'tree2' },
      { x: 42, y: 10, t: 'tree' },
      { x: 42, y: 20, t: 'tree2' }
    ]
  },
  {
    id: 'reed',
    name: '苇潮部落',
    kind: 'tribe',
    music: 'harvest',
    door: WORLD_TOWN_POSITIONS.reed,
    size: [32, 20],
    variant: 10,
    authored: true,
    paths: [
      { x: 15, y: 4, w: 3, h: 15, kind: 'dirt' },
      { x: 3, y: 8, w: 26, h: 2, kind: 'dirt' },
      { x: 3, y: 15, w: 26, h: 2, kind: 'dirt' }
    ],
    npcs: [
      { x: 10, y: 8, sp: 'npc_old', name: '苇潮长者', talk: 'reed_elder' },
      { x: 21, y: 12, sp: 'npc_w', name: '摆渡人', talk: 'reed_ferryman' },
      { x: 25, y: 15, sp: 'kid', name: '采苇少年', talk: 'reed_child' }
    ],
    buildings: [
      bld(2, 2, 'weapon', '芦骨交易棚', { w: 8, h: 4, door: [6, 5] }),
      bld(12, 2, 'inn', '渡口营帐', { w: 8, h: 4, door: [16, 5] }),
      bld(23, 2, 'house', '长者帐屋', { w: 6, h: 4, door: [26, 5], open: false }),
      bld(3, 10, 'bounty', '潮痕告示棚', { w: 8, h: 4, door: [7, 13] }),
      bld(22, 10, 'house', '熏鱼棚', { w: 7, h: 4, door: [25, 13], open: false })
    ],
    decor: [
      { x: 11, y: 3, t: 'hay' },
      { x: 21, y: 7, t: 'well' },
      { x: 5, y: 8, t: 'barrel' },
      { x: 27, y: 8, t: 'crate' },
      { x: 12, y: 16, t: 'campfire' },
      { x: 20, y: 16, t: 'sign' }
    ]
  },
  {
    id: 'pobb',
    name: '波布镇',
    door: WORLD_TOWN_POSITIONS.pobb,
    size: [44, 26],
    variant: 3,
    npcs: [
      { x: 7, y: 6, sp: 'wolf', name: '红狼', talk: 'story_pobb_wolf' },
      { x: 9, y: 6, sp: 'npc_old', name: '老猎人', talk: 'pobb_hunter' },
      { x: 22, y: 20, sp: 'npc_m', name: '渔夫', talk: 'pobb_fisher' },
      { x: 26, y: 20, sp: 'npc_w', name: '妇人', talk: 'pobb_woman' },
      { x: 30, y: 21, sp: 'kid', name: '小孩', talk: 'pobb_kid' },
      { x: 4, y: 7, sp: 'shopkeep', name: '武器店主', talk: 'shop_weapon' },
      { x: 14, y: 7, sp: 'shopkeep', name: '战车店主', talk: 'shop_tank' }
    ],
    buildings: [
      bld(2, 2, 'weapon', '武器店'),
      bld(10, 2, 'tankshop', '战车店'),
      bld(18, 2, 'house', '民居', { w: 5, h: 3, open: false }),
      bld(2, 8, 'inn', '宿屋'),
      bld(10, 8, 'bounty', '情报屋'),
      ...houses()
    ]
  },
  {
    id: 'ashridge',
    name: '灰脊矿村',
    kind: 'village',
    door: WORLD_TOWN_POSITIONS.ashridge,
    size: [32, 20],
    variant: 11,
    authored: true,
    paths: [
      { x: 15, y: 4, w: 3, h: 15, kind: 'stone' },
      { x: 3, y: 8, w: 26, h: 2, kind: 'stone' },
      { x: 3, y: 15, w: 26, h: 2, kind: 'metal' }
    ],
    npcs: [
      { x: 10, y: 8, sp: 'npc_m', name: '矿车司机', talk: 'ashridge_driver' },
      { x: 20, y: 12, sp: 'npc_old', name: '老矿工', talk: 'ashridge_miner' },
      { x: 25, y: 15, sp: 'npc_w', name: '修理学徒', talk: 'ashridge_mechanic' }
    ],
    buildings: [
      bld(2, 2, 'weapon', '矿钉补给所', { w: 8, h: 4, door: [6, 5] }),
      bld(12, 2, 'inn', '矿灯旅舍', { w: 8, h: 4, door: [16, 5] }),
      bld(23, 2, 'house', '绞盘机房', { w: 6, h: 4, door: [26, 5], open: false }),
      bld(3, 10, 'modshop', '灰脊修造棚', { w: 9, h: 4, door: [7, 13] }),
      bld(22, 10, 'house', '矿石仓', { w: 7, h: 4, door: [25, 13], open: false })
    ],
    decor: [
      { x: 11, y: 3, t: 'scrap' },
      { x: 21, y: 7, t: 'cart' },
      { x: 5, y: 8, t: 'barrel' },
      { x: 27, y: 8, t: 'crate' },
      { x: 12, y: 16, t: 'rock' },
      { x: 20, y: 16, t: 'lamp' }
    ]
  },
  {
    id: 'rock',
    name: '罗克镇',
    door: WORLD_TOWN_POSITIONS.rock,
    size: [44, 26],
    variant: 4,
    npcs: [
      { x: 7, y: 6, sp: 'npc_m', name: '医生', talk: 'rock_doctor' },
      { x: 9, y: 6, sp: 'npc_w', name: '护士', talk: 'rock_nurse' },
      { x: 22, y: 20, sp: 'npc_old', name: '老人', talk: 'rock_old' },
      { x: 26, y: 20, sp: 'npc_m', name: '镇民', talk: 'rock_man' },
      { x: 30, y: 21, sp: 'kid', name: '小孩', talk: 'rock_kid' },
      { x: 4, y: 7, sp: 'shopkeep', name: '武器店主', talk: 'shop_weapon' },
      { x: 14, y: 7, sp: 'shopkeep', name: '战车店主', talk: 'shop_tank' }
    ],
    buildings: [
      bld(2, 2, 'weapon', '武器店'),
      bld(10, 2, 'tankshop', '战车店'),
      bld(18, 2, 'story', '无敌医院', { story: 'rock_hospital' }),
      bld(2, 8, 'inn', '宿屋'),
      bld(10, 8, 'bounty', '情报屋'),
      ...houses()
    ]
  },
  {
    id: 'odo',
    name: '奥多镇',
    door: WORLD_TOWN_POSITIONS.odo,
    size: [44, 26],
    variant: 5,
    npcs: [
      { x: 7, y: 6, sp: 'npc_old', name: '改造师', talk: 'odo_modder' },
      { x: 9, y: 6, sp: 'npc_m', name: '商人', talk: 'odo_merchant' },
      { x: 22, y: 20, sp: 'npc_w', name: '妇人', talk: 'odo_woman' },
      { x: 26, y: 20, sp: 'npc_m', name: '猎人', talk: 'odo_hunter' },
      { x: 30, y: 21, sp: 'kid', name: '小孩', talk: 'odo_kid' },
      { x: 4, y: 7, sp: 'shopkeep', name: '武器店主', talk: 'shop_weapon' },
      { x: 14, y: 7, sp: 'shopkeep', name: '战车店主', talk: 'shop_tank' }
    ],
    buildings: [
      bld(2, 2, 'weapon', '武器店'),
      bld(10, 2, 'tankshop', '战车店'),
      bld(18, 2, 'house', '民居', { w: 5, h: 3, open: false }),
      bld(2, 8, 'modshop', '改造工房'),
      bld(10, 8, 'bounty', '情报屋'),
      ...houses()
    ]
  },
  {
    id: 'sold',
    name: '索鲁镇',
    door: WORLD_TOWN_POSITIONS.sold,
    size: [44, 26],
    variant: 6,
    npcs: [
      { x: 7, y: 6, sp: 'npc_old', name: '老人', talk: 'sold_old' },
      { x: 9, y: 6, sp: 'npc_m', name: '退役兵', talk: 'sold_soldier' },
      { x: 22, y: 20, sp: 'npc_w', name: '妇人', talk: 'sold_woman' },
      { x: 26, y: 20, sp: 'npc_m', name: '情报贩子', talk: 'sold_info' },
      { x: 30, y: 21, sp: 'kid', name: '小孩', talk: 'sold_kid' },
      { x: 4, y: 7, sp: 'shopkeep', name: '武器店主', talk: 'shop_weapon' },
      { x: 14, y: 7, sp: 'shopkeep', name: '战车店主', talk: 'shop_tank' }
    ],
    buildings: [
      bld(2, 2, 'weapon', '武器店'),
      bld(10, 2, 'tankshop', '战车店'),
      bld(18, 2, 'house', '民居', { w: 5, h: 3, open: false }),
      bld(2, 8, 'modshop', '改造工房'),
      bld(10, 8, 'bounty', '情报屋'),
      ...houses()
    ]
  },
  {
    id: 'tarr',
    name: '塔镇',
    door: WORLD_TOWN_POSITIONS.tarr,
    size: [44, 26],
    variant: 7,
    npcs: [
      { x: 7, y: 6, sp: 'npc_old', name: '老人', talk: 'tarr_old' },
      { x: 9, y: 6, sp: 'npc_m', name: '镇民', talk: 'tarr_man' },
      { x: 22, y: 20, sp: 'npc_w', name: '妇人', talk: 'tarr_woman' },
      { x: 26, y: 20, sp: 'kid', name: '小孩', talk: 'tarr_kid' },
      { x: 30, y: 21, sp: 'npc_m', name: '猎人', talk: 'tarr_hunter' },
      { x: 4, y: 7, sp: 'shopkeep', name: '武器店主', talk: 'shop_weapon' },
      { x: 14, y: 7, sp: 'shopkeep', name: '战车店主', talk: 'shop_tank' }
    ],
    buildings: [
      bld(2, 2, 'weapon', '武器店'),
      bld(10, 2, 'tankshop', '战车店'),
      bld(18, 2, 'story', '戈麦斯藏身处', { story: 'tarr_gomez' }),
      bld(2, 8, 'modshop', '改造工房'),
      bld(10, 8, 'bounty', '情报屋'),
      ...houses()
    ]
  },
  {
    id: 'eden',
    name: '伊甸镇',
    door: WORLD_TOWN_POSITIONS.eden,
    size: [44, 26],
    variant: 8,
    npcs: [
      { x: 7, y: 6, sp: 'npc_old', name: '长者', talk: 'eden_elder' },
      { x: 9, y: 6, sp: 'npc_m', name: '猎人', talk: 'eden_hunter' },
      { x: 22, y: 20, sp: 'npc_w', name: '妇人', talk: 'eden_woman' },
      { x: 26, y: 20, sp: 'npc_m', name: '镇民', talk: 'eden_man' },
      { x: 30, y: 21, sp: 'kid', name: '小孩', talk: 'eden_kid' },
      { x: 4, y: 7, sp: 'shopkeep', name: '武器店主', talk: 'shop_weapon' },
      { x: 14, y: 7, sp: 'shopkeep', name: '战车店主', talk: 'shop_tank' }
    ],
    buildings: [
      bld(2, 2, 'weapon', '武器店'),
      bld(10, 2, 'tankshop', '战车店'),
      bld(18, 2, 'house', '民居', { w: 5, h: 3, open: false }),
      bld(2, 8, 'modshop', '改造工房'),
      bld(10, 8, 'bounty', '情报屋'),
      ...houses()
    ]
  }
]

/* 室内房间（开局父亲的修理店等） */
export const ROOMS: RoomDef[] = [
  {
    id: 'rado_home',
    name: '父亲的修理店',
    town: 'rado',
    size: [20, 15],
    layout: [
      '####################',
      '#........#.........#',
      '#........#.........#',
      '#........#.........#',
      '#........#.........#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#.........E........#',
      '####################'
    ],
    exit: [10, 13],
    door: [6, 6],
    floor: 'wood',
    npcs: [{ x: 7, y: 6, sp: 'father', name: '父亲·老战', talk: 'rado_home_father' }],
    furniture: [
      { x: 2, y: 2, w: 5, h: 2, t: 'workbench' },
      { x: 2, y: 4, w: 5, h: 2, t: 'shelf' },
      { x: 13, y: 2, w: 4, h: 2, t: 'bed' },
      { x: 13, y: 5, w: 3, h: 2, t: 'table' },
      { x: 17, y: 5, w: 1, h: 1, t: 'tv' },
      { x: 2, y: 9, w: 2, h: 2, t: 'stove' },
      { x: 6, y: 9, w: 3, h: 2, t: 'sofa' },
      { x: 10, y: 8, w: 4, h: 2, t: 'rug' },
      { x: 15, y: 11, w: 1, h: 1, t: 'plant' },
      { x: 11, y: 1, w: 1, h: 1, t: 'poster' },
      { x: 14, y: 10, w: 1, h: 1, t: 'radio' },
      { x: 2, y: 12, w: 1, h: 1, t: 'crate' },
      { x: 1, y: 6, w: 2, h: 3, t: 'stairs_down' },
      { x: 17, y: 8, w: 2, h: 3, t: 'stairs' }
    ],
    links: [
      { x: 2, y: 6, target: 'rado_garage', spawn: [26, 16] },
      { x: 2, y: 7, target: 'rado_garage', spawn: [26, 16] },
      { x: 2, y: 8, target: 'rado_garage', spawn: [26, 16] },
      { x: 17, y: 8, target: 'rado_home_upper', spawn: [16, 10] },
      { x: 17, y: 9, target: 'rado_home_upper', spawn: [16, 10] },
      { x: 17, y: 10, target: 'rado_home_upper', spawn: [16, 10] }
    ]
  },
  {
    id: 'rado_home_upper',
    name: '父亲的修理店·二楼',
    town: 'rado',
    size: [20, 15],
    layout: [
      '####################',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#.........E........#',
      '####################'
    ],
    exit: [10, 13],
    exitTarget: 'rado_home',
    exitSpawn: [9, 9],
    door: [6, 6],
    floor: 'wood',
    rest: true,
    links: [
      { x: 17, y: 8, target: 'rado_home', spawn: [16, 10] },
      { x: 17, y: 9, target: 'rado_home', spawn: [16, 10] },
      { x: 17, y: 10, target: 'rado_home', spawn: [16, 10] }
    ],
    furniture: [
      { x: 3, y: 2, w: 5, h: 3, t: 'bed' },
      { x: 13, y: 2, w: 4, h: 2, t: 'shelf' },
      { x: 12, y: 6, w: 4, h: 2, t: 'table' },
      { x: 17, y: 8, w: 2, h: 3, t: 'stairs' },
      { x: 14, y: 10, w: 1, h: 1, t: 'radio' }
    ]
  },
  {
    id: 'rado_garage',
    name: '父亲的修理店·地下战车库（8车位）',
    town: 'rado',
    size: [30, 20],
    layout: [
      '##############################',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################'
    ],
    exit: [27, 16],
    exitTarget: 'rado_home',
    exitSpawn: [3, 7],
    door: [6, 6],
    floor: 'metal',
    garageSlots: [
      { x: 4, y: 5, facing: 0 },
      { x: 10, y: 5, facing: 0 },
      { x: 16, y: 5, facing: 0 },
      { x: 22, y: 5, facing: 0 },
      { x: 4, y: 13, facing: 0 },
      { x: 10, y: 13, facing: 0 },
      { x: 16, y: 13, facing: 0 },
      { x: 22, y: 13, facing: 0 }
    ],
    furniture: [
      { x: 2, y: 1, w: 5, h: 2, t: 'workbench' },
      { x: 8, y: 1, w: 4, h: 2, t: 'locker' },
      { x: 14, y: 1, w: 2, h: 2, t: 'garageconsole' },
      { x: 18, y: 1, w: 5, h: 2, t: 'shelf' },
      { x: 1, y: 17, w: 2, h: 2, t: 'crate' },
      { x: 25, y: 2, w: 2, h: 2, t: 'locker' },
      { x: 26, y: 7, w: 3, h: 6, t: 'vehiclelift' },
      { x: 27, y: 15, w: 2, h: 3, t: 'stairs' }
    ],
    links: [
      { x: 27, y: 15, target: 'rado_home', spawn: [3, 7] },
      { x: 27, y: 16, target: 'rado_home', spawn: [3, 7] },
      { x: 27, y: 17, target: 'rado_home', spawn: [3, 7] }
    ]
  },
  {
    id: 'rado_weapon',
    name: '铁蜥蜴武器店',
    town: 'rado',
    size: [20, 15],
    exit: [10, 13],
    door: [16, 5],
    floor: 'wood',
    service: 'weapon',
    npcs: [{ x: 10, y: 6, sp: 'shopkeep', name: '武器商汉克', talk: 'shop_weapon' }],
    furniture: [
      { x: 2, y: 2, w: 5, h: 3, t: 'weaponrack' },
      { x: 7, y: 2, w: 5, h: 3, t: 'weaponrack' },
      { x: 13, y: 2, w: 5, h: 3, t: 'weaponrack' },
      { x: 2, y: 7, w: 7, h: 2, t: 'counter' },
      { x: 11, y: 7, w: 7, h: 2, t: 'counter' },
      { x: 17, y: 10, w: 2, h: 2, t: 'locker' },
      { x: 2, y: 10, w: 2, h: 2, t: 'crate' },
      { x: 4, y: 1, w: 1, h: 1, t: 'poster' }
    ]
  },
  {
    id: 'rado_tank',
    name: '老乔战车工房',
    town: 'rado',
    size: [24, 16],
    exit: [12, 14],
    door: [26, 6],
    floor: 'metal',
    service: 'tank',
    npcs: [{ x: 12, y: 6, sp: 'shopkeep', name: '机械师老乔', talk: 'shop_tank' }],
    furniture: [
      { x: 3, y: 2, w: 7, h: 4, t: 'tanklift' },
      { x: 14, y: 2, w: 7, h: 4, t: 'tanklift' },
      { x: 2, y: 8, w: 9, h: 2, t: 'counter' },
      { x: 13, y: 8, w: 9, h: 2, t: 'counter' },
      { x: 2, y: 11, w: 3, h: 2, t: 'locker' },
      { x: 19, y: 11, w: 3, h: 2, t: 'locker' },
      { x: 6, y: 11, w: 3, h: 2, t: 'workbench' },
      { x: 15, y: 11, w: 2, h: 2, t: 'crate' }
    ]
  },
  {
    id: 'rado_inn',
    name: '公路之星宿屋',
    town: 'rado',
    size: [20, 15],
    exit: [10, 13],
    door: [37, 5],
    floor: 'wood',
    service: 'inn',
    npcs: [{ x: 10, y: 6, sp: 'npc_w', name: '宿屋老板玛莎', talk: 'shop_inn' }],
    furniture: [
      { x: 2, y: 2, w: 5, h: 3, t: 'bed' },
      { x: 13, y: 2, w: 5, h: 3, t: 'bed' },
      { x: 2, y: 7, w: 7, h: 2, t: 'counter' },
      { x: 11, y: 7, w: 7, h: 2, t: 'counter' },
      { x: 3, y: 10, w: 3, h: 2, t: 'table' },
      { x: 15, y: 10, w: 2, h: 2, t: 'stove' },
      { x: 8, y: 9, w: 4, h: 2, t: 'rug' },
      { x: 18, y: 10, w: 1, h: 1, t: 'plant' }
    ]
  },
  {
    id: 'rado_bounty',
    name: '猎人情报所',
    town: 'rado',
    size: [20, 15],
    exit: [10, 13],
    door: [6, 13],
    floor: 'stone',
    service: 'bounty',
    npcs: [{ x: 10, y: 6, sp: 'npc_old', name: '情报贩子莫里', talk: 'shop_bounty' }],
    furniture: [
      { x: 2, y: 2, w: 7, h: 3, t: 'bountyboard' },
      { x: 11, y: 2, w: 7, h: 3, t: 'bountyboard' },
      { x: 2, y: 7, w: 7, h: 2, t: 'counter' },
      { x: 11, y: 7, w: 7, h: 2, t: 'counter' },
      { x: 2, y: 10, w: 3, h: 2, t: 'table' },
      { x: 16, y: 10, w: 2, h: 2, t: 'locker' },
      { x: 7, y: 1, w: 1, h: 1, t: 'poster' }
    ]
  }
]

export const CAVES: CaveDef[] = [
  {
    id: 'cave1',
    name: '拉多镇南侧洞窟',
    size: [26, 17],
    region: 'rado',
    authored: true,
    layout: [
      '##########################',
      '##########################',
      '##...^....##.......c...###',
      '##..OO..s.##...........###',
      '##........==...........###',
      '##....c...##..~~~~.....###',
      '##........##..~~~~.....###',
      '####.#######.....s.....###',
      '####.###########.#########',
      '##...........###.#########',
      '##........c..##...^....###',
      '##....~~~....==........###',
      '##E...~~~....##....X...###',
      '##...s.......##.....c..###',
      '##...........##........###',
      '##########################',
      '##########################'
    ],
    rooms: [
      { x: 2, y: 2, w: 8, h: 5 },
      { x: 12, y: 2, w: 10, h: 6 },
      { x: 2, y: 9, w: 11, h: 6 },
      { x: 15, y: 10, w: 8, h: 5 }
    ],
    chests: [
      { x: 6, y: 5, item: 'med' },
      { x: 17, y: 4, item: 'bomb' }
    ],
    events: [{ x: 19, y: 12, type: 'tank', tankId: 't1' }],
    exits: [{ x: 2, y: 12, world: WORLD_CAVE_POSITIONS.cave1 }]
  },
  {
    id: 'north_relay',
    name: '北方旧公路驿站',
    size: [20, 13],
    region: 'rado',
    authored: true,
    layout: [
      '####################',
      '####################',
      '##................##',
      '##..c...######....##',
      '##......##....##..##',
      '##......==....==..##',
      '##..s...##....##..##',
      '##......######....##',
      '##.............c..##',
      '##..^.............##',
      '##E...............##',
      '####################',
      '####################'
    ],
    rooms: [
      { x: 2, y: 2, w: 6, h: 8 },
      { x: 14, y: 2, w: 4, h: 8 }
    ],
    chests: [
      { x: 5, y: 4, item: 'repair' },
      { x: 15, y: 8, item: 'gun55' }
    ],
    events: [],
    exits: [{ x: 2, y: 10, world: WORLD_CAVE_POSITIONS.north_relay }]
  },
  {
    id: 'factory',
    name: '海边兵工厂',
    size: [26, 17],
    region: 'pobb',
    rooms: [
      { x: 2, y: 2, w: 9, h: 6 },
      { x: 13, y: 2, w: 10, h: 5 },
      { x: 3, y: 10, w: 10, h: 5 },
      { x: 15, y: 9, w: 9, h: 6 }
    ],
    chests: [
      { x: 6, y: 4, item: 'med2' },
      { x: 18, y: 3, item: 'repair' },
      { x: 20, y: 12, item: 'med2' }
    ],
    events: [
      { x: 5, y: 12, type: 'guard', mob: 'tankbot', count: 2 },
      { x: 18, y: 12, type: 'tank', tankId: 't2' }
    ],
    exits: [{ x: 2, y: 2, world: WORLD_CAVE_POSITIONS.factory }]
  },
  {
    id: 'clinic',
    name: '诊所地下室',
    size: [22, 15],
    region: 'rock',
    rooms: [
      { x: 2, y: 2, w: 8, h: 5 },
      { x: 12, y: 2, w: 8, h: 5 },
      { x: 5, y: 8, w: 12, h: 5 }
    ],
    chests: [
      { x: 4, y: 4, item: 'med2' },
      { x: 15, y: 9, item: 'repair' }
    ],
    events: [{ x: 12, y: 10, type: 'tank', tankId: 't3' }],
    exits: [{ x: 2, y: 2, world: WORLD_CAVE_POSITIONS.clinic }]
  },
  {
    id: 'puru_cave',
    name: '伊甸镇东洞窟',
    size: [28, 18],
    region: 'eden',
    rooms: [
      { x: 2, y: 2, w: 9, h: 6 },
      { x: 13, y: 2, w: 11, h: 5 },
      { x: 4, y: 10, w: 10, h: 6 },
      { x: 16, y: 10, w: 10, h: 6 }
    ],
    chests: [
      { x: 7, y: 4, item: 'med3' },
      { x: 20, y: 3, item: 'repair' },
      { x: 10, y: 13, item: 'med3' }
    ],
    events: [{ x: 22, y: 13, type: 'boss', bountyId: 'puru' }],
    exits: [{ x: 2, y: 2, world: WORLD_CAVE_POSITIONS.puru_cave }]
  },
  {
    id: 'base8',
    name: '西北沙漠·旧军械基地',
    size: [28, 18],
    region: 'desert',
    authored: true,
    layout: [
      '############################',
      '############################',
      '##..........####..........##',
      '##..........####..........##',
      '##..^.......####.....c....##',
      '##..........====..........##',
      '######.##########.##########',
      '######.##########.##########',
      '##..........####..........##',
      '##....c.....####..........##',
      '##..........####....^.....##',
      '##..........====..........##',
      '##..s.......####..........##',
      '##..........####......c...##',
      '##........................##',
      '##E.......................##',
      '############################',
      '############################'
    ],
    rooms: [
      { x: 2, y: 2, w: 10, h: 5 },
      { x: 16, y: 2, w: 10, h: 5 },
      { x: 2, y: 8, w: 10, h: 7 },
      { x: 16, y: 8, w: 10, h: 7 }
    ],
    chests: [
      { x: 6, y: 3, item: 'med3' },
      { x: 18, y: 9, item: 'repair' },
      { x: 8, y: 13, item: 'gun205' }
    ],
    events: [
      { x: 20, y: 11, type: 'guard', mob: 'noa_guard', count: 2, text: '基地警戒系统启动！' },
      { x: 24, y: 3, type: 'tank', tankId: 't8' }
    ],
    exits: [{ x: 2, y: 15, world: WORLD_CAVE_POSITIONS.base8 }]
  },
  {
    id: 'noa1',
    name: '诺亚大楼·一层',
    size: [26, 17],
    region: 'noa',
    rooms: [
      { x: 2, y: 2, w: 9, h: 5 },
      { x: 13, y: 2, w: 10, h: 5 },
      { x: 4, y: 9, w: 9, h: 5 },
      { x: 15, y: 9, w: 9, h: 5 }
    ],
    chests: [
      { x: 6, y: 4, item: 'med3' },
      { x: 18, y: 3, item: 'repair' }
    ],
    events: [{ x: 19, y: 11, type: 'boss', bountyId: 'noa_guard', text: '防御机器人挡住了去路！' }],
    exits: [
      { x: 2, y: 2, world: WORLD_CAVE_POSITIONS.noa },
      { x: 22, y: 11, next: 'noa2' }
    ]
  },
  {
    id: 'noa2',
    name: '诺亚大楼·二层',
    size: [26, 17],
    region: 'noa',
    rooms: [
      { x: 2, y: 2, w: 10, h: 6 },
      { x: 14, y: 2, w: 9, h: 6 },
      { x: 5, y: 10, w: 9, h: 5 },
      { x: 16, y: 10, w: 8, h: 5 }
    ],
    chests: [
      { x: 6, y: 5, item: 'med3' },
      { x: 17, y: 4, item: 'repair' },
      { x: 9, y: 12, item: 'bomb' }
    ],
    events: [{ x: 20, y: 12, type: 'boss', bountyId: 'noa_laser', text: '激光系统启动！' }],
    exits: [
      { x: 2, y: 2, prev: 'noa1' },
      { x: 22, y: 12, next: 'noa3' }
    ]
  },
  {
    id: 'noa3',
    name: '诺亚大楼·三层',
    size: [26, 17],
    region: 'noa',
    rooms: [
      { x: 2, y: 2, w: 10, h: 6 },
      { x: 14, y: 2, w: 10, h: 6 },
      { x: 6, y: 10, w: 14, h: 5 }
    ],
    chests: [
      { x: 7, y: 4, item: 'med3' },
      { x: 19, y: 3, item: 'gun220' }
    ],
    events: [{ x: 13, y: 12, type: 'boss', bountyId: 'noa', text: '主电脑室……诺亚就在那里！' }],
    exits: [{ x: 2, y: 2, prev: 'noa2' }]
  }
]
