import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { ACTOR_ASSETS } from '@/game/assets'
import { TANKS as TANK_DEFS } from '@/game/data/equipment'
import { CAVES, ROOMS, TOWNS, WORLD_H, WORLD_W } from '@/game/data/maps'
import {
  DECOR_BLOCK,
  TS,
  drawBuilding,
  drawDecor,
  drawFurniture,
  drawTownTile,
  hash,
  townDecor
} from '@/game/engine/tileart'
import { bakeMap, TOWN_GROUND_SEED } from '@/game/engine/map-baker'
import { overworldTankVisualFor } from '@/game/assets/tanks'
import type { GameState, RoomDef, TankState } from '@/game/types'
import { WORLD_GATES, worldGateUnlocked } from '@/game/systems/world-gates'
import { TankActor } from '@/game/pixi/TankActor'
import { pixiAssets } from '@/game/pixi/assets'
import {
  BASE_TILE_SIZE,
  canvasTexture,
  clamp,
  createCanvas,
  mapSize,
  movingPosition
} from '@/game/pixi/helpers'
import type { WeatherPresentation } from '@/game/pixi/WeatherLayer'
import {
  explorationTileSize,
  townBackdropMarginTiles,
  type ExplorationMapKind
} from '@/game/pixi/layout'

const EXPLORATION_SCREENS = new Set(['world', 'town', 'cave', 'room', 'menu', 'shop', 'password'])

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

function actorTexture(spriteId: string, facing = 1, frame = 1): Texture {
  const asset = ACTOR_ASSETS[spriteId] || ACTOR_ASSETS.npc_m
  const direction = ['up', 'down', 'left', 'right'][facing] || 'down'
  return pixiAssets.texture(asset.atlas, `${asset.sprite}/${direction}/${frame}`)
}

function leadTank(state: GameState): TankState | null {
  if (!state.riding) return null
  const partyTankIds = new Set(
    state.party
      .filter((member) => member.id && member.id !== state.hunt?.memberId)
      .map((member) => member.tankId)
      .filter((tankId): tankId is string => !!tankId)
  )
  const leadTankId = state.party.find(
    (member) => member.id && member.id !== state.hunt?.memberId
  )?.tankId
  const convoy = state.tanks.filter(
    (tank) =>
      tank.garageSlot === null &&
      tank.tankId !== state.hunt?.tankId &&
      partyTankIds.has(tank.tankId)
  )
  return (
    convoy.find((tank) => tank.tankId === leadTankId && tank.sp > 0) ||
    convoy.find((tank) => tank.sp > 0) ||
    convoy[0] ||
    null
  )
}

function roomGarageSignature(state: GameState, room: RoomDef | undefined): string {
  if (!room?.garageSlots?.length) return ''
  return state.tanks
    .filter((tank) => tank.garageSlot !== null)
    .map((tank) => `${tank.garageSlot}:${tank.tankId}:${tank.sp}`)
    .sort()
    .join('|')
}

export class ExplorationScene extends Container {
  private backdrop = new Graphics()
  private world = new Container()
  private player = new Sprite(Texture.EMPTY)
  private playerTank = new TankActor()
  private gateLayer = new Container()
  private townBackdrop: Sprite | null = null
  private gateGraphics = new Map<string, Graphics>()
  private mapTextures = new Map<string, Texture>()
  private generatedTextures: Texture[] = []
  private sceneKey = ''
  private mapId = ''
  private mapWidth = WORLD_W
  private mapHeight = WORLD_H
  private screenWidth = 1
  private screenHeight = 1
  private cameraX = 0
  private cameraY = 0
  private cameraReady = false

  constructor() {
    super()
    this.eventMode = 'none'
    this.world.sortableChildren = true
    this.player.anchor.set(0.5, 1)
    this.player.scale.set(2)
    this.player.zIndex = 100
    this.playerTank.zIndex = 100
    this.gateLayer.zIndex = 20
    this.addChild(this.backdrop, this.world)
  }

