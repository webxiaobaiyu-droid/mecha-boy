/* 事件运行时：解释数据层指令，并在对话结束后继续剩余事件 */

import type { GameApi } from '@/game/core/api'
import { EVENTS } from '@/game/data/events'
import { DIALOGUE } from '@/game/data/story'
import type { EventCommand, EventCondition, EventDefinition, GameState } from '@/game/types'
import { recruitWithCatchUp } from '@/game/systems/growth'

export class EventSystem {
  constructor(
    private api: GameApi,
    private definitions: Record<string, EventDefinition> = EVENTS
  ) {}

  run(id: string): boolean {
    const event = this.definitions[id]
    if (!event) return false
    this.execute(event.commands)
    return true
  }

  private execute(commands: EventCommand[]) {
    let queue = [...commands]
    while (queue.length) {
      const command = queue.shift()!
      switch (command.type) {
        case 'if': {
          const branch = this.matches(command.condition) ? command.then : command.else || []
          queue = [...branch, ...queue]
          break
        }
        case 'setFlag':
          this.api.state.flags[command.key] = command.value
          break
        case 'addGold':
          this.api.state.gold += command.amount
          break
        case 'recruit': {
          const member = this.api.state.party.find((item) => item.cls === command.member)
          if (member) recruitWithCatchUp(member, this.api.state.party)
          break
        }
        case 'sfx':
          this.api.sfx(command.kind)
          break
        case 'say': {
          const texts = command.dialogueId ? DIALOGUE[command.dialogueId] : command.texts
          if (!texts) return
          const remaining = [...queue]
          this.api.say(texts, remaining.length ? () => this.execute(remaining) : undefined)
          return
        }
      }
    }
  }

  private matches(condition: EventCondition): boolean {
    return eventConditionMatches(this.api.state, condition)
  }
}

export function validateEventDefinitions(
  definitions: Record<string, EventDefinition>,
  dialogue: Record<string, string[]>
): string[] {
  const errors: string[] = []
  const ids = new Set<string>()

  const validateCommands = (eventId: string, commands: EventCommand[]) => {
    for (const command of commands) {
      if (command.type === 'say') {
        if (command.dialogueId && !dialogue[command.dialogueId]) {
          errors.push(`${eventId}: missing dialogue ${command.dialogueId}`)
        } else if (command.texts && command.texts.length === 0) {
          errors.push(`${eventId}: empty inline dialogue`)
        }
      } else if (command.type === 'if') {
        validateCommands(eventId, command.then)
        if (command.else) validateCommands(eventId, command.else)
      }
    }
  }

  for (const [key, event] of Object.entries(definitions)) {
    if (event.id !== key) errors.push(`${key}: event id is ${event.id}`)
    if (ids.has(event.id)) errors.push(`${key}: duplicate event id ${event.id}`)
    ids.add(event.id)
    if (!event.commands.length) errors.push(`${key}: event has no commands`)
    validateCommands(key, event.commands)
  }

  return errors
}

export function eventConditionMatches(state: GameState, condition: EventCondition): boolean {
  if (condition.type === 'flag') {
    const value = state.flags[condition.key]
    return condition.equals === undefined ? Boolean(value) : value === condition.equals
  }
  const recruited = state.party.some(
    (member) => member.cls === condition.member && member.id === condition.member
  )
  return recruited === (condition.recruited ?? true)
}
