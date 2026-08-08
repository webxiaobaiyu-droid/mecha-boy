/* ============================================================
 * 重装机兵：荒野的赏金猎人 —— 游戏数据
 * 原创致敬作 · 所有内容为原创设计
 * ============================================================ */

const DATA = (() => {

  /* ---------------- 调色板 ---------------- */
  const PAL = {
    K:'#101010', W:'#ffffff', S:'#d8d8d8', s:'#8a8a8a', N:'#3a3a3a',
    R:'#e83838', D:'#a01818', O:'#f0a030', Y:'#f8e048', G:'#50c048',
    g:'#1c7428', B:'#4070f0', b:'#1838a8', C:'#38d0d0', T:'#e0b088',
    H:'#7a5830', M:'#a87848', m:'#684020', P:'#c858d8', p:'#7c2090',
    F:'#f0a0b0', L:'#78a8e8', E:'#c0c8d8', V:'#409040', U:'#f0f8f8'
  };

  /* ---------------- 角色精灵（ASCII 像素画） ---------------- */
  const SPR = {
    hero: [
      ".....HHHH.....",
      "....HHHHHH....",
      "....HHHHHH....",
      ".....HHHH.....",
      "....TTTTTT....",
      "...TTTTTTTT...",
      "...TKTTTTKT...",
      "...TTTTTTTT...",
      "....TTTTTT....",
      ".....TTTT.....",
      "..BBB....BBB..",
      ".BBBB....BBBB.",
      ".BBBB....BBBB.",
      "..BBB....BBB..",
      "...TT....TT...",
      "...TT....TT..."
    ],
    mecha: [
      ".....FFFF.....",
      "....FFFFFF....",
      "....FFFFFF....",
      ".....FFFF.....",
      "....TTTTTT....",
      "...TTTTTTTT...",
      "...TKTTTTKT...",
      "...TTTTTTTT...",
      "....TTTTTT....",
      ".....TTTT.....",
      "..RRR....SSS..",
      ".RRRR....SSS..",
      ".RRRR...SSSS..",
      "..RRR...SSS...",
      "...MM....MM...",
      "...MM....MM..."
    ],
    wolf: [
      ".....RRRR.....",
      "....RRRRRR....",
      "....RRRRRR....",
      ".....RRRR.....",
      "....TTTTTT....",
      "...TTTTTTTT...",
      "...TKTTTTKT...",
      "...TTTTTTTT...",
      "....TTTTTT....",
      "..KK..TT..KK..",
      ".RRRR..RRRRR..",
      ".RRRRR.RRRRR..",
      ".RRRR..RRRRR..",
      "..RR....RRR...",
      "..NN....NN....",
      ".NNN....NNN..."
    ],
    father: [
      ".....HHHH.....",
      "....HHHHHH....",
      "....HHHHHH....",
      ".....HHHH.....",
      "....TTTTTT....",
      "...TTTTTTTT...",
      "...TKTTTTKT...",
      "...TTTTTTTT...",
      "....TTTTTT....",
      "....TTTTTT....",
      "..VVV....VVV..",
      ".VVVV....VVVV.",
      ".VVVV....VVVV.",
      "..VVV....VVV..",
      "...m......m...",
      "..mmm....mmm.."
    ],
    npc_m: [
      ".....mmmm.....",
      "....mmmmmm....",
      "....mmmmmm....",
      ".....mmmm.....",
      "....TTTTTT....",
      "...TTTTTTTT...",
      "...TKTTTTKT...",
      "...TTTTTTTT...",
      "....TTTTTT....",
      "....TTTTTT....",
      "..ssss..ssss..",
      ".sssss..sssss.",
      ".sssss..sssss.",
      "..sss....sss..",
      "...TT....TT...",
      "...TT....TT..."
    ],
    npc_w: [
      ".....YYYY.....",
      "....YYYYYY....",
      "....YYYYYY....",
      ".....YYYY.....",
      "....TTTTTT....",
      "...TTTTTTTT...",
      "...TKTTTTKT...",
      "...TTTTTTTT...",
      "....TTTTTT....",
      ".....TTTT.....",
      "..FF.F....FFF.",
      ".FFFF.....FFFF",
      ".FFFF.....FFFF",
      "..FF.F....FFF.",
      "...TT....TT...",
      "...TT....TT..."
    ],
    npc_old: [
      ".....SSSS.....",
      "....SSSSSS....",
      "....SSSSSS....",
      ".....SSSS.....",
      "....TTTTTT....",
      "...TTTTTTTT...",
      "...TKTTTTKT...",
      "...TTTTTTTT...",
      "....TTTTTT....",
      "....TTTTTT....",
      "..MMMM....MM..",
      ".MMMMM...MMM..",
      ".MMMMM...MMM..",
      "..MMM....MM...",
      "...MM....MM...",
      "..MMM....MMM.."
    ],
    kid: [
      ".....HHHH.....",
      "....HHHHHH....",
      "....HHHHHH....",
      ".....HHHH.....",
      "....TTTTTT....",
      "...TTTTTTTT...",
      "...TKTTTTKT...",
      "...TTTTTTTT...",
      "....TTTTTT....",
      ".....TTTT.....",
      "..GG......GG..",
      ".GGGG....GGGG.",
      ".GGGG....GGGG.",
      "..GG......GG..",
      "...T......T...",
      "..TT......TT.."
    ],
    soldier: [
      ".....VVVV.....",
      "....VVVVVV....",
      "....VVVVVV....",
      ".....VVVV.....",
      "....TTTTTT....",
      "...TTTTTTTT...",
      "...TKTTTTKT...",
      "...TTTTTTTT...",
      "....TTTTTT....",
      "...SSSSSSSS...",
      "..SSS....SSS..",
      ".SSSS....SSSS.",
      ".SSSS....SSSS.",
      "..SSS....SSS..",
      "...SS....SS...",
      "..SSS....SSS.."
    ]
  };

  /* ---------------- 敌人造型模板 ---------------- */
  /* X=主色 Y=次色 K=轮廓 W=高光 */
  const ETPL = {
    blob: [
      ".....XXXX.....",
      "...XXXXXXXX...",
      "..XXXXXXXXXX..",
      ".XXXXWXXWXXXX.",
      ".XXKWWXXWWKXX.",
      ".XXXXXXXXXXXX.",
      ".XXXXXXXXXXXX.",
      "..XXXXXXXXXX..",
      "..XXXKXXXKXX..",
      "...XXXXXXXX...",
      "....XXXXXX...."
    ],
    bug: [
      "..........XX..",
      "........XXXX..",
      "...XX..XXXXXX.",
      "..XXXX.XXWXX..",
      ".XXXXXXXWXXX..",
      ".XXXXXX.XXXX..",
      "..XXXX...XX...",
      "...XX....XX...",
      "..XX.....XX...",
      ".XX......XX...",
      "..............",
      ".XX.....XX....",
      "..XX...XX.....",
      "....XXX......."
    ],
    beast: [
      "....XXXXXXXXX.",
      "..XXXXYYYYXXX.",
      ".XXXYYKKKYYYY.",
      ".XXYYKWWKYYYY.",
      ".XXXYYKKKYYYY.",
      "..XXXXYYYYXXX.",
      "....XXXXXXX...",
      "...XXX..XXX...",
      "..XXXX..XXXX..",
      ".XXXX....XXXX.",
      "..XX......XX..",
      "..XX......XX.."
    ],
    bird: [
      ".......XXXX...",
      "......XXXXXX..",
      "..XX..XXWXXXX.",
      ".XXXX.XXWXXXX.",
      ".XXXXX.XXXXXX.",
      "..XXXXXXXXXX..",
      "...XXXXXXXX...",
      "....XXXXXX....",
      "...XX..XX.....",
      "..XX....XX....",
      "............XX",
      "..........XXXX",
      "............XX"
    ],
    bot: [
      "..XXXXXXXXXX..",
      ".XXYYYYYYYYXX.",
      ".XYKYYYYYYKYX.",
      ".XYYYYYYYYYYX.",
      ".XYKWYYYYWKYX.",
      ".XYYYYYYYYYYX.",
      ".XXYYYYYYYYXX.",
      ".XXXXXXXXXXXX.",
      ".XX........XX.",
      ".XX..XX..XX..X",
      ".XX..XX..XX..X",
      "....XX..XX...."
    ],
    tankbot: [
      ".......XXXXXXXX",
      ".....XXXXXXXXXX",
      "....XXYYYYYYYYX",
      "...XXXYYYYYYYYX",
      "..XXXXXXXXXXXXX",
      ".XXXXXXXXXXXXXX",
      ".YYYYYYYYYYYYY.",
      ".YYYYYYYYYYYYY.",
      "OOOOO.OOOOO.OOO",
      "O...O.O...O.O.O",
      "O.O.O.O.O.O.O.O"
    ],
    human: [
      ".....HHHH.....",
      "....HHHHHH....",
      "....HHHHHH....",
      ".....HHHH.....",
      "....TTTTTT....",
      "...TTTTTTTT...",
      "...TKTTTTKT...",
      "...TTTTTTTT...",
      "....TTTTTT....",
      "...XXXXXXXX...",
      "..XX......XX..",
      ".XXXX....XXXX.",
      ".XXXX....XXXX.",
      "..XX......XX..",
      "...XX....XX...",
      "..XXXX..XXXX.."
    ],
    soldier: [
      ".....YYYY.....",
      "....YYYYYY....",
      "...YYYYYYYY...",
      "...YKYYYYKY...",
      "....YYYYYY....",
      "....TTTTTT....",
      "...TTTTTTTT...",
      "...TKTTTTKT...",
      "...TTTTTTTT...",
      "....TTTTTT....",
      "...XXXXXXXX...",
      "..XX......XX..",
      ".XXXX....XXXX.",
      ".XXXX....XXXX.",
      "..XX......XX..",
      "...XX....XX..."
    ],
    worm: [
      "XX.............",
      "XXXXX........XX",
      "XXXXXXX....XXXX",
      ".XXXXXXX..XXXXX",
      ".XXKXXXX.XXXXX.",
      "..XXKXXXXXXXX..",
      "...XXKXXXXXXX..",
      "....XXKXXXXXX..",
      ".....XXKXXXXX..",
      "......XXXXXXXX.",
      ".......XXXXXX..",
      "........XXXX..."
    ],
    plant: [
      ".....YYYY.....",
      "....YYYYYY....",
      "...YYYYYYYY...",
      "..YYYYYYYYYY..",
      "..YXXYYYYXXY..",
      "..YXXYYYYXXY..",
      "..YYYYYYYYYY..",
      "...YYYYYYYY...",
      "..XX......XX..",
      ".XXXX....XXXX.",
      "..XX......XX.."
    ],
    dragon: [
      ".....XXXXXXXXX.",
      "...XXXXXXXXXXXX",
      "..XXYYYYYYYYYXX",
      ".XXYKWWYYWWKYYX",
      ".XXYKKYYYKKYYYX",
      "..XXXXXXXXXXXXX",
      "...XXXKXXXXXX..",
      "....XXKXXXXX...",
      "...XXXKXXXX....",
      "..XXXXKXXXX....",
      "..XX.KXX.KX....",
      "....XX...XX...."
    ],
    noa: [
      ".XXXXXXXXXXXXXXXXXX.",
      "XXYYYYYYYYYYYYYYYYXX",
      "XYWWYYYYYYYYYYYYWYXX",
      "XYWWYYYYYYYYYYYYWYXX",
      "XYYYYYYYXXYYYYYYYYXX",
      "XYYYYYYYYXYYYYYYYYXX",
      "XXYYYYYYYYYYYYYYYYXX",
      "XXKKKKKKKKKKKKKKKKXX",
      ".XXXXXXXXXXXXXXXXXX.",
      ".XX................XX",
      ".XX..XX........XX..XX",
      ".XXXXXX........XXXXXX",
      "..XXXX..........XXXX."
    ]
  };

  /* ---------------- 战车造型模板（ASCII，32x20） ---------------- */
  const TTPL = {
    tank: [
      "............................",
      ".................XXXXXXXXX.",
      "...............XXXXXXXXXXXX",
      "..............XXYYYYYYYYYXX",
      ".............XXYYYYYYYYYYYX",
      ".............XYYWWYYYYWWYYX",
      "............XXYYYYYYYYYYYYX",
      "............XXXXXXXXXXXXXXX",
      ".........SSSSSSSSSSSSSSSSSS",
      ".......SSSSSSSSSSSSSSSSSSSS",
      "......NNNNNNNNNNNNNNNNNNNNN",
      "....NNNNNNNNNNNNNNNNNNNNNNN",
      "...OOOOOO.OOOOOO.OOOOOO.OOO",
      "..OO...OO.OO...OO.OO...OO.O",
      "..O.....O..O.....O..O.....O"
    ],
    jeep: [
      "............................",
      "..............XXXXXXXXXXX..",
      ".............XXXXXXXXXXXX..",
      "............XXYYYYYYYYYYX..",
      "............XYYWWYYYYWWYX..",
      "............XXYYYYYYYYYYX..",
      ".............XXXXXXXXXXXX..",
      ".............XXXXXXXXXXX...",
      ".............XX........XX..",
      "......SSSSSSSXX........XX..",
      ".....SSSSSSSSX..........XX.",
      "....NNNNNNNNNN...........XX",
      "...OOOOOO.OOOOOO.OOOOOO...",
      "...O....O.O....O.O....O...",
      "...........O.....O........"
    ],
    van: [
      "............................",
      ".................XXXXXXXXX.",
      "...............XXXXXXXXXXXX",
      "..............XXYYYYYYYYYYX",
      "..............XYWYYYYYYWYX.",
      "..............XYWWYYYYWWYX.",
      "..............XXYYYYYYYYYX.",
      "..............XXXXXXXXXXXX.",
      ".........SSSSSSSSSSSSSSSSS.",
      ".......SSSSSSSSSSSSSSSSSSS.",
      "......NNNNNNNNNNNNNNNNNNNN.",
      "....NNNNNNNNNNNNNNNNNNNNNN.",
      "...OOOOOO.OOOOOO.OOOOOO....",
      "...O....O.O....O.O....O....",
      ".........O.....O.........."
    ],
    heavy: [
      "..............................",
      "................XXXXXXXXXXX.",
      "..............XXXXXXXXXXXXXX",
      ".............XXYYYYYYYYYYYYX",
      ".............XYYWWYYYYYYWWYX",
      "............XXYYYYYYYYYYYYYX",
      "............XXYYYYYYYYYYYYYX",
      ".............XXXXXXXXXXXXXXX",
      ".........SSSSSSSSSSSSSSSSSS.",
      ".......SSSSSSSSSSSSSSSSSSSS.",
      "......NNNNNNNNNNNNNNNNNNNNN.",
      "....NNNNNNNNNNNNNNNNNNNNNNN.",
      "...OOOOOO.OOOOOO.OOOOOO.OOO.",
      "...O....O.O....O.O....O.O...",
      "................O.........."
    ],
    super: [
      "..............................",
      ".............XXXXXXXXXXXXXXX.",
      "...........XXXXXXXXXXXXXXXXX",
      "..........XXYYYYYYYYYYYYYYYYX",
      "..........XYYWWYYYYYYYYWWYYXX",
      "..........XYYWWYYYYYYYYWWYYXX",
      ".........XXYYYYYYYYYYYYYYYYXX",
      ".........XXXXXXXXXXXXXXXXXXX.",
      "......SSSSSSSSSSSSSSSSSSSSS..",
      "....SSSSSSSSSSSSSSSSSSSSSSS..",
      "...NNNNNNNNNNNNNNNNNNNNNNNN..",
      "..NNNNNNNNNNNNNNNNNNNNNNNNN..",
      ".OOOOOO.OOOOOO.OOOOOO.OOOOOO.",
      ".O....O.O....O.O....O.O....O.",
      "................O............"
    ]
  };

  /* ---------------- 地形配色 ---------------- */
  const TILE = {
    ' ': {c:'#000000', w:true},
    '.': {c:'#3a8a30', w:true},
    ',': {c:'#327a28', w:true},
    'r': {c:'#a08050', w:true},
    'f': {c:'#1e5c22', w:true, enc:1.6},
    'm': {c:'#5a5a66', w:false},
    'w': {c:'#2850b8', w:false},
    's': {c:'#c8b878', w:true, enc:1.4},
    't': {c:'#8a8a8a', w:true},
    'D': {c:'#a0a0a0', w:true},
    'C': {c:'#2a2a30', w:true},
    'H': {c:'#6a5a3a', w:true},
    'N': {c:'#40404a', w:true},
    'I': {c:'#ffd700', w:true}
  };

  /* ---------------- 世界地图生成 ---------------- */
  const WORLD_W = 80, WORLD_H = 64;

  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildWorld() {
    const rnd = mulberry32(20260802);
    const g = Array.from({length: WORLD_H}, () => Array(WORLD_W).fill('.'));
    // 东部海洋
    for (let y = 8; y < 52; y++) for (let x = 72; x < WORLD_W; x++) g[y][x] = 'w';
    // 波布镇南大湖
    for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
      const dx = x - 68, dy = y - 36;
      if (dx*dx/49 + dy*dy/36 <= 1 && g[y][x] === '.') g[y][x] = 'w';
    }
    // 西北大沙漠
    for (let y = 2; y < 24; y++) for (let x = 2; x < 28; x++) {
      if (g[y][x] === '.') g[y][x] = 's';
    }
    // 山地：几团噪声
    const mts = [[8,30,9],[50,2,8],[18,54,8],[30,44,5],[64,46,6],[10,14,6]];
    for (const [cx,cy,rad] of mts) {
      for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
        const d = Math.hypot(x-cx, y-cy);
        if (d < rad && rnd() < 0.75) g[y][x] = 'm';
      }
    }
    // 森林
    const frs = [[34,33,5],[58,37,5],[22,18,5],[60,14,4],[42,42,4]];
    for (const [cx,cy,rad] of frs) {
      for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
        const d = Math.hypot(x-cx, y-cy);
        if (d < rad && rnd() < 0.7) g[y][x] = 'f';
      }
    }
    // 城镇（3x3 区域，中心门）
    const towns = {
      rado:   [25, 42], masaru: [25, 30], pobb: [60, 28],
      rock:   [31, 22], odo:    [40, 17], sold: [47, 12],
      tarr:   [35, 9],  eden:   [56, 10]
    };
    for (const key in towns) {
      const [tx, ty] = towns[key];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        g[ty+dy][tx+dx] = 't';
      }
      g[ty][tx] = 'D';
    }
    // 特殊点
    g[46][26] = 'C';  // 拉多南洞
    g[27][71] = 'C';  // 波布东兵工厂
    g[24][33] = 'C';  // 罗克诊所地下室
    g[16][64] = 'C';  // 伊甸东帕鲁洞
    g[4][52]  = 'H';  // 地狱门
    g[2][52]  = 'N';  // 诺亚大楼
    // 道路
    const road = (x0,y0,x1,y1) => {
      let [x,y] = [x0,y0];
      while (x !== x1 || y !== y1) {
        if (x !== x1 && (y === y1 || Math.abs(x-x1) >= Math.abs(y-y1))) x += x1>x0?1:-1;
        else y += y1>y0?1:-1;
        if (g[y][x] === '.' || g[y][x] === ',' || g[y][x] === 's') g[y][x] = 'r';
      }
    };
    road(25,42,25,30); road(25,30,60,28); road(60,28,60,24);
    road(31,22,40,17); road(40,17,47,12); road(47,12,35,9);
    road(35,9,52,4); road(47,12,56,10); road(56,10,52,4);
    road(31,22,31,26); road(25,30,31,26); road(15,12,15,20); road(15,20,25,20);
    road(25,20,40,17); road(64,16,64,14); road(56,10,64,14);
    // 横向河流（先铺路后挖河，道路穿过处即桥）
    for (let y = 19; y <= 20; y++) for (let x = 0; x < WORLD_W; x++) {
      const ch = g[y][x];
      if (ch === 'r' || ch === 't' || ch === 'D' || ch === 'm') continue;
      g[y][x] = 'w';
    }
    // 一些小草地差异
    for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
      if (g[y][x] === '.' && rnd() < 0.18) g[y][x] = ',';
    }
    // 保证特殊点可走（去除被山覆盖的点）
    const guards = [[46,26],[27,71],[24,33],[16,64],[4,52],[2,52],[25,42],[25,30],[60,28],[31,22],[40,17],[47,12],[35,9],[56,10]];
    for (const [y,x] of guards) g[y][x] = (g[y][x]==='w') ? 'r' : (g[y][x]==='C'||g[y][x]==='H'||g[y][x]==='N') ? g[y][x] : g[y][x];
    return g.map(row => row.join(''));
  }

  const WORLD = buildWorld();

  /* ---------------- 城镇 ---------------- */
  const TOWNS = [
    {
      id:'rado', name:'拉多镇', door:[25,42], size:[22,15],
      npcs:[
        {x:10, y:4, sp:'father', name:'父亲·老战', talk:'story_rado_father'},
        {x:10, y:7, sp:'npc_old', name:'老人', talk:'rado_old'},
        {x:5, y:7, sp:'npc_w', name:'妇人', talk:'rado_woman'},
        {x:19, y:7, sp:'kid', name:'小孩', talk:'rado_kid'},
        {x:12, y:12, sp:'npc_m', name:'镇民', talk:'rado_man'},
        {x:20, y:12, sp:'npc_w', name:'镇民', talk:'rado_woman2'}
      ],
      buildings:[
        {x:2, y:2, w:6, h:4, type:'weapon', name:'武器店', door:[4,6]},
        {x:14, y:2, w:6, h:4, type:'tankshop', name:'战车店', door:[16,6]},
        {x:2, y:9, w:6, h:4, type:'inn', name:'宿屋', door:[4,9]},
        {x:14, y:9, w:6, h:4, type:'bounty', name:'情报屋', door:[16,9]}
      ]
    },
    {
      id:'masaru', name:'麦镇', door:[25,30], size:[22,15],
      npcs:[
        {x:10, y:4, sp:'npc_w', name:'机械师·美娜', talk:'story_masaru_mecha'},
        {x:10, y:7, sp:'npc_old', name:'老人', talk:'masaru_old'},
        {x:5, y:7, sp:'npc_m', name:'农夫', talk:'masaru_farmer'},
        {x:12, y:12, sp:'npc_w', name:'妇人', talk:'masaru_woman'},
        {x:19, y:7, sp:'kid', name:'小孩', talk:'masaru_kid'}
      ],
      buildings:[
        {x:2, y:2, w:6, h:4, type:'weapon', name:'武器店', door:[4,6]},
        {x:14, y:2, w:6, h:4, type:'tankshop', name:'战车店', door:[16,6]},
        {x:2, y:9, w:6, h:4, type:'inn', name:'宿屋', door:[4,9]},
        {x:14, y:9, w:6, h:4, type:'bounty', name:'情报屋', door:[16,9]}
      ]
    },
    {
      id:'pobb', name:'波布镇', door:[60,28], size:[22,15],
      npcs:[
        {x:10, y:4, sp:'wolf', name:'红狼', talk:'story_pobb_wolf'},
        {x:10, y:7, sp:'npc_old', name:'老猎人', talk:'pobb_hunter'},
        {x:5, y:7, sp:'npc_m', name:'渔夫', talk:'pobb_fisher'},
        {x:12, y:12, sp:'npc_w', name:'妇人', talk:'pobb_woman'},
        {x:19, y:7, sp:'kid', name:'小孩', talk:'pobb_kid'}
      ],
      buildings:[
        {x:2, y:2, w:6, h:4, type:'weapon', name:'武器店', door:[4,6]},
        {x:14, y:2, w:6, h:4, type:'tankshop', name:'战车店', door:[16,6]},
        {x:2, y:9, w:6, h:4, type:'inn', name:'宿屋', door:[4,9]},
        {x:14, y:9, w:6, h:4, type:'bounty', name:'情报屋', door:[16,9]}
      ]
    },
    {
      id:'rock', name:'罗克镇', door:[31,22], size:[22,15],
      npcs:[
        {x:10, y:4, sp:'npc_m', name:'医生', talk:'rock_doctor'},
        {x:10, y:7, sp:'npc_w', name:'护士', talk:'rock_nurse'},
        {x:5, y:7, sp:'npc_old', name:'老人', talk:'rock_old'},
        {x:18, y:7, sp:'npc_m', name:'镇民', talk:'rock_man'},
        {x:19, y:7, sp:'kid', name:'小孩', talk:'rock_kid'}
      ],
      buildings:[
        {x:2, y:2, w:6, h:4, type:'weapon', name:'武器店', door:[4,6]},
        {x:14, y:2, w:6, h:4, type:'tankshop', name:'战车店', door:[16,6]},
        {x:2, y:9, w:6, h:4, type:'inn', name:'宿屋', door:[4,9]},
        {x:14, y:9, w:6, h:4, type:'bounty', name:'情报屋', door:[16,9]},
        {x:8, y:9, w:5, h:4, type:'story', name:'无敌医院', door:[10,9], story:'rock_hospital'}
      ]
    },
    {
      id:'odo', name:'奥多镇', door:[40,17], size:[22,15],
      npcs:[
        {x:10, y:4, sp:'npc_old', name:'改造师', talk:'odo_modder'},
        {x:10, y:7, sp:'npc_m', name:'商人', talk:'odo_merchant'},
        {x:5, y:7, sp:'npc_w', name:'妇人', talk:'odo_woman'},
        {x:12, y:12, sp:'npc_m', name:'猎人', talk:'odo_hunter'},
        {x:19, y:7, sp:'kid', name:'小孩', talk:'odo_kid'}
      ],
      buildings:[
        {x:2, y:2, w:6, h:4, type:'weapon', name:'武器店', door:[4,6]},
        {x:14, y:2, w:6, h:4, type:'tankshop', name:'战车店', door:[16,6]},
        {x:2, y:9, w:6, h:4, type:'modshop', name:'改造工房', door:[4,9]},
        {x:14, y:9, w:6, h:4, type:'bounty', name:'情报屋', door:[16,9]}
      ]
    },
    {
      id:'sold', name:'索鲁镇', door:[47,12], size:[22,15],
      npcs:[
        {x:10, y:4, sp:'npc_old', name:'老人', talk:'sold_old'},
        {x:10, y:7, sp:'npc_m', name:'退役兵', talk:'sold_soldier'},
        {x:5, y:7, sp:'npc_w', name:'妇人', talk:'sold_woman'},
        {x:12, y:12, sp:'npc_m', name:'情报贩子', talk:'sold_info'},
        {x:19, y:7, sp:'kid', name:'小孩', talk:'sold_kid'}
      ],
      buildings:[
        {x:2, y:2, w:6, h:4, type:'weapon', name:'武器店', door:[4,6]},
        {x:14, y:2, w:6, h:4, type:'tankshop', name:'战车店', door:[16,6]},
        {x:2, y:9, w:6, h:4, type:'modshop', name:'改造工房', door:[4,9]},
        {x:14, y:9, w:6, h:4, type:'bounty', name:'情报屋', door:[16,9]}
      ]
    },
    {
      id:'tarr', name:'塔镇', door:[35,9], size:[22,15],
      npcs:[
        {x:10, y:4, sp:'npc_old', name:'老人', talk:'tarr_old'},
        {x:10, y:7, sp:'npc_m', name:'镇民', talk:'tarr_man'},
        {x:5, y:7, sp:'npc_w', name:'妇人', talk:'tarr_woman'},
        {x:18, y:7, sp:'kid', name:'小孩', talk:'tarr_kid'},
        {x:20, y:7, sp:'npc_m', name:'猎人', talk:'tarr_hunter'}
      ],
      buildings:[
        {x:2, y:2, w:6, h:4, type:'weapon', name:'武器店', door:[4,6]},
        {x:14, y:2, w:6, h:4, type:'tankshop', name:'战车店', door:[16,6]},
        {x:2, y:9, w:6, h:4, type:'modshop', name:'改造工房', door:[4,9]},
        {x:14, y:9, w:6, h:4, type:'bounty', name:'情报屋', door:[16,9]},
        {x:8, y:9, w:5, h:4, type:'story', name:'戈麦斯藏身处', door:[10,9], story:'tarr_gomez'}
      ]
    },
    {
      id:'eden', name:'伊甸镇', door:[56,10], size:[22,15],
      npcs:[
        {x:10, y:4, sp:'npc_old', name:'长者', talk:'eden_elder'},
        {x:10, y:7, sp:'npc_m', name:'猎人', talk:'eden_hunter'},
        {x:5, y:7, sp:'npc_w', name:'妇人', talk:'eden_woman'},
        {x:12, y:12, sp:'npc_m', name:'镇民', talk:'eden_man'},
        {x:19, y:7, sp:'kid', name:'小孩', talk:'eden_kid'}
      ],
      buildings:[
        {x:2, y:2, w:6, h:4, type:'weapon', name:'武器店', door:[4,6]},
        {x:14, y:2, w:6, h:4, type:'tankshop', name:'战车店', door:[16,6]},
        {x:2, y:9, w:6, h:4, type:'modshop', name:'改造工房', door:[4,9]},
        {x:14, y:9, w:6, h:4, type:'bounty', name:'情报屋', door:[16,9]}
      ]
    }
  ];

  /* ---------------- 洞窟/迷宫 ---------------- */
  const CAVES = [
    {
      id:'cave1', name:'拉多镇南侧洞窟', size:[26,17], region:'rado',
      rooms:[{x:2,y:2,w:8,h:5},{x:12,y:2,w:10,h:6},{x:4,y:9,w:9,h:6},{x:15,y:10,w:8,h:5}],
      chests:[{x:6,y:5,item:'med'},{x:17,y:4,item:'bomb'}],
      events:[{x:19,y:12,type:'tank',tankId:'t1'}],
      exits:[{x:2,y:12,world:[26,46]}]
    },
    {
      id:'factory', name:'海边兵工厂', size:[26,17], region:'pobb',
      rooms:[{x:2,y:2,w:9,h:6},{x:13,y:2,w:10,h:5},{x:3,y:10,w:10,h:5},{x:15,y:9,w:9,h:6}],
      chests:[{x:6,y:4,item:'med2'},{x:18,y:3,item:'repair'},{x:20,y:12,item:'med2'}],
      events:[{x:5,y:12,type:'guard',mob:'tankbot',count:2},{x:18,y:12,type:'tank',tankId:'t2'}],
      exits:[{x:2,y:2,world:[27,71]}]
    },
    {
      id:'clinic', name:'诊所地下室', size:[22,15], region:'rock',
      rooms:[{x:2,y:2,w:8,h:5},{x:12,y:2,w:8,h:5},{x:5,y:8,w:12,h:5}],
      chests:[{x:4,y:4,item:'med2'},{x:15,y:9,item:'repair'}],
      events:[{x:12,y:10,type:'tank',tankId:'t3'}],
      exits:[{x:2,y:2,world:[24,33]}]
    },
    {
      id:'puru_cave', name:'伊甸镇东洞窟', size:[28,18], region:'eden',
      rooms:[{x:2,y:2,w:9,h:6},{x:13,y:2,w:11,h:5},{x:4,y:10,w:10,h:6},{x:16,y:10,w:10,h:6}],
      chests:[{x:7,y:4,item:'med3'},{x:20,y:3,item:'repair'},{x:10,y:13,item:'med3'}],
      events:[{x:22,y:13,type:'boss',bountyId:'puru'}],
      exits:[{x:2,y:2,world:[16,64]}]
    },
    {
      id:'noa1', name:'诺亚大楼·一层', size:[26,17], region:'noa',
      rooms:[{x:2,y:2,w:9,h:5},{x:13,y:2,w:10,h:5},{x:4,y:9,w:9,h:5},{x:15,y:9,w:9,h:5}],
      chests:[{x:6,y:4,item:'med3'},{x:18,y:3,item:'repair'}],
      events:[{x:19,y:11,type:'boss',bountyId:'noa_guard',text:'防御机器人挡住了去路！'}],
      exits:[{x:2,y:2,world:[2,52]},{x:2,y:9,next:'noa2'}]
    },
    {
      id:'noa2', name:'诺亚大楼·二层', size:[26,17], region:'noa',
      rooms:[{x:2,y:2,w:10,h:6},{x:14,y:2,w:9,h:6},{x:5,y:10,w:9,h:5},{x:16,y:10,w:8,h:5}],
      chests:[{x:6,y:5,item:'med3'},{x:17,y:4,item:'repair'},{x:9,y:12,item:'bomb'}],
      events:[{x:20,y:12,type:'boss',bountyId:'noa_laser',text:'激光系统启动！'}],
      exits:[{x:2,y:2,prev:'noa1'},{x:2,y:9,next:'noa3'}]
    },
    {
      id:'noa3', name:'诺亚大楼·三层', size:[26,17], region:'noa',
      rooms:[{x:2,y:2,w:10,h:6},{x:14,y:2,w:10,h:6},{x:6,y:10,w:14,h:5}],
      chests:[{x:7,y:4,item:'med3'},{x:19,y:3,item:'gun220'}],
      events:[{x:13,y:12,type:'boss',bountyId:'noa',text:'主电脑室……诺亚就在那里！'}],
      exits:[{x:2,y:2,prev:'noa2'}]
    }
  ];

  /* ---------------- 普通怪物 ---------------- */
  const MONSTERS = {
    rat:     {name:'变异鼠',  tpl:'beast',  c:{X:'#8a8a8a',Y:'#5a5a5a'}, hp:45,  atk:22, def:6,  spd:9,  xp:18,  g:15},
    ant:     {name:'杀人蚁',  tpl:'bug',    c:{X:'#a04030',Y:'#5a1c14'}, hp:60,  atk:28, def:8,  spd:8,  xp:24,  g:20},
    dog:     {name:'野狗',    tpl:'beast',  c:{X:'#a87848',Y:'#684020'}, hp:70,  atk:32, def:10, spd:12, xp:30,  g:24},
    bug:     {name:'大角虫',  tpl:'bug',    c:{X:'#40a040',Y:'#1e5c22'}, hp:95,  atk:42, def:14, spd:7,  xp:45,  g:35},
    thief:   {name:'荒野强盗',tpl:'human',  c:{X:'#685028',Y:'#3a2c14'}, hp:110, atk:48, def:16, spd:10, xp:55,  g:60},
    scorp:   {name:'变异蝎',  tpl:'bug',    c:{X:'#b06020',Y:'#7a3c10'}, hp:130, atk:55, def:20, spd:9,  xp:65,  g:45},
    giant_ant:{name:'巨蚁',   tpl:'bug',    c:{X:'#d04830',Y:'#701c10'}, hp:170, atk:65, def:24, spd:9,  xp:90,  g:70},
    spider:  {name:'毒蜘蛛',  tpl:'bug',    c:{X:'#903090',Y:'#4c1450'}, hp:150, atk:60, def:22, spd:11, xp:80,  g:60},
    leech:   {name:'巨水蛭',  tpl:'worm',   c:{X:'#40a8a8',Y:'#1e5c64'}, hp:200, atk:72, def:26, spd:7,  xp:105, g:80},
    beast:   {name:'变异兽',  tpl:'beast',  c:{X:'#805030',Y:'#4c2c18'}, hp:260, atk:85, def:30, spd:10, xp:140, g:110},
    thief2:  {name:'盗贼团',  tpl:'human',  c:{X:'#3868b8',Y:'#20386c'}, hp:240, atk:80, def:28, spd:12, xp:130, g:160},
    ironbug: {name:'铁甲虫',  tpl:'bug',    c:{X:'#707080',Y:'#3a3a48'}, hp:300, atk:95, def:38, spd:8,  xp:170, g:120},
    robot:   {name:'旧世机械兵',tpl:'bot',  c:{X:'#8a8a98',Y:'#4a4a58'}, hp:380, atk:110, def:42, spd:8,  xp:220, g:180},
    turret:  {name:'自动炮台', tpl:'tankbot',c:{X:'#688848',Y:'#385028'}, hp:320, atk:105, def:45, spd:6,  xp:200, g:150},
    mutwolf: {name:'变异狼',  tpl:'beast',  c:{X:'#4040a0',Y:'#24245c'}, hp:420, atk:125, def:44, spd:13, xp:260, g:200},
    mech_soldier:{name:'机械兵',tpl:'soldier',c:{X:'#8a8a8a',Y:'#4a4a4a'}, hp:520, atk:140, def:52, spd:10, xp:340, g:300},
    cyborg:  {name:'改造人',  tpl:'human',  c:{X:'#c05830',Y:'#682414'}, hp:560, atk:150, def:55, spd:12, xp:380, g:320},
    tankbot: {name:'侦察战车',tpl:'tankbot',c:{X:'#6a8a4a',Y:'#3c5a28'}, hp:640, atk:160, def:60, spd:8,  xp:430, g:380},
    killer:  {name:'猎杀者',  tpl:'bot',    c:{X:'#a82828',Y:'#541414'}, hp:760, atk:185, def:68, spd:14, xp:520, g:450},
    armor:   {name:'重甲兵',  tpl:'soldier',c:{X:'#585868',Y:'#30303c'}, hp:840, atk:195, def:75, spd:9,  xp:580, g:500},
    giant:   {name:'变异巨人',tpl:'human',  c:{X:'#a07840',Y:'#5c4420'}, hp:950, atk:210, def:80, spd:7,  xp:660, g:550},
    biobeast:{name:'生化兽',  tpl:'beast',  c:{X:'#a03088',Y:'#541448'}, hp:1100,atk:235, def:88, spd:11, xp:800, g:700},
    dragon:  {name:'机械飞龙',tpl:'dragon', c:{X:'#d02828',Y:'#701414'}, hp:1250,atk:255, def:95, spd:13, xp:900, g:800},
    assault: {name:'突击兵',  tpl:'soldier',c:{X:'#3c6a40',Y:'#1e3820'}, hp:1180,atk:245, def:90, spd:12, xp:850, g:750},
    sandworm:{name:'沙虫',    tpl:'worm',   c:{X:'#c8a860',Y:'#7a5c28'}, hp:1400,atk:275, def:100,spd:8,  xp:1100,g:950},
    vulture: {name:'秃鹫群',  tpl:'bird',   c:{X:'#686868',Y:'#383838'}, hp:1050,atk:230, def:82, spd:15, xp:780, g:700},
    bandit:  {name:'沙漠暴徒',tpl:'human',  c:{X:'#c8a860',Y:'#7a5c28'}, hp:1300,atk:260, def:96, spd:11, xp:1000,g:1200},
    guard_bot:{name:'防御机器人',tpl:'bot', c:{X:'#3868c8',Y:'#1c3870'}, hp:1700,atk:300, def:115,spd:9,  xp:1500,g:1200},
    laser:   {name:'激光炮台',tpl:'tankbot',c:{X:'#c83838',Y:'#701c1c'}, hp:1500,atk:290, def:110,spd:10, xp:1300,g:1000},
    noa_guard:{name:'诺亚卫兵',tpl:'bot',   c:{X:'#8a38c8',Y:'#481c70'}, hp:1900,atk:320, def:125,spd:10, xp:1800,g:1400}
  };

  /* ---------------- 区域遇敌表 ---------------- */
  const REGIONS = [
    {id:'rado',   x0:15, y0:34, x1:48, y1:55, mobs:['rat','ant','dog','rat','ant']},
    {id:'pobb',   x0:45, y0:22, x1:79, y1:36, mobs:['giant_ant','spider','leech','giant_ant']},
    {id:'masaru', x0:15, y0:24, x1:44, y1:38, mobs:['bug','thief','scorp','bug']},
    {id:'rock',   x0:24, y0:15, x1:45, y1:30, mobs:['beast','thief2','ironbug']},
    {id:'odo',    x0:36, y0:13, x1:58, y1:30, mobs:['robot','turret','mutwolf','robot']},
    {id:'sold',   x0:40, y0:7,  x1:60, y1:21, mobs:['mech_soldier','cyborg','tankbot']},
    {id:'tarr',   x0:27, y0:5,  x1:49, y1:18, mobs:['killer','armor','giant']},
    {id:'eden',   x0:50, y0:5,  x1:79, y1:19, mobs:['biobeast','dragon','assault','biobeast']},
    {id:'desert', x0:2,  y0:2,  x1:29, y1:24, mobs:['sandworm','vulture','bandit']},
    {id:'noa',    x0:44, y0:0,  x1:62, y1:9,  mobs:['guard_bot','laser','noa_guard']}
  ];

  /* ---------------- 赏金首 ---------------- */
  const BOUNTIES = [
    {id:'water',  name:'水怪',     tpl:'blob',   c:{X:'#40a0b8',Y:'#285068'}, size:1, hp:700,  atk:55,  def:20,  spd:6,  xp:600,   gold:1000,   loc:'波布镇南 湖畔',       drop:null},
    {id:'ghost',  name:'水鬼',     tpl:'worm',   c:{X:'#48c0c8',Y:'#206868'}, size:1, hp:1400, atk:90,  def:35,  spd:8,  xp:1000,  gold:3000,   loc:'波布镇西 沼泽',       drop:null},
    {id:'marshal',name:'马歇尔',   tpl:'soldier',c:{X:'#a0a0a8',Y:'#505058'}, size:1, hp:2200, atk:130, def:50,  spd:9,  xp:1800,  gold:5000,   loc:'罗克镇 无敌医院',     drop:null},
    {id:'alien',  name:'异形虫',   tpl:'bug',    c:{X:'#a028a0',Y:'#501458'}, size:2, hp:3000, atk:160, def:70,  spd:10, xp:2500,  gold:8000,   loc:'奥多镇东 森林',       drop:{id:'amy',n:1}},
    {id:'bolt',   name:'波特',     tpl:'tankbot',c:{X:'#a83828',Y:'#581c14'}, size:2, hp:6000, atk:210, def:110, spd:7,  xp:6000,  gold:50000,  loc:'索鲁镇北 荒原',       drop:{id:'nick',n:1}},
    {id:'waroo',  name:'瓦鲁',     tpl:'beast',  c:{X:'#5850b8',Y:'#2c2860'}, size:2, hp:9000, atk:260, def:150, spd:12, xp:10000, gold:60000,  loc:'塔镇周边 沙地',       drop:{id:'nick',n:1}},
    {id:'mystery',name:'神秘人',   tpl:'human',  c:{X:'#503078',Y:'#2c1844'}, size:1, hp:12000,atk:300, def:180, spd:13, xp:14000, gold:70000,  loc:'伊甸镇南 废墟',       drop:{id:'sol',n:1}},
    {id:'gomez',  name:'戈麦斯',   tpl:'human',  c:{X:'#c03030',Y:'#681414'}, size:1, hp:15000,atk:340, def:200, spd:11, xp:20000, gold:80000,  loc:'塔镇 戈麦斯藏身处',   drop:null},
    {id:'ark',    name:'沙漠之舟', tpl:'worm',   c:{X:'#d0a858',Y:'#78602c'}, size:2, hp:30000,atk:400, def:260, spd:10, xp:40000, gold:160000, loc:'大沙漠 深处',         drop:{id:'v100',n:1}},
    {id:'puru',   name:'帕鲁',     tpl:'dragon', c:{X:'#30a838',Y:'#1a5c20'}, size:2, hp:35000,atk:450, def:300, spd:12, xp:50000, gold:200000, loc:'伊甸镇东 洞窟',       drop:{id:'jet',n:1}},
    {id:'noa',    name:'诺亚',     tpl:'noa',    c:{X:'#c83838',Y:'#a0a0a8'}, size:2, hp:60000,atk:520, def:350, spd:9,  xp:100000,gold:100000, loc:'诺亚大楼 主电脑室',   drop:null, final:true}
  ];

  /* ---------------- 战车 ---------------- */
  const TANKS = [
    {id:'t1', name:'NO.1 老式主战坦克', sp:420, armorCap:500, speed:4, def:22, slots:{main:1,sub:1,se:0},
     parts:{main:'gun45', sub:'mg', se:null, engine:'mot1', c:'c0'}, tpl:'tank',  colors:{X:'#3c5a2c',Y:'#2a4520'}, price:0, loc:'拉多镇南侧洞窟'},
    {id:'t2', name:'NO.2 军用越野车',   sp:360, armorCap:400, speed:6, def:18, slots:{main:1,sub:1,se:0},
     parts:{main:'gun55', sub:'ac', se:null, engine:'mot3', c:'c0'}, tpl:'jeep',  colors:{X:'#4a6a3a',Y:'#33501f'}, price:0, loc:'波布镇东 海边兵工厂'},
    {id:'t3', name:'NO.3 军用救护车',   sp:400, armorCap:600, speed:5, def:24, slots:{main:1,sub:1,se:0},
     parts:{main:'gun75', sub:'hmg', se:null, engine:'bul1', c:'amy'}, tpl:'van', colors:{X:'#c83838',Y:'#a0a0a0'}, price:0, loc:'罗克镇 诊所地下室'},
    {id:'t4', name:'NO.4 反坦克炮车',   sp:520, armorCap:700, speed:3, def:30, slots:{main:1,sub:1,se:1},
     parts:{main:'gun105',sub:'vul', se:'mis', engine:'v24', c:'nick'}, tpl:'heavy', colors:{X:'#5a6a3c',Y:'#3c4820'}, price:50000, loc:'奥多镇 战车店'},
    {id:'t5', name:'NO.5 炮战车',       sp:600, armorCap:800, speed:4, def:36, slots:{main:1,sub:1,se:1},
     parts:{main:'gun125',sub:'vul', se:'rkt', engine:'v48', c:'nick'}, tpl:'heavy', colors:{X:'#4a4a68',Y:'#303044'}, price:120000, loc:'索鲁镇 战车店'},
    {id:'t6', name:'NO.6 装甲车',       sp:700, armorCap:900, speed:3, def:44, slots:{main:1,sub:1,se:1},
     parts:{main:'gun155',sub:'potan',se:'sonic',engine:'v66', c:'sol'}, tpl:'tank', colors:{X:'#486a48',Y:'#2e482e'}, price:200000, loc:'伊甸镇 战车店'},
    {id:'t7', name:'NO.7 红狼战车',     sp:800, armorCap:1000,speed:5, def:55, slots:{main:1,sub:1,se:1},
     parts:{main:'gun205',sub:'fir', se:'tolu',engine:'v100',c:'sol2'}, tpl:'super', colors:{X:'#c83030',Y:'#701818'}, price:0, loc:'红狼的托付'},
    {id:'t8', name:'NO.8 主战坦克',     sp:900, armorCap:1100,speed:4, def:62, slots:{main:1,sub:1,se:1},
     parts:{main:'gun220',sub:'fir', se:'tolu',engine:'jet', c:'sol2'}, tpl:'super', colors:{X:'#5a5a68',Y:'#34343e'}, price:0, loc:'地狱门北 军事基地'}
  ];

  /* ---------------- 部件 ---------------- */
  const PARTS = {
    main: [
      {id:'gun45',  name:'45毫米炮',  atk:60,  w:2.0, price:400},
      {id:'gun55',  name:'55毫米炮',  atk:110, w:2.5, price:1200},
      {id:'gun75',  name:'75毫米炮',  atk:180, w:3.0, price:3000},
      {id:'gun88',  name:'88毫米炮',  atk:270, w:3.5, price:7000},
      {id:'gun105', name:'105毫米炮', atk:380, w:4.5, price:15000},
      {id:'gun125', name:'125毫米炮', atk:500, w:6.0, price:30000},
      {id:'gun155', name:'155毫米炮', atk:620, w:7.5, price:60000},
      {id:'gun205', name:'205毫米炮', atk:760, w:9.0, price:120000},
      {id:'gun220', name:'220毫米炮', atk:800, w:10.0, price:200000}
    ],
    sub: [
      {id:'mg',    name:'机枪',   atk:35,  w:0.5, price:300},
      {id:'ac',    name:'机关炮', atk:80,  w:1.0, price:1500},
      {id:'hmg',   name:'重机枪', atk:140, w:1.5, price:4500},
      {id:'vul',   name:'火神炮', atk:220, w:2.0, price:12000},
      {id:'potan', name:'波坦',   atk:350, w:3.5, price:45000},
      {id:'fir',   name:'火龙',   atk:355, w:3.5, price:60000}
    ],
    se: [
      {id:'mis',   name:'导弹',   atk:150, all:true,  w:2.0, price:2500},
      {id:'rkt',   name:'火箭炮', atk:260, all:true,  w:2.5, price:8000},
      {id:'drill', name:'钻头',   atk:400, all:false, w:3.0, price:20000, acc:15},
      {id:'sonic', name:'音波枪', atk:520, all:true,  w:4.0, price:50000},
      {id:'tolu',  name:'托卢',   atk:760, all:false, w:5.0, price:160000}
    ],
    engine: [
      {id:'mot1', name:'MOT1',   load:5,  w:1.0, price:0},
      {id:'mot3', name:'MOT3',   load:10, w:1.2, price:1500},
      {id:'bul1', name:'BUL1',   load:15, w:1.5, price:5000},
      {id:'v24',  name:'V24',    load:24, w:2.0, price:15000},
      {id:'v48',  name:'V48',    load:36, w:2.5, price:40000},
      {id:'v66',  name:'V66',    load:50, w:3.0, price:90000},
      {id:'v100', name:'V100',   load:58, w:3.5, price:200000},
      {id:'jet',  name:'喷气式', load:70, w:4.0, price:350000}
    ],
    c: [
      {id:'c0',   name:'普通C装置', acc:0,  w:2.0, price:0},
      {id:'amy',  name:'艾米',      acc:8,  w:2.0, price:8000},
      {id:'nick', name:'尼克',      acc:15, w:2.5, price:25000},
      {id:'sol',  name:'所罗门',    acc:22, w:3.0, price:80000},
      {id:'sol2', name:'SOLOMON2',  acc:30, w:2.0, price:200000}
    ]
  };

  /* ---------------- 道具 ---------------- */
  const ITEMS = {
    med:    {name:'药箱',   hp:60,  price:80,   desc:'恢复 60 HP'},
    med2:   {name:'大药箱', hp:160, price:350,  desc:'恢复 160 HP'},
    med3:   {name:'急救包', hp:320, price:1000, desc:'恢复 320 HP'},
    repair: {name:'修理箱', repair:300, price:600, desc:'恢复战车 300 SP'},
    bomb:   {name:'手榴弹', dmg:200, price:400, desc:'对敌单体造成 200 伤害'},
    smoke:  {name:'烟雾弹', smoke:true, price:250, desc:'战斗中必定逃脱'}
  };

  /* ---------------- 商店库存 ---------------- */
  const SHOPS = {
    rado: {
      weapon:{items:['med'], main:['gun45','gun55'], sub:['mg','ac'], se:[], engine:['mot3'], c:['c0']},
      tank:{sell:[]}
    },
    masaru: {
      weapon:{items:['med','bomb','smoke'], main:['gun55','gun75'], sub:['ac','hmg'], se:['mis'], engine:['mot3','bul1'], c:['c0','amy']},
      tank:{sell:[]}
    },
    pobb: {
      weapon:{items:['med','med2','bomb','smoke'], main:['gun75','gun88'], sub:['hmg','vul'], se:['mis','rkt'], engine:['bul1'], c:['amy']},
      tank:{sell:[]}
    },
    rock: {
      weapon:{items:['med2','repair','bomb'], main:['gun88','gun105'], sub:['vul'], se:['rkt','drill'], engine:['bul1','v24'], c:['amy','nick']},
      tank:{sell:[]}
    },
    odo: {
      weapon:{items:['med2','repair','bomb','smoke'], main:['gun105','gun125'], sub:['vul'], se:['drill'], engine:['v24','v48'], c:['nick']},
      tank:{sell:['t4']}
    },
    sold: {
      weapon:{items:['med2','med3','repair'], main:['gun125','gun155'], sub:['vul','potan'], se:['drill','sonic'], engine:['v48','v66'], c:['nick','sol']},
      tank:{sell:['t5']}
    },
    tarr: {
      weapon:{items:['med3','repair','bomb'], main:['gun155'], sub:['potan','fir'], se:['sonic'], engine:['v66'], c:['sol']},
      tank:{sell:[]}
    },
    eden: {
      weapon:{items:['med3','repair','bomb','smoke'], main:['gun155','gun205'], sub:['fir'], se:['sonic','tolu'], engine:['v66','jet'], c:['sol','sol2']},
      tank:{sell:['t6']}
    }
  };

  /* ---------------- 成长曲线 ---------------- */
  const GROWTH = {
    hero:  {base:{hp:60, atk:12, def:8, spd:8},  up:{hp:11, atk:3, def:2, spd:1}},
    mecha: {base:{hp:48, atk:9,  def:10, spd:7}, up:{hp:9,  atk:2, def:3, spd:1}},
    wolf:  {base:{hp:72, atk:18, def:10, spd:12},up:{hp:11, atk:4, def:2, spd:2}}
  };
  const xpNeed = lv => Math.floor(45 * Math.pow(lv, 1.7));

  /* ---------------- 对话文本 ---------------- */
  const PASSWORDS = ['3864', '2917', '7350', '5102'];

  const DIALOGUE = {
    story_rado_father: [
      '老战：臭小子！战车工的儿子就该老老实实修车！',
      '老战：当赏金猎人？那是拿命换钱的行当！',
      '老战：……罢了。你要走，就带着这把扳手走吧。',
      '老战：记住，废土上能相信的只有战车和伙伴。',
      '（老战把工具塞进你怀里，别过头去。）',
      '（你被父亲赶出了家门。冒险，从这里开始。）'
    ],
    rado_old: ['老人：大破坏之后一百年了，镇子还是这么安静。','老人：南边的洞窟里好像有什么铁家伙……年轻人去看看吧。'],
    rado_woman: ['妇人：荒野上到处都是怪物。赏金猎人们开着重型战车讨伐它们。','妇人：我们这样的小镇，只能靠猎人保护。'],
    rado_kid: ['小孩：我长大了也要开战车！像红狼那样的大英雄！'],
    rado_man: ['镇民：听说北边有座会说话的机器城堡……谁知道呢。'],
    rado_woman2: ['镇民：战车店能修理战车，装甲片就是战车的生命线，记得补给。'],
    story_masaru_mecha: [
      '美娜：哇，好破的战车！你是赏金猎人吗？',
      '美娜：我是机械师美娜。这种老式主战坦克我最在行了！',
      '美娜：让我加入吧！修战车、改战车，我都包了！',
      '（机械师·美娜 加入了队伍！）'
    ],
    masaru_old: ['老人：麦镇的庄稼是废土上难得的一点绿。','老人：可惜北边河流上游，好像被什么东西污染了。'],
    masaru_farmer: ['农夫：变异虫子总来啃庄稼，猎人们帮了大忙。'],
    masaru_woman: ['妇人：往东走是波布镇，那边有个大湖，听说湖里有怪物。'],
    masaru_kid: ['小孩：情报屋的悬赏榜上有好多怪物！水怪值 1000G 呢！'],
    story_pobb_wolf: [
      '红狼：小子，你就是新来的猎人？',
      '红狼：波布镇南边的湖里有水怪作乱。敢不敢跟我比一比，谁先讨伐它？',
      '红狼：哼，口气不小。水怪死后，去情报屋找我。',
      '（红狼离开了。）'
    ],
    pobb_hunter: ['老猎人：水怪就藏在南边的大湖里。用战车打它，别用脚！'],
    pobb_fisher: ['渔夫：湖里本来有鱼，现在只剩水怪了……'],
    pobb_woman: ['妇人：东边的海边兵工厂大门紧锁，里面好像有战车。'],
    pobb_kid: ['小孩：红狼大人超帅的！我也要像他一样！'],
    rock_doctor: ['医生：无敌医院……那已经不是医院了，是马歇尔的地盘。'],
    rock_nurse: ['护士：马歇尔带着一群暴徒占领了医院，悬赏 5000G。'],
    rock_old: ['老人：诊所地下室有个旧仓库，好像藏着什么东西。'],
    rock_man: ['镇民：奥多镇有手艺最好的改造工房，猎人都去那儿改车。'],
    rock_kid: ['小孩：妈妈不让我去医院玩……里面的人好凶。'],
    odo_modder: ['改造师：欢迎光临奥多改造工房！主炮、副炮、发动机、C装置，随便换！','改造师：装甲片涂装也在这里。注意载重，超重了战车就跑不动啦！'],
    odo_merchant: ['商人：奥多镇是废土的中心，往北是沙漠和索鲁镇。'],
    odo_woman: ['妇人：西边的罗克镇有个可怕的赏金首，别去招惹他。'],
    odo_hunter: ['猎人：战车店的 NO.4 反坦克炮车，可是好东西。50000G，童叟无欺。'],
    odo_kid: ['小孩：密码？什么密码……大人们神神秘秘的。'],
    sold_old: ['老人：很久以前，人类为了拯救地球造了超级电脑“诺亚”。','老人：可它却认定人类才是地球的毒瘤……唉。'],
    sold_soldier: ['退役兵：地狱门在北边，没有密码谁也进不去。','退役兵：我听说密码藏在各个镇的传闻里。'],
    sold_woman: ['妇人：北边沙漠里有怪物在沙子里游动，像船一样。'],
    sold_info: ['情报贩子：嘿，消息 200G 一条，童叟无欺！','情报贩子：地狱门第一台终端的密码是——3864。'],
    sold_kid: ['小孩：索鲁镇的酒馆半夜总有怪声……'],
    tarr_old: ['老人：塔镇曾经是军事要塞。现在……是戈麦斯的地盘。'],
    tarr_man: ['镇民：戈麦斯那伙人抢走了镇上的粮食，猎人拿他也没办法。'],
    tarr_woman: ['妇人：红狼大人最近常来镇上……他说要亲手解决戈麦斯。'],
    tarr_kid: ['小孩：藏身处里有宝箱！可是门口有大汉守着！'],
    tarr_hunter: ['猎人：戈麦斯的战车火力很猛。对付他，需要一流的装备。','猎人：对了，地狱门第二台终端的密码是——2917。'],
    eden_elder: ['长者：伊甸镇是废土上最后的绿洲。可诺亚的天线，正对着这里。','长者：孩子，诺亚认为人类会毁掉地球。你要怎么回答它？'],
    eden_hunter: ['猎人：东边的洞窟里住着帕鲁，那家伙值 200000G。','猎人：沙漠深处还有一艘“船”，值 160000G。'],
    eden_woman: ['妇人：地狱门第三台终端的密码……好像是 7350？记不清了。'],
    eden_man: ['镇民：北边就是地狱门和诺亚大楼。普通人去不了。'],
    eden_kid: ['小孩：塔镇的小孩子告诉我，第四台终端的密码是 5102！'],
    rock_hospital: ['门卫：这里是马歇尔的地盘！闲人免进！','门卫：……想找死的话，就进来吧。'],
    tarr_gomez: ['守门人：戈麦斯大人不见客。','守门人：不过——红狼那家伙，戈麦斯大人倒是等很久了。']
  };

  /* ---------------- 音乐曲目信息 ---------------- */
  const TRACKS = {
    title: '废土的黎明',
    town: '小镇的黄昏',
    field: '荒野之旅',
    cave: '地底回响',
    battle: '迎战！',
    boss: '以血偿金',
    shop: '讨价还价',
    inn: '一夜安眠',
    last: '决战·诺亚',
    ending: '再会于废土'
  };

  return {
    PAL, SPR, ETPL, TTPL, TILE, WORLD, WORLD_W, WORLD_H,
    TOWNS, CAVES, MONSTERS, REGIONS, BOUNTIES, TANKS, PARTS, ITEMS, SHOPS,
    GROWTH, xpNeed, DIALOGUE, TRACKS, PASSWORDS
  };
})();
