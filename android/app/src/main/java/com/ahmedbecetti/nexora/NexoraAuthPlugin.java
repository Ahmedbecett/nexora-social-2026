package com.ahmedbecetti.nexora;

import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.os.Build;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/**
 * NEXORA AI — تشخيص بيئة تسجيل الدخول داخل التطبيق (Android / Fire OS).
 *
 * <p>لماذا هذه الإضافة موجودة؟ لأن إضافة Firebase Authentication (capacitor-firebase/authentication)
 * تُحمَّل كسولًا: عندما لا يوجد {@code google-services.json} داخل الحزمة، أو عندما لا تتوفّر
 * Google Play Services على جهاز Fire OS، يفشل تحميل الإضافة على مستوى Java دون أن تُبلغ JavaScript،
 * فيبقى وعد {@code signInWithGoogle()} معلّقًا إلى الأبد ويظهر للمستخدم زر لا يستجيب —
 * وهو بالضبط ما رصدته مراجعة Amazon Appstore.</p>
 *
 * <p>هذه الإضافة لا تعتمد على أي مكتبة Firebase أو Play Services في زمن الترجمة:
 * كل الفحوص تُنفَّذ بالانعكاس (reflection) داخل try/catch، فلا يمكن أن تُسقط التطبيق
 * ولا أن تمنع الإقلاع، ولا تُهيّئ Firebase (FirebaseAuth.getInstance() غير مستدعاة أبدًا).</p>
 */
@CapacitorPlugin(name = "NexoraAuth")
public class NexoraAuthPlugin extends Plugin {

    private static final String TAG = "NexoraAuth";
    private static final int PLAY_SERVICES_SUCCESS = 0;

    /**
     * يعيد وصفًا كاملًا لبيئة المصادقة على الجهاز.
     * كل الحقول منطقية/نصية، ولا يُرفض الوعد إلا في حالة استثناء غير متوقّع (وهذا لا يحدث عمليًا).
     */
    @PluginMethod
    public void getAuthEnvironment(PluginCall call) {
        JSObject result = new JSObject();
        try {
            Context context = getContext();

            Boolean playServices = playServicesAvailable(context);
            Boolean firebaseReady = firebaseAppInitialized(context);
            Boolean webClient = webClientIdConfigured(context);
            Boolean fireOs = isFireOs(context);
            Boolean hasPlayStore = isPackageInstalled(context, "com.android.vending");

            boolean googleUsable =
                Boolean.TRUE.equals(playServices)
                    && Boolean.TRUE.equals(firebaseReady)
                    && Boolean.TRUE.equals(webClient);

            result.put("platform", "android");
            result.put("manufacturer", safeString(Build.MANUFACTURER));
            result.put("brand", safeString(Build.BRAND));
            result.put("model", safeString(Build.MODEL));
            result.put("sdkInt", Build.VERSION.SDK_INT);
            // true = Fire OS / Amazon device (لا يوجد عادةً Google Play Services)
            result.put("fireOs", Boolean.TRUE.equals(fireOs));
            result.put("playStore", Boolean.TRUE.equals(hasPlayStore));
            // null = تعذّر الفحص (لا نعتبره فشلًا)
            result.put("playServices", (playServices == null) ? JSONObject.NULL : (Object) playServices);
            result.put("firebaseConfigured", Boolean.TRUE.equals(firebaseReady));
            result.put("webClientConfigured", Boolean.TRUE.equals(webClient));
            result.put("googleSignInAvailable", googleUsable);
            // الدخول بالبريد وكلمة المرور يعمل عبر خادم NEXORA ولا يحتاج أي خدمة Google
            result.put("emailSignInAvailable", true);
            result.put("reason", googleUsable ? "ok" : googleReason(playServices, firebaseReady, webClient, fireOs));

            call.resolve(result);
        } catch (Throwable error) {
            // لا نُفشل الوعد أبدًا: الأسوأ أن نُعيد "غير متاح" بدل تعليق الواجهة
            Log.w(TAG, "getAuthEnvironment failed, reporting unavailable", error);
            JSObject fallback = new JSObject();
            fallback.put("platform", "android");
            fallback.put("fireOs", false);
            fallback.put("playServices", JSONObject.NULL);
            fallback.put("firebaseConfigured", false);
            fallback.put("webClientConfigured", false);
            fallback.put("googleSignInAvailable", false);
            fallback.put("emailSignInAvailable", true);
            fallback.put("reason", "diagnostics_failed");
            call.resolve(fallback);
        }
    }

