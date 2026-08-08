<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { FIELD_MENU_ITEMS, store } from '@/game/core/store'
import { findHumanWeapon, ITEMS, TANKS } from '@/game/data/equipment'
import { BOUNTIES, REGIONS } from '@/game/data/combat'
import { WORLD, WORLD_H, WORLD_W } from '@/game/data/maps'
import { xpNeed } from '@/game/data/story'
import { fmtG } from '@/game/utils'
import { useSettingsStore } from '@/stores/settings'
import {
  currentRegion,
  dangerPips,
  recommendedLevelLabel,
  regionAtWorld,
  vehicleRecommendationLabel
} from '@/game/systems/regions'
import { HUNT_DURATIONS } from '@/game/systems/hunting'
import { maintenanceTimeLabel } from '@/game/systems/maintenance'
import { GARAGE_CAPACITY, garageTankAtSlot } from '@/game/systems/garage'
import { isWorldTileExplored } from '@/game/systems/world-map'

const state = store.state
const settings = useSettingsStore()
const menuItems = FIELD_MENU_ITEMS
const view = computed(() => state.menu?.view || 'root')
const idx = computed(() => state.menu?.idx || 0)
const usableItems = computed(() =>
  Object.keys(state.inventory.items).filter((id) => state.inventory.items[id] > 0)
)
const members = computed(() => state.party.filter((p) => p.id))
const equipmentMember = computed(() =>
  state.menu?.equipMember
    ? state.party.find((member) => member.id === state.menu!.equipMember) || null
    : null
)
const humanWeaponChoices = computed(() =>
  equipmentMember.value ? store.humanWeaponChoicesForUi(equipmentMember.value.id!) : []
)
const teleportTargets = computed(() => store.teleportTargets())
const region = computed(() => currentRegion(state))
const huntRegions = computed(() => store.huntRegionsForUi())
const huntPreview = computed(() => store.huntPreviewForUi())
const huntTask = computed(() => state.hunt)
const huntTaskRegion = computed(() =>
  huntTask.value ? REGIONS.find((item) => item.id === huntTask.value!.regionId) : null
)
const huntTaskMember = computed(() =>
  huntTask.value ? state.party.find((member) => member.id === huntTask.value!.memberId) : null
)
const huntTaskTank = computed(() =>
  huntTask.value?.tankId ? TANKS.find((tank) => tank.id === huntTask.value!.tankId) : null
)
const huntRemaining = computed(() => store.huntRemainingForUi())
const huntProgress = computed(() => {
  const task = huntTask.value
  if (!task) return 0
  return Math.max(0, Math.min(1, 1 - huntRemaining.value / task.durationMinutes))
})
const atGarage = computed(() => store.isAtGarage())
const assignmentTanks = computed(() => store.tankAssignmentChoicesForUi())
const garageSlot = computed(() => state.menu?.garageSlot ?? 0)
const garageTank = computed(() => garageTankAtSlot(state, garageSlot.value))
const garageActions = computed(() => store.garageMenuOptionsForUi())
const garageOccupancy = computed(() =>
  Array.from({ length: GARAGE_CAPACITY }, (_, slot) => garageTankAtSlot(state, slot))
)
const canDispatchFromTown = computed(
  () => !!state.inTown && (state.base === 'town' || state.base === 'room')
)
const worldMap = computed(() => store.worldMapForUi())
const mapCanvas = ref<HTMLCanvasElement | null>(null)

const MAP_SCALE = 4
const TERRAIN_COLORS: Record<string, string> = {
  '.': '#426c45',
  ',': '#375e3e',
  r: '#9a825b',
  f: '#1f4d39',
  m: '#686e70',
  w: '#275f78',
  s: '#a68f57',
  t: '#79786b',
  D: '#d0ad5c',
  C: '#537c7b',
  G: '#8f5648',
  F: '#6f8f80',
  H: '#925b4d',
  N: '#8a7767'
}