  resize(width: number, height: number) {
    const changed = width !== this.screenWidth || height !== this.screenHeight
    this.screenWidth = Math.max(1, width)
    this.screenHeight = Math.max(1, height)
    if (changed && this.townBackdrop) this.sceneKey = ''
    this.paintBackdrop()
  }

  supports(state: GameState): boolean {
    return EXPLORATION_SCREENS.has(state.screen)
  }

  update(state: GameState, dt: number): WeatherPresentation {
    const room = ROOMS.find((item) => item.id === state.map)
    const key = `${state.map}|${roomGarageSignature(state, room)}`
    const mapChanged = key !== this.sceneKey
    if (mapChanged) this.rebuild(state, key)

    const tileSize = this.tileSize(state.map)
    const scale = tileSize / BASE_TILE_SIZE
    this.world.scale.set(scale)

    const position = movingPosition(state)
    const footX = position.x * BASE_TILE_SIZE + BASE_TILE_SIZE / 2
    const footY = position.y * BASE_TILE_SIZE + BASE_TILE_SIZE
    this.updatePlayer(state, footX, footY)
    this.updateGates(state)

    const scaledMapWidth = this.mapWidth * BASE_TILE_SIZE * scale
    const scaledMapHeight = this.mapHeight * BASE_TILE_SIZE * scale
    const focusWorldX = footX * scale
    const focusWorldY = (footY - BASE_TILE_SIZE * 0.46) * scale
    const targetCameraX =
      scaledMapWidth <= this.screenWidth
        ? -(this.screenWidth - scaledMapWidth) / 2
        : clamp(focusWorldX - this.screenWidth / 2, 0, scaledMapWidth - this.screenWidth)
    const targetCameraY =
      scaledMapHeight <= this.screenHeight
        ? -(this.screenHeight - scaledMapHeight) / 2
        : clamp(focusWorldY - this.screenHeight * 0.52, 0, scaledMapHeight - this.screenHeight)

    if (!this.cameraReady || mapChanged) {
      this.cameraX = targetCameraX
      this.cameraY = targetCameraY
      this.cameraReady = true
    } else {
      const ease = 1 - Math.exp(-Math.max(0, dt) * 11)
      this.cameraX += (targetCameraX - this.cameraX) * ease
      this.cameraY += (targetCameraY - this.cameraY) * ease
    }
    this.world.position.set(Math.round(-this.cameraX), Math.round(-this.cameraY))

    const outdoors = state.map === 'world' || TOWNS.some((town) => town.id === state.map)
    return {
      outdoors,
      focusX: focusWorldX - this.cameraX,
      focusY: focusWorldY - this.cameraY,
      groundY: footY * scale - this.cameraY
    }
  }

  private tileSize(mapId: string): number {
    const kind: ExplorationMapKind =
      mapId === 'world'
        ? 'world'
        : ROOMS.some((item) => item.id === mapId)
          ? 'room'
          : CAVES.some((item) => item.id === mapId)
            ? 'cave'
            : 'town'
    return explorationTileSize({
      viewportWidth: this.screenWidth,
      viewportHeight: this.screenHeight,
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      kind
    })
  }

  private paintBackdrop() {
    const color =
      this.mapId === 'world'
        ? 0x18251d
        : CAVES.some((item) => item.id === this.mapId)
          ? 0x111522
          : ROOMS.some((item) => item.id === this.mapId)
            ? 0x241c19
            : 0x3b332b
    this.backdrop.clear().rect(0, 0, this.screenWidth, this.screenHeight).fill(color)
  }

