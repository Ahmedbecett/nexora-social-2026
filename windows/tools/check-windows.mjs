#!/usr/bin/env node
/* فحص شامل لجاهزية نسخة Windows قبل البناء/التوقيع.
   يعمل على أي نظام (لا يحتاج Windows SDK). لا يوقّع ولا ينشر شيئًا.
   الاستخدام: node windows/tools/check-windows.mjs
   رمز الخروج 1 عند وجود خطأ حقيقي، و0 مع تحذيرات غير حاجزة (مثل رابط المتجر قبل النشر).
*/

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { toMsixVersion, validateIdentity, findMissingAssets, validateManifestXml, validateCapabilities, looksLikeStoreProductId } from './msix.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const identity = JSON.parse(read('windows/package-identity.json'));
const ads = JSON.parse(read('public/windows/ads-config.json'));
const errors = [];
const warnings = [];

// 1) الإصدار
try {
  const expected = toMsixVersion(pkg.version);
  if (identity.version !== expected) errors.push(`identity version ${identity.version} ≠ ${expected}`);
} catch (e) {
  errors.push(String(e.message || e));
}

// 2) الهوية
const idCheck = validateIdentity(identity);
for (const e of idCheck.errors) errors.push(`identity: ${e}`);
for (const p of idCheck.placeholders) warnings.push(`identity placeholder pending Partner Center: ${p}`);

// 3) الأصول
const missing = findMissingAssets(resolve(root, 'windows/msix/Assets'));
if (missing.length) errors.push(`missing MSIX assets: ${missing.join(', ')}`);

// 4) مرجع المانيفست
const manifest = read('windows/msix/AppxManifest.reference.xml');
const mCheck = validateManifestXml(manifest, identity);
for (const e of mCheck.errors) errors.push(`manifest: ${e}`);

// 4b) سياسة الصلاحيات: internetClient + تبرير runFullTrust أو إزالتها
const capCheck = validateCapabilities(manifest, identity);
for (const e of capCheck.errors) errors.push(`capabilities: ${e}`);
const restricted = identity.capabilities?.restricted?.runFullTrust;
if (restricted && restricted.required === true) {
  const reviewFile = restricted.reviewFile || 'docs/windows/RUNFULLTRUST-REVIEW.md';
  if (!existsSync(resolve(root, reviewFile))) errors.push(`missing runFullTrust review: ${reviewFile}`);
  else {
    const review = read(reviewFile);
    for (const rule of [
      'Hosted App Model',
      'Microsoft.Copilot',
      'runFullTrust',
      'Partner Center',
      'Add-AppxPackage',
    ]) {
      if (!review.includes(rule)) errors.push(`${reviewFile} missing evidence: ${rule}`);
    }
  }
}
if (!capCheck.capabilities.includes('runFullTrust') && restricted && restricted.required === true) {
  errors.push('identity requires runFullTrust but the manifest does not declare it');
}

// 4c) أدوات الاختبار/التوقيع المطلوبة للتسليم
for (const tool of ['windows/scripts/Test-MsixInstall.ps1', 'windows/scripts/Sign-StorePackage.ps1']) {
  if (!existsSync(resolve(root, tool))) errors.push(`missing tool: ${tool}`);
}

// 5) ملفات PWA الأساسية
for (const file of ['public/sw.js', 'public/offline.html', 'public/manifest.webmanifest', 'public/windows/privacy.html', 'public/windows/index.html']) {
  if (!existsSync(resolve(root, file))) errors.push(`missing: ${file}`);
}
const sw = read('public/sw.js');
for (const rule of ["startsWith(API_PREFIX)", "url.pathname === '/version.json'", 'NX_SKIP_WAITING', 'offline.html']) {
  if (!sw.includes(rule)) errors.push(`sw.js missing rule: ${rule}`);
}

// 6) الإعلانات: معطّلة افتراضيًا، ولا معرّفات اختبارية
if (ads.enabled !== false) errors.push('ads-config.json must ship disabled');
if (ads.provider !== 'none') errors.push('ads-config.json provider must be none until verified');
if (/3940256099942544/.test(JSON.stringify(ads))) errors.push('Google test ad ID present in config');
if (ads.allowInMsix !== false) errors.push('ads allowInMsix must stay false until written verification');

// 7) Product ID / Package family name — قيم حقيقية من Partner Center
if (!identity.productId) warnings.push('Store Product ID not recorded yet');
else if (!looksLikeStoreProductId(identity.productId)) errors.push('identity productId is not a valid Store Product ID');
if (identity.productId && !identity.storeUrl) warnings.push('Store URL pending publication (Product ID is recorded)');
if (!identity.packageFamilyName) warnings.push('Package family name not recorded yet');

console.log('NEXORA AI by BECETTI — Windows readiness check');
console.log(`app version: ${pkg.version} · msix version: ${identity.version}`);
console.log(`capabilities: ${(capCheck.capabilities || []).join(', ')}${restricted && restricted.required ? ' (runFullTrust justified)' : ''}`);
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(`\nOK — Partner Center identity is integrated; ${warnings.length} warning(s).`);
