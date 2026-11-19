/* ==========================================================================
   NEXORA AI — غلاف Windows (Window Controls Overlay + قوائم + اختصارات)
   --------------------------------------------------------------------------
   لا يظهر هذا الغلاف إلا داخل تطبيق Windows مثبّت يدعم Window Controls
   Overlay (Edge/Chrome حديث). في المتصفح العادي أو تطبيق أندرويد لا يُرسم
   أي شيء — لا شريط إضافي ولا تغيير في التخطيط.

   المبدأ: أزرار النافذة الأصلية (تصغير/تكبير/إغلاق) تبقى ملك Windows؛ نحن
   نملأ المنطقة القابلة للسحب فقط، ونضع فيها اسم التطبيق وقائمة تطبيق حقيقية
   (محادثة جديدة، Studio، الإعدادات، التحقق من التحديث، الخصوصية، حول).
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_VERSION } from './version.js';
import { BUILD_ID, fetchLatestBuild, isStale, reloadWithLatest } from './updates.js';
import { isCapacitorNative, isWindowsApp, runtimeSurface, supportsWindowControlsOverlay } from './platform.js';
import { applyServiceWorkerUpdate, checkForServiceWorkerUpdate, onServiceWorkerUpdate } from './pwa.js';
import { openUrl } from './native.js';

const EVENTS = {
  openChat: 'nxs-open-chat',
  openStudio: 'nxs-open-studio',
  newChat: 'nxs-new-chat',
  settings: 'nxs-open-settings',
};

const TEXT = {
  ar: {
    app: 'NEXORA AI',
    menu: 'قائمة التطبيق',
    newChat: 'محادثة جديدة',
    studio: 'NEXORA Studio',
    settings: 'الحساب والإعدادات',
    updates: 'التحقق من التحديثات',
    shortcuts: 'اختصارات لوحة المفاتيح',
    privacy: 'سياسة الخصوصية (Windows)',
    support: 'الدعم والمساعدة',
    about: 'حول التطبيق',
    offline: 'لا يوجد اتصال — ستُحفظ أعمالك المحلية، لكن المحادثات تحتاج الشبكة.',
    online: 'عاد الاتصال بالإنترنت',
    updateReady: 'تحديث جديد جاهز — أعد التشغيل لتثبيته',
    applyUpdate: 'إعادة التشغيل الآن',
    later: 'لاحقًا',
    checking: 'جارٍ التحقق…',
    upToDate: 'أنت على أحدث إصدار',
    checkFailed: 'تعذّر التحقق من التحديثات — تحقق من الاتصال',
    version: 'الإصدار',
    build: 'البناء',
    surface: 'السطح',
    close: 'إغلاق',
    dialogHint: 'اضغط Esc للإغلاق',
    scNew: 'فتح مساحة المحادثة',
    scSettings: 'فتح الحساب والإعدادات',
    scShortcuts: 'عرض هذه القائمة',
    shortcutsTitle: 'اختصارات Windows',
  },
  en: {
    app: 'NEXORA AI',
    menu: 'Application menu',
    newChat: 'New conversation',
    studio: 'NEXORA Studio',
    settings: 'Account & settings',
    updates: 'Check for updates',
    shortcuts: 'Keyboard shortcuts',
    privacy: 'Privacy policy (Windows)',
    support: 'Support & help',
    about: 'About NEXORA AI',
    offline: 'You are offline — local work is safe, but AI conversations need a connection.',
    online: 'Back online',
    updateReady: 'An update is ready — restart to install it',
    applyUpdate: 'Restart now',
    later: 'Later',
    checking: 'Checking…',
    upToDate: 'You are on the latest version',
    checkFailed: 'Could not check for updates — verify your connection',
    version: 'Version',
    build: 'Build',
    surface: 'Surface',
    close: 'Close',
    dialogHint: 'Press Esc to close',
    scNew: 'Open the conversation workspace',
    scSettings: 'Open account & settings',
    scShortcuts: 'Show this list',
    shortcutsTitle: 'Windows shortcuts',
  },
};

function useHtmlLang() {
  const read = () => {
    try {
      return document.documentElement.lang === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  };
  const [lang, setLang] = useState(read);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;
    const obs = new MutationObserver(() => setLang(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => obs.disconnect();
  }, []);
  return lang;
}

/* ----------------------------- Window drag area --------------------------- */

