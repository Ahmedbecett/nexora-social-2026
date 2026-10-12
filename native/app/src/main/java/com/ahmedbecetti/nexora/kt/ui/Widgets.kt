package com.ahmedbecetti.nexora.kt.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ahmedbecetti.nexora.kt.ui.theme.Blue
import com.ahmedbecetti.nexora.kt.ui.theme.GrandHotel
import com.ahmedbecetti.nexora.kt.ui.theme.Nx

/** Instagram-style brand gradient used for the login wordmark. */
val BrandGradient = Brush.linearGradient(listOf(Color(0xFFFFB13D), Color(0xFFFF5A3C), Color(0xFFE1306C), Color(0xFFC13584), Color(0xFF8A3AB9)))

@Composable
fun GradientWordmark(size: TextUnit = 64.sp) {
    Text("Nexora", fontFamily = GrandHotel, fontSize = size, maxLines = 1, style = TextStyle(brush = BrandGradient))
}

enum class PickKind { Any, Image, Video }

/** System photo picker (no storage permission needed). Returns a launcher; call it to open the picker. */
@Composable
fun rememberMediaPicker(multi: Boolean, kind: PickKind = PickKind.Any, onPicked: (List<Uri>) -> Unit): () -> Unit {
    val cb by rememberUpdatedState(onPicked)
    val type = when (kind) {
        PickKind.Any -> ActivityResultContracts.PickVisualMedia.ImageAndVideo
        PickKind.Image -> ActivityResultContracts.PickVisualMedia.ImageOnly
        PickKind.Video -> ActivityResultContracts.PickVisualMedia.VideoOnly
    }
    val many = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(10)) { if (it.isNotEmpty()) cb(it) }
    val one = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { if (it != null) cb(listOf(it)) }
    return { if (multi) many.launch(PickVisualMediaRequest(type)) else one.launch(PickVisualMediaRequest(type)) }
}

/** Text tabs with a blue underline under the selected one (search / notifications). */
@Composable
fun NxTabs(labels: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    val c = Nx.c
    Column(modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
            labels.forEachIndexed { i, l ->
                val sel = i == selected
                Column(Modifier.padding(horizontal = 4.dp).clickable { onSelect(i) }, horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(l, color = if (sel) c.text else c.muted, fontSize = 14.sp, fontWeight = if (sel) FontWeight.SemiBold else FontWeight.Normal,
                        maxLines = 1, modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp))
                    Box(Modifier.height(2.dp).width(if (sel) 56.dp else 0.dp).clip(RoundedCornerShape(1.dp)).background(Blue))
                }
            }
        }
        Divider()
    }
}

@Composable
fun NxSwitch(checked: Boolean, onChange: (Boolean) -> Unit, enabled: Boolean = true) {
    val c = Nx.c
    Switch(checked, onChange, enabled = enabled, colors = SwitchDefaults.colors(
        checkedTrackColor = Blue, checkedThumbColor = Color.White, uncheckedThumbColor = Color.White,
        uncheckedTrackColor = c.border, uncheckedBorderColor = Color.Transparent, checkedBorderColor = Color.Transparent,
        disabledUncheckedTrackColor = c.sep, disabledUncheckedThumbColor = Color.White, disabledUncheckedBorderColor = Color.Transparent,
    ))
}

/** Settings-style row: icon, label (+ optional value) and chevron. */
@Composable
fun NavRow(icon: ImageVector?, label: String, value: String? = null, danger: Boolean = false, onClick: () -> Unit) {
    val c = Nx.c
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) { Icon(icon, null, tint = if (danger) com.ahmedbecetti.nexora.kt.ui.theme.Red else c.text, modifier = Modifier.size(24.dp)); Spacer(Modifier.width(14.dp)) }
        Text(label, color = if (danger) com.ahmedbecetti.nexora.kt.ui.theme.Red else c.text, fontSize = 15.sp, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (value != null) Text(value, color = c.muted, fontSize = 14.sp, maxLines = 1, modifier = Modifier.padding(start = 8.dp))
        Icon(NxIcons.Chevron, null, tint = c.muted, modifier = Modifier.padding(start = 6.dp).size(16.dp).mirrorIfRtl(NxIcons.Chevron))
    }
}

@Composable
fun ToggleRow(label: String, checked: Boolean, desc: String? = null, icon: ImageVector? = null, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    val c = Nx.c
    Row(Modifier.fillMaxWidth().clickable(enabled = enabled) { onChange(!checked) }.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) { Icon(icon, null, tint = c.text, modifier = Modifier.size(24.dp)); Spacer(Modifier.width(14.dp)) }
        Column(Modifier.weight(1f)) {
            Text(label, color = if (enabled) c.text else c.muted, fontSize = 15.sp, fontWeight = FontWeight.Medium)
            if (desc != null) Text(desc, color = c.muted, fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp))
        }
        NxSwitch(checked, onChange, enabled)
    }
}

@Composable
fun SectionLabel(s: String) = Text(s, color = Nx.c.text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp))
