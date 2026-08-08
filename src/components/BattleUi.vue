<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@/game/core/store'
import { ITEMS } from '@/game/data/equipment'
import { tankConditionFor } from '@/game/assets/tanks'
import type { BattleFighter } from '@/game/types'

const b = computed(() => store.state.battle)
const menuItems = computed(() => store.battleMenuItems())
const commandHelp = computed(() => store.battleCommandHelp())
const usableItems = computed(() => {
  const inv = store.state.inventory.items
  return Object.keys(inv).filter(
    (k) => inv[k] > 0 && (ITEMS[k].hp || ITEMS[k].dmg || ITEMS[k].smoke || ITEMS[k].repair)
  )
})
const fighters = computed(() => b.value?.fighters || [])
const log = computed(() => b.value?.log.slice(-3) || [])

function confirmSelection(index: number) {
  store.battleCmd(index)
  store.battleConfirm()
}

function fighterStatus(fighter: BattleFighter) {
  if (!fighter.tank || fighter.tank.sp <= 0) {
    return `${fighter.member.hp}/${fighter.member.maxHp}`
  }
  return `装甲${fighter.tank.armor} · SP${fighter.tank.sp}`
}

function fighterStatusClass(fighter: BattleFighter) {
  if (!fighter.tank || fighter.tank.sp <= 0) {
    return { ko: fighter.member.hp <= 0 }
  }
  const condition = tankConditionFor(fighter.tank.sp, fighter.tank.tankDef?.sp || fighter.tank.sp)
  return {
    damaged: condition === 'damaged',
    critical: condition === 'critical'
  }
}
</script>

<template>
  <div v-if="b" class="battle-ui">
    <!-- 我方状态 -->
    <div class="pixel-window status">
      <div v-for="f in fighters.slice(0, 3)" :key="f.member.id || f.member.name" class="row">
        <span class="nm">{{ f.member.name }}</span>
        <span class="hp" :class="fighterStatusClass(f)">
          {{ fighterStatus(f) }}
        </span>
      </div>
    </div>

    <!-- 战斗信息 -->
    <div class="pixel-window log">
      <div v-for="(ln, i) in log" :key="i" class="ln">{{ ln }}</div>
    </div>

    <!-- 命令菜单 -->
    <div v-if="b.cmd && b.phase === 'fight'" class="cmd-zone">
      <div v-if="b.cmd.mode === 'menu'" class="pixel-window cmd">
        <div
          v-for="(it, i) in menuItems"
          :key="it"
          class="menu-row"
          :class="{ sel: b.cmd!.idx === i }"
          @click="confirmSelection(i)"
        >
          {{ it }}
        </div>
      </div>
      <div v-if="b.cmd.mode === 'menu' && commandHelp" class="weapon-help">
        {{ commandHelp }}
      </div>

      <div v-else-if="b.cmd.mode === 'target'" class="pixel-window target">
        <div
          v-for="(m, i) in b.mobs"
          :key="m.id + i"
          class="trow"
          :class="{ sel: b.cmd!.idx === i && m.hp > 0, dead: m.hp <= 0 }"
          @click="confirmSelection(i)"
        >
          <span>{{ m.hp > 0 ? '' : '✕' }}{{ m.name }}</span>
          <span class="thp">HP {{ m.hp }}</span>
        </div>
      </div>

      <div v-else-if="b.cmd.mode === 'item'" class="pixel-window target">
        <div
          v-for="(id, i) in usableItems"
          :key="id"
          class="trow"
          :class="{ sel: b.cmd!.idx === i }"
          @click="confirmSelection(i)"
        >
          {{ ITEMS[id].name }} ×{{ store.state.inventory.items[id] }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.battle-ui {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}
.status,
.log {
  position: absolute;
  bottom: 3%;
  height: 23%;
  padding: 6px 10px;
  font-size: 11px;
  pointer-events: auto;
}
.status {
  left: 2%;
  width: 44%;
}
.log {
  right: 2%;
  width: 44%;
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}
.nm {
  color: #fff;
}
.hp {
  color: #78d878;
}
.hp.ko {
  color: #d84848;
}
.hp.damaged {
  color: #e5c45b;
}
.hp.critical {
  color: #ff6b43;
}
.ln {
  color: #e8e8f0;
  font-size: 10px;
  line-height: 1.5;
}
.cmd-zone {
  position: absolute;
  right: 2%;
  top: 20%;
  pointer-events: auto;
}
.weapon-help {
  width: 214px;
  margin-top: 5px;
  padding: 5px 7px;
  border-left: 2px solid #9b8756;
  background: rgb(5 8 12 / 84%);
  color: #c7c2ad;
  font-size: 9px;
  line-height: 1.45;
}
.cmd {
  padding: 8px 12px 8px 20px;
  font-size: 12px;
}
.cmd .menu-row {
  padding: 4px 0;
}
.target {
  padding: 8px 12px;
  font-size: 11px;
  min-width: 150px;
}
.trow {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 3px 4px;
  cursor: pointer;
}
.trow.sel {
  color: #f8e048;
}
.trow.dead {
  color: #606060;
}
.thp {
  color: #88d088;
  font-size: 9px;
}
</style>
