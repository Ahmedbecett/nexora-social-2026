package com.ahmedbecetti.nexora.kt.ui

import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ahmedbecetti.nexora.kt.data.I18n
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.theme.Blue
import com.ahmedbecetti.nexora.kt.ui.theme.CloseFriendsGreen
import com.ahmedbecetti.nexora.kt.ui.theme.GrandHotel
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import com.ahmedbecetti.nexora.kt.ui.theme.StoryGradient

enum class Ring { None, Unseen, Seen, Close }

fun Modifier.noRippleClick(onClick: () -> Unit): Modifier = this.then(
    Modifier.clickable(interactionSource = MutableInteractionSource(), indication = null, onClick = onClick)
)

@Composable
fun Avatar(url: String?, size: Dp, modifier: Modifier = Modifier, ring: Ring = Ring.None, onClick: (() -> Unit)? = null) {
    val c = Nx.c
    val gap = if (size >= 60.dp) 3.dp else 2.dp
    val ringW = if (size >= 60.dp) 2.5.dp else 2.dp
    var m = modifier.size(size)
    if (onClick != null) m = m.noRippleClick(onClick)
    Box(m, contentAlignment = Alignment.Center) {
        when (ring) {
            Ring.Unseen -> Box(Modifier.matchParentSize().clip(CircleShape).background(StoryGradient))
            Ring.Close -> Box(Modifier.matchParentSize().clip(CircleShape).background(CloseFriendsGreen))
            Ring.Seen -> Box(Modifier.matchParentSize().border(1.dp, c.border, CircleShape))
            Ring.None -> {}
        }
        val inner = if (ring == Ring.None) size else size - (ringW + gap) * 2 + (if (ring == Ring.Seen) 2.dp else 0.dp)
        Box(
            Modifier.size(if (ring == Ring.None) size else inner + gap * 2).clip(CircleShape).background(c.bg),
            contentAlignment = Alignment.Center,
        ) {
            AvatarImage(url, inner)
        }
    }
}

@Composable
fun AvatarImage(url: String?, size: Dp) {
    val c = Nx.c
    if (url.isNullOrBlank()) {
        Box(Modifier.size(size).clip(CircleShape).background(if (c.dark) Color(0xFF363A3F) else Color(0xFFDBDBDB)), contentAlignment = Alignment.BottomCenter) {
            Icon(NxIcons.User, null, tint = if (c.dark) Color(0xFF0C1014) else Color.White, modifier = Modifier.size(size * 0.9f).padding(top = size * 0.12f))
        }
    } else {
        AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Crop,
            modifier = Modifier.size(size).clip(CircleShape).background(c.sep))
    }
}

@Composable
fun VerifiedBadge(size: Dp = 13.dp) {
    Icon(NxIcons2.Verified, "verified", tint = Color.Unspecified, modifier = Modifier.padding(start = 4.dp).size(size))
}

@Composable
fun UserNameText(user: User, fontSize: TextUnit = 14.sp, color: Color = Nx.c.text, modifier: Modifier = Modifier, weight: FontWeight = FontWeight.SemiBold) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Text(user.username, fontSize = fontSize, fontWeight = weight, color = color, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
        if (user.verified) VerifiedBadge()
    }
}

@Composable
fun Wordmark(size: TextUnit = 34.sp, color: Color = Nx.c.text) {
    Text("Nexora", fontFamily = GrandHotel, fontSize = size, color = color, maxLines = 1)
}

@Composable
fun NxIcon(icon: ImageVector, size: Dp = 24.dp, tint: Color = LocalContentColor.current, modifier: Modifier = Modifier, desc: String? = null) {
    Icon(icon, desc, tint = tint, modifier = modifier.size(size))
}

@Composable
fun IconBtn(icon: ImageVector, onClick: () -> Unit, size: Dp = 24.dp, tint: Color = Nx.c.text, modifier: Modifier = Modifier, desc: String? = null) {
    Box(modifier.size(size + 20.dp).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Icon(icon, desc, tint = tint, modifier = Modifier.size(size).mirrorIfRtl(icon))
    }
}

/** Back / chevron glyphs point the other way in RTL languages (like the web's .flip class). */
fun Modifier.mirrorIfRtl(icon: ImageVector): Modifier =
    if (I18n.rtl && (icon === NxIcons.Back || icon === NxIcons.Chevron)) this.scale(-1f, 1f) else this