function drawWorldMap() {
  const canvas = mapCanvas.value
  if (!canvas || view.value !== 'map') return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const model = worldMap.value
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#070a0b'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const explored = isWorldTileExplored(state.worldMap, x, y)
      ctx.fillStyle = explored ? TERRAIN_COLORS[WORLD[y][x]] || '#343d3c' : '#090d0e'
      ctx.fillRect(x * MAP_SCALE, y * MAP_SCALE, MAP_SCALE, MAP_SCALE)
      if (explored && regionAtWorld(x, y).id === model.selectedRegion.id) {
        ctx.fillStyle = 'rgba(240, 205, 112, 0.13)'
        ctx.fillRect(x * MAP_SCALE, y * MAP_SCALE, MAP_SCALE, MAP_SCALE)
      } else if (!explored && (x + y) % 2 === 0) {
        ctx.fillStyle = '#0b1011'
        ctx.fillRect(x * MAP_SCALE, y * MAP_SCALE, MAP_SCALE, MAP_SCALE)
      }
    }
  }

  ctx.strokeStyle = 'rgba(126, 151, 145, 0.12)'
  ctx.lineWidth = 1
  for (let x = 10; x < WORLD_W; x += 10) {
    ctx.beginPath()
    ctx.moveTo(x * MAP_SCALE + 0.5, 0)
    ctx.lineTo(x * MAP_SCALE + 0.5, canvas.height)
    ctx.stroke()
  }
  for (let y = 10; y < WORLD_H; y += 10) {
    ctx.beginPath()
    ctx.moveTo(0, y * MAP_SCALE + 0.5)
    ctx.lineTo(canvas.width, y * MAP_SCALE + 0.5)
    ctx.stroke()
  }

  for (const location of model.locations) {
    const cx = location.x * MAP_SCALE + Math.floor(MAP_SCALE / 2)
    const cy = location.y * MAP_SCALE + Math.floor(MAP_SCALE / 2)
    ctx.fillStyle =
      location.kind === 'town'
        ? '#f0c75e'
        : location.kind === 'village'
          ? '#d7d38a'
          : location.kind === 'tribe'
            ? '#d98d5b'
            : location.kind === 'gate'
              ? location.status === 'open'
                ? '#75c277'
                : '#d45d4d'
              : '#78c3bd'
    if (location.kind === 'town') {
      ctx.fillRect(cx - 2, cy - 2, 5, 5)
      ctx.fillStyle = '#171715'
      ctx.fillRect(cx, cy, 1, 1)
    } else if (location.kind === 'village') {
      ctx.fillRect(cx - 2, cy - 1, 5, 3)
      ctx.fillRect(cx - 1, cy - 2, 3, 5)
    } else if (location.kind === 'tribe') {
      ctx.beginPath()
      ctx.moveTo(cx, cy - 3)
      ctx.lineTo(cx + 3, cy + 3)
      ctx.lineTo(cx - 3, cy + 3)
      ctx.closePath()
      ctx.fill()
    } else if (location.kind === 'gate') {
      ctx.fillRect(cx - 3, cy - 3, 2, 7)
      ctx.fillRect(cx + 2, cy - 3, 2, 7)
      ctx.fillRect(cx - 2, cy - 1, 4, 2)
    } else {
      ctx.beginPath()
      ctx.moveTo(cx, cy - 3)
      ctx.lineTo(cx + 3, cy)
      ctx.lineTo(cx, cy + 3)
      ctx.lineTo(cx - 3, cy)
      ctx.closePath()
      ctx.fill()
    }
  }

  const [playerX, playerY] = model.position
  const px = playerX * MAP_SCALE + Math.floor(MAP_SCALE / 2)
  const py = playerY * MAP_SCALE + Math.floor(MAP_SCALE / 2)
  ctx.fillStyle = '#f4f0d2'
  ctx.fillRect(px - 4, py - 1, 9, 3)
  ctx.fillRect(px - 1, py - 4, 3, 9)
  ctx.fillStyle = '#d65045'
  ctx.fillRect(px, py, 1, 1)
}

watch(
  [view, () => state.worldMap.explored.join(''), () => state.menu?.mapRegion],
  async () => {
    await nextTick()
    drawWorldMap()
  },
  { immediate: true }
)
</script>

