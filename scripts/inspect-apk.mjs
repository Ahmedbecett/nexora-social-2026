#!/usr/bin/env node
/**
 * NEXORA AI — تقرير هوية الـ APK بعد البناء (بدون أدوات أندرويد).
 *
 * يقرأ ملف APK ويستخرج:
 *  - رقم الحزمة (من AndroidManifest الثنائي) وversionCode — إن أمكن قراءتهما،
 *  - توقيع الشهادة (SHA-256) — يجب أن يبقى نفسه بين النسخ،
 *  - هل google-services.json مضمّن (أي هل Google Sign-In مُهيّأ في هذه الحزمة)،
 *  - وجود إضافة NexoraAuth،
 *  - حجم الملف.
 *
 * الاستخدام: node scripts/inspect-apk.mjs Nexora.apk
 */
import { readFileSync, statSync, existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { createHash, X509Certificate } from 'node:crypto';

const apkPath = process.argv[2] || 'Nexora.apk';
const buf = readFileSync(apkPath);

/* ---------- قراءة مركز الدليل (ZIP) ---------- */
function readZipEntries(buffer) {
  // ابحث عن EOCD
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 70000); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ليس ملف ZIP/APK صالحًا');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
    entries.set(name, { method, compSize, localOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(buffer, entry) {
  const { localOffset, method, compSize } = entry;
  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('ترويسة محلية تالفة');
  const nameLen = buffer.readUInt16LE(localOffset + 26);
  const extraLen = buffer.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLen + extraLen;
  const raw = buffer.subarray(start, start + compSize);
  return method === 0 ? raw : inflateRawSync(raw);
}

const entries = readZipEntries(buf);

/* ---------- التوقيع ---------- */
const certEntry = [...entries.keys()].find(
  (n) => /^META-INF\/.*\.(RSA|DSA|EC)$/i.test(n),
);
let signer = null;
if (certEntry) {
  // PKCS#7 DER: نستخرج أول شهادة X.509 داخل الحاوية بمطابقة ترويسة SEQUENCE للشهادة
  const der = readEntry(buf, entries.get(certEntry));
  const candidates = [];
  for (let i = 0; i < der.length - 4; i += 1) {
    if (der[i] === 0x30 && der[i + 1] === 0x82) {
      const len = der.readUInt16BE(i + 2) + 4;
      if (len > 200 && i + len <= der.length) candidates.push(der.subarray(i, i + len));
    }
  }
  for (const candidate of candidates) {
    try {
      const cert = new X509Certificate(candidate);
      const sha256 = createHash('sha256').update(cert.raw).digest('hex').toUpperCase().match(/../g).join(':');
      signer = { subject: cert.subject.replace(/\n/g, ', '), sha256, validTo: cert.validTo };
      break;
    } catch {
      /* ليست شهادة — تابع */
    }
  }
}

/* ---------- Firebase / Google في الحزمة ---------- */
let hasGoogleServices = false;
try {
  const arsc = readEntry(buf, entries.get('resources.arsc'));
  // قد يكون مجمّع النصوص UTF-8 أو UTF-16؛ نطبّع الحالتين قبل المطابقة
  const text = (arsc.toString('latin1') + '\n' + arsc.toString('utf16le')).replace(/\0/g, '');
  hasGoogleServices =
    !text.includes('WILL_BE_OVERRIDDEN') &&
    (text.includes('apps.googleusercontent.com') || text.includes('google_app_id'));
} catch {
  /* لا يوجد resources.arsc */
}

const hasAuthPlugin = [...entries.keys()].some((n) => n.startsWith('assets/')) === true;

/* هل شُحنت واجهة Google داخل DEX؟ (شفرة Play Services/Credential Manager) */
let googleClassesInDex = false;
try {
  const dexText = [...entries.keys()]
    .filter((n) => /^classes\d*\.dex$/.test(n))
    .map((n) => readEntry(buf, entries.get(n)).toString('latin1'))
    .join('\n');
  googleClassesInDex = /com\/google\/android\/gms\/auth\/api\/signin/.test(dexText)
    || /androidx\/credentials\/CredentialManager/.test(dexText);
} catch {
  /* تبقى false */
}
/*
 * حاجز الأمان: بناء شُحن بمعهد Google لكن بلا تهيئة Firebase يعني تكرار خلل النسخة 43
 * على Fire OS (وعد معلّق / زر لا يستجيب). نُفشل التقرير بدل نشر حزمة مرفوضة.
 */
const configSourceExists = existsSync('android/app/google-services.json');
const envConfigExists = String(process.env.GOOGLE_SERVICES_JSON || '').trim().startsWith('{');
const expectedConfig = configSourceExists || envConfigExists;

// --describe-only: وصف الحزمة فقط (تشخيص/فحص التوقيع لحزمة قديمة) بلا حاجز نشر
const describeOnly = process.argv.includes('--describe-only')
  || String(process.env.APK_DESCRIBE_ONLY || '') === '1';

let configProblem = null;
if (describeOnly) configProblem = null;
if (describeOnly) {
  // لا حاجز
} else if (!hasGoogleServices && googleClassesInDex) {
  configProblem = 'شُحنت واجهة Google بلا تهيئة Firebase — هذا يُعيد إنتاج خلل النسخة 43. أوقف rgcfaIncludeGoogle أو أضِف google-services.json.';
} else if (expectedConfig && !hasGoogleServices) {
  // التهيئة موجودة للمصدر لكنها لم تصل إلى الحزمة: البناء لم يُشغّل الإضافة،
  // أي أن Google معطّل فعليًا — لا يجوز وصف الحزمة بأن Google يعمل فيها.
  configProblem = 'تهيئة Firebase موجودة في المصدر لكن غير مضمّنة في الحزمة — أضِف apply plugin: com.google.gms.google-services وتحقّق من rgcfaIncludeGoogle.';
}

/* ---------- الحزمة ورقم النسخة من AndroidManifest الثنائي (AXML) ---------- */
function parseManifest(buffer) {
  const RES_STRING_POOL = 0x0001;
  const RES_XML_RESOURCE_MAP = 0x0180;
  const RES_XML_START_ELEMENT = 0x0102;
  const ANDROID_VERSION_CODE = 0x0101021b;
  const ANDROID_VERSION_NAME = 0x0101021c;

  let strings = [];
  let resIds = [];
  let packageName = null;
  let versionCode = null;
  let versionName = null;

  let pos = buffer.readUInt16LE(2); // تجاوز ترويسة الملف
  while (pos + 8 <= buffer.length) {
    const type = buffer.readUInt16LE(pos);
    const headerSize = buffer.readUInt16LE(pos + 2);
    const chunkSize = buffer.readUInt32LE(pos + 4);
    if (chunkSize <= 0 || pos + chunkSize > buffer.length) break;

    if (type === RES_STRING_POOL) {
      const count = buffer.readUInt32LE(pos + 8);
      const flags = buffer.readUInt32LE(pos + 16);
      const stringsStart = buffer.readUInt32LE(pos + 20);
      const utf8 = (flags & 0x100) !== 0;
      const offsets = [];
      for (let i = 0; i < count; i += 1) offsets.push(buffer.readUInt32LE(pos + headerSize + i * 4));
      strings = offsets.map((off) => {
        const at = pos + stringsStart + off;
        if (utf8) {
          let p2 = at;
          p2 += buffer[p2] & 0x80 ? 2 : 1; // طول عدد الأحرف
          let len = buffer[p2];
          if (len & 0x80) {
            p2 += 1;
            len = ((len & 0x7f) << 8) | buffer[p2];
          }
          p2 += 1;
          return buffer.toString('utf8', p2, p2 + len);
        }
        const units = buffer.readUInt16LE(at);
        return buffer.toString('utf16le', at + 2, at + 2 + units * 2);
      });
    } else if (type === RES_XML_RESOURCE_MAP) {
      const n = (chunkSize - headerSize) / 4;
      resIds = [];
      for (let i = 0; i < n; i += 1) resIds.push(buffer.readUInt32LE(pos + headerSize + i * 4));
    } else if (type === RES_XML_START_ELEMENT) {
      const ext = pos + headerSize;
      const nameIdx = buffer.readUInt32LE(ext + 4);
      const tag = strings[nameIdx] || '';
      if (tag === 'manifest') {
        const attrStart = buffer.readUInt16LE(ext + 8);
        const attrSize = buffer.readUInt16LE(ext + 10);
        const attrCount = buffer.readUInt16LE(ext + 12);
        for (let i = 0; i < attrCount; i += 1) {
          const a = ext + attrStart + i * attrSize;
          const aName = buffer.readUInt32LE(a + 4);
          const rawValue = buffer.readInt32LE(a + 8);
          const dataType = buffer[a + 15];
          const data = buffer.readUInt32LE(a + 16);
          const resId = resIds[aName];
          const key = resId || strings[aName];
          const value = rawValue >= 0 ? strings[rawValue] : dataType === 0x10 || dataType === 0x11 ? data : data;
          if (key === 'package' || resId === 0x0101020c) packageName = String(value);
          else if (resId === ANDROID_VERSION_CODE || key === 'versionCode') versionCode = Number(data) || null;
          else if (resId === ANDROID_VERSION_NAME || key === 'versionName') versionName = rawValue >= 0 ? strings[rawValue] : null;
        }
      }
    }
    pos += chunkSize;
  }
  return { packageName, versionCode, versionName };
}

let manifestInfo = { packageName: null, versionCode: null, versionName: null };
try {
  manifestInfo = parseManifest(readEntry(buf, entries.get('AndroidManifest.xml')));
} catch {
  /* تجاهل: التقرير يبقى صالحًا */
}
const { packageName, versionCode, versionName } = manifestInfo;

const sizeMb = (statSync(apkPath).size / (1024 * 1024)).toFixed(2);

const lines = [
  '### NEXORA AI — تقرير حزمة الإصدار',
  '',
  `- الملف: \`${apkPath}\` (${sizeMb} MB)`,
  `- الحزمة: ${packageName || 'com.ahmedbecetti.nexora (المتوقع)'}`,
  `- versionCode: ${versionCode || 'غير مقروء تلقائيًا (تحقّق بـ aapt dump badging)'}${versionName ? ` · versionName ${versionName}` : ''}`,
  `- التوقيع: ${signer ? signer.subject : 'غير موجود'}`,
  `- SHA-256 للشهادة: ${signer ? signer.sha256 : '—'}`,
  `- صلاحية الشهادة: ${signer ? signer.validTo : '—'}`,
  `- تهيئة Firebase/Google داخل الحزمة: ${hasGoogleServices ? 'نعم (Google Sign-In مفعّل)' : 'لا (البريد/الهاتف فقط — متوافق مع Fire OS)'}`,
  `- ملف التهيئة في المصدر: ${expectedConfig ? 'موجود' : 'غائب (بناء مقصود بلا Google)'}`,
  `- محتوى الويب مضمّن: ${hasAuthPlugin ? 'نعم' : 'لا'}`,
  `- شفرة Google الأصلية داخل DEX: ${googleClassesInDex ? 'نعم' : 'لا'}`,
  '',
  signer
    ? '> إن تغيّر SHA-256 أعلاه عن البصمة المعتمدة، فلا ترفع الحزمة: المفتاح نفسه يجب أن يبقى.'
    : '> لم يُعثر على توقيع: لا ترفع هذه الحزمة إلى Amazon Appstore.',
];

if (configProblem) {
  lines.push('');
  lines.push('> [FAIL] ' + configProblem);
}
for (const line of lines) console.log(line);

if (configProblem) {
  console.error(`\nفشل فحص الحزمة: ${configProblem}`);
  process.exit(1);
}
