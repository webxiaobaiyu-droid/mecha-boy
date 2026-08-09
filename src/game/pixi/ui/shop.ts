import { Container, Graphics } from 'pixi.js'
import type { GameState, Part, PartKind, TankState } from '@/game/types'
import { store } from '@/game/core/store'
import { BOUNTIES } from '@/game/data/combat'
import { HUMAN_WEAPONS, ITEMS, PARTS, TANKS, findPart } from '@/game/data/equipment'
import { fmtG } from '@/game/utils'
import {
  ARMOR_PACK_COST,
  ARMOR_PACK_SIZE,
  maintenanceTimeLabel,
  maintenanceTotals
} from '@/game/systems/maintenance'
import { PART_CONDITION_LABELS, tankAmmoCapacity, tankPartCondition } from '@/game/systems/tanks'
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

const WEAPON_TABS = ['人员装备', '主炮', '副炮', 'S-E', '发动机', 'C装置', '卖出', '退出']
const MOD_SLOTS: { id: PartKind; name: string }[] = [
  { id: 'main', name: '主炮' },
  { id: 'sub', name: '副炮' },
  { id: 'se', name: 'S-E' },
  { id: 'engine', name: '发动机' },
  { id: 'c', name: 'C装置' }
]

interface ShopListItem {
  id: string
  name: string
  price: number
  kind?: string
}

interface ContentLayout {
  width: number
  height: number
  pad: number
  unit: number
  compact: boolean
}

interface ListEntry {
  label: string
  detail?: string
  value?: string
  disabled?: boolean
}

function confirmSelection(index: number) {
  store.shopSelect(index)
  store.shopConfirm()
}

function rightLabel(
  root: Container,
  text: string,
  x: number,
  y: number,
  size: number,
  color: number = UI_COLORS.muted
) {
  const node = label(text, x, y, utilityStyle(size, { fill: color, align: 'right' }))
  node.anchor.set(1, 0)
  root.addChild(node)
  return node
}

function divider(
  root: Container,
  x: number,
  y: number,
  width: number,
  color: number = UI_COLORS.steel
) {
  root.addChild(
    new Graphics()
      .moveTo(x, y)
      .lineTo(x + width, y)
      .stroke({ color, width: 1, alpha: 0.62 })
  )
}

function emptyState(
  root: Container,
  text: string,
  x: number,
  y: number,
  width: number,
  unit: number
) {
  const node = label(
    text,
    x,
    y,
    bodyStyle(12 * unit, {
      fill: UI_COLORS.muted,
      wordWrap: true,
      wordWrapWidth: width,
      lineHeight: Math.round(20 * unit)
    })
  )
  root.addChild(node)
  return node
}

function renderSelectableList(
  root: Container,
  entries: ListEntry[],
  selected: number,
  x: number,
  y: number,
  width: number,
  availableHeight: number,
  rowHeight: number,
  onPress: (index: number) => void
) {
  if (!entries.length) return y
  const capacity = Math.max(1, Math.floor(availableHeight / rowHeight))
  const { start, end } = listWindowRange(entries.length, selected, capacity)
  if (entries.length > capacity) {
    const pagerSize = 24
    const pagerGap = 4
    const pagerWidth = pagerSize * 2 + pagerGap
    rightLabel(
      root,
      `${start + 1}-${end} / ${entries.length}`,
      x + width - pagerWidth - 7,
      y - 17,
      9
    )
    const previous = uiButton('▲', pagerSize, 22, {
      dense: true,
      onPress: () => store.shopSelect((selected + entries.length - 1) % entries.length)
    })
    const next = uiButton('▼', pagerSize, 22, {
      dense: true,
      onPress: () => store.shopSelect((selected + 1) % entries.length)
    })
    previous.position.set(x + width - pagerWidth, y - 25)
    next.position.set(previous.x + pagerSize + pagerGap, previous.y)
    root.addChild(previous, next)
  }
  for (let index = start; index < end; index++) {
    const entry = entries[index]
    const row = uiButton(entry.label, width, rowHeight - 3, {
      active: selected === index,
      disabled: entry.disabled,
      detail: entry.detail,
      value: entry.value,
      dense: true,
      onPress: () => onPress(index)
    })
    row.position.set(x, y + (index - start) * rowHeight)
    root.addChild(row)
  }
  return y + (end - start) * rowHeight
}

function partStats(part: Part): string {
  const values: string[] = []
  if (part.atk !== undefined) values.push(`攻 ${part.atk}`)
  if (part.acc !== undefined) values.push(`命中 ${part.acc >= 0 ? '+' : ''}${part.acc}%`)
  if (part.load !== undefined) values.push(`载重 ${part.load.toFixed(1)}t`)
  if (part.ammo !== undefined) values.push(`弹仓 ${part.ammo}`)
  if (part.all) values.push('全体')
  values.push(`重量 ${part.w.toFixed(1)}t`)
  return values.join(' · ')
}