<template>
  <div class="menu-root">
    <div v-if="view !== 'garage' && view !== 'map'" class="pixel-window left">
      <div class="title">菜单</div>
      <div
        v-for="(it, i) in menuItems"
        :key="it"
        class="menu-row"
        :class="{ sel: view === 'root' && idx === i }"
        @click="store.menuSelect(i)"
      >
        {{ it }}
      </div>
    </div>

    <!-- 实体战车库 -->
    <div v-if="view === 'garage'" class="pixel-window garage-panel">
      <div class="garage-heading">
        <div>
          <div class="title">地下战车库 · {{ String(garageSlot + 1).padStart(2, '0') }} 号位</div>
          <div class="garage-count">
            固定容量 {{ GARAGE_CAPACITY }} · 已停 {{ garageOccupancy.filter(Boolean).length }}
          </div>
        </div>
        <div class="garage-status" :class="{ empty: !garageTank }">
          {{ garageTank ? TANKS.find((tank) => tank.id === garageTank!.tankId)?.name : '空车位' }}
        </div>
      </div>

      <div class="garage-slots" aria-label="八个固定车位">
        <div
          v-for="(tank, slot) in garageOccupancy"
          :key="slot"
          class="garage-slot-cell"
          :class="{ active: slot === garageSlot, occupied: !!tank }"
        >
          <strong>{{ String(slot + 1).padStart(2, '0') }}</strong>
          <span>{{ tank ? `NO.${tank.tankId.slice(1)}` : 'EMPTY' }}</span>
        </div>
      </div>

      <div v-if="garageTank" class="garage-tank-stats">
        <span
          >SP {{ garageTank.sp }}/{{
            TANKS.find((tank) => tank.id === garageTank!.tankId)?.sp
          }}</span
        >
        <span
          >装甲 {{ garageTank.armor }}/{{
            TANKS.find((tank) => tank.id === garageTank!.tankId)?.armorCap
          }}</span
        >
      </div>
      <div v-else class="garage-tank-stats empty-copy">本车位可停入一辆当前随队战车</div>

      <div class="garage-actions">
        <div
          v-for="(action, i) in garageActions"
          :key="`${action.memberId || 'close'}-${i}`"
          class="menu-row"
          :class="{ sel: idx === i }"
          @click="store.garageSlotUse(i)"
        >
          {{ action.label }}
        </div>
      </div>
      <div class="hint">A 确认 · B 关闭</div>
    </div>

    <!-- 世界测绘图 -->
    <div
      v-else-if="view === 'map'"
      class="pixel-window world-map-panel"
      :data-map-region="worldMap.selectedRegion.id"
    >
      <div class="world-map-heading">
        <div>
          <div class="title">世界测绘图</div>
          <div class="map-coordinate">
            POS {{ String(worldMap.position[0]).padStart(2, '0') }}-{{
              String(worldMap.position[1]).padStart(2, '0')
            }}
            · {{ worldMap.currentRegion.name }}
          </div>
        </div>
        <button type="button" class="map-close" aria-label="返回菜单" @click="store.worldMapBack()">
          ×
        </button>
      </div>

      <div class="world-map-body">
        <div class="map-raster-wrap">
          <canvas
            ref="mapCanvas"
            class="map-raster"
            :width="WORLD_W * MAP_SCALE"
            :height="WORLD_H * MAP_SCALE"
            aria-label="仅显示已经实地探索过的世界地图瓦片"
          />
          <div class="map-legend" aria-label="地图符号说明">
            <div class="legend-row">
              <b>地点</b>
              <span><i class="legend-town" />主城</span>
              <span><i class="legend-village" />村落</span>
              <span><i class="legend-tribe" />部落</span>
              <span><i class="legend-cave" />洞窟</span>
            </div>
            <div class="legend-row">
              <b>路线</b>
              <span><i class="legend-gate-locked" />封锁关口</span>
              <span><i class="legend-gate-open" />已开放关口</span>
              <span><i class="legend-road" />公路/浅滩</span>
            </div>
            <div class="legend-row">
              <b>地形</b>
              <span><i class="legend-water" />水域·不可通行</span>
              <span><i class="legend-mountain" />山地·不可通行</span>
              <span><i class="legend-fog" />黑格·未探索</span>
              <span><i class="legend-player" />十字·当前位置</span>
            </div>
            <div class="legend-note">浅黄色地块表示右侧正在查看的区域，不代表已经清除威胁。</div>
          </div>
        </div>

        <aside class="map-region-info">
          <div class="region-switcher">
            <button
              type="button"
              aria-label="上一个已发现区域"
              @click="store.worldMapCycleRegion(-1)"
            >
              ‹
            </button>
            <div>
              <small>区域 {{ worldMap.selectedIndex + 1 }}/{{ worldMap.regions.length }}</small>
              <strong>{{ worldMap.selectedRegion.name }}</strong>
            </div>
            <button
              type="button"
              aria-label="下一个已发现区域"
              @click="store.worldMapCycleRegion(1)"
            >
              ›
            </button>
          </div>

          <div class="map-survey-line">
            <span>测绘进度</span><strong>{{ worldMap.exploration.percent }}%</strong>
          </div>
          <div class="map-survey-track">
            <span :style="{ width: worldMap.exploration.percent + '%' }" />
          </div>
          <div class="map-region-meta">
            <span :class="'risk-' + worldMap.selectedRegion.dangerLevel">
              威胁 {{ dangerPips(worldMap.selectedRegion) }}
            </span>
            <span>推荐 {{ recommendedLevelLabel(worldMap.selectedRegion) }}</span>
            <span>{{ vehicleRecommendationLabel(worldMap.selectedRegion) }}</span>
          </div>
          <p>{{ worldMap.selectedRegion.description }}</p>

          <div class="map-place-title">已发现地点</div>
          <div v-if="worldMap.selectedLocations.length" class="map-place-list">
            <div v-for="location in worldMap.selectedLocations" :key="location.id">
              <i
                :class="['place-' + location.kind, location.status ? 'is-' + location.status : '']"
              />
              <span>
                <strong>{{ location.name }}</strong>
                <em>{{ location.note }}</em>
              </span>
              <small>{{ location.x }}-{{ location.y }}</small>
            </div>
          </div>
          <div v-else class="map-place-empty">该区域尚未发现入口或聚落</div>
        </aside>
      </div>
      <div class="map-hint">方向键切换已发现区域 · B 返回</div>
    </div>

    <!-- 状态 -->
    <div v-else-if="view === 'status'" class="pixel-window panel">
      <div class="title">状态</div>
      <div v-for="p in members" :key="p.id || p.name" class="member">
        <div class="nm">{{ p.name }} Lv.{{ p.lv }}</div>
        <div class="hp">HP {{ p.hp }}/{{ p.maxHp }}</div>
        <div class="stats">
          攻{{ p.atk + (findHumanWeapon(p.weaponId)?.atk || 0) }} 防{{ p.def }} 速{{ p.spd }}
        </div>
        <div class="weapon">武器 {{ findHumanWeapon(p.weaponId)?.name || '徒手' }}</div>
        <div class="xp">EXP {{ p.xp }}/{{ xpNeed(p.lv) }}</div>
      </div>
      <div v-if="region" class="region-status">
        <div class="sub-title">当前区域</div>
        <div class="region-title">{{ region.name }}</div>
        <div class="region-meta">
          <span :class="`risk-${region.dangerLevel}`">威胁 {{ dangerPips(region) }}</span>
          <span>推荐 {{ recommendedLevelLabel(region) }}</span>
          <span>{{ vehicleRecommendationLabel(region) }}</span>
        </div>
        <div class="region-desc">{{ region.description }}</div>
      </div>
      <div class="hint">B 返回</div>
    </div>

    <!-- 道具 -->
    <div v-else-if="view === 'items'" class="pixel-window panel">
      <div class="title">道具</div>
      <div
        v-for="(id, i) in usableItems"
        :key="id"
        class="menu-row"
        :class="{ sel: idx === i }"
        @click="store.menuUse(i)"
      >
        {{ ITEMS[id].name }} ×{{ state.inventory.items[id] }}
      </div>
      <div v-if="!usableItems.length" class="empty">（空）</div>
      <div class="hint">A 使用 B 返回</div>
    </div>

    <!-- 战车 -->
    <div v-else-if="view === 'tanks'" class="pixel-window panel">
      <div class="title">战车</div>
      <div class="menu-row" :class="{ sel: idx === 0 }" @click="store.menuUse(0)">
        【{{ state.riding ? '乘坐中' : '徒步中' }}】乘降切换
      </div>
      <div
        v-for="(m, i) in members"
        :key="m.id || m.name"
        class="menu-row"
        :class="{ sel: idx === i + 1 }"
        @click="store.menuUse(i + 1)"
      >
        {{ m.name }}：{{ m.tankId ? TANKS.find((t) => t.id === m.tankId)!.name : '徒步' }}
      </div>
      <div
        class="menu-row"
        :class="{ sel: idx === members.length + 1 }"
        @click="store.menuUse(members.length + 1)"
      >
        返回
      </div>
    </div>

    <!-- 战车分配 -->
    <div v-else-if="view === 'tankassign'" class="pixel-window assign">
      <div class="title">{{ state.menu!.assignMember }} 的座驾</div>
      <div v-if="atGarage" class="menu-row" :class="{ sel: idx === 0 }" @click="store.menuUse(0)">
        徒步（当前战车停入首个空位）
      </div>
      <div
        v-for="(t, i) in assignmentTanks"
        :key="t.tankId"
        class="menu-row"
        :class="{ sel: idx === i + (atGarage ? 1 : 0) }"
        @click="store.menuUse(i + (atGarage ? 1 : 0))"
      >
        {{ TANKS.find((x) => x.id === t.tankId)!.name }}
        <small v-if="t.garageSlot !== null">
          · {{ String(t.garageSlot + 1).padStart(2, '0') }}号位</small
        >
      </div>
      <div v-if="!assignmentTanks.length && !atGarage" class="empty">没有可在现场调配的战车</div>
    </div>

    <!-- 人员装备 -->
    <div v-else-if="view === 'equipment'" class="pixel-window panel equipment-panel">
      <div class="title">人员装备</div>
      <div
        v-for="(member, i) in members"
        :key="member.id!"
        class="equipment-member"
        :class="{ sel: idx === i }"
        @click="store.menuUse(i)"
      >
        <div class="equipment-heading">
          <strong>{{ member.name }}</strong>
          <span>攻击 {{ member.atk + (findHumanWeapon(member.weaponId)?.atk || 0) }}</span>
        </div>
        <small>{{ findHumanWeapon(member.weaponId)?.name || '徒手' }}</small>
      </div>
      <div class="hint">A 选择成员 · B 返回</div>
    </div>

    <!-- 人员武器换装 -->
    <div v-else-if="view === 'weaponassign'" class="pixel-window panel equipment-panel">
      <div class="title">{{ equipmentMember?.name }} · 武器</div>
      <div
        v-for="(weapon, i) in humanWeaponChoices"
        :key="weapon.id || 'unarmed'"
        class="equipment-choice"
        :class="{ sel: idx === i }"
        @click="store.menuUse(i)"
      >
        <div class="equipment-heading">
          <strong>{{ weapon.name }}</strong>
          <span v-if="weapon.current">装备中</span>
          <span v-else-if="weapon.id">库存 ×{{ weapon.owned }}</span>
        </div>
        <small>{{ weapon.desc }}</small>
      </div>
      <div class="hint">A 换装 · B 返回</div>
    </div>

    <!-- 传送 -->
    <div v-else-if="view === 'teleport'" class="pixel-window panel">
      <div class="title">传送</div>
      <div
        v-for="(town, i) in teleportTargets"
        :key="town.id"
        class="menu-row"
        :class="{ sel: idx === i }"
        @click="store.menuUse(i)"
      >
        {{ town.name }}{{ state.map === town.id ? '（当前位置）' : '' }}
      </div>
      <div v-if="!teleportTargets.length" class="empty">（还没有解锁城镇）</div>
      <div class="hint">A 传送 · B 返回</div>
    </div>

    <!-- 赏金 -->
    <div v-else-if="view === 'bounty'" class="pixel-window panel">
      <div class="title">赏金榜</div>
      <div v-for="b in BOUNTIES" :key="b.id" class="bounty-row">
        <span
          :class="[
            'bname',
            {
              done: state.bounties.claimed[b.id],
              kill: state.bounties.killed[b.id] && !state.bounties.claimed[b.id]
            }
          ]"
        >
          {{ b.name }} {{ fmtG(b.gold) }}G
        </span>
        <span class="bstatus">
          {{
            state.bounties.claimed[b.id]
              ? '已领取'
              : state.bounties.killed[b.id]
                ? '可领取!'
                : '未讨伐'
          }}
        </span>
      </div>
      <div class="hint">领取赏金请前往情报屋 · B 返回</div>
    </div>

    <!-- 自动巡猎 -->
    <div v-else-if="view === 'hunt'" class="pixel-window panel hunt-panel">
      <div class="title">自动巡猎</div>
      <template v-if="huntTask">
        <div class="hunt-report">
          <div class="hunt-heading">
            <strong>{{ huntTaskRegion?.name }}</strong>
            <span>{{ huntRemaining > 0 ? '执行中' : '已返航' }}</span>
          </div>
          <div class="hunt-progress"><span :style="{ width: `${huntProgress * 100}%` }" /></div>
          <div class="hunt-grid">
            <span>派遣成员</span><strong>{{ huntTaskMember?.name }}</strong> <span>战车</span
            ><strong>{{ huntTaskTank?.name || '徒步巡猎' }}</strong> <span>剩余时间</span
            ><strong>{{ huntRemaining ? maintenanceTimeLabel(huntRemaining) : '等待结算' }}</strong>
            <span>预计收获</span><strong>{{ huntTask.xp }} EXP · {{ fmtG(huntTask.gold) }}G</strong>
            <span>已投入</span
            ><strong
              >装甲 {{ huntTask.armorCost }} · 主炮弹 {{ huntTask.mainAmmoCost }} · S-E 弹
              {{ huntTask.seAmmoCost }}</strong
            >
          </div>
        </div>
        <div
          class="hunt-command"
          :class="{ ready: huntRemaining === 0 }"
          @click="store.huntConfirm()"
        >
          {{ huntRemaining === 0 ? '接收巡猎报告' : '巡猎队尚未返航' }}
        </div>
        <div class="hint">世界时间会在探索、战斗、维修与休息时推进 · B 返回</div>
      </template>

      <template v-else>
        <div v-if="!canDispatchFromTown" class="hunt-warning">只能在城镇内派出巡猎队。</div>
        <div v-if="huntRegions.length" class="hunt-regions">
          <div
            v-for="(huntRegion, i) in huntRegions"
            :key="huntRegion.id"
            class="hunt-region-row"
            :class="{ sel: idx === i }"
            @click="store.huntSelectRegion(i)"
          >
            <span>{{ huntRegion.name }}</span>
            <small>{{ dangerPips(huntRegion) }} · {{ recommendedLevelLabel(huntRegion) }}</small>
          </div>
        </div>
        <div v-else class="empty">
          需要一名非队长成员；徒步只允许安全区，更危险区域必须配备能力足够的战车。
        </div>
        <div class="hunt-duration" aria-label="巡猎时长">
          <button
            v-for="duration in HUNT_DURATIONS"
            :key="duration"
            type="button"
            :class="{ on: state.menu?.huntDuration === duration }"
            @click="store.huntSetDuration(duration)"
          >
            {{ maintenanceTimeLabel(duration) }}
          </button>
        </div>
        <div v-if="huntPreview" class="hunt-preview">
          <div class="hunt-heading">
            <strong>{{ huntPreview.member?.name }} · {{ huntPreview.riskLabel }}</strong>
            <span>{{
              huntPreview.tank
                ? TANKS.find((tank) => tank.id === huntPreview.tank!.tankId)?.name
                : '徒步'
            }}</span>
          </div>
          <div class="hunt-grid">
            <span>预计收获</span
            ><strong>{{ huntPreview.xp }} EXP · {{ fmtG(huntPreview.gold) }}G</strong>
            <span>装甲消耗</span><strong>{{ huntPreview.armorCost }}</strong> <span>弹药消耗</span
            ><strong>主炮 {{ huntPreview.mainAmmoCost }} · S-E {{ huntPreview.seAmmoCost }}</strong>
          </div>
          <div v-if="huntPreview.reason" class="hunt-warning">{{ huntPreview.reason }}</div>
        </div>
        <div
          class="hunt-command"
          :class="{ ready: canDispatchFromTown && huntPreview?.canStart }"
          @click="store.huntConfirm()"
        >
          派出巡猎队
        </div>
        <div class="hint">方向键选择区域 · 左右调整时长 · A 派遣 · B 返回</div>
      </template>
    </div>

    <!-- 设置 -->
    <div v-else-if="view === 'options'" class="pixel-window panel">
      <div class="title">设置</div>
      <div
        class="menu-row option-row"
        :class="{ sel: idx === 0 }"
        role="button"
        tabindex="0"
        @click="settings.activateOption(0)"
      >
        音乐：{{ settings.muted ? '静音' : settings.optionLabel(0) }}
      </div>
      <div
        class="menu-row option-row"
        :class="{ sel: idx === 1 }"
        role="button"
        tabindex="0"
        @click="settings.activateOption(1)"
      >
        音效：{{ settings.optionLabel(1) }}
      </div>
      <div
        class="menu-row option-row"
        :class="{ sel: idx === 2 }"
        role="button"
        tabindex="0"
        @click="settings.activateOption(2)"
      >
        文本速度：{{ settings.optionLabel(2) }}
      </div>
      <div
        class="menu-row option-row"
        :class="{ sel: idx === 3 }"
        role="button"
        tabindex="0"
        @click="store.menuUse(3)"
      >
        返回标题画面
      </div>
      <div class="hint">方向键调节 · A 切换 · B 返回</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.menu-root {
  position: absolute;
  inset: 0;
  z-index: 22;
}
.left {
  position: absolute;
  left: 3%;
  top: 14%;
  padding: 10px 16px 10px 22px;
  font-size: 13px;
}
.left .menu-row {
  padding: 5px 0;
}
.panel {
  position: absolute;
  right: 3%;
  top: 14%;
  width: 52%;
  max-height: 68%;
  overflow-y: auto;
  scrollbar-color: #5d6672 #171c28;
  scrollbar-width: thin;
  padding: 10px 14px;
  font-size: 12px;
}
.panel::-webkit-scrollbar {
  width: 6px;
}
.panel::-webkit-scrollbar-track {
  background: #171c28;
}
.panel::-webkit-scrollbar-thumb {
  background: #5d6672;
}
.world-map-panel {
  position: absolute;
  left: 4%;
  top: 6%;
  width: 92%;
  height: 87%;
  padding: 10px 12px 8px;
  background: #11191b;
  font-size: 10px;
}
.world-map-heading {
  display: flex;
  min-height: 30px;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid #4c5b59;
  padding-bottom: 5px;
}
.map-coordinate {
  margin-top: 2px;
  color: #87a19b;
  font-family: 'Courier New', monospace;
  font-size: 8px;
}
.map-close,
.region-switcher button {
  display: grid;
  width: 24px;
  height: 22px;
  border: 1px solid #667a75;
  border-radius: 2px;
  background: #172224;
  color: #d8d3b8;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  place-items: center;
  cursor: pointer;
}
.map-close:focus-visible,
.region-switcher button:focus-visible {
  outline: 2px solid #e2c66e;
  outline-offset: 1px;
}
.world-map-body {
  display: grid;
  grid-template-columns: minmax(0, 376px) minmax(0, 1fr);
  height: 336px;
  gap: 12px;
  padding-top: 7px;
}
.map-raster-wrap {
  min-width: 0;
}
.map-raster {
  display: block;
  width: 100%;
  max-height: 265px;
  aspect-ratio: 4 / 3;
  border: 1px solid #64716d;
  background: #070a0b;
  image-rendering: pixelated;
}
.map-legend {
  display: grid;
  min-height: 66px;
  align-content: center;
  gap: 2px;
  padding-top: 3px;
  color: #829690;
  font-size: 7px;
}
.legend-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}
.legend-row b {
  width: 25px;
  flex: 0 0 auto;
  color: #c7bc84;
  font-weight: normal;
}
.legend-row span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
.legend-note {
  color: #667b76;
  line-height: 1.25;
}
.map-legend i,
.map-place-list i {
  display: inline-block;
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
}
.legend-town,
.place-town {
  background: #f0c75e;
}
.legend-village,
.place-village {
  background: #d7d38a;
  box-shadow: 0 0 0 1px #6e6b4c;
}
.legend-tribe,
.place-tribe {
  background: #d98d5b;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}
.legend-cave,
.place-cave {
  background: #78c3bd;
  transform: rotate(45deg) scale(0.75);
}
.legend-gate-locked,
.legend-gate-open,
.place-gate {
  border-right: 2px solid currentColor;
  border-left: 2px solid currentColor;
  background: linear-gradient(transparent 35%, currentColor 35% 65%, transparent 65%);
}
.legend-gate-locked,
.place-gate.is-locked {
  color: #d45d4d;
}
.legend-gate-open,
.place-gate.is-open {
  color: #75c277;
}
.legend-road {
  height: 3px !important;
  background: #9a825b;
}
.legend-water {
  background: #275f78;
}
.legend-mountain {
  background: #686e70;
}
.legend-player {
  position: relative;
  background: transparent;
}
.legend-player::before,
.legend-player::after {
  position: absolute;
  background: #d65045;
  content: '';
}
.legend-player::before {
  top: 2px;
  left: 0;
  width: 6px;
  height: 2px;
}
.legend-player::after {
  top: 0;
  left: 2px;
  width: 2px;
  height: 6px;
}
.legend-fog {
  border: 1px solid #33403e;
  background: #090d0e;
}
.map-region-info {
  min-width: 0;
  max-height: 332px;
  overflow-y: auto;
  padding-right: 3px;
  scrollbar-color: #60736e #172123;
  scrollbar-width: thin;
}
.region-switcher {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 24px;
  align-items: center;
  gap: 5px;
  border-bottom: 1px solid #3c4b49;
  padding-bottom: 7px;
  text-align: center;
}
.region-switcher div {
  min-width: 0;
}
.region-switcher small,
.region-switcher strong {
  display: block;
}
.region-switcher small {
  color: #718985;
  font-size: 7px;
}
.region-switcher strong {
  margin-top: 2px;
  color: #ead58b;
  font-size: 10px;
  overflow-wrap: anywhere;
}
.map-survey-line {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  color: #829690;
  font-size: 8px;
}
.map-survey-line strong {
  color: #d2c88f;
  font-weight: normal;
}
.map-survey-track {
  height: 4px;
  margin-top: 3px;
  background: #25312f;
}
.map-survey-track span {
  display: block;
  height: 100%;
  background: #779a73;
}
.map-region-meta {
  display: grid;
  margin-top: 8px;
  gap: 3px;
  color: #a9b6b1;
  font-size: 8px;
}
.map-region-meta .risk-1,
.map-region-meta .risk-2 {
  color: #7fca85;
}
.map-region-meta .risk-3 {
  color: #dbc66b;
}
.map-region-meta .risk-4,
.map-region-meta .risk-5 {
  color: #e27764;
}
.map-region-info p {
  margin-top: 8px;
  color: #9aaba6;
  font-size: 8px;
  line-height: 1.45;
}
.map-place-title {
  margin-top: 10px;
  border-bottom: 1px solid #344240;
  padding-bottom: 3px;
  color: #d5c887;
  font-size: 8px;
}
.map-place-list > div {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  padding: 5px 1px;
  border-bottom: 1px solid #263331;
  color: #b9c4bf;
  font-size: 8px;
}
.map-place-list span {
  display: grid;
  min-width: 0;
  overflow-wrap: anywhere;
}
.map-place-list span strong {
  color: #c5cfca;
  font-size: 8px;
  font-weight: normal;
}
.map-place-list span em {
  margin-top: 1px;
  color: #748783;
  font-size: 6px;
  font-style: normal;
  line-height: 1.3;
}
.map-place-list small {
  color: #71827e;
  font-family: 'Courier New', monospace;
  font-size: 7px;
}
.map-place-empty {
  padding-top: 7px;
  color: #70817d;
  font-size: 8px;
  line-height: 1.4;
}
.map-hint {
  height: 14px;
  color: #71847f;
  font-size: 8px;
  text-align: right;
}
.member {
  margin: 6px 0;
}
.region-status {
  margin-top: 9px;
  padding-top: 7px;
  border-top: 1px solid #4a5260;
}
.sub-title {
  color: #8e9da2;
  font-size: 9px;
}
.region-title {
  margin-top: 2px;
  color: #eee5ba;
}
.region-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 9px;
  margin-top: 3px;
  color: #b9c4c6;
  font-size: 9px;
}
.region-meta [class^='risk-'] {
  color: #7ed083;
}
.region-meta .risk-3 {
  color: #e0c768;
}
.region-meta .risk-4,
.region-meta .risk-5 {
  color: #ef7a67;
}
.region-desc {
  margin-top: 4px;
  color: #aab3b5;
  font-size: 9px;
  line-height: 1.45;
}
.nm {
  color: #fff;
}
.hp {
  color: #78d878;
}
.stats {
  color: #a8b8c8;
}
.xp {
  color: #c8a8e8;
}
.weapon {
  color: #e1c77b;
  font-size: 10px;
}
.hint {
  margin-top: 8px;
  color: #8890a0;
  font-size: 10px;
}
.option-row {
  padding: 4px 0;
}
.empty {
  color: #8890a0;
}
.bounty-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}
.bname.done {
  color: #707078;
}
.bname.kill {
  color: #f8e048;
}
.bstatus {
  color: #8890a0;
  font-size: 10px;
}
.hunt-panel {
  font-size: 10px;
}
.hunt-heading {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #e9e3bd;
}
.hunt-heading span {
  color: #94a4ad;
}
.hunt-progress {
  height: 4px;
  margin: 7px 0;
  background: #202632;
}
.hunt-progress span {
  display: block;
  height: 100%;
  background: #7eaa78;
}
.hunt-grid {
  display: grid;
  grid-template-columns: minmax(68px, 0.6fr) minmax(0, 1.4fr);
  gap: 3px 8px;
}
.hunt-grid > span {
  color: #82919c;
}
.hunt-grid > strong {
  min-width: 0;
  color: #c8d0cb;
  font-weight: normal;
  overflow-wrap: anywhere;
}
.hunt-regions {
  margin-top: 5px;
  border-top: 1px solid #39414f;
  border-bottom: 1px solid #39414f;
}
.hunt-region-row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 3px;
  cursor: pointer;
}
.hunt-region-row small {
  color: #87959d;
  font-size: 8px;
}
.hunt-region-row.sel {
  background: #252b36;
  color: #f8e048;
}
.hunt-duration {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 7px;
  border: 1px solid #3f4855;
}
.hunt-duration button {
  min-width: 0;
  border: 0;
  border-right: 1px solid #3f4855;
  padding: 4px 2px;
  background: transparent;
  color: #919da6;
  font: inherit;
  cursor: pointer;
}
.hunt-duration button:last-child {
  border-right: 0;
}
.hunt-duration button.on {
  background: #343744;
  color: #f0df8d;
}
.hunt-preview,
.hunt-report {
  margin-top: 8px;
  border-left: 2px solid #697e72;
  padding: 5px 7px;
  background: rgb(10 15 20 / 62%);
}
.hunt-warning {
  margin: 6px 0;
  color: #e5a26f;
  line-height: 1.4;
}
.hunt-command {
  margin-top: 8px;
  padding: 5px;
  color: #68727b;
  text-align: center;
  cursor: pointer;
}
.hunt-command.ready {
  background: #30383b;
  color: #8fdf94;
}
.garage-panel {
  position: absolute;
  left: 8%;
  top: 11%;
  width: 84%;
  max-height: 76%;
  overflow-y: auto;
  padding: 13px 16px;
  font-size: 11px;
}
.garage-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.garage-count {
  margin-top: 3px;
  color: #8d9aa0;
  font-size: 9px;
}
.garage-status {
  max-width: 48%;
  color: #f0d26d;
  text-align: right;
  overflow-wrap: anywhere;
}
.garage-status.empty,
.empty-copy {
  color: #849198;
}
.garage-slots {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  margin: 11px 0 9px;
  border: 1px solid #555f63;
  background: #11171a;
}
.garage-slot-cell {
  min-width: 0;
  height: 39px;
  border-right: 1px solid #41494d;
  padding: 5px 2px 3px;
  color: #68747a;
  text-align: center;
}
.garage-slot-cell:last-child {
  border-right: 0;
}
.garage-slot-cell strong,
.garage-slot-cell span {
  display: block;
}
.garage-slot-cell strong {
  color: #c4a957;
  font-size: 10px;
}
.garage-slot-cell span {
  margin-top: 3px;
  font-size: 7px;
  white-space: nowrap;
}
.garage-slot-cell.occupied {
  background: #222b2d;
  color: #b7c2bd;
}
.garage-slot-cell.active {
  box-shadow: inset 0 -3px #e1bd4f;
  color: #f2df99;
}
.garage-tank-stats {
  display: flex;
  gap: 18px;
  min-height: 18px;
  border-bottom: 1px solid #41494d;
  padding-bottom: 6px;
  color: #aebdc0;
  font-size: 9px;
}
.garage-actions {
  margin-top: 7px;
}
.garage-actions .menu-row {
  padding: 5px 4px;
}
.assign {
  position: absolute;
  left: 20%;
  top: 34%;
  width: 60%;
  padding: 10px 18px;
}
.equipment-panel {
  font-size: 10px;
}
.equipment-member,
.equipment-choice {
  border-bottom: 1px solid #303744;
  padding: 6px 4px;
  cursor: pointer;
}
.equipment-member.sel,
.equipment-choice.sel {
  background: #292e38;
  color: #f8e048;
}
.equipment-heading {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.equipment-heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
}
.equipment-heading span {
  flex: 0 0 auto;
  color: #9fb0b7;
}
.equipment-member small,
.equipment-choice small {
  display: block;
  margin-top: 3px;
  color: #87949e;
  font-size: 9px;
  line-height: 1.35;
}
</style>
