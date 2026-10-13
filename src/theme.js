// Theme (dark / light / system) + native system-bar colours.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

const SystemBars = registerPlugin('SystemBars');
const KEY = 'nx_theme';
const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set();

/** 'dark' (default, like the Instagram app), 'light' or 'system' */
export const getThemePref = () => localStorage.getItem(KEY) || 'dark';
export const resolvedTheme = () => {
  const p = getThemePref();
  return p === 'system' ? (mq?.matches ? 'dark' : 'light') : p;
};
export function onThemeChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function initTheme() {
  const th = resolvedTheme();
  document.documentElement.dataset.theme = th;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th === 'dark' ? '#0c1014' : '#ffffff');
}
export function setThemePref(p) {
  localStorage.setItem(KEY, p);
  initTheme();
  listeners.forEach((f) => f());
}
mq?.addEventListener?.('change', () => {
  if (getThemePref() !== 'system') return;
  initTheme(); listeners.forEach((f) => f());
});

let last = '';
/** Colour the Android status + navigation bars to match the current screen. */
export function applyTheme({ immersive = false } = {}) {
  initTheme();
  if (!Capacitor.isNativePlatform()) return;
  const dark = immersive || resolvedTheme() === 'dark';
  const color = immersive ? '#000000' : dark ? '#0c1014' : '#ffffff';
  const key = color + dark;
  if (key === last) return;
  last = key;
  SystemBars.set({ color, darkIcons: !dark }).catch(() => {
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color }).catch(() => {});
  });
}

/** Light haptic tap on native (likes, etc.). No-op on the web. */
let hapticsMod = null;
export function tapHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  (hapticsMod ||= import('@capacitor/haptics'))
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => {});
}
