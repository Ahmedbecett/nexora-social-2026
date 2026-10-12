package com.ahmedbecetti.nexora.kt.ui.screens

import com.ahmedbecetti.nexora.kt.ui.NxTabs

import androidx.compose.foundation.border
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.ui.graphics.Color
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import com.ahmedbecetti.nexora.kt.data.Post
import com.ahmedbecetti.nexora.kt.data.timeAgo
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle
import kotlinx.coroutines.delay
import com.ahmedbecetti.nexora.kt.ui.Avatar
import com.ahmedbecetti.nexora.kt.ui.mirrorIfRtl
import com.ahmedbecetti.nexora.kt.ui.Empty

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ahmedbecetti.nexora.kt.BuildConfig
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.Route
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.ApiException
import com.ahmedbecetti.nexora.kt.data.I18n
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.json
import com.ahmedbecetti.nexora.kt.data.mapObj
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.ConfirmDialog
import com.ahmedbecetti.nexora.kt.ui.Divider
import com.ahmedbecetti.nexora.kt.ui.Loader
import com.ahmedbecetti.nexora.kt.ui.NavRow
import com.ahmedbecetti.nexora.kt.ui.NxButton
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.SectionLabel
import com.ahmedbecetti.nexora.kt.ui.ToggleRow
import com.ahmedbecetti.nexora.kt.ui.TopBar
import com.ahmedbecetti.nexora.kt.ui.UserRow
import com.ahmedbecetti.nexora.kt.ui.WEB_URL
import com.ahmedbecetti.nexora.kt.ui.noRippleClick
import com.ahmedbecetti.nexora.kt.ui.profileLink
import com.ahmedbecetti.nexora.kt.ui.shareText
import com.ahmedbecetti.nexora.kt.ui.theme.Blue
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import com.ahmedbecetti.nexora.kt.ui.theme.Red
import com.ahmedbecetti.nexora.kt.ui.toast
import kotlinx.coroutines.launch
import org.json.JSONObject

private data class SettingItem(val icon: ImageVector, val label: String, val value: String? = null, val go: () -> Unit)

/** Real on-device screen-time tracker (Time management). Foreground time is summed per day in prefs. */
object Usage {
    private var since = 0L
    private fun day(offset: Int = 0) = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US).format(java.util.Date(System.currentTimeMillis() - offset * 86_400_000L))
    fun resume() { since = System.currentTimeMillis() }
    fun pause() {
        if (since == 0L) return
        val add = System.currentTimeMillis() - since; since = 0L
        val k = "usage_" + day()
        Api.setPref(k, ((Api.pref(k, "0")?.toLongOrNull() ?: 0L) + add).toString())
    }
    fun msOn(offset: Int): Long = (Api.pref("usage_" + day(offset), "0")?.toLongOrNull() ?: 0L) + if (offset == 0 && since > 0) System.currentTimeMillis() - since else 0L
    var limitMin: Int
        get() = Api.pref("dailyLimit", "0")?.toIntOrNull() ?: 0
        set(v) = Api.setPref("dailyLimit", v.toString())
    /** true once per day when the daily limit is exceeded */
    fun shouldRemind(): Boolean {
        val l = limitMin
        if (l <= 0 || msOn(0) < l * 60_000L || Api.pref("limitShown", "") == day()) return false
        Api.setPref("limitShown", day()); return true
    }
    fun fmt(ms: Long): String { val m = ms / 60_000; return if (m >= 60) "${m / 60}h ${m % 60}m" else "${m}m" }
}

