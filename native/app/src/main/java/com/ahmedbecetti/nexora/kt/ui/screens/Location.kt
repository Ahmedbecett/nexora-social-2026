package com.ahmedbecetti.nexora.kt.ui.screens

import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/** Obtain a fresh device location (cache <= 3 min, otherwise one live fix); no synthetic coordinates. */
suspend fun currentLocation(context: Context): Location {
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val providers = lm.getProviders(true).filter { it == LocationManager.GPS_PROVIDER || it == LocationManager.NETWORK_PROVIDER }
    val cached = providers.mapNotNull { try { lm.getLastKnownLocation(it) } catch (_: SecurityException) { null } }
        .filter { System.currentTimeMillis() - it.time < 180_000 }.maxByOrNull { it.time }
    if (cached != null) return cached
    val fix = withTimeoutOrNull(20_000) {
        suspendCancellableCoroutine<Location?> { cont ->
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) { try { lm.removeUpdates(this) } catch (_: Exception) {}; if (cont.isActive) cont.resume(location) }
                @Deprecated("Deprecated") override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }
            try {
                providers.forEach { lm.requestLocationUpdates(it, 500L, 0f, listener, Looper.getMainLooper()) }
            } catch (e: SecurityException) { if (cont.isActive) cont.resume(null) }
            cont.invokeOnCancellation { try { lm.removeUpdates(listener) } catch (_: Exception) {} }
        }
    }
    if (fix != null) return fix
    throw IllegalStateException("location_unavailable")
}
