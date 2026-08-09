import { Container, Graphics } from 'pixi.js'
import type { GameState, WorldMapLocation } from '@/game/types'
import { FIELD_MENU_ITEMS, store } from '@/game/core/store'
import * as input from '@/game/engine/input'
import { BOUNTIES, REGIONS } from '@/game/data/combat'
import { ITEMS, TANKS, findHumanWeapon } from '@/game/data/equipment'
import { WORLD, WORLD_H, WORLD_W } from '@/game/data/maps'
import { xpNeed } from '@/game/data/story'
import { fmtG } from '@/game/utils'
import { HUNT_DURATIONS } from '@/game/systems/hunting'
import { GARAGE_CAPACITY, garageTankAtSlot } from '@/game/systems/garage'
import { maintenanceTimeLabel } from '@/game/systems/maintenance'
import {
  currentRegion,
  dangerPips,
  recommendedLevelLabel,
  regionAtWorld,
  vehicleRecommendationLabel
} from '@/game/systems/regions'
import { isWorldTileExplored } from '@/game/systems/world-map'
import { useSettingsStore } from '@/stores/settings'
import {
  fitText,
  label,
  listWindowRange,
  panel,
  progressBar,
  sectionTitle,
  uiButton,
  uiEdgeFor
} from '@/game/pixi/ui/primitives'
import { UI_COLORS, bodyStyle, displayStyle, utilityStyle } from '@/game/pixi/ui/theme'

type MenuViewRenderer = (
  state: GameState,
  width: number,
  height: number,
  scale: number
) => Container

interface IndexedEntry<T> {
  item: T
  index: number
}

const TERRAIN_COLORS: Record<string, number> = {
  '.': 0x426c45,
  ',': 0x375e3e,
  r: 0x9a825b,
  f: 0x1f4d39,
  m: 0x686e70,
  w: 0x275f78,
  s: 0xa68f57,
  t: 0x79786b,
  D: 0xd0ad5c,
  C: 0x537c7b,
  G: 0x8f5648,
  F: 0x6f8f80,
  H: 0x925b4d,
  N: 0x8a7767
}

const ROOT_DESCRIPTIONS: Record<(typeof FIELD_MENU_ITEMS)[number], string> = {
  状态: '查看队员等级、生命、武器与当前区域威胁。',
  道具: '使用医疗用品与随车维修物资。',
  战车: '切换乘降状态，调整队员与战车的分配。',
  赏金: '查看荒原赏金首的讨伐与领奖状态。',
  记录: '旅途记录需要在宿屋的登记终端完成。',
  设置: '调整音乐、音效与文本显示速度。',
  传送: '前往已经建立坐标信标的城镇。',
  巡猎: '派遣闲置队员执行有风险控制的自动巡猎。',
  装备: '为队员换装已经取得的人类武器。',
  地图: '查看逐瓦片测绘图、已发现地点与区域进度。'
}

function safeScale(scale: number): number {
  return Math.max(0.78, Math.min(1.35, scale || 1))
}

function menuIndex(state: GameState): number {
  return Math.max(0, state.menu?.idx || 0)
}

function back() {
  input.press('b')
}

function openMenuItem(state: GameState, index: number) {
  if (!state.menu) return
  if (state.menu.view !== 'root') state.menu.view = 'root'
  state.menu.idx = index
  store.menuSelect(index)
}

function indexedWindow<T>(items: readonly T[], selected: number, limit: number): IndexedEntry<T>[] {
  if (!items.length || limit <= 0) return []
  const { start, end } = listWindowRange(items.length, selected, limit)
  return items.slice(start, end).map((item, offset) => ({ item, index: start + offset }))
}

function addBackButton(root: Container, width: number, scale: number, onPress = back) {
  const buttonWidth = Math.round(70 * scale)
  const button = uiButton('返回', buttonWidth, Math.round(27 * scale), {
    dense: true,
    value: 'B',
    onPress
  })
  button.position.set(width - buttonWidth - 13 * scale, 6 * scale)
  root.addChild(button)
}

function addHint(root: Container, text: string, width: number, height: number, scale: number) {
  const hint = label(text, width - 15 * scale, height - 22 * scale, utilityStyle(9.5 * scale))
  hint.anchor.set(1, 0)
  fitText(hint, width - 30 * scale)
  root.addChild(hint)
}

function addEmpty(
  root: Container,
  text: string,
  x: number,
  y: number,
  width: number,
  scale: number
) {
  const copy = label(
    text,
    x,
    y,
    bodyStyle(12 * scale, {
      fill: UI_COLORS.muted,
      wordWrap: true,
      wordWrapWidth: width,
      lineHeight: 19 * scale
    })
  )
  root.addChild(copy)
}

function addOverflowIndicator(
  root: Container,
  shown: readonly IndexedEntry<unknown>[],
  total: number,
  x: number,
  y: number,
  width: number,
  scale: number
) {
  if (!shown.length || shown.length >= total) return
  const first = shown[0].index + 1
  const last = shown[shown.length - 1].index + 1
  const buttonSize = Math.max(22, 24 * scale)
  const gap = Math.max(3, 4 * scale)
  const buttonsWidth = buttonSize * 2 + gap
  const copy = label(
    `${first}-${last} / ${total}`,
    x + width - buttonsWidth - 7 * scale,
    y,
    utilityStyle(8.5 * scale)
  )
  copy.anchor.set(1, 0)
  const previous = uiButton('▲', buttonSize, buttonSize, {
    dense: true,
    onPress: () => input.press('up')
  })
  const next = uiButton('▼', buttonSize, buttonSize, {
    dense: true,
    onPress: () => input.press('down')
  })
  previous.position.set(x + width - buttonsWidth, y - 10 * scale)
  next.position.set(previous.x + buttonSize + gap, previous.y)
  root.addChild(copy, previous, next)
}

function renderNavigation(
  state: GameState,
  width: number,
  height: number,
  scale: number
): Container {
  const root = panel(width, height, {
    title: '车载终端',
    accent: UI_COLORS.brass,
    label: 'MENU'
  })
  const selected = menuIndex(state) % FIELD_MENU_ITEMS.length
  const top = 43 * scale
  const footer = 28 * scale
  const rowHeight = Math.max(
    24,
    Math.min(39 * scale, (height - top - footer) / FIELD_MENU_ITEMS.length)
  )
  FIELD_MENU_ITEMS.forEach((item, index) => {
    const button = uiButton(item, width - 18 * scale, rowHeight, {
      active: state.menu?.view === 'root' && selected === index,
      dense: rowHeight < 35,
      value: String(index + 1).padStart(2, '0'),
      onPress: () => openMenuItem(state, index)
    })
    button.position.set(9 * scale, top + index * rowHeight)
    root.addChild(button)
  })
  const close = uiButton('关闭', width - 18 * scale, Math.max(22, footer - 5 * scale), {
    dense: true,
    value: 'B',
    onPress: back
  })
  close.position.set(9 * scale, height - footer + 1 * scale)
  root.addChild(close)
  return root
}

