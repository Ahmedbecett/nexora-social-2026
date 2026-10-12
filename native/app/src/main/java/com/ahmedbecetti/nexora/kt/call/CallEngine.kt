package com.ahmedbecetti.nexora.kt.call

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.ahmedbecetti.nexora.kt.CallNotify
import com.ahmedbecetti.nexora.kt.CallService
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.parseTime
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.MediaStreamTrack
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.RtpTransceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoCapturer
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import org.webrtc.audio.JavaAudioDeviceModule
import kotlin.coroutines.resume

/** One participant tile shown in the call screen. */
data class CallPeer(val id: Long, val user: User?, val connected: Boolean, val pending: Boolean, val video: VideoTrack?)

/**
 * Native call engine — real WebRTC audio/video calls that interoperate with the web app (src/chatkit/call.js).
 * Signaling (offer/answer/ICE as full SDP) travels through the chat as hidden messages that are deleted after
 * 7 s, exactly like the web. Group calls are a full mesh of up to 4 people (one extra "leg" per participant).
 * All logic runs on the main thread; WebRTC callbacks are re-posted to it.
 */
@SuppressLint("StaticFieldLeak")
object CallEngine {
    // ---------------- observable state (read by the UI) ----------------
    var phase by mutableStateOf("idle")            // idle | outgoing | incoming | connecting | connected | ended
        private set
    var kind by mutableStateOf("audio")
        private set
    var peer by mutableStateOf<User?>(null)
        private set
    var outgoing by mutableStateOf(false)
        private set
    var status by mutableStateOf("contacting")
        private set
    var muted by mutableStateOf(false)
        private set
    var camOn by mutableStateOf(false)
        private set
    var peerCam by mutableStateOf(true)
        private set
    var speaker by mutableStateOf(false)
        private set
    var touchUp by mutableStateOf(true)
        private set
    var frontCam by mutableStateOf(true)
        private set
    var startedAt by mutableLongStateOf(0L)
        private set
    var error by mutableStateOf("")
    var notice by mutableStateOf<Pair<String, String>?>(null)   // (key, name)
    var speakerId by mutableLongStateOf(0L)
        private set
    var minimized by mutableStateOf(false)
    var localVideo by mutableStateOf<VideoTrack?>(null)
        private set
    var remoteVideo by mutableStateOf<VideoTrack?>(null)
        private set
    var version by mutableIntStateOf(0)
        private set
    val peers = mutableStateListOf<CallPeer>()

    val active get() = phase != "idle" && phase != "ended"

    // ---------------- internals ----------------
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var ctx: Context
    private var meId = 0L
    private var eglBase: EglBase? = null
    private var factory: PeerConnectionFactory? = null
    private var adm: JavaAudioDeviceModule? = null
    val egl: EglBase.Context? get() = eglBase?.eglBaseContext

    private class Leg(val id: Long, var user: User?, val pc: PeerConnection, var i: String, val primary: Boolean) {
        var connected = false
        var remoteVideo: VideoTrack? = null
        val added = HashSet<String>()
        val queued = ArrayList<CallSignal.Cand>()
    }

    private var main: Leg? = null
    private val extras = LinkedHashMap<Long, Leg>()
    private val known = LinkedHashMap<Long, User>()
    private var callId: String? = null
    private var peerId: Long? = null
    private var groupId = ""
    private var pendingOffer: String? = null
    private var pendingGroup = ""
    private var pendingList: JSONArray? = null
    private var signalPeer: User? = null
    private var ringSent = false
    private var busySent = false
    private var connectedLogged = false
    private var endLogged = false
    private var ringStamp = 0L
    private var refreshes = 0
    private var seen = LinkedHashSet<String>()

    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var videoSource: VideoSource? = null
    private var capturer: VideoCapturer? = null
    private var texHelper: SurfaceTextureHelper? = null

    private var refreshJob: Job? = null
    private var timeoutJob: Job? = null
    private var ringJob: Job? = null
    private var toneJob: Job? = null
    private var statsJob: Job? = null
    private var loopJob: Job? = null
    private var tone: ToneGenerator? = null
    private var savedAudioMode = AudioManager.MODE_NORMAL
    var foreground = true
        set(v) { field = v; if (!v) backgroundSince = System.currentTimeMillis() }
    private var backgroundSince = 0L

    fun init(context: Context) { ctx = context.applicationContext }
    fun setMe(id: Long) { meId = id }

    // ---------------- WebRTC setup ----------------
    private fun ensureFactory(): PeerConnectionFactory {
        factory?.let { return it }
        PeerConnectionFactory.initialize(PeerConnectionFactory.InitializationOptions.builder(ctx).createInitializationOptions())
        val e = EglBase.create()
        eglBase = e
        adm = JavaAudioDeviceModule.builder(ctx)
            .setUseHardwareAcousticEchoCanceler(Build.VERSION.SDK_INT >= 29)
            .setUseHardwareNoiseSuppressor(Build.VERSION.SDK_INT >= 29)
            .createAudioDeviceModule()
        val f = PeerConnectionFactory.builder()
            .setAudioDeviceModule(adm)
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(e.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(e.eglBaseContext))
            .createPeerConnectionFactory()
        factory = f
        return f
    }

