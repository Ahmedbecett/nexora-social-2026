package com.ahmedbecetti.nexora.kt.ui.screens

import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed as lazyItemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.ApiException
import com.ahmedbecetti.nexora.kt.data.I18n
import com.ahmedbecetti.nexora.kt.data.Upload
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.json
import com.ahmedbecetti.nexora.kt.data.long
import com.ahmedbecetti.nexora.kt.data.mapObj
import com.ahmedbecetti.nexora.kt.data.str
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.Avatar
import com.ahmedbecetti.nexora.kt.ui.Divider
import com.ahmedbecetti.nexora.kt.ui.IconBtn
import com.ahmedbecetti.nexora.kt.ui.Loader
import com.ahmedbecetti.nexora.kt.ui.NxButton
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.NxSwitch
import com.ahmedbecetti.nexora.kt.ui.UserNameText
import com.ahmedbecetti.nexora.kt.ui.mirrorIfRtl
import com.ahmedbecetti.nexora.kt.ui.noRippleClick
import com.ahmedbecetti.nexora.kt.ui.theme.Blue
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import com.ahmedbecetti.nexora.kt.ui.toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray

/** "New post" screen from the mockup: preview, caption, Add location, Tag people, Also post to Feed / Reels / Story, Share. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateScreen(uris: List<Uri>, reel: Boolean) {
    val app = LocalApp.current
    val c = Nx.c
    val ctx = LocalContext.current
    val previews = remember { mutableStateMapOf<Uri, Bitmap?>() }
    val firstVideo = remember(uris) { Upload.isVideo(ctx, uris.first()) }
    var caption by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    val tagged = remember { mutableStateListOf<User>() }
    var toFeed by remember { mutableStateOf(true) }
    var toReels by remember { mutableStateOf(reel || firstVideo) }
    var toStory by remember { mutableStateOf(false) }
    var progress by remember { mutableStateOf<Float?>(null) }
    var locDialog by remember { mutableStateOf(false) }
    var tagSheet by remember { mutableStateOf(false) }
    LaunchedEffect(uris) {
        for (u in uris) previews[u] = withContext(Dispatchers.IO) { Upload.preview(ctx, u) }
    }
    val canShare = progress == null && (toFeed || (toReels && firstVideo) || toStory)

    fun share() {
        progress = 0f
        app.scope.launch {
            try {
                val media = JSONArray()
                uris.forEachIndexed { i, u ->
                    val r = Upload.media(ctx, u) { p -> app.scope.launch { progress = (i + p) / uris.size * 0.95f } }
                    media.put(r.toJson())
                }
                val mentions = tagged.map { "@" + it.username }.filter { !caption.contains(it) }
                val fullCaption = (caption.trim() + (if (mentions.isNotEmpty()) "\n" + mentions.joinToString(" ") else "")).trim()
                if (toFeed || (toReels && firstVideo)) {
                    Api.post("posts", json(
                        "kind" to if (toReels && firstVideo) "reel" else "post",
                        "media" to media, "caption" to fullCaption, "location" to location.trim(), "alsoStory" to toStory,
                    ))
                } else if (toStory) {
                    val m = media.getJSONObject(0)
                    Api.post("stories", json("url" to m.getString("url"), "type" to m.optString("type", "image")))
                }
                progress = 1f
                toast(ctx, t("posted"))
                app.feedVersion++; app.profileVersion++
                app.scope.launch { app.loadStories() }
                app.pop()
            } catch (e: Exception) { app.errToast(e); progress = null }
        }
    }

    Column(Modifier.fillMaxSize().background(c.bg).imePadding()) {
        Box(Modifier.fillMaxWidth().statusBarsPadding().height(52.dp)) {
            IconBtn(NxIcons.Back, { if (progress == null) app.pop() }, size = 26.dp, modifier = Modifier.align(Alignment.CenterStart).padding(start = 4.dp))
            Text(if (reel) t("newReel") else t("newPost"), fontSize = 17.sp, fontWeight = FontWeight.Bold, color = c.text, modifier = Modifier.align(Alignment.Center))
        }
        progress?.let { LinearProgressIndicator(progress = { it }, color = Blue, trackColor = c.sep, modifier = Modifier.fillMaxWidth().height(2.dp)) }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            // preview
            if (uris.size == 1) {
                Box(Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth().aspectRatio(if (firstVideo) 1.2f else 1.9f).clip(RoundedCornerShape(12.dp)).background(c.sep)) {
                    previews[uris.first()]?.let { Image(it.asImageBitmap(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
                    if (firstVideo) Icon(NxIcons.Reels, null, tint = Color.White, modifier = Modifier.align(Alignment.TopEnd).padding(10.dp).size(22.dp))
                }
            } else {
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(uris) { u ->
                        Box(Modifier.size(width = 130.dp, height = 170.dp).clip(RoundedCornerShape(10.dp)).background(c.sep)) {
                            previews[u]?.let { Image(it.asImageBitmap(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
                            if (Upload.isVideo(ctx, u)) Icon(NxIcons.Play, null, tint = Color.White, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp).size(16.dp))
                        }
                    }
                }
            }
            // caption
            Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                if (caption.isEmpty()) Text(t("writeCaption"), color = c.muted, fontSize = 15.sp)
                BasicTextField(caption, { caption = it.take(2200) }, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text),
                    minLines = 2, maxLines = 8, modifier = Modifier.fillMaxWidth())
            }
            Divider()
            CreateRow(NxIcons.Location, if (location.isBlank()) t("addLocation") else location) { locDialog = true }
            Divider(Modifier.padding(start = 52.dp))
            CreateRow(NxIcons.User, if (tagged.isEmpty()) t("tagPeople") else tagged.joinToString(", ") { it.username }) { tagSheet = true }
            Divider()
            Text(t("alsoPostTo"), color = c.text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp))
            ShareToggle(t("feed"), toFeed) { toFeed = it }
            ShareToggle(t("reels"), toReels && firstVideo, enabled = firstVideo) { toReels = it }
            ShareToggle(t("story"), toStory) { toStory = it }
            if (!firstVideo) Text(t("reelNeedsVideo"), color = c.muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 16.dp))
        }
        Box(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp)) {
            NxButton(if (progress != null) t("uploading") else t("share"), { share() }, Modifier.fillMaxWidth(), enabled = canShare,
                loading = progress != null && progress!! >= 0.95f, height = 48.dp, radius = 12.dp)
        }
    }

    if (locDialog) {
        var v by remember { mutableStateOf(location) }
        AlertDialog(
            onDismissRequest = { locDialog = false }, containerColor = c.elevated,
            title = { Text(t("addLocation"), fontWeight = FontWeight.SemiBold, color = c.text) },
            text = {
                Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(c.input).padding(12.dp)) {
                    if (v.isEmpty()) Text(t("ckSearchPlace"), color = c.muted, fontSize = 15.sp)
                    BasicTextField(v, { v = it.take(80) }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = { TextButton(onClick = { location = v.trim(); locDialog = false }) { Text(t("done"), color = Blue, fontWeight = FontWeight.SemiBold) } },
            dismissButton = { TextButton(onClick = { location = ""; locDialog = false }) { Text(t("remove"), color = c.text) } },
        )
    }
    if (tagSheet) TagPeopleSheet(tagged, onDismiss = { tagSheet = false })
}

@Composable
private fun CreateRow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    val c = Nx.c
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = c.text, modifier = Modifier.size(24.dp))
        Text(label, color = c.text, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(horizontal = 12.dp))
        Icon(NxIcons.Chevron, null, tint = c.muted, modifier = Modifier.size(16.dp).mirrorIfRtl(NxIcons.Chevron))
    }
}

@Composable
private fun ShareToggle(label: String, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    val c = Nx.c
    Row(Modifier.fillMaxWidth().clickable(enabled = enabled) { onChange(!checked) }.padding(horizontal = 16.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = if (enabled) c.text else c.muted, fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        NxSwitch(checked, onChange, enabled)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TagPeopleSheet(tagged: MutableList<User>, onDismiss: () -> Unit) {
    val c = Nx.c
    var q by remember { mutableStateOf("") }
    val results = remember { mutableStateListOf<User>() }
    LaunchedEffect(q) {
        delay(250)
        try {
            val r = if (q.isBlank()) Api.get("suggestions") else Api.get("search/users?q=" + java.net.URLEncoder.encode(q.trim(), "UTF-8"))
            results.clear(); results.addAll(r.optJSONArray("users").mapObj { User.from(it) })
        } catch (_: Exception) {}
    }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.elevated, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().fillMaxSize(0.85f).imePadding()) {
            Text(t("tagPeople"), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = c.text, modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 10.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(40.dp).clip(RoundedCornerShape(12.dp)).background(c.input).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(NxIcons.Search, null, tint = c.muted, modifier = Modifier.size(18.dp))
                Box(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                    if (q.isEmpty()) Text(t("search"), color = c.muted, fontSize = 15.sp)
                    BasicTextField(q, { q = it }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
                }
            }
            LazyColumn(Modifier.weight(1f).padding(top = 6.dp)) {
                items(results, key = { it.id }) { u ->
                    val sel = tagged.any { it.id == u.id }
                    Row(Modifier.fillMaxWidth().clickable { if (sel) tagged.removeAll { it.id == u.id } else if (tagged.size < 20) tagged.add(u) }
                        .padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Avatar(u.avatarUrl, 44.dp)
                        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                            UserNameText(u)
                            if (!u.fullName.isNullOrBlank()) Text(u.fullName!!, color = c.muted, fontSize = 13.sp, maxLines = 1)
                        }
                        Box(Modifier.size(24.dp).clip(CircleShape).then(if (sel) Modifier.background(Blue) else Modifier.border(1.5.dp, c.border, CircleShape)), contentAlignment = Alignment.Center) {
                            if (sel) Icon(NxIcons.Check, null, tint = Color.White, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
            Box(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp)) {
                NxButton(t("done"), onDismiss, Modifier.fillMaxWidth(), height = 46.dp, radius = 12.dp)
            }
        }
    }
}

/** New highlight: pick from your stories archive (`me/stories`), name it, `POST highlights`. */
@Composable
fun NewHighlightScreen() {
    val app = LocalApp.current
    val c = Nx.c
    val ctx = LocalContext.current
    data class S(val id: Long, val url: String, val type: String)
    val stories = remember { mutableStateListOf<S>() }
    val picked = remember { mutableStateListOf<Long>() }
    var loaded by remember { mutableStateOf(false) }
    var naming by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        try { stories.addAll(Api.get("me/stories").optJSONArray("stories").mapObj { o -> o.str("url")?.let { S(o.long("id"), it, o.optString("type", "image")) } }) }
        catch (e: Exception) { app.errToast(e) } finally { loaded = true }
    }
    Column(Modifier.fillMaxSize().background(c.bg)) {
        Box(Modifier.fillMaxWidth().statusBarsPadding().height(52.dp)) {
            IconBtn(NxIcons.Close, { app.pop() }, size = 24.dp, modifier = Modifier.align(Alignment.CenterStart).padding(start = 4.dp))
            Text(t("newHighlight"), fontSize = 17.sp, fontWeight = FontWeight.Bold, color = c.text, modifier = Modifier.align(Alignment.Center))
            Text(t("next"), color = if (picked.isEmpty()) Blue.copy(alpha = 0.4f) else Blue, fontWeight = FontWeight.SemiBold, fontSize = 16.sp,
                modifier = Modifier.align(Alignment.CenterEnd).padding(end = 16.dp).noRippleClick { if (picked.isNotEmpty()) naming = true })
        }
        Text(t("chooseStories"), color = c.muted, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp))
        when {
            !loaded -> Loader()
            stories.isEmpty() -> Text(t("noArchive"), color = c.muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(32.dp))
            else -> LazyVerticalGrid(GridCells.Fixed(3), modifier = Modifier.fillMaxSize()) {
                itemsIndexed(stories, key = { _, s -> s.id }) { _, s ->
                    val i = picked.indexOf(s.id)
                    Box(Modifier.padding(1.dp).fillMaxWidth().aspectRatio(0.62f).background(c.sep).clickable { if (i >= 0) picked.remove(s.id) else picked.add(s.id) }) {
                        if (s.type != "video") AsyncImage(s.url, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                        else Icon(NxIcons.Play, null, tint = c.muted, modifier = Modifier.align(Alignment.Center).size(28.dp))
                        Box(Modifier.align(Alignment.BottomEnd).padding(8.dp).size(24.dp).clip(CircleShape)
                            .then(if (i >= 0) Modifier.background(Blue) else Modifier.border(1.5.dp, Color.White, CircleShape)), contentAlignment = Alignment.Center) {
                            if (i >= 0) Text("${i + 1}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
    if (naming) {
        var title by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { naming = false }, containerColor = c.elevated,
            title = { Text(t("newHighlight"), fontWeight = FontWeight.SemiBold, color = c.text) },
            text = {
                Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(c.input).padding(12.dp)) {
                    if (title.isEmpty()) Text(t("highlightTitle"), color = c.muted, fontSize = 15.sp)
                    BasicTextField(title, { title = it.take(30) }, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp), cursorBrush = SolidColor(c.text), modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                TextButton(enabled = !busy, onClick = {
                    busy = true
                    app.scope.launch {
                        try {
                            Api.post("highlights", json("title" to title.trim().ifEmpty { t("highlightTitle") }, "storyIds" to JSONArray(picked.toList())))
                            app.profileVersion++; toast(ctx, t("saved2")); naming = false; app.pop()
                        } catch (e: ApiException) { toast(ctx, I18n.err(e.code)) } catch (e: Exception) { app.errToast(e) } finally { busy = false }
                    }
                }) { Text(t("done"), color = Blue, fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = { TextButton(onClick = { naming = false }) { Text(t("cancel"), color = c.text) } },
        )
    }
}
