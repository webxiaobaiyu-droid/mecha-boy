import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameApi } from '../src/game/core/api'
import { createInitialState } from '../src/game/core/state'
import { EVENTS } from '../src/game/data/events'
import { DIALOGUE } from '../src/game/data/story'
import {
  EventSystem,
  eventConditionMatches,
  validateEventDefinitions
} from '../src/game/systems/events'
import type { EventDefinition } from '../src/game/types'

function makeApi() {
  const api = {
    state: createInitialState(),
    say: vi.fn(),
    sfx: vi.fn()
  } as unknown as GameApi
  return api
}

describe('数据事件运行时', () => {
  let api: GameApi
  let events: EventSystem

  beforeEach(() => {
    api = makeApi()
    events = new EventSystem(api)
  })

  it('事件定义中的引用全部有效', () => {
    expect(validateEventDefinitions(EVENTS, DIALOGUE)).toEqual([])
  })

  it('拉多父亲事件首次触发写入状态，再次触发走重复对白', () => {
    expect(events.run('story_rado_father')).toBe(true)
    expect(api.state.flags.kicked).toBe(true)
    expect(api.state.flags.tutorial_step).toBe(1)
    expect(api.sfx).toHaveBeenCalledWith('confirm')
    expect(api.say).toHaveBeenLastCalledWith(DIALOGUE.story_rado_father, undefined)

    events.run('story_rado_father')
    expect(api.say).toHaveBeenLastCalledWith(
      [
        '老战：发动机和 C 装置要是大破，战车就动不了。',
        '老战：记得去老乔那里做诊断，别只顾着往炮塔上堆东西。'
      ],
      undefined
    )
  })

  it('取车休息后由父亲发放整备金并推进工房教学', () => {
    api.state.flags.kicked = true
    api.state.flags.tutorial_step = 4
    const gold = api.state.gold

    events.run('story_rado_father')

    expect(api.state.flags.tutorial_step).toBe(5)
    expect(api.state.gold).toBe(gold + 1500)
    expect(api.say).toHaveBeenLastCalledWith(DIALOGUE.story_rado_tank_lesson, undefined)
  })

  it('麦镇事件招募机械师，并在已入队时切换对白', () => {
    expect(api.state.party[1].id).toBeNull()
    events.run('story_masaru_mecha')
    expect(api.state.party[1].id).toBe('mecha')
    expect(api.state.flags.tutorial_step).toBe(10)
    expect(api.sfx).toHaveBeenCalledWith('levelup')
    expect(api.say).toHaveBeenLastCalledWith(DIALOGUE.story_masaru_mecha, undefined)

    events.run('story_masaru_mecha')
    expect(api.say).toHaveBeenLastCalledWith(['美娜：战车状态良好！记得常来麦镇补给！'], undefined)
  })

  it('未知事件交还旧逻辑处理，条件支持显式真假判断', () => {
    expect(events.run('missing')).toBe(false)
    expect(eventConditionMatches(api.state, { type: 'flag', key: 'door_open' })).toBe(false)
    api.state.flags.door_open = true
    expect(eventConditionMatches(api.state, { type: 'flag', key: 'door_open' })).toBe(true)
    expect(
      eventConditionMatches(api.state, {
        type: 'partyMember',
        member: 'mecha',
        recruited: false
      })
    ).toBe(true)
  })

  it('对话结束后继续执行剩余指令', () => {
    const definitions: Record<string, EventDefinition> = {
      resume_after_dialogue: {
        id: 'resume_after_dialogue',
        commands: [
          { type: 'say', texts: ['先显示对话。'] },
          { type: 'setFlag', key: 'dialogue_finished', value: true }
        ]
      }
    }
    const runtime = new EventSystem(api, definitions)

    runtime.run('resume_after_dialogue')
    expect(api.state.flags.dialogue_finished).toBeUndefined()
    const callback = vi.mocked(api.say).mock.calls[0][1]
    expect(callback).toBeTypeOf('function')
    callback?.()
    expect(api.state.flags.dialogue_finished).toBe(true)
  })

  it('校验器报告缺失对白引用', () => {
    const definitions: Record<string, EventDefinition> = {
      broken: {
        id: 'broken',
        commands: [{ type: 'say', dialogueId: 'missing_dialogue' }]
      }
    }
    expect(validateEventDefinitions(definitions, DIALOGUE)).toEqual([
      'broken: missing dialogue missing_dialogue'
    ])
  })
})
