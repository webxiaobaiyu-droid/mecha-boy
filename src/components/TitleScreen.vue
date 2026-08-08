<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@/game/core/store'
import { TRACKS } from '@/game/data/story'
import titleBackdrop from '@/assets/game/battle/rado-ruins-ogaby.png'

const state = store.state
const menu = ['开始新游戏', '继续冒险', '音乐室', '制作名单']
const names = Object.keys(TRACKS)
const jukeList = computed(() => names)
</script>

<template>
  <div class="title-screen">
    <img class="title-scene" :src="titleBackdrop" alt="" aria-hidden="true" />

    <header class="brand">
      <h1 class="logo"><span>荒原</span><strong>引擎</strong></h1>
      <p class="subtitle">每一台旧机器，都有下一段路。</p>
    </header>

    <nav v-if="!state.jukebox && !state.creditsOpen" class="menu" aria-label="标题菜单">
      <button
        v-for="(m, i) in menu"
        :key="m"
        type="button"
        class="menu-row"
        :class="{ sel: state.titleMenu === i }"
        :aria-current="state.titleMenu === i ? 'true' : undefined"
        @click="store.titleChoose(i)"
      >
        {{ m }}
      </button>
    </nav>

    <section v-else-if="state.jukebox" class="pixel-window jukebox" aria-label="音乐室">
      <div class="title jk-title">音乐室</div>
      <button
        v-for="(n, i) in jukeList"
        :key="n"
        type="button"
        class="menu-row jk-row"
        :class="{ sel: state.jukeIdx === i }"
        :aria-current="state.jukeIdx === i ? 'true' : undefined"
        @click="store.jukeboxSelect(i)"
      >
        {{ TRACKS[n] }}
      </button>
    </section>

    <section v-else class="pixel-window credits" aria-label="制作名单与素材许可">
      <div class="title credits-title">制作名单与素材许可</div>
      <p>企划、程序与原创角色图集：荒原引擎项目贡献者</p>
      <p>“Post Apocalyptic Pixel Art Backgrounds” by CraftPix.net 2D Game Assets，OGA-BY 3.0。</p>
      <a
        href="https://opengameart.org/content/post-apocalyptic-pixel-art-backgrounds"
        target="_blank"
        rel="noreferrer"
        >背景素材来源</a
      >
      <p>“Tricolor NES Static Monster Graphics” by Ctske，CC BY 4.0。</p>
      <a
        href="https://opengameart.org/content/tricolor-nes-static-monster-graphics"
        target="_blank"
        rel="noreferrer"
        >敌人素材来源</a
      >
      <p>CodeManu、FisherG、mishonis 的 CC0 素材用于室内、城镇与战车图像。</p>
      <button type="button" class="close-credits" @click="store.closeTitleOverlay()">返回</button>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.title-screen {
  position: absolute;
  inset: 0;
  isolation: isolate;
  overflow: hidden;
  background: #130d0d;
  color: #f0dfbf;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Courier New', monospace;
  letter-spacing: 0;
  z-index: 25;
}

.title-scene {
  position: absolute;
  inset: 0 0 auto;
  width: 640px;
  height: 360px;
  object-fit: cover;
  image-rendering: pixelated;
  z-index: -3;
}

.title-screen::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      rgba(19, 10, 9, 0.84) 0%,
      rgba(19, 10, 9, 0.46) 43%,
      rgba(19, 10, 9, 0.08) 76%
    ),
    linear-gradient(
      180deg,
      rgba(19, 10, 9, 0.08) 0%,
      rgba(19, 10, 9, 0.12) 48%,
      rgba(19, 13, 13, 0.92) 76%,
      #130d0d 100%
    );
  pointer-events: none;
  z-index: -2;
}

.title-screen::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 4px solid rgba(240, 190, 112, 0.22);
  box-shadow: inset 0 0 0 2px rgba(16, 10, 9, 0.72);
  pointer-events: none;
  z-index: 2;
}

.brand {
  position: absolute;
  top: 38px;
  left: 36px;
  width: 330px;
  pointer-events: none;
}

.logo {
  margin: 0;
  color: #f3e1bb;
  font-size: 54px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0;
  text-shadow:
    2px 2px 0 #4b241a,
    4px 4px 0 #160b09;
}

.logo strong {
  color: #d36b3f;
  font-weight: 900;
}

.subtitle {
  margin: 10px 0 0;
  color: #ead8b7;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: 0;
  text-shadow:
    1px 1px 0 #160b09,
    2px 2px 0 rgba(22, 11, 9, 0.72);
}

.menu {
  position: absolute;
  left: 36px;
  bottom: 38px;
  display: grid;
  width: 196px;
  gap: 2px;
}

.menu-row {
  position: relative;
  display: block;
  width: 100%;
  min-height: 34px;
  margin: 0;
  padding: 7px 14px 7px 30px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #d0c2aa;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  line-height: 20px;
  letter-spacing: 0;
  text-align: left;
  text-shadow: 1px 1px 0 #160b09;
  white-space: nowrap;
  cursor: pointer;
}

.menu-row:hover,
.menu-row.sel {
  background: rgba(109, 45, 28, 0.78);
  color: #fff0c8;
}

.menu-row.sel::before {
  content: '▶';
  position: absolute;
  left: 10px;
  color: #ef9d55;
}

.menu-row:focus-visible {
  outline: 2px solid #ef9d55;
  outline-offset: -2px;
}

.menu-row:active {
  transform: translateY(1px);
}

.jukebox {
  position: absolute;
  top: 78px;
  right: 34px;
  width: 260px;
  max-height: 360px;
  padding: 14px 18px 12px;
  overflow-y: auto;
  background: rgba(25, 18, 18, 0.96);
}

.jk-title {
  margin-bottom: 8px;
  color: #ef9d55;
  font-size: 15px;
  letter-spacing: 0;
  text-align: center;
}

.jk-row {
  min-height: 25px;
  padding: 2px 8px 2px 22px;
  font-size: 12px;
  line-height: 21px;
}

.credits {
  position: absolute;
  top: 40px;
  right: 30px;
  width: 500px;
  max-height: 400px;
  padding: 17px 20px;
  overflow-y: auto;
  background: rgba(25, 18, 18, 0.97);
  color: #d8cbb5;
  font-size: 13px;
  line-height: 1.55;
}

.credits-title {
  margin-bottom: 9px;
  color: #ef9d55;
  font-size: 17px;
}

.credits p {
  margin: 7px 0 2px;
}

.credits a {
  color: #e8b56e;
  text-decoration: underline;
}

.close-credits {
  display: block;
  width: 92px;
  min-height: 30px;
  margin: 12px 0 0 auto;
  border: 1px solid #ad7448;
  border-radius: 0;
  background: #4d251c;
  color: #fff0c8;
  font: inherit;
  cursor: pointer;
}

.close-credits:focus-visible {
  outline: 2px solid #ef9d55;
  outline-offset: 2px;
}
</style>
