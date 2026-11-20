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
  OFFICIAL_DISPLAY_NAME,
  REQUIRED_ASSETS,
  toMsixVersion,
  isValidMsixVersion,
  webAppIdFromManifestId,
  validateIdentity,
  findMissingAssets,
  validateManifestXml,
  validateCapabilities,
  manifestCapabilities,
  looksLikeStoreProductId,
} from '../windows/tools/msix.mjs';

const read = (p) => readFileSync(p, 'utf8');
const pkg = JSON.parse(read('package.json'));
const identity = JSON.parse(read('windows/package-identity.json'));
const manifest = read('windows/msix/AppxManifest.reference.xml');

test('إصدار MSIX رباعي مشتق من package.json لا مكتوب يدويًا', () => {
  assert.equal(pkg.version, '4.4.1');
  assert.equal(toMsixVersion('4.4.1'), '4.4.1.0');
  assert.equal(toMsixVersion('12.0.7'), '12.0.7.0');
  assert.equal(isValidMsixVersion('4.4.1.0'), true);
  assert.equal(isValidMsixVersion('4.4.1'), false);
  assert.equal(isValidMsixVersion('4.4.1.1'), false, 'المراجعة تبقى صفرًا وقت البناء');
  assert.throws(() => toMsixVersion('4.4'));
  assert.equal(identity.version, toMsixVersion(pkg.version), '4.4.1 → 4.4.1.0');
  assert.equal(identity.version, '4.4.1.0');
  assert.match(manifest, /Version="4\.4\.1\.0"/);
  assert.doesNotMatch(manifest, /Version="4\.4\.0\.0"/, 'الإصدار القديم لم يبق في المانيفست');
});

