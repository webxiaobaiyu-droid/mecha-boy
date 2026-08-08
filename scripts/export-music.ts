import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { getMusicSourceData } from '../src/game/audio/audio'
import { TRACKS } from '../src/game/data/story'
import { buildFamiStudioText, summarizeFamiStudioText } from './lib/famistudio-export'

const FAMISTUDIO_VERSION = '4.5.2'
const output = resolve('music-source/famistudio-4.5/WastelandEngine.txt')
const source = buildFamiStudioText(getMusicSourceData(), TRACKS, {
  version: FAMISTUDIO_VERSION,
  projectName: 'Wasteland Engine OST',
  author: 'Mecha Boy contributors',
  copyright: 'Original score for the Mecha Boy project'
})

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, source, 'utf8')

const summary = summarizeFamiStudioText(source)
console.log(
  `saved ${output} for FamiStudio ${FAMISTUDIO_VERSION}: ${summary.songs} songs, ${summary.patterns} patterns, ${summary.notes} notes`
)
