<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <div class="banner-wrap">
    <div class="pixel-window banner">
      <span class="title">{{ text }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.banner-wrap {
  position: absolute;
  left: 50%;
  top: 44%;
  transform: translate(-50%, -50%);
  z-index: 20;
  pointer-events: none;
}
.banner {
  padding: 6px 22px;
  font-size: 15px;
  letter-spacing: 2px;
}
</style>
