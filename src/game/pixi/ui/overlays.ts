import { Container, Graphics, Rectangle, Text } from 'pixi.js'
import type { BattleFighter, GameState } from '@/game/types'
import { store } from '@/game/core/store'
import * as input from '@/game/engine/input'
import { ITEMS } from '@/game/data/equipment'
import { ENDING, INTRO } from '@/game/data/story'
import { formatWorldTime } from '@/game/systems/environment'
import { tankConditionFor } from '@/game/assets/tanks'
import {
  fitText,
  label,
  panel,
  progressBar,
  sectionTitle,
  uiButton,
  uiEdgeFor
} from '@/game/pixi/ui/primitives'
import { UI_COLORS, bodyStyle, displayStyle, utilityStyle } from '@/game/pixi/ui/theme'

function destroyableScrim(width: number, height: number, alpha = 0.52): Graphics {
  return new Graphics().rect(0, 0, width, height).fill({ color: UI_COLORS.black, alpha })
}

export function renderDialog(
  state: GameState,
  width: number,
  height: number,
  scale: number,
  bottomReserve: number
): Container {
  const root = new Container()
  const dialog = state.dialog
  if (!dialog) return root
  const edge = uiEdgeFor(width, height)
  const boxWidth = Math.min(width - edge * 2, 1040 * scale)
  const boxHeight = Math.max(104, 122 * scale)
  const box = panel(boxWidth, boxHeight, {
    accent: UI_COLORS.brass,
    alpha: 0.97,
    label: `COM ${dialog.idx + 1}/${dialog.texts.length}`
  })
  box.position.set((width - boxWidth) / 2, height - bottomReserve - edge - boxHeight)
  const full = dialog.texts[dialog.idx] || ''
  const shown = full.slice(0, Math.floor(dialog.reveal))
  const colon = shown.indexOf('：')
  let copy = shown
  if (colon > 0 && colon < 10) {
    const speaker = label(
      shown.slice(0, colon),
      18 * scale,
      13 * scale,
      displayStyle(13 * scale, {
        fill: UI_COLORS.brassLight
      })
    )
    box.addChild(speaker)
    copy = shown.slice(colon + 1)
  }
  const textY = colon > 0 && colon < 10 ? 39 * scale : 22 * scale
  const text = label(
    copy,
    18 * scale,
    textY,
    bodyStyle(Math.max(14, 16 * scale), {
      fill: UI_COLORS.text,
      wordWrap: true,
      wordWrapWidth: boxWidth - 36 * scale,
      lineHeight: Math.max(23, 25 * scale)
    })
  )
  box.addChild(text)
  if (Math.floor(dialog.reveal) >= full.length) {
    const next = label(
      '▼',
      boxWidth - 20 * scale,
      boxHeight - 23 * scale,
      utilityStyle(12 * scale, {
        fill: UI_COLORS.brassLight
      })
    )
    next.anchor.set(1, 0)
    box.addChild(next)
  }
  box.eventMode = 'static'
  box.cursor = 'pointer'
  box.hitArea = new Rectangle(0, 0, boxWidth, boxHeight)
  box.on('pointertap', (event) => {
    event.stopPropagation()
    input.press('a')
  })
  root.addChild(box)
  return root
}

export function renderBanner(
  state: GameState,
  width: number,
  height: number,
  scale: number
): Container {
  const root = new Container()
  if (state.bannerT <= 0 || !state.bannerText) return root
  const boxWidth = Math.min(width - 32, Math.max(260 * scale, state.bannerText.length * 19 * scale))
  const box = panel(boxWidth, 58 * scale, { accent: UI_COLORS.brass, alpha: 0.95, label: 'NOTICE' })
  box.position.set((width - boxWidth) / 2, height * 0.42)
  const text = label(
    state.bannerText,
    boxWidth / 2,
    19 * scale,
    displayStyle(15 * scale, {
      fill: UI_COLORS.brassLight,
      align: 'center'
    })
  )
  text.anchor.set(0.5, 0)
  fitText(text, boxWidth - 32)
  box.addChild(text)
  root.addChild(box)
  return root
}

