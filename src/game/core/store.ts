/* 总控：响应式游戏状态 + 全局流程（菜单/商店/密码/存档/标题/结局） */

import { reactive } from 'vue'
import type { BattleOpts, GameState, PartKind, Screen, TankState, WeatherKind } from '@/game/types'
import { createInitialState, makeTank } from './state'
import type { GameApi } from './api'
import { WorldSystem } from '@/game/systems/world'
import { BattleSystem } from '@/game/systems/battle'
import {
  DEFAULT_HUMAN_WEAPON,
  findHumanWeapon,
  findPart,
  HUMAN_WEAPONS,
  ITEMS,
  PARTS,
  SHOPS,
  TANKS
} from '@/game/data/equipment'
import { BOUNTIES, REGIONS } from '@/game/data/combat'
import { CAVES, ROOMS, TOWNS } from '@/game/data/maps'
import { ENDING, GROWTH, INTRO, TRACKS, xpNeed, PASSWORDS } from '@/game/data/story'
import { fmtG } from '@/game/utils'
import * as audio from '@/game/audio/audio'
import { explorationTrackFor } from '@/game/audio/cues'
import * as input from '@/game/engine/input'
import { getTextRevealRate, useSettingsStore } from '@/stores/settings'
import {
  advanceWorldEnvironment,
  advanceEnvironmentMinutes,
  forceWeather,
  normalizeWorldEnvironment,
  parseDebugTime,
  restUntilMorning,
  setWorldTime,
  weatherBanner
} from '@/game/systems/environment'
import {
  normalizeTankRuntime,
  tankAmmoCapacity,
  tankLoadValue,
  tankOperational as isTankOperational,
  tankOverCapacity
} from '@/game/systems/tanks'
import {
  ARMOR_PACK_COST,
  ARMOR_PACK_SIZE,
  diagnoseTank,
  executeMaintenance,
  maintenanceTotals
} from '@/game/systems/maintenance'
import {
  HUNT_DURATIONS,
  availableHuntRegions,
  createHuntTask,
  huntRemainingMinutes,
  normalizeHuntTask,
  previewHunt
} from '@/game/systems/hunting'
import {
  convoyTanks,
  firstFreeGarageSlot,
  GARAGE_ROOM_ID,
  garageTankAtSlot,
  normalizeGarageLocations,
  validGarageSlot
} from '@/game/systems/garage'
import {
  buildWorldMapViewModel,
  normalizeWorldMapProgress,
  revealWorldTiles,
  worldPositionForLocation
} from '@/game/systems/world-map'
import { WORLD_GATES } from '@/game/systems/world-gates'
import { migrateLegacyWorldPosition, WORLD_LAYOUT_VERSION } from '@/game/systems/world-layout'

const SAVE_KEY = 'mmw_save_v1'
export const DEFEAT_GOLD_LOSS_RATE = 0.5

export function defeatGoldLoss(gold: number): number {
  if (!Number.isFinite(gold) || gold <= 0) return 0
  return Math.floor(gold * DEFEAT_GOLD_LOSS_RATE)
}

export const FIELD_MENU_ITEMS = [
  '状态',
  '道具',
  '战车',
  '赏金',
  '记录',
  '设置',
  '传送',
  '巡猎',
  '装备',
  '地图'
] as const

function inventoryRecord(value: unknown): Record<string, number> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, number>)
    : {}
}

class GameStore implements GameApi {
  state: GameState = reactive(createInitialState()) as GameState
  world = new WorldSystem(this)
  battle = new BattleSystem(this)

  private dialogQueue: { texts: string[]; cb?: () => void }[] = []
  private booted = false

