---
title: "Agent World 🌍"
permalink: /game/
author_profile: false
---

<p>A tiny <em>Terraria-like</em> 2D pixel sandbox that an <strong>AI agent plays by itself</strong> — it explores,
mines, fights slimes, upgrades its gear, and hunts the hidden treasure. The map is procedurally
generated and <strong>guaranteed solvable</strong> (BFS-verified at generation). On death it <strong>drops all
equipment</strong> (go pick the 🎒 back up!) and auto-respawns.</p>

<div id="tw-wrap">
  <div id="tw-top">
    <div id="tw-hp"><div id="tw-hpbar"></div></div>
    <span id="tw-gear">⛏️Lv1 🗡️Lv1 🛡️Lv0 💎0 🏆0</span>
    <span id="tw-state">AUTO</span>
    <button id="tw-mode" type="button">🤖 Agent: AUTO</button>
    <button id="tw-new" type="button">🔄 New World</button>
  </div>
  <canvas id="tw-canvas" width="860" height="460"></canvas>
  <p id="tw-help">Manual mode: <b>←→/A·D</b> move · <b>↑/W/Space</b> jump · <b>X/J</b> attack · <b>Z/K/↓</b> mine ·
  Agent brain: pathfinding + FSM on-device; an optional LLM picks high-level goals &amp; “thoughts”.</p>
</div>

<details>
  <summary><b>🧠 Plug in an LLM brain (optional, no key in the frontend)</b></summary>
  <p>The game is fully playable with its built-in algorithmic brain. To let a real LLM pick the agent's
  high-level goals and generate its "thoughts", deploy the tiny serverless proxy in
  <a href="https://github.com/Xinji-Mai/Xinji-Mai.github.io/tree/master/agent-proxy"><code>agent-proxy/</code></a>
  (Cloudflare Workers or Aliyun Function Compute — your API key stays in the backend as a secret, with
  origin lock + rate limit + daily cap). Then open the browser console on this page and run:</p>
  <pre><code>localStorage.setItem('agent_llm_endpoint', 'https://your-worker.example.workers.dev')</code></pre>
  <p>Refresh — the HUD will show <code>LLM brain ✓</code>. Calls are throttled to ~1 per 9s, so token usage stays tiny.</p>
</details>

<style>
#tw-wrap{max-width:880px;margin:0 auto}
#tw-top{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.4rem;font-family:"Source Sans 3",sans-serif;font-size:.85rem}
#tw-hp{width:130px;height:12px;border:1px solid rgba(128,128,128,.5);border-radius:6px;overflow:hidden;background:rgba(0,0,0,.15)}
#tw-hpbar{height:100%;width:100%;background:linear-gradient(90deg,#e05555,#7ed957);transition:width .2s}
#tw-gear{font-weight:600}
#tw-state{color:#888;font-size:.78rem;margin-left:auto}
#tw-top button{border:1px solid rgba(128,128,128,.4);border-radius:8px;background:transparent;color:inherit;padding:.25rem .6rem;font-size:.8rem;cursor:pointer}
#tw-top button:hover{border-color:#2563eb;color:#2563eb}
#tw-canvas{width:100%;height:auto;border:1px solid rgba(128,128,128,.35);border-radius:10px;image-rendering:pixelated;background:#0b0e13;display:block}
#tw-help{font-size:.78rem;color:#8a919b;margin-top:.45rem}
details{margin-top:1rem}
details pre{font-size:.78rem;overflow:auto}
</style>

<script>
  /* Optional LLM proxy endpoint. Leave "" to use the built-in algorithmic brain.
     NEVER put an API key here — deploy agent-proxy/ and paste the PROXY URL only. */
  window.AGENT_LLM_ENDPOINT = "";
</script>
<script src="/assets/js/tasty-world.js"></script>
