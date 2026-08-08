<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue'
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
import { calculateStageLayout } from '@/ui/stageLayout'

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

const viewport = ref<HTMLDivElement | null>(null)

function hasTouchInput(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const narrowViewport = window.innerWidth <= 768
  const shortLandscape =
    window.innerWidth > window.innerHeight && window.innerWidth <= 1024 && window.innerHeight < 480
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(hover: none), (pointer: coarse)').matches ||
    narrowViewport ||
    shortLandscape
  )
}

const touchCapable = ref(hasTouchInput())
const showTouch = computed(() => touchCapable.value && touchScreens.has(state.screen))
const initialWidth = typeof window === 'undefined' ? 640 : window.innerWidth
const initialHeight = typeof window === 'undefined' ? 480 : window.innerHeight
const stageLayout = ref(
  calculateStageLayout({
    viewportWidth: initialWidth,
    viewportHeight: initialHeight,
    touchControls: showTouch.value
  })
)

const shellStyle = computed<CSSProperties>(() => {
  const layout = stageLayout.value
  return {
    '--stage-scale': String(layout.scale),
    '--stage-width': `${layout.stageWidth}px`,
    '--stage-height': `${layout.stageHeight}px`,
    '--shell-width': `${layout.shellWidth}px`,
    '--shell-height': `${layout.shellHeight}px`,
    '--shell-x': `${layout.shellX}px`,
    '--shell-y': `${layout.shellY}px`,
    '--stage-x': `${layout.stageX}px`,
    '--stage-y': `${layout.stageY}px`,
    '--control-size': `${layout.controlSize}px`,
    '--control-gap': `${layout.controlGap}px`,
    '--controls-height': `${layout.controlsHeight}px`,
    '--stage-control-gap': `${layout.stageControlGap}px`
  }
})

let resizeObserver: ResizeObserver | null = null
let touchQuery: MediaQueryList | null = null
let layoutFrame = 0

function updateStageLayout() {
  const target = viewport.value
  if (!target) return

  const visualViewport = window.visualViewport
  const viewportWidth = Math.min(
    target.clientWidth,
    Math.floor(visualViewport?.width ?? target.clientWidth)
  )
  const viewportHeight = Math.min(
    target.clientHeight,
    Math.floor(visualViewport?.height ?? target.clientHeight)
  )
  stageLayout.value = calculateStageLayout({
    viewportWidth,
    viewportHeight,
    touchControls: showTouch.value
  })
}

function scheduleStageLayout() {
  cancelAnimationFrame(layoutFrame)
  layoutFrame = requestAnimationFrame(updateStageLayout)
}

function updateTouchCapability() {
  touchCapable.value = hasTouchInput()
  scheduleStageLayout()
}

watch(showTouch, scheduleStageLayout, { flush: 'post' })

onMounted(() => {
  touchQuery = window.matchMedia('(hover: none), (pointer: coarse)')
  touchQuery.addEventListener('change', updateTouchCapability)
  window.addEventListener('resize', updateTouchCapability)
  window.addEventListener('orientationchange', updateTouchCapability)
  window.visualViewport?.addEventListener('resize', updateTouchCapability)

  if (typeof ResizeObserver !== 'undefined' && viewport.value) {
    resizeObserver = new ResizeObserver(scheduleStageLayout)
    resizeObserver.observe(viewport.value)
  }

  updateTouchCapability()
  updateStageLayout()
})

onUnmounted(() => {
  cancelAnimationFrame(layoutFrame)
  resizeObserver?.disconnect()
  touchQuery?.removeEventListener('change', updateTouchCapability)
  window.removeEventListener('resize', updateTouchCapability)
  window.removeEventListener('orientationchange', updateTouchCapability)
  window.visualViewport?.removeEventListener('resize', updateTouchCapability)
})
</script>

<template>
  <div ref="viewport" class="game-viewport">
    <main
      class="game-shell"
      :style="shellStyle"
      :data-touch-placement="stageLayout.touchPlacement"
      :data-scale-mode="stageLayout.scaleMode"
      :data-stage-scale="stageLayout.scale"
    >
      <div class="stage-viewport">
        <div class="stage">
          <GameCanvas :presentation-scale="stageLayout.scale" />
          <div class="ui-layer">
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
          </div>
        </div>
      </div>
      <TouchControls v-if="showTouch" :placement="stageLayout.touchPlacement" />
    </main>
  </div>
</template>
