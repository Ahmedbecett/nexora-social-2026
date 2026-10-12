package com.ahmedbecetti.nexora.kt.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.ahmedbecetti.nexora.kt.BuildConfig
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView

/** Live AdMob banner in production; Google's documented test unit is used in debug builds. */
@Composable
fun NexoraBannerAd(modifier: Modifier = Modifier) {
    if (BuildConfig.DEBUG) return
    AndroidView(modifier = modifier, factory = { context ->
        AdView(context).apply {
            adUnitId = if (BuildConfig.DEBUG) "ca-app-pub-3940256099942544/6300978111" else BuildConfig.ADMOB_BANNER
            setAdSize(AdSize.BANNER)
            loadAd(AdRequest.Builder().build())
        }
    }, update = { })
}