function itemMeta(id: string): string {
  if (ITEMS[id]) return ITEMS[id].desc
  if (HUMAN_WEAPONS[id]) return HUMAN_WEAPONS[id].desc
  const part = findPart(id)
  return part ? partStats(part) : ''
}

function tankDefinition(tank: TankState | null | undefined) {
  return tank ? TANKS.find((candidate) => candidate.id === tank.tankId) : undefined
}

function selectedServiceTank(state: GameState) {
  const tanks = store.serviceableTanksForUi()
  const index = Math.max(0, Math.min(Math.max(0, tanks.length - 1), state.shop?.tankSel || 0))
  return { tanks, tank: tanks[index] || null, index }
}

function tankLoadCapacity(tank: TankState | null): number {
  if (!tank) return 0
  return PARTS.engine.find((candidate) => candidate.id === tank.parts.engine)?.load || 0
}

function ammoText(tank: TankState | null, kind: 'main' | 'se'): string {
  if (!tank?.parts[kind]) return '--'
  return `${tank.ammo[kind]}/${tankAmmoCapacity(tank, kind)}`
}

function equippedName(tank: TankState, slot: PartKind): string {
  const id = tank.parts[slot]
  return id ? PARTS[slot].find((candidate) => candidate.id === id)?.name || id : '未装备'
}

function slotSupported(tank: TankState, slot: PartKind): boolean {
  const definition = tankDefinition(tank)
  if (!definition || slot === 'engine' || slot === 'c') return true
  return definition.slots[slot] > 0
}

function addTankSelector(
  root: Container,
  tanks: TankState[],
  selected: number,
  x: number,
  y: number,
  width: number,
  layout: ContentLayout
) {
  const title = sectionTitle('随队战车', width)
  title.position.set(x, y)
  root.addChild(title)
  y += 25 * layout.unit
  if (!tanks.length) return y
  const gap = Math.max(4, 6 * layout.unit)
  const columns = Math.min(3, tanks.length)
  const chipWidth = (width - gap * (columns - 1)) / columns
  const chipHeight = Math.max(35, 38 * layout.unit)
  tanks.forEach((tank, index) => {
    const definition = tankDefinition(tank)
    const copy = layout.compact
      ? definition?.name.split(' ')[0] || tank.tankId
      : definition?.name || tank.tankId
    const chip = uiButton(copy, chipWidth, chipHeight, {
      active: selected === index,
      dense: true,
      value: layout.compact ? String(index + 1).padStart(2, '0') : undefined,
      onPress: () => store.shopTankTo(index)
    })
    chip.position.set(x + index * (chipWidth + gap), y)
    root.addChild(chip)
  })
  return y + chipHeight + gap
}

function addTankSummary(
  root: Container,
  tank: TankState,
  x: number,
  y: number,
  width: number,
  layout: ContentLayout
) {
  const definition = tankDefinition(tank)
  if (!definition) return y
  const load = store.tankLoad(tank)
  const capacity = tankLoadCapacity(tank)
  const name = label(
    definition.name,
    x,
    y,
    displayStyle(12 * layout.unit, { fill: UI_COLORS.paper })
  )
  fitText(name, width)
  root.addChild(name)
  y += 22 * layout.unit

  const statSize = 9.5 * layout.unit
  root.addChild(
    label(`SP ${tank.sp}/${definition.sp}`, x, y, utilityStyle(statSize, { fill: UI_COLORS.text })),
    label(
      `ARM ${tank.armor}/${definition.armorCap}`,
      x + width * 0.5,
      y,
      utilityStyle(statSize, { fill: UI_COLORS.text })
    )
  )
  y += 17 * layout.unit
  const spBar = progressBar(
    width * 0.47,
    tank.sp / Math.max(1, definition.sp),
    tank.sp / Math.max(1, definition.sp) < 0.3 ? UI_COLORS.warning : UI_COLORS.success,
    Math.max(5, 6 * layout.unit)
  )
  const armorBar = progressBar(
    width * 0.47,
    tank.armor / Math.max(1, definition.armorCap),
    UI_COLORS.info,
    Math.max(5, 6 * layout.unit)
  )
  spBar.position.set(x, y)
  armorBar.position.set(x + width * 0.5, y)
  root.addChild(spBar, armorBar)
  y += 14 * layout.unit
  root.addChild(
    label(
      `主炮 ${ammoText(tank, 'main')}  ·  S-E ${ammoText(tank, 'se')}`,
      x,
      y,
      utilityStyle(9 * layout.unit)
    )
  )
  rightLabel(
    root,
    `${load.toFixed(1)}/${capacity.toFixed(1)}t${store.tankOverweight(tank) ? ' 超载' : ''}`,
    x + width,
    y,
    9 * layout.unit,
    store.tankOverweight(tank) ? UI_COLORS.warning : UI_COLORS.muted
  )
  return y + 21 * layout.unit
}

