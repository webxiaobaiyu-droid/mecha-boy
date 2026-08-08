<script setup lang="ts">
import { onUnmounted } from 'vue'
import * as input from '@/game/engine/input'
import type { TouchPlacement } from '@/ui/stageLayout'

defineProps<{ placement: TouchPlacement }>()

const heldDirections = new Set<string>()

function holdDirection(event: PointerEvent, key: string) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()
  const button = event.currentTarget as HTMLButtonElement
  button.setPointerCapture?.(event.pointerId)
  heldDirections.add(key)
  input.hold(key)
}

function releaseDirection(event: PointerEvent, key: string) {
  heldDirections.delete(key)
  input.release(key)
  const button = event.currentTarget as HTMLButtonElement
  if (button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId)
}

function pressAction(event: PointerEvent, key: string) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()
  input.press(key)
}

onUnmounted(() => {
  for (const key of heldDirections) input.release(key)
  heldDirections.clear()
})
</script>

<template>
  <div class="touch-controls" :data-placement="placement" role="group" aria-label="游戏触控">
    <div class="direction-pad">
      <button
        type="button"
        class="touch-button direction-button"
        data-key="up"
        aria-label="向上"
        @pointerdown="holdDirection($event, 'up')"
        @pointerup="releaseDirection($event, 'up')"
        @pointercancel="releaseDirection($event, 'up')"
        @lostpointercapture="releaseDirection($event, 'up')"
      >
        ▲
      </button>
      <button
        type="button"
        class="touch-button direction-button"
        data-key="left"
        aria-label="向左"
        @pointerdown="holdDirection($event, 'left')"
        @pointerup="releaseDirection($event, 'left')"
        @pointercancel="releaseDirection($event, 'left')"
        @lostpointercapture="releaseDirection($event, 'left')"
      >
        ◀
      </button>
      <button
        type="button"
        class="touch-button direction-button"
        data-key="down"
        aria-label="向下"
        @pointerdown="holdDirection($event, 'down')"
        @pointerup="releaseDirection($event, 'down')"
        @pointercancel="releaseDirection($event, 'down')"
        @lostpointercapture="releaseDirection($event, 'down')"
      >
        ▼
      </button>
      <button
        type="button"
        class="touch-button direction-button"
        data-key="right"
        aria-label="向右"
        @pointerdown="holdDirection($event, 'right')"
        @pointerup="releaseDirection($event, 'right')"
        @pointercancel="releaseDirection($event, 'right')"
        @lostpointercapture="releaseDirection($event, 'right')"
      >
        ▶
      </button>
    </div>
    <div class="action-pad">
      <button
        type="button"
        class="touch-button action-button"
        aria-label="取消"
        @pointerdown="pressAction($event, 'b')"
      >
        B
      </button>
      <button
        type="button"
        class="touch-button action-button primary"
        aria-label="确认"
        @pointerdown="pressAction($event, 'a')"
      >
        A
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.touch-controls {
  position: absolute;
  left: 0;
  display: flex;
  width: var(--shell-width);
  height: var(--controls-height);
  justify-content: space-between;
  align-items: center;
  z-index: 40;
  pointer-events: none;
  touch-action: none;
}

.touch-controls[data-placement='below'] {
  top: calc(var(--stage-height) + var(--stage-control-gap));
}

.touch-controls[data-placement='sides'] {
  top: 0;
  height: var(--stage-height);
}

.direction-pad {
  display: grid;
  flex: none;
  grid-template-columns: repeat(3, var(--control-size));
  grid-template-rows: repeat(2, var(--control-size));
  gap: var(--control-gap);
}

.direction-pad .touch-button[data-key='up'] {
  grid-column: 2;
  grid-row: 1;
}

.direction-pad .touch-button[data-key='left'] {
  grid-column: 1;
  grid-row: 2;
}

.direction-pad .touch-button[data-key='down'] {
  grid-column: 2;
  grid-row: 2;
}

.direction-pad .touch-button[data-key='right'] {
  grid-column: 3;
  grid-row: 2;
}

.action-pad {
  display: flex;
  flex: none;
  gap: var(--control-gap);
  align-items: center;
}

.touch-button {
  width: var(--control-size);
  height: var(--control-size);
  padding: 0;
  border: 2px solid #bca266;
  border-radius: 4px;
  background: rgba(24, 25, 32, 0.94);
  box-shadow:
    inset 2px 2px 0 rgba(255, 238, 190, 0.16),
    inset -2px -2px 0 rgba(0, 0, 0, 0.52),
    0 2px 0 rgba(0, 0, 0, 0.55);
  color: #ead99f;
  font-family: inherit;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.action-button {
  border-radius: 50%;
  color: #d8cbb1;
}

.action-button.primary {
  border-color: #d17a52;
  color: #f2cf9f;
}

.touch-button:focus-visible {
  outline: 2px solid #f3df9b;
  outline-offset: 2px;
}

.touch-button:active {
  background: #41434c;
  box-shadow:
    inset 2px 2px 0 rgba(0, 0, 0, 0.45),
    inset -1px -1px 0 rgba(255, 238, 190, 0.12);
  transform: translateY(1px);
}
</style>
