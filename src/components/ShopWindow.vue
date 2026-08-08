<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@/game/core/store'
import { HUMAN_WEAPONS, ITEMS, PARTS, TANKS, findPart } from '@/game/data/equipment'
import { BOUNTIES } from '@/game/data/combat'
import { fmtG } from '@/game/utils'
import type { Part, PartKind } from '@/game/types'
import {
  ARMOR_PACK_COST,
  ARMOR_PACK_SIZE,
  maintenanceTimeLabel,
  maintenanceTotals as calculateMaintenanceTotals
} from '@/game/systems/maintenance'
import {
  PART_CONDITION_LABELS,
  TANK_PART_LABELS,
  tankAmmoCapacity,
  tankPartCondition
} from '@/game/systems/tanks'

const state = store.state
const sh = computed(() => state.shop!)
const tabs = ['人员装备', '主炮', '副炮', 'S-E', '发动机', 'C装置', '卖出', '退出']

/* 直接从 store 读取当前列表（共享 shopList 逻辑） */
const shop = store as unknown as {
  shopListForUi(): {
    list: { id: string; name: string; price: number; kind?: string }[]
    kind: string
  }
}
const list = computed(() => shop.shopListForUi()?.list || [])

const tankOptions = computed(() => store.tankGarageMenuItems())
const serviceableTanks = computed(() => store.serviceableTanksForUi())
const modTank = computed(() => serviceableTanks.value[sh.value.tankSel || 0])
const modDef = computed(() => modTank.value && TANKS.find((t) => t.id === modTank.value.tankId))
const modSlots: { id: PartKind; name: string }[] = [
  { id: 'main', name: '主炮' },
  { id: 'sub', name: '副炮' },
  { id: 'se', name: 'S-E' },
  { id: 'engine', name: '发动机' },
  { id: 'c', name: 'C装置' }
]
const modLoad = computed(() => (modTank.value ? store.tankLoad(modTank.value) : 0))
const modCapacity = computed(() => {
  const engine = modTank.value && PARTS.engine.find((p) => p.id === modTank.value.parts.engine)
  return engine?.load || 0
})
const maintenance = computed(() => sh.value.maintenance)
const workTotals = computed(() => calculateMaintenanceTotals(maintenance.value?.items || []))
const tankPartRows = computed(() => {
  const tank = modTank.value
  if (!tank) return []
  return modSlots.map(({ id, name }) => {
    const partId = tank.parts[id]
    const part = partId ? PARTS[id].find((candidate) => candidate.id === partId) : undefined
    const condition = tankPartCondition(tank, id)
    return {
      id,
      name,
      partName: part?.name || '未装备',
      condition: partId ? PART_CONDITION_LABELS[condition] : '--',
      problem: condition !== 'normal'
    }
  })
})

function ammoText(kind: 'main' | 'se'): string {
  const tank = modTank.value
  if (!tank?.parts[kind]) return '--'
  return `${tank.ammo[kind]}/${tankAmmoCapacity(tank, kind)}`
}

function partStats(part: Part): string {
  const values: string[] = []
  if (part.atk !== undefined) values.push(`攻 ${part.atk}`)
  if (part.acc !== undefined) values.push(`命中 +${part.acc}%`)
  if (part.load !== undefined) values.push(`载重 ${part.load.toFixed(1)}t`)
  if (part.ammo !== undefined) values.push(`弹仓 ${part.ammo}`)
  if (part.all) values.push('全体攻击')
  values.push(`重量 ${part.w.toFixed(1)}t`)
  return values.join(' · ')
}

function shopItemMeta(id: string): string {
  const item = ITEMS[id]
  if (item) return item.desc
  const humanWeapon = HUMAN_WEAPONS[id]
  if (humanWeapon) return humanWeapon.desc
  const part = findPart(id)
  return part ? partStats(part) : ''
}

function slotSupported(slot: PartKind): boolean {
  if (!modDef.value || slot === 'engine' || slot === 'c') return true
  return modDef.value.slots[slot] > 0
}

