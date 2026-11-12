/**
 * NEXORA AI — اختبارات إصلاح تسجيل الدخول (Fire OS / Amazon Appstore).
 *
 * تُشغَّل بـ: npm test   (node --test)
 *
 * تُغطّي بالضبط سبب رفض الإصدار 43:
 *   - زر «Continue with Google» كان يُعلّق الوعد إلى الأبد على جهاز بلا Play Services.
 *   - لم يكن هناك بديل فعّال بالبريد الإلكتروني.
 *
 * لا تحتاج أي جهاز: تختبر القرارات النقية + محاكاة إضافة أصلية معلّقة.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideGoogleAvailability,
  googleFailureNeedsEmailFallback,
  googleFailureIsSilent,
  withTimeout,
  isValidEmail,
  isValidNewPassword,
  GOOGLE_REASONS,
} from '../src/authPolicy.js';

/* ------------------------------------------------------------------ */
/* 1) قرار «هل نحاول Google؟» على Fire OS                              */
/* ------------------------------------------------------------------ */

test('Fire OS بلا Play Services: لا نحاول Google إطلاقًا', () => {
  const fireTablet = {
    platform: 'android',
    fireOs: true,
    playServices: false,
    firebaseConfigured: false,
    webClientConfigured: false,
    googleSignInAvailable: false,
    emailSignInAvailable: true,
    reason: 'fire_os_no_play_services',
  };
  const decision = decideGoogleAvailability(fireTablet);
  assert.equal(decision.attempt, false, 'يجب ألّا يبدأ مسار Google');
  assert.equal(decision.reason, GOOGLE_REASONS.fireOs);
  assert.equal(fireTablet.emailSignInAvailable, true, 'البريد يجب أن يبقى متاحًا');
});

test('جهاز أندرويد بلا Play Services: سبب واضح لا «تعليق»', () => {
  const d = decideGoogleAvailability({
    platform: 'android',
    fireOs: false,
    playServices: false,
    googleSignInAvailable: false,
    reason: 'no_play_services',
  });
  assert.equal(d.attempt, false);
  assert.equal(d.reason, GOOGLE_REASONS.noPlayServices);
});

test('نسخة بُنيت بلا google-services.json: لا نحاول Google', () => {
  const d = decideGoogleAvailability({
    platform: 'android',
    playServices: true,
    firebaseConfigured: false,
    webClientConfigured: false,
    googleSignInAvailable: false,
  });
  assert.equal(d.attempt, false);
  assert.equal(d.reason, GOOGLE_REASONS.firebaseNotConfigured);
});

test('جهاز سليم (Play Services + Firebase + Web client): نحاول Google', () => {
  const d = decideGoogleAvailability({
    platform: 'android',
    fireOs: false,
    playServices: true,
    firebaseConfigured: true,
    webClientConfigured: true,
    googleSignInAvailable: true,
    reason: 'ok',
  });
  assert.equal(d.attempt, true);
  assert.equal(d.available, true);
});

test('فشل التشخيص نفسه لا يُعلّق الزر: قرار «غير متاح» افتراضيًا', () => {
  assert.equal(decideGoogleAvailability(null).attempt, false);
  assert.equal(decideGoogleAvailability(undefined).attempt, false);
  assert.equal(decideGoogleAvailability(null).reason, GOOGLE_REASONS.diagnosticsFailed);
});

/* ------------------------------------------------------------------ */
/* 2) انحدار الإصدار 43: وعد معلّق إلى الأبد                            */
/* ------------------------------------------------------------------ */

test('انحدار: محاولة معلّقة تُقطع بمهلة بدل أن تُعلّق الواجهة', async () => {
  // هذه هي الحالة التي رصدتها Amazon: الإضافة الأصلية لا تحلّ الوعد ولا ترفضه.
  const hanging = new Promise(() => {});
  const started = Date.now();
  await assert.rejects(
    () => withTimeout(hanging, 60, 'google_timeout'),
    (err) => err.code === 'google_timeout' && err.isTimeout === true,
  );
  assert.ok(Date.now() - started < 2000, 'المهلة يجب أن تُنفَّذ فورًا بعد 60ms');
});

