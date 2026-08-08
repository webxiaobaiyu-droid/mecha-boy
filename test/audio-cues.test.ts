import { describe, expect, it } from 'vitest'
import { explorationTrackFor, townTrackFor, worldTrackForPosition } from '@/game/audio/cues'

describe('场景音乐映射', () => {
  it('麦镇使用独立聚落主题，拉多保留通用城镇主题', () => {
    expect(townTrackFor('masaru')).toBe('harvest')
    expect(townTrackFor('rado')).toBe('town')
  })

  it('沙漠地表与普通荒野使用不同旅行主题', () => {
    expect(worldTrackForPosition(3, 3)).toBe('desert')
    expect(worldTrackForPosition(25, 43)).toBe('field')
  })

  it('麦镇房间、洞窟和世界地图都能恢复正确曲目', () => {
    expect(explorationTrackFor({ screen: 'town', map: 'masaru', px: 1, py: 1 })).toBe('harvest')
    expect(explorationTrackFor({ screen: 'room', map: 'rado_home', px: 1, py: 1 })).toBe('town')
    expect(explorationTrackFor({ screen: 'cave', map: 'cave1', px: 1, py: 1 })).toBe('cave')
    expect(explorationTrackFor({ screen: 'world', map: 'world', px: 3, py: 3 })).toBe('desert')
  })
})
