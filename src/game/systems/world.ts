/* 探索系统：世界地图 / 城镇 / 洞窟 / 对话 / 商店入口 / 剧情事件 */

import type { GameApi } from '@/game/core/api'
import type { TownDef } from '@/game/types'
import { BOUNTIES, REGIONS } from '@/game/data/combat'
import { DIALOGUE } from '@/game/data/story'
import { CAVES, ROOMS, TILE, TOWNS, WORLD } from '@/game/data/maps'
import { buildCaveGrid, buildRoomGrid, buildTownGrid, invalidateMap } from '@/game/engine/map-baker'
import { townDecorAt } from '@/game/engine/tileart'
import { chance, choice, ri } from '@/game/utils'
import { playTrack } from '@/game/audio/audio'
import { explorationTrackFor } from '@/game/audio/cues'
import { advanceEncounterPacing, encounterTriggers } from '@/game/systems/encounters'
import { EventSystem } from '@/game/systems/events'
import { recruitWithCatchUp } from '@/game/systems/growth'
import {
  dangerPips,
  recommendedLevelLabel,
  regionAtWorld,
  vehicleRecommendationLabel
} from '@/game/systems/regions'
import {
  caveWorldEntrance,
  revealWorldTiles,
  worldPositionForLocation
} from '@/game/systems/world-map'
import { worldGateAt, worldGateUnlocked } from '@/game/systems/world-gates'

const DIRS: [number, number][] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0]
]
const BOUNTY_REGION: Record<string, string> = {
  water: 'pobb',
  ghost: 'pobb',
  alien: 'odo',
  bolt: 'sold',
  waroo: 'tarr',
  mystery: 'eden',
  ark: 'desert'
}

export class WorldSystem {
  private events: EventSystem

  constructor(private api: GameApi) {
    this.events = new EventSystem(api)
  }

  private get s() {
    return this.api.state
  }

  private rememberWorldPosition(x: number, y: number, radius?: number) {
    this.s.worldMap = revealWorldTiles(this.s.worldMap, x, y, radius)
  }

  syncWorldMapPosition(radius?: number) {
    if (this.s.map !== 'world') return
    this.rememberWorldPosition(this.s.px, this.s.py, radius)
  }

  /* ---------------- 地图 ---------------- */
  private gridOf(mapId: string): string[] {
    if (mapId === 'world') return WORLD
    const town = TOWNS.find((t) => t.id === mapId)
    if (town) return buildTownGrid(town).map
    const cave = CAVES.find((c) => c.id === mapId)
    if (cave) return buildCaveGrid(cave).map
    const room = ROOMS.find((r) => r.id === mapId)
    if (room) return buildRoomGrid(room).map
    return []
  }

  tileAt(mapId: string, x: number, y: number): string {
    const grid = this.gridOf(mapId)
    if (!grid.length || y < 0 || y >= grid.length || x < 0 || x >= grid[y].length) return '#'
    return grid[y][x]
  }

  /* ---------------- 状态切换 ---------------- */
  enterTown(id: string) {
    const t = TOWNS.find((x) => x.id === id)!
    const g = buildTownGrid(t)
    const s = this.s
    s.screen = 'town'
    s.map = id
    s.px = g.exit[0]
    s.py = g.exit[1] - 1
    s.facing = 0
    s.riding = false
    s.anim = null
    s.inTown = id
    s.flags['town_' + id] = true
    s.flags.encounter_steps = 0
    this.rememberWorldPosition(t.door[0], t.door[1])
    if (s.flags.tutorial_step === 2 && id === 'rado') s.flags.tutorial_step = 3
    this.api.banner(t.name)
    playTrack(explorationTrackFor({ screen: 'town', map: s.map, px: s.px, py: s.py }))
  }

