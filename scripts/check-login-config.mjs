#!/usr/bin/env node
/**
 * NEXORA AI — فحص ربط تسجيل الدخول داخل مشروع أندرويد قبل البناء.
 *
 * يفشل البناء إذا اختل شيء يمنع «Continue with Google» من الاستجابة على Fire OS،
 * أو إذا كُسر مسار البريد الإلكتروني الذي يطالب به مراجع Amazon:
 *
 *  1. النسخة > 43 (Amazon رفضت 43، والتحديث يجب أن يحمل رقمًا أكبر).
 *  2. اسم الحزمة كما هو: com.ahmedbecetti.nexora.
 *  3. إضافة NexoraAuth موجودة ومسجَّلة في MainActivity (تشخيص الجهاز + منع التعليق).
 *  4. إذا وُجد google-services.json فيجب أن يكون مشروعًا صحيحًا وله Web OAuth client
 *     وAndroid client ببصمة توقيع — وإلا فشل Google دون تفسير.
 *  5. assets/public يحتوي على الحزمة المبنية (فحص آخر بناء فقط، إن كان موجودًا).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const APP_ID = 'com.ahmedbecetti.nexora';
const PROJECT_ID = 'nexora-social-2026';
const MIN_VERSION_CODE = 44;

const problems = [];
const notes = [];

function read(path) {
  return readFileSync(path, 'utf8');
}

/* ---------- 1) build.gradle: الإصدار والحزمة ---------- */
const gradlePath = 'android/app/build.gradle';
if (!existsSync(gradlePath)) {
  problems.push(`${gradlePath} غير موجود`);
} else {
  const gradle = read(gradlePath);
  const versionCode = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1] || 0);
  const versionName = /versionName\s+"([^"]+)"/.exec(gradle)?.[1] || '';
  if (versionCode <= 43) problems.push(`versionCode = ${versionCode} — يجب أن يكون أكبر من 43`);
  else notes.push(`versionCode = ${versionCode} · versionName = ${versionName}`);
  if (!gradle.includes(`applicationId "${APP_ID}"`)) problems.push(`applicationId يجب أن يبقى ${APP_ID}`);
  if (!gradle.includes('rgcfaIncludeGoogle')) {
    problems.push('build.gradle لا يضبط rgcfaIncludeGoogle (مسار Google قد يُشحن بلا تهيئة)');
  }
}