export function useWindowControlsOverlay() {
  const [state, setState] = useState(() => {
    try {
      const wco = typeof navigator !== 'undefined' ? navigator.windowControlsOverlay : null;
      return { supported: Boolean(wco), visible: Boolean(wco && wco.visible), height: 32, right: 138 };
    } catch {
      return { supported: false, visible: false, height: 32, right: 138 };
    }
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.windowControlsOverlay) return undefined;
    const wco = navigator.windowControlsOverlay;
    const sync = () => {
      try {
        const rect = typeof wco.getTitlebarAreaRect === 'function' ? wco.getTitlebarAreaRect() : null;
        setState({
          supported: true,
          visible: Boolean(wco.visible),
          height: Math.max(0, Math.min(80, Math.round(rect?.height || 32))),
          right: Math.max(0, Math.round(rect?.width || 0)),
        });
      } catch {
        setState({ supported: true, visible: Boolean(wco.visible), height: 32, right: 0 });
      }
    };
    sync();
    try { wco.addEventListener('geometrychange', sync); } catch { /* ignore */ }
    return () => {
      try { wco.removeEventListener('geometrychange', sync); } catch { /* ignore */ }
    };
  }, []);

  return state;
}

/* Studio يستخدم data-theme="cream|dark" على .nxs، بينما شريط Windows يقرأ متغيّرات html.
   ننسخ السمة الفعلية إلى data-nx-studio-theme كي يبقى شريط العنوان متناسقًا. */
function useStudioSurfaceTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const el = document.querySelector('.nxs[data-theme]');
      if (el) root.dataset.nxStudioTheme = el.getAttribute('data-theme') || '';
      else root.removeAttribute('data-nx-studio-theme');
    };
    sync();
    if (typeof MutationObserver === 'undefined') return undefined;
    const obs = new MutationObserver(sync);
    // فقط تغييرات السمة وتبديل السطح — لا نراقب كل عقدة أثناء بث المحادثة.
    obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-theme'] });
    const host = document.getElementById('root');
    if (host) obs.observe(host, { childList: true });
    return () => {
      obs.disconnect();
      root.removeAttribute('data-nx-studio-theme');
    };
  }, []);
}

function dispatch(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, detail ? { detail } : undefined));
  } catch { /* ignore */ }
}

/* ------------------------------ Offline notice ---------------------------- */

