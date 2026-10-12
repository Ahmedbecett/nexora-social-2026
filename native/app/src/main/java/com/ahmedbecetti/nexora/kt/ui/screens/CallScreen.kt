package com.ahmedbecetti.nexora.kt.ui.screens

import android.Manifest
import android.view.View
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import com.ahmedbecetti.nexora.kt.call.CallEngine
import com.ahmedbecetti.nexora.kt.call.CallPeer
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.AvatarImage
import com.ahmedbecetti.nexora.kt.ui.IconBtn
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.NxIcons2
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.webrtc.RendererCommon
import org.webrtc.SurfaceViewRenderer

private val CallPink = Color(0xFFCA2E66)

@Composable
fun CallPermissionGate(onGranted: () -> Unit) {
    val ctx = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        if (r[Manifest.permission.RECORD_AUDIO] == true) PermissionRequester.pending?.invoke()
        else android.widget.Toast.makeText(ctx, t("ckCallMediaErr"), android.widget.Toast.LENGTH_LONG).show()
        PermissionRequester.pending = null
    }
    fun request(video: Boolean) {
        val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (video) perms += Manifest.permission.CAMERA
        val needed = perms.filter { ContextCompat.checkSelfPermission(ctx, it) != PackageManager.PERMISSION_GRANTED }
        if (needed.isEmpty()) PermissionRequester.pending?.invoke() else launcher.launch(needed.toTypedArray())
    }
    PermissionRequester.request = ::request
}

/** An activity-result permission bridge used by the chat call buttons and incoming call sheet. */
object PermissionRequester {
    var request: ((Boolean) -> Unit)? = null
    var pending: (() -> Unit)? = null
    fun call(video: Boolean, action: () -> Unit) { pending = action; request?.invoke(video) }
}

