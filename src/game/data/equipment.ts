/* 装备数据：战车 / 部件 / 道具 / 商店库存 */

import type { HumanWeaponDef, ItemDef, MemberClass, Part, PartKind, TankDef } from '@/game/types'

export const TANKS: TankDef[] = [
  {
    id: 't1',
    name: 'NO.1 老式主战坦克',
    sp: 420,
    armorCap: 500,
    speed: 4,
    def: 36,
    slots: { main: 1, sub: 1, se: 1 },
    parts: { main: 'gun45', sub: 'mg', se: 'mis', engine: 'mot1', c: 'c0' },
    tpl: 'tank',
    colors: { X: '#3c5a2c', Y: '#2a4520' },
    price: 0,
    loc: '拉多镇南侧洞窟'
  },
  {
    id: 't2',
    name: 'NO.2 军用越野车',
    sp: 360,
    armorCap: 400,
    speed: 6,
    def: 18,
    slots: { main: 1, sub: 1, se: 0 },
    parts: { main: 'gun55', sub: 'ac', se: null, engine: 'mot3', c: 'c0' },
    tpl: 'jeep',
    colors: { X: '#4a6a3a', Y: '#33501f' },
    price: 0,
    loc: '波布镇东 海边兵工厂'
  },
  {
    id: 't3',
    name: 'NO.3 军用救护车',
    sp: 400,
    armorCap: 600,
    speed: 5,
    def: 24,
    slots: { main: 1, sub: 1, se: 0 },
    parts: { main: 'gun75', sub: 'hmg', se: null, engine: 'bul1', c: 'amy' },
    tpl: 'van',
    colors: { X: '#c83838', Y: '#a0a0a0' },
    price: 0,
    loc: '罗克镇 诊所地下室'
  },
  {
    id: 't4',
    name: 'NO.4 反坦克炮车',
    sp: 520,
    armorCap: 700,
    speed: 3,
    def: 30,
    slots: { main: 1, sub: 1, se: 1 },
    parts: { main: 'gun105', sub: 'vul', se: 'mis', engine: 'v24', c: 'nick' },
    tpl: 'heavy',
    colors: { X: '#5a6a3c', Y: '#3c4820' },
    price: 50000,
    loc: '奥多镇 战车店'
  },
  {
    id: 't5',
    name: 'NO.5 炮战车',
    sp: 600,
    armorCap: 800,
    speed: 4,
    def: 36,
    slots: { main: 1, sub: 1, se: 1 },
    parts: { main: 'gun125', sub: 'vul', se: 'rkt', engine: 'v48', c: 'nick' },
    tpl: 'heavy',
    colors: { X: '#4a4a68', Y: '#303044' },
    price: 120000,
    loc: '索鲁镇 战车店'
  },
  {
    id: 't6',
    name: 'NO.6 装甲车',
    sp: 700,
    armorCap: 900,
    speed: 3,
    def: 44,
    slots: { main: 1, sub: 1, se: 1 },
    parts: { main: 'gun155', sub: 'potan', se: 'sonic', engine: 'v66', c: 'sol' },
    tpl: 'tank',
    colors: { X: '#486a48', Y: '#2e482e' },
    price: 200000,
    loc: '伊甸镇 战车店'
  },
  {
    id: 't7',
    name: 'NO.7 红狼战车',
    sp: 800,
    armorCap: 1000,
    speed: 5,
    def: 55,
    slots: { main: 1, sub: 1, se: 1 },
    parts: { main: 'gun205', sub: 'fir', se: 'tolu', engine: 'v100', c: 'sol2' },
    tpl: 'super',
    colors: { X: '#c83030', Y: '#701818' },
    price: 0,
    loc: '红狼的托付'
  },
  {
    id: 't8',
    name: 'NO.8 主战坦克',
    sp: 900,
    armorCap: 1100,
    speed: 4,
    def: 62,
    slots: { main: 1, sub: 1, se: 1 },
    parts: { main: 'gun220', sub: 'fir', se: 'tolu', engine: 'jet', c: 'sol2' },
    tpl: 'super',
    colors: { X: '#5a5a68', Y: '#34343e' },
    price: 0,
    loc: '地狱门北 军事基地'
  }
]

