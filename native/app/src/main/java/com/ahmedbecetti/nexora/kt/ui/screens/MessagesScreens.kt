package com.ahmedbecetti.nexora.kt.ui.screens

import android.util.Base64
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import coil.compose.AsyncImage
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.Route
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.Conversation
import com.ahmedbecetti.nexora.kt.data.Message
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.json
import com.ahmedbecetti.nexora.kt.data.mapObj
import com.ahmedbecetti.nexora.kt.data.parseTime
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.data.timeAgo
import com.ahmedbecetti.nexora.kt.ui.Avatar
import com.ahmedbecetti.nexora.kt.ui.AvatarImage
import com.ahmedbecetti.nexora.kt.ui.Empty
import com.ahmedbecetti.nexora.kt.ui.IconBtn
import com.ahmedbecetti.nexora.kt.ui.Loader
import com.ahmedbecetti.nexora.kt.ui.NxButton
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.SheetItem
import com.ahmedbecetti.nexora.kt.ui.UserNameText
import com.ahmedbecetti.nexora.kt.ui.UserRow
import com.ahmedbecetti.nexora.kt.ui.VerifiedBadge
import com.ahmedbecetti.nexora.kt.ui.VideoPlayer
import com.ahmedbecetti.nexora.kt.ui.noRippleClick
import com.ahmedbecetti.nexora.kt.ui.theme.Blue
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import com.ahmedbecetti.nexora.kt.ui.toast
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject

private const val ACTIVE_MS = 5 * 60_000L
private val MineBubble = Color(0xFF3797F0)
private val Online = Color(0xFF1CD14F)

fun callLogText(text: String): String {
    return try {
        val o = JSONObject(String(Base64.decode(text.removePrefix("⟦NXLOG⟧"), Base64.DEFAULT)))
        val video = o.optString("k") == "video"
        when (o.optString("d")) {
            "missed" -> t(if (video) "ckLogMissedVideo" else "ckLogMissedAudio")
            "ended" -> t(if (video) "ckLogVideoEnd" else "ckLogAudioEnd")
            else -> t(if (video) "ckLogVideoStart" else "ckLogAudioStart")
        }
    } catch (_: Exception) { t("ckCallPreviewAudio") }
}

fun previewOf(c: Conversation): String {
    val txt = c.lastText
    val body = when {
        txt != null && txt.startsWith("⟦NXLOG⟧") -> callLogText(txt)
        txt != null && txt.startsWith("⟦NXCALL⟧") -> t("ckCallPreviewAudio")
        c.lastHasPost -> t("sentPost")
        c.lastMedia != null && txt.isNullOrBlank() -> if (c.lastMediaType == "audio") "🎤" else t("sentPhoto")
        else -> txt ?: ""
    }
    return (if (c.lastMine) t("you") + ": " else "") + body
}

/* ---------------- inbox ---------------- */

