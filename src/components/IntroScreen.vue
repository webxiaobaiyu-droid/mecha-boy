<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@/game/core/store'
import { INTRO } from '@/game/data/story'

const shown = computed(() => INTRO.slice(0, store.state.intro.idx + 1))
const last = computed(() => store.state.intro.idx >= INTRO.length - 1)
</script>

<template>
  <div class="intro">
    <div v-for="(ln, i) in shown" :key="i" class="line">{{ ln }}</div>
    <div v-if="last" class="start-hint">按 Z 开始</div>
  </div>
</template>

<style lang="scss" scoped>
.intro {
  position: absolute;
  inset: 0;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #c8c8d8;
  z-index: 25;
}
.line {
  font-size: clamp(12px, 2.4vw, 16px);
  text-align: center;
}
.start-hint {
  margin-top: 10px;
  color: #f8e048;
  font-size: 13px;
}
</style>
