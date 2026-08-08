/* 共享类型定义 */

export type Screen =
  | 'title'
  | 'intro'
  | 'world'
  | 'town'
  | 'cave'
  | 'battle'
  | 'menu'
  | 'shop'
  | 'password'
  | 'ending'
  | 'gameover'
  | 'room'

export type WeatherKind = 'clear' | 'cloudy' | 'wind' | 'rain' | 'storm'
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'

export interface WorldEnvironment {
  day: number
  minute: number
  weather: WeatherKind
  weatherStartedAt: number
  nextWeatherAt: number
  seed: number
  wind: number
  intensity: number
}

export type PartKind = 'main' | 'sub' | 'se' | 'engine' | 'c'
export type MemberClass = 'hero' | 'mecha' | 'wolf'
export type EventValue = boolean | string | number

export type EventCondition =
  | { type: 'flag'; key: string; equals?: EventValue }
  | { type: 'partyMember'; member: MemberClass; recruited?: boolean }

export type EventCommand =
  | { type: 'say'; dialogueId: string; texts?: never }
  | { type: 'say'; texts: string[]; dialogueId?: never }
  | { type: 'setFlag'; key: string; value: EventValue }
  | { type: 'addGold'; amount: number }
  | { type: 'recruit'; member: MemberClass }
  | { type: 'sfx'; kind: string }
  | {
      type: 'if'
      condition: EventCondition
      then: EventCommand[]
      else?: EventCommand[]
    }

export interface EventDefinition {
  id: string
  commands: EventCommand[]
}

export interface Part {
  id: string
  name: string
  w: number
  price: number
  atk?: number
  all?: boolean
  acc?: number
  load?: number
  ammo?: number
  ammoPrice?: number
}

export interface TankDef {
  id: string
  name: string
  sp: number
  armorCap: number
  speed: number
  def: number
  slots: { main: number; sub: number; se: number }
  parts: Record<PartKind, string | null>
  tpl: string
  colors: { X: string; Y: string }
  price: number
  loc: string
}

export interface MonsterDef {
  name: string
  tpl: string
  c: { X: string; Y: string }
  hp: number
  atk: number
  def: number
  spd: number
  xp: number
  g: number
}

export interface BountyDef extends MonsterDef {
  id: string
  size: number
  gold: number
  loc: string
  drop: { id: string; n: number } | null
  final?: boolean
}

export interface ItemDef {
  name: string
  price: number
  desc: string
  hp?: number
  repair?: number
  dmg?: number
  smoke?: boolean
}

export interface HumanWeaponDef {
  id: string
  name: string
  atk: number
  price: number
  desc: string
  acc?: number
  all?: boolean
}

export type TankPartCondition = 'normal' | 'damaged' | 'broken'
export type LimitedTankWeapon = 'main' | 'se'

export interface TankState {
  tankId: string
  /** null 表示随队；0..7 表示停在拉多自宅地下车库的固定车位。 */
  garageSlot: number | null
  armor: number
  sp: number
  parts: Record<PartKind, string | null>
  ammo: Record<LimitedTankWeapon, number>
  condition: Record<PartKind, TankPartCondition>
  tankDef?: TankDef
  sx?: number
  sy?: number
}

export interface PartyMember {
  id: string | null
  name: string
  cls: MemberClass
  lv: number
  hp: number
  maxHp: number
  atk: number
  def: number
  spd: number
  xp: number
  weaponId: string | null
  tankId: string | null
}

export interface MoveAnim {
  fx: number
  fy: number
  tx: number
  ty: number
  t: number
}

export interface DialogState {
  texts: string[]
  idx: number
  cb: (() => void) | null
  reveal: number
  wait: number
}

export interface SleepState {
  source: 'home' | 'inn'
  phase: 'fadeout' | 'night' | 'summary' | 'fadein'
  t: number
  settled: boolean
}

export interface ShopState {
  type: string
  name: string
  town: string
  tab: number
  idx: number
  msg: string
  msgT: number
  tankSel: number
  slot?: PartKind
  maintenance?: MaintenanceSession
}

