package com.ahmedbecetti.nexora.kt.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ahmedbecetti.nexora.kt.AppState
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.Route
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.Comment
import com.ahmedbecetti.nexora.kt.data.Post
import com.ahmedbecetti.nexora.kt.data.fmtNum
import com.ahmedbecetti.nexora.kt.data.json
import com.ahmedbecetti.nexora.kt.data.mapObj
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.data.timeAgo
import com.ahmedbecetti.nexora.kt.ui.theme.Blue
import com.ahmedbecetti.nexora.kt.ui.theme.Like
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val TOKEN = Regex("([@#][\\p{L}\\p{N}_.]+)")

/** Caption / comment text with tappable @mentions and #hashtags. */
fun richText(app: AppState, text: String, link: Color, prefixUser: String? = null): AnnotatedString = buildAnnotatedString {
    if (prefixUser != null) {
        withLink(LinkAnnotation.Clickable("u:$prefixUser") { app.openProfile(prefixUser) }) {
            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(prefixUser) }
        }
        append(" ")
    }
    var last = 0
    for (m in TOKEN.findAll(text)) {
        append(text.substring(last, m.range.first))
        val tok = m.value.trimEnd('.')
        val rest = m.value.substring(tok.length)
        if (tok.startsWith("@")) {
            val u = tok.drop(1).lowercase()
            withLink(LinkAnnotation.Clickable("m:$u") { app.openProfile(u) }) { withStyle(SpanStyle(color = link)) { append(tok) } }
        } else {
            val tg = tok.drop(1)
            withLink(LinkAnnotation.Clickable("t:$tg") { app.push(Route.Tag(tg)) }) { withStyle(SpanStyle(color = link)) { append(tok) } }
        }
        append(rest)
        last = m.range.last + 1
    }
    append(text.substring(last))
}

/** Likes / saves with optimistic updates; shared by feed cards, post detail and reels. */
class PostActions(private val app: AppState, private val get: () -> Post, private val set: (Post) -> Unit) {
    fun like(value: Boolean = !get().liked) {
        val p = get()
        if (p.world && p.wid == 0L) return
        if (p.liked == value) return
        set(p.copy(liked = value, likeCount = (p.likeCount + if (value) 1 else -1).coerceAtLeast(0)))
        app.scope.launch {
            try {
                val path = if (p.world) "world/${p.wid}/like" else "posts/${p.id}/like"
                val r = if (value) Api.post(path) else Api.delete(path)
                set(get().copy(liked = r.optBoolean("liked", value), likeCount = r.optInt("likeCount", get().likeCount)))
            } catch (e: Exception) { set(get().copy(liked = p.liked, likeCount = p.likeCount)); app.errToast(e) }
        }
    }
    fun save() {
        val p = get(); val v = !p.saved
        set(p.copy(saved = v))
        app.scope.launch {
            try { if (v) Api.post("posts/${p.id}/save") else Api.delete("posts/${p.id}/save") }
            catch (e: Exception) { set(get().copy(saved = p.saved)); app.errToast(e) }
        }
    }
}