function workspace(width: number, height: number, title: string, code: string, scale: number) {
  const root = panel(width, height, {
    title,
    accent: UI_COLORS.info,
    label: code
  })
  addBackButton(root, width, scale)
  return root
}

function renderRoot(state: GameState, width: number, height: number, scale: number): Container {
  const root = panel(width, height, {
    title: '荒原行军终端',
    accent: UI_COLORS.brass,
    label: 'READY'
  })
  const selected = FIELD_MENU_ITEMS[menuIndex(state) % FIELD_MENU_ITEMS.length]
  const pad = 18 * scale
  const headline = label(
    selected,
    pad,
    55 * scale,
    displayStyle(27 * scale, {
      fill: UI_COLORS.brassLight
    })
  )
  fitText(headline, width - pad * 2)
  root.addChild(headline)

  const description = label(
    ROOT_DESCRIPTIONS[selected],
    pad,
    94 * scale,
    bodyStyle(12.5 * scale, {
      fill: UI_COLORS.text,
      wordWrap: true,
      wordWrapWidth: width - pad * 2,
      lineHeight: 20 * scale
    })
  )
  root.addChild(description)

  const dividerY = Math.min(height * 0.38, 154 * scale)
  const divider = sectionTitle('当前行军数据', width - pad * 2)
  divider.position.set(pad, dividerY)
  root.addChild(divider)

  const region = currentRegion(state)
  const activeTank = store.getActiveTank()
  const tankDef = activeTank ? TANKS.find((tank) => tank.id === activeTank.tankId) : null
  const lines = [
    ['资金', `${fmtG(state.gold)} G`],
    ['队伍', `${state.party.filter((member) => member.id).length} 人`],
    ['区域', region?.name || '室内'],
    ['威胁', region ? `${dangerPips(region)}  ${recommendedLevelLabel(region)}` : '安全'],
    ['载具', state.riding && tankDef ? tankDef.name : '徒步']
  ]
  const rowsTop = dividerY + 29 * scale
  const rowHeight = Math.max(
    25,
    Math.min(37 * scale, (height - rowsTop - 70 * scale) / lines.length)
  )
  lines.forEach(([name, value], index) => {
    const y = rowsTop + index * rowHeight
    root.addChild(
      new Graphics()
        .moveTo(pad, y + rowHeight - 2)
        .lineTo(width - pad, y + rowHeight - 2)
        .stroke({ color: UI_COLORS.steelDark, width: 1, alpha: 0.7 })
    )
    const key = label(name, pad, y + 5 * scale, utilityStyle(10 * scale))
    const val = label(
      value,
      width - pad,
      y + 4 * scale,
      bodyStyle(11.5 * scale, {
        fill:
          name === '威胁' && region && region.dangerLevel >= 4 ? UI_COLORS.warning : UI_COLORS.text,
        align: 'right'
      })
    )
    val.anchor.set(1, 0)
    fitText(val, width - pad * 2 - 70 * scale)
    root.addChild(key, val)
  })

  const enter = uiButton(`打开 ${selected}`, Math.min(width - pad * 2, 260 * scale), 39 * scale, {
    active: true,
    value: 'A',
    onPress: () => openMenuItem(state, menuIndex(state) % FIELD_MENU_ITEMS.length)
  })
  enter.position.set(pad, height - 53 * scale)
  root.addChild(enter)
  return root
}

function renderStatus(state: GameState, width: number, height: number, scale: number): Container {
  const root = workspace(width, height, '队伍状态', 'STATUS', scale)
  const members = state.party.filter((member) => member.id)
  const pad = 15 * scale
  const top = 48 * scale
  const regionHeight = currentRegion(state) ? Math.min(104 * scale, height * 0.23) : 0
  const available = height - top - regionHeight - 31 * scale
  const memberHeight = Math.max(52, Math.min(90 * scale, available / Math.max(1, members.length)))

  members.forEach((member, index) => {
    const y = top + index * memberHeight
    const weapon = findHumanWeapon(member.weaponId)
    const totalAttack = member.atk + (weapon?.atk || 0)
    const name = label(
      `${member.name}  Lv.${member.lv}`,
      pad,
      y + 3 * scale,
      bodyStyle(13 * scale, {
        fill: UI_COLORS.brassLight
      })
    )
    const hp = label(
      `HP ${member.hp}/${member.maxHp}`,
      width - pad,
      y + 4 * scale,
      utilityStyle(10 * scale, {
        fill: member.hp / Math.max(1, member.maxHp) < 0.3 ? UI_COLORS.warning : UI_COLORS.success,
        align: 'right'
      })
    )
    hp.anchor.set(1, 0)
    root.addChild(name, hp)

    const barWidth = Math.max(70, width - pad * 2)
    const hpBar = progressBar(
      barWidth,
      member.hp / Math.max(1, member.maxHp),
      member.hp / Math.max(1, member.maxHp) < 0.3 ? UI_COLORS.warning : UI_COLORS.success,
      Math.max(5, 6 * scale)
    )
    hpBar.position.set(pad, y + 23 * scale)
    root.addChild(hpBar)
    if (memberHeight >= 66) {
      const stats = label(
        `攻击 ${totalAttack}   防御 ${member.def}   速度 ${member.spd}`,
        pad,
        y + 34 * scale,
        utilityStyle(9.5 * scale)
      )
      const equipment = label(
        `${weapon?.name || '徒手'}   EXP ${member.xp}/${xpNeed(member.lv)}`,
        pad,
        y + 50 * scale,
        utilityStyle(9 * scale, { fill: UI_COLORS.muted })
      )
      fitText(stats, width - pad * 2)
      fitText(equipment, width - pad * 2)
      root.addChild(stats, equipment)
    }
    root.addChild(
      new Graphics()
        .moveTo(pad, y + memberHeight - 3)
        .lineTo(width - pad, y + memberHeight - 3)
        .stroke({ color: UI_COLORS.steelDark, width: 1 })
    )
  })

  const region = currentRegion(state)
  if (region) {
    const y = height - regionHeight - 25 * scale
    const title = sectionTitle('当前区域', width - pad * 2)
    title.position.set(pad, y)
    root.addChild(title)
    const regionName = label(
      region.name,
      pad,
      y + 28 * scale,
      bodyStyle(12 * scale, {
        fill: UI_COLORS.text
      })
    )
    const threat = label(
      `${dangerPips(region)}  ${recommendedLevelLabel(region)}  ${vehicleRecommendationLabel(region)}`,
      width - pad,
      y + 29 * scale,
      utilityStyle(9 * scale, {
        fill: region.dangerLevel >= 4 ? UI_COLORS.warning : UI_COLORS.info,
        align: 'right'
      })
    )
    threat.anchor.set(1, 0)
    fitText(threat, width - pad * 2 - Math.min(100 * scale, width * 0.3))
    const description = label(
      region.description,
      pad,
      y + 49 * scale,
      bodyStyle(9.5 * scale, {
        fill: UI_COLORS.muted,
        wordWrap: true,
        wordWrapWidth: width - pad * 2,
        lineHeight: 14 * scale
      })
    )
    root.addChild(regionName, threat, description)
  }
  addHint(root, 'A / B 返回', width, height, scale)
  return root
}