  private rebuild(state: GameState, key: string) {
    this.sceneKey = key
    this.mapId = state.map
    ;[this.mapWidth, this.mapHeight] = mapSize(state.map)
    this.cameraReady = false
    this.paintBackdrop()
    for (const child of this.world.removeChildren()) {
      if (child !== this.player && child !== this.playerTank && child !== this.gateLayer) {
        child.destroy({ children: true })
      }
    }
    for (const child of this.gateLayer.removeChildren()) child.destroy({ children: true })
    for (const texture of this.generatedTextures) texture.destroy(true)
    this.generatedTextures = []
    this.gateGraphics.clear()
    this.townBackdrop = null

    let texture = this.mapTextures.get(state.map)
    if (!texture) {
      texture = canvasTexture(bakeMap(state.map, { includeStructures: false }))
      this.mapTextures.set(state.map, texture)
    }
    const mapSprite = new Sprite(texture)
    mapSprite.zIndex = 0

    const town = TOWNS.find((item) => item.id === state.map)
    const room = ROOMS.find((item) => item.id === state.map)
    if (town) this.addTownBackdrop(town)
    this.world.addChild(mapSprite, this.gateLayer)
    for (const npc of town?.npcs || room?.npcs || []) this.addNpc(npc)
    if (town) {
      this.addTownBuildings(town)
      this.addTownProps(town)
    }
    if (room) this.addRoomProps(room, state)
    if (state.map === 'world') this.addWorldGates()

    this.world.addChild(this.player, this.playerTank)
  }

  private addTownBackdrop(town: (typeof TOWNS)[number]) {
    const [townWidth, townHeight] = town.size
    const tilePixels = this.tileSize(town.id)
    const marginX = townBackdropMarginTiles(this.screenWidth, townWidth, tilePixels)
    const marginY = townBackdropMarginTiles(this.screenHeight, townHeight, tilePixels)
    const { canvas, context } = createCanvas(
      (townWidth + marginX * 2) * TS,
      (townHeight + marginY * 2) * TS
    )
    const emptyNeighbors = {
      N: ' ',
      S: ' ',
      E: ' ',
      W: ' ',
      NE: ' ',
      NW: ' ',
      SE: ' ',
      SW: ' '
    }
    context.save()
    context.translate(marginX * TS, marginY * TS)
    for (let y = -marginY; y < townHeight + marginY; y++) {
      for (let x = -marginX; x < townWidth + marginX; x++) {
        drawTownTile(
          {
            ctx: context,
            x,
            y,
            h: hash(x, y, TOWN_GROUND_SEED),
            n: emptyNeighbors
          },
          ' ',
          town
        )
      }
    }
    context.restore()
    const texture = canvasTexture(canvas)
    this.generatedTextures.push(texture)
    this.townBackdrop = new Sprite(texture)
    this.townBackdrop.position.set(-marginX * TS, -marginY * TS)
    this.townBackdrop.zIndex = -10
    this.world.addChild(this.townBackdrop)
  }

  private addNpc(npc: { x: number; y: number; sp: string }) {
    const sprite = new Sprite(actorTexture(npc.sp))
    sprite.anchor.set(0.5, 1)
    sprite.scale.set(2)
    sprite.position.set(npc.x * TS + TS / 2, npc.y * TS + TS)
    sprite.zIndex = npc.y * TS + TS
    this.world.addChild(sprite)
  }

  private addTownBuildings(town: (typeof TOWNS)[number]) {
    for (const building of town.buildings) {
      const paddingLeft = 18
      const paddingTop = 18
      const paddingRight = 34
      const paddingBottom = 22
      const width = building.w * TS + paddingLeft + paddingRight
      const height = building.h * TS + paddingTop + paddingBottom
      const cameraX = building.x * TS - paddingLeft
      const cameraY = building.y * TS - paddingTop
      const { canvas, context } = createCanvas(width, height)
      context.save()
      context.translate(-cameraX, -cameraY)
      drawBuilding(context, building, hash(building.x, building.y, 202), town.id)
      context.restore()
      const texture = canvasTexture(canvas)
      this.generatedTextures.push(texture)
      const sprite = new Sprite(texture)
      sprite.position.set(cameraX, cameraY)
      sprite.zIndex = (building.y + building.h) * TS - 1
      this.world.addChild(sprite)
    }
  }

  private addTownProps(town: (typeof TOWNS)[number]) {
    const decors = [...townDecor(town), ...(town.decor || [])]
    for (const decor of decors) {
      if (!DECOR_BLOCK.has(decor.t)) continue
      const padding = TS * 2
      const { canvas, context } = createCanvas(TS * 5, TS * 6)
      const cameraX = decor.x * TS - padding
      const cameraY = decor.y * TS - padding
      drawDecor(
        context,
        decor.t,
        decor.x,
        decor.y,
        hash(decor.x, decor.y, 303),
        cameraX,
        cameraY,
        town.id
      )
      const texture = canvasTexture(canvas)
      this.generatedTextures.push(texture)
      const sprite = new Sprite(texture)
      sprite.position.set(cameraX, cameraY)
      sprite.zIndex = (decor.y + 1) * TS
      this.world.addChild(sprite)
    }
  }