@Composable
fun InboxScreen(active: Boolean) {
    val app = LocalApp.current
    val c = Nx.c
    val convs = remember { mutableStateListOf<Conversation>() }
    var loaded by remember { mutableStateOf(false) }
    var q by remember { mutableStateOf("") }
    var newMsg by remember { mutableStateOf(false) }
    var requests by remember { mutableStateOf(false) }

    suspend fun load() {
        try {
            val r = Api.get("conversations")
            convs.clear(); convs.addAll(r.optJSONArray("conversations").mapObj { Conversation.from(it) })
        } catch (_: Exception) {} finally { loaded = true }
    }
    LaunchedEffect(active) {
        while (active && isActive) { load(); app.refreshBadges(); delay(10_000) }
    }
    val shown = convs.filter { q.isBlank() || it.user.username.contains(q.trim().lowercase()) || (it.user.fullName ?: "").lowercase().contains(q.trim().lowercase()) }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().height(54.dp).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Spacer(Modifier.width(10.dp))
            Text(app.me?.username ?: "", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = c.text, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            IconBtn(NxIcons.Edit, { newMsg = true }, size = 26.dp)
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).height(38.dp).clip(RoundedCornerShape(19.dp)).background(c.input).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Icon(NxIcons.Search, null, tint = c.muted, modifier = Modifier.size(18.dp))
            Box(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                if (q.isEmpty()) Text(t("searchPh"), color = c.muted, fontSize = 15.sp)
                BasicTextField(q, { q = it }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(t("messages"), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = c.text, modifier = Modifier.weight(1f))
            Text(t("msgsRequests"), color = Blue, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.noRippleClick { requests = true })
        }
        LazyColumn(Modifier.fillMaxSize()) {
            if (!loaded) item { Loader() }
            if (loaded && convs.isEmpty()) item {
                Empty(NxIcons.Send, t("noMessages"), t("noMessagesSub")) { NxButton(t("newMessage"), { newMsg = true }) }
            }
            items(shown, key = { it.user.id }) { cv -> ConversationRow(cv) { app.push(Route.Chat(cv.user)) } }
        }
    }
    if (newMsg) NewMessageSheet(onDismiss = { newMsg = false }) { u -> newMsg = false; app.push(Route.Chat(u)) }
    if (requests) RequestsSheet(convs.toList(), onDismiss = { requests = false }) { u -> requests = false; app.push(Route.Chat(u)) }
}

@Composable
private fun ConversationRow(cv: Conversation, onClick: () -> Unit) {
    val c = Nx.c
    val online = cv.activeAt != null && System.currentTimeMillis() - parseTime(cv.activeAt) < ACTIVE_MS
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box {
            Avatar(cv.user.avatarUrl, 56.dp)
            if (online) Box(Modifier.align(Alignment.BottomEnd).size(16.dp).clip(CircleShape).background(c.bg).padding(2.5.dp).clip(CircleShape).background(Online))
        }
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(cv.user.fullName?.takeIf { it.isNotBlank() } ?: cv.user.username, fontSize = 14.sp, color = c.text,
                    fontWeight = if (cv.unread > 0) FontWeight.Bold else FontWeight.Normal, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (cv.user.verified) VerifiedBadge()
            }
            Row {
                Text(if (cv.unread > 1) "${cv.unread}+ ${t("msgsNew")}" else previewOf(cv), fontSize = 13.sp, color = if (cv.unread > 0) c.text else c.muted,
                    fontWeight = if (cv.unread > 0) FontWeight.SemiBold else FontWeight.Normal, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                Text(" · " + timeAgo(cv.lastAt), fontSize = 13.sp, color = c.muted, maxLines = 1)
            }
        }
        if (cv.unread > 0) Box(Modifier.size(9.dp).clip(CircleShape).background(Blue))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewMessageSheet(onDismiss: () -> Unit, onPick: (User) -> Unit) {
    val c = Nx.c
    var q by remember { mutableStateOf("") }
    val users = remember { mutableStateListOf<User>() }
    LaunchedEffect(q) {
        delay(250)
        try {
            val r = if (q.isBlank()) Api.get("suggestions") else Api.get("search/users?q=" + java.net.URLEncoder.encode(q.trim(), "UTF-8"))
            users.clear(); users.addAll(r.optJSONArray("users").mapObj { User.from(it) })
        } catch (_: Exception) {}
    }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.elevated, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxSize(0.9f).imePadding()) {
            Text(t("newMessage"), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = c.text, modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 8.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(t("sendTo") + ":", color = c.text, fontWeight = FontWeight.SemiBold)
                Box(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                    if (q.isEmpty()) Text(t("searchPh"), color = c.muted)
                    BasicTextField(q, { q = it }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
                }
            }
            LazyColumn { items(users, key = { it.id }) { u -> UserRow(u, onClick = { onPick(u) }) } }
        }
    }
}