test('هوية المنتج الحقيقية من Partner Center مثبّتة في الحزمة', () => {
  assert.equal(identity.displayName, OFFICIAL_DISPLAY_NAME);
  assert.equal(identity.displayName, 'NEXORA AI by BECETTI');
  assert.equal(identity.publisherDisplayName, 'Ahmedbecetti');
  assert.equal(identity.identityName, 'Ahmedbecetti.NEXORAAIbyBECETTI');
  assert.equal(identity.publisher, 'CN=A5D5DC31-4A15-4059-8030-D96C51054596');
  assert.equal(identity.productId, '9ND09PBRDPKZ');
  assert.equal(identity.packageFamilyName, 'Ahmedbecetti.NEXORAAIbyBECETTI_y0zvy3a8v70hm');
  assert.equal(identity.storeListingStatus, 'draft');
  assert.equal(identity.storeUrl, '', 'لا رابط متجر قبل النشر');
  assert.equal(identity.applicationId, 'App');
  assert.equal(identity.startPage, 'https://nexora-social-2026.vercel.app/?nx_surface=msix');
  assert.equal(identity.webAppManifestId, 'https://nexora-social-2026.vercel.app/');
  assert.equal(identity.webAppId, 'pkojfojlpmhfnldcmaemlmpbkcdmihle');
  assert.equal(webAppIdFromManifestId(identity.webAppManifestId), identity.webAppId);
  assert.equal(webAppIdFromManifestId('https://nexora-social-2026.vercel.app/?nx_surface=pwa'), 'khpbciolabiceimodlbidabjnmgijghj');
  assert.match(identity.privacyPolicyUrl, /\/windows\/privacy\.html$/);
  assert.match(identity.supportUrl, /\/windows\/#support$/);
  assert.equal(identity.contactEmail, 'ahmedbecetti35@gmail.com');

  assert.equal(looksLikeStoreProductId(identity.productId), true);
  assert.equal(identity.packageFamilyName.startsWith(`${identity.identityName}_`), true);

  const v = validateIdentity(identity);
  assert.equal(v.ok, true);
  assert.deepEqual(v.placeholders, []);
});

test('رفض الهويات غير الصالحة أو غير المتطابقة', () => {
  const base = { ...identity };
  assert.equal(validateIdentity(base).ok, true);
  assert.equal(validateIdentity({ ...base, displayName: 'Nexora' }).ok, false);
  assert.equal(validateIdentity({ ...base, displayName: 'NEXORA AI' }).ok, false, 'الاسم القديم لم يعد مقبولًا');
  assert.equal(validateIdentity({ ...base, publisherDisplayName: 'BECETTI' }).ok, false);
  assert.equal(validateIdentity({ ...base, version: '4.4.0' }).ok, false);
  assert.equal(validateIdentity({ ...base, startPage: 'http://nexora-social-2026.vercel.app/' }).ok, false);
  assert.equal(validateIdentity({ ...base, startPage: 'https://nexora-social-2026.vercel.app/' }).ok, false);
  assert.equal(validateIdentity({ ...base, productId: '9FAKE' }).ok, false);
  assert.equal(validateIdentity({ ...base, productId: '' }).ok, true, 'الحقل اختياري لكن check-windows يحذّر');
  assert.equal(validateIdentity({ ...base, packageFamilyName: 'NEXORA' }).ok, false);
  assert.equal(validateIdentity({ ...base, packageFamilyName: 'Other.NEXORAAI_8wekyb3d8bbwe' }).ok, false);
  assert.equal(validateIdentity({ ...base, identityName: 'BECETTI.NEXORAAI' }).ok, false, 'PFN لا يطابق Identity Name');
  assert.equal(looksLikeStoreProductId('9ND09PBRDPKZ'), true);
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

test('مانيفست الحزمة يستخدم Hosted App Model وليس StartPage', () => {
  // تعليقات XML لا يجوز أن تحتوي على «--» وإلا يفشل تحليل الحزمة
  const commentStart = manifest.indexOf('<!--') + 4;
  const commentEnd = manifest.indexOf('-->');
  assert.doesNotMatch(manifest.slice(commentStart, commentEnd), /--/);
  const result = validateManifestXml(manifest, identity);
  assert.deepEqual(result.errors, []);
  for (const fragment of [
    '<DisplayName>NEXORA AI by BECETTI</DisplayName>',
    'DisplayName="NEXORA AI by BECETTI"',
    '<PublisherDisplayName>Ahmedbecetti</PublisherDisplayName>',
    'Name="Ahmedbecetti.NEXORAAIbyBECETTI"',
    'Publisher="CN=A5D5DC31-4A15-4059-8030-D96C51054596"',
    'Name="Windows.Desktop"',
    'MinVersion="10.0.19041.0"',
    'uap10:HostId="PWA"',
    'uap10:HostRuntimeDependency',
    'Name="Microsoft.MicrosoftEdge.Stable"',
    `--app-id=${identity.webAppId}`,
    '--app-fallback-url=https://nexora-social-2026.vercel.app/?nx_surface=msix',
    '--windows-store-app',
    '<Capability Name="internetClient"',
    '<rescap:Capability Name="runFullTrust"',
    'xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"',
    'Assets\\StoreLogo.png',
    'Assets\\SplashScreen.png',
    'windows.appUriHandler',
  ]) {
    assert.ok(manifest.includes(fragment), fragment);
  }
  assert.doesNotMatch(manifest, /StartPage=/);
  assert.doesNotMatch(manifest, /ProductId="9[A-Z0-9]{11}"/);
  assert.match(manifest, /Hosted App Model/);
});

test('سياسة الصلاحيات: internetClient + runFullTrust مبرَّرة، ولا صلاحيات مقيّدة أخرى', () => {
  assert.deepEqual(manifestCapabilities(manifest), [
    { name: 'internetClient', restricted: false },
    { name: 'runFullTrust', restricted: true },
  ]);
  assert.deepEqual(identity.capabilities.required, ['internetClient', 'runFullTrust']);
  const justification = identity.capabilities.restricted.runFullTrust;
  assert.equal(justification.required, true);
  assert.ok(justification.partnerCenterJustification.length > 400, 'تبرير Partner Center يجب أن يكون نصًا تقنيًا كاملًا');
  assert.match(justification.partnerCenterJustification, /Hosted App Model/);
  assert.match(justification.partnerCenterJustification, /no executable/);
  assert.match(justification.partnerCenterJustification, /privacy/i);
  assert.equal(justification.reviewFile, 'docs/windows/RUNFULLTRUST-REVIEW.md');
  assert.equal(justification.evidence, 'hosted-app-model-host-activation');

  const result = validateCapabilities(manifest, identity);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.capabilities, ['internetClient', 'runFullTrust']);

  // الصلاحية غير مقبولة بلا تبرير مكتوب
  const noJustification = { ...identity, capabilities: { required: ['internetClient', 'runFullTrust'], restricted: {} } };
  assert.ok(validateCapabilities(manifest, noJustification).errors.includes('run-full-trust-not-justified'));

  // إزالة الصلاحية من المانيفست تعني أن الهوية يجب أن تتغيّر معها
  const withoutFullTrust = manifest.replace(/<rescap:Capability\s+Name="runFullTrust"\s*\/>/, '');
  assert.ok(validateCapabilities(withoutFullTrust, identity).errors.some((e) => e.startsWith('capabilities-mismatch')));
  assert.deepEqual(validateCapabilities(withoutFullTrust, { ...identity, capabilities: { required: ['internetClient'] } }).errors, []);

  // لا صلاحيات مقيّدة إضافية (allowElevation / packageManagement / unvirtualizedResources)
  for (const extra of ['allowElevation', 'packageManagement', 'unvirtualizedResources']) {
    const patched = manifest.replace('</Capabilities>', `<rescap:Capability Name="${extra}" /></Capabilities>`);
    const errors = validateCapabilities(patched, { ...identity, capabilities: { required: ['internetClient', 'runFullTrust', extra] } }).errors;
    assert.ok(errors.includes(`unexpected-restricted-capability:${extra}`), extra);
  }
  const noNamespace = manifest.replace(/\s*xmlns:rescap="[^"]+"/, '');
  assert.ok(validateCapabilities(noNamespace, identity).errors.includes('capabilities-missing-rescap-namespace'));
});

test('مراجعة runFullTrust موثّقة بالدليل الحقيقي وقابلة لإعادة القياس', () => {
  const review = read('docs/windows/RUNFULLTRUST-REVIEW.md');
  for (const needle of [
    'Hosted App Model',
    'uap10:HostId="PWA"',
    'Microsoft.Copilot',
    'AppModelSamples',
    'Add-AppxPackage',
    'Partner Center',
    'Test-RunFullTrustNecessity.ps1',
    'no executable',
  ]) {
    assert.ok(review.includes(needle), `RUNFULLTRUST-REVIEW.md missing: ${needle}`);
  }
  const necessity = read('windows/scripts/Test-RunFullTrustNecessity.ps1');
  assert.match(necessity, /runFullTrust/);
  assert.match(necessity, /makeappx unpack/);
  assert.match(necessity, /Test-MsixInstall\.ps1/);
  assert.match(necessity, /exit 0/, 'التجربة دليل لا بوابة بناء');

  const install = read('windows/scripts/Test-MsixInstall.ps1');
  for (const needle of ['Add-AppxPackage', 'Get-AppxPackage', 'Get-StartApps', 'Get-AppxPackageManifest', 'Remove-AppxPackage', 'CertificatePath', 'ExpectedCapabilities', 'production-surface']) {
    assert.ok(install.includes(needle), `Test-MsixInstall.ps1 missing: ${needle}`);
  }
  const sign = read('windows/scripts/Sign-StorePackage.ps1');
  for (const needle of ['signtool.exe', 'verify', 'TimestampUrl', 'Package/Identity/Publisher', 'test-signed']) {
    assert.ok(sign.includes(needle), `Sign-StorePackage.ps1 missing: ${needle}`);
  }
  const assertScript = read('windows/tools/assert-install-test.mjs');
  assert.match(assertScript, /add-appxpackage/);
  assert.match(assertScript, /allow-headless/);

  const workflow = read('.github/workflows/windows-store-package.yml');
  assert.match(workflow, /Test-MsixInstall\.ps1/);
  assert.match(workflow, /assert-install-test\.mjs/);
  assert.match(workflow, /Test-RunFullTrustNecessity\.ps1/);
  assert.match(workflow, /windows-v4\.4\.1\.0/);
  assert.match(workflow, /PKG_VERSION: 4\.4\.1\.0/);
  assert.match(workflow, /name: nexora-windows-\$\{\{ env\.PKG_VERSION \}\}/);
  assert.match(workflow, /windows-latest/);
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
  assert.match(inspect, /Properties\/DisplayName must be the reserved Store name/);
  assert.match(inspect, /VisualElements\/DisplayName must match the reserved Store name/);
  assert.match(inspect, /PublisherDisplayName -ne 'Ahmedbecetti'/);
  assert.match(inspect, /DATABASE_URL/);
  assert.match(inspect, /OPENAI_API_KEY/);
  assert.match(inspect, /package-identity\.json/);
  assert.match(inspect, /Identity Name does not match/);

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
  assert.match(sync, /MSIX version OK: 4\.4\.1\.0/);
  const check = execFileSync(process.execPath, ['windows/tools/check-windows.mjs'], { encoding: 'utf8' });
  assert.match(check, /OK — Partner Center identity is integrated; 1 warning/);
  assert.match(check, /Store URL pending publication/);
  assert.match(check, /capabilities: internetClient, runFullTrust \(runFullTrust justified\)/);
});

test('الوثائق تحمل الهوية الحقيقية ولا تدّعي حزمة موقّعة أو نشرًا', () => {
  const docs = read('docs/windows/MSIX.md');
  assert.match(docs, /Ahmedbecetti\.NEXORAAIbyBECETTI/);
  assert.match(docs, /9ND09PBRDPKZ/);
  assert.match(docs, /Partner Center/);
  assert.match(docs, /4\.4\.1\.0/);
  assert.match(docs, /signtool/);
  assert.match(docs, /لا تغيّر هذه القيم يدويًا|لا تغير هذه القيم يدويًا/);
  assert.match(docs, /draft|مسودة/);
  assert.doesNotMatch(docs, /9NBLGGH4R315/);

  const listing = read('docs/windows/STORE-LISTING.md');
  assert.match(listing, /9ND09PBRDPKZ/);
  assert.match(listing, /Ahmedbecetti\.NEXORAAIbyBECETTI/);
  assert.match(listing, /windows\/privacy\.html/);
  assert.match(listing, /not operational|Advertising: \*\*none currently\*\*/);
  assert.doesNotMatch(listing, /9NBLGGH4R315/);
});
