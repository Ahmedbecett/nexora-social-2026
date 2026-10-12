package com.nexora.social

import android.content.Context
import android.net.Uri
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody
import java.io.InputStream
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

data class NexoraSession(val token: String, val username: String, val fullName: String)
data class NexoraPost(
    val id: String,
    val username: String,
    val caption: String,
    val mediaUrl: String?,
    val mediaType: String,
    val likeCount: Int,
    val commentCount: Int,
    val liked: Boolean
)
data class NexoraUser(val id: String, val username: String, val fullName: String, val avatarUrl: String?, val bio: String = "", val website: String = "")
data class NexoraConversation(val user: NexoraUser, val lastText: String, val unread: Int)
data class NexoraMessage(val id: String, val mine: Boolean, val text: String, val mediaUrl: String?)

object NexoraApi {
    private const val BASE_URL = "https://nexora-social-2026.vercel.app/api/"
    private const val PREFS = "nexora_session"
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.SECONDS)
        .build()

    private fun preferences(context: Context) = EncryptedSharedPreferences.create(
        context,
        PREFS,
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun savedToken(context: Context): String? = preferences(context).getString("token", null)

    fun saveSession(context: Context, token: String) {
        preferences(context).edit().putString("token", token).apply()
    }

    fun clearSession(context: Context) {
        preferences(context).edit().remove("token").apply()
    }

    suspend fun login(identifier: String, password: String): NexoraSession = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("identifier", identifier.trim())
            .put("password", password)
        val data = request("auth/login", body = body)
        val user = data.optJSONObject("user") ?: JSONObject()
        val token = data.optString("token")
        if (token.isBlank()) throw IOException("لم يُرجع الخادم رمز جلسة صالحًا.")
        NexoraSession(
            token = token,
            username = user.optString("username", identifier.trim()),
            fullName = user.optString("fullName", user.optString("full_name", ""))
        )
    }

    suspend fun uploadMedia(context: Context, token: String, uri: Uri): Pair<String, String> = withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        val mime = resolver.getType(uri) ?: "image/jpeg"
        if (!(mime.startsWith("image/") || mime.startsWith("video/"))) throw IOException("نوع الملف غير مدعوم.")
        val tokenData = request("upload/token", body = JSONObject().put("contentType", mime), token = token, method = "POST")
        val clientToken = tokenData.optString("clientToken")
        val pathname = tokenData.optString("pathname")
        if (clientToken.isBlank() || pathname.isBlank()) throw IOException("تعذّر الحصول على تصريح رفع الملف.")
        val body = object : RequestBody() {
            override fun contentType() = mime.toMediaType()
            override fun contentLength(): Long = resolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
            override fun writeTo(sink: okio.BufferedSink) {
                val input: InputStream = resolver.openInputStream(uri) ?: throw IOException("تعذّر فتح الملف المختار.")
                input.use { stream ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val count = stream.read(buffer)
                        if (count < 0) break
                        sink.write(buffer, 0, count)
                    }
                }
            }
        }
        val url = "https://blob.vercel-storage.com/?pathname=" + java.net.URLEncoder.encode(pathname, "UTF-8")
        val uploadRequest = Request.Builder().url(url)
            .header("Authorization", "Bearer $clientToken")
            .header("x-api-version", "12")
            .header("x-vercel-blob-access", "public")
            .header("x-content-type", mime)
            .put(body).build()
        client.newCall(uploadRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IOException("فشل رفع الملف إلى التخزين (HTTP ${response.code}).")
            val data = try { JSONObject(raw) } catch (_: Exception) { JSONObject() }
            val mediaUrl = data.optString("url")
            if (mediaUrl.isBlank()) throw IOException("لم يُرجع التخزين رابط الملف.")
            Pair(mediaUrl, if (mime.startsWith("video/")) "video" else "image")
        }
    }

    suspend fun createPost(token: String, url: String, type: String, caption: String, kind: String = "post") = withContext(Dispatchers.IO) {
        val media = org.json.JSONArray().put(JSONObject().put("url", url).put("type", type))
        request("posts", body = JSONObject().put("media", media).put("caption", caption).put("kind", kind), token = token, method = "POST")
    }

    suspend fun sendPhoneCode(phone: String) = withContext(Dispatchers.IO) {
        request("auth/phone/send", body = JSONObject().put("phone", phone).put("lang", "ar"), method = "POST")
    }

    suspend fun verifyPhoneCode(phone: String, code: String): JSONObject = withContext(Dispatchers.IO) {
        request("auth/phone/verify", body = JSONObject().put("phone", phone).put("code", code), method = "POST")
    }

    suspend fun completeProfile(pending: String, fullName: String, username: String): NexoraSession = withContext(Dispatchers.IO) {
        val data = request("auth/complete", body = JSONObject().put("pending", pending).put("fullName", fullName).put("username", username), method = "POST")
        val user = data.optJSONObject("user") ?: JSONObject()
        val token = data.optString("token")
        if (token.isBlank()) throw IOException("لم يُرجع الخادم رمز جلسة صالحًا.")
        NexoraSession(token, user.optString("username", username), user.optString("fullName", fullName))
    }

    suspend fun resetPassword(identifier: String) = withContext(Dispatchers.IO) {
        request("auth/reset", body = JSONObject().put("identifier", identifier), method = "POST")
    }

    suspend fun register(fullName: String, username: String, email: String, password: String): NexoraSession = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("fullName", fullName.trim())
            .put("username", username.trim())
            .put("email", email.trim())
            .put("password", password)
        val data = request("auth/register", body = body)
        val user = data.optJSONObject("user") ?: JSONObject()
        val token = data.optString("token")
        if (token.isBlank()) throw IOException("لم يُرجع الخادم رمز جلسة صالحًا.")
        NexoraSession(
            token = token,
            username = user.optString("username", username.trim()),
            fullName = user.optString("fullName", fullName.trim())
        )
    }

    suspend fun feed(token: String): List<NexoraPost> = posts("feed", token)
    suspend fun explore(token: String): List<NexoraPost> = posts("explore", token)
    suspend fun reels(token: String): List<NexoraPost> = posts("reels", token)

    private suspend fun posts(path: String, token: String): List<NexoraPost> = withContext(Dispatchers.IO) {
        val data = request(path, token = token)
        val array = data.optJSONArray("posts") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until array.length()) {
                val post = array.optJSONObject(i) ?: continue
                val user = post.optJSONObject("user") ?: JSONObject()
                val media = post.optJSONArray("media")?.optJSONObject(0)
                add(NexoraPost(
                    id = post.optString("id", i.toString()),
                    username = user.optString("username", "NEXORA"),
                    caption = post.optString("caption", ""),
                    mediaUrl = media?.optString("url")?.takeIf { it.isNotBlank() },
                    mediaType = media?.optString("type", "image") ?: "image",
                    likeCount = post.optInt("likeCount"),
                    commentCount = post.optInt("commentCount"),
                    liked = post.optBoolean("liked")
                ))
            }
        }
    }

    suspend fun searchUsers(token: String, query: String): List<NexoraUser> = withContext(Dispatchers.IO) {
        val data = request("search/users?q=${java.net.URLEncoder.encode(query, "UTF-8")}", token = token)
        val array = data.optJSONArray("users") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until array.length()) {
                val u = array.optJSONObject(i) ?: continue
                add(NexoraUser(u.optString("id"), u.optString("username"), u.optString("fullName"), u.optString("avatarUrl").takeIf { it.isNotBlank() }, u.optString("bio"), u.optString("website")))
            }
        }
    }

    suspend fun me(token: String): NexoraUser = withContext(Dispatchers.IO) {
        val u = request("me", token = token).optJSONObject("user") ?: JSONObject()
        NexoraUser(u.optString("id"), u.optString("username"), u.optString("fullName"), u.optString("avatarUrl").takeIf { it.isNotBlank() }, u.optString("bio"), u.optString("website"))
    }

    suspend fun conversations(token: String): List<NexoraConversation> = withContext(Dispatchers.IO) {
        val array = request("conversations", token = token).optJSONArray("conversations") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until array.length()) {
                val row = array.optJSONObject(i) ?: continue
                val u = row.optJSONObject("user") ?: JSONObject()
                val last = row.optJSONObject("last") ?: JSONObject()
                add(NexoraConversation(
                    NexoraUser(u.optString("id"), u.optString("username"), u.optString("fullName"), u.optString("avatarUrl").takeIf { it.isNotBlank() }),
                    last.optString("text", if (last.optBoolean("media")) "وسائط" else ""),
                    row.optInt("unread")
                ))
            }
        }
    }

    suspend fun messages(token: String, userId: String): List<NexoraMessage> = withContext(Dispatchers.IO) {
        val array = request("messages/$userId", token = token).optJSONArray("messages") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until array.length()) {
                val m = array.optJSONObject(i) ?: continue
                if (m.optBoolean("gone")) continue
                add(NexoraMessage(m.optString("id"), m.optBoolean("mine"), m.optString("text"), m.optString("mediaUrl").takeIf { it.isNotBlank() }))
            }
        }
    }

    suspend fun sendMessage(token: String, userId: String, text: String) = withContext(Dispatchers.IO) {
        request("messages/$userId", body = JSONObject().put("text", text), token = token)
    }

    suspend fun updateProfile(token: String, fullName: String, bio: String, website: String) = withContext(Dispatchers.IO) {
        request("me", body = JSONObject().put("fullName", fullName).put("bio", bio).put("website", website), token = token, method = "PATCH")
    }

    suspend fun followUser(token: String, userId: String, following: Boolean) = withContext(Dispatchers.IO) {
        request("users/$userId/follow", token = token, method = if (following) "DELETE" else "POST")
    }

    suspend fun createStory(token: String, url: String, type: String) = withContext(Dispatchers.IO) {
        request("stories", body = JSONObject().put("url", url).put("type", type), token = token, method = "POST")
    }

    suspend fun comments(token: String, postId: String): List<String> = withContext(Dispatchers.IO) {
        val array = request("posts/$postId/comments", token = token).optJSONArray("comments") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until array.length()) {
                val row = array.optJSONObject(i) ?: continue
                val user = row.optJSONObject("user") ?: JSONObject()
                add("@${user.optString("username")}: ${row.optString("text")}")
            }
        }
    }

    suspend fun createComment(token: String, postId: String, text: String) = withContext(Dispatchers.IO) {
        request("posts/$postId/comments", body = JSONObject().put("text", text), token = token, method = "POST")
    }

    suspend fun toggleLike(token: String, postId: String, liked: Boolean) = withContext(Dispatchers.IO) {
        request("posts/$postId/like", token = token, method = if (liked) "DELETE" else "POST")
    }

    suspend fun notifications(token: String): List<String> = withContext(Dispatchers.IO) {
        val array = request("notifications", token = token).optJSONArray("notifications") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until array.length()) {
                val n = array.optJSONObject(i) ?: continue
                val actor = n.optJSONObject("actor") ?: JSONObject()
                add("@${actor.optString("username")} · ${n.optString("text", n.optString("type", "نشاط جديد"))}")
            }
        }
    }

    private fun request(path: String, body: JSONObject? = null, token: String? = null, method: String = "GET"): JSONObject {
        val builder = Request.Builder().url(BASE_URL + path)
            .header("Accept", "application/json")
        if (token != null) builder.header("Authorization", "Bearer $token")
        when (method) {
            "POST" -> builder.post((body ?: JSONObject()).toString().toRequestBody(jsonType))
            "PATCH" -> builder.patch((body ?: JSONObject()).toString().toRequestBody(jsonType))
            "DELETE" -> builder.delete()
            else -> builder.get()
        }
        client.newCall(builder.build()).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val data = try { JSONObject(raw) } catch (_: Exception) { JSONObject() }
            if (!response.isSuccessful) {
                val code = data.optString("error", "server_error")
                throw IOException(messageFor(code, response.code))
            }
            return data
        }
    }

    private fun messageFor(code: String, status: Int): String = when (code) {
        "invalid_credentials" -> "بيانات الدخول غير صحيحة."
        "missing_credentials" -> "أدخل اسم المستخدم أو البريد وكلمة المرور."
        "use_phone_login" -> "هذا الحساب يحتاج إلى تسجيل الدخول برقم الهاتف."
        "network" -> "تعذّر الاتصال بالإنترنت."
        else -> "تعذّر تسجيل الدخول (HTTP $status: $code)."
    }
}
