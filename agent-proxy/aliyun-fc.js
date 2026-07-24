/**
 * Aliyun Function Compute — WEB FUNCTION (Node.js) LLM proxy for Terramai.
 *
 * ‼️ Create a "Web 函数" (Web Function), NOT "任务函数" / "事件函数".
 *    Task/Event functions are for async jobs; a Web Function gives you a real
 *    HTTPS URL that the game can fetch directly.
 *
 * Runtime: Node.js 16/18/20 (uses only built-in http/https — no dependencies).
 * Request handler: index.handler is IGNORED for web functions; this file just
 * starts an HTTP server on the port FC injects (FC_SERVER_PORT, default 9000).
 *
 * Environment variables (FC console → 函数配置 → 环境变量):
 *   DASHSCOPE_API_KEY  = sk-...     (your key — stays on the server)
 *   LLM_BASE_URL       = https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
 *   LLM_MODEL          = qwen3.8-max-preview
 *   ALLOWED_ORIGIN     = https://xinji-mai.github.io
 *   DAILY_LIMIT        = 800
 */
const http = require("http");
const https = require("https");
const PORT = process.env.FC_SERVER_PORT || 9000;
const LLM_BASE = process.env.LLM_BASE_URL || "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";

let dayKey = "", dayCount = 0;
const ipHits = new Map();

function callLLM(payload) {
  return new Promise(function (resolve, reject) {
    var u = new URL(LLM_BASE.replace(/\/+$/, "") + "/chat/completions");
    var key = process.env.DASHSCOPE_API_KEY || process.env.LLM_API_KEY || "";
    var data = JSON.stringify(payload);
    var req = https.request({
      hostname: u.hostname, port: u.port || 443, path: u.pathname + (u.search || ""),
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), Authorization: "Bearer " + key }
    }, function (r) { var b = ""; r.on("data", function (c) { b += c; }); r.on("end", function () { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); });
    req.on("error", reject); req.write(data); req.end();
  });
}