export type MaintenancePhase = 'garage' | 'diagnosis' | 'workorder' | 'result' | 'buy'
export type MaintenanceWorkKind = 'chassis' | 'armor' | 'part' | 'ammo'

export interface MaintenanceWorkItem {
  id: string
  kind: MaintenanceWorkKind
  label: string
  detail: string
  cost: number
  minutes: number
  selected: boolean
  partKind?: PartKind
  ammoKind?: LimitedTankWeapon
}

export interface MaintenanceSession {
  phase: MaintenancePhase
  items: MaintenanceWorkItem[]
  result: string[]
}

export interface MenuState {
  view: string
  idx: number
  assignMember?: string
  equipMember?: string
  huntDuration?: number
  garageSlot?: number
  mapRegion?: string
}

export interface HuntTask {
  id: string
  regionId: string
  memberId: string
  tankId: string | null
  startedAt: number
  endsAt: number
  durationMinutes: number
  xp: number
  gold: number
  armorCost: number
  mainAmmoCost: number
  seAmmoCost: number
  claimed: boolean
}

export interface PasswordState {
  pos: number
  digits: number[]
}

export interface BattleMob {
  id: string
  name: string
  tpl: string
  colors: { X: string; Y: string }
  hp: number
  maxHp: number
  atk: number
  def: number
  spd: number
  xp: number
  gold: number
  size: number
  x: number
  y: number
  isBoss: boolean
  bountyId?: string
}

export interface BattleFighter {
  member: PartyMember
  tank: TankState | null
}

export interface OrderEntry {
  side: 'p' | 'e'
  f?: BattleFighter
  m?: BattleMob
  spd: number
}

export type BattleEnvironment =
  'field' | 'forest' | 'mountain' | 'town' | 'cave' | 'desert' | 'final'
export type BattleWeaponKind = 'human' | 'main' | 'sub' | 'se' | 'enemy' | 'item'

export interface BattleEffect {
  weaponKind: BattleWeaponKind
  fromX: number
  fromY: number
  toX: number
  toY: number
  hit: boolean
  dmg: number
  elapsed: number
  duration: number
}

export type PendingAction =
  | { kind: 'msg'; text: string; once?: boolean; delay?: number }
  | {
      kind: 'anim'
      weaponKind: BattleWeaponKind
      fromX: number
      fromY: number
      tx: number
      ty: number
      dmg: number
      hit: boolean
      delay: number
    }
  | { kind: 'end'; win: boolean; fled?: boolean; delay?: number }

export interface BattleOpts {
  bountyId?: string
  boss?: boolean
  final?: boolean
  guard?: boolean
  text?: string
  completionFlag?: string
  completionMessage?: string
  requiredWeapon?: LimitedTankWeapon | 'sub'
  tutorialNextStep?: number
  tutorialStage?: 'sub' | 'main' | 'se'
  noRewards?: boolean
}

export interface BattleState {
  mobs: BattleMob[]
  fighters: BattleFighter[]
  opts: BattleOpts
  environment: BattleEnvironment
  phase: 'intro' | 'fight' | 'ended'
  round: number
  order: OrderEntry[]
  qi: number
  pending: PendingAction[]
  pendT: number
  cmd: { mode: 'menu' | 'target' | 'item'; idx: number; type?: string } | null
  log: string[]
  effect: BattleEffect | null
  bounty: BountyDef | null
  winQueued: boolean
  done: boolean
  introT: number
}

export interface WorldMapProgress {
  /** 每行由 0/1 组成；1 表示对应的世界地图瓦片已经实地探索。 */
  explored: string[]
  /** 离开世界地图后保留的最后一个世界坐标，用于室内与洞窟定位。 */
  lastWorldX: number
  lastWorldY: number
}

export interface WorldMapLocation {
  id: string
  name: string
  kind: 'town' | 'village' | 'tribe' | 'cave' | 'gate'
  x: number
  y: number
  regionId: string
  note?: string
  status?: 'locked' | 'open'
}

export interface WorldGateDef {
  id: string
  name: string
  position: [number, number]
  regionId: string
  route: string
  unlockFlag: string
  lockedText: string[]
  battle?: {
    mobs: string[]
    text: string
    completionMessage: string
  }
  requiredBounty?: string
}