  enterRoom(id: string, spawn?: [number, number]) {
    const r = ROOMS.find((x) => x.id === id)!
    buildRoomGrid(r)
    const s = this.s
    s.screen = 'room'
    s.map = id
    s.px = spawn?.[0] ?? r.exit[0]
    s.py = spawn?.[1] ?? r.exit[1] - 1
    s.facing = 1
    s.riding = false
    s.anim = null
    s.inTown = r.town
    const worldPosition = worldPositionForLocation(r.town, 0, 0)
    this.rememberWorldPosition(worldPosition[0], worldPosition[1])
    this.api.banner(r.name)
    playTrack(explorationTrackFor({ screen: 'room', map: s.map, px: s.px, py: s.py }))
  }

  enterCave(id: string, spawn?: [number, number]) {
    const c = CAVES.find((x) => x.id === id)!
    buildCaveGrid(c)
    const s = this.s
    s.screen = 'cave'
    s.map = id
    const exit = spawn || [c.exits[0].x, c.exits[0].y]
    s.px = exit[0]
    s.py = exit[1]
    s.facing = 2
    s.riding = false
    s.anim = null
    const worldPosition = caveWorldEntrance(id)
    if (worldPosition) this.rememberWorldPosition(worldPosition[0], worldPosition[1])
    this.syncOpenedChests(id)
    this.api.banner(c.name)
    playTrack(explorationTrackFor({ screen: 'cave', map: s.map, px: s.px, py: s.py }))
  }

  syncOpenedChests(caveId: string) {
    const cave = CAVES.find((c) => c.id === caveId)
    if (!cave) return
    const cached = buildCaveGrid(cave)
    const grid = cached.map.map((row) => row.split(''))
    let changed = false
    for (const chest of cave.chests) {
      const tile = this.s.openedChests[this.chestKey(cave.id, chest.x, chest.y)] ? ' ' : 'I'
      if (grid[chest.y][chest.x] !== tile) {
        grid[chest.y][chest.x] = tile
        changed = true
      }
    }
    if (!changed) return
    cached.map = grid.map((row) => row.join(''))
    invalidateMap(cave.id)
  }

  enterWorld(x: number, y: number) {
    const s = this.s
    s.screen = 'world'
    s.map = 'world'
    s.px = x
    s.py = y
    s.anim = null
    s.inTown = null
    const activeTank = this.api.getActiveTank()
    s.riding = !!activeTank && this.api.tankOperational(activeTank)
    this.syncWorldMapPosition()
    playTrack(explorationTrackFor({ screen: 'world', map: s.map, px: s.px, py: s.py }))
    this.syncRegionDiscovery()
  }

  /* ---------------- 移动 ---------------- */
  private currentNpcAt(x: number, y: number) {
    if (this.s.map === 'world') return null
    const town = TOWNS.find((t) => t.id === this.s.map)
    if (town) return town.npcs.find((n) => n.x === x && n.y === y) || null
    const room = ROOMS.find((r) => r.id === this.s.map)
    if (room) return (room.npcs || []).find((n) => n.x === x && n.y === y) || null
    return null
  }

  isWalkable(map: string, x: number, y: number): boolean {
    const ch = this.tileAt(map, x, y)
    if (map === 'world') {
      const t = TILE[ch]
      if (!t || !t.w) return false
      const gate = worldGateAt(x, y)
      if (gate && !worldGateUnlocked(this.s, gate)) return false
      if (ch === 'H' && !this.s.flags.hell_open) return false
      return true
    }
    if (ch === 'B' || ch === '#' || ch === '~' || ch === 'O' || ch === '^') return false
    if (this.currentNpcAt(x, y)) return false
    const room = ROOMS.find((candidate) => candidate.id === map)
    const garageSlot = room?.garageSlots?.findIndex((slot) => slot.x === x && slot.y === y) ?? -1
    if (garageSlot >= 0 && this.s.tanks.some((tank) => tank.garageSlot === garageSlot)) return false
    const town = TOWNS.find((t) => t.id === map)
    if (town && townDecorAt(town, x, y)) return false
    return true
  }