function renderItems(state: GameState, width: number, height: number, scale: number): Container {
  const root = workspace(width, height, '随身道具', 'CARGO', scale)
  const ids = Object.keys(state.inventory.items).filter((id) => state.inventory.items[id] > 0)
  const pad = 13 * scale
  const top = 47 * scale
  const footer = 30 * scale
  const rowHeight = Math.max(38, 48 * scale)
  const limit = Math.max(1, Math.floor((height - top - footer) / rowHeight))
  const shown = indexedWindow(ids, menuIndex(state), limit)
  shown.forEach(({ item: id, index }, offset) => {
    const definition = ITEMS[id]
    if (!definition) return
    const button = uiButton(definition.name, width - pad * 2, rowHeight - 2 * scale, {
      active: menuIndex(state) === index,
      detail: definition.desc,
      value: `x${state.inventory.items[id]}`,
      onPress: () => store.menuUse(index)
    })
    button.position.set(pad, top + offset * rowHeight)
    root.addChild(button)
  })
  if (!ids.length) addEmpty(root, '物资栏为空。', pad, top + 12 * scale, width - pad * 2, scale)
  addOverflowIndicator(
    root,
    shown,
    ids.length,
    pad,
    height - footer - 12 * scale,
    width - pad * 2,
    scale
  )
  addHint(root, 'A 使用 · B 返回', width, height, scale)
  return root
}

function tankName(tankId: string | null): string {
  return tankId ? TANKS.find((tank) => tank.id === tankId)?.name || tankId : '徒步'
}

function renderTanks(state: GameState, width: number, height: number, scale: number): Container {
  const root = workspace(width, height, '战车编组', 'CONVOY', scale)
  const members = state.party.filter((member) => member.id)
  const pad = 13 * scale
  const top = 47 * scale
  const rowHeight = Math.max(40, 49 * scale)
  const options = [
    {
      name: state.riding ? '乘坐中 · 切换为徒步' : '徒步中 · 尝试乘车',
      detail: '队长当前行动方式'
    },
    ...members.map((member) => ({
      name: member.name,
      detail: `${tankName(member.tankId)}${member.id === state.hunt?.memberId ? ' · 巡猎中' : ''}`
    })),
    { name: '返回主菜单', detail: '关闭战车编组面板' }
  ]
  const limit = Math.max(1, Math.floor((height - top - 30 * scale) / rowHeight))
  const shown = indexedWindow(options, menuIndex(state), limit)
  shown.forEach(({ item, index }, offset) => {
    const button = uiButton(item.name, width - pad * 2, rowHeight - 2 * scale, {
      active: menuIndex(state) === index,
      detail: item.detail,
      value: index === 0 ? (state.riding ? 'RIDE' : 'FOOT') : undefined,
      onPress: () => store.menuUse(index)
    })
    button.position.set(pad, top + offset * rowHeight)
    root.addChild(button)
  })
  addOverflowIndicator(
    root,
    shown,
    options.length,
    pad,
    height - 41 * scale,
    width - pad * 2,
    scale
  )
  addHint(root, 'A 确认 · B 返回', width, height, scale)
  return root
}

function renderTankAssignment(
  state: GameState,
  width: number,
  height: number,
  scale: number
): Container {
  const root = workspace(
    width,
    height,
    `${state.menu?.assignMember || '队员'} · 座驾`,
    'ASSIGN',
    scale
  )
  const choices = store.tankAssignmentChoicesForUi()
  const canPark = store.isAtGarage()
  const options = [
    ...(canPark
      ? [{ tankId: null as string | null, name: '徒步', detail: '当前战车停入首个空车位' }]
      : []),
    ...choices.map((tank) => {
      const definition = TANKS.find((item) => item.id === tank.tankId)
      return {
        tankId: tank.tankId as string | null,
        name: definition?.name || tank.tankId,
        detail: `SP ${tank.sp}/${definition?.sp || 0} · 装甲 ${tank.armor}/${definition?.armorCap || 0}${
          tank.garageSlot === null ? '' : ` · ${String(tank.garageSlot + 1).padStart(2, '0')}号位`
        }`
      }
    })
  ]
  const pad = 13 * scale
  const top = 47 * scale
  const rowHeight = Math.max(42, 50 * scale)
  const limit = Math.max(1, Math.floor((height - top - 30 * scale) / rowHeight))
  const shown = indexedWindow(options, menuIndex(state), limit)
  shown.forEach(({ item, index }, offset) => {
    const button = uiButton(item.name, width - pad * 2, rowHeight - 2 * scale, {
      active: menuIndex(state) === index,
      detail: item.detail,
      value: item.tankId ? item.tankId.toUpperCase() : 'FOOT',
      onPress: () => store.menuUse(index)
    })
    button.position.set(pad, top + offset * rowHeight)
    root.addChild(button)
  })
  if (!options.length) {
    addEmpty(
      root,
      '现场没有可调配战车；回到地下车库后可重新编组。',
      pad,
      top,
      width - pad * 2,
      scale
    )
  }
  addOverflowIndicator(
    root,
    shown,
    options.length,
    pad,
    height - 41 * scale,
    width - pad * 2,
    scale
  )
  addHint(root, 'A 分配 · B 返回', width, height, scale)
  return root
}

