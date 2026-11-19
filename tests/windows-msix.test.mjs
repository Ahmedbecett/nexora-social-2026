/**
 * NEXORA AI — MSIX preparation.
 *
 * These tests protect against the two easiest ways to fake a Store release:
 * inventing package identity/product IDs, and shipping a package whose start
 * page or assets do not match the PWA. They also assert that the Windows build
 * scripts exist and enforce signing/identity rules.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  REQUIRED_ASSETS,
  toMsixVersion,
  isValidMsixVersion,
  validateIdentity,
  findMissingAssets,
  validateManifestXml,
  looksLikeStoreProductId,
} from '../windows/tools/msix.mjs';

const read = (p) => readFileSync(p, 'utf8');
const pkg = JSON.parse(read('package.json'));
const identity = JSON.parse(read('windows/package-identity.json'));
const manifest = read('windows/msix/AppxManifest.reference.xml');

test('إصدار MSIX رباعي مشتق من package.json لا مكتوب يدويًا', () => {
  assert.equal(pkg.version, '4.4.0');
  assert.equal(toMsixVersion('4.4.0'), '4.4.0.0');
  assert.equal(toMsixVersion('12.0.7'), '12.0.7.0');
  assert.equal(isValidMsixVersion('4.4.0.0'), true);
  assert.equal(isValidMsixVersion('4.4.0'), false);
  assert.equal(isValidMsixVersion('4.4.0.1'), false, 'المراجعة تبقى صفرًا وقت البناء');
  assert.throws(() => toMsixVersion('4.4'));
  assert.equal(identity.version, toMsixVersion(pkg.version));
  assert.match(manifest, /Version="4\.4\.0\.0"/);
});

test('هوية المنتج تحمل الاسم والناشر الرسميين، والPlaceholders معلنة لا مخفية', () => {
  assert.equal(identity.displayName, 'NEXORA AI');
  assert.equal(identity.publisherDisplayName, 'BECETTI');
  assert.equal(identity.applicationId, 'App');
  assert.equal(identity.startPage, 'https://nexora-social-2026.vercel.app/?nx_surface=msix');
  assert.match(identity.privacyPolicyUrl, /\/windows\/privacy\.html$/);
  assert.match(identity.supportUrl, /\/windows\/#support$/);
  assert.equal(identity.contactEmail, 'ahmedbecetti35@gmail.com');

  // القيم الحقيقية لا تُخترع: يجب أن تبقى Placeholders حتى Partner Center
  assert.match(identity.identityName, /REPLACE-WITH-PARTNER-CENTER/);
  assert.match(identity.publisher, /REPLACE-WITH-PARTNER-CENTER/);
  assert.equal(identity.productId, '');
  assert.equal(identity.packageFamilyName, '');
  assert.equal(identity.storeUrl, '');
  assert.equal(looksLikeStoreProductId(identity.productId), false);

  const v = validateIdentity(identity);
  assert.equal(v.ok, true);
  assert.deepEqual(v.placeholders.sort(), ['identityName', 'publisher']);
});

test('رفض الهويات المخترعة أو غير الصالحة', () => {
  const base = { ...identity, identityName: 'BECETTI.NEXORAAI', publisher: 'CN=BECETTI', productId: '', packageFamilyName: '' };
  assert.equal(validateIdentity(base).ok, true);
  assert.equal(validateIdentity({ ...base, displayName: 'Nexora' }).ok, false);
  assert.equal(validateIdentity({ ...base, publisherDisplayName: 'Ahmed' }).ok, false);
  assert.equal(validateIdentity({ ...base, version: '4.4.0' }).ok, false);
  assert.equal(validateIdentity({ ...base, startPage: 'http://nexora-social-2026.vercel.app/' }).ok, false);
  assert.equal(validateIdentity({ ...base, startPage: 'https://nexora-social-2026.vercel.app/' }).ok, false);
  // معرّف حقيقي من Partner Center مقبول؛ القيم المشوّهة مرفوضة
  assert.equal(validateIdentity({ ...base, productId: '9NBLGGH4R315' }).ok, true);
  assert.equal(validateIdentity({ ...base, productId: '9FAKE' }).ok, false);
  assert.equal(validateIdentity({ ...base, packageFamilyName: 'BECETTI.NEXORAAI_8wekyb3d8bbwe' }).ok, true);
  assert.equal(validateIdentity({ ...base, packageFamilyName: 'NEXORA' }).ok, false);
  assert.equal(looksLikeStoreProductId('9NBLGGH4R315'), true);
  assert.equal(looksLikeStoreProductId(''), false);
});

test('أصول MSIX المطلوبة موجودة فعلًا وغير فارغة', () => {
  const missing = findMissingAssets('windows/msix/Assets');
  assert.deepEqual(missing, []);
  for (const name of REQUIRED_ASSETS) {
    const path = join('windows/msix/Assets', name);
    assert.ok(existsSync(path), name);
    assert.ok(statSync(path).size > 100, `${name} فارغ`);
  }
  const files = readdirSync('windows/msix/Assets').filter((f) => f.endsWith('.png'));
  assert.ok(files.length >= 50, 'المجموعة الكاملة لمقاييس Windows مطلوبة');
  for (const file of files) {
    assert.match(file, /\.png$/);
  }
});

test('مانيفست المرجع يستوفي Store: HTTPS، MSIX surface، Windows.Desktop، وروابط تطبيق', () => {
  // تعليقات XML لا يجوز أن تحتوي على «--» وإلا يفشل تحليل الحزمة
  const commentStart = manifest.indexOf('<!--') + 4;
  const commentEnd = manifest.indexOf('-->');
  assert.doesNotMatch(manifest.slice(commentStart, commentEnd), /--/);
  const result = validateManifestXml(manifest, identity);
  assert.deepEqual(result.errors, []);
  for (const fragment of [
    '<DisplayName>NEXORA AI</DisplayName>',
    '<PublisherDisplayName>BECETTI</PublisherDisplayName>',
    'Name="Windows.Desktop"',
    'MinVersion="10.0.19041.0"',
    '<Capability Name="internetClient"',
    'Assets\\StoreLogo.png',
    'Assets\\SplashScreen.png',
    'windows.appUriHandler',
  ]) {
    assert.ok(manifest.includes(fragment), fragment);
  }
  assert.doesNotMatch(manifest, /ProductId="9[A-Z0-9]{11}"/);
  assert.match(manifest, /REFERENCE/);
});

test('سكربتات Windows ترفض Product ID مخترعًا وتشترط التوقيع عند الطلب', () => {
  const patch = read('windows/scripts/Update-MsixIdentity.ps1');
  assert.match(patch, /never invent it/i);
  assert.match(patch, /if \(\$identity\.productId/);
  assert.match(patch, /signtool\.exe/);
  assert.match(patch, /makeappx\.exe/);
  assert.match(patch, /RequireSignature/);
  assert.match(patch, /nx_surface=msix/);
  assert.match(patch, /AppxSignature\.p7x/);
  assert.match(patch, /AppxBlockMap\.xml/);

  const inspect = read('windows/scripts/Test-MsixPackage.ps1');
  assert.match(inspect, /nx_surface=msix/);
  assert.match(inspect, /DisplayName -ne 'NEXORA AI'/);
  assert.match(inspect, /PublisherDisplayName -ne 'BECETTI'/);
  assert.match(inspect, /DATABASE_URL/);
  assert.match(inspect, /OPENAI_API_KEY/);

  const assets = read('windows/scripts/New-MsixAssets.ps1');
  assert.match(assets, /SplashScreen\.png/);
  assert.match(assets, /altform-unplated/);
  assert.ok(existsSync('windows/tools/generate-assets.sh'));
});

test('لا شهادات توقيع ولا مفاتيح في المستودع', () => {
  const forbidden = ['.pfx', '.p12', '.jks', '.keystore'];
  const hits = [];
  const walk = (dir, depth = 0) => {
    if (depth > 4) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', '.next', 'windows/store/screenshots'].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (forbidden.some((ext) => entry.name.toLowerCase().endsWith(ext))) hits.push(full);
    }
  };
  walk('.');
  assert.deepEqual(hits, [], `ملفات توقيع يجب ألا تكون في المستودع: ${hits.join(', ')}`);
});

test('أدوات النسخة تعمل: sync-version --check وcheck-windows', async () => {
  const { execFileSync } = await import('node:child_process');
  const sync = execFileSync(process.execPath, ['windows/tools/sync-version.mjs', '--check'], { encoding: 'utf8' });
  assert.match(sync, /MSIX version OK: 4\.4\.0\.0/);
  const check = execFileSync(process.execPath, ['windows/tools/check-windows.mjs'], { encoding: 'utf8' });
  assert.match(check, /OK — 2 expected placeholder warning/);
  assert.match(check, /identity placeholder pending Partner Center: publisher/);
});

test('النشر والوثائق لا تدّعي حزمة موقّعة أو Product ID', () => {
  const docs = read('docs/windows/MSIX.md');
  assert.match(docs, /Placeholders/);
  assert.match(docs, /Partner Center/);
  assert.match(docs, /4\.4\.0\.0/);
  assert.match(docs, /signtool/);
  assert.match(docs, /لا تخترعه|لا تخترع/);
  assert.doesNotMatch(docs, /9NBLGGH4R315/);

  const listing = read('docs/windows/STORE-LISTING.md');
  assert.match(listing, /Do not invent a Product ID/);
  assert.match(listing, /BECETTI/);
  assert.match(listing, /windows\/privacy\.html/);
  assert.match(listing, /not operational|Advertising: \*\*none currently\*\*/);
  assert.doesNotMatch(listing, /9NBLGGH4R315/);
});
