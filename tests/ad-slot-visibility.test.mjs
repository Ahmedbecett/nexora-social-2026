import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adSlotState, watchAdSlot, EMPTY_SLOT_TIMEOUT_MS } from '../src/ai/adSlotVisibility.js';

function adIns(status = null, iframe = false) {
  return {
    status, iframe,
    getAttribute(name) { assert.equal(name, 'data-ad-status'); return this.status; },
    querySelector(selector) { assert.equal(selector, 'iframe'); return this.iframe ? {} : null; },
  };
}

function fakeBrowser() {
  const timers = new Map();
  const observers = [];
  let nextId = 0;
  const env = {
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(target, options) { this.target = target; this.options = options; this.connected = true; }
      disconnect() { this.connected = false; }
      notify() { if (this.connected) this.callback(); }
    },
    setTimeout(callback, ms) { const id = ++nextId; timers.set(id, { callback, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const fireTimeout = () => {
    const [id, timer] = timers.entries().next().value;
    timers.delete(id);
    timer.callback();
  };
  return { env, timers, observers, fireTimeout };
}

test('only an empty or timed-out AdSense slot is collapsed; valid creatives remain eligible', () => {
  const ins = adIns();
  assert.equal(adSlotState(ins), 'pending', 'the initial ad slot must stay visible for a request');
  assert.equal(adSlotState(ins, true), 'empty', 'blocked or silent requests eventually collapse');
  ins.iframe = true;
  assert.equal(adSlotState(ins, true), 'filled', 'preserve iframe creatives even without a status');
  ins.status = 'unfilled';
  assert.equal(adSlotState(ins), 'empty', 'explicit no-fill wins over a leftover iframe');
  ins.status = 'filled';
  assert.equal(adSlotState(ins), 'filled');
  ins.status = 'unfill-optimized';
  assert.equal(adSlotState(ins), 'filled', 'do not hide provider-optimized content');
});

test('observer collapses a confirmed no-fill and can reveal a late filled result', () => {
  const ins = adIns();
  const browser = fakeBrowser();
  const states = [];
  const stop = watchAdSlot(ins, (state) => states.push(state), { env: browser.env });
  assert.deepEqual(states, ['pending']);
  assert.equal(browser.timers.size, 1);
  assert.equal(browser.timers.values().next().value.ms, EMPTY_SLOT_TIMEOUT_MS);
  assert.deepEqual(browser.observers[0].options.attributeFilter, ['data-ad-status']);
  assert.equal(browser.observers[0].options.childList, true);

  ins.status = 'unfilled';
  browser.observers[0].notify();
  assert.equal(states.at(-1), 'empty');
  assert.equal(browser.timers.size, 0, 'no timer remains after an answer');
  ins.status = 'filled';
  browser.observers[0].notify();
  assert.equal(states.at(-1), 'filled', 'a late valid ad is not permanently hidden');
  stop();
  ins.status = 'unfilled';
  browser.observers[0].notify();
  assert.equal(states.at(-1), 'filled', 'unmounted slots no longer update');
});

test('silent requests collapse after timeout but recover when a real iframe arrives', () => {
  const ins = adIns();
  const browser = fakeBrowser();
  const states = [];
  const stop = watchAdSlot(ins, (state) => states.push(state), { env: browser.env });
  browser.fireTimeout();
  assert.equal(states.at(-1), 'empty');
  ins.iframe = true;
  browser.observers[0].notify();
  assert.equal(states.at(-1), 'filled');
  stop();
  assert.equal(browser.observers[0].connected, false);
  assert.equal(browser.timers.size, 0);
});

test('only the in-app AdSense wrapper is collapsed; existing ads and native exclusion remain', () => {
  const component = readFileSync('src/ai/AdSlot.jsx', 'utf8');
  const css = readFileSync('src/ai/AIPlatform.css', 'utf8');
  assert.match(component, /watchAdSlot\(ins, setAdState\)/);
  assert.match(component, /data-ad-state=\{adState\}/);
  assert.match(component, /1971049956/);
  assert.match(component, /adsbygoogle\.js/);
  assert.match(component, /adsAllowed\(\)/);
  assert.match(css, /\.nx-ai-ad\[data-ad-state="empty"\]\{display:none!important\}/);
  assert.match(readFileSync('public/monetag-web.js', 'utf8'), /const zone = '310646'/);
});