    private fun rtcConfig(): PeerConnection.RTCConfiguration {
        val servers = mutableListOf(PeerConnection.IceServer.builder(listOf("stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302")).createIceServer())
        val turn = runCatching { TurnConfigStore.load(ctx) }.getOrDefault(TurnConfig())
        if (turn.urls.isNotEmpty() && turn.username.isNotBlank() && turn.credential.isNotBlank()) {
            servers += PeerConnection.IceServer.builder(turn.urls).setUsername(turn.username).setPassword(turn.credential).createIceServer()
        }
        return PeerConnection.RTCConfiguration(servers).apply {
        sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
        rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
        iceCandidatePoolSize = 4
        continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_ONCE
        }
    }

    private fun audioConstraints(enhanced: Boolean) = MediaConstraints().apply {
        mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "true"))
        mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", enhanced.toString()))
        mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", enhanced.toString()))
        mandatory.add(MediaConstraints.KeyValuePair("googHighpassFilter", enhanced.toString()))
    }

    private fun ensureAudio() {
        if (audioTrack != null) return
        val f = ensureFactory()
        audioSource = f.createAudioSource(audioConstraints(touchUp))
        audioTrack = f.createAudioTrack("nxa" + rid(), audioSource).also { it.setEnabled(!muted) }
    }

    private fun startCamera(): VideoTrack? {
        localVideo?.let { return it }
        val f = ensureFactory()
        val en = Camera2Enumerator(ctx)
        val names = en.deviceNames
        val name = names.firstOrNull { if (frontCam) en.isFrontFacing(it) else en.isBackFacing(it) } ?: names.firstOrNull() ?: return null
        val cap = en.createCapturer(name, null) ?: return null
        val helper = SurfaceTextureHelper.create("nx-cap", eglBase!!.eglBaseContext)
        val src = f.createVideoSource(false)
        cap.initialize(helper, ctx, src.capturerObserver)
        cap.startCapture(1280, 720, 30)
        capturer = cap; texHelper = helper; videoSource = src
        val track = f.createVideoTrack("nxv" + rid(), src)
        localVideo = track
        return track
    }

    private fun stopCamera() {
        try { capturer?.stopCapture() } catch (_: Exception) {}
        try { capturer?.dispose() } catch (_: Exception) {}
        val t = localVideo
        localVideo = null
        try { t?.dispose() } catch (_: Exception) {}
        try { videoSource?.dispose() } catch (_: Exception) {}
        try { texHelper?.dispose() } catch (_: Exception) {}
        capturer = null; videoSource = null; texHelper = null
    }

    private fun newLeg(id: Long, user: User?, i: String, primary: Boolean): Leg {
        val f = ensureFactory()
        lateinit var leg: Leg
        val obs = object : PeerConnection.Observer {
            override fun onSignalingChange(s: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(s: PeerConnection.IceConnectionState?) {}
            override fun onIceConnectionReceivingChange(b: Boolean) {}
            override fun onIceGatheringChange(s: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidate(c: IceCandidate?) {}
            override fun onIceCandidatesRemoved(c: Array<out IceCandidate>?) {}
            override fun onAddStream(s: MediaStream?) {}
            override fun onRemoveStream(s: MediaStream?) {}
            override fun onDataChannel(d: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(r: RtpReceiver?, s: Array<out MediaStream>?) {}
            override fun onTrack(t: RtpTransceiver?) {
                val track = t?.receiver?.track()
                if (track is VideoTrack) scope.launch {
                    leg.remoteVideo = track
                    if (leg.primary) remoteVideo = track
                    pushPeers(); version++
                }
            }
            override fun onConnectionChange(s: PeerConnection.PeerConnectionState?) {
                scope.launch { onLegState(leg, s) }
            }
        }
        val pc = f.createPeerConnection(rtcConfig(), obs) ?: throw IllegalStateException("pc")
        leg = Leg(id, user, pc, i, primary)
        return leg
    }

    private fun onLegState(leg: Leg, s: PeerConnection.PeerConnectionState?) {
        if (!leg.primary) {
            if (extras[leg.id] !== leg) return
            leg.connected = s == PeerConnection.PeerConnectionState.CONNECTED
            if (s == PeerConnection.PeerConnectionState.FAILED) dropLeg(leg.id)
            pushPeers()
            if (leg.connected) { scope.launch { announce(leg.id) }; startStats() }
            return
        }
        if (main !== leg) return
        when (s) {
            PeerConnection.PeerConnectionState.CONNECTED -> {
                stopTone()
                val first = !connectedLogged
                leg.connected = true
                phase = "connected"; status = "connected"
                if (startedAt == 0L) startedAt = System.currentTimeMillis()
                pushPeers()
                if (first) { connectedLogged = true; if (outgoing) scope.launch { writeLog("started") } }
                startStats()
            }
            PeerConnection.PeerConnectionState.FAILED -> scope.launch { endCall("failed") }
            PeerConnection.PeerConnectionState.DISCONNECTED -> {
                status = "reconnecting"
                scope.launch { delay(9000); if (main === leg && leg.pc.connectionState() == PeerConnection.PeerConnectionState.DISCONNECTED) endCall("lost") }
            }
            else -> {}
        }
    }

    /** Adds our microphone (and camera, if on) and always keeps a video transceiver so the camera can be turned on later. */
    private fun addLocalTo(pc: PeerConnection) {
        audioTrack?.let { a -> if (pc.senders.none { it.track()?.kind() == "audio" }) pc.addTrack(a, listOf("nx")) }
        val v = localVideo
        val vtx = pc.transceivers.firstOrNull { it.mediaType == MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO }
        if (v != null) {
            if (vtx != null) vtx.sender.setTrack(v, false) else pc.addTrack(v, listOf("nx"))
            vtx?.direction = RtpTransceiver.RtpTransceiverDirection.SEND_RECV
        } else if (vtx == null) {
            pc.addTransceiver(MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO, RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.SEND_RECV))
        }
    }

    private fun videoTxs(pc: PeerConnection) = pc.transceivers.filter { it.mediaType == MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO }

    // ---------------- SDP helpers ----------------
    private open class Sdp : SdpObserver {
        override fun onCreateSuccess(s: SessionDescription?) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(e: String?) {}
        override fun onSetFailure(e: String?) {}
    }

    private suspend fun create(pc: PeerConnection, offer: Boolean): SessionDescription? = suspendCancellableCoroutine { cont ->
        val o = object : Sdp() {
            override fun onCreateSuccess(s: SessionDescription?) { if (cont.isActive) cont.resume(s) }
            override fun onCreateFailure(e: String?) { if (cont.isActive) cont.resume(null) }
        }
        if (offer) pc.createOffer(o, MediaConstraints()) else pc.createAnswer(o, MediaConstraints())
    }

    private suspend fun setLocal(pc: PeerConnection, s: SessionDescription): Boolean = suspendCancellableCoroutine { cont ->
        pc.setLocalDescription(object : Sdp() {
            override fun onSetSuccess() { if (cont.isActive) cont.resume(true) }
            override fun onSetFailure(e: String?) { if (cont.isActive) cont.resume(false) }
        }, s)
    }

    private suspend fun setRemote(pc: PeerConnection, type: SessionDescription.Type, sdp: String): Boolean = suspendCancellableCoroutine { cont ->
        pc.setRemoteDescription(object : Sdp() {
            override fun onSetSuccess() { if (cont.isActive) cont.resume(true) }
            override fun onSetFailure(e: String?) { if (cont.isActive) cont.resume(false) }
        }, SessionDescription(type, sdp))
    }

    private suspend fun waitIce(pc: PeerConnection, ms: Long = 3500) {
        withTimeoutOrNull(ms) { while (pc.iceGatheringState() != PeerConnection.IceGatheringState.COMPLETE) delay(120) }
    }

    private fun localSdp(pc: PeerConnection): String = pc.localDescription?.description ?: ""

    private fun harvest(leg: Leg, sdp: String) {
        val cands = CallSignal.candidates(sdp)
        if (leg.pc.remoteDescription == null) { leg.queued.addAll(cands); return }
        for (c in cands) addCand(leg, c)
    }

    private fun addCand(leg: Leg, c: CallSignal.Cand) {
        if (c.candidate.isEmpty() || !leg.added.add(c.candidate)) return
        try { leg.pc.addIceCandidate(IceCandidate(c.mid ?: c.index.toString(), maxOf(0, c.index), c.candidate)) } catch (_: Exception) {}
    }

    private fun flush(leg: Leg) { val l = ArrayList(leg.queued); leg.queued.clear(); l.forEach { addCand(leg, it) } }

    // ---------------- sending ----------------
    private fun rid(): String { val a = "abcdefghijklmnopqrstuvwxyz0123456789"; return (1..8).map { a.random() }.joinToString("") }

    private fun scheduleDelete(r: JSONObject?) {
        val id = r?.optJSONObject("message")?.optLong("id") ?: return
        if (id <= 0) return
        scope.launch { delay(7000); try { Api.delete("message/$id") } catch (_: Exception) {} }
    }

    private suspend fun send(to: Long, t: String, extra: JSONObject = JSONObject()) {
        val body = JSONObject().put("i", callId).put("t", t).put("k", kind)
        if (groupId.isNotEmpty()) body.put("g", groupId)
        extra.keys().forEach { k -> body.put(k, extra.get(k)) }
        val text = CallSignal.envelope(body)
        if (text.length <= 1900) {
            scheduleDelete(Api.post("messages/$to", JSONObject().put("text", text)))
            return
        }
        val parts = text.chunked(1100) // nested Base64 envelope must remain below the API's 2,000-char message limit
        parts.forEachIndexed { p, x ->
            val env = CallSignal.envelope(JSONObject().put("i", callId).put("t", "part").put("k", kind).put("n", parts.size).put("p", p).put("x", x))
            scheduleDelete(Api.post("messages/$to", JSONObject().put("text", env)))
        }
    }

    private suspend fun readParts(peer: Long, env: JSONObject): JSONObject? {
        val r = Api.get("messages/$peer?after=0")
        val arr = r.optJSONArray("messages") ?: return null
        val n = env.optInt("n")
        val bucket = arrayOfNulls<String>(n)
        for (k in 0 until arr.length()) {
            val m = arr.optJSONObject(k) ?: continue
            if (m.optBoolean("mine")) continue
            val e = CallSignal.parse(m.optString("text")) ?: continue
            if (e.optString("t") == "part" && e.optString("i") == env.optString("i") && e.optString("k") == env.optString("k") && e.optInt("n") == n) {
                val p = e.optInt("p"); if (p in 0 until n) bucket[p] = e.optString("x")
            }
        }
        if (bucket.any { it == null }) return null
        return CallSignal.parse(bucket.joinToString(""))
    }

    private suspend fun writeLog(d: String) {
        val to = peerId ?: return
        if (d != "started" && endLogged) return
        if (d != "started") endLogged = true
        try { Api.post("messages/$to", JSONObject().put("text", CallSignal.makeLog(kind, d))) } catch (_: Exception) {}
    }

    // ---------------- tones / audio routing ----------------
    private fun vibrate(pattern: LongArray?) {
        try {
            val v = ctx.getSystemService(Vibrator::class.java) ?: return
            if (pattern == null) { v.cancel(); return }
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, 0)) else @Suppress("DEPRECATION") v.vibrate(pattern, 0)
        } catch (_: Exception) {}
    }

    private fun stopTone() {
        toneJob?.cancel(); toneJob = null
        try { tone?.stopTone(); tone?.release() } catch (_: Exception) {}
        tone = null
        vibrate(null)
    }

    private fun outgoingTone() {
        stopTone()
        tone = try { ToneGenerator(AudioManager.STREAM_VOICE_CALL, 60) } catch (_: Exception) { null }
        toneJob = scope.launch { while (true) { try { tone?.startTone(ToneGenerator.TONE_SUP_RINGTONE, 1000) } catch (_: Exception) {}; delay(3000) } }
    }

    private fun incomingTone() {
        stopTone()
        tone = try { ToneGenerator(AudioManager.STREAM_RING, 85) } catch (_: Exception) { null }
        toneJob = scope.launch { while (true) { try { tone?.startTone(ToneGenerator.TONE_PROP_BEEP2, 700) } catch (_: Exception) {}; delay(1800) } }
        vibrate(longArrayOf(0, 400, 220, 400, 900))
    }

    private fun audioManager() = ctx.getSystemService(AudioManager::class.java)

    private fun enterCallAudio() {
        val am = audioManager() ?: return
        savedAudioMode = am.mode
        am.mode = AudioManager.MODE_IN_COMMUNICATION
        applySpeaker()
    }

    private fun leaveCallAudio() {
        val am = audioManager() ?: return
        try {
            if (Build.VERSION.SDK_INT >= 31) am.clearCommunicationDevice()
            @Suppress("DEPRECATION") am.isSpeakerphoneOn = false
            am.mode = savedAudioMode
        } catch (_: Exception) {}
    }

    private fun applySpeaker() {
        val am = audioManager() ?: return
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                val want = if (speaker) android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER else android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
                val headset = am.availableCommunicationDevices.firstOrNull { it.type == android.media.AudioDeviceInfo.TYPE_WIRED_HEADSET || it.type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO || it.type == android.media.AudioDeviceInfo.TYPE_BLE_HEADSET }
                val dev = if (!speaker && headset != null) headset else am.availableCommunicationDevices.firstOrNull { it.type == want }
                if (dev != null) am.setCommunicationDevice(dev)
            } else {
                @Suppress("DEPRECATION") am.isSpeakerphoneOn = speaker
            }
        } catch (_: Exception) {}
    }

    // ---------------- participants ----------------
    private fun pushPeers() {
        val out = ArrayList<CallPeer>()
        val m = main
        peerId?.let { out.add(CallPeer(it, peer, phase == "connected", false, m?.remoteVideo)) }
        extras.values.forEach { out.add(CallPeer(it.id, it.user, it.connected, false, it.remoteVideo)) }
        known.forEach { (id, u) -> if (out.none { it.id == id } && id != meId) out.add(CallPeer(id, u, false, true, null)) }
        peers.clear(); peers.addAll(out)
    }

    private fun nameOf(id: Long): String = (extras[id]?.user ?: known[id])?.let { it.fullName?.takeIf { n -> n.isNotBlank() } ?: it.username } ?: ""

    private fun metaList(): JSONArray = JSONArray().apply {
        peers.forEach { put(JSONObject().put("id", it.id).put("u", it.user?.username ?: "").put("f", it.user?.fullName ?: "")) }
    }

    private suspend fun announce(newPeer: Long) {
        val lst = metaList()
        for (leg in extras.values.toList()) {
            if (leg.id == newPeer) continue
            try { send(leg.id, "dial", JSONObject().put("u", newPeer).put("n", nameOf(newPeer)).put("lst", lst)) } catch (_: Exception) {}
        }
        val p = peerId
        if (p != null && p != newPeer) try { send(p, "dial", JSONObject().put("u", newPeer).put("n", nameOf(newPeer)).put("lst", lst)) } catch (_: Exception) {}
    }

    /** Invite another person into the running call (independent WebRTC leg with them; max 4 people). */
    suspend fun invite(user: User): Boolean {
        if (!active || audioTrack == null) return false
        val id = user.id
        if (id == peerId || extras.containsKey(id) || id == meId) return false
        if (extras.size >= 3) { notice = "full" to ""; return false }
        return try {
            known[id] = user
            val leg = newLeg(id, user, rid(), false)
            extras[id] = leg
            pushPeers()
            addLocalTo(leg.pc)
            val offer = create(leg.pc, true) ?: throw IllegalStateException()
            setLocal(leg.pc, offer)
            waitIce(leg.pc)
            val nm = JSONObject().put("id", user.id).put("username", user.username).put("fullName", user.fullName ?: "").put("avatarUrl", user.avatarUrl ?: "")
            send(id, "offer", JSONObject().put("i", leg.i).put("d", CallSignal.pack(localSdp(leg.pc))).put("grp", 1).put("g", groupId).put("nm", nm).put("k", kind))
            notice = "invited" to (user.fullName?.takeIf { it.isNotBlank() } ?: user.username)
            startStats()
            true
        } catch (_: Exception) { dropLeg(id); false }
    }

    private fun dropLeg(id: Long) {
        val leg = extras.remove(id) ?: return
        known.remove(id)
        try { leg.pc.close(); leg.pc.dispose() } catch (_: Exception) {}
        pushPeers(); version++
    }

    private suspend fun joinLeg(env: JSONObject, from: Long, user: User?) {
        val sdp = CallSignal.unpack(env.optString("d"))
        if (sdp.isEmpty()) return
        try {
            val leg = newLeg(from, user, env.optString("i"), false)
            extras[from] = leg
            if (user != null) known[from] = user
            pushPeers()
            addLocalTo(leg.pc)
            if (!setRemote(leg.pc, SessionDescription.Type.OFFER, sdp)) throw IllegalStateException()
            CallSignal.candidates(sdp).forEach { addCand(leg, it) }
            val ans = create(leg.pc, false) ?: throw IllegalStateException()
            setLocal(leg.pc, ans)
            waitIce(leg.pc)
            send(from, "answer", JSONObject().put("i", leg.i).put("d", CallSignal.pack(localSdp(leg.pc))).put("grp", 1).put("g", groupId))
            startStats()
        } catch (_: Exception) { dropLeg(from) }
    }

    private fun startStats() {
        if (statsJob?.isActive == true) return
        statsJob = scope.launch {
            while (active) {
                delay(900)
                val all = ArrayList<Pair<Long, PeerConnection>>()
                val m = main; val p = peerId
                if (m != null && p != null) all.add(p to m.pc)
                extras.values.forEach { all.add(it.id to it.pc) }
                if (all.size < 2) { if (speakerId != 0L) speakerId = 0L; continue }
                var best = 0L; var level = 0.02
                for ((id, pc) in all) {
                    val lv = suspendCancellableCoroutine<Double> { cont ->
                        pc.getStats { rep ->
                            var mx = 0.0
                            rep.statsMap.values.forEach { s ->
                                if (s.type == "inbound-rtp" && (s.members["kind"] == "audio" || s.members["mediaType"] == "audio")) {
                                    (s.members["audioLevel"] as? Number)?.toDouble()?.let { if (it > mx) mx = it }
                                }
                            }
                            if (cont.isActive) cont.resume(mx)
                        }
                    }
                    if (lv > level) { level = lv; best = id }
                }
                if (best != speakerId) speakerId = best
            }
        }
    }

    private fun startRefresh(mode: String) {
        refreshJob?.cancel()
        refreshJob = scope.launch {
            delay(3800L + (0..2200).random())
            while (true) {
                val leg = main ?: break
                if (!active || leg.pc.connectionState() == PeerConnection.PeerConnectionState.CONNECTED || refreshes > 14) break
                refreshes++
                val to = peerId ?: break
                try {
                    if (mode == "answer") send(to, "answer", JSONObject().put("d", CallSignal.pack(localSdp(leg.pc))).put("i", callId))
                    else if (leg.pc.signalingState() == PeerConnection.SignalingState.HAVE_LOCAL_OFFER)
                        // still unanswered: resend the (now complete) offer so a callee who opens the app late still rings
                        send(to, "offer", JSONObject().put("d", CallSignal.pack(localSdp(leg.pc))).put("g", groupId))
                    else send(to, "ice", JSONObject().put("d", CallSignal.pack(localSdp(leg.pc))))
                } catch (_: Exception) {}
                delay(4200L + (0..2600).random())
            }
        }
    }

    private fun resetFlags() {
        seen = LinkedHashSet(); refreshes = 0
        ringSent = false; busySent = false; connectedLogged = false; endLogged = false
        muted = false; peerCam = true; frontCam = true; startedAt = 0L; error = ""; notice = null; speakerId = 0L; minimized = false
    }

    // ---------------- public API ----------------
    fun startCall(user: User, k: String) {
        if (phase != "idle") return
        scope.launch {
            peerId = user.id; callId = rid(); groupId = rid()
            extras.clear(); known.clear()
            resetFlags()
            kind = k; peer = user; outgoing = true; status = "contacting"
            camOn = k == "video"; speaker = k == "video"
            phase = "outgoing"
            pushPeers()
            try {
                outgoingTone()
                enterCallAudio()
                CallService.start(ctx, k == "video")
                ensureAudio()
                if (k == "video" && startCamera() == null) { kind = "audio"; camOn = false }
                val leg = newLeg(user.id, user, callId!!, true)
                main = leg
                addLocalTo(leg.pc)
                val offer = create(leg.pc, true) ?: throw IllegalStateException("offer")
                setLocal(leg.pc, offer)
                waitIce(leg.pc, 2500)
                send(user.id, "offer", JSONObject().put("d", CallSignal.pack(localSdp(leg.pc))).put("g", groupId))
                startRefresh("ice")
                timeoutJob = scope.launch { delay(60_000); if (phase == "outgoing" || phase == "connecting") endCall("noanswer") }
            } catch (e: Exception) {
                cleanup(); resetIds()
                phase = "idle"; error = "media"
            }
        }
    }

    fun acceptCall() {
        if (phase != "incoming" || pendingOffer == null) return
        scope.launch {
            stopTone()
            CallNotify.cancel(ctx)
            phase = "connecting"; status = "connecting"
            try {
                groupId = pendingGroup.ifEmpty { rid() }
                enterCallAudio()
                CallService.start(ctx, kind == "video")
                ensureAudio()
                if (kind == "video" && startCamera() == null) camOn = false
                val leg = newLeg(peerId!!, peer, callId!!, true)
                main = leg
                addLocalTo(leg.pc)
                known.clear()
                pendingList?.let { l ->
                    for (k in 0 until l.length()) {
                        val m = l.optJSONObject(k) ?: continue
                        val id = m.optLong("id")
                        if (id != peerId && id != meId && id > 0) known[id] = User(id, m.optString("u"), m.optString("f").ifBlank { null })
                    }
                }
                pushPeers()
                if (!setRemote(leg.pc, SessionDescription.Type.OFFER, pendingOffer!!)) throw IllegalStateException("remote")
                CallSignal.candidates(pendingOffer!!).forEach { addCand(leg, it) }
                pendingOffer = null
                flush(leg)
                val ans = create(leg.pc, false) ?: throw IllegalStateException("answer")
                setLocal(leg.pc, ans)
                waitIce(leg.pc, 2500)
                send(peerId!!, "answer", JSONObject().put("d", CallSignal.pack(localSdp(leg.pc))).put("i", callId))
                startRefresh("answer")
                timeoutJob = scope.launch { delay(45_000); if (phase == "connecting") endCall("failed") }
            } catch (e: Exception) { endCall("media") }
        }
    }

    fun declineCall() {
        scope.launch {
            stopTone()
            val to = peerId
            if (to != null) try { send(to, "decline") } catch (_: Exception) {}
            pendingOffer = null; pendingGroup = ""; pendingList = null
            cleanup(); resetIds()
            phase = "ended"; status = "declined"
            delay(1500); if (phase == "ended") phase = "idle"
        }
    }

    fun hangUp() { scope.launch { endCall("hangup") } }

    private suspend fun endCall(reason: String) {
        if (phase == "idle" || phase == "ended") return
        val wasConnected = phase == "connected"
        val mine = outgoing
        val to = peerId
        phase = "ended"; status = reason
        stopTone()
        if (to != null && reason == "hangup") try { send(to, "bye") } catch (_: Exception) {}
        for (leg in extras.values.toList()) try { send(leg.id, "bye", JSONObject().put("i", leg.i)) } catch (_: Exception) {}
        if (mine) writeLog(if (wasConnected) "ended" else "missed")
        cleanup(); resetIds()
        status = reason
        delay(1700)
        if (phase == "ended") phase = "idle"
    }

    private fun resetIds() { peerId = null; signalPeer = null; pendingOffer = null; peers.clear(); speakerId = 0L }

    private fun cleanup() {
        stopTone()
        CallNotify.cancel(ctx)
        refreshJob?.cancel(); timeoutJob?.cancel(); ringJob?.cancel(); statsJob?.cancel()
        extras.values.forEach { try { it.pc.close(); it.pc.dispose() } catch (_: Exception) {} }
        extras.clear(); known.clear()
        groupId = ""
        main?.let { try { it.pc.close(); it.pc.dispose() } catch (_: Exception) {} }
        main = null
        remoteVideo = null
        stopCamera()
        try { audioTrack?.dispose() } catch (_: Exception) {}
        try { audioSource?.dispose() } catch (_: Exception) {}
        audioTrack = null; audioSource = null
        camOn = false
        leaveCallAudio()
        CallService.stop(ctx)
        version++
    }

    // ---------------- in-call controls ----------------
    fun toggleMute() {
        muted = !muted
        audioTrack?.setEnabled(!muted)
    }

    fun toggleSpeaker() { speaker = !speaker; applySpeaker() }

    fun toggleCam() {
        val pcs = listOfNotNull(main?.pc) + extras.values.map { it.pc }
        if (pcs.isEmpty()) return
        if (!camOn) {
            val v = startCamera() ?: run { error = "media"; return }
            pcs.forEach { pc -> videoTxs(pc).firstOrNull()?.let { tx -> tx.sender.setTrack(v, false); tx.direction = RtpTransceiver.RtpTransceiverDirection.SEND_RECV } }
            kind = "video"; camOn = true
            if (!speaker) { speaker = true; applySpeaker() }
            peerId?.let { p -> scope.launch { try { send(p, "cam1", JSONObject().put("k", "video")) } catch (_: Exception) {} } }
        } else {
            pcs.forEach { pc -> videoTxs(pc).firstOrNull()?.sender?.setTrack(null, false) }
            stopCamera()
            camOn = false
            peerId?.let { p -> scope.launch { try { send(p, "cam1x", JSONObject().put("k", "video")) } catch (_: Exception) {} } }
        }
        version++
    }

    fun switchCamera() {
        val cap = capturer as? CameraVideoCapturer ?: return
        cap.switchCamera(object : CameraVideoCapturer.CameraSwitchHandler {
            override fun onCameraSwitchDone(front: Boolean) { scope.launch { frontCam = front } }
            override fun onCameraSwitchError(e: String?) {}
        })
    }

    /** Audio Touch Up: swaps the microphone track for one with noise suppression, auto gain and high-pass on/off. */
    fun toggleTouchUp() {
        touchUp = !touchUp
        val f = factory ?: return
        val old = audioTrack ?: return
        val oldSrc = audioSource
        val src = f.createAudioSource(audioConstraints(touchUp))
        val track = f.createAudioTrack("nxa" + rid(), src).also { it.setEnabled(!muted) }
        val pcs = listOfNotNull(main?.pc) + extras.values.map { it.pc }
        pcs.forEach { pc -> pc.senders.firstOrNull { it.track()?.kind() == "audio" }?.setTrack(track, false) }
        audioTrack = track; audioSource = src
        try { old.dispose(); oldSrc?.dispose() } catch (_: Exception) {}
    }

    // ---------------- receiving ----------------
    private suspend fun handle(env: JSONObject, from: Long) {
        val i = env.optString("i")
        val sameCall = i == callId
        val sdp = CallSignal.unpack(env.optString("d").ifEmpty { null })
        val legByI = extras.values.firstOrNull { it.i == i }
        if (sdp.isNotEmpty()) (legByI ?: main)?.let { harvest(it, sdp) }
        when (env.optString("t")) {
            "offer" -> {
                if (env.optInt("grp") == 1 && phase != "idle" && env.optString("g").isNotEmpty() && env.optString("g") == groupId && !extras.containsKey(from)) {
                    val nm = env.optJSONObject("nm")
                    val u = nm?.let { User(from, it.optString("username"), it.optString("fullName").ifBlank { null }, it.optString("avatarUrl").ifBlank { null }) } ?: signalPeer
                    joinLeg(env, from, u?.copy(id = from))
                    return
                }
                if (phase == "idle") {
                    callId = i; peerId = from; pendingOffer = sdp
                    pendingGroup = env.optString("g"); pendingList = env.optJSONArray("lst")
                    resetFlags()
                    val k = if (env.optString("k") == "video") "video" else "audio"
                    kind = k; peerCam = k == "video"; camOn = k == "video"; speaker = k == "video"
                    peer = signalPeer ?: User(from, "")
                    outgoing = false; status = "incoming"; phase = "incoming"
                    ringStamp = System.currentTimeMillis()
                    pushPeers()
                    incomingTone()
                    CallNotify.incoming(ctx, peer!!, k == "video")
                    try { send(from, "ring"); ringSent = true } catch (_: Exception) {}
                    ringJob = scope.launch { delay(45_000); if (phase == "incoming") declineCall() }
                } else if (phase == "incoming" && sameCall) {
                    if (sdp.isNotEmpty()) pendingOffer = sdp
                } else if (!sameCall && !busySent && !ringSent && from != peerId && !extras.containsKey(from)) {
                    busySent = true
                    try {
                        val text = CallSignal.envelope(JSONObject().put("i", i).put("t", "busy").put("k", env.optString("k")))
                        scheduleDelete(Api.post("messages/$from", JSONObject().put("text", text)))
                    } catch (_: Exception) {}
                }
            }
            "answer" -> {
                if (legByI != null && sdp.isNotEmpty()) {
                    if (legByI.pc.signalingState() == PeerConnection.SignalingState.HAVE_LOCAL_OFFER) {
                        setRemote(legByI.pc, SessionDescription.Type.ANSWER, sdp)
                        CallSignal.candidates(sdp).forEach { addCand(legByI, it) }
                        flush(legByI)
                    }
                    return
                }
                val leg = main ?: return
                if (sdp.isNotEmpty()) {
                    if (leg.pc.signalingState() == PeerConnection.SignalingState.HAVE_LOCAL_OFFER) {
                        if (setRemote(leg.pc, SessionDescription.Type.ANSWER, sdp)) {
                            CallSignal.candidates(sdp).forEach { addCand(leg, it) }
                            flush(leg)
                            stopTone()
                            if (phase != "connected") { phase = "connecting"; status = "connecting" }
                        }
                    } else harvest(leg, sdp)
                }
            }
            "ice", "syn" -> {}
            "dial" -> {
                if (phase == "idle") return
                val u = env.optLong("u"); if (u <= 0) return
                env.optJSONArray("lst")?.let { l ->
                    for (k in 0 until l.length()) {
                        val m = l.optJSONObject(k) ?: continue
                        val id = m.optLong("id")
                        if (id != meId && id > 0 && !known.containsKey(id)) known[id] = User(id, m.optString("u"), m.optString("f").ifBlank { null })
                    }
                }
                pushPeers()
                if (!extras.containsKey(u) && u != peerId && u != meId) {
                    val n = env.optString("n")
                    invite(known[u] ?: User(u, n, n.ifBlank { null }))
                }
            }
            "cam1" -> if (sameCall) { kind = "video"; peerCam = true }
            "cam1x" -> if (sameCall) peerCam = false
            "ring" -> if (phase == "outgoing") status = "ringing"
            "busy" -> if (sameCall && (phase == "outgoing" || phase == "connecting")) endCall("busy")
            "decline" -> {
                if (legByI != null) { val n = legByI.user?.let { it.fullName ?: it.username } ?: ""; dropLeg(legByI.id); notice = "declinedPeer" to n; return }
                if (sameCall && active) endCall("declined")
                else if (sameCall && phase == "incoming") endCall("declined")
            }
            "bye" -> {
                if (legByI != null) {
                    val n = legByI.user?.let { it.fullName?.takeIf { s -> s.isNotBlank() } ?: it.username } ?: ""
                    dropLeg(legByI.id)
                    if (phase == "connected" && n.isNotEmpty()) notice = "peerLeft" to n
                    return
                }
                if (sameCall && phase != "idle" && phase != "ended") {
                    if (phase == "incoming") { stopTone(); CallNotify.cancel(ctx); cleanup(); resetIds(); phase = "idle" } else endCall("remote")
                }
            }
        }
    }

    private suspend fun poll() {
        if (Api.token == null) return
        val convs = try { Api.get("conversations").optJSONArray("conversations") ?: return } catch (_: Exception) { return }
        val watching = HashSet<Long>().apply { peerId?.let { add(it) }; addAll(extras.keys); addAll(known.keys) }
        val now = System.currentTimeMillis()
        val targets = ArrayList<Pair<JSONObject, User>>()
        for (k in 0 until convs.length()) {
            val c = convs.optJSONObject(k) ?: continue
            val last = c.optJSONObject("last") ?: continue
            if (last.optBoolean("mine")) continue
            val u = User.from(c.optJSONObject("user")) ?: continue
            val text = last.optString("text")
            if (!CallSignal.isSignal(text)) continue
            val age = now - parseTime(last.optString("createdAt"))
            if (age < 60_000 || watching.contains(u.id)) targets.add(last to u)
        }
        for ((last, user) in targets) {
            val text = last.optString("text")
            var env = CallSignal.parse(text) ?: continue
            var key = "${last.optString("createdAt")}|${text.length}|${text.takeLast(40)}"
            if (env.optString("t") == "part") {
                key = "${last.optString("createdAt")}|full"
                if (seen.contains(key)) continue
                env = try { readParts(user.id, env) } catch (_: Exception) { null } ?: continue
            }
            if (!seen.add(key)) continue
            if (seen.size > 400) seen = LinkedHashSet(seen.toList().takeLast(200))
            signalPeer = user
            if (peer?.id == user.id && (peer?.username.isNullOrEmpty() || peer?.avatarUrl == null)) peer = user
            try { handle(env, user.id) } catch (_: Exception) {}
        }
        // an incoming call whose signal disappeared (the caller gave up before we answered)
        if (phase == "incoming" && peerId != null && now - ringStamp > 8000) {
            var fresh = false
            for (k in 0 until convs.length()) {
                val c = convs.optJSONObject(k) ?: continue
                if (c.optJSONObject("user")?.optLong("id") != peerId) continue
                val last = c.optJSONObject("last") ?: continue
                fresh = !last.optBoolean("mine") && CallSignal.isSignal(last.optString("text")) && now - parseTime(last.optString("createdAt")) < 60_000
            }
            if (!fresh) { stopTone(); CallNotify.cancel(ctx); cleanup(); resetIds(); phase = "idle" }
        }
    }

    /** Polls the inbox for call signals: every 3 s (1.2 s during a call). */
    fun startLoop() {
        if (loopJob?.isActive == true) return
        loopJob = scope.launch {
            while (true) {
                val busy = phase != "idle"
                // in the background keep listening for incoming calls for 10 minutes (slower), then stop
                val bgOk = !foreground && System.currentTimeMillis() - backgroundSince < 10 * 60_000L
                if (busy || foreground || bgOk) try { poll() } catch (_: Exception) {}
                delay(if (busy) 1200 else if (foreground) 3000 else 6000)
            }
        }
    }

    fun stopLoop() { loopJob?.cancel(); loopJob = null }

    fun clearNotice() { notice = null }
    fun phaseIncomingCleared() { CallNotify.cancel(ctx) }
}
