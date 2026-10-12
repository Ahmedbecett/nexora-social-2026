package com.ahmedbecetti.nexora.kt.ui.screens

import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.ExperimentalLayoutApi

import com.ahmedbecetti.nexora.kt.ui.rememberMediaPicker
import com.ahmedbecetti.nexora.kt.ui.PickKind
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.navigationBarsPadding

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.Route
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.ApiException
import com.ahmedbecetti.nexora.kt.data.I18n
import com.ahmedbecetti.nexora.kt.data.Post
import com.ahmedbecetti.nexora.kt.data.Profile
import com.ahmedbecetti.nexora.kt.data.Story
import com.ahmedbecetti.nexora.kt.data.StoryGroup
import com.ahmedbecetti.nexora.kt.data.fmtNum
import com.ahmedbecetti.nexora.kt.data.json
import com.ahmedbecetti.nexora.kt.data.mapObj
import com.ahmedbecetti.nexora.kt.data.str
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.Avatar
import com.ahmedbecetti.nexora.kt.ui.Empty
import com.ahmedbecetti.nexora.kt.ui.FollowButton
import com.ahmedbecetti.nexora.kt.ui.IconBtn
import com.ahmedbecetti.nexora.kt.ui.Loader
import com.ahmedbecetti.nexora.kt.ui.NxButton
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.Ring
import com.ahmedbecetti.nexora.kt.ui.SheetItem
import com.ahmedbecetti.nexora.kt.ui.VerifiedBadge
import com.ahmedbecetti.nexora.kt.ui.noRippleClick
import com.ahmedbecetti.nexora.kt.ui.profileLink
import com.ahmedbecetti.nexora.kt.ui.richText
import com.ahmedbecetti.nexora.kt.ui.shareText
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import com.ahmedbecetti.nexora.kt.ui.theme.Red
import com.ahmedbecetti.nexora.kt.ui.toast
import kotlinx.coroutines.launch

