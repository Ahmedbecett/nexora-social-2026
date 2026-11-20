/* ==========================================================================
   NEXORA AI — أدوات MSIX مشتركة (Node، تعمل على Linux وWindows)
   --------------------------------------------------------------------------
   لا تُشغّل هذه الأدوات أي أمر بناء أو توقيع؛ تتحقق فقط من:
     • تحويل 4.4.1 ⟹ 4.4.1.0 (إصدار الحزمة الرباعي)
     • أن هوية الحزمة لا تزال Placeholder قبل Partner Center
     • أن أصول الشعارات المطلوبة موجودة فعلًا
     • أن المرجع AppxManifest يحتوي القيم الصحيحة ولا يحتوي Product ID مخترعًا
   ========================================================================== */

import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

/** الاسم المحجوز حرفيًا في Partner Center (Package/Properties/DisplayName). */
export const OFFICIAL_DISPLAY_NAME = 'NEXORA AI by BECETTI';

export const REQUIRED_ASSETS = [
  'StoreLogo.png',
  'Square44x44Logo.png',
  'Square44x44Logo.targetsize-16.png',
  'Square44x44Logo.targetsize-24.png',
  'Square44x44Logo.targetsize-32.png',
  'Square44x44Logo.targetsize-48.png',
  'Square44x44Logo.targetsize-256.png',
  'Square44x44Logo.altform-unplated_targetsize-16.png',
  'Square44x44Logo.altform-unplated_targetsize-24.png',
  'Square44x44Logo.altform-unplated_targetsize-32.png',
  'Square44x44Logo.altform-unplated_targetsize-48.png',
  'Square44x44Logo.altform-unplated_targetsize-256.png',
  'Square150x150Logo.png',
  'Square150x150Logo.scale-100.png',
  'Square150x150Logo.scale-200.png',
  'Square310x310Logo.png',
  'Square71x71Logo.png',
  'Wide310x150Logo.png',
  'Wide310x150Logo.scale-200.png',
  'SplashScreen.png',
  'SplashScreen.scale-200.png',
  'LockScreenLogo.scale-200.png',
];