export function renderIntro(
  state: GameState,
  width: number,
  height: number,
  scale: number
): Container {
  const root = new Container()
  root.addChild(new Graphics().rect(0, 0, width, height).fill(UI_COLORS.black))
  const lines = INTRO.slice(0, state.intro.idx + 1)
  const lineHeight = Math.max(34, 42 * scale)
  const startY = (height - lines.length * lineHeight) / 2
  lines.forEach((lineText, index) => {
    const line = label(
      lineText,
      width / 2,
      startY + index * lineHeight,
      bodyStyle(16 * scale, {
        fill: index === lines.length - 1 ? UI_COLORS.paper : UI_COLORS.muted,
        align: 'center'
      })
    )
    line.anchor.set(0.5, 0)
    fitText(line, width - 40)
    root.addChild(line)
  })
  if (state.intro.idx >= INTRO.length - 1) {
    const hint = label(
      'A / ENTER  点火',
      width / 2,
      startY + lines.length * lineHeight + 18 * scale,
      utilityStyle(12 * scale, {
        fill: UI_COLORS.brassLight,
        align: 'center'
      })
    )
    hint.anchor.set(0.5, 0)
    root.addChild(hint)
  }
  return root
}

export function renderPassword(
  state: GameState,
  width: number,
  height: number,
  scale: number
): Container {
  const root = new Container()
  if (!state.pass) return root
  root.addChild(destroyableScrim(width, height, 0.64))
  const cardWidth = Math.min(width - 28, 520 * scale)
  const cardHeight = Math.min(height - 28, 300 * scale)
  const card = panel(cardWidth, cardHeight, {
    title: '地狱门认证终端',
    accent: UI_COLORS.warning,
    label: 'SECURITY'
  })
  card.position.set((width - cardWidth) / 2, (height - cardHeight) / 2)
  card.addChild(
    label(
      '输入四位机械锁密码',
      cardWidth / 2,
      52 * scale,
      bodyStyle(12 * scale, {
        fill: UI_COLORS.muted,
        align: 'center'
      })
    )
  )
  const sub = card.children[card.children.length - 1]
  if (sub instanceof Text) sub.anchor.set(0.5, 0)
  const digitSize = Math.min(70 * scale, (cardWidth - 70 * scale) / 4)
  state.pass.digits.forEach((digit, index) => {
    const digitPanel = panel(digitSize, digitSize, {
      alpha: 1,
      accent: state.pass!.pos === index ? UI_COLORS.brassLight : UI_COLORS.steel,
      inset: true
    })
    digitPanel.position.set(24 * scale + index * (digitSize + 8 * scale), 91 * scale)
    const number = label(
      String(digit),
      digitSize / 2,
      digitSize * 0.17,
      displayStyle(digitSize * 0.5, {
        fill: state.pass!.pos === index ? UI_COLORS.brassLight : UI_COLORS.text,
        align: 'center'
      })
    )
    number.anchor.set(0.5, 0)
    digitPanel.addChild(number)
    digitPanel.eventMode = 'static'
    digitPanel.cursor = 'pointer'
    digitPanel.on('pointertap', () => {
      if (state.pass) state.pass.pos = index
    })
    card.addChild(digitPanel)
  })
  const controls = [
    ['−', 'down'],
    ['+', 'up'],
    ['←', 'left'],
    ['→', 'right'],
    ['认证', 'a'],
    ['退出', 'b']
  ] as const
  const controlWidth =
    (cardWidth - 48 * scale - (controls.length - 1) * 6 * scale) / controls.length
  controls.forEach(([copy, key], index) => {
    const button = uiButton(copy, controlWidth, 38 * scale, {
      active: key === 'a',
      dense: true,
      onPress: () => store.passPress(key)
    })
    button.position.set(24 * scale + index * (controlWidth + 6 * scale), cardHeight - 58 * scale)
    card.addChild(button)
  })
  root.addChild(card)
  return root
}

function fighterStatus(fighter: BattleFighter): { text: string; ratio: number; color: number } {
  if (!fighter.tank || fighter.tank.sp <= 0) {
    const ratio = fighter.member.hp / Math.max(1, fighter.member.maxHp)
    return {
      text: `HP ${fighter.member.hp}/${fighter.member.maxHp}`,
      ratio,
      color: ratio <= 0.25 ? UI_COLORS.warning : UI_COLORS.success
    }
  }
  const maxSp = fighter.tank.tankDef?.sp || fighter.tank.sp
  const condition = tankConditionFor(fighter.tank.sp, maxSp)
  return {
    text: `SP ${fighter.tank.sp}  ARM ${fighter.tank.armor}`,
    ratio: fighter.tank.sp / Math.max(1, maxSp),
    color:
      condition === 'critical' || condition === 'disabled'
        ? UI_COLORS.warning
        : condition === 'damaged'
          ? UI_COLORS.brass
          : UI_COLORS.success
  }
}

