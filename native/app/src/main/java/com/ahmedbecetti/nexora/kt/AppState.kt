package com.ahmedbecetti.nexora.kt

import android.content.Context
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.ApiException
import com.ahmedbecetti.nexora.kt.data.I18n
import com.ahmedbecetti.nexora.kt.data.Post
import com.ahmedbecetti.nexora.kt.data.StoryGroup
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.json
import com.ahmedbecetti.nexora.kt.data.mapObj
import com.ahmedbecetti.nexora.kt.data.Upload
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class Tab { Home, Reels, Messages, Search, Profile }

/** An account saved on this device (real multi-account like IG). token == null → must log in again. */
data class SavedAccount(val id: Long, val username: String, val avatarUrl: String?, val token: String?)

sealed interface Route {
    data class Profile(val username: String) : Route
    data class PostDetail(val id: String, val initial: Post? = null) : Route
    data class ReelsAt(val posts: List<Post>, val start: Int) : Route
    data class FollowList(val username: String, val kind: String) : Route
    data class Likes(val postId: String) : Route
    data object Notifications : Route
    data object FollowRequests : Route
    data object Settings : Route
    data object EditProfile : Route
    data object Language : Route
    data object Saved : Route
    data class Chat(val user: User) : Route
    data class Stories(val groups: List<StoryGroup>, val start: Int) : Route
    data class Tag(val tag: String) : Route
    data object Inbox : Route
    data object MessageRequests : Route
    data object Spam : Route
    data object Discover : Route
    data object NewHighlight : Route
    data class Create(val uris: List<android.net.Uri>, val reel: Boolean) : Route
    data class SettingsPage(val key: String) : Route
}

