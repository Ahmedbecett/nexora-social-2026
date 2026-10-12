package com.ahmedbecetti.nexora.kt.ui.screens

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

private data class SettingItem(val key: String, val icon: ImageVector, val label: String)

/** Settings home (like the mockup): search + Follow and invite friends, Notifications, Privacy, Security, Account, Help, About. */
@Composable
fun SettingsScreen() {
    val app = LocalApp.current
    val c = Nx.c
    var q by rememberSaveable { mutableStateOf("") }
    var confirmLogout by remember { mutableStateOf(false) }
    val items = listOf(
        SettingItem("invite", NxIcons.UserPlus, t("inviteFriends")),
        SettingItem("notif", NxIcons.Bell, t("notifSettings")),
        SettingItem("privacy", NxIcons.Lock, t("privacy")),
        SettingItem("security", NxIcons.Shield, t("security")),
        SettingItem("account", NxIcons.Account, t("account")),
        SettingItem("help", NxIcons.Help, t("help")),
        SettingItem("about", NxIcons.Info, t("about")),
    )
    // extra searchable shortcuts that live inside the pages
    val shortcuts = listOf(
        Triple(t("theme"), NxIcons.Moon) { app.push(Route.SettingsPage("theme")) },
        Triple(t("languageSetting"), NxIcons.Globe) { app.push(Route.Language) },
        Triple(t("saved"), NxIcons.Bookmark) { app.push(Route.Saved) },
        Triple(t("editProfile"), NxIcons.Edit) { app.push(Route.EditProfile) },
        Triple(t("followRequests"), NxIcons.UserPlus) { app.push(Route.FollowRequests) },
        Triple(t("changePassword"), NxIcons.Key) { app.push(Route.SettingsPage("security")) },
        Triple(t("blocked"), NxIcons.Block) { app.push(Route.SettingsPage("list:block")) },
        Triple(t("mutedAccounts"), NxIcons.BellOff) { app.push(Route.SettingsPage("list:mute")) },
        Triple(t("deleteAccount"), NxIcons.Trash) { app.push(Route.SettingsPage("account")) },
    )
    val term = q.trim().lowercase()
    Column(Modifier.fillMaxSize().background(c.bg)) {
        TopBar(t("settingsTitle"), onBack = { app.pop() })
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).height(40.dp).clip(RoundedCornerShape(12.dp)).background(c.input).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Icon(NxIcons.Search, null, tint = c.muted, modifier = Modifier.size(18.dp))
            Box(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                if (q.isEmpty()) Text(t("search"), color = c.muted, fontSize = 15.sp)
                BasicTextField(q, { q = it }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
            }
            if (q.isNotEmpty()) Icon(NxIcons.Close, null, tint = c.muted, modifier = Modifier.size(16.dp).noRippleClick { q = "" })
        }
        Column(Modifier.verticalScroll(rememberScrollState())) {
            items.filter { term.isEmpty() || it.label.lowercase().contains(term) }.forEach { it2 ->
                NavRow(it2.icon, it2.label) { app.push(Route.SettingsPage(it2.key)) }
            }
            if (term.isNotEmpty()) shortcuts.filter { it.first.lowercase().contains(term) }.forEach { (label, icon, go) -> NavRow(icon, label, onClick = go) }
            if (term.isEmpty()) {
                Divider(Modifier.padding(vertical = 8.dp))
                Text(t("logout"), color = Red, fontSize = 15.sp, modifier = Modifier.fillMaxWidth().clickable { confirmLogout = true }.padding(horizontal = 16.dp, vertical = 14.dp))
            }
            Spacer(Modifier.height(40.dp))
        }
    }
    if (confirmLogout) ConfirmDialog(t("logoutConfirm"), t("logout"), onDismiss = { confirmLogout = false }) { confirmLogout = false; app.logout() }
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
    val title = when {
        key == "invite" -> t("inviteFriends"); key == "notif" -> t("notifSettings"); key == "privacy" -> t("privacy")
        key == "security" -> t("security"); key == "account" -> t("account"); key == "help" -> t("help"); key == "about" -> t("about")
        key == "theme" -> t("theme"); key == "list:block" -> t("blocked"); key == "list:mute" -> t("mutedAccounts"); else -> ""
    }
    Column(Modifier.fillMaxSize().background(c.bg)) {
        TopBar(title, onBack = { app.pop() })
        when {
            key == "invite" -> InvitePage()
            key == "notif" -> NotifPage()
            key == "privacy" -> PrivacyPage()
            key == "security" -> SecurityPage()
            key == "account" -> AccountPage()
            key == "help" -> HelpPage()
            key == "about" -> AboutPage()
            key == "theme" -> ThemePage()
            key.startsWith("list:") -> ListPage(key.removePrefix("list:"))
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
    var choose by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try { st.load(); isPrivate = Api.get("me").optJSONObject("user")?.optBoolean("isPrivate") ?: isPrivate } catch (e: Exception) { app.errToast(e) }
    }
    val s = st.s ?: return Loader()
    fun audLabel(v: String) = when (v) { "following" -> t("peopleYouFollow"); "followers" -> t("followers"); "none" -> t("noOne"); else -> t("everyone") }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        ToggleRow(t("privateToggle"), isPrivate, icon = NxIcons.Lock) { v ->
            isPrivate = v
            scope.launch {
                try { User.from(Api.patch("me", json("isPrivate" to v)).optJSONObject("user"))?.let { app.me = it }; app.profileVersion++ }
                catch (e: Exception) { isPrivate = !v; app.errToast(e) }
            }
        }
        ToggleRow(t("activityStatus"), s.optBoolean("activityStatus", true), icon = NxIcons.Activity) { v ->
            scope.launch { try { st.patch(json("activityStatus" to v)) } catch (e: Exception) { app.errToast(e) } }
        }
        Divider(Modifier.padding(vertical = 6.dp))
        NavRow(NxIcons.Send, t("whoCanMessage"), audLabel(s.optString("messages", "everyone"))) { choose = "messages" }
        NavRow(NxIcons.Comment, t("whoCanComment"), audLabel(s.optString("comments", "everyone"))) { choose = "comments" }
        NavRow(NxIcons.Tagged, t("whoCanMention"), audLabel(s.optString("mentions", "everyone"))) { choose = "mentions" }
        NavRow(NxIcons.Reply, t("whoCanReplyStory"), audLabel(s.optString("storyReplies", "everyone"))) { choose = "storyReplies" }
        Divider(Modifier.padding(vertical = 6.dp))
        NavRow(NxIcons.Block, t("blocked")) { app.push(Route.SettingsPage("list:block")) }
        NavRow(NxIcons.BellOff, t("mutedAccounts")) { app.push(Route.SettingsPage("list:mute")) }
        Spacer(Modifier.height(30.dp))
    }
    choose?.let { k ->
        val opts = if (k == "comments") listOf("everyone", "followers", "none") else listOf("everyone", "following", "none")
        ChoiceDialog(when (k) { "messages" -> t("whoCanMessage"); "comments" -> t("whoCanComment"); "mentions" -> t("whoCanMention"); else -> t("whoCanReplyStory") },
            opts.map { it to audLabel(it) }, s.optString(k, "everyone"), onDismiss = { choose = null }) { v ->
            choose = null
            scope.launch { try { st.patch(json(k to v)) } catch (e: Exception) { app.errToast(e) } }
        }
    }
}

