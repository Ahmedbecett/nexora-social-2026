package com.ahmedbecetti.nexora.kt.ui.screens

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ahmedbecetti.nexora.kt.BuildConfig
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.Route
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.ApiException
import com.ahmedbecetti.nexora.kt.data.I18n
import com.ahmedbecetti.nexora.kt.data.Notif
import com.ahmedbecetti.nexora.kt.data.Post
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.json
import com.ahmedbecetti.nexora.kt.data.mapObj
import com.ahmedbecetti.nexora.kt.data.parseTime
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.data.timeAgo
import com.ahmedbecetti.nexora.kt.ui.Avatar
import com.ahmedbecetti.nexora.kt.ui.ConfirmDialog
import com.ahmedbecetti.nexora.kt.ui.Divider
import com.ahmedbecetti.nexora.kt.ui.Empty
import com.ahmedbecetti.nexora.kt.ui.FollowButton
import com.ahmedbecetti.nexora.kt.ui.Loader
import com.ahmedbecetti.nexora.kt.ui.NxButton
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.PostCard
import com.ahmedbecetti.nexora.kt.ui.TopBar
import com.ahmedbecetti.nexora.kt.ui.UserRow
import com.ahmedbecetti.nexora.kt.ui.mirrorIfRtl
import com.ahmedbecetti.nexora.kt.ui.theme.Blue
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import com.ahmedbecetti.nexora.kt.ui.theme.Red
import com.ahmedbecetti.nexora.kt.ui.toast
import kotlinx.coroutines.launch

/* ---------------- user lists ---------------- */

@Composable
fun UserListScreen(title: String, path: String, emptyText: String) {
    val app = LocalApp.current
    val users = remember(path) { mutableStateListOf<User>() }
    var loaded by remember(path) { mutableStateOf(false) }
    LaunchedEffect(path) {
        try { users.addAll(Api.get(path).optJSONArray("users").mapObj { User.from(it) }) } catch (e: Exception) { app.errToast(e) } finally { loaded = true }
    }
    Column(Modifier.fillMaxSize().background(Nx.c.bg)) {
        TopBar(title, onBack = { app.pop() })
        LazyColumn(Modifier.fillMaxSize()) {
            if (!loaded) item { Loader() }
            if (loaded && users.isEmpty()) item { Text(emptyText, color = Nx.c.muted, modifier = Modifier.padding(24.dp)) }
            items(users, key = { it.id }) { u ->
                UserRow(u, onClick = { app.openProfile(u.username) }) {
                    if (u.id != app.me?.id && u.followStatus != null) {
                        val st = u.followStatus
                        FollowButton(st, u.followsYou, onClick = {
                            app.scope.launch {
                                try { val ns = app.toggleFollow(u.id, st); val i = users.indexOfFirst { it.id == u.id }; if (i >= 0) users[i] = u.copy(followStatus = ns) }
                                catch (e: Exception) { app.errToast(e) }
                            }
                        })
                    }
                }
            }
        }
    }
}

@Composable
fun FollowListScreen(username: String, kind: String) =
    UserListScreen(t(kind), "users/${Uri.encode(username)}/$kind", t("noFollowersYet"))

@Composable
fun LikesScreen(postId: String) = UserListScreen(t("likesTab"), "posts/$postId/likes", t("noFollowersYet"))

@Composable
fun FollowRequestsScreen() {
    val app = LocalApp.current
    val users = remember { mutableStateListOf<User>() }
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        try { users.addAll(Api.get("follow-requests").optJSONArray("users").mapObj { User.from(it) }) } catch (e: Exception) { app.errToast(e) } finally { loaded = true }
    }
    fun act(u: User, action: String) {
        users.removeAll { it.id == u.id }
        app.scope.launch { try { Api.post("follow-requests/${u.id}/$action"); app.refreshBadges() } catch (e: Exception) { app.errToast(e) } }
    }
    Column(Modifier.fillMaxSize().background(Nx.c.bg)) {
        TopBar(t("followRequests"), onBack = { app.pop() })
        LazyColumn {
            if (!loaded) item { Loader() }
            if (loaded && users.isEmpty()) item { Text(t("noRequests"), color = Nx.c.muted, modifier = Modifier.padding(24.dp)) }
            items(users, key = { it.id }) { u ->
                UserRow(u, onClick = { app.openProfile(u.username) }) {
                    NxButton(t("confirm"), { act(u, "accept") })
                    Spacer(Modifier.width(6.dp))
                    NxButton(t("delete"), { act(u, "decline") }, primary = false)
                }
            }
        }
    }
}

