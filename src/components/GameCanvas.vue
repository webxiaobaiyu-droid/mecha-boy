<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { store } from '@/game/core/store'
import { PixiGameRenderer } from '@/game/pixi/PixiGameRenderer'
import { TOWNS } from '@/game/data/maps'
import * as audio from '@/game/audio/audio'
import { weatherVisualIntensity } from '@/game/systems/environment'

const host = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const loading = ref(true)
const loadError = ref(false)
let renderer: PixiGameRenderer | null = null
let raf = 0
let last = 0
let mounted = true

function frame(time: number) {
  const dt = Math.min(0.05, (time - last) / 1000 || 0.016)
  last = time
  store.update(dt)
  renderer?.update(store.state, dt)
  const state = store.state
  const outdoors =
    ['world', 'town', 'battle', 'menu', 'shop', 'password'].includes(state.screen) &&
    (state.map === 'world' || TOWNS.some((town) => town.id === state.map))
  audio.setWeatherAmbience(
    outdoors ? state.environment.weather : null,
    outdoors ? weatherVisualIntensity(state.environment) : 0
  )
  raf = requestAnimationFrame(frame)
}

onMounted(async () => {
  if (!canvas.value || !host.value) return
  renderer = new PixiGameRenderer()
  try {
    await renderer.init(canvas.value, host.value)
    if (!mounted) return
    store.boot()
    loading.value = false
    last = performance.now()
    raf = requestAnimationFrame(frame)
  } catch (error) {
    console.error('Pixi game renderer failed to initialize', error)
    loadError.value = true
    loading.value = false
  }
})

onUnmounted(() => {
  mounted = false
  cancelAnimationFrame(raf)
  renderer?.destroy()
  renderer = null
  audio.setWeatherAmbience(null)
})
</script>

<template>
  <div ref="host" class="pixi-host">
    <canvas ref="canvas" class="game-canvas"></canvas>
    <div v-if="loading" class="renderer-status">正在装载荒野资源...</div>
    <div v-else-if="loadError" class="renderer-status error">
      <strong>图形引擎启动失败</strong>
      <span>请确认浏览器已启用 WebGL，然后刷新页面</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.pixi-host,
.game-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pixi-host {
  overflow: hidden;
  background: #05070a;
  touch-action: none;
}

.game-canvas {
  display: block;
  image-rendering: pixelated;
}

.renderer-status {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 8px;
  background: #070a0d;
  color: #d8c06a;
  font-size: 14px;
  text-align: center;
}

.renderer-status.error {
  color: #ef7267;
}

.renderer-status span {
  color: #d8d0c0;
  font-size: 12px;
}
</style>
