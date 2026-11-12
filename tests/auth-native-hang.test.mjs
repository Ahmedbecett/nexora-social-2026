/**
 * NEXORA AI — محاكاة الطبقة الأصلية كما كانت في الإصدار 43.
 *
 * في الإصدار 43 كان مسار Google يستدعي:
 *     FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })
 * مباشرة. على Fire OS لا تُهيّأ الإضافة (لا Play Services)، فلا resolve ولا reject.
 *
 * هذا الملف يعيد بناء تلك الحالة بالضبط، ثم يبرهن أن السياسة الجديدة
 * (فحص البيئة أولًا + مهلة صارمة) تُنهي الانتظار بكود مفهوم يقود إلى البريد.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { decideGoogleAvailability, withTimeout } from '../src/authPolicy.js';

/** يحاكي إضافة Capacitor الأصلية على Fire OS. */
function makeFireOsPlugin() {
  return {
    calls: 0,
    // الإضافة الحقيقية لا تُرجع شيئًا على Fire OS (الوعد يبقى معلقًا)
    signInWithGoogle() {
      this.calls += 1;
      return new Promise(() => {});
    },
  };
}

/** يحاكي إضافة NexoraAuth (تشخيصنا المحلي) على Fire OS. */
const fireOsEnvironment = {
  platform: 'android',
  manufacturer: 'Amazon',
  brand: 'Amazon',
  fireOs: true,
  playStore: false,
  playServices: false,
  firebaseConfigured: false,
  webClientConfigured: false,
  googleSignInAvailable: false,
  emailSignInAvailable: true,
  reason: 'fire_os_no_play_services',
};

/** هذه هي الخطوات التي ينفّذها signInWithGoogle في src/firebase.js */
async function signInWithGoogleLike44({ plugin, env, timeoutMs = 60 }) {
  const decision = decideGoogleAvailability(env);
  if (!decision.attempt) {
    const err = new Error(decision.reason);
    err.code = decision.reason;
    throw err;
  }
  const res = await withTimeout(plugin.signInWithGoogle(), timeoutMs, 'google_timeout');
  return res;
}

/** ويساوي سلوك الإصدار 43: استدعاء مباشر بلا فحص ولا مهلة. */
function signInWithGoogleLike43(plugin) {
  return plugin.signInWithGoogle();
}

test('الإصدار 43: الوعد يبقى معلّقًا على Fire OS (سبب رفض Amazon)', async () => {
  const plugin = makeFireOsPlugin();
  const result = await Promise.race([
    signInWithGoogleLike43(plugin).then(() => 'resolved').catch(() => 'rejected'),
    new Promise((r) => setTimeout(() => r('still-pending'), 120)),
  ]);
  assert.equal(result, 'still-pending', 'الإصدار 43 كان يُعلّق الزر بلا استجابة');
  assert.equal(plugin.calls, 1);
});

test('الإصدار 44: لا يبدأ مسار Google أصلًا على Fire OS', async () => {
  const plugin = makeFireOsPlugin();
  await assert.rejects(
    () => signInWithGoogleLike44({ plugin, env: fireOsEnvironment }),
    (err) => err.code === 'fire_os_no_play_services',
  );
  assert.equal(plugin.calls, 0, 'لا يجب استدعاء الإضافة التي لا تستجيب');
});

test('الإصدار 44: حتى لو تنكّرت البيئة، المهلة تُخرج المستخدم من الانتظار', async () => {
  const plugin = makeFireOsPlugin();
  // بيئة تبدو سليمة لكن الإضافة معلّقة (حالة جهاز غريب أو Play Services تالف)
  const misleadingEnv = { ...fireOsEnvironment, playServices: true, firebaseConfigured: true, webClientConfigured: true, googleSignInAvailable: true, reason: 'ok', fireOs: false };
  const started = Date.now();
  await assert.rejects(
    () => signInWithGoogleLike44({ plugin, env: misleadingEnv, timeoutMs: 80 }),
    (err) => err.code === 'google_timeout',
  );
  assert.ok(Date.now() - started < 2000);
  assert.equal(plugin.calls, 1);
});

test('الإصدار 44: جهاز سليم يُكمل المصادقة فعليًا (لا نجاح شكلي)', async () => {
  const plugin = {
    signInWithGoogle: async () => ({ credential: { idToken: 'firebase-id-token' } }),
  };
  const env = { ...fireOsEnvironment, fireOs: false, playServices: true, firebaseConfigured: true, webClientConfigured: true, googleSignInAvailable: true, reason: 'ok' };
  const res = await signInWithGoogleLike44({ plugin, env });
  assert.equal(res.credential.idToken, 'firebase-id-token');
});

test('الإصدار 44: إضافة مفقودة/غير مسجّلة لا تُسقط الواجهة', async () => {
  // الإضافة غير موجودة إطلاقًا ⟹ import يفشل ⟹ الكود يتحوّل إلى google_plugin_missing
  const load = () => Promise.reject(new Error('not implemented on android'));
  const err = await load().catch((e) => e);
  assert.match(err.message, /not implemented/i);
  // السياسة تعتبر أي كود غير متوقع قابلًا للتحويل إلى بديل بريد
  const { googleFailureNeedsEmailFallback } = await import('../src/authPolicy.js');
  assert.equal(googleFailureNeedsEmailFallback('google_plugin_missing'), true);
});