/* ---------------- post detail ---------------- */

@Composable
fun PostDetailScreen(id: String, initial: Post?, active: Boolean) {
    val app = LocalApp.current
    var post by remember(id) { mutableStateOf(initial) }
    var error by remember(id) { mutableStateOf<String?>(null) }
    LaunchedEffect(id) {
        try { post = Post.from(Api.get("posts/$id").getJSONObject("post")) } catch (e: ApiException) { if (post == null) error = I18n.err(e.code) } catch (_: Exception) {}
    }
    Column(Modifier.fillMaxSize().background(Nx.c.bg)) {
        TopBar(t("posts"), onBack = { app.pop() })
        val p = post
        when {
            p != null -> Column(Modifier.verticalScroll(rememberScrollState())) {
                PostCard(p, onChange = { post = it }, onDeleted = { app.pop() }, videoActive = active)
            }
            error != null -> Empty(NxIcons.Image, error!!)
            else -> Loader()
        }
    }
}

/* ---------------- notifications ---------------- */

@Composable
fun NotificationsScreen() {
    val app = LocalApp.current
    val c = Nx.c
    val list = remember { mutableStateListOf<Notif>() }
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        try {
            list.addAll(Api.get("notifications").optJSONArray("notifications").mapObj { Notif.from(it) })
            Api.post("notifications/read"); app.refreshBadges()
        } catch (e: Exception) { app.errToast(e) } finally { loaded = true }
    }
    val now = System.currentTimeMillis()
    val groups = remember(list.toList()) {
        list.groupBy {
            val age = now - parseTime(it.createdAt)
            when { age < 86_400_000L -> "today"; age < 7 * 86_400_000L -> "thisWeek"; else -> "earlier" }
        }
    }
    Column(Modifier.fillMaxSize().background(c.bg)) {
        TopBar(t("notifications"), onBack = { app.pop() })
        LazyColumn(Modifier.fillMaxSize()) {
            if (app.requestBadge > 0) item {
                Row(Modifier.fillMaxWidth().clickable { app.push(Route.FollowRequests) }.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(44.dp).clip(RoundedCornerShape(22.dp)).background(c.sep), contentAlignment = Alignment.Center) {
                        Icon(NxIcons.UserPlus, null, tint = c.text, modifier = Modifier.size(22.dp))
                    }
                    Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                        Text(t("followRequests"), fontWeight = FontWeight.SemiBold, color = c.text)
                        Text("${app.requestBadge}", color = c.muted, fontSize = 13.sp)
                    }
                    Box(Modifier.size(8.dp).clip(RoundedCornerShape(4.dp)).background(Red))
                    Icon(NxIcons.Chevron, null, tint = c.muted, modifier = Modifier.padding(start = 8.dp).size(18.dp).mirrorIfRtl(NxIcons.Chevron))
                }
            }
            if (!loaded) item { Loader() }
            if (loaded && list.isEmpty()) item { Empty(NxIcons.Heart, t("noNotifications"), t("noNotificationsSub")) }
            for (k in listOf("today", "thisWeek", "earlier")) {
                val g = groups[k] ?: continue
                item(key = "h:$k") { Text(t(k), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = c.text, modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 6.dp)) }
                items(g, key = { "n:" + it.id }) { n -> NotifRow(n) { st -> val i = list.indexOfFirst { it.id == n.id }; if (i >= 0) list[i] = n.copy(followStatus = st) } }
            }
        }
    }
}