const modCandidates = computed(() => {
  const tank = modTank.value
  const slot = sh.value.slot
  if (!tank || !slot) return []
  const current = tank.parts[slot]
  const owned = Object.keys(state.inventory.parts).filter(
    (id) => state.inventory.parts[id] > 0 && PARTS[slot].some((p) => p.id === id)
  )
  const ids = [...(current ? [current] : []), ...owned.filter((id) => id !== current)]
  return ids.map((id) => {
    const part = PARTS[slot].find((p) => p.id === id)!
    const oldPart = current ? PARTS[slot].find((p) => p.id === current) : undefined
    const load =
      modLoad.value - (slot === 'engine' ? 0 : oldPart?.w || 0) + (slot === 'engine' ? 0 : part.w)
    const capacity = slot === 'engine' ? part.load || 0 : modCapacity.value
    return {
      id,
      part,
      current: id === current,
      count: state.inventory.parts[id] || 0,
      load,
      capacity,
      overweight: load > capacity
    }
  })
})

function equippedName(slot: PartKind): string {
  const id = modTank.value?.parts[slot]
  return id ? PARTS[slot].find((p) => p.id === id)?.name || id : '未装备'
}

function confirmShopSelection(index: number) {
  store.shopSelect(index)
  store.shopConfirm()
}
</script>

