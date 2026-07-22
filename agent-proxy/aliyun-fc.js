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
 *   LLM_MODEL          = qwen-plus
 *   ALLOWED_ORIGIN     = https://xinji-mai.github.io
 *   DAILY_LIMIT        = 800
 */
const http = require("http");
const https = require("https");
const PORT = process.env.FC_SERVER_PORT || 9000;

let dayKey = "", dayCount = 0;
const ipHits = new Map();

function callLLM(payload) {
  return new Promise(function (resolve, reject) {
    var data = JSON.stringify(payload);
    var req = https.request({
      hostname: "dashscope.aliyuncs.com",
      path: "/compatible-mode/v1/chat/completions",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), Authorization: "Bearer " + process.env.DASHSCOPE_API_KEY }
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
    var model = process.env.LLM_MODEL || "qwen-plus";
    var sys = "You are the brain of a pixel game agent exploring a Terraria-like world. Reply ONLY compact JSON: " +
      "{\"thought\":\"<witty first-person thought, <=10 words>\",\"hint\":\"<one of: explore|dig_down|seek_goal|fight|flee|surface>\"}";
    var usr = "State: hp=" + s.hp + ", gems=" + s.gems + ", pick=" + s.pick + ", sword=" + s.sword + ", armor=" + s.armor +
      ", depth=" + s.depth + ", enemyNear=" + s.enemyNear + ", treasureFound=" + s.goalKnown + ", explored=" + s.exploredPct + "%, state=" + s.state + ".";
    dayCount++;
    callLLM({ model: model, messages: [{ role: "system", content: sys }, { role: "user", content: usr }], max_tokens: 80, temperature: 0.9 })
      .then(function (d) {
        var text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
        var m = text.match(/\{[\s\S]*\}/), out = { thought: "Hmm…", hint: "explore" };
        if (m) { try { out = JSON.parse(m[0]); } catch (e) {} }
        var H = ["explore", "dig_down", "seek_goal", "fight", "flee", "surface"];
        if (H.indexOf(out.hint) < 0) out.hint = "explore";
        out.thought = String(out.thought || "…").slice(0, 64); out.model = model;
        send(200, out);
      })
      .catch(function () { send(200, { thought: "…(brain offline)" }); });
  });
}).listen(PORT, function () { console.log("Terramai proxy listening on " + PORT); });