function renderEquipment(
  state: GameState,
  width: number,
  height: number,
  scale: number
): Container {
  const root = workspace(width, height, '人员装备', 'GEAR', scale)
  const members = state.party.filter((member) => member.id)
  const pad = 13 * scale
  const top = 47 * scale
  const rowHeight = Math.max(48, 58 * scale)
  members.forEach((member, index) => {
    const weapon = findHumanWeapon(member.weaponId)
    const button = uiButton(member.name, width - pad * 2, rowHeight - 3 * scale, {
      active: menuIndex(state) === index,
      detail: weapon?.name || '徒手',
      value: `ATK ${member.atk + (weapon?.atk || 0)}`,
      onPress: () => store.menuUse(index)
    })
    button.position.set(pad, top + index * rowHeight)
    root.addChild(button)
  })
  if (!members.length) addEmpty(root, '队伍中没有可操作成员。', pad, top, width - pad * 2, scale)
  addHint(root, 'A 选择成员 · B 返回', width, height, scale)
  return root
}

function renderWeaponAssignment(
  state: GameState,
  width: number,
  height: number,
  scale: number
): Container {
  const member = state.party.find((candidate) => candidate.id === state.menu?.equipMember)
  const choices = member?.id ? store.humanWeaponChoicesForUi(member.id) : []
  const root = workspace(width, height, `${member?.name || '队员'} · 武器`, 'ARMORY', scale)
  const pad = 13 * scale
  const top = 47 * scale
  const rowHeight = Math.max(45, 55 * scale)
  const limit = Math.max(1, Math.floor((height - top - 30 * scale) / rowHeight))
  const shown = indexedWindow(choices, menuIndex(state), limit)
  shown.forEach(({ item: weapon, index }, offset) => {
    const value = weapon.current
      ? '装备中'
      : weapon.id
        ? `库存 x${weapon.owned}`
        : `ATK +${weapon.atk}`
    const button = uiButton(weapon.name, width - pad * 2, rowHeight - 3 * scale, {
      active: menuIndex(state) === index,
      detail: weapon.desc,
      value,
      onPress: () => store.menuUse(index)
    })
    button.position.set(pad, top + offset * rowHeight)
    root.addChild(button)
  })
  if (!choices.length) addEmpty(root, '没有可换装武器。', pad, top, width - pad * 2, scale)
  addOverflowIndicator(
    root,
    shown,
    choices.length,
    pad,
    height - 41 * scale,
    width - pad * 2,
    scale
  )
  addHint(root, 'A 换装 · B 返回', width, height, scale)
  return root
}

function renderTeleport(state: GameState, width: number, height: number, scale: number): Container {
  const root = workspace(width, height, '坐标传送', 'BEACON', scale)
  const towns = store.teleportTargets()
  const pad = 13 * scale
  const top = 47 * scale
  const rowHeight = Math.max(38, 45 * scale)
  const limit = Math.max(1, Math.floor((height - top - 30 * scale) / rowHeight))
  const shown = indexedWindow(towns, menuIndex(state), limit)
  shown.forEach(({ item: town, index }, offset) => {
    const current = state.map === town.id
    const button = uiButton(town.name, width - pad * 2, rowHeight - 2 * scale, {
      active: menuIndex(state) === index,
      detail: current ? '当前坐标' : '信标已建立',
      value: current ? 'HERE' : String(index + 1).padStart(2, '0'),
      onPress: () => store.menuUse(index)
    })
    button.position.set(pad, top + offset * rowHeight)
    root.addChild(button)
  })
  if (!towns.length) addEmpty(root, '尚未解锁任何城镇坐标。', pad, top, width - pad * 2, scale)
  addOverflowIndicator(root, shown, towns.length, pad, height - 41 * scale, width - pad * 2, scale)
  addHint(root, 'A 传送 · B 返回', width, height, scale)
  return root
}

function renderBounty(state: GameState, width: number, height: number, scale: number): Container {
  const root = workspace(width, height, '赏金首通缉榜', 'BOUNTY', scale)
  const pad = 13 * scale
  const top = 46 * scale
  const footer = 30 * scale
  const rowHeight = Math.max(21, Math.min(38 * scale, (height - top - footer) / BOUNTIES.length))
  BOUNTIES.forEach((bounty, index) => {
    const claimed = !!state.bounties.claimed[bounty.id]
    const killed = !!state.bounties.killed[bounty.id]
    const status = claimed ? '已领取' : killed ? '可领取' : '未讨伐'
    const color = claimed ? UI_COLORS.steelLight : killed ? UI_COLORS.brassLight : UI_COLORS.text
    const y = top + index * rowHeight
    const background = new Graphics()
      .rect(pad, y, width - pad * 2, rowHeight - 1)
      .fill({ color: index % 2 ? UI_COLORS.coal : UI_COLORS.gunmetal, alpha: 0.72 })
    if (killed && !claimed) background.rect(pad, y, 4 * scale, rowHeight - 1).fill(UI_COLORS.brass)
    root.addChild(background)
    const rank = label(
      String(index + 1).padStart(2, '0'),
      pad + 7 * scale,
      y + 5 * scale,
      utilityStyle(8.5 * scale)
    )
    const name = label(
      bounty.name,
      pad + 35 * scale,
      y + 4 * scale,
      bodyStyle(10.5 * scale, {
        fill: color
      })
    )
    const reward = label(
      `${fmtG(bounty.gold)} G`,
      width - pad - 68 * scale,
      y + 5 * scale,
      utilityStyle(9 * scale, {
        fill: UI_COLORS.brassLight,
        align: 'right'
      })
    )
    reward.anchor.set(1, 0)
    const stateLabel = label(
      status,
      width - pad - 7 * scale,
      y + 5 * scale,
      utilityStyle(8.5 * scale, {
        fill: killed && !claimed ? UI_COLORS.brassLight : UI_COLORS.muted,
        align: 'right'
      })
    )
    stateLabel.anchor.set(1, 0)
    fitText(name, width - pad * 2 - 180 * scale)
    root.addChild(rank, name, reward, stateLabel)
  })
  addHint(root, '赏金需前往情报屋领取 · B 返回', width, height, scale)
  return root
}

