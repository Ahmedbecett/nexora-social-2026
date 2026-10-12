package com.ahmedbecetti.nexora.kt.ui.screens

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
import com.ahmedbecetti.nexora.kt.ui.Ring
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
    val tray = remember { mutableStateListOf<StoryGroup>() }
    val suggestions = remember { mutableStateListOf<User>() }
    var cursor by remember { mutableStateOf<Long?>(null) }
    var loaded by remember { mutableStateOf(false) }
    var loadingMore by remember { mutableStateOf(false) }
    var refreshing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val list = rememberLazyListState()

    suspend fun loadStories() {
        try { val r = Api.get("stories"); tray.clear(); tray.addAll(r.optJSONArray("tray").mapObj { StoryGroup.from(it) }) } catch (_: Exception) {}
    }
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

    LaunchedEffect(Unit) { refresh() }
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
        Row(Modifier.fillMaxWidth().statusBarsPadding().height(54.dp).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f).padding(start = 8.dp)) { Wordmark(size = 34.sp) }
            Box {
                IconBtn(NxIcons.Heart, { app.push(Route.Notifications) }, size = 26.dp)
                if (app.notifBadge > 0 || app.requestBadge > 0) Box(Modifier.align(Alignment.TopEnd).offset(x = (-9).dp, y = 9.dp).size(8.dp).clip(CircleShape).background(Red))
            }
        }
        PullToRefreshBox(isRefreshing = refreshing, onRefresh = { refreshing = true; scope.launch { refresh(); refreshing = false } }, modifier = Modifier.weight(1f)) {
            LazyColumn(state = list, modifier = Modifier.fillMaxSize()) {
                if (tray.isNotEmpty()) item(key = "stories") {
                    LazyRow(contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)) {
                        itemsIndexed(tray, key = { _, g -> g.user.id }) { i, g ->
                            Column(Modifier.width(84.dp).padding(horizontal = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Avatar(g.user.avatarUrl, 80.dp, ring = ringOf(g), onClick = { app.push(Route.Stories(tray.toList(), i)) })
                                Text(if (g.user.id == app.me?.id) t("yourStory") else g.user.username, fontSize = 12.sp, color = if (g.allSeen) c.muted else c.text,
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

