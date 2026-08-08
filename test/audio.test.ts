import { beforeEach, describe, expect, it, vi } from 'vitest'

const noop = () => {}
let initialState: AudioContextState
let nextTimer: number
let setIntervalSpy: ReturnType<typeof vi.fn>
let clearIntervalSpy: ReturnType<typeof vi.fn>
let resumeSpy: ReturnType<typeof vi.fn>
let eventHandlers: Record<string, ((event: { code: string; preventDefault: () => void }) => void)[]>
let audioTime: number
let intervalCallbacks: (() => void)[]
let oscillatorStartTimes: number[]
let compressorCreateCount: number
let gainInstances: FakeGain[]

interface GainAutomationEvent {
  type: 'set' | 'exponential'
  value: number
  when: number
}

class FakeGain {
  automation: GainAutomationEvent[] = []
  gain = {
    value: 0.5,
    setValueAtTime: (value: number, when: number) => {
      this.gain.value = value
      this.automation.push({ type: 'set', value, when })
    },
    exponentialRampToValueAtTime: (value: number, when: number) => {
      this.gain.value = value
      this.automation.push({ type: 'exponential', value, when })
    }
  }
  connect() {
    return {}
  }
  disconnect() {}
}

class FakeOscillator {
  frequency = { value: 440, exponentialRampToValueAtTime: noop }
  type = ''
  connect() {}
  start(when = 0) {
    oscillatorStartTimes.push(when)
  }
  stop() {}
}

class FakeCompressor {
  threshold = { value: 0 }
  knee = { value: 0 }
  ratio = { value: 0 }
  attack = { value: 0 }
  release = { value: 0 }
  connect() {
    return {}
  }
}

class FakeAudioContext {
  state: AudioContextState
  sampleRate = 44100
  destination = {}

  get currentTime() {
    return audioTime
  }

  constructor() {
    this.state = initialState
  }

  async resume() {
    resumeSpy()
    this.state = 'running'
  }

  createGain() {
    const gain = new FakeGain()
    gainInstances.push(gain)
    return gain
  }
  createDynamicsCompressor() {
    compressorCreateCount++
    return new FakeCompressor()
  }
  createOscillator() {
    return new FakeOscillator()
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    return { buffer: null, connect: noop, start: noop, stop: noop }
  }
  createBiquadFilter() {
    return { type: '', frequency: { value: 0 }, connect: noop }
  }
}

async function loadAudio() {
  return import('../src/game/audio/audio')
}

beforeEach(() => {
  vi.resetModules()
  initialState = 'running'
  nextTimer = 1
  audioTime = 0
  intervalCallbacks = []
  oscillatorStartTimes = []
  compressorCreateCount = 0
  gainInstances = []
  setIntervalSpy = vi.fn((callback: () => void) => {
    intervalCallbacks.push(callback)
    return nextTimer++
  })
  clearIntervalSpy = vi.fn()
  resumeSpy = vi.fn()
  eventHandlers = {}
  ;(globalThis as { window?: unknown }).window = {
    AudioContext: FakeAudioContext,
    webkitAudioContext: undefined,
    setInterval: setIntervalSpy,
    clearInterval: clearIntervalSpy,
    addEventListener: (
      type: string,
      handler: (event: { code: string; preventDefault: () => void }) => void
    ) => {
      ;(eventHandlers[type] ||= []).push(handler)
    }
  }
})

async function fireGesture(type: 'pointerdown' | 'keydown') {
  const event = { code: type === 'keydown' ? 'KeyZ' : '', preventDefault: vi.fn() }
  for (const handler of eventHandlers[type] || []) handler(event)
  await Promise.resolve()
  await Promise.resolve()
}

