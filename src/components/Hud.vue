<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@/game/core/store'
import { ROOMS, TOWNS } from '@/game/data/maps'
import { TANKS } from '@/game/data/equipment'
import { fmtG } from '@/game/utils'
import { formatWorldTime, weatherLabel } from '@/game/systems/environment'
import {
  currentRegion,
  dangerPips,
  recommendedLevelLabel,
  vehicleRecommendationLabel
} from '@/game/systems/regions'

const state = store.state
const townName = computed(
  () =>
    TOWNS.find((t) => t.id === state.map)?.name || ROOMS.find((r) => r.id === state.map)?.name || ''
)
const tankName = computed(() => {
  if (!state.riding || state.map !== 'world') return ''
  const t = store.getActiveTank()
  return t ? TANKS.find((x) => x.id === t.tankId)?.name || '' : ''
})
const isOutdoors = computed(
  () => state.map === 'world' || TOWNS.some((town) => town.id === state.map)
)
const environmentText = computed(() => {
  const clock = `第${state.environment.day}日 ${formatWorldTime(state.environment)}`
  return isOutdoors.value ? `${clock} ${weatherLabel(state.environment.weather)}` : clock
})
const region = computed(() => currentRegion(state))
const objective = computed(() => {
  switch (state.flags.tutorial_step) {
    case 0:
      return '目标：和父亲对话'
    case 1:
      return '目标：去南侧洞窟取回战车'
    case 2:
      return '目标：返回拉多镇'
    case 3:
      return '目标：回自宅二楼免费休息'
    case 4:
      return '目标：下楼找父亲学习战车整备'
    case 5:
      return '目标：去老乔工房诊断旧战车并执行维修工单'
    case 6:
      return '目标：在老乔工房完成副炮清杂训练'
    case 7:
      return '目标：在老乔工房完成主炮破甲训练'
    case 8:
      return '目标：在老乔工房完成 S-E 群攻训练'
    case 9:
      return '目标：沿公路前往麦镇，招募机械师美娜'
    case 10:
      return '目标：进入任意情报屋查看悬赏榜'
    case 11:
      return '目标：整备战车，前往波布湖区讨伐水怪'
    case 12:
      return '目标：回情报屋领取水怪赏金'
    default:
      return ''
  }
})
</script>

<template>
  <div class="hud">
    <div class="hud-line">
      <span class="context">
        <span class="town">{{ townName }}</span>
        <span class="environment">{{ environmentText }}</span>
      </span>
      <span class="tank">{{ tankName }}</span>
      <span class="gold">G {{ fmtG(state.gold) }}</span>
    </div>
    <div v-if="region" class="region-line">
      <span class="region-name">区域·{{ region.name }}</span>
      <span class="region-danger" :class="`danger-${region.dangerLevel}`">
        威胁 {{ dangerPips(region) }}
      </span>
      <span>{{ recommendedLevelLabel(region) }}</span>
      <span>{{ vehicleRecommendationLabel(region) }}</span>
    </div>
    <div v-if="objective" class="objective">{{ objective }}</div>
  </div>
</template>

<style lang="scss" scoped>
.hud {
  position: absolute;
  top: 4px;
  left: 8px;
  right: 8px;
  z-index: 15;
  font-size: 12px;
  pointer-events: none;
  text-shadow: 1px 1px 0 #000;
}
.hud-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  justify-content: space-between;
}
.context {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}
.objective {
  max-width: 72%;
  margin-top: 4px;
  color: #f0d890;
  font-size: 10px;
  line-height: 1.2;
}
.region-line {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 2px 5px 2px 4px;
  border-left: 2px solid #718b78;
  background: rgb(5 10 15 / 68%);
  color: #b7c3bd;
  font-size: 9px;
  line-height: 1.25;
  white-space: nowrap;
}
.region-name {
  color: #e4e0bd;
}
.region-danger {
  color: #7ed083;
}
.danger-3 {
  color: #e0c768;
}
.danger-4,
.danger-5 {
  color: #ef7a67;
}
.town {
  color: #e0d8a0;
}
.environment {
  color: #b9ced0;
  font-size: 10px;
}
.tank {
  min-width: 0;
  color: #a8d8a8;
}
.gold {
  flex: 0 0 auto;
  color: #f8e048;
}
</style>
