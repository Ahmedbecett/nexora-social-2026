package com.ahmedbecetti.nexora.kt.call

import android.util.Base64
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

/**
 * Wire format shared with the web app (src/chatkit/call.js): call signals travel inside the chat as hidden
 * messages that start with [MARK] and are deleted a few seconds later; call-history bubbles start with [LOGMARK].
 * Everything here must stay byte-compatible with the web implementation.
 */
object CallSignal {
    const val MARK = "\u27e6NXCALL\u27e7"
    const val LOGMARK = "\u27e6NXLOG\u27e7"

    fun isSignal(s: String?) = s?.startsWith(MARK) == true
    fun isLog(s: String?) = s?.startsWith(LOGMARK) == true

    private fun b64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)
    private fun unb64(s: String): ByteArray = Base64.decode(s, Base64.DEFAULT)

    /** `enc()` of the web: base64 of the UTF-8 bytes. */
    fun enc(s: String): String = b64(s.toByteArray(Charsets.UTF_8))
    fun dec(s: String): String = String(unb64(s), Charsets.UTF_8)

    fun envelope(body: JSONObject): String = MARK + enc(body.toString())
    fun parse(text: String?): JSONObject? {
        if (!isSignal(text)) return null
        return try { JSONObject(dec(text!!.substring(MARK.length))) } catch (_: Exception) { null }
    }

    fun makeLog(kind: String, d: String, at: Long = System.currentTimeMillis()): String =
        LOGMARK + b64(JSONObject().put("k", kind).put("d", d).put("at", at).toString().toByteArray(Charsets.UTF_8))

    fun parseLog(text: String?): JSONObject? {
        if (!isLog(text)) return null
        return try { JSONObject(String(unb64(text!!.substring(LOGMARK.length)), Charsets.UTF_8)) } catch (_: Exception) { null }
    }

    private val KEEP = Regex("^(v=|o=|s=|t=|a=group:|a=ice-ufrag:|a=ice-pwd:|a=fingerprint:|a=setup:|a=mid:|a=rtcp-mux|a=rtcp:|a=rtpmap:|a=fmtp:|a=sendrecv|a=recvonly|a=sendonly|a=inactive|a=maxptime:|a=ptime:|a=candidate:|a=end-of-candidates|a=rtcp-fb:|m=)")

    /** Same trimming as the web `slimSdp` (keeps the essentials, video limited to VP8 + its RTX), plus rtcp-fb for VP8. */
    fun slimSdp(sdp: String): String {
        val lines = sdp.split(Regex("\\r?\\n")).map { it.trim() }.filter { it.isNotEmpty() && KEEP.containsMatchIn(it) }.toMutableList()
        val rtpmap = HashMap<String, String>(); val fmtp = HashMap<String, String>()
        for (l in lines) {
            Regex("^a=rtpmap:(\\d+)\\s+([^/]+)").find(l)?.let { rtpmap[it.groupValues[1]] = it.groupValues[2].lowercase() }
            Regex("^a=fmtp:(\\d+)\\s+(.*)$").find(l)?.let { fmtp[it.groupValues[1]] = it.groupValues[2] }
        }
        val out = ArrayList<String>()
        var i = 0
        while (i < lines.size) {
            val line = lines[i]
            if (line.isEmpty()) { i++; continue }
            if (!line.startsWith("m=video")) { out.add(line); i++; continue }
            val parts = line.split(" ")
            val pts = parts.drop(3)
            val keep = pts.filter { pt ->
                rtpmap[pt] == "vp8" || (rtpmap[pt] == "rtx" && Regex("apt=(\\d+)").find(fmtp[pt] ?: "")?.groupValues?.get(1)?.let { rtpmap[it] == "vp8" } == true)
            }.toSet()
            if (keep.isEmpty()) { out.add(line); i++; continue }
            out.add("m=video ${parts[1]} ${parts[2]} ${pts.filter { it in keep }.joinToString(" ")}")
            i++
            while (i < lines.size && !lines[i].startsWith("m=")) {
                val l = lines[i]
                val mp = Regex("^a=(rtpmap|fmtp|rtcp-fb):(\\d+)").find(l)
                if (l.isNotEmpty() && (mp == null || mp.groupValues[2] in keep)) out.add(l)
                i++
            }
        }
        // rtcp-fb lines outside video sections (audio) are harmless; drop the rest of non-video wildcard extras
        return out.joinToString("\r\n") + "\r\n"
    }

    fun pack(sdp: String?): String {
        if (sdp.isNullOrEmpty()) return ""
        val slim = slimSdp(sdp)
        return try {
            val bos = ByteArrayOutputStream()
            GZIPOutputStream(bos).use { it.write(slim.toByteArray(Charsets.UTF_8)) }
            "z" + b64(bos.toByteArray())
        } catch (_: Exception) { "p" + enc(slim) }
    }

    fun unpack(tag: String?): String {
        if (tag.isNullOrEmpty()) return ""
        return try {
            if (tag[0] == 'z') GZIPInputStream(ByteArrayInputStream(unb64(tag.substring(1)))).use { String(it.readBytes(), Charsets.UTF_8) }
            else dec(tag.substring(1))
        } catch (_: Exception) { "" }
    }

    data class Cand(val candidate: String, val mid: String?, val index: Int)

    fun candidates(sdp: String): List<Cand> {
        val out = ArrayList<Cand>()
        var idx = -1
        val mids = ArrayList<String?>()
        for (raw in sdp.split(Regex("\\r?\\n"))) {
            val line = raw.trim()
            when {
                line.startsWith("m=") -> { mids.add(null); idx = mids.size - 1 }
                line.startsWith("a=mid:") && idx >= 0 -> mids[idx] = line.substring(6)
                line.startsWith("a=candidate:") -> out.add(Cand(line.substring(2), mids.getOrNull(idx), idx))
            }
        }
        // a=mid usually comes after the candidates of the same section only rarely; fix up mids afterwards
        return out.map { c -> if (c.mid == null && c.index >= 0) c.copy(mid = mids.getOrNull(c.index)) else c }
    }
}
