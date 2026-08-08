import { describe, expect, it } from 'vitest'
import { getMusicSourceData } from '@/game/audio/audio'
import { TRACKS } from '@/game/data/story'
import { buildFamiStudioText, summarizeFamiStudioText } from '../scripts/lib/famistudio-export'

describe('FamiStudio production source', () => {
  it('exports every runtime cue with four NES APU channels and preserved loop points', () => {
    const sources = getMusicSourceData()
    const text = buildFamiStudioText(sources, TRACKS, {
      version: '4.5.2',
      projectName: 'Test OST',
      author: 'Test',
      copyright: 'Test'
    })
    const summary = summarizeFamiStudioText(text)

    expect(summary.songs).toBe(Object.keys(sources).length)
    expect(summary.channels).toBe(Object.keys(sources).length * 4)
    expect(summary.patterns).toBe(
      Object.values(sources).reduce((sum, track) => sum + (track.totalSteps / 16) * 4, 0)
    )
    for (const [id, source] of Object.entries(sources)) {
      expect(text).toContain(`Song Name="${TRACKS[id]}"`)
      expect(text).toContain(`LoopPoint="${source.introSteps / 16}"`)
    }
  })

  it('targets an explicit compatible FamiStudio version', () => {
    expect(() =>
      buildFamiStudioText(getMusicSourceData(), TRACKS, {
        version: 'latest',
        projectName: 'Test',
        author: 'Test',
        copyright: 'Test'
      })
    ).toThrow(/major\.minor\.patch/)
  })
})