function renderHunt(state: GameState, width: number, height: number, scale: number): Container {
  const root = workspace(width, height, '自动巡猎', 'PATROL', scale)
  const pad = 14 * scale
  const top = 49 * scale
  const task = state.hunt
  if (task) {
    const region = REGIONS.find((candidate) => candidate.id === task.regionId)
    const member = state.party.find((candidate) => candidate.id === task.memberId)
    const tank = task.tankId ? TANKS.find((candidate) => candidate.id === task.tankId) : null
    const remaining = store.huntRemainingForUi()
    const progress = Math.max(0, Math.min(1, 1 - remaining / Math.max(1, task.durationMinutes)))
    const heading = label(
      region?.name || '未知区域',
      pad,
      top,
      displayStyle(18 * scale, {
        fill: UI_COLORS.paper
      })
    )
    const phase = label(
      remaining > 0 ? '执行中' : '已返航',
      width - pad,
      top + 3 * scale,
      utilityStyle(10 * scale, {
        fill: remaining > 0 ? UI_COLORS.info : UI_COLORS.success,
        align: 'right'
      })
    )
    phase.anchor.set(1, 0)
    root.addChild(heading, phase)
    const track = progressBar(
      width - pad * 2,
      progress,
      remaining > 0 ? UI_COLORS.info : UI_COLORS.success,
      9 * scale
    )
    track.position.set(pad, top + 31 * scale)
    root.addChild(track)
    const lines = [
      ['派遣成员', member?.name || task.memberId],
      ['战车', tank?.name || '徒步巡猎'],
      ['剩余时间', remaining ? maintenanceTimeLabel(remaining) : '等待结算'],
      ['预计收获', `${task.xp} EXP · ${fmtG(task.gold)} G`],
      ['资源投入', `装甲 ${task.armorCost} · 主炮 ${task.mainAmmoCost} · S-E ${task.seAmmoCost}`]
    ]
    const rowTop = top + 55 * scale
    const rowHeight = Math.max(
      27,
      Math.min(38 * scale, (height - rowTop - 94 * scale) / lines.length)
    )
    lines.forEach(([keyText, value], index) => {
      const y = rowTop + index * rowHeight
      const key = label(keyText, pad, y + 5 * scale, utilityStyle(9.5 * scale))
      const val = label(
        value,
        width - pad,
        y + 4 * scale,
        bodyStyle(10.5 * scale, {
          fill: UI_COLORS.text,
          align: 'right'
        })
      )
      val.anchor.set(1, 0)
      fitText(val, width - pad * 2 - 78 * scale)
      root.addChild(key, val)
      root.addChild(
        new Graphics()
          .moveTo(pad, y + rowHeight - 2)
          .lineTo(width - pad, y + rowHeight - 2)
          .stroke({ color: UI_COLORS.steelDark, width: 1 })
      )
    })
    const command = uiButton(
      remaining === 0 ? '接收巡猎报告' : '巡猎队尚未返航',
      width - pad * 2,
      41 * scale,
      {
        active: remaining === 0,
        disabled: remaining > 0,
        value: remaining === 0 ? 'A' : maintenanceTimeLabel(remaining),
        onPress: () => store.huntConfirm()
      }
    )
    command.position.set(pad, height - 72 * scale)
    root.addChild(command)
    addHint(root, '世界时间推进后巡猎队会返航 · B 返回', width, height, scale)
    return root
  }

  const regions = store.huntRegionsForUi()
  const preview = store.huntPreviewForUi()
  const inTown = !!state.inTown && (state.base === 'town' || state.base === 'room')
  const narrow = width < 360
  const regionsWidth = narrow ? width - pad * 2 : Math.max(120, width * 0.42)
  const previewX = narrow ? pad : pad + regionsWidth + 10 * scale
  const previewWidth = narrow ? width - pad * 2 : width - previewX - pad
  const regionRowHeight = Math.max(37, 44 * scale)
  const durationY = height - 113 * scale
  const regionLimit = Math.max(1, Math.floor((durationY - top - 8 * scale) / regionRowHeight))
  const shown = indexedWindow(regions, menuIndex(state), regionLimit)
  shown.forEach(({ item: region, index }, offset) => {
    const button = uiButton(region.name, regionsWidth, regionRowHeight - 2 * scale, {
      active: menuIndex(state) === index,
      detail: `${dangerPips(region)} · ${recommendedLevelLabel(region)}`,
      onPress: () => store.huntSelectRegion(index)
    })
    button.position.set(pad, top + offset * regionRowHeight)
    root.addChild(button)
  })
  if (!regions.length) {
    addEmpty(
      root,
      '没有符合安全派遣条件的区域或闲置成员。徒步只允许安全区，更危险区域需要状态良好的战车。',
      pad,
      top,
      regionsWidth,
      scale
    )
  }

  if (!narrow) {
    const title = sectionTitle('风险预估', previewWidth)
    title.position.set(previewX, top)
    root.addChild(title)
    if (preview) {
      const lines = [
        ['成员', preview.member?.name || '无'],
        ['载具', preview.tank ? tankName(preview.tank.tankId) : '徒步'],
        ['风险', preview.riskLabel],
        ['收益', `${preview.xp} EXP · ${fmtG(preview.gold)} G`],
        ['消耗', `装甲 ${preview.armorCost} · 炮弹 ${preview.mainAmmoCost + preview.seAmmoCost}`]
      ]
      lines.forEach(([keyText, value], index) => {
        const y = top + 28 * scale + index * 27 * scale
        const key = label(keyText, previewX, y, utilityStyle(9 * scale))
        const val = label(
          value,
          previewX + previewWidth,
          y,
          bodyStyle(9.5 * scale, {
            align: 'right'
          })
        )
        val.anchor.set(1, 0)
        fitText(val, previewWidth - 52 * scale)
        root.addChild(key, val)
      })
      if (preview.reason) {
        const warning = label(
          preview.reason,
          previewX,
          top + 170 * scale,
          bodyStyle(9 * scale, {
            fill: UI_COLORS.warning,
            wordWrap: true,
            wordWrapWidth: previewWidth,
            lineHeight: 14 * scale
          })
        )
        root.addChild(warning)
      }
    }
  }

  const durationGap = 5 * scale
  const durationWidth =
    (width - pad * 2 - durationGap * (HUNT_DURATIONS.length - 1)) / HUNT_DURATIONS.length
  HUNT_DURATIONS.forEach((duration, index) => {
    const button = uiButton(maintenanceTimeLabel(duration), durationWidth, 35 * scale, {
      active: state.menu?.huntDuration === duration,
      dense: true,
      onPress: () => store.huntSetDuration(duration)
    })
    button.position.set(pad + index * (durationWidth + durationGap), durationY)
    root.addChild(button)
  })
  const command = uiButton('派出巡猎队', width - pad * 2, 39 * scale, {
    active: inTown && !!preview?.canStart,
    disabled: !inTown || !preview?.canStart,
    value: 'A',
    onPress: () => store.huntConfirm()
  })
  command.position.set(pad, durationY + 41 * scale)
  root.addChild(command)
  addHint(
    root,
    inTown ? '选择区域与时长后派遣 · B 返回' : '只能在城镇内派遣 · B 返回',
    width,
    height,
    scale
  )
  return root
}

