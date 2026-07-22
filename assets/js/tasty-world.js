/* ============================================================================
   Tasty World — a tiny Terraria-like 2D sandbox that an AI agent auto-plays.
   Pure client-side engine + reactive/FSM agent (instant, free, no API key).
   Optional LLM "brain": deploy the serverless proxy in /agent-proxy/ and set
   window.AGENT_LLM_ENDPOINT (or localStorage 'agent_llm_endpoint').
   The API key NEVER appears in this file or anywhere in the frontend.
   ============================================================================ */
(function () {
  "use strict";
  var canvas = document.getElementById("tw-canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");

  /* ---------------- constants ---------------- */
  var TS = 14, WW = 240, WH = 96;
  var GRAV = 0.55, MAXFALL = 11, MOVE = 1.75, JUMP = 8.7;
  var AIR = 0, DIRT = 1, GRASS = 2, STONE = 3, ORE = 4, GEM = 5, WOOD = 6, LEAF = 7, BEDROCK = 8, GOAL = 9;
  var SOLID = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 8: 1 };
  var HARD = { 1: 10, 2: 10, 3: 24, 4: 34, 5: 40, 6: 16, 7: 4 };
  var COL = { 1: "#7a5230", 2: "#4f9d3a", 3: "#6b6f76", 4: "#c98a3d", 5: "#37c8d6", 6: "#5b3b22", 7: "#2f7d2a", 8: "#26282e", 9: "#ffd54a" };

  var world = new Uint8Array(WW * WH), explored = new Uint8Array(WW * WH), exploredCount = 0;
  function idx(x, y) { return y * WW + x; }
  function inb(x, y) { return x >= 0 && x < WW && y >= 0 && y < WH; }
  function get(x, y) { return inb(x, y) ? world[idx(x, y)] : BEDROCK; }
  function setT(x, y, v) { if (inb(x, y)) world[idx(x, y)] = v; }
  function isSolid(x, y) { return !!SOLID[get(x, y)]; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------------- world generation (procedural, guaranteed solvable) ---------------- */
  var spawn = { x: 0, y: 0 }, goal = { x: 0, y: 0 }, surf = [];
  function generate() {
    world.fill(AIR); explored.fill(0); exploredCount = 0; surf = [];
    var h = (WH * 0.42) | 0, x, y;
    for (x = 0; x < WW; x++) {
      if (Math.random() < 0.35) h += Math.random() < 0.5 ? -1 : 1;
      h += Math.round(Math.sin(x * 0.07) * 0.5);
      h = Math.max((WH * 0.28) | 0, Math.min((WH * 0.6) | 0, h));
      surf[x] = h;
      for (y = h; y < WH; y++) {
        var t = (y === h) ? GRASS : (y < h + 4 ? DIRT : STONE);
        if (y >= WH - 2) t = BEDROCK;
        setT(x, y, t);
      }
      if (Math.random() < 0.045 && x > 4 && x < WW - 4) {
        var th = 3 + (Math.random() * 3 | 0), k, lx, ly;
        for (k = 1; k <= th; k++) setT(x, h - k, WOOD);
        for (lx = -2; lx <= 2; lx++) for (ly = -2; ly <= 0; ly++)
          if (Math.abs(lx) + Math.abs(ly + 1) < 3) setT(x + lx, h - th + ly, LEAF);
      }
    }
    var w, s, ox, oy;
    for (w = 0; w < 26; w++) {                         // cave worms
      var cx = rnd(6, WW - 6), cy = rnd(WH * 0.45, WH - 4), ang = rnd(0, 6.28), len = rnd(30, 90);
      for (s = 0; s < len; s++) {
        ang += rnd(-0.4, 0.4); cx += Math.cos(ang); cy += Math.sin(ang) * 0.7;
        var r = rnd(1.2, 2.4);
        for (ox = -3; ox <= 3; ox++) for (oy = -3; oy <= 3; oy++) {
          var tx = (cx + ox) | 0, ty = (cy + oy) | 0;
          if (ox * ox + oy * oy <= r * r && inb(tx, ty) && get(tx, ty) !== BEDROCK && ty < WH - 2) setT(tx, ty, AIR);
        }
      }
    }
    for (var i = 0; i < world.length; i++) {           // ores & gems
      if (world[i] === STONE) {
        var yy = (i / WW) | 0;
        if (Math.random() < 0.035) world[i] = ORE;
        else if (yy > WH * 0.6 && Math.random() < 0.014) world[i] = GEM;
      }
    }
    var sx = 5; spawn.x = sx * TS + 2; spawn.y = (surf[sx] - 3) * TS;
    for (var cy2 = surf[sx] - 4; cy2 < surf[sx]; cy2++) { setT(sx, cy2, AIR); setT(sx + 1, cy2, AIR); }
    var gx = WW - 8, gy = WH - 6;                      // goal treasure: deep & far right
    while (gy > WH * 0.5 && get(gx, gy) === AIR) gy--;
    goal.x = gx; goal.y = gy;
    for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) if (get(gx + a, gy + b) === BEDROCK) setT(gx + a, gy + b, STONE);
    setT(gx, gy, GOAL);
    ensureSolvable();
  }
  /* BFS over non-bedrock (everything else is diggable => reachable); carve tunnel as fallback */
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
  var P = { x: 0, y: 0, w: 10, h: 18, vx: 0, vy: 0, ground: false, face: 1, hp: 100, maxhp: 100, inv: 0, dead: 0 };
  var gear = { pick: 1, sword: 1, armor: 0, gems: 0, ore: 0 };
  var enemies = [], drops = [], parts = [], msgs = [];
  var agent = { on: true, state: "EXPLORE", think: "Waking up…", hint: null, hintT: 0, tgt: null, digT: null, digP: 0, atk: 0, stuck: 0, lx: 0, decideT: 0 };
  var cam = { x: 0, y: 0 }, keys = {}, wins = 0, frame = 0, regenT = 0;
  var llmEP = (window.AGENT_LLM_ENDPOINT || "").trim();
  try { llmEP = llmEP || localStorage.getItem("agent_llm_endpoint") || ""; } catch (e) {}
  var llmLast = 0, llmFail = 0;

  function say(t) { agent.think = t; }
  function msg(t) { msgs.push({ t: t, life: 200 }); if (msgs.length > 4) msgs.shift(); }

  function resetPlayer() { P.x = spawn.x; P.y = spawn.y; P.vx = P.vy = 0; P.hp = P.maxhp; P.dead = 0; P.inv = 60; }
  function die() {
    if (P.dead) return;
    P.dead = 110;
    if (gear.pick > 1 || gear.sword > 1 || gear.armor > 0) {   // drop ALL equipment as a bag
      drops.push({ x: P.x, y: Math.min(P.y, (WH - 4) * TS), w: 10, h: 10, vx: rnd(-1, 1), vy: -3, bag: { pick: gear.pick, sword: gear.sword, armor: gear.armor } });
      msg("💀 Died — dropped all equipment!");
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
  function step(e, dtf) {
    e.vy = Math.min(e.vy + GRAV * dtf, MAXFALL);
    var nx = e.x + e.vx * dtf;
    if (!hitSolid(nx, e.y, e.w, e.h)) e.x = nx;
    else { var d1 = e.vx > 0 ? 1 : -1; while (!hitSolid(e.x + d1 * 0.5, e.y, e.w, e.h)) e.x += d1 * 0.5; e.vx = 0; }
    var ny = e.y + e.vy * dtf; e.ground = false;
    if (!hitSolid(e.x, ny, e.w, e.h)) e.y = ny;
    else { var d2 = e.vy > 0 ? 1 : -1; while (!hitSolid(e.x, e.y + d2 * 0.5, e.w, e.h)) e.y += d2 * 0.5; if (e.vy > 0) e.ground = true; e.vy = 0; }
  }

  /* ---------------- mining ---------------- */
  function tryMine(tx, ty) {
    var t = get(tx, ty);
    if (!HARD[t]) return false;
    var d = Math.hypot((tx + 0.5) * TS - (P.x + P.w / 2), (ty + 0.5) * TS - (P.y + P.h / 2));
    if (d > TS * 2.8) return false;
    if (!agent.digT || agent.digT.x !== tx || agent.digT.y !== ty) { agent.digT = { x: tx, y: ty }; agent.digP = 0; }
    agent.digP += 1 + gear.pick * 0.8;
    if (frame % 5 === 0) burst((tx + 0.5) * TS, (ty + 0.5) * TS, COL[t] || "#999", 1);
    if (agent.digP >= HARD[t]) {
      agent.digT = null; agent.digP = 0;
      if (t === ORE) {
        gear.ore++; msg("⛏️ Ore! (" + gear.ore + ")");
        if (gear.ore % 3 === 0) {
          if (Math.random() < 0.5 && gear.pick < 5) { gear.pick++; msg("⬆️ Pickaxe Lv." + gear.pick); }
          else if (gear.sword < 5) { gear.sword++; msg("⬆️ Sword Lv." + gear.sword); }
        }
      } else if (t === GEM) {
        gear.gems++; msg("💎 Gem! (" + gear.gems + ")");
        if (gear.gems % 2 === 0 && gear.armor < 5) { gear.armor++; msg("🛡️ Armor Lv." + gear.armor); }
      }
      setT(tx, ty, AIR);
    }
    return true;
  }

  /* ---------------- enemies & combat ---------------- */
  function spawnEnemy() {
    if (enemies.length >= 5) return;
    for (var tr = 0; tr < 24; tr++) {
      var tx = rnd(2, WW - 2) | 0, ty = rnd(4, WH - 4) | 0;
      if (get(tx, ty) === AIR && get(tx, ty - 1) === AIR && isSolid(tx, ty + 1)) {
        var d = Math.hypot(tx * TS - P.x, ty * TS - P.y);
        if (d > TS * 14 && d < TS * 45) {
          enemies.push({ x: tx * TS + 1, y: ty * TS + 2, w: 12, h: 11, vx: 0, vy: 0, ground: false, hp: 14 + wins * 4, hop: rnd(10, 50), face: 1 });
          return;
        }
      }
    }
  }
  function updEnemies(dtf) {
    for (var i = enemies.length - 1; i >= 0; i--) {
      var s = enemies[i];
      var dx = P.x - s.x, dist = Math.hypot(dx, P.y - s.y);
      s.face = dx > 0 ? 1 : -1;
      if (s.ground) {
        s.vx *= 0.8; s.hop -= dtf;
        if (dist < TS * 16 && s.hop <= 0) { s.vx = s.face * rnd(1.2, 2.2); s.vy = -rnd(4, 6.5); s.hop = rnd(40, 85); }
      }
      step(s, dtf);
      if (s.y > WH * TS + 40) s.hp = 0;
      if (!P.dead && P.inv <= 0 &&
          Math.abs((s.x + s.w / 2) - (P.x + P.w / 2)) < (s.w + P.w) / 2 &&
          Math.abs((s.y + s.h / 2) - (P.y + P.h / 2)) < (s.h + P.h) / 2) {
        var dmg = Math.max(2, 9 + wins * 2 - gear.armor * 2);
        P.hp -= dmg; P.inv = 45; P.vx = (dx > 0 ? -1 : 1) * 3; P.vy = -3;
        burst(P.x + P.w / 2, P.y + P.h / 2, "#e05555", 6);
        if (P.hp <= 0) die();
      }
      if (s.hp <= 0) { burst(s.x + 6, s.y + 5, "#63c74d", 10); enemies.splice(i, 1); }
    }
  }
  function attack() {
    if (agent.atk > 0 || P.dead) return;
    agent.atk = 26;
    var rx = P.face > 0 ? P.x + P.w : P.x - 22;
    for (var i = 0; i < enemies.length; i++) {
      var s = enemies[i];
      if (s.x + s.w > rx && s.x < rx + 22 && s.y + s.h > P.y - 4 && s.y < P.y + P.h + 4) {
        s.hp -= 5 + gear.sword * 4; s.vx = P.face * 4; s.vy = -3;
        burst(s.x + 6, s.y + 5, "#ffd54a", 5);
      }
    }
  }

  /* ---------------- drops & particles ---------------- */
  function updDrops(dtf) {
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i]; step(d, dtf); d.vx *= 0.92;
      if (!P.dead && Math.abs(d.x - P.x) < 15 && Math.abs(d.y - P.y) < 22) {
        gear.pick = Math.max(gear.pick, d.bag.pick); gear.sword = Math.max(gear.sword, d.bag.sword); gear.armor = Math.max(gear.armor, d.bag.armor);
        msg("🎒 Recovered your equipment!"); burst(d.x, d.y, "#ffd54a", 8); drops.splice(i, 1);
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

  /* ---------------- agent brain (client-side FSM + reactive navigation) ---------------- */
  var THINKS = {
    EXPLORE: ["Let's see what's over there…", "Mapping the caves…", "Adventure awaits →", "I smell treasure…", "Deeper we go."],
    FIGHT: ["A slime! En garde!", "Get back, blob!", "XP time."],
    FLEE: ["Nope nope nope", "Retreat and regroup!", "Too spicy, backing off."],
    GOAL: ["Treasure detected! Digging in…", "Almost there…", "The gem calls to me."],
    WIN: ["Found it! 🎉", "Loot secured!"]
  };
  function nearestEnemy() {
    var b = null, bd = 1e9;
    for (var i = 0; i < enemies.length; i++) {
      var d = Math.hypot(enemies[i].x - P.x, enemies[i].y - P.y);
      if (d < bd) { bd = d; b = enemies[i]; }
    }
    return b ? { e: b, d: bd } : null;
  }
  function pickExploreTarget() {
    for (var tr = 0; tr < 40; tr++) {
      var tx = ((P.x / TS) | 0) + ((rnd(6, 30) | 0) * (Math.random() < 0.75 ? 1 : -1));
      var ty = ((P.y / TS) | 0) + (rnd(-6, 22) | 0);
      tx = Math.max(2, Math.min(WW - 3, tx)); ty = Math.max(2, Math.min(WH - 3, ty));
      if (!explored[idx(tx, ty)]) return { x: tx, y: ty };
    }
    return { x: goal.x, y: goal.y };
  }
  function decide() {
    if (P.dead) return;
    var ne = nearestEnemy(), hpr = P.hp / P.maxhp;
    var goalKnown = !!explored[idx(goal.x, goal.y)] && get(goal.x, goal.y) === GOAL;
    var st;
    if (ne && ne.d < TS * 6 && hpr < 0.35) st = "FLEE";
    else if (ne && ne.d < TS * 7) st = "FIGHT";
    else if (agent.hintT > 0 && agent.hint === "dig_down") st = "DIG";
    else if (agent.hintT > 0 && agent.hint === "surface") st = "SURFACE";
    else if (goalKnown || (agent.hintT > 0 && agent.hint === "seek_goal")) st = "GOAL";
    else st = "EXPLORE";
    if (st !== agent.state) {
      agent.state = st;
      var pool = THINKS[(st === "DIG" || st === "SURFACE") ? "EXPLORE" : st] || THINKS.EXPLORE;
      if (!llmEP) say(pool[(Math.random() * pool.length) | 0]);
    }
    var pcx = (P.x / TS) | 0;
    if (st === "EXPLORE" && (!agent.tgt || explored[idx(agent.tgt.x, agent.tgt.y)] || agent.stuck > 200)) agent.tgt = pickExploreTarget();
    if (st === "GOAL") agent.tgt = { x: goal.x, y: goal.y };
    if (st === "DIG") agent.tgt = { x: pcx, y: Math.min(WH - 3, ((P.y / TS) | 0) + 10) };
    if (st === "SURFACE") agent.tgt = { x: pcx, y: Math.max(2, (surf[Math.max(0, Math.min(WW - 1, pcx))] || 40) - 2) };
    if (st === "FIGHT" && ne) agent.tgt = { x: (ne.e.x / TS) | 0, y: (ne.e.y / TS) | 0 };
    if (st === "FLEE" && ne) agent.tgt = { x: Math.max(2, Math.min(WW - 3, pcx + (P.x < ne.e.x ? -12 : 12))), y: (P.y / TS) | 0 };
    if (agent.hintT > 0) agent.hintT -= 14;
  }
  function act(dtf) {
    if (P.dead || !agent.tgt) return;
    var t = agent.tgt;
    var ptx = (P.x + P.w / 2) / TS, pty = (P.y + P.h / 2) / TS;
    var dx = (t.x + 0.5) - ptx, dy = (t.y + 0.5) - pty;
    var ne = nearestEnemy();
    if (ne && ne.d < TS * 2.2) { P.face = ne.e.x > P.x ? 1 : -1; attack(); }
    if (Math.abs(dx) > 0.6) {
      P.face = dx > 0 ? 1 : -1;
      P.vx = P.face * MOVE;
      if (agent.state === "FIGHT" && ne && ne.d < TS * 1.4) P.vx *= 0.4;
      var fx = ((P.x + (P.face > 0 ? P.w + 2 : -3)) / TS) | 0;
      var footY = ((P.y + P.h - 2) / TS) | 0, headY = ((P.y + 2) / TS) | 0;
      if (isSolid(fx, footY) || isSolid(fx, headY)) {
        var canStep = P.ground && !isSolid(fx, footY - 1) && !isSolid(fx, headY - 1) && !isSolid(((P.x + P.w / 2) / TS) | 0, headY - 1);
        if (canStep) P.vy = -JUMP;
        else tryMine(fx, isSolid(fx, headY) ? headY : footY);
      }
    } else P.vx *= 0.7;
    if (dy > 1.2 && Math.abs(dx) < 2.5) {
      var bx = ((P.x + P.w / 2) / TS) | 0, by = ((P.y + P.h + 2) / TS) | 0;
      if (isSolid(bx, by) && get(bx, by) !== BEDROCK) tryMine(bx, by);
    } else if (dy < -1.2 && Math.abs(dx) < 2.5) {
      if (P.ground) P.vy = -JUMP;
      var ux = ((P.x + P.w / 2) / TS) | 0, uy = ((P.y - 3) / TS) | 0;
      if (isSolid(ux, uy)) tryMine(ux, uy);
    }
    if (Math.abs(P.x - agent.lx) < 0.5) agent.stuck += 1; else agent.stuck = 0;
    agent.lx = P.x;
    if (agent.stuck > 90) {
      if (P.ground && Math.random() < 0.3) P.vy = -JUMP;
      var sx2 = (((P.x + P.w / 2) / TS) + P.face) | 0, sy2 = ((P.y + P.h - 2) / TS) | 0;
      if (isSolid(sx2, sy2)) tryMine(sx2, sy2);
      else tryMine(((P.x + P.w / 2) / TS) | 0, ((P.y + P.h + 2) / TS) | 0);
      if (agent.stuck > 260) { agent.tgt = pickExploreTarget(); agent.stuck = 0; }
    }
    if (Math.abs(dx) < 1.5 && Math.abs(dy) < 2 && agent.state === "EXPLORE") agent.tgt = null;
  }

  /* ---------------- optional LLM brain (via YOUR serverless proxy; no key here) ---------------- */
  function askLLM() {
    if (!llmEP || P.dead || document.hidden) return;
    var now = Date.now();
    if (now - llmLast < 9000 || now < llmFail) return;
    llmLast = now;
    var ne = nearestEnemy();
    var pcx = Math.max(0, Math.min(WW - 1, (P.x / TS) | 0));
    var body = {
      hp: Math.round(P.hp), gems: gear.gems, pick: gear.pick, sword: gear.sword, armor: gear.armor,
      state: agent.state, depth: Math.round(P.y / TS - (surf[pcx] || 40)),
      enemyNear: !!(ne && ne.d < TS * 10), goalKnown: !!explored[idx(goal.x, goal.y)],
      exploredPct: Math.round(100 * exploredCount / (WW * WH)), wins: wins
    };
    try {
      fetch(llmEP, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.thought) say(String(j.thought).slice(0, 64));
          if (j && j.hint) { agent.hint = String(j.hint); agent.hintT = 700; }
        })
        .catch(function () { llmFail = Date.now() + 60000; });
    } catch (e) { llmFail = Date.now() + 60000; }
  }

  /* ---------------- fog, goal, world reset ---------------- */
  function reveal() {
    var cx = (P.x / TS) | 0, cy = (P.y / TS) | 0, R = 9;
    for (var y = cy - R; y <= cy + R; y++) for (var x = cx - R; x <= cx + R; x++)
      if (inb(x, y) && !explored[idx(x, y)] && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= R * R) { explored[idx(x, y)] = 1; exploredCount++; }
  }
  function checkGoal() {
    if (get(goal.x, goal.y) !== GOAL) return;
    var d = Math.hypot((goal.x + 0.5) * TS - (P.x + P.w / 2), (goal.y + 0.5) * TS - (P.y + P.h / 2));
    if (d < TS * 1.7) {
      setT(goal.x, goal.y, AIR); wins++; gear.gems += 5;
      msg("🏆 Treasure found! +5 💎 (run " + wins + ")");
      say(THINKS.WIN[(Math.random() * THINKS.WIN.length) | 0]);
      burst((goal.x + 0.5) * TS, (goal.y + 0.5) * TS, "#ffd54a", 30);
      regenT = 260;
    }
  }
  function newWorld(keepGear) {
    generate();
    enemies.length = 0; drops.length = 0; parts.length = 0;
    if (!keepGear) { gear.pick = 1; gear.sword = 1; gear.armor = 0; gear.gems = 0; gear.ore = 0; wins = 0; }
    resetPlayer(); agent.tgt = null; agent.state = "EXPLORE"; agent.stuck = 0; regenT = 0;
    msg("🌍 New world generated (solvable ✔)"); say("A fresh world to conquer!");
  }

  /* ---------------- manual controls ---------------- */
  function manual(dtf) {
    var L = keys.ArrowLeft || keys.a, R = keys.ArrowRight || keys.d;
    if (L) { P.vx = -MOVE; P.face = -1; } else if (R) { P.vx = MOVE; P.face = 1; } else P.vx *= 0.7;
    if ((keys.ArrowUp || keys.w || keys[" "]) && P.ground) P.vy = -JUMP;
    if (keys.x || keys.j) attack();
    if (keys.z || keys.k || keys.ArrowDown) {
      var fx = (((P.x + P.w / 2) / TS) + P.face) | 0, fy = ((P.y + P.h - 4) / TS) | 0;
      if (keys.ArrowDown || !isSolid(fx, fy)) tryMine(((P.x + P.w / 2) / TS) | 0, ((P.y + P.h + 2) / TS) | 0);
      else tryMine(fx, fy);
    }
  }

  /* ---------------- HUD (DOM) ---------------- */
  function hud() {
    var hb = document.getElementById("tw-hpbar");
    if (hb) hb.style.width = Math.max(0, P.hp / P.maxhp * 100) + "%";
    var ge = document.getElementById("tw-gear");
    if (ge) ge.textContent = "⛏️Lv" + gear.pick + "  🗡️Lv" + gear.sword + "  🛡️Lv" + gear.armor + "  💎" + gear.gems + "  🏆" + wins;
    var st = document.getElementById("tw-state");
    if (st) st.textContent = (agent.on ? "AUTO · " + agent.state : "MANUAL") + (llmEP ? " · LLM brain ✓" : " · local brain");
  }

  /* ---------------- render ---------------- */
  function render() {
    var W = canvas.width, H = canvas.height;
    cam.x = Math.max(0, Math.min(WW * TS - W, P.x + P.w / 2 - W / 2));
    cam.y = Math.max(0, Math.min(WH * TS - H, P.y + P.h / 2 - H / 2));
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#8ec9ee"); g.addColorStop(1, "#cfe9f8");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var x0 = (cam.x / TS) | 0, y0 = (cam.y / TS) | 0, x1 = ((cam.x + W) / TS) | 0, y1 = ((cam.y + H) / TS) | 0;
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
      if (!inb(tx, ty)) continue;
      var t = world[idx(tx, ty)], px = tx * TS - cam.x, py = ty * TS - cam.y;
      if (t === AIR) {
        if (ty > (surf[tx] || 0)) { ctx.fillStyle = "#14171d"; ctx.fillRect(px, py, TS, TS); }
      } else {
        if (t === GOAL) {
          var pu = 0.5 + 0.5 * Math.sin(frame * 0.15);
          ctx.fillStyle = "rgba(255,213,74," + (0.25 + 0.3 * pu).toFixed(2) + ")"; ctx.fillRect(px - 4, py - 4, TS + 8, TS + 8);
          ctx.fillStyle = "#ffd54a"; ctx.fillRect(px, py, TS, TS);
          ctx.fillStyle = "#fff3c0"; ctx.fillRect(px + 4, py + 4, TS - 8, TS - 8);
        } else {
          ctx.fillStyle = COL[t]; ctx.fillRect(px, py, TS, TS);
          var sh = Math.min(0.35, Math.max(0, (ty - (surf[tx] || 0)) * 0.012));
          if (sh > 0) { ctx.fillStyle = "rgba(0,0,0," + sh.toFixed(2) + ")"; ctx.fillRect(px, py, TS, TS); }
          ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(px, py, TS, 2);
          if (t === ORE) { ctx.fillStyle = "#ffcf7a"; ctx.fillRect(px + 4, py + 4, 4, 4); ctx.fillRect(px + 8, py + 8, 3, 3); }
          if (t === GEM) { ctx.fillStyle = "#c9f6fa"; ctx.fillRect(px + 5, py + 5, 5, 5); }
        }
      }
      if (!explored[idx(tx, ty)]) { ctx.fillStyle = "rgba(5,7,11,0.96)"; ctx.fillRect(px, py, TS, TS); }
    }
    var i;
    for (i = 0; i < drops.length; i++) { ctx.font = "12px sans-serif"; ctx.fillText("🎒", drops[i].x - cam.x - 2, drops[i].y - cam.y + 10); }
    for (i = 0; i < enemies.length; i++) {
      var s = enemies[i], ex = s.x - cam.x, ey = s.y - cam.y;
      ctx.fillStyle = "#63c74d"; ctx.fillRect(ex, ey + 3, s.w, s.h - 3);
      ctx.fillRect(ex + 2, ey, s.w - 4, 4);
      ctx.fillStyle = "#fff"; ctx.fillRect(ex + (s.face > 0 ? 8 : 2), ey + 4, 3, 3);
      ctx.fillStyle = "#123c0e"; ctx.fillRect(ex + (s.face > 0 ? 9 : 3), ey + 5, 1.6, 1.6);
    }
    if (!P.dead && (P.inv <= 0 || (frame % 6) < 3)) {
      var pxp = P.x - cam.x, pyp = P.y - cam.y;
      ctx.fillStyle = "#2f6feb"; ctx.fillRect(pxp, pyp + 6, P.w, P.h - 6);
      ctx.fillStyle = "#f3c89b"; ctx.fillRect(pxp + 1, pyp, P.w - 2, 7);
      ctx.fillStyle = "#222"; ctx.fillRect(pxp + (P.face > 0 ? P.w - 4 : 2), pyp + 2, 2, 2);
      if (gear.armor > 0) { ctx.fillStyle = "rgba(200,220,255,0.8)"; ctx.fillRect(pxp - 1, pyp + 6, P.w + 2, 3); }
      if (agent.atk > 16) {
        ctx.strokeStyle = "#ffe9a3"; ctx.lineWidth = 2; ctx.beginPath();
        var ax = pxp + (P.face > 0 ? P.w + 8 : -8), ay = pyp + 8;
        ctx.arc(ax, ay, 9, -1.2, 1.2); ctx.stroke();
      }
    }
    for (i = 0; i < parts.length; i++) { ctx.fillStyle = parts[i].c; ctx.fillRect(parts[i].x - cam.x, parts[i].y - cam.y, 2.5, 2.5); }
    if (!P.dead && agent.think) {
      ctx.font = "11px 'Source Sans 3', sans-serif";
      var tw = ctx.measureText(agent.think).width + 12;
      var bx = Math.max(4, Math.min(W - tw - 4, P.x - cam.x + P.w / 2 - tw / 2)), by = Math.max(4, P.y - cam.y - 32);
      ctx.fillStyle = "rgba(255,255,255,0.93)"; ctx.fillRect(bx, by, tw, 18);
      ctx.fillStyle = "#20242a"; ctx.fillText(agent.think, bx + 6, by + 13);
    }
    ctx.font = "12px 'Source Sans 3', sans-serif";
    for (i = 0; i < msgs.length; i++) {
      ctx.fillStyle = "rgba(0,0,0," + Math.min(0.55, msgs[i].life / 120).toFixed(2) + ")";
      ctx.fillRect(8, H - 22 - i * 20, ctx.measureText(msgs[i].t).width + 12, 17);
      ctx.fillStyle = "rgba(255,255,255," + Math.min(1, msgs[i].life / 60).toFixed(2) + ")";
      ctx.fillText(msgs[i].t, 14, H - 10 - i * 20);
    }
    var ms = 0.5, mw = WW * ms, mh = WH * ms, mx = W - mw - 8, my = 8;   // minimap
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
    for (var yy = 0; yy < WH; yy += 2) for (var xx = 0; xx < WW; xx += 2) {
      if (!explored[idx(xx, yy)]) continue;
      var tt = world[idx(xx, yy)];
      ctx.fillStyle = tt === AIR ? "#20242c" : (COL[tt] || "#666");
      ctx.fillRect(mx + xx * ms, my + yy * ms, 1.4, 1.4);
    }
    if (explored[idx(goal.x, goal.y)] && get(goal.x, goal.y) === GOAL) { ctx.fillStyle = "#ffd54a"; ctx.fillRect(mx + goal.x * ms - 1, my + goal.y * ms - 1, 3.5, 3.5); }
    ctx.fillStyle = "#4da3ff"; ctx.fillRect(mx + (P.x / TS) * ms - 1, my + (P.y / TS) * ms - 1, 3, 3);
    if (P.dead) {
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff"; ctx.font = "bold 20px 'Source Sans 3', sans-serif"; ctx.textAlign = "center";
      ctx.fillText("💀 Respawning… (equipment dropped)", W / 2, H / 2);
      ctx.textAlign = "left";
    }
  }

  /* ---------------- main loop ---------------- */
  function update(dtf) {
    frame++;
    if (P.dead > 0) { P.dead -= dtf; if (P.dead <= 0) resetPlayer(); }
    else {
      if (agent.on) { agent.decideT -= dtf; if (agent.decideT <= 0) { decide(); agent.decideT = 14; } act(dtf); askLLM(); }
      else manual(dtf);
      step(P, dtf);
      if (P.y > WH * TS + 40) { P.hp = 0; die(); }
      reveal(); checkGoal();
    }
    if (P.inv > 0) P.inv -= dtf;
    if (agent.atk > 0) agent.atk -= dtf;
    if (frame % 150 === 0) spawnEnemy();
    updEnemies(dtf); updDrops(dtf); updParts(dtf);
    for (var i = msgs.length - 1; i >= 0; i--) { msgs[i].life -= dtf; if (msgs[i].life <= 0) msgs.splice(i, 1); }
    if (regenT > 0) { regenT -= dtf; if (regenT <= 0) newWorld(true); }
    if (frame % 10 === 0) hud();
  }
  var last = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    var dtf = Math.min(2.2, Math.max(0.4, (ts - last) / 16.666)); last = ts;
    try { update(dtf); render(); } catch (err) { /* keep the loop alive */ }
  }

  /* ---------------- input & boot ---------------- */
  document.addEventListener("keydown", function (e) {
    keys[e.key] = 1; if (e.key && e.key.length === 1) keys[e.key.toLowerCase()] = 1;
    if (!agent.on && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) >= 0) e.preventDefault();
  });
  document.addEventListener("keyup", function (e) {
    keys[e.key] = 0; if (e.key && e.key.length === 1) keys[e.key.toLowerCase()] = 0;
  });
  var bMode = document.getElementById("tw-mode"), bNew = document.getElementById("tw-new");
  if (bMode) bMode.addEventListener("click", function () {
    agent.on = !agent.on;
    bMode.textContent = agent.on ? "🤖 Agent: AUTO" : "🎮 Mode: MANUAL";
    say(agent.on ? "I got this." : "Human takes the wheel!");
  });
  if (bNew) bNew.addEventListener("click", function () { newWorld(false); });
  function fit() {
    var w = Math.min(880, (canvas.parentElement && canvas.parentElement.clientWidth) || 860);
    canvas.width = Math.max(480, w); canvas.height = 460;
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener("resize", fit);
  fit(); generate(); resetPlayer();
  say(llmEP ? "LLM brain connected." : "Algorithmic brain online.");
  msg("🌍 World generated — the agent is exploring on its own.");
  requestAnimationFrame(loop);
})();
