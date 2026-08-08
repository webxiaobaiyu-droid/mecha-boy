<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@/game/core/store'
import { ENDING } from '@/game/data/story'

const shown = computed(() => ENDING.slice(0, store.state.ending!.idx + 1))
const last = computed(() => store.state.ending!.idx >= ENDING.length - 1)
</script>

<template>
  <div class="ending">
    <div
      v-for="(ln, i) in shown"
      :key="i"
      class="line"
      :class="{ special: ln === '完' || ln.includes('荒原引擎') }"
    >
      {{ ln }}
    </div>
    <div v-if="last" class="hint">按 Z 返回标题</div>
  </div>
</template>

<style lang="scss" scoped>
.ending {
  position: absolute;
  inset: 0;
  background: #05050a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 13px;
  color: #c8c8d8;
  z-index: 25;
}
.line {
  font-size: clamp(12px, 2.4vw, 15px);
  text-align: center;
}
.special {
  color: #e8c878;
}
.hint {
  margin-top: 8px;
  color: #f8e048;
  font-size: 12px;
}
</style>
