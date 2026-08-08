<script setup lang="ts">
import { store } from '@/game/core/store'
</script>

<template>
  <div class="gameover">
    <div class="go">全 员 倒 下</div>
    <div class="sub">救援队正在把你们送回拉多镇……</div>
    <div class="penalty">醒来后损失一半随身金币</div>
    <div v-if="store.state.goT > 1.2" class="hint">— 按 Z 在自宅醒来 —</div>
  </div>
</template>

<style lang="scss" scoped>
.gameover {
  position: absolute;
  inset: 0;
  background: #0a0505;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  z-index: 25;
}
.go {
  color: #d84848;
  font-size: clamp(24px, 5vw, 36px);
  font-weight: bold;
  letter-spacing: 8px;
  text-shadow: 2px 2px 0 #000;
}
.sub {
  color: #a8a8b8;
  font-size: 12px;
}
.penalty {
  color: #d8b860;
  font-size: 11px;
}
.hint {
  color: #f8e048;
  font-size: 12px;
}
</style>
