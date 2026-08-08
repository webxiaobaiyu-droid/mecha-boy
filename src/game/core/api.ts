/* 世界/战斗系统与 store 之间的接口，避免循环依赖 */

import type { BattleOpts, GameState, TankState } from '@/game/types'

export interface GameApi {
  state: GameState
  say(texts: string[], cb?: () => void): void
  beginSleep(source: 'home' | 'inn'): void
  banner(text: string): void
  sfx(kind: string): void
  addItem(id: string, n?: number): void
  addPart(id: string, n?: number): void
  addTank(tankId: string): void
  openGarageSlot(slot: number): void
  getTankByMember(memberId: string): TankState | null
  getActiveTank(): TankState | null
  tankLoad(t: TankState): number
  tankOverweight(t: TankState): boolean
  tankOperational(t: TankState): boolean
  startBattle(mobs: string[], opts: BattleOpts): void
  startBountyBattle(id: string, opts?: BattleOpts): void
  openMenu(): void
  openShop(type: string, building: { name: string }): void
  openPassword(): void
  gainXP(xp: number): string[]
  gameOver(): void
  doEnding(): void
}
