/* ============================================================================
   TERRAMAI — a Terraria-like 2D pixel sandbox that an AI agent auto-plays.
   Client-side engine + agent brain: BFS pathfinding + frontier exploration + FSM.
   Optional LLM "brain" via your serverless proxy (see /agent-proxy/):
   the API key NEVER appears in this file or anywhere in the frontend.
   ============================================================================ */
(function () {
  "use strict";
  var canvas = document.getElementById("tw-canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");

  /* ---------------- constants ---------------- */
  var TS = 16, WW = 240, WH = 100;
  var GRAV = 0.55, MAXFALL = 11, MOVE = 1.8, JUMP = 8.9;
  var AIR = 0, DIRT = 1, GRASS = 2, STONE = 3, COPPER = 4, IRON = 5, GOLD = 6, DIAMOND = 7,
      GEM = 8, WOOD = 9, LEAF = 10, BEDROCK = 11, GOAL = 12, CHEST = 13;
  var SOLID = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 11: 1 };
  var HARD = { 1: 10, 2: 10, 3: 24, 4: 28, 5: 34, 6: 40, 7: 55, 8: 45, 9: 16, 10: 4 };
  var ORE_PTS = { 4: 1, 5: 2, 6: 3, 7: 5 };
  var ORE_NAME = { 4: "Copper", 5: "Iron", 6: "Gold", 7: "Diamond" };
  var BASECOL = { 1: "#6e4a28", 2: "#6e4a28", 3: "#6b6f76", 4: "#6b6f76", 5: "#6b6f76", 6: "#6b6f76",
                  7: "#5d6166", 8: "#5d6166", 9: "#5b3b22", 10: "#2f7d2a", 11: "#23252b", 12: "#ffd54a", 13: "#7a4a1e" };
  var NUG = { 4: "#c47a3a", 5: "#d8cfc0", 6: "#ffd24a", 7: "#6ee6f2", 8: "#b06ef2" };
  var MAPCOL = { 0: "#181c24", 1: "#6e4a28", 2: "#3e9e3a", 3: "#6b6f76", 4: "#c47a3a", 5: "#d8cfc0",
                 6: "#ffd24a", 7: "#6ee6f2", 8: "#b06ef2", 9: "#5b3b22", 10: "#2f7d2a", 11: "#0c0d10", 12: "#ffd54a", 13: "#e8a33d" };

  var world = new Uint8Array(WW * WH), explored = new Uint8Array(WW * WH), exploredCount = 0;
  function idx(x, y) { return y * WW + x; }
  function inb(x, y) { return x >= 0 && x < WW && y >= 0 && y < WH; }
  function get(x, y) { return inb(x, y) ? world[idx(x, y)] : BEDROCK; }
  function setT(x, y, v) { if (inb(x, y)) world[idx(x, y)] = v; }
  function isSolid(x, y) { return !!SOLID[get(x, y)]; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------------- pixel textures (Terraria-ish, procedurally baked) ---------------- */
  var TEX = {};
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, r * f | 0)); g = Math.max(0, Math.min(255, g * f | 0)); b = Math.max(0, Math.min(255, b * f | 0));
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function makeTex(t) {
    var c = document.createElement("canvas"); c.width = TS; c.height = TS;
    var g = c.getContext("2d"), base = BASECOL[t] || "#888", i, px, py;
    g.fillStyle = base; g.fillRect(0, 0, TS, TS);
    for (i = 0; i < 30; i++) {                                  // grainy noise
      px = (Math.random() * TS) | 0; py = (Math.random() * TS) | 0;
      g.fillStyle = shade(base, Math.random() < 0.5 ? 0.82 : 1.15);
      g.fillRect(px, py, 1 + (Math.random() * 2 | 0), 1);
    }
    if (t === GRASS) {                                          // green turf + blades
      g.fillStyle = "#3e9e3a"; g.fillRect(0, 0, TS, 5);
      g.fillStyle = "#57c04f";
      for (i = 0; i < 6; i++) { px = (Math.random() * TS) | 0; g.fillRect(px, 0, 1, 2 + (Math.random() * 3 | 0)); }
      g.fillStyle = "#2c7a2a"; g.fillRect(0, 4, TS, 1);
    }
    if (NUG[t]) {                                               // ore nuggets
      g.fillStyle = NUG[t];
      for (i = 0; i < 5; i++) {
        px = 2 + (Math.random() * (TS - 5)) | 0; py = 2 + (Math.random() * (TS - 5)) | 0;
        g.fillRect(px, py, 2 + (Math.random() * 2 | 0), 2);
        g.fillStyle = shade(NUG[t], 1.3); g.fillRect(px, py, 1, 1); g.fillStyle = NUG[t];
      }
    }
    if (t === WOOD) { g.fillStyle = shade(base, 0.7); for (i = 2; i < TS; i += 5) g.fillRect(i, 0, 1, TS); }
    if (t === LEAF) { g.fillStyle = "#54b04a"; for (i = 0; i < 8; i++) g.fillRect((Math.random() * TS) | 0, (Math.random() * TS) | 0, 2, 2); }
    if (t === BEDROCK) { g.fillStyle = "#101114"; for (i = 0; i < 5; i++) g.fillRect((Math.random() * TS) | 0, (Math.random() * TS) | 0, 4, 2); }
    if (t === GOAL) {
      g.fillStyle = "#fff3c0"; g.fillRect(3, 3, TS - 6, TS - 6);
      g.fillStyle = "#ffea8a"; g.fillRect(5, 5, TS - 10, TS - 10);
      g.fillStyle = "#fff"; g.fillRect(4, 4, 2, 2);
    }
    if (t === CHEST) {
      g.fillStyle = "#8a5a26"; g.fillRect(1, 3, TS - 2, TS - 4);
      g.fillStyle = "#6e4419"; g.fillRect(1, 3, TS - 2, 2); g.fillRect(1, TS - 3, TS - 2, 2);
      g.fillStyle = "#ffd24a"; g.fillRect(1, 7, TS - 2, 2); g.fillRect(TS / 2 - 1, 6, 3, 5);
      g.fillStyle = "#3a2508"; g.fillRect(TS / 2, 8, 1, 2);
    }
    if (t !== GOAL && t !== CHEST) {                            // beveled edges
      g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(0, 0, TS, 1); g.fillRect(0, 0, 1, TS);
      g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(0, TS - 1, TS, 1); g.fillRect(TS - 1, 0, 1, TS);
    }
    return c;
  }
  function buildTex() {
    for (var t = 1; t <= 13; t++) { TEX[t] = [makeTex(t), makeTex(t), makeTex(t)]; }
  }

  /* ---------------- world generation (procedural + guaranteed solvable) ---------------- */
  var spawn = { x: 0, y: 0 }, goal = { x: 0, y: 0 }, surf = [], chests = [], clouds = [];
  function generate() {
    world.fill(AIR); explored.fill(0); exploredCount = 0; surf = []; chests = [];
    var h = (WH * 0.40) | 0, x, y;
    for (x = 0; x < WW; x++) {
      if (Math.random() < 0.35) h += Math.random() < 0.5 ? -1 : 1;
      h += Math.round(Math.sin(x * 0.06) * 0.5);
      h = Math.max((WH * 0.26) | 0, Math.min((WH * 0.58) | 0, h));
      surf[x] = h;
      for (y = h; y < WH; y++) {
        var t = (y === h) ? GRASS : (y < h + 4 ? DIRT : STONE);
        if (y >= WH - 2) t = BEDROCK;
        setT(x, y, t);
      }
      if (Math.random() < 0.05 && x > 7 && x < WW - 4) {        // trees
        var th = 4 + (Math.random() * 3 | 0), k, lx, ly;
        for (k = 1; k <= th; k++) setT(x, h - k, WOOD);
        for (lx = -2; lx <= 2; lx++) for (ly = -2; ly <= 0; ly++)
          if (Math.abs(lx) + Math.abs(ly + 1) < 3) setT(x + lx, h - th + ly, LEAF);
      }
    }
    var w, s, ox, oy;
    for (w = 0; w < 30; w++) {                                  // cave worms
      var cx = rnd(6, WW - 6), cy = rnd(WH * 0.42, WH - 4), ang = rnd(0, 6.28), len = rnd(30, 100);
      for (s = 0; s < len; s++) {
        ang += rnd(-0.4, 0.4); cx += Math.cos(ang); cy += Math.sin(ang) * 0.7;
        var r = rnd(1.2, 2.6);
        for (ox = -3; ox <= 3; ox++) for (oy = -3; oy <= 3; oy++) {
          var tx = (cx + ox) | 0, ty = (cy + oy) | 0;
          if (ox * ox + oy * oy <= r * r && inb(tx, ty) && get(tx, ty) !== BEDROCK && ty < WH - 2) setT(tx, ty, AIR);
        }
      }
    }
    for (var i = 0; i < world.length; i++) {                    // ore bands by depth
      if (world[i] !== STONE) continue;
      var yy = (i / WW) | 0, xx = i % WW, d = yy - (surf[xx] || 0), rr = Math.random();
      if (d > 2 && d < 24 && rr < 0.035) world[i] = COPPER;
      else if (d > 10 && d < 45 && rr < 0.055) world[i] = IRON;
      else if (d > 28 && rr < 0.072) world[i] = GOLD;
      else if (d > 45 && rr < 0.082) world[i] = DIAMOND;
      else if (d > 40 && rr < 0.09) world[i] = GEM;
    }
    for (var tr = 0; tr < 200 && chests.length < 8; tr++) {     // treasure chests in caves
      var qx = rnd(12, WW - 6) | 0, qy = rnd(WH * 0.42, WH - 4) | 0;
      if (get(qx, qy) === AIR && get(qx, qy - 1) === AIR && get(qx, qy + 1) === STONE) {
        var far = true;
        for (var ci = 0; ci < chests.length; ci++) if (Math.abs(chests[ci].x - qx) < 18) far = false;
        if (far) { setT(qx, qy, CHEST); chests.push({ x: qx, y: qy }); }
      }
    }
    var sx = 5; spawn.x = sx * TS + 2; spawn.y = (surf[sx] - 3) * TS;
    for (var cy2 = surf[sx] - 5; cy2 < surf[sx]; cy2++) { setT(sx, cy2, AIR); setT(sx + 1, cy2, AIR); }
    var gx = WW - 8, gy = WH - 6;                               // goal: the Grand Gem, deep & far
    while (gy > WH * 0.5 && get(gx, gy) === AIR) gy--;
    goal.x = gx; goal.y = gy;
    for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) if (get(gx + a, gy + b) === BEDROCK) setT(gx + a, gy + b, STONE);
    setT(gx, gy, GOAL);
    ensureSolvable();
    clouds = [];
    for (var cl = 0; cl < 10; cl++) clouds.push({ x: rnd(0, WW * TS), y: rnd(20, 150), w: rnd(60, 150), v: rnd(0.08, 0.25) });
  }
  /* BFS over non-bedrock (everything else diggable => reachable); carve tunnel as fallback */
  function ensureSolvable() {
    var stx = (spawn.x / TS) | 0, sty = (spawn.y / TS) | 0;
    var seen = new Uint8Array(WW * WH), q = [idx(stx, sty)]; seen[q[0]] = 1;
    for (var qi = 0; qi < q.length; qi++) {
      var c = q[qi], cx = c % WW, cy = (c / WW) | 0;
      var xs = [cx + 1, cx - 1, cx, cx], ys = [cy, cy, cy + 1, cy - 1];
      for (var n = 0; n < 4; n++) {
        if (inb(xs[n], ys[n])) {
          var ni = idx(xs[n], ys[n]);
          if (!seen[ni] && world[ni] !== BEDROCK) { seen[ni] = 1; q.push(ni); }
        }
      }
    }
    if (!seen[idx(goal.x, goal.y)]) {
      var x1 = stx, y1 = sty;
      while (x1 !== goal.x || y1 !== goal.y) {
        if (get(x1, y1) !== GOAL) setT(x1, y1, AIR);
        if (x1 < goal.x) x1++; else if (x1 > goal.x) x1--;
        else if (y1 < goal.y) y1++; else y1--;
      }
      setT(goal.x, goal.y, GOAL);
    }
  }

  /* ---------------- state ---------------- */
  var P = { x: 0, y: 0, w: 10, h: 20, vx: 0, vy: 0, ground: false, face: 1, hp: 100, maxhp: 100, inv: 0, dead: 0 };
  var gear = { pick: 1, sword: 1, armor: 0, gems: 0, pts: 0 };
  var enemies = [], drops = [], parts = [], msgs = [];
  var stat = { ore: 0, gem: 0, chest: 0, kill: 0 };
  var agent = { on: true, state: "EXPLORE", think: "Waking up…", hint: null, hintT: 0, tgt: null,
                path: null, pi: 0, pathT: 0, digT: null, digP: 0, atk: 0, stuck: 0, lx: 0, decideT: 0, jumpCD: 0, hist: [], exdir: 1, since: 0, planQ: [], planT: 0, anchor: null, avoidT: 0, badTs: [] };
  var cam = { x: 0, y: 0 }, keys = {}, wins = 0, frame = 0, regenT = 0, showMap = false;
  var evt = { name: "", label: "", t: 0, timer: 1900 };
  var llmEP = "", llmOn = false, llmModel = "", llmLast = 0, llmFail = 0;
  try { llmEP = (window.AGENT_LLM_ENDPOINT || "").trim() || localStorage.getItem("agent_llm_endpoint") || ""; } catch (e) {}
  var llmLog = [];   // recent LLM decisions, shown on the right while in LLM mode

  function say(t) { agent.think = t; }
  function msg(t) { msgs.push({ t: t, life: 220 }); if (msgs.length > 4) msgs.shift(); }
  function llmActive() { return llmOn && !!llmEP; }

  function resetPlayer() { P.x = spawn.x; P.y = spawn.y; P.vx = P.vy = 0; P.hp = P.maxhp; P.dead = 0; P.inv = 60; agent.path = null; agent.tgt = null; }
  function die() {
    if (P.dead) return;
    P.dead = 110;
    if (gear.pick > 1 || gear.sword > 1 || gear.armor > 0) {
      drops.push({ x: P.x, y: Math.min(P.y, (WH - 4) * TS), w: 10, h: 10, vx: rnd(-1, 1), vy: -3,
                   bag: { pick: gear.pick, sword: gear.sword, armor: gear.armor } });
      msg("💀 Died — dropped ALL equipment!");
    } else msg("💀 Died!");
    gear.pick = 1; gear.sword = 1; gear.armor = 0;
    say("Ouch. Respawning…");
    burst(P.x + P.w / 2, P.y + P.h / 2, "#e05555", 14);
  }

  /* ---------------- physics ---------------- */
  function hitSolid(x, y, w, h) {
    var x0 = (x / TS) | 0, y0 = (y / TS) | 0, x1 = ((x + w - 0.01) / TS) | 0, y1 = ((y + h - 0.01) / TS) | 0;
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (isSolid(tx, ty)) return true;
    return false;
  }
  function unstick(e) { var n = 0; while (hitSolid(e.x, e.y, e.w, e.h) && n++ < 40) e.y -= TS / 2; }
  function step(e, dtf) {
    e.vy = Math.min(e.vy + GRAV * dtf, MAXFALL);
    var nx = e.x + e.vx * dtf;
    if (!hitSolid(nx, e.y, e.w, e.h)) e.x = nx;
    else if (!hitSolid(e.x, e.y, e.w, e.h)) { var d1 = e.vx > 0 ? 1 : -1; while (!hitSolid(e.x + d1 * 0.5, e.y, e.w, e.h)) e.x += d1 * 0.5; e.vx = 0; }
    else { unstick(e); e.vx = 0; }
    var ny = e.y + e.vy * dtf; e.ground = false;
    if (!hitSolid(e.x, ny, e.w, e.h)) e.y = ny;
    else if (!hitSolid(e.x, e.y, e.w, e.h)) { var d2 = e.vy > 0 ? 1 : -1; while (!hitSolid(e.x, e.y + d2 * 0.5, e.w, e.h)) e.y += d2 * 0.5; if (e.vy > 0) e.ground = true; e.vy = 0; }
    else { unstick(e); e.vy = 0; }
  }

  /* ---------------- mining ---------------- */
  function levelUp() {
    while (gear.pts >= 4) {
      gear.pts -= 4;
      if (gear.pick <= gear.sword && gear.pick < 6) { gear.pick++; msg("⬆️ Pickaxe Lv." + gear.pick); }
      else if (gear.sword < 6) { gear.sword++; msg("⬆️ Sword Lv." + gear.sword); }
      else if (gear.armor < 6) { gear.armor++; msg("⬆️ Armor Lv." + gear.armor); }
    }
  }
  function gainOre(t) {
    gear.pts += ORE_PTS[t]; stat.ore++;
    msg("⛏️ " + ORE_NAME[t] + "!");
    levelUp();
  }
  function tryMine(tx, ty) {
    var t = get(tx, ty);
    if (!HARD[t]) return false;
    var d = Math.hypot((tx + 0.5) * TS - (P.x + P.w / 2), (ty + 0.5) * TS - (P.y + P.h / 2));
    if (d > TS * 3) return false;
    if (!agent.digT || agent.digT.x !== tx || agent.digT.y !== ty) { agent.digT = { x: tx, y: ty }; agent.digP = 0; }
    agent.digP += 1 + gear.pick * 0.8; agent.mineF = frame;
    if (frame % 5 === 0) burst((tx + 0.5) * TS, (ty + 0.5) * TS, BASECOL[t] || "#999", 1);
    if (agent.digP >= HARD[t]) {
      agent.digT = null; agent.digP = 0; agent.stuck = 0;
      if (ORE_PTS[t]) gainOre(t);
      else if (t === GEM) {
        gear.gems++; stat.gem++; msg("💎 Amethyst! (" + gear.gems + ")");
        if (gear.gems % 2 === 0 && gear.armor < 6) { gear.armor++; msg("🛡️ Armor Lv." + gear.armor); }
      }
      setT(tx, ty, AIR);
    }
    return true;
  }

  /* ---------------- chests ---------------- */
  function openChest(tx, ty) {
    setT(tx, ty, AIR);
    for (var i = 0; i < chests.length; i++) if (chests[i].x === tx && chests[i].y === ty) { chests.splice(i, 1); break; }
    stat.chest++;
    burst((tx + 0.5) * TS, (ty + 0.5) * TS, "#ffd24a", 18);
    var roll = Math.random();
    if (roll < 0.3 && gear.pick < 6) { gear.pick++; msg("🧰 Chest: shiny pickaxe! ⛏️Lv." + gear.pick); }
    else if (roll < 0.55 && gear.sword < 6) { gear.sword++; msg("🧰 Chest: sharp sword! 🗡️Lv." + gear.sword); }
    else if (roll < 0.75 && gear.armor < 6) { gear.armor++; msg("🧰 Chest: armor plate! 🛡️Lv." + gear.armor); }
    else if (roll < 0.9) { gear.gems += 3; msg("🧰 Chest: 3 gems! 💎" + gear.gems); }
    else { P.hp = Math.min(P.maxhp, P.hp + 40); msg("🧰 Chest: heart! +40 ❤️"); }
    say("Treasure chest! Lucky me.");
  }
  function checkChest() {
    var tx0 = ((P.x - 4) / TS) | 0, tx1 = ((P.x + P.w + 4) / TS) | 0;
    var ty0 = ((P.y - 4) / TS) | 0, ty1 = ((P.y + P.h + 4) / TS) | 0;
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++)
      if (get(tx, ty) === CHEST) openChest(tx, ty);
  }

  /* ---------------- enemies (slime / zombie / bat) ---------------- */
  var EK = {
    slime:  { w: 14, h: 11, hp: 14, dmg: 8,  col: "#63c74d" },
    zombie: { w: 12, h: 20, hp: 30, dmg: 13, col: "#7d9e5a" },
    bat:    { w: 12, h: 8,  hp: 8,  dmg: 6,  col: "#7a5da8" }
  };
  function spawnEnemy(force) {
    if (enemies.length >= (force ? 10 : 6)) return;
    for (var tr = 0; tr < 24; tr++) {
      var tx = rnd(2, WW - 2) | 0, ty = rnd(4, WH - 4) | 0;
      if (get(tx, ty) !== AIR || get(tx, ty - 1) !== AIR) continue;
      var d = Math.hypot(tx * TS - P.x, ty * TS - P.y);
      if (d < TS * 14 || d > TS * 48) continue;
      var depth = ty - (surf[tx] || 0), kind;
      if (depth > 6) kind = Math.random() < 0.45 ? "bat" : (Math.random() < 0.5 ? "slime" : "zombie");
      else kind = Math.random() < 0.6 ? "slime" : "zombie";
      if (kind !== "bat" && !isSolid(tx, ty + 1)) continue;
      var k = EK[kind];
      var lv = Math.max(1, Math.min(6, 1 + Math.floor(depth / 8) + (Math.random() < 0.35 ? 1 : 0)));
      var ehp = Math.round((k.hp + wins * 3) * (1 + 0.7 * (lv - 1)));
      enemies.push({ kind: kind, x: tx * TS + 1, y: ty * TS + (TS - k.h) - 1, w: k.w, h: k.h, lv: lv,
                     vx: 0, vy: 0, ground: false, hp: ehp, maxhp: ehp, hop: rnd(10, 50), face: 1, t: rnd(0, 6.28) });
      return;
    }
  }
  function updEnemies(dtf) {
    for (var i = enemies.length - 1; i >= 0; i--) {
      var s = enemies[i], k = EK[s.kind];
      var dx = P.x - s.x, dy = P.y - s.y, dist = Math.hypot(dx, dy);
      s.face = dx > 0 ? 1 : -1;
      if (s.kind === "slime") {
        if (s.ground) { s.vx *= 0.8; s.hop -= dtf;
          if (dist < TS * 16 && s.hop <= 0) { s.vx = s.face * rnd(1.2, 2.2); s.vy = -rnd(4, 6.5); s.hop = rnd(40, 85); } }
        step(s, dtf);
      } else if (s.kind === "zombie") {
        if (dist < TS * 20) {
          s.vx = s.face * 0.85;
          var fx = ((s.x + (s.face > 0 ? s.w + 2 : -3)) / TS) | 0, fy = ((s.y + s.h - 2) / TS) | 0;
          if (s.ground && isSolid(fx, fy) && !isSolid(fx, fy - 1)) s.vy = -7.2;
        } else s.vx *= 0.8;
        step(s, dtf);
      } else {                                                   // bat: flies, ignores gravity
        s.t += 0.08 * dtf;
        var sp = dist < TS * 18 ? 1.5 : 0.5;
        var mx = (dx / (dist || 1)) * sp * dtf, my = (dy / (dist || 1)) * sp * dtf + Math.sin(s.t) * 0.9 * dtf;
        if (!hitSolid(s.x + mx, s.y, s.w, s.h)) s.x += mx;
        if (!hitSolid(s.x, s.y + my, s.w, s.h)) s.y += my;
      }
      if (s.y > WH * TS + 40) s.hp = 0;
      if (!P.dead && P.inv <= 0 &&
          Math.abs((s.x + s.w / 2) - (P.x + P.w / 2)) < (s.w + P.w) / 2 &&
          Math.abs((s.y + s.h / 2) - (P.y + P.h / 2)) < (s.h + P.h) / 2) {
        var dmg = Math.max(2, Math.round(k.dmg * (1 + 0.55 * ((s.lv || 1) - 1)) + wins - gear.armor * 2));
        P.hp -= dmg; P.inv = 45; P.vx = (dx > 0 ? -1 : 1) * 3; P.vy = -3;
        burst(P.x + P.w / 2, P.y + P.h / 2, "#e05555", 6);
        if (P.hp <= 0) die();
      }
      if (s.hp <= 0) {
        burst(s.x + s.w / 2, s.y + s.h / 2, k.col, 10); stat.kill++;
        gear.pts += (s.lv || 1); levelUp();
        if ((s.lv || 1) >= 3) { gear.gems++; msg("💎 Lv" + s.lv + " " + s.kind + " dropped a gem! (" + gear.gems + ")"); if (gear.gems % 2 === 0 && gear.armor < 6) { gear.armor++; msg("🛡️ Armor Lv." + gear.armor); } }
        else msg("⚔️ " + s.kind + " Lv" + (s.lv || 1) + " down! +" + (s.lv || 1) + " pts");
        enemies.splice(i, 1);
      }
    }
  }
  function attack() {
    if (agent.atk > 0 || P.dead) return;
    agent.atk = 26;
    var rx = P.face > 0 ? P.x + P.w : P.x - 24;
    for (var i = 0; i < enemies.length; i++) {
      var s = enemies[i];
      if (s.x + s.w > rx && s.x < rx + 24 && s.y + s.h > P.y - 6 && s.y < P.y + P.h + 6) {
        s.hp -= 5 + gear.sword * 4; s.vx = P.face * 4; s.vy = -3; agent.stuck = 0;
        burst(s.x + s.w / 2, s.y + s.h / 2, "#ffe9a3", 5);
      }
    }
  }

  /* ---------------- drops & particles ---------------- */
  function updDrops(dtf) {
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i]; step(d, dtf); d.vx *= 0.92;
      if (!P.dead && Math.abs(d.x - P.x) < 16 && Math.abs(d.y - P.y) < 24) {
        gear.pick = Math.max(gear.pick, d.bag.pick); gear.sword = Math.max(gear.sword, d.bag.sword); gear.armor = Math.max(gear.armor, d.bag.armor);
        msg("🎒 Recovered your equipment!"); burst(d.x, d.y, "#ffd24a", 8); drops.splice(i, 1);
      }
    }
  }
  function burst(x, y, c, n) { for (var i = 0; i < n; i++) parts.push({ x: x, y: y, vx: rnd(-2, 2), vy: rnd(-3, 0.5), l: rnd(15, 35), c: c }); }
  function updParts(dtf) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.x += p.vx * dtf; p.y += p.vy * dtf; p.vy += 0.2 * dtf; p.l -= dtf;
      if (p.l <= 0) parts.splice(i, 1);
    }
  }

  /* ============================================================================
     AGENT BRAIN — a finite state machine that switches between behaviors, each
     driven by BFS pathfinding (Dijkstra with digging cost) + frontier exploration.
     States: EXPLORE (frontier) · SEEK_GOAL · FIGHT · FLEE · DIG · SURFACE
     ============================================================================ */
  var THINKS = {
    EXPLORE: ["Frontier ahead — let's map it.", "Unknown tiles that way →", "Exploring the dark…", "New ground to chart."],
    SEEK_GOAL: ["Path to the Grand Gem locked in.", "Following the route to treasure.", "Almost at the prize…"],
    FIGHT: ["Hostile! Engaging.", "En garde, creature!", "Combat mode."],
    FLEE: ["Too risky — retreating.", "Fall back and heal!", "Nope, running."],
    DIG: ["Tunnelling downward…", "Digging for ore."],
    SURFACE: ["Heading back up for air.", "To the surface!"],
    CHEST: ["A chest! Gimme that loot.", "Treasure nearby — on my way.", "Free loot, don't mind if I do."],
    MINE: ["Mining ore to upgrade.", "Need better gear — digging.", "More ore, more power."],
    GEMS: ["Gem hunting — armor time.", "Sparkly things, come to me."],
    HUNT: ["Hunting something my size.", "Monster farming time."],
    WIN: ["Grand Gem secured! 🎉", "Loot acquired!"]
  };
  function pickThink(st) { var p = THINKS[st] || THINKS.EXPLORE; return p[(Math.random() * p.length) | 0]; }
  function pushHist(s) { if (agent.hist[0] !== s) { agent.hist.unshift(s); if (agent.hist.length > 8) agent.hist.pop(); } }
  function badTarget(x, y) {
    for (var i = 0; i < agent.badTs.length; i++) { var b = agent.badTs[i]; if (Math.abs(b.x - x) <= 3 && Math.abs(b.y - y) <= 3) return true; }
    return false;
  }
  function banTarget() {                                     // blacklist an unreachable target so we don't re-pick it
    if (agent.tgt) { agent.badTs.push({ x: agent.tgt.x, y: agent.tgt.y, life: 900 }); if (agent.badTs.length > 4) agent.badTs.shift(); }
    agent.path = null; agent.tgt = null;
  }
  function agentPower() { return 1 + gear.sword + gear.armor * 0.6 + gear.pick * 0.2; }
  function beatable(e) { return !e || (e.lv || 1) <= agentPower() + 0.6; }
  function nearestBeatableEnemy() {
    var b = null, bd = 1e9;
    for (var i = 0; i < enemies.length; i++) { if (!beatable(enemies[i])) continue; var d = Math.hypot(enemies[i].x - P.x, enemies[i].y - P.y); if (d < bd) { bd = d; b = enemies[i]; } }
    return b ? { e: b, d: bd } : null;
  }
  function nearestEnemy() {
    var b = null, bd = 1e9;
    for (var i = 0; i < enemies.length; i++) { var d = Math.hypot(enemies[i].x - P.x, enemies[i].y - P.y); if (d < bd) { bd = d; b = enemies[i]; } }
    return b ? { e: b, d: bd } : null;
  }
  function nearestKnownChest() {
    var b = null, bd = 1e9, pcx = (P.x / TS) | 0, pcy = (P.y / TS) | 0;
    for (var i = 0; i < chests.length; i++) {
      var c = chests[i]; if (!explored[idx(c.x, c.y)] || get(c.x, c.y) !== CHEST) continue;
      var d = Math.abs(c.x - pcx) + Math.abs(c.y - pcy); if (d < bd) { bd = d; b = c; }
    }
    return b ? { x: b.x, y: b.y, d: bd } : null;
  }
  function nearestKnownOre() {
    var b = null, bd = 1e9, pcx = (P.x / TS) | 0, pcy = (P.y / TS) | 0;
    for (var y = Math.max(1, pcy - 26); y < Math.min(WH - 1, pcy + 26); y++)
      for (var x = Math.max(1, pcx - 34); x < Math.min(WW - 1, pcx + 34); x++) {
        var ii = idx(x, y); if (!explored[ii]) continue; var t = world[ii];
        if (!ORE_PTS[t] && t !== GEM) continue;
        var d = Math.abs(x - pcx) + Math.abs(y - pcy); if (d < bd) { bd = d; b = { x: x, y: y }; }
      }
    return b;
  }
  function nearestKnownGem() {
    var b = null, bd = 1e9, pcx = (P.x / TS) | 0, pcy = (P.y / TS) | 0;
    for (var y = Math.max(1, pcy - 26); y < Math.min(WH - 1, pcy + 26); y++)
      for (var x = Math.max(1, pcx - 34); x < Math.min(WW - 1, pcx + 34); x++) {
        var ii = idx(x, y); if (!explored[ii] || world[ii] !== GEM) continue;
        var d = Math.abs(x - pcx) + Math.abs(y - pcy); if (d < bd) { bd = d; b = { x: x, y: y }; }
      }
    return b;
  }

  /* ---- Dijkstra path over tiles (AIR cheap, diggable costs ~hardness, bedrock blocked) ---- */
  function passCost(t) { if (t === AIR || t === GOAL || t === CHEST) return 1; if (t === BEDROCK) return Infinity; if (HARD[t]) return 4 + HARD[t] * 0.5; return Infinity; }
  function bfsPath(sx, sy, gx, gy) {
    if (!inb(sx, sy) || !inb(gx, gy)) return null;
    var N = WW * WH, dist = new Float32Array(N), prev = new Int32Array(N);
    dist.fill(Infinity); prev.fill(-1);
    var start = idx(sx, sy), goalI = idx(gx, gy); dist[start] = 0;
    var heap = [[0, start]];
    function push(d, i) { heap.push([d, i]); var c = heap.length - 1; while (c > 0) { var p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; var t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var c = 0; for (; ;) { var l = 2 * c + 1, r = l + 1, s = c; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === c) break; var t = heap[s]; heap[s] = heap[c]; heap[c] = t; c = s; } } return top; }
    var exp = 0;
    while (heap.length) {
      var cur = pop(), cd = cur[0], ci = cur[1];
      if (cd > dist[ci]) continue;
      if (ci === goalI || ++exp > 12000) break;
      var cx = ci % WW, cy = (ci / WW) | 0, nx = [cx + 1, cx - 1, cx, cx], ny = [cy, cy, cy + 1, cy - 1];
      for (var k = 0; k < 4; k++) {
        if (!inb(nx[k], ny[k])) continue;
        var ni = idx(nx[k], ny[k]), c2 = passCost(world[ni]);
        if (c2 === Infinity) continue;
        var nd = cd + c2; if (nd < dist[ni]) { dist[ni] = nd; prev[ni] = ci; push(nd, ni); }
      }
    }
    if (!isFinite(dist[goalI])) return null;
    var path = [], p = goalI, guard = 0;
    while (p !== -1 && guard++ < 5000) { path.push({ x: p % WW, y: (p / WW) | 0 }); p = prev[p]; }
    path.reverse(); return path;
  }
  /* ---- frontier: nearest explored-air tile bordering the unknown (BFS over explored air) ---- */
  function nearestFrontier() {
    var sx = (P.x / TS) | 0, sy = (P.y / TS) | 0;
    if (!inb(sx, sy)) return null;
    var seen = new Uint8Array(WW * WH), q = [idx(sx, sy)]; seen[q[0]] = 1;
    for (var qi = 0; qi < q.length && qi < 8000; qi++) {
      var c = q[qi], cx = c % WW, cy = (c / WW) | 0, xs = [cx + 1, cx - 1, cx, cx], ys = [cy, cy, cy + 1, cy - 1], k, ni;
      for (k = 0; k < 4; k++) if (inb(xs[k], ys[k]) && !explored[idx(xs[k], ys[k])] && world[idx(xs[k], ys[k])] !== BEDROCK) {
        if ((cx !== sx || cy !== sy) && cy + 2 >= (surf[cx] || 0) && !badTarget(cx, cy)) return { x: cx, y: cy };
      }
      for (k = 0; k < 4; k++) {
        if (!inb(xs[k], ys[k])) continue; ni = idx(xs[k], ys[k]);
        if (seen[ni]) continue; seen[ni] = 1;
        var t = world[ni];
        if (explored[ni] && (t === AIR || t === GOAL || t === CHEST)) q.push(ni);
      }
    }
    return null;
  }
  function randFar() {
    for (var i = 0; i < 40; i++) {
      var tx = ((P.x / TS) | 0) + ((rnd(8, 40) | 0) * (Math.random() < 0.75 ? agent.exdir : -agent.exdir)), ty = ((P.y / TS) | 0) + (rnd(-4, 28) | 0);
      tx = Math.max(2, Math.min(WW - 3, tx)); ty = Math.max(2, Math.min(WH - 3, ty));
      if (world[idx(tx, ty)] !== BEDROCK) return { x: tx, y: ty };
    }
    return { x: goal.x, y: goal.y };
  }
  function enemyStandTile(e) {                              // reachable ground spot near an enemy (not a floating air tile)
    var ex = Math.max(1, Math.min(WW - 2, ((e.x + e.w / 2) / TS) | 0)), ey = Math.max(1, Math.min(WH - 2, ((e.y + e.h - 2) / TS) | 0));
    for (var y = ey; y < WH - 1; y++) { if (get(ex, y) !== BEDROCK && !isSolid(ex, y) && isSolid(ex, y + 1)) return { x: ex, y: y }; }
    return { x: ex, y: ey };
  }
  function chooseTarget(st, ne) {
    if (st === "FLEE" && ne) return { x: Math.max(2, Math.min(WW - 3, ((P.x / TS) | 0) + (P.x < ne.e.x ? -16 : 16))), y: (P.y / TS) | 0 };
    if (st === "FIGHT" && ne) return enemyStandTile(ne.e);
    if (st === "CHEST") { var ch = nearestKnownChest(); return ch ? { x: ch.x, y: ch.y } : (nearestFrontier() || randFar()); }
    if (st === "MINE") { var o = nearestKnownOre(); return o ? o : { x: Math.max(2, Math.min(WW - 3, ((P.x / TS) | 0) + agent.exdir * 6)), y: Math.min(WH - 3, ((P.y / TS) | 0) + 10) }; }
    if (st === "GEMS") { var g = nearestKnownGem(); return g ? g : { x: (P.x / TS) | 0, y: Math.min(WH - 3, ((P.y / TS) | 0) + 14) }; }
    if (st === "HUNT") { var be = nearestBeatableEnemy(); return be ? enemyStandTile(be.e) : (nearestFrontier() || randFar()); }
    if (st === "SEEK_GOAL") return { x: goal.x, y: goal.y };
    if (st === "DIG") return { x: (P.x / TS) | 0, y: Math.min(WH - 3, ((P.y / TS) | 0) + 16) };
    if (st === "SURFACE") { var cx = Math.max(0, Math.min(WW - 1, (P.x / TS) | 0)); return { x: cx, y: Math.max(2, (surf[cx] || 40) - 1) }; }
    return nearestFrontier() || randFar();
  }
  function decide() {
    if (P.dead) return;
    if (llmActive() && agent.planQ.length) {                        // advance the plan on real accomplishment (or generous timeout)
      agent.planT--;
      var curG = agent.planQ[0], sn = agent.snap || {}, gdone = false;
      if (curG === "mine_ore") gdone = (stat.ore - (sn.ore || 0) >= 2) || !nearestKnownOre();
      else if (curG === "collect_gems") gdone = (stat.gem - (sn.gem || 0) >= 1) || !nearestKnownGem();
      else if (curG === "open_chest") gdone = (stat.chest - (sn.chest || 0) >= 1) || !nearestKnownChest();
      else if (curG === "fight" || curG === "hunt") gdone = (stat.kill - (sn.kill || 0) >= 1) || !nearestBeatableEnemy();
      else if (curG === "dig_deep") gdone = (P.y / TS - (sn.py || 0)) >= 6;
      else if (curG === "explore" || curG === "explore_left" || curG === "explore_right") gdone = (exploredCount - (sn.exp || 0)) >= 140;
      else if (curG === "surface") gdone = (P.y / TS) <= ((surf[(P.x / TS) | 0] || 40) + 1);
      if (gdone || agent.planT <= 0) {
        agent.planQ.shift(); agent.planT = 50;
        agent.snap = { ore: stat.ore, gem: stat.gem, chest: stat.chest, kill: stat.kill, py: P.y / TS, exp: exploredCount };
        if (agent.planQ.length) { agent.hint = agent.planQ[0]; agent.hintT = 999; agent.path = null; pushHist("»" + agent.planQ[0]); }
        else { agent.hintT = 0; agent.path = null; }               // plan done: hand control back to auto until next reply
      }
    }
    var ne = nearestEnemy(), hpr = P.hp / P.maxhp;
    var goalKnown = explored[idx(goal.x, goal.y)] && get(goal.x, goal.y) === GOAL;
    var chest = nearestKnownChest();
    var strong = ne && !beatable(ne.e);
    var h = agent.hintT > 0 ? agent.hint : null;
    var lat = llmActive() ? (agent.latent || "loot") : "loot";              // latent policy: how AUTO handles surprises
    if (h === "explore_left") agent.exdir = -1; else if (h === "explore_right") agent.exdir = 1;
    var busy = (h === "mine_ore" || h === "collect_gems" || h === "open_chest" || h === "dig_deep" || h === "dig_down" || h === "surface" || h === "seek_goal");
    var fightR = lat === "aggressive" ? 10 : (lat === "rush" ? 3 : 7);
    var o2 = nearestKnownOre(), pcx2 = (P.x / TS) | 0, pcy2 = (P.y / TS) | 0;
    var oreNear = o2 && (Math.abs(o2.x - pcx2) + Math.abs(o2.y - pcy2)) < 14;
    var st;
    if (ne && ne.d < TS * 6 && (hpr < (lat === "cautious" ? 0.6 : 0.35) || strong)) st = "FLEE";
    else if ((h === "avoid" || lat === "cautious") && ne && ne.d < TS * 8) st = "FLEE";
    else if (ne && ne.d < TS * fightR && !strong && (!busy || lat === "aggressive") && agent.avoidT <= 0) st = "FIGHT";
    else if (h === "open_chest" && chest) st = "CHEST";
    else if (h === "mine_ore") st = "MINE";
    else if (h === "collect_gems") st = "GEMS";
    else if (h === "hunt") st = "HUNT";
    else if (h === "dig_deep" || h === "dig_down") st = "DIG";
    else if (h === "surface" && hpr < 0.9) st = "SURFACE";
    else if (h === "seek_goal" && goalKnown) st = "SEEK_GOAL";
    else if (goalKnown && gear.sword >= 4) st = "SEEK_GOAL";                // chase the Grand Gem only once decently geared
    else if (chest && chest.d < (lat === "rush" ? 8 : 40)) st = "CHEST";
    else if (lat === "loot" && oreNear) st = "MINE";
    else st = "EXPLORE";
    var changed = st !== agent.state; agent.state = st;
    if (changed) { agent.path = null; agent.since = 0; if (!llmActive()) say(pickThink(st)); pushHist(st); }
    else agent.since++;
    if (st === "EXPLORE" && agent.since > 26) { agent.exdir = -agent.exdir; agent.since = 0; agent.tgt = null; agent.path = null; }   // break explore loops
    if (agent.replanT === undefined) agent.replanT = 0;
    agent.replanT--;
    var noPath = !agent.path || agent.pi >= agent.path.length;
    if (noPath || agent.replanT <= 0 || agent.stuck > 110) {
      var t = chooseTarget(st, ne); agent.tgt = t;
      if (t) { agent.path = bfsPath(((P.x + P.w / 2) / TS) | 0, ((P.y + P.h - 2) / TS) | 0, t.x, t.y); agent.pi = 0; }
      agent.replanT = 40; agent.hopN = 0; if (agent.stuck > 110) agent.stuck = 60;
    }
    if (agent.hintT > 0) agent.hintT -= 15;
  }
  function followPath() {}
  function moveToward(txp, typ) {
    var mid = ((P.x + P.w / 2) / TS) | 0, footY = ((P.y + P.h - 3) / TS) | 0, headY = ((P.y + 3) / TS) | 0;
    var pcx = (P.x + P.w / 2) / TS, pcy = (P.y + P.h / 2) / TS, dx = (txp + 0.5) - pcx, dy = (typ + 0.5) - pcy;
    if (Math.abs(dx) > 0.45) {
      P.face = dx > 0 ? 1 : -1; P.vx = P.face * MOVE;
      var fx = mid + P.face, bf = isSolid(fx, footY), bh = isSolid(fx, headY);
      if (bf || bh) {
        var stepUp = bf && !bh && !isSolid(fx, footY - 1) && !isSolid(fx, headY - 1) && !isSolid(mid, headY - 1);
        if (stepUp && P.ground && agent.jumpCD <= 0) { P.vy = -JUMP; agent.jumpCD = 16; }
        else tryMine(fx, bh ? headY : footY);
      }
    } else P.vx *= 0.6;
    if (dy < -1.2) {
      var uy = ((P.y - 3) / TS) | 0;
      if (isSolid(mid, uy)) { if (agent.mineF !== frame) tryMine(mid, uy); agent.hopN = 0; }
      else if (P.ground && agent.jumpCD <= 0) {
        P.vy = -JUMP; agent.jumpCD = 16;
        agent.hopN = (agent.hopN || 0) + 1;
        if (agent.hopN > 4) { agent.hopN = 0; banTarget(); agent.exdir = -agent.exdir; }   // unreachable overhead target: blacklist & re-target
      }
    } else if (dy > 1.2 && Math.abs(dx) < 1.3) {
      var by = ((P.y + P.h + 2) / TS) | 0;
      if (isSolid(mid, by) && get(mid, by) !== BEDROCK && agent.mineF !== frame) tryMine(mid, by);
      else if (!isSolid(mid, by) && P.ground) {                 // hole is open below but we're perched on its edge
        var hc = (mid + 0.5) * TS - (P.x + P.w / 2);
        if (hc > 1) P.vx = 0.9; else if (hc < -1) P.vx = -0.9;
        else if (agent.mineF !== frame) {                       // centered yet still supported: chew the edge tile under us
          var lft = ((P.x + 1) / TS) | 0, rgt = ((P.x + P.w - 1) / TS) | 0;
          if (lft !== mid && isSolid(lft, by) && get(lft, by) !== BEDROCK) tryMine(lft, by);
          else if (rgt !== mid && isSolid(rgt, by) && get(rgt, by) !== BEDROCK) tryMine(rgt, by);
        }
      }
    }
  }
  function nextWaypoint() {
    if (!agent.path || agent.pi >= agent.path.length) return null;
    var pcx = (P.x + P.w / 2) / TS, pcy = (P.y + P.h / 2) / TS, guard = 0;
    while (agent.pi < agent.path.length - 1 && guard++ < 300) {
      var n = agent.path[agent.pi];
      if (Math.abs((n.x + 0.5) - pcx) < 1.15 && Math.abs((n.y + 0.5) - pcy) < 1.5) agent.pi++; else break;
    }
    return agent.path[agent.pi];
  }
  function act(dtf) {
    if (P.dead) return;
    if (agent.jumpCD > 0) agent.jumpCD -= dtf;
    if (agent.avoidT > 0) agent.avoidT -= dtf;
    for (var bi = agent.badTs.length - 1; bi >= 0; bi--) { agent.badTs[bi].life -= dtf; if (agent.badTs[bi].life <= 0) agent.badTs.splice(bi, 1); }
    if (!agent.anchor) agent.anchor = { x: P.x, y: P.y };
    if (Math.hypot(P.x - agent.anchor.x, P.y - agent.anchor.y) > TS * 1.5) { agent.anchor.x = P.x; agent.anchor.y = P.y; agent.stuck = 0; }
    else agent.stuck += dtf;                                  // counts even mid-air: hopping in place IS stuck
    var ne = nearestEnemy();
    if (ne && ne.d < TS * 2.6) { P.face = ne.e.x > P.x ? 1 : -1; attack(); }
    if (ne && ne.d < TS * 3.5 && P.hp / P.maxhp >= 0.35 && agent.avoidT <= 0) {   // close-range melee
      var fmid = ((P.x + P.w / 2) / TS) | 0, ffoot = ((P.y + P.h - 3) / TS) | 0, fhead = ((P.y + 3) / TS) | 0, edx = ne.e.x - P.x;
      if (agent.atk > 10 && ne.d < TS * 1.4) { P.vx = (edx > 0 ? -1 : 1) * MOVE * 0.8; }        // kite while the sword recovers
      else if (Math.abs(edx) > TS * 0.6) {
        P.face = edx > 0 ? 1 : -1; P.vx = P.face * MOVE;
        var ffx = fmid + P.face;
        if (isSolid(ffx, ffoot) || isSolid(ffx, fhead)) {
          if (P.ground && agent.jumpCD <= 0 && !isSolid(ffx, ffoot - 1) && !isSolid(fmid, fhead - 1)) { P.vy = -JUMP; agent.jumpCD = 16; }
          else tryMine(ffx, isSolid(ffx, fhead) ? fhead : ffoot);
        }
      } else P.vx *= 0.6;
      if (ne.e.y + ne.e.h < P.y + 2 && P.ground && agent.jumpCD <= 0 && !isSolid(fmid, ((P.y - 3) / TS) | 0)) { P.vy = -JUMP; agent.jumpCD = 16; }  // hop at bats only with clear headroom
      if (agent.stuck > 120) { agent.avoidT = 300; agent.stuck = 0; agent.anchor = { x: P.x, y: P.y }; }   // enemy unreachable: disengage for a while
      return;
    }
    var wp = nextWaypoint();
    var tx = wp ? wp.x : (agent.tgt ? agent.tgt.x : null), ty = wp ? wp.y : (agent.tgt ? agent.tgt.y : null);
    if (tx !== null) moveToward(tx, ty); else P.vx *= 0.6;
    if (agent.stuck > 45 && tx !== null && agent.mineF !== frame) {
      var mid = ((P.x + P.w / 2) / TS) | 0, cy = ((P.y + P.h / 2) / TS) | 0, ddx = tx - mid, ddy = ty - cy;
      var dgx, dgy;                                          // mine ONE tile per frame so digP accumulates
      if (Math.abs(ddx) >= Math.abs(ddy)) { dgx = mid + (ddx >= 0 ? 1 : -1); dgy = ((P.y + P.h - 3) / TS) | 0; if (!isSolid(dgx, dgy)) dgy = ((P.y + 3) / TS) | 0; }
      else if (ddy < 0) { dgx = mid; dgy = ((P.y - 3) / TS) | 0; }
      else { dgx = mid; dgy = ((P.y + P.h + 2) / TS) | 0; }
      if (!isSolid(dgx, dgy) || get(dgx, dgy) === BEDROCK) {
        dgx = mid; dgy = ((P.y + P.h + 2) / TS) | 0;
        if (!isSolid(dgx, dgy)) { var l2 = ((P.x + 1) / TS) | 0, r2 = ((P.x + P.w - 1) / TS) | 0; if (isSolid(l2, dgy) && get(l2, dgy) !== BEDROCK) dgx = l2; else if (isSolid(r2, dgy) && get(r2, dgy) !== BEDROCK) dgx = r2; }
      }
      tryMine(dgx, dgy);
      if (agent.stuck > 170) { banTarget(); agent.exdir = -agent.exdir; agent.stuck = 0; agent.anchor = { x: P.x, y: P.y }; }
    }
  }

  /* ---------------- optional LLM brain (via YOUR serverless proxy; no key here) ---------------- */
  function askLLM() {
    if (!llmActive() || P.dead || document.hidden) return;
    var now = Date.now(); if (now - llmLast < 15000 || now < llmFail) return; llmLast = now;
    var ne = nearestEnemy(), pcx = Math.max(0, Math.min(WW - 1, (P.x / TS) | 0)), pcy = (P.y / TS) | 0;
    var eInfo = null;
    if (ne) {
      var et = enemyStandTile(ne.e);
      eInfo = { kind: ne.e.kind, lv: ne.e.lv || 1, distTiles: Math.round(ne.d / TS), dir: (ne.e.x < P.x ? "left" : "right"),
        above: (ne.e.y + ne.e.h < P.y), reachable: !!bfsPath(pcx, ((P.y + P.h - 2) / TS) | 0, et.x, et.y), beatable: beatable(ne.e) };
    }
    var chest = nearestKnownChest();
    var body = { hp: Math.round(P.hp), maxhp: P.maxhp, gems: gear.gems, pick: gear.pick, sword: gear.sword, armor: gear.armor,
      power: Math.round(agentPower() * 10) / 10, depth: Math.round(pcy - (surf[pcx] || 40)), state: agent.state, wins: wins,
      enemyNear: !!(ne && ne.d < TS * 10), enemy: eInfo, chestKnown: !!chest, chestDist: chest ? chest.d : null,
      goalKnown: !!(explored[idx(goal.x, goal.y)] && get(goal.x, goal.y) === GOAL),
      exploredPct: Math.round(100 * exploredCount / (WW * WH)),
      surroundings: { solidBelow: isSolid(pcx, pcy + 1), solidLeft: isSolid(pcx - 1, pcy), solidRight: isSolid(pcx + 1, pcy) },
      recentActions: agent.hist.slice(0, 6), lastPlan: agent.lastPlan || [], planLeft: agent.planQ.length, latent: agent.latent || "loot", event: evt.name || "none" };
    try {
      fetch(llmEP, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          llmFail = 0;
          if (j && j.model) llmModel = String(j.model).slice(0, 24);
          if (j && j.thought) say(String(j.thought).slice(0, 64));
          var HL = ["explore", "explore_left", "explore_right", "mine_ore", "collect_gems", "dig_deep", "open_chest", "fight", "hunt", "avoid", "seek_goal", "surface"];
          var plan = [];
          if (j && j.plan && j.plan.length) for (var q = 0; q < j.plan.length && plan.length < 4; q++) { if (HL.indexOf(String(j.plan[q])) >= 0) plan.push(String(j.plan[q])); }
          if (!plan.length && j && j.hint && HL.indexOf(String(j.hint)) >= 0) plan = [String(j.hint)];
          var LAT = ["loot", "aggressive", "cautious", "rush"];
          if (j && j.latent && LAT.indexOf(String(j.latent)) >= 0) agent.latent = String(j.latent);
          if (plan.length) { agent.planQ = plan.slice(); agent.lastPlan = plan.slice(); agent.planT = 50; agent.hint = plan[0]; agent.hintT = 999; agent.path = null;
            agent.snap = { ore: stat.ore, gem: stat.gem, chest: stat.chest, kill: stat.kill, py: P.y / TS, exp: exploredCount }; }
          llmLog.unshift({ hint: (plan.length ? plan.join(" → ") : ((j && j.hint) || "?")) + " ⋄" + (agent.latent || "loot").toUpperCase(), thought: (j && j.thought) || "", life: 600 });
          if (llmLog.length > 5) llmLog.pop();
        })
        .catch(function () { llmFail = Date.now() + 60000; });
    } catch (e) { llmFail = Date.now() + 60000; }
  }

  /* ---------------- fog / goal / world reset ---------------- */
  function reveal() {
    var cx = (P.x / TS) | 0, cy = (P.y / TS) | 0, R = 9;
    for (var y = cy - R; y <= cy + R; y++) for (var x = cx - R; x <= cx + R; x++)
      if (inb(x, y) && !explored[idx(x, y)] && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= R * R) { explored[idx(x, y)] = 1; exploredCount++; }
  }
  function checkGoal() {
    if (get(goal.x, goal.y) !== GOAL) return;
    var d = Math.hypot((goal.x + 0.5) * TS - (P.x + P.w / 2), (goal.y + 0.5) * TS - (P.y + P.h / 2));
    if (d < TS * 1.8) {
      setT(goal.x, goal.y, AIR); wins++; gear.gems += 5;
      msg("🏆 Grand Gem found! +5 💎 (run " + wins + ")"); say(pickThink("WIN"));
      burst((goal.x + 0.5) * TS, (goal.y + 0.5) * TS, "#ffd54a", 34); regenT = 280;
    }
  }
  /* ---------------- random world events: meteor / monster wave / supply drop ---------------- */
  function revealAt(cx, cy, R) {
    for (var y = cy - R; y <= cy + R; y++) for (var x = cx - R; x <= cx + R; x++)
      if (inb(x, y) && !explored[idx(x, y)] && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= R * R) { explored[idx(x, y)] = 1; exploredCount++; }
  }
  function meteorStrike() {
    var cx = Math.max(6, Math.min(WW - 7, ((P.x / TS) | 0) + ((rnd(10, 26) | 0) * (Math.random() < 0.5 ? 1 : -1))));
    var cy = Math.max(6, Math.min(WH - 8, surf[cx] || 40));
    for (var y = cy - 3; y <= cy + 3; y++) for (var x = cx - 4; x <= cx + 4; x++) {
      if (!inb(x, y) || get(x, y) === BEDROCK) continue;
      var dd = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (dd <= 8) setT(x, y, AIR);
      else if (dd <= 16 && get(x, y) !== AIR && Math.random() < 0.55) setT(x, y, Math.random() < 0.6 ? GOLD : DIAMOND);
    }
    for (var i = 0; i < 42; i++) parts.push({ x: (cx + rnd(-3, 3)) * TS, y: (cy + rnd(-4, 0)) * TS, vx: rnd(-3, 3), vy: rnd(-5, -0.5), l: rnd(25, 60), c: i % 2 ? "#ff9c40" : "#ffd54a" });
    revealAt(cx, cy, 7);
    msg("☄️ Meteor strike! Rare ore exposed."); evt.name = "meteor"; evt.label = "METEOR STRIKE — rare ore!"; evt.t = 620;
  }
  function monsterWave() {
    for (var i = 0; i < 3; i++) spawnEnemy(true);
    msg("👹 Monster wave incoming!"); evt.name = "wave"; evt.label = "MONSTER WAVE!"; evt.t = 620;
  }
  function supplyDrop() {
    for (var tr = 0; tr < 24; tr++) {
      var cx = Math.max(3, Math.min(WW - 4, ((P.x / TS) | 0) + ((rnd(6, 18) | 0) * (Math.random() < 0.5 ? 1 : -1))));
      var cy = (surf[cx] || 40) - 1;
      if (!inb(cx, cy) || get(cx, cy) !== AIR) continue;
      setT(cx, cy, CHEST); chests.push({ x: cx, y: cy }); revealAt(cx, cy, 5);
      burst((cx + 0.5) * TS, (cy + 0.5) * TS, "#ffd24a", 14);
      msg("🎁 Supply chest dropped nearby!"); evt.name = "supply"; evt.label = "SUPPLY DROP — free chest!"; evt.t = 620;
      return;
    }
  }
  function updEvents(dtf) {
    if (evt.t > 0) { evt.t -= dtf; if (evt.t <= 0) evt.name = ""; }
    evt.timer -= dtf;
    if (evt.timer <= 0) {
      evt.timer = rnd(1700, 3200);
      var r = Math.random();
      if (r < 0.34) meteorStrike(); else if (r < 0.67) monsterWave(); else supplyDrop();
    }
  }
  function newWorld(keepGear) {
    generate(); enemies.length = 0; drops.length = 0; parts.length = 0;
    if (!keepGear) { gear.pick = 1; gear.sword = 1; gear.armor = 0; gear.gems = 0; gear.pts = 0; wins = 0; }
    resetPlayer(); agent.state = "EXPLORE"; agent.path = null; agent.stuck = 0; agent.planQ.length = 0; agent.snap = null; regenT = 0; showMap = false;
    evt.name = ""; evt.label = ""; evt.t = 0; evt.timer = 1900;
    msg("🌍 New world (procedurally generated, solvable ✔)"); say("A fresh world to conquer!");
  }

  /* ---------------- manual controls ---------------- */
  function manual() {
    var L = keys.ArrowLeft || keys.a, R = keys.ArrowRight || keys.d;
    if (L) { P.vx = -MOVE; P.face = -1; } else if (R) { P.vx = MOVE; P.face = 1; } else P.vx *= 0.7;
    if ((keys.ArrowUp || keys.w || keys[" "]) && P.ground) P.vy = -JUMP;
    if (keys.x || keys.j) attack();
    if (keys.z || keys.k || keys.ArrowDown) {
      var fx = (((P.x + P.w / 2) / TS) + P.face) | 0, fy = ((P.y + P.h - 5) / TS) | 0;
      if (keys.ArrowDown || !isSolid(fx, fy)) tryMine(((P.x + P.w / 2) / TS) | 0, ((P.y + P.h + 2) / TS) | 0); else tryMine(fx, fy);
    }
  }

  /* ---------------- HUD (DOM) ---------------- */
  function hud() {
    var hb = document.getElementById("tw-hpbar"); if (hb) hb.style.width = Math.max(0, P.hp / P.maxhp * 100) + "%";
    var ge = document.getElementById("tw-gear"); if (ge) ge.textContent = "⛏️Lv" + gear.pick + " 🗡️Lv" + gear.sword + " 🛡️Lv" + gear.armor + " 💎" + gear.gems + " 🏆" + wins;
    var stt = document.getElementById("tw-state");
    if (stt) stt.textContent = !agent.on ? "MANUAL" : (llmActive() ? ("🧠 " + (llmModel || (Date.now() < llmFail ? "offline" : "…")) + " · " + agent.state) : ("BFS+Frontier+FSM · " + agent.state));
    var lb = document.getElementById("tw-llm"); if (lb) { lb.textContent = llmActive() ? "🧠 LLM: ON" : "🧠 LLM: OFF"; lb.className = llmActive() ? "on" : ""; }
  }

  /* ---------------- render ---------------- */
  function wallColor(x, y) { var d = y - (surf[x] || 0); if (d < 0) return null; if (d < 6) return "#241a10"; if (d < 26) return "#1e2129"; return "#15181e"; }
  function drawSky(W, H) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#5aa6e0"); g.addColorStop(0.55, "#8fc9ef"); g.addColorStop(1, "#d7ecfa");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.85)";                       // clouds
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i]; c.x += c.v; if (c.x - c.w > WW * TS) c.x = -c.w;
      var sxp = c.x - cam.x * 0.3, syp = c.y - cam.y * 0.1;
      ctx.fillRect(sxp, syp, c.w, 12); ctx.fillRect(sxp + 12, syp - 8, c.w - 30, 12); ctx.fillRect(sxp + 24, syp - 14, c.w - 60, 12);
    }
    ctx.fillStyle = "rgba(70,120,80,0.35)";                         // far hill parallax
    ctx.beginPath(); ctx.moveTo(0, H);
    for (var x = 0; x <= WW; x += 4) { var hx = x * TS - cam.x * 0.5, hy = ((surf[Math.min(WW - 1, x)] || 40) + 6) * TS - cam.y * 0.5; ctx.lineTo(hx, hy); }
    ctx.lineTo(WW * TS, H); ctx.closePath(); ctx.fill();
  }
  function drawChar(px, py, face) {
    ctx.fillStyle = "#3a2f28"; ctx.fillRect(px + 1, py + 14, 3, 6); ctx.fillRect(px + 6, py + 14, 3, 6);  // legs
    ctx.fillStyle = "#2f6feb"; ctx.fillRect(px + 1, py + 7, 8, 8);                                        // torso
    ctx.fillStyle = "#1c4fb0"; ctx.fillRect(px + 1, py + 7, 8, 2);
    ctx.fillStyle = "#f3c89b"; ctx.fillRect(px + 1, py + 1, 8, 6);                                        // head
    ctx.fillStyle = "#5a3b22"; ctx.fillRect(px + 1, py, 8, 3);                                            // hair
    ctx.fillStyle = "#20242a"; ctx.fillRect(px + (face > 0 ? 6 : 2), py + 3, 2, 2);                       // eye
    var mining = !!agent.digT && !P.dead;
    if (agent.atk > 16) {
      ctx.strokeStyle = "#e9edf2"; ctx.lineWidth = 2; ctx.beginPath();
      ctx.arc(px + (face > 0 ? 9 : 1), py + 9, 10, face > 0 ? -1.1 : 2.0, face > 0 ? 1.1 : 4.2); ctx.stroke();
    } else {
      var hy = py + 9 + (mining ? Math.sin(frame * 0.5) * 3 : 0);                                          // pickaxe
      ctx.strokeStyle = "#8a5a2b"; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(px + (face > 0 ? 8 : 2), py + 10); ctx.lineTo(px + (face > 0 ? 13 : -3), hy); ctx.stroke();
      ctx.strokeStyle = "#c9ced6"; ctx.beginPath();
      ctx.moveTo(px + (face > 0 ? 11 : -1), hy - 3); ctx.lineTo(px + (face > 0 ? 15 : -5), hy + 2); ctx.stroke();
    }
  }
  function drawEnemy(s) {
    var ex = s.x - cam.x, ey = s.y - cam.y;
    if (s.kind === "slime") {
      var sq = s.ground ? 0 : 2;
      ctx.fillStyle = "#3fae3a"; ctx.fillRect(ex, ey + 3 - sq, s.w, s.h - 3 + sq);
      ctx.fillStyle = "#63c74d"; ctx.fillRect(ex + 1, ey + 2 - sq, s.w - 2, 4);
      ctx.fillStyle = "#fff"; ctx.fillRect(ex + 3, ey + 5 - sq, 3, 3); ctx.fillRect(ex + s.w - 6, ey + 5 - sq, 3, 3);
      ctx.fillStyle = "#123c0e"; ctx.fillRect(ex + 4 + (s.face > 0 ? 1 : 0), ey + 6 - sq, 1.6, 1.6); ctx.fillRect(ex + s.w - 5 + (s.face > 0 ? 1 : 0), ey + 6 - sq, 1.6, 1.6);
    } else if (s.kind === "zombie") {
      ctx.fillStyle = "#3d5a2e"; ctx.fillRect(ex + 1, ey + s.h - 6, 4, 6); ctx.fillRect(ex + s.w - 5, ey + s.h - 6, 4, 6);
      ctx.fillStyle = "#5f7a45"; ctx.fillRect(ex + 1, ey + 6, s.w - 2, s.h - 11);                          // torso
      ctx.fillStyle = "#7d9e5a"; ctx.fillRect(ex + 2, ey, s.w - 4, 7);                                      // head
      ctx.fillStyle = "#233"; ctx.fillRect(ex + 3, ey + 2, 2, 2); ctx.fillRect(ex + s.w - 5, ey + 2, 2, 2);
      ctx.fillStyle = "#5f7a45"; var sw = Math.sin(frame * 0.15) * 2; ctx.fillRect(ex + (s.face > 0 ? s.w - 2 : -2), ey + 7 + sw, 4, 3);   // outstretched arm
    } else {
      var flap = Math.sin(frame * 0.4) * 4;
      ctx.fillStyle = "#5a3f80"; ctx.fillRect(ex + (s.face > 0 ? -3 : s.w - 1), ey + 1, 4, 3 + flap); ctx.fillRect(ex + (s.face > 0 ? s.w - 1 : -3), ey + 1, 4, 3 + flap);
      ctx.fillStyle = "#7a5da8"; ctx.fillRect(ex + 3, ey + 1, s.w - 6, 6);
      ctx.fillStyle = "#ff5a5a"; ctx.fillRect(ex + 4, ey + 2, 1.6, 1.6); ctx.fillRect(ex + s.w - 5, ey + 2, 1.6, 1.6);
    }
    var beat = beatable(s), lv = s.lv || 1;
    if (s.maxhp && s.hp < s.maxhp) { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(ex, ey - 3, s.w, 2); ctx.fillStyle = beat ? "#63c74d" : "#e05555"; ctx.fillRect(ex, ey - 3, s.w * Math.max(0, s.hp / s.maxhp), 2); }
    ctx.font = "bold 8px 'Source Sans 3', sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = beat ? "#8fe388" : (lv - agentPower() > 1.6 ? "#ff6a6a" : "#ffcf5a");
    ctx.fillText("Lv" + lv, ex + s.w / 2, ey - 5); ctx.textAlign = "left";
  }
  function drawMapOverlay(W, H) {
    ctx.fillStyle = "rgba(8,10,14,0.9)"; ctx.fillRect(0, 0, W, H);
    var sc = Math.min((W - 40) / WW, (H - 70) / WH), mw = WW * sc, mh = WH * sc, ox = (W - mw) / 2, oy = 44;
    ctx.fillStyle = "#0c0e12"; ctx.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);
    for (var y = 0; y < WH; y++) for (var x = 0; x < WW; x++) {
      if (!explored[idx(x, y)]) continue;
      ctx.fillStyle = MAPCOL[world[idx(x, y)]] || "#333"; ctx.fillRect(ox + x * sc, oy + y * sc, Math.ceil(sc), Math.ceil(sc));
    }
    var i;
    for (i = 0; i < chests.length; i++) if (explored[idx(chests[i].x, chests[i].y)]) { ctx.fillStyle = "#ffae42"; ctx.fillRect(ox + chests[i].x * sc - 1, oy + chests[i].y * sc - 1, 4, 4); }
    if (explored[idx(goal.x, goal.y)] && get(goal.x, goal.y) === GOAL) { ctx.fillStyle = "#ffd54a"; ctx.fillRect(ox + goal.x * sc - 2, oy + goal.y * sc - 2, 5, 5); }
    ctx.fillStyle = "#4da3ff"; ctx.fillRect(ox + (P.x / TS) * sc - 2, oy + (P.y / TS) * sc - 2, 5, 5);
    ctx.fillStyle = "#fff"; ctx.font = "bold 16px 'Source Sans 3',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("WORLD MAP  ·  explored " + Math.round(100 * exploredCount / (WW * WH)) + "%  ·  press M to close", W / 2, 26);
    ctx.font = "12px 'Source Sans 3',sans-serif";
    ctx.fillText("🔵 you   🟡 Grand Gem   🟠 chest   (unexplored = hidden)", W / 2, oy + mh + 18);
    ctx.textAlign = "left";
  }
  function render() {
    var W = canvas.width, H = canvas.height;
    cam.x = Math.max(0, Math.min(WW * TS - W, P.x + P.w / 2 - W / 2));
    cam.y = Math.max(0, Math.min(WH * TS - H, P.y + P.h / 2 - H / 2));
    drawSky(W, H);
    var x0 = (cam.x / TS) | 0, y0 = (cam.y / TS) | 0, x1 = (((cam.x + W) / TS) | 0) + 1, y1 = (((cam.y + H) / TS) | 0) + 1, tx, ty;
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) {
      if (!inb(tx, ty)) continue;
      var px = tx * TS - cam.x, py = ty * TS - cam.y, t = world[idx(tx, ty)];
      if (!explored[idx(tx, ty)]) { ctx.fillStyle = "#0a0c10"; ctx.fillRect(px, py, TS, TS); continue; }
      if (t === AIR) { var wc = wallColor(tx, ty); if (wc) { ctx.fillStyle = wc; ctx.fillRect(px, py, TS, TS); } }
      else if (t === GOAL) {
        var pu = 0.5 + 0.5 * Math.sin(frame * 0.12);
        ctx.fillStyle = "rgba(255,213,74," + (0.15 + 0.25 * pu).toFixed(2) + ")"; ctx.fillRect(px - 6, py - 6, TS + 12, TS + 12);
        ctx.fillStyle = "#ffd54a"; ctx.fillRect(px, py, TS, TS); if (TEX[GOAL]) ctx.drawImage(TEX[GOAL][0], px, py);
      } else if (TEX[t]) {
        ctx.drawImage(TEX[t][(tx * 7 + ty * 3) % 3], px, py);
        var sh = Math.min(0.4, Math.max(0, (ty - (surf[tx] || 0)) * 0.010));
        if (sh > 0) { ctx.fillStyle = "rgba(0,0,0," + sh.toFixed(2) + ")"; ctx.fillRect(px, py, TS, TS); }
      } else { ctx.fillStyle = BASECOL[t] || "#666"; ctx.fillRect(px, py, TS, TS); }
    }
    var i;
    for (i = 0; i < drops.length; i++) { var d = drops[i]; ctx.fillStyle = "#8a5a26"; ctx.fillRect(d.x - cam.x, d.y - cam.y, 10, 9); ctx.fillStyle = "#ffd24a"; ctx.fillRect(d.x - cam.x, d.y - cam.y + 3, 10, 2); }
    for (i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);
    if (!P.dead && (P.inv <= 0 || (frame % 6) < 3)) {
      if (gear.armor > 0) { ctx.fillStyle = "rgba(200,220,255,0.85)"; ctx.fillRect(P.x - cam.x, P.y - cam.y + 6, P.w, 3); }
      drawChar(P.x - cam.x, P.y - cam.y, P.face);
    }
    for (i = 0; i < parts.length; i++) { ctx.fillStyle = parts[i].c; ctx.fillRect(parts[i].x - cam.x, parts[i].y - cam.y, 2.5, 2.5); }
    if (!P.dead && agent.think) {                                    // thought bubble
      var label = (llmActive() ? "🧠 " : "") + agent.think;
      ctx.font = "11px 'Source Sans 3',sans-serif"; var tw = ctx.measureText(label).width + 12;
      var bx = Math.max(4, Math.min(W - tw - 4, P.x - cam.x + P.w / 2 - tw / 2)), by = Math.max(26, P.y - cam.y - 30);
      ctx.fillStyle = "rgba(255,255,255,0.94)"; ctx.fillRect(bx, by, tw, 18);
      ctx.fillStyle = llmActive() ? "#7b3fe4" : "#20242a"; ctx.fillText(label, bx + 6, by + 13);
    }
    if (llmActive()) {                                              // LLM status banner
      var t2, col;
      if (llmModel) { t2 = "🧠 " + llmModel + " in control"; col = "rgba(123,63,228,0.92)"; }
      else if (Date.now() < llmFail) { t2 = "🧠 LLM offline — using local brain"; col = "rgba(180,60,60,0.9)"; }
      else { t2 = "🧠 LLM connecting…"; col = "rgba(123,63,228,0.7)"; }
      ctx.font = "bold 12px 'Source Sans 3',sans-serif"; var bw = ctx.measureText(t2).width + 18;
      ctx.fillStyle = col; ctx.fillRect(W / 2 - bw / 2, 6, bw, 20);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(t2, W / 2, 20); ctx.textAlign = "left";
    }
    if (evt.t > 0 && evt.label) {                                    // world-event banner
      var eb = "⚡ " + evt.label, ea = Math.min(1, evt.t / 120);
      ctx.font = "bold 13px 'Source Sans 3',sans-serif"; var ew = ctx.measureText(eb).width + 20;
      ctx.globalAlpha = ea; ctx.fillStyle = "rgba(205,92,26,0.93)"; ctx.fillRect(W / 2 - ew / 2, 30, ew, 22);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(eb, W / 2, 46); ctx.textAlign = "left"; ctx.globalAlpha = 1;
    }
    ctx.font = "12px 'Source Sans 3',sans-serif";                    // toast messages
    for (i = 0; i < msgs.length; i++) {
      ctx.fillStyle = "rgba(0,0,0," + Math.min(0.55, msgs[i].life / 120).toFixed(2) + ")"; ctx.fillRect(8, H - 22 - i * 20, ctx.measureText(msgs[i].t).width + 12, 17);
      ctx.fillStyle = "rgba(255,255,255," + Math.min(1, msgs[i].life / 60).toFixed(2) + ")"; ctx.fillText(msgs[i].t, 14, H - 10 - i * 20);
    }
    var ms = 0.42, mw = WW * ms, mh = WH * ms, mx = W - mw - 8, my = 8;   // corner minimap
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
    for (var yy = 0; yy < WH; yy += 2) for (var xx = 0; xx < WW; xx += 2) { if (!explored[idx(xx, yy)]) continue; ctx.fillStyle = MAPCOL[world[idx(xx, yy)]] || "#555"; ctx.fillRect(mx + xx * ms, my + yy * ms, 1.2, 1.2); }
    if (explored[idx(goal.x, goal.y)] && get(goal.x, goal.y) === GOAL) { ctx.fillStyle = "#ffd54a"; ctx.fillRect(mx + goal.x * ms - 1, my + goal.y * ms - 1, 3, 3); }
    ctx.fillStyle = "#4da3ff"; ctx.fillRect(mx + (P.x / TS) * ms - 1, my + (P.y / TS) * ms - 1, 3, 3);
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "9px 'Source Sans 3',sans-serif"; ctx.fillText("M = map", mx, my + mh + 9);
    if (llmActive() && llmLog.length) {                              // LLM decision feed (right side)
      var pw = 212, plx = W - pw - 8, ply = 70, li2;
      ctx.textAlign = "left"; ctx.font = "11px 'Source Sans 3', sans-serif";
      for (li2 = 0; li2 < llmLog.length; li2++) {
        var le = llmLog[li2], la = Math.max(0, Math.min(1, le.life / 120));
        var lth = le.thought.length > 34 ? le.thought.slice(0, 33) + "…" : le.thought;
        ctx.globalAlpha = la;
        ctx.fillStyle = "rgba(58,30,88,0.85)"; ctx.fillRect(plx, ply, pw, 34);
        ctx.fillStyle = "#ffd54a"; ctx.fillRect(plx, ply, 3, 34);
        var lh = String(le.hint).toUpperCase(); if (lh.length > 33) lh = lh.slice(0, 32) + "…";
        ctx.fillText("🧠 " + lh, plx + 9, ply + 14);
        ctx.fillStyle = "#e9e3f6"; ctx.fillText("“" + lth + "”", plx + 9, ply + 28);
        ctx.globalAlpha = 1;
        ply += 40; if (ply > H - 30) break;
      }
    }
    if (showMap) drawMapOverlay(W, H);
    if (P.dead) { ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.font = "bold 20px 'Source Sans 3',sans-serif"; ctx.textAlign = "center"; ctx.fillText("💀 Respawning… (dropped all equipment)", W / 2, H / 2); ctx.textAlign = "left"; }
  }

  /* ---------------- main loop ---------------- */
  function update(dtf) {
    frame++;
    if (P.dead > 0) { P.dead -= dtf; if (P.dead <= 0) resetPlayer(); }
    else {
      if (agent.on) { if (agent.decideT === undefined) agent.decideT = 0; agent.decideT -= dtf; if (agent.decideT <= 0) { decide(); agent.decideT = 12; } act(dtf); askLLM(); }
      else manual();
      step(P, dtf);
      if (P.y > WH * TS + 40) { P.hp = 0; die(); }
      reveal(); checkChest(); checkGoal();
    }
    if (P.inv > 0) P.inv -= dtf;
    if (agent.atk > 0) agent.atk -= dtf;
    if (frame % 140 === 0) spawnEnemy();
    updEnemies(dtf); updDrops(dtf); updParts(dtf); updEvents(dtf);
    for (var i = msgs.length - 1; i >= 0; i--) { msgs[i].life -= dtf; if (msgs[i].life <= 0) msgs.splice(i, 1); }
    for (var li = llmLog.length - 1; li >= 0; li--) { llmLog[li].life -= dtf; if (llmLog[li].life <= 0) llmLog.splice(li, 1); }
    if (regenT > 0) { regenT -= dtf; if (regenT <= 0) newWorld(true); }
    if (frame % 10 === 0) hud();
  }
  var last = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    var dtf = Math.min(2.2, Math.max(0.4, (ts - last) / 16.666)); last = ts;
    try { update(dtf); render(); } catch (err) { /* keep loop alive */ }
  }

  /* ---------------- input & boot ---------------- */
  document.addEventListener("keydown", function (e) {
    var k = e.key; keys[k] = 1; if (k && k.length === 1) keys[k.toLowerCase()] = 1;
    if (k === "m" || k === "M") showMap = !showMap;
    if (!agent.on && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(k) >= 0) e.preventDefault();
  });
  document.addEventListener("keyup", function (e) { var k = e.key; keys[k] = 0; if (k && k.length === 1) keys[k.toLowerCase()] = 0; });
  var bMode = document.getElementById("tw-mode"), bNew = document.getElementById("tw-new");
  var MODES = ["auto", "llm", "manual"];
  function applyMode(m) {
    if (m === "llm" && !llmEP) {
      var u = window.prompt("Serverless proxy URL (deploy /agent-proxy/). Your API key stays on the backend.", "https://your-worker.workers.dev");
      if (u && /^https?:\/\//.test(u.trim())) { llmEP = u.trim(); try { localStorage.setItem("agent_llm_endpoint", llmEP); } catch (e) {} } else m = "auto";
    }
    agent.mode = m; agent.on = (m !== "manual"); llmOn = (m === "llm");
    if (!llmOn) { llmModel = ""; llmLog.length = 0; agent.planQ.length = 0; }
    if (bMode) { bMode.textContent = m === "manual" ? "🕹️ Mode: MANUAL" : (m === "llm" ? "🧠 Mode: LLM" : "🤖 Mode: AUTO"); bMode.className = (m === "llm") ? "on" : ""; }
    say(m === "manual" ? "Human takes the wheel!" : (m === "llm" ? "Handing high-level goals to the LLM…" : "I've got this — exploring."));
    hud();
  }
  if (bMode) bMode.addEventListener("click", function () { applyMode(MODES[(MODES.indexOf(agent.mode || "auto") + 1) % MODES.length]); });
  if (bNew) bNew.addEventListener("click", function () { newWorld(false); });
  applyMode("auto");
  function fit() { var w = Math.min(900, (canvas.parentElement && canvas.parentElement.clientWidth) || 880); canvas.width = Math.max(480, w); canvas.height = 480; ctx.imageSmoothingEnabled = false; }
  window.addEventListener("resize", fit);
  buildTex(); fit(); generate(); resetPlayer(); hud();
  say(llmActive() ? "LLM brain connected." : "Ready — let's explore!");
  msg("🌍 World generated — the agent explores on its own. Press M for the map.");
  requestAnimationFrame(loop);
})();