/** Same rule as the web app: conversations where the other person wrote and I never replied. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RequestsSheet(convs: List<Conversation>, onDismiss: () -> Unit, onPick: (User) -> Unit) {
    val c = Nx.c
    var rows by remember { mutableStateOf<List<Conversation>?>(null) }
    LaunchedEffect(Unit) {
        val cands = convs.filter { !it.lastMine }.take(15)
        val out = mutableListOf<Conversation>()
        for (cv in cands) {
            try { val r = Api.get("messages/${cv.user.id}?after=0"); if (r.optJSONArray("messages").mapObj { if (it.optBoolean("mine")) it else null }.isEmpty()) out.add(cv) } catch (_: Exception) {}
        }
        rows = out
    }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.elevated, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxSize(0.9f)) {
            Text(t("msgsRequests"), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = c.text, modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 8.dp))
            val r = rows
            when {
                r == null -> Loader()
                r.isEmpty() -> Empty(NxIcons.Comment, t("msgsNoRequests"), t("msgsNoRequestsSub"))
                else -> LazyColumn { items(r, key = { it.user.id }) { cv -> ConversationRow(cv) { onPick(cv.user) } } }
            }
        }
    }
}

/* ---------------- chat ---------------- */

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ChatScreen(partner: User, active: Boolean) {
    val app = LocalApp.current
    val c = Nx.c
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val msgs = remember { mutableStateListOf<Message>() }
    var user by remember { mutableStateOf(partner) }
    var loaded by remember { mutableStateOf(false) }
    var activeAt by remember { mutableStateOf<String?>(null) }
    var typing by remember { mutableStateOf(false) }
    var since by remember { mutableStateOf<String?>(null) }
    var text by remember { mutableStateOf("") }
    var replyTo by remember { mutableStateOf<Message?>(null) }
    var sheetFor by remember { mutableStateOf<Message?>(null) }
    var lastTypingPing by remember { mutableStateOf(0L) }
    val list = rememberLazyListState()

    fun merge(incoming: List<Message>) {
        for (m in incoming) {
            val i = msgs.indexOfFirst { it.id == m.id }
            when {
                m.gone -> if (i >= 0) msgs.removeAt(i)
                i >= 0 -> msgs[i] = m
                else -> msgs.add(m)
            }
        }
        msgs.sortBy { it.id }
    }
    suspend fun poll() {
        val after = msgs.lastOrNull()?.id ?: 0
        val qs = if (loaded) "?after=$after" + (since?.let { "&since=" + java.net.URLEncoder.encode(it, "UTF-8") } ?: "") else ""
        try {
            val r = Api.get("messages/${partner.id}$qs")
            User.from(r.optJSONObject("user"))?.let { user = it }
            merge(r.optJSONArray("messages").mapObj { Message.from(it) })
            since = r.optString("serverTime").ifBlank { since }
            activeAt = if (r.isNull("activeAt")) null else r.optString("activeAt")
            typing = r.optBoolean("typing")
        } catch (_: Exception) {}
        loaded = true
    }
    LaunchedEffect(active) { while (active && isActive) { poll(); delay(2500) } }
    LaunchedEffect(msgs.size) { if (msgs.isNotEmpty()) list.animateScrollToItem(0) }
    DisposableEffect(Unit) { onDispose { app.scope.launch { app.refreshBadges() } } }

    fun send() {
        val body = text.trim(); if (body.isEmpty()) return
        val rep = replyTo
        text = ""; replyTo = null
        scope.launch {
            try {
                val r = Api.post("messages/${partner.id}", json("text" to body, "replyTo" to rep?.id))
                r.optJSONObject("message")?.let { merge(listOf(Message.from(it))) }
            } catch (e: Exception) { text = body; app.errToast(e) }
        }
    }

    val visible = msgs.filter { !it.isSignal }
    val lastMineId = visible.lastOrNull { it.mine }?.id
    val online = activeAt != null && System.currentTimeMillis() - parseTime(activeAt) < ACTIVE_MS

    Column(Modifier.fillMaxSize().background(c.bg).imePadding()) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().height(56.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconBtn(NxIcons.Back, { app.pop() }, size = 26.dp)
            Row(Modifier.weight(1f).noRippleClick { app.openProfile(user.username) }, verticalAlignment = Alignment.CenterVertically) {
                Box {
                    AvatarImage(user.avatarUrl, 34.dp)
                    if (online) Box(Modifier.align(Alignment.BottomEnd).size(12.dp).clip(CircleShape).background(c.bg).padding(2.dp).clip(CircleShape).background(Online))
                }
                Column(Modifier.padding(horizontal = 10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(user.fullName?.takeIf { it.isNotBlank() } ?: user.username, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (user.verified) VerifiedBadge()
                    }
                    val sub = when {
                        typing -> "…"
                        online -> t("activeNowLive")
                        activeAt != null -> t("activeAgo", "t" to timeAgo(activeAt))
                        else -> user.username
                    }
                    Text(sub, fontSize = 12.sp, color = c.muted, maxLines = 1)
                }
            }
        }
        Box(Modifier.weight(1f)) {
            if (!loaded) Loader()
            LazyColumn(state = list, reverseLayout = true, modifier = Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)) {
                if (typing) item(key = "typing") {
                    Row(Modifier.padding(horizontal = 12.dp, vertical = 4.dp), verticalAlignment = Alignment.Bottom) {
                        AvatarImage(user.avatarUrl, 26.dp)
                        Text("• • •", color = c.muted, modifier = Modifier.padding(start = 8.dp).clip(RoundedCornerShape(18.dp)).background(c.bubbleOther).padding(horizontal = 14.dp, vertical = 8.dp))
                    }
                }
                val rev = visible.asReversed()
                items(rev.size, key = { rev[it].id }) { idx ->
                    val m = rev[idx]
                    val older = rev.getOrNull(idx + 1)
                    val newer = rev.getOrNull(idx - 1)
                    val gap = older == null || parseTime(m.createdAt) - parseTime(older.createdAt) > 30 * 60_000L
                    if (gap) Text(timeAgo(m.createdAt), color = c.muted, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp))
                    val lastOfRun = newer == null || newer.mine != m.mine
                    Bubble(m, partner = user, showAvatar = !m.mine && lastOfRun, onLong = { sheetFor = m }, onOpenPost = { id -> app.push(Route.PostDetail(id.toString())) })
                    if (m.id == lastMineId && m.read && m.mine) Text(t("msgSeen"), color = c.muted, fontSize = 12.sp, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth().padding(end = 16.dp, top = 2.dp))
                }
                if (loaded && visible.isEmpty()) item {
                    Column(Modifier.fillMaxWidth().padding(top = 40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Avatar(user.avatarUrl, 96.dp)
                        Text(user.fullName ?: user.username, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = c.text, modifier = Modifier.padding(top = 10.dp))
                        Text(user.username + " · Nexora", color = c.muted, fontSize = 14.sp)
                        NxButton(t("viewProfile"), { app.openProfile(user.username) }, Modifier.padding(top = 12.dp), primary = false)
                    }
                }
            }
        }
        if (replyTo != null) Row(Modifier.fillMaxWidth().background(c.sep).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(if (replyTo!!.mine) t("you") else user.username, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = c.text)
                Text(replyTo!!.text ?: t("sentPhoto"), fontSize = 13.sp, color = c.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(NxIcons.Close, null, tint = c.muted, modifier = Modifier.size(18.dp).noRippleClick { replyTo = null })
        }
        Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 10.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(24.dp)).background(c.input).heightIn(min = 46.dp).padding(start = 18.dp, end = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f).padding(vertical = 10.dp)) {
                if (text.isEmpty()) Text(t("typeMessage"), color = c.muted, fontSize = 15.sp)
                BasicTextField(text, {
                    text = it
                    val now = System.currentTimeMillis()
                    if (now - lastTypingPing > 3000 && it.isNotBlank()) { lastTypingPing = now; app.scope.launch { try { Api.post("messages/${partner.id}/typing") } catch (_: Exception) {} } }
                }, maxLines = 5, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
            }
            if (text.isNotBlank()) Box(Modifier.padding(start = 6.dp).size(width = 52.dp, height = 34.dp).clip(RoundedCornerShape(17.dp)).background(Color(0xFF4A5DF9)).clickable { send() },
                contentAlignment = Alignment.Center) { Icon(NxIcons.ArrowUp, null, tint = Color.White, modifier = Modifier.size(20.dp)) }
        }
    }

    sheetFor?.let { m ->
        ModalBottomSheet(onDismissRequest = { sheetFor = null }, containerColor = c.elevated) {
            Column(Modifier.navigationBarsPadding().padding(bottom = 12.dp)) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    for (e in listOf("❤️", "😂", "😮", "😢", "😡", "👍")) {
                        val mineR = m.reactions.firstOrNull { it.second }?.first
                        Text(e, fontSize = 30.sp, modifier = Modifier.clip(CircleShape).background(if (mineR == e) c.sep else Color.Transparent).clickable {
                            sheetFor = null
                            scope.launch {
                                try { if (mineR == e) Api.delete("message/${m.id}/react") else Api.post("message/${m.id}/react", json("emoji" to e)); poll() } catch (ex: Exception) { app.errToast(ex) }
                            }
                        }.padding(6.dp))
                    }
                }
                SheetItem(NxIcons.Reply, t("msgReply")) { replyTo = m; sheetFor = null }
                if (!m.text.isNullOrBlank() && !m.isCallLog) SheetItem(NxIcons.Copy, t("msgCopy")) {
                    val cm = ctx.getSystemService(android.content.ClipboardManager::class.java)
                    cm.setPrimaryClip(android.content.ClipData.newPlainText("msg", m.text)); sheetFor = null
                }
                if (m.mine) SheetItem(NxIcons.Unsend, t("msgUnsend"), danger = true) {
                    sheetFor = null
                    scope.launch { try { Api.delete("message/${m.id}"); msgs.removeAll { it.id == m.id } } catch (ex: Exception) { app.errToast(ex) } }
                }
                SheetItem(NxIcons.Trash, t("msgDeleteForYou"), danger = true) {
                    sheetFor = null
                    scope.launch { try { Api.post("message/${m.id}/hide"); msgs.removeAll { it.id == m.id } } catch (ex: Exception) { app.errToast(ex) } }
                }
            }
        }
    }

}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Bubble(m: Message, partner: User, showAvatar: Boolean, onLong: () -> Unit, onOpenPost: (Long) -> Unit) {
    val c = Nx.c
    if (m.isCallLog) {
        Text("📞 " + callLogText(m.text!!) + " · " + timeAgo(m.createdAt), color = c.muted, fontSize = 13.sp, textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp))
        return
    }
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 1.5.dp), horizontalArrangement = if (m.mine) Arrangement.End else Arrangement.Start, verticalAlignment = Alignment.Bottom) {
        if (!m.mine) { if (showAvatar) AvatarImage(partner.avatarUrl, 28.dp) else Spacer(Modifier.width(28.dp)); Spacer(Modifier.width(8.dp)) }
        Column(horizontalAlignment = if (m.mine) Alignment.End else Alignment.Start, modifier = Modifier.widthIn(max = 280.dp)) {
            if (m.replyText != null) Text(m.replyText, fontSize = 13.sp, color = c.muted, maxLines = 2, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(bottom = 2.dp).clip(RoundedCornerShape(14.dp)).border(1.dp, c.border, RoundedCornerShape(14.dp)).padding(horizontal = 12.dp, vertical = 6.dp))
            val mod = Modifier.combinedClickable(onClick = {}, onLongClick = onLong)
            Box {
                Column(mod, horizontalAlignment = if (m.mine) Alignment.End else Alignment.Start) {
                    if (m.postId != null) {
                        Column(Modifier.width(220.dp).clip(RoundedCornerShape(16.dp)).background(c.bubbleOther).clickable { onOpenPost(m.postId) }) {
                            if (m.postUser != null) Text("@" + m.postUser, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = c.text, modifier = Modifier.padding(10.dp))
                            if (m.postThumb != null) AsyncImage(m.postThumb, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().height(260.dp))
                        }
                    }
                    if (m.mediaUrl != null) when (m.mediaType) {
                        "video" -> { var play by remember { mutableStateOf(false) }
                            Box(Modifier.width(220.dp).height(300.dp).clip(RoundedCornerShape(18.dp)).background(Color.Black).clickable { play = !play }, contentAlignment = Alignment.Center) {
                                VideoPlayer(m.mediaUrl, null, playing = play, muted = false, modifier = Modifier.fillMaxSize())
                                if (!play) Icon(NxIcons.Play, null, tint = Color.White, modifier = Modifier.size(40.dp))
                            } }
                        "audio" -> AudioBubble(m.mediaUrl, m.mine)
                        else -> AsyncImage(m.mediaUrl, null, contentScale = ContentScale.Crop, modifier = Modifier.width(220.dp).heightIn(max = 320.dp).clip(RoundedCornerShape(18.dp)).background(c.sep))
                    }
                    if (!m.text.isNullOrBlank()) {
                        val onlyEmoji = m.text.length <= 8 && m.text.codePoints().allMatch { Character.getType(it) == Character.OTHER_SYMBOL.toInt() || Character.getType(it) == Character.SURROGATE.toInt() || it == 0xFE0F || it == 0x200D }
                        if (onlyEmoji) Text(m.text, fontSize = 40.sp, modifier = Modifier.padding(top = 2.dp))
                        else Text(m.text, color = if (m.mine) Color.White else c.text, fontSize = 15.sp,
                            modifier = Modifier.padding(top = if (m.mediaUrl != null || m.postId != null) 2.dp else 0.dp).clip(RoundedCornerShape(20.dp))
                                .background(if (m.mine) MineBubble else c.bubbleOther).padding(horizontal = 14.dp, vertical = 9.dp))
                    }
                }
            }
            if (m.reactions.isNotEmpty()) Text(m.reactions.map { it.first }.distinct().joinToString("") + if (m.reactions.size > 1) " ${m.reactions.size}" else "", fontSize = 13.sp,
                modifier = Modifier.offset(y = (-4).dp).clip(RoundedCornerShape(12.dp)).background(c.elevated).border(1.dp, c.bg, RoundedCornerShape(12.dp)).padding(horizontal = 6.dp, vertical = 2.dp))
        }
    }
}

