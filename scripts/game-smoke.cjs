#!/usr/bin/env node
'use strict';
// Node-only deterministic runtime smoke test; never edits the supplied source.
// It exposes internal state only in an in-memory VM copy, and calls update/render
// directly so the production animation loop cannot swallow a test failure.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
const sourcePath = path.resolve(args[0] || path.join(__dirname, 'tasty-world.js'));
const pagePath = path.resolve(args[1] || path.join(__dirname, 'game-controls.html'));
const compareFlag = args.indexOf('--compare');
const comparePath = compareFlag >= 0 ? path.resolve(args[compareFlag + 1]) : null;
const source = fs.readFileSync(sourcePath, 'utf8');
const html = fs.readFileSync(pagePath, 'utf8');
const passed = [];
function check(name, fn) { fn(); passed.push(name); console.log('PASS ' + name); }

function boot(code, page = html, viewport = 880, seed = 3571) {
  const network = [], storage = [], drawnText = [];
  const raf = [], timers = [];
  let document, window, nextCanvas = 0, draws = 0;
  class Target {
    constructor() { this.listeners = {}; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
    dispatchEvent(event) {
      event.target ||= this; event.currentTarget = this;
      event.preventDefault ||= function () { this.defaultPrevented = true; };
      for (const fn of this.listeners[event.type] || []) fn.call(this, event);
      if (event.bubbles !== false && this.parentElement) this.parentElement.dispatchEvent(event);
      return !event.defaultPrevented;
    }
  }
  class Element extends Target {
    constructor(tag = 'div', attrs = {}) {
      super(); this.tagName = tag.toUpperCase(); this.attrs = attrs; this.children = []; this.style = {};
      this.textContent = ''; this.hidden = 'hidden' in attrs; this.clientWidth = viewport;
      this.width = Number(attrs.width || 0); this.height = Number(attrs.height || 0);
      this.id = attrs.id || ''; this.className = attrs.class || ''; this.isContentEditable = attrs.contenteditable === 'true';
      this.classList = {
        add: c => { if (!this.className.split(' ').includes(c)) this.className = (this.className + ' ' + c).trim(); },
        remove: c => { this.className = this.className.split(' ').filter(x => x !== c).join(' '); },
        contains: c => this.className.split(' ').includes(c)
      };
    }
    appendChild(e) { e.parentElement = this; this.children.push(e); return e; }
    contains(e) { return this === e || this.children.some(c => c.contains(e)); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    hasAttribute(k) { return k in this.attrs; }
    matches(selector) {
      if (selector[0] === '#') return this.id === selector.slice(1);
      if (selector === '[data-tw-key]') return this.hasAttribute('data-tw-key');
      return this.tagName.toLowerCase() === selector.toLowerCase();
    }
    querySelectorAll(selector) { return this.children.flatMap(c => [...(c.matches(selector) ? [c] : []), ...c.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    focus() {
      const old = document.activeElement;
      if (old === this) return;
      document.activeElement = this;
      if (old) old.dispatchEvent({ type: 'focusout', target: old, relatedTarget: this });
    }
    setPointerCapture(id) { this.capturedPointer = id; }
    releasePointerCapture(id) { if (this.capturedPointer === id) this.capturedPointer = null; }
    getContext() {
      const ctx = {
        measureText: t => ({ width: String(t).length * 6 }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        fillText(t) { drawnText.push(String(t)); },
      };
      for (const k of ['fillRect','clearRect','strokeRect','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','drawImage','save','restore','translate','scale','rotate','setTransform','rect','clip']) ctx[k] = () => { draws++; };
      return ctx;
    }
  }
  document = new Target(); window = new Target();
  document.body = new Element('body'); document.body.parentElement = document;
  document.activeElement = document.body; document.hidden = false;
  document.getElementById = id => document.body.querySelector('#' + id);
  document.querySelectorAll = selector => document.body.querySelectorAll(selector);
  document.createElement = tag => new Element(tag, tag === 'canvas' ? { id: 'offscreen-' + nextCanvas++ } : {});
  const stack = [document.body];
  const tokens = page.match(/<\/?[a-z][^>]*>/ig) || [];
  for (const token of tokens) {
    const tag = token.match(/^<\/?([a-z][\w-]*)/i)[1].toLowerCase();
    if (token.startsWith('</')) {
      const i = stack.findLastIndex(el => el.tagName.toLowerCase() === tag);
      if (i > 0) stack.length = i;
      continue;
    }
    const attrs = {};
    for (const m of token.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
    const e = new Element(tag, attrs); stack.at(-1).appendChild(e);
    if (!['br', 'hr', 'input', 'img', 'meta', 'link'].includes(tag) && !token.endsWith('/>')) stack.push(e);
  }
  const seededMath = Object.create(Math);
  seededMath.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const failNetwork = type => (...a) => { network.push([type, ...a]); throw Error('Unexpected network: ' + type); };
  const sandbox = {
    console, document, Math: seededMath, Date, Uint8Array, Int32Array, Float32Array,
    requestAnimationFrame: fn => { raf.push(fn); return raf.length; },
    cancelAnimationFrame() {},
    setTimeout: fn => { timers.push(fn); return timers.length; },
    clearTimeout() {},
    fetch: failNetwork('fetch'), XMLHttpRequest: failNetwork('XMLHttpRequest'), WebSocket: failNetwork('WebSocket'),
    navigator: { sendBeacon: failNetwork('beacon'), maxTouchPoints: 5 },
    localStorage: {
      getItem: k => { storage.push(['get', k]); return 'https://legacy.invalid/inference'; },
      setItem: (k, v) => { storage.push(['set', k, v]); }, removeItem: k => { storage.push(['remove', k]); }
    },
    AGENT_LLM_ENDPOINT: 'https://legacy.invalid/inference',
    prompt: failNetwork('endpoint-prompt'),
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
  };
  sandbox.window = sandbox;
  const instrumented = code.replace(/\}\)\(\);\s*$/, `
    globalThis.__gameAudit = {
      P: P, gear: gear, agent: agent, world: world, explored: explored, enemies: enemies, buffs: buffs, stat: stat,
      get keys() { return keys; }, get showMap() { return showMap; }, get frame() { return frame; },
      get exploredCount() { return exploredCount; }, get deaths() { return deaths; },
      update: update, render: render, manual: manual, decide: decide, bfsPath: bfsPath,
      get: get, setT: setT, die: die, newWorld: newWorld, applyMode: applyMode
    };
  })();`);
  vm.createContext(sandbox); vm.runInContext(instrumented, sandbox, { filename: sourcePath, timeout: 10000 });
  const a = sandbox.__gameAudit;
  function fire(target, type, extra = {}) {
    const event = { type, target, key: '', repeat: false, ctrlKey: false, metaKey: false, altKey: false, detail: 1,
      pointerId: 1, button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
    target.dispatchEvent(event); return event;
  }
  function key(type, key, extra) { return fire(document.activeElement, type, { key, ...extra }); }
  function frames(n) { for (let i = 0; i < n; i++) { a.update(1); if (i % 30 === 0) a.render(); } }
  function clearArena() {
    a.world.fill(0); a.explored.fill(0); a.enemies.length = 0;
    for (let x = 0; x < 240; x++) a.setT(x, 12, 11);
    Object.assign(a.P, { x: 160, y: 172, vx: 0, vy: 0, ground: true, hp: 100, maxhp: 100, dead: 0, inv: 10000, face: 1 });
    a.agent.lowHP = false; a.agent.escapeT = 0; a.agent.campT = 0; a.agent.avoidT = 0;
  }
  return { a, document, window, network, storage, drawnText, raf, timers, fire, key, frames, clearArena, get draws() { return draws; } };
}

check('No LLM configuration, networking, remote plan, or LLM UI remains in source/page', () => {
  assert.doesNotMatch(source + '\n' + html, /\bllm\b|llmEP|llmOn|llmModel|askLLM|llmActive|AGENT_LLM_ENDPOINT|agent_llm_endpoint|agent-proxy|\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|agent\.(?:hint|hintT|planQ|planT|latent|snap|lastPlan)/i);
});
const g = boot(source), a = g.a;
const canvas = g.document.getElementById('tw-canvas');
const mode = g.document.getElementById('tw-mode');
check('Boot builds a local world, starts AUTO and schedules animation', () => {
  assert.ok(a && a.agent.on); assert.equal(a.agent.mode, 'auto'); assert.ok(g.raf.length);
  assert.ok(a.world.some(t => t !== 0)); assert.ok(Number.isFinite(a.P.x));
  assert.match(g.document.getElementById('tw-state').textContent, /BFS.*FSM/);
});
check('600 AUTO frames explore and move without runtime/render errors', () => {
  const before = [a.P.x, a.P.y, a.exploredCount]; g.frames(600);
  assert.ok(a.exploredCount > before[2]); assert.ok(a.P.x !== before[0] || a.P.y !== before[1]);
  assert.equal(a.frame, 600); assert.ok(g.draws > 1000); assert.ok(a.P.hp > 0 || a.P.dead > 0);
});
if (comparePath) check('AUTO physics/world/state match original for 1,800 seeded frames', () => {
  const original = boot(fs.readFileSync(comparePath, 'utf8')), revised = boot(source);
  function snapshot(b) { return JSON.stringify({ P:b.a.P, gear:b.a.gear, stat:b.a.stat, state:b.a.agent.state,
    explored: b.a.exploredCount, world: Buffer.from(b.a.world).toString('base64') }); }
  for (let i = 0; i < 18; i++) { original.frames(100); revised.frames(100); assert.equal(snapshot(revised), snapshot(original), 'AUTO diverged at frame ' + (i + 1) * 100); }
});
check('Mode cycles directly AUTO → MANUAL → AUTO', () => {
  g.fire(mode, 'click'); assert.equal(a.agent.mode, 'manual'); assert.equal(a.agent.on, false);
  g.fire(mode, 'click'); assert.equal(a.agent.mode, 'auto'); assert.equal(a.agent.on, true);
});
check('MANUAL arrow input moves player; scoped keys prevent page scrolling', () => {
  a.applyMode('manual'); g.clearArena(); canvas.focus();
  const e = g.key('keydown', 'ArrowRight'); assert.equal(e.defaultPrevented, true);
  const x = a.P.x; g.frames(12); g.key('keyup', 'ArrowRight'); assert.ok(a.P.x > x);
  assert.ok(!a.keys.ArrowRight);
});
check('Outside game, edit fields, and browser shortcuts retain their keys', () => {
  g.document.body.focus(); assert.equal(g.key('keydown', 'ArrowDown').defaultPrevented, false); assert.ok(!a.keys.ArrowDown);
  const input = g.document.createElement('input'); g.document.getElementById('tw-wrap').appendChild(input); input.focus();
  assert.equal(g.key('keydown', ' ').defaultPrevented, false); assert.ok(!a.keys[' ']);
  canvas.focus(); assert.equal(g.key('keydown', 'a', { metaKey:true }).defaultPrevented, false); assert.ok(!a.keys.a);
  assert.equal(g.key('keydown', 'r', { ctrlKey:true }).defaultPrevented, false);
});
check('M toggles once per physical press; toolbar Map exposes map state', () => {
  canvas.focus(); const was = a.showMap;
  g.key('keydown', 'm'); assert.equal(a.showMap, !was);
  g.key('keydown', 'm', { repeat: true }); assert.equal(a.showMap, !was);
  g.key('keyup', 'm');
  const map = g.document.getElementById('tw-map'); assert.ok(map, 'tw-map button is required for touch users');
  g.fire(map, 'click'); assert.equal(a.showMap, was); assert.equal(map.getAttribute('aria-pressed'), String(was));
});
check('Blur, hidden page, leaving game, and mode change release held controls', () => {
  canvas.focus(); g.key('keydown', 'ArrowRight'); g.fire(g.window, 'blur'); assert.ok(!a.keys.ArrowRight);
  g.key('keydown', 'ArrowLeft'); g.document.hidden = true; g.fire(g.document, 'visibilitychange'); assert.ok(!a.keys.ArrowLeft); g.document.hidden = false;
  g.key('keydown', 'ArrowRight'); g.document.body.focus(); assert.ok(!a.keys.ArrowRight);
  canvas.focus(); g.key('keydown', 'ArrowLeft'); a.applyMode('auto'); assert.ok(!a.keys.ArrowLeft); a.applyMode('manual');
});
check('Hold mine + Space still jumps; aiming up while mining does not jump', () => {
  g.clearArena(); canvas.focus(); g.key('keydown', 'k'); g.key('keydown', 'ArrowUp'); a.manual(); assert.equal(a.P.vy, 0);
  g.key('keydown', ' '); a.manual(); assert.ok(a.P.vy < 0);
  g.key('keyup', ' '); g.key('keyup', 'ArrowUp'); g.key('keyup', 'k');
});
check('Manual mining removes a targeted block and placing spends one dirt block', () => {
  g.clearArena(); canvas.focus(); a.setT(11, 10, 1); g.key('keydown', 'k');
  for (let i=0;i<45;i++) a.manual(); assert.equal(a.get(11,10), 0); g.key('keyup','k');
  const dirt = a.gear.dirt; g.key('keydown', 'c'); a.manual(); g.key('keyup', 'c');
  assert.equal(a.gear.dirt, dirt - 1);
});
check('Local pathfinder prefers safe air detour over lava and rejects bedrock', () => {
  a.world.fill(11);
  for (let x=10;x<=14;x++) { a.setT(x, 10, 0); a.setT(x, 11, 0); }
  a.setT(12,10,14); const route = a.bfsPath(10,10,14,10); assert.ok(route && route.length);
  assert.ok(!route.some(p => p.x === 12 && p.y === 10)); assert.equal(a.bfsPath(10,10,20,20), null);
});
check('Local FSM retreats from danger and seeks healing at low HP', () => {
  g.clearArena(); a.P.hp = 20; a.decide(); assert.equal(a.agent.state,'HEAL');
  a.enemies.push({x:a.P.x+20,y:a.P.y,w:10,h:20,lv:20}); a.decide(); assert.equal(a.agent.state,'FLEE');
});
check('Death retains equipment, renders accurate message, and respawns', () => {
  g.clearArena(); a.gear.sword = 7; a.gear.pick = 5; const deaths = a.deaths;
  a.die(); assert.equal(a.deaths, deaths + 1); assert.ok(a.P.dead > 0); a.render();
  assert.ok(g.drawnText.some(t => /Respawning.*gear is safe/.test(t)));
  g.frames(112); assert.equal(a.P.dead, 0); assert.equal(a.gear.sword,7); assert.equal(a.gear.pick,5);
});
check('Touch controls support simultaneous move+jump and pointer cancellation', () => {
  a.applyMode('manual'); g.clearArena();
  const controls = g.document.getElementById('tw-wrap').querySelectorAll('[data-tw-key]');
  const button = k => controls.find(b => b.getAttribute('data-tw-key') === k);
  for (const k of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','x','k','c']) assert.ok(button(k), 'Missing touch control ' + JSON.stringify(k));
  const right = button('ArrowRight'), jump = button(' ');
  assert.equal(g.fire(right,'pointerdown',{pointerId:11}).defaultPrevented,true);
  g.fire(jump,'pointerdown',{pointerId:12}); assert.ok(a.keys.ArrowRight && a.keys[' ']);
  a.manual(); assert.ok(a.P.vx > 0 && a.P.vy < 0);
  g.fire(right,'pointercancel',{pointerId:11}); assert.ok(!a.keys.ArrowRight && a.keys[' ']);
  g.fire(jump,'lostpointercapture',{pointerId:12}); assert.ok(!a.keys[' ']);
  // Releasing a pointer must not erase the same key held on the keyboard.
  canvas.focus(); g.key('keydown','ArrowRight'); g.fire(right,'pointerdown',{pointerId:13}); g.fire(right,'pointerup',{pointerId:13});
  assert.ok(a.keys.ArrowRight); g.key('keyup','ArrowRight'); assert.ok(!a.keys.ArrowRight);
});
check('New resets world/gear/map while preserving selected mode', () => {
  a.applyMode('manual'); canvas.focus(); g.key('keydown','m');
  g.fire(g.document.getElementById('tw-new'),'click');
  assert.equal(a.agent.mode,'manual'); assert.equal(a.gear.pick,1); assert.equal(a.gear.sword,1);
  assert.equal(a.P.dead,0); assert.equal(a.showMap,false); assert.ok(a.world.some(t=>t!==0));
});
check('360px mobile and 1,440px desktop render without runtime errors', () => {
  for (const width of [360,1440]) {
    const view = boot(source, html, width); view.frames(30);
    const c = view.document.getElementById('tw-canvas'); assert.ok(c.width > 0 && c.height > 0); assert.ok(view.draws > 0);
  }
});
check('No runtime network, endpoint prompt, or legacy storage access', () => {
  assert.deepEqual(g.network, []); assert.deepEqual(g.storage, []);
});
console.log(JSON.stringify({ ok:true, passed:passed.length, source:sourcePath, page:pagePath,
  scope:'Deterministic Node VM / stub DOM and Canvas, not browser layout or physical-device QA' }, null, 2));
