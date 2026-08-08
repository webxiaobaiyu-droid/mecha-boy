import { describe, expect, it } from 'vitest'
import { BOUNTIES, MONSTERS, REGIONS } from '../src/game/data/combat'
import { HUMAN_WEAPONS, PARTS, TANKS } from '../src/game/data/equipment'
import { GROWTH, xpNeed } from '../src/game/data/story'
import { ARMOR_PLATE_COST, diagnoseTank, maintenanceTotals } from '../src/game/systems/maintenance'
import { createTankRuntime } from '../src/game/systems/tanks'
import type { MemberClass, PartKind } from '../src/game/types'

function seededRandom(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function memberAtLevel(cls: MemberClass, level: number) {
  const growth = GROWTH[cls]
  return {
    hp: growth.base.hp + growth.up.hp * (level - 1),
    atk: growth.base.atk + growth.up.atk * (level - 1),
    def: growth.base.def + growth.up.def * (level - 1)
  }
}

function part(kind: PartKind, id: string | null) {
  return id ? PARTS[kind].find((item) => item.id === id)! : null
}

function humanAttack(random: () => number, monster: (typeof MONSTERS)[string]): number {
  const hero = memberAtLevel('hero', 1)
  const sling = HUMAN_WEAPONS.sling
  const attack = hero.atk + sling.atk
  const accuracy = Math.max(0.35, 0.88 + (sling.acc || 0) / 100 - monster.spd * 0.008)
  if (random() >= accuracy) return 0
  let damage = Math.max(1, Math.round(attack * (0.92 + random() * 0.2) - monster.def * 0.5))
  if (random() < 0.08) damage = Math.round(damage * 1.8)
  return damage
}

function monsterAttack(
  random: () => number,
  monster: (typeof MONSTERS)[string],
  defense: number
): number {
  return Math.max(1, Math.round(monster.atk * (0.9 + random() * 0.2) - defense * 0.5))
}

function simulateFootEncounter(
  random: () => number,
  monsterId: string,
  startingHp = GROWTH.hero.base.hp,
  startingMeds = 0
) {
  const monster = MONSTERS[monsterId]
  let monsterHp = monster.hp
  let hp = startingHp
  let meds = startingMeds
  let rounds = 0

  while (hp > 0 && monsterHp > 0 && rounds++ < 100) {
    const playerFirst =
      GROWTH.hero.base.spd > monster.spd || (GROWTH.hero.base.spd === monster.spd && random() < 0.5)
    const playerTurn = () => {
      if (hp <= 20 && meds > 0) {
        hp = Math.min(GROWTH.hero.base.hp, hp + 60)
        meds--
      } else {
        monsterHp -= humanAttack(random, monster)
      }
    }
    const enemyTurn = () => {
      hp -= monsterAttack(random, monster, GROWTH.hero.base.def)
    }

    if (playerFirst) {
      playerTurn()
      if (monsterHp > 0) enemyTurn()
    } else {
      enemyTurn()
      if (hp > 0) playerTurn()
    }
  }

  return { won: monsterHp <= 0, hp: Math.max(0, hp), meds }
}

function simulateTankCampaign(seed: number, encounters: number) {
  const random = seededRandom(seed)
  const region = REGIONS.find((candidate) => candidate.id === 'masaru')!
  const tank = TANKS.find((candidate) => candidate.id === 't1')!
  const machineGun = PARTS.sub.find((candidate) => candidate.id === tank.parts.sub)!
  let armor = tank.armorCap
  let gold = 0
  let completed = 0

  for (let encounter = 0; encounter < encounters && armor > 0; encounter++) {
    const groupSize = 1 + Math.floor(random() * (region.maxGroup || 3))
    const mobs = Array.from({ length: groupSize }, () => {
      const id = region.mobs[Math.floor(random() * region.mobs.length)]
      return { def: MONSTERS[id], hp: MONSTERS[id].hp }
    })
    let rounds = 0
    while (armor > 0 && mobs.some((mob) => mob.hp > 0) && rounds++ < 100) {
      for (const mob of mobs) {
        if (mob.hp <= 0) continue
        const accuracy = Math.max(0.35, 0.88 - mob.def.spd * 0.008)
        if (random() >= accuracy) continue
        let damage = Math.max(
          1,
          Math.round((machineGun.atk || 0) * (0.92 + random() * 0.2) - mob.def.def * 0.5)
        )
        if (random() < 0.08) damage = Math.round(damage * 1.8)
        mob.hp -= damage
      }
      for (const mob of mobs) {
        if (mob.hp > 0) armor -= monsterAttack(random, mob.def, tank.def)
      }
    }
    if (mobs.every((mob) => mob.hp <= 0)) {
      completed++
      gold += mobs.reduce((sum, mob) => sum + mob.def.g, 0)
    }
  }

  const armorLoss = tank.armorCap - Math.max(0, armor)
  return {
    completed,
    armor: Math.max(0, armor),
    netGold: gold - armorLoss * ARMOR_PLATE_COST
  }
}

function simulateNoa(seed: number) {
  const random = seededRandom(seed)
  const boss = BOUNTIES.find((bounty) => bounty.id === 'noa')!
  const setup: { tankId: string; cls: MemberClass }[] = [
    { tankId: 't6', cls: 'hero' },
    { tankId: 't7', cls: 'mecha' },
    { tankId: 't8', cls: 'wolf' }
  ]
  const fighters = setup.map(({ tankId, cls }) => {
    const tank = TANKS.find((item) => item.id === tankId)!
    const member = memberAtLevel(cls, 25)
    return {
      ...member,
      tank,
      armor: tank.armorCap,
      sp: tank.sp,
      inTank: true
    }
  })
  let bossHp = boss.hp
  let round = 0

  while (bossHp > 0 && fighters.some((fighter) => fighter.hp > 0) && round < 100) {
    round++
    for (const fighter of fighters) {
      if (fighter.hp <= 0) continue
      const weapon = fighter.inTank ? part('main', fighter.tank.parts.main) : null
      const computer = fighter.inTank ? part('c', fighter.tank.parts.c) : null
      const attack = weapon?.atk || fighter.atk
      const accuracy = Math.max(
        0.35,
        0.88 + ((weapon?.acc || 0) + (computer?.acc || 0)) / 100 - boss.spd * 0.008
      )
      if (random() >= accuracy) continue
      let damage = Math.max(1, Math.round(attack * (0.92 + random() * 0.2) - boss.def * 0.5))
      if (random() < 0.08) damage = Math.round(damage * 1.8)
      bossHp -= Math.min(bossHp, damage)
      if (bossHp <= 0) break
    }
    if (bossHp <= 0) break

    const alive = fighters.filter((fighter) => fighter.hp > 0)
    const hitsEveryone = random() < 0.3
    const targets = hitsEveryone ? alive : [alive[Math.floor(random() * alive.length)]]
    for (const fighter of targets) {
      const defense = fighter.inTank ? fighter.tank.def : fighter.def
      const variance = hitsEveryone ? 0.75 + random() * 0.2 : 0.9 + random() * 0.2
      const reduction = hitsEveryone ? 0.4 : 0.5
      let damage = Math.max(1, Math.round(boss.atk * variance - defense * reduction))
      if (fighter.inTank) {
        const armorDamage = Math.min(fighter.armor, damage)
        fighter.armor -= armorDamage
        damage -= armorDamage
        fighter.sp -= damage
        if (fighter.sp <= 0) {
          fighter.sp = 0
          fighter.inTank = false
        }
      } else {
        fighter.hp = Math.max(0, fighter.hp - damage)
      }
    }
  }

  return { won: bossHp <= 0, round }
}

describe('正式数值平衡', () => {
  it('旧战车完成教学整备后保留足够的初期周转金', () => {
    const tank = createTankRuntime('t1')
    tank.sp = 330
    tank.armor = 80
    tank.ammo.main = 6
    tank.ammo.se = 2
    tank.condition.sub = 'damaged'

    const items = diagnoseTank(tank)
    const totals = maintenanceTotals(items)
    const availableGold = 300 + 1500

    expect(items.find((item) => item.id === 'armor')?.cost).toBe(420)
    expect(totals.cost).toBe(916)
    expect(availableGold - totals.cost).toBe(884)
  })

  it.each(['rat', 'ant', 'dog'] as const)('%s 的保守战损成本低于战斗收入', (id) => {
    const monster = MONSTERS[id]
    const tank = TANKS.find((candidate) => candidate.id === 't1')!
    const machineGun = PARTS.sub.find((part) => part.id === 'mg')!
    const maxIncomingDamage = Math.max(1, Math.round(monster.atk * 1.1 - tank.def * 0.5))
    const minOutgoingDamage = Math.max(
      1,
      Math.round((machineGun.atk || 0) * 0.92 - monster.def * 0.5)
    )
    const conservativeEnemyTurns = Math.ceil(monster.hp / minOutgoingDamage) + 1
    const conservativeRepairCost = maxIncomingDamage * conservativeEnemyTurns * ARMOR_PLATE_COST

    expect(monster.g).toBeGreaterThan(conservativeRepairCost)
  })

  it.each(['bug', 'thief', 'scorp'] as const)('%s 用初始副炮作战的保守收益为正', (id) => {
    const monster = MONSTERS[id]
    const tank = TANKS.find((candidate) => candidate.id === 't1')!
    const machineGun = PARTS.sub.find((candidate) => candidate.id === 'mg')!
    const maxIncomingDamage = Math.max(1, Math.round(monster.atk * 1.1 - tank.def * 0.5))
    const minOutgoingDamage = Math.max(
      1,
      Math.round((machineGun.atk || 0) * 0.92 - monster.def * 0.5)
    )
    const conservativeEnemyTurns = Math.ceil(monster.hp / minOutgoingDamage) + 1
    const conservativeRepairCost = maxIncomingDamage * conservativeEnemyTurns * ARMOR_PLATE_COST

    expect(monster.g).toBeGreaterThan(conservativeRepairCost)
  })

  it.each(['rat', 'ant', 'dog'] as const)('一级猎人徒步单挑 %s 不会被随机数卡死', (id) => {
    const outcomes = Array.from({ length: 10_000 }, (_, index) =>
      simulateFootEncounter(seededRandom(index + 1), id)
    )
    const winRate = outcomes.filter((outcome) => outcome.won).length / outcomes.length

    expect(winRate).toBeGreaterThanOrEqual(0.999)
  })

  it('取得战车后徒步返回洞口的整段路线可靠存活', () => {
    const region = REGIONS.find((candidate) => candidate.id === 'rado')!
    const outcomes = Array.from({ length: 20_000 }, (_, index) => {
      const random = seededRandom(index + 1)
      let hp = GROWTH.hero.base.hp
      let meds = 3
      let alive = true
      for (let step = 0; step < 21 && alive; step++) {
        if (random() >= (region.encounterRate || 0.055)) continue
        const id = region.mobs[Math.floor(random() * region.mobs.length)]
        const result = simulateFootEncounter(random, id, hp, meds)
        alive = result.won
        hp = result.hp
        meds = result.meds
      }
      return alive
    })
    const survivalRate = outcomes.filter(Boolean).length / outcomes.length

    expect(region.maxGroup).toBe(1)
    expect(survivalRate).toBeGreaterThanOrEqual(0.9995)
  })

  it('抵达麦镇前两场最低经验值遇敌足以让主角升到 2 级', () => {
    const region = REGIONS.find((candidate) => candidate.id === 'rado')!
    const minimumEncounterXp = Math.min(...region.mobs.map((id) => MONSTERS[id].xp))

    expect(minimumEncounterXp * 2).toBeGreaterThanOrEqual(xpNeed(1))
  })

  it('初始战车在麦镇农垦带连战三场后仍有装甲且维修后盈利', () => {
    const outcomes = Array.from({ length: 10_000 }, (_, index) =>
      simulateTankCampaign(index + 1, 3)
    )
    const completed = outcomes.filter((outcome) => outcome.completed === 3)
    const completionRate = completed.length / outcomes.length
    const sortedArmor = completed.map((outcome) => outcome.armor).sort((a, b) => a - b)
    const sortedProfit = completed.map((outcome) => outcome.netGold).sort((a, b) => a - b)

    expect(completionRate).toBeGreaterThanOrEqual(0.995)
    expect(sortedArmor[Math.floor(sortedArmor.length / 2)]).toBeGreaterThanOrEqual(250)
    expect(sortedProfit[Math.floor(sortedProfit.length / 2)]).toBeGreaterThanOrEqual(150)
    expect(completed.every((outcome) => outcome.netGold > 0)).toBe(true)
  })

  it('合法终局配置对诺亚具有可控但不保送的胜率', () => {
    const outcomes = Array.from({ length: 1000 }, (_, index) => simulateNoa(index + 1))
    const wins = outcomes.filter((outcome) => outcome.won)
    const rounds = wins.map((outcome) => outcome.round).sort((a, b) => a - b)
    const winRate = wins.length / outcomes.length
    const medianRounds = rounds[Math.floor(rounds.length / 2)]

    expect(winRate).toBeGreaterThanOrEqual(0.4)
    expect(winRate).toBeLessThanOrEqual(0.7)
    expect(medianRounds).toBeGreaterThanOrEqual(12)
    expect(medianRounds).toBeLessThanOrEqual(25)
  })
})
