package com.ahmedbecetti.nexora.kt

import android.graphics.Color as AColor
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.Coil
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.I18n
import com.ahmedbecetti.nexora.kt.ui.theme.NexoraTheme

class MainActivity : ComponentActivity() {
    lateinit var app: AppState
        private set

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Api.init(applicationContext)
        I18n.init(applicationContext)
        com.ahmedbecetti.nexora.kt.call.CallEngine.init(applicationContext)
        com.google.android.gms.ads.MobileAds.initialize(applicationContext)
        com.ahmedbecetti.nexora.kt.call.CallEngine.startLoop()
        Coil.setImageLoader(
            ImageLoader.Builder(applicationContext)
                .okHttpClient(Api.http)
                .memoryCache { MemoryCache.Builder(applicationContext).maxSizePercent(0.2).build() }
                .diskCache { DiskCache.Builder().directory(cacheDir.resolve("img")).maxSizeBytes(150L * 1024 * 1024).build() }
                .crossfade(true)
                .components {
                    add(coil.decode.SvgDecoder.Factory())
                    add(coil.decode.ImageDecoderDecoder.Factory())
                }
                .build()
        )
        val app = AppState(applicationContext)
        this.app = app
        app.start()
        setContent {
            val dark = when (app.themeMode) { "dark" -> true; "light" -> false; else -> isSystemInDarkTheme() }
            LaunchedEffect(dark) {
                enableEdgeToEdge(
                    statusBarStyle = if (dark) SystemBarStyle.dark(AColor.TRANSPARENT) else SystemBarStyle.light(AColor.TRANSPARENT, AColor.TRANSPARENT),
                    navigationBarStyle = if (dark) SystemBarStyle.dark(AColor.TRANSPARENT) else SystemBarStyle.light(AColor.TRANSPARENT, AColor.TRANSPARENT),
                )
            }
            key(app.langVersion) {
                CompositionLocalProvider(
                    LocalApp provides app,
                    LocalLayoutDirection provides if (I18n.rtl) LayoutDirection.Rtl else LayoutDirection.Ltr,
                ) {
                    NexoraTheme(app.themeMode) { NexoraApp() }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        com.ahmedbecetti.nexora.kt.ui.screens.Usage.resume()
        com.ahmedbecetti.nexora.kt.call.CallEngine.foreground = true
    }

    override fun onPause() {
        com.ahmedbecetti.nexora.kt.ui.screens.Usage.pause()
        com.ahmedbecetti.nexora.kt.call.CallEngine.foreground = false
        super.onPause()
    }
}