/** Settings and activity — same structure as Instagram. Every row opens a real, server-backed page. */
@Composable
fun SettingsScreen() {
    val app = LocalApp.current
    val c = Nx.c
    var q by rememberSaveable { mutableStateOf("") }
    var confirmLogout by remember { mutableStateOf(false) }
    var confirmAll by remember { mutableStateOf(false) }
    var counts by remember { mutableStateOf(JSONObject()) }
    var isPrivate by remember { mutableStateOf(app.me?.isPrivate ?: false) }
    LaunchedEffect(Unit) {
        try { Api.get("me/settings").optJSONObject("counts")?.let { counts = it } } catch (_: Exception) {}
        isPrivate = app.me?.isPrivate ?: false
    }
    fun cnt(k: String) = counts.optInt(k).takeIf { it > 0 }?.toString()
    fun page(k: String) = { app.push(Route.SettingsPage(k)) }
    val sections: List<Pair<String, List<SettingItem>>> = listOf(
        t("howYouUse") to listOf(
            SettingItem(NxIcons.Bookmark, t("saved")) { app.push(Route.Saved) },
            SettingItem(NxIcons.Archive, t("archive"), go = page("archive")),
            SettingItem(NxIcons.Activity, t("yourActivity"), go = page("activity")),
            SettingItem(NxIcons.Bell, t("notifications"), go = page("notif")),
            SettingItem(NxIcons.Clock, t("timeManagement"), go = page("time")),
        ),
        t("whoCanSee") to listOf(
            SettingItem(NxIcons.Lock, t("accountPrivacy"), if (isPrivate) t("private") else t("public"), page("privacy")),
            SettingItem(NxIcons.Star, t("closeFriends"), cnt("close"), page("list:close")),
            SettingItem(NxIcons.Block, t("blocked"), cnt("blocked"), page("list:block")),
        ),
        t("howOthersInteract") to listOf(
            SettingItem(NxIcons.Send, t("messagesStoryReplies"), go = page("msgs")),
            SettingItem(NxIcons.Tagged, t("tagsMentions"), go = page("mentions")),
            SettingItem(NxIcons.Comment, t("commentsSetting"), go = page("comments")),
            SettingItem(NxIcons.Repost, t("sharing"), go = page("sharing")),
            SettingItem(NxIcons.EyeOff, t("restricted"), cnt("restricted"), page("list:restrict")),
            SettingItem(NxIcons.Shield, t("limitInteractions"), go = page("limit")),
            SettingItem(NxIcons.Flag, t("hiddenWords"), go = page("hidden")),
            SettingItem(NxIcons.UserPlus, t("inviteFriends"), go = page("invite")),
        ),
        t("whatYouSee") to listOf(
            SettingItem(NxIcons.Star, t("favorites"), cnt("favorites"), page("list:favorite")),
            SettingItem(NxIcons.BellOff, t("mutedAccounts"), cnt("muted"), page("list:mute")),
        ),
        t("yourAppMedia") to listOf(
            SettingItem(NxIcons.Globe, t("languageSetting"), I18n.languages.firstOrNull { it.first == I18n.lang }?.second) { app.push(Route.Language) },
            SettingItem(NxIcons.Moon, t("theme"), when (app.themeMode) { "dark" -> t("themeDark"); "light" -> t("themeLight"); else -> t("themeSystem") }, page("theme")),
        ),
        t("moreInfoSupport") to listOf(
            SettingItem(NxIcons.Lifebuoy, t("help"), go = page("help")),
            SettingItem(NxIcons.Shield, t("privacyCenter"), go = page("privacycenter")),
            SettingItem(NxIcons.User, t("accountStatus"), go = page("status")),
            SettingItem(NxIcons.Info, t("about"), go = page("about")),
        ),
    )
    val term = q.trim().lowercase()
    Column(Modifier.fillMaxSize().background(c.bg)) {
        TopBar(t("settingsTitle"), onBack = { app.pop() })
        Column(Modifier.verticalScroll(rememberScrollState())) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).height(40.dp).clip(RoundedCornerShape(12.dp)).background(c.input).padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Icon(NxIcons.Search, null, tint = c.muted, modifier = Modifier.size(18.dp))
                Box(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                    if (q.isEmpty()) Text(t("search"), color = c.muted, fontSize = 15.sp)
                    BasicTextField(q, { q = it }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
                }
                if (q.isNotEmpty()) Icon(NxIcons.Close, null, tint = c.muted, modifier = Modifier.size(16.dp).noRippleClick { q = "" })
            }
            if (term.isEmpty()) {
                SettingsHeader(t("yourAccount"), first = true)
                Row(Modifier.fillMaxWidth().clickable { app.push(Route.SettingsPage("center")) }.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(NxIcons.Account, null, tint = c.text, modifier = Modifier.size(26.dp))
                    Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                        Text(t("accountsCenter"), color = c.text, fontSize = 16.sp)
                        Text(t("accountsCenterSub"), color = c.muted, fontSize = 13.sp)
                    }
                    Icon(NxIcons.Chevron, null, tint = c.muted, modifier = Modifier.size(18.dp).mirrorIfRtl(NxIcons.Chevron))
                }
                Text(t("accountsCenterDesc"), color = c.muted, fontSize = 12.sp, modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 8.dp))
            }
            sections.forEach { (title, items) ->
                val shown = items.filter { term.isEmpty() || it.label.lowercase().contains(term) }
                if (shown.isNotEmpty()) {
                    SettingsHeader(title)
                    shown.forEach { NavRow(it.icon, it.label, it.value, onClick = it.go) }
                }
            }
            if (term.isEmpty()) {
                SettingsHeader(t("loginSection"))
                Text(t("addAccount"), color = Blue, fontSize = 16.sp, modifier = Modifier.fillMaxWidth().clickable { app.addAccount() }.padding(horizontal = 16.dp, vertical = 13.dp))
                Text(t("logout"), color = Red, fontSize = 16.sp, modifier = Modifier.fillMaxWidth().clickable { confirmLogout = true }.padding(horizontal = 16.dp, vertical = 13.dp))
                if (app.accounts.count { it.token != null } > 1)
                    Text(t("logoutAll"), color = Red, fontSize = 16.sp, modifier = Modifier.fillMaxWidth().clickable { confirmAll = true }.padding(horizontal = 16.dp, vertical = 13.dp))
                Text("Nexora · " + t("appVersion") + " " + com.ahmedbecetti.nexora.kt.BuildConfig.VERSION_NAME, color = c.muted, fontSize = 12.sp,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp))
            }
            Spacer(Modifier.height(30.dp))
        }
    }
    if (confirmLogout) ConfirmDialog(t("logoutOf", "u" to (app.me?.username ?: "")), t("logout"), onDismiss = { confirmLogout = false }) { confirmLogout = false; app.logout() }
    if (confirmAll) ConfirmDialog(t("logoutAll") + "?", t("logout"), onDismiss = { confirmAll = false }) { confirmAll = false; app.logoutAll() }
}

@Composable
private fun SettingsHeader(title: String, first: Boolean = false) {
    val c = Nx.c
    if (!first) Box(Modifier.fillMaxWidth().padding(top = 6.dp).height(6.dp).background(c.sep))
    Text(title, color = c.muted, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 4.dp))
}

/** Loads / patches `me/settings` (same server settings as the web app). */
private class ServerSettings {
    var s by mutableStateOf<JSONObject?>(null)
    suspend fun load() { s = Api.get("me/settings").optJSONObject("settings") }
    suspend fun patch(body: JSONObject) { s = Api.patch("me/settings", body).optJSONObject("settings") ?: s }
}