function dataRow(
  root: Container,
  title: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  unit: number,
  warning = false
) {
  root.addChild(
    new Graphics()
      .rect(x, y, width, height - 2)
      .fill({ color: UI_COLORS.gunmetal, alpha: 0.68 })
      .rect(x, y + height - 3, width, 1)
      .fill({ color: UI_COLORS.steelDark, alpha: 0.8 })
  )
  root.addChild(label(title, x + 9 * unit, y + 5 * unit, utilityStyle(9 * unit)))
  rightLabel(
    root,
    value,
    x + width - 9 * unit,
    y + 5 * unit,
    9 * unit,
    warning ? UI_COLORS.warning : UI_COLORS.text
  )
}

function renderWeaponShop(root: Container, state: GameState, layout: ContentLayout) {
  const shop = state.shop!
  const { width, height, pad, unit, compact } = layout
  const innerWidth = width - pad * 2
  const columns = compact ? 4 : 8
  const rows = Math.ceil(WEAPON_TABS.length / columns)
  const gap = Math.max(3, 5 * unit)
  const tabHeight = Math.max(31, 34 * unit)
  const tabWidth = (innerWidth - gap * (columns - 1)) / columns
  let y = 44 * unit
  WEAPON_TABS.forEach((copy, index) => {
    const tab = uiButton(copy, tabWidth, tabHeight, {
      active: shop.tab === index,
      dense: true,
      onPress: () => store.shopTabTo(index)
    })
    tab.position.set(
      pad + (index % columns) * (tabWidth + gap),
      y + Math.floor(index / columns) * (tabHeight + gap)
    )
    root.addChild(tab)
  })
  y += rows * tabHeight + (rows - 1) * gap + 11 * unit

  const section = sectionTitle(
    shop.tab === 6 ? '寄售回收' : shop.tab === 7 ? '离开商店' : '商品清单',
    innerWidth
  )
  section.position.set(pad, y)
  root.addChild(section)
  y += 27 * unit

  if (shop.tab === 7) {
    const exit = uiButton('结束交易', innerWidth, Math.max(42, 48 * unit), {
      active: true,
      detail: '返回当前场景',
      value: 'A',
      onPress: () => store.shopConfirm()
    })
    exit.position.set(pad, y)
    root.addChild(exit)
    return
  }

  const shopList = store.shopListForUi().list as ShopListItem[]
  if (!shopList.length) {
    emptyState(
      root,
      shop.tab === 6 ? '背包中没有可出售的物品。' : '本店当前没有该类库存。',
      pad,
      y,
      innerWidth,
      unit
    )
    return
  }
  const entries = shopList.map((item) => ({
    label: item.name,
    detail: itemMeta(item.id),
    value: `${fmtG(item.price)}G`
  }))
  const rowHeight = Math.max(48, 53 * unit)
  renderSelectableList(
    root,
    entries,
    shop.idx,
    pad,
    y,
    innerWidth,
    height - y - pad,
    rowHeight,
    confirmSelection
  )
}

