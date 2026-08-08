import { beforeEach, describe, expect, it, vi } from 'vitest'

type TestButton = Pick<GamepadButton, 'pressed' | 'touched' | 'value'>

function makeGamepad(pressedButtons: number[] = [], axes: number[] = [0, 0]): Gamepad {
  const pressed = new Set(pressedButtons)
  const buttons: TestButton[] = Array.from({ length: 16 }, (_, index) => ({
    pressed: pressed.has(index),
    touched: pressed.has(index),
    value: pressed.has(index) ? 1 : 0
  }))
  return {
    axes,
    buttons,
    connected: true,
    id: 'standard-test-pad',
    index: 0,
    mapping: 'standard',
    timestamp: 0,
    vibrationActuator: null
  } as unknown as Gamepad
}

describe('gamepad input', () => {
  let pads: (Gamepad | null)[]

  beforeEach(() => {
    vi.resetModules()
    pads = []
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { getGamepads: () => pads }
    })
  })

  it('maps standard confirm/cancel buttons and only queues their press edge', async () => {
    const input = await import('../src/game/engine/input')

    pads = [makeGamepad([0])]
    expect(input.poll()).toEqual(['a'])
    expect(input.poll()).toEqual([])

    pads = [makeGamepad()]
    expect(input.poll()).toEqual([])
    pads = [makeGamepad([1])]
    expect(input.poll()).toEqual(['b'])
  })

  it('supports analog and d-pad movement with a deadzone and clears on disconnect', async () => {
    const input = await import('../src/game/engine/input')

    pads = [makeGamepad([], [-0.8, 0.2])]
    expect(input.isHeld('left')).toBe(true)
    expect(input.isHeld('down')).toBe(false)
    expect(input.poll()).toEqual(['left'])

    pads = [makeGamepad([12])]
    expect(input.isHeld('left')).toBe(false)
    expect(input.isHeld('up')).toBe(true)
    expect(input.poll()).toEqual(['up'])

    pads = []
    expect(input.isHeld('up')).toBe(false)
  })
})
