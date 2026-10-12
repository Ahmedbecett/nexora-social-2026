package com.ahmedbecetti.nexora.kt.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.Route
import com.ahmedbecetti.nexora.kt.SavedAccount
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.ApiException
import com.ahmedbecetti.nexora.kt.data.I18n
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.json
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.Avatar
import com.ahmedbecetti.nexora.kt.ui.IconBtn
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.mirrorIfRtl
import com.ahmedbecetti.nexora.kt.ui.noRippleClick
import com.ahmedbecetti.nexora.kt.ui.theme.Blue
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import com.ahmedbecetti.nexora.kt.ui.theme.Red
import com.ahmedbecetti.nexora.kt.ui.toast
import kotlinx.coroutines.launch
import org.json.JSONArray

/** The little thought bubble above the profile photo / in the notes rail (real 24h note from the server). */
@Composable
fun NoteBubble(note: String?, modifier: Modifier = Modifier, placeholder: String = t("noteProfilePh"), onClick: () -> Unit) {
    val c = Nx.c
    val bg = if (c.dark) Color(0xFF262A2F) else Color.White
    Box(modifier) {
        Box(Modifier.widthIn(max = 104.dp).shadow(3.dp, RoundedCornerShape(16.dp)).clip(RoundedCornerShape(16.dp)).background(bg)
            .then(if (c.dark) Modifier else Modifier.border(0.5.dp, c.border, RoundedCornerShape(16.dp)))
            .noRippleClick(onClick).padding(horizontal = 12.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
            Text(if (note.isNullOrBlank()) placeholder else note, fontSize = 12.sp, lineHeight = 15.sp, color = if (note.isNullOrBlank()) c.muted else c.text,
                textAlign = TextAlign.Center, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun LinkChip(icon: ImageVector, label: String, muted: Boolean = false, onClick: () -> Unit) {
    val c = Nx.c
    Row(Modifier.height(36.dp).clip(RoundedCornerShape(18.dp)).border(1.dp, c.border, RoundedCornerShape(18.dp)).clickable(onClick = onClick).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = if (muted) c.muted else c.text, modifier = Modifier.size(16.dp))
        Text(label, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = if (muted) c.muted else c.text, maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(start = 6.dp).widthIn(max = 180.dp))
    }
}

@Composable
private fun DialogInput(value: String, onChange: (String) -> Unit, placeholder: String, max: Int, single: Boolean = true) {
    val c = Nx.c
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(c.input).padding(12.dp)) {
        if (value.isEmpty()) Text(placeholder, color = c.muted, fontSize = 15.sp)
        BasicTextField(value, { onChange(it.take(max)) }, singleLine = single, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
    }
}

/** Share / clear your note (PATCH me {note}); notes disappear after 24h on the server. */
@Composable
fun NoteDialog(onDismiss: () -> Unit) {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val c = Nx.c
    var text by remember { mutableStateOf(app.me?.note ?: "") }
    var busy by remember { mutableStateOf(false) }
    fun save(v: String) {
        busy = true
        app.scope.launch {
            try {
                val u = User.from(Api.patch("me", json("note" to v.trim())).optJSONObject("user"))
                app.me = app.me?.copy(note = u?.note); app.profileVersion++
                toast(ctx, t("noteSaved")); onDismiss()
            } catch (e: Exception) { app.errToast(e) } finally { busy = false }
        }
    }
    AlertDialog(
        onDismissRequest = onDismiss, containerColor = c.elevated,
        title = { Text(t("note"), fontWeight = FontWeight.SemiBold, color = c.text) },
        text = {
            Column {
                DialogInput(text, { text = it }, t("notePh"), 60, single = false)
                Text(t("noteHint"), color = c.muted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
            }
        },
        confirmButton = { TextButton(enabled = !busy && text.isNotBlank(), onClick = { save(text) }) { Text(t("share"), color = Blue, fontWeight = FontWeight.SemiBold) } },
        dismissButton = {
            Row {
                if (!app.me?.note.isNullOrBlank()) TextButton(enabled = !busy, onClick = { save("") }) { Text(t("deleteNote"), color = Red) }
                TextButton(onClick = onDismiss) { Text(t("cancel"), color = c.text) }
            }
        },
    )
}

/** Add / remove profile links (PATCH me {links}, max 5). */
@Composable
fun LinksDialog(current: List<Pair<String, String>>, onDismiss: () -> Unit, onSaved: () -> Unit) {
    val app = LocalApp.current
    val c = Nx.c
    val links = remember { mutableStateListOf<Pair<String, String>>().apply { addAll(current) } }
    var title by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }
    var err by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    fun push(list: List<Pair<String, String>>) {
        busy = true
        app.scope.launch {
            try {
                val arr = JSONArray(); list.forEach { (t0, u) -> arr.put(json("title" to t0.ifBlank { null }, "url" to u)) }
                val u = User.from(Api.patch("me", json("links" to arr)).optJSONObject("user"))
                app.me = app.me?.copy(links = u?.links ?: list); onSaved(); onDismiss()
            } catch (e: ApiException) { err = I18n.err(e.code) } catch (e: Exception) { app.errToast(e) } finally { busy = false }
        }
    }
    AlertDialog(
        onDismissRequest = onDismiss, containerColor = c.elevated,
        title = { Text(t("links"), fontWeight = FontWeight.SemiBold, color = c.text) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                links.forEachIndexed { i, (t0, u) ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(NxIcons.Link, null, tint = c.text, modifier = Modifier.size(16.dp))
                        Text(t0.ifBlank { u }, color = c.text, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(horizontal = 8.dp))
                        Icon(NxIcons.Close, null, tint = c.muted, modifier = Modifier.size(18.dp).noRippleClick { if (!busy) push(links.toList().filterIndexed { j, _ -> j != i }) })
                    }
                }
                if (links.size < 5) {
                    Spacer(Modifier.height(8.dp))
                    DialogInput(url, { url = it; err = null }, "https://", 300)
                    Spacer(Modifier.height(8.dp))
                    DialogInput(title, { title = it }, t("linkTitle"), 40)
                }
                err?.let { Text(it, color = Red, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp)) }
            }
        },
        confirmButton = {
            TextButton(enabled = !busy && url.isNotBlank() && links.size < 5, onClick = { push(links.toList() + (title.trim() to url.trim())) }) {
                Text(t("add"), color = Blue, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t("done"), color = c.text) } },
    )
}

private fun badgeLine(n: Pair<Int, Int>?): String? {
    if (n == null) return null
    return when {
        n.second > 0 -> if (n.second == 1) t("oneChat") else t("nChats", "n" to "${n.second}")
        n.first > 0 -> if (n.first == 1) t("oneNotification") else t("nNotifications", "n" to "${n.first}")
        else -> null
    }
}

/** Account switcher (IG bottom sheet): accounts on this device with unread counts, add account, Accounts Center. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountsSheet(onDismiss: () -> Unit) {
    val app = LocalApp.current
    val c = Nx.c
    LaunchedEffect(Unit) { app.refreshAccountBadges() }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bg) {
        Column(Modifier.navigationBarsPadding().padding(horizontal = 16.dp).padding(bottom = 16.dp)) {
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).border(1.dp, c.border, RoundedCornerShape(20.dp)).padding(vertical = 6.dp)) {
                val list = app.accounts.ifEmpty { listOfNotNull(app.me?.let { SavedAccount(it.id, it.username, it.avatarUrl, Api.token) }) }
                list.forEach { a ->
                    val cur = a.id == app.me?.id
                    Row(Modifier.fillMaxWidth().clickable {
                        if (cur) onDismiss()
                        else if (a.token != null) { onDismiss(); app.switchTo(a) }
                        else { onDismiss(); app.addAccount() }
                    }.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Avatar(if (cur) app.me?.avatarUrl else a.avatarUrl, 54.dp)
                        Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                            Text(a.username, fontSize = 16.sp, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            val line = if (cur) null else if (a.token == null) t("loginAgain") else badgeLine(app.accountBadges[a.id])
                            if (line != null) Row(verticalAlignment = Alignment.CenterVertically) {
                                if (a.token != null) Box(Modifier.padding(end = 6.dp).size(6.dp).clip(CircleShape).background(Red))
                                Text(line, fontSize = 14.sp, color = c.muted)
                            }
                        }
                        if (cur) Box(Modifier.size(26.dp).clip(CircleShape).background(Blue), contentAlignment = Alignment.Center) {
                            Icon(NxIcons.Check, null, tint = Color.White, modifier = Modifier.size(17.dp))
                        }
                    }
                }
                Row(Modifier.fillMaxWidth().clickable { onDismiss(); app.addAccount() }.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(54.dp).clip(CircleShape).background(c.btn), contentAlignment = Alignment.Center) { Icon(NxIcons.Plus, null, tint = c.text, modifier = Modifier.size(26.dp)) }
                    Text(t("addNexoraAccount"), fontSize = 16.sp, color = c.text, modifier = Modifier.padding(horizontal = 14.dp))
                }
            }
            Box(Modifier.padding(top = 16.dp).fillMaxWidth().height(48.dp).clip(RoundedCornerShape(24.dp)).border(1.dp, c.border, RoundedCornerShape(24.dp))
                .clickable { onDismiss(); app.push(Route.SettingsPage("center")) }, contentAlignment = Alignment.Center) {
                Text(t("goAccountsCenter"), fontSize = 16.sp, color = c.text, fontWeight = FontWeight.Medium)
            }
        }
    }
}

/** IG "saved profiles" login screen: accounts remembered on this device, use another profile, create new account. */
@Composable
fun SavedProfilesScreen(onUseAnother: (String?) -> Unit, onCreate: () -> Unit) {
    val app = LocalApp.current
    val c = Nx.c
    var manage by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Box(Modifier.fillMaxWidth().height(64.dp).padding(horizontal = 8.dp)) {
            IconBtn(NxIcons.Close, { onUseAnother(null) }, size = 26.dp, modifier = Modifier.align(Alignment.CenterStart))
            IconBtn(NxIcons.MoreH, { manage = !manage }, size = 26.dp, modifier = Modifier.align(Alignment.CenterEnd))
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.ahmedbecetti.nexora.kt.R.mipmap.ic_launcher_foreground), null, modifier = Modifier.size(120.dp))
            Spacer(Modifier.height(20.dp))
            app.accounts.forEach { a ->
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(RoundedCornerShape(22.dp)).border(1.dp, c.border, RoundedCornerShape(22.dp))
                    .clickable {
                        if (manage) app.removeAccount(a.id)
                        else if (a.token != null) app.switchTo(a) else onUseAnother(a.username)
                    }.padding(horizontal = 14.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Avatar(a.avatarUrl, 62.dp)
                    Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                        Text(a.username, fontSize = 17.sp, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (a.token == null) Text(t("loginAgain"), fontSize = 14.sp, color = c.muted)
                    }
                    if (manage) Text(t("remove"), color = Red, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    else Icon(NxIcons.Chevron, null, tint = c.muted, modifier = Modifier.size(20.dp).mirrorIfRtl(NxIcons.Chevron))
                }
            }
        }
        Column(Modifier.padding(16.dp)) {
            Box(Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(26.dp)).background(c.btn).clickable { onUseAnother(null) }, contentAlignment = Alignment.Center) {
                Text(t("useAnotherProfile"), color = c.text, fontSize = 16.sp, fontWeight = FontWeight.Medium)
            }
            Spacer(Modifier.height(12.dp))
            Box(Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(26.dp)).border(1.5.dp, Blue, RoundedCornerShape(26.dp)).clickable(onClick = onCreate), contentAlignment = Alignment.Center) {
                Text(t("createNewAccount"), color = Blue, fontSize = 16.sp, fontWeight = FontWeight.Medium)
            }
            Spacer(Modifier.height(14.dp))
            Text("Nexora", color = c.text, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.align(Alignment.CenterHorizontally))
        }
    }
}
