#!/usr/bin/env node
/* ==========================================================================
   NEXORA AI — مُحقِّق حزمة الرفع إلى Microsoft Partner Center
   --------------------------------------------------------------------------
   يتحقق من ".msixupload" (وهو ZIP) دون Windows SDK، لأن البنية معيارية:
     upload → msixbundle → AppxBundleManifest + msix → AppxManifest + blockmap

   ما يفحصه فعليًا:
     1. أن الرفع ZIP سليم، وكل عناصره في الجذر، وفيه حزمة واحدة فقط
        (.msix أو .msixbundle) — كما يطلب Partner Center.
     2. أن الرفع لا يحتوي AppxSignature.p7x ولا *.pdb ولا *.cer ولا ملفات
        مضغوطة متداخلة (أخطاء رفع شائعة).
     3. أن .appxsym إن وُجد ملف رموز حقيقي (ZIP) — وإن غاب فهو مسموح:
        اختياري وفق توثيق Microsoft، لا نصنعه.
     4. أن AppxBundleManifest.xml يحمل نفس Identity والPublisher والإصدار،
        وأن كل <Package> فيه موجود فعلًا بنفس FileName/Version/Architecture.
     5. أن كل ملف داخل الحزمة/الـbundle مذكور في AppxBlockMap.xml، وأن كل
        بصمة Block (SHA-256 / base64) تطابق المحتوى الفعلي للكتل غير المضغوطة.
     6. أن AppxManifest.xml: الاسم المحجوز، PublisherDisplayName، الإصدار
        الرباعي، HostId=PWA، مضيف Edge، --app-id المشتق، رابط fallback،
        الصلاحيات المطابقة لـ package-identity.json، والأصول المشار إليها.
     7. أن CRC32 لكل عنصر ZIP سليم (كشف تلف أثناء النقل).

   الاستخدام:
     node windows/tools/verify-msix-upload.mjs <file.msixupload> [--json out.json]
   رمز الخروج 1 عند أي خطأ حقيقي.
   ========================================================================== */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, basename } from 'node:path';
import { validateCapabilities, validateManifestXml, webAppIdFromManifestId, looksLikeStoreProductId } from './msix.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ------------------------------------------------------------------ ZIP ---
   قارئ ZIP صغير يعتمد على الدليل المركزي (central directory) ويدعم
   store/deflate — وهو ما يستخدمه makeappx وCompress-Archive. */