@Composable
fun SettingsPage(key: String) {
    val app = LocalApp.current
    val c = Nx.c
    val title = when (key) {
        "invite" -> t("inviteFriends"); "notif" -> t("notifications"); "privacy" -> t("accountPrivacy")
        "security" -> t("passwordSecurity"); "account" -> t("personalDetails"); "help" -> t("help"); "about" -> t("about")
        "theme" -> t("theme"); "center" -> t("accountsCenter"); "archive" -> t("archive"); "activity" -> t("yourActivity")
        "time" -> t("timeManagement"); "msgs" -> t("messagesStoryReplies"); "mentions" -> t("tagsMentions"); "comments" -> t("commentsSetting")
        "sharing" -> t("sharing"); "limit" -> t("limitInteractions"); "hidden" -> t("hiddenWords"); "privacycenter" -> t("privacyCenter")
        "status" -> t("accountStatus"); "messages" -> t("messagesStoryReplies")
        "list:block" -> t("blocked"); "list:mute" -> t("mutedAccounts"); "list:close" -> t("closeFriends"); "list:favorite" -> t("favorites"); "list:restrict" -> t("restricted")
        else -> ""
    }
    Column(Modifier.fillMaxSize().background(c.bg)) {
        TopBar(title, onBack = { app.pop() })
        when (key) {
            "invite" -> InvitePage()
            "notif" -> NotifPage()
            "privacy" -> PrivacyPage()
            "security" -> SecurityPage()
            "account" -> AccountPage()
            "help" -> HelpPage()
            "about" -> AboutPage()
            "theme" -> ThemePage()
            "center" -> CenterPage()
            "archive" -> ArchivePage()
            "activity" -> ActivityPage()
            "time" -> TimePage()
            "msgs", "messages" -> AudiencePage(listOf("messages", "storyReplies"))
            "mentions" -> AudiencePage(listOf("mentions"))
            "comments" -> AudiencePage(listOf("comments"))
            "sharing" -> SharingPage()
            "limit" -> LimitPage()
            "hidden" -> HiddenWordsPage()
            "privacycenter" -> PrivacyCenterPage()
            "status" -> StatusPage()
            else -> if (key.startsWith("list:")) ListPage(key.removePrefix("list:"))
        }
    }
}

@Composable
private fun InvitePage() {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val users = remember { mutableStateListOf<User>() }
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        try { users.addAll(Api.get("suggestions").optJSONArray("users").mapObj { User.from(it) }) } catch (_: Exception) {} finally { loaded = true }
    }
    LazyColumn(Modifier.fillMaxSize()) {
        item {
            NavRow(NxIcons.Link, t("inviteByLink")) { shareText(ctx, t("inviteText") + " " + profileLink(app.me?.username ?: "")) }
            Divider(Modifier.padding(vertical = 6.dp))
            SectionLabel(t("suggested"))
        }
        if (!loaded) item { Loader() }
        items(users, key = { it.id }) { u ->
            SuggestionRow(u) { st -> val i = users.indexOfFirst { it.id == u.id }; if (i >= 0) users[i] = u.copy(followStatus = st) }
        }
    }
}

@Composable
private fun NotifPage() {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val st = remember { ServerSettings() }
    LaunchedEffect(Unit) { try { st.load() } catch (e: Exception) { app.errToast(e) } }
    val s = st.s ?: return Loader()
    val notif = s.optJSONObject("notif") ?: JSONObject()
    fun setNotif(k: String, v: Boolean) {
        val n = JSONObject(notif.toString()).put(k, v)
        scope.launch { try { st.patch(json("notif" to n)) } catch (e: Exception) { app.errToast(e) } }
    }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        ToggleRow(t("pauseAll"), s.optBoolean("pauseAll"), desc = t("pauseAllDesc").takeIf { it != "pauseAllDesc" }) { v ->
            scope.launch { try { st.patch(json("pauseAll" to v)) } catch (e: Exception) { app.errToast(e) } }
        }
        SectionLabel(t("notifTypes"))
        val paused = s.optBoolean("pauseAll")
        ToggleRow(t("likesTab"), notif.optBoolean("likes", true), enabled = !paused) { setNotif("likes", it) }
        ToggleRow(t("commentsTab"), notif.optBoolean("comments", true), enabled = !paused) { setNotif("comments", it) }
        ToggleRow(t("mentionsTab"), notif.optBoolean("mentions", true), enabled = !paused) { setNotif("mentions", it) }
        ToggleRow(t("newFollowers"), notif.optBoolean("follows", true), enabled = !paused) { setNotif("follows", it) }
        ToggleRow(t("followRequests"), notif.optBoolean("requests", true), enabled = !paused) { setNotif("requests", it) }
        ToggleRow(t("messages"), notif.optBoolean("messages", true), enabled = !paused) { setNotif("messages", it) }
    }
}

@Composable
private fun PrivacyPage() {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val st = remember { ServerSettings() }
    var isPrivate by remember { mutableStateOf(app.me?.isPrivate ?: false) }
    LaunchedEffect(Unit) {
        try { st.load(); isPrivate = Api.get("me").optJSONObject("user")?.optBoolean("isPrivate") ?: isPrivate } catch (e: Exception) { app.errToast(e) }
    }
    val s = st.s ?: return Loader()
    Column(Modifier.verticalScroll(rememberScrollState())) {
        ToggleRow(t("privateToggle"), isPrivate, desc = t("privateDesc").takeIf { it != "privateDesc" }) { v ->
            isPrivate = v
            scope.launch {
                try { User.from(Api.patch("me", json("isPrivate" to v)).optJSONObject("user"))?.let { app.me = it }; app.profileVersion++ }
                catch (e: Exception) { isPrivate = !v; app.errToast(e) }
            }
        }
        Divider(Modifier.padding(vertical = 6.dp))
        ToggleRow(t("activityStatus"), s.optBoolean("activityStatus", true), desc = t("activityStatusDesc")) { v ->
            scope.launch { try { st.patch(json("activityStatus" to v)) } catch (e: Exception) { app.errToast(e) } }
        }
    }
}

