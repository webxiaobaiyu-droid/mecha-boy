# 荒原引擎

一款以废土公路、赏金狩猎与可改装战车为核心的网页 RPG。

项目使用 **Vite + Vue 3 + TypeScript + PixiJS 8**。PixiJS 以 WebGL 场景图渲染世界、城镇、洞窟、室内、天气和战斗，画布按设备像素比铺满整个浏览器视口；HUD、菜单、对话、商店等界面由 Vue 组件承载，并在独立的可读安全区内响应式缩放。游戏规则按数据、引擎和系统分层，生产构建仍输出一个可双击游玩的自包含 HTML。

> 场景细节：32px 精细瓦片（地形自动衔接边缘、水面动态反光）、44×26 大城镇（多建筑 + 路灯/水井/树木等装饰）、开局从「父亲的修理店」房间开始，洞窟与战斗场景同样有颗粒度升级。

运行时不再每帧重绘 640×480 Canvas。程序化瓦片只在地图载入时生成一次纹理，随后由 PixiJS 负责全屏相机、实体景深、昼夜灯光、GPU 天气粒子、战斗弹道、爆炸和镜头震动。

## 开发

需要 Node.js 22+。

```bash
npm install
npm run dev
```

Vite 开发服务器默认监听所有网卡，并使用端口 `9001`。本机可通过 `http://localhost:9001` 访问，局域网内其他设备请使用运行本项目电脑的局域网 IP（例如 `http://192.168.1.100:9001`）。

Git 分支约定：`main` 为可发布的完整源码，日常功能开发从 `develop` 切出分支，验收后再合并回 `main`。

```bash
git switch develop
git switch -c feature/my-change
```

## 构建与检查

```bash
# 类型检查、ESLint、测试和生产构建
npm run check

# 只构建生产版本
npm run build
```

构建结果为 `dist/index.html`。它已经内联 JavaScript 和 CSS，可以直接双击打开，也可以通过任意静态服务器部署。

其他常用命令：

```bash
npm run typecheck
npm run lint
npm test
npm run preview
npm run audit:world  # 审计关口、绕路与城镇可达性
npm run preview:art  # 重新生成地图与战斗离线预览（PNG + PPM）
```

## 操作

- 方向键 / WASD：移动、选择
- Z / J / Enter：确认、调查、对话
- X / K / Esc：取消、打开菜单
- M：静音切换
- 手机 / 平板：竖屏在画面下方、横屏在画面两侧显示虚拟方向键和 A/B 键

游戏内“设置”可分别调整音乐、音效音量和文本速度，设置会保存在浏览器本地。

## 场景验收入口

开发服务器启动后，可通过查询参数直接进入验收场景：

```text
?debug=town             拉多镇
?debug=masaru           麦镇
?debug=room             父亲的修理店
?debug=cave             拉多南洞窟
?debug=map              战争迷雾与世界图例
?debug=gate&id=windbreak 裂风山口（追加 open=1 查看开放状态）
?debug=settings         设置页
?debug=tank-drive       战车四向行驶与受损状态
?debug=battle-field     荒野战斗
?debug=battle-forest    森林战斗
?debug=battle-mountain  山地战斗
?debug=battle-town      城镇战斗
?debug=battle-cave      洞窟战斗
?debug=battle-desert    沙漠战斗
?debug=boss             终局战斗
```

例如 `http://localhost:9001/?debug=masaru`。战车入口可叠加 `tank=t1..t8`、`facing=0..3` 和 `condition=damaged|critical`，例如 `?debug=tank-drive&tank=t7&facing=3&condition=critical`。`npm run preview:art` 会在 `preview/` 同时生成可直接查看的 PNG 和无损 PPM 中间图。

## 目录结构

```text
src/
  components/          Vue 界面组件
  game/
    audio/             Web Audio 音乐与音效
    core/              状态、存档和流程总控
    data/              地图、装备、怪物和剧情数据
    engine/            输入、图集与一次性地图纹理生成
    pixi/              PixiJS 场景、相机、天气、战车与战斗特效
    systems/           探索和战斗规则
    types.ts           共享领域类型
  stores/              Pinia 应用级设置
  styles/              全局 Sass 样式和设计令牌
test/                   Vitest 集成测试
legacy/                 改造前的原生 JS 版本（保留作对照）
dist/index.html         可直接打开的单文件生产版本
```

新增玩法时，优先把规则放进 `src/game/systems`、静态配置放进 `src/game/data`、Pixi 表现放进 `src/game/pixi`、界面放进 `src/components`，避免把业务逻辑堆回 Vue 组件或渲染场景。

## 游戏内容

- 10 幕主线与多结局
- 96x72 开放世界、8 座主城、2 个村落、1 个部落及多层洞窟 / 迷宫
- 逐瓦片战争迷雾、区域地图图例，以及守门战、赏金首条件、危险绕路组成的非线性路网
- 昼夜、风、雨与暴风天气系统，不同环境会同步影响探索和战斗画面
- 8 辆可改装战车、四向探索轮廓、战斗炮塔瞄准/后坐、受损状态和完整载重系统
- 徒步 / 战车双模式回合制战斗，含 9 级人用武器、队员换装与单体/全体枪械
- 战车工房按工单维修，装甲片统一按 1G/点补给；拉多初期战斗具备正向战损收益
- 全灭后在拉多镇自宅二楼复苏，只损失当前金币的一半，不丢物品、经验或剧情进度
- 11 个赏金首与赏金领取流程
- 10 首 Web Audio 实时合成芯片音乐
- 基于 `localStorage` 的存档

设计与玩法细节见 [DESIGN.md](DESIGN.md)。

当前可按生产标准验收的是拉多区域第一纵切；麦镇已完成第二个手工城镇样本，但独立室内、完整事件和正式地图工具链仍未闭环。其余城镇和终局流程仍包含复用布局与临时美术。场景、输入、地图层和后续工具路线的验收门槛见 [docs/PRODUCTION_BASELINE.md](docs/PRODUCTION_BASELINE.md)。

本轮产品判断、发行阻断与 P0/P1/P2 后续顺序见 [docs/PRODUCT_REVIEW_2026-08-02.md](docs/PRODUCT_REVIEW_2026-08-02.md)。

GitHub 上不同语言《重装机兵》相关实现的源码调研、许可边界与可集成玩法见 [docs/GITHUB_METAL_MAX_RESEARCH_2026-08-03.md](docs/GITHUB_METAL_MAX_RESEARCH_2026-08-03.md)。

> 项目不包含从商业游戏中提取的素材；第三方资源的来源与许可证见 [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)。