@Composable
private fun AudioBubble(url: String, mine: Boolean) {
    val c = Nx.c
    val ctx = LocalContext.current
    var playing by remember { mutableStateOf(false) }
    var progress by remember { mutableStateOf(0f) }
    val player = remember(url) { ExoPlayer.Builder(ctx).build().apply { setMediaItem(MediaItem.fromUri(url)); prepare() } }
    DisposableEffect(player) {
        val l = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) { playing = isPlaying }
            override fun onPlaybackStateChanged(state: Int) { if (state == Player.STATE_ENDED) { player.seekTo(0); player.pause(); progress = 0f } }
        }
        player.addListener(l)
        onDispose { player.removeListener(l); player.release() }
    }
    LaunchedEffect(playing) { while (playing) { val d = player.duration; if (d > 0) progress = player.currentPosition.toFloat() / d; delay(100) } }
    val fg = if (mine) Color.White else c.text
    Row(Modifier.width(220.dp).clip(RoundedCornerShape(22.dp)).background(if (mine) MineBubble else c.bubbleOther).clickable { if (playing) player.pause() else player.play() }
        .padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(if (playing) NxIcons.Pause else NxIcons.Play, null, tint = fg, modifier = Modifier.size(22.dp))
        Box(Modifier.weight(1f).padding(horizontal = 10.dp).height(3.dp).clip(RoundedCornerShape(2.dp)).background(fg.copy(alpha = 0.35f))) {
            Box(Modifier.fillMaxWidth(progress.coerceIn(0f, 1f)).height(3.dp).background(fg))
        }
        Text("🎤", fontSize = 14.sp)
    }
}

