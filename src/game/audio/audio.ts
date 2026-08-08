/* 芯片音乐引擎：Web Audio 实时合成（方波×2 + 三角波 + 噪声） */

import type { WeatherKind } from '@/game/types'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null
let ambienceBus: GainNode | null = null
let limiter: DynamicsCompressorNode | null = null
let noiseBuf: AudioBuffer | null = null
let current: { name: string; timer: number; gain: GainNode } | null = null
let currentAmbience: {
  kind: 'rain' | 'storm' | 'wind'
  source: AudioBufferSourceNode
  gain: GainNode
  level: number
} | null = null
let muted = false
let musicVolume = 1
let sfxVolume = 1

const OUTPUT_MIX = Object.freeze({
  masterGain: 0.5,
  musicGain: 1,
  sfxGain: 0.78,
  ambienceGain: 0.42,
  transitionSeconds: 0.16,
  limiter: Object.freeze({
    threshold: -12,
    knee: 6,
    ratio: 12,
    attack: 0.003,
    release: 0.18
  })
})

const NOTE_FREQ: Record<string, number> = {}
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
for (let oct = 1; oct <= 7; oct++) {
  for (let i = 0; i < 12; i++) {
    const midi = (oct + 1) * 12 + i
    NOTE_FREQ[NAMES[i] + oct] = 440 * Math.pow(2, (midi - 69) / 12)
  }
}

function ensure(): boolean {
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return false
    ctx = new AC()
    master = ctx.createGain()
    musicBus = ctx.createGain()
    sfxBus = ctx.createGain()
    limiter = ctx.createDynamicsCompressor()
    master.gain.value = muted ? 0 : OUTPUT_MIX.masterGain
    musicBus.gain.value = OUTPUT_MIX.musicGain * musicVolume
    sfxBus.gain.value = OUTPUT_MIX.sfxGain * sfxVolume
    limiter.threshold.value = OUTPUT_MIX.limiter.threshold
    limiter.knee.value = OUTPUT_MIX.limiter.knee
    limiter.ratio.value = OUTPUT_MIX.limiter.ratio
    limiter.attack.value = OUTPUT_MIX.limiter.attack
    limiter.release.value = OUTPUT_MIX.limiter.release
    musicBus.connect(master)
    sfxBus.connect(master)
    master.connect(limiter)
    limiter.connect(ctx.destination)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return true
}

/**
 * Must be called directly from a user gesture on browsers that gate Web Audio.
 * Creating the graph and unlocking playback are deliberately separate actions.
 */
export async function unlock(): Promise<boolean> {
  if (!ensure() || !ctx) return false
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      return false
    }
  }
  return ctx.state === 'running'
}

function osc(
  type: OscillatorType,
  freq: number,
  dur: number,
  vol: number,
  when: number,
  dest: AudioNode,
  slide?: number
) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = freq
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), when + dur)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(vol, when + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  o.connect(g)
  g.connect(dest)
  o.start(when)
  o.stop(when + dur + 0.02)
}

function noise(dur: number, vol: number, when: number, dest: AudioNode, freq: number) {
  if (!ctx || !noiseBuf) return
  const s = ctx.createBufferSource()
  s.buffer = noiseBuf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, when)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  s.connect(f)
  f.connect(g)
  g.connect(dest)
  s.start(when)
  s.stop(when + dur + 0.02)
}

/* ---------------- 曲目 ---------------- */
export type ChannelName = 'sq1' | 'sq2' | 'tri' | 'noi'

export type MusicScene =
  'title' | 'settlement' | 'travel' | 'dungeon' | 'combat' | 'service' | 'climax' | 'ending'

export interface TrackProfile {
  scene: MusicScene
  energy: 1 | 2 | 3 | 4 | 5
  tonalCenter: string
  mood: string
}

interface TrackDef {
  bpm: number
  introSteps: number
  loopSteps: number
  mix: TrackMix
  sq1: string
  sq2: string
  tri: string
  noi: string
}

export interface TrackMix {
  sq1: number
  sq2: number
  tri: number
  noi: number
  gate: number
  introGain: number
  loopGain: number
}

interface CompiledTrack {
  bpm: number
  introSteps: number
  loopSteps: number
  totalSteps: number
  profile: Readonly<TrackProfile>
  mix: Readonly<TrackMix>
  channels: Record<ChannelName, readonly string[]>
  sourceSteps: Record<ChannelName, number>
  noteSteps: Record<ChannelName, number>
  accentSteps: Record<ChannelName, number>
}

