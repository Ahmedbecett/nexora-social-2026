package com.ahmedbecetti.nexora.kt.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.Locale

/** Same dictionaries (and keys) as the web app: assets/i18n/<lang>.json, English fallback. */
object I18n {
    private var en = JSONObject()
    private var cur = JSONObject()
    var lang: String = "en"; private set
    val rtl get() = lang in setOf("ar", "fa", "ur", "ps", "he", "ku")
    var languages: List<Triple<String, String, String>> = emptyList(); private set

    fun init(ctx: Context) {
        en = load(ctx, "en") ?: JSONObject()
        languages = try {
            val arr = JSONArray(ctx.assets.open("i18n/languages.json").bufferedReader().use { it.readText() })
            (0 until arr.length()).map { val a = arr.getJSONArray(it); Triple(a.getString(0), a.getString(1), a.optString(2)) }
        } catch (e: Exception) { emptyList() }
        val saved = Api.pref("lang")
        val sys = Locale.getDefault().language.let { if (it == "iw") "he" else if (it == "in") "id" else it }
        setLang(ctx, saved ?: sys)
    }

    fun setLang(ctx: Context, l: String) {
        val d = if (l == "en") en else load(ctx, l)
        if (d == null) { lang = "en"; cur = en } else { lang = l; cur = d }
    }

    private fun load(ctx: Context, l: String): JSONObject? = try {
        JSONObject(ctx.assets.open("i18n/$l.json").bufferedReader().use { it.readText() })
    } catch (e: Exception) { null }

    fun t(key: String, vararg vars: Pair<String, Any>): String {
        var s = cur.optString(key).ifEmpty { en.optString(key).ifEmpty { key } }
        for ((k, v) in vars) s = s.replace("{$k}", v.toString())
        return s
    }

    fun err(code: String?): String {
        val c = code ?: "server_error"
        return cur.optJSONObject("errors")?.optString(c)?.ifEmpty { null }
            ?: en.optJSONObject("errors")?.optString(c)?.ifEmpty { null } ?: t("error")
    }
}

fun t(key: String, vararg vars: Pair<String, Any>) = I18n.t(key, *vars)

fun fmtNum(n: Int): String = when {
    n < 10000 -> "%,d".format(Locale.US, n)
    n < 1_000_000 -> ("%.${if (n < 100000) 1 else 0}f".format(Locale.US, n / 1000.0)).removeSuffix(".0") + "K"
    else -> ("%.1f".format(Locale.US, n / 1e6)).removeSuffix(".0") + "M"
}

fun parseTime(iso: String?): Long = try { if (iso == null) 0 else Instant.parse(iso).toEpochMilli() } catch (e: Exception) {
    try { java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli() } catch (e2: Exception) { 0 }
}

fun timeAgo(iso: String?): String {
    val ms = parseTime(iso); if (ms == 0L) return ""
    val s = maxOf(1L, (System.currentTimeMillis() - ms) / 1000)
    val units = listOf("y" to 31536000L, "w" to 604800L, "d" to 86400L, "h" to 3600L, "m" to 60L, "s" to 1L)
    for ((u, sec) in units) if (s >= sec) {
        val n = s / sec
        if (I18n.lang == "ar") return "$n" + mapOf("y" to "سنة", "w" to "أ", "d" to "ي", "h" to "س", "m" to "د", "s" to "ث")[u]
        return "$n$u"
    }
    return ""
}
