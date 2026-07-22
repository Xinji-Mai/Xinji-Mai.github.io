---
title: "Terramai 🌍"
permalink: /game/
author_profile: false
---

<p><strong>Terramai</strong> 是一款迷你 2D 像素沙盒游戏，由 AI 智能体自主操控——它会探索世界、挖掘矿石、与怪物战斗、搜刮宝箱、升级装备，并寻找隐藏的终极宝石。每张地图都是程序生成的。智能体死亡后会掉落所有装备（拾取 🎒 即可找回），并自动重生。</p>

<p id="tw-keys"><b>Controls</b> — <kbd>M</kbd> toggle world map ·
Agent runs itself by default; click <b>🎮 Mode</b> to take over manually:
<kbd>←</kbd><kbd>→</kbd>/<kbd>A</kbd><kbd>D</kbd> move · <kbd>↑</kbd>/<kbd>W</kbd>/<kbd>Space</kbd> jump ·
<kbd>X</kbd>/<kbd>J</kbd> attack · <kbd>Z</kbd>/<kbd>K</kbd>/<kbd>↓</kbd> mine.
The <b>🧠 LLM</b> button lets a real model take over the agent's high-level goals.</p>

<div id="tw-wrap">
  <div id="tw-top">
    <div id="tw-hp"><div id="tw-hpbar"></div></div>
    <span id="tw-gear">⛏️Lv1 🗡️Lv1 🛡️Lv0 💎0 🏆0</span>
    <button id="tw-mode" type="button">🤖 Agent: AUTO</button>
    <button id="tw-llm" type="button">🧠 LLM: OFF</button>
    <button id="tw-new" type="button">🔄 New World</button>
    <span id="tw-state">AUTO</span>
  </div>
  <canvas id="tw-canvas" width="880" height="480"></canvas>
  <p id="tw-brain">Agent brain: <b>BFS pathfinding + frontier exploration + finite-state machine</b>
  (switching between Explore · Seek-Goal · Fight · Flee · Dig · Surface), all on-device. Turning on
  <b>🧠 LLM</b> lets a model pick the high-level goal &amp; narrate its thoughts — the banner shows which
  model is in control.</p>
</div>

<style>
#tw-wrap{max-width:900px;margin:0 auto}
#tw-top{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;margin-bottom:.4rem;font-family:"Source Sans 3",sans-serif;font-size:.85rem}
#tw-hp{width:120px;height:12px;border:1px solid rgba(128,128,128,.5);border-radius:6px;overflow:hidden;background:rgba(0,0,0,.15)}
#tw-hpbar{height:100%;width:100%;background:linear-gradient(90deg,#e05555,#7ed957);transition:width .2s}
#tw-gear{font-weight:600}
#tw-state{color:#888;font-size:.75rem;margin-left:auto}
#tw-top button{border:1px solid rgba(128,128,128,.4);border-radius:8px;background:transparent;color:inherit;padding:.25rem .6rem;font-size:.8rem;cursor:pointer}
#tw-top button:hover{border-color:#2563eb;color:#2563eb}
#tw-top #tw-llm.on{border-color:#7b3fe4;color:#fff;background:#7b3fe4}
#tw-canvas{width:100%;height:auto;border:1px solid rgba(128,128,128,.35);border-radius:10px;image-rendering:pixelated;background:#0b0e13;display:block}
#tw-keys,#tw-brain{font-size:.8rem;color:#8a919b;margin-top:.45rem}
#tw-keys kbd{border:1px solid rgba(128,128,128,.5);border-radius:4px;padding:0 .3rem;font-size:.72rem;background:rgba(128,128,128,.12)}
</style>

<script>
  /* Optional LLM proxy endpoint. Leave "" to use the built-in BFS+FSM brain; the 🧠 LLM
     button can also set it at runtime. NEVER put an API key here — deploy agent-proxy/
     and use only the PROXY URL. */
  window.AGENT_LLM_ENDPOINT = "";
</script>
<script src="/assets/js/tasty-world.js"></script>