export const PARTS: Record<PartKind, Part[]> = {
  main: [
    { id: 'gun45', name: '45毫米炮', atk: 60, w: 2.0, price: 400, ammo: 18, ammoPrice: 8 },
    { id: 'gun55', name: '55毫米炮', atk: 110, w: 2.5, price: 1200, ammo: 16, ammoPrice: 12 },
    { id: 'gun75', name: '75毫米炮', atk: 180, w: 3.0, price: 3000, ammo: 15, ammoPrice: 18 },
    { id: 'gun88', name: '88毫米炮', atk: 270, w: 3.5, price: 7000, ammo: 14, ammoPrice: 24 },
    { id: 'gun105', name: '105毫米炮', atk: 380, w: 4.5, price: 15000, ammo: 12, ammoPrice: 32 },
    { id: 'gun125', name: '125毫米炮', atk: 500, w: 6.0, price: 30000, ammo: 10, ammoPrice: 42 },
    { id: 'gun155', name: '155毫米炮', atk: 620, w: 7.5, price: 60000, ammo: 9, ammoPrice: 56 },
    { id: 'gun205', name: '205毫米炮', atk: 760, w: 9.0, price: 120000, ammo: 8, ammoPrice: 72 },
    { id: 'gun220', name: '220毫米炮', atk: 800, w: 10.0, price: 200000, ammo: 7, ammoPrice: 90 }
  ],
  sub: [
    { id: 'mg', name: '机枪', atk: 35, all: true, w: 0.5, price: 300 },
    { id: 'ac', name: '机关炮', atk: 80, all: true, w: 1.0, price: 1500 },
    { id: 'hmg', name: '重机枪', atk: 140, all: true, w: 1.5, price: 4500 },
    { id: 'vul', name: '火神炮', atk: 220, all: true, w: 2.0, price: 12000 },
    { id: 'potan', name: '波坦', atk: 350, all: true, w: 3.5, price: 45000 },
    { id: 'fir', name: '火龙', atk: 355, all: true, w: 3.5, price: 60000 }
  ],
  se: [
    { id: 'mis', name: '导弹', atk: 150, all: true, w: 2.0, price: 2500, ammo: 6, ammoPrice: 35 },
    { id: 'rkt', name: '火箭炮', atk: 260, all: true, w: 2.5, price: 8000, ammo: 5, ammoPrice: 55 },
    {
      id: 'drill',
      name: '钻头',
      atk: 400,
      all: false,
      w: 3.0,
      price: 20000,
      acc: 15,
      ammo: 8,
      ammoPrice: 60
    },
    {
      id: 'sonic',
      name: '音波枪',
      atk: 520,
      all: true,
      w: 4.0,
      price: 50000,
      ammo: 4,
      ammoPrice: 95
    },
    {
      id: 'tolu',
      name: '托卢',
      atk: 760,
      all: false,
      w: 5.0,
      price: 160000,
      ammo: 3,
      ammoPrice: 160
    }
  ],
  engine: [
    { id: 'mot1', name: 'MOT1', load: 9, w: 1.0, price: 0 },
    { id: 'mot3', name: 'MOT3', load: 10, w: 1.2, price: 1500 },
    { id: 'bul1', name: 'BUL1', load: 15, w: 1.5, price: 5000 },
    { id: 'v24', name: 'V24', load: 24, w: 2.0, price: 15000 },
    { id: 'v48', name: 'V48', load: 36, w: 2.5, price: 40000 },
    { id: 'v66', name: 'V66', load: 50, w: 3.0, price: 90000 },
    { id: 'v100', name: 'V100', load: 58, w: 3.5, price: 200000 },
    { id: 'jet', name: '喷气式', load: 70, w: 4.0, price: 350000 }
  ],
  c: [
    { id: 'c0', name: '普通C装置', acc: 0, w: 2.0, price: 0 },
    { id: 'amy', name: '艾米', acc: 8, w: 2.0, price: 8000 },
    { id: 'nick', name: '尼克', acc: 15, w: 2.5, price: 25000 },
    { id: 'sol', name: '所罗门', acc: 22, w: 3.0, price: 80000 },
    { id: 'sol2', name: 'SOLOMON2', acc: 30, w: 2.0, price: 200000 }
  ]
}