/** Who can message / reply to stories / mention / comment — server `me/settings`. */
@Composable
private fun AudiencePage(keys: List<String>) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val st = remember { ServerSettings() }
    LaunchedEffect(Unit) { try { st.load() } catch (e: Exception) { app.errToast(e) } }
    val s = st.s ?: return Loader()
    fun audLabel(v: String) = when (v) { "following" -> t("peopleYouFollow"); "followers" -> t("followers"); "none" -> t("noOne"); else -> t("everyone") }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        keys.forEach { k ->
            SectionLabel(when (k) { "messages" -> t("whoCanMessage"); "comments" -> t("whoCanComment"); "mentions" -> t("whoCanMention"); else -> t("whoCanReplyStory") })
            val opts = if (k == "comments") listOf("everyone", "followers", "none") else listOf("everyone", "following", "none")
            opts.forEach { v ->
                RadioRow(audLabel(v), s.optString(k, "everyone") == v) {
                    scope.launch { try { st.patch(json(k to v)) } catch (e: Exception) { app.errToast(e) } }
                }
            }
            Divider(Modifier.padding(vertical = 6.dp))
        }
        if ("messages" in keys) Text(t("requestsAlways").takeIf { false } ?: t("msgsNoRequestsSub"), color = Nx.c.muted, fontSize = 13.sp, modifier = Modifier.padding(16.dp))
    }
}

@Composable
private fun RadioRow(label: String, selected: Boolean, onClick: () -> Unit) {
    val c = Nx.c
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = c.text, fontSize = 16.sp, modifier = Modifier.weight(1f))
        Box(Modifier.size(22.dp).clip(CircleShape).border(if (selected) 7.dp else 1.5.dp, if (selected) c.text else c.muted, CircleShape))
    }
}

@Composable
private fun SharingPage() {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val st = remember { ServerSettings() }
    LaunchedEffect(Unit) { try { st.load() } catch (e: Exception) { app.errToast(e) } }
    val s = st.s ?: return Loader()
    ToggleRow(t("allowSharing"), s.optBoolean("allowSharing", true), desc = t("allowSharingDesc")) { v ->
        scope.launch { try { st.patch(json("allowSharing" to v)) } catch (e: Exception) { app.errToast(e) } }
    }
}

@Composable
private fun LimitPage() {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val st = remember { ServerSettings() }
    LaunchedEffect(Unit) { try { st.load() } catch (e: Exception) { app.errToast(e) } }
    val s = st.s ?: return Loader()
    Column {
        Text(t("limitDesc"), color = Nx.c.muted, fontSize = 14.sp, modifier = Modifier.padding(16.dp))
        ToggleRow(t("limitInteractions"), s.optJSONObject("limit")?.optBoolean("enabled") == true, desc = t("limitToggleDesc")) { v ->
            scope.launch { try { st.patch(json("limit" to json("enabled" to v))) } catch (e: Exception) { app.errToast(e) } }
        }
    }
}

@Composable
private fun HiddenWordsPage() {
    val app = LocalApp.current
    val c = Nx.c
    val scope = rememberCoroutineScope()
    val st = remember { ServerSettings() }
    var word by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { try { st.load() } catch (e: Exception) { app.errToast(e) } }
    val s = st.s ?: return Loader()
    val hw = s.optJSONObject("hiddenWords") ?: JSONObject()
    val custom = (0 until (hw.optJSONArray("custom")?.length() ?: 0)).map { hw.getJSONArray("custom").getString(it) }
    fun save(enabled: Boolean, words: List<String>) {
        scope.launch { try { st.patch(json("hiddenWords" to json("enabled" to enabled, "custom" to org.json.JSONArray(words)))) } catch (e: Exception) { app.errToast(e) } }
    }
    LazyColumn(Modifier.fillMaxSize()) {
        item {
            ToggleRow(t("hiddenWords"), hw.optBoolean("enabled"), desc = t("hiddenWordsDesc").takeIf { it != "hiddenWordsDesc" }) { save(it, custom) }
            Divider(Modifier.padding(vertical = 6.dp))
            SectionLabel(t("customWords").takeIf { it != "customWords" } ?: t("hiddenWords"))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f).height(42.dp).clip(RoundedCornerShape(10.dp)).background(c.input).padding(horizontal = 12.dp), contentAlignment = Alignment.CenterStart) {
                    if (word.isEmpty()) Text(t("addWordPh").takeIf { it != "addWordPh" } ?: "…", color = c.muted)
                    BasicTextField(word, { word = it.take(40) }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
                }
                Text(t("add"), color = Blue, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 12.dp).noRippleClick {
                    val w = word.trim().lowercase(); if (w.isNotEmpty() && w !in custom) { save(true, custom + w); word = "" }
                })
            }
        }
        items(custom) { w ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(w, color = c.text, fontSize = 15.sp, modifier = Modifier.weight(1f))
                Icon(NxIcons.Close, null, tint = c.muted, modifier = Modifier.size(18.dp).noRippleClick { save(hw.optBoolean("enabled"), custom - w) })
            }
        }
    }
}

