// AdSense reports the result of an in-page request on the <ins> itself.
// Do not hide the slot before requesting an ad: Google may skip hidden units.
export const EMPTY_SLOT_TIMEOUT_MS = 10_000;

export function adSlotState(ins, timedOut = false) {
  const status = ins.getAttribute('data-ad-status');
  if (status === 'unfilled') return 'empty';
  if (status === 'filled' || status === 'unfill-optimized') return 'filled';
  // An ad served inside an iframe may not receive data-ad-status; preserve it.
  if (ins.querySelector('iframe')) return 'filled';
  return timedOut ? 'empty' : 'pending';
}

export function watchAdSlot(ins, onState, { timeoutMs = EMPTY_SLOT_TIMEOUT_MS, env = globalThis } = {}) {
  let timedOut = false;
  let timer;
  const update = () => {
    const state = adSlotState(ins, timedOut);
    onState(state);
    if (state !== 'pending' && timer !== undefined) {
      env.clearTimeout(timer);
      timer = undefined;
    }
  };
  const observer = new env.MutationObserver(update);
  observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'], childList: true, subtree: true });
  timer = env.setTimeout(() => { timedOut = true; update(); }, timeoutMs);
  update();
  return () => {
    observer.disconnect();
    if (timer !== undefined) env.clearTimeout(timer);
  };
}