@Composable
fun TopBar(title: String, onBack: (() -> Unit)?, modifier: Modifier = Modifier, actions: @Composable () -> Unit = {}) {
    val c = Nx.c
    Row(
        modifier.fillMaxWidth().background(c.bg).statusBarsPadding().height(50.dp).padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) IconBtn(NxIcons.Back, onBack, size = 26.dp) else Spacer(Modifier.width(12.dp))
        Text(title, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f).padding(horizontal = 6.dp))
        actions()
    }
}

@Composable
fun Loader(modifier: Modifier = Modifier, color: Color = Nx.c.muted) {
    Box(modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = color, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
    }
}

@Composable
fun Empty(icon: ImageVector, title: String, sub: String? = null, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    val c = Nx.c
    Column(modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(84.dp).border(2.dp, c.text, CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = c.text, modifier = Modifier.size(40.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text(title, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = c.text, textAlign = TextAlign.Center)
        if (sub != null) {
            Spacer(Modifier.height(8.dp))
            Text(sub, fontSize = 14.sp, color = c.muted, textAlign = TextAlign.Center)
        }
        if (action != null) { Spacer(Modifier.height(16.dp)); action() }
    }
}

@Composable
fun NxButton(
    text: String, onClick: () -> Unit, modifier: Modifier = Modifier, primary: Boolean = true, enabled: Boolean = true,
    loading: Boolean = false, height: Dp = 34.dp, radius: Dp = 8.dp,
) {
    val c = Nx.c
    val bg = if (primary) Blue else c.btn
    val fg = if (primary) Color.White else c.text
    Box(
        modifier.height(height).clip(RoundedCornerShape(radius)).background(if (enabled) bg else bg.copy(alpha = 0.5f))
            .clickable(enabled = enabled && !loading, onClick = onClick).padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) CircularProgressIndicator(color = fg, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
        else Text(text, color = fg, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1)
    }
}

/** Follow / Following / Requested button bound to a follow status string from the API. */
@Composable
fun FollowButton(status: String, followsYou: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, height: Dp = 32.dp) {
    when (status) {
        "accepted" -> NxButton(t("followingBtn"), onClick, modifier, primary = false, height = height)
        "pending" -> NxButton(t("requested"), onClick, modifier, primary = false, height = height)
        else -> NxButton(if (followsYou) t("followBack") else t("follow"), onClick, modifier, primary = true, height = height)
    }
}

@Composable
fun UserRow(user: User, sub: String? = null, onClick: () -> Unit, ring: Ring = Ring.None, trailing: @Composable () -> Unit = {}) {
    val c = Nx.c
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(user.avatarUrl, 50.dp, ring = ring)
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            UserNameText(user)
            val s = sub ?: user.fullName
            if (!s.isNullOrBlank()) Text(s, fontSize = 14.sp, color = c.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        trailing()
    }
}

@Composable
fun Divider(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(0.5.dp).background(Nx.c.sep))
}

@Composable
fun SheetItem(icon: ImageVector?, label: String, danger: Boolean = false, onClick: () -> Unit) {
    val c = Nx.c
    val col = if (danger) com.ahmedbecetti.nexora.kt.ui.theme.Red else c.text
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) { Icon(icon, null, tint = col, modifier = Modifier.size(24.dp)); Spacer(Modifier.width(14.dp)) }
        Text(label, color = col, fontSize = 16.sp)
    }
}

@Composable
fun HeartBurst(visible: Boolean, modifier: Modifier = Modifier) {
    val s by animateFloatAsState(if (visible) 1f else 0f, tween(if (visible) 180 else 260), label = "burst")
    if (s > 0.01f) Icon(NxIcons.HeartFill, null, tint = Color.White, modifier = modifier.size(96.dp).scale(0.6f + 0.6f * s))
}

fun toast(ctx: Context, msg: String) = Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show()

fun shareText(ctx: Context, text: String) {
    val i = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text) }
    ctx.startActivity(Intent.createChooser(i, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

const val WEB_URL = "https://nexora-social-2026.vercel.app"
fun postLink(id: String) = "$WEB_URL/?p=$id"
fun profileLink(u: String) = "$WEB_URL/?u=$u"

@Composable
fun WithContent(color: Color, content: @Composable () -> Unit) = CompositionLocalProvider(LocalContentColor provides color, content = content)