/** App-wide state: session, navigation stack, tab, badges and per-tab caches. */
@Stable
class AppState(val ctx: Context) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    var me by mutableStateOf<User?>(null)
    var booting by mutableStateOf(Api.token != null)
    var tab by mutableStateOf(Tab.Home)
    val stack = mutableStateListOf<Route>()
    var themeMode by mutableStateOf(Api.pref("theme", "system") ?: "system")
    var langVersion by mutableIntStateOf(0)
    var notifBadge by mutableIntStateOf(0)
    var msgBadge by mutableIntStateOf(0)
    var requestBadge by mutableIntStateOf(0)
    var reelsMuted by mutableStateOf(false)
    /** Bumped when the user taps the current tab again (scroll to top / refresh). */
    var tabReselect by mutableIntStateOf(0)
    /** Bumped after actions that should refresh the own profile (follow, edit...). */
    var profileVersion by mutableIntStateOf(0)
    /** Bumped after creating a post / story so the feed reloads. */
    var feedVersion by mutableIntStateOf(0)
    /** Story tray shared by the feed, post headers and profiles (rings). */
    var storyTray by mutableStateOf<List<StoryGroup>>(emptyList())
    fun storyOf(userId: Long): StoryGroup? = storyTray.firstOrNull { it.user.id == userId && it.stories.isNotEmpty() }
    /** Progress (0..1) of a background story upload, or null. Shown as a thin bar on the home screen. */
    var uploading by mutableStateOf<Float?>(null)
    fun addStory(uri: android.net.Uri) {
        if (uploading != null) return
        uploading = 0f
        scope.launch {
            try {
                val r = Upload.media(ctx, uri) { p -> scope.launch { uploading = p * 0.95f } }
                Api.post("stories", json("url" to r.url, "type" to r.type))
                loadStories(); toast(ctx, t("posted"))
            } catch (e: Exception) { errToast(e) } finally { uploading = null }
        }
    }
    suspend fun loadStories() {
        try { storyTray = Api.get("stories").optJSONArray("tray").mapObj { StoryGroup.from(it) } } catch (_: Exception) {}
    }

    /* ---------------- accounts on this device ---------------- */
    var accounts by mutableStateOf(loadAccounts())
        private set
    /** Per-account unread counts for the switcher: id -> (notifications, messages). */
    var accountBadges by mutableStateOf<Map<Long, Pair<Int, Int>>>(emptyMap())
    /** When true the auth screen opens directly on the login form ("Add account"). */
    var authStart by mutableStateOf<String?>(null)

    private fun loadAccounts(): List<SavedAccount> = try {
        val arr = org.json.JSONArray(Api.pref("accounts", "[]"))
        (0 until arr.length()).mapNotNull { i ->
            arr.optJSONObject(i)?.let { o -> SavedAccount(o.optLong("id"), o.optString("username"), o.optString("avatarUrl").ifEmpty { null }, o.optString("token").ifEmpty { null }) }
        }
    } catch (_: Exception) { emptyList() }

    private fun storeAccounts(list: List<SavedAccount>) {
        accounts = list
        val arr = org.json.JSONArray()
        list.forEach { a -> arr.put(json("id" to a.id, "username" to a.username, "avatarUrl" to a.avatarUrl, "token" to a.token)) }
        Api.setPref("accounts", arr.toString())
    }

    /** Remember / refresh the signed-in account (username, photo and token). */
    private fun rememberCurrent() {
        val u = me ?: return
        val tok = Api.token ?: return
        val rest = accounts.filter { it.id != u.id }
        storeAccounts(listOf(SavedAccount(u.id, u.username, u.avatarUrl, tok)) + rest)
    }

    fun switchTo(a: SavedAccount) {
        if (a.token == null || a.id == me?.id) return
        rememberCurrent()
        Api.setToken(a.token)
        booting = true; stack.clear(); tab = Tab.Home; storyTray = emptyList()
        scope.launch {
            try {
                me = User.from(Api.get("me").optJSONObject("user")); rememberCurrent()
                feedVersion++; profileVersion++
                refreshBadges(); loadStories()
            } catch (e: ApiException) {
                if (e.status == 401) { forgetToken(a.id); me = null; Api.setToken(null) } else errToast(e)
            } finally { booting = false }
        }
    }

    fun addAccount() { rememberCurrent(); Api.setToken(null); me = null; stack.clear(); tab = Tab.Home; authStart = "login" }

    fun removeAccount(id: Long) { storeAccounts(accounts.filter { it.id != id }) }
    private fun forgetToken(id: Long) { storeAccounts(accounts.map { if (it.id == id) it.copy(token = null) else it }) }

    suspend fun refreshAccountBadges() {
        val out = HashMap<Long, Pair<Int, Int>>()
        for (a in accounts) {
            val tok = a.token ?: continue
            if (a.id == me?.id) { out[a.id] = notifBadge to msgBadge; continue }
            try { val b = Api.getAs(tok, "me/badges"); out[a.id] = b.optInt("notifications") to b.optInt("messages") } catch (_: Exception) {}
        }
        accountBadges = out
    }

    fun push(r: Route) { stack.add(r) }
    fun pop(): Boolean { if (stack.isEmpty()) return false; stack.removeAt(stack.lastIndex); return true }
    fun openProfile(username: String) {
        if (username == me?.username && stack.isEmpty()) { tab = Tab.Profile; return }
        push(Route.Profile(username))
    }
    fun selectTab(t: Tab) {
        if (stack.isNotEmpty()) stack.clear()
        if (tab == t) tabReselect++ else tab = t
    }

    fun setTheme(m: String) { themeMode = m; Api.setPref("theme", m) }
    fun setLanguage(l: String) { Api.setPref("lang", l); I18n.setLang(ctx, l); langVersion++ }

    fun start() {
        if (Api.token == null) { booting = false; return }
        scope.launch {
            try {
                me = com.ahmedbecetti.nexora.kt.data.User.from(Api.get("me").optJSONObject("user"))
                rememberCurrent()
            } catch (e: ApiException) {
                if (e.status == 401) logout(local = true)
            } finally { booting = false }
        }
        scope.launch {
            Api.unauthorized.collect { if (it) { Api.unauthorized.value = false; logout(local = true); toast(ctx, I18n.err("session_expired")) } }
        }
        scope.launch {
            while (isActive) {
                if (me != null) refreshBadges()
                delay(20_000)
            }
        }
    }

    suspend fun refreshBadges() {
        try {
            val b = Api.get("me/badges")
            notifBadge = b.optInt("notifications"); msgBadge = b.optInt("messages"); requestBadge = b.optInt("requests")
        } catch (_: Exception) {}
    }

    fun onLoggedIn(token: String, user: User?) {
        Api.setToken(token); me = user; tab = Tab.Home; stack.clear(); authStart = null
        rememberCurrent()
        feedVersion++; profileVersion++
        scope.launch { if (me == null) try { me = User.from(Api.get("me").optJSONObject("user")) } catch (_: Exception) {}; rememberCurrent(); refreshBadges(); loadStories() }
    }

    fun logoutAll() {
        storeAccounts(accounts.map { it.copy(token = null) })
        logout(local = true)
    }

    fun logout(local: Boolean = false) {
        me?.id?.let { forgetToken(it) }
        Api.setToken(null); me = null; stack.clear(); tab = Tab.Home; storyTray = emptyList()
        notifBadge = 0; msgBadge = 0; requestBadge = 0
        // like IG: if another account on this device is still signed in, continue with it
        if (!local) accounts.firstOrNull { it.token != null }?.let { switchTo(it) }
    }

    /** Follow / unfollow (or cancel request); returns the new status. */
    suspend fun toggleFollow(userId: Long, status: String): String {
        val r = if (status == "none") Api.post("users/$userId/follow") else Api.delete("users/$userId/follow")
        profileVersion++
        return r.optString("followStatus", if (status == "none") "accepted" else "none")
    }

    fun errToast(e: Throwable) {
        val code = (e as? ApiException)?.code ?: "network"
        toast(ctx, I18n.err(code))
    }
}

val LocalApp = compositionLocalOf<AppState> { error("no app") }
