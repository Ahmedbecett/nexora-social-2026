package com.ahmedbecetti.nexora.kt.ui.screens

import androidx.compose.runtime.mutableFloatStateOf

import androidx.compose.material3.AlertDialog
import androidx.compose.foundation.horizontalScroll

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

import androidx.compose.foundation.rememberScrollState

import com.ahmedbecetti.nexora.kt.ui.NxIcons2

import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.layout.PaddingValues
import com.ahmedbecetti.nexora.kt.ui.TopBar
import com.ahmedbecetti.nexora.kt.data.str

import com.ahmedbecetti.nexora.kt.ui.mirrorIfRtl

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

/** Message requests rule (same as the web app): the other person wrote and I never replied. Cached per session. */
object MsgRequests {
    private val answered = HashMap<Long, Boolean>()
    suspend fun requestsOf(convs: List<Conversation>): Set<Long> {
        val out = HashSet<Long>()
        for (cv in convs) {
            if (cv.lastMine) { answered[cv.user.id] = true; continue }
            val known = answered[cv.user.id]
            if (known == true) continue
            if (known == false) { out.add(cv.user.id); continue }
            try {
                val r = Api.get("messages/${cv.user.id}?after=0")
                val mine = r.optJSONArray("messages").mapObj { if (it.optBoolean("mine")) it else null }.isNotEmpty()
                answered[cv.user.id] = mine
                if (!mine) out.add(cv.user.id)
            } catch (_: Exception) {}
        }
        return out
    }
    fun markAnswered(id: Long) { answered[id] = true }
    /** Spam folder: kept on this device per account (requests you moved to Spam never come back to Requests). */
    fun spam(meId: Long?): Set<Long> = (Api.pref("spam_$meId", "") ?: "").split(',').mapNotNull { it.toLongOrNull() }.toSet()
    fun setSpam(meId: Long?, ids: Set<Long>) = Api.setPref("spam_$meId", ids.joinToString(","))
    /** Delete a conversation for me: hide every message (server `message/:id/hide`). */
    suspend fun deleteForMe(userId: Long) {
        val r = Api.get("messages/$userId?after=0")
        r.optJSONArray("messages").mapObj { it.optLong("id").takeIf { id -> id > 0 } }.forEach { id -> try { Api.post("message/$id/hide") } catch (_: Exception) {} }
    }
}

@Composable
fun InboxScreen(active: Boolean, isTab: Boolean = false) {
    val app = LocalApp.current
    val c = Nx.c
    val convs = remember { mutableStateListOf<Conversation>() }
    var loaded by remember { mutableStateOf(false) }
    var q by remember { mutableStateOf("") }
    var newMsg by remember { mutableStateOf(false) }
    var accounts by remember { mutableStateOf(false) }
    var requestIds by remember { mutableStateOf<Set<Long>>(emptySet()) }
    var noteDialog by remember { mutableStateOf(false) }
    val notes = remember { mutableStateMapOf<Long, String>() }

    suspend fun load() {
        try {
            val r = Api.get("conversations")
            val list = r.optJSONArray("conversations").mapObj { Conversation.from(it) }
            convs.clear(); convs.addAll(list)
            requestIds = MsgRequests.requestsOf(list.take(30)) + MsgRequests.spam(app.me?.id)
        } catch (_: Exception) {} finally { loaded = true }
    }
    LaunchedEffect(active) {
        while (active && isActive) { load(); app.refreshBadges(); delay(10_000) }
    }
    // notes rail: real notes (24h) of people you talk to
    LaunchedEffect(loaded, app.profileVersion) {
        if (!loaded) return@LaunchedEffect
        for (cv in convs.filter { it.user.id !in requestIds }.take(12)) {
            try { Api.get("users/" + android.net.Uri.encode(cv.user.username)).optJSONObject("user")?.str("note")?.let { notes[cv.user.id] = it } ?: notes.remove(cv.user.id) } catch (_: Exception) {}
        }
    }
    val term = q.trim().lowercase()
    val main = convs.filter { it.user.id !in requestIds }
    val shown = main.filter { term.isEmpty() || it.user.username.contains(term) || (it.user.fullName ?: "").lowercase().contains(term) }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        Box(Modifier.fillMaxWidth().statusBarsPadding().height(56.dp).padding(horizontal = 4.dp)) {
            if (!isTab) IconBtn(NxIcons.Back, { app.pop() }, size = 26.dp, modifier = Modifier.align(Alignment.CenterStart))
            Row(Modifier.align(Alignment.Center).noRippleClick { accounts = true }, verticalAlignment = Alignment.CenterVertically) {
                Text(app.me?.username ?: "", fontSize = 21.sp, fontWeight = FontWeight.Bold, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.widthIn(max = 220.dp))
                Icon(NxIcons.Down, null, tint = c.text, modifier = Modifier.padding(start = 6.dp).size(18.dp))
            }
            IconBtn(NxIcons.Edit, { newMsg = true }, size = 27.dp, modifier = Modifier.align(Alignment.CenterEnd))
        }
        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).height(44.dp).clip(RoundedCornerShape(22.dp)).background(c.input).padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Icon(NxIcons.Search, null, tint = c.text, modifier = Modifier.size(20.dp))
                    Box(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                        if (q.isEmpty()) Text(t("search"), color = c.muted, fontSize = 16.sp)
                        BasicTextField(q, { q = it }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 16.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
                    }
                    if (q.isNotEmpty()) Icon(NxIcons.Close, null, tint = c.muted, modifier = Modifier.size(18.dp).noRippleClick { q = "" })
                }
            }
            if (term.isEmpty()) item {
                LazyRow(contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    item { NoteItem(app.me?.avatarUrl, app.me?.note, t("msgsYourNote"), mine = true) { noteDialog = true } }
                    items(main.filter { notes[it.user.id] != null }.take(12), key = { "n" + it.user.id }) { cv ->
                        NoteItem(cv.user.avatarUrl, notes[cv.user.id], cv.user.username, mine = false) { app.push(Route.Chat(cv.user)) }
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(t("messages"), fontWeight = FontWeight.Bold, fontSize = 17.sp, color = c.text, modifier = Modifier.weight(1f))
                    Text(t("msgsRequests") + (requestIds.count { id -> id !in MsgRequests.spam(app.me?.id) }.takeIf { it > 0 }?.let { " ($it)" } ?: ""),
                        color = Blue, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, modifier = Modifier.noRippleClick { app.push(Route.MessageRequests) })
                }
            }
            if (!loaded) item { Loader() }
            if (loaded && main.isEmpty()) item {
                Empty(NxIcons.Send, t("noMessages"), t("noMessagesSub")) { NxButton(t("newMessage"), { newMsg = true }) }
            }
            items(shown, key = { it.user.id }) { cv -> ConversationRow(cv) { app.push(Route.Chat(cv.user)) } }
        }
    }
    if (newMsg) NewMessageSheet(onDismiss = { newMsg = false }) { u -> newMsg = false; app.push(Route.Chat(u)) }
    if (accounts) AccountsSheet(onDismiss = { accounts = false })
    if (noteDialog) NoteDialog(onDismiss = { noteDialog = false })
}

