package com.ahmedbecetti.nexora.kt

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.t

/** Keeps the microphone/camera alive while a call runs and the user leaves the app (ongoing notification). */
class CallService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val video = intent?.getBooleanExtra("video", false) == true
        CallNotify.channels(this)
        val n = NotificationCompat.Builder(this, CallNotify.ONGOING)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle("Nexora")
            .setContentText(t(if (video) "ckCallPreviewVideo" else "ckCallPreviewAudio"))
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setContentIntent(CallNotify.openApp(this))
            .build()
        var type = 0
        if (Build.VERSION.SDK_INT >= 30) {
            if (granted(Manifest.permission.RECORD_AUDIO)) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            if (video && granted(Manifest.permission.CAMERA)) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
        }
        try {
            ServiceCompat.startForeground(this, 41, n, type)
        } catch (_: Exception) { stopSelf() }
        return START_NOT_STICKY
    }

    private fun granted(p: String) = ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

    companion object {
        fun start(ctx: Context, video: Boolean) {
            try { ContextCompat.startForegroundService(ctx, Intent(ctx, CallService::class.java).putExtra("video", video)) } catch (_: Exception) {}
        }
        fun stop(ctx: Context) { try { ctx.stopService(Intent(ctx, CallService::class.java)) } catch (_: Exception) {} }
    }
}

/** Incoming-call heads-up notification (shown when the app is in the background while it still listens). */
object CallNotify {
    const val ONGOING = "nx_call_ongoing"
    const val INCOMING = "nx_call_incoming"
    private const val ID = 42

    fun channels(ctx: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(NotificationChannel(ONGOING, t("ckCallInCall"), NotificationManager.IMPORTANCE_LOW))
        nm.createNotificationChannel(NotificationChannel(INCOMING, t("ckCallInAudio"), NotificationManager.IMPORTANCE_HIGH).apply {
            setSound(null, null); enableVibration(false); lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        })
    }

    fun openApp(ctx: Context): PendingIntent = PendingIntent.getActivity(ctx, 0,
        Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun incoming(ctx: Context, from: User, video: Boolean) {
        if (com.ahmedbecetti.nexora.kt.call.CallEngine.foreground) return
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        channels(ctx)
        val pi = openApp(ctx)
        val n = NotificationCompat.Builder(ctx, INCOMING)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle(from.fullName?.takeIf { it.isNotBlank() } ?: from.username)
            .setContentText(t(if (video) "ckCallInVideo" else "ckCallInAudio"))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setTimeoutAfter(45_000)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
            .build()
        try { ctx.getSystemService(NotificationManager::class.java)?.notify(ID, n) } catch (_: Exception) {}
    }

    fun cancel(ctx: Context) { try { ctx.getSystemService(NotificationManager::class.java)?.cancel(ID) } catch (_: Exception) {} }
}