export interface BattleUiLayout {
  edge: number
  portrait: boolean
  lowerY: number
  statusWidth: number
  statusHeight: number
  logWidth: number
  logHeight: number
  commandWidth: number
}

export function battleUiLayout(
  width: number,
  height: number,
  scale: number,
  bottomReserve: number
): BattleUiLayout {
  const edge = uiEdgeFor(width, height)
  const portrait = width / height < 1.2
  const lowerY = height - bottomReserve - edge
  const statusWidth = Math.min(portrait ? width - edge * 2 : 390 * scale, width - edge * 2)
  const statusHeight = Math.max(92, 116 * scale)
  const logWidth = Math.min(portrait ? width - edge * 2 : 500 * scale, width - edge * 2)
  return {
    edge,
    portrait,
    lowerY,
    statusWidth,
    statusHeight,
    logWidth,
    logHeight: statusHeight,
    commandWidth: portrait
      ? Math.min(width - edge * 2, Math.max(204, width * 0.6))
      : Math.min(300 * scale, width - edge * 2)
  }
}

export function renderBattleUi(
  state: GameState,
  width: number,
  height: number,
  scale: number,
  bottomReserve: number
): Container {
  const root = new Container()
  const battle = state.battle
  if (!battle) return root
  const { edge, portrait, lowerY, statusWidth, statusHeight, logWidth, logHeight, commandWidth } =
    battleUiLayout(width, height, scale, bottomReserve)
  const status = panel(statusWidth, statusHeight, {
    title: '乘员 / 车况',
    accent: UI_COLORS.success,
    alpha: 0.92,
    label: `ROUND ${battle.round}`
  })
  status.position.set(edge, lowerY - statusHeight)
  const fighters = battle.fighters.slice(0, 3)
  const rowHeight = (statusHeight - 42 * scale) / Math.max(1, fighters.length)
  fighters.forEach((fighter, index) => {
    const info = fighterStatus(fighter)
    const y = 39 * scale + index * rowHeight
    status.addChild(
      label(fighter.member.name, 14 * scale, y, bodyStyle(10.5 * scale)),
      label(
        info.text,
        statusWidth - 14 * scale,
        y,
        utilityStyle(9.5 * scale, {
          fill: info.color,
          align: 'right'
        })
      )
    )
    const value = status.children[status.children.length - 1]
    if (value instanceof Text) value.anchor.set(1, 0)
    const bar = progressBar(
      statusWidth - 28 * scale,
      info.ratio,
      info.color,
      Math.max(4, 5 * scale)
    )
    bar.position.set(14 * scale, y + 17 * scale)
    status.addChild(bar)
  })
  root.addChild(status)

  const logPanel = panel(logWidth, logHeight, {
    title: '战斗记录',
    accent: UI_COLORS.info,
    alpha: 0.92,
    label: 'COMBAT LOG'
  })
  logPanel.position.set(
    portrait ? edge : width - edge - logWidth,
    portrait ? edge : lowerY - logHeight
  )
  battle.log.slice(-3).forEach((lineText, index) => {
    const line = label(
      lineText,
      14 * scale,
      40 * scale + index * 22 * scale,
      bodyStyle(10.5 * scale, {
        fill: index === Math.min(2, battle.log.length - 1) ? UI_COLORS.text : UI_COLORS.muted,
        wordWrap: true,
        wordWrapWidth: logWidth - 28 * scale
      })
    )
    logPanel.addChild(line)
  })
  root.addChild(logPanel)

  if (battle.cmd && battle.phase === 'fight') {
    let entries: { label: string; value?: string; disabled?: boolean }[] = []
    if (battle.cmd.mode === 'menu') {
      entries = store.battleMenuItems().map((item) => ({ label: item }))
    } else if (battle.cmd.mode === 'target') {
      entries = battle.mobs.map((mob) => ({
        label: mob.hp > 0 ? mob.name : `× ${mob.name}`,
        value: `HP ${Math.max(0, mob.hp)}`,
        disabled: mob.hp <= 0
      }))
    } else {
      entries = Object.keys(state.inventory.items)
        .filter((id) => {
          const item = ITEMS[id]
          return (
            state.inventory.items[id] > 0 && !!(item.hp || item.dmg || item.smoke || item.repair)
          )
        })
        .map((id) => ({ label: ITEMS[id].name, value: `×${state.inventory.items[id]}` }))
    }
    const rowHeight = Math.max(35, 40 * scale)
    const hasBack = battle.cmd.mode !== 'menu'
    const commandHeight =
      44 * scale +
      Math.max(1, entries.length) * rowHeight +
      (battle.cmd.mode === 'menu' && store.battleCommandHelp() ? 46 * scale : 0) +
      (hasBack ? rowHeight : 0)
    const command = panel(commandWidth, commandHeight, {
      title:
        battle.cmd.mode === 'menu'
          ? '行动指令'
          : battle.cmd.mode === 'target'
            ? '选择目标'
            : '使用道具',
      accent: UI_COLORS.warning,
      alpha: 0.96,
      label: 'COMMAND'
    })
    command.position.set(edge, portrait ? logPanel.y + logHeight + edge : edge)
    entries.forEach((entry, index) => {
      const row = uiButton(entry.label, commandWidth - 20 * scale, rowHeight, {
        active: battle.cmd!.idx === index && !entry.disabled,
        disabled: entry.disabled,
        value: entry.value,
        dense: true,
        onPress: () => {
          store.battleCmd(index)
          store.battleConfirm()
        }
      })
      row.position.set(10 * scale, 38 * scale + index * rowHeight)
      command.addChild(row)
    })
    if (battle.cmd.mode === 'menu' && store.battleCommandHelp()) {
      const help = label(
        store.battleCommandHelp(),
        14 * scale,
        42 * scale + entries.length * rowHeight,
        utilityStyle(9 * scale, {
          fill: UI_COLORS.muted,
          wordWrap: true,
          wordWrapWidth: commandWidth - 28 * scale
        })
      )
      command.addChild(help)
    }
    if (hasBack) {
      const back = uiButton('返回上一级', commandWidth - 20 * scale, rowHeight - 3, {
        value: 'B',
        dense: true,
        onPress: () => store.battleCancel()
      })
      back.position.set(10 * scale, 38 * scale + entries.length * rowHeight)
      command.addChild(back)
    }
    root.addChild(command)
  }
  return root
}

