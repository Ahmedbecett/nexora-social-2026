/* ==========================================================================
   NEXORA AI — بوابة إعلانات الويب الموحّدة
   إيقاع واحد لكل إعلانات الموقع كما طلب المالك: انطباع واحد كل 30 دقيقة،
   يظهر ثم يختفي تلقائيًا بعد 15 ثانية.
   - AdSense (AdSlot) وبانر Adsterra يتشاركان النافذة نفسها: أول من يظهر يحجزها.
   - Popunder (Monetag) له مفتاحه الخاص داخل ملفه.
   - تطبيق أندرويد لا يرى هذه الإعلانات أصلًا (انظر src/ads.js).
   ========================================================================== */
const GATE_KEY = 'nx_web_ad_last';

/** نافذة الإعلان: 30 دقيقة بين انطباع وآخر */
export const WEB_AD_WINDOW_MS = 30 * 60 * 1000;
/** كم يبقى الإعلان ظاهرًا قبل أن يختفي */
export const WEB_AD_HIDE_MS = 15_000;

function readLast() {
  try { return Number(localStorage.getItem(GATE_KEY) || 0) || 0; } catch { return 0; }
}
export function webAdWindowOpen() {
  return Date.now() - readLast() >= WEB_AD_WINDOW_MS;
}
export function webAdMarkShown() {
  try { localStorage.setItem(GATE_KEY, String(Date.now())); } catch { /* بيئات مقيدة */ }
}
/** يطالب بالنافذة: يعيد true مرة واحدة فقط داخل كل 30 دقيقة */
export function webAdClaim() {
  if (!webAdWindowOpen()) return false;
  webAdMarkShown();
  return true;
}