@Composable
fun CallOverlay() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val phase = CallEngine.phase
    if (phase == "idle") return
    val user = CallEngine.peer
    val black = Color(0xFF08090B)
    var inviteOpen by remember { mutableStateOf(false) }
    var search by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<User>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var elapsed by remember { mutableLongStateOf(0L) }
    LaunchedEffect(phase, CallEngine.startedAt) {
        while (CallEngine.active) { elapsed = if (CallEngine.startedAt > 0) (System.currentTimeMillis() - CallEngine.startedAt) / 1000 else 0; delay(1000) }
    }
    LaunchedEffect(search) {
        if (search.isBlank()) { results = emptyList(); return@LaunchedEffect }
        delay(320); loading = true
        try {
            val j = Api.get("search/users?q=" + java.net.URLEncoder.encode(search, "UTF-8"))
            val arr = j.optJSONArray("users") ?: org.json.JSONArray()
            results = (0 until arr.length()).mapNotNull { User.from(arr.optJSONObject(it)) }.filter { it.id != CallEngine.peer?.id }
        } catch (_: Exception) { results = emptyList() }
        loading = false
    }
    Box(Modifier.fillMaxSize().background(black)) {
        val remote = CallEngine.remoteVideo
        if (remote != null && phase == "connected") {
            VideoRenderer(remote, Modifier.fillMaxSize())
        } else if (user != null) {
            AvatarImage(user.avatarUrl, 118.dp)
            Column(Modifier.align(Alignment.Center).padding(top = 180.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(user.fullName?.takeIf { it.isNotBlank() } ?: user.username, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                Text(if (phase == "incoming") t(if (CallEngine.kind == "video") "ckCallInVideo" else "ckCallInAudio") else t("ckCall" + when (CallEngine.status) { "ringing" -> "Ringing"; "connecting" -> "Connecting"; "reconnecting" -> "Reconnecting"; else -> "Contacting" }), color = Color.White.copy(alpha = .72f), modifier = Modifier.padding(top = 8.dp))
                if (phase == "connected") Text("%02d:%02d".format(elapsed / 60, elapsed % 60), color = Color.White.copy(alpha = .7f), modifier = Modifier.padding(top = 8.dp))
            }
        }
        if (CallEngine.kind == "video" && CallEngine.camOn && CallEngine.localVideo != null) {
            VideoRenderer(CallEngine.localVideo!!, Modifier.align(Alignment.TopEnd).padding(top = 56.dp, end = 16.dp).size(width = 112.dp, height = 160.dp).clip(MaterialTheme.shapes.large))
        }
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(user?.username ?: "Nexora", color = Color.White, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            if (CallEngine.active && phase != "incoming") Text(t("ckCallInCall"), color = Color.White.copy(alpha = .7f), fontSize = 13.sp)
        }
        if (CallEngine.error.isNotEmpty()) Text(t("ckCallMediaErr"), color = Color.White, modifier = Modifier.align(Alignment.Center).padding(24.dp))
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().padding(bottom = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (CallEngine.peers.size > 2) {
                Row(Modifier.fillMaxWidth().padding(bottom = 14.dp), horizontalArrangement = Arrangement.Center) {
                    CallEngine.peers.forEach { p -> Text(p.user?.fullName ?: p.user?.username ?: "…", color = Color.White, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 8.dp)) }
                }
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 32.dp), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                if (phase == "incoming") {
                    Control(t("ckCallDecline"), NxIcons2.PhoneEnd, Color(0xFFE44157)) { CallEngine.declineCall() }
                    Control(t("ckCallAccept"), if (CallEngine.kind == "video") NxIcons2.Video else NxIcons2.Phone, Color(0xFF32B768)) { PermissionRequester.call(CallEngine.kind == "video") { CallEngine.acceptCall() } }
                } else {
                    Control(t("ckCallMute"), if (CallEngine.muted) NxIcons2.MicOff else NxIcons.Mic, Color(0xFF292B30)) { CallEngine.toggleMute() }
                    if (CallEngine.kind == "video" || phase == "connected") Control(t("ckCallCamera"), if (CallEngine.camOn) NxIcons2.Video else NxIcons2.VideoOff, Color(0xFF292B30)) { if (CallEngine.camOn) CallEngine.toggleCam() else PermissionRequester.call(true) { CallEngine.toggleCam() } }
                    Control(t("ckCallSpeaker"), if (CallEngine.speaker) NxIcons2.VolumeOn else NxIcons2.VolumeOff, Color(0xFF292B30)) { CallEngine.toggleSpeaker() }
                    Control(t("ckCallInvite"), NxIcons.UserPlus, Color(0xFF292B30)) { inviteOpen = true }
                    Control(t("ckCallEnd"), NxIcons2.PhoneEnd, Color(0xFFE44157)) { CallEngine.hangUp() }
                }
            }
            if (phase == "connected" && CallEngine.kind == "audio") TextButton(onClick = { CallEngine.toggleTouchUp() }) { Text(t("ckCallTouchUp") + if (CallEngine.touchUp) " ✓" else "", color = Color.White.copy(alpha = .8f)) }
        }
    }
    if (inviteOpen) AlertDialog(onDismissRequest = { inviteOpen = false }, title = { Text(t("ckCallInvite")) },
        text = { Column(Modifier.heightIn(max = 420.dp)) {
            OutlinedTextField(search, { search = it }, label = { Text(t("ckCallSearch")) }, singleLine = true)
            if (loading) CircularProgressIndicator(Modifier.padding(12.dp))
            LazyColumn { items(results, key = { it.id }) { u ->
                Row(Modifier.fillMaxWidth().clickable { scope.launch { if (CallEngine.invite(u)) inviteOpen = false } }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    AvatarImage(u.avatarUrl, 38.dp); Column(Modifier.padding(start = 10.dp)) { Text(u.fullName ?: u.username, maxLines = 1, overflow = TextOverflow.Ellipsis); Text("@" + u.username, fontSize = 12.sp) }
                }
            } }
        } }, confirmButton = { TextButton(onClick = { inviteOpen = false }) { Text(t("close")) } })
}

@Composable
private fun Control(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, bg: Color, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable(onClick = onClick)) {
        Box(Modifier.size(58.dp).clip(CircleShape).background(bg), contentAlignment = Alignment.Center) {
            IconBtn(icon, onClick, size = 27.dp, tint = Color.White)
        }
        Text(label, color = Color.White.copy(alpha = .84f), fontSize = 11.sp, modifier = Modifier.padding(top = 5.dp))
    }
}

@Composable
private fun VideoRenderer(track: org.webrtc.VideoTrack, modifier: Modifier) {
    val egl = CallEngine.egl ?: return
    val context = LocalContext.current
    val renderer = remember(track) { SurfaceViewRenderer(context) }
    AndroidView(factory = {
        renderer.apply { init(egl, null); setEnableHardwareScaler(true); setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL); track.addSink(this) }
    }, modifier = modifier, update = { track.addSink(it) })
    DisposableEffect(track, renderer) { onDispose { try { track.removeSink(renderer); renderer.release() } catch (_: Exception) {} } }
}