@Composable
private fun ListPage(kind: String) {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val users = remember { mutableStateListOf<User>() }
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(kind) {
        try { users.addAll(Api.get("me/lists/$kind").optJSONArray("users").mapObj { User.from(it) }) } catch (e: Exception) { app.errToast(e) } finally { loaded = true }
    }
    LazyColumn(Modifier.fillMaxSize()) {
        if (kind == "mute") item { Text(t("mutedDesc"), color = Nx.c.muted, fontSize = 13.sp, modifier = Modifier.padding(16.dp)) }
        if (!loaded) item { Loader() }
        if (loaded && users.isEmpty()) item { Text(if (kind == "block") t("noBlocked") else t("noMuted"), color = Nx.c.muted, modifier = Modifier.padding(24.dp)) }
        items(users, key = { it.id }) { u ->
            UserRow(u, onClick = { app.openProfile(u.username) }) {
                NxButton(if (kind == "block") t("unblock") else t("unmute"), {
                    app.scope.launch {
                        try {
                            Api.delete("users/${u.id}/$kind"); users.removeAll { it.id == u.id }
                            toast(ctx, if (kind == "block") t("unblockedToast") else t("unmutedToast"))
                        } catch (e: Exception) { app.errToast(e) }
                    }
                }, primary = false)
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
