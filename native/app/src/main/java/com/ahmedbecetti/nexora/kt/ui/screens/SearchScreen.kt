package com.ahmedbecetti.nexora.kt.ui.screens

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

@Composable
fun SearchScreen(active: Boolean) {
    val app = LocalApp.current
    val c = Nx.c
    val focus = LocalFocusManager.current
    var q by rememberSaveable { mutableStateOf("") }
    var focused by remember { mutableStateOf(false) }
    val users = remember { mutableStateListOf<User>() }
    var searching by remember { mutableStateOf(false) }
    val explore = remember { mutableStateListOf<Post>() }
    var cursor by remember { mutableStateOf<Long?>(null) }
    var loaded by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    val grid = rememberLazyGridState()

    suspend fun more() {
        if (busy || (loaded && cursor == null)) return
        busy = true
        try {
            val r = Api.get("explore?suggested=1" + (cursor?.let { "&cursor=$it" } ?: ""))
            val have = explore.map { it.id }.toHashSet()
            explore.addAll(Post.list(r).filter { it.id !in have && it.media.isNotEmpty() })
            cursor = r.optLong("nextCursor").takeIf { !r.isNull("nextCursor") && it > 0 }
        } catch (_: Exception) {} finally { busy = false; loaded = true }
    }
    LaunchedEffect(Unit) { more() }
    LaunchedEffect(q) {
        val term = q.trim()
        if (term.isEmpty()) { users.clear(); return@LaunchedEffect }
        delay(250); searching = true
        try { val r = Api.get("search/users?q=" + java.net.URLEncoder.encode(term, "UTF-8")); users.clear(); users.addAll(r.optJSONArray("users").mapObj { User.from(it) }) }
        catch (_: Exception) {} finally { searching = false }
    }
    LaunchedEffect(grid) {
        snapshotFlow { grid.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }.collect { if (it >= grid.layoutInfo.totalItemsCount - 9) more() }
    }
    LaunchedEffect(app.tabReselect) { if (app.tabReselect > 0 && active) grid.animateScrollToItem(0) }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (focused || q.isNotEmpty()) IconBtn(NxIcons.Back, { q = ""; focus.clearFocus() }, size = 24.dp)
            Row(Modifier.weight(1f).height(38.dp).clip(RoundedCornerShape(10.dp)).background(c.input).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(NxIcons.Search, null, tint = c.muted, modifier = Modifier.size(18.dp))
                Box(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                    if (q.isEmpty()) Text(t("searchPh"), color = c.muted, fontSize = 15.sp)
                    BasicTextField(q, { q = it }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        modifier = Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused })
                }
                if (q.isNotEmpty()) Icon(NxIcons.Close, null, tint = c.muted, modifier = Modifier.size(16.dp).noRippleClick { q = "" })
            }
        }
        if (q.isNotBlank() || focused) {
            LazyColumn(Modifier.fillMaxSize()) {
                if (searching && users.isEmpty()) item { Loader() }
                if (!searching && q.isNotBlank() && users.isEmpty()) item { Text(t("noAccountsFound", "q" to q.trim()), color = c.muted, modifier = Modifier.padding(20.dp)) }
                items(users, key = { it.id }) { u ->
                    UserRow(u, sub = listOfNotNull(u.fullName, if (u.followStatus == "accepted") t("followingBtn") else null, if (u.followers > 0) "${fmtNum(u.followers)} ${t("followers").lowercase()}" else null).joinToString(" • "),
                        onClick = { focus.clearFocus(); app.openProfile(u.username) })
                }
            }
        } else {
            LazyVerticalGrid(GridCells.Fixed(3), state = grid, modifier = Modifier.fillMaxSize()) {
                if (!loaded) item(span = { GridItemSpan(maxLineSpan) }) { Loader() }
                if (loaded && explore.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) { Empty(NxIcons.Search, t("noResults")) }
                postGrid(app, explore, tall = false)
                if (busy && loaded) item(span = { GridItemSpan(maxLineSpan) }) { Loader() }
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