export function renderEnding(
  state: GameState,
  width: number,
  height: number,
  scale: number
): Container {
  const root = new Container()
  root.addChild(new Graphics().rect(0, 0, width, height).fill(UI_COLORS.black))
  const lines = ENDING.slice(0, (state.ending?.idx || 0) + 1)
  const lineHeight = Math.max(32, 39 * scale)
  const startY = Math.max(30, (height - lines.length * lineHeight) / 2)
  lines.forEach((lineText, index) => {
    const special = lineText === '完' || lineText.includes('荒原引擎')
    const line = label(
      lineText,
      width / 2,
      startY + index * lineHeight,
      special
        ? displayStyle(22 * scale, { fill: UI_COLORS.brassLight, align: 'center' })
        : bodyStyle(14 * scale, { fill: UI_COLORS.muted, align: 'center' })
    )
    line.anchor.set(0.5, 0)
    fitText(line, width - 40)
    root.addChild(line)
  })
  if ((state.ending?.idx || 0) >= ENDING.length - 1) {
    const hint = label(
      'A 返回标题',
      width / 2,
      startY + lines.length * lineHeight + 18 * scale,
      utilityStyle(11 * scale, {
        fill: UI_COLORS.brassLight,
        align: 'center'
      })
    )
    hint.anchor.set(0.5, 0)
    root.addChild(hint)
  }
  return root
}