@Composable
private fun NotifRow(n: Notif, onStatus: (String) -> Unit) {
    val app = LocalApp.current
    val c = Nx.c
    val msg = when (n.type) {
        "like" -> t("nLike"); "comment" -> t("nComment", "t" to (n.text ?: "")); "reply" -> t("nReply", "t" to (n.text ?: ""))
        "comment_like" -> t("nCommentLike", "t" to (n.text ?: "")); "mention" -> t("nMention", "t" to (n.text ?: ""))
        "follow" -> t("nFollow"); "follow_request" -> t("nRequest"); "follow_accepted" -> t("nAccepted"); "repost" -> t("nRepost")
        else -> n.text ?: ""
    }
    Row(
        Modifier.fillMaxWidth().clickable { if (n.postId != null) app.push(Route.PostDetail(n.postId.toString())) else app.openProfile(n.actor.username) }
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(n.actor.avatarUrl, 44.dp, onClick = { app.openProfile(n.actor.username) })
        Text(buildAnnotatedString {
            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(n.actor.username) }
            append(" $msg ")
            withStyle(SpanStyle(color = c.muted)) { append(timeAgo(n.createdAt)) }
        }, fontSize = 14.sp, color = c.text, maxLines = 3, modifier = Modifier.weight(1f).padding(horizontal = 12.dp))
        if (n.postThumb != null) AsyncImage(n.postThumb, null, contentScale = ContentScale.Crop, modifier = Modifier.size(44.dp).clip(RoundedCornerShape(6.dp)).background(c.sep))
        else if (n.type == "follow" || n.type == "follow_accepted") FollowButton(n.followStatus, n.type == "follow", onClick = {
            val st = n.followStatus
            app.scope.launch { try { onStatus(app.toggleFollow(n.actor.id, st)) } catch (e: Exception) { app.errToast(e) } }
        })
    }
}

/* ---------------- edit profile ---------------- */

@Composable
fun EditProfileScreen() {
    val app = LocalApp.current
    val c = Nx.c
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var loaded by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var bio by remember { mutableStateOf("") }
    var website by remember { mutableStateOf("") }
    var isPrivate by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        try {
            val u = Api.get("me").getJSONObject("user")
            name = u.optString("fullName"); username = u.optString("username"); bio = if (u.isNull("bio")) "" else u.optString("bio")
            website = if (u.isNull("website")) "" else u.optString("website"); isPrivate = u.optBoolean("isPrivate")
        } catch (e: Exception) { app.errToast(e) } finally { loaded = true }
    }
    Column(Modifier.fillMaxSize().background(c.bg).imePadding()) {
        TopBar(t("editProfile"), onBack = { app.pop() }) {
            Text(t("done"), color = Blue, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, modifier = Modifier.padding(horizontal = 14.dp).clickable(enabled = loaded && !saving) {
                saving = true
                scope.launch {
                    try {
                        val r = Api.patch("me", json("fullName" to name.trim(), "username" to username.trim().lowercase(), "bio" to bio.trim(), "website" to website.trim(), "isPrivate" to isPrivate))
                        User.from(r.optJSONObject("user"))?.let { app.me = it }
                        app.profileVersion++; toast(ctx, t("saved2")); app.pop()
                    } catch (e: Exception) { app.errToast(e) } finally { saving = false }
                }
            })
        }
        if (!loaded) { Loader(); return@Column }
        Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp)) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { Avatar(app.me?.avatarUrl, 86.dp) }
            Spacer(Modifier.height(16.dp))
            EditField(t("fullName"), name) { name = it }
            EditField(t("username"), username) { username = it.lowercase().replace(" ", "") }
            EditField(t("bio"), bio, single = false) { bio = it }
            EditField(t("website"), website) { website = it }
            Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(t("privateToggle"), color = c.text, fontSize = 15.sp, modifier = Modifier.weight(1f))
                Switch(isPrivate, { isPrivate = it }, colors = SwitchDefaults.colors(checkedTrackColor = Blue, checkedThumbColor = Color.White, uncheckedThumbColor = Color.White, uncheckedTrackColor = c.border, uncheckedBorderColor = Color.Transparent, checkedBorderColor = Color.Transparent))
            }
        }
    }
}

@Composable
private fun EditField(label: String, value: String, single: Boolean = true, onChange: (String) -> Unit) {
    val c = Nx.c
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(RoundedCornerShape(12.dp)).background(c.input).padding(horizontal = 14.dp, vertical = 8.dp)) {
        Text(label, color = c.muted, fontSize = 12.sp)
        BasicTextField(value, onChange, singleLine = single, maxLines = if (single) 1 else 5, textStyle = TextStyle(color = c.text, fontSize = 15.sp),
            cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth().padding(top = 2.dp))
    }
}

/* ---------------- settings ---------------- */

