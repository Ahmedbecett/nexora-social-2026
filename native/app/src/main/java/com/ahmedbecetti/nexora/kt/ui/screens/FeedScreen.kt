package com.ahmedbecetti.nexora.kt.ui.screens

import androidx.compose.material3.Icon
import androidx.compose.ui.graphics.Color
import com.ahmedbecetti.nexora.kt.ui.noRippleClick

import com.ahmedbecetti.nexora.kt.ui.rememberMediaPicker
import com.ahmedbecetti.nexora.kt.ui.Ring
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.sizeIn

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.Route
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.Post
import com.ahmedbecetti.nexora.kt.data.StoryGroup
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.mapObj
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.Avatar
import com.ahmedbecetti.nexora.kt.ui.Empty
import com.ahmedbecetti.nexora.kt.ui.FollowButton
import com.ahmedbecetti.nexora.kt.ui.IconBtn
import com.ahmedbecetti.nexora.kt.ui.Loader
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.PostCard
import com.ahmedbecetti.nexora.kt.ui.UserNameText
import com.ahmedbecetti.nexora.kt.ui.Wordmark
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import com.ahmedbecetti.nexora.kt.ui.theme.Red
import kotlinx.coroutines.launch

fun ringOf(g: StoryGroup?): Ring = when {
    g == null || g.stories.isEmpty() -> Ring.None
    g.allSeen -> Ring.Seen
    g.close -> Ring.Close
    else -> Ring.Unseen
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(active: Boolean) {
    val app = LocalApp.current
    val c = Nx.c
    val scope = rememberCoroutineScope()
    val posts = remember { mutableStateListOf<Post>() }
    val tray = app.storyTray
    val suggestions = remember { mutableStateListOf<User>() }
    var cursor by remember { mutableStateOf<Long?>(null) }
    var loaded by remember { mutableStateOf(false) }
    var loadingMore by remember { mutableStateOf(false) }
    var refreshing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val list = rememberLazyListState()

    suspend fun loadStories() = app.loadStories()
    val pickStory = rememberMediaPicker(multi = false) { uris -> app.addStory(uris.first()) }
    suspend fun loadSuggestions() {
        try { val r = Api.get("suggestions"); suggestions.clear(); suggestions.addAll(r.optJSONArray("users").mapObj { User.from(it) }) } catch (_: Exception) {}
    }
    suspend fun refresh() {
        try {
            error = null
            val r = Api.get("feed")
            posts.clear(); posts.addAll(Post.list(r)); cursor = r.optLong("nextCursor").takeIf { !r.isNull("nextCursor") && it > 0 }
        } catch (e: Exception) { if (posts.isEmpty()) error = com.ahmedbecetti.nexora.kt.data.I18n.err((e as? com.ahmedbecetti.nexora.kt.data.ApiException)?.code) }
        loaded = true
        scope.launch { loadStories() }
        scope.launch { loadSuggestions() }
    }
    suspend fun more() {
        val cur = cursor ?: return
        if (loadingMore) return
        loadingMore = true
        try {
            val r = Api.get("feed?cursor=$cur")
            val have = posts.map { it.id }.toHashSet()
            posts.addAll(Post.list(r).filter { it.id !in have })
            cursor = r.optLong("nextCursor").takeIf { !r.isNull("nextCursor") && it > 0 }
        } catch (_: Exception) {} finally { loadingMore = false }
    }

    LaunchedEffect(app.feedVersion) { refresh() }
    LaunchedEffect(app.tabReselect) {
        if (app.tabReselect > 0 && active) { list.animateScrollToItem(0); refresh() }
    }
    LaunchedEffect(list) {
        snapshotFlow { list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }.collect { last ->
            if (last >= list.layoutInfo.totalItemsCount - 4) more()
        }
    }
    // the post whose centre is closest to the viewport centre plays its video
    val activeKey by remember {
        derivedStateOf {
            val info = list.layoutInfo
            val center = (info.viewportStartOffset + info.viewportEndOffset) / 2
            info.visibleItemsInfo.filter { (it.key as? String)?.startsWith("p:") == true }
                .minByOrNull { kotlin.math.abs(it.offset + it.size / 2 - center) }?.key as? String
        }
    }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().height(56.dp).padding(start = 14.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) { Wordmark(size = 36.sp) }
            Box {
                IconBtn(NxIcons.Heart, { app.push(Route.Notifications) }, size = 27.dp)
                if (app.notifBadge > 0 || app.requestBadge > 0) Box(Modifier.align(Alignment.TopEnd).offset(x = (-9).dp, y = 10.dp).size(8.dp).clip(CircleShape).background(Red))
            }
            Box {
                IconBtn(NxIcons.Send, { app.push(Route.Inbox) }, size = 26.dp)
                if (app.msgBadge > 0) Box(
                    Modifier.align(Alignment.TopEnd).offset(x = (-2).dp, y = 4.dp).sizeIn(minWidth = 18.dp, minHeight = 18.dp)
                        .clip(CircleShape).background(Red).border(2.dp, c.bg, CircleShape).padding(horizontal = 4.dp),
                    contentAlignment = Alignment.Center,
                ) { Text(if (app.msgBadge > 9) "9+" else "${app.msgBadge}", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
            }
        }
        app.uploading?.let { p ->
            androidx.compose.material3.LinearProgressIndicator(progress = { p }, color = com.ahmedbecetti.nexora.kt.ui.theme.Blue, trackColor = c.sep,
                modifier = Modifier.fillMaxWidth().height(2.dp))
        }
        PullToRefreshBox(isRefreshing = refreshing, onRefresh = { refreshing = true; scope.launch { refresh(); refreshing = false } }, modifier = Modifier.weight(1f)) {
            LazyColumn(state = list, modifier = Modifier.fillMaxSize()) {
                item(key = "stories") {
                    val me = app.me
                    val mine = tray.firstOrNull { it.user.id == me?.id }
                    val others = tray.filter { it.user.id != me?.id }
                    LazyRow(contentPadding = PaddingValues(horizontal = 6.dp, vertical = 8.dp)) {
                        item(key = "me") {
                            Column(Modifier.width(86.dp).padding(horizontal = 3.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Box(Modifier.size(80.dp)) {
                                    Avatar(me?.avatarUrl, 80.dp, ring = if (mine != null) ringOf(mine) else Ring.None, onClick = {
                                        if (mine != null) app.push(Route.Stories(listOfNotNull(mine) + others, 0)) else pickStory()
                                    })
                                    Box(Modifier.align(Alignment.BottomEnd).offset(x = (-2).dp, y = (-2).dp).size(24.dp).clip(CircleShape).background(c.bg).padding(2.dp)
                                        .clip(CircleShape).background(com.ahmedbecetti.nexora.kt.ui.theme.Blue).noRippleClick { pickStory() }, contentAlignment = Alignment.Center) {
                                        Icon(NxIcons.Plus, null, tint = Color.White, modifier = Modifier.size(14.dp))
                                    }
                                }
                                Text(t("yourStory"), fontSize = 12.sp, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
                            }
                        }
                        itemsIndexed(others, key = { _, g -> g.user.id }) { i, g ->
                            Column(Modifier.width(86.dp).padding(horizontal = 3.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Avatar(g.user.avatarUrl, 80.dp, ring = ringOf(g), onClick = { app.push(Route.Stories(others, i)) })
                                Text(g.user.username, fontSize = 12.sp, color = c.text,
                                    maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
                            }
                        }
                    }
                    com.ahmedbecetti.nexora.kt.ui.Divider()
                }
                if (!loaded) item { Loader(Modifier.padding(top = 40.dp)) }
                error?.let { e -> item { Empty(NxIcons.Globe, e, null) } }
                items(posts, key = { "p:" + it.id }) { p ->
                    PostCard(p, onChange = { np -> val i = posts.indexOfFirst { it.id == np.id }; if (i >= 0) posts[i] = np },
                        onDeleted = { id -> posts.removeAll { it.id == id } }, videoActive = active && activeKey == "p:" + p.id)
                }
                if (loadingMore) item { Loader() }
                if (loaded && cursor == null && error == null) {
                    if (posts.isEmpty()) item { Empty(NxIcons.Camera, t("welcome"), t("welcomeSub")) }
                    else item {
                        Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("✓", fontSize = 34.sp, color = c.text)
                            Text(t("caughtUp"), fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = c.text)
                            Text(t("caughtUpSub"), color = c.muted, fontSize = 14.sp, textAlign = TextAlign.Center)
                        }
                    }
                    if (suggestions.isNotEmpty()) {
                        item { Text(t("suggested"), fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = c.text, modifier = Modifier.padding(16.dp)) }
                        items(suggestions, key = { "s:" + it.id }) { u ->
                            SuggestionRow(u) { st -> val i = suggestions.indexOfFirst { it.id == u.id }; if (i >= 0) suggestions[i] = u.copy(followStatus = st) }
                        }
                        item { Spacer(Modifier.height(24.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
fun SuggestionRow(u: User, onStatus: (String) -> Unit) {
    val app = LocalApp.current
    val c = Nx.c
    val st = u.followStatus ?: "none"
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Avatar(u.avatarUrl, 46.dp, onClick = { app.openProfile(u.username) })
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            UserNameText(u)
            Text(if (u.followsYou) t("followsYou") else (u.fullName ?: t("suggested")), color = c.muted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        FollowButton(st, u.followsYou, onClick = {
            app.scope.launch { try { onStatus(app.toggleFollow(u.id, st)) } catch (e: Exception) { app.errToast(e) } }
        })
    }
}