describe('audio track timeline', () => {
  it('ships twelve complete bar-aligned intro and loop arrangements', async () => {
    const audio = await loadAudio()
    const tracks = audio.getAudioDebugInfo().tracks

    expect(Object.keys(tracks)).toHaveLength(12)
    expect(tracks.title.introSteps).toBe(16)
    expect(tracks.title.loopSteps).toBe(64)
    expect(tracks.harvest.introSteps).toBe(16)
    expect(tracks.harvest.loopSteps).toBe(64)
    expect(tracks.desert.introSteps).toBe(32)
    expect(tracks.desert.loopSteps).toBe(64)
    expect(tracks.boss.introSteps).toBe(32)
    expect(tracks.last.introSteps).toBe(32)
    expect(tracks.last.loopSteps).toBe(96)

    for (const track of Object.values(tracks)) {
      expect(track.introSteps % 16).toBe(0)
      expect(track.loopSteps % 16).toBe(0)
      expect(track.totalSteps).toBe(track.introSteps + track.loopSteps)
      for (const sourceSteps of Object.values(track.sourceSteps)) {
        expect(sourceSteps).toBe(track.totalSteps)
      }
      expect(Object.values(track.silentPaddingSteps).every((steps) => steps === 0)).toBe(true)
    }
  })

  it('publishes production profiles spanning every soundtrack scene role', async () => {
    const audio = await loadAudio()
    const tracks = audio.getAudioDebugInfo().tracks
    const sceneRoles = new Set(Object.values(tracks).map((track) => track.profile.scene))

    expect(sceneRoles).toEqual(
      new Set(['title', 'settlement', 'travel', 'dungeon', 'combat', 'service', 'climax', 'ending'])
    )
    expect(tracks.harvest.profile).toMatchObject({
      scene: 'settlement',
      energy: 3,
      tonalCenter: 'D major'
    })
    expect(tracks.desert.profile).toMatchObject({
      scene: 'travel',
      energy: 3,
      tonalCenter: 'E Phrygian dominant'
    })
    for (const track of Object.values(tracks)) {
      expect(track.profile.mood.length).toBeGreaterThan(0)
      expect(track.profile.energy).toBeGreaterThanOrEqual(1)
      expect(track.profile.energy).toBeLessThanOrEqual(5)
    }
  })

  it('differentiates calm, travel, and escalating combat cues by tempo and dynamics', async () => {
    const audio = await loadAudio()
    const tracks = audio.getAudioDebugInfo().tracks

    expect(tracks.inn.bpm).toBeLessThan(tracks.town.bpm)
    expect(tracks.town.bpm).toBeLessThan(tracks.field.bpm)
    expect(tracks.field.bpm).toBeLessThan(tracks.battle.bpm)
    expect(tracks.boss.bpm).toBeGreaterThan(tracks.field.bpm)
    expect(tracks.last.bpm).toBeGreaterThan(tracks.battle.bpm)
    expect(tracks.inn.mix.gate).toBeGreaterThan(tracks.town.mix.gate)
    expect(tracks.battle.mix.noi).toBeGreaterThan(tracks.field.mix.noi)
    expect(tracks.boss.mix.noi).toBeGreaterThan(tracks.battle.mix.noi)
    expect(tracks.last.mix.tri).toBeGreaterThan(tracks.boss.mix.tri)
  })

  it('routes music and quieter effects through a protective output limiter', async () => {
    const audio = await loadAudio()
    audio.playTrack('battle')
    const output = audio.getAudioDebugInfo().outputMix

    expect(compressorCreateCount).toBe(1)
    expect(output.masterGain).toBeLessThanOrEqual(0.5)
    expect(output.sfxGain).toBeLessThan(output.musicGain)
    expect(output.transitionSeconds).toBe(0.16)
    expect(output.limiter.threshold).toBeLessThan(0)
    expect(output.limiter.ratio).toBeGreaterThanOrEqual(10)
  })

  it('crossfades outgoing and incoming cues over the configured transition', async () => {
    const audio = await loadAudio()

    audio.playTrack('title')
    const outgoing = gainInstances[3]
    expect(outgoing.automation).toEqual([
      { type: 'set', value: 0.0001, when: 0 },
      { type: 'exponential', value: 1, when: 0.16 }
    ])

    audioTime = 0.5
    audio.playTrack('harvest')
    const incoming = gainInstances[4]

    expect(outgoing.automation.slice(-2)).toEqual([
      { type: 'set', value: 1, when: 0.5 },
      { type: 'exponential', value: 0.0001, when: 0.66 }
    ])
    expect(incoming.automation).toEqual([
      { type: 'set', value: 0.0001, when: 0.5 },
      { type: 'exponential', value: 1, when: 0.66 }
    ])
  })

  it('keeps music and effects volume independent and clamped', async () => {
    const audio = await loadAudio()

    audio.setMusicVolume(0.37)
    audio.setSfxVolume(1.4)
    expect(audio.getVolumeSettings()).toEqual({ music: 0.35, sfx: 1 })

    audio.setSfxVolume(-1)
    expect(audio.getAudioDebugInfo().volumes).toEqual({ music: 0.35, sfx: 0 })
  })

  it('室外天气环境声会随天气切换并在进入室内时停止', async () => {
    const audio = await loadAudio()

    audio.setWeatherAmbience('rain', 0.8)
    expect(audio.getAudioDebugInfo().currentAmbience).toBe('rain')
    expect(audio.getAudioDebugInfo().outputMix.ambienceGain).toBeLessThan(
      audio.getAudioDebugInfo().outputMix.sfxGain
    )

    audio.setWeatherAmbience('wind', 0.72)
    expect(audio.getAudioDebugInfo().currentAmbience).toBe('wind')

    audio.setWeatherAmbience(null)
    expect(audio.getAudioDebugInfo().currentAmbience).toBeNull()
  })

  it('plays an intro once and then resolves every later step into the loop', async () => {
    const audio = await loadAudio()

    expect(audio.getTrackTimelinePosition('title', 0)).toEqual({ section: 'intro', scoreStep: 0 })
    expect(audio.getTrackTimelinePosition('title', 15)).toEqual({ section: 'intro', scoreStep: 15 })
    expect(audio.getTrackTimelinePosition('title', 16)).toEqual({ section: 'loop', scoreStep: 16 })
    expect(audio.getTrackTimelinePosition('title', 79)).toEqual({ section: 'loop', scoreStep: 79 })
    expect(audio.getTrackTimelinePosition('title', 80)).toEqual({ section: 'loop', scoreStep: 16 })
    expect(audio.getTrackTimelinePosition('last', 128)).toEqual({ section: 'loop', scoreStep: 32 })
  })

  it('does not restart an already playing cue', async () => {
    const audio = await loadAudio()

    audio.playTrack('title')
    audio.playTrack('title')

    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    expect(clearIntervalSpy).not.toHaveBeenCalled()
    expect(audio.getAudioDebugInfo().currentTrack).toBe('title')

    audio.playTrack('town')
    expect(setIntervalSpy).toHaveBeenCalledTimes(2)
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
  })

  it('skips missed steps after timer throttling without a playback burst or phase drift', async () => {
    const audio = await loadAudio()
    audio.playTrack('town')
    const schedule = intervalCallbacks[0]

    schedule()
    const startsBeforeStall = oscillatorStartTimes.length
    audioTime = 120
    schedule()

    const startsAfterStall = oscillatorStartTimes.slice(startsBeforeStall)
    expect(startsAfterStall.length).toBeGreaterThan(0)
    expect(startsAfterStall.length).toBeLessThanOrEqual(8)
    expect(startsAfterStall.every((when) => when >= audioTime)).toBe(true)

    const stepDuration = 60 / 104 / 4
    for (const when of startsAfterStall) {
      const absoluteStep = (when - 0.06) / stepDuration
      expect(Math.abs(absoluteStep - Math.round(absoluteStep))).toBeLessThan(1e-9)
    }
  })

  it('resumes a suspended context only through explicit unlock', async () => {
    initialState = 'suspended'
    const audio = await loadAudio()

    audio.playTrack('title')
    expect(resumeSpy).not.toHaveBeenCalled()

    await expect(audio.unlock()).resolves.toBe(true)
    expect(resumeSpy).toHaveBeenCalledTimes(1)
    expect(audio.getAudioDebugInfo().contextState).toBe('running')
  })

  it.each(['pointerdown', 'keydown'] as const)(
    'unlocks once from the first real %s gesture',
    async (gestureType) => {
      initialState = 'suspended'
      const input = await import('../src/game/engine/input')
      input.init()

      expect(resumeSpy).not.toHaveBeenCalled()
      await fireGesture(gestureType)
      expect(resumeSpy).toHaveBeenCalledTimes(1)

      await fireGesture(gestureType)
      await fireGesture(gestureType === 'keydown' ? 'pointerdown' : 'keydown')
      expect(resumeSpy).toHaveBeenCalledTimes(1)
    }
  )
})