function renderSettings(state: GameState, width: number, height: number, scale: number): Container {
  const root = workspace(width, height, '系统设置', 'OPTIONS', scale)
  const settings = useSettingsStore()
  const options = [
    {
      name: '音乐音量',
      detail: settings.muted ? '全局静音中' : '调整背景音乐混音',
      value: settings.muted ? '静音' : settings.optionLabel(0)
    },
    { name: '音效音量', detail: '调整战斗与界面反馈音效', value: settings.optionLabel(1) },
    { name: '文本速度', detail: '调整对话文字显示速度', value: settings.optionLabel(2) },
    { name: '返回标题画面', detail: '离开当前游戏；请先在宿屋登记进度', value: 'EXIT' }
  ]
  const pad = 13 * scale
  const top = 49 * scale
  const rowHeight = Math.max(48, 60 * scale)
  options.forEach((option, index) => {
    const button = uiButton(option.name, width - pad * 2, rowHeight - 3 * scale, {
      active: menuIndex(state) === index,
      detail: option.detail,
      value: option.value,
      onPress: () => store.menuUse(index)
    })
    button.position.set(pad, top + index * rowHeight)
    root.addChild(button)
  })
  addHint(root, '方向键调节 · A 切换 · B 返回', width, height, scale)
  return root
}

function locationColor(location: WorldMapLocation): number {
  if (location.kind === 'town') return UI_COLORS.brassLight
  if (location.kind === 'village') return 0xd7d38a
  if (location.kind === 'tribe') return 0xd98d5b
  if (location.kind === 'gate')
    return location.status === 'open' ? UI_COLORS.success : UI_COLORS.warning
  return UI_COLORS.info
}

function drawMapMarker(
  graphics: Graphics,
  location: WorldMapLocation,
  x: number,
  y: number,
  size: number
) {
  const color = locationColor(location)
  const marker = Math.max(2, Math.min(5, size * 0.8))
  if (location.kind === 'town') {
    graphics.rect(x - marker, y - marker, marker * 2, marker * 2).fill(color)
    graphics.rect(x - 0.5, y - 0.5, 1, 1).fill(UI_COLORS.black)
  } else if (location.kind === 'village') {
    graphics.rect(x - marker, y - marker * 0.35, marker * 2, marker * 0.7).fill(color)
    graphics.rect(x - marker * 0.35, y - marker, marker * 0.7, marker * 2).fill(color)
  } else if (location.kind === 'tribe') {
    graphics.poly([x, y - marker, x + marker, y + marker, x - marker, y + marker]).fill(color)
  } else if (location.kind === 'gate') {
    graphics.rect(x - marker, y - marker, Math.max(1, marker * 0.45), marker * 2).fill(color)
    graphics.rect(x + marker * 0.55, y - marker, Math.max(1, marker * 0.45), marker * 2).fill(color)
    graphics.rect(x - marker * 0.5, y - marker * 0.2, marker, Math.max(1, marker * 0.4)).fill(color)
  } else {
    graphics.poly([x, y - marker, x + marker, y, x, y + marker, x - marker, y]).fill(color)
  }
}

function drawWorldMap(
  state: GameState,
  x: number,
  y: number,
  width: number,
  height: number,
  selectedRegionId: string
): Container {
  const root = new Container()
  const frame = new Graphics()
    .rect(x, y, width, height)
    .fill(UI_COLORS.black)
    .rect(x, y, width, height)
    .stroke({ color: UI_COLORS.steel, width: 1 })
  root.addChild(frame)

  const tile = Math.min(width / WORLD_W, height / WORLD_H)
  const tileSize = tile >= 1 ? Math.floor(tile) : tile
  const mapWidth = tileSize * WORLD_W
  const mapHeight = tileSize * WORLD_H
  const originX = x + Math.floor((width - mapWidth) / 2)
  const originY = y + Math.floor((height - mapHeight) / 2)
  const raster = new Graphics().rect(originX, originY, mapWidth, mapHeight).fill(0x080c0d)

  for (let ty = 0; ty < WORLD_H; ty++) {
    for (let tx = 0; tx < WORLD_W; tx++) {
      const explored = isWorldTileExplored(state.worldMap, tx, ty)
      if (!explored) {
        if ((tx + ty) % 2 === 0) {
          raster
            .rect(originX + tx * tileSize, originY + ty * tileSize, tileSize, tileSize)
            .fill(0x0b1011)
        }
        continue
      }
      const terrain = WORLD[ty]?.[tx]
      raster
        .rect(originX + tx * tileSize, originY + ty * tileSize, tileSize, tileSize)
        .fill(TERRAIN_COLORS[terrain] || 0x343d3c)
      if (regionAtWorld(tx, ty).id === selectedRegionId) {
        raster
          .rect(originX + tx * tileSize, originY + ty * tileSize, tileSize, tileSize)
          .fill({ color: UI_COLORS.brassLight, alpha: 0.13 })
      }
    }
  }

  if (tileSize >= 2) {
    for (let tx = 10; tx < WORLD_W; tx += 10) {
      raster
        .moveTo(originX + tx * tileSize, originY)
        .lineTo(originX + tx * tileSize, originY + mapHeight)
        .stroke({ color: UI_COLORS.steelLight, width: 1, alpha: 0.1 })
    }
    for (let ty = 10; ty < WORLD_H; ty += 10) {
      raster
        .moveTo(originX, originY + ty * tileSize)
        .lineTo(originX + mapWidth, originY + ty * tileSize)
        .stroke({ color: UI_COLORS.steelLight, width: 1, alpha: 0.1 })
    }
  }
  root.addChild(raster)

  const model = store.worldMapForUi()
  const markers = new Graphics()
  model.locations.forEach((location) => {
    drawMapMarker(
      markers,
      location,
      originX + (location.x + 0.5) * tileSize,
      originY + (location.y + 0.5) * tileSize,
      tileSize
    )
  })
  const [playerX, playerY] = model.position
  const px = originX + (playerX + 0.5) * tileSize
  const py = originY + (playerY + 0.5) * tileSize
  const cross = Math.max(3, Math.min(6, tileSize))
  markers.rect(px - cross, py - 1, cross * 2, 2).fill(UI_COLORS.white)
  markers.rect(px - 1, py - cross, 2, cross * 2).fill(UI_COLORS.white)
  markers.circle(px, py, Math.max(1, tileSize * 0.25)).fill(UI_COLORS.warning)
  root.addChild(markers)
  return root
}

