const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const bootstrap = fs.readFileSync('_layouts/research.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const script = fs.readFileSync('assets/js/research.js', 'utf8');
function boot(saved, browserLanguage, blocked = false) {
  const store = {...saved};
  const root = {dataset: {}, lang: 'en'};
  const button = language => ({dataset: {language}, attributes: {}, listeners: {}, setAttribute(k,v) {this.attributes[k]=v}, addEventListener(k,v) {this.listeners[k]=v}});
  const buttons = [button('en'),button('zh')], theme = button();
  const context = {document:{documentElement:root,querySelectorAll:()=>buttons,querySelector:()=>theme},navigator:{language:browserLanguage},localStorage:{getItem(k) {if(blocked) throw Error('denied');return store[k]},setItem(k,v) {if(blocked) throw Error('denied');store[k]=v}}};
  vm.runInNewContext(bootstrap,context); vm.runInNewContext(script,context);
  return {root,buttons,theme,store};
}
const zh=boot({},'zh-CN'); assert.equal(zh.root.lang,'zh-CN'); assert.equal(zh.buttons[1].attributes['aria-pressed'],'true');
zh.buttons[0].listeners.click(); assert.equal(zh.root.lang,'en'); assert.equal(zh.store['site-language'],'en'); assert.equal(zh.buttons[1].attributes['aria-pressed'],'false');
assert.equal(boot(zh.store,'zh-CN').root.lang,'en');
const en=boot({'site-language':'invalid'},'en-US');assert.equal(en.root.lang,'en');
en.theme.listeners.click();assert.equal(en.store['site-theme'],'dark');assert.equal(en.theme.attributes['aria-pressed'],'true');
assert.equal(boot(en.store,'en').root.dataset.theme,'dark');
en.theme.listeners.click();assert.equal(en.root.dataset.theme,'light');
const privateWindow=boot({},'en',true);privateWindow.buttons[1].listeners.click();privateWindow.theme.listeners.click();assert.equal(privateWindow.root.lang,'zh-CN');
console.log('PASS: language detection, switching, persistence, aria states, theme switching, and blocked storage');