/** Accounts Center: profiles on this device + personal details + password & security. */
@Composable
private fun CenterPage() {
    val app = LocalApp.current
    val c = Nx.c
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Text(t("accountsCenterDesc"), color = c.muted, fontSize = 14.sp, modifier = Modifier.padding(16.dp))
        SectionLabel(t("accountsOnDevice"))
        app.accounts.forEach { a ->
            Row(Modifier.fillMaxWidth().clickable { if (a.id != app.me?.id) app.switchTo(a) }.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Avatar(a.avatarUrl, 44.dp)
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text(a.username, color = c.text, fontWeight = FontWeight.SemiBold)
                    Text(if (a.id == app.me?.id) t("currentAccount") else if (a.token != null) t("loggedIn") else t("loginAgain"), color = c.muted, fontSize = 13.sp)
                }
                if (a.id == app.me?.id) Icon(NxIcons.Check, null, tint = Blue, modifier = Modifier.size(20.dp))
            }
        }
        Text(t("addAccount"), color = Blue, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.fillMaxWidth().clickable { app.addAccount() }.padding(16.dp))
        Divider(Modifier.padding(vertical = 6.dp))
        SectionLabel(t("accountSettings"))
        NavRow(NxIcons.Edit, t("editProfile")) { app.push(Route.EditProfile) }
        NavRow(NxIcons.Key, t("passwordSecurity")) { app.push(Route.SettingsPage("security")) }
        NavRow(NxIcons.User, t("personalDetails")) { app.push(Route.SettingsPage("account")) }
        NavRow(NxIcons.UserPlus, t("followRequests"), if (app.requestBadge > 0) "${app.requestBadge}" else null) { app.push(Route.FollowRequests) }
        Spacer(Modifier.height(30.dp))
    }
}

/** Story archive (server `me/stories`, all of your stories including expired ones). */
@Composable
private fun ArchivePage() {
    val app = LocalApp.current
    val c = Nx.c
    var items by remember { mutableStateOf<List<JSONObject>?>(null) }
    LaunchedEffect(Unit) { items = try { Api.get("me/stories").optJSONArray("stories").mapObj { it } } catch (e: Exception) { app.errToast(e); emptyList() } }
    val list = items ?: return Loader()
    if (list.isEmpty()) return Empty(NxIcons.Archive, t("archive"), t("noArchive"))
    LazyVerticalGrid(GridCells.Fixed(3), Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(1.dp), verticalArrangement = Arrangement.spacedBy(1.dp)) {
        items(list, key = { it.optLong("id") }) { s ->
            Box(Modifier.aspectRatio(9f / 16f).background(c.sep)) {
                if (s.optString("type") != "video") AsyncImage(s.optString("url"), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                else Icon(NxIcons.Play, null, tint = c.muted, modifier = Modifier.align(Alignment.Center).size(28.dp))
                val d = java.time.Instant.ofEpochMilli(com.ahmedbecetti.nexora.kt.data.parseTime(s.optString("createdAt"))).atZone(java.time.ZoneId.systemDefault())
                Column(Modifier.padding(6.dp).clip(RoundedCornerShape(6.dp)).background(Color.White).padding(horizontal = 6.dp, vertical = 2.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("${d.dayOfMonth}", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(d.month.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale(I18n.lang)), color = Color.Black, fontSize = 10.sp)
                }
            }
        }
    }
}

/** Your activity: posts you liked + your comments (server `me/activity/likes`, `me/activity/comments`). */
@Composable
private fun ActivityPage() {
    val app = LocalApp.current
    val c = Nx.c
    var tab by rememberSaveable { mutableStateOf(0) }
    var likes by remember { mutableStateOf<List<Post>?>(null) }
    var comments by remember { mutableStateOf<List<JSONObject>?>(null) }
    LaunchedEffect(tab) {
        try {
            if (tab == 0 && likes == null) likes = Post.list(Api.get("me/activity/likes"))
            if (tab == 1 && comments == null) comments = Api.get("me/activity/comments").optJSONArray("comments").mapObj { it }
        } catch (e: Exception) { app.errToast(e); if (tab == 0) likes = emptyList() else comments = emptyList() }
    }
    Column(Modifier.fillMaxSize()) {
        NxTabs(listOf(t("likesTab"), t("commentsTab")), tab, { tab = it })
        if (tab == 0) {
            val l = likes ?: return@Column Loader()
            if (l.isEmpty()) Empty(NxIcons.Heart, t("likesTab"), t("noLikesYet").takeIf { it != "noLikesYet" })
            else LazyVerticalGrid(GridCells.Fixed(3), Modifier.fillMaxSize()) { postGrid(app, l) }
        } else {
            val l = comments ?: return@Column Loader()
            if (l.isEmpty()) Empty(NxIcons.Comment, t("commentsTab"), t("noComments"))
            else LazyColumn(Modifier.fillMaxSize()) {
                items(l, key = { it.optLong("id") }) { cm ->
                    Row(Modifier.fillMaxWidth().clickable { app.push(Route.PostDetail(cm.optLong("postId").toString())) }.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(buildAnnotatedString {
                                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(app.me?.username ?: "") }
                                append(" " + cm.optString("text"))
                            }, color = c.text, fontSize = 14.sp, maxLines = 3)
                            Text("@" + cm.optString("postUser") + " · " + timeAgo(cm.optString("createdAt")), color = c.muted, fontSize = 12.sp)
                        }
                        val th = cm.optString("thumb").takeIf { it.isNotBlank() && cm.optString("thumbType") != "video" }
                        if (th != null) AsyncImage(th, null, contentScale = ContentScale.Crop, modifier = Modifier.padding(start = 10.dp).size(46.dp).clip(RoundedCornerShape(6.dp)).background(c.sep))
                    }
                }
            }
        }
    }
}

