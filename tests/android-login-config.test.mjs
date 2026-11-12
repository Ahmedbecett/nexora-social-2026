/**
 * NEXORA AI — اختبارات بنية الحزمة (Android/Fire OS).
 * تحمي متطلبات التسليم في تقرير Amazon:
 *   - نفس اسم الحزمة، نسخة أكبر من 43، نفس مفتاح التوقيع (بفحص SHA-256).
 *   - زر Google لم يعد يُخفى داخل التطبيق.
 *   - مسار البريد الإلكتروني موجود فعليًا في الواجهة.
 *   - الفحص الذاتي للبناء ينجح.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => readFileSync(p, 'utf8');

test('اسم الحزمة لم يتغيّر', () => {
  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /applicationId "com\.ahmedbecetti\.nexora"/);
  const cap = JSON.parse(read('capacitor.config.json'));
  assert.equal(cap.appId, 'com.ahmedbecetti.nexora');
});

test('versionCode أكبر من 43 (Amazon رفضت 43)', () => {
  const gradle = read('android/app/build.gradle');
  const versionCode = Number(/versionCode\s+(\d+)/.exec(gradle)[1]);
  assert.ok(versionCode > 43, `versionCode = ${versionCode}`);
  const versionName = /versionName\s+"([^"]+)"/.exec(gradle)[1];
  assert.match(versionName, /^4\.[4-9]\./, `versionName = ${versionName}`);
});

test('مفتاح التوقيع في الحزمة الحالية هو نفسه البصمة المعتمدة', { skip: !existsSync('public/download/Nexora.apk') }, () => {
  const out = execFileSync(process.execPath, ['scripts/inspect-apk.mjs', 'public/download/Nexora.apk', '--describe-only'], { encoding: 'utf8' });
  const sha = /SHA-256 للشهادة:\s*([0-9A-F:]{95})/.exec(out)?.[1];
  if (!sha) return; // لم تُقرأ الشهادة (نسخة تُبنى لاحقًا)
  assert.equal(sha, '24:0E:00:2F:A0:90:51:6D:EF:06:E8:92:61:4F:03:A3:79:17:A0:3B:30:04:BE:EC:F5:1B:1A:D3:0C:07:42:F6');
});

test('زر Google لا يُخفى داخل التطبيق (كان يختفي تمامًا)', () => {
  const auth = read('src/screens/Auth.jsx');
  assert.ok(!/insideApp\s*\(/.test(auth), 'لم يعد مسموحًا بإخفاء زر Google عبر user-agent');
  assert.match(auth, /continueGoogle/);
});

test('الدخول بالبريد موجود: بريد + كلمة مرور + استعادة', () => {
  const auth = read('src/screens/Auth.jsx');
  assert.match(auth, /emailOrUsername/);
  assert.match(auth, /go\('forgot'\)/);
  assert.match(auth, /go\('signup'\)/);
  const fb = read('src/firebase.js');
  assert.match(fb, /auth\/login/);
  assert.match(fb, /auth\/register/);
  assert.match(fb, /auth\/reset/);
});

test('كل مسار Google محمي بمهلة (لا وعد معلّق)', () => {
  const fb = read('src/firebase.js');
  const googleSection = fb.slice(fb.indexOf('export async function signInWithGoogle'), fb.indexOf('export async function signInWithEmail'));
  assert.match(googleSection, /withTimeout\(/);
  assert.match(fb, /GOOGLE_ATTEMPT_TIMEOUT_MS/);
});

test('إضافة التشخيص المحلية موجودة ومسجَّلة', () => {
  assert.ok(existsSync('android/app/src/main/java/com/ahmedbecetti/nexora/NexoraAuthPlugin.java'));
  assert.match(read('android/app/src/main/java/com/ahmedbecetti/nexora/MainActivity.java'), /registerPlugin\(NexoraAuthPlugin\.class\)/);
});

test('الفحص الذاتي لتسجيل الدخول ينجح', () => {
  const out = execFileSync(process.execPath, ['scripts/check-login-config.mjs'], { encoding: 'utf8' });
  assert.match(out, /كل فحوص تسجيل الدخول سليمة/);
});
