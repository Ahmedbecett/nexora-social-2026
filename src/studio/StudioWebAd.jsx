/* ============================================================================
   NEXORA Studio — web ad placement (round 8)
   Ads now reach every device: the web (Windows/mac/mobile browsers) shows the
   guarded Adsterra Native Banner here inside the studio chat column, while the
   Android app keeps using AdMob (src/ads.js) — never both, never in WebView.
   The /adsterra-web.js bootstrap picks this container up through its DOM
   observer; the shared 30-minute gate keeps the rhythm site-wide.
   ============================================================================ */
import { Capacitor } from '@capacitor/core';
import AdsterraBanner from '../ai/AdsterraBanner.jsx';

export default function StudioWebAd() {
  try {
    if (Capacitor.isNativePlatform()) return null;
  } catch { /* ويب عادي */ }
  return <AdsterraBanner />;
}
