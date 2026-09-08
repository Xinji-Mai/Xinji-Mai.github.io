---
layout: research
permalink: /game/
title: "Terramai"
title_zh: "Terramai 像素世界"
kicker: "A LITTLE PLAYGROUND"
kicker_zh: "小游戏"
intro: "Watch a curious agent explore, or take the controls yourself."
intro_zh: "看一位好奇的智能体自由探索，或亲自接管这个世界。"
---
<div id="tw-wrap">
  <div id="tw-top">
    <div id="tw-hp" aria-label="Health / 生命值"><div id="tw-hpbar"></div></div>
    <span id="tw-gear">⛏️Lv1 🗡️Lv1 🛡️Lv0 💎0 🏆0</span>
    <div class="tw-buttons"><button id="tw-mode" type="button">🤖 Mode: AUTO</button><button id="tw-map" type="button" aria-pressed="false"><span class="i18n-en">Map</span><span class="i18n-zh">地图</span> M</button><button id="tw-new" type="button"><span class="i18n-en">New world</span><span class="i18n-zh">新世界</span> ↻</button></div>
  </div>
  <canvas id="tw-canvas" width="880" height="480" tabindex="0" aria-label="Terramai game. Click to focus, then use the keyboard controls below. / 点击聚焦后可使用下方说明中的键盘操作。"><span class="i18n-en">Your browser needs canvas support to run Terramai.</span><span class="i18n-zh">浏览器需要支持 Canvas 才能运行游戏。</span></canvas>
  <div class="tw-status"><span id="tw-state">AUTO</span><span><span class="i18n-en">Click the game to use your keyboard.</span><span class="i18n-zh">点击游戏画面后即可使用键盘。</span></span></div>
  <div id="tw-touch" hidden aria-label="Touch controls / 触屏控制">
    <div class="tw-direction"><button type="button" data-tw-key="ArrowLeft" aria-label="Left / 向左">←</button><button type="button" data-tw-key="ArrowRight" aria-label="Right / 向右">→</button><button type="button" data-tw-key="ArrowUp" aria-label="Aim up / 向上">↑</button><button type="button" data-tw-key="ArrowDown" aria-label="Aim down / 向下">↓</button></div>
    <div class="tw-actions"><button type="button" data-tw-key=" "><span class="i18n-en">Jump</span><span class="i18n-zh">跳跃</span></button><button type="button" data-tw-key="x"><span class="i18n-en">Attack</span><span class="i18n-zh">攻击</span></button><button type="button" data-tw-key="k"><span class="i18n-en">Mine</span><span class="i18n-zh">挖掘</span></button><button type="button" data-tw-key="c"><span class="i18n-en">Place</span><span class="i18n-zh">放置</span></button></div>
  </div>
  <div class="game-guide">
    <div><h2><span class="i18n-en">Explore at your own pace.</span><span class="i18n-zh">按自己的节奏探索。</span></h2><p><span class="i18n-en">Mine underground, discover legendary gear, and defeat three bosses to reach the Victory Gate. Each victory opens a harder world. Your equipment stays with you when you respawn.</span><span class="i18n-zh">深入地下挖矿、发现传奇装备、击败三位首领，抵达胜利之门。每次通关都会开启更难的世界；重生时会保留装备。</span></p><p><span class="i18n-en"><strong>AUTO</strong> explores on its own. Switch to <strong>MANUAL</strong> to play with your keyboard or the touch controls.</span><span class="i18n-zh"><strong>AUTO</strong> 模式会自主探索；切换到 <strong>MANUAL</strong> 后，可以用键盘或触屏按钮亲自操作。</span></p></div>
    <div class="controls-guide"><h3><span class="i18n-en">Controls</span><span class="i18n-zh">操作指南</span></h3><dl><div><dt><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd></dt><dd><span class="i18n-en">Move</span><span class="i18n-zh">移动</span></dd></div><div><dt><kbd>Space</kbd> / <kbd>W</kbd></dt><dd><span class="i18n-en">Jump</span><span class="i18n-zh">跳跃</span></dd></div><div><dt><kbd>X</kbd> / <kbd>J</kbd></dt><dd><span class="i18n-en">Attack</span><span class="i18n-zh">攻击</span></dd></div><div><dt><kbd>K</kbd> + <kbd>↑↓←→</kbd></dt><dd><span class="i18n-en">Mine & aim</span><span class="i18n-zh">定向挖掘</span></dd></div><div><dt><kbd>C</kbd></dt><dd><span class="i18n-en">Place a block</span><span class="i18n-zh">放置方块</span></dd></div><div><dt><kbd>M</kbd></dt><dd><span class="i18n-en">World map</span><span class="i18n-zh">世界地图</span></dd></div></dl></div>
  </div>
</div>
<link rel="stylesheet" href="{{ '/assets/css/game.css' | relative_url }}">
<script src="{{ '/assets/js/tasty-world.js' | relative_url }}?v=20260908-local"></script>
