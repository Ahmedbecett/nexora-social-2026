import { useEffect, useState } from 'react';
import { getLang } from './i18n.js';
import { reloadWithLatest, watchForUpdates } from './updates.js';

/**
 * شريط «تحديث جديد متاح» — يظهر تلقائيًا عندما يكون المنشور أحدث من الحزمة
 * التي تعمل في هذا التبويب، ويصحّح الصفحة القديمة بضغطة واحدة.
 */
export default function UpdateNotice() {
  const [latest, setLatest] = useState(null);
  const ar = getLang() !== 'en';

  useEffect(() => watchForUpdates(setLatest), []);

  if (!latest) return null;

  return (
    <div className="nx-update-bar" role="status" dir={ar ? 'rtl' : 'ltr'}>
      <span className="nx-update-text">
        {ar ? 'تحديث جديد متاح — أنت على نسخة قديمة' : 'A new version is available — you are on an older one'}
      </span>
      <button type="button" className="nx-update-btn" onClick={() => reloadWithLatest(latest.buildId)}>
        {ar ? 'تحديث الآن' : 'Update now'}
      </button>
    </div>
  );
}