function renderTankGarage(root: Container, state: GameState, layout: ContentLayout) {
  const shop = state.shop!
  const session = shop.maintenance || { phase: 'garage' as const, items: [], result: [] }
  const { tanks, tank, index } = selectedServiceTank(state)
  const { width, height, pad, unit, compact } = layout
  const innerWidth = width - pad * 2
  let y = 44 * unit

  if (session.phase === 'garage') {
    y = addTankSelector(root, tanks, index, pad, y, innerWidth, layout)
    if (tank) y = addTankSummary(root, tank, pad, y, innerWidth, layout)
    else {
      emptyState(
        root,
        '接车台没有随队战车。库内车辆需先到自宅地下车库办理出库。',
        pad,
        y,
        innerWidth,
        unit
      )
      y += 58 * unit
    }
    const section = sectionTitle('工房业务', innerWidth)
    section.position.set(pad, y)
    root.addChild(section)
    y += 27 * unit
    const options = store.tankGarageMenuItems()
    const entries = options.map((option) => ({
      label: option,
      detail: option === '接车诊断' ? '检查底盘、装甲、部件与弹仓' : undefined
    }))
    renderSelectableList(
      root,
      entries,
      shop.idx,
      pad,
      y,
      innerWidth,
      height - y - pad,
      Math.max(39, 44 * unit),
      confirmSelection
    )
    return
  }

  if (session.phase === 'diagnosis') {
    const definition = tankDefinition(tank)
    if (!tank || !definition) {
      emptyState(root, '当前没有可诊断的随队战车。', pad, y, innerWidth, unit)
      return
    }
    const heading = label(`诊断报告 · ${definition.name}`, pad, y, displayStyle(12 * unit))
    fitText(heading, innerWidth)
    root.addChild(heading)
    y += 25 * unit
    const diagnosticRows = MOD_SLOTS.map(({ id, name }) => {
      const partId = tank.parts[id]
      const condition = tankPartCondition(tank, id)
      return {
        title: name,
        value: partId
          ? `${equippedName(tank, id)} · ${PART_CONDITION_LABELS[condition]}`
          : '未装备',
        warning: !!partId && condition !== 'normal'
      }
    })
    diagnosticRows.push(
      { title: '主炮弹仓', value: ammoText(tank, 'main'), warning: false },
      { title: 'S-E 弹仓', value: ammoText(tank, 'se'), warning: false }
    )
    const columns = compact && height >= 440 * unit ? 1 : 2
    const gap = 6 * unit
    const rowWidth = (innerWidth - gap * (columns - 1)) / columns
    const rowHeight = Math.max(26, 29 * unit)
    diagnosticRows.forEach((row, rowIndex) => {
      dataRow(
        root,
        row.title,
        row.value,
        pad + (rowIndex % columns) * (rowWidth + gap),
        y + Math.floor(rowIndex / columns) * rowHeight,
        rowWidth,
        rowHeight,
        unit,
        row.warning
      )
    })
    y += Math.ceil(diagnosticRows.length / columns) * rowHeight + 9 * unit
    const faultTitle = sectionTitle(`待处理项目 · ${session.items.length}`, innerWidth)
    faultTitle.position.set(pad, y)
    root.addChild(faultTitle)
    y += 25 * unit
    if (session.items.length) {
      const actionHeight = Math.max(42, 45 * unit)
      const room = Math.max(0, height - y - actionHeight - pad - 12 * unit)
      const maxRows = Math.max(1, Math.floor(room / Math.max(31, 35 * unit)))
      session.items.slice(0, maxRows).forEach((item, itemIndex) => {
        dataRow(
          root,
          item.label,
          item.detail,
          pad,
          y + itemIndex * Math.max(31, 35 * unit),
          innerWidth,
          Math.max(31, 35 * unit),
          unit,
          true
        )
      })
      y += Math.min(session.items.length, maxRows) * Math.max(31, 35 * unit)
      if (session.items.length > maxRows) {
        root.addChild(
          label(
            `另有 ${session.items.length - maxRows} 项，将在工单中完整显示`,
            pad,
            y,
            utilityStyle(8.5 * unit)
          )
        )
        y += 18 * unit
      }
    } else {
      root.addChild(
        label('未发现故障或补给缺口。', pad, y, bodyStyle(11 * unit, { fill: UI_COLORS.success }))
      )
      y += 27 * unit
    }
    const actionWidth = (innerWidth - 7 * unit) / 2
    const makeOrder = uiButton('生成维修工单', actionWidth, Math.max(39, 43 * unit), {
      active: true,
      onPress: () => store.shopConfirm()
    })
    const back = uiButton('返回接车台', actionWidth, Math.max(39, 43 * unit), {
      onPress: () => store.shopCancel()
    })
    makeOrder.position.set(pad, Math.min(y + 7 * unit, height - pad - makeOrder.height))
    back.position.set(pad + actionWidth + 7 * unit, makeOrder.y)
    root.addChild(makeOrder, back)
    return
  }

  if (session.phase === 'workorder') {
    const totals = maintenanceTotals(session.items)
    const section = sectionTitle('维修工单 · 选择执行项目', innerWidth)
    section.position.set(pad, y)
    root.addChild(section)
    y += 27 * unit
    const footerHeight = Math.max(84, 92 * unit)
    if (session.items.length) {
      const entries = session.items.map((item) => ({
        label: `${item.selected ? '■' : '□'} ${item.label}`,
        detail: item.detail,
        value: `${fmtG(item.cost)}G · ${maintenanceTimeLabel(item.minutes)}`
      }))
      y = renderSelectableList(
        root,
        entries,
        shop.idx,
        pad,
        y,
        innerWidth,
        height - y - footerHeight - pad,
        Math.max(49, 54 * unit),
        confirmSelection
      )
    } else {
      emptyState(root, '没有需要加入工单的项目。', pad, y, innerWidth, unit)
      y += 42 * unit
    }
    const footerY = height - pad - footerHeight
    divider(root, pad, footerY, innerWidth, UI_COLORS.brass)
    root.addChild(
      label(`已选 ${totals.selected} 项`, pad, footerY + 9 * unit, utilityStyle(9 * unit)),
      label(
        `${fmtG(totals.cost)}G · ${maintenanceTimeLabel(totals.minutes)}`,
        pad + innerWidth * 0.42,
        footerY + 9 * unit,
        utilityStyle(9 * unit, { fill: UI_COLORS.brassLight })
      )
    )
    const execute = uiButton('开始整备', innerWidth, Math.max(39, 43 * unit), {
      active: shop.idx === session.items.length,
      value: 'A',
      onPress: () => confirmSelection(session.items.length)
    })
    execute.position.set(pad, footerY + 31 * unit)
    root.addChild(execute)
    return
  }

  if (session.phase === 'result') {
    const section = sectionTitle('整备结算 · 工单已完成', innerWidth)
    section.position.set(pad, y)
    root.addChild(section)
    y += 29 * unit
    const lines = session.result.length ? session.result : ['整备完成。']
    const lineHeight = Math.max(25, 28 * unit)
    const resultFooter = Math.max(92, 102 * unit)
    const visibleCount = Math.max(1, Math.floor((height - y - pad - resultFooter) / lineHeight))
    const visibleLines = lines.slice(0, visibleCount)
    visibleLines.forEach((lineText, lineIndex) => {
      const row = label(
        `✓ ${lineText}`,
        pad,
        y + lineIndex * lineHeight,
        bodyStyle(11 * unit, { fill: UI_COLORS.success })
      )
      fitText(row, innerWidth)
      root.addChild(row)
    })
    y += visibleLines.length * lineHeight
    if (lines.length > visibleLines.length) {
      root.addChild(
        label(
          `另有 ${lines.length - visibleLines.length} 项已完成`,
          pad,
          y,
          utilityStyle(8.5 * unit)
        )
      )
      y += 18 * unit
    }
    y += 12 * unit
    const totals = maintenanceTotals(session.items)
    divider(root, pad, y, innerWidth, UI_COLORS.success)
    y += 10 * unit
    root.addChild(label(`费用 ${fmtG(totals.cost)}G`, pad, y, utilityStyle(10 * unit)))
    rightLabel(root, `耗时 ${maintenanceTimeLabel(totals.minutes)}`, pad + innerWidth, y, 10 * unit)
    y += 30 * unit
    const done = uiButton('交车返回', innerWidth, Math.max(41, 46 * unit), {
      active: true,
      value: 'A',
      onPress: () => store.shopConfirm()
    })
    done.position.set(pad, Math.min(y, height - pad - done.height))
    root.addChild(done)
    return
  }

  const section = sectionTitle('战车销售 · 库存车辆', innerWidth)
  section.position.set(pad, y)
  root.addChild(section)
  y += 28 * unit
  const list = store.shopListForUi().list as ShopListItem[]
  if (list.length) {
    renderSelectableList(
      root,
      list.map((item) => ({ label: item.name, value: `${fmtG(item.price)}G` })),
      shop.idx,
      pad,
      y,
      innerWidth,
      height - y - pad - 48 * unit,
      Math.max(41, 46 * unit),
      confirmSelection
    )
  } else {
    emptyState(root, '目前没有可出售的战车。', pad, y, innerWidth, unit)
  }
  const back = uiButton('返回接车台', Math.min(innerWidth, 210 * unit), Math.max(39, 43 * unit), {
    onPress: () => store.shopCancel()
  })
  back.position.set(pad, height - pad - back.height)
  root.addChild(back)
}

