package com.ahmedbecetti.nexora.kt.ui.screens

import androidx.compose.ui.text.style.TextOverflow

import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridItemSpan
import androidx.compose.foundation.lazy.staggeredgrid.rememberLazyStaggeredGridState
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.CircleShape
import com.ahmedbecetti.nexora.kt.ui.NxTabs
import com.ahmedbecetti.nexora.kt.ui.SectionLabel

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ahmedbecetti.nexora.kt.AppState
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.Route
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.Post
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.fmtNum
import com.ahmedbecetti.nexora.kt.data.mapObj
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.Empty
import com.ahmedbecetti.nexora.kt.ui.IconBtn
import com.ahmedbecetti.nexora.kt.ui.Loader
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.TopBar
import com.ahmedbecetti.nexora.kt.ui.UserRow
import com.ahmedbecetti.nexora.kt.ui.noRippleClick
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import kotlinx.coroutines.delay

fun openFromGrid(app: AppState, posts: List<Post>, p: Post) {
    if (p.isReel) {
        val reels = posts.filter { it.isReel }
        app.push(Route.ReelsAt(reels, reels.indexOfFirst { it.id == p.id }.coerceAtLeast(0)))
    } else app.push(Route.PostDetail(p.id, p))
}

@Composable
fun PostTile(p: Post, onClick: () -> Unit, tall: Boolean = false) {
    val c = Nx.c
    val m = p.media.firstOrNull()
    Box(Modifier.padding(0.5.dp).fillMaxWidth().aspectRatio(if (tall) 0.75f else 1f).background(c.sep).noRippleClick(onClick)) {
        if (m != null) AsyncImage(m.thumb, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        when {
            p.isReel -> Icon(NxIcons.ReelsFill, null, tint = Color.White, modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).size(18.dp))
            p.media.size > 1 -> Icon(NxIcons.Copy, null, tint = Color.White, modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).size(18.dp))
            m?.isVideo == true -> Icon(NxIcons.Play, null, tint = Color.White, modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).size(18.dp))
        }
        if (tall && p.viewCount > 0) Row(Modifier.align(Alignment.BottomStart).padding(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(NxIcons.Play, null, tint = Color.White, modifier = Modifier.size(14.dp))
            Text(fmtNum(p.viewCount), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

fun LazyGridScope.postGrid(app: AppState, posts: List<Post>, tall: Boolean = false) {
    items(posts, key = { "g:" + it.id }) { p -> PostTile(p, { openFromGrid(app, posts, p) }, tall) }
}

private val HASHTAG = Regex("#([\\p{L}\\p{N}_]+)")

/** Explore tile for the staggered grid: height follows the media shape (tall reels, square photos…). */
@Composable
fun StaggerTile(p: Post, onClick: () -> Unit) {
    val c = Nx.c
    val m = p.media.firstOrNull()
    val ratio = when {
        m == null -> 1f
        m.width > 0 && m.height > 0 -> (m.width.toFloat() / m.height).coerceIn(0.62f, 1.2f)
        p.isReel || m.isVideo -> 0.62f
        else -> 1f
    }
    Box(Modifier.fillMaxWidth().aspectRatio(ratio).background(c.sep).noRippleClick(onClick)) {
        if (m != null) AsyncImage(m.thumb, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        when {
            p.isReel || m?.isVideo == true -> Icon(NxIcons.ReelsFill, null, tint = Color.White, modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).size(18.dp))
            p.media.size > 1 -> Icon(NxIcons.Copy, null, tint = Color.White, modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).size(18.dp))
        }
    }
}

@Composable
fun SearchScreen(active: Boolean) {
    val app = LocalApp.current
    val c = Nx.c
    val focus = LocalFocusManager.current
    var q by rememberSaveable { mutableStateOf("") }
    var tab by rememberSaveable { mutableStateOf(0) }
    val users = remember { mutableStateListOf<User>() }
    val suggested = remember { mutableStateListOf<User>() }
    val found = remember { mutableStateListOf<Post>() }      // reels / videos matching the query
    var searching by remember { mutableStateOf(false) }
    val explore = remember { mutableStateListOf<Post>() }
    var cursor by remember { mutableStateOf<Long?>(null) }
    var ownDone by remember { mutableStateOf(false) }
    var worldOffset by remember { mutableStateOf(0) }
    var loaded by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    val seed = remember { "x" + System.currentTimeMillis().toString(36) }
    val grid = rememberLazyStaggeredGridState()

    // For you: people's posts first, then real-world videos so the grid never runs dry
    suspend fun more() {
        if (busy) return
        busy = true
        val before = explore.size
        try {
            val have = explore.map { it.id }.toHashSet()
            if (!ownDone) {
                val r = Api.get("explore?suggested=1" + (cursor?.let { "&cursor=$it" } ?: ""))
                explore.addAll(Post.list(r).filter { it.id !in have && it.media.isNotEmpty() })
                cursor = r.optLong("nextCursor").takeIf { !r.isNull("nextCursor") && it > 0 }
                if (cursor == null) ownDone = true
            } else {
                val r = Api.get("world/reels?topic=mix&seed=$seed&offset=$worldOffset&limit=12")
                explore.addAll(Post.list(r).filter { it.id !in have && it.media.isNotEmpty() })
                worldOffset = if (r.isNull("nextOffset")) worldOffset + 12 else r.optInt("nextOffset", worldOffset + 12)
            }
        } catch (_: Exception) {} finally { busy = false; loaded = true }
        if (ownDone && explore.size < 12 && (explore.size > before || before == 0) && worldOffset < 48) more()
    }
    LaunchedEffect(Unit) { more() }
    LaunchedEffect(Unit) { try { suggested.clear(); suggested.addAll(Api.get("suggestions").optJSONArray("users").mapObj { User.from(it) }) } catch (_: Exception) {} }
    LaunchedEffect(q) {
        val term = q.trim()
        if (term.isEmpty()) { users.clear(); found.clear(); return@LaunchedEffect }
        delay(300); searching = true
        val enc = java.net.URLEncoder.encode(term, "UTF-8")
        try { val r = Api.get("search/users?q=$enc"); users.clear(); users.addAll(r.optJSONArray("users").mapObj { User.from(it) }) } catch (_: Exception) {}
        try { val r = Api.get("search/reels?q=$enc"); found.clear(); found.addAll(Post.list(r).filter { it.media.isNotEmpty() }) } catch (_: Exception) {}
        searching = false
    }
    LaunchedEffect(grid) {
        snapshotFlow { grid.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }.collect { if (it >= grid.layoutInfo.totalItemsCount - 12) more() }
    }
    LaunchedEffect(app.tabReselect) { if (app.tabReselect > 0 && active) grid.animateScrollToItem(0) }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(12.dp)).background(c.input).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(NxIcons.Search, null, tint = c.muted, modifier = Modifier.size(18.dp))
                Box(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                    if (q.isEmpty()) Text(t("searchPh"), color = c.muted, fontSize = 15.sp)
                    BasicTextField(q, { q = it }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { focus.clearFocus() }),
                        modifier = Modifier.fillMaxWidth())
                }
                if (q.isNotEmpty()) Icon(NxIcons.Close, null, tint = c.muted, modifier = Modifier.size(16.dp).noRippleClick { q = ""; focus.clearFocus() })
            }
        }
        NxTabs(listOf(t("forYou"), t("accounts"), t("audioTab"), t("tags")), tab, { tab = it; focus.clearFocus() })
        val term = q.trim()
        when (tab) {
            0 -> {
                val list = if (term.isEmpty()) explore else found
                LazyVerticalStaggeredGrid(StaggeredGridCells.Fixed(3), state = grid, modifier = Modifier.fillMaxSize().padding(top = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp), verticalItemSpacing = 2.dp) {
                    if (term.isNotEmpty() && users.isNotEmpty()) item(span = StaggeredGridItemSpan.FullLine) {
                        Column { users.take(3).forEach { u -> UserRow(u, onClick = { focus.clearFocus(); app.openProfile(u.username) }) } }
                    }
                    if ((term.isEmpty() && !loaded) || (term.isNotEmpty() && searching && list.isEmpty())) item(span = StaggeredGridItemSpan.FullLine) { Loader() }
                    if (term.isNotEmpty() && !searching && list.isEmpty() && users.isEmpty()) item(span = StaggeredGridItemSpan.FullLine) { Empty(NxIcons.Search, t("noResults")) }
                    items(list, key = { "e:" + it.id }) { p -> StaggerTile(p) { openFromGrid(app, list, p) } }
                }
            }
            1 -> LazyColumn(Modifier.fillMaxSize()) {
                val list = if (term.isEmpty()) suggested else users
                if (term.isEmpty() && suggested.isNotEmpty()) item { SectionLabel(t("suggested")) }
                if (searching && users.isEmpty()) item { Loader() }
                if (term.isNotEmpty() && !searching && users.isEmpty()) item { Text(t("noAccountsFound", "q" to term), color = c.muted, modifier = Modifier.padding(20.dp)) }
                items(list, key = { "u:" + it.id }) { u ->
                    UserRow(u, sub = listOfNotNull(u.fullName?.takeIf { it.isNotBlank() }, if (u.followStatus == "accepted") t("followingBtn") else null,
                        if (u.followers > 0) "${fmtNum(u.followers)} ${t("followers").lowercase()}" else null).joinToString(" • "),
                        onClick = { focus.clearFocus(); app.openProfile(u.username) })
                }
            }
            2 -> LazyColumn(Modifier.fillMaxSize()) {
                // audio of reels: matching the search, or from the explore feed
                val list = (if (term.isEmpty()) explore else found).filter { it.isReel || it.media.first().isVideo }
                if (searching && list.isEmpty()) item { Loader() }
                if (!searching && list.isEmpty()) item { Empty(NxIcons.Music, t("noResults")) }
                items(list, key = { "a:" + it.id }) { p ->
                    Row(Modifier.fillMaxWidth().clickable { openFromGrid(app, list, p) }.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(52.dp).clip(RoundedCornerShape(8.dp)).background(c.sep), contentAlignment = Alignment.Center) {
                            AsyncImage(p.media.first().thumb, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                            Icon(NxIcons.Music, null, tint = Color.White, modifier = Modifier.size(20.dp))
                        }
                        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                            Text(p.audio?.takeIf { it.isNotBlank() } ?: (p.caption?.takeIf { p.world }?.take(60) ?: t("original")), color = c.text, fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(if (p.world) t("worldSource") else p.user.username, color = c.muted, fontSize = 13.sp, maxLines = 1)
                        }
                        Icon(NxIcons.Play, null, tint = c.text, modifier = Modifier.size(18.dp))
                    }
                }
            }
            else -> LazyColumn(Modifier.fillMaxSize()) {
                val src = if (term.isEmpty()) explore else found
                val counts = src.flatMap { p -> HASHTAG.findAll(p.caption ?: "").map { it.groupValues[1].lowercase() }.toSet() }
                    .groupingBy { it }.eachCount().toList().sortedByDescending { it.second }
                val tags = (if (term.isNotEmpty()) listOf(term.removePrefix("#").lowercase() to 0) else emptyList()) +
                    counts.filter { term.isEmpty() || it.first.contains(term.removePrefix("#").lowercase()) }.filter { it.first != term.removePrefix("#").lowercase() }
                if (tags.isEmpty()) item { Empty(NxIcons.Search, t("noResults")) }
                items(tags, key = { "t:" + it.first }) { (tag, n) ->
                    Row(Modifier.fillMaxWidth().clickable { focus.clearFocus(); app.push(Route.Tag(tag)) }.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(52.dp).border(1.dp, c.border, CircleShape), contentAlignment = Alignment.Center) {
                            Text("#", fontSize = 24.sp, color = c.text)
                        }
                        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                            Text("#$tag", color = c.text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            if (n > 0) Text("$n ${t("posts").lowercase()}", color = c.muted, fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TagScreen(tag: String) {
    val app = LocalApp.current
    val posts = remember { mutableStateListOf<Post>() }
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(tag) {
        try { posts.addAll(Post.list(Api.get("tags/" + java.net.URLEncoder.encode(tag, "UTF-8")))) } catch (e: Exception) { app.errToast(e) } finally { loaded = true }
    }
    Column(Modifier.fillMaxSize().background(Nx.c.bg)) {
        TopBar("#$tag", onBack = { app.pop() })
        LazyVerticalGrid(GridCells.Fixed(3), modifier = Modifier.fillMaxSize()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Text("${fmtNum(posts.size)} ${t("posts").lowercase()}", color = Nx.c.muted, modifier = Modifier.padding(16.dp))
            }
            if (!loaded) item(span = { GridItemSpan(maxLineSpan) }) { Loader() }
            postGrid(app, posts)
        }
    }
}