function readZip(buffer, label) {
  const errors = [];
  const entries = [];
  // ابحث عن EOCD الكلاسيكي (0x06054b50) من النهاية، واقبل فقط ما يشير إلى دليل مركزي صالح.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i >= buffer.length - 65558; i -= 1) {
    if (buffer.readUInt32LE(i) !== 0x06054b50) continue;
    const commentLength = buffer.readUInt16LE(i + 20);
    if (i + 22 + commentLength !== buffer.length) continue;
    eocd = i;
    break;
  }
  if (eocd < 0) throw new Error(`${label}: not a ZIP archive (EOCD not found)`);

  let count = buffer.readUInt16LE(eocd + 10);
  let directoryOffset = buffer.readUInt32LE(eocd + 16);
  let directorySize = buffer.readUInt32LE(eocd + 12);

  // makeappx ينتج ZIP64 حتى للأحجام الصغيرة؛ اقرأ السجل الموسّع عند الحاجة.
  if (count === 0xffff || directoryOffset === 0xffffffff || directorySize === 0xffffffff) {
    const locator = eocd - 20;
    if (locator < 0 || buffer.readUInt32LE(locator) !== 0x07064b50) {
      throw new Error(`${label}: ZIP64 locator not found`);
    }
    const zip64 = Number(buffer.readBigUInt64LE(locator + 8));
    if (zip64 + 56 > buffer.length || buffer.readUInt32LE(zip64) !== 0x06064b50) {
      throw new Error(`${label}: ZIP64 end of central directory is corrupt`);
    }
    count = Number(buffer.readBigUInt64LE(zip64 + 32));
    directorySize = Number(buffer.readBigUInt64LE(zip64 + 40));
    directoryOffset = Number(buffer.readBigUInt64LE(zip64 + 48));
  }
  if (count > 0 && (directoryOffset + 4 > buffer.length || buffer.readUInt32LE(directoryOffset) !== 0x02014b50)) {
    throw new Error(`${label}: central directory is missing or corrupt`);
  }

  let offset = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      errors.push(`${label}: corrupt central directory at entry ${index}`);
      break;
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    let compressedSize = buffer.readUInt32LE(offset + 20);
    let size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    let localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString(flags & 0x800 ? 'utf8' : 'latin1', offset + 46, offset + 46 + nameLength);

    // الحقول الموسّعة: قيم 64-bit بترتيب ثابت داخل الحقل 0x0001.
    if (size === 0xffffffff || compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      let extra = offset + 46 + nameLength;
      const extraEnd = extra + extraLength;
      while (extra + 4 <= extraEnd) {
        const id = buffer.readUInt16LE(extra);
        const length = buffer.readUInt16LE(extra + 2);
        if (id === 0x0001) {
          let cursor = extra + 4;
          if (size === 0xffffffff) { size = Number(buffer.readBigUInt64LE(cursor)); cursor += 8; }
          if (compressedSize === 0xffffffff) { compressedSize = Number(buffer.readBigUInt64LE(cursor)); cursor += 8; }
          if (localOffset === 0xffffffff) { localOffset = Number(buffer.readBigUInt64LE(cursor)); }
          break;
        }
        extra += 4 + length;
      }
    }

    offset += 46 + nameLength + extraLength + commentLength;
    if (localOffset >= buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      errors.push(`${label}: corrupt local header for ${name}`);
      continue;
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    let data;
    try {
      data = method === 0 ? Buffer.from(raw) : method === 8 ? inflateRawSync(raw) : null;
    } catch (error) {
      errors.push(`${label}: cannot inflate ${name} (${error.message})`);
      data = null;
    }
    if (method !== 0 && method !== 8) errors.push(`${label}: ${name} uses unsupported compression method ${method}`);
    if (data && data.length !== size) errors.push(`${label}: ${name} size mismatch (${data.length} ≠ ${size})`);
    if (data && crc32(data) !== crc) errors.push(`${label}: ${name} CRC32 mismatch — the file is corrupt`);
    entries.push({ name, method, size, compressedSize, crc, data, isDirectory: name.endsWith('/') });
  }
  return { entries, errors };
}

let crcTable = null;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------- XML helpers */
function attr(xml, tag, attribute) {
  const match = new RegExp(`<${tag}\\b[^>]*\\b${attribute}="([^"]*)"`).exec(xml);
  return match ? match[1] : null;
}
function elementText(xml, tag) {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml);
  return match ? match[1] : null;
}
function unescapeXml(value) {
  return String(value).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function blockMapFiles(xml) {
  const files = [];
  const pattern = /<File\b([^>]*)>([\s\S]*?)<\/File>/g;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    const header = match[1];
    const body = match[2];
    const name = /Name="([^"]*)"/.exec(header)?.[1] ?? '';
    const size = Number(/Size="(\d+)"/.exec(header)?.[1] ?? -1);
    const blocks = [];
    const blockPattern = /<Block\b([^>]*)\/?>/g;
    let blockMatch;
    while ((blockMatch = blockPattern.exec(body)) !== null) {
      const blockAttrs = blockMatch[1];
      blocks.push({
        hash: /Hash="([^"]*)"/.exec(blockAttrs)?.[1] ?? '',
        size: /Size="(\d+)"/.exec(blockAttrs)?.[1] ? Number(/Size="(\d+)"/.exec(blockAttrs)[1]) : null,
      });
    }
    files.push({ name: unescapeXml(name), size, blocks });
  }
  return files;
}

/* ------------------------------------------------------------------ checks */
const BLOCK = 64 * 1024;
const SPECIAL_PARTS = new Set(['AppxBlockMap.xml', '[Content_Types].xml', 'AppxSignature.p7x']);

