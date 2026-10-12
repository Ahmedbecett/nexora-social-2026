package com.ahmedbecetti.nexora.kt.data

import android.content.Context
import android.content.SharedPreferences
import com.ahmedbecetti.nexora.kt.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(val code: String, val status: Int) : Exception(code)

/** Thin client for the existing Nexora REST API (same endpoints as the web app). */
object Api {
    private const val BASE = BuildConfig.API_BASE
    private val JSON = "application/json; charset=utf-8".toMediaType()
    /** Descriptive UA: Wikimedia (world reels + posters) rejects okhttp's default UA with 403. */
    val USER_AGENT = "Nexora/${BuildConfig.VERSION_NAME} (Android; https://nexora-social-2026.vercel.app)"
    val http: OkHttpClient = OkHttpClient.Builder()
        .addInterceptor { chain -> chain.proceed(chain.request().newBuilder().header("User-Agent", USER_AGENT).build()) }
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(40, TimeUnit.SECONDS)
        .writeTimeout(40, TimeUnit.SECONDS)
        .build()

    private lateinit var prefs: SharedPreferences
    @Volatile var token: String? = null
        private set
    /** Emits true when the server rejects our token (session expired / logged out elsewhere). */
    val unauthorized = MutableStateFlow(false)

    fun init(ctx: Context) {
        prefs = ctx.getSharedPreferences("nexora", Context.MODE_PRIVATE)
        token = prefs.getString("token", null)
    }

    fun setToken(t: String?) {
        token = t
        prefs.edit().apply { if (t == null) remove("token") else putString("token", t) }.apply()
    }

    fun pref(key: String, def: String? = null): String? = prefs.getString(key, def)
    fun setPref(key: String, value: String?) {
        prefs.edit().apply { if (value == null) remove(key) else putString(key, value) }.apply()
    }

    suspend fun get(path: String): JSONObject = call("GET", path, null)
    suspend fun post(path: String, body: JSONObject? = null): JSONObject = call("POST", path, body ?: JSONObject())
    suspend fun delete(path: String): JSONObject = call("DELETE", path, null)
    suspend fun patch(path: String, body: JSONObject): JSONObject = call("PATCH", path, body)

    /** GET with another saved account's token (badges for the account switcher). Never touches the session. */
    suspend fun getAs(tok: String, path: String): JSONObject = call("GET", path, null, tok)

    suspend fun call(method: String, path: String, body: JSONObject?, asToken: String? = null): JSONObject = withContext(Dispatchers.IO) {
        val b = Request.Builder().url(BASE + path)
        (asToken ?: token)?.let { b.header("Authorization", "Bearer $it") }
        b.header("Accept", "application/json")
        val rb = body?.toString()?.toRequestBody(JSON)
        when (method) {
            "GET" -> b.get()
            "DELETE" -> if (rb != null) b.delete(rb) else b.delete()
            else -> b.method(method, rb ?: "{}".toRequestBody(JSON))
        }
        val res = try { http.newCall(b.build()).execute() } catch (e: IOException) { throw ApiException("network", 0) }
        res.use { r ->
            val text = r.body?.string().orEmpty()
            val data = try { if (text.isBlank()) JSONObject() else JSONObject(text) } catch (e: Exception) { JSONObject() }
            if (!r.isSuccessful) {
                val code = data.optString("error").ifBlank { if (r.code >= 500) "server_error" else "error" }
                if (r.code == 401 && token != null && asToken == null) unauthorized.value = true
                throw ApiException(code, r.code)
            }
            data
        }
    }
}

fun json(vararg pairs: Pair<String, Any?>): JSONObject = JSONObject().apply { pairs.forEach { (k, v) -> put(k, v ?: JSONObject.NULL) } }