  private addRoomProps(room: RoomDef, state: GameState) {
    for (const furniture of room.furniture || []) {
      if (!ROOM_ENTITY_TYPES.has(furniture.t)) continue
      const padding = TS
      const { canvas, context } = createCanvas((furniture.w + 2) * TS, (furniture.h + 3) * TS)
      const cameraX = furniture.x * TS - padding
      const cameraY = furniture.y * TS - padding
      drawFurniture(
        context,
        furniture,
        hash(furniture.x, furniture.y, 606),
        cameraX,
        cameraY,
        room.town
      )
      const texture = canvasTexture(canvas)
      this.generatedTextures.push(texture)
      const sprite = new Sprite(texture)
      sprite.position.set(cameraX, cameraY)
      sprite.zIndex = (furniture.y + furniture.h) * TS
      this.world.addChild(sprite)
    }

    for (const [index, slot] of (room.garageSlots || []).entries()) {
      const tank = state.tanks.find((candidate) => candidate.garageSlot === index)
      if (!tank) continue
      if (!tank.tankDef) tank.tankDef = TANK_DEFS.find((item) => item.id === tank.tankId)
      const actor = new TankActor()
      actor.sync(tank, slot.facing, false, state.playtime)
      actor.position.set(slot.x * TS + TS / 2, slot.y * TS + TS / 2)
      actor.zIndex = (slot.y + 1) * TS
      this.world.addChild(actor)
    }
  }

  private addWorldGates() {
    for (const gate of WORLD_GATES) {
      const graphic = new Graphics()
      graphic.position.set(gate.position[0] * TS, gate.position[1] * TS)
      graphic.zIndex = gate.position[1] * TS + TS
      this.gateGraphics.set(gate.id, graphic)
      this.gateLayer.addChild(graphic)
    }
  }

  private updateGates(state: GameState) {
    if (state.map !== 'world') return
    for (const gate of WORLD_GATES) {
      const graphic = this.gateGraphics.get(gate.id)
      if (!graphic) continue
      const open = worldGateUnlocked(state, gate)
      graphic
        .clear()
        .rect(4, 4, 4, 4)
        .fill(open ? 0x75c277 : 0xd45d4d)
        .rect(24, 4, 4, 4)
        .fill(open ? 0x75c277 : 0xd45d4d)
      if (!open) {
        graphic
          .rect(7, 14, 19, 5)
          .fill(0x3b2724)
          .rect(9, 14, 3, 2)
          .rect(16, 14, 3, 2)
          .rect(23, 14, 3, 2)
          .fill(0xe2b85f)
      }
    }
  }

  private updatePlayer(state: GameState, footX: number, footY: number) {
    const tank = leadTank(state)
    const walkFrame = state.anim ? Math.min(2, Math.floor(clamp(state.anim.t, 0, 0.999) * 3)) : 1
    this.player.visible = !tank
    this.playerTank.visible = !!tank
    this.player.position.set(footX, footY)
    this.player.zIndex = footY
    if (!tank) {
      this.player.texture = actorTexture('hero', state.facing, walkFrame)
      this.player.y = footY + (state.anim && walkFrame === 1 ? -2 : 0)
      return
    }
    if (!tank.tankDef) tank.tankDef = TANK_DEFS.find((item) => item.id === tank.tankId)
    this.playerTank.position.set(footX, footY - BASE_TILE_SIZE / 2)
    this.playerTank.zIndex = footY
    this.playerTank.sync(tank, state.facing, !!state.anim, state.playtime)
    const visual = overworldTankVisualFor(tank.tankId)
    this.playerTank.scale.set(visual.bodyLength > 26 ? 1.04 : 1)
  }
}