function modCandidates(state: GameState, tank: TankState) {
  const slot = state.shop?.slot
  if (!slot) return []
  const current = tank.parts[slot]
  const owned = Object.keys(state.inventory.parts).filter(
    (id) => state.inventory.parts[id] > 0 && PARTS[slot].some((part) => part.id === id)
  )
  const ids = [...(current ? [current] : []), ...owned.filter((id) => id !== current)]
  const currentLoad = store.tankLoad(tank)
  const currentPart = current ? PARTS[slot].find((part) => part.id === current) : undefined
  const currentCapacity = tankLoadCapacity(tank)
  return ids.map((id) => {
    const part = PARTS[slot].find((candidate) => candidate.id === id)!
    const load =
      currentLoad - (slot === 'engine' ? 0 : currentPart?.w || 0) + (slot === 'engine' ? 0 : part.w)
    const capacity = slot === 'engine' ? part.load || 0 : currentCapacity
    return {
      part,
      current: id === current,
      count: state.inventory.parts[id] || 0,
      load,
      capacity,
      overweight: load > capacity
    }
  })
}

function renderModShop(root: Container, state: GameState, layout: ContentLayout) {
  const shop = state.shop!
  const { tanks, tank, index } = selectedServiceTank(state)
  const { width, height, pad, unit } = layout
  const innerWidth = width - pad * 2
  let y = 44 * unit
  y = addTankSelector(root, tanks, index, pad, y, innerWidth, layout)
  if (!tank) {
    emptyState(
      root,
      '没有随队战车可供改造。库内车辆需先在自宅地下车库办理出库。',
      pad,
      y,
      innerWidth,
      unit
    )
    const back = uiButton('离开改造工房', innerWidth, Math.max(41, 46 * unit), {
      active: true,
      onPress: () => store.shopCancel()
    })
    back.position.set(pad, Math.min(height - pad - back.height, y + 70 * unit))
    root.addChild(back)
    return
  }
  y = addTankSummary(root, tank, pad, y, innerWidth, layout)
  const definition = tankDefinition(tank)!

  if (shop.tab === 0) {
    const section = sectionTitle('改造项目', innerWidth)
    section.position.set(pad, y)
    root.addChild(section)
    y += 27 * unit
    const entries = [
      { label: '更换装备', detail: '从仓库选择主炮、副炮、S-E、发动机或 C 装置' },
      {
        label: '装甲片补给',
        detail: `每次补充 ${ARMOR_PACK_SIZE} 装甲片`,
        value: `${ARMOR_PACK_COST}G`
      },
      { label: '查看状态', detail: '检查底盘参数、载重与当前装备' }
    ]
    renderSelectableList(
      root,
      entries,
      shop.idx,
      pad,
      y,
      innerWidth,
      height - y - pad,
      Math.max(49, 54 * unit),
      confirmSelection
    )
    return
  }

  if (shop.tab === 1) {
    const section = sectionTitle('选择改造部位', innerWidth)
    section.position.set(pad, y)
    root.addChild(section)
    y += 27 * unit
    const entries = MOD_SLOTS.map((slot) => ({
      label: slot.name,
      value: slotSupported(tank, slot.id) ? equippedName(tank, slot.id) : '无槽位',
      disabled: !slotSupported(tank, slot.id)
    }))
    renderSelectableList(
      root,
      entries,
      shop.idx,
      pad,
      y,
      innerWidth,
      height - y - pad,
      Math.max(39, 44 * unit),
      confirmSelection
    )
    return
  }

  if (shop.tab === 2) {
    const slotName = MOD_SLOTS.find((slot) => slot.id === shop.slot)?.name || '部件'
    const section = sectionTitle(`${slotName}换装 · 仓库部件`, innerWidth)
    section.position.set(pad, y)
    root.addChild(section)
    y += 27 * unit
    const candidates = modCandidates(state, tank)
    if (!candidates.length) {
      emptyState(root, '仓库中没有该部位的可换装部件。', pad, y, innerWidth, unit)
      return
    }
    const entries = candidates.map((candidate) => ({
      label: candidate.part.name,
      detail: `${partStats(candidate.part)} · 换装后 ${candidate.load.toFixed(1)}/${candidate.capacity.toFixed(1)}t${candidate.overweight ? ' · 超载' : ''}`,
      value: candidate.current ? '装备中' : `库存 ×${candidate.count}`
    }))
    renderSelectableList(
      root,
      entries,
      shop.idx,
      pad,
      y,
      innerWidth,
      height - y - pad,
      Math.max(55, 62 * unit),
      confirmSelection
    )
    return
  }

  if (shop.tab === 3) {
    const section = sectionTitle('装甲片补给', innerWidth)
    section.position.set(pad, y)
    root.addChild(section)
    y += 31 * unit
    root.addChild(
      label(
        `当前 ${tank.armor}/${definition.armorCap}`,
        pad,
        y,
        displayStyle(15 * unit, { fill: UI_COLORS.paper })
      )
    )
    y += 29 * unit
    const armorBar = progressBar(
      innerWidth,
      tank.armor / Math.max(1, definition.armorCap),
      UI_COLORS.info,
      Math.max(9, 11 * unit)
    )
    armorBar.position.set(pad, y)
    root.addChild(armorBar)
    y += 30 * unit
    const fill = uiButton(`补充 ${ARMOR_PACK_SIZE} 装甲片`, innerWidth, Math.max(44, 50 * unit), {
      active: true,
      detail: tank.armor >= definition.armorCap ? '装甲已经补满' : '可连续购买，直到装甲上限',
      value: `${ARMOR_PACK_COST}G`,
      onPress: () => store.shopConfirm()
    })
    fill.position.set(pad, y)
    root.addChild(fill)
    return
  }

  const section = sectionTitle(`${definition.name} · 状态`, innerWidth)
  section.position.set(pad, y)
  root.addChild(section)
  y += 28 * unit
  const load = store.tankLoad(tank)
  const capacity = tankLoadCapacity(tank)
  const status = [
    ['底盘防御', String(definition.def), false],
    ['速度', String(definition.speed), false],
    ['载重', `${load.toFixed(1)}/${capacity.toFixed(1)}t`, store.tankOverweight(tank)],
    ...MOD_SLOTS.map(
      (slot) => [slot.name, equippedName(tank, slot.id), false] as [string, string, boolean]
    )
  ] as [string, string, boolean][]
  const columns = layout.compact && height >= 430 * unit ? 1 : 2
  const gap = 6 * unit
  const rowWidth = (innerWidth - gap * (columns - 1)) / columns
  const rowHeight = Math.max(28, 31 * unit)
  status.forEach(([title, value, warning], rowIndex) => {
    dataRow(
      root,
      title,
      value,
      pad + (rowIndex % columns) * (rowWidth + gap),
      y + Math.floor(rowIndex / columns) * rowHeight,
      rowWidth,
      rowHeight,
      unit,
      warning
    )
  })
  y += Math.ceil(status.length / columns) * rowHeight + 10 * unit
  const back = uiButton('返回改造菜单', Math.min(innerWidth, 230 * unit), Math.max(39, 44 * unit), {
    active: true,
    onPress: () => store.shopCancel()
  })
  back.position.set(pad, Math.min(y, height - pad - back.height))
  root.addChild(back)
}

