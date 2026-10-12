package com.ahmedbecetti.nexora.kt.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.Post
import com.ahmedbecetti.nexora.kt.data.fmtNum
import com.ahmedbecetti.nexora.kt.data.json
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.AvatarImage
import com.ahmedbecetti.nexora.kt.ui.CommentsSheet
import com.ahmedbecetti.nexora.kt.ui.HeartBurst
import com.ahmedbecetti.nexora.kt.ui.IconBtn
import com.ahmedbecetti.nexora.kt.ui.Loader
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.NxIcons2
import com.ahmedbecetti.nexora.kt.ui.PostActions
import com.ahmedbecetti.nexora.kt.ui.PostMenu
import com.ahmedbecetti.nexora.kt.ui.SheetItem
import com.ahmedbecetti.nexora.kt.ui.VerifiedBadge
import com.ahmedbecetti.nexora.kt.ui.VideoPlayer
import com.ahmedbecetti.nexora.kt.ui.noRippleClick
import com.ahmedbecetti.nexora.kt.ui.postLink
import com.ahmedbecetti.nexora.kt.ui.richText
import com.ahmedbecetti.nexora.kt.ui.shareText
import com.ahmedbecetti.nexora.kt.ui.theme.Like
import com.ahmedbecetti.nexora.kt.ui.toast
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Reels tab: people's reels first (cursor paging), then real-world videos from Wikimedia Commons. */
@Composable
fun ReelsTab(active: Boolean) {
    val posts = remember { mutableStateListOf<Post>() }
    var cursor by remember { mutableStateOf<Long?>(null) }
    var ownDone by remember { mutableStateOf(false) }
    var worldOffset by remember { mutableStateOf(0) }
    var worldDone by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var loaded by remember { mutableStateOf(false) }
    val seed = remember { System.currentTimeMillis().toString(36) }

    suspend fun next() {
        if (busy) return
        busy = true
        try {
            val have = posts.map { it.id }.toHashSet()
            if (!ownDone) {
                val r = Api.get("reels" + (cursor?.let { "?cursor=$it" } ?: ""))
                val got = Post.list(r).filter { it.id !in have && it.media.isNotEmpty() }
                posts.addAll(got)
                cursor = r.optLong("nextCursor").takeIf { !r.isNull("nextCursor") && it > 0 }
                if (cursor == null) ownDone = true
                if (got.size >= 3) return
            }
            if (!worldDone) {
                val r = Api.get("world/reels?topic=mix&seed=$seed&offset=$worldOffset&limit=8")
                val got = Post.list(r).filter { it.id !in have && it.media.isNotEmpty() }
                posts.addAll(got)
                worldOffset = if (r.isNull("nextOffset")) worldOffset else r.optInt("nextOffset", worldOffset)
                if (got.isEmpty()) worldDone = true
            }
        } catch (_: Exception) {
        } finally { busy = false; loaded = true }
    }
    LaunchedEffect(Unit) { next() }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (!loaded) Loader(Modifier.align(Alignment.Center), color = Color.White)
        else if (posts.isEmpty()) Column(Modifier.align(Alignment.Center).padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(NxIcons.Reels, null, tint = Color.White, modifier = Modifier.size(54.dp))
            Text(t("noReels"), color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
        }
        else ReelsPager(posts, 0, active, onNearEnd = { next() })
        Text(t("reels"), color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.statusBarsPadding().padding(start = 16.dp, top = 10.dp))
    }
}

/** Opened from a profile / explore grid: the given reels, starting at [start]. */
@Composable
fun ReelsViewer(initial: List<Post>, start: Int, active: Boolean) {
    val app = LocalApp.current
    val posts = remember { mutableStateListOf<Post>().apply { addAll(initial) } }
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        ReelsPager(posts, start, active, onNearEnd = {})
        IconBtn(NxIcons.Back, { app.pop() }, tint = Color.White, size = 28.dp, modifier = Modifier.statusBarsPadding().padding(4.dp))
    }
}

@Composable
fun ReelsPager(posts: SnapshotStateList<Post>, start: Int, active: Boolean, onNearEnd: suspend () -> Unit) {
    val pager = rememberPagerState(initialPage = start.coerceIn(0, (posts.size - 1).coerceAtLeast(0))) { posts.size }
    LaunchedEffect(pager.currentPage, posts.size) { if (pager.currentPage >= posts.size - 3) onNearEnd() }
    VerticalPager(pager, modifier = Modifier.fillMaxSize(), beyondViewportPageCount = 1, key = { posts.getOrNull(it)?.id ?: it }) { i ->
        val p = posts.getOrNull(i) ?: return@VerticalPager
        ReelItem(p, active = active && pager.settledPage == i,
            onChange = { np -> val k = posts.indexOfFirst { it.id == np.id }; if (k >= 0) posts[k] = np },
            onRemove = { id -> posts.removeAll { it.id == id } })
    }
}

