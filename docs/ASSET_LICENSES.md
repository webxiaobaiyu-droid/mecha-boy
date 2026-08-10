# 素材来源与许可台账

审计快照：2026-08-10。

本文是 `src/assets/game` 与 `src/assets/fonts` 运行时素材的权威台账。每个文件通过“来源 ID”关联到作者、许可证、来源页面和下载 URL；文件表另行记录本地 SHA-256、上游成员和本地变换。两张表联合后即为完整的逐文件来源记录。

## 发布规则

- `src/assets/game` 中的每个文件必须在“逐文件台账”中且只能出现一次。
- `src/assets/fonts` 中的每个文件必须在“逐文件台账”中且只能出现一次。
- 文件名中的 `cc0`、`oga` 或 `ogaby` 不是许可证明；来源页面、下载地址和哈希比对才是证明。
- `CC-BY 4.0` 和 `OGA-BY 3.0` 素材发布时必须附带本文“发行时必须保留的归属文本”。只发布单个 `dist/index.html` 而不包含归属信息，不满足本项目的发布门槛。
- 修改、替换或重新编码任一素材后，必须同步更新本地 SHA-256 和“本地变换”。
- 无法落实到已验证来源的文件必须标为 `UNKNOWN / DO NOT SHIP`，并从生产构建中移除；文件名或口头说明不能解除阻断。

## 来源登记