function renderInn(root: Container, state: GameState, layout: ContentLayout) {
  const shop = state.shop!
  const { width, height, pad, unit } = layout
  const innerWidth = width - pad * 2
  let y = 47 * unit
  const greeting = label(
    '宿屋老板：要休息一晚，还是登记旅途记录？',
    pad,
    y,
    bodyStyle(12 * unit, {
      fill: UI_COLORS.paper,
      wordWrap: true,
      wordWrapWidth: innerWidth
    })
  )
  root.addChild(greeting)
  y += Math.max(45, greeting.height + 16 * unit)
  const entries = [
    { label: '住宿', detail: '回复全体人员 HP', value: `${store.innCost()}G` },
    { label: '登记旅途记录', detail: '保存当前进度', value: '免费' },
    { label: '离开宿屋' }
  ]
  renderSelectableList(
    root,
    entries,
    shop.idx,
    pad,
    y,
    innerWidth,
    height - y - pad,
    Math.max(48, 54 * unit),
    confirmSelection
  )
}

function renderBountyBoard(root: Container, state: GameState, layout: ContentLayout) {
  const { width, height, pad, unit, compact } = layout
  const innerWidth = width - pad * 2
  const y = 44 * unit
  const available = height - y - pad - Math.max(48, 52 * unit)
  const columns = !compact || available < 390 * unit ? 2 : 1
  const gap = Math.max(5, 7 * unit)
  const rows = Math.ceil(BOUNTIES.length / columns)
  const rowHeight = Math.max(31, Math.min(43 * unit, available / Math.max(1, rows)))
  const rowWidth = (innerWidth - gap * (columns - 1)) / columns
  BOUNTIES.forEach((bounty, index) => {
    const column = Math.floor(index / rows)
    const rowIndex = index % rows
    const x = pad + column * (rowWidth + gap)
    const rowY = y + rowIndex * rowHeight
    const claimed = !!state.bounties.claimed[bounty.id]
    const killed = !!state.bounties.killed[bounty.id]
    const color = claimed ? UI_COLORS.steel : killed ? UI_COLORS.brassLight : UI_COLORS.text
    root.addChild(
      new Graphics()
        .rect(x, rowY, rowWidth, rowHeight - 3)
        .fill({
          color: killed && !claimed ? 0x3b3325 : UI_COLORS.gunmetal,
          alpha: claimed ? 0.46 : 0.78
        })
        .rect(x, rowY, 3 * unit, rowHeight - 3)
        .fill({ color: claimed ? UI_COLORS.steel : killed ? UI_COLORS.brass : UI_COLORS.steelDark })
    )
    const title = label(
      `${claimed ? '✓' : killed ? '★' : '·'} ${bounty.name}`,
      x + 9 * unit,
      rowY + 4 * unit,
      bodyStyle(9.5 * unit, { fill: color })
    )
    fitText(title, rowWidth - 94 * unit)
    root.addChild(title)
    rightLabel(
      root,
      `${fmtG(bounty.gold)}G`,
      x + rowWidth - 7 * unit,
      rowY + 5 * unit,
      8.5 * unit,
      color
    )
    if (rowHeight >= 36 * unit) {
      const location = label(bounty.loc, x + 9 * unit, rowY + 20 * unit, utilityStyle(7.5 * unit))
      fitText(location, rowWidth - 18 * unit, 0.58)
      root.addChild(location)
    }
  })
  const unclaimed = BOUNTIES.filter(
    (bounty) => state.bounties.killed[bounty.id] && !state.bounties.claimed[bounty.id]
  ).length
  const claim = uiButton('领取全部赏金', innerWidth, Math.max(42, 47 * unit), {
    active: unclaimed > 0,
    detail: unclaimed > 0 ? `${unclaimed} 项讨伐记录待结算` : '当前没有可领取的赏金',
    value: 'A',
    onPress: () => store.shopConfirm()
  })
  claim.position.set(pad, height - pad - claim.height)
  root.addChild(claim)
}

