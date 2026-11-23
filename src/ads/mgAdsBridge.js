/* ==========================================================================
   NEXORA AI by BECETTI — Secure WebView2 JS <-> Native MG Ads Bridge
   --------------------------------------------------------------------------
   Communicates ONLY with the native C# + WebView2 host (NexoraWindows.exe)
   over window.chrome.webview.postMessage.

   Security invariants:
     • Never holds, receives, or logs the MG Ads Private Key.
     • Fails closed (returns unavailable/null) on normal browsers, PWA, Android.
     • Never generates fake impressions, clicks, or unearned rewards.
   ========================================================================== */

const BRIDGE_TYPE = 'nx-mgads';
const DEFAULT_TIMEOUT_MS = 12_000;
const REWARDED_TIMEOUT_MS = 190_000;

let seq = 0;
let listenerInstalled = false;
const pending = new Map();
const eventListeners = new Set();
const stateListeners = new Set();
let cachedState = null;

function safeWin(win) {
  return win || (typeof window !== 'undefined' ? window : null);
}

/** True ONLY when running inside the native C# WebView2 MSIX host. */
export function isNativeMgAdsHost(win) {
  const w = safeWin(win);
  if (!w) return false;
  try {
    const hasWebView = Boolean(w.chrome && w.chrome.webview && typeof w.chrome.webview.postMessage === 'function');
    if (!hasWebView) return false;
    if (w.document && w.document.documentElement && w.document.documentElement.dataset?.nxNativeHost === 'webview2-mgads') {
      return true;
    }
    const q = new URLSearchParams(w.location?.search || '');
    if (q.get('nx_host') === 'native-webview2') return true;
    return w.sessionStorage?.getItem('nx_host') === 'native-webview2';
  } catch {
    return false;
  }
}

function handleIncomingMessage(raw) {
  let msg = raw;
  if (typeof msg === 'string') {
    try { msg = JSON.parse(msg); } catch { return; }
  }
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'nx-mgads-response' && msg.requestId && pending.has(msg.requestId)) {
    const entry = pending.get(msg.requestId);
    pending.delete(msg.requestId);
    clearTimeout(entry.timer);
    if (msg.ok) entry.resolve(msg.data);
    else entry.resolve({ ok: false, error: msg.error || 'native-error' });
    return;
  }

  if (msg.type === 'nx-mgads-state' && msg.payload) {
    cachedState = msg.payload;
    for (const fn of stateListeners) {
      try { fn(cachedState); } catch { /* ignore */ }
    }
    return;
  }

  if (msg.type === 'nx-mgads-event' && msg.payload) {
    for (const fn of eventListeners) {
      try { fn(msg.payload); } catch { /* ignore */ }
    }
  }
}

function ensureListener(win) {
  const w = safeWin(win);
  if (!w || listenerInstalled) return;
  try {
    if (w.chrome && w.chrome.webview && typeof w.chrome.webview.addEventListener === 'function') {
      w.chrome.webview.addEventListener('message', (evt) => handleIncomingMessage(evt?.data));
      listenerInstalled = true;
    }
  } catch { /* ignore */ }
}

function invokeNative(action, payload = {}, timeoutMs = DEFAULT_TIMEOUT_MS, win) {
  const w = safeWin(win);
  if (!isNativeMgAdsHost(w)) {
    return Promise.resolve({ ok: false, reason: 'not-native-host' });
  }
  ensureListener(w);

  return new Promise((resolve) => {
    const requestId = `mg_${Date.now()}_${++seq}`;
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve({ ok: false, reason: 'timeout' });
    }, timeoutMs);

    pending.set(requestId, { resolve, timer });
    try {
      w.chrome.webview.postMessage({
        type: BRIDGE_TYPE,
        requestId,
        action,
        payload,
      });
    } catch {
      clearTimeout(timer);
      pending.delete(requestId);
      resolve({ ok: false, reason: 'post-message-failed' });
    }
  });
}

export function getCachedMgAdsState() {
  return cachedState;
}

export async function getMgAdsState(win) {
  const res = await invokeNative('getState', {}, DEFAULT_TIMEOUT_MS, win);
  if (res && typeof res === 'object' && res.provider === 'mgads') {
    cachedState = res;
  }
  return res;
}

export function syncViewContext({ view = 'studio', hasMessages = false } = {}, win) {
  if (!isNativeMgAdsHost(win)) return Promise.resolve(null);
  return invokeNative('syncView', { view: String(view), hasMessages: Boolean(hasMessages) }, DEFAULT_TIMEOUT_MS, win);
}

export function requestBanner({ force = false } = {}, win) {
  if (!isNativeMgAdsHost(win)) return Promise.resolve({ shown: false, reason: 'not-native-host' });
  return invokeNative('showBanner', { force: Boolean(force) }, DEFAULT_TIMEOUT_MS, win);
}

export function hideBanner(win) {
  if (!isNativeMgAdsHost(win)) return Promise.resolve({ hidden: false });
  return invokeNative('hideBanner', {}, DEFAULT_TIMEOUT_MS, win);
}

export async function showNativeRewardedAd({ comment = 'nexora-windows-reward' } = {}, win) {
  if (!isNativeMgAdsHost(win)) {
    return { shown: false, completed: false, reason: 'not-native-host' };
  }
  return invokeNative('showRewarded', { comment: String(comment || 'nexora-windows-reward') }, REWARDED_TIMEOUT_MS, win);
}

export function requestCouplet(win) {
  if (!isNativeMgAdsHost(win)) return Promise.resolve({ shown: false, reason: 'not-native-host' });
  return invokeNative('showCouplet', {}, DEFAULT_TIMEOUT_MS, win);
}

export function hideCouplet(win) {
  if (!isNativeMgAdsHost(win)) return Promise.resolve({ hidden: false });
  return invokeNative('hideCouplet', {}, DEFAULT_TIMEOUT_MS, win);
}

export function showNativeInterstitial(win) {
  if (!isNativeMgAdsHost(win)) return Promise.resolve({ shown: false, reason: 'not-native-host' });
  return invokeNative('showInterstitial', {}, DEFAULT_TIMEOUT_MS, win);
}

export function openNativePrivacyChoices(win) {
  if (!isNativeMgAdsHost(win)) return Promise.resolve({ opened: false, reason: 'not-native-host' });
  return invokeNative('openPrivacyChoices', {}, DEFAULT_TIMEOUT_MS, win);
}

export function onMgAdsStateChange(callback, win) {
  if (typeof callback !== 'function') return () => {};
  ensureListener(win);
  stateListeners.add(callback);
  if (cachedState) {
    try { callback(cachedState); } catch { /* ignore */ }
  }
  return () => stateListeners.delete(callback);
}

export function onMgAdsEvent(callback, win) {
  if (typeof callback !== 'function') return () => {};
  ensureListener(win);
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
}

export default {
  isNativeMgAdsHost,
  getCachedMgAdsState,
  getMgAdsState,
  syncViewContext,
  requestBanner,
  hideBanner,
  showNativeRewardedAd,
  requestCouplet,
  hideCouplet,
  showNativeInterstitial,
  openNativePrivacyChoices,
  onMgAdsStateChange,
  onMgAdsEvent,
};