export interface GameState {
  screen: Screen
  map: string
  px: number
  py: number
  facing: number
  anim: MoveAnim | null
  riding: boolean
  inTown: string | null
  base: Screen | null
  party: PartyMember[]
  gold: number
  inventory: {
    items: Record<string, number>
    parts: Record<string, number>
    weapons: Record<string, number>
  }
  tanks: TankState[]
  bounties: { killed: Record<string, boolean>; claimed: Record<string, boolean> }
  openedChests: Record<string, boolean>
  flags: Record<string, boolean | string | number | undefined>
  playtime: number
  environment: WorldEnvironment
  worldMap: WorldMapProgress
  dialog: DialogState | null
  sleep: SleepState | null
  bannerText: string
  bannerT: number
  menu: MenuState | null
  shop: ShopState | null
  pass: PasswordState | null
  ending: { idx: number; t: number } | null
  intro: { idx: number; t: number }
  titleMenu: number
  titleT: number
  jukebox: boolean
  creditsOpen: boolean
  jukeIdx: number
  goT: number
  battle: BattleState | null
  hunt: HuntTask | null
}

export interface RegionDef {
  id: string
  name: string
  anchor: [number, number]
  x0: number
  y0: number
  x1: number
  y1: number
  mobs: string[]
  dangerLevel: 1 | 2 | 3 | 4 | 5
  recommendedLevel: [number, number]
  vehicle: 'optional' | 'recommended' | 'required'
  description: string
  safeZone?: boolean
  encounterRate?: number
  maxGroup?: number
}

export interface TownDef {
  id: string
  name: string
  kind?: 'town' | 'village' | 'tribe'
  music?: string
  door: [number, number]
  size: [number, number]
  variant?: number
  authored?: boolean
  paths?: {
    x: number
    y: number
    w: number
    h: number
    kind?: 'dirt' | 'stone' | 'metal'
  }[]
  fields?: {
    x: number
    y: number
    w: number
    h: number
    orientation: 'horizontal' | 'vertical'
  }[]
  npcs: { x: number; y: number; sp: string; name: string; talk: string }[]
  buildings: {
    x: number
    y: number
    w: number
    h: number
    type: string
    name: string
    door: [number, number]
    story?: string
    open?: boolean
    roomId?: string
  }[]
  decor?: { x: number; y: number; t: string }[]
}

export interface CaveDef {
  id: string
  name: string
  size: [number, number]
  region: string
  authored?: boolean
  layout?: string[]
  rooms: { x: number; y: number; w: number; h: number }[]
  chests: { x: number; y: number; item: string }[]
  events: {
    x: number
    y: number
    type: string
    tankId?: string
    mob?: string
    count?: number
    bountyId?: string
    text?: string
  }[]
  exits: { x: number; y: number; world?: [number, number]; next?: string; prev?: string }[]
}

export interface RoomDef {
  id: string
  name: string
  town: string
  size: [number, number]
  layout?: string[]
  exit: [number, number]
  door: [number, number]
  floor: string
  exitTarget?: string
  exitSpawn?: [number, number]
  rest?: boolean
  links?: { x: number; y: number; target: string; spawn?: [number, number] }[]
  service?: 'weapon' | 'tank' | 'mod' | 'inn' | 'bounty'
  npcs?: { x: number; y: number; sp: string; name: string; talk: string }[]
  decor?: { x: number; y: number; t: string }[]
  furniture?: { x: number; y: number; w: number; h: number; t: string }[]
  garageSlots?: { x: number; y: number; facing: number }[]
}

export interface TownGrid {
  map: string[]
  npcs: TownDef['npcs']
  buildings: TownDef['buildings']
  exit: [number, number]
  size: [number, number]
}

export interface CaveGrid {
  map: string[]
  size: [number, number]
  cave: CaveDef
}

export interface RoomGrid {
  map: string[]
  size: [number, number]
  room: RoomDef
}

export interface ShopListEntry {
  id: string
  name: string
  price: number
  kind?: string
  pkey?: PartKind
  cur?: boolean
}