http.createServer(function (req, res) {
  var origin = req.headers.origin || "";
  var allowed = process.env.ALLOWED_ORIGIN || "https://xinji-mai.github.io";
  var cors = { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json" };
  function send(code, obj) { res.writeHead(code, cors); res.end(JSON.stringify(obj)); }
  if (req.method === "OPTIONS") return send(204, {});
  if (req.method !== "POST") return send(405, { error: "POST only" });
  if (origin !== allowed) return send(403, { error: "origin not allowed" });

  var today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) { dayKey = today; dayCount = 0; ipHits.clear(); }
  if (dayCount >= Number(process.env.DAILY_LIMIT || 800)) return send(200, { thought: "…(daily budget reached)" });
  var ip = String(req.headers["x-forwarded-for"] || "?").split(",")[0], now = Date.now(), rec = ipHits.get(ip) || { t: 0, n: 0 };
  if (now - rec.t > 60000) { rec.t = now; rec.n = 0; }
  rec.n++; ipHits.set(ip, rec);
  if (rec.n > 10) return send(429, { thought: "…(slow down)" });

  var body = "";
  req.on("data", function (c) { body += c; });
  req.on("end", function () {
    var s = {}; try { s = JSON.parse(body); } catch (e) {}
    var model = process.env.LLM_MODEL || "qwen3.8-max-preview";
    var sys = "You are the strategic brain of an AI agent in a Terraria-like 2D mining sandbox. A low-level controller (pathfinding, digging, jumping, melee) executes the GOAL you choose; you only pick the next high-level goal plus a short first-person thought.\n" +
      "Grow stronger before taking risks: mine_ore upgrades pickaxe/sword, collect_gems upgrades armor, open_chest gives random upgrades, hunt seeks out a beatable monster to farm. pillar_up climbs straight up by stacking dirt blocks (consumes dirtBlocks; use it to escape pits or head back toward the surface). Only fight/hunt enemies you can beat (enemy.beatable=true); avoid ones too strong (beatable=false) until geared. Seek the Grand Gem (seek_goal) only once it is known and you are well geared.\n" +
      "WORLD LAYOUT & PROGRESSION: gold/diamond get denser the DEEPER you dig; chests are denser toward the RIGHT; monsters are higher level deeper and further right; deep lava burns hard. The VICTORY GATE sits at the FAR RIGHT on the surface, guarded by a Lv10 BOSS; stepping through clears the world and starts a fresh one. Develop first (mine & upgrade near home); once power >= 5 push right and deeper for better loot; if upgrades stall in your area, stop grinding and explore right/deeper. Gear caps at Lv10 and upgrades get pricier at higher levels - keep upgrading until power >= 8, then commit to pushing right, kill the gate boss and seek_goal.\n" +
      "Keep CONTINUITY across replies: lastPlan shows your previous plan. Continue or extend the same theme (e.g., finish a mining trip: mine_ore, collect_gems, open_chest) instead of switching activities every reply. Only switch themes when the situation changes: low hp, new threat, a discovery, or the theme is finished.\n" +
      "Be adaptive and avoid loops: read recentActions and do NOT repeat the same goal every turn. If the enemy is unreachable (reachable=false) or too strong, pick a different goal \u2014 mine ore, open a chest, explore the other direction, dig deeper, or flee.\n" +
      "Random world EVENTS appear in the event field: meteor = rare ore exposed nearby (go mine_ore!), wave = monster wave (fight/hunt if geared, else avoid), supply = free chest dropped (open_chest!). React to events.\n" +
      "STUCK HANDLING: if stuckSec > 2, bannedTargets > 0, or recentActions keep repeating, your current approach is FAILING - switch strategy: go the opposite direction (explore_left/explore_right), dig_deep to reroute from below, or pillar_up to climb (needs dirtBlocks > 0; mining dirt/stone restocks blocks). Anything marked (up on a ledge) can NOT be reached by jumping - use pillar_up or approach from the side. Never chase the same unreachable target twice in a row. If loiterSec > 10 you have lingered too long in one area - move toward fresh territory (explore a new direction or dig_deep), do not keep farming the same spot.\n" +
      "LOW HP RULE: when hp is low, do NOT flip between fighting and fleeing - commit to ONE recovery line: eat_food (go grab the nearest healing food) or avoid (retreat to safety), and stay on it until hp recovers above 65%. Never fight or push for the gate while weak, even if your gear is strong.\n" +
      "Reply ONLY compact JSON: {\"thought\":\"<=10 words, first person, lively\",\"plan\":[\"goal1\"],\"latent\":\"loot\"}. You are called every ~8 seconds: your plan must cover the NEXT 8 SECONDS of play. plan = 1 to 4 goals executed in order; a single goal means sustain it the whole time. Each goal one of: explore|explore_left|explore_right|mine_ore|collect_gems|dig_deep|open_chest|fight|hunt|avoid|seek_goal|surface|pillar_up|eat_food. latent = standing priority when surprises interrupt the plan: loot (grab nearby chests/ore on sight), aggressive (engage any beatable enemy), cautious (avoid all combat, keep hp high), rush (ignore distractions, stick to the plan).";
    var e = s.enemy;
    var enemyStr = e ? ((e.boss ? "BOSS " : "") + e.kind + " Lv" + e.lv + ", " + e.distTiles + " tiles " + e.dir + (e.above ? " (above)" : "") + ", reachable=" + e.reachable + ", beatable=" + e.beatable) : "none";
    var c2 = s.chest, chestStr = c2 ? (c2.dist + " tiles " + c2.dir + (c2.above ? " (up on a ledge)" : "")) : "none";
    var o2 = s.ore, oreStr = o2 ? (o2.dist + " tiles " + o2.dir + (o2.above ? " (above)" : "")) : "none";
    var usr = "hp=" + s.hp + "/" + s.maxhp + ", power=" + s.power + ", gear pick/sword/armor=" + s.pick + "/" + s.sword + "/" + s.armor + ", gems=" + s.gems + ", dirtBlocks=" + s.dirt +
      ", depth=" + s.depth + ", exploredPct=" + s.exploredPct + ", goalKnown=" + s.goalKnown + ", deaths=" + (s.deaths || 0) + ", event=" + (s.event || "none") + ", latent=" + (s.latent || "loot") +
      ", stuckSec=" + (s.stuckSec || 0) + ", bannedTargets=" + (s.bannedTargets || 0) + ", loiterSec=" + (s.loiterSec || 0) + ", lavaNear=" + !!s.lavaNear +
      ", nearestChest=[" + chestStr + "], nearestOre=[" + oreStr + "], nearestEnemy=[" + enemyStr + "]" +
      ", lastPlan=" + JSON.stringify(s.lastPlan || []) + ", recentActions=" + JSON.stringify(s.recentActions || []) + ", currentState=" + s.state + ". Compose the next plan.";
    dayCount++;
    callLLM({ model: model, messages: [{ role: "system", content: sys }, { role: "user", content: usr }], max_tokens: 140, temperature: 0.7 })
      .then(function (d) {
        var text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
        var m = text.match(/\{[\s\S]*\}/), out = { thought: "Hmm…", hint: "explore" };
        if (m) { try { out = JSON.parse(m[0]); } catch (e) {} }
        var H = ["explore", "explore_left", "explore_right", "mine_ore", "collect_gems", "dig_deep", "open_chest", "fight", "hunt", "avoid", "seek_goal", "surface", "pillar_up", "eat_food"];
        var plan = [];
        if (out.plan && out.plan.length) for (var q = 0; q < out.plan.length && plan.length < 4; q++) { if (H.indexOf(String(out.plan[q])) >= 0) plan.push(String(out.plan[q])); }
        if (!plan.length) plan = [H.indexOf(out.hint) >= 0 ? out.hint : "explore"];
        out.plan = plan; out.hint = plan[0];
        var L = ["loot", "aggressive", "cautious", "rush"];
        out.latent = (L.indexOf(String(out.latent)) >= 0) ? String(out.latent) : "loot";
        out.thought = String(out.thought || "…").slice(0, 64); out.model = model;
        send(200, out);
      })
      .catch(function () { send(200, { thought: "…(brain offline)" }); });
  });
}).listen(PORT, function () { console.log("Terramai proxy listening on " + PORT); });
