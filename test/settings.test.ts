import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const storage = new Map<string, string>()

function installStorage() {
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key)
  }
}

describe('player settings', () => {
  beforeEach(() => {
    vi.resetModules()
    storage.clear()
    installStorage()
    setActivePinia(createPinia())
  })

  it('persists independent audio levels and text speed', async () => {
    const { getTextRevealRate, useSettingsStore } = await import('../src/stores/settings')
    const settings = useSettingsStore()

    settings.setMusicVolume(0.63)
    settings.setSfxVolume(0.17)
    settings.cycleTextSpeed()

    expect(settings.musicVolume).toBe(0.65)
    expect(settings.sfxVolume).toBe(0.15)
    expect(settings.optionLabel(2)).toBe('快')
    expect(getTextRevealRate()).toBe(72)

    const saved = JSON.parse(storage.get('mmw_settings_v1')!)
    expect(saved).toEqual({ muted: false, musicVolume: 0.65, sfxVolume: 0.15, textSpeed: 2 })
  })

  it('recovers invalid persisted values to safe defaults', async () => {
    storage.set(
      'mmw_settings_v1',
      JSON.stringify({ muted: 'yes', musicVolume: 99, sfxVolume: -2, textSpeed: 99 })
    )
    const { useSettingsStore } = await import('../src/stores/settings')
    const settings = useSettingsStore()
    const audio = await import('../src/game/audio/audio')

    expect(settings.muted).toBe(false)
    expect(settings.musicVolume).toBe(1)
    expect(settings.sfxVolume).toBe(0)
    expect(settings.textSpeed).toBe(1)
    expect(audio.getVolumeSettings()).toEqual({ music: 1, sfx: 0 })
  })
})