@Composable
private fun TimePage() {
    val c = Nx.c
    var limit by remember { mutableStateOf(Usage.limitMin) }
    var pick by remember { mutableStateOf(false) }
    val week = (0..6).map { Usage.msOn(it) }
    val avg = week.sum() / 7
    Column(Modifier.verticalScroll(rememberScrollState()).padding(vertical = 10.dp)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(Usage.fmt(avg), color = c.text, fontSize = 30.sp, fontWeight = FontWeight.Bold)
            Text(t("dailyAverage").takeIf { it != "dailyAverage" } ?: t("timeSpent"), color = c.muted, fontSize = 14.sp)
        }
        val max = (week.maxOrNull() ?: 1L).coerceAtLeast(1L)
        Row(Modifier.fillMaxWidth().height(140.dp).padding(horizontal = 24.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
            week.reversed().forEachIndexed { i, ms ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.width(26.dp).height((100f * ms / max).dp.coerceAtLeast(3.dp)).clip(RoundedCornerShape(4.dp)).background(if (i == 6) Blue else c.border))
                    val d = java.time.LocalDate.now().minusDays((6 - i).toLong())
                    Text(d.dayOfWeek.getDisplayName(java.time.format.TextStyle.NARROW, java.util.Locale(I18n.lang)), color = c.muted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
        Text(t("today") + ": " + Usage.fmt(week[0]), color = c.text, fontSize = 15.sp, modifier = Modifier.padding(16.dp))
        Divider(Modifier.padding(vertical = 6.dp))
        NavRow(NxIcons.Clock, t("dailyLimit"), if (limit > 0) Usage.fmt(limit * 60_000L) else t("off")) { pick = true }
        Text(t("dailyLimitDesc"), color = c.muted, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 16.dp))
    }
    if (pick) ChoiceDialog(t("dailyLimit"), listOf(0, 15, 30, 45, 60, 120, 180).map { "$it" to if (it == 0) t("off") else Usage.fmt(it * 60_000L) }, "$limit",
        onDismiss = { pick = false }) { v -> pick = false; limit = v.toInt(); Usage.limitMin = limit }
}

@Composable
private fun PrivacyCenterPage() {
    val c = Nx.c
    var open by remember { mutableStateOf<String?>(null) }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Text(t("privacyCenterDesc"), color = c.muted, fontSize = 14.sp, modifier = Modifier.padding(16.dp))
        NavRow(NxIcons.Lock, t("privacyPolicy")) { open = "policyText" }
        NavRow(NxIcons.Info, t("termsOfUse")) { open = "termsText" }
    }
    open?.let { k -> ConfirmDialog(t(k), t("close"), onDismiss = { open = null }) { open = null } }
}

@Composable
private fun StatusPage() {
    val app = LocalApp.current
    val c = Nx.c
    var st by remember { mutableStateOf<JSONObject?>(null) }
    LaunchedEffect(Unit) { try { st = Api.get("me/status") } catch (e: Exception) { app.errToast(e) } }
    val s = st ?: return Loader()
    val good = s.optString("standing") == "good"
    Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Avatar(app.me?.avatarUrl, 84.dp)
        Text(app.me?.username ?: "", color = c.text, fontWeight = FontWeight.Bold, fontSize = 17.sp, modifier = Modifier.padding(top = 10.dp))
        Row(Modifier.padding(top = 20.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).border(1.dp, c.border, RoundedCornerShape(14.dp)).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(if (good) Color(0xFF1CD14F) else Color(0xFFF5A623)), contentAlignment = Alignment.Center) {
                Icon(if (good) NxIcons.Check else NxIcons.Flag, null, tint = Color.White, modifier = Modifier.size(22.dp))
            }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(if (good) t("statusGood") else t("statusReview"), color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                Text(if (good) t("statusGoodDesc") else t("statusReviewDesc"), color = c.muted, fontSize = 13.sp)
            }
        }
        listOf(t("reportsOnContent") to "${s.optInt("reports")}", t("posts") to "${s.optInt("posts")}", t("joined") to s.optString("createdAt").take(10)).forEach { (k, v) ->
            Row(Modifier.fillMaxWidth().padding(vertical = 13.dp)) {
                Text(k, color = c.text, fontSize = 15.sp, modifier = Modifier.weight(1f))
                Text(v, color = c.muted, fontSize = 15.sp)
            }
        }
    }
}

@Composable
private fun ListPage(kind: String) {
    val app = LocalApp.current
    val c = Nx.c
    val ctx = LocalContext.current
    val users = remember { mutableStateListOf<User>() }
    var loaded by remember { mutableStateOf(false) }
    var q by remember { mutableStateOf("") }
    val found = remember { mutableStateListOf<User>() }
    val canAdd = kind == "close" || kind == "favorite"
    LaunchedEffect(kind) {
        try { users.addAll(Api.get("me/lists/$kind").optJSONArray("users").mapObj { User.from(it) }) } catch (e: Exception) { app.errToast(e) } finally { loaded = true }
    }
    LaunchedEffect(q) {
        if (q.isBlank()) { found.clear(); return@LaunchedEffect }
        delay(250)
        try { found.clear(); found.addAll(Api.get("search/users?q=" + java.net.URLEncoder.encode(q.trim(), "UTF-8")).optJSONArray("users").mapObj { User.from(it) }.filter { it.id != app.me?.id }) } catch (_: Exception) {}
    }
    val desc = when (kind) { "mute" -> t("mutedDesc"); "close" -> t("closeFriendsDesc"); "favorite" -> t("favoritesDesc"); "restrict" -> t("restrictedDesc"); else -> null }
    val empty = when (kind) { "block" -> t("noBlocked"); "mute" -> t("noMuted"); "close" -> t("noCloseFriends"); "favorite" -> t("noFavorites"); else -> t("noRestricted") }
    val removeLabel = when (kind) { "block" -> t("unblock"); "mute" -> t("unmute"); "restrict" -> t("unrestrict"); else -> t("remove") }
    fun toggle(u: User, on: Boolean) {
        app.scope.launch {
            try {
                if (on) { Api.post("users/${u.id}/$kind"); if (users.none { it.id == u.id }) users.add(0, u) }
                else { Api.delete("users/${u.id}/$kind"); users.removeAll { it.id == u.id } }
                toast(ctx, when (kind) {
                    "block" -> t("unblockedToast"); "mute" -> t("unmutedToast"); "restrict" -> t("unrestrictedToast")
                    "close" -> if (on) t("addedCloseFriend") else t("removedCloseFriend"); else -> if (on) t("addedFavorite") else t("removedFavorite")
                })
            } catch (e: Exception) { app.errToast(e) }
        }
    }
    LazyColumn(Modifier.fillMaxSize()) {
        if (desc != null) item { Text(desc, color = c.muted, fontSize = 13.sp, modifier = Modifier.padding(16.dp)) }
        if (canAdd) item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).height(40.dp).clip(RoundedCornerShape(12.dp)).background(c.input).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(NxIcons.Search, null, tint = c.muted, modifier = Modifier.size(18.dp))
                Box(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                    if (q.isEmpty()) Text(t("search"), color = c.muted, fontSize = 15.sp)
                    BasicTextField(q, { q = it }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
                }
            }
        }
        if (q.isNotBlank()) items(found, key = { "f" + it.id }) { u ->
            val on = users.any { it.id == u.id }
            UserRow(u, onClick = { app.openProfile(u.username) }) { NxButton(if (on) t("remove") else t("add"), { toggle(u, !on) }, primary = !on) }
        } else {
            if (!loaded) item { Loader() }
            if (loaded && users.isEmpty()) item { Text(empty, color = c.muted, modifier = Modifier.padding(24.dp)) }
            items(users, key = { it.id }) { u ->
                UserRow(u, onClick = { app.openProfile(u.username) }) { NxButton(removeLabel, { toggle(u, false) }, primary = false) }
            }
        }
    }
}

