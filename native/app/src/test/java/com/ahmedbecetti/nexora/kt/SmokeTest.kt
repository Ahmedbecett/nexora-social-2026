package com.ahmedbecetti.nexora.kt

import android.graphics.Bitmap
import android.os.Looper
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.captureToImage
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import android.content.Context
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.io.FileOutputStream
import java.time.Duration

/**
 * Not a unit test in the strict sense: boots the real app against the production API with the
 * test account (token from env NX_TOKEN), walks through every Round-1 screen and saves screenshots
 * to /tmp/shots. Any crash during composition fails the test.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class SmokeTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val out = File(System.getenv("NX_SHOTS") ?: "/tmp/shots").apply { mkdirs() }

    private fun pump(ms: Long) {
        rule.mainClock.autoAdvance = false
        var t = 0L
        while (t < ms) {
            Thread.sleep(100)
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(100))
            rule.mainClock.advanceTimeBy(100)
            t += 100
        }
    }

    private var scn: ActivityScenario<MainActivity>? = null
    private fun shot(name: String) {
        var bmp: Bitmap? = null
        scn!!.onActivity { a ->
            val v = a.window.decorView
            val b = Bitmap.createBitmap(v.width, v.height, Bitmap.Config.ARGB_8888)
            v.draw(android.graphics.Canvas(b))
            bmp = b
        }
        FileOutputStream(File(out, "$name.png")).use { bmp!!.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("SHOT $name")
    }

    private fun step(name: String, wait: Long = 6000, block: (AppState) -> Unit, sc: ActivityScenario<MainActivity>) {
        try {
            sc.onActivity { block(it.app) }
            pump(wait)
            shot(name)
        } catch (e: Throwable) {
            println("FAIL $name: $e"); throw e
        }
    }

    @Test fun walk() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val theme = System.getenv("NX_THEME") ?: "light"
        val prefs = ctx.getSharedPreferences("nexora", Context.MODE_PRIVATE).edit()
        prefs.putString("theme", theme)
        System.getenv("NX_LANG")?.let { prefs.putString("lang", it) }
        val tok = System.getenv("NX_TOKEN")
        if (System.getenv("NX_LOGIN") == "1" || tok == null) prefs.remove("token") else prefs.putString("token", tok)
        prefs.commit()
        val sc = ActivityScenario.launch(MainActivity::class.java)
        scn = sc
        pump(5000)
        if (tok == null || System.getenv("NX_LOGIN") == "1") { shot("${theme}_00_login"); return }
        shot("${theme}_01_home")
        if (System.getenv("NX_SHORT") == "1") {
            step("${theme}_02_reels", 9000, { it.selectTab(Tab.Reels) }, sc)
            step("${theme}_04_profile", 7000, { it.selectTab(Tab.Profile) }, sc)
            step("${theme}_10_editprofile", 3000, { it.push(Route.EditProfile) }, sc)
            step("${theme}_09_post", 9000, { it.pop(); it.push(Route.PostDetail("19")) }, sc)
            sc.close(); return
        }
        step("${theme}_02_reels", 9000, { it.selectTab(Tab.Reels) }, sc)
        step("${theme}_03_search", 7000, { it.selectTab(Tab.Search) }, sc)
        step("${theme}_04_profile", 7000, { it.selectTab(Tab.Profile) }, sc)
        step("${theme}_05_inbox", 6000, { it.push(Route.Inbox) }, sc)
        step("${theme}_06_notifs", 6000, { it.pop(); it.push(Route.Notifications) }, sc)
        step("${theme}_07_settings", 3000, { it.pop(); it.push(Route.Settings) }, sc)
        step("${theme}_07b_privacy", 5000, { it.push(Route.SettingsPage("privacy")) }, sc)
        step("${theme}_07c_notifset", 5000, { it.pop(); it.push(Route.SettingsPage("notif")) }, sc)
        step("${theme}_07d_about", 2000, { it.pop(); it.push(Route.SettingsPage("about")) }, sc)
        val img = File(ctx.cacheDir, "test.jpg")
        val b = Bitmap.createBitmap(600, 400, Bitmap.Config.ARGB_8888); b.eraseColor(0xFF3366CC.toInt())
        FileOutputStream(img).use { b.compress(Bitmap.CompressFormat.JPEG, 90, it) }
        step("${theme}_12_create", 3000, { it.pop(); it.pop(); it.push(Route.Create(listOf(android.net.Uri.fromFile(img)), false)) }, sc)
        step("${theme}_13_newhighlight", 5000, { it.pop(); it.push(Route.NewHighlight) }, sc)
        step("${theme}_14_discover", 6000, { it.pop(); it.push(Route.Discover) }, sc)
        sc.onActivity { it.app.pop() }
        step("${theme}_08_otherprofile", 7000, { it.pop(); it.openProfile("ahmedbecetti") }, sc)
        step("${theme}_09_post", 7000, { it.push(Route.PostDetail("19")) }, sc)
        step("${theme}_10_editprofile", 3000, { it.pop(); it.pop(); it.push(Route.EditProfile) }, sc)
        step("${theme}_11_chat", 7000, { a -> a.pop(); a.push(Route.Chat(com.ahmedbecetti.nexora.kt.data.User(id = 19, username = "ahmedbecetti", fullName = "Nexora official"))) }, sc)
        sc.close()
    }
}
