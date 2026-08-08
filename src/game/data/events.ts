/* 数据驱动剧情事件：内容分支留在数据层，执行规则由 EventSystem 统一处理 */

import type { EventDefinition } from '@/game/types'

export const EVENTS = {
  story_rado_father: {
    id: 'story_rado_father',
    commands: [
      {
        type: 'if',
        condition: { type: 'flag', key: 'tutorial_step', equals: 4 },
        then: [
          { type: 'setFlag', key: 'tutorial_step', value: 5 },
          { type: 'addGold', amount: 1500 },
          { type: 'sfx', kind: 'cash' },
          { type: 'say', dialogueId: 'story_rado_tank_lesson' }
        ],
        else: [
          {
            type: 'if',
            condition: { type: 'flag', key: 'kicked', equals: true },
            then: [
              {
                type: 'say',
                texts: [
                  '老战：发动机和 C 装置要是大破，战车就动不了。',
                  '老战：记得去老乔那里做诊断，别只顾着往炮塔上堆东西。'
                ]
              }
            ],
            else: [
              { type: 'setFlag', key: 'kicked', value: true },
              { type: 'setFlag', key: 'tutorial_step', value: 1 },
              { type: 'sfx', kind: 'confirm' },
              { type: 'say', dialogueId: 'story_rado_father' }
            ]
          }
        ]
      }
    ]
  },
  story_masaru_mecha: {
    id: 'story_masaru_mecha',
    commands: [
      {
        type: 'if',
        condition: { type: 'partyMember', member: 'mecha', recruited: true },
        then: [{ type: 'say', texts: ['美娜：战车状态良好！记得常来麦镇补给！'] }],
        else: [
          { type: 'recruit', member: 'mecha' },
          { type: 'setFlag', key: 'tutorial_step', value: 10 },
          { type: 'sfx', kind: 'levelup' },
          { type: 'say', dialogueId: 'story_masaru_mecha' }
        ]
      }
    ]
  }
} satisfies Record<string, EventDefinition>
