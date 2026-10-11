// Shared media state: one sound switch for the feed, one for Reels (like Instagram), and
// pausing every video when the app goes to the background (Android keeps playing otherwise).
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

const state = { feedMuted: true, reelsMuted: false, appActive: true };
const subs = new Set();
const emit = () => subs.forEach((fn) => fn({ ...state }));

export function setFeedMuted(v) { state.feedMuted = !!v; emit(); }
export function setReelsMuted(v) { state.reelsMuted = !!v; emit(); }

export function useMedia() {
  const [s, set] = useState({ ...state });
  useEffect(() => { subs.add(set); set({ ...state }); return () => subs.delete(set); }, []);
  return s;
}

export function pauseAllMedia() {
  document.querySelectorAll('video, audio').forEach((m) => { try { m.pause(); } catch { /* */ } });
}

/** play() with sound; if the platform refuses unmuted autoplay, fall back to muted playback. */
export function playSafe(v, onForcedMute) {
  if (!v || !state.appActive) return;
  const p = v.play();
  if (p && p.catch) p.catch((err) => {
    if (err?.name === 'NotAllowedError' && !v.muted) {
      v.muted = true; onForcedMute?.();
      v.play().catch(() => {});
    }
  });
}

function setActive(active) {
  if (state.appActive === active) return;
  state.appActive = active;
  if (!active) pauseAllMedia();
  emit();
}

export function initMedia() {
  document.addEventListener('visibilitychange', () => setActive(document.visibilityState === 'visible'));
  if (Capacitor.isNativePlatform()) {
    CapApp.addListener('appStateChange', ({ isActive }) => setActive(isActive));
    CapApp.addListener('pause', () => setActive(false));
    CapApp.addListener('resume', () => setActive(true));
  }
}