@Composable
fun SettingsScreen() {
    val app = LocalApp.current
    val c = Nx.c
    var confirmLogout by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().background(c.bg)) {
        TopBar(t("settings"), onBack = { app.pop() })
        Column(Modifier.verticalScroll(rememberScrollState())) {
            SectionTitle(t("yourAppMedia"))
            SettingRow(NxIcons.Moon, t("theme"), when (app.themeMode) { "dark" -> t("themeDark"); "light" -> t("themeLight"); else -> t("themeSystem") }) {
                app.setTheme(when (app.themeMode) { "system" -> "dark"; "dark" -> "light"; else -> "system" })
            }
            SettingRow(NxIcons.Globe, t("languageSetting"), I18n.languages.firstOrNull { it.first == I18n.lang }?.second ?: I18n.lang) { app.push(Route.Language) }
            SectionTitle(t("howYouUse"))
            SettingRow(NxIcons.Bookmark, t("saved"), null) { app.push(Route.Saved) }
            SettingRow(NxIcons.UserPlus, t("followRequests"), if (app.requestBadge > 0) "${app.requestBadge}" else null) { app.push(Route.FollowRequests) }
            SettingRow(NxIcons.Heart, t("notifications"), null) { app.push(Route.Notifications) }
            SectionTitle(t("moreInfoSupport"))
            SettingRow(NxIcons.Info, t("about"), t("aboutText", "v" to BuildConfig.VERSION_NAME)) {}
            Divider(Modifier.padding(vertical = 8.dp))
            SectionTitle(t("loginSection"))
            Text(t("logout"), color = Red, fontSize = 16.sp, modifier = Modifier.fillMaxWidth().clickable { confirmLogout = true }.padding(horizontal = 16.dp, vertical = 14.dp))
            Spacer(Modifier.height(40.dp))
        }
    }
    if (confirmLogout) ConfirmDialog(t("logoutConfirm"), t("logout"), onDismiss = { confirmLogout = false }) { confirmLogout = false; app.logout() }
}

@Composable
private fun SectionTitle(s: String) = Text(s, color = Nx.c.muted, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 16.dp, top = 18.dp, bottom = 4.dp))

@Composable
private fun SettingRow(icon: ImageVector, label: String, value: String?, onClick: () -> Unit) {
    val c = Nx.c
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = c.text, modifier = Modifier.size(24.dp))
        Text(label, color = c.text, fontSize = 16.sp, modifier = Modifier.weight(1f).padding(horizontal = 14.dp))
        if (value != null) Text(value, color = c.muted, fontSize = 14.sp, maxLines = 1)
        Icon(NxIcons.Chevron, null, tint = c.muted, modifier = Modifier.padding(start = 6.dp).size(16.dp).mirrorIfRtl(NxIcons.Chevron))
    }
}

@Composable
fun LanguageScreen() {
    val app = LocalApp.current
    val c = Nx.c
    Column(Modifier.fillMaxSize().background(c.bg)) {
        TopBar(t("languageSetting"), onBack = { app.pop() })
        LazyColumn {
            items(I18n.languages, key = { it.first }) { (code, native, english) ->
                Row(Modifier.fillMaxWidth().clickable { app.setLanguage(code) }.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(native, color = c.text, fontSize = 16.sp)
                        Text(english, color = c.muted, fontSize = 13.sp)
                    }
                    if (code == I18n.lang) Icon(NxIcons.Check, null, tint = Blue, modifier = Modifier.size(22.dp))
                }
            }
        }
    }
}

@Composable
fun SavedScreen() {
    val app = LocalApp.current
    val posts = remember { mutableStateListOf<Post>() }
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { try { posts.addAll(Post.list(Api.get("me/saved"))) } catch (e: Exception) { app.errToast(e) } finally { loaded = true } }
    Column(Modifier.fillMaxSize().background(Nx.c.bg)) {
        TopBar(t("saved"), onBack = { app.pop() })
        androidx.compose.foundation.lazy.grid.LazyVerticalGrid(androidx.compose.foundation.lazy.grid.GridCells.Fixed(3)) {
            if (!loaded) item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(maxLineSpan) }) { Loader() }
            if (loaded && posts.isEmpty()) item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(maxLineSpan) }) { Empty(NxIcons.Bookmark, t("saved"), t("noSaved")) }
            postGrid(app, posts)
        }
    }
}