/** 4.4.1 → 4.4.1.0؛ الإصدار الرابع (revision) صفر دائمًا عند البناء. */
export function toMsixVersion(version) {
  const raw = String(version || '').trim();
  const match = raw.match(/^(\d{1,5})\.(\d{1,5})\.(\d{1,5})$/);
  if (!match) throw new Error(`invalid-semver:${raw}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  return `${major}.${minor}.${patch}.0`;
}

export function isValidMsixVersion(value) {
  const parts = String(value || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 65535)) return false;
  return parts[3] === 0;
}

/**
 * معرّف تطبيق الويب الذي يتوقعه Edge في uap10:Parameters.
 * نفس خوارزمية Chromium GenerateId: SHA-256 للمعرّف المطلق، أول 16 بايت،
 * ثم تحويل كل nibble hexadecimal إلى حرف بين a وp.
 */
export function webAppIdFromManifestId(manifestId) {
  const value = String(manifestId || '').trim();
  if (!/^https:\/\//.test(value)) throw new Error(`manifest-id-must-be-https:${value}`);
  const hex = createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 32);
  return [...hex]
    .map((c) => {
      const code = c.charCodeAt(0);
      return String.fromCharCode(code <= 57 ? code + 49 : code + 10);
    })
    .join('');
}

const IDENTITY_PLACEHOLDER = /REPLACE|PARTNER-CENTER|TODO|CHANGEME/i;
const OFFICIAL_PUBLISHER_DISPLAY_NAME = 'Ahmedbecetti';

/** يتحقق من هوية الحزمة مقابل متطلبات Store وقواعد التسمية. */
export function validateIdentity(identity) {
  const errors = [];
  const placeholders = [];
  const id = identity && typeof identity === 'object' ? identity : {};

  const name = String(id.identityName || '');
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]{1,48}[A-Za-z0-9]$/.test(name)) errors.push('identity-name-invalid');
  if (IDENTITY_PLACEHOLDER.test(name)) placeholders.push('identityName');

  const publisher = String(id.publisher || '');
  if (!/^CN=.+/i.test(publisher)) errors.push('publisher-invalid');
  if (IDENTITY_PLACEHOLDER.test(publisher)) placeholders.push('publisher');

  if (String(id.displayName || '') !== OFFICIAL_DISPLAY_NAME) errors.push('display-name-not-official');
  if (String(id.publisherDisplayName || '') !== OFFICIAL_PUBLISHER_DISPLAY_NAME) errors.push('publisher-display-name-not-official');

  if (!isValidMsixVersion(id.version)) errors.push('version-not-four-part');
  const min = String(id.minWindowsVersion || '');
  if (!/^10\.0\.\d{4,5}\.0$/.test(min)) errors.push('min-windows-version-invalid');
  if (Number(min.split('.')[2] || 0) < 17763) errors.push('min-windows-too-old');

  const start = String(id.startPage || '');
  if (!/^https:\/\//.test(start)) errors.push('start-page-must-be-https');
  if (!/[?&]nx_surface=msix/.test(start)) errors.push('start-page-missing-msix-surface');

  const webAppManifestId = String(id.webAppManifestId || '');
  if (webAppManifestId) {
    if (!/^https:\/\//.test(webAppManifestId)) errors.push('web-app-manifest-id-must-be-https');
    const expected = webAppIdFromManifestId(webAppManifestId);
    if (String(id.webAppId || '') !== expected) errors.push('web-app-id-mismatch');
  } else if (id.webAppId && !/^[a-p]{32}$/.test(String(id.webAppId))) {
    errors.push('web-app-id-invalid');
  }

  // يُسمح بالمعرّف الحقيقي بعد Partner Center؛ نرفض فقط القيم غير الصالحة.
  if (id.productId && !looksLikeStoreProductId(id.productId)) errors.push('product-id-invalid');
  if (id.packageFamilyName) {
    const pfn = String(id.packageFamilyName);
    if (!/^[A-Za-z0-9.-]+_[a-z0-9]{13}$/.test(pfn)) errors.push('package-family-name-invalid');
    else if (name && !pfn.startsWith(`${name}_`)) errors.push('package-family-name-mismatch');
  }

  return { ok: errors.length === 0, errors, placeholders };
}

/** أصول MSIX الناقصة في مجلد Assets. */
export function findMissingAssets(assetsDir) {
  return REQUIRED_ASSETS.filter((file) => !existsSync(resolve(assetsDir, file)));
}

/** يكشف Product IDs المخترعة (تبدأ 9 وتتبع نمط Store) إن ظهرت في نص. */
export function looksLikeStoreProductId(value) {
  return /^9[A-Z0-9]{11}$/.test(String(value || '').trim());
}

/** فحص ملف AppxManifest المرجعي. */
export function validateManifestXml(xml, identity = {}) {
  const text = String(xml || '');
  const errors = [];
  const version = identity.version || '4.4.1.0';

  if (!text.includes(`Version="${version}"`)) errors.push('manifest-version-mismatch');
  if (!text.includes(`<DisplayName>${OFFICIAL_DISPLAY_NAME}</DisplayName>`)) errors.push('manifest-display-name');
  if (!text.includes(`DisplayName="${OFFICIAL_DISPLAY_NAME}"`)) errors.push('manifest-visual-display-name');
  if (!text.includes(`<PublisherDisplayName>${OFFICIAL_PUBLISHER_DISPLAY_NAME}</PublisherDisplayName>`)) errors.push('manifest-publisher-display-name');
  if (identity.identityName && !text.includes(`Name="${identity.identityName}"`)) errors.push('manifest-identity-name');
  if (identity.publisher && !text.includes(`Publisher="${identity.publisher}"`)) errors.push('manifest-publisher');
  if (!text.includes('StartPage=')) {
    // Hosted App Model: لا يوجد StartPage، والرابط في --app-fallback-url.
    if (!text.includes('uap10:HostId="PWA"')) errors.push('manifest-host-id');
    if (!text.includes('uap10:HostRuntimeDependency')) errors.push('manifest-host-runtime-dependency');
    if (!text.includes('Name="Microsoft.MicrosoftEdge.Stable"')) errors.push('manifest-edge-host');
    if (!/--app-id=[a-p]{32}\b/.test(text)) errors.push('manifest-web-app-id');
    if (identity.webAppId && !text.includes(`--app-id=${identity.webAppId}`)) errors.push('manifest-web-app-id-mismatch');
    if (!text.includes('--app-fallback-url=https://nexora-social-2026.vercel.app/?nx_surface=msix')) errors.push('manifest-fallback-url');
    if (!text.includes('--windows-store-app')) errors.push('manifest-store-launch-flag');
    // Hosted App Model: activation data and trust/runtime attributes belong to
    // the host (Edge) manifest. Declaring them here is a schematic error.
    if (/\bExecutable\s*=/.test(text)) errors.push('manifest-hosted-app-executable');
    if (/\bEntryPoint\s*=/.test(text)) errors.push('manifest-hosted-app-entry-point');
    if (/uap10:(?:TrustLevel|RuntimeBehavior)\s*=/.test(text)) errors.push('manifest-hosted-app-runtime-attributes');
    if (text.includes('windows.hostRuntime')) errors.push('manifest-hosted-app-declares-host-runtime');
  } else {
    errors.push('manifest-must-use-hosted-app-model');
  }
  if (!text.includes('Name="Windows.Desktop"')) errors.push('manifest-target-family');
  if (!text.includes('<Capability Name="internetClient"')) errors.push('manifest-internet-capability');
  // إلزامية: Edge Stable host runtime يحتوي full-trust content، وWindows يرفض
  // التثبيت بدونها بالخطأ 0x80073D2F.
  if (!text.includes('<rescap:Capability Name="runFullTrust"')) errors.push('manifest-run-full-trust');
  if (!text.includes('Assets\\StoreLogo.png')) errors.push('manifest-store-logo');
  if (!text.includes('Assets\\SplashScreen.png')) errors.push('manifest-splash');
  if (!text.includes('windows.appUriHandler')) errors.push('manifest-uri-handler');
  if (/ProductId\s*=\s*["']9[A-Z0-9]{11}["']/.test(text)) errors.push('manifest-fake-product-id');

  return { ok: errors.length === 0, errors };
}

export default {
  OFFICIAL_DISPLAY_NAME,
  REQUIRED_ASSETS,
  toMsixVersion,
  isValidMsixVersion,
  webAppIdFromManifestId,
  validateIdentity,
  findMissingAssets,
  looksLikeStoreProductId,
  validateManifestXml,
};
