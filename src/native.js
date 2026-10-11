// Open links like a native app: Chrome Custom Tabs on Android, new tab on the web.
import { Capacitor } from '@capacitor/core';

export async function openUrl(url) {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, toolbarColor: '#0c1014' });
      return;
    } catch { /* fall through */ }
  }
  window.open(url, '_blank', 'noopener');
}