private data class Highlight(val title: String, val items: List<Story>)

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(username: String, isTab: Boolean, active: Boolean) {
    val app = LocalApp.current
    val c = Nx.c
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var prof by remember(username) { mutableStateOf<Profile?>(null) }
    var error by remember(username) { mutableStateOf<String?>(null) }
    var tab by rememberSaveable(username) { mutableStateOf(0) }
    val posts = remember(username) { mutableStateListOf<Post>() }
    val reels = remember(username) { mutableStateListOf<Post>() }
    val tagged = remember(username) { mutableStateListOf<Post>() }
    val reposts = remember(username) { mutableStateListOf<Post>() }
    var noteDialog by remember { mutableStateOf(false) }
    var linkDialog by remember { mutableStateOf(false) }
    val highlights = remember(username) { mutableStateListOf<Highlight>() }
    var postsLoaded by remember(username) { mutableStateOf(false) }
    var extraLoaded by remember(username) { mutableStateOf(setOf<Int>()) }
    var refreshing by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var accounts by remember { mutableStateOf(false) }
    var create by remember { mutableStateOf(false) }
    val pickPost = rememberMediaPicker(multi = true) { uris -> app.push(Route.Create(uris, reel = false)) }
    val pickReel = rememberMediaPicker(multi = false, kind = PickKind.Video) { uris -> app.push(Route.Create(uris, reel = true)) }
    val pickStory = rememberMediaPicker(multi = false) { uris -> app.addStory(uris.first()) }
    var storyGroup by remember(username) { mutableStateOf<StoryGroup?>(null) }
    val grid = rememberLazyGridState()

    suspend fun load() {
        try {
            val p = Profile.from(Api.get("users/" + Uri.encode(username))) ?: return
            prof = p; error = null
            if (p.isMe) app.me = app.me?.copy(fullName = p.user.fullName, avatarUrl = p.user.avatarUrl, username = p.user.username, verified = p.user.verified)
            if (p.canView) {
                val r = Api.get("users/${Uri.encode(username)}/posts")
                posts.clear(); posts.addAll(Post.list(r))
                try {
                    val h = Api.get("users/${Uri.encode(username)}/highlights")
                    highlights.clear()
                    highlights.addAll(h.optJSONArray("highlights").mapObj { o ->
                        val items = o.optJSONArray("items").mapObj { s -> s.str("url")?.let { Story(0, it, s.optString("type", "image"), s.str("createdAt"), true) } }
                        if (items.isEmpty()) null else Highlight(o.optString("title"), items)
                    })
                } catch (_: Exception) {}
            }
            if (p.hasStory) try {
                storyGroup = Api.get("stories").optJSONArray("tray").mapObj { StoryGroup.from(it) }.firstOrNull { it.user.id == p.user.id }
            } catch (_: Exception) {} else storyGroup = null
        } catch (e: ApiException) { error = I18n.err(e.code) } catch (e: Exception) { error = I18n.err("network") }
        postsLoaded = true
    }
    LaunchedEffect(username, if (isTab) app.profileVersion else 0) { load() }
    LaunchedEffect(app.tabReselect) { if (isTab && active && app.tabReselect > 0) grid.animateScrollToItem(0) }
    LaunchedEffect(tab, prof?.canView) {
        if (prof?.canView != true || tab == 0 || tab in extraLoaded) return@LaunchedEffect
        try {
            if (tab == 1) { reels.clear(); reels.addAll(Post.list(Api.get("users/${Uri.encode(username)}/posts?kind=reel"))) }
            if (tab == 2) { reposts.clear(); reposts.addAll(Post.list(Api.get("users/${Uri.encode(username)}/reposts"))) }
            if (tab == 3) { tagged.clear(); tagged.addAll(Post.list(Api.get("users/${Uri.encode(username)}/tagged"))) }
            extraLoaded = extraLoaded + tab
        } catch (_: Exception) {}
    }

    val p = prof
    Column(Modifier.fillMaxSize().background(c.bg)) {
        // top bar (IG: + · lock username ▾ • · ☰)
        Box(Modifier.fillMaxWidth().statusBarsPadding().height(56.dp).padding(horizontal = 4.dp)) {
            if (!isTab) IconBtn(NxIcons.Back, { app.pop() }, size = 26.dp, modifier = Modifier.align(Alignment.CenterStart))
            else if (p?.isMe == true) IconBtn(NxIcons.Plus, { create = true }, size = 28.dp, modifier = Modifier.align(Alignment.CenterStart))
            val otherBadges = app.accountBadges.filterKeys { it != app.me?.id }.values.any { it.first + it.second > 0 }
            Row(Modifier.align(Alignment.Center).fillMaxWidth(0.66f).wrapContentWidth().noRippleClick { if (p?.isMe == true) { accounts = true } },
                verticalAlignment = Alignment.CenterVertically) {
                if (p?.user?.isPrivate == true) Icon(NxIcons.Lock, null, tint = c.text, modifier = Modifier.padding(end = 6.dp).size(18.dp))
                Text(username, fontSize = 21.sp, fontWeight = FontWeight.Bold, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (p?.user?.verified == true) VerifiedBadge(16.dp)
                if (p?.isMe == true) {
                    Icon(NxIcons.Down, null, tint = c.text, modifier = Modifier.padding(start = 6.dp).size(18.dp))
                    if (otherBadges) Box(Modifier.padding(start = 8.dp).size(8.dp).clip(CircleShape).background(Red))
                }
            }
            Row(Modifier.align(Alignment.CenterEnd)) {
                if (p?.isMe == true) IconBtn(NxIcons.Menu, { app.push(Route.Settings) }, size = 28.dp)
                else if (p != null) IconBtn(NxIcons.MoreH, { menu = true }, size = 26.dp)
            }
        }
        if (p == null) {
            if (error != null) Empty(NxIcons.Account, error!!, null) else Loader(Modifier.padding(top = 40.dp))
            return@Column
        }
        PullToRefreshBox(isRefreshing = refreshing, onRefresh = { refreshing = true; scope.launch { extraLoaded = emptySet(); load(); refreshing = false } }) {
            LazyVerticalGrid(GridCells.Fixed(3), state = grid, modifier = Modifier.fillMaxSize()) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                        Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(top = 4.dp)) {
                            // avatar with the note bubble on top and the + (add story) badge — like IG
                            Box(Modifier.width(100.dp).height(124.dp)) {
                                Box(Modifier.align(Alignment.BottomStart)) {
                                    Avatar(p.user.avatarUrl, 92.dp, ring = if (storyGroup != null) ringOf(storyGroup) else Ring.None,
                                        onClick = { storyGroup?.let { app.push(Route.Stories(listOf(it), 0)) } ?: run { if (p.isMe) pickStory() } })
                                    if (p.isMe) Box(Modifier.align(Alignment.BottomEnd).offset(x = 2.dp, y = 2.dp).size(28.dp).clip(CircleShape).background(c.bg).padding(2.5.dp)
                                        .clip(CircleShape).background(c.text).noRippleClick { pickStory() }, contentAlignment = Alignment.Center) {
                                        Icon(NxIcons.Plus, null, tint = c.bg, modifier = Modifier.size(16.dp))
                                    }
                                }
                                val note = if (p.isMe) app.me?.note ?: p.note else p.note
                                if (p.isMe || !note.isNullOrBlank()) NoteBubble(note, Modifier.align(Alignment.TopStart).padding(start = 2.dp)) { if (p.isMe) noteDialog = true }
                            }
                            Column(Modifier.weight(1f).padding(start = 16.dp, bottom = 14.dp)) {
                                if (!p.user.fullName.isNullOrBlank()) Text(p.user.fullName!!, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = c.text, maxLines = 1,
                                    overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(bottom = 6.dp))
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Stat(p.posts, t("posts")) {}
                                    Stat(p.followers, t("followers")) { if (p.canView) app.push(Route.FollowList(p.user.username, "followers")) }
                                    Stat(p.following, t("following")) { if (p.canView) app.push(Route.FollowList(p.user.username, "following")) }
                                    Spacer(Modifier.width(4.dp))
                                }
                            }
                        }
                        if (!p.user.bio.isNullOrBlank()) Text(richText(app, p.user.bio!!, com.ahmedbecetti.nexora.kt.ui.theme.Blue), fontSize = 14.sp, color = c.text, modifier = Modifier.padding(top = 2.dp))
                        val links = (listOfNotNull(p.user.website?.takeIf { it.isNotBlank() }?.let { it to it }) + p.links).distinctBy { it.second }
                        if (links.isNotEmpty() || p.isMe) androidx.compose.foundation.layout.FlowRow(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            links.forEach { (title, url) ->
                                LinkChip(NxIcons.Link, (title.ifBlank { url }).removePrefix("https://").removePrefix("http://").removeSuffix("/")) {
                                    val u = if (url.startsWith("http")) url else "https://$url"
                                    try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: Exception) {}
                                }
                            }
                            if (p.isMe && p.links.size < 5) LinkChip(NxIcons.Plus, t("add"), muted = true) { linkDialog = true }
                        }
                        if (!p.isMe && p.mutuals.isNotEmpty()) Text(t("mutualsFollowedBy", "u" to p.mutuals.joinToString(", ")), fontSize = 13.sp, color = c.muted, modifier = Modifier.padding(top = 6.dp))
                        Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            if (p.isMe) {
                                NxButton(t("editProfile"), { app.push(Route.EditProfile) }, Modifier.weight(1f), primary = false, height = 38.dp, radius = 10.dp, fontSize = 15.sp)
                                NxButton(t("shareProfile"), { shareText(ctx, profileLink(p.user.username)) }, Modifier.weight(1f), primary = false, height = 38.dp, radius = 10.dp, fontSize = 15.sp)
                            } else {
                                FollowButton(p.followStatus, p.followsYou, onClick = {
                                    val st = p.followStatus
                                    scope.launch {
                                        try {
                                            val ns = app.toggleFollow(p.user.id, st)
                                            prof = p.copy(followStatus = ns, followers = p.followers + when { ns == "accepted" && st != "accepted" -> 1; st == "accepted" && ns != "accepted" -> -1; else -> 0 })
                                            if (ns == "accepted" && !p.canView) load()
                                        } catch (e: Exception) { app.errToast(e) }
                                    }
                                }, modifier = Modifier.weight(1f))
                                if (p.canMessage) NxButton(t("message"), { app.push(Route.Chat(p.user)) }, Modifier.weight(1f), primary = false)
                            }
                            Box(Modifier.size(38.dp).clip(RoundedCornerShape(10.dp)).background(c.btn).noRippleClick { app.push(Route.Discover) }, contentAlignment = Alignment.Center) {
                                Icon(NxIcons.UserPlus, null, tint = c.text, modifier = Modifier.size(20.dp))
                            }
                        }
                        if (highlights.isNotEmpty()) LazyRow(contentPadding = PaddingValues(vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(highlights) { h ->
                                Column(Modifier.width(76.dp).noRippleClick {
                                    app.push(Route.Stories(listOf(StoryGroup(p.user, h.items, true, false)), 0))
                                }, horizontalAlignment = Alignment.CenterHorizontally) {
                                    Box(Modifier.size(68.dp).border(1.dp, c.border, CircleShape).padding(3.dp).clip(CircleShape).background(c.sep), contentAlignment = Alignment.Center) {
                                        val first = h.items.first()
                                        if (first.type == "video") Icon(NxIcons.Play, null, tint = c.muted, modifier = Modifier.size(22.dp))
                                        else AsyncImage(first.url, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                                    }
                                    Text(h.title, fontSize = 12.sp, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 5.dp))
                                }
                            }
                        } else Spacer(Modifier.height(12.dp))
                    }
                }
                if (!p.canView) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Column {
                            com.ahmedbecetti.nexora.kt.ui.Divider()
                            Empty(NxIcons.Lock, t("privateAccount"), t("privateSub"))
                        }
                    }
                } else {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Row(Modifier.fillMaxWidth()) {
                            listOf(NxIcons.Grid, NxIcons.Reels, NxIcons.Repost, NxIcons.Tagged).forEachIndexed { i, ic ->
                                Column(Modifier.weight(1f).noRippleClick { tab = i }, horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(ic, null, tint = if (tab == i) c.text else c.muted, modifier = Modifier.padding(vertical = 12.dp).size(26.dp))
                                    Box(Modifier.fillMaxWidth(0.6f).height(2.dp).background(if (tab == i) c.text else Color.Transparent))
                                }
                            }
                        }
                    }
                    val list = when (tab) { 0 -> posts; 1 -> reels; 2 -> reposts; else -> tagged }
                    val loadedTab = if (tab == 0) postsLoaded else tab in extraLoaded
                    if (!loadedTab) item(span = { GridItemSpan(maxLineSpan) }) { Loader() }
                    else if (list.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                        when (tab) {
                            0 -> Empty(NxIcons.Camera, t("noPosts"), if (p.isMe) t("noPostsSub") else null)
                            1 -> Empty(NxIcons.Reels, t("noReels"))
                            2 -> Empty(NxIcons.Repost, t("noReposts"))
                            else -> Empty(NxIcons.Tagged, t("noTagged"), t("noTaggedSub"))
                        }
                    }
                    postGrid(app, list, tall = tab == 1)
                }
            }
        }
    }
    if (menu && p != null) ModalBottomSheet(onDismissRequest = { menu = false }, containerColor = c.elevated) {
        Column(Modifier.padding(bottom = 28.dp)) {
            SheetItem(NxIcons.Link, t("copyLink")) {
                val cm = ctx.getSystemService(android.content.ClipboardManager::class.java)
                cm.setPrimaryClip(android.content.ClipData.newPlainText("link", profileLink(p.user.username))); toast(ctx, t("linkCopied")); menu = false
            }
            SheetItem(NxIcons.Send, t("shareProfile")) { shareText(ctx, profileLink(p.user.username)); menu = false }
            SheetItem(NxIcons.Flag, t("report"), danger = true) {
                scope.launch { try { Api.post("reports", json("userId" to p.user.id, "reason" to "profile")); toast(ctx, t("reported")) } catch (e: Exception) { app.errToast(e) } }
                menu = false
            }
            SheetItem(NxIcons.Shield, t("block"), danger = true) {
                scope.launch {
                    try { Api.post("users/${p.user.id}/block"); toast(ctx, t("blockedToast")); app.pop() } catch (e: Exception) { app.errToast(e) }
                }
                menu = false
            }
        }
    }
    if (accounts) AccountsSheet(onDismiss = { accounts = false })
    if (noteDialog) NoteDialog(onDismiss = { noteDialog = false })
    if (linkDialog && p != null) LinksDialog(p.links, onDismiss = { linkDialog = false }) { app.scope.launch { load() } }
    if (create) ModalBottomSheet(onDismissRequest = { create = false }, containerColor = c.elevated) {
        Column(Modifier.navigationBarsPadding().padding(bottom = 16.dp)) {
            Text(t("create"), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = c.text, modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 8.dp))
            com.ahmedbecetti.nexora.kt.ui.Divider()
            SheetItem(NxIcons.Reels, t("newReel")) { create = false; pickReel() }
            SheetItem(NxIcons.Grid, t("newPost")) { create = false; pickPost() }
            SheetItem(NxIcons.Plus, t("newStory")) { create = false; pickStory() }
            SheetItem(NxIcons.Star, t("newHighlight")) { create = false; app.push(Route.NewHighlight) }
        }
    }
}

@Composable
private fun Stat(n: Int, label: String, onClick: () -> Unit) {
    val c = Nx.c
    Column(horizontalAlignment = Alignment.Start, modifier = Modifier.noRippleClick(onClick)) {
        Text(fmtNum(n), fontWeight = FontWeight.Bold, fontSize = 18.sp, color = c.text)
        Text(label, fontSize = 15.sp, color = c.text)
    }
}

