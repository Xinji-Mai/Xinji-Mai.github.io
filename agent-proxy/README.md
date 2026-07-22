# agent-proxy — LLM brain for the Agent World game

A ~90-line serverless proxy so the game at `/game/` can use a real LLM **without ever
exposing your API key**: the key lives only as a backend secret; the browser only talks
to this proxy.

Built-in protections: origin lock (only your site may call it), per-IP rate limit
(10/min), and a **hard daily budget** (`DAILY_LIMIT`) so your token plan can't be drained.

## Deploy on Cloudflare Workers (free, ~3 minutes)

1. https://dash.cloudflare.com → **Workers & Pages → Create → Worker**, paste `worker.js`, Deploy.
2. Worker → **Settings → Variables and Secrets**:
   | type | name | value |
   |---|---|---|
   | Secret | `LLM_API_KEY` | your DashScope / OpenAI-compatible key |
   | Var | `LLM_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
   | Var | `LLM_MODEL` | `qwen-plus` (or any model your plan covers) |
   | Var | `ALLOWED_ORIGIN` | `https://xinji-mai.github.io` |
   | Var | `DAILY_LIMIT` | `800` |
3. Copy the worker URL (e.g. `https://agent-brain.xxx.workers.dev`).
4. Open `https://xinji-mai.github.io/game/`, press F12 → Console:
   ```js
   localStorage.setItem('agent_llm_endpoint', 'https://agent-brain.xxx.workers.dev')
   ```
   Refresh — the HUD shows `LLM brain ✓`. (Or hardcode it in `_pages/game.md` →
   `window.AGENT_LLM_ENDPOINT`.)

The game calls the brain at most **once per 9 seconds**, and the proxy caps everything at
`DAILY_LIMIT` upstream calls/day, so cost stays negligible.

## Alternative: Aliyun Function Compute (Web Function)

Use `aliyun-fc.js` (no dependencies). ‼️ Choose **Web 函数 (Web Function)** — NOT
**任务函数 (Task Function)** or **事件函数 (Event Function)**; only a Web Function gives
a direct HTTPS URL the game can call.

1. FC console → 创建函数 → **Web 函数** → Node.js 18/20 → 使用示例代码.
2. Replace the sample with `aliyun-fc.js` (the *request handler* field is ignored for Web
   functions — the file just starts an HTTP server on `FC_SERVER_PORT`).
3. 函数配置 → 环境变量: `DASHSCOPE_API_KEY` (secret), `LLM_MODEL=qwen-plus`,
   `ALLOWED_ORIGIN=https://xinji-mai.github.io`, `DAILY_LIMIT=800`.
4. Enable the public HTTPS endpoint and copy the URL.
5. On the game page click **🧠 LLM** and paste that URL.

## Why not put the key in the page / rent an ECS?

- Frontend key = public key. Anyone can read it from the source.
- A 24/7 ECS works but costs money and needs patching — overkill for one endpoint.
- A serverless function is free-tier, zero-maintenance, and holds the secret server-side.
