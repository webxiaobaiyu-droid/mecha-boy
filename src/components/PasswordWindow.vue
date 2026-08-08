<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@/game/core/store'

const state = store.state
const code = computed(() => state.pass!.digits.join(''))
const entered = computed(() => [0, 1, 2, 3].filter((i) => state.flags['pass' + i]).length)
</script>

<template>
  <div class="pw-wrap">
    <div class="pixel-window pw">
      <div class="title">地狱门终端</div>
      <div class="sub">请输入 4 位密码</div>
      <div class="entered">已认证 {{ entered }}/4</div>
      <div class="digits">
        <span
          v-for="(ch, i) in code"
          :key="i"
          class="digit"
          :class="{ on: state.pass!.pos === i }"
          >{{ ch }}</span
        >
      </div>
      <div class="hint">↑↓改数字 ←→移动 Z 确定</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.pw-wrap {
  position: absolute;
  inset: 0;
  z-index: 22;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pw {
  padding: 16px 24px;
  text-align: center;
}
.title {
  font-size: 15px;
}
.sub {
  margin-top: 8px;
  font-size: 12px;
  color: #c8d0d8;
}
.entered {
  margin-top: 4px;
  font-size: 10px;
  color: #a8c8a8;
}
.digits {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 10px;
}
.digit {
  width: 34px;
  height: 30px;
  border: 2px solid #000;
  border-top-color: #d0d8e8;
  border-left-color: #d0d8e8;
  border-bottom-color: #384058;
  border-right-color: #384058;
  background: #101828;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
}
.digit.on {
  color: #f8e048;
}
.hint {
  margin-top: 12px;
  font-size: 10px;
  color: #8890a0;
}
</style>