@Composable
private fun SecurityPage() {
    val app = LocalApp.current
    val ctx = LocalContext.current
    var pwDialog by remember { mutableStateOf(false) }
    var confirmOthers by remember { mutableStateOf(false) }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        SectionLabel(t("passwordSecurity"))
        NavRow(NxIcons.Key, t("changePassword")) { pwDialog = true }
        NavRow(NxIcons.Mail, t("forgot")) {
            app.scope.launch { try { Api.post("me/password-reset"); toast(ctx, t("resetSentShort")) } catch (e: Exception) { app.errToast(e) } }
        }
        SectionLabel(t("securityChecks"))
        NavRow(NxIcons.Logout, t("logoutOtherDevices")) { confirmOthers = true }
    }
    if (pwDialog) PasswordDialog(onDismiss = { pwDialog = false })
    if (confirmOthers) ConfirmDialog(t("logoutOtherDevices"), t("logout"), text = t("logoutOtherDesc"), onDismiss = { confirmOthers = false }) {
        confirmOthers = false
        app.scope.launch {
            try { Api.post("me/logout-all").optString("token").takeIf { it.isNotBlank() }?.let { Api.setToken(it) }; toast(ctx, t("saved2")) }
            catch (e: Exception) { app.errToast(e) }
        }
    }
}

@Composable
private fun PasswordDialog(onDismiss: () -> Unit) {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val c = Nx.c
    var cur by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDismiss, containerColor = c.elevated,
        title = { Text(t("changePassword"), fontWeight = FontWeight.SemiBold, color = c.text) },
        text = {
            Column {
                DialogField(cur, { cur = it; err = null }, t("currentPassword"), password = true)
                Spacer(Modifier.height(8.dp))
                DialogField(next, { next = it; err = null }, t("newPassword"), password = true)
                err?.let { Text(it, color = Red, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp)) }
            }
        },
        confirmButton = {
            TextButton(enabled = !busy && cur.isNotEmpty() && next.length >= 6, onClick = {
                busy = true
                app.scope.launch {
                    try {
                        val r = Api.post("me/password", json("current" to cur, "next" to next))
                        r.optString("token").takeIf { it.isNotBlank() }?.let { Api.setToken(it) }
                        toast(ctx, t("passwordChanged")); onDismiss()
                    } catch (e: ApiException) { err = I18n.err(e.code) } finally { busy = false }
                }
            }) { Text(t("save"), color = Blue, fontWeight = FontWeight.SemiBold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t("cancel"), color = c.text) } },
    )
}

@Composable
private fun DialogField(value: String, onChange: (String) -> Unit, placeholder: String, password: Boolean = false, single: Boolean = true) {
    val c = Nx.c
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(c.input).padding(horizontal = 12.dp, vertical = 12.dp)) {
        if (value.isEmpty()) Text(placeholder, color = c.muted, fontSize = 15.sp)
        BasicTextField(value, onChange, singleLine = single, minLines = if (single) 1 else 4, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text),
            visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else KeyboardType.Text), modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun AccountPage() {
    val app = LocalApp.current
    var del by remember { mutableStateOf(false) }
    var confirmLogout by remember { mutableStateOf(false) }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        NavRow(NxIcons.Edit, t("editProfile")) { app.push(Route.EditProfile) }
        NavRow(NxIcons.Moon, t("theme"), when (app.themeMode) { "dark" -> t("themeDark"); "light" -> t("themeLight"); else -> t("themeSystem") }) { app.push(Route.SettingsPage("theme")) }
        NavRow(NxIcons.Globe, t("languageSetting"), I18n.languages.firstOrNull { it.first == I18n.lang }?.second ?: I18n.lang) { app.push(Route.Language) }
        NavRow(NxIcons.Bookmark, t("saved")) { app.push(Route.Saved) }
        NavRow(NxIcons.UserPlus, t("followRequests"), if (app.requestBadge > 0) "${app.requestBadge}" else null) { app.push(Route.FollowRequests) }
        Divider(Modifier.padding(vertical = 6.dp))
        NavRow(NxIcons.Trash, t("deleteAccount"), danger = true) { del = true }
        NavRow(NxIcons.Logout, t("logout"), danger = true) { confirmLogout = true }
    }
    if (del) DeleteAccountDialog(onDismiss = { del = false })
    if (confirmLogout) ConfirmDialog(t("logoutConfirm"), t("logout"), onDismiss = { confirmLogout = false }) { confirmLogout = false; app.logout() }
}