  /* ================= 生命周期 ================= */
  boot() {
    if (this.booted) return
    this.booted = true
    input.init()
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggleMute()
    })
    audio.playTrack('title')
    const params = new URLSearchParams(location.search)
    const dbg = params.get('debug')
    if (dbg) {
      this.newGame()
      const s = this.state
      s.screen = 'world'
      s.intro = { idx: INTRO.length, t: 0 }
      s.party[1].id = 'mecha'
      s.party[2].id = 'wolf'
      this.addTank('t1')
      this.addTank('t4')
      this.addTank('t7')
      const debugTankId = params.get('tank')
      const debugTankDef = TANKS.find((tank) => tank.id === debugTankId)
      if (debugTankDef) {
        this.addTank(debugTankDef.id)
        s.party[0].tankId = debugTankDef.id
        this.normalizeTankAssignments(s)
        normalizeGarageLocations(s)
        const tank = s.tanks.find((item) => item.tankId === debugTankDef.id)
        if (tank) {
          const condition = params.get('condition')
          if (condition === 'damaged') tank.sp = Math.round(debugTankDef.sp * 0.5)
          else if (condition === 'critical')
            tank.sp = Math.max(1, Math.round(debugTankDef.sp * 0.2))
        }
      }
      s.gold = 999999
      s.riding = true
      if (dbg === 'battle') {
        const battleEnvironment = params.get('env')
        if (battleEnvironment === 'town') this.world.enterTown('rado')
        else if (battleEnvironment === 'cave') this.world.enterCave('cave1')
        else if (battleEnvironment === 'desert') {
          s.map = 'world'
          s.px = 3
          s.py = 3
        }
        s.bannerT = 0
        this.startBountyBattle('water', { final: battleEnvironment === 'final' })
      } else if (dbg === 'battle-field') {
        this.world.enterWorld(24, 59)
        this.startBattle(['rat', 'ant'], {})
      } else if (dbg === 'battle-town') {
        this.world.enterTown('rado')
        s.riding = true
        this.startBattle(['rat', 'thief'], {})
      } else if (dbg === 'battle-cave') {
        this.world.enterCave('cave1')
        s.riding = true
        this.startBattle(['ant', 'robot'], {})
      } else if (dbg === 'battle-desert') {
        this.world.enterWorld(4, 4)
        this.startBattle(['sandworm', 'vulture'], {})
      } else if (dbg === 'battle-forest') {
        this.world.enterWorld(77, 16)
        this.startBattle(['bug', 'mutwolf'], {})
      } else if (dbg === 'battle-mountain') {
        this.world.enterWorld(60, 3)
        this.startBattle(['ironbug', 'vulture'], {})
      } else if (dbg === 'tank-drive') {
        this.world.enterWorld(24, 59)
        s.flags.no_encounter = true
        s.riding = true
      } else if (dbg === 'boss') this.startBountyBattle('noa', { final: true })
      else if (dbg === 'menu') this.openMenu()
      else if (dbg === 'settings') {
        this.openMenu()
        if (s.menu) s.menu.view = 'options'
      } else if (dbg === 'shop') {
        this.world.enterTown('odo')
        this.openShop('mod', { name: '改造工房' })
      } else if (dbg === 'weapon') {
        this.world.enterTown('sold')
        this.openShop('weapon', { name: '武器店' })
      } else if (dbg === 'bounty') {
        this.world.enterTown('pobb')
        this.openShop('bounty', { name: '情报屋' })
      } else if (dbg === 'pass') {
        this.world.enterWorld(62, 5)
        this.openPassword()
      } else if (dbg === 'town') this.world.enterTown('rado')
      else if (dbg === 'cave') this.world.enterCave('cave1')
      else if (dbg === 'room') this.world.enterRoom('rado_home')
      else if (dbg === 'parking') {
        this.addTank('t2')
        this.addTank('t3')
        this.world.enterRoom(GARAGE_ROOM_ID)
        this.parkTankAtSlot('hero', 2)
        this.parkTankAtSlot('mecha', 3)
        const debugSlot = Number(params.get('slot'))
        if (params.has('slot') && validGarageSlot(debugSlot)) this.openGarageSlot(debugSlot)
      } else if (dbg === 'weapon-room') this.world.enterRoom('rado_weapon')
      else if (dbg === 'tank-room') this.world.enterRoom('rado_tank')
      else if (dbg === 'garage') {
        this.world.enterRoom('rado_tank')
        const tank = s.tanks.find((item) => item.tankId === 't1')
        if (tank) {
          tank.sp = 330
          tank.armor = 80
          tank.ammo.main = 6
          tank.ammo.se = 2
          tank.condition.sub = 'damaged'
        }
        s.flags.tutorial_step = 5
        this.openShop('tank', { name: '老乔战车工房' })
      } else if (dbg === 'sleep') {
        this.world.enterRoom('rado_home_upper')
        s.party[0].hp = 1
        this.beginSleep('home')
      } else if (dbg === 'hunt') {
        s.flags.region_rado = true
        s.flags.region_odo = true
        this.world.enterTown('rado')
        this.openMenu()
        this.menuSelect(FIELD_MENU_ITEMS.indexOf('巡猎'))
      } else if (dbg === 'map') {
        const start = TOWNS.find((town) => town.id === 'rado')!.door
        const destination = TOWNS.find((town) => town.id === 'masaru')!.door
        const steps = Math.max(
          Math.abs(destination[0] - start[0]),
          Math.abs(destination[1] - start[1])
        )
        for (let step = 0; step <= steps; step++) {
          const progress = steps ? step / steps : 0
          const x = Math.round(start[0] + (destination[0] - start[0]) * progress)
          const y = Math.round(start[1] + (destination[1] - start[1]) * progress)
          s.worldMap = revealWorldTiles(s.worldMap, x, y)
        }
        this.world.enterWorld(
          Math.round((start[0] + destination[0]) / 2),
          Math.round((start[1] + destination[1]) / 2)
        )
        s.flags.no_encounter = true
        this.openMenu()
        this.menuSelect(FIELD_MENU_ITEMS.indexOf('地图'))
      } else if (dbg === 'gate') {
        const selectedGate =
          WORLD_GATES.find((gate) => gate.id === params.get('id')) || WORLD_GATES[0]
        if (params.get('open') === '1') s.flags[selectedGate.unlockFlag] = true
        this.world.enterWorld(selectedGate.position[0] - 1, selectedGate.position[1])
        s.flags.no_encounter = true
        s.facing = 3
      } else if (dbg === 'inn-room') this.world.enterRoom('rado_inn')
      else if (dbg === 'inn') {
        this.world.enterRoom('rado_inn')
        this.openShop('inn', { name: '公路之星宿屋' })
      } else if (dbg === 'bounty-room') this.world.enterRoom('rado_bounty')
      else audio.playTrack('field')
      if (dbg === 'masaru') this.world.enterTown('masaru')
      const debugX = Number(params.get('x'))
      const debugY = Number(params.get('y'))
      if (Number.isFinite(debugX) && params.has('x')) s.px = debugX
      if (Number.isFinite(debugY) && params.has('y')) s.py = debugY
      if (s.map === 'world') this.world.syncWorldMapPosition()
      const debugFacing = Number(params.get('facing'))
      if (Number.isInteger(debugFacing) && debugFacing >= 0 && debugFacing <= 3) {
        s.facing = debugFacing
      }
      const debugTime = parseDebugTime(params.get('time'))
      if (debugTime !== null) setWorldTime(s.environment, debugTime)
      const debugWeather = params.get('weather') as WeatherKind | null
      if (debugWeather && ['clear', 'cloudy', 'wind', 'rain', 'storm'].includes(debugWeather)) {
        forceWeather(s.environment, debugWeather)
      }
    }
  }

  update(dt: number) {
    const s = this.state
    s.playtime += dt
    if (s.bannerT > 0) s.bannerT -= dt
    if (s.sleep) {
      input.poll()
      this.updateSleep(dt)
      return
    }
    if (!s.dialog && ['world', 'town', 'cave', 'room', 'battle'].includes(s.screen)) {
      const environmentUpdate = advanceWorldEnvironment(s.environment, dt)
      const outdoors = s.map === 'world' || TOWNS.some((town) => town.id === s.map)
      if (outdoors && environmentUpdate.weatherChanged) {
        this.banner(weatherBanner(environmentUpdate.weather))
      } else if (outdoors && environmentUpdate.phaseChanged) {
        const phaseText = {
          dawn: '天色渐明',
          day: '日光照亮荒野',
          dusk: '夕阳正在下沉',
          night: '夜幕降临'
        }[environmentUpdate.phase]
        this.banner(phaseText)
      }
    }
    if (s.dialog) {
      this.updateDialog(dt)
      return
    }
    switch (s.screen) {
      case 'title':
        this.updateTitle(dt)
        break
      case 'intro':
        this.updateIntro(dt)
        break
      case 'world':
      case 'town':
      case 'cave':
      case 'room':
        this.world.tryMove(dt)
        break
      case 'battle':
        this.battle.update(dt)
        break
      case 'menu':
        this.updateMenu(dt)
        break
      case 'shop':
        this.updateShop(dt)
        break
      case 'password':
        this.updatePassword(dt)
        break
      case 'ending':
        this.updateEnding(dt)
        break
      case 'gameover':
        this.updateGameOver(dt)
        break
    }
  }

  /* ================= 新游戏 / 存档 ================= */
  newGame() {
    Object.assign(this.state, createInitialState())
    this.state.screen = 'intro'
    this.dialogQueue = []
    audio.playTrack('title')
  }

  saveGame(): boolean {
    const s = this.state
    if (s.screen === 'title') return false
    const data = {
      worldLayoutVersion: WORLD_LAYOUT_VERSION,
      map: s.map,
      px: s.px,
      py: s.py,
      facing: s.facing,
      riding: s.riding,
      party: s.party,
      gold: s.gold,
      inventory: s.inventory,
      tanks: s.tanks,
      bounties: s.bounties,
      openedChests: s.openedChests,
      flags: s.flags,
      playtime: s.playtime,
      environment: s.environment,
      worldMap: s.worldMap,
      hunt: s.hunt
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
      return true
    } catch {
      return false
    }
  }

  loadGame(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw)
      const s = createInitialState()
      Object.assign(s, data)
      const legacyWorldLayout = Number(data.worldLayoutVersion || 1) < WORLD_LAYOUT_VERSION
      s.environment = normalizeWorldEnvironment(data.environment)
      if (!s.flags || typeof s.flags !== 'object' || Array.isArray(s.flags)) s.flags = {}
      if (!s.openedChests || typeof s.openedChests !== 'object' || Array.isArray(s.openedChests))
        s.openedChests = {}
      const savedInventory = s.inventory as Partial<GameState['inventory']> | undefined
      s.inventory = {
        items: inventoryRecord(savedInventory?.items),
        parts: inventoryRecord(savedInventory?.parts),
        weapons: inventoryRecord(savedInventory?.weapons)
      }
      if (legacyWorldLayout && s.map === 'world') {
        ;[s.px, s.py] = migrateLegacyWorldPosition(s.px, s.py)
      }
      const legacyKnownPoints = TOWNS.filter((town) => s.flags['town_' + town.id]).map(
        (town) => town.door
      )
      s.worldMap = normalizeWorldMapProgress(
        legacyWorldLayout ? undefined : data.worldMap,
        worldPositionForLocation(s.map, s.px, s.py),
        legacyKnownPoints
      )
      for (const member of s.party) {
        if (member.weaponId === undefined) member.weaponId = DEFAULT_HUMAN_WEAPON[member.cls]
        else if (member.weaponId !== null && !findHumanWeapon(member.weaponId)) {
          member.weaponId = DEFAULT_HUMAN_WEAPON[member.cls]
        }
      }
      s.tanks = Array.isArray(s.tanks)
        ? s.tanks
            .filter((tank) => tank && TANKS.some((definition) => definition.id === tank.tankId))
            .map((tank) => normalizeTankRuntime(tank))
        : []
      this.normalizeTankAssignments(s)
      normalizeGarageLocations(s)
      s.hunt = normalizeHuntTask(data.hunt, s)
      s.anim = null
      const room = ROOMS.find((r) => r.id === s.map)
      const town = TOWNS.find((t) => t.id === s.map)
      const cave = CAVES.find((c) => c.id === s.map)
      const saveTown = town || (room ? TOWNS.find((t) => t.id === room.town) : null)
      if (saveTown) s.flags['town_' + saveTown.id] = true
      if (room) {
        s.screen = 'room'
        s.inTown = room.town
      } else if (town) {
        s.screen = 'town'
        s.inTown = s.map
      } else if (cave) {
        s.screen = 'cave'
        s.inTown = null
      } else {
        s.screen = 'world'
        s.inTown = null
      }
      if (s.map === 'world') s.riding = convoyTanks(s).some((tank) => isTankOperational(tank))
      Object.assign(this.state, s)
      if (cave) this.world.syncOpenedChests(cave.id)
      audio.playTrack(s.map === 'world' ? 'field' : cave ? 'cave' : 'town')
      return true
    } catch {
      return false
    }
  }

  hasSave(): boolean {
    try {
      return !!localStorage.getItem(SAVE_KEY)
    } catch {
      return false
    }
  }

  beginSleep(source: 'home' | 'inn') {
    if (this.state.sleep) return
    input.poll()
    this.state.sleep = { source, phase: 'fadeout', t: 0, settled: false }
    audio.playTrack('inn')
  }

  private updateSleep(dt: number) {
    const sleep = this.state.sleep
    if (!sleep) return
    sleep.t += Math.max(0, dt)
    if (sleep.phase === 'fadeout' && sleep.t >= 0.7) {
      sleep.phase = 'night'
      sleep.t = 0
      return
    }
    if (sleep.phase === 'night' && sleep.t >= 1.4) {
      this.settleSleep()
      sleep.phase = 'summary'
      sleep.t = 0
      return
    }
    if (sleep.phase === 'summary' && sleep.t >= 1.5) {
      sleep.phase = 'fadein'
      sleep.t = 0
      return
    }
    if (sleep.phase === 'fadein' && sleep.t >= 0.8) {
      const source = sleep.source
      this.state.sleep = null
      if (source === 'inn') this.closeShop()
      else {
        audio.playTrack(
          explorationTrackFor({
            screen: this.state.screen as 'world' | 'town' | 'cave' | 'room',
            map: this.state.map,
            px: this.state.px,
            py: this.state.py
          })
        )
        this.banner('清晨 07:00 · 人员状态已恢复')
      }
    }
  }

  private settleSleep() {
    const sleep = this.state.sleep
    if (!sleep || sleep.settled) return
    for (const member of this.state.party) if (member.id) member.hp = member.maxHp
    restUntilMorning(this.state.environment)
    if (sleep.source === 'home' && this.state.flags.tutorial_step === 3) {
      this.state.flags.tutorial_step = 4
    }
    sleep.settled = true
    audio.sfx('heal')
    if (sleep.source === 'inn') this.saveGame()
  }

  /* ================= 对话 ================= */
  say(texts: string[], cb?: () => void) {
    if (!Array.isArray(texts)) texts = [texts]
    const s = this.state
    if (s.dialog) {
      this.dialogQueue.push({ texts, cb })
      return
    }
    s.dialog = { texts, idx: 0, cb: cb || null, reveal: 0, wait: 0 }
  }

  private updateDialog(dt: number) {
    const d = this.state.dialog!
    if (d.wait > 0) {
      d.wait -= dt
      return
    }
    d.reveal += dt * getTextRevealRate()
    for (const k of input.poll()) {
      if (k === 'a' || k === 'b') {
        this.dialogNext()
        return
      }
    }
  }

  private dialogNext() {
    const s = this.state
    const d = s.dialog!
    d.reveal = 9999
    if (d.idx < d.texts.length - 1) {
      d.idx++
      d.reveal = 0
      audio.sfx('cursor')
    } else {
      const cb = d.cb
      s.dialog = null
      if (cb) cb()
      if (this.dialogQueue.length) {
        const next = this.dialogQueue.shift()!
        s.dialog = { texts: next.texts, idx: 0, cb: next.cb || null, reveal: 0, wait: 0 }
      }
    }
  }

  banner(text: string) {
    this.state.bannerText = text
    this.state.bannerT = 2.0
  }

  /* ================= 道具 / 部件 / 战车 ================= */
  addItem(id: string, n = 1) {
    this.state.inventory.items[id] = (this.state.inventory.items[id] || 0) + n
  }
  addPart(id: string, n = 1) {
    this.state.inventory.parts[id] = (this.state.inventory.parts[id] || 0) + n
  }
  addHumanWeapon(id: string, n = 1) {
    if (!findHumanWeapon(id) || n <= 0) return
    this.state.inventory.weapons[id] = (this.state.inventory.weapons[id] || 0) + n
  }
  humanWeaponChoicesForUi(memberId: string) {
    const member = this.state.party.find((candidate) => candidate.id === memberId)
    if (!member) return []
    const ids = new Set<string>()
    if (member.weaponId && findHumanWeapon(member.weaponId)) ids.add(member.weaponId)
    for (const [id, count] of Object.entries(this.state.inventory.weapons)) {
      if (count > 0 && findHumanWeapon(id)) ids.add(id)
    }
    return [
      {
        id: null,
        name: '徒手',
        atk: 0,
        acc: 0,
        all: false,
        desc: '不装备武器，仅使用人员基础攻击',
        owned: 0,
        current: member.weaponId === null
      },
      ...[...ids].map((id) => {
        const weapon = HUMAN_WEAPONS[id]
        return {
          ...weapon,
          owned: this.state.inventory.weapons[id] || 0,
          current: member.weaponId === id
        }
      })
    ]
  }
  equipHumanWeapon(memberId: string, weaponId: string | null): boolean {
    const member = this.state.party.find((candidate) => candidate.id === memberId)
    if (!member || (weaponId !== null && !findHumanWeapon(weaponId))) return false
    if (member.weaponId === weaponId) return true
    if (weaponId !== null && (this.state.inventory.weapons[weaponId] || 0) <= 0) return false
    if (weaponId !== null) this.state.inventory.weapons[weaponId]--
    if (member.weaponId) this.addHumanWeapon(member.weaponId)
    member.weaponId = weaponId
    return true
  }
  addTank(tankId: string) {
    const s = this.state
    if (s.tanks.some((t) => t.tankId === tankId)) return
    const tank = makeTank(tankId)
    s.tanks.push(tank)
    const empty = s.party.find((m) => m.id && !m.tankId)
    if (empty) {
      empty.tankId = tankId
      tank.garageSlot = null
    } else {
      tank.garageSlot = firstFreeGarageSlot(s)
    }
  }
  assignTank(memberId: string, tankId: string | null): boolean {
    const s = this.state
    if (s.hunt && (s.hunt.memberId === memberId || (!!tankId && s.hunt.tankId === tankId))) {
      return false
    }
    const member = s.party.find((m) => m.id === memberId)
    const targetTank = tankId ? s.tanks.find((tank) => tank.tankId === tankId) || null : null
    if (!member || (tankId && !targetTank)) return false
    if (member.tankId === tankId) return true

    const previousTank = member.tankId
    const previousTankState = previousTank
      ? s.tanks.find((tank) => tank.tankId === previousTank) || null
      : null

    if (!tankId) {
      if (!previousTankState) return true
      if (!this.isAtGarage()) return false
      const slot = firstFreeGarageSlot(s)
      if (slot === null) return false
      previousTankState.garageSlot = slot
      member.tankId = null
      s.riding = false
      return true
    }

    if (targetTank!.garageSlot !== null && !this.isAtGarage()) return false
    const previousDriver = tankId
      ? s.party.find((m) => m.id && m !== member && m.tankId === tankId)
      : null
    if (previousDriver) {
      member.tankId = tankId
      previousDriver.tankId = previousTank
      return true
    }

    if (targetTank!.garageSlot === null) return false
    const vacatedSlot = targetTank!.garageSlot
    targetTank!.garageSlot = null
    member.tankId = tankId
    if (previousTankState) previousTankState.garageSlot = vacatedSlot
    return true
  }

  isAtGarage(): boolean {
    return this.state.map === GARAGE_ROOM_ID
  }

  parkTankAtSlot(memberId: string, slot: number): boolean {
    const s = this.state
    if (!this.isAtGarage() || !validGarageSlot(slot) || garageTankAtSlot(s, slot)) return false
    if (s.hunt?.memberId === memberId) return false
    const member = s.party.find((candidate) => candidate.id === memberId)
    const tank = member?.tankId
      ? s.tanks.find((candidate) => candidate.tankId === member.tankId) || null
      : null
    if (!member || !tank || s.hunt?.tankId === tank.tankId) return false
    tank.garageSlot = slot
    member.tankId = null
    s.riding = false
    return true
  }

  tankAssignmentChoicesForUi(): TankState[] {
    if (this.isAtGarage()) {
      return this.state.tanks.filter((tank) => tank.tankId !== this.state.hunt?.tankId)
    }
    return convoyTanks(this.state)
  }

  serviceableTanksForUi(): TankState[] {
    return convoyTanks(this.state)
  }

  openGarageSlot(slot: number) {
    if (!this.isAtGarage() || !validGarageSlot(slot)) return
    const s = this.state
    s.base = 'room'
    s.screen = 'menu'
    s.menu = { view: 'garage', idx: 0, garageSlot: slot }
    audio.sfx('confirm')
  }

  garageMenuOptionsForUi(): { memberId: string | null; label: string }[] {
    const slot = this.state.menu?.garageSlot
    if (!validGarageSlot(slot)) return [{ memberId: null, label: '关闭' }]
    const parked = garageTankAtSlot(this.state, slot)
    const members = this.state.party.filter(
      (member) => member.id && member.id !== this.state.hunt?.memberId
    )
    const actions = parked
      ? members.map((member) => {
          const current = member.tankId
            ? TANKS.find((tank) => tank.id === member.tankId)?.name || member.tankId
            : null
          return {
            memberId: member.id!,
            label: current ? `交给 ${member.name}（${current} 停入本位）` : `交给 ${member.name}`
          }
        })
      : members
          .filter((member) => !!member.tankId)
          .map((member) => ({
            memberId: member.id!,
            label: `停放 ${member.name} 的 ${TANKS.find((tank) => tank.id === member.tankId)?.name || member.tankId}`
          }))
    return [...actions, { memberId: null, label: '关闭' }]
  }

  garageSlotUse(index: number) {
    const menu = this.state.menu
    if (!menu || menu.view !== 'garage') return
    menu.idx = index
    this.garageMenuAct()
  }

  private garageMenuAct() {
    const menu = this.state.menu
    const slot = menu?.garageSlot
    if (!menu || !validGarageSlot(slot)) return
    const actions = this.garageMenuOptionsForUi()
    const action = actions[menu.idx % actions.length]
    if (!action?.memberId) {
      this.closeMenu()
      return
    }

    const parked = garageTankAtSlot(this.state, slot)
    const member = this.state.party.find((candidate) => candidate.id === action.memberId)
    const previousTankId = member?.tankId || null
    const success = parked
      ? this.assignTank(action.memberId, parked.tankId)
      : this.parkTankAtSlot(action.memberId, slot)
    if (!success) {
      audio.sfx('cancel')
      return
    }

    this.closeMenu()
    if (parked) {
      const name = TANKS.find((tank) => tank.id === parked.tankId)?.name || parked.tankId
      const previous = previousTankId
        ? TANKS.find((tank) => tank.id === previousTankId)?.name || previousTankId
        : null
      this.say([
        `${String(slot + 1).padStart(2, '0')} 号位：${name} 已交给 ${member!.name}。`,
        previous ? `${previous} 已回填到原车位。` : '车辆升降平台已将战车送至待命区。'
      ])
    } else {
      const name = previousTankId
        ? TANKS.find((tank) => tank.id === previousTankId)?.name || previousTankId
        : '战车'
      this.say([`${name} 已停入 ${String(slot + 1).padStart(2, '0')} 号位。`])
    }
  }
  private normalizeTankAssignments(s: GameState) {
    const owned = new Set(s.tanks.map((t) => t.tankId))
    const assigned = new Set<string>()
    for (const member of s.party) {
      if (
        !member.id ||
        !member.tankId ||
        !owned.has(member.tankId) ||
        assigned.has(member.tankId)
      ) {
        member.tankId = null
        continue
      }
      assigned.add(member.tankId)
    }
  }
  getTankByMember(memberId: string): TankState | null {
    const m = this.state.party.find((x) => x.id === memberId)
    if (!m || !m.tankId) return null
    return this.state.tanks.find((t) => t.tankId === m.tankId && t.garageSlot === null) || null
  }
  getActiveTank(): TankState | null {
    const hero = this.state.party[0]
    const convoy = convoyTanks(this.state)
    if (hero.tankId) {
      const t = convoy.find((x) => x.tankId === hero.tankId)
      if (t && this.tankOperational(t)) return t
    }
    return convoy.find((tank) => this.tankOperational(tank)) || convoy[0] || null
  }
  tankLoad(tank: TankState): number {
    return tankLoadValue(tank)
  }
  tankOverweight(tank: TankState): boolean {
    return tankOverCapacity(tank)
  }
  tankOperational(tank: TankState): boolean {
    return isTankOperational(tank) && this.state.hunt?.tankId !== tank.tankId
  }

  /* ================= 战斗入口 ================= */
  startBattle(mobs: string[], opts: BattleOpts = {}) {
    const s = this.state
    s.screen = 'battle'
    s.base = this.explorationScreenForMap(s.map)
    this.battle.start(mobs, opts)
  }
  startBountyBattle(id: string, opts?: BattleOpts) {
    const b = BOUNTIES.find((x) => x.id === id)
    if (!b) return
    const s = this.state
    s.screen = 'battle'
    s.base = this.explorationScreenForMap(s.map)
    this.battle.start([], Object.assign({ bountyId: id }, opts || {}))
  }

  private explorationScreenForMap(
    map: string
  ): Extract<Screen, 'world' | 'town' | 'cave' | 'room'> {
    if (map === 'world') return 'world'
    if (TOWNS.some((town) => town.id === map)) return 'town'
    if (ROOMS.some((room) => room.id === map)) return 'room'
    return 'cave'
  }

  /* ================= 升级 ================= */
  gainXP(xp: number): string[] {
    const msgs: string[] = []
    for (const m of this.state.party) {
      if (!m.id) continue
      m.xp += xp
      let ups = 0
      while (m.xp >= xpNeed(m.lv)) {
        m.xp -= xpNeed(m.lv)
        m.lv++
        const u = GROWTH[m.cls].up
        m.maxHp += u.hp
        m.atk += u.atk
        m.def += u.def
        m.spd += u.spd
        m.hp = m.maxHp
        ups++
      }
      if (ups) msgs.push(m.name + ' 升到了 ' + m.lv + ' 级！')
    }
    return msgs
  }

  /* ================= 结束 / 失败 ================= */
  gameOver() {
    const s = this.state
    s.screen = 'gameover'
    s.goT = 0
    audio.stopTrack()
    audio.sfx('gameover')
  }

  doEnding() {
    const s = this.state
    s.flags.noa_dead = true
    s.flags.ending_seen = true
    s.screen = 'ending'
    s.ending = { idx: 0, t: 0 }
    this.saveGame()
    audio.playTrack('ending')
  }

  toggleMute() {
    useSettingsStore().toggleMute()
  }
  sfx(kind: string) {
    audio.sfx(kind)
  }

  /* ================= 菜单 ================= */
  openMenu() {
    const s = this.state
    if (!['world', 'town', 'cave', 'room'].includes(s.screen)) return
    s.base = s.screen
    s.screen = 'menu'
    s.menu = { view: 'root', idx: 0 }
    audio.sfx('confirm')
  }

  private closeMenu() {
    const s = this.state
    s.screen = (s.base || 'world') as Screen
    s.menu = null
    audio.sfx('cancel')
  }

  teleportTargets() {
    return TOWNS.filter((town) => town.id === 'rado' || this.state.flags['town_' + town.id])
  }

  private teleportTo(townId: string) {
    const town = this.teleportTargets().find((item) => item.id === townId)
    if (!town) return
    this.world.enterTown(town.id)
    this.state.menu = null
    this.state.base = null
    audio.sfx('confirm')
  }

  private updateMenu(_dt: number) {
    const m = this.state.menu!
    for (const k of input.poll()) {
      if (m.view === 'root') {
        if (k === 'up' || k === 'left') {
          m.idx = (m.idx + FIELD_MENU_ITEMS.length - 1) % FIELD_MENU_ITEMS.length
          audio.sfx('cursor')
        }
        if (k === 'down' || k === 'right') {
          m.idx = (m.idx + 1) % FIELD_MENU_ITEMS.length
          audio.sfx('cursor')
        }
        if (k === 'a') this.menuAct()
        if (k === 'b') {
          this.closeMenu()
          return
        }
      } else {
        this.menuSubview(k)
      }
    }
  }

  private menuAct() {
    const m = this.state.menu!
    const sel = FIELD_MENU_ITEMS[m.idx]
    if (sel === '状态') {
      m.view = 'status'
      m.idx = 0
    } else if (sel === '道具') {
      m.view = 'items'
      m.idx = 0
    } else if (sel === '战车') {
      m.view = 'tanks'
      m.idx = 0
    } else if (sel === '赏金') {
      m.view = 'bounty'
      m.idx = 0
    } else if (sel === '记录') {
      this.say(['旅途记录只能在宿屋登记。'])
      this.closeMenu()
    } else if (sel === '设置') {
      m.view = 'options'
      m.idx = 0
    } else if (sel === '传送') {
      if (this.state.base !== 'world' && this.state.base !== 'town') {
        this.say(['传送只能在野外或城镇使用。'])
        this.closeMenu()
      } else {
        m.view = 'teleport'
        const targets = this.teleportTargets()
        const current = targets.findIndex((town) => town.id === this.state.map)
        m.idx = current >= 0 ? current : 0
      }
    } else if (sel === '巡猎') {
      m.view = 'hunt'
      m.idx = 0
      m.huntDuration = HUNT_DURATIONS[0]
    } else if (sel === '装备') {
      m.view = 'equipment'
      m.idx = 0
    } else if (sel === '地图') {
      const model = buildWorldMapViewModel(this.state)
      m.view = 'map'
      m.idx = model.selectedIndex
      m.mapRegion = model.selectedRegion.id
    }
    audio.sfx('confirm')
  }

  private menuSubview(k: string) {
    const s = this.state
    const m = s.menu!
    const view = m.view
    if (view === 'garage') {
      const actions = this.garageMenuOptionsForUi()
      if (k === 'b') {
        this.closeMenu()
        return
      }
      if (k === 'up') {
        m.idx = (m.idx + actions.length - 1) % actions.length
        audio.sfx('cursor')
      }
      if (k === 'down') {
        m.idx = (m.idx + 1) % actions.length
        audio.sfx('cursor')
      }
      if (k === 'a') this.garageMenuAct()
    } else if (view === 'map') {
      if (k === 'b') {
        this.worldMapBack()
        return
      }
      if (k === 'left' || k === 'up') this.worldMapCycleRegion(-1)
      else if (k === 'right' || k === 'down') this.worldMapCycleRegion(1)
    } else if (view === 'teleport') {
      const targets = this.teleportTargets()
      if (k === 'b') {
        this.closeMenu()
        return
      }
      if (!targets.length) {
        this.say(['还没有可用的传送城镇。'])
        this.closeMenu()
        return
      }
      if (k === 'up') {
        m.idx = (m.idx + targets.length - 1) % targets.length
        audio.sfx('cursor')
      }
      if (k === 'down') {
        m.idx = (m.idx + 1) % targets.length
        audio.sfx('cursor')
      }
      if (k === 'a') this.teleportTo(targets[m.idx % targets.length].id)
    } else if (view === 'status') {
      if (k === 'b' || k === 'a') {
        m.view = 'root'
        audio.sfx('cancel')
      }
    } else if (view === 'items') {
      const ids = Object.keys(s.inventory.items).filter((id) => s.inventory.items[id] > 0)
      if (k === 'b') {
        m.view = 'root'
        audio.sfx('cancel')
        return
      }
      if (k === 'up') {
        m.idx = (m.idx + Math.max(1, ids.length) - 1) % Math.max(1, ids.length)
        audio.sfx('cursor')
      }
      if (k === 'down') {
        m.idx = (m.idx + 1) % Math.max(1, ids.length)
        audio.sfx('cursor')
      }
      if (k === 'a' && ids.length) {
        const id = ids[m.idx % ids.length]
        const it = ITEMS[id]
        if (it.hp) {
          const target = s.party
            .filter((x) => x.id && x.hp < x.maxHp)
            .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
          if (target) {
            target.hp = Math.min(target.maxHp, target.hp + it.hp)
            s.inventory.items[id]--
            audio.sfx('heal')
            this.say([target.name + ' 恢复了 ' + it.hp + ' HP。'])
          } else this.say(['HP 已经全满。'])
        } else if (it.repair) {
          const tank = this.getActiveTank()
          if (tank && tank.sp < TANKS.find((t) => t.id === tank.tankId)!.sp) {
            tank.sp = Math.min(TANKS.find((t) => t.id === tank.tankId)!.sp, tank.sp + it.repair)
            s.inventory.items[id]--
            audio.sfx('heal')
            this.say(['战车 SP 恢复了 ' + it.repair + '。'])
          } else this.say(['战车状态良好。'])
        }
      }
    } else if (view === 'tanks') {
      if (k === 'b') {
        m.view = 'root'
        audio.sfx('cancel')
        return
      }
      const members = s.party.filter((x) => x.id)
      const opts = ['乘降战车', ...members.map((x) => x.name + ' 的战车'), '返回']
      if (k === 'up') {
        m.idx = (m.idx + opts.length - 1) % opts.length
        audio.sfx('cursor')
      }
      if (k === 'down') {
        m.idx = (m.idx + 1) % opts.length
        audio.sfx('cursor')
      }
      if (k === 'a') {
        if (m.idx === 0) {
          if (s.riding) {
            s.riding = false
            audio.sfx('confirm')
          } else if (this.getActiveTank()) {
            s.riding = true
            audio.sfx('confirm')
          } else {
            audio.sfx('cancel')
          }
        } else if (m.idx === opts.length - 1) {
          m.view = 'root'
          m.idx = 2
          audio.sfx('cancel')
        } else {
          m.assignMember = members[m.idx - 1].name
          m.view = 'tankassign'
          m.idx = 0
        }
      }
    } else if (view === 'tankassign') {
      if (k === 'b') {
        m.view = 'tanks'
        m.idx = 0
        audio.sfx('cancel')
        return
      }
      const member = s.party.find((x) => x.name === m.assignMember)!
      const owned = this.tankAssignmentChoicesForUi().map((tank) => tank.tankId)
      const canPark = this.isAtGarage()
      const opts = [
        ...(canPark ? ['徒步（当前战车入库）'] : []),
        ...owned.map((id) => TANKS.find((t) => t.id === id)!.name)
      ]
      const optionCount = Math.max(1, opts.length)
      if (k === 'up') {
        m.idx = (m.idx + optionCount - 1) % optionCount
        audio.sfx('cursor')
      }
      if (k === 'down') {
        m.idx = (m.idx + 1) % optionCount
        audio.sfx('cursor')
      }
      if (k === 'a' && opts.length) {
        const selected = canPark && m.idx === 0 ? null : owned[m.idx - (canPark ? 1 : 0)]
        if (this.assignTank(member.id!, selected)) {
          audio.sfx('confirm')
          m.view = 'tanks'
          m.idx = 1
        } else audio.sfx('cancel')
      }
    } else if (view === 'equipment') {
      const members = s.party.filter((member) => member.id)
      if (k === 'b') {
        m.view = 'root'
        m.idx = FIELD_MENU_ITEMS.indexOf('装备')
        audio.sfx('cancel')
        return
      }
      if (k === 'up') {
        m.idx = (m.idx + Math.max(1, members.length) - 1) % Math.max(1, members.length)
        audio.sfx('cursor')
      } else if (k === 'down') {
        m.idx = (m.idx + 1) % Math.max(1, members.length)
        audio.sfx('cursor')
      } else if (k === 'a' && members.length) {
        const member = members[m.idx % members.length]
        m.equipMember = member.id!
        m.view = 'weaponassign'
        const choices = this.humanWeaponChoicesForUi(member.id!)
        m.idx = Math.max(
          0,
          choices.findIndex((choice) => choice.current)
        )
        audio.sfx('confirm')
      }
    } else if (view === 'weaponassign') {
      const memberId = m.equipMember
      const choices = memberId ? this.humanWeaponChoicesForUi(memberId) : []
      if (k === 'b') {
        m.view = 'equipment'
        m.idx = Math.max(
          0,
          s.party.filter((member) => member.id).findIndex((member) => member.id === memberId)
        )
        audio.sfx('cancel')
        return
      }
      if (k === 'up') {
        m.idx = (m.idx + Math.max(1, choices.length) - 1) % Math.max(1, choices.length)
        audio.sfx('cursor')
      } else if (k === 'down') {
        m.idx = (m.idx + 1) % Math.max(1, choices.length)
        audio.sfx('cursor')
      } else if (k === 'a' && memberId && choices.length) {
        const choice = choices[m.idx % choices.length]
        if (this.equipHumanWeapon(memberId, choice.id)) {
          m.view = 'equipment'
          m.idx = Math.max(
            0,
            s.party.filter((member) => member.id).findIndex((member) => member.id === memberId)
          )
          audio.sfx('confirm')
        } else {
          this.banner('仓库中没有这件武器')
          audio.sfx('cancel')
        }
      }
    } else if (view === 'hunt') {
      if (k === 'b') {
        m.view = 'root'
        m.idx = FIELD_MENU_ITEMS.indexOf('巡猎')
        audio.sfx('cancel')
        return
      }
      if (s.hunt) {
        if (k === 'a') this.claimHunt()
        return
      }
      const regions = availableHuntRegions(s)
      if (k === 'up' || k === 'down') {
        m.idx =
          (m.idx + (k === 'up' ? Math.max(1, regions.length) - 1 : 1)) % Math.max(1, regions.length)
        audio.sfx('cursor')
      } else if (k === 'left' || k === 'right') {
        const current = HUNT_DURATIONS.indexOf(
          (m.huntDuration || HUNT_DURATIONS[0]) as (typeof HUNT_DURATIONS)[number]
        )
        const direction = k === 'left' ? -1 : 1
        m.huntDuration =
          HUNT_DURATIONS[
            (Math.max(0, current) + direction + HUNT_DURATIONS.length) % HUNT_DURATIONS.length
          ]
        audio.sfx('cursor')
      } else if (k === 'a') {
        const region = regions[m.idx % Math.max(1, regions.length)]
        if (region) this.dispatchHunt(region.id, m.huntDuration || HUNT_DURATIONS[0])
        else this.say(['当前没有符合安全派遣条件的区域或成员。'])
      }
    } else if (view === 'bounty') {
      if (k === 'b') {
        m.view = 'root'
        audio.sfx('cancel')
        return
      }
    } else if (view === 'options') {
      const settings = useSettingsStore()
      if (k === 'b') {
        m.view = 'root'
        audio.sfx('cancel')
        return
      }
      if (k === 'a') {
        if (m.idx < 3) settings.activateOption(m.idx)
        else if (m.idx === 3) {
          s.screen = 'title'
          s.menu = null
          s.titleMenu = 0
          s.titleT = 0
          audio.playTrack('title')
        }
      }
      if (k === 'up') {
        m.idx = (m.idx + 3) % 4
        audio.sfx('cursor')
      }
      if (k === 'down') {
        m.idx = (m.idx + 1) % 4
        audio.sfx('cursor')
      }
      if (k === 'left' && m.idx < 3) {
        if (m.idx === 0) settings.adjustMusicVolume(-0.05)
        else if (m.idx === 1) settings.adjustSfxVolume(-0.05)
        else settings.cycleTextSpeed(-1)
        audio.sfx('cursor')
      }
      if (k === 'right' && m.idx < 3) {
        if (m.idx === 0) settings.adjustMusicVolume(0.05)
        else if (m.idx === 1) settings.adjustSfxVolume(0.05)
        else settings.cycleTextSpeed(1)
        audio.sfx('cursor')
      }
    }
  }

  private inTownForHunt(): boolean {
    return !!this.state.inTown && (this.state.base === 'town' || this.state.base === 'room')
  }

  private dispatchHunt(regionId: string, durationMinutes: number) {
    const s = this.state
    if (s.hunt) {
      this.say(['已经有一支巡猎队在外执行任务。'])
      return
    }
    if (!this.inTownForHunt()) {
      this.say(['巡猎队只能从城镇整备点出发。'])
      return
    }
    const preview = previewHunt(s, regionId, durationMinutes)
    if (!preview?.canStart || !preview.member) {
      this.say([preview?.reason || '当前无法执行该巡猎任务。'])
      return
    }
    const serial = Math.max(0, Math.floor(Number(s.flags.hunt_serial) || 0)) + 1
    const task = createHuntTask(s, preview, serial)
    if (preview.tank) {
      preview.tank.armor -= task.armorCost
      preview.tank.ammo.main -= task.mainAmmoCost
      preview.tank.ammo.se -= task.seAmmoCost
    }
    s.flags.hunt_serial = serial
    s.hunt = task
    audio.sfx('confirm')
    this.say([
      `${preview.member.name}已前往${preview.region.name}巡猎。`,
      `预计耗时 ${task.durationMinutes} 分钟；返航安全线已锁定。`,
      '巡猎期间，派出成员与战车不能参加战斗、改装或重新分配。'
    ])
  }

  private claimHunt() {
    const s = this.state
    const task = s.hunt
    if (!task) return
    if (!this.inTownForHunt()) {
      this.say(['请回到任意城镇接收巡猎队。'])
      return
    }
    const remaining = huntRemainingMinutes(s)
    if (remaining > 0) {
      this.say([`巡猎队尚未返航，预计还需 ${remaining} 分钟。`])
      return
    }
    const claimKey = `hunt_claimed_${task.id}`
    if (task.claimed || s.flags[claimKey]) {
      s.hunt = null
      this.say(['这份巡猎报告已经结算。'])
      return
    }
    task.claimed = true
    s.flags[claimKey] = true
    const member = s.party.find((candidate) => candidate.id === task.memberId)
    const region = REGIONS.find((candidate) => candidate.id === task.regionId)
    s.gold += task.gold
    const levelMessages = member ? this.gainMemberXP(member, task.xp) : []
    s.hunt = null
    audio.sfx('cash')
    this.say([
      `${member?.name || '巡猎队'}从${region?.name || '荒野'}返航。`,
      `获得 ${task.xp} 经验值与 ${fmtG(task.gold)}G。`,
      ...levelMessages
    ])
  }

  private gainMemberXP(member: GameState['party'][number], xp: number): string[] {
    const messages: string[] = []
    member.xp += xp
    while (member.xp >= xpNeed(member.lv)) {
      member.xp -= xpNeed(member.lv)
      member.lv++
      const growth = GROWTH[member.cls].up
      member.maxHp += growth.hp
      member.atk += growth.atk
      member.def += growth.def
      member.spd += growth.spd
      member.hp = member.maxHp
      messages.push(`${member.name}升到了 ${member.lv} 级！`)
    }
    return messages
  }

  claimAll() {
    const s = this.state
    let total = 0
    for (const b of BOUNTIES) {
      if (s.bounties.killed[b.id] && !s.bounties.claimed[b.id]) {
        s.bounties.claimed[b.id] = true
        total += b.gold
      }
    }
    if (total) {
      s.gold += total
      if (s.flags.tutorial_step === 12 && s.bounties.claimed.water) {
        s.flags.tutorial_step = 13
        s.flags.tutorial_complete = true
        this.banner('新手教学完成：真正的猎人生涯开始了')
      }
      audio.sfx('cash')
      this.say(['领取了 ' + fmtG(total) + 'G 赏金！'])
    } else this.say(['没有可领取的赏金。'])
  }

  /* ================= 商店 ================= */
  openShop(type: string, building: { name: string }) {
    const s = this.state
    const shopType = type === 'tankshop' ? 'tank' : type === 'modshop' ? 'mod' : type
    s.base = s.screen
    s.screen = 'shop'
    s.shop = {
      type: shopType,
      name: building.name,
      town: s.inTown || s.map,
      tab: 0,
      idx: 0,
      msg: '',
      msgT: 0,
      tankSel: 0,
      maintenance: shopType === 'tank' ? { phase: 'garage', items: [], result: [] } : undefined
    }
    if (shopType === 'bounty' && s.flags.tutorial_step === 10) {
      s.flags.tutorial_step = 11
      this.banner('新手教学：悬赏目标已登记')
    }
    audio.playTrack('shop')
    audio.sfx('confirm')
  }

  private closeShop() {
    const s = this.state
    s.screen = (s.base || 'world') as Screen
    s.shop = null
    if (['world', 'town', 'cave', 'room'].includes(s.screen)) {
      audio.playTrack(
        explorationTrackFor({
          screen: s.screen as 'world' | 'town' | 'cave' | 'room',
          map: s.map,
          px: s.px,
          py: s.py
        })
      )
    }
    audio.sfx('cancel')
  }

  private shopList(): {
    list: { id: string; name: string; price: number; kind?: string; pkey?: PartKind }[]
    kind: string
  } {
    const sh = this.state.shop!
    if (sh.type === 'weapon') {
      const cfg = SHOPS[sh.town].weapon
      if (sh.tab < 6) {
        if (sh.tab === 0)
          return {
            list: [
              ...cfg.items.map((id) => ({
                id,
                name: ITEMS[id].name,
                price: ITEMS[id].price,
                kind: 'item'
              })),
              ...cfg.human.map((id) => ({
                id,
                name: HUMAN_WEAPONS[id].name,
                price: HUMAN_WEAPONS[id].price,
                kind: 'humanWeapon'
              }))
            ],
            kind: 'mixed'
          }
        const pkey = (['main', 'sub', 'se', 'engine', 'c'] as PartKind[])[sh.tab - 1]
        return {
          list: cfg[pkey].map((id) => ({
            id,
            name: PARTS[pkey].find((p) => p.id === id)!.name,
            price: PARTS[pkey].find((p) => p.id === id)!.price
          })),
          kind: 'part'
        }
      }
      if (sh.tab === 6) {
        const list: { id: string; name: string; price: number; kind?: string }[] = []
        for (const id in this.state.inventory.items)
          if (this.state.inventory.items[id] > 0)
            list.push({
              id,
              name: ITEMS[id].name,
              price: Math.floor(ITEMS[id].price / 2),
              kind: 'item'
            })
        for (const id in this.state.inventory.parts)
          if (this.state.inventory.parts[id] > 0) {
            const p = findPart(id)
            if (p) list.push({ id, name: p.name, price: Math.floor(p.price / 2), kind: 'part' })
          }
        for (const id in this.state.inventory.weapons) {
          if (this.state.inventory.weapons[id] <= 0) continue
          const weapon = findHumanWeapon(id)
          if (weapon) {
            list.push({
              id,
              name: weapon.name,
              price: Math.floor(weapon.price / 2),
              kind: 'humanWeapon'
            })
          }
        }
        return { list, kind: 'sell' }
      }
      return { list: [], kind: 'none' }
    }
    if (sh.type === 'tank') {
      const cfg = SHOPS[sh.town].tank
      const list = cfg.sell
        .filter((id) => !this.state.tanks.some((t) => t.tankId === id))
        .map((id) => {
          const t = TANKS.find((x) => x.id === id)!
          return { id, name: t.name, price: t.price }
        })
      return { list, kind: 'tank' }
    }
    if (sh.type === 'mod') {
      const tanks = this.serviceableTanksForUi()
      return {
        list: tanks.map((t, i) => ({
          id: String(i),
          name: TANKS.find((x) => x.id === t.tankId)!.name,
          price: 0,
          cur: i === (sh.tankSel || 0)
        })),
        kind: 'modsel'
      }
    }
    return { list: [], kind: 'none' }
  }

  private updateShop(dt: number) {
    const sh = this.state.shop!
    if (sh.msgT > 0) sh.msgT -= dt
    const lst = this.shopList()
    const list = lst.list
    for (const k of input.poll()) {
      if (sh.type === 'weapon') {
        if (k === 'left') {
          sh.tab = (sh.tab + 7) % 8
          sh.idx = 0
          audio.sfx('cursor')
        }
        if (k === 'right') {
          sh.tab = (sh.tab + 1) % 8
          sh.idx = 0
          audio.sfx('cursor')
        }
        if (k === 'up') {
          sh.idx = (sh.idx + Math.max(1, list.length) - 1) % Math.max(1, list.length)
          audio.sfx('cursor')
        }
        if (k === 'down') {
          sh.idx = (sh.idx + 1) % Math.max(1, list.length)
          audio.sfx('cursor')
        }
        if (k === 'a') {
          if (sh.tab === 7) {
            this.closeShop()
            return
          }
          if (sh.tab === 6) {
            const it = list[sh.idx]
            if (it) {
              if (it.kind === 'item') {
                this.state.inventory.items[it.id]--
                this.state.gold += it.price
              } else if (it.kind === 'part') {
                this.state.inventory.parts[it.id]--
                this.state.gold += it.price
              } else {
                this.state.inventory.weapons[it.id]--
                this.state.gold += it.price
              }
              audio.sfx('cash')
              sh.msg = '卖出 ' + it.name + '，+' + fmtG(it.price) + 'G'
              sh.msgT = 1.2
            }
          } else if (sh.tab === 0) {
            const it = list[sh.idx]
            if (it && this.state.gold >= it.price) {
              this.state.gold -= it.price
              if (it.kind === 'humanWeapon') this.addHumanWeapon(it.id)
              else this.addItem(it.id)
              audio.sfx('cash')
              sh.msg = '购入 ' + it.name
              sh.msgT = 1.2
            } else if (it) {
              sh.msg = '资金不足！'
              sh.msgT = 1.2
            }
          } else {
            const it = list[sh.idx]
            if (it && this.state.gold >= it.price) {
              this.state.gold -= it.price
              this.addPart(it.id)
              audio.sfx('cash')
              sh.msg = '购入 ' + it.name
              sh.msgT = 1.2
            } else if (it) {
              sh.msg = '资金不足！'
              sh.msgT = 1.2
            }
          }
        }
        if (k === 'b') {
          this.closeShop()
          return
        }
      } else if (sh.type === 'tank') {
        this.updateTankGarage(k, list)
      } else if (sh.type === 'mod') {
        this.updateMod(k)
      } else if (sh.type === 'inn') {
        if (k === 'up') {
          sh.idx = (sh.idx + 2) % 3
          audio.sfx('cursor')
        }
        if (k === 'down') {
          sh.idx = (sh.idx + 1) % 3
          audio.sfx('cursor')
        }
        if (k === 'a') {
          if (sh.idx === 0) {
            const cost = this.innCost()
            if (this.state.gold < cost) {
              sh.msg = '住宿费需要 ' + fmtG(cost) + 'G。'
              sh.msgT = 1.5
              audio.sfx('cancel')
              continue
            }
            this.state.gold -= cost
            this.beginSleep('inn')
          } else if (sh.idx === 1) {
            if (this.saveGame()) {
              sh.msg = '旅途记录已保存。'
              sh.msgT = 1.5
              audio.sfx('confirm')
            }
          } else this.closeShop()
        }
        if (k === 'b') {
          this.closeShop()
          return
        }
      } else if (sh.type === 'bounty') {
        if (k === 'a') this.claimAll()
        if (k === 'b') {
          this.closeShop()
          return
        }
      }
    }
  }

  private updateTankGarage(key: string, buyList: { id: string; name: string; price: number }[]) {
    const sh = this.state.shop!
    const session = (sh.maintenance ||= { phase: 'garage', items: [], result: [] })
    const serviceableTanks = this.serviceableTanksForUi()
    const tank = serviceableTanks[sh.tankSel] || null
    if (session.phase === 'garage') {
      const actions = this.tankGarageActions()
      if ((key === 'left' || key === 'right') && serviceableTanks.length) {
        const direction = key === 'left' ? -1 : 1
        sh.tankSel = (sh.tankSel + direction + serviceableTanks.length) % serviceableTanks.length
        audio.sfx('cursor')
      } else if (key === 'up' || key === 'down') {
        sh.idx = (sh.idx + (key === 'up' ? actions.length - 1 : 1)) % Math.max(1, actions.length)
        audio.sfx('cursor')
      } else if (key === 'a') {
        const action = actions[sh.idx]
        if (action === 'training') {
          if (!tank || !this.tankOperational(tank)) {
            sh.msg = '训练前必须先把发动机、C 装置和底盘修到可行动状态。'
            sh.msgT = 1.8
            audio.sfx('cancel')
            return
          }
          const step = Number(this.state.flags.tutorial_step)
          const kind = step === 6 ? 'sub' : step === 7 ? 'main' : 'se'
          this.closeShop()
          this.startTutorialTraining(kind)
          return
        }
        if (action === 'diagnosis') {
          if (!tank) {
            sh.msg = '车库里没有可接收的战车。'
            sh.msgT = 1.5
            audio.sfx('cancel')
            return
          }
          if (this.state.hunt?.tankId === tank.tankId) {
            sh.msg = '该战车正在执行巡猎任务，返航前无法接车。'
            sh.msgT = 1.8
            audio.sfx('cancel')
            return
          }
          session.items = diagnoseTank(tank)
          session.result = []
          session.phase = 'diagnosis'
          sh.idx = 0
          this.state.flags.tutorial_maintenance_diagnosed = true
          audio.sfx('confirm')
        } else if (action === 'buy') {
          session.phase = 'buy'
          sh.idx = 0
          audio.sfx('confirm')
        } else if (action === 'exit') {
          this.closeShop()
        }
      } else if (key === 'b') this.closeShop()
      return
    }
    if (session.phase === 'diagnosis') {
      if (key === 'a') {
        session.phase = 'workorder'
        sh.idx = 0
        audio.sfx('confirm')
      } else if (key === 'b') {
        session.phase = 'garage'
        sh.idx = 0
        audio.sfx('cancel')
      }
      return
    }
    if (session.phase === 'workorder') {
      const actionIndex = session.items.length
      const optionCount = actionIndex + 1
      if (key === 'up' || key === 'down') {
        sh.idx = (sh.idx + (key === 'up' ? optionCount - 1 : 1)) % optionCount
        audio.sfx('cursor')
      } else if (key === 'a' && sh.idx < actionIndex) {
        session.items[sh.idx].selected = !session.items[sh.idx].selected
        audio.sfx('cursor')
      } else if (key === 'a') {
        if (!tank) {
          session.phase = 'garage'
          return
        }
        const totals = maintenanceTotals(session.items)
        if (!totals.selected) {
          sh.msg = '工单中还没有选择整备项目。'
          sh.msgT = 1.5
          audio.sfx('cancel')
          return
        }
        if (this.state.gold < totals.cost) {
          sh.msg = `资金不足（需 ${fmtG(totals.cost)}G）`
          sh.msgT = 1.5
          audio.sfx('cancel')
          return
        }
        const result = executeMaintenance(tank, session.items)
        this.state.gold -= result.cost
        advanceEnvironmentMinutes(this.state.environment, result.minutes)
        session.result = result.lines
        session.phase = 'result'
        sh.idx = 0
        this.state.flags.tutorial_maintenance_done = true
        if (this.state.flags.tutorial_step === 5) this.state.flags.tutorial_step = 6
        audio.sfx('heal')
      } else if (key === 'b') {
        session.phase = 'diagnosis'
        sh.idx = 0
        audio.sfx('cancel')
      }
      return
    }
    if (session.phase === 'result') {
      if (key === 'a' || key === 'b') {
        session.phase = 'garage'
        session.items = []
        sh.idx = 0
        audio.sfx(key === 'a' ? 'confirm' : 'cancel')
      }
      return
    }
    if (session.phase === 'buy') {
      if (key === 'up' || key === 'down') {
        sh.idx =
          (sh.idx + (key === 'up' ? Math.max(1, buyList.length) - 1 : 1)) %
          Math.max(1, buyList.length)
        audio.sfx('cursor')
      } else if (key === 'a') {
        const item = buyList[sh.idx]
        if (!item) {
          sh.msg = '目前没有可购买的战车。'
          sh.msgT = 1.5
        } else if (this.state.gold < item.price) {
          sh.msg = '资金不足！'
          sh.msgT = 1.2
          audio.sfx('cancel')
        } else {
          this.state.gold -= item.price
          this.addTank(item.id)
          sh.tankSel = Math.max(0, this.serviceableTanksForUi().length - 1)
          sh.idx = 0
          audio.sfx('levelup')
          sh.msg = `购入 ${item.name}！`
          sh.msgT = 1.5
        }
      } else if (key === 'b') {
        session.phase = 'garage'
        sh.idx = 0
        audio.sfx('cancel')
      }
    }
  }

  private tankGarageActions(): Array<'training' | 'diagnosis' | 'buy' | 'exit'> {
    const step = Number(this.state.flags.tutorial_step)
    return step >= 6 && step <= 8
      ? ['training', 'diagnosis', 'buy', 'exit']
      : ['diagnosis', 'buy', 'exit']
  }

  private startTutorialTraining(kind: 'sub' | 'main' | 'se') {
    const config = {
      sub: {
        mobs: ['training_can', 'training_can', 'training_can'],
        next: 7,
        text: '老乔：副炮不耗炮弹，还能扫射全体。用副炮一次清掉这些轻型靶！'
      },
      main: {
        mobs: ['training_armor'],
        next: 8,
        text: '老乔：主炮是有限弹药的高威力单体武器。瞄准重甲测试靶开火！'
      },
      se: {
        mobs: ['training_cluster', 'training_cluster'],
        next: 9,
        text: '老乔：S-E 弹仓小、补给贵，但适合紧急爆发。用导弹同时摧毁强化靶！'
      }
    }[kind]
    this.state.riding = true
    this.startBattle(config.mobs, {
      requiredWeapon: kind,
      tutorialStage: kind,
      tutorialNextStep: config.next,
      noRewards: true,
      text: config.text
    })
  }

  private updateMod(k: string) {
    const sh = this.state.shop!
    const tanks = this.serviceableTanksForUi()
    if (!tanks.length) {
      if (k === 'b') this.closeShop()
      return
    }
    const selectedTank = tanks[this.state.shop!.tankSel]
    if (k === 'a' && selectedTank && this.state.hunt?.tankId === selectedTank.tankId) {
      this.state.shop!.msg = '该战车正在巡猎，返航前不能改造。'
      this.state.shop!.msgT = 1.8
      audio.sfx('cancel')
      return
    }
    if (sh.tab === undefined) sh.tab = 0
    if (k === 'b') {
      if (sh.tab === 0) {
        this.closeShop()
        return
      }
      sh.tab = 0
      sh.idx = 0
      audio.sfx('cancel')
      return
    }
    if (sh.tab === 0) {
      if (k === 'up') {
        sh.tankSel = (sh.tankSel + tanks.length - 1) % tanks.length
        audio.sfx('cursor')
      }
      if (k === 'down') {
        sh.tankSel = (sh.tankSel + 1) % tanks.length
        audio.sfx('cursor')
      }
      if (k === 'left') {
        sh.idx = (sh.idx + 2) % 3
        audio.sfx('cursor')
      }
      if (k === 'right') {
        sh.idx = (sh.idx + 1) % 3
        audio.sfx('cursor')
      }
      if (k === 'a') {
        sh.tab = sh.idx === 0 ? 1 : sh.idx === 1 ? 3 : 4
        sh.idx = 0
        audio.sfx('confirm')
      }
    } else if (sh.tab === 1) {
      if (k === 'up') {
        sh.idx = (sh.idx + 4) % 5
        audio.sfx('cursor')
      }
      if (k === 'down') {
        sh.idx = (sh.idx + 1) % 5
        audio.sfx('cursor')
      }
      if (k === 'a') {
        const slot = (['main', 'sub', 'se', 'engine', 'c'] as PartKind[])[sh.idx]
        const tank = tanks[sh.tankSel]
        const def = TANKS.find((t) => t.id === tank.tankId)!
        if ((slot === 'main' || slot === 'sub' || slot === 'se') && def.slots[slot] < 1) {
          sh.msg =
            def.name +
            ' 没有' +
            ({ main: '主炮', sub: '副炮', se: 'S-E' } as const)[slot] +
            '槽位。'
          sh.msgT = 1.5
          audio.sfx('cancel')
          return
        }
        sh.slot = slot
        sh.tab = 2
        sh.idx = 0
        audio.sfx('confirm')
      }
    } else if (sh.tab === 2) {
      const tank = tanks[sh.tankSel]
      const pkey = sh.slot!
      const list = PARTS[pkey]
      const owned = Object.keys(this.state.inventory.parts).filter(
        (id) => this.state.inventory.parts[id] > 0 && list.some((p) => p.id === id)
      )
      const cur = tank.parts[pkey]
      const all = [...(cur ? [cur] : []), ...owned.filter((id) => id !== cur)]
      if (k === 'up') {
        sh.idx = (sh.idx + Math.max(1, all.length) - 1) % Math.max(1, all.length)
        audio.sfx('cursor')
      }
      if (k === 'down') {
        sh.idx = (sh.idx + 1) % Math.max(1, all.length)
        audio.sfx('cursor')
      }
      if (k === 'a' && all.length) {
        const newId = all[sh.idx]
        if (newId !== cur) {
          this.state.inventory.parts[newId]--
          if (cur) this.addPart(cur)
          tank.parts[pkey] = newId
          tank.condition[pkey] = 'normal'
          if (pkey === 'main' || pkey === 'se') {
            tank.ammo[pkey] = Math.min(tank.ammo[pkey], tankAmmoCapacity(tank, pkey))
          }
          audio.sfx('confirm')
          sh.msg = this.tankOverweight(tank) ? '换装完成，但战车已经超载！' : '换装完成！'
          sh.msgT = 1.5
        }
        sh.tab = 1
        sh.idx = (['main', 'sub', 'se', 'engine', 'c'] as PartKind[]).indexOf(pkey)
      }
    } else if (sh.tab === 3) {
      const tank = tanks[sh.tankSel]
      const td = TANKS.find((x) => x.id === tank.tankId)!
      if (k === 'a') {
        if (tank.armor >= td.armorCap) {
          sh.msg = '装甲已满。'
          sh.msgT = 1.2
        } else if (this.state.gold >= ARMOR_PACK_COST) {
          this.state.gold -= ARMOR_PACK_COST
          tank.armor = Math.min(td.armorCap, tank.armor + ARMOR_PACK_SIZE)
          audio.sfx('cash')
          sh.msg = `+${ARMOR_PACK_SIZE} 装甲片（${tank.armor}/${td.armorCap}）`
          sh.msgT = 1.2
        } else {
          sh.msg = '资金不足！'
          sh.msgT = 1.2
        }
      }
    } else if (sh.tab === 4) {
      if (k === 'a') {
        sh.tab = 0
        audio.sfx('cancel')
      }
    }
  }

  /* ================= 密码门 ================= */
  openPassword() {
    const s = this.state
    s.base = s.screen
    s.screen = 'password'
    s.pass = { pos: 0, digits: [0, 0, 0, 0] }
    audio.sfx('confirm')
  }

  private updatePassword(_dt: number) {
    const p = this.state.pass!
    for (const k of input.poll()) {
      if (k === 'left') {
        p.pos = (p.pos + 3) % 4
        audio.sfx('cursor')
      }
      if (k === 'right') {
        p.pos = (p.pos + 1) % 4
        audio.sfx('cursor')
      }
      if (k === 'up') {
        p.digits[p.pos] = (p.digits[p.pos] + 1) % 10
        audio.sfx('cursor')
      }
      if (k === 'down') {
        p.digits[p.pos] = (p.digits[p.pos] + 9) % 10
        audio.sfx('cursor')
      }
      if (k === 'a') {
        const code = p.digits.join('')
        const idx = PASSWORDS.indexOf(code)
        const s = this.state
        if (idx >= 0 && !s.flags['pass' + idx]) {
          s.flags['pass' + idx] = true
          const done = [0, 1, 2, 3].every((i) => s.flags['pass' + i])
          if (done) {
            s.flags.hell_open = true
            audio.sfx('levelup')
            s.screen = (s.base || 'world') as Screen
            s.pass = null
            this.say([
              '「密码认证通过——第 ' + (idx + 1) + ' 终端。」',
              '「……全部密码已确认。」',
              '「地狱门，开启。」'
            ])
          } else {
            audio.sfx('confirm')
            s.screen = (s.base || 'world') as Screen
            s.pass = null
            this.say([
              '「密码认证通过——第 ' + (idx + 1) + ' 终端。」',
              '（还剩 ' +
                (4 - [0, 1, 2, 3].filter((i) => s.flags['pass' + i]).length) +
                ' 个终端需要认证。）'
            ])
          }
        } else {
          audio.sfx('alarm')
          this.say(['「密码错误。警告：防御系统启动中……」', '（好在守卫没有发现你。）'])
        }
      }
      if (k === 'b') {
        this.state.screen = (this.state.base || 'world') as Screen
        this.state.pass = null
        audio.sfx('cancel')
      }
    }
  }

  /* ================= 标题 / 序章 ================= */
  private updateTitle(dt: number) {
    const s = this.state
    s.titleT += dt
    for (const k of input.poll()) {
      if (s.creditsOpen) {
        if (k === 'a' || k === 'b') {
          s.creditsOpen = false
          s.titleMenu = 0
          audio.sfx(k === 'a' ? 'confirm' : 'cancel')
        }
        continue
      }
      if (s.jukebox) {
        const names = Object.keys(TRACKS)
        if (k === 'up' || k === 'left') {
          s.jukeIdx = (s.jukeIdx + names.length - 1) % names.length
          audio.playTrack(names[s.jukeIdx])
          audio.sfx('cursor')
        }
        if (k === 'down' || k === 'right') {
          s.jukeIdx = (s.jukeIdx + 1) % names.length
          audio.playTrack(names[s.jukeIdx])
          audio.sfx('cursor')
        }
        if (k === 'a') {
          audio.playTrack(names[s.jukeIdx])
          audio.sfx('confirm')
        }
        if (k === 'b') {
          s.jukebox = false
          s.titleMenu = 0
          audio.sfx('cancel')
        }
        continue
      }
      if (k === 'up' || k === 'left') {
        s.titleMenu = (s.titleMenu + 3) % 4
        audio.sfx('cursor')
      }
      if (k === 'down' || k === 'right') {
        s.titleMenu = (s.titleMenu + 1) % 4
        audio.sfx('cursor')
      }
      if (k === 'a') {
        audio.sfx('confirm')
        if (s.titleMenu === 0) {
          if (this.hasSave())
            this.say(['已有存档。', '开始新游戏将覆盖存档，确定吗？'], () => this.newGame())
          else this.newGame()
        } else if (s.titleMenu === 1) {
          if (!this.loadGame()) this.say(['没有找到存档。'])
        } else if (s.titleMenu === 2) {
          s.titleMenu = 0
          s.jukebox = true
          audio.playTrack('title')
        } else {
          s.titleMenu = 0
          s.creditsOpen = true
        }
      }
    }
  }

  private updateIntro(dt: number) {
    const it = this.state.intro
    it.t += dt
    for (const k of input.poll()) {
      if (k === 'a') {
        it.idx++
        it.t = 0
        audio.sfx('cursor')
        if (it.idx >= INTRO.length) this.startWorld()
      }
    }
  }

  private startWorld() {
    this.state.flags.tutorial_step = 0
    this.say([
      '清晨，拉多镇。你在修理店的引擎轰鸣声中醒来。',
      '新手任务：先面对父亲按 Z 对话。',
      '方向键 / WASD 移动，Z / J / 回车确认，X / K / Esc 打开菜单。',
      '目标：去拉多镇南侧洞窟取回老战车。拿到第一辆战车前，附近不会出现随机战斗。'
    ])
    this.world.enterRoom('rado_home')
  }

  private updateEnding(dt: number) {
    const e = this.state.ending!
    e.t += dt
    for (const k of input.poll()) {
      if (k === 'a' && e.t > 0.5) {
        e.idx++
        e.t = 0
        if (e.idx >= ENDING.length) {
          const s = this.state
          s.screen = 'title'
          s.titleMenu = 0
          s.titleT = 0
          s.ending = null
          audio.playTrack('title')
        }
      }
    }
  }

  private updateGameOver(dt: number) {
    this.state.goT += dt
    for (const k of input.poll()) {
      if ((k === 'a' || k === 'b') && this.state.goT > 1) {
        this.recoverAfterDefeat()
        return
      }
    }
  }

  private recoverAfterDefeat() {
    const s = this.state
    const lostGold = defeatGoldLoss(s.gold)
    s.gold -= lostGold
    for (const member of s.party) {
      if (member.id) member.hp = member.maxHp
      if (member.id && member.id !== s.hunt?.memberId) member.tankId = null
    }
    normalizeGarageLocations(s)

    s.battle = null
    s.base = null
    s.dialog = null
    s.sleep = null
    s.menu = null
    s.shop = null
    s.pass = null
    s.anim = null
    s.riding = false
    s.goT = 0
    this.dialogQueue = []

    this.world.enterRoom('rado_home_upper', [5, 5])
    s.facing = 0
    this.say([
      '……楼下传来熟悉的引擎声。',
      '你在拉多镇自宅二楼的床边醒了过来。',
      lostGold > 0
        ? `救援和治疗花掉了 ${fmtG(lostGold)}G。`
        : '你身上没有金币，救援队这次没有收钱。',
      '队员已经恢复。物品、装备、经验和旅途进度没有丢失。',
      '参战战车已按空位拖回自宅地下车库，保留战斗结束时的受损状态。'
    ])
  }

  /* 供 Vue 组件直接调用的便捷方法 */
  menuSelect(i: number) {
    const m = this.state.menu
    if (m && m.view === 'root') {
      m.idx = i
      this.menuAct()
    }
  }
  menuUse(i: number) {
    const m = this.state.menu
    if (m) {
      m.idx = i
    }
    input.press('a')
  }
  worldMapForUi() {
    return buildWorldMapViewModel(this.state, this.state.menu?.mapRegion)
  }
  worldMapCycleRegion(direction: number) {
    const menu = this.state.menu
    if (!menu || menu.view !== 'map') return
    const model = buildWorldMapViewModel(this.state, menu.mapRegion)
    if (!model.regions.length) return
    const step = direction < 0 ? -1 : 1
    const index = (model.selectedIndex + step + model.regions.length) % model.regions.length
    menu.idx = index
    menu.mapRegion = model.regions[index].id
    audio.sfx('cursor')
  }
  worldMapBack() {
    const menu = this.state.menu
    if (!menu || menu.view !== 'map') return
    menu.view = 'root'
    menu.idx = FIELD_MENU_ITEMS.indexOf('地图')
    delete menu.mapRegion
    audio.sfx('cancel')
  }
  huntRegionsForUi() {
    return availableHuntRegions(this.state)
  }
  huntPreviewForUi() {
    const menu = this.state.menu
    const regions = availableHuntRegions(this.state)
    const region = regions[(menu?.idx || 0) % Math.max(1, regions.length)]
    return region
      ? previewHunt(this.state, region.id, menu?.huntDuration || HUNT_DURATIONS[0])
      : null
  }
  huntRemainingForUi(): number {
    return huntRemainingMinutes(this.state)
  }
  huntSelectRegion(index: number) {
    const menu = this.state.menu
    if (!menu || menu.view !== 'hunt' || this.state.hunt) return
    const regions = availableHuntRegions(this.state)
    menu.idx = Math.max(0, Math.min(regions.length - 1, index))
    audio.sfx('cursor')
  }
  huntCycleDuration(direction: number) {
    const menu = this.state.menu
    if (!menu || menu.view !== 'hunt' || this.state.hunt) return
    const current = HUNT_DURATIONS.indexOf(
      (menu.huntDuration || HUNT_DURATIONS[0]) as (typeof HUNT_DURATIONS)[number]
    )
    menu.huntDuration =
      HUNT_DURATIONS[
        (Math.max(0, current) + Math.sign(direction) + HUNT_DURATIONS.length) %
          HUNT_DURATIONS.length
      ]
    audio.sfx('cursor')
  }
  huntSetDuration(minutes: number) {
    const menu = this.state.menu
    if (
      !menu ||
      menu.view !== 'hunt' ||
      this.state.hunt ||
      !HUNT_DURATIONS.includes(minutes as (typeof HUNT_DURATIONS)[number])
    ) {
      return
    }
    menu.huntDuration = minutes
    audio.sfx('cursor')
  }
  huntConfirm() {
    input.press('a')
  }
  titleChoose(i: number) {
    this.state.titleMenu = i
    input.press('a')
  }
  jukeboxSelect(i: number) {
    const names = Object.keys(TRACKS)
    this.state.jukeIdx = ((i % names.length) + names.length) % names.length
    audio.playTrack(names[this.state.jukeIdx])
  }
  closeTitleOverlay() {
    this.state.jukebox = false
    this.state.creditsOpen = false
    this.state.titleMenu = 0
    audio.sfx('cancel')
  }
  shopSelect(i: number) {
    const sh = this.state.shop
    if (sh) {
      sh.idx = i
    }
  }
  shopTankTo(i: number) {
    const sh = this.state.shop
    const tanks = this.serviceableTanksForUi()
    if (!sh || !tanks.length) return
    sh.tankSel = Math.max(0, Math.min(tanks.length - 1, i))
    sh.idx = 0
  }
  shopTabTo(i: number) {
    const sh = this.state.shop
    if (sh && sh.type === 'weapon') {
      sh.tab = i
      sh.idx = 0
    }
  }
  shopListForUi() {
    return this.state.shop ? this.shopList() : { list: [], kind: 'none' }
  }
  tankGarageMenuItems(): string[] {
    const step = Number(this.state.flags.tutorial_step)
    const trainingLabel = step === 6 ? '副炮清杂训练' : step === 7 ? '主炮破甲训练' : 'S-E 群攻训练'
    return this.tankGarageActions().map((action) => {
      if (action === 'training') return trainingLabel
      if (action === 'diagnosis') return '接车诊断'
      if (action === 'buy') return '购买战车'
      return '离开工房'
    })
  }
  shopConfirm() {
    input.press('a')
  }
  shopCancel() {
    input.press('b')
  }
  innCost() {
    return this.state.party.filter((m) => m.id).length * 20
  }
  passPress(k: string) {
    input.press(k)
  }
  battleMenuItems(): string[] {
    return this.battle.menuItems()
  }
  battleCommandHelp(): string {
    return this.battle.commandHelp()
  }
  battleCmd(i: number) {
    const b = this.state.battle
    if (b && b.cmd) {
      b.cmd.idx = i
    }
  }
  battleConfirm() {
    input.press('a')
  }
  battleCancel() {
    input.press('b')
  }
}

export const store = new GameStore()
