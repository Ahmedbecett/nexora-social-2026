/**
 * NEXORA AI — MSIX preparation (Native C# + WebView2 + MG Ads C# SDK V1.2.1).
 *
 * Protects Partner Center identity continuity, four-part version alignment,
 * native Desktop Bridge manifest requirements, Store assets, and secret hygiene.
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
  looksLikeStoreProductId,
} from '../windows/tools/msix.mjs';

const read = (p) => readFileSync(p, 'utf8');
const pkg = JSON.parse(read('package.json'));
const identity = JSON.parse(read('windows/package-identity.json'));
const manifest = read('windows/msix/AppxManifest.reference.xml');

test('إصدار MSIX رباعي مشتق من package.json لا مكتوب يدويًا', () => {
  assert.equal(pkg.version, '4.5.0');
  assert.equal(toMsixVersion('4.5.0'), '4.5.0.0');
  assert.equal(toMsixVersion('12.0.7'), '12.0.7.0');
  assert.equal(isValidMsixVersion('4.5.0.0'), true);
  assert.equal(isValidMsixVersion('4.5.0'), false);
  assert.equal(isValidMsixVersion('4.5.0.1'), false, 'المراجعة تبقى صفرًا وقت البناء');
  assert.throws(() => toMsixVersion('4.5'));
  assert.equal(identity.version, toMsixVersion(pkg.version));
  assert.match(manifest, /Version="4\.5\.0\.0"/);
});

test('هوية المنتج الحقيقية من Partner Center محفوظة حرفيًا بدون تغيير', () => {
  assert.equal(identity.displayName, OFFICIAL_DISPLAY_NAME);
  assert.equal(identity.displayName, 'NEXORA AI by BECETTI');
  assert.equal(identity.publisherDisplayName, 'Ahmedbecetti');
  assert.equal(identity.identityName, 'Ahmedbecetti.NEXORAAIbyBECETTI');
  assert.equal(identity.publisher, 'CN=A5D5DC31-4A15-4059-8030-D96C51054596');
  assert.equal(identity.productId, '9ND09PBRDPKZ');
  assert.equal(identity.packageFamilyName, 'Ahmedbecetti.NEXORAAIbyBECETTI_y0zvy3a8v70hm');
  assert.equal(identity.applicationId, 'App');
  assert.equal(identity.hostModel, 'native-webview2-mgads');
  assert.equal(identity.executable, 'NexoraWindows.exe');
  assert.equal(identity.mgAdsAppId, '6b03f6af1f812ea86a26de4f');
  assert.equal(identity.mgAdsSdkVersion, '1.2.1');
  assert.equal(identity.startPage, 'https://nexora-social-2026.vercel.app/?nx_surface=msix&nx_host=native-webview2');
  assert.equal(webAppIdFromManifestId(identity.webAppManifestId), identity.webAppId);
  assert.match(identity.privacyPolicyUrl, /\/windows\/privacy\.html$/);
  assert.match(identity.supportUrl, /\/windows\/#support$/);
  assert.equal(identity.contactEmail, 'ahmedbecetti35@gmail.com');

  const v = validateIdentity(identity);
  assert.equal(v.ok, true);
  assert.deepEqual(v.placeholders, []);
});

test('رفض الهويات غير الصالحة أو غير المتطابقة', () => {
  const base = { ...identity };
  assert.equal(validateIdentity(base).ok, true);
  assert.equal(validateIdentity({ ...base, displayName: 'Nexora' }).ok, false);
  assert.equal(validateIdentity({ ...base, displayName: 'NEXORA AI' }).ok, false);
  assert.equal(validateIdentity({ ...base, publisherDisplayName: 'BECETTI' }).ok, false);
  assert.equal(validateIdentity({ ...base, version: '4.5.0' }).ok, false);
  assert.equal(validateIdentity({ ...base, startPage: 'http://nexora-social-2026.vercel.app/' }).ok, false);
  assert.equal(validateIdentity({ ...base, startPage: 'https://nexora-social-2026.vercel.app/' }).ok, false);
  assert.equal(validateIdentity({ ...base, productId: '9FAKE' }).ok, false);
  assert.equal(validateIdentity({ ...base, packageFamilyName: 'Other.NEXORAAI_8wekyb3d8bbwe' }).ok, false);
  assert.equal(looksLikeStoreProductId('9ND09PBRDPKZ'), true);
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
  assert.ok(files.length >= 50);
});

test('مانيفست الحزمة يستخدم Native C# + WebView2 Desktop Bridge (x64) ويحفظ هوية المتجر', () => {
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
    'ProcessorArchitecture="x64"',
    'Executable="NexoraWindows.exe"',
    'EntryPoint="Windows.FullTrustApplication"',
    'Name="Windows.Desktop"',
    'MinVersion="10.0.19041.0"',
    '<Capability Name="internetClient"',
    '<rescap:Capability Name="runFullTrust"',
    'Assets\\StoreLogo.png',
    'Assets\\SplashScreen.png',
    'windows.appUriHandler',
  ]) {
    assert.ok(manifest.includes(fragment), fragment);
  }
  assert.doesNotMatch(manifest, /StartPage=/);
  assert.doesNotMatch(manifest, /ProductId="9[A-Z0-9]{11}"/);
});

test('سكربتات Windows تفحص المضيف الأصلي والـ MG Ads SDK وتمنع تسريب الأسرار', () => {
  const build = read('windows/scripts/Build-Msix.ps1');
  assert.match(build, /Restore-MgAdsSdk\.ps1/);
  assert.match(build, /Write-NativeSecretVault\.ps1/);
  assert.match(build, /NexoraWindows\.csproj/);
  assert.match(build, /--smoke-check/);
  assert.match(build, /MiracleGamesAd\.dll/);
  assert.match(build, /signtool\.exe/);
  assert.match(build, /makeappx\.exe/);

  const inspect = read('windows/scripts/Test-MsixPackage.ps1');
  assert.match(inspect, /NexoraWindows\.exe/);
  assert.match(inspect, /MiracleGamesAd\.dll/);
  assert.match(inspect, /Config\\mgads-config\.json/);
  assert.match(inspect, /DATABASE_URL/);
  assert.match(inspect, /MIGTAgEA/);
  assert.match(inspect, /BEGIN PRIVATE KEY/);
});

test('لا شهادات توقيع ولا مفاتيح في المستودع', () => {
  const forbidden = ['.pfx', '.p12', '.jks', '.keystore', '.cred.dat'];
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
  assert.deepEqual(hits, [], `ملفات حساسة يجب ألا تكون في المستودع: ${hits.join(', ')}`);
  assert.equal(existsSync('windows/host/NexoraWindows/Config/NativeSecretVault.g.cs'), false);
});

test('أدوات النسخة تعمل: sync-version --check وcheck-windows', async () => {
  const { execFileSync } = await import('node:child_process');
  const sync = execFileSync(process.execPath, ['windows/tools/sync-version.mjs', '--check'], { encoding: 'utf8' });
  assert.match(sync, /MSIX version OK: 4\.5\.0\.0/);
  const check = execFileSync(process.execPath, ['windows/tools/check-windows.mjs'], { encoding: 'utf8' });
  assert.match(check, /OK — Partner Center identity & MG Ads SDK V1\.2\.1 native host ready/);
});

test('الوثائق تحمل الهوية الحقيقية ونسخة 4.5.0.0', () => {
  const docs = read('docs/windows/MSIX.md');
  assert.match(docs, /Ahmedbecetti\.NEXORAAIbyBECETTI/);
  assert.match(docs, /9ND09PBRDPKZ/);
  assert.match(docs, /Partner Center/);
  assert.match(docs, /4\.5\.0\.0/);
  assert.match(docs, /NexoraWindows\.exe/);
  assert.match(docs, /MG Ads C# SDK V1\.2\.1/);

  const listing = read('docs/windows/STORE-LISTING.md');
  assert.match(listing, /9ND09PBRDPKZ/);
  assert.match(listing, /Ahmedbecetti\.NEXORAAIbyBECETTI/);
  assert.match(listing, /windows\/privacy\.html/);
  assert.match(listing, /MG Ads \(Miracle Games\) C# SDK V1\.2\.1/);
});
