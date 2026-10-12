package com.ahmedbecetti.nexora.kt.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.I18n
import com.ahmedbecetti.nexora.kt.data.StoryGroup
import com.ahmedbecetti.nexora.kt.data.json
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.data.timeAgo
import com.ahmedbecetti.nexora.kt.ui.AvatarImage
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.VerifiedBadge
import com.ahmedbecetti.nexora.kt.ui.VideoPlayer
import com.ahmedbecetti.nexora.kt.ui.noRippleClick
import com.ahmedbecetti.nexora.kt.ui.toast
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun StoryViewer(groups: List<StoryGroup>, start: Int, active: Boolean) {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val focus = LocalFocusManager.current
    var gi by remember { mutableIntStateOf(start.coerceIn(0, (groups.size - 1).coerceAtLeast(0))) }
    var si by remember { mutableIntStateOf(groups.getOrNull(start)?.stories?.indexOfFirst { !it.seen }?.takeIf { it >= 0 } ?: 0) }
    var progress by remember { mutableFloatStateOf(0f) }
    var paused by remember { mutableStateOf(false) }
    var typing by remember { mutableStateOf(false) }
    var reply by remember { mutableStateOf("") }
    val g = groups.getOrNull(gi)
    val s = g?.stories?.getOrNull(si)
    val mine = g?.user?.id == app.me?.id

    fun next() {
        val grp = groups.getOrNull(gi) ?: return
        if (si < grp.stories.size - 1) { si++; progress = 0f }
        else if (gi < groups.size - 1) { gi++; si = 0; progress = 0f }
        else app.pop()
    }
    fun prev() {
        if (si > 0) { si--; progress = 0f }
        else if (gi > 0) { gi--; si = 0; progress = 0f }
        else progress = 0f
    }

    if (g == null || s == null) { LaunchedEffect(Unit) { app.pop() }; return }

    LaunchedEffect(gi, si) {
        if (s.id > 0 && !mine) try { Api.post("stories/${s.id}/view") } catch (_: Exception) {}
    }
    // image stories advance after 5 s; video stories follow the player's progress
    if (s.type != "video") LaunchedEffect(gi, si, paused || typing || !active) {
        if (paused || typing || !active) return@LaunchedEffect
        while (progress < 1f) { delay(50); progress += 50f / 5000f }
        next()
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        Box(Modifier.fillMaxSize().statusBarsPadding().padding(bottom = 64.dp).clip(RoundedCornerShape(10.dp))
            .pointerInput(gi, si) {
                detectTapGestures(
                    onPress = { paused = true; tryAwaitRelease(); paused = false },
                    onTap = { off ->
                        if (typing) { focus.clearFocus(); return@detectTapGestures }
                        val left = off.x < size.width / 3f
                        if (left xor I18n.rtl) prev() else next()
                    },
                )
            }) {
            if (s.type == "video") VideoPlayer(s.url, null, playing = active && !paused && !typing, muted = false, fill = false, loop = false,
                modifier = Modifier.fillMaxSize(), onEnded = { next() }, onProgress = { pos, dur -> if (dur > 0) progress = pos.toFloat() / dur })
            else AsyncImage(s.url, null, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
            Box(Modifier.fillMaxWidth().height(110.dp).background(Brush.verticalGradient(listOf(Color(0x80000000), Color.Transparent))))
            Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    g.stories.forEachIndexed { i, _ ->
                        Box(Modifier.weight(1f).height(2.5.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x59FFFFFF))) {
                            val f = when { i < si -> 1f; i == si -> progress.coerceIn(0f, 1f); else -> 0f }
                            Box(Modifier.fillMaxHeight().fillMaxWidth(f).background(Color.White))
                        }
                    }
                }
                Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.noRippleClick { app.pop(); app.openProfile(g.user.username) }) { AvatarImage(g.user.avatarUrl, 32.dp) }
                    Spacer(Modifier.width(8.dp))
                    Text(g.user.username, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    if (g.user.verified) VerifiedBadge()
                    Text("  " + timeAgo(s.createdAt), color = Color(0xCCFFFFFF), fontSize = 13.sp)
                    Spacer(Modifier.weight(1f))
                    Icon(NxIcons.Close, null, tint = Color.White, modifier = Modifier.size(28.dp).noRippleClick { app.pop() })
                }
            }
        }
        if (!mine && s.id > 0) Row(Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().imePadding().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f).height(44.dp).border(1.dp, Color(0x99FFFFFF), RoundedCornerShape(22.dp)).padding(horizontal = 16.dp), contentAlignment = Alignment.CenterStart) {
                if (reply.isEmpty()) Text(t("replyStory", "u" to g.user.username), color = Color(0xCCFFFFFF), fontSize = 14.sp)
                BasicTextField(reply, { reply = it }, singleLine = true, textStyle = TextStyle(color = Color.White, fontSize = 14.sp), cursorBrush = SolidColor(Color.White),
                    modifier = Modifier.fillMaxWidth().onFocusChanged { typing = it.isFocused })
            }
            if (reply.isNotBlank()) Text(t("send"), color = Color.White, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 12.dp).noRippleClick {
                val text = reply.trim(); reply = ""; focus.clearFocus()
                app.scope.launch {
                    try { Api.post("messages/${g.user.id}", json("text" to text, "mediaUrl" to (if (s.type == "image") s.url else null), "storyReply" to true)); toast(ctx, t("sent")) } catch (e: Exception) { app.errToast(e) }
                }
            })
        }
    }
}