    private String googleReason(Boolean playServices, Boolean firebaseReady, Boolean webClient, Boolean fireOs) {
        if (playServices == null) return "diagnostics_failed";
        if (!Boolean.TRUE.equals(playServices)) {
            return Boolean.TRUE.equals(fireOs) ? "fire_os_no_play_services" : "no_play_services";
        }
        if (!Boolean.TRUE.equals(firebaseReady)) return "firebase_not_configured";
        if (!Boolean.TRUE.equals(webClient)) return "web_client_not_configured";
        return "unavailable";
    }

    /** فحص Play Services بالانعكاس — أو null إذا تعذّر الفحص. */
    private Boolean playServicesAvailable(Context context) {
        try {
            Class<?> availabilityClass = Class.forName("com.google.android.gms.common.GoogleApiAvailability");
            Object availability = availabilityClass.getMethod("getInstance").invoke(null);
            Object code = availabilityClass
                .getMethod("isGooglePlayServicesAvailable", Context.class)
                .invoke(availability, context);
            if (code instanceof Integer) {
                return ((Integer) code) == PLAY_SERVICES_SUCCESS;
            }
            return null;
        } catch (Throwable ignored) {
            // الصنف غير موجود على Fire OS، أو المكتبة غير مضمّنة
            return null;
        }
    }

    /** هل تمّت تهيئة FirebaseApp لهذه العملية؟ (بدون استدعاء FirebaseAuth أو أي تهيئة جديدة) */
    private Boolean firebaseAppInitialized(Context context) {
        try {
            Class<?> appClass = Class.forName("com.google.firebase.FirebaseApp");
            Object apps;
            try {
                apps = appClass.getMethod("getApps", Context.class).invoke(null, context);
            } catch (NoSuchMethodException missingNoArg) {
                apps = appClass.getMethod("getApps").invoke(null);
            }
            if (apps instanceof java.util.List) {
                return !((java.util.List<?>) apps).isEmpty();
            }
            return false;
        } catch (Throwable ignored) {
            return false;
        }
    }

    /** هل يوجد Web OAuth client حقيقي في الموارد (وليس القيمة النائبة)؟ */
    private Boolean webClientIdConfigured(Context context) {
        try {
            Resources resources = context.getResources();
            int id = resources.getIdentifier("default_web_client_id", "string", context.getPackageName());
            if (id == 0) return false;
            String value = resources.getString(id);
            if (value == null) return false;
            String trimmed = value.trim();
            return !trimmed.isEmpty()
                && !"WILL_BE_OVERRIDDEN".equals(trimmed)
                && trimmed.endsWith(".apps.googleusercontent.com");
        } catch (Throwable ignored) {
            return false;
        }
    }

    /** Fire OS: أجهزة Amazon لا تتضمّن Google Play Services في العادة. */
    private Boolean isFireOs(Context context) {
        try {
            String manufacturer = safeString(Build.MANUFACTURER).toLowerCase();
            String brand = safeString(Build.BRAND).toLowerCase();
            if (manufacturer.contains("amazon") || brand.contains("amazon")) return true;

            PackageManager pm = context.getPackageManager();
            String[] amazonFeatures = new String[] {
                "amazon.hardware.fire_tv",
                "amazon.hardware.kindle",
                "com.amazon.hardware.firetv",
                "com.amazon.hardware.firetvc",
            };
            for (String feature : amazonFeatures) {
                if (pm.hasSystemFeature(feature)) return true;
            }
            if (isPackageInstalled(context, "com.amazon.device.software.ota")) return true;
            if (isPackageInstalled(context, "com.amazon.kindle.kso")) return true;
            return false;
        } catch (Throwable ignored) {
            return false;
        }
    }

    private boolean isPackageInstalled(Context context, String packageName) {
        try {
            context.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    private static String safeString(String value) {
        return value == null ? "" : value;
    }
}