function verifyBlockMap(zipEntries, blockMapXml, label, errors, stats) {
  const files = blockMapFiles(blockMapXml);
  const byName = new Map(zipEntries.filter((e) => !e.isDirectory).map((e) => [e.name.replace(/\//g, '\\'), e]));
  const listed = new Set(files.map((f) => f.name));
  if (!/HashMethod="http:\/\/www\.w3\.org\/2001\/04\/xmlenc#sha256"/.test(blockMapXml)) {
    errors.push(`${label}: block map does not declare SHA-256`);
  }
  for (const file of files) {
    const entry = byName.get(file.name);
    if (!entry) { errors.push(`${label}: block map lists a missing file ${file.name}`); continue; }
    if (file.size !== entry.data.length) {
      errors.push(`${label}: ${file.name} block-map size ${file.size} ≠ actual ${entry.data.length}`);
    }
    let cursor = 0;
    for (const block of file.blocks) {
      if (block.size !== null) {
        // كتلة مضغوطة: البصمة على التدفق المضغوط، ويتحقق منها النظام عند التثبيت.
        cursor += block.size;
        stats.compressedBlocks += 1;
        continue;
      }
      const chunk = entry.data.subarray(cursor, cursor + BLOCK);
      if (!chunk.length) { errors.push(`${label}: ${file.name} has too many blocks`); break; }
      const hash = createHash('sha256').update(chunk).digest('base64');
      if (hash !== block.hash) errors.push(`${label}: block hash mismatch in ${file.name} at offset ${cursor}`);
      cursor += BLOCK;
      stats.verifiedBlocks += 1;
    }
    if (file.blocks.every((b) => b.size === null) && cursor - BLOCK >= entry.data.length) {
      errors.push(`${label}: ${file.name} block count exceeds content`);
    }
  }
  // كل ملف غير استثنائي يجب أن يكون في block map (وإلا فالحزمة غير مكتملة).
  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;
    if (SPECIAL_PARTS.has(entry.name)) continue;
    if (!listed.has(entry.name.replace(/\//g, '\\'))) {
      errors.push(`${label}: ${entry.name} is not covered by the block map`);
    }
  }
  stats.blockMapFiles += files.length;
}

export function verifyUpload(uploadPath, identityPath = resolve(root, 'windows/package-identity.json')) {
  const errors = [];
  const warnings = [];
  const stats = { entries: 0, verifiedBlocks: 0, compressedBlocks: 0, blockMapFiles: 0 };
  const identity = JSON.parse(readFileSync(identityPath, 'utf8'));

  if (!existsSync(uploadPath)) throw new Error(`upload not found: ${uploadPath}`);
  const upload = readZip(readFileSync(uploadPath), 'msixupload');
  errors.push(...upload.errors);
  stats.entries = upload.entries.length;

  // 1) عناصر الرفع في الجذر وحزمة واحدة فقط
  for (const entry of upload.entries) {
    if (entry.isDirectory) { errors.push(`msixupload: directory entry ${entry.name} must not be present`); continue; }
    if (entry.name.includes('/') || entry.name.includes('\\')) errors.push(`msixupload: ${entry.name} is not at the archive root`);
  }
  const packages = upload.entries.filter((e) => /\.(msix|appxbundle|msixbundle|appx)$/i.test(e.name));
  const symbols = upload.entries.filter((e) => /\.(appxsym|msixsym|pdb)$/i.test(e.name));
  if (packages.length !== 1) errors.push(`msixupload: expected exactly one package/bundle, found ${packages.length}`);
  for (const entry of upload.entries) {
    if (/\.(pdb|cer|pfx|p7x|zip|msixupload|appxupload)$/i.test(entry.name)) {
      errors.push(`msixupload: forbidden file in the upload: ${entry.name}`);
    }
  }
  for (const symbol of symbols) {
    if (!symbol.name.toLowerCase().endsWith('.appxsym')) {
      errors.push(`msixupload: ${symbol.name} must not be a raw .pdb inside the upload`);
    }
  }
  if (!symbols.length) {
    warnings.push('msixupload: no .appxsym file — optional per Microsoft (crash analytics only); this Hosted App Model package ships no compiled code to symbolize');
  } else {
    for (const symbol of symbols) {
      try { readZip(symbol.data, `appxsym:${symbol.name}`); }
      catch { errors.push(`msixupload: ${symbol.name} is not a valid symbol archive`); }
    }
  }
  // لا معنى لتحليل المحتوى إن لم يكن في الجذر حزمة واحدة بالضبط.
  if (packages.length !== 1) return { ok: false, errors, warnings, stats, identity };

  const pkgEntry = packages[0];
  const pkgName = pkgEntry.name;
  const family = /\.msixbundle$/i.test(pkgName) ? 'bundle' : 'package';

  // 2) اسم الملف يتبع النمط <name>_<version>_<arch>
  const nameMatch = /^(.+)_(\d+\.\d+\.\d+\.\d+)_([A-Za-z0-9]+)\.(msix|msixbundle)$/.exec(pkgName);
  if (!nameMatch) warnings.push(`msixupload: ${pkgName} does not follow <name>_<version>_<arch>`);
  else if (nameMatch[2] !== identity.version) errors.push(`msixupload: file name version ${nameMatch[2]} ≠ identity ${identity.version}`);

  // 3) اقرأ الحزمة الداخلية (bundle أو msix مباشرة)
  let innerMsix = pkgEntry;
  let bundleEntries = null;
  if (family === 'bundle') {
    let bundle;
    try { bundle = readZip(pkgEntry.data, 'msixbundle'); }
    catch (error) { errors.push(error.message); return { ok: false, errors, warnings, stats, identity }; }
    errors.push(...bundle.errors);
    bundleEntries = bundle.entries;
    const contentTypes = bundle.entries.find((e) => e.name === '[Content_Types].xml');
    const blockMap = bundle.entries.find((e) => e.name === 'AppxBlockMap.xml');
    const bundleManifest = bundle.entries.find((e) => e.name === 'AppxMetadata/AppxBundleManifest.xml');
    if (!contentTypes) errors.push('msixbundle: [Content_Types].xml is missing');
    if (!blockMap) errors.push('msixbundle: AppxBlockMap.xml is missing');
    if (!bundleManifest) { errors.push('msixbundle: AppxMetadata/AppxBundleManifest.xml is missing'); return { ok: false, errors, warnings, stats, identity }; }
    if (bundle.entries.some((e) => e.name === 'AppxSignature.p7x')) errors.push('msixbundle: must not be signed (the Store signs during certification)');

    const bundleXml = bundleManifest.data.toString('utf8');
    const bundleIdentity = {
      name: attr(bundleXml, 'Identity', 'Name'),
      publisher: attr(bundleXml, 'Identity', 'Publisher'),
      version: attr(bundleXml, 'Identity', 'Version'),
    };
    if (bundleIdentity.name !== identity.identityName) errors.push(`msixbundle: Identity Name ${bundleIdentity.name} ≠ ${identity.identityName}`);
    if (bundleIdentity.publisher !== identity.publisher) errors.push(`msixbundle: Publisher ${bundleIdentity.publisher} ≠ ${identity.publisher}`);
    if (bundleIdentity.version !== identity.version) errors.push(`msixbundle: Version ${bundleIdentity.version} ≠ ${identity.version}`);

    const payloadNames = [...bundleXml.matchAll(/<Package\b[^>]*>/g)].map((m) => ({
      raw: m[0],
      fileName: /FileName="([^"]*)"/.exec(m[0])?.[1],
      version: /Version="([^"]*)"/.exec(m[0])?.[1],
      architecture: /Architecture="([^"]*)"/.exec(m[0])?.[1],
      type: /Type="([^"]*)"/.exec(m[0])?.[1],
    }));
    const applications = payloadNames.filter((p) => p.type === 'application');
    if (applications.length !== 1) errors.push(`msixbundle: expected one application package, found ${applications.length}`);
    for (const payload of payloadNames) {
      const found = bundle.entries.find((e) => e.name === payload.fileName);
      if (!found) { errors.push(`msixbundle: declared payload ${payload.fileName} is missing`); continue; }
      if (payload.version !== identity.version) errors.push(`msixbundle: payload ${payload.fileName} version ${payload.version} ≠ ${identity.version}`);
      if (payload.architecture && !['neutral', 'x64', 'x86', 'arm', 'arm64'].includes(payload.architecture)) {
        errors.push(`msixbundle: unexpected architecture ${payload.architecture}`);
      }
      if (payload.type === 'application') innerMsix = found;
    }
    if (blockMap) {
      const payloadSet = new Set(payloadNames.map((p) => p.fileName));
      const covered = bundle.entries.filter((e) => !e.isDirectory && !SPECIAL_PARTS.has(e.name) && !payloadSet.has(e.name));
      verifyBlockMap(covered, blockMap.data.toString('utf8'), 'msixbundle', errors, stats);
    }
    // الحِزم المُضمَّنة يجب أن تكون مخزّنة (stored) كما ينتج makeappx bundle
    for (const payload of payloadNames) {
      const found = bundle.entries.find((e) => e.name === payload.fileName);
      if (found && found.method !== 0) warnings.push(`msixbundle: payload ${payload.fileName} is deflated (makeappx stores payloads; the Store accepts both)`);
    }
  }

  // 4) الحزمة الداخلية
  let pkg;
  try { pkg = readZip(innerMsix.data, 'msix'); }
  catch (error) { errors.push(error.message); return { ok: false, errors, warnings, stats, identity }; }
  errors.push(...pkg.errors);
  const manifestEntry = pkg.entries.find((e) => e.name === 'AppxManifest.xml');
  const blockMapEntry = pkg.entries.find((e) => e.name === 'AppxBlockMap.xml');
  const contentTypesEntry = pkg.entries.find((e) => e.name === '[Content_Types].xml');
  const priEntry = pkg.entries.find((e) => e.name === 'resources.pri');
  if (!manifestEntry) { errors.push('msix: AppxManifest.xml is missing'); return { ok: false, errors, warnings, stats, identity }; }
  if (!blockMapEntry) errors.push('msix: AppxBlockMap.xml is missing');
  if (!contentTypesEntry) errors.push('msix: [Content_Types].xml is missing');
  if (!priEntry) errors.push('msix: resources.pri is missing');
  if (pkg.entries.some((e) => e.name === 'AppxSignature.p7x')) errors.push('msix: the Store upload must not contain AppxSignature.p7x');
  if (priEntry && priEntry.data.subarray(0, 8).toString('latin1') !== 'mrm_pri2') {
    errors.push('msix: resources.pri has an unexpected header');
  }

  const manifestXml = manifestEntry.data.toString('utf8');
  const manifestCheck = validateManifestXml(manifestXml, identity);
  for (const error of manifestCheck.errors) errors.push(`msix manifest: ${error}`);
  const capabilityCheck = validateCapabilities(manifestXml, identity);
  for (const error of capabilityCheck.errors) errors.push(`msix capabilities: ${error}`);
  if (!looksLikeStoreProductId(identity.productId)) errors.push('identity: productId is not a valid Store Product ID');

  const displayName = elementText(manifestXml, 'DisplayName');
  const publisherDisplayName = elementText(manifestXml, 'PublisherDisplayName');
  if (displayName !== identity.displayName) errors.push(`msix: DisplayName "${displayName}" ≠ reserved name "${identity.displayName}"`);
  if (publisherDisplayName !== identity.publisherDisplayName) errors.push(`msix: PublisherDisplayName "${publisherDisplayName}" ≠ "${identity.publisherDisplayName}"`);
  const visualName = /<uap:VisualElements[^>]*DisplayName="([^"]*)"/.exec(manifestXml)?.[1];
  if (visualName !== identity.displayName) errors.push(`msix: tile DisplayName "${visualName}" ≠ reserved name`);
  const version = attr(manifestXml, 'Identity', 'Version');
  if (version !== identity.version) errors.push(`msix: Version ${version} ≠ ${identity.version}`);
  if (attr(manifestXml, 'Identity', 'Publisher') !== identity.publisher) errors.push('msix: Publisher does not match the Partner Center value');
  if (attr(manifestXml, 'Identity', 'Name') !== identity.identityName) errors.push('msix: Identity Name does not match the Partner Center value');

  // 5) معاملات مضيف Edge PWA
  const parameters = /uap10:Parameters="([^"]*)"/.exec(manifestXml)?.[1] ?? '';
  const appId = /--app-id=([a-p]{32})/.exec(parameters)?.[1];
  if (appId !== webAppIdFromManifestId(identity.webAppManifestId)) errors.push('msix: --app-id does not match the web app manifest id');
  if (!parameters.includes(`--app-fallback-url=${identity.startPage}`)) errors.push('msix: --app-fallback-url does not match startPage');
  if (!manifestXml.includes('uap10:HostId="PWA"')) errors.push('msix: HostId is not PWA');
  if (!manifestXml.includes('Name="Microsoft.MicrosoftEdge.Stable"')) errors.push('msix: Edge stable host dependency is missing');

  // 6) الأصول المشار إليها موجودة
  const referenced = new Set();
  for (const match of manifestXml.matchAll(/(?:Logo|Image|Square44x44Logo|Square150x150Logo|Square310x310Logo|Square71x71Logo|Wide310x150Logo)="([^"]+\.png)"/g)) {
    referenced.add(match[1].replace(/\\/g, '/'));
  }
  for (const asset of referenced) {
    if (!pkg.entries.some((e) => e.name === asset)) errors.push(`msix: referenced asset missing: ${asset}`);
  }
  const pngCount = pkg.entries.filter((e) => /\.png$/i.test(e.name)).length;

  // 7) block map للحزمة
  if (blockMapEntry) verifyBlockMap(pkg.entries, blockMapEntry.data.toString('utf8'), 'msix', errors, stats);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: { ...stats, family, packageName: pkgName, pngAssets: pngCount, referencedAssets: referenced.size, manifestEntries: pkg.entries.length },
    identity: {
      name: identity.identityName,
      publisher: identity.publisher,
      displayName,
      publisherDisplayName,
      version,
      capabilities: capabilityCheck.capabilities,
      productId: identity.productId,
      packageFamilyName: identity.packageFamilyName,
    },
  };
}