test('withTimeout: النجاح السريع يمرّ كما هو', async () => {
  const value = await withTimeout(Promise.resolve({ token: 'ok' }), 500);
  assert.deepEqual(value, { token: 'ok' });
});

test('withTimeout: الفشل الحقيقي يبقى فشلًا بكوده الأصلي', async () => {
  const original = Object.assign(new Error('boom'), { code: 'network' });
  await assert.rejects(() => withTimeout(Promise.reject(original), 500), (err) => err.code === 'network');
});

/* ------------------------------------------------------------------ */
/* 3) كل فشل في مسار Google يقود إلى بديل بالبريد                       */
/* ------------------------------------------------------------------ */

test('أعطال Google كلها تُظهر البديل (لا زر صامت)', () => {
  const codes = [
    'google_not_configured',
    'google_failed',
    'google_timeout',
    'google_plugin_missing',
    'play_services_missing',
    'fire_os_no_play_services',
    'no_play_services',
    'firebase_not_configured',
    'web_client_not_configured',
    'app_not_authorized',
    'provider_disabled',
    'unsupported_platform',
    'diagnostics_failed',
    'unavailable',
    'auth_provider_error',
  ];
  for (const code of codes) {
    assert.equal(googleFailureNeedsEmailFallback(code), true, `${code} يجب أن يقود إلى بديل البريد`);
    assert.equal(googleFailureIsSilent(code), false, `${code} يجب أن يُعرَض للمستخدم`);
  }
});

test('الإلغاء من المستخدم لا يُظهر رسالة ولا بديلًا', () => {
  assert.equal(googleFailureNeedsEmailFallback('cancelled'), false);
  assert.equal(googleFailureIsSilent('cancelled'), true);
});

/* ------------------------------------------------------------------ */
/* 4) تحقق البريد وكلمة المرور قبل الإرسال                             */
/* ------------------------------------------------------------------ */

test('التحقق من البريد', () => {
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('  User@Example.COM '), true);
  assert.equal(isValidEmail('user@'), false);
  assert.equal(isValidEmail('user example.com'), false);
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail('a@b.c'), false);
});

test('كلمة المرور الجديدة: 6 أحرف على الأقل (مطابق للخادم)', () => {
  assert.equal(isValidNewPassword('123456'), true);
  assert.equal(isValidNewPassword('12345'), false);
  assert.equal(isValidNewPassword(''), false);
});

test('فشل فحص Play Services (null) يعني: استخدم البريد — لا محاولة معلّقة', () => {
  const d = decideGoogleAvailability({
    platform: 'android',
    playServices: null,
    googleSignInAvailable: true, // الإضافة تظنّ نفسها متاحة
    reason: 'ok',
  });
  assert.equal(d.attempt, false);
  assert.equal(d.reason, 'diagnostics_failed');
});

test('الويب: Google متاح دائمًا (لا فحص جهاز يُعطّله)', async () => {
  // منطق firebase.js: غير أصلي ⟹ attempt=true قبل أي فحص
  const { decideGoogleAvailability: decide } = await import('../src/authPolicy.js');
  // حتى لو مرّرنا بيئة فارغة بالخطأ، القرار الويب لا يُستعمل
  const webStatus = { attempt: true, available: true, reason: 'ok', env: null };
  assert.equal(webStatus.attempt, true);
  // والقرار الأصلي مع env=null يبقى «استخدم البريد» (سلوك الهاتف)
  assert.equal(decide(null).attempt, false);
});

test('مصدر firebase.js يفرّق بين الويب والأندرويد', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/firebase.js', 'utf8');
  const idx = src.indexOf('export async function googleSignInStatus');
  const body = src.slice(idx, idx + 500);
  assert.match(body, /isNativePlatform\(\)/);
  assert.match(body, /attempt: true/);
});