<template>
  <div class="shop-root">
    <div class="pixel-window head">
      <span class="title">{{ sh.name }}</span>
      <span class="gold">G {{ fmtG(state.gold) }}</span>
    </div>

    <!-- 武器店 -->
    <div v-if="sh.type === 'weapon'" class="pixel-window body">
      <div class="tabrow">
        <span
          v-for="(t, i) in tabs"
          :key="t"
          class="tab"
          :class="{ on: sh.tab === i }"
          @click="store.shopTabTo(i)"
          >{{ t }}</span
        >
      </div>
      <div class="list">
        <div
          v-for="(it, i) in list"
          :key="it.id + i"
          class="row"
          :class="{ sel: sh.idx === i }"
          @click="confirmShopSelection(i)"
        >
          <span class="item-copy"
            ><strong>{{ it.name }}</strong
            ><small>{{ shopItemMeta(it.id) }}</small></span
          >
          <span class="price">{{ fmtG(it.price) }}G</span>
        </div>
      </div>
    </div>

    <!-- 战车店 -->
    <div v-else-if="sh.type === 'tank'" class="pixel-window body garage">
      <template v-if="maintenance?.phase === 'garage'">
        <div class="section-label">接车台</div>
        <div v-if="serviceableTanks.length" class="mod-tanks">
          <span
            v-for="(tank, i) in serviceableTanks"
            :key="tank.tankId"
            class="tankchip"
            :class="{ on: (sh.tankSel || 0) === i }"
            @click="store.shopTankTo(i)"
            >{{ TANKS.find((item) => item.id === tank.tankId)?.name }}</span
          >
        </div>
        <div v-if="modTank && modDef" class="garage-summary">
          <div class="summary-main">
            <strong>{{ modDef.name }}</strong>
            <span>底盘 SP {{ modTank.sp }}/{{ modDef.sp }}</span>
            <span>装甲 {{ modTank.armor }}/{{ modDef.armorCap }}</span>
          </div>
          <div class="summary-secondary">
            <span>主炮弹 {{ ammoText('main') }}</span>
            <span>S-E 弹 {{ ammoText('se') }}</span>
            <span :class="{ danger: store.tankOverweight(modTank) }">
              {{ modLoad.toFixed(1) }}/{{ modCapacity.toFixed(1) }}t
            </span>
          </div>
        </div>
        <div v-else class="empty-state">
          接车台没有随队战车。库内车辆需先到自宅地下车库办理出库。
        </div>
        <div class="garage-actions">
          <div
            v-for="(option, i) in tankOptions"
            :key="option"
            class="row"
            :class="{ sel: sh.idx === i }"
            @click="confirmShopSelection(i)"
          >
            <span>{{ option }}</span>
            <small v-if="option === '接车诊断'">检查底盘、部件、装甲与弹仓</small>
          </div>
        </div>
      </template>

      <template v-else-if="maintenance?.phase === 'diagnosis'">
        <div class="report-heading">
          <span>诊断报告</span>
          <strong>{{ modDef?.name }}</strong>
        </div>
        <div class="diagnostic-grid">
          <template v-for="part in tankPartRows" :key="part.id">
            <span>{{ TANK_PART_LABELS[part.id] }}</span>
            <strong :class="{ danger: part.problem }"
              >{{ part.partName }} · {{ part.condition }}</strong
            >
          </template>
          <span>主炮弹仓</span><strong>{{ ammoText('main') }}</strong> <span>S-E 弹仓</span
          ><strong>{{ ammoText('se') }}</strong>
        </div>
        <div v-if="maintenance.items.length" class="fault-list">
          <div v-for="item in maintenance.items" :key="item.id" class="fault-row">
            <span>{{ item.label }}</span
            ><small>{{ item.detail }}</small>
          </div>
        </div>
        <div v-else class="all-clear">未发现故障或补给缺口，当前无需整备。</div>
        <div class="flow-actions">
          <button type="button" class="text-command" @click="store.shopConfirm()">生成工单</button>
          <button type="button" class="text-command muted" @click="store.shopCancel()">返回</button>
        </div>
      </template>

      <template v-else-if="maintenance?.phase === 'workorder'">
        <div class="report-heading">
          <span>维修工单</span>
          <strong>选择要执行的项目</strong>
        </div>
        <div v-if="maintenance.items.length" class="work-list">
          <div
            v-for="(item, i) in maintenance.items"
            :key="item.id"
            class="work-row"
            :class="{ sel: sh.idx === i }"
            @click="confirmShopSelection(i)"
          >
            <span class="check">{{ item.selected ? '■' : '□' }}</span>
            <span class="work-copy"
              ><strong>{{ item.label }}</strong
              ><small>{{ item.detail }}</small></span
            >
            <span class="work-meta"
              >{{ fmtG(item.cost) }}G<br />{{ maintenanceTimeLabel(item.minutes) }}</span
            >
          </div>
        </div>
        <div v-else class="all-clear">没有需要加入工单的项目。</div>
        <div class="order-total">
          <span>已选 {{ workTotals.selected }} 项</span>
          <strong
            >{{ fmtG(workTotals.cost) }}G · {{ maintenanceTimeLabel(workTotals.minutes) }}</strong
          >
        </div>
        <div
          class="execute-order"
          :class="{ sel: sh.idx === maintenance.items.length }"
          @click="confirmShopSelection(maintenance.items.length)"
        >
          开始整备
        </div>
      </template>

      <template v-else-if="maintenance?.phase === 'result'">
        <div class="report-heading"><span>整备结算</span><strong>工单已完成</strong></div>
        <div class="result-list">
          <div v-for="line in maintenance.result" :key="line">{{ line }}</div>
        </div>
        <div class="order-total">
          <span>费用 {{ fmtG(workTotals.cost) }}G</span>
          <strong>耗时 {{ maintenanceTimeLabel(workTotals.minutes) }}</strong>
        </div>
        <div class="execute-order sel" @click="store.shopConfirm()">交车返回</div>
      </template>

      <template v-else-if="maintenance?.phase === 'buy'">
        <div class="report-heading"><span>战车销售</span><strong>库存车辆</strong></div>
        <div v-if="list.length" class="buylist">
          <div
            v-for="(item, i) in list"
            :key="item.id"
            class="row"
            :class="{ sel: sh.idx === i }"
            @click="confirmShopSelection(i)"
          >
            <span>{{ item.name }}</span>
            <span class="price">{{ fmtG(item.price) }}G</span>
          </div>
        </div>
        <div v-else class="all-clear">目前没有可出售的战车。</div>
        <div class="hint">X 返回接车台</div>
      </template>
    </div>

    <!-- 改造工房 -->
    <div v-else-if="sh.type === 'mod'" class="pixel-window body mod">
      <div v-if="!modTank" class="empty-state">
        没有随队战车可供改造。库内车辆需先在自宅办理出库。
      </div>
      <div v-else class="title">选择战车</div>
      <div class="mod-tanks">
        <span
          v-for="(t, i) in serviceableTanks"
          :key="t.tankId"
          class="tankchip"
          :class="{ on: (sh.tankSel || 0) === i }"
          @click="store.shopTankTo(i)"
          >{{ TANKS.find((x) => x.id === t.tankId)!.name }}</span
        >
      </div>
      <div v-if="modTank" class="mod-info">
        <div>
          装甲 {{ modTank.armor }}/{{ TANKS.find((x) => x.id === modTank.tankId)!.armorCap }} SP
          {{ modTank.sp }}/{{ TANKS.find((x) => x.id === modTank.tankId)!.sp }}
        </div>
        <div :class="{ danger: store.tankOverweight(modTank) }">
          载重 {{ modLoad.toFixed(1) }}/{{ modCapacity.toFixed(1) }}t
          {{ store.tankOverweight(modTank) ? '（超载：移动与行动速度下降）' : '' }}
        </div>
      </div>
      <div v-if="sh.tab === 0 && modTank" class="mod-menu">
        <div
          v-for="(it, i) in [
            '更换装备',
            `装甲片补给（${ARMOR_PACK_COST}G/+${ARMOR_PACK_SIZE}）`,
            '查看状态'
          ]"
          :key="it"
          class="row"
          :class="{ sel: sh.tab === 0 && sh.idx === i }"
          @click="confirmShopSelection(i)"
        >
          {{ it }}
        </div>
      </div>
      <div v-if="sh.tab === 1" class="sub">
        <div class="title">选择改造部位</div>
        <div
          v-for="(slot, i) in modSlots"
          :key="slot.id"
          class="row"
          :class="{ sel: sh.idx === i, disabled: !slotSupported(slot.id) }"
          @click="confirmShopSelection(i)"
        >
          <span>{{ slot.name }}</span>
          <span>{{ slotSupported(slot.id) ? equippedName(slot.id) : '无槽位' }}</span>
        </div>
      </div>
      <div v-if="sh.tab === 2" class="sub equipment-list">
        <div class="title">{{ modSlots.find((s) => s.id === sh.slot)?.name }}换装</div>
        <div
          v-for="(candidate, i) in modCandidates"
          :key="candidate.id"
          class="equipment-row"
          :class="{ sel: sh.idx === i, danger: candidate.overweight }"
          @click="confirmShopSelection(i)"
        >
          <div class="equipment-head">
            <strong>{{ candidate.part.name }}</strong>
            <span>{{ candidate.current ? '装备中' : `库存 ×${candidate.count}` }}</span>
          </div>
          <small>{{ partStats(candidate.part) }}</small>
          <small
            >换装后 {{ candidate.load.toFixed(1) }}/{{ candidate.capacity.toFixed(1) }}t{{
              candidate.overweight ? ' · 超载' : ''
            }}</small
          >
        </div>
        <div v-if="!modCandidates.length" class="empty-state">仓库中没有该部位的可换装部件。</div>
      </div>
      <div v-if="sh.tab === 3" class="sub">
        <div class="title">
          装甲涂层：当前 {{ modTank!.armor }}/{{
            TANKS.find((x) => x.id === modTank!.tankId)!.armorCap
          }}
        </div>
        <div class="row" @click="store.shopConfirm()">
          按 Z 购买（{{ ARMOR_PACK_COST }}G / +{{ ARMOR_PACK_SIZE }}）
        </div>
      </div>
      <div v-if="sh.tab === 4 && modTank && modDef" class="sub status-sheet">
        <div class="title">{{ modDef.name }} 状态</div>
        <div class="status-grid">
          <span>底盘防御</span><strong>{{ modDef.def }}</strong> <span>速度</span
          ><strong>{{ modDef.speed }}</strong> <span>载重</span
          ><strong :class="{ danger: store.tankOverweight(modTank) }"
            >{{ modLoad.toFixed(1) }}/{{ modCapacity.toFixed(1) }}t</strong
          >
          <template v-for="slot in modSlots" :key="slot.id">
            <span>{{ slot.name }}</span
            ><strong>{{ equippedName(slot.id) }}</strong>
          </template>
        </div>
        <div class="hint">A / B 返回</div>
      </div>
    </div>

    <!-- 宿屋 -->
    <div v-else-if="sh.type === 'inn'" class="pixel-window body">
      <div class="talk">宿屋老板：要休息一晚吗？</div>
      <div class="row" :class="{ sel: sh.idx === 0 }" @click="confirmShopSelection(0)">
        住宿（回复人员 HP）<span>{{ store.innCost() }}G</span>
      </div>
      <div class="row" :class="{ sel: sh.idx === 1 }" @click="confirmShopSelection(1)">
        登记旅途记录<span>免费</span>
      </div>
      <div class="row" :class="{ sel: sh.idx === 2 }" @click="confirmShopSelection(2)">离开</div>
    </div>

    <!-- 情报屋 -->
    <div v-else-if="sh.type === 'bounty'" class="pixel-window body bounty">
      <div class="title">—— 悬赏榜 —— Z 领取全部</div>
      <div
        v-for="b in BOUNTIES"
        :key="b.id"
        class="brow"
        :class="{
          claimed: state.bounties.claimed[b.id],
          kill: state.bounties.killed[b.id] && !state.bounties.claimed[b.id]
        }"
      >
        <span class="bname">
          {{ state.bounties.claimed[b.id] ? '✓' : state.bounties.killed[b.id] ? '★' : '·' }}
          {{ b.name }} {{ fmtG(b.gold) }}G
        </span>
        <span class="bloc">{{ b.loc }}</span>
      </div>
      <div class="claim" @click="store.shopConfirm()">领取全部赏金（Z）</div>
    </div>

    <div v-if="sh.msg && sh.msgT > 0" class="pixel-window msg">{{ sh.msg }}</div>
  </div>