/* -------------------------------------------------------------------- CLI */
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const jsonIndex = args.indexOf('--json');
  if (!target) {
    console.error('usage: node windows/tools/verify-msix-upload.mjs <file.msixupload> [--json out.json]');
    process.exit(2);
  }
  let report;
  try {
    report = verifyUpload(resolve(target));
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exit(1);
  }
  console.log(`NEXORA AI — Partner Center upload verification`);
  console.log(`  file:      ${basename(target)}`);
  console.log(`  identity:  ${report.identity.name}`);
  console.log(`  publisher: ${report.identity.publisher}`);
  console.log(`  version:   ${report.identity.version} · ${report.identity.displayName} (${report.identity.publisherDisplayName})`);
  console.log(`  caps:      ${(report.identity.capabilities || []).join(', ')}`);
  console.log(`  structure: ${report.stats.family} · ${report.stats.entries} entry · ${report.stats.manifestEntries} parts · ${report.stats.pngAssets} PNG`);
  console.log(`  block map: ${report.stats.blockMapFiles} files · ${report.stats.verifiedBlocks} blocks hashed · ${report.stats.compressedBlocks} compressed blocks`);
  for (const warning of report.warnings) console.log(`WARN  ${warning}`);
  for (const error of report.errors) console.error(`ERROR ${error}`);
  if (jsonIndex >= 0 && args[jsonIndex + 1]) {
    writeFileSync(resolve(args[jsonIndex + 1]), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`JSON written to ${args[jsonIndex + 1]}`);
  }
  if (!report.ok) {
    console.error(`\n${report.errors.length} blocking issue(s) — do not upload this file.`);
    process.exit(1);
  }
  console.log('\nOK — the upload is structurally valid for Partner Center.');
}

export default { verifyUpload };