export const ITEMS: Record<string, ItemDef> = {
  med: { name: '药箱', hp: 60, price: 80, desc: '恢复 60 HP' },
  med2: { name: '大药箱', hp: 160, price: 350, desc: '恢复 160 HP' },
  med3: { name: '急救包', hp: 320, price: 1000, desc: '恢复 320 HP' },
  repair: { name: '修理箱', repair: 300, price: 600, desc: '恢复战车 300 SP' },
  bomb: { name: '手榴弹', dmg: 200, price: 400, desc: '对敌单体造成 200 伤害' },
  smoke: { name: '烟雾弹', smoke: true, price: 250, desc: '战斗中必定逃脱' }
}

export const HUMAN_WEAPONS: Record<string, HumanWeaponDef> = {
  sling: {
    id: 'sling',
    name: '猎人弹弓',
    atk: 8,
    acc: 3,
    price: 60,
    desc: '攻击 +8 · 命中 +3% · 单体'
  },
  pistol: {
    id: 'pistol',
    name: '老式手枪',
    atk: 18,
    acc: 5,
    price: 240,
    desc: '攻击 +18 · 命中 +5% · 单体'
  },
  shotgun: {
    id: 'shotgun',
    name: '短管霰弹枪',
    atk: 28,
    acc: -4,
    all: true,
    price: 700,
    desc: '攻击 +28 · 命中 -4% · 全体'
  },
  rifle: {
    id: 'rifle',
    name: '猎人步枪',
    atk: 45,
    acc: 8,
    price: 1500,
    desc: '攻击 +45 · 命中 +8% · 单体'
  },
  smg: {
    id: 'smg',
    name: '乌兹冲锋枪',
    atk: 58,
    acc: 2,
    all: true,
    price: 3600,
    desc: '攻击 +58 · 命中 +2% · 全体'
  },
  magnum: {
    id: 'magnum',
    name: '44 马格南',
    atk: 82,
    acc: 10,
    price: 7600,
    desc: '攻击 +82 · 命中 +10% · 单体'
  },
  laser: {
    id: 'laser',
    name: '激光步枪',
    atk: 118,
    acc: 14,
    price: 18000,
    desc: '攻击 +118 · 命中 +14% · 单体'
  },
  flamer: {
    id: 'flamer',
    name: '火焰喷射器',
    atk: 148,
    acc: 6,
    all: true,
    price: 42000,
    desc: '攻击 +148 · 命中 +6% · 全体'
  },
  bazooka: {
    id: 'bazooka',
    name: '单兵火箭筒',
    atk: 210,
    acc: -3,
    price: 88000,
    desc: '攻击 +210 · 命中 -3% · 单体'
  }
}

export const DEFAULT_HUMAN_WEAPON: Record<MemberClass, string> = {
  hero: 'sling',
  mecha: 'pistol',
  wolf: 'magnum'
}

export const SHOPS: Record<
  string,
  {
    weapon: {
      human: string[]
      items: string[]
      main: string[]
      sub: string[]
      se: string[]
      engine: string[]
      c: string[]
    }
    tank: { sell: string[] }
  }
