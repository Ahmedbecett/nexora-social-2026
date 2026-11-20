import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyUpload } from '../windows/tools/verify-msix-upload.mjs';

const upload = 'windows/release/4.4.1.0/NEXORA-AI_4.4.1.0_neutral.msixupload';
const hasArtifact = existsSync(upload);

/* كاتب ZIP مصغّر (store فقط) لبناء حالات سلبية دون أي تبعيات. */
const table = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const data = Buffer.from(content);
    const nameBytes = Buffer.from(name, 'latin1');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // store
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

function tempFile(name, content) {
  const dir = mkdtempSync(join(tmpdir(), 'msix-verify-'));
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

test('the committed 4.4.1.0 .msixupload passes the Partner Center structural verification', { skip: !hasArtifact && 'release artifact not present' }, () => {
  const report = verifyUpload(upload);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.deepEqual(report.errors, []);
  assert.equal(report.identity.name, 'Ahmedbecetti.NEXORAAIbyBECETTI');
  assert.equal(report.identity.publisher, 'CN=A5D5DC31-4A15-4059-8030-D96C51054596');
  assert.equal(report.identity.displayName, 'NEXORA AI by BECETTI');
  assert.equal(report.identity.version, '4.4.1.0');
  assert.deepEqual(report.identity.capabilities, ['internetClient', 'runFullTrust']);
  assert.equal(report.stats.family, 'bundle');
  assert.equal(report.stats.entries, 1, 'the upload must hold exactly one entry');
  assert.ok(report.stats.verifiedBlocks > 100, 'block hashes must actually be verified');
  assert.ok(report.stats.pngAssets >= 40);
  // غياب الرموز مسموح ويجب أن يُشرح لا أن يُصلَح
  assert.equal(report.warnings.length, 1);
  assert.match(report.warnings[0], /no \.appxsym file/);
});

test('a non-ZIP file is rejected', () => {
  const path = tempFile('not-a-zip.msixupload', 'this is not a package');
  assert.throws(() => verifyUpload(path), /not a ZIP archive/);
});

test('an empty archive is rejected (no package inside)', () => {
  const path = tempFile('empty.msixupload', storedZip({}));
  const report = verifyUpload(path);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => /expected exactly one package\/bundle, found 0/.test(error)));
});

test('a signature part inside the upload is rejected', () => {
  const path = tempFile('signed.msixupload', storedZip({ 'AppxSignature.p7x': Buffer.from([0x30, 0x00]) }));
  const report = verifyUpload(path);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => /forbidden file in the upload: AppxSignature\.p7x/.test(error)));
});

test('two packages in one upload is rejected (Partner Center allows one)', () => {
  const path = tempFile('two.msixupload', storedZip({
    'a_1.0.0.0_neutral.msixbundle': Buffer.from('PK'),
    'b_1.0.0.0_neutral.msixbundle': Buffer.from('PK'),
  }));
  const report = verifyUpload(path);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => /expected exactly one package\/bundle, found 2/.test(error)));
});

test('a raw .pdb in the upload is rejected (symbols must be .appxsym)', () => {
  const path = tempFile('pdb.msixupload', storedZip({
    'x_1.0.0.0_neutral.msixbundle': Buffer.from('PK'),
    'Nexora.pdb': Buffer.from('PDB'),
  }));
  const report = verifyUpload(path);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => /forbidden file in the upload: Nexora\.pdb/.test(error)));
});

test('tampering with the build script cannot silently drop the upload assertions', () => {
  const script = readFileSync('windows/scripts/Build-Msix.ps1', 'utf8');
  assert.match(script, /System\.IO\.Compression\.ZipArchive/);
  assert.match(script, /The \.msixupload must contain exactly one \.msixbundle/);
  assert.match(script, /must not contain raw \.pdb files/);
  assert.match(script, /Symbols:\s+\$symbolCount \.appxsym file\(s\)/);
});

test('the packaging doc states the .appxsym policy with a Microsoft reference', () => {
  const doc = readFileSync('docs/windows/PARTNER-CENTER-REVIEW.md', 'utf8');
  assert.match(doc, /appxsym/);
  assert.match(doc, /You can omit this file/);
  assert.match(doc, /learn\.microsoft\.com\/en-us\/windows\/msix\/package\/packaging-uwp-apps/);
});