const CHANNEL_NAMES: readonly ChannelName[] = ['sq1', 'sq2', 'tri', 'noi']
const NOTE_TOKEN = /^([A-G][#]?)([1-7])([!~]{0,2})$/
const DRUM_TOKENS = new Set(['.', '-', 'K', 'S', 'H'])

const TRACK_PROFILES: Record<string, TrackProfile> = {
  title: { scene: 'title', energy: 2, tonalCenter: 'D minor', mood: '苍凉、辽阔' },
  town: { scene: 'settlement', energy: 2, tonalCenter: 'C major', mood: '温暖、安心' },
  harvest: { scene: 'settlement', energy: 3, tonalCenter: 'D major', mood: '丰收、机械律动' },
  field: { scene: 'travel', energy: 4, tonalCenter: 'A minor', mood: '流浪、前进' },
  desert: { scene: 'travel', energy: 3, tonalCenter: 'E Phrygian dominant', mood: '热风、孤寂' },
  cave: { scene: 'dungeon', energy: 1, tonalCenter: 'E chromatic minor', mood: '空灵、压抑' },
  battle: { scene: 'combat', energy: 4, tonalCenter: 'E minor', mood: '紧张、短促' },
  boss: { scene: 'combat', energy: 5, tonalCenter: 'D minor', mood: '压迫、激昂' },
  shop: { scene: 'service', energy: 3, tonalCenter: 'D major', mood: '轻快、俏皮' },
  inn: { scene: 'service', energy: 1, tonalCenter: 'C major', mood: '舒缓、治愈' },
  last: { scene: 'climax', energy: 5, tonalCenter: 'E minor', mood: '沉重、史诗' },
  ending: { scene: 'ending', energy: 1, tonalCenter: 'A minor', mood: '释然、伤感' }
}

function score(...bars: string[]): string {
  for (let i = 0; i < bars.length; i++) {
    const steps = bars[i].trim().split(/\s+/).filter(Boolean)
    if (steps.length !== 16) {
      throw new Error(`Score bar ${i + 1} has ${steps.length} steps instead of 16`)
    }
  }
  return bars.join(' ')
}

const TR: Record<string, TrackDef> = {
  title: {
    bpm: 88,
    introSteps: 16,
    loopSteps: 64,
    mix: {
      sq1: 0.086,
      sq2: 0.048,
      tri: 0.13,
      noi: 0.045,
      gate: 0.82,
      introGain: 0.72,
      loopGain: 1
    },
    sq1: score(
      '. . . .  A3~ . . .  D4~ . . .  F4~ . E4 .',
      'D4~ . . F4  A4~ . G4 F4  E4~ . . D4  C4~ . A3 .',
      'F4~ . . A4  C5~ . A4 G4  F4~ . E4 F4  D4~ . . .',
      'A4~ . G4 F4  E4~ . D4 E4  F4~ . A4 C5  D5~ . C5 A4',
      'G4~ . F4 E4  D4~ . C4 D4  A3~ . . .  D4~ . . .'
    ),
    sq2: score(
      '. . . .  D3~ . . .  A2~ . . .  C3~ . A2 .',
      'D3 . A3 .  F3 . A3 .  C3 . G3 .  A2 . E3 .',
      'F3 . C4 .  A3 . C4 .  D3 . A3 .  C3 . A3 .',
      'A3 . E4 .  G3 . E4 .  F3 . C4 .  A3 . F3 .',
      'G3 . D4 .  E3 . C4 .  D3 . A3 .  D3 . A2 .'
    ),
    tri: score(
      'D2 . . .  A1 . . .  C2 . . .  A1 . . .',
      'D2 . D2 .  F2 . F2 .  C2 . C2 .  A1 . A1 .',
      'F2 . F2 .  D2 . D2 .  C2 . C2 .  A1 . A1 .',
      'A1 . A1 .  C2 . C2 .  F2 . F2 .  D2 . D2 .',
      'G1 . G1 .  C2 . A1 .  D2 . D2 .  A1 . D2 .'
    ),
    noi: score(
      '. . . .  . . . H  . . . .  S . . .',
      'K . . H  . . S .  K . . H  . . S .',
      'K . H .  . . S .  K . H .  . . S .',
      'K . . H  K . S .  K . . H  . . S .',
      'K . H .  . . S .  K . . .  S . . .'
    )
  },
  town: {
    bpm: 104,
    introSteps: 16,
    loopSteps: 64,
    mix: {
      sq1: 0.074,
      sq2: 0.044,
      tri: 0.105,
      noi: 0.038,
      gate: 0.7,
      introGain: 0.76,
      loopGain: 0.9
    },
    sq1: score(
      '. . G4 .  C5~ . . .  E5 . D5 .  C5~ . . .',
      'E5 . D5 C5  G4 . A4 C5  E5 . G5 E5  D5~ . . .',
      'C5 . E5 G5  A5 . G5 E5  D5 . E5 D5  C5~ . . .',
      'G4 . A4 C5  D5 . E5 G5  E5 . D5 C5  A4 . G4 .',
      'A4 . C5 E5  D5 . C5 A4  G4 . E4 G4  C5~ . . .'
    ),
    sq2: score(
      '. . C4 .  G3 . C4 .  E4 . G4 .  F4 . D4 .',
      'C4 . G4 .  E4 . G4 .  A3 . E4 .  F4 . C4 .',
      'F4 . C5 .  A4 . C5 .  G4 . D5 .  B4 . G4 .',
      'E4 . B4 .  G4 . B4 .  F4 . C5 .  A4 . F4 .',
      'D4 . A4 .  F4 . A4 .  G3 . D4 .  G4 . C4 .'
    ),
    tri: score(
      'C3 . . .  G2 . . .  A2 . . .  G2 . . .',
      'C3 . . .  A2 . . .  F2 . . .  G2 . . .',
      'F2 . . .  A2 . . .  G2 . . .  C3 . . .',
      'E2 . . .  G2 . . .  F2 . . .  G2 . . .',
      'D2 . . .  F2 . . .  G2 . . .  C3 . . .'
    ),
    noi: score(
      '. . . H  . . . .  . . . H  . . S .',
      'K . . H  . . S .  K . . H  . . S .',
      'K . . H  . . S .  K . H .  . . S .',
      'K . . H  . . S .  K . . H  . . S .',
      'K . H .  . . S .  K . . H  . . S .'
    )
  },
  harvest: {
    bpm: 112,
    introSteps: 16,
    loopSteps: 64,
    mix: {
      sq1: 0.08,
      sq2: 0.046,
      tri: 0.12,
      noi: 0.05,
      gate: 0.74,
      introGain: 0.72,
      loopGain: 0.94
    },
    sq1: score(
      '. . D4 F#4  A4~ . F#4 D4  B3 . D4 E4  F#4~ . . .',
      'D4 . F#4 A4  B4 . A4 F#4  E4 . D4 E4  F#4~ . . .',
      'G4 . B4 D5  E5 . D5 B4  A4 . F#4 A4  D5~ . . .',
      'B4 A4 F#4 D4  E4 F#4 G4 A4  B4 . A4 G4  F#4~ . E4 .',
      'D4 F#4 A4 D5  C#5 B4 A4 F#4  G4 E4 F#4 A4  D5~ . . .'
    ),
    sq2: score(
      'D3 . A3 .  F#3 . A3 .  B2 . F#3 .  A3 . F#3 .',
      'D3 . A3 F#3  . A3 D4 .  B2 . F#3 D3  . A2 E3 .',
      'G3 . D4 B3  . D4 G4 .  D3 . A3 F#3  . A3 D4 .',
      'B2 F#3 B3 F#3  E3 B3 E4 B3  G3 D4 G4 D4  A3 E4 A4 E4',
      'D3 A3 D4 A3  A2 E3 A3 E3  G2 D3 G3 D3  D3 A3 D4 .'
    ),
    tri: score(
      'D2 . . A2  . . D3 .  B1 . . F#2  . . A2 .',
      'D2 . A2 .  D3 . A2 .  B1 . F#2 .  A2 . F#2 .',
      'G2 . D3 .  B2 . G2 .  D2 . A2 .  D3 . A2 .',
      'B1 . F#2 .  E2 . B2 .  G2 . D3 .  A2 . E3 .',
      'D2 . A2 .  C#2 . A2 .  G1 . D2 .  A1 . D2 .'
    ),
    noi: score(
      'K . . H  . . S .  K . . H  . . S .',
      'K . H .  S . H .  K . H H  S . H .',
      'K . H H  S . H .  K H . H  S . H H',
      'K . . H  S . H .  K . H .  S H . H',
      'K . H .  S . H H  K . H .  S . S .'
    )
  },
  field: {
    bpm: 136,
    introSteps: 16,
    loopSteps: 64,
    mix: {
      sq1: 0.09,
      sq2: 0.052,
      tri: 0.145,
      noi: 0.078,
      gate: 0.82,
      introGain: 0.82,
      loopGain: 1
    },
    sq1: score(
      'A3 A3 C4 E4  A4! . G4 E4  D4 D4 F4 A4  C5! . B4 G4',
      'A4 A4 C5 A4  E5! E5 D5 C5  B4 G4 A4 B4  C5! B4 A4 G4',
      'F4 F4 A4 C5  F5! E5 C5 A4  G4 G4 B4 D5  G5! F5 D5 B4',
      'E4 G4 B4 E5  D5 C5 B4 G4  A4 C5 E5 A5  G5 E5 D5 C5',
      'B4 G4 E4 G4  A4 B4 C5 D5  E5! D5 C5 B4  A4~ . . .'
    ),
    sq2: score(
      'A3 . C4 .  E4 . A4 .  F4 . D4 .  E4 . G4 .',
      'A3 E4 A4 E4  A3 E4 A4 E4  G3 D4 G4 D4  G3 D4 G4 D4',
      'F3 C4 F4 C4  F3 C4 F4 C4  G3 D4 G4 D4  G3 D4 G4 D4',
      'E3 B3 E4 B3  G3 D4 G4 D4  A3 E4 A4 E4  C4 G4 C5 G4',
      'B3 F#4 B4 F#4  E3 B3 E4 B3  A3 E4 A4 E4  E3 B3 E4 B3'
    ),
    tri: score(
      'A2 A2 A2 A2  F2 F2 F2 F2  G2 G2 G2 G2  E2 E2 E2 E2',
      'A2 A2 E2 E2  A2 A2 E2 E2  G2 G2 D2 D2  G2 G2 D2 D2',
      'F2 F2 C2 C2  F2 F2 C2 C2  G2 G2 D2 D2  G2 G2 D2 D2',
      'E2 E2 B1 B1  G2 G2 D2 D2  A2 A2 E2 E2  C3 C3 G2 G2',
      'B2 B2 F#2 F#2  E2 E2 B1 B1  A2 A2 E2 E2  E2 E2 E2 E2'
    ),
    noi: score(
      'K H . H  K H S H  K H . H  K H S H',
      'K H S H  K H S H  K H S H  K H S H',
      'K H S H  K H S H  K H S H  K H S H',
      'K H S H  K H S H  K H S H  K H S H',
      'K H S H  K H S H  K H S H  K H S S'
    )
  },
  desert: {
    bpm: 118,
    introSteps: 32,
    loopSteps: 64,
    mix: {
      sq1: 0.082,
      sq2: 0.042,
      tri: 0.14,
      noi: 0.052,
      gate: 0.96,
      introGain: 0.68,
      loopGain: 0.94
    },
    sq1: score(
      '. . . .  E4~ . . .  F4~ . E4 .  B3~ . . .',
      '. . B3 E4  G#4~ . F4 E4  D4 . E4 F4  E4~ . . .',
      'E4 . G#4 B4  C5~ . B4 G#4  F4 . E4 D4  B3~ . . .',
      'F4 . A4 C5  B4 . G#4 F4  E4 E4 G#4 B4  D5~ . . .',
      'C5 B4 G#4 E4  F4 G#4 A4 C5  B4 . G#4 F4  E4~ . D4 .',
      'E4 G#4 B4 E5  D5 C5 B4 G#4  A4 F4 G#4 B4  E5~ . . .'
    ),
    sq2: score(
      'E3 . . .  B2 . . .  F3 . . .  E3 . . .',
      'E3 . B3 .  F3 . C4 .  E3 . B3 .  D3 . A3 .',
      'E3 B3 E4 B3  E3 B3 E4 B3  F3 C4 F4 C4  E3 B3 E4 B3',
      'F3 C4 F4 C4  E3 B3 E4 B3  D3 A3 D4 A3  B2 F#3 B3 F#3',
      'C3 G3 C4 G3  B2 F#3 B3 F#3  A2 E3 A3 E3  B2 F#3 B3 F#3',
      'E3 B3 E4 B3  D3 A3 D4 A3  C3 G3 C4 G3  B2 F#3 B3 .'
    ),
    tri: score(
      'E2 . . .  E2 . . .  F2 . . .  E2 . . .',
      'E2 . B1 .  F2 . C2 .  E2 . B1 .  D2 . A1 .',
      'E2 E2 B1 B1  E2 E2 B1 B1  F2 F2 C2 C2  E2 E2 B1 B1',
      'F2 F2 C2 C2  E2 E2 B1 B1  D2 D2 A1 A1  B1 B1 F#2 F#2',
      'C2 C2 G1 G1  B1 B1 F#2 F#2  A1 A1 E2 E2  B1 B1 F#2 F#2',
      'E2 E2 B1 B1  D2 D2 A1 A1  C2 C2 G1 G1  B1 B1 B1 B1'
    ),
    noi: score(
      'K . . .  . . . H  K . . .  S . . .',
      'K . . H  . . S .  K . H .  . . S .',
      'K . H .  . H S .  K . H .  . . S H',
      'K . . H  K . S .  K . . H  . H S .',
      'K . H .  . . S H  K H . .  S . H .',
      'K . . H  K . S .  K . H H  S . S .'
    )
  },
  cave: {
    bpm: 76,
    introSteps: 16,
    loopSteps: 64,
    mix: {
      sq1: 0.068,
      sq2: 0.038,
      tri: 0.12,
      noi: 0.032,
      gate: 1.18,
      introGain: 0.66,
      loopGain: 0.86
    },
    sq1: score(
      '. . E4~ .  . . F4 .  D#4~ . . .  B3~ . . .',
      'E4~ . . .  F4 . E4 .  C4~ . . .  B3~ . . .',
      'D4~ . . E4  F4~ . D#4 .  B3~ . . .  A#3~ . . .',
      'C4~ . D4 .  E4~ . . .  G4 . F#4 .  D#4~ . . .',
      'B3~ . . .  C4 . A#3 .  E4~ . . .  . . . .'
    ),
    sq2: score(
      '. . B3~ .  . . C4 .  A#3~ . . .  F#3~ . . .',
      'B3~ . . .  C4 . B3 .  G3~ . . .  F#3~ . . .',
      'A3~ . . B3  C4~ . A#3 .  F#3~ . . .  E3~ . . .',
      'G3~ . A3 .  B3~ . . .  D4 . C#4 .  A#3~ . . .',
      'F#3~ . . .  G3 . E3 .  B3~ . . .  . . . .'
    ),
    tri: score(
      'E2 . . .  F2 . . .  D#2 . . .  B1 . . .',
      'E2 . . .  C2 . . .  D2 . . .  B1 . . .',
      'D2 . . .  D#2 . . .  B1 . . .  A#1 . . .',
      'C2 . . .  E2 . . .  D#2 . . .  B1 . . .',
      'B1 . . .  A#1 . . .  E2 . . .  E2 . . .'
    ),
    noi: score(
      '. . . .  H . . .  . . . .  H . . .',
      'H . . .  . . . .  H . . .  . . S .',
      '. . . H  . . . .  H . . .  . . . .',
      'H . . .  . . S .  . . . H  . . . .',
      '. . H .  . . . .  H . . .  . . . .'
    )
  },
  battle: {
    bpm: 164,
    introSteps: 16,
    loopSteps: 64,
    mix: {
      sq1: 0.098,
      sq2: 0.062,
      tri: 0.16,
      noi: 0.105,
      gate: 0.88,
      introGain: 0.88,
      loopGain: 1.04
    },
    sq1: score(
      'E4 E4 G4 A4  B4! . B4 D5  E5! . D5 B4  A4 G4 F#4 E4',
      'E5 E5 G5 B5  A5 G5 E5 D5  C5 E5 G5 A5  B5! A5 G5 E5',
      'D5 F#5 A5 D6  C6 A5 F#5 E5  D5 E5 F#5 A5  B5! A5 F#5 D5',
      'C5 E5 G5 C6  B5 G5 E5 D5  C5 D5 E5 G5  A5! G5 E5 C5',
      'B4 D5 F#5 B5  A5 F#5 E5 D5  E5 G5 B5 E6  D6 B5 G5 E5'
    ),
    sq2: score(
      'E3 B3 E4 B3  G3 D4 G4 D4  A3 E4 A4 E4  B3 F#4 B4 F#4',
      'E4 B4 E5 B4  C4 G4 C5 G4  A3 E4 A4 E4  B3 F#4 B4 F#4',
      'D4 A4 D5 A4  C4 G4 C5 G4  D4 A4 D5 A4  B3 F#4 B4 F#4',
      'C4 G4 C5 G4  B3 F#4 B4 F#4  C4 G4 C5 G4  A3 E4 A4 E4',
      'B3 F#4 B4 F#4  A3 E4 A4 E4  E4 B4 E5 B4  D4 A4 D5 A4'
    ),
    tri: score(
      'E2 E2 E2 E2  G2 G2 G2 G2  A2 A2 A2 A2  B2 B2 B2 B2',
      'E2 E2 B1 B1  C2 C2 G1 G1  A1 A1 E2 E2  B1 B1 F#2 F#2',
      'D2 D2 A1 A1  C2 C2 G1 G1  D2 D2 A1 A1  B1 B1 F#2 F#2',
      'C2 C2 G1 G1  B1 B1 F#2 F#2  C2 C2 G1 G1  A1 A1 E2 E2',
      'B1 B1 F#2 F#2  A1 A1 E2 E2  E2 E2 B1 B1  D2 D2 A1 A1'
    ),
    noi: score(
      'K H K H  K H S H  K H K H  K S S S',
      'K H S H  K H S H  K H S H  K H S H',
      'K H S H  K H S H  K H S H  K S S H',
      'K H S H  K K S H  K H S H  K H S S',
      'K H S H  K H S H  K K S H  K S S S'
    )
  },
  boss: {
    bpm: 150,
    introSteps: 32,
    loopSteps: 64,
    mix: {
      sq1: 0.104,
      sq2: 0.068,
      tri: 0.17,
      noi: 0.118,
      gate: 0.92,
      introGain: 0.84,
      loopGain: 1.06
    },
    sq1: score(
      'D4! . D4 .  F4 . E4 .  D4! . A3 .  C4 . D4 .',
      'F4 F4 A4 C5  D5! . C5 A4  G4! . F4 E4  D4~ . . .',
      'D5! D5 F5 D5  A4 D5 F5 A5  G5! F5 D5 C5  D5 F5 A5 G5',
      'C5! C5 E5 G5  A#5 A5 G5 E5  F5! E5 C5 A4  C5 E5 G5 F5',
      'A4! C5 D5 F5  E5 D5 C5 A4  A#4! D5 F5 A5  G5 F5 D5 C5',
      'B4! D5 F5 B5  A5 F5 E5 D5  D5! A4 C5 D5  F5~ . . .'
    ),
    sq2: score(
      'D3 A3 D4 A3  F3 C4 F4 C4  D3 A3 D4 A3  C3 G3 C4 G3',
      'F3 C4 F4 C4  A3 E4 A4 E4  G3 D4 G4 D4  D3 A3 D4 A3',
      'D4 A4 D5 A4  F4 C5 F5 C5  G4 D5 G5 D5  A3 E4 A4 E4',
      'C4 G4 C5 G4  A#3 F4 A#4 F4  F4 C5 F5 C5  A3 E4 A4 E4',
      'A3 E4 A4 E4  C4 G4 C5 G4  A#3 F4 A#4 F4  G3 D4 G4 D4',
      'B3 F#4 B4 F#4  D4 A4 D5 A4  C4 G4 C5 G4  D4 A4 D5 A4'
    ),
    tri: score(
      'D2 D2 D2 D2  F2 F2 F2 F2  D2 D2 D2 D2  C2 C2 C2 C2',
      'F2 F2 F2 F2  A2 A2 A2 A2  G2 G2 G2 G2  D2 D2 D2 D2',
      'D2 D2 A1 A1  F2 F2 C2 C2  G2 G2 D2 D2  A1 A1 E2 E2',
      'C2 C2 G1 G1  A#1 A#1 F2 F2  F2 F2 C2 C2  A1 A1 E2 E2',
      'A1 A1 E2 E2  C2 C2 G1 G1  A#1 A#1 F2 F2  G1 G1 D2 D2',
      'B1 B1 F#2 F#2  D2 D2 A1 A1  C2 C2 G1 G1  D2 D2 D2 D2'
    ),
    noi: score(
      'K . . H  K . S .  K . . H  K . S .',
      'K H K H  K H S H  K H K H  K S S S',
      'K H S H  K K S H  K H S H  K K S S',
      'K H S H  K H S S  K K S H  K H S S',
      'K K S H  K H S H  K K S H  K S S S',
      'K H S H  K K S H  K H S H  K S S S'
    )
  },
  shop: {
    bpm: 122,
    introSteps: 16,
    loopSteps: 64,
    mix: {
      sq1: 0.075,
      sq2: 0.048,
      tri: 0.11,
      noi: 0.052,
      gate: 0.66,
      introGain: 0.8,
      loopGain: 0.92
    },
    sq1: score(
      'D4 F#4 A4 D5  C#5 A4 F#4 E4  G4 B4 D5 G5  F#5 E5 D5 A4',
      'D5 F#5 A5 F#5  E5 G5 B5 G5  F#5 A5 D6 A5  G5 F#5 E5 D5',
      'B4 D5 G5 D5  C#5 E5 A5 E5  D5 F#5 A5 F#5  E5 D5 C#5 A4',
      'G4 B4 D5 G5  F#5 D5 B4 A4  E5 G5 B5 E6  D6 B5 G5 E5',
      'F#5 A5 D6 A5  G5 E5 C#5 A4  D5 E5 F#5 A5  D6~ . . .'
    ),
    sq2: score(
      'D3 A3 D4 A3  A3 E4 A4 E4  G3 D4 G4 D4  A3 E4 A4 E4',
      'D4 A4 D5 A4  E4 B4 E5 B4  F#4 C#5 F#5 C#5  G4 D5 G5 D5',
      'G3 D4 G4 D4  A3 E4 A4 E4  D4 A4 D5 A4  A3 E4 A4 E4',
      'G3 D4 G4 D4  F#3 C#4 F#4 C#4  E4 B4 E5 B4  G4 D5 G5 D5',
      'F#4 C#5 F#5 C#5  A3 E4 A4 E4  D4 A4 D5 A4  A3 E4 A4 E4'
    ),
    tri: score(
      'D2 . A2 .  A1 . E2 .  G2 . D2 .  A1 . E2 .',
      'D2 . A1 .  E2 . B1 .  F#2 . C#2 .  G2 . D2 .',
      'G2 . D2 .  A1 . E2 .  D2 . A1 .  A1 . E2 .',
      'G2 . D2 .  F#2 . C#2 .  E2 . B1 .  G2 . D2 .',
      'F#2 . C#2 .  A1 . E2 .  D2 . A1 .  D2 . A1 .'
    ),
    noi: score(
      'K . H .  S . H .  K . H .  S . H .',
      'K . H .  S . H .  K . H .  S . H .',
      'K . H .  S . H .  K . H .  S . H .',
      'K . H .  S . H .  K . H .  S . H .',
      'K . H .  S . H .  K . H .  S . S .'
    )
  },
  inn: {
    bpm: 68,
    introSteps: 16,
    loopSteps: 64,
    mix: {
      sq1: 0.062,
      sq2: 0.038,
      tri: 0.09,
      noi: 0.018,
      gate: 1.3,
      introGain: 0.68,
      loopGain: 0.78
    },
    sq1: score(
      '. . C4~ .  E4~ . G4 .  C5~ . . .  B4 . G4 .',
      'E4~ . G4 .  C5~ . B4 .  A4~ . G4 .  E4~ . . .',
      'F4~ . A4 .  D5~ . C5 .  B4~ . A4 .  G4~ . . .',
      'E4~ . G4 .  B4~ . D5 .  C5~ . A4 .  G4~ . E4 .',
      'D4~ . F4 .  A4~ . G4 .  E4~ . D4 .  C4~ . . .'
    ),
    sq2: score(
      '. . G3~ .  C4~ . E4 .  G4~ . . .  F4 . E4 .',
      'C4~ . E4 .  G4~ . F4 .  F4~ . E4 .  C4~ . . .',
      'D4~ . F4 .  A4~ . G4 .  G4~ . F4 .  D4~ . . .',
      'C4~ . E4 .  G4~ . B4 .  A4~ . F4 .  E4~ . C4 .',
      'B3~ . D4 .  F4~ . E4 .  C4~ . B3 .  C4~ . . .'
    ),
    tri: score(
      'C2 . . .  G2 . . .  C3 . . .  G2 . . .',
      'C2 . . .  G2 . . .  F2 . . .  C2 . . .',
      'D2 . . .  A2 . . .  G2 . . .  D2 . . .',
      'E2 . . .  B2 . . .  A2 . . .  E2 . . .',
      'F2 . . .  G2 . . .  C2 . . .  C2 . . .'
    ),
    noi: score(
      '. . . .  . . . H  . . . .  . . . .',
      '. . . H  . . . .  . . . H  . . . .',
      '. . . .  . . . H  . . . .  . . . H',
      '. . . H  . . . .  . . . H  . . . .',
      '. . . .  . . . H  . . . .  . . . .'
    )
  },
  last: {
    bpm: 172,
    introSteps: 32,
    loopSteps: 96,
    mix: {
      sq1: 0.108,
      sq2: 0.074,
      tri: 0.18,
      noi: 0.13,
      gate: 0.9,
      introGain: 0.78,
      loopGain: 1.08
    },
    sq1: score(
      '. . E3 .  E4! . . .  B3 . D4 .  E4! . G4 .',
      'A4 . G4 E4  D4 . B3 D4  E4! . G4 B4  E5! . . .',
      'E5 E5 G5 B5  C6! B5 G5 E5  D5 F#5 A5 C6  B5 A5 F#5 D5',
      'C5 E5 G5 C6  E6! D6 C6 G5  A5 C6 E6 A6  G6 E6 D6 C6',
      'B5 D6 F#6 B6  A6 F#6 E6 D6  C6 E6 G6 C7  B6 G6 E6 C6',
      'D6! C6 A5 F#5  G5 A5 B5 D6  E6! D6 B5 G5  A5 G5 F#5 E5',
      'C6! B5 G5 E5  D5 E5 F#5 A5  B5! A5 F#5 D5  E5 G5 B5 E6',
      'D6 C6 B5 G5  A5 B5 C6 D6  E6! D6 C6 B5  E5~ . . .'
    ),
    sq2: score(
      'E3 B3 E4 B3  E3 B3 E4 B3  D3 A3 D4 A3  E3 B3 E4 B3',
      'A3 E4 A4 E4  G3 D4 G4 D4  E3 B3 E4 B3  B3 F#4 B4 F#4',
      'E4 B4 E5 B4  C4 G4 C5 G4  D4 A4 D5 A4  B3 F#4 B4 F#4',
      'C4 G4 C5 G4  E4 B4 E5 B4  A3 E4 A4 E4  C4 G4 C5 G4',
      'B3 F#4 B4 F#4  A3 E4 A4 E4  C4 G4 C5 G4  B3 F#4 B4 F#4',
      'D4 A4 D5 A4  G3 D4 G4 D4  E4 B4 E5 B4  A3 E4 A4 E4',
      'C4 G4 C5 G4  D4 A4 D5 A4  B3 F#4 B4 F#4  E4 B4 E5 B4',
      'D4 A4 D5 A4  C4 G4 C5 G4  B3 F#4 B4 F#4  E4 B4 E5 B4'
    ),
    tri: score(
      'E2 E2 E2 E2  E2 E2 E2 E2  D2 D2 D2 D2  E2 E2 E2 E2',
      'A1 A1 A1 A1  G1 G1 G1 G1  E2 E2 E2 E2  B1 B1 B1 B1',
      'E2 E2 B1 B1  C2 C2 G1 G1  D2 D2 A1 A1  B1 B1 F#2 F#2',
      'C2 C2 G1 G1  E2 E2 B1 B1  A1 A1 E2 E2  C2 C2 G1 G1',
      'B1 B1 F#2 F#2  A1 A1 E2 E2  C2 C2 G1 G1  B1 B1 F#2 F#2',
      'D2 D2 A1 A1  G1 G1 D2 D2  E2 E2 B1 B1  A1 A1 E2 E2',
      'C2 C2 G1 G1  D2 D2 A1 A1  B1 B1 F#2 F#2  E2 E2 B1 B1',
      'D2 D2 A1 A1  C2 C2 G1 G1  B1 B1 F#2 F#2  E2 E2 E2 E2'
    ),
    noi: score(
      'K . . H  K . . H  K . S H  K S S S',
      'K H K H  K H S H  K K S H  K S S S',
      'K H S H  K K S H  K H S H  K S S H',
      'K K S H  K H S S  K K S H  K S S S',
      'K H S H  K K S H  K H S H  K K S S',
      'K K S H  K H S H  K K S H  K S S S',
      'K H S H  K K S S  K H S H  K S S S',
      'K K S H  K H S H  K K S H  K S S S'
    )
  },
  ending: {
    bpm: 78,
    introSteps: 16,
    loopSteps: 64,
    mix: {
      sq1: 0.072,
      sq2: 0.042,
      tri: 0.1,
      noi: 0.022,
      gate: 1.12,
      introGain: 0.68,
      loopGain: 0.84
    },
    sq1: score(
      '. . A3~ .  C4~ . E4 .  A4~ . . .  G4 . E4 .',
      'A4~ . C5 .  E5~ . D5 C5  B4~ . A4 .  E4~ . . .',
      'F4~ . A4 .  C5~ . E5 .  D5~ . C5 .  A4~ . . .',
      'G4~ . B4 .  D5~ . C5 B4  A4~ . G4 .  E4~ . . .',
      'C5~ . B4 A4  E5~ . D5 C5  A4~ . E4 .  A4~ . . .'
    ),
    sq2: score(
      '. . E3~ .  A3~ . C4 .  E4~ . . .  D4 . C4 .',
      'E4~ . A4 .  C5~ . B4 A4  G4~ . E4 .  C4~ . . .',
      'C4~ . F4 .  A4~ . C5 .  B4~ . A4 .  F4~ . . .',
      'D4~ . G4 .  B4~ . A4 G4  F4~ . E4 .  C4~ . . .',
      'A4~ . G4 F4  C5~ . B4 A4  E4~ . C4 .  E4~ . . .'
    ),
    tri: score(
      'A2 . . .  E2 . . .  F2 . . .  E2 . . .',
      'A2 . . .  F2 . . .  G2 . . .  E2 . . .',
      'F2 . . .  C3 . . .  G2 . . .  F2 . . .',
      'G2 . . .  D3 . . .  F2 . . .  E2 . . .',
      'A2 . . .  C3 . . .  E2 . . .  A2 . . .'
    ),
    noi: score(
      '. . . .  . . . H  . . . .  . . . .',
      '. . . H  . . . .  . . . H  . . . .',
      '. . . .  . . . H  . . . .  . . . H',
      '. . . H  . . . .  . . . H  . . . .',
      '. . . .  . . . H  . . . .  . . . .'
    )
  }
}

function tokenize(sequence: string): string[] {
  return sequence.trim().split(/\s+/).filter(Boolean)
}

function compileTrack(name: string, track: TrackDef): CompiledTrack {
  const profile = TRACK_PROFILES[name]
  if (!profile) throw new Error(`Track "${name}" has no production profile`)
  if (!Number.isFinite(track.bpm) || track.bpm <= 0) {
    throw new Error(`Track "${name}" has an invalid bpm value`)
  }
  if (!Number.isInteger(track.introSteps) || track.introSteps < 0 || track.introSteps % 16 !== 0) {
    throw new Error(`Track "${name}" has an invalid introSteps value`)
  }
  if (!Number.isInteger(track.loopSteps) || track.loopSteps <= 0 || track.loopSteps % 16 !== 0) {
    throw new Error(`Track "${name}" has an invalid loopSteps value`)
  }
  const totalSteps = track.introSteps + track.loopSteps

  const channels = {} as Record<ChannelName, readonly string[]>
  const sourceSteps = {} as Record<ChannelName, number>
  const noteSteps = {} as Record<ChannelName, number>
  const accentSteps = {} as Record<ChannelName, number>
  for (const channel of CHANNEL_NAMES) {
    const notes = tokenize(track[channel])
    if (notes.length > totalSteps) {
      throw new Error(
        `Track "${name}" channel "${channel}" has ${notes.length} steps, exceeding totalSteps ${totalSteps}`
      )
    }
    for (const token of notes) {
      const valid =
        channel === 'noi'
          ? DRUM_TOKENS.has(token)
          : token === '.' || token === '-' || NOTE_TOKEN.test(token)
      if (!valid)
        throw new Error(`Track "${name}" channel "${channel}" has invalid token "${token}"`)
    }
    sourceSteps[channel] = notes.length
    noteSteps[channel] = notes.filter((token) => token !== '.' && token !== '-').length
    accentSteps[channel] = notes.filter((token) => token.includes('!')).length
    channels[channel] = Object.freeze([
      ...notes,
      ...Array<string>(totalSteps - notes.length).fill('.')
    ])
  }

  return Object.freeze({
    bpm: track.bpm,
    introSteps: track.introSteps,
    loopSteps: track.loopSteps,
    totalSteps,
    profile: Object.freeze({ ...profile }),
    mix: Object.freeze({ ...track.mix }),
    channels: Object.freeze(channels),
    sourceSteps: Object.freeze(sourceSteps),
    noteSteps: Object.freeze(noteSteps),
    accentSteps: Object.freeze(accentSteps)
  })
}

const TRACKS: Readonly<Record<string, CompiledTrack>> = Object.freeze(
  Object.fromEntries(Object.entries(TR).map(([name, track]) => [name, compileTrack(name, track)]))
)

const SCHEDULE_AHEAD_SECONDS = 0.18
const MIN_SCHEDULE_LEAD_SECONDS = 0.01

interface ParsedNote {
  frequency: number
  accent: boolean
  sustain: boolean
}

function parseNote(tok: string): ParsedNote | null {
  if (tok === '-' || tok === '.') return null
  const m = tok.match(NOTE_TOKEN)
  if (!m) return null
  const frequency = NOTE_FREQ[m[1] + m[2]]
  if (!frequency) return null
  return { frequency, accent: m[3].includes('!'), sustain: m[3].includes('~') }
}

function timelinePosition(track: CompiledTrack, absoluteStep: number) {
  if (absoluteStep < track.introSteps) {
    return { section: 'intro' as const, scoreStep: absoluteStep }
  }
  return {
    section: 'loop' as const,
    scoreStep: track.introSteps + ((absoluteStep - track.introSteps) % track.loopSteps)
  }
}

export function playTrack(name: string | null) {
  if (!name) {
    stopTrack()
    return
  }
  if (current?.name === name) return
  const t = TRACKS[name]
  if (!t) return
  if (!ensure()) return
  stopTrack()
  const trackGain = ctx!.createGain()
  trackGain.gain.setValueAtTime(0.0001, ctx!.currentTime)
  trackGain.gain.exponentialRampToValueAtTime(1, ctx!.currentTime + OUTPUT_MIX.transitionSeconds)
  trackGain.connect(musicBus!)
  const stepDur = 60 / t.bpm / 4
  const chans = [
    { notes: t.channels.sq1, type: 'square' as OscillatorType, vol: t.mix.sq1 },
    { notes: t.channels.sq2, type: 'square' as OscillatorType, vol: t.mix.sq2 },
    { notes: t.channels.tri, type: 'triangle' as OscillatorType, vol: t.mix.tri },
    { notes: t.channels.noi, type: 'noise' as OscillatorType, vol: t.mix.noi }
  ]
  const start = ctx!.currentTime + 0.06
  let step = 0
  const timer = window.setInterval(() => {
    if (!ctx || !musicBus) return
    const tNow = ctx.currentTime
    const earliest = tNow + MIN_SCHEDULE_LEAD_SECONDS
    const nextStepAt = start + step * stepDur
    if (nextStepAt < earliest) {
      // Timers are throttled in background tabs. Preserve the track phase while
      // skipping missed steps instead of firing the whole backlog at once.
      step += Math.ceil((earliest - nextStepAt) / stepDur)
    }
    const horizon = tNow + SCHEDULE_AHEAD_SECONDS
    while (start + step * stepDur < horizon) {
      const when = start + step * stepDur
      const position = timelinePosition(t, step)
      const sectionGain = position.section === 'intro' ? t.mix.introGain : t.mix.loopGain
      for (let c = 0; c < 4; c++) {
        const ch = chans[c]
        const tok = ch.notes[position.scoreStep]
        if (c === 3) {
          const drumVol = ch.vol * sectionGain
          if (tok === 'K') {
            osc('sine', 120, 0.14, drumVol * 3, when, trackGain, 40)
            noise(0.05, drumVol * 0.5, when, trackGain, 400)
          } else if (tok === 'S') {
            noise(0.12, drumVol * 1.2, when, trackGain, 1800)
            osc('triangle', 220, 0.06, drumVol * 0.5, when, trackGain)
          } else if (tok === 'H') {
            noise(0.03, drumVol * 0.4, when, trackGain, 6000)
          }
        } else {
          const note = parseNote(tok)
          if (note) {
            const gate = note.sustain ? Math.max(1.65, t.mix.gate) : t.mix.gate
            const accent = note.accent ? 1.25 : 1
            osc(
              ch.type,
              note.frequency,
              stepDur * gate,
              ch.vol * sectionGain * accent,
              when,
              trackGain
            )
          }
        }
      }
      step++
    }
  }, 40)
  current = { name, timer, gain: trackGain }
}

export function stopTrack() {
  if (current) {
    const active = current
    window.clearInterval(active.timer)
    if (ctx) {
      active.gain.gain.setValueAtTime(Math.max(0.0001, active.gain.gain.value), ctx.currentTime)
      active.gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + OUTPUT_MIX.transitionSeconds
      )
      if (typeof window.setTimeout === 'function') {
        window.setTimeout(
          () => active.gain.disconnect(),
          (OUTPUT_MIX.transitionSeconds + 0.08) * 1000
        )
      }
    }
    current = null
  }
}

export function setMuted(m: boolean) {
  muted = m
  if (master) master.gain.value = m ? 0 : OUTPUT_MIX.masterGain
}

export function isMuted() {
  return muted
}

function normalizedVolume(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(0, Math.min(1, Math.round(value * 20) / 20))
}

export function setMusicVolume(value: number) {
  musicVolume = normalizedVolume(value)
  if (musicBus) musicBus.gain.value = OUTPUT_MIX.musicGain * musicVolume
}

export function setSfxVolume(value: number) {
  sfxVolume = normalizedVolume(value)
  if (sfxBus) sfxBus.gain.value = OUTPUT_MIX.sfxGain * sfxVolume
  if (ambienceBus) ambienceBus.gain.value = OUTPUT_MIX.ambienceGain * sfxVolume
}

export function getVolumeSettings() {
  return Object.freeze({ music: musicVolume, sfx: sfxVolume })
}

export interface TrackDebugInfo {
  readonly bpm: number
  readonly introSteps: number
  readonly loopSteps: number
  readonly totalSteps: number
  readonly profile: Readonly<TrackProfile>
  readonly mix: Readonly<TrackMix>
  readonly sourceSteps: Readonly<Record<ChannelName, number>>
  readonly noteSteps: Readonly<Record<ChannelName, number>>
  readonly accentSteps: Readonly<Record<ChannelName, number>>
  readonly silentPaddingSteps: Readonly<Record<ChannelName, number>>
}

export interface AudioDebugInfo {
  readonly currentTrack: string | null
  readonly currentAmbience: string | null
  readonly contextState: AudioContextState | 'uninitialized'
  readonly outputMix: typeof OUTPUT_MIX
  readonly volumes: Readonly<{ music: number; sfx: number }>
  readonly tracks: Readonly<Record<string, TrackDebugInfo>>
}

/** Returns copies of metadata only; Web Audio nodes remain private. */
export function getAudioDebugInfo(): AudioDebugInfo {
  const tracks = Object.fromEntries(
    Object.entries(TRACKS).map(([name, track]) => {
      const sourceSteps = { ...track.sourceSteps }
      const silentPaddingSteps = Object.fromEntries(
        CHANNEL_NAMES.map((channel) => [channel, track.totalSteps - track.sourceSteps[channel]])
      ) as Record<ChannelName, number>
      return [
        name,
        {
          bpm: track.bpm,
          introSteps: track.introSteps,
          loopSteps: track.loopSteps,
          totalSteps: track.totalSteps,
          profile: Object.freeze({ ...track.profile }),
          mix: Object.freeze({ ...track.mix }),
          sourceSteps: Object.freeze(sourceSteps),
          noteSteps: Object.freeze({ ...track.noteSteps }),
          accentSteps: Object.freeze({ ...track.accentSteps }),
          silentPaddingSteps: Object.freeze(silentPaddingSteps)
        }
      ]
    })
  )
  return Object.freeze({
    currentTrack: current?.name ?? null,
    currentAmbience: currentAmbience?.kind ?? null,
    contextState: ctx?.state ?? 'uninitialized',
    outputMix: OUTPUT_MIX,
    volumes: getVolumeSettings(),
    tracks: Object.freeze(tracks)
  })
}

function stopWeatherAmbience() {
  if (!currentAmbience) return
  const active = currentAmbience
  if (ctx) {
    active.gain.gain.setValueAtTime(Math.max(0.0001, active.gain.gain.value), ctx.currentTime)
    active.gain.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + OUTPUT_MIX.transitionSeconds
    )
    active.source.stop(ctx.currentTime + OUTPUT_MIX.transitionSeconds + 0.03)
  } else active.source.stop()
  currentAmbience = null
}