export function renderGameOver(
  state: GameState,
  width: number,
  height: number,
  scale: number
): Container {
  const root = new Container()
  root.addChild(new Graphics().rect(0, 0, width, height).fill(0x0a0505))
  const heading = label(
    '全员倒下',
    width / 2,
    height * 0.34,
    displayStyle(42 * scale, {
      fill: UI_COLORS.warning,
      align: 'center',
      stroke: { color: UI_COLORS.black, width: 5 * scale }
    })
  )
  heading.anchor.set(0.5, 0)
  root.addChild(heading)
  const lines = ['救援队正在把你们送回拉多镇', '醒来后损失一半随身金币']
  lines.forEach((lineText, index) => {
    const line = label(
      lineText,
      width / 2,
      height * 0.5 + index * 32 * scale,
      bodyStyle(14 * scale, {
        fill: index === 1 ? UI_COLORS.brassLight : UI_COLORS.muted,
        align: 'center'
      })
    )
    line.anchor.set(0.5, 0)
    root.addChild(line)
  })
  if (state.goT > 1.2) {
    const hint = label(
      'A / ENTER  在自宅醒来',
      width / 2,
      height * 0.66,
      utilityStyle(12 * scale, {
        fill: UI_COLORS.paper,
        align: 'center'
      })
    )
    hint.anchor.set(0.5, 0)
    root.addChild(hint)
  }
  return root
}

export function renderSleep(
  state: GameState,
  width: number,
  height: number,
  scale: number
): Container {
  const root = new Container()
  const sleep = state.sleep
  if (!sleep) return root
  let opacity = 1
  if (sleep.phase === 'fadeout') opacity = Math.min(1, sleep.t / 0.7)
  else if (sleep.phase === 'fadein') opacity = Math.max(0, 1 - sleep.t / 0.8)
  root.alpha = opacity
  root.addChild(new Graphics().rect(0, 0, width, height).fill(0x03050a))
  if (sleep.phase === 'night') {
    const sky = new Graphics().rect(0, 0, width, height).fill(0x070a13)
    for (let index = 0; index < 28; index++) {
      const x = (((index * 173 + 31) % 997) / 997) * width
      const y = (((index * 83 + 17) % 389) / 389) * height * 0.58
      sky.circle(x, y, index % 5 === 0 ? 1.5 * scale : 1 * scale).fill({
        color: 0xc9d3d4,
        alpha: 0.5 + (index % 4) * 0.12
      })
    }
    sky.circle(width * 0.78, height * 0.18, 30 * scale).fill(0xdfd9a9)
    sky.circle(width * 0.79, height * 0.17, 27 * scale).fill(0x070a13)
    sky
      .moveTo(0, height)
      .lineTo(0, height * 0.72)
      .lineTo(width * 0.18, height * 0.62)
      .lineTo(width * 0.34, height * 0.75)
      .lineTo(width * 0.54, height * 0.58)
      .lineTo(width * 0.73, height * 0.73)
      .lineTo(width, height * 0.61)
      .lineTo(width, height)
      .closePath()
      .fill(0x0c1015)
    root.addChild(sky)
    const sleepMark = label(
      'Z  Z',
      width * 0.57,
      height * 0.55,
      displayStyle(22 * scale, {
        fill: 0x8f9bb1
      })
    )
    sleepMark.rotation = -0.12
    root.addChild(sleepMark)
  } else if (sleep.phase === 'summary') {
    const summary = panel(Math.min(width - 32, 420 * scale), 250 * scale, {
      title: '晨间整备报告',
      accent: UI_COLORS.brass,
      label: `DAY ${state.environment.day}`
    })
    summary.position.set((width - summary.width) / 2, (height - summary.height) / 2)
    const time = label(
      formatWorldTime(state.environment),
      summary.width / 2,
      54 * scale,
      displayStyle(28 * scale, {
        fill: UI_COLORS.brassLight,
        align: 'center'
      })
    )
    time.anchor.set(0.5, 0)
    summary.addChild(time)
    const reports = [
      '人员 HP 已恢复',
      '战车状态未改变',
      ...(sleep.source === 'inn' ? ['旅途记录已保存'] : [])
    ]
    reports.forEach((copy, index) => {
      summary.addChild(
        label(
          `✓  ${copy}`,
          32 * scale,
          116 * scale + index * 30 * scale,
          bodyStyle(13 * scale, {
            fill: index === 0 ? UI_COLORS.success : UI_COLORS.text
          })
        )
      )
    })
    root.addChild(summary)
  }
  return root
}

export function renderSectionHeader(text: string, width: number): Container {
  return sectionTitle(text, width)
}