/* ---------- 2) الإضافة المحلية + تسجيلها ---------- */
const pluginPath = 'android/app/src/main/java/com/ahmedbecetti/nexora/NexoraAuthPlugin.java';
if (!existsSync(pluginPath)) {
  problems.push('NexoraAuthPlugin.java غير موجود (لا يوجد فحص بيئة الجهاز)');
} else {
  const plugin = read(pluginPath);
  if (!plugin.includes('@CapacitorPlugin(name = "NexoraAuth")')) problems.push('NexoraAuthPlugin يجب أن يحمل الاسم NexoraAuth');
  if (!plugin.includes('googleSignInAvailable')) problems.push('NexoraAuthPlugin لا يعيد googleSignInAvailable');
  // نتجاهل التعليقات: المطلوب ألّا يستدعي الكودُ الفعلي FirebaseAuth.getInstance()
  const pluginCode = plugin.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (/FirebaseAuth\.getInstance\s*\(/.test(pluginCode)) problems.push('NexoraAuthPlugin لا يجب أن يهيّئ FirebaseAuth أثناء الفحص');
}

const mainActivityPath = 'android/app/src/main/java/com/ahmedbecetti/nexora/MainActivity.java';
if (!existsSync(mainActivityPath)) {
  problems.push('MainActivity.java غير موجود');
} else if (!read(mainActivityPath).includes('registerPlugin(NexoraAuthPlugin.class)')) {
  problems.push('MainActivity لا يسجّل NexoraAuthPlugin');
}

/* ---------- 3) الويب: زر Google لا يُخفى داخل التطبيق ---------- */
const authScreenPath = 'src/screens/Auth.jsx';
if (!existsSync(authScreenPath)) {
  problems.push('src/screens/Auth.jsx غير موجود');
} else {
  const auth = read(authScreenPath);
  if (/insideApp\s*\(/.test(auth)) problems.push('Auth.jsx لا يجب أن يخفي زر Google داخل التطبيق (Fire OS يرفض زرًا مفقودًا/صامتًا)');
  if (!auth.includes('googleFallbackBody')) problems.push('Auth.jsx لا يعرض البديل بالبريد عند تعذّر Google');
  if (!auth.includes('emailOrUsername')) problems.push('Auth.jsx لا يحتوي حقل بريد/اسم مستخدم صريحًا');
}

/* ---------- 4) تهيئة Firebase إن وُجدت ---------- */
const gsPath = 'android/app/google-services.json';
const gsFromEnv = process.env.GOOGLE_SERVICES_JSON;
let gsConfig = null;
if (gsFromEnv && gsFromEnv.trim().startsWith('{')) {
  try {
    gsConfig = JSON.parse(gsFromEnv);
  } catch {
    problems.push('GOOGLE_SERVICES_JSON ليس JSON صالحًا');
  }
} else if (existsSync(gsPath)) {
  try {
    gsConfig = JSON.parse(read(gsPath));
  } catch {
    problems.push('android/app/google-services.json ليس JSON صالحًا');
  }
}

if (gsConfig) {
  if (gsConfig?.project_info?.project_id !== PROJECT_ID) {
    problems.push(`google-services.json لمشروع ${gsConfig?.project_info?.project_id} — المتوقع ${PROJECT_ID}`);
  }
  const client = (gsConfig.client || []).find(
    (c) => c?.client_info?.android_client_info?.package_name === APP_ID,
  );
  if (!client) problems.push(`google-services.json لا يحتوي عميل أندرويد للحزمة ${APP_ID}`);
  else {
    const webClient = (client.oauth_client || []).find(
      (o) => o.client_type === 3 && String(o.client_id).endsWith('.apps.googleusercontent.com'),
    );
    const androidClient = (client.oauth_client || []).find(
      (o) => o.client_type === 1 && o?.android_info?.package_name === APP_ID && o?.android_info?.certificate_hash,
    );
    if (!webClient) problems.push('لا يوجد Web OAuth client (client_type 3) — Google Sign-In لن يعمل');
    if (!androidClient) problems.push('لا يوجد Android OAuth client ببصمة SHA — أضِف SHA-1/SHA-256 للتوقيع في Firebase');
    if (webClient && androidClient) notes.push('Google Sign-In مُهيّأ (Web + Android client + بصمة)');
  }
} else {
  notes.push('بدون google-services.json: Google Sign-In سيكون معطّلًا بوعي، والبريد/الهاتف يعملان.');
}

/* ---------- 5) الحزمة المبنية (إن وُجدت) ---------- */
const assetsDir = 'android/app/src/main/assets/public';
if (existsSync(assetsDir)) {
  const indexHtml = join(assetsDir, 'index.html');
  if (!existsSync(indexHtml)) problems.push('assets/public/index.html غير موجود — نفّذ npx cap sync android');
} else {
  notes.push('assets/public غير موجود بعد (لم يُنفَّذ cap sync في هذه النسخة من الفحص).');
}

/* ---------- التقرير ---------- */
console.log('NEXORA — فحص ربط تسجيل الدخول');
for (const n of notes) console.log(`  ✓ ${n}`);
for (const p of problems) console.log(`  ✗ ${p}`);
if (problems.length) {
  console.error(`\nفشل الفحص: ${problems.length} مشكلة.`);
  process.exit(1);
}
console.log('\nكل فحوص تسجيل الدخول سليمة.');