  tryMove(dt: number) {
    const s = this.s
    if (s.anim) {
      const convoyOverweight =
        s.riding &&
        s.party.some((member) => {
          if (!member.id) return false
          const tank = this.api.getTankByMember(member.id)
          return !!tank && this.api.tankOverweight(tank)
        })
      s.anim.t += dt / (convoyOverweight ? 0.22 : 0.13)
      if (s.anim.t >= 1) {
        s.px = s.anim.tx
        s.py = s.anim.ty
        s.anim = null
        this.onArrive()
      }
      return
    }
    const q = poll()
    for (const k of q) {
      if (k === 'up') {
        s.facing = 0
      } else if (k === 'down') {
        s.facing = 1
      } else if (k === 'left') {
        s.facing = 2
      } else if (k === 'right') {
        s.facing = 3
      } else if (k === 'a') {
        this.interact()
        return
      } else if (k === 'b') {
        this.api.openMenu()
        return
      } else if (k === 'm') {
        this.api.sfx('cursor')
      }
    }
    const dirIdx = ['up', 'down', 'left', 'right'].findIndex((k) => isHeld(k))
    if (dirIdx >= 0) {
      const dir = DIRS[dirIdx]
      const tx = s.px + dir[0]
      const ty = s.py + dir[1]
      const gate = s.map === 'world' ? worldGateAt(tx, ty) : null
      if (gate && this.handleWorldGate(gate)) return
      if (this.isWalkable(s.map, tx, ty)) {
        s.anim = { fx: s.px, fy: s.py, tx, ty, t: 0 }
      }
    }
  }

  private handleWorldGate(gate: NonNullable<ReturnType<typeof worldGateAt>>): boolean {
    if (worldGateUnlocked(this.s, gate)) {
      if (!this.s.flags[gate.unlockFlag]) {
        this.s.flags[gate.unlockFlag] = true
        this.api.banner(`${gate.name}已开放`)
        this.api.sfx('confirm')
      }
      return false
    }
    if (gate.battle) {
      this.api.say(gate.lockedText, () => {
        this.api.startBattle(gate.battle!.mobs, {
          boss: true,
          guard: true,
          completionFlag: gate.unlockFlag,
          completionMessage: gate.battle!.completionMessage,
          text: gate.battle!.text
        })
      })
      return true
    }
    this.api.say(gate.lockedText)
    this.api.sfx('cancel')
    return true
  }

  private onArrive() {
    const s = this.s
    const ch = this.tileAt(s.map, s.px, s.py)
    if (s.map === 'world') {
      this.syncRegionDiscovery()
      playTrack(explorationTrackFor({ screen: 'world', map: s.map, px: s.px, py: s.py }))
      if (ch === 'D') {
        const town = TOWNS.find((t) => t.door[0] === s.px && t.door[1] === s.py)
        if (town) {
          this.enterTown(town.id)
          return
        }
      }
      if (ch === 'C') {
        const cave = CAVES.find(
          (c) =>
            c.exits[0] &&
            c.exits[0].world &&
            c.exits[0].world[0] === s.px &&
            c.exits[0].world[1] === s.py
        )
        if (cave) {
          this.enterCave(cave.id)
          return
        }
      }
      if (ch === 'N') {
        if (!s.flags.hell_open) {
          this.api.say(['诺亚大楼的大门紧闭着。', '恐怕只有通过地狱门才能抵达那里。'])
          return
        }
        this.enterCave('noa1')
        return
      }
      if (ch === 'H') {
        if (!s.flags.hell_open) {
          this.api.say(['地狱门的终端发出幽光。', '需要输入密码才能通过……'])
        }
        return
      }
      if (ch !== 't' && ch !== 'D' && ch !== 'G') this.tryEncounter()
    } else if (CAVES.some((cave) => cave.id === s.map)) {
      if (ch === 'I') this.openChestAt(s.px, s.py)
      else if (ch === 'X') this.caveEventAt(s.px, s.py)
      else if (ch === 'E') this.caveExitAt(s.px, s.py)
      else this.tryEncounter()
    }
    const town = TOWNS.find((t) => t.id === s.map)
    if (town) {
      const g = buildTownGrid(town)
      if (s.px === g.exit[0] && s.py === g.exit[1]) {
        this.enterWorld(town.door[0], town.door[1])
        return
      }
      const b = town.buildings.find((b) => b.door[0] === s.px && b.door[1] === s.py)
      if (b) {
        this.enterBuilding(b)
        return
      }
    }
    const room = ROOMS.find((r) => r.id === s.map)
    if (room && ch === 'E') {
      if (room.exitTarget) {
        this.enterRoom(room.exitTarget, room.exitSpawn)
        return
      }
      const t = TOWNS.find((x) => x.id === room.town)
      if (!t) return
      s.screen = 'town'
      s.map = room.town
      s.px = room.door[0]
      s.py = room.door[1]
      s.anim = null
      s.inTown = room.town
      this.api.banner(t.name)
      playTrack(explorationTrackFor({ screen: 'town', map: s.map, px: s.px, py: s.py }))
      return
    }
  }