function shopBodyTitle(state: GameState): string {
  const shop = state.shop!
  if (shop.type === 'weapon') return '武器、装备与补给'
  if (shop.type === 'mod') {
    return (
      ['改造工房', '选择改造部位', '仓库换装', '装甲片补给', '战车状态'][shop.tab] || '改造工房'
    )
  }
  if (shop.type === 'tank') {
    const phase = shop.maintenance?.phase || 'garage'
    return {
      garage: '战车工房 · 接车台',
      diagnosis: '战车工房 · 诊断报告',
      workorder: '战车工房 · 维修工单',
      result: '战车工房 · 整备结算',
      buy: '战车工房 · 车辆销售'
    }[phase]
  }
  if (shop.type === 'inn') return '住宿与旅途记录'
  if (shop.type === 'bounty') return '猎人悬赏榜'
  return shop.name
}

function renderMessage(
  root: Container,
  text: string,
  width: number,
  safeHeight: number,
  edge: number,
  unit: number
) {
  const boxWidth = Math.min(width - edge * 2, 620 * unit)
  const boxHeight = Math.max(52, 58 * unit)
  const box = panel(boxWidth, boxHeight, {
    accent: UI_COLORS.warning,
    alpha: 0.98,
    label: 'NOTICE'
  })
  box.position.set((width - boxWidth) / 2, safeHeight - edge - boxHeight)
  const copy = label(
    text,
    14 * unit,
    15 * unit,
    bodyStyle(11 * unit, {
      fill: UI_COLORS.brassLight,
      wordWrap: true,
      wordWrapWidth: boxWidth - 28 * unit,
      align: 'center'
    })
  )
  copy.anchor.set(0.5, 0)
  copy.x = boxWidth / 2
  box.addChild(copy)
  root.addChild(box)
}