| 来源 ID                   | 作者                                | 上游标题                                               | 许可证                                                                                                   | 来源页面                                                                                              | 下载 URL                                                                                                                                                           | 上游包 SHA-256                                                                     |
| ------------------------- | ----------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `LOCAL-ACTORS`            | Mecha Boy 项目贡献者                | 项目原创角色图集                                       | 项目原创；未引入第三方许可，对外授权范围由项目所有者决定                                                 | `scripts/generate_actor_atlas.py`                                                                     | 不适用                                                                                                                                                             | 生成器 SHA-256：`b7ba71cbc8fcc7b424905bafe30a320afe9f9ae460a035d992a2d44435a10dd4` |
| `LOCAL-BATTLE-EFFECTS`    | Mecha Boy 项目贡献者                | 项目原创战斗效果图集                                   | 项目原创；未引入第三方许可，对外授权范围由项目所有者决定                                                 | `scripts/generate_battle_effects_atlas.py`                                                            | 不适用                                                                                                                                                             | 生成器 SHA-256：`5f64af4f4f71dd548dbbbbe911a62c295fcb71eb874a25daabdf2c9f54d5e758` |
| `OGA-FISHERG-CITY`        | FisherG                             | (12x12) City Tiles - Top Down                          | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                            | [OpenGameArt 页面](https://opengameart.org/content/12x12-city-tiles-top-down)                         | [topdowncitypack.zip](https://opengameart.org/sites/default/files/topdowncitypack.zip)                                                                             | `dd082b0c08b323fcde191c69b702207869caaee29b1d7f3b660f6bb6f4ab918e`                 |
| `OGA-CODEMANU-WASTELAND`  | CodeManu                            | Pixel Art Wasteland                                    | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                            | [OpenGameArt 页面](https://opengameart.org/content/pixel-art-wasteland)                               | [pixel_art_wasteland.zip](https://opengameart.org/sites/default/files/pixel_art_wasteland.zip)                                                                     | `0645063c15afb2623b11207f8f737425575d8ec773175e73894c17090c9bda27`                 |
| `OGA-CRAFTPIX-BACKGROUND` | CraftPix.net 2D Game Assets         | Post Apocalyptic Pixel Art Backgrounds                 | [OGA-BY 3.0](https://opengameart.org/content/oga-by-30-faq)                                              | [OpenGameArt 页面](https://opengameart.org/content/post-apocalyptic-pixel-art-backgrounds)            | [postapocalypse_bg_pixel_png.zip](https://opengameart.org/sites/default/files/postapocalypse_bg_pixel_png.zip)                                                     | `86ccc80f064f8b24a6b5f2f2fbc4cb4259d8b53721258cd86338fb3dcc1769d7`                 |
| `OGA-CTSKE-BATTLERS`      | Ctske（页面账号 `ctske`）           | Tricolor NES Static Monster Graphics                   | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)；上游同时提供 OGA-BY 3.0，本项目选择 CC-BY 4.0 | [OpenGameArt 页面](https://opengameart.org/content/tricolor-nes-static-monster-graphics)              | [Battlers_0.zip](https://opengameart.org/sites/default/files/Battlers_0.zip)                                                                                       | `7854ee4ba0bce834619bf885c3d83d0122bfc360764032a7f7ee1dbdfee4a592`                 |
| `OGA-MISHONIS-TANK`       | mishonis                            | Tileset and assets for a Scorched Earth type game      | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                            | [OpenGameArt 页面](https://opengameart.org/content/tileset-and-assets-for-a-scorched-earth-type-game) | [tanks_assets.zip](https://opengameart.org/sites/default/files/tanks_assets.zip)                                                                                   | `d13d37266bfacec4fb6018479432feba532981c1a6d4b76b85b430f26b5c11f7`                 |
| `FUSION-PIXEL-FONT`       | TakWolf 与 Fusion Pixel Font 贡献者 | Fusion Pixel Font 10px Proportional Simplified Chinese | [SIL OFL 1.1](https://openfontlicense.org/)                                                              | [GitHub 项目](https://github.com/TakWolf/fusion-pixel-font)                                           | [2026.07.20 WOFF2 发布包](https://github.com/TakWolf/fusion-pixel-font/releases/download/2026.07.20/fusion-pixel-font-10px-proportional-otf.woff2-v2026.07.20.zip) | `749cc17fd41fb90782fb1539a36849df4c683230b62d87dbd25d744948973300`                 |

## 逐文件台账

| 发布状态                      | 本地文件                                                             | 来源 ID                   | 上游成员或生成输入                                 | 本地 SHA-256                                                       | 本地变换                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------- | ------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 可发布（项目原创）            | `src/assets/game/actors-common.json`                                 | `LOCAL-ACTORS`            | `scripts/generate_actor_atlas.py`                  | `29de59c7f9baa9b98ecda9bec41d6544115cf58652584720ddf077a6395128a1` | 由脚本生成 7 个角色、4 个方向、每方向 3 帧的 16x24 图集元数据；JSON 使用 ASCII 转义。                                      |
| 可发布（项目原创）            | `src/assets/game/actors-common.png`                                  | `LOCAL-ACTORS`            | `scripts/generate_actor_atlas.py`                  | `25bcda712d33664fc5819b51fb4b540621628b6d4e0baf1861f387f1a0abde9e` | 由脚本使用 Pillow 程序化绘制并以优化 PNG 保存；包含 7 个角色的四方向三帧及逐帧颜色校验，没有第三方图像输入。               |
| 可发布（项目原创）            | `src/assets/game/battle/effects-original.json`                       | `LOCAL-BATTLE-EFFECTS`    | `scripts/generate_battle_effects_atlas.py`         | `81d31e027e772b7515c8b016677d2c9d41755d7c538ee6eb9b71b6bda8d8b60d` | 由脚本生成炮弹、导弹、能量弹、命中闪光及两档爆炸共 28 帧的图集元数据；JSON 使用 ASCII 转义。                               |
| 可发布（项目原创）            | `src/assets/game/battle/effects-original.png`                        | `LOCAL-BATTLE-EFFECTS`    | `scripts/generate_battle_effects_atlas.py`         | `60242559e2b50ca06bc6eea147a87f834b4ed9608660d30f6997e2d66c156f87` | 由脚本使用 Pillow 程序化绘制并以优化 PNG 保存；未读取或转换任何第三方图像。                                                |
| 可发布（CC-BY，须归属）       | `src/assets/game/battle/dragon-oga.png`                              | `OGA-CTSKE-BATTLERS`      | `battler_dragon.png`                               | `67802cd44937a371b7dfca964a8452f19cd2331802908f019f8aafc7008d852f` | 使用 FFmpeg nearest-neighbor 从 224x192 缩小 50% 至 112x96，并重新编码为 PNG。                                             |
| 可发布（CC-BY，须归属）       | `src/assets/game/battle/drecko-oga.png`                              | `OGA-CTSKE-BATTLERS`      | `battler_drecko.png`                               | `302713bcdaa3e568720993c01de2310d4f52a811d0f97c64c1003d524c090841` | 使用 FFmpeg nearest-neighbor 从 160x96 缩小 50% 至 80x48，并重新编码为 PNG。                                               |
| 可发布（CC-BY，须归属）       | `src/assets/game/battle/golem-oga.png`                               | `OGA-CTSKE-BATTLERS`      | `battler_golem.png`                                | `6342a6197c8501ae3c037be1d7c0134da01b0b0738185839bd50209c075a0d2d` | 使用 FFmpeg nearest-neighbor 从 160x192 缩小 50% 至 80x96，并重新编码为 PNG。                                              |
| 可发布（CC-BY，须归属）       | `src/assets/game/battle/leogan-oga.png`                              | `OGA-CTSKE-BATTLERS`      | `battler_leogan.png`                               | `6aee77c5bcebb8c467bc1b590b03ccf37f1b7ec0dc7739ee3f4e8cb4dce91fe6` | 使用 FFmpeg nearest-neighbor 从 160x96 缩小 50% 至 80x48，并重新编码为 PNG。                                               |
| 可发布（CC-BY，须归属）       | `src/assets/game/battle/lepidopteram-oga.png`                        | `OGA-CTSKE-BATTLERS`      | `battler_lepidopteram.png`                         | `3a029e7e9440f861723720fbfe183192d218c6d2c63d132e080477497d397736` | 使用 FFmpeg nearest-neighbor 从 96x128 缩小 50% 至 48x64，并重新编码为 PNG。                                               |
| 可发布（OGA-BY，须归属）      | `src/assets/game/battle/rado-ruins-ogaby.png`                        | `OGA-CRAFTPIX-BACKGROUND` | `PNG/Postapocalypce1/Pale/postapocalypse1.png`     | `b8251cdb0def0640763f666eafbe99bd492a4b9b2d9de77a2dbf37fe56ba8683` | 使用 FFmpeg nearest-neighbor 从 1920x1080 缩放至 640x360，并重新编码为 PNG。                                               |
| 可发布（CC-BY，须归属）       | `src/assets/game/battle/smudge2-oga.png`                             | `OGA-CTSKE-BATTLERS`      | `battler_smudge2.png`                              | `0c785766ea316a91cf004a0d53afab0a8daa4d7591623187879a190e71a9e6aa` | 使用 FFmpeg nearest-neighbor 从 96x64 缩小 50% 至 48x32，并重新编码为 PNG。                                                |
| 可发布（CC0）                 | `src/assets/game/battle/tank-cc0.png`                                | `OGA-MISHONIS-TANK`       | `tank.gif`                                         | `f4b3b4aa922c54f819bfa272e03f6fd92ccb160eb7f6a50c1966438e03e50141` | 使用 FFmpeg 提取 45x28 GIF 的第一帧，并重新编码为 RGBA PNG；未缩放。                                                       |
| 可发布（CC-BY，须归属）       | `src/assets/game/battle/torpion-oga.png`                             | `OGA-CTSKE-BATTLERS`      | `battler_torpion.png`                              | `ada75e1c16b352bd659b3accb028c6058382a888eaadfeead6b0fbefd3efb5f3` | 使用 FFmpeg nearest-neighbor 从 128x96 缩小 50% 至 64x48，并重新编码为 PNG。                                               |
| 可发布（CC0）                 | `src/assets/game/rado/city-cc0.png`                                  | `OGA-FISHERG-CITY`        | `TopDownCityPack/Sprites/sTiles.png`               | `3ed35ff9c5dc9254fb2d215b498f06b592863f285660ca343be3215e7899f7bf` | 原样复制并改名；与上游成员 byte-identical，已用 `cmp` 和 SHA-256 双重确认。                                                |
| 可发布（CC0，兼容副本待去重） | `src/assets/game/rado/interiors-cc0.png`                             | `OGA-CODEMANU-WASTELAND`  | `Assets/tileset8sorted.png`                        | `fc7b786b5f1c52ebb87935eb0c36b26f6ae6a4ea3cc133bbf3361f685c5c01ae` | 原样复制并改名；与上游成员及 `third-party` 规范副本 byte-identical。运行时代码已切换到规范副本，本文件只为兼容旧路径暂存。 |
| 可发布（CC0）                 | `src/assets/game/rado/rock-wall-cc0.png`                             | `OGA-CODEMANU-WASTELAND`  | `Tilesets/rockWall01.png`                          | `c85ca70a4f76099aec84bcfd4c8bf7ac2f8e94c0d01ece9a48d66ce2e47dc074` | 原样复制并改名；无像素变换，已核对 SHA-256。                                                                               |
| 可发布（CC0）                 | `src/assets/game/rado/sand-floor-cc0.png`                            | `OGA-CODEMANU-WASTELAND`  | `Tilesets/sandFloor02.png`                         | `18c54f65f6d5010ac6c29d1cda8bbd847c79b4613f4416fb253fce8c9d243390` | 原样复制并改名；无像素变换，已核对 SHA-256。                                                                               |
| 可发布（CC0）                 | `src/assets/game/rado/stone-floor-cc0.png`                           | `OGA-CODEMANU-WASTELAND`  | `Tilesets/stoneFloor01.png`                        | `d118020a2e84f46490310089c17647d3ff8244e335ff651462bd4a4dbd8b5345` | 原样复制并改名；无像素变换，已核对 SHA-256。                                                                               |
| 可发布（CC0）                 | `src/assets/game/rado/wood-wall-cc0.png`                             | `OGA-CODEMANU-WASTELAND`  | `Tilesets/woodWall01.png`                          | `034973b5c3da7a09ca58c93cc34495bd8669be9b2465cd833860fcce366e59f9` | 原样复制并改名；无像素变换，已核对 SHA-256。                                                                               |
| 可发布（CC0，规范副本）       | `src/assets/game/third-party/pixel-art-wasteland/tileset8sorted.png` | `OGA-CODEMANU-WASTELAND`  | `Assets/tileset8sorted.png`                        | `fc7b786b5f1c52ebb87935eb0c36b26f6ae6a4ea3cc133bbf3361f685c5c01ae` | 原样复制；无改名以外的变换，作为后续唯一运行时副本保留。                                                                   |
| 可发布（SIL OFL 1.1）         | `src/assets/fonts/fusion-pixel-10px-proportional-zh-hans.woff2`      | `FUSION-PIXEL-FONT`       | `fusion-pixel-10px-proportional-zh_hans.otf.woff2` | `84ed18458dcd3af930a81d9dfd85cedb73da2c414a651696b93ca49f2051c4cc` | 从官方 WOFF2 发布包提取简体中文比例宽度子集，未修改字体数据；许可证副本保存在 `docs/licenses/FUSION_PIXEL_OFL.txt`。       |

## 上游输入校验

以下哈希用于复现派生文件，并区分“上游输入未变”与“本地重新编码导致哈希变化”。

| 来源 ID                   | 上游成员                                       | SHA-256                                                            |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| `OGA-FISHERG-CITY`        | `TopDownCityPack/Sprites/sTiles.png`           | `3ed35ff9c5dc9254fb2d215b498f06b592863f285660ca343be3215e7899f7bf` |
| `OGA-CODEMANU-WASTELAND`  | `Assets/tileset8sorted.png`                    | `fc7b786b5f1c52ebb87935eb0c36b26f6ae6a4ea3cc133bbf3361f685c5c01ae` |
| `OGA-CODEMANU-WASTELAND`  | `Tilesets/rockWall01.png`                      | `c85ca70a4f76099aec84bcfd4c8bf7ac2f8e94c0d01ece9a48d66ce2e47dc074` |
| `OGA-CODEMANU-WASTELAND`  | `Tilesets/sandFloor02.png`                     | `18c54f65f6d5010ac6c29d1cda8bbd847c79b4613f4416fb253fce8c9d243390` |
| `OGA-CODEMANU-WASTELAND`  | `Tilesets/stoneFloor01.png`                    | `d118020a2e84f46490310089c17647d3ff8244e335ff651462bd4a4dbd8b5345` |
| `OGA-CODEMANU-WASTELAND`  | `Tilesets/woodWall01.png`                      | `034973b5c3da7a09ca58c93cc34495bd8669be9b2465cd833860fcce366e59f9` |
| `OGA-CRAFTPIX-BACKGROUND` | `PNG/Postapocalypce1/Pale/postapocalypse1.png` | `a86eae9fce0ac84c6db16fdcd7f161f259858c35b6fdb942aa0019b98257847c` |
| `OGA-CTSKE-BATTLERS`      | `battler_dragon.png`                           | `1487ba1f3b60c19aa1760d8580b181dc60559986c30d40dc7b57d0e17f998797` |
| `OGA-CTSKE-BATTLERS`      | `battler_drecko.png`                           | `b9a1a1c890d3e16edbd1e8fddaf7d6ad9fb5a5165968b5f3e917c7e317dadcbd` |
| `OGA-CTSKE-BATTLERS`      | `battler_golem.png`                            | `382a3c038be86ff760370924b1ae54bd1ec36b09e57ba9f142754a2477357fb5` |
| `OGA-CTSKE-BATTLERS`      | `battler_leogan.png`                           | `bb40ee793d1fca801a1a5851620f5283dce748220df03fb16fa77258fa3db129` |
| `OGA-CTSKE-BATTLERS`      | `battler_lepidopteram.png`                     | `13f4dbe1486196efba5472254ad417e3862d4b23d8f940d8d6fe611ec7543dad` |
| `OGA-CTSKE-BATTLERS`      | `battler_smudge2.png`                          | `6cde5a59754cc962601c24c1711db8b4a4235a7bb317960a8fec067d025a154d` |
| `OGA-CTSKE-BATTLERS`      | `battler_torpion.png`                          | `1ed756d0bf9506029b396e9ce5e2efd33f061ef7625a58db8fc8c4c13cc1fedc` |
| `OGA-MISHONIS-TANK`       | `tank.gif`                                     | `d7233a2e8d5393efaa357eb199fa71433f43bc44f31ccd096e287589be9bf992` |

## 保留的可编辑源文件

| 本地文件                                                             | 来源 ID                  | 上游成员                                 | SHA-256                                                            | 本地变换                                       |
| -------------------------------------------------------------------- | ------------------------ | ---------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| `art-source/third-party/pixel-art-wasteland/tileset8sorted.aseprite` | `OGA-CODEMANU-WASTELAND` | `Aseprite Files/tileset8sorted.aseprite` | `1ebacb8652b210c5652d010099e1613759b780ca971b995c35d4ad7038cfd97d` | 原样复制；作为可编辑源保留，不参与运行时构建。 |

## 发行时必须保留的归属文本

以下两段必须随包含相应素材的发行物一起提供；可放在游戏“制作人员/许可证”界面、发行包内的许可证文件，或两者同时提供。

> “Post Apocalyptic Pixel Art Backgrounds” by CraftPix.net 2D Game Assets, licensed under OGA-BY 3.0. Source: https://opengameart.org/content/post-apocalyptic-pixel-art-backgrounds. Modified by nearest-neighbor scaling and PNG re-encoding for this project.

> “Tricolor NES Static Monster Graphics” by Ctske, licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/. Source: https://opengameart.org/content/tricolor-nes-static-monster-graphics. Modified by 50% nearest-neighbor scaling and PNG re-encoding for this project.

CC0 素材不强制署名，但建议在完整制作人员名单中保留 CodeManu、FisherG 和 mishonis 的名称。FisherG 的上游包 README 另有“不把素材冒充为自己作品”的说明，本项目按作者原名记录来源。

## 已解决的来源问题

`src/assets/game/rado/city-cc0.png` 曾因缺少原包证据而被视为来源未知。2026-08-02 重新下载 FisherG 的官方 `topdowncitypack.zip` 后，确认本地文件与 `TopDownCityPack/Sprites/sTiles.png` 的 SHA-256 同为 `3ed35ff9c5dc9254fb2d215b498f06b592863f285660ca343be3215e7899f7bf`，且 `cmp` 返回一致。因此该文件已解除 `UNKNOWN / DO NOT SHIP` 阻断。
