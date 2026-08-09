import { Container, Graphics, Text } from 'pixi.js'
import type { GameState } from '@/game/types'
import { ROOMS, TOWNS } from '@/game/data/maps'
import { TANKS } from '@/game/data/equipment'
import { store } from '@/game/core/store'
import { fmtG } from '@/game/utils'
import { formatWorldTime, weatherLabel } from '@/game/systems/environment'
import { currentRegion, dangerPips } from '@/game/systems/regions'
import { label, panel, progressBar } from '@/game/pixi/ui/primitives'
import { UI_COLORS, bodyStyle, displayStyle, utilityStyle } from '@/game/pixi/ui/theme'

const MAP_SCREENS = new Set(['world', 'town', 'cave', 'room'])

export interface HudLayout {
  edge: number
  compact: boolean
  leftWidth: number
  hudHeight: number
  moneyWidth: number
  moneyX: number
  tankWidth: number
  tankX: number
}

export function hudLayout(width: number, height: number, scale: number): HudLayout {
  const edge = Math.round(Math.max(10, Math.min(24, Math.min(width, height) * 0.024)))
  const compact = width < 720
  const leftWidth = Math.min(compact ? width - edge * 2 : 590 * scale, width - edge * 2)
  const hudHeight = Math.round((compact ? 82 : 74) * scale)
  const moneyWidth = Math.round((compact ? 124 : 168) * scale)
  const tankWidth = Math.round((compact ? 168 : 244) * scale)
  return {
    edge,
    compact,
    leftWidth,
    hudHeight,
    moneyWidth,
    moneyX: width - edge - moneyWidth,
    tankWidth,
    tankX: width - edge - tankWidth
  }
}

export function tutorialObjective(step: unknown): string {
  switch (Number(step)) {
    case 0:
      return '和父亲谈谈'
    case 1:
      return '前往南侧洞窟，取回旧战车'
    case 2:
      return '把旧战车开回拉多镇'
    case 3:
      return '回自宅二楼休息'
    case 4:
      return '下楼找父亲学习战车整备'
    case 5:
      return '去老乔工房诊断并维修旧战车'
    case 6:
      return '完成副炮清杂训练'
    case 7:
      return '完成主炮破甲训练'
    case 8:
      return '完成 S-E 群攻训练'
    case 9:
      return '沿公路前往麦镇，寻找机械师美娜'
    case 10:
      return '进入情报屋查看悬赏榜'
    case 11:
      return '整备战车，前往波布湖区讨伐水怪'
    case 12:
      return '回情报屋领取水怪赏金'
    default:
      return ''
  }
}

function locationName(state: GameState): string {
  if (state.map === 'world') return '荒原公路'
  return (
    TOWNS.find((town) => town.id === state.map)?.name ||
    ROOMS.find((room) => room.id === state.map)?.name ||
    '未知区域'
  )
}