@Composable
fun ReelItem(post: Post, active: Boolean, onChange: (Post) -> Unit, onRemove: (String) -> Unit) {
    val app = LocalApp.current
    val ctx = LocalContext.current
    var p by remember(post) { mutableStateOf(post) }
    val actions = remember(post) { PostActions(app, { p }, { p = it; onChange(it) }) }
    var burst by remember { mutableStateOf(false) }
    var comments by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var expanded by remember { mutableStateOf(false) }
    var follow by remember(post) { mutableStateOf(if (post.following) "accepted" else "none") }
    var showMuteHint by remember { mutableStateOf(false) }
    LaunchedEffect(burst) { if (burst) { delay(650); burst = false } }
    LaunchedEffect(showMuteHint) { if (showMuteHint) { delay(900); showMuteHint = false } }
    LaunchedEffect(active) {
        if (active) { delay(2000); try { Api.post(if (p.world) "world/${p.wid}/view" else "posts/${p.id}/view") } catch (_: Exception) {} }
    }
    val m = p.media.first()
    val wide = m.width > 0 && m.height > 0 && m.width > m.height
    Box(Modifier.fillMaxSize().background(Color.Black)
        .pointerInput(p.id) {
            detectTapGestures(
                onTap = { app.reelsMuted = !app.reelsMuted; showMuteHint = true },
                onDoubleTap = { actions.like(true); burst = true },
            )
        }) {
        if (m.isVideo) VideoPlayer(m.url, m.poster, playing = active, muted = app.reelsMuted, fill = !wide, modifier = Modifier.fillMaxSize(),
            onError = { if (p.world && active) { onRemove(p.id); if (p.wid > 0) app.scope.launch { try { Api.post("world/${p.wid}/hide") } catch (_: Exception) {} } } })
        else coil.compose.AsyncImage(m.url, null, contentScale = androidx.compose.ui.layout.ContentScale.Fit, modifier = Modifier.fillMaxSize())
        Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(260.dp).background(Brush.verticalGradient(listOf(Color.Transparent, Color(0x99000000)))))
        HeartBurst(burst, Modifier.align(Alignment.Center))
        if (showMuteHint) Box(Modifier.align(Alignment.Center).size(64.dp).clip(CircleShape).background(Color(0x99000000)), contentAlignment = Alignment.Center) {
            Icon(if (app.reelsMuted) NxIcons2.VolumeOff else NxIcons2.VolumeOn, null, tint = Color.White, modifier = Modifier.size(30.dp))
        }
        // right action rail
        Column(Modifier.align(Alignment.BottomEnd).padding(end = 6.dp, bottom = 20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (!p.world || p.wid > 0) RailBtn(if (p.liked) NxIcons.HeartFill else NxIcons.Heart, if (p.likeCount > 0) fmtNum(p.likeCount) else null, if (p.liked) Like else Color.White) { actions.like() }
            if (!p.world) RailBtn(NxIcons.Comment, if (p.commentCount > 0) fmtNum(p.commentCount) else null) { comments = true }
            RailBtn(NxIcons.Send, null) { shareText(ctx, if (p.world) (p.sourceUrl ?: "") else postLink(p.id)) }
            RailBtn(NxIcons.MoreH, null) { menu = true }
        }
        // bottom info
        Column(Modifier.align(Alignment.BottomStart).padding(start = 14.dp, end = 72.dp, bottom = 18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (p.world) Box(Modifier.size(32.dp).clip(CircleShape).background(Color(0x33FFFFFF)), contentAlignment = Alignment.Center) {
                    Icon(NxIcons.Globe, null, tint = Color.White, modifier = Modifier.size(20.dp))
                } else Box(Modifier.noRippleClick { app.openProfile(p.user.username) }) { AvatarImage(p.user.avatarUrl, 32.dp) }
                Spacer(Modifier.width(10.dp))
                Text(if (p.world) t("worldSource") else p.user.username, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1,
                    overflow = TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 180.dp).noRippleClick { if (!p.world) app.openProfile(p.user.username) })
                if (p.user.verified) VerifiedBadge()
                if (!p.world && p.user.id != app.me?.id && follow != "accepted") {
                    Spacer(Modifier.width(10.dp))
                    Text(if (follow == "pending") t("requested") else t("follow"), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                        modifier = Modifier.border(1.dp, Color(0xB3FFFFFF), RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 4.dp).noRippleClick {
                            val st = follow
                            app.scope.launch { try { follow = app.toggleFollow(p.user.id, st) } catch (e: Exception) { app.errToast(e) } }
                        })
                }
            }
            val cap = p.caption
            if (!cap.isNullOrBlank()) Text(richText(app, cap, Color.White), color = Color.White, fontSize = 14.sp, maxLines = if (expanded) 12 else 2,
                overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 8.dp).noRippleClick { expanded = !expanded })
            if (p.world && expanded && p.sourceLicense != null) Text(t("worldSource") + " · " + p.sourceLicense + " · " + p.user.username, color = Color(0xCCFFFFFF), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
            Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(NxIcons.Music, null, tint = Color.White, modifier = Modifier.size(13.dp))
                Text("  " + (p.audio ?: if (p.world) t("worldReels") else "${p.user.username} · ${t("original")}"), color = Color.White, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
    if (comments) CommentsSheet(p, onDismiss = { comments = false }, onCount = { n -> p = p.copy(commentCount = n); onChange(p) })
    if (menu) PostMenu(p, onDismiss = { menu = false }, onDeleted = onRemove, onChange = { p = it; onChange(it) }, extra = {
        SheetItem(if (app.reelsMuted) NxIcons2.VolumeOn else NxIcons2.VolumeOff, if (app.reelsMuted) t("unmute") else t("mute")) { app.reelsMuted = !app.reelsMuted; menu = false }
        if (p.world) SheetItem(NxIcons.EyeOff, t("notInterested")) {
            onRemove(p.id); if (p.wid > 0) app.scope.launch { try { Api.post("world/${p.wid}/hide") } catch (_: Exception) {} }
            toast(ctx, t("notInterestedDone")); menu = false
        }
    })
}

@Composable
private fun RailBtn(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String?, tint: Color = Color.White, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(52.dp).noRippleClick(onClick)) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(28.dp))
        if (label != null) Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 2.dp))
    }
}