@Composable
fun PostCard(post: Post, onChange: (Post) -> Unit, onDeleted: (String) -> Unit, videoActive: Boolean, modifier: Modifier = Modifier) {
    val app = LocalApp.current
    val c = Nx.c
    val ctx = LocalContext.current
    var p by remember(post) { mutableStateOf(post) }
    val actions = remember(post) { PostActions(app, { p }, { p = it; onChange(it) }) }
    var menu by remember { mutableStateOf(false) }
    var comments by remember { mutableStateOf(false) }
    var expanded by remember { mutableStateOf(false) }
    var burst by remember { mutableStateOf(false) }
    LaunchedEffect(burst) { if (burst) { delay(650); burst = false } }

    Column(modifier.fillMaxWidth().background(c.bg)) {
        // header
        Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Avatar(p.user.avatarUrl, 34.dp, onClick = { app.openProfile(p.user.username) })
            Column(Modifier.weight(1f).padding(horizontal = 10.dp).noRippleClick { app.openProfile(p.user.username) }) {
                UserNameText(p.user, fontSize = 14.sp)
                val sub = p.location ?: p.audio?.takeIf { p.isReel }
                if (!sub.isNullOrBlank()) Text(sub, fontSize = 12.sp, color = c.text, maxLines = 1)
            }
            IconBtn(NxIcons.MoreH, { menu = true }, size = 22.dp)
        }
        // media
        if (p.media.isNotEmpty()) {
            val first = p.media.first()
            val pager = rememberPagerState { p.media.size }
            Box(
                Modifier.fillMaxWidth().aspectRatio(if (p.isReel) 0.8f else first.ratio).background(if (c.dark) Color.Black else c.sep)
                    .pointerInput(p.id) { detectTapGestures(onDoubleTap = { actions.like(true); burst = true }) },
                contentAlignment = Alignment.Center,
            ) {
                HorizontalPager(pager, modifier = Modifier.fillMaxSize(), key = { it }) { i ->
                    val m = p.media[i]
                    if (m.isVideo) {
                        Box(Modifier.fillMaxSize()) {
                            VideoPlayer(m.url, m.poster, playing = videoActive && pager.currentPage == i, muted = app.reelsMuted, modifier = Modifier.fillMaxSize())
                            Box(Modifier.align(Alignment.BottomEnd).padding(12.dp).size(28.dp).clip(CircleShape).background(Color(0x99000000))
                                .clickable { app.reelsMuted = !app.reelsMuted }, contentAlignment = Alignment.Center) {
                                Icon(if (app.reelsMuted) NxIcons2.VolumeOff else NxIcons2.VolumeOn, null, tint = Color.White, modifier = Modifier.size(16.dp))
                            }
                        }
                    } else {
                        AsyncImage(m.url, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    }
                }
                if (p.media.size > 1) Text("${pager.currentPage + 1}/${p.media.size}", color = Color.White, fontSize = 12.sp,
                    modifier = Modifier.align(Alignment.TopEnd).padding(12.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xB3121212)).padding(horizontal = 8.dp, vertical = 3.dp))
                HeartBurst(burst)
            }
            if (p.media.size > 1) Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.Center) {
                repeat(p.media.size) { i ->
                    Box(Modifier.padding(horizontal = 2.dp).size(6.dp).clip(CircleShape).background(if (i == pager.currentPage) Blue else c.border))
                }
            }
        }
        // actions
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconBtn(if (p.liked) NxIcons.HeartFill else NxIcons.Heart, { actions.like() }, tint = if (p.liked) Like else c.text)
            if (p.likeCount > 0) Text(fmtNum(p.likeCount), fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = c.text,
                modifier = Modifier.noRippleClick { app.push(Route.Likes(p.id)) })
            IconBtn(NxIcons.Comment, { comments = true })
            if (p.commentCount > 0) Text(fmtNum(p.commentCount), fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = c.text)
            IconBtn(NxIcons.Send, { shareText(ctx, postLink(p.id)) })
            Spacer(Modifier.weight(1f))
            IconBtn(if (p.saved) NxIcons2.BookmarkFill else NxIcons.Bookmark, { actions.save() })
        }
        Column(Modifier.padding(horizontal = 14.dp)) {
            if (p.likeCount > 0 && p.lastLiker != null) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.noRippleClick { app.push(Route.Likes(p.id)) }) {
                    AvatarImage(p.lastLikerAvatar, 18.dp)
                    Spacer(Modifier.width(6.dp))
                    Text(buildAnnotatedString {
                        append(t("likedBy") + " ")
                        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(p.lastLiker) }
                        if (p.likeCount > 1) { append(" "); withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(t("andOthers")) } }
                    }, fontSize = 14.sp, color = c.text)
                }
            }
            if (!p.caption.isNullOrBlank()) {
                val cap = p.caption!!
                val long = cap.length > 120 || cap.count { it == '\n' } > 1
                Text(
                    richText(app, if (long && !expanded) cap.take(110).trimEnd() else cap, if (c.dark) Color(0xFFE0F1FF) else Color(0xFF00376B), p.user.username),
                    fontSize = 14.sp, color = c.text, style = TextStyle(lineHeight = 18.sp), modifier = Modifier.padding(top = 4.dp),
                )
                if (long && !expanded) Text("… " + t("more"), color = c.muted, fontSize = 14.sp, modifier = Modifier.noRippleClick { expanded = true })
            }
            if (p.commentCount > 0) Text(t("viewAllComments", "n" to p.commentCount), color = c.muted, fontSize = 14.sp,
                modifier = Modifier.padding(top = 4.dp).noRippleClick { comments = true })
            Text(timeAgo(p.createdAt), color = c.muted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp, bottom = 14.dp))
        }
    }
    if (menu) PostMenu(p, onDismiss = { menu = false }, onDeleted = onDeleted, onChange = { p = it; onChange(it) })
    if (comments) CommentsSheet(p, onDismiss = { comments = false }, onCount = { n -> p = p.copy(commentCount = n); onChange(p) })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostMenu(p: Post, onDismiss: () -> Unit, onDeleted: (String) -> Unit, onChange: (Post) -> Unit, extra: (@Composable () -> Unit)? = null) {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val mine = p.user.id == app.me?.id
    var confirm by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Nx.c.elevated, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.navigationBarsPadding().padding(bottom = 12.dp)) {
            if (!p.world) {
                SheetItem(if (p.saved) NxIcons2.BookmarkFill else NxIcons.Bookmark, t("saveToCollection")) {
                    PostActions(app, { p }, onChange).save(); onDismiss()
                }
                SheetItem(NxIcons.Link, t("copyLink")) {
                    val cm = ctx.getSystemService(android.content.ClipboardManager::class.java)
                    cm.setPrimaryClip(android.content.ClipData.newPlainText("link", postLink(p.id))); toast(ctx, t("linkCopied")); onDismiss()
                }
                if (!mine && !p.user.isPrivate) SheetItem(NxIcons.Repost, if (p.reposted) t("removeRepost") else t("repost")) {
                    val v = !p.reposted
                    app.scope.launch {
                        try { if (v) Api.post("posts/${p.id}/repost") else Api.delete("posts/${p.id}/repost"); onChange(p.copy(reposted = v)); toast(ctx, t(if (v) "reposted" else "repostRemoved")) }
                        catch (e: Exception) { app.errToast(e) }
                    }
                    onDismiss()
                }
                SheetItem(NxIcons.Account, t("viewProfile")) { onDismiss(); app.openProfile(p.user.username) }
                if (!mine && p.following) SheetItem(NxIcons.UserPlus, t("unfollow")) {
                    app.scope.launch { try { app.toggleFollow(p.user.id, "accepted"); onChange(p.copy(following = false)) } catch (e: Exception) { app.errToast(e) } }
                    onDismiss()
                }
            } else if (p.sourceUrl != null) {
                SheetItem(NxIcons.Globe, t("viewSource")) {
                    ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(p.sourceUrl)).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)); onDismiss()
                }
            }
            extra?.invoke()
            if (mine) SheetItem(NxIcons.Trash, t("deletePost"), danger = true) { confirm = true }
            else if (!p.world) SheetItem(NxIcons.Flag, t("report"), danger = true) {
                app.scope.launch { try { Api.post("reports", json("postId" to p.numId, "reason" to "inappropriate")); toast(ctx, t("reported")) } catch (e: Exception) { app.errToast(e) } }
                onDismiss()
            }
        }
    }
    if (confirm) ConfirmDialog(t("deletePostQ"), t("delete"), onDismiss = { confirm = false }) {
        app.scope.launch {
            try { Api.delete("posts/${p.id}"); onDeleted(p.id); app.profileVersion++ } catch (e: Exception) { app.errToast(e) }
        }
        confirm = false; onDismiss()
    }
}

