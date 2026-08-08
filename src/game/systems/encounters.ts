export interface EncounterPacingOptions {
  cave?: boolean
  road?: boolean
  safeZone?: boolean
}

export interface EncounterPacing {
  chance: number
  forced: boolean
  graceSteps: number
  hardCap: number
  steps: number
}

function pacingWindow(options: EncounterPacingOptions): [graceSteps: number, hardCap: number] {
  if (options.cave) return options.safeZone ? [6, 14] : [4, 11]
  return options.safeZone ? [5, 13] : [3, 10]
}

export function advanceEncounterPacing(
  previousSteps: number,
  baseRate: number,
  options: EncounterPacingOptions = {}
): EncounterPacing {
  const steps = Math.max(0, Math.floor(previousSteps)) + 1
  const [graceSteps, hardCap] = pacingWindow(options)
  if (steps <= graceSteps) return { chance: 0, forced: false, graceSteps, hardCap, steps }
  if (steps >= hardCap) return { chance: 1, forced: true, graceSteps, hardCap, steps }

  const progress = (steps - graceSteps) / (hardCap - graceSteps)
  const terrainMultiplier = options.road ? 0.6 : 1
  const ramp = 0.75 + progress * 2.25
  const chance = Math.min(0.45, Math.max(0, baseRate * terrainMultiplier * ramp))
  return { chance, forced: false, graceSteps, hardCap, steps }
}

export function encounterTriggers(pacing: EncounterPacing, roll: number): boolean {
  return pacing.forced || roll < pacing.chance
}