function renderMapLegend(width: number, scale: number): Container {
  const root = new Container()
  const entries = [
    ['主城', UI_COLORS.brassLight],
    ['村落', 0xd7d38a],
    ['部落', 0xd98d5b],
    ['洞窟', UI_COLORS.info],
    ['开放关口', UI_COLORS.success],
    ['封锁关口', UI_COLORS.warning],
    ['未探索', 0x0b1011]
  ] as const
  const columns = width < 420 ? 4 : entries.length
  const cellWidth = width / columns
  entries.forEach(([name, color], index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const x = column * cellWidth
    const y = row * 17 * scale
    const swatch = new Graphics().rect(x, y + 3 * scale, 8 * scale, 8 * scale).fill(color)
    const copy = label(name, x + 13 * scale, y, utilityStyle(8 * scale))
    fitText(copy, cellWidth - 15 * scale)
    root.addChild(swatch, copy)
  })
  return root
}

function renderMap(state: GameState, width: number, height: number, scale: number): Container {
  const root = panel(width, height, {
    title: '世界测绘图',
    accent: UI_COLORS.info,
    label: 'SURVEY'
  })
  addBackButton(root, width, scale, () => store.worldMapBack())
  const model = store.worldMapForUi()
  const pad = 13 * scale
  const top = 44 * scale
  const footer = 24 * scale
  const innerWidth = width - pad * 2
  const innerHeight = height - top - footer
  const compact = width < 760 || height > width * 1.25
  const coordinate = label(
    `POS ${String(model.position[0]).padStart(2, '0')}-${String(model.position[1]).padStart(2, '0')} · ${model.currentRegion.name}`,
    pad,
    27 * scale,
    utilityStyle(8.5 * scale, { fill: UI_COLORS.info })
  )
  fitText(coordinate, width - pad * 2 - 88 * scale)
  root.addChild(coordinate)

  const mapX = pad
  const mapY = top
  let mapWidth = innerWidth
  let mapHeight = Math.min(innerHeight * 0.55, innerWidth * 0.75)
  let infoX = pad
  let infoY = mapY + mapHeight + 34 * scale
  let infoWidth = innerWidth
  let infoHeight = height - infoY - footer

  if (!compact) {
    infoWidth = Math.max(245 * scale, innerWidth * 0.31)
    mapWidth = innerWidth - infoWidth - 12 * scale
    mapHeight = innerHeight - 37 * scale
    infoX = mapX + mapWidth + 12 * scale
    infoY = top
    infoHeight = innerHeight
  }

  root.addChild(drawWorldMap(state, mapX, mapY, mapWidth, mapHeight, model.selectedRegion.id))
  const legend = renderMapLegend(mapWidth, scale)
  legend.position.set(mapX, mapY + mapHeight + 7 * scale)
  root.addChild(legend)

  const previous = uiButton('◀', 31 * scale, 28 * scale, {
    dense: true,
    onPress: () => store.worldMapCycleRegion(-1)
  })
  previous.position.set(infoX, infoY)
  const next = uiButton('▶', 31 * scale, 28 * scale, {
    dense: true,
    onPress: () => store.worldMapCycleRegion(1)
  })
  next.position.set(infoX + infoWidth - 31 * scale, infoY)
  root.addChild(previous, next)

  const regionName = label(
    model.selectedRegion.name,
    infoX + infoWidth / 2,
    infoY + 1 * scale,
    displayStyle(13 * scale, {
      fill: UI_COLORS.paper,
      align: 'center'
    })
  )
  regionName.anchor.set(0.5, 0)
  fitText(regionName, infoWidth - 74 * scale)
  const index = label(
    `${model.selectedIndex + 1}/${Math.max(1, model.regions.length)}`,
    infoX + infoWidth / 2,
    infoY + 17 * scale,
    utilityStyle(7.5 * scale)
  )
  index.anchor.set(0.5, 0)
  root.addChild(regionName, index)

  const surveyY = infoY + 38 * scale
  const surveyLabel = label('测绘进度', infoX, surveyY, utilityStyle(8.5 * scale))
  const percent = label(
    `${model.exploration.percent}%`,
    infoX + infoWidth,
    surveyY,
    utilityStyle(9 * scale, {
      fill: UI_COLORS.brassLight,
      align: 'right'
    })
  )
  percent.anchor.set(1, 0)
  const survey = progressBar(infoWidth, model.exploration.percent / 100, UI_COLORS.brass, 7 * scale)
  survey.position.set(infoX, surveyY + 16 * scale)
  root.addChild(surveyLabel, percent, survey)

  const threatY = surveyY + 29 * scale
  const threat = label(
    `${dangerPips(model.selectedRegion)} · ${recommendedLevelLabel(model.selectedRegion)} · ${vehicleRecommendationLabel(model.selectedRegion)}`,
    infoX,
    threatY,
    utilityStyle(8.5 * scale, {
      fill: model.selectedRegion.dangerLevel >= 4 ? UI_COLORS.warning : UI_COLORS.info
    })
  )
  fitText(threat, infoWidth)
  root.addChild(threat)

  const descriptionY = threatY + 18 * scale
  const description = label(
    model.selectedRegion.description,
    infoX,
    descriptionY,
    bodyStyle(8.5 * scale, {
      fill: UI_COLORS.muted,
      wordWrap: true,
      wordWrapWidth: infoWidth,
      lineHeight: 13 * scale
    })
  )
  root.addChild(description)

  const placesY = descriptionY + (compact ? 34 : 48) * scale
  if (placesY < infoY + infoHeight - 18 * scale) {
    const title = sectionTitle('已发现地点', infoWidth)
    title.position.set(infoX, placesY)
    root.addChild(title)
    const availableRows = Math.max(
      0,
      Math.floor((infoY + infoHeight - (placesY + 26 * scale)) / (26 * scale))
    )
    model.selectedLocations.slice(0, availableRows).forEach((location, locationIndex) => {
      const y = placesY + 25 * scale + locationIndex * 26 * scale
      const marker = new Graphics()
        .circle(infoX + 5 * scale, y + 7 * scale, 3 * scale)
        .fill(locationColor(location))
      const name = label(location.name, infoX + 14 * scale, y, bodyStyle(9.5 * scale))
      const coordinate = label(
        `${location.x}-${location.y}`,
        infoX + infoWidth,
        y + 1 * scale,
        utilityStyle(8 * scale, { align: 'right' })
      )
      coordinate.anchor.set(1, 0)
      fitText(name, infoWidth - 82 * scale)
      const note = label(
        location.note || '',
        infoX + 14 * scale,
        y + 13 * scale,
        utilityStyle(7 * scale)
      )
      fitText(note, infoWidth - 16 * scale)
      root.addChild(marker, name, coordinate, note)
    })
    if (!model.selectedLocations.length) {
      addEmpty(root, '该区域尚未发现入口或聚落。', infoX, placesY + 28 * scale, infoWidth, scale)
    }
  }
  addHint(root, '方向键切换已发现区域 · B 返回', width, height, scale)
  return root
}