@Composable
private fun DeleteAccountDialog(onDismiss: () -> Unit) {
    val app = LocalApp.current
    val c = Nx.c
    var confirm by remember { mutableStateOf("") }
    var pw by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }
    val me = app.me ?: return
    AlertDialog(
        onDismissRequest = onDismiss, containerColor = c.elevated,
        title = { Text(t("deleteAccount"), fontWeight = FontWeight.SemiBold, color = c.text) },
        text = {
            Column {
                Text(t("deleteAccountDesc"), color = c.muted, fontSize = 13.sp)
                Spacer(Modifier.height(10.dp))
                DialogField(confirm, { confirm = it.trim().lowercase(); err = null }, me.username)
                Spacer(Modifier.height(8.dp))
                DialogField(pw, { pw = it; err = null }, t("password"), password = true)
                err?.let { Text(it, color = Red, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp)) }
            }
        },
        confirmButton = {
            TextButton(enabled = !busy && confirm == me.username, onClick = {
                busy = true
                app.scope.launch {
                    try { Api.call("DELETE", "me", json("confirm" to confirm, "password" to pw)); onDismiss(); app.logout() }
                    catch (e: ApiException) { err = I18n.err(e.code) } finally { busy = false }
                }
            }) { Text(t("delete"), color = Red, fontWeight = FontWeight.SemiBold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t("cancel"), color = c.text) } },
    )
}

@Composable
private fun ThemePage() {
    val app = LocalApp.current
    val c = Nx.c
    Column {
        Text(t("themeDesc"), color = c.muted, fontSize = 13.sp, modifier = Modifier.padding(16.dp))
        listOf("light" to t("themeLight"), "dark" to t("themeDark"), "system" to t("themeSystem")).forEach { (k, label) ->
            Row(Modifier.fillMaxWidth().clickable { app.setTheme(k) }.padding(horizontal = 16.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(label, color = c.text, fontSize = 15.sp, modifier = Modifier.weight(1f))
                RadioButton(app.themeMode == k, { app.setTheme(k) }, colors = RadioButtonDefaults.colors(selectedColor = c.text, unselectedColor = c.muted))
            }
        }
    }
}

@Composable
private fun HelpPage() {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val c = Nx.c
    var report by remember { mutableStateOf(false) }
    var open by remember { mutableStateOf(-1) }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        NavRow(NxIcons.Flag, t("reportProblem")) { report = true }
        Divider(Modifier.padding(vertical = 6.dp))
        SectionLabel(t("help"))
        (1..5).forEach { i ->
            Column(Modifier.fillMaxWidth().clickable { open = if (open == i) -1 else i }.padding(horizontal = 16.dp, vertical = 12.dp)) {
                Text(t("faq${i}q"), color = c.text, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                if (open == i) Text(t("faq${i}a"), color = c.muted, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp))
            }
        }
    }
    if (report) {
        var text by remember { mutableStateOf("") }
        var busy by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { report = false }, containerColor = c.elevated,
            title = { Text(t("reportProblem"), fontWeight = FontWeight.SemiBold, color = c.text) },
            text = { DialogField(text, { text = it }, t("reportProblemPh"), single = false) },
            confirmButton = {
                TextButton(enabled = !busy && text.isNotBlank(), onClick = {
                    busy = true
                    app.scope.launch {
                        try { Api.post("support", json("text" to text.trim())); toast(ctx, t("reported")); report = false } catch (e: Exception) { app.errToast(e) } finally { busy = false }
                    }
                }) { Text(t("send"), color = Blue, fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = { TextButton(onClick = { report = false }) { Text(t("cancel"), color = c.text) } },
        )
    }
}

@Composable
private fun AboutPage() {
    val ctx = LocalContext.current
    val c = Nx.c
    var terms by remember { mutableStateOf(false) }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            com.ahmedbecetti.nexora.kt.ui.Wordmark(size = 44.sp)
            Text(t("appVersion") + " " + BuildConfig.VERSION_NAME, color = c.muted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
        }
        NavRow(NxIcons.Lock, t("privacyPolicy")) {
            try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("$WEB_URL/privacy.html")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: Exception) {}
        }
        NavRow(NxIcons.Info, t("termsOfUse")) { terms = true }
    }
    if (terms) AlertDialog(
        onDismissRequest = { terms = false }, containerColor = c.elevated,
        title = { Text(t("termsOfUse"), fontWeight = FontWeight.SemiBold, color = c.text) },
        text = { Text(t("termsText"), color = c.muted, fontSize = 14.sp) },
        confirmButton = { TextButton(onClick = { terms = false }) { Text("OK", color = Blue) } },
    )
}

@Composable
fun ChoiceDialog(title: String, options: List<Pair<String, String>>, selected: String, onDismiss: () -> Unit, onPick: (String) -> Unit) {
    val c = Nx.c
    AlertDialog(
        onDismissRequest = onDismiss, containerColor = c.elevated,
        title = { Text(title, fontWeight = FontWeight.SemiBold, color = c.text, fontSize = 17.sp) },
        text = {
            Column {
                options.forEach { (k, label) ->
                    Row(Modifier.fillMaxWidth().clickable { onPick(k) }.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(label, color = c.text, fontSize = 15.sp, modifier = Modifier.weight(1f))
                        RadioButton(selected == k, { onPick(k) }, colors = RadioButtonDefaults.colors(selectedColor = c.text, unselectedColor = c.muted))
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(t("cancel"), color = c.text) } },
    )
}
