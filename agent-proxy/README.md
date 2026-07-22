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

## Alternative: Aliyun Function Compute

The same logic ports directly to an Aliyun FC HTTP handler (Node.js runtime): store
`LLM_API_KEY` as an FC environment variable, check the `Origin` header, and forward to
DashScope. Use FC if you prefer keeping everything inside Alibaba Cloud.

## Why not put the key in the page / rent an ECS?

- Frontend key = public key. Anyone can read it from the source.
- A 24/7 ECS works but costs money and needs patching — overkill for one endpoint.
- A serverless function is free-tier, zero-maintenance, and holds the secret server-side.
