/* 应用级设置：音频混音、文本速度与跨会话持久化。 */

import { defineStore } from 'pinia'
import * as audio from '@/game/audio/audio'

const SETTINGS_KEY = 'mmw_settings_v1'
const TEXT_SPEEDS = [24, 40, 72] as const
const DEFAULTS = Object.freeze({
  muted: false,
  musicVolume: 1,
  sfxVolume: 1,
  textSpeed: 1
})

export type SettingsSnapshot = {
  muted: boolean
  musicVolume: number
  sfxVolume: number
  textSpeed: number
}

function clampVolume(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.max(0, Math.min(1, Math.round(n * 20) / 20))
}

function clampTextSpeed(value: unknown) {
  const n = typeof value === 'number' ? Math.round(value) : Number(value)
  return Number.isInteger(n) && n >= 0 && n < TEXT_SPEEDS.length ? n : DEFAULTS.textSpeed
}

function readPersistedSettings(): SettingsSnapshot {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<SettingsSnapshot>
    return {
      muted: parsed.muted === true,
      musicVolume: clampVolume(parsed.musicVolume),
      sfxVolume: clampVolume(parsed.sfxVolume),
      textSpeed: clampTextSpeed(parsed.textSpeed)
    }
  } catch {
    return { ...DEFAULTS }
  }
}

let runtime = readPersistedSettings()

function applyAudio(snapshot: SettingsSnapshot) {
  audio.setMuted(snapshot.muted)
  audio.setMusicVolume(snapshot.musicVolume)
  audio.setSfxVolume(snapshot.sfxVolume)
}

applyAudio(runtime)

function persist(snapshot: SettingsSnapshot) {
  runtime = { ...snapshot }
  applyAudio(snapshot)
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(snapshot))
  } catch {
    // A private browsing context may reject storage; settings still work in memory.
  }
}

export function getTextRevealRate() {
  return TEXT_SPEEDS[runtime.textSpeed] ?? TEXT_SPEEDS[DEFAULTS.textSpeed]
}

export function getSettingsKey() {
  return SETTINGS_KEY
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsSnapshot => ({ ...runtime }),
  actions: {
    sync() {
      const snapshot = readPersistedSettings()
      this.muted = snapshot.muted
      this.musicVolume = snapshot.musicVolume
      this.sfxVolume = snapshot.sfxVolume
      this.textSpeed = snapshot.textSpeed
      persist(snapshot)
    },
    save() {
      persist({
        muted: this.muted,
        musicVolume: this.musicVolume,
        sfxVolume: this.sfxVolume,
        textSpeed: this.textSpeed
      })
    },
    toggleMute() {
      this.muted = !this.muted
      this.save()
    },
    setMusicVolume(value: number) {
      this.musicVolume = clampVolume(value)
      this.save()
    },
    setSfxVolume(value: number) {
      this.sfxVolume = clampVolume(value)
      this.save()
    },
    adjustMusicVolume(delta: number) {
      this.setMusicVolume(this.musicVolume + delta)
    },
    adjustSfxVolume(delta: number) {
      this.setSfxVolume(this.sfxVolume + delta)
    },
    cycleTextSpeed(delta = 1) {
      this.textSpeed = (this.textSpeed + delta + TEXT_SPEEDS.length) % TEXT_SPEEDS.length
      this.save()
    },
    activateOption(index: number) {
      if (index === 0) this.adjustMusicVolume(this.musicVolume >= 1 ? -0.25 : 0.25)
      else if (index === 1) this.adjustSfxVolume(this.sfxVolume >= 1 ? -0.25 : 0.25)
      else if (index === 2) this.cycleTextSpeed()
    },
    optionLabel(index: number) {
      if (index === 0) return `${Math.round(this.musicVolume * 100)}%`
      if (index === 1) return `${Math.round(this.sfxVolume * 100)}%`
      return ['慢', '标准', '快'][this.textSpeed] || '标准'
    }
  }
})