> = {
  rado: {
    weapon: {
      human: ['sling', 'pistol'],
      items: ['med'],
      main: ['gun45', 'gun55'],
      sub: ['mg', 'ac'],
      se: [],
      engine: ['mot3'],
      c: ['c0']
    },
    tank: { sell: [] }
  },
  windpump: {
    weapon: {
      human: ['sling', 'pistol'],
      items: ['med', 'smoke'],
      main: ['gun55'],
      sub: ['ac'],
      se: [],
      engine: ['mot3'],
      c: ['c0']
    },
    tank: { sell: [] }
  },
  masaru: {
    weapon: {
      human: ['pistol', 'shotgun'],
      items: ['med', 'bomb', 'smoke'],
      main: ['gun55', 'gun75'],
      sub: ['ac', 'hmg'],
      se: ['mis'],
      engine: ['mot3', 'bul1'],
      c: ['c0', 'amy']
    },
    tank: { sell: [] }
  },
  reed: {
    weapon: {
      human: ['pistol', 'shotgun'],
      items: ['med', 'med2', 'repair', 'smoke'],
      main: ['gun75'],
      sub: ['hmg'],
      se: ['mis'],
      engine: ['bul1'],
      c: ['amy']
    },
    tank: { sell: [] }
  },
  pobb: {
    weapon: {
      human: ['shotgun', 'rifle'],
      items: ['med', 'med2', 'bomb', 'smoke'],
      main: ['gun75', 'gun88'],
      sub: ['hmg', 'vul'],
      se: ['mis', 'rkt'],
      engine: ['bul1'],
      c: ['amy']
    },
    tank: { sell: [] }
  },
  rock: {
    weapon: {
      human: ['rifle', 'smg'],
      items: ['med2', 'repair', 'bomb'],
      main: ['gun88', 'gun105'],
      sub: ['vul'],
      se: ['rkt', 'drill'],
      engine: ['bul1', 'v24'],
      c: ['amy', 'nick']
    },
    tank: { sell: [] }
  },
  ashridge: {
    weapon: {
      human: ['rifle', 'smg'],
      items: ['med2', 'repair', 'bomb'],
      main: ['gun88', 'gun105'],
      sub: ['vul'],
      se: ['rkt'],
      engine: ['bul1', 'v24'],
      c: ['amy', 'nick']
    },
    tank: { sell: [] }
  },
  odo: {
    weapon: {
      human: ['smg', 'magnum'],
      items: ['med2', 'repair', 'bomb', 'smoke'],
      main: ['gun105', 'gun125'],
      sub: ['vul'],
      se: ['drill'],
      engine: ['v24', 'v48'],
      c: ['nick']
    },
    tank: { sell: ['t4'] }
  },
  sold: {
    weapon: {
      human: ['magnum', 'laser'],
      items: ['med2', 'med3', 'repair'],
      main: ['gun125', 'gun155'],
      sub: ['vul', 'potan'],
      se: ['drill', 'sonic'],
      engine: ['v48', 'v66'],
      c: ['nick', 'sol']
    },
    tank: { sell: ['t5'] }
  },
  tarr: {
    weapon: {
      human: ['laser', 'flamer'],
      items: ['med3', 'repair', 'bomb'],
      main: ['gun155'],
      sub: ['potan', 'fir'],
      se: ['sonic'],
      engine: ['v66'],
      c: ['sol']
    },
    tank: { sell: [] }
  },
  eden: {
    weapon: {
      human: ['flamer', 'bazooka'],
      items: ['med3', 'repair', 'bomb', 'smoke'],
      main: ['gun155', 'gun205'],
      sub: ['fir'],
      se: ['sonic', 'tolu'],
      engine: ['v66', 'jet'],
      c: ['sol', 'sol2']
    },
    tank: { sell: ['t6'] }
  }
}

export function findPart(id: string): Part | undefined {
  for (const k of Object.keys(PARTS) as PartKind[]) {
    const p = PARTS[k].find((x) => x.id === id)
    if (p) return p
  }
  return undefined
}

export function findHumanWeapon(id: string | null | undefined): HumanWeaponDef | undefined {
  return id ? HUMAN_WEAPONS[id] : undefined
}

export function allParts(): Part[] {
  return Object.values(PARTS).flat()
}
