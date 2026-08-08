import { BOUNTIES } from '@/game/data/combat'
import { WORLD_GATE_POSITIONS } from '@/game/data/maps'
import type { GameState, WorldGateDef } from '@/game/types'

export const WORLD_GATES: WorldGateDef[] = [
  {
    id: 'windbreak',
    name: '裂风山口',
    position: WORLD_GATE_POSITIONS.windbreak,
    regionId: 'rado',
    route: '风泵村—麦镇主路',
    unlockFlag: 'gate_windbreak_open',
    lockedText: ['废弃路霸车横在山口中央。', '不击毁它，战车无法通过裂风山口。'],
    battle: {
      mobs: ['windbreak_guard'],
      text: '裂风路霸车启动了残存的火控系统！',
      completionMessage: '裂风山口的残骸已被推到路旁，主路永久开放。'
    }
  },
  {
    id: 'tidebridge',
    name: '断潮桥',
    position: WORLD_GATE_POSITIONS.tidebridge,
    regionId: 'pobb',
    route: '苇潮部落—波布镇主路',
    unlockFlag: 'gate_tidebridge_open',
    lockedText: ['巨大的钳兽盘踞在断潮桥中央。', '也可以向南寻找浅滩，但那条路更远、怪物更多。'],
    battle: {
      mobs: ['tide_crab'],
      text: '断潮钳兽从桥下撞破护栏！',
      completionMessage: '断潮桥恢复通行；南北湖岸之间出现了一条永久捷径。'
    }
  },
  {
    id: 'sluice',
    name: '旧水闸捷径',
    position: WORLD_GATE_POSITIONS.sluice,
    regionId: 'pobb',
    route: '波布镇—奥多废墟捷径',
    unlockFlag: 'gate_sluice_open',
    requiredBounty: 'water',
    lockedText: [
      '水怪堵住了旧水闸的泄洪机构，桥面完全浸在水下。',
      '先调查波布镇南侧大湖；水怪消失后，水位才能下降。'
    ]
  },
  {
    id: 'graypass',
    name: '灰脊关',
    position: WORLD_GATE_POSITIONS.graypass,
    regionId: 'rock',
    route: '灰脊矿村—奥多主路',
    unlockFlag: 'gate_graypass_open',
    requiredBounty: 'marshal',
    lockedText: [
      '灰脊关的遥控路障仍接收着罗克医院发出的占领信号。',
      '切断马歇尔的控制后，路障才会失去动力。'
    ]
  },
  {
    id: 'north_checkpoint',
    name: '北部军管哨',
    position: WORLD_GATE_POSITIONS.north_checkpoint,
    regionId: 'sold',
    route: '奥多—索鲁主路',
    unlockFlag: 'gate_north_checkpoint_open',
    lockedText: [
      '无人路障车封锁了北部军管哨。',
      '东侧旧军道可以绕行，但会穿过更危险的机械巡逻区。'
    ],
    battle: {
      mobs: ['checkpoint_tank'],
      text: '军管路障车识别失败，自动炮塔开始旋转！',
      completionMessage: '北部军管哨停止运转，奥多与索鲁之间的主路永久开放。'
    }
  }
]

type GateProgress = Pick<GameState, 'flags' | 'bounties'>

export function worldGateAt(x: number, y: number): WorldGateDef | null {
  return WORLD_GATES.find((gate) => gate.position[0] === x && gate.position[1] === y) || null
}

export function worldGateUnlocked(state: GateProgress, gate: WorldGateDef): boolean {
  if (state.flags[gate.unlockFlag]) return true
  return !!gate.requiredBounty && !!state.bounties.killed[gate.requiredBounty]
}

export function worldGateRequirement(gate: WorldGateDef): string {
  if (gate.battle) return '击破守卫后永久开放'
  const bounty = BOUNTIES.find((candidate) => candidate.id === gate.requiredBounty)
  return bounty ? `击破「${bounty.name}」后开放` : '满足区域事件后开放'
}

export function worldGateNote(state: GateProgress, gate: WorldGateDef): string {
  return worldGateUnlocked(state, gate)
    ? `已开放 · ${gate.route}`
    : `封锁中 · ${worldGateRequirement(gate)}`
}