</template>

<style lang="scss" scoped>
.shop-root {
  position: absolute;
  inset: 0;
  z-index: 22;
}
.head {
  position: absolute;
  left: 3%;
  right: 3%;
  top: 3%;
  display: flex;
  justify-content: space-between;
  padding: 8px 14px;
  font-size: 14px;
}
.gold {
  color: #f8e048;
  font-size: 12px;
}
.body {
  position: absolute;
  left: 3%;
  right: 3%;
  top: 14%;
  padding: 12px 14px;
  font-size: 12px;
  max-height: 68%;
  overflow-y: auto;
  scrollbar-color: #5d6672 #171c28;
  scrollbar-width: thin;
}
.body::-webkit-scrollbar {
  width: 6px;
}
.body::-webkit-scrollbar-track {
  background: #171c28;
}
.body::-webkit-scrollbar-thumb {
  background: #5d6672;
}
.tabrow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 11px;
}
.tab {
  cursor: pointer;
  color: #c8d0d8;
}
.tab.on {
  color: #f8e048;
}
.row {
  padding: 5px 6px;
  display: flex;
  justify-content: space-between;
  cursor: pointer;
}
.row.sel {
  color: #f8e048;
}
.price {
  color: #a0e0a0;
  font-size: 11px;
}
.item-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.item-copy small {
  color: #8fa0ae;
  font-size: 9px;
}
.list {
  max-height: 160px;
  overflow-y: auto;
}
.buylist {
  margin-top: 6px;
}
.section-label,
.report-heading {
  border-bottom: 1px solid #4a5264;
  padding-bottom: 5px;
  color: #aeb9c4;
  font-size: 10px;
}
.report-heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.report-heading strong {
  color: #f0e8c0;
  font-weight: normal;
}
.garage-summary {
  margin: 7px 0;
  border-left: 2px solid #718b78;
  padding: 5px 8px;
  background: rgb(18 24 28 / 72%);
}
.summary-main,
.summary-secondary {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
}
.summary-main strong {
  flex-basis: 100%;
  color: #e8e1bd;
}
.summary-secondary {
  margin-top: 4px;
  color: #9badb4;
  font-size: 9px;
}
.garage-actions {
  border-top: 1px solid #303744;
  padding-top: 4px;
}
.garage-actions .row small {
  color: #7f8b96;
  font-size: 9px;
}
.diagnostic-grid {
  display: grid;
  grid-template-columns: minmax(74px, 0.6fr) 1.4fr;
  gap: 3px 10px;
  font-size: 10px;
}
.diagnostic-grid span {
  color: #82909b;
}
.diagnostic-grid strong {
  font-weight: normal;
}
.fault-list,
.work-list,
.result-list {
  margin-top: 8px;
  border-top: 1px solid #303744;
}
.fault-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 2px;
  color: #efb26c;
}
.fault-row small {
  color: #a3aab0;
  font-size: 9px;
}
.all-clear {
  margin: 12px 0;
  color: #80cb88;
}
.flow-actions {
  display: flex;
  gap: 14px;
  margin-top: 10px;
}
.text-command {
  border: 0;
  border-bottom: 1px solid #d8c95b;
  padding: 3px 1px;
  background: transparent;
  color: #f8e048;
  font: inherit;
  cursor: pointer;
}
.text-command.muted {
  border-color: #69717c;
  color: #9aa3ad;
}
.work-row {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  padding: 5px 3px;
  cursor: pointer;
}
.work-row.sel {
  background: #252839;
  color: #f8e048;
}
.check {
  color: #7ed083;
}
.work-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.work-copy small {
  overflow-wrap: anywhere;
  color: #8f9ba6;
  font-size: 9px;
}
.work-meta {
  color: #a8b6a5;
  font-size: 9px;
  text-align: right;
}
.order-total {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  border-top: 1px solid #4a5264;
  padding-top: 6px;
  color: #aab4bd;
}
.order-total strong {
  color: #f0df8d;
  font-weight: normal;
}
.execute-order {
  margin-top: 7px;
  padding: 5px;
  color: #d7dbe0;
  text-align: center;
  cursor: pointer;
}
.execute-order.sel {
  background: #353340;
  color: #f8e048;
}
.result-list {
  min-height: 64px;
  padding-top: 6px;
  color: #82d18c;
  line-height: 1.6;
}
.talk {
  margin-bottom: 8px;
  color: #d0d0d8;
}
.title {
  margin-bottom: 6px;
}
.mod-tanks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.tankchip {
  border: 1px solid #384058;
  padding: 2px 6px;
  font-size: 10px;
  color: #c8c8d8;
}
.tankchip.on {
  color: #f8e048;
  border-color: #f8e048;
}
.mod-info {
  color: #a8d8a8;
  font-size: 11px;
  margin-bottom: 6px;
}
.danger {
  color: #f07868 !important;
}
.disabled {
  color: #626778;
}
.mod-menu {
  margin: 6px 0;
}
.sub {
  margin-top: 8px;
  border-top: 1px solid #384058;
  padding-top: 6px;
}
.equipment-list {
  max-height: 190px;
  overflow-y: auto;
}
.equipment-row {
  padding: 6px;
  cursor: pointer;
  border-bottom: 1px solid #292d3a;
}
.equipment-row.sel {
  color: #f8e048;
  background: #252839;
}
.equipment-head {
  display: flex;
  justify-content: space-between;
}
.equipment-row small {
  display: block;
  margin-top: 2px;
  color: #93a0ae;
  font-size: 9px;
}
.status-grid {
  display: grid;
  grid-template-columns: minmax(72px, 0.7fr) 1.3fr;
  gap: 4px 10px;
}
.status-grid span {
  color: #8fa0ae;
}
.status-grid strong {
  font-weight: normal;
}
.empty-state {
  color: #8b91a0;
  padding: 10px 4px;
}
.bounty .brow {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
}
.bname.claimed {
  color: #788088;
}
.bname.kill {
  color: #f8e048;
}
.bloc {
  color: #7888a0;
  font-size: 10px;
}
.claim {
  margin-top: 8px;
  color: #78e878;
  cursor: pointer;
}
.msg {
  position: absolute;
  left: 28%;
  right: 28%;
  bottom: 8%;
  text-align: center;
  padding: 6px;
  color: #f8e8b0;
  font-size: 12px;
}
</style>
