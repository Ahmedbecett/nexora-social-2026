#!/usr/bin/env node
/* فحص شامل لجاهزية نسخة Windows (المضيف الأصلي C# + WebView2 + MG Ads SDK V1.2.1).
   يعمل على أي نظام (Linux/Windows). لا يوقّع ولا ينشر شيئًا.
   الاستخدام: node windows/tools/check-windows.mjs
*/

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { toMsixVersion, validateIdentity, findMissingAssets, validateManifestXml, looksLikeStoreProductId } from './msix.mjs';
import { validateAdsConfig, hasTestAdId, hasPrivateKeyMaterial } from '../../src/ads/windowsAds.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const identity = JSON.parse(read('windows/package-identity.json'));
const webAds = JSON.parse(read('public/windows/ads-config.json'));
const nativeAds = JSON.parse(read('windows/host/NexoraWindows/Config/mgads-config.json'));
const errors = [];
const warnings = [];

// 1) الإصدار
try {
  const expected = toMsixVersion(pkg.version);
  if (identity.version !== expected) errors.push(`identity version ${identity.version} ≠ ${expected}`);
} catch (e) {
  errors.push(String(e.message || e));
}

// 2) الهوية (Partner Center)
const idCheck = validateIdentity(identity);
for (const e of idCheck.errors) errors.push(`identity: ${e}`);
for (const p of idCheck.placeholders) warnings.push(`identity placeholder pending Partner Center: ${p}`);

// 3) الأصول
const missing = findMissingAssets(resolve(root, 'windows/msix/Assets'));
if (missing.length) errors.push(`missing MSIX assets: ${missing.join(', ')}`);

// 4) مرجع المانيفست (Native Desktop Bridge x64)
const manifest = read('windows/msix/AppxManifest.reference.xml');
const mCheck = validateManifestXml(manifest, identity);
for (const e of mCheck.errors) errors.push(`manifest: ${e}`);

// 5) ملفات المضيف الأصلي C# + WebView2 + MG Ads SDK V1.2.1
const requiredNativeFiles = [
  'windows/host/NexoraWindows.sln',
  'windows/host/NexoraWindows/NexoraWindows.csproj',
  'windows/host/NexoraWindows/App.config',
  'windows/host/NexoraWindows/app.manifest',
  'windows/host/NexoraWindows/Program.cs',
  'windows/host/NexoraWindows/UI/MainForm.cs',
  'windows/host/NexoraWindows/Ads/MgAdsManager.cs',
  'windows/host/NexoraWindows/Bridge/WebViewBridge.cs',
  'windows/host/NexoraWindows/Config/MgAdsConfig.cs',
  'windows/host/NexoraWindows/Config/NativeSecretVault.cs',
  'windows/host/NexoraWindows/Config/mgads-config.json',
  'windows/scripts/Restore-MgAdsSdk.ps1',
  'windows/scripts/Write-NativeSecretVault.ps1',
  'src/ads/mgAdsBridge.js',
];
for (const file of requiredNativeFiles) {
  if (!existsSync(resolve(root, file))) errors.push(`missing native host file: ${file}`);
}

// 6) ملفات PWA والصفحات القانونية
for (const file of ['public/sw.js', 'public/offline.html', 'public/manifest.webmanifest', 'public/windows/privacy.html', 'public/windows/index.html']) {
  if (!existsSync(resolve(root, file))) errors.push(`missing: ${file}`);
}
const sw = read('public/sw.js');
for (const rule of ["startsWith(API_PREFIX)", "url.pathname === '/version.json'", 'NX_SKIP_WAITING', 'offline.html']) {
  if (!sw.includes(rule)) errors.push(`sw.js missing rule: ${rule}`);
}

// 7) التحقق الصارم من إعدادات MG Ads الإنتاجية ومنع تسريب أي أسرار أو معرّفات تجريبية
const adsCheck = validateAdsConfig(webAds);
if (!adsCheck.ok) errors.push(`public ads-config invalid: ${adsCheck.errors.join(', ')}`);
if (adsCheck.config.provider !== 'mgads' || adsCheck.config.enabled !== true || adsCheck.config.allowInMsix !== true) {
  errors.push('public/windows/ads-config.json must configure production mgads for windows-msix');
}
if (hasTestAdId(JSON.stringify(webAds)) || hasTestAdId(JSON.stringify(nativeAds))) {
  errors.push('test or demo ad ID found in production ad config');
}
if (hasPrivateKeyMaterial(JSON.stringify(webAds)) || hasPrivateKeyMaterial(JSON.stringify(nativeAds))) {
  errors.push('private key material found in ad config JSON');
}

// تطابق المعرّفات الإنتاجية بين إعداد المضيف الأصلي وإعداد الواجهة
const webMg = webAds.providers?.mgads || {};
if (nativeAds.appId !== '6b03f6af1f812ea86a26de4f' || webMg.appId !== nativeAds.appId) {
  errors.push('MG Ads production AppId mismatch');
}
if (nativeAds.units?.banner?.unitId !== 'd461565a9efe49f0ac63ae71048fb594' || webMg.units?.banner?.unitId !== nativeAds.units?.banner?.unitId) {
  errors.push('MG Ads Banner Unit ID mismatch');
}
if (nativeAds.units?.rewarded?.unitId !== '48f66ca841444050a166841f331b6adb' || webMg.units?.rewarded?.unitId !== nativeAds.units?.rewarded?.unitId) {
  errors.push('MG Ads Rewarded Unit ID mismatch');
}
if (nativeAds.units?.couplet?.unitId !== '168ce66592d743bea2c16cdf908165b3' || webMg.units?.couplet?.unitId !== nativeAds.units?.couplet?.unitId) {
  errors.push('MG Ads Couplet Unit ID mismatch');
}
if (nativeAds.units?.interstitial?.enabled !== false || nativeAds.units?.interstitial?.unitId !== '') {
  errors.push('MG Ads Interstitial must stay disabled with empty unitId until official 1024x768 ID is provided');
}
if (existsSync(resolve(root, 'windows/host/NexoraWindows/Config/NativeSecretVault.g.cs'))) {
  errors.push('ephemeral NativeSecretVault.g.cs must never exist in repository working tree');
}

// 8) Product ID / Package family name
if (!identity.productId) warnings.push('Store Product ID not recorded yet');
else if (!looksLikeStoreProductId(identity.productId)) errors.push('identity productId is not a valid Store Product ID');
if (!identity.packageFamilyName) warnings.push('Package family name not recorded yet');

console.log('NEXORA AI by BECETTI — Windows Native + MG Ads readiness check');
console.log(`app version: ${pkg.version} · msix version: ${identity.version} · host: native-webview2-mgads (x64)`);
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(`\nOK — Partner Center identity & MG Ads SDK V1.2.1 native host ready; ${warnings.length} warning(s).`);
