<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { store } from '@/game/core/store'
import { formatWorldTime } from '@/game/systems/environment'

const sleep = computed(() => store.state.sleep)
const opacity = computed(() => {
  const value = sleep.value
  if (!value) return 0
  if (value.phase === 'fadeout') return Math.min(1, value.t / 0.7)
  if (value.phase === 'fadein') return Math.max(0, 1 - value.t / 0.8)
  return 1
})
const overlayStyle = computed<CSSProperties>(() => ({ opacity: opacity.value }))
const stars = [
  [18, 20],
  [31, 12],
  [44, 25],
  [62, 15],
  [76, 29],
  [84, 12],
  [11, 37],
  [55, 39]
]
</script>

<template>
  <div v-if="sleep" class="sleep-overlay" :style="overlayStyle" aria-live="polite">
    <div v-if="sleep.phase === 'night'" class="night-scene" aria-label="夜晚休息中">
      <span
        v-for="([x, y], index) in stars"
        :key="index"
        class="star"
        :style="{ left: `${x}%`, top: `${y}%` }"
      />
      <div class="moon" />
      <div class="horizon" />
      <div class="sleep-mark">Z<br /><span>Z</span></div>
    </div>
    <div v-else-if="sleep.phase === 'summary'" class="morning-summary">
      <span>DAY {{ store.state.environment.day }}</span>
      <strong>{{ formatWorldTime(store.state.environment) }}</strong>
      <p>人员 HP 已恢复</p>
      <p>战车状态未改变</p>
      <p v-if="sleep.source === 'inn'">旅途记录已保存</p>
    </div>
  </div>
</template>

<style scoped>
.sleep-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  overflow: hidden;
  background: #03050a;
  color: #e7e5cf;
  pointer-events: all;
}
.night-scene {
  position: absolute;
  inset: 0;
  background: #070a13;
}
.star {
  position: absolute;
  width: 2px;
  height: 2px;
  background: #bec8cb;
  box-shadow: 0 0 0 1px #29313c;
}
.moon {
  position: absolute;
  top: 14%;
  right: 18%;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #dfd9a9;
  box-shadow: inset -9px -4px 0 #070a13;
}
.horizon {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 28%;
  background: #0c1015;
  clip-path: polygon(
    0 55%,
    13% 38%,
    25% 64%,
    39% 28%,
    56% 59%,
    69% 34%,
    83% 60%,
    100% 42%,
    100% 100%,
    0 100%
  );
}
.sleep-mark {
  position: absolute;
  right: 38%;
  bottom: 30%;
  color: #8f9bb1;
  font-size: 18px;
  line-height: 0.75;
  transform: rotate(8deg);
}
.sleep-mark span {
  padding-left: 9px;
  font-size: 11px;
}
.morning-summary {
  position: absolute;
  top: 30%;
  left: 50%;
  width: min(72%, 280px);
  transform: translateX(-50%);
  text-align: center;
}
.morning-summary > span {
  display: block;
  color: #93a4ad;
  font-size: 10px;
}
.morning-summary strong {
  display: block;
  margin: 4px 0 12px;
  color: #f0df91;
  font-size: 24px;
  font-weight: normal;
}
.morning-summary p {
  margin: 4px 0;
  color: #c8d0ce;
  font-size: 10px;
}
</style>
