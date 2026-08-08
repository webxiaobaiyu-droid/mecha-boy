<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { store } from '@/game/core/store'
import {
  bindCanvas,
  drawBattleScene,
  drawScene,
  clear,
  text,
  setPresentationScale
} from '@/game/engine/renderer'
import { preloadGameAssets } from '@/game/assets'
import { TOWNS } from '@/game/data/maps'
import * as audio from '@/game/audio/audio'
import { weatherVisualIntensity } from '@/game/systems/environment'

const props = defineProps<{ presentationScale: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0
let last = 0
let mounted = true

watch(
  () => props.presentationScale,
  (scale) => setPresentationScale(scale),
  { immediate: true }
)

function frame(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000 || 0.016)
  last = t
  store.update(dt)
  const s = store.state
  if (s.screen === 'battle') drawBattleScene(s)
  else if (['world', 'town', 'cave', 'room', 'menu', 'shop', 'password'].includes(s.screen))
    drawScene(s)
  else clear('#05050a')
  const outdoors =
    ['world', 'town', 'battle', 'menu', 'shop', 'password'].includes(s.screen) &&
    (s.map === 'world' || TOWNS.some((town) => town.id === s.map))
  audio.setWeatherAmbience(
    outdoors ? s.environment.weather : null,
    outdoors ? weatherVisualIntensity(s.environment) : 0
  )
  raf = requestAnimationFrame(frame)
}

onMounted(async () => {
  if (canvas.value) {
    bindCanvas(canvas.value)
    clear('#05050a')
    text('正在装载荒野资源...', 320, 224, '#d8c06a', 16, 'center', true)
    try {
      await preloadGameAssets()
      if (!mounted) return
      store.boot()
      last = performance.now()
      raf = requestAnimationFrame(frame)
    } catch (error) {
      console.error('Game asset preload failed', error)
      clear('#140d0d')
      text('资源装载失败', 320, 216, '#ef7267', 18, 'center', true)
      text('请刷新页面重试', 320, 248, '#d8d0c0', 13, 'center')
    }
  }
})

onUnmounted(() => {
  mounted = false
  cancelAnimationFrame(raf)
  audio.setWeatherAmbience(null)
})
</script>

<template>
  <canvas ref="canvas" width="640" height="480" class="game-canvas"></canvas>
</template>

<style lang="scss" scoped>
.game-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 640px;
  height: 480px;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
  background: #000;
  touch-action: none;
}
</style>
