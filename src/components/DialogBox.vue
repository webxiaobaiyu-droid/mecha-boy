<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@/game/core/store'
import * as input from '@/game/engine/input'

const d = computed(() => store.state.dialog)
const shown = computed(() => {
  const dd = d.value
  if (!dd) return ''
  return dd.texts[dd.idx].slice(0, Math.floor(dd.reveal))
})
const done = computed(() => {
  const dd = d.value
  return !!dd && Math.floor(dd.reveal) >= dd.texts[dd.idx].length
})

function advance() {
  input.press('a')
}
</script>

<template>
  <div class="dialog-wrap" role="dialog" aria-live="polite" @pointerdown="advance">
    <div class="pixel-window dialog">
      <div class="text">{{ shown }}</div>
      <div v-if="done" class="next">▼</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dialog-wrap {
  position: absolute;
  left: 2%;
  right: 2%;
  bottom: 3%;
  z-index: 30;
  pointer-events: auto;
  cursor: pointer;
}
.dialog {
  min-height: 74px;
  padding: 10px 14px;
  position: relative;
  font-size: 14px;
  line-height: 1.7;
}
.next {
  position: absolute;
  right: 12px;
  bottom: 6px;
  color: #f8e048;
  font-size: 12px;
}
</style>