  private facingTile(): [number, number] {
    const d = DIRS[this.s.facing]
    return [this.s.px + d[0], this.s.py + d[1]]
  }

  private interact() {
    const s = this.s
    if (s.anim) return
    if (s.map === 'world') {
      const [x, y] = this.facingTile()
      const ch = this.tileAt('world', x, y)
      const gate = worldGateAt(x, y)
      if (gate) {
        if (!this.handleWorldGate(gate)) {
          this.api.say([`${gate.name}已经开放，路障被推到了道路两侧。`])
        }
        return
      }
      if (ch === 'H') {
        this.api.openPassword()
        return
      }
      return
    }
    const town = TOWNS.find((t) => t.id === s.map)
    if (town) {
      const [x, y] = this.facingTile()
      const npc = town.npcs.find((n) => n.x === x && n.y === y)
      if (npc) {
        this.talkNpc(npc)
        return
      }
      const b = town.buildings.find((b) => b.door[0] === x && b.door[1] === y)
      if (b) {
        this.enterBuilding(b)
        return
      }
      return
    }
    const room = ROOMS.find((r) => r.id === s.map)
    if (room) {
      const [x, y] = this.facingTile()
      const npc = (room.npcs || []).find((n) => n.x === x && n.y === y)
      if (npc) {
        if (room.service) {
          const lines = DIALOGUE[npc.talk] || ['需要些什么？']
          this.api.say([npc.name + '：' + lines[0], ...lines.slice(1)], () => {
            this.api.openShop(room.service!, { name: room.name })
          })
        } else this.talkNpc(npc)
        return
      }
      const garageSlot = room.garageSlots?.findIndex((slot) => slot.x === x && slot.y === y) ?? -1
      if (garageSlot >= 0) {
        this.api.openGarageSlot(garageSlot)
        return
      }
      const furniture = (room.furniture || []).find(
        (f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h
      )
      const link = room.links?.find((item) => item.x === x && item.y === y)
      if (link) {
        this.enterRoom(link.target, link.spawn)
        return
      }
      if (room.rest && furniture?.t === 'bed') {
        this.restAtHome()
        return
      }
      if (furniture?.t === 'garageconsole') {
        const occupied = new Set(
          this.s.tanks
            .map((tank) => tank.garageSlot)
            .filter((slot): slot is number => Number.isInteger(slot))
        ).size
        this.api.say([
          `地下战车库：${occupied}/8 个车位已占用。`,
          '请走到具体车位旁确认。空位可停入随队战车，已有车辆的车位可办理出库或原位交换。',
          '右墙货运升降台负责将待命战车送往镇街，人员请走楼梯。'
        ])
        return
      }
      return
    }
    const [x, y] = this.facingTile()
    const ch = this.tileAt(s.map, x, y)
    if (ch === 'I') {
      s.px = x
      s.py = y
      this.openChestAt(x, y)
    } else if (ch === 'X') {
      s.px = x
      s.py = y
      this.caveEventAt(x, y)
    } else if (ch === 'E') {
      s.px = x
      s.py = y
      this.caveExitAt(x, y)
    }
  }

  private caveExitAt(x: number, y: number) {
    const c = CAVES.find((c) => c.id === this.s.map)
    if (!c) return
    const ex = c.exits.find((e) => e.x === x && e.y === y)
    if (!ex) return
    if (ex.next) {
      const target = CAVES.find((cave) => cave.id === ex.next)
      const arrival = target?.exits.find((targetExit) => targetExit.prev === c.id)
      this.enterCave(ex.next, arrival ? [arrival.x, arrival.y] : undefined)
      return
    }
    if (ex.prev) {
      const target = CAVES.find((cave) => cave.id === ex.prev)
      const arrival = target?.exits.find((targetExit) => targetExit.next === c.id)
      this.enterCave(ex.prev, arrival ? [arrival.x, arrival.y] : undefined)
      return
    }
    if (ex.world) {
      this.enterWorld(ex.world[0], ex.world[1])
      return
    }
  }

  private caveEventAt(x: number, y: number) {
    const c = CAVES.find((c) => c.id === this.s.map)
    if (!c) return
    const ev = c.events.find((e) => e.x === x && e.y === y)
    if (!ev) return
    if (ev.type === 'tank') {
      const tank = TANKS_DEF.find((t) => t.id === ev.tankId)
      if (!tank) return
      if (this.s.tanks.some((t) => t.tankId === ev.tankId)) {
        this.api.say(['这里已经空空如也。'])
        return
      }
      this.api.addTank(ev.tankId!)
      const acquired = this.s.tanks.find((item) => item.tankId === ev.tankId)
      if (ev.tankId === 't1') {
        if (acquired) {
          acquired.sp = 330
          acquired.armor = 80
          acquired.ammo.main = 6
          acquired.ammo.se = 2
          acquired.condition.sub = 'damaged'
        }
        this.s.flags.tutorial_step = 2
      }
      const hasDriver = this.s.party.some(
        (member) => member.id && member.tankId === acquired?.tankId
      )
      if (acquired && hasDriver && this.api.tankOperational(acquired)) {
        this.s.riding = true
        this.s.flags.encounter_steps = 0
      }
      this.api.say([
        '你发现了『' + tank.name + '』！',
        ev.tankId === 't1'
          ? '底盘还能启动，但装甲不足、副炮小破，炮弹也所剩不多。'
          : '这辆战车虽然老旧，但还能开！',
        hasDriver
          ? '（你进入战车；现在可以驾驶它撤离。）'
          : '（没有空闲驾驶员，拖车会把它送回拉多车库。）'
      ])
      this.api.sfx('confirm')
      return
    }
    if (ev.type === 'guard') {
      const completionFlag = c.id + '_guard_done'
      if (this.s.flags[completionFlag]) {
        this.api.say(['被击毁的守卫已经无法行动。'])
        return
      }
      this.api.startBattle([ev.mob || 'robot', ev.mob || 'robot'], {
        boss: true,
        guard: true,
        completionFlag,
        text: ev.text || '守卫战车挡住了去路！'
      })
      return
    }
    if (ev.type === 'boss') {
      const b = BOUNTIES.find((b) => b.id === ev.bountyId)
      if (ev.bountyId === 'noa') {
        if (this.s.flags.noa_dead) {
          this.api.say(['主电脑已经停止运转。'])
          return
        }
        this.api.startBountyBattle('noa', { final: true })
      } else if (ev.bountyId === 'noa_guard') {
        if (this.s.flags.noa1_done) {
          this.api.say(['防御机器人已经停止运转。'])
          return
        }
        this.api.startBattle(['guard_bot', 'guard_bot'], {
          boss: true,
          completionFlag: 'noa1_done',
          text: ev.text
        })
      } else if (ev.bountyId === 'noa_laser') {
        if (this.s.flags.noa2_done) {
          this.api.say(['激光防御系统已经关闭。'])
          return
        }
        this.api.startBattle(['laser', 'laser'], {
          boss: true,
          completionFlag: 'noa2_done',
          text: ev.text
        })
      } else if (b) {
        if (this.s.bounties.killed[b.id]) {
          this.api.say(['这里已经没有赏金首的踪迹。'])
          return
        }
        this.api.startBountyBattle(b.id, { text: ev.text })
      }
      return
    }
  }

  private openChestAt(x: number, y: number) {
    const c = CAVES.find((c) => c.id === this.s.map)
    const chest = c && c.chests.find((ch) => ch.x === x && ch.y === y)
    if (!c) return
    const key = this.chestKey(c.id, x, y)
    if (!chest || this.s.openedChests[key]) return
    this.s.openedChests[key] = true
    this.syncOpenedChests(c.id)
    const item = ITEMS[chest.item]
    const part = findPart(chest.item)
    if (item) this.api.addItem(chest.item)
    else if (part) this.api.addPart(chest.item)
    this.api.say(['获得『' + (item ? item.name : part ? part.name : chest.item) + '』！'])
    this.api.sfx('cash')
  }

  private restAtHome() {
    this.api.beginSleep('home')
  }

  private talkNpc(npc: TownDef['npcs'][number]) {
    if (this.s.map === 'rado_home' && npc.talk === 'rado_home_father') {
      this.runStory('story_rado_father')
      return
    }
    if (npc.talk.startsWith('story_')) {
      this.runStory(npc.talk)
      return
    }
    const lines = DIALOGUE[npc.talk] || ['……']
    this.api.say([npc.name + '：' + lines[0], ...lines.slice(1)])
  }

  private chestKey(caveId: string, x: number, y: number) {
    return `${caveId}:${x},${y}`
  }

  private enterBuilding(b: TownDef['buildings'][number]) {
    this.api.sfx('confirm')
    if (b.roomId) {
      const room = ROOMS.find((r) => r.id === b.roomId)
      if (room) {
        this.enterRoom(room.id)
        return
      }
      this.api.say(['门后的空间还没有开放。'])
      return
    }
    if (b.type === 'home') {
      this.api.say(['门锁着。'])
      return
    }
    switch (b.type) {
      case 'weapon':
      case 'tankshop':
      case 'modshop':
      case 'inn':
      case 'bounty':
        this.api.openShop(b.type === 'tankshop' ? 'tank' : b.type === 'modshop' ? 'mod' : b.type, b)
        break
      case 'house':
        this.api.say(['门锁着。'])
        break
      case 'story':
        this.runStory(b.story || '')
        break
    }
  }

  /* ---------------- 遇敌 ---------------- */
  private syncRegionDiscovery() {
    const s = this.s
    if (s.map !== 'world') return
    this.syncWorldMapPosition()
    const region = regionAtWorld(s.px, s.py)
    const currentKey = 'region_current'
    const previous = typeof s.flags[currentKey] === 'string' ? s.flags[currentKey] : null
    const discoveredKey = `region_${region.id}`
    const firstVisit = !s.flags[discoveredKey]
    s.flags[currentKey] = region.id
    s.flags[discoveredKey] = true
    if (previous === region.id) return
    const prefix = firstVisit ? '发现区域' : '进入区域'
    this.api.banner(
      `${prefix}：${region.name}  ${dangerPips(region)}  ${recommendedLevelLabel(region)}  ${vehicleRecommendationLabel(region)}`
    )
  }

  private tryEncounter() {
    const s = this.s
    if (s.anim || s.flags.no_encounter) return
    if (!s.tanks.length) return
    let region
    let baseRate: number
    let road = false
    let cave = false
    if (s.map === 'world') {
      const ch = WORLD[s.py][s.px]
      region = regionAtWorld(s.px, s.py)
      baseRate = region.encounterRate ?? 0.075 * (TILE[ch].enc || 1)
      road = ch === 'r' || ch === 'G' || ch === 'F'
    } else {
      const c = CAVES.find((c) => c.id === s.map)!
      region = REGIONS.find((r) => r.id === c.region) || REGIONS[0]
      baseRate = region.encounterRate ?? 0.055
      cave = true
    }
    const previousSteps = typeof s.flags.encounter_steps === 'number' ? s.flags.encounter_steps : 0
    const pacing = advanceEncounterPacing(previousSteps, baseRate, {
      cave,
      road,
      safeZone: !!region.safeZone
    })
    s.flags.encounter_steps = pacing.steps
    if (!encounterTriggers(pacing, Math.random())) return
    s.flags.encounter_steps = 0
    const unkilled = BOUNTIES.filter(
      (b) => BOUNTY_REGION[b.id] === region.id && !s.bounties.killed[b.id]
    )
    if (unkilled.length && chance(0.09)) {
      this.api.startBountyBattle(unkilled[0].id)
      return
    }
    const count = ri(1, region.maxGroup ?? (region.id === 'rado' ? 2 : 3))
    const mobs: string[] = []
    for (let i = 0; i < count; i++) mobs.push(choice(region.mobs))
    this.api.startBattle(mobs, {})
  }

  /* ---------------- 剧情事件 ---------------- */
  runStory(id: string) {
    if (this.events.run(id)) return
    const stories: Record<string, () => void> = {
      story_pobb_wolf: () => {
        const s = this.s
        const f = s.flags
        if (s.party[2].id) {
          this.api.say(['红狼：哼，干得不错。'])
          return
        }
        if (f.wolf_met) {
          this.api.say(['红狼：还愣着干什么？水怪等着你呢。'])
          return
        }
        if (s.bounties.killed.water) {
          f.wolf_met = true
          const level = recruitWithCatchUp(s.party[2], s.party)
          this.api.say([
            '红狼：……居然比我先一步。',
            '红狼：有意思。小子，我跟你同行一阵。',
            `（红狼 Lv.${level} 加入了队伍！）`
          ])
          this.api.sfx('levelup')
        } else {
          this.api.say([
            '红狼：小子，你就是新来的猎人？',
            '红狼：波布镇南边的湖里有水怪作乱。',
            '红狼：有胆量的话，先去讨伐它再说。'
          ])
        }
      },
      rock_hospital: () => {
        const s = this.s
        if (s.bounties.killed.marshal) {
          this.api.say(['医院里空无一人。马歇尔已经倒下了。'])
          return
        }
        if (s.flags.marshal_fight) {
          this.api.say(['马歇尔：还没打够？再来！'])
          this.api.startBountyBattle('marshal', { text: '马歇尔从阴影中现身！' })
          return
        }
        s.flags.marshal_fight = true
        this.api.say(['医院深处传来咆哮声。', '（你推开了锈迹斑斑的铁门……）'])
        this.api.startBountyBattle('marshal', { text: '马歇尔从阴影中现身！' })
      },
      tarr_gomez: () => {
        const s = this.s
        if (s.bounties.killed.gomez) {
          this.api.say(['藏身处一片狼藉。戈麦斯已经不在了。'])
          return
        }
        if (!s.flags.gomez_fight) {
          s.flags.gomez_fight = true
          if (s.party[2].id === 'wolf') {
            this.api.say([
              '红狼：……终于等到这一天了。',
              '红狼：小子，这是我自己的战斗。',
              '红狼：如果我输了，红狼战车就拜托你了。',
              '（红狼独自走进了藏身处。你紧随其后……）'
            ])
          } else {
            this.api.say(['藏身处大门轰然打开。', '（戈麦斯的身影出现在阴影中……）'])
          }
          this.api.startBountyBattle('gomez', { text: '戈麦斯：杂碎，来送死了吗！' })
          return
        }
        this.api.say(['藏身处大门紧闭。里面传来引擎的轰鸣。'])
      }
    }
    if (stories[id]) stories[id]()
  }
}

import { ITEMS, TANKS as TANKS_DEF, findPart } from '@/game/data/equipment'
import { poll, isHeld } from '@/game/engine/input'
