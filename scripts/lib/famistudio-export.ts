import type { ChannelName, MusicTrackSource } from '../../src/game/audio/audio'

export interface FamiStudioExportOptions {
  version: string
  projectName: string
  author: string
  copyright: string
}

const CHANNEL_TYPES: Record<ChannelName, string> = {
  sq1: 'Square1',
  sq2: 'Square2',
  tri: 'Triangle',
  noi: 'Noise'
}

const CHANNEL_INSTRUMENTS: Record<Exclude<ChannelName, 'noi'>, string> = {
  sq1: 'Pulse Lead',
  sq2: 'Pulse Harmony',
  tri: 'Triangle Bass'
}

const NOISE_NOTES = {
  K: { value: 'C2', instrument: 'Noise Kick', volume: 15 },
  S: { value: 'F#3', instrument: 'Noise Snare', volume: 13 },
  H: { value: 'C5', instrument: 'Noise Hat', volume: 8 }
} as const

function attr(name: string, value: string | number | boolean) {
  const escaped = String(value).replaceAll('"', '""')
  return ` ${name}="${escaped}"`
}

function instrumentLines() {
  return [
    `\tInstrument${attr('Name', 'Pulse Lead')}`,
    `\t\tEnvelope${attr('Type', 'Volume')}${attr('Length', 8)}${attr('Values', '15,13,11,9,7,5,3,1')}`,
    `\t\tEnvelope${attr('Type', 'DutyCycle')}${attr('Length', 1)}${attr('Values', '2')}`,
    `\tInstrument${attr('Name', 'Pulse Harmony')}`,
    `\t\tEnvelope${attr('Type', 'Volume')}${attr('Length', 7)}${attr('Values', '12,10,8,6,4,2,1')}`,
    `\t\tEnvelope${attr('Type', 'DutyCycle')}${attr('Length', 1)}${attr('Values', '1')}`,
    `\tInstrument${attr('Name', 'Triangle Bass')}`,
    `\t\tEnvelope${attr('Type', 'Volume')}${attr('Length', 2)}${attr('Values', '15,15')}`,
    `\tInstrument${attr('Name', 'Noise Kick')}`,
    `\t\tEnvelope${attr('Type', 'Volume')}${attr('Length', 5)}${attr('Values', '15,12,8,4,1')}`,
    `\tInstrument${attr('Name', 'Noise Snare')}`,
    `\t\tEnvelope${attr('Type', 'Volume')}${attr('Length', 6)}${attr('Values', '15,12,10,7,4,1')}`,
    `\tInstrument${attr('Name', 'Noise Hat')}`,
    `\t\tEnvelope${attr('Type', 'Volume')}${attr('Length', 3)}${attr('Values', '10,5,1')}`
  ]
}

function noteLine(channel: ChannelName, token: string, time: number): string | null {
  if (token === '.' || token === '-') return null
  if (channel === 'noi') {
    const drum = NOISE_NOTES[token as keyof typeof NOISE_NOTES]
    if (!drum) throw new Error(`Unsupported noise token "${token}"`)
    return `\t\t\t\tNote${attr('Time', time)}${attr('Value', drum.value)}${attr('Duration', 1)}${attr('Instrument', drum.instrument)}${attr('Volume', drum.volume)}`
  }

  const sustained = token.includes('~')
  const accented = token.includes('!')
  const value = token.replace(/[!~]/g, '')
  const instrument = CHANNEL_INSTRUMENTS[channel]
  const volume = channel === 'sq1' ? (accented ? 15 : 13) : channel === 'sq2' ? 11 : 15
  return `\t\t\t\tNote${attr('Time', time)}${attr('Value', value)}${attr('Duration', sustained ? 2 : 1)}${attr('Instrument', instrument)}${attr('Volume', volume)}`
}

function channelLines(trackId: string, channel: ChannelName, track: MusicTrackSource) {
  const lines = [`\t\tChannel${attr('Type', CHANNEL_TYPES[channel])}`]
  const barCount = track.totalSteps / 16
  const tokens = track.channels[channel]
  for (let bar = 0; bar < barCount; bar++) {
    const patternName = `${trackId}-${channel}-${bar}`
    lines.push(`\t\t\tPattern${attr('Name', patternName)}`)
    for (let step = 0; step < 16; step++) {
      const note = noteLine(channel, tokens[bar * 16 + step], step)
      if (note) lines.push(note)
    }
  }
  for (let bar = 0; bar < barCount; bar++) {
    lines.push(
      `\t\t\tPatternInstance${attr('Time', bar)}${attr('Pattern', `${trackId}-${channel}-${bar}`)}`
    )
  }
  return lines
}

export function buildFamiStudioText(
  tracks: Readonly<Record<string, MusicTrackSource>>,
  displayNames: Readonly<Record<string, string>>,
  options: FamiStudioExportOptions
) {
  if (!/^\d+\.\d+\.\d+$/.test(options.version)) {
    throw new Error('FamiStudio export version must use major.minor.patch format')
  }
  const lines = [
    `Project${attr('Version', options.version)}${attr('TempoMode', 'FamiTracker')}${attr('Name', options.projectName)}${attr('Author', options.author)}${attr('Copyright', options.copyright)}`,
    ...instrumentLines()
  ]

  for (const [trackId, track] of Object.entries(tracks)) {
    if (track.totalSteps % 16 !== 0 || track.introSteps % 16 !== 0) {
      throw new Error(`Track "${trackId}" is not aligned to 16-step FamiStudio patterns`)
    }
    if (!displayNames[trackId]) throw new Error(`Track "${trackId}" has no display name`)
    const length = track.totalSteps / 16
    const loopPoint = track.introSteps / 16
    lines.push(
      `\tSong${attr('Name', displayNames[trackId])}${attr('Length', length)}${attr('LoopPoint', loopPoint)}${attr('PatternLength', 16)}${attr('BeatLength', 4)}${attr('FamiTrackerTempo', track.bpm)}${attr('FamiTrackerSpeed', 6)}`
    )
    for (const channel of ['sq1', 'sq2', 'tri', 'noi'] as const) {
      lines.push(...channelLines(trackId, channel, track))
    }
  }

  return lines.join('\n') + '\n'
}

export function summarizeFamiStudioText(text: string) {
  const lines = text.split(/\r?\n/)
  return {
    songs: lines.filter((line) => /^\s+Song /.test(line)).length,
    channels: lines.filter((line) => /^\s+Channel /.test(line)).length,
    patterns: lines.filter((line) => /^\s+Pattern /.test(line)).length,
    notes: lines.filter((line) => /^\s+Note /.test(line)).length
  }
}