export function OfflineNotice() {
  const [online, setOnline] = useState(() => {
    try { return navigator.onLine !== false; } catch { return true; }
  });
  const [showBack, setShowBack] = useState(false);
  const lang = useHtmlLang();
  const t = TEXT[lang];

  useEffect(() => {
    if (typeof window === 'undefined' || isCapacitorNative()) return undefined;
    let timer = 0;
    const up = () => {
      setOnline(true);
      setShowBack(true);
      timer = window.setTimeout(() => setShowBack(false), 3500);
    };
    const down = () => { setOnline(false); setShowBack(false); };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (isCapacitorNative() || !isWindowsApp()) return null;
  if (online && !showBack) return null;
  return (
    <div className={`nx-net-bar ${online ? 'is-online' : 'is-offline'}`} role="status" aria-live="polite" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <span className="nx-net-dot" aria-hidden="true" />
      {online ? t.online : t.offline}
    </div>
  );
}

/* ---------------------------------- Menu ---------------------------------- */

export default function WindowsShell() {
  const [enabled, setEnabled] = useState(false);
  const lang = useHtmlLang();
  const t = TEXT[lang];
  const wco = useWindowControlsOverlay();
  useStudioSurfaceTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // 'shortcuts' | 'about' | null
  const [checkState, setCheckState] = useState('idle');
  const [updateReady, setUpdateReady] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  /* هل نحن تطبيق Windows فعليًا؟ يُحسب بعد التركيب لتجنّب اختلاف SSR. */
  useEffect(() => {
    setEnabled(isWindowsApp() && supportsWindowControlsOverlay() && wco.visible);
  }, [wco.visible]);

  /* مزامنة خصائص الجذر مع تخطيط الصفحة */
  useEffect(() => {
    const root = document.documentElement;
    if (!enabled) {
      root.removeAttribute('data-nx-wco');
      root.style.removeProperty('--nx-titlebar-h');
      return undefined;
    }
    root.dataset.nxWco = '1';
    root.dataset.nxPlatform = runtimeSurface();
    root.style.setProperty('--nx-titlebar-h', `${wco.height || 32}px`);
    return () => {
      root.removeAttribute('data-nx-wco');
      root.style.removeProperty('--nx-titlebar-h');
    };
  }, [enabled, wco.height]);

  /* حالة التحديث الجاهز — لتطبيق Windows فقط (UpdateNotice يتكفّل بالويب) */
  useEffect(() => {
    if (!isWindowsApp()) return undefined;
    return onServiceWorkerUpdate(() => setUpdateReady(true));
  }, []);

  /* اختصارات لوحة المفاتيح (Windows فقط) */
  useEffect(() => {
    if (typeof window === 'undefined' || !isWindowsApp()) return undefined;
    const onKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        dispatch(EVENTS.openChat);
        window.setTimeout(() => dispatch(EVENTS.newChat), 40);
        return;
      }
      if (ctrl && !e.shiftKey && !e.altKey && (e.key === ',' || e.key === '،')) {
        e.preventDefault();
        dispatch(EVENTS.settings);
        return;
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setDialog('shortcuts');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* إغلاق القائمة بالنقر خارجها */
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !buttonRef.current?.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  /* Escape يغلق القائمة أو النافذة */
  useEffect(() => {
    if (!menuOpen && !dialog) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (dialog) setDialog(null);
      else {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen, dialog]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const runAction = useCallback(async (action) => {
    closeMenu();
    if (action === 'new-chat') {
      dispatch(EVENTS.openChat);
      window.setTimeout(() => dispatch(EVENTS.newChat), 40);
      return;
    }
    if (action === 'studio') {
      dispatch(EVENTS.openStudio);
      return;
    }
    if (action === 'settings') {
      dispatch(EVENTS.settings);
      return;
    }
    if (action === 'shortcuts') {
      setDialog('shortcuts');
      return;
    }
    if (action === 'about') {
      setDialog('about');
      return;
    }
    if (action === 'privacy') {
      openUrl('/windows/privacy.html');
      return;
    }
    if (action === 'support') {
      openUrl('/windows/#support');
      return;
    }
    if (action === 'updates') {
      setCheckState('checking');
      const hasSw = await checkForServiceWorkerUpdate();
      if (hasSw) {
        setUpdateReady(true);
        setCheckState('ready');
        return;
      }
      const latest = await fetchLatestBuild();
      if (isStale(latest, BUILD_ID)) {
        setCheckState('ready');
        reloadWithLatest(latest.buildId);
        return;
      }
      setCheckState(latest ? 'latest' : 'failed');
    }
  }, [closeMenu]);

  if (!enabled) {
    // على الويب العادي أو أندرويد لا نضيف أي شريط: UpdateNotice الحالي يتكفّل بالتحديث.
    if (!isWindowsApp()) return null;
    return (
      <>
        <OfflineNotice />
        <UpdateToast updateReady={updateReady} setUpdateReady={setUpdateReady} lang={lang} t={t} />
      </>
    );
  }

  const menuItems = [
    ['new-chat', t.newChat, 'Ctrl+N'],
    ['studio', t.studio, ''],
    ['settings', t.settings, 'Ctrl+,'],
    ['updates', t.updates, ''],
    ['shortcuts', t.shortcuts, 'F1'],
    ['privacy', t.privacy, ''],
    ['support', t.support, ''],
    ['about', t.about, ''],
  ];

  return (
    <>
      <OfflineNotice />
      <UpdateToast updateReady={updateReady} setUpdateReady={setUpdateReady} lang={lang} t={t} />

      <div
        className="nx-win-titlebar"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        style={{ height: `${wco.height || 32}px` }}
        role="banner"
      >
        <div className="nx-win-titlebar-brand" aria-label={t.app}>
          <img src="/icon-192.png" width="16" height="16" alt="" aria-hidden="true" />
          <span>{t.app}</span>
          <small>Windows</small>
        </div>

        <div className="nx-win-titlebar-actions">
          <button
            ref={buttonRef}
            type="button"
            className="nx-win-menu-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls="nx-win-menu"
            title={t.menu}
            aria-label={t.menu}
            onClick={() => setMenuOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMenuOpen(true);
                window.setTimeout(() => menuRef.current?.querySelector('[role="menuitem"]')?.focus(), 0);
              }
            }}
          >
            <span aria-hidden="true">⋯</span>
          </button>

          {menuOpen && (
            <div id="nx-win-menu" ref={menuRef} className="nx-win-menu" role="menu" aria-label={t.menu}>
              {menuItems.map(([action, label, shortcut], index) => (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  className="nx-win-menu-item"
                  onClick={() => runAction(action)}
                  onKeyDown={(e) => {
                    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
                    const pos = items.indexOf(e.currentTarget);
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      items[(pos + 1) % items.length]?.focus();
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      items[(pos - 1 + items.length) % items.length]?.focus();
                    } else if (e.key === 'Home') {
                      e.preventDefault();
                      items[0]?.focus();
                    } else if (e.key === 'End') {
                      e.preventDefault();
                      items[items.length - 1]?.focus();
                    }
                  }}
                  tabIndex={index === 0 ? 0 : -1}
                >
                  <span>{label}</span>
                  {shortcut && <kbd>{shortcut}</kbd>}
                </button>
              ))}
              <div className="nx-win-menu-note" role="status" aria-live="polite">
                {checkState === 'checking' && t.checking}
                {checkState === 'latest' && t.upToDate}
                {checkState === 'failed' && t.checkFailed}
                {checkState === 'ready' && t.updateReady}
              </div>
            </div>
          )}
        </div>
      </div>

      {dialog === 'shortcuts' && (
        <ShellDialog title={t.shortcutsTitle} hint={t.dialogHint} closeLabel={t.close} onClose={() => setDialog(null)}>
          <dl className="nx-win-keys">
            <div><dt><kbd>Ctrl</kbd> + <kbd>N</kbd></dt><dd>{t.scNew}</dd></div>
            <div><dt><kbd>Ctrl</kbd> + <kbd>,</kbd></dt><dd>{t.scSettings}</dd></div>
            <div><dt><kbd>F1</kbd></dt><dd>{t.scShortcuts}</dd></div>
            <div><dt><kbd>Ctrl</kbd> + <kbd>K</kbd></dt><dd>{lang === 'ar' ? 'لوحة الأوامر والبحث في Studio' : 'Studio command palette'}</dd></div>
            <div><dt><kbd>Ctrl</kbd> + <kbd>S</kbd></dt><dd>{lang === 'ar' ? 'حفظ نقطة استعادة للمشروع' : 'Save a project checkpoint'}</dd></div>
            <div><dt><kbd>Enter</kbd> / <kbd>Shift</kbd> + <kbd>Enter</kbd></dt><dd>{lang === 'ar' ? 'إرسال الرسالة / سطر جديد' : 'Send message / new line'}</dd></div>
          </dl>
        </ShellDialog>
      )}

      {dialog === 'about' && (
        <ShellDialog title={t.about} hint={t.dialogHint} closeLabel={t.close} onClose={() => setDialog(null)}>
          <div className="nx-win-about">
            <img src="/icon-192.png" width="64" height="64" alt="" aria-hidden="true" />
            <strong>NEXORA AI · Windows</strong>
            <p>{lang === 'ar' ? 'منصة NEXORA AI الرسمية على Windows — نفس الحساب ونفس الخدمات السحابية.' : 'The official NEXORA AI Windows app — same account and production services.'}</p>
            <dl>
              <div><dt>{t.version}</dt><dd>{APP_VERSION}</dd></div>
              <div><dt>{t.build}</dt><dd><code>{BUILD_ID}</code></dd></div>
              <div><dt>{t.surface}</dt><dd>{runtimeSurface()}</dd></div>
            </dl>
            <p className="nx-win-about-links">
              <button type="button" onClick={() => openUrl('/windows/privacy.html')}>{t.privacy}</button>
              <button type="button" onClick={() => openUrl('/windows/#support')}>{t.support}</button>
            </p>
          </div>
        </ShellDialog>
      )}
    </>
  );
}

/* ------------------------------ Update toast ------------------------------ */

function UpdateToast({ updateReady, setUpdateReady, lang, t }) {
  if (!updateReady) return null;
  return (
    <div className="nx-win-update" role="status" aria-live="polite" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <span>{t.updateReady}</span>
      <button type="button" className="primary" onClick={() => applyServiceWorkerUpdate()}>{t.applyUpdate}</button>
      <button type="button" onClick={() => setUpdateReady(false)}>{t.later}</button>
    </div>
  );
}

/* --------------------------------- Dialog --------------------------------- */

function ShellDialog({ title, hint, closeLabel, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const first = ref.current?.querySelector('button, a, [tabindex="0"]');
    first?.focus();
    const root = document.documentElement;
    root.dataset.nxDialog = '1';
    return () => { root.removeAttribute('data-nx-dialog'); };
  }, []);
  return (
    <div className="nx-win-dialog-wrap" role="presentation" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nx-win-dialog" ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <div className="nx-win-dialog-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label={closeLabel}>✕</button>
        </div>
        <div className="nx-win-dialog-body">{children}</div>
        <small className="nx-win-dialog-hint">{hint}</small>
      </div>
    </div>
  );
}