export function setWeatherAmbience(weather: WeatherKind | null, intensity = 0) {
  const kind = weather === 'rain' || weather === 'storm' || weather === 'wind' ? weather : null
  if (!kind || intensity <= 0.02) {
    stopWeatherAmbience()
    return
  }
  const normalizedIntensity = Math.max(0, Math.min(1, intensity))
  const level = (kind === 'storm' ? 0.085 : kind === 'rain' ? 0.058 : 0.04) * normalizedIntensity
  if (currentAmbience?.kind === kind && ctx) {
    if (Math.abs(currentAmbience.level - level) > 0.005) {
      currentAmbience.gain.gain.setValueAtTime(
        Math.max(0.0001, currentAmbience.gain.gain.value),
        ctx.currentTime
      )
      currentAmbience.gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, level),
        ctx.currentTime + OUTPUT_MIX.transitionSeconds
      )
      currentAmbience.level = level
    }
    return
  }
  if (!ensure() || !ctx || !noiseBuf || !master) return
  stopWeatherAmbience()
  if (!ambienceBus) {
    ambienceBus = ctx.createGain()
    ambienceBus.gain.value = OUTPUT_MIX.ambienceGain * sfxVolume
    ambienceBus.connect(master)
  }
  const source = ctx.createBufferSource()
  source.buffer = noiseBuf
  source.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = kind === 'wind' ? 520 : kind === 'storm' ? 1700 : 3400
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, level),
    ctx.currentTime + OUTPUT_MIX.transitionSeconds
  )
  source.connect(filter)
  filter.connect(gain)
  gain.connect(ambienceBus)
  source.start(ctx.currentTime)
  currentAmbience = { kind, source, gain, level }
}