@Composable
private fun NoteItem(avatar: String?, note: String?, label: String, mine: Boolean, onClick: () -> Unit) {
    val c = Nx.c
    Column(Modifier.width(96.dp).noRippleClick(onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.height(120.dp).fillMaxWidth()) {
            Box(Modifier.align(Alignment.BottomCenter)) { AvatarImage(avatar, 84.dp) }
            NoteBubble(note, Modifier.align(Alignment.TopCenter), placeholder = t("msgsYourThoughts"), onClick = onClick)
        }
        Text(label, fontSize = 13.sp, color = if (mine) c.muted else c.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
@OptIn(ExperimentalFoundationApi::class)
private fun ConversationRow(cv: Conversation, onLongClick: (() -> Unit)? = null, onClick: () -> Unit) {
    val app = LocalApp.current
    val c = Nx.c
    val online = cv.activeAt != null && System.currentTimeMillis() - parseTime(cv.activeAt) < ACTIVE_MS
    val story = app.storyOf(cv.user.id)
    Row(Modifier.fillMaxWidth().combinedClickable(onClick = onClick, onLongClick = onLongClick).padding(horizontal = 16.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
        Box {
            Avatar(cv.user.avatarUrl, 62.dp, ring = if (story != null && !story.allSeen) com.ahmedbecetti.nexora.kt.ui.Ring.Unseen else com.ahmedbecetti.nexora.kt.ui.Ring.None, onClick = if (story != null) ({ app.push(Route.Stories(listOf(story), 0)) }) else null)
            if (online) Box(Modifier.align(Alignment.BottomEnd).size(17.dp).clip(CircleShape).background(c.bg).padding(2.5.dp).clip(CircleShape).background(Online))
        }
        Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(cv.user.fullName?.takeIf { it.isNotBlank() } ?: cv.user.username, fontSize = 16.sp, color = c.text,
                    fontWeight = if (cv.unread > 0) FontWeight.Bold else FontWeight.Normal, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (cv.user.verified) VerifiedBadge()
            }
            Row(Modifier.padding(top = 2.dp)) {
                val line = when {
                    cv.unread > 1 -> (if (cv.unread > 4) "4+" else "${cv.unread}") + " " + t("msgsNew")
                    cv.unread == 0 && !cv.lastMine && online -> t("activeNowLive")
                    else -> previewOf(cv)
                }
                Text(line, fontSize = 15.sp, color = if (cv.unread > 0) c.text else c.muted,
                    fontWeight = if (cv.unread > 0) FontWeight.Bold else FontWeight.Normal, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                Text(" · " + timeAgo(cv.lastAt), fontSize = 15.sp, color = if (cv.unread > 0) c.text else c.muted, maxLines = 1)
            }
        }
        if (cv.unread > 0) Box(Modifier.size(10.dp).clip(CircleShape).background(Blue))
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

/** IG "Message requests": banner about Spam, Spam row, requests list (long-press → delete / move to spam). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessageRequestsScreen() {
    val app = LocalApp.current
    val c = Nx.c
    val ctx = LocalContext.current
    var rows by remember { mutableStateOf<List<Conversation>?>(null) }
    var banner by remember { mutableStateOf(Api.pref("spamBanner", "1") == "1") }
    var menuFor by remember { mutableStateOf<Conversation?>(null) }
    var spamIds by remember { mutableStateOf(MsgRequests.spam(app.me?.id)) }
    suspend fun load() {
        try {
            val list = Api.get("conversations").optJSONArray("conversations").mapObj { Conversation.from(it) }
            val req = MsgRequests.requestsOf(list.take(30))
            rows = list.filter { it.user.id in req && it.user.id !in spamIds }
        } catch (e: Exception) { rows = emptyList(); app.errToast(e) }
    }
    LaunchedEffect(spamIds) { load() }
    Column(Modifier.fillMaxSize().background(c.bg)) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().height(56.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconBtn(NxIcons.Back, { app.pop() }, size = 26.dp)
            Text(t("msgRequestsTitle"), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = c.text, modifier = Modifier.weight(1f).padding(start = 8.dp))
            IconBtn(NxIcons.Prefs, { app.push(Route.SettingsPage("messages")) }, size = 26.dp)
        }
        LazyColumn(Modifier.fillMaxSize()) {
            if (banner) item {
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp).clip(RoundedCornerShape(16.dp)).border(1.dp, c.border, RoundedCornerShape(16.dp)).padding(16.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(t("spamBannerTitle"), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = c.text)
                        Text(t("spamBannerText"), fontSize = 15.sp, color = c.text, modifier = Modifier.padding(top = 4.dp))
                    }
                    Icon(NxIcons.Close, null, tint = c.muted, modifier = Modifier.size(20.dp).noRippleClick { banner = false; Api.setPref("spamBanner", "0") })
                }
            }
            item {
                Row(Modifier.fillMaxWidth().clickable { app.push(Route.Spam) }.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(56.dp).clip(CircleShape).background(c.btn), contentAlignment = Alignment.Center) { Icon(NxIcons.EyeOff, null, tint = c.text, modifier = Modifier.size(26.dp)) }
                    Text(t("spam") + if (spamIds.isNotEmpty()) " (${spamIds.size})" else "", fontSize = 16.sp, color = c.text, modifier = Modifier.weight(1f).padding(horizontal = 14.dp))
                    Icon(NxIcons.Chevron, null, tint = c.muted, modifier = Modifier.size(18.dp).mirrorIfRtl(NxIcons.Chevron))
                }
            }
            val r = rows
            when {
                r == null -> item { Loader() }
                r.isEmpty() -> item { Empty(NxIcons.Send, t("noMsgRequestsYet"), t("noMsgRequestsSub")) }
                else -> {
                    item { Text(t("msgRequestsHint"), color = c.muted, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) }
                    items(r, key = { it.user.id }) { cv -> ConversationRow(cv, onLongClick = { menuFor = cv }) { app.push(Route.Chat(cv.user)) } }
                }
            }
        }
    }
    menuFor?.let { cv ->
        ModalBottomSheet(onDismissRequest = { menuFor = null }, containerColor = c.elevated) {
            Column(Modifier.navigationBarsPadding().padding(bottom = 16.dp)) {
                SheetItem(NxIcons.EyeOff, t("moveToSpam")) {
                    menuFor = null
                    spamIds = spamIds + cv.user.id; MsgRequests.setSpam(app.me?.id, spamIds); toast(ctx, t("movedToSpam"))
                }
                SheetItem(NxIcons.Trash, t("delete"), danger = true) {
                    menuFor = null
                    app.scope.launch { try { MsgRequests.deleteForMe(cv.user.id); rows = rows?.filter { it.user.id != cv.user.id }; toast(ctx, t("removed")) } catch (e: Exception) { app.errToast(e) } }
                }
                SheetItem(NxIcons.Block, t("block"), danger = true) {
                    menuFor = null
                    app.scope.launch { try { Api.post("users/${cv.user.id}/block"); rows = rows?.filter { it.user.id != cv.user.id }; toast(ctx, t("blockedToast")) } catch (e: Exception) { app.errToast(e) } }
                }
            }
        }
    }
}

@Composable
fun SpamScreen() {
    val app = LocalApp.current
    val c = Nx.c
    val ctx = LocalContext.current
    var ids by remember { mutableStateOf(MsgRequests.spam(app.me?.id)) }
    var rows by remember { mutableStateOf<List<Conversation>?>(null) }
    LaunchedEffect(ids) {
        rows = try { Api.get("conversations").optJSONArray("conversations").mapObj { Conversation.from(it) }.filter { it.user.id in ids } } catch (_: Exception) { emptyList() }
    }
    Column(Modifier.fillMaxSize().background(c.bg)) {
        TopBar(t("spam"), onBack = { app.pop() })
        LazyColumn(Modifier.fillMaxSize()) {
            val r = rows
            when {
                r == null -> item { Loader() }
                r.isEmpty() -> item { Empty(NxIcons.EyeOff, t("noSpam"), t("noSpamSub")) }
                else -> items(r, key = { it.user.id }) { cv ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.weight(1f)) { ConversationRow(cv) { app.push(Route.Chat(cv.user)) } }
                        TextButtonSmall(t("notSpam")) {
                            ids = ids - cv.user.id; MsgRequests.setSpam(app.me?.id, ids); toast(ctx, t("movedToRequests"))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TextButtonSmall(label: String, onClick: () -> Unit) {
    Text(label, color = Blue, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.padding(end = 16.dp).noRippleClick(onClick))
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
    var recording by remember { mutableStateOf(false) }
    var recordTick by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    LaunchedEffect(recording) { while (recording) { delay(500); recordTick++ } }
    var recordStarted by remember { androidx.compose.runtime.mutableLongStateOf(0L) }
    var recordPath by remember { mutableStateOf<String?>(null) }
    var mediaBusy by remember { mutableStateOf(false) }
    var showExtras by remember { mutableStateOf(false) }
    var showDraw by remember { mutableStateOf(false) }
    var showAiImage by remember { mutableStateOf(false) }
    var giphyKey by remember { mutableStateOf("") }
    var gifQuery by remember { mutableStateOf("") }
    var gifResults by remember { mutableStateOf<List<Pair<String,String>>>(emptyList()) }
    var gifSearchBusy by remember { mutableStateOf(false) }
    var aiPrompt by remember { mutableStateOf("") }
    var aiBusy by remember { mutableStateOf(false) }
    var aiStyle by remember { mutableStateOf("photorealistic, natural light, detailed") }
    var showMusic by remember { mutableStateOf(false) }
    var showAssistant by remember { mutableStateOf(false) }
    var assistantQuestion by remember { mutableStateOf("") }
    var assistantKey by remember { mutableStateOf("") }
    var assistantBase by remember { mutableStateOf("https://api.openai.com/v1") }
    var assistantModel by remember { mutableStateOf("gpt-4o-mini") }
    var assistantReply by remember { mutableStateOf("") }
    var assistantBusy by remember { mutableStateOf(false) }
    var musicTitle by remember { mutableStateOf("") }
    var musicArtist by remember { mutableStateOf("") }
    var musicUrl by remember { mutableStateOf("") }
    val recorder = remember { mutableStateOf<android.media.MediaRecorder?>(null) }
    val photoPicker = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launch { mediaBusy = true; try { val mime = ctx.contentResolver.getType(uri).orEmpty(); if (!mime.startsWith("image/") && !mime.startsWith("video/")) throw Exception("unsupported_type"); val up = com.ahmedbecetti.nexora.kt.data.Upload.media(ctx, uri); val r = Api.post("messages/${user.id}", json("mediaUrl" to up.url, "mediaType" to up.type, "mediaMeta" to org.json.JSONObject().put("w",up.w).put("h",up.h).put("poster",up.poster))); r.optJSONObject("message")?.let { msgs.add(Message.from(it)); msgs.sortBy { m -> m.id } } } catch (e: Exception) { app.errToast(e) }; mediaBusy = false }
    }
    val cameraPicker = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.TakePicturePreview()) { bmp -> if (bmp != null) scope.launch { mediaBusy = true; try { val up = com.ahmedbecetti.nexora.kt.data.Upload.bitmap(bmp, false); val r=Api.post("messages/${user.id}",json("mediaUrl" to up.url,"mediaType" to "image","mediaMeta" to org.json.JSONObject().put("w",up.w).put("h",up.h))); r.optJSONObject("message")?.let{msgs.add(Message.from(it));msgs.sortBy{m->m.id}} } catch(e:Exception){app.errToast(e)}; mediaBusy=false; bmp.recycle() } }
    val cameraPermission = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { ok -> if (ok) cameraPicker.launch(null) else android.widget.Toast.makeText(ctx, t("cameraAccess"), android.widget.Toast.LENGTH_SHORT).show() }
    val locationPermission = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result[android.Manifest.permission.ACCESS_FINE_LOCATION] == true || result[android.Manifest.permission.ACCESS_COARSE_LOCATION] == true) scope.launch {
            mediaBusy = true
            try { val loc = currentLocation(ctx); val lat = loc.latitude; val lng = loc.longitude; val label = "${"%.5f".format(java.util.Locale.US,lat)}, ${"%.5f".format(java.util.Locale.US,lng)}"; val txt = "📍 $label\\nhttps://www.openstreetmap.org/?mlat=$lat&mlon=$lng#map=16/$lat/$lng"; val r = Api.post("messages/${user.id}", json("text" to txt, "replyTo" to replyTo?.id, "mediaMeta" to org.json.JSONObject().put("kind","location").put("lat",lat).put("lng",lng).put("place",label))); r.optJSONObject("message")?.let { msgs.add(Message.from(it)); msgs.sortBy { m -> m.id } }; showExtras = false } catch (e: Exception) { app.errToast(e) }; mediaBusy = false
        } else android.widget.Toast.makeText(ctx, t("ckLocDenied"), android.widget.Toast.LENGTH_LONG).show()
    }
    val micPermission = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) try {
            val f = java.io.File(ctx.cacheDir, "voice-${System.currentTimeMillis()}.m4a")
            val rec = if (android.os.Build.VERSION.SDK_INT >= 31) android.media.MediaRecorder(ctx) else @Suppress("DEPRECATION") android.media.MediaRecorder()
            rec.setAudioSource(android.media.MediaRecorder.AudioSource.MIC); rec.setOutputFormat(android.media.MediaRecorder.OutputFormat.MPEG_4); rec.setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC); rec.setAudioEncodingBitRate(64000); rec.setAudioSamplingRate(24000); rec.setOutputFile(f.absolutePath); rec.prepare(); rec.start()
            recorder.value = rec; recordPath = f.absolutePath; recordStarted = System.currentTimeMillis(); recording = true
        } catch (_: Exception) { android.widget.Toast.makeText(ctx, t("msgMicUnsupported"), android.widget.Toast.LENGTH_SHORT).show() }
    }
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
                Column(Modifier.padding(horizontal = 10.dp).weight(1f)) {
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
            IconBtn(NxIcons2.Phone, { PermissionRequester.call(false) { com.ahmedbecetti.nexora.kt.call.CallEngine.startCall(user, "audio") } }, size = 23.dp, tint = Color(0xFF0095F6), modifier = Modifier.padding(horizontal = 7.dp), desc = t("ckVoiceCall"))
            IconBtn(NxIcons2.Video, { PermissionRequester.call(true) { com.ahmedbecetti.nexora.kt.call.CallEngine.startCall(user, "video") } }, size = 24.dp, tint = Color(0xFF0095F6), modifier = Modifier.padding(end = 8.dp), desc = t("ckVideoCall"))
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
            IconBtn(NxIcons.Camera, { cameraPermission.launch(android.Manifest.permission.CAMERA) }, size = 23.dp, tint = Color(0xFF0095F6), modifier = Modifier.padding(end = 8.dp), desc = t("msgPhoto"))
            Box(Modifier.weight(1f).padding(vertical = 10.dp)) {
                if (text.isEmpty()) Text(if (recording) "●  ${recordTick / 2}s — ${t("msgVoice")}" else t("typeMessage"), color = if (recording) Color(0xFFE5484D) else c.muted, fontSize = 15.sp)
                BasicTextField(text, {
                    text = it
                    val now = System.currentTimeMillis()
                    if (now - lastTypingPing > 3000 && it.isNotBlank()) { lastTypingPing = now; app.scope.launch { try { Api.post("messages/${partner.id}/typing") } catch (_: Exception) {} } }
                }, enabled = !recording, maxLines = 5, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
            }
            if (text.isNotBlank()) Box(Modifier.padding(start = 6.dp).size(width = 48.dp, height = 34.dp).clip(RoundedCornerShape(17.dp)).background(Color(0xFF4A5DF9)).clickable { send() }, contentAlignment = Alignment.Center) { Icon(NxIcons.ArrowUp, null, tint = Color.White, modifier = Modifier.size(20.dp)) }
            else if (recording) {
                IconBtn(NxIcons.Trash, {
                    val rec = recorder.value; val path = recordPath; recorder.value = null; recording = false; recordPath = null
                    try { rec?.stop() } catch (_: Exception) {}; try { rec?.release() } catch (_: Exception) {}
                    path?.let { java.io.File(it).delete() }
                }, size = 22.dp, tint = Color(0xFFE5484D))
                IconBtn(NxIcons.ArrowUp, {
                val rec = recorder.value; val path = recordPath; recorder.value = null; recording = false
                try { rec?.stop() } catch (_: Exception) {}; try { rec?.release() } catch (_: Exception) {}
                if (path != null) scope.launch {
                    mediaBusy = true
                    try { val bytes = java.io.File(path).readBytes(); if (bytes.size < 1200) throw Exception("short recording"); val url = com.ahmedbecetti.nexora.kt.data.Upload.bytes(bytes, "audio/mp4"); val dur = ((System.currentTimeMillis() - recordStarted) / 1000).coerceAtLeast(1L); val r = Api.post("messages/${user.id}", json("mediaUrl" to url, "mediaType" to "audio", "mediaMeta" to org.json.JSONObject().put("duration", dur))); r.optJSONObject("message")?.let { msgs.add(Message.from(it)); msgs.sortBy { m -> m.id } }; java.io.File(path).delete() } catch (e: Exception) { app.errToast(e) }; mediaBusy = false
                }
                }, size = 24.dp, tint = Color(0xFF0095F6))
            } else {
                IconBtn(NxIcons.Mic, { if (androidx.core.content.ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED) micPermission.launch(android.Manifest.permission.RECORD_AUDIO) else micPermission.launch(android.Manifest.permission.RECORD_AUDIO) }, size = 23.dp, tint = Color(0xFF0095F6), modifier = Modifier.padding(horizontal = 4.dp), desc = t("msgVoice"))
                IconBtn(NxIcons2.Sticker, { showExtras = true }, size = 23.dp, tint = Color(0xFF0095F6), modifier = Modifier.padding(horizontal = 4.dp), desc = t("ckStickers"))
                IconBtn(NxIcons.Plus, { photoPicker.launch(arrayOf("image/*", "video/*")) }, size = 23.dp, tint = Color(0xFF0095F6), modifier = Modifier.padding(start = 4.dp), desc = t("ckMore"))
            }
        }
    }

    if (showMusic) AlertDialog(onDismissRequest = { showMusic = false }, title = { Text(t("ckMusic")) }, text = { Column {
        androidx.compose.material3.OutlinedTextField(musicTitle, { musicTitle = it }, label = { Text(t("ckTrackTitle")) }, singleLine = true)
        androidx.compose.material3.OutlinedTextField(musicArtist, { musicArtist = it }, label = { Text(t("ckTrackArtist")) }, singleLine = true)
        androidx.compose.material3.OutlinedTextField(musicUrl, { musicUrl = it }, label = { Text(t("ckOpenLink")) }, singleLine = true)
    } }, confirmButton = { androidx.compose.material3.TextButton(enabled = musicTitle.isNotBlank() && musicUrl.startsWith("https://"), onClick = {
        scope.launch { try { val meta = org.json.JSONObject().put("kind","music").put("title",musicTitle).put("artist",musicArtist).put("link",musicUrl); val r = Api.post("messages/${user.id}", json("text" to "♫ $musicTitle — $musicArtist", "mediaMeta" to meta)); r.optJSONObject("message")?.let { msgs.add(Message.from(it)); msgs.sortBy { m -> m.id } }; showMusic = false } catch (e: Exception) { app.errToast(e) } }
    }) { Text(t("ckMakeCard")) } }, dismissButton = { androidx.compose.material3.TextButton(onClick = { showMusic = false }) { Text(t("cancel")) } })
    if (showAssistant) AlertDialog(onDismissRequest = { showAssistant = false }, title = { Text(t("ckAi")) }, text = { Column {
        androidx.compose.material3.OutlinedTextField(assistantQuestion, { assistantQuestion = it }, label = { Text(t("ckAiAsk")) }, minLines = 2, enabled = !assistantBusy)
        if (assistantBusy) androidx.compose.material3.CircularProgressIndicator(Modifier.padding(12.dp))
        if (assistantReply.isNotBlank()) Text(assistantReply, color = c.text, modifier = Modifier.padding(top = 8.dp))
        androidx.compose.material3.OutlinedTextField(assistantKey, { assistantKey = it }, label = { Text("AI provider API key (kept in memory only)") }, singleLine = true, visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation())
        androidx.compose.material3.OutlinedTextField(assistantBase, { assistantBase = it }, label = { Text("OpenAI-compatible HTTPS endpoint") }, singleLine = true)
        androidx.compose.material3.OutlinedTextField(assistantModel, { assistantModel = it }, label = { Text("Model") }, singleLine = true)
    } }, confirmButton = { androidx.compose.material3.TextButton(enabled = assistantQuestion.isNotBlank() && !assistantBusy, onClick = {
        assistantBusy = true; assistantReply = ""
        scope.launch {
            try {
                val key = assistantKey.trim().takeIf { it.isNotBlank() } ?: throw Exception("key")
                val base = assistantBase.trim().trimEnd('/').takeIf { it.startsWith("https://") } ?: throw Exception("endpoint")
                val model = assistantModel.trim().takeIf { it.isNotBlank() } ?: throw Exception("model")
                val arr = org.json.JSONArray().put(org.json.JSONObject().put("role","system").put("content","You are Nexora AI, a helpful conversation assistant. Be honest, concise, and do not claim to take actions."))
                msgs.takeLast(16).forEach { m -> val v = m.text?.takeIf { it.isNotBlank() } ?: return@forEach; if (!m.isCallLog && !m.isSignal) arr.put(org.json.JSONObject().put("role",if (m.mine) "user" else "assistant").put("content",v)) }
                arr.put(org.json.JSONObject().put("role","user").put("content",assistantQuestion))
                val body = org.json.JSONObject().put("model",model).put("messages",arr).put("max_tokens",700)
                val req = okhttp3.Request.Builder().url("$base/chat/completions").header("Authorization","Bearer $key").post(body.toString().toRequestBody("application/json; charset=utf-8".toMediaType())).build()
                val data = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { Api.http.newCall(req).execute().use { res -> if (!res.isSuccessful) throw Exception("ai_${res.code}"); org.json.JSONObject(res.body?.string().orEmpty()) } }
                assistantReply = data.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")?.optString("content").orEmpty().ifBlank { throw Exception("empty") }
            } catch (_: Exception) { assistantReply = t("ckAiKeyHint") + "\\n\\n" + t("ckServices") }
            assistantBusy = false
        }
    }) { Text(t("ckAiSuggestReplies")) } }, dismissButton = { androidx.compose.material3.TextButton(onClick = { if (assistantReply.isNotBlank()) { text = assistantReply; showAssistant = false } else showAssistant = false }) { Text(if (assistantReply.isNotBlank()) t("send") else t("cancel")) } })
    if (showAiImage) AlertDialog(onDismissRequest = { if (!aiBusy) showAiImage = false }, title = { Text(t("ckAiImages")) }, text = { Column {
        androidx.compose.material3.OutlinedTextField(aiPrompt, { aiPrompt = it }, label = { Text(t("ckAiPlaceholder")) }, minLines = 2, enabled = !aiBusy)
        Spacer(Modifier.height(8.dp))
        Box(Modifier.horizontalScroll(rememberScrollState())) { Row {
            listOf("photorealistic, natural light, detailed", "anime illustration", "3D render", "watercolor painting", "minimal flat design").forEach { style ->
                androidx.compose.material3.FilterChip(selected = aiStyle == style, onClick = { aiStyle = style }, label = { Text(style.substringBefore(",").take(14)) }, modifier = Modifier.padding(end = 5.dp))
            }
        } }
        if (aiBusy) Row(verticalAlignment = Alignment.CenterVertically) { androidx.compose.material3.CircularProgressIndicator(Modifier.size(20.dp)); Text(t("ckGenerating"), modifier = Modifier.padding(start = 8.dp)) }
    } }, confirmButton = { androidx.compose.material3.TextButton(enabled = !aiBusy && aiPrompt.isNotBlank(), onClick = {
        val prompt = aiPrompt.trim(); aiBusy = true
        scope.launch {
            try {
                val full = java.net.URLEncoder.encode("$prompt, $aiStyle", "UTF-8").replace("+", "%20")
                val url = "https://image.pollinations.ai/prompt/$full?width=1024&height=1024&nologo=true&model=flux&seed=${System.currentTimeMillis() % 1000000}"
                val req = okhttp3.Request.Builder().url(url).header("User-Agent", com.ahmedbecetti.nexora.kt.data.Api.USER_AGENT).get().build()
                val bytes = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { com.ahmedbecetti.nexora.kt.data.Api.http.newCall(req).execute().use { res -> if (!res.isSuccessful) throw Exception("image_service_${res.code}"); res.body?.bytes() ?: throw Exception("empty") } }
                val blob = com.ahmedbecetti.nexora.kt.data.Upload.bytes(bytes, "image/jpeg")
                val r = Api.post("messages/${user.id}", json("mediaUrl" to blob, "mediaType" to "image", "mediaMeta" to org.json.JSONObject().put("kind", "ai").put("prompt", prompt)))
                r.optJSONObject("message")?.let { msgs.add(Message.from(it)); msgs.sortBy { m -> m.id } }
                showAiImage = false
            } catch (e: Exception) { android.widget.Toast.makeText(ctx, t("ckAiFailed"), android.widget.Toast.LENGTH_LONG).show() }
            aiBusy = false
        }
    }) { Text(t("ckGenerate")) } }, dismissButton = { androidx.compose.material3.TextButton(enabled = !aiBusy, onClick = { showAiImage = false }) { Text(t("cancel")) } })
    if (showDraw) DrawingSheet(onDismiss = { showDraw = false }) { bitmap ->
        showDraw = false
        scope.launch { mediaBusy = true; try { val up = com.ahmedbecetti.nexora.kt.data.Upload.bitmap(bitmap, true); val r = Api.post("messages/${user.id}", json("mediaUrl" to up.url,"mediaType" to "image","mediaMeta" to org.json.JSONObject().put("kind","draw").put("w",up.w).put("h",up.h))); r.optJSONObject("message")?.let { msgs.add(Message.from(it)); msgs.sortBy { m -> m.id } }; bitmap.recycle() } catch (e: Exception) { app.errToast(e) }; mediaBusy = false }
    }
    if (showExtras) {
        var tab by remember { mutableStateOf("stickers") }
        ModalBottomSheet(onDismissRequest = { showExtras = false }, containerColor = c.elevated) {
            Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    androidx.compose.material3.TextButton(onClick = { locationPermission.launch(arrayOf(android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION)) }) { Icon(NxIcons.Location, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text(t("ckLocation")) }
                    androidx.compose.material3.TextButton(onClick = { showDraw = true; showExtras = false }) { Icon(NxIcons2.Draw, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text(t("ckDraw")) }
                    androidx.compose.material3.TextButton(onClick = { showAiImage = true; showExtras = false }) { Icon(NxIcons2.AiImage, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text(t("ckAiImages")) }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    androidx.compose.material3.TextButton(onClick = { tab = "stickers" }) { Text(t("ckStickers")) }
                    androidx.compose.material3.TextButton(onClick = { tab = "gifs" }) { Text(t("ckGifs")) }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    androidx.compose.material3.TextButton(onClick = { showMusic = true; showExtras = false }) { Icon(NxIcons.Music, null, modifier = Modifier.size(18.dp)); Text(t("ckMusic")) }
                    androidx.compose.material3.TextButton(onClick = { showAssistant = true; showExtras = false }) { Icon(NxIcons2.Sparkle, null, modifier = Modifier.size(18.dp)); Text(t("ckAi")) }
                }
                androidx.compose.material3.OutlinedTextField(giphyKey, { giphyKey = it }, label = { Text("Optional GIPHY API key") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(verticalAlignment = Alignment.CenterVertically) {
                    androidx.compose.material3.OutlinedTextField(gifQuery, { gifQuery = it }, label = { Text(t("ckSearchStickers")) }, singleLine = true, modifier = Modifier.weight(1f))
                    IconBtn(NxIcons.Search, { if (giphyKey.isNotBlank() && gifQuery.isNotBlank()) scope.launch { gifSearchBusy = true; try {
                        val u = "https://api.giphy.com/v1/${if (tab == "stickers") "stickers" else "gifs"}/search?api_key=${java.net.URLEncoder.encode(giphyKey.trim(),"UTF-8")}&q=${java.net.URLEncoder.encode(gifQuery.trim(),"UTF-8")}&limit=24&rating=pg-13"
                        val req = okhttp3.Request.Builder().url(u).build()
                        val res = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { Api.http.newCall(req).execute().use { if (!it.isSuccessful) throw Exception("giphy"); org.json.JSONObject(it.body?.string().orEmpty()) } }
                        val arr = res.optJSONArray("data") ?: org.json.JSONArray(); gifResults = (0 until arr.length()).mapNotNull { i -> val ob=arr.optJSONObject(i) ?: return@mapNotNull null; val url=ob.optJSONObject("images")?.optJSONObject("fixed_height")?.optString("url") ?: return@mapNotNull null; ob.optString("title") to url }
                    } catch (e: Exception) { android.widget.Toast.makeText(ctx, "GIPHY search failed", android.widget.Toast.LENGTH_SHORT).show() }; gifSearchBusy = false } }, size = 24.dp, tint = Color(0xFF0095F6))
                }
                if (gifSearchBusy) androidx.compose.material3.CircularProgressIndicator(Modifier.size(22.dp))
                if (gifResults.isNotEmpty()) LazyRow(Modifier.fillMaxWidth().height(90.dp)) { items(gifResults) { (title,url) ->
                    AsyncImage(url, title, modifier = Modifier.size(width = 120.dp, height = 82.dp).clickable {
                        showExtras = false
                        scope.launch {
                            mediaBusy = true
                            try {
                                val req = okhttp3.Request.Builder().url(url).build()
                                val bytes = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { Api.http.newCall(req).execute().use { it.body?.bytes() ?: throw Exception("empty") } }
                                val blob = com.ahmedbecetti.nexora.kt.data.Upload.bytes(bytes, "image/gif")
                                val r = Api.post("messages/${user.id}", json("mediaUrl" to blob, "mediaType" to "image", "mediaMeta" to org.json.JSONObject().put("kind", "gif")))
                                r.optJSONObject("message")?.let { msgs.add(Message.from(it)); msgs.sortBy { m -> m.id } }
                            } catch (e: Exception) { app.errToast(e) }
                            mediaBusy = false
                        }
                    })
                } }
                val assetFolder = if (tab == "stickers") "stickers-png" else "gifs"
                val files = remember(tab) { ctx.assets.list("chatkit/$assetFolder")?.toList().orEmpty() }
                LazyColumn(Modifier.heightIn(max = 420.dp)) {
                    items(files.chunked(3)) { row -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        row.forEach { name ->
                            val path = "chatkit/$assetFolder/$name"
                            AsyncImage("file:///android_asset/$path", name, modifier = Modifier.size(86.dp).clickable {
                                showExtras = false
                                scope.launch { mediaBusy = true; try {
                                    val bytes = ctx.assets.open(path).use { it.readBytes() }
                                    val mime = if (name.endsWith(".gif")) "image/gif" else "image/png"
                                    val url = com.ahmedbecetti.nexora.kt.data.Upload.bytes(bytes, mime)
                                    val kind = if (tab == "gifs") "gif" else "sticker"
                                    val r = Api.post("messages/${user.id}", json("mediaUrl" to url, "mediaType" to "image", "mediaMeta" to org.json.JSONObject().put("kind", kind)))
                                    r.optJSONObject("message")?.let { merge(listOf(Message.from(it))) }
                                } catch (e: Exception) { app.errToast(e) }; mediaBusy = false }
                            })
                        }
                    } }
                }
                Text(t("ckGiphyNote"), color = c.muted, fontSize = 12.sp, modifier = Modifier.padding(top = 10.dp))
            }
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
    val ctx = LocalContext.current
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
                    if (m.mediaMeta?.optString("kind") == "music") {
                        val title = m.mediaMeta.optString("title"); val artist = m.mediaMeta.optString("artist"); val link = m.mediaMeta.optString("link")
                        Row(Modifier.width(220.dp).clip(RoundedCornerShape(16.dp)).background(if (m.mine) MineBubble else c.bubbleOther).clickable { try { ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(link))) } catch (_: Exception) {} }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(NxIcons.Music, null, tint = if (m.mine) Color.White else c.text, modifier = Modifier.size(28.dp))
                            Column(Modifier.padding(start = 10.dp)) { Text(title, color = if (m.mine) Color.White else c.text, fontWeight = FontWeight.SemiBold); Text(artist, color = if (m.mine) Color.White.copy(alpha = .8f) else c.muted, fontSize = 12.sp); Text(t("ckOpenLink"), color = if (m.mine) Color.White.copy(alpha = .8f) else c.muted, fontSize = 12.sp) }
                        }
                    }
                    if (m.mediaMeta?.optString("kind") == "location") {
                        val lat = m.mediaMeta.optDouble("lat"); val lng = m.mediaMeta.optDouble("lng"); val place = m.mediaMeta.optString("place", "Location")
                        Row(Modifier.width(220.dp).clip(RoundedCornerShape(16.dp)).background(if (m.mine) MineBubble else c.bubbleOther).clickable {
                            try { val uri = android.net.Uri.parse("geo:$lat,$lng?q=$lat,$lng(" + android.net.Uri.encode(place) + ")"); ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, uri)) } catch (_: Exception) {}
                        }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(NxIcons.Location, null, tint = if (m.mine) Color.White else c.text, modifier = Modifier.size(26.dp))
                            Column(Modifier.padding(start = 10.dp)) { Text(place, color = if (m.mine) Color.White else c.text, fontWeight = FontWeight.SemiBold); Text(t("ckOpenMaps"), color = if (m.mine) Color.White.copy(alpha = .8f) else c.muted, fontSize = 12.sp) }
                        }
                    }
                    if (!m.text.isNullOrBlank() && m.mediaMeta?.optString("kind") !in listOf("location", "music")) {
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