@Composable
fun ConfirmDialog(title: String, ok: String, text: String? = null, onDismiss: () -> Unit, onOk: () -> Unit) {
    val c = Nx.c
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss, containerColor = c.elevated,
        title = { Text(title, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = c.text) },
        text = text?.let { { Text(it, color = c.muted) } },
        confirmButton = { androidx.compose.material3.TextButton(onClick = onOk) { Text(ok, color = com.ahmedbecetti.nexora.kt.ui.theme.Red, fontWeight = FontWeight.SemiBold) } },
        dismissButton = { androidx.compose.material3.TextButton(onClick = onDismiss) { Text(t("cancel"), color = c.text) } },
    )
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun CommentsSheet(p: Post, onDismiss: () -> Unit, onCount: (Int) -> Unit) {
    val app = LocalApp.current
    val c = Nx.c
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<Comment>() }
    var loading by remember { mutableStateOf(true) }
    var text by remember { mutableStateOf("") }
    var replyTo by remember { mutableStateOf<Comment?>(null) }
    var sending by remember { mutableStateOf(false) }
    var del by remember { mutableStateOf<Comment?>(null) }
    LaunchedEffect(p.id) {
        try { list.clear(); list.addAll(Api.get("posts/${p.id}/comments").optJSONArray("comments").mapObj { Comment.from(it) }) }
        catch (e: Exception) { app.errToast(e) } finally { loading = false }
    }
    // top-level comments followed by their replies
    val ordered = remember(list.toList()) {
        val tops = list.filter { it.parentId == null }
        tops.flatMap { top -> listOf(top) + list.filter { it.parentId == top.id } } + list.filter { r -> r.parentId != null && tops.none { it.id == r.parentId } }
    }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.elevated, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().fillMaxSize(0.92f).imePadding()) {
            Text(t("comments"), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = c.text, modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 10.dp))
            Divider()
            Box(Modifier.weight(1f)) {
                when {
                    loading -> Loader()
                    ordered.isEmpty() -> Column(Modifier.fillMaxWidth().padding(top = 60.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(t("noComments"), fontSize = 22.sp, fontWeight = FontWeight.Bold, color = c.text)
                        Text(t("startConversation"), color = c.muted, modifier = Modifier.padding(top = 6.dp))
                    }
                    else -> LazyColumn(Modifier.fillMaxSize()) {
                        items(ordered, key = { it.id }) { cm ->
                            Row(
                                Modifier.fillMaxWidth().combinedClickable(onClick = {}, onLongClick = { if (cm.user.id == app.me?.id || p.user.id == app.me?.id) del = cm })
                                    .padding(start = if (cm.parentId != null) 62.dp else 14.dp, end = 8.dp, top = 10.dp, bottom = 10.dp),
                                verticalAlignment = Alignment.Top,
                            ) {
                                Avatar(cm.user.avatarUrl, if (cm.parentId != null) 28.dp else 36.dp, onClick = { onDismiss(); app.openProfile(cm.user.username) })
                                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        UserNameText(cm.user, fontSize = 13.sp, modifier = Modifier.weight(1f, fill = false))
                                        Text("  " + timeAgo(cm.createdAt), fontSize = 12.sp, color = c.muted)
                                    }
                                    Text(richText(app, cm.text, Blue), fontSize = 14.sp, color = c.text)
                                    Text(t("reply"), fontSize = 12.sp, color = c.muted, fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.padding(top = 4.dp).noRippleClick { replyTo = cm; text = "@${cm.user.username} " })
                                }
                                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(36.dp).noRippleClick {
                                    val v = !cm.liked
                                    val i = list.indexOfFirst { it.id == cm.id }
                                    if (i >= 0) list[i] = cm.copy(liked = v, likeCount = (cm.likeCount + if (v) 1 else -1).coerceAtLeast(0))
                                    scope.launch { try { if (v) Api.post("comments/${cm.id}/like") else Api.delete("comments/${cm.id}/like") } catch (_: Exception) {} }
                                }) {
                                    Icon(if (cm.liked) NxIcons.HeartFill else NxIcons.Heart, null, tint = if (cm.liked) Like else c.muted, modifier = Modifier.size(14.dp))
                                    if (cm.likeCount > 0) Text(fmtNum(cm.likeCount), fontSize = 11.sp, color = c.muted)
                                }
                            }
                        }
                    }
                }
            }
            Divider()
            if (replyTo != null) Row(Modifier.fillMaxWidth().background(c.sep).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("↪ @${replyTo!!.user.username}", color = c.muted, fontSize = 13.sp, modifier = Modifier.weight(1f))
                Icon(NxIcons.Close, null, tint = c.muted, modifier = Modifier.size(16.dp).noRippleClick { replyTo = null; text = "" })
            }
            Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                AvatarImage(app.me?.avatarUrl, 36.dp)
                Box(Modifier.weight(1f).padding(horizontal = 10.dp).clip(RoundedCornerShape(22.dp)).background(c.input).padding(horizontal = 14.dp, vertical = 10.dp)) {
                    if (text.isEmpty()) Text(t("addComment"), color = c.muted, fontSize = 14.sp)
                    BasicTextField(text, { text = it }, textStyle = TextStyle(color = c.text, fontSize = 14.sp), cursorBrush = SolidColor(c.text),
                        maxLines = 4, modifier = Modifier.fillMaxWidth())
                }
                if (text.isNotBlank()) Text(t("post"), color = Blue, fontWeight = FontWeight.SemiBold, modifier = Modifier.noRippleClick {
                    if (sending) return@noRippleClick
                    sending = true
                    scope.launch {
                        try {
                            val body = json("text" to text.trim()); replyTo?.let { body.put("parentId", it.id) }
                            Comment.from(Api.post("posts/${p.id}/comments", body).getJSONObject("comment"))?.let { list.add(it) }
                            text = ""; replyTo = null; onCount(list.size)
                        } catch (e: Exception) { app.errToast(e) } finally { sending = false }
                    }
                })
            }
        }
    }
    del?.let { cm ->
        ConfirmDialog(t("delete") + "?", t("delete"), text = cm.text.take(80), onDismiss = { del = null }) {
            scope.launch { try { Api.delete("comments/${cm.id}"); list.removeAll { it.id == cm.id || it.parentId == cm.id }; onCount(list.size) } catch (e: Exception) { app.errToast(e) } }
            del = null
        }
    }
}
