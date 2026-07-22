/**
 * agent-proxy — tiny LLM proxy for the Agent World game (Cloudflare Worker).
 *
 * Your API key lives ONLY here as a Worker Secret (LLM_API_KEY).
 * The static site calls this endpoint; the key never reaches the browser.
 *
 * Deploy (dashboard): Workers & Pages -> Create Worker -> paste this file.
 *   Settings -> Variables:
 *     Secret  LLM_API_KEY     = sk-...            (DashScope / OpenAI-compatible key)
 *     Var     LLM_BASE_URL    = https://dashscope.aliyuncs.com/compatible-mode/v1
 *     Var     LLM_MODEL       = qwen-plus
 *     Var     ALLOWED_ORIGIN  = https://xinji-mai.github.io
 *     Var     DAILY_LIMIT     = 800               (max upstream calls per day, hard budget)
 */

let dayKey = "";        // best-effort in-isolate counters (per Worker instance)
let dayCount = 0;
const ipHits = new Map();

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "https://xinji-mai.github.io";
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, cors);
    if (origin !== allowed) return json({ error: "origin not allowed" }, 403, cors);

    // ---- budget guards ----
    const today = new Date().toISOString().slice(0, 10);
    if (today !== dayKey) { dayKey = today; dayCount = 0; ipHits.clear(); }
    if (dayCount >= Number(env.DAILY_LIMIT || 800)) return json({ thought: "…(daily budget reached)" }, 200, cors);
    const ip = request.headers.get("CF-Connecting-IP") || "?";
    const now = Date.now();
    const rec = ipHits.get(ip) || { t: 0, n: 0 };
    if (now - rec.t > 60000) { rec.t = now; rec.n = 0; }
    rec.n++; ipHits.set(ip, rec);
    if (rec.n > 10) return json({ thought: "…(slow down)" }, 429, cors);

    // ---- build prompt from game state ----
    let s = {};
    try { s = await request.json(); } catch (e) {}
    const sys = "You are the brain of a pixel game agent exploring a Terraria-like world. " +
      "Reply ONLY compact JSON: {\"thought\":\"<witty first-person thought, <=10 words>\"," +
      "\"hint\":\"<one of: explore|dig_down|seek_goal|fight|flee|surface>\"}";
    const usr = `State: hp=${s.hp}, gems=${s.gems}, pick=${s.pick}, sword=${s.sword}, armor=${s.armor}, ` +
      `depth=${s.depth} tiles underground, enemyNear=${s.enemyNear}, treasureFound=${s.goalKnown}, ` +
      `explored=${s.exploredPct}%, wins=${s.wins}, currentState=${s.state}. Pick the best next high-level goal.`;

    try {
      dayCount++;
      const r = await fetch(`${env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.LLM_API_KEY}` },
        body: JSON.stringify({
          model: env.LLM_MODEL || "qwen-plus",
          messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
          max_tokens: 80, temperature: 0.9,
        }),
      });
      const data = await r.json();
      const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
      const m = text.match(/\{[\s\S]*\}/);
      let out = { thought: "Hmm…", hint: "explore" };
      if (m) { try { out = JSON.parse(m[0]); } catch (e) {} }
      const HINTS = ["explore", "dig_down", "seek_goal", "fight", "flee", "surface"];
      if (!HINTS.includes(out.hint)) out.hint = "explore";
      out.thought = String(out.thought || "…").slice(0, 64);
      out.model = env.LLM_MODEL || "qwen-plus";
      return json(out, 200, cors);
    } catch (e) {
      return json({ thought: "…(brain offline)" }, 200, cors);
    }
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers });
}