export function renderShop(
  state: GameState,
  width: number,
  height: number,
  scale: number,
  bottomReserve: number
): Container {
  const root = new Container()
  const shop = state.shop
  if (!shop) return root

  const safeHeight = Math.max(1, height - bottomReserve)
  const edge = uiEdgeFor(width, safeHeight)
  const unit = Math.max(0.78, Math.min(1.18, scale))
  const compact = width < 720 || safeHeight < 500
  const gap = Math.max(6, 9 * unit)
  const headerHeight = Math.max(54, 58 * unit)
  const cardWidth = Math.max(120, Math.min(width - edge * 2, 1080 * unit))
  const cardX = (width - cardWidth) / 2
  const bodyY = edge + headerHeight + gap
  const bodyHeight = Math.max(120, safeHeight - bodyY - edge)

  const scrim = new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: UI_COLORS.black, alpha: 0.72 })
  scrim.eventMode = 'static'
  scrim.on('pointertap', (event) => event.stopPropagation())
  root.addChild(scrim)

  const header = panel(cardWidth, headerHeight, {
    accent: UI_COLORS.brass,
    alpha: 0.98
  })
  header.position.set(cardX, edge)
  const backWidth = Math.max(62, 72 * unit)
  const back = uiButton('返回', backWidth, headerHeight - 16 * unit, {
    onPress: () => store.shopCancel(),
    dense: true
  })
  back.position.set(cardWidth - backWidth - 8 * unit, 8 * unit)
  const name = label(shop.name, 14 * unit, 12 * unit, displayStyle(15 * unit))
  fitText(name, cardWidth - backWidth - 148 * unit, 0.55)
  header.addChild(name)
  rightLabel(
    header,
    `${fmtG(state.gold)} G`,
    cardWidth - backWidth - 17 * unit,
    17 * unit,
    11 * unit,
    UI_COLORS.brassLight
  )
  header.addChild(back)
  root.addChild(header)

  const body = panel(cardWidth, bodyHeight, {
    title: shopBodyTitle(state),
    accent:
      shop.type === 'bounty'
        ? UI_COLORS.warning
        : shop.type === 'inn'
          ? UI_COLORS.info
          : UI_COLORS.brass,
    alpha: 0.98,
    label: 'TERMINAL'
  })
  body.position.set(cardX, bodyY)
  const layout: ContentLayout = {
    width: cardWidth,
    height: bodyHeight,
    pad: Math.max(10, 14 * unit),
    unit,
    compact
  }

  if (shop.type === 'weapon') renderWeaponShop(body, state, layout)
  else if (shop.type === 'tank') renderTankGarage(body, state, layout)
  else if (shop.type === 'mod') renderModShop(body, state, layout)
  else if (shop.type === 'inn') renderInn(body, state, layout)
  else if (shop.type === 'bounty') renderBountyBoard(body, state, layout)
  else
    emptyState(
      body,
      '该服务终端暂不可用。',
      layout.pad,
      48 * unit,
      cardWidth - layout.pad * 2,
      unit
    )
  root.addChild(body)

  if (shop.msg && shop.msgT > 0) renderMessage(root, shop.msg, width, safeHeight, edge, unit)
  return root
}