function renderGarage(state: GameState, width: number, height: number, scale: number): Container {
  const slot = Math.max(0, Math.min(GARAGE_CAPACITY - 1, state.menu?.garageSlot ?? 0))
  const parked = garageTankAtSlot(state, slot)
  const definition = parked ? TANKS.find((tank) => tank.id === parked.tankId) : null
  const occupancy = Array.from({ length: GARAGE_CAPACITY }, (_, index) =>
    garageTankAtSlot(state, index)
  )
  const actions = store.garageMenuOptionsForUi()
  const root = panel(width, height, {
    title: `地下战车库 · ${String(slot + 1).padStart(2, '0')} 号位`,
    accent: parked ? UI_COLORS.brass : UI_COLORS.info,
    label: `${occupancy.filter(Boolean).length}/${GARAGE_CAPACITY}`
  })
  addBackButton(root, width, scale)
  const pad = 14 * scale
  const top = 46 * scale
  const compact = width < 700
  const columns = compact ? 4 : 8
  const gap = 5 * scale
  const slotWidth = (width - pad * 2 - gap * (columns - 1)) / columns
  const slotHeight = compact ? 47 * scale : 58 * scale
  occupancy.forEach((tank, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const tankDef = tank ? TANKS.find((item) => item.id === tank.tankId) : null
    const button = uiButton(String(index + 1).padStart(2, '0'), slotWidth, slotHeight, {
      active: index === slot,
      detail: tankDef ? tankDef.name.replace(/^NO\.\d+\s*/, '') : '空车位',
      value: tank ? tank.tankId.toUpperCase() : 'EMPTY',
      dense: true,
      onPress: () => store.openGarageSlot(index)
    })
    button.position.set(pad + column * (slotWidth + gap), top + row * (slotHeight + gap))
    root.addChild(button)
  })

  const slotRows = Math.ceil(GARAGE_CAPACITY / columns)
  const detailY = top + slotRows * (slotHeight + gap) + 10 * scale
  const detailHeight = parked ? 74 * scale : 49 * scale
  const detailTitle = sectionTitle(
    parked ? definition?.name || parked.tankId : '空车位',
    width - pad * 2
  )
  detailTitle.position.set(pad, detailY)
  root.addChild(detailTitle)
  if (parked && definition) {
    const sp = label(
      `SP ${parked.sp}/${definition.sp}`,
      pad,
      detailY + 27 * scale,
      utilityStyle(9.5 * scale)
    )
    const armor = label(
      `装甲 ${parked.armor}/${definition.armorCap}`,
      width - pad,
      detailY + 27 * scale,
      utilityStyle(9.5 * scale, { align: 'right' })
    )
    armor.anchor.set(1, 0)
    const bar = progressBar(
      width - pad * 2,
      parked.armor / Math.max(1, definition.armorCap),
      parked.armor / Math.max(1, definition.armorCap) < 0.3 ? UI_COLORS.warning : UI_COLORS.success,
      8 * scale
    )
    bar.position.set(pad, detailY + 48 * scale)
    root.addChild(sp, armor, bar)
  } else {
    const empty = label(
      '可停入一辆当前随队战车',
      pad,
      detailY + 27 * scale,
      bodyStyle(10 * scale, {
        fill: UI_COLORS.muted
      })
    )
    root.addChild(empty)
  }

  const actionTop = detailY + detailHeight
  const actionRowHeight = Math.max(36, 43 * scale)
  const actionLimit = Math.max(1, Math.floor((height - actionTop - 29 * scale) / actionRowHeight))
  const shown = indexedWindow(actions, menuIndex(state), actionLimit)
  shown.forEach(({ item: action, index }, offset) => {
    const button = uiButton(action.label, width - pad * 2, actionRowHeight - 2 * scale, {
      active: menuIndex(state) === index,
      value: action.memberId ? 'MOVE' : 'B',
      dense: true,
      onPress: () => store.garageSlotUse(index)
    })
    button.position.set(pad, actionTop + offset * actionRowHeight)
    root.addChild(button)
  })
  addOverflowIndicator(
    root,
    shown,
    actions.length,
    pad,
    height - 40 * scale,
    width - pad * 2,
    scale
  )
  addHint(root, '选择车位与调度命令 · B 关闭', width, height, scale)
  return root
}

const VIEW_RENDERERS: Record<string, MenuViewRenderer> = {
  root: renderRoot,
  status: renderStatus,
  items: renderItems,
  tanks: renderTanks,
  tankassign: renderTankAssignment,
  equipment: renderEquipment,
  weaponassign: renderWeaponAssignment,
  teleport: renderTeleport,
  bounty: renderBounty,
  hunt: renderHunt,
  hunting: renderHunt,
  options: renderSettings,
  settings: renderSettings
}

export function renderMenu(
  state: GameState,
  width: number,
  height: number,
  scale: number,
  bottomReserve = 0
): Container {
  const root = new Container()
  if (!state.menu) return root

  const s = safeScale(scale)
  const safeHeight = Math.max(1, height - bottomReserve)
  const edge = uiEdgeFor(width, safeHeight)
  const scrim = new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: UI_COLORS.black, alpha: 0.7 })
  root.addChild(scrim)

  const view = state.menu.view || 'root'
  const fullWidth = width - edge * 2
  const fullHeight = safeHeight - edge * 2
  if (view === 'map') {
    const map = renderMap(state, fullWidth, fullHeight, s)
    map.position.set(edge, edge)
    root.addChild(map)
    return root
  }
  if (view === 'garage') {
    const garage = renderGarage(state, fullWidth, fullHeight, s)
    garage.position.set(edge, edge)
    root.addChild(garage)
    return root
  }

  const compact = width < 720
  const gap = Math.max(7, 10 * s)
  const navigationWidth = Math.max(
    104,
    Math.min(compact ? width * 0.29 : 196 * s, fullWidth * 0.35)
  )
  const contentWidth = fullWidth - navigationWidth - gap
  const navigation = renderNavigation(state, navigationWidth, fullHeight, s)
  navigation.position.set(edge, edge)
  root.addChild(navigation)

  const renderer = VIEW_RENDERERS[view] || renderRoot
  const content = renderer(state, contentWidth, fullHeight, s)
  content.position.set(edge + navigationWidth + gap, edge)
  root.addChild(content)
  return root
}
