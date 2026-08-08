/* 键盘 / 触屏输入：按键映射与按键队列 */

import { unlock } from '@/game/audio/audio'

const KEYMAP: Record<string, string> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  KeyZ: 'a',
  KeyJ: 'a',
  Enter: 'a',
  NumpadEnter: 'a',
  Space: 'a',
  KeyX: 'b',
  KeyK: 'b',
  Escape: 'b',
  Backspace: 'b',
  KeyM: 'm',
  KeyR: 'r'
}

const held = new Set<string>()
const gamepadHeld = new Set<string>()
const queue: string[] = []
let initialized = false
let audioUnlocked = false
let audioUnlocking: Promise<boolean> | null = null

const GAMEPAD_DEADZONE = 0.55

function buttonDown(gamepad: Gamepad, index: number): boolean {
  const button = gamepad.buttons[index]
  return !!button && (button.pressed || button.value > 0.5)
}

function readGamepad(): Set<string> {
  const next = new Set<string>()
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return next

  let gamepads: readonly (Gamepad | null)[]
  try {
    gamepads = navigator.getGamepads()
  } catch {
    return next
  }

  for (const gamepad of gamepads) {
    if (!gamepad?.connected) continue
    const horizontal = gamepad.axes[0] || 0
    const vertical = gamepad.axes[1] || 0
    if (horizontal <= -GAMEPAD_DEADZONE || buttonDown(gamepad, 14)) next.add('left')
    if (horizontal >= GAMEPAD_DEADZONE || buttonDown(gamepad, 15)) next.add('right')
    if (vertical <= -GAMEPAD_DEADZONE || buttonDown(gamepad, 12)) next.add('up')
    if (vertical >= GAMEPAD_DEADZONE || buttonDown(gamepad, 13)) next.add('down')
    if (buttonDown(gamepad, 0) || buttonDown(gamepad, 9)) next.add('a')
    if (buttonDown(gamepad, 1) || buttonDown(gamepad, 8)) next.add('b')
  }
  return next
}

function syncGamepad() {
  const next = readGamepad()
  for (const key of next) {
    if (!gamepadHeld.has(key)) queue.push(key)
  }
  gamepadHeld.clear()
  for (const key of next) gamepadHeld.add(key)
}

function unlockAudioFromGesture() {
  if (audioUnlocked || audioUnlocking) return
  const attempt = unlock()
  audioUnlocking = attempt
  void attempt
    .then((success) => {
      audioUnlocked = success
    })
    .catch(() => {
      audioUnlocked = false
    })
    .finally(() => {
      if (audioUnlocking === attempt) audioUnlocking = null
    })
}

export function init() {
  if (initialized) return
  initialized = true
  window.addEventListener('keydown', (e) => {
    // AudioContext.resume() must be invoked from the browser's gesture stack.
    unlockAudioFromGesture()
    const k = KEYMAP[e.code]
    if (!k) return
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
    if (!held.has(k)) {
      held.add(k)
      queue.push(k)
    }
  })
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code]
    if (!k) return
    held.delete(k)
  })
  window.addEventListener(
    'keydown',
    (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code))
        e.preventDefault()
    },
    { passive: false }
  )
  window.addEventListener('pointerdown', unlockAudioFromGesture, { passive: true })
}

export function poll(): string[] {
  syncGamepad()
  const q = queue.slice()
  queue.length = 0
  return q
}

export function isHeld(k: string): boolean {
  syncGamepad()
  return held.has(k) || gamepadHeld.has(k)
}

/* 调试 / 触屏 / 测试入口 */
export function press(k: string) {
  queue.push(k)
}
export function hold(k: string) {
  held.add(k)
}
export function release(k: string) {
  held.delete(k)
}