export interface MusicTrackSource {
  readonly bpm: number
  readonly introSteps: number
  readonly loopSteps: number
  readonly totalSteps: number
  readonly profile: Readonly<TrackProfile>
  readonly channels: Readonly<Record<ChannelName, readonly string[]>>
}

/** Serializable score source used by production exporters; contains no Web Audio nodes. */
export function getMusicSourceData(): Readonly<Record<string, MusicTrackSource>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(TRACKS).map(([name, track]) => [
        name,
        Object.freeze({
          bpm: track.bpm,
          introSteps: track.introSteps,
          loopSteps: track.loopSteps,
          totalSteps: track.totalSteps,
          profile: Object.freeze({ ...track.profile }),
          channels: Object.freeze(
            Object.fromEntries(
              CHANNEL_NAMES.map((channel) => [channel, Object.freeze([...track.channels[channel]])])
            ) as Record<ChannelName, readonly string[]>
          )
        })
      ])
    )
  )
}

export function getTrackTimelinePosition(name: string, absoluteStep: number) {
  const track = TRACKS[name]
  if (!track || !Number.isInteger(absoluteStep) || absoluteStep < 0) return null
  return Object.freeze(timelinePosition(track, absoluteStep))
}

export function sfx(kind: string) {
  if (!ensure() || !sfxBus) return
  const output = sfxBus
  const t = ctx!.currentTime
  switch (kind) {
    case 'cursor':
      osc('square', 500, 0.05, 0.08, t, sfxBus)
      break
    case 'confirm':
      osc('square', 660, 0.07, 0.09, t, sfxBus)
      osc('square', 990, 0.09, 0.09, t + 0.05, sfxBus)
      break
    case 'cancel':
      osc('square', 440, 0.07, 0.08, t, sfxBus)
      osc('square', 330, 0.09, 0.08, t + 0.06, sfxBus)
      break
    case 'shot':
      osc('square', 900, 0.1, 0.1, t, sfxBus, 150)
      noise(0.08, 0.08, t, sfxBus, 2500)
      break
    case 'boom':
      osc('sine', 90, 0.35, 0.3, t, sfxBus, 35)
      noise(0.25, 0.12, t, sfxBus, 900)
      break
    case 'hit':
      osc('square', 180, 0.08, 0.1, t, sfxBus, 90)
      noise(0.05, 0.07, t, sfxBus, 1500)
      break
    case 'heal':
      osc('triangle', 523, 0.12, 0.12, t, sfxBus)
      osc('triangle', 659, 0.12, 0.12, t + 0.1, sfxBus)
      osc('triangle', 784, 0.18, 0.12, t + 0.2, sfxBus)
      break
    case 'levelup':
      ;[523, 659, 784, 1047].forEach((f, i) => osc('square', f, 0.1, 0.09, t + i * 0.08, output))
      break
    case 'cash':
      ;[1200, 1500, 1200, 1800].forEach((f, i) =>
        osc('square', f, 0.06, 0.08, t + i * 0.06, output)
      )
      break
    case 'victory':
      ;[660, 880, 990, 1320].forEach((f, i) => osc('square', f, 0.14, 0.1, t + i * 0.12, output))
      break
    case 'gameover':
      ;[392, 330, 262, 196].forEach((f, i) => osc('triangle', f, 0.4, 0.14, t + i * 0.35, output))
      break
    case 'alarm':
      osc('square', 220, 0.12, 0.12, t, sfxBus)
      osc('square', 220, 0.12, 0.12, t + 0.16, sfxBus)
      break
    default:
      break
  }
}
