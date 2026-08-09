<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type CSSProperties } from 'vue'
import GameCanvas from '@/components/GameCanvas.vue'
import TitleScreen from '@/components/TitleScreen.vue'
import IntroScreen from '@/components/IntroScreen.vue'
import DialogBox from '@/components/DialogBox.vue'
import Banner from '@/components/Banner.vue'
import Hud from '@/components/Hud.vue'
import FieldMenu from '@/components/FieldMenu.vue'
import ShopWindow from '@/components/ShopWindow.vue'
import PasswordWindow from '@/components/PasswordWindow.vue'
import BattleUi from '@/components/BattleUi.vue'
import EndingScreen from '@/components/EndingScreen.vue'
import GameOverScreen from '@/components/GameOverScreen.vue'
import TouchControls from '@/components/TouchControls.vue'
import SleepOverlay from '@/components/SleepOverlay.vue'
import { store } from '@/game/core/store'
import { calculateViewportLayout, type TouchPlacement } from '@/ui/viewportLayout'

const state = store.state
const isMap = computed(() => ['world', 'town', 'cave', 'room'].includes(state.screen))
const touchScreens = new Set([
  'title',
  'intro',
  'world',
  'town',
  'cave',
  'room',
  'menu',
  'shop',
  'password',
  'battle',
  'ending',
  'gameover'
])

function hasTouchInput(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(hover: none), (pointer: coarse)').matches ||
    window.innerWidth <= 768
  )
}

const viewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)
const viewportHeight = ref(typeof window === 'undefined' ? 720 : window.innerHeight)
const touchCapable = ref(hasTouchInput())
const showTouch = computed(() => touchCapable.value && touchScreens.has(state.screen))
const touchPlacement = computed<TouchPlacement>(() =>
  showTouch.value ? (viewportWidth.value > viewportHeight.value ? 'sides' : 'below') : 'hidden'
)

const viewportStyle = computed<CSSProperties>(() => {
  const layout = calculateViewportLayout({
    width: viewportWidth.value,
    height: viewportHeight.value,
    touchPlacement: touchPlacement.value
  })
  return {
    '--ui-scale': String(layout.uiScale),
    '--ui-x': `${Math.round(layout.uiX)}px`,
    '--ui-y': `${Math.round(layout.uiY)}px`,
    '--control-size': `${Math.round(layout.controlSize)}px`,
    '--control-gap': `${layout.controlGap}px`
  }
})

function updateViewport() {
  const visual = window.visualViewport
  viewportWidth.value = Math.max(1, Math.floor(visual?.width || window.innerWidth))
  viewportHeight.value = Math.max(1, Math.floor(visual?.height || window.innerHeight))
  touchCapable.value = hasTouchInput()
}

onMounted(() => {
  window.addEventListener('resize', updateViewport)
  window.addEventListener('orientationchange', updateViewport)
  window.visualViewport?.addEventListener('resize', updateViewport)
  updateViewport()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewport)
  window.removeEventListener('orientationchange', updateViewport)
  window.visualViewport?.removeEventListener('resize', updateViewport)
})
</script>

<template>
  <div class="game-viewport" :style="viewportStyle">
    <GameCanvas />
    <main class="ui-safe">
      <Banner v-if="state.bannerT > 0" :text="state.bannerText" />
      <Hud v-if="isMap" />
      <DialogBox v-if="state.dialog" />
      <BattleUi v-if="state.screen === 'battle'" />
      <TitleScreen v-if="state.screen === 'title'" />
      <IntroScreen v-if="state.screen === 'intro'" />
      <FieldMenu v-if="state.screen === 'menu'" />
      <ShopWindow v-if="state.screen === 'shop'" />
      <PasswordWindow v-if="state.screen === 'password'" />
      <EndingScreen v-if="state.screen === 'ending'" />
      <GameOverScreen v-if="state.screen === 'gameover'" />
      <SleepOverlay v-if="state.sleep" />
    </main>
    <TouchControls v-if="showTouch" :placement="touchPlacement" />
  </div>
</template>