export function renderHud(
  state: GameState,
  width: number,
  height: number,
  scale: number
): Container {
  const root = new Container()
  if (!MAP_SCREENS.has(state.screen)) return root

  const layout = hudLayout(width, height, scale)
  const { edge, compact, leftWidth, hudHeight } = layout
  const locationPanel = panel(leftWidth, hudHeight, {
    alpha: 0.86,
    accent: UI_COLORS.brass,
    label: state.map === 'world' ? 'NAV' : 'LOCAL'
  })
  locationPanel.position.set(edge, edge)
  root.addChild(locationPanel)

  const place = label(
    locationName(state),
    16 * scale,
    12 * scale,
    displayStyle(16 * scale, {
      fill: UI_COLORS.paper
    })
  )
  locationPanel.addChild(place)
  const outdoors = state.map === 'world' || TOWNS.some((town) => town.id === state.map)
  const clock = `DAY ${state.environment.day}  ${formatWorldTime(state.environment)}`
  const environment = outdoors ? `${clock}  ${weatherLabel(state.environment.weather)}` : clock
  const time = label(
    environment,
    16 * scale,
    36 * scale,
    utilityStyle(10.5 * scale, {
      fill: outdoors ? UI_COLORS.info : UI_COLORS.muted
    })
  )
  locationPanel.addChild(time)

  const objective = tutorialObjective(state.flags.tutorial_step)
  if (objective) {
    const objectiveText = label(
      `任务 / ${objective}`,
      16 * scale,
      53 * scale,
      bodyStyle(10.5 * scale, {
        fill: UI_COLORS.brassLight
      })
    )
    objectiveText.style.wordWrap = true
    objectiveText.style.wordWrapWidth = leftWidth - 32 * scale
    locationPanel.addChild(objectiveText)
  }

  if (!compact) {
    const region = currentRegion(state)
    if (region) {
      const regionWidth = Math.round(224 * scale)
      const regionPanel = panel(regionWidth, Math.round(48 * scale), {
        alpha: 0.84,
        accent: region.dangerLevel >= 4 ? UI_COLORS.warning : UI_COLORS.info,
        label: 'ZONE'
      })
      regionPanel.position.set(edge, edge + hudHeight + Math.round(7 * scale))
      const regionName = label(
        region.name,
        14 * scale,
        9 * scale,
        bodyStyle(11 * scale, {
          fill: UI_COLORS.text
        })
      )
      const threat = label(
        `威胁 ${dangerPips(region)}  LV.${region.recommendedLevel[0]}-${region.recommendedLevel[1]}`,
        14 * scale,
        26 * scale,
        utilityStyle(9 * scale, {
          fill: region.dangerLevel >= 4 ? UI_COLORS.warning : UI_COLORS.muted
        })
      )
      regionPanel.addChild(regionName, threat)
      root.addChild(regionPanel)
    }
  }

  const moneyWidth = layout.moneyWidth
  const moneyPanel = panel(moneyWidth, Math.round(50 * scale), {
    alpha: 0.88,
    accent: UI_COLORS.brass,
    label: 'CREDIT'
  })
  moneyPanel.position.set(layout.moneyX, edge)
  const money = label(
    `${fmtG(state.gold)} G`,
    moneyWidth - 14 * scale,
    16 * scale,
    utilityStyle(15 * scale, {
      fill: UI_COLORS.brassLight,
      align: 'right'
    })
  )
  money.anchor.set(1, 0)
  moneyPanel.addChild(money)
  root.addChild(moneyPanel)

  if (state.riding) {
    const tank = store.getActiveTank()
    const definition = tank ? TANKS.find((item) => item.id === tank.tankId) : null
    if (tank && definition) {
      const tankWidth = layout.tankWidth
      const tankPanel = panel(tankWidth, Math.round(62 * scale), {
        alpha: 0.86,
        accent: tank.sp / Math.max(1, definition.sp) < 0.3 ? UI_COLORS.warning : UI_COLORS.success,
        label: 'CHASSIS'
      })
      tankPanel.position.set(layout.tankX, edge + Math.round(57 * scale))
      tankPanel.addChild(
        label(definition.name, 13 * scale, 9 * scale, bodyStyle(10.5 * scale)),
        label(`SP ${tank.sp}/${definition.sp}`, 13 * scale, 29 * scale, utilityStyle(9 * scale)),
        label(
          `ARM ${tank.armor}/${definition.armorCap}`,
          tankWidth - 13 * scale,
          29 * scale,
          utilityStyle(9 * scale, { align: 'right' })
        )
      )
      const armorLabel = tankPanel.children[tankPanel.children.length - 1]
      if (armorLabel instanceof Text) armorLabel.anchor.set(1, 0)
      const bar = progressBar(
        tankWidth - 26 * scale,
        tank.sp / Math.max(1, definition.sp),
        tank.sp / Math.max(1, definition.sp) < 0.3 ? UI_COLORS.warning : UI_COLORS.success,
        Math.max(5, 6 * scale)
      )
      bar.position.set(13 * scale, 47 * scale)
      tankPanel.addChild(bar)
      root.addChild(tankPanel)
    }
  }

  const scan = new Graphics()
    .moveTo(edge, height - edge)
    .lineTo(edge + Math.min(120 * scale, width * 0.16), height - edge)
    .stroke({ color: UI_COLORS.brass, width: 2, alpha: 0.55 })
  root.addChild(scan)
  return root
}
