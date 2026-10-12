package com.ahmedbecetti.nexora.kt.data

import androidx.compose.runtime.Immutable
import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.str(k: String): String? = if (isNull(k)) null else optString(k).ifEmpty { null }
fun JSONObject.long(k: String): Long = optLong(k, 0L)
inline fun <T> JSONArray?.mapObj(f: (JSONObject) -> T?): List<T> {
    if (this == null) return emptyList()
    val out = ArrayList<T>(length())
    for (i in 0 until length()) optJSONObject(i)?.let { o -> f(o)?.let(out::add) }
    return out
}

@Immutable
data class User(
    val id: Long,
    val username: String,
    val fullName: String? = null,
    val avatarUrl: String? = null,
    val verified: Boolean = false,
    val isPrivate: Boolean = false,
    val bio: String? = null,
    val website: String? = null,
    val email: String? = null,
    val followStatus: String? = null,
    val followers: Int = 0,
    val followsYou: Boolean = false,
    val note: String? = null,
    val links: List<Pair<String, String>> = emptyList(),
) {
    companion object {
        fun from(o: JSONObject?): User? {
            if (o == null) return null
            return User(
                id = o.long("id"),
                username = o.optString("username"),
                fullName = o.str("fullName"),
                avatarUrl = o.str("avatarUrl"),
                verified = o.optBoolean("verified"),
                isPrivate = o.optBoolean("isPrivate"),
                bio = o.str("bio"),
                website = o.str("website"),
                email = o.str("email"),
                followStatus = o.str("followStatus"),
                followers = o.optInt("followers"),
                followsYou = o.optBoolean("followsYou"),
                note = o.str("note"),
                links = o.optJSONArray("links").mapObj { l -> l.str("url")?.let { (l.str("title") ?: "") to it } },
            )
        }
    }
}

@Immutable
data class Media(val url: String, val type: String, val poster: String?, val width: Int, val height: Int) {
    val isVideo get() = type == "video"
    val thumb get() = poster ?: url
    val ratio: Float get() = if (width > 0 && height > 0) (width.toFloat() / height).coerceIn(0.8f, 1.91f) else 1f
}

@Immutable
data class Post(
    val id: String,               // "123" for posts, "w45" for world reels
    val numId: Long,
    val kind: String,
    val media: List<Media>,
    val caption: String?,
    val location: String?,
    val audio: String?,
    val createdAt: String?,
    val user: User,
    val likeCount: Int,
    val commentCount: Int,
    val liked: Boolean,
    val saved: Boolean,
    val following: Boolean,
    val lastLiker: String?,
    val lastLikerAvatar: String?,
    val lastCommentUser: String?,
    val lastCommentText: String?,
    val viewCount: Int,
    val reposted: Boolean,
    val world: Boolean = false,
    val wid: Long = 0,
    val sourceLicense: String? = null,
    val sourceUrl: String? = null,
) {
    val isReel get() = kind == "reel"
    companion object {
        fun from(o: JSONObject): Post? {
            val user = User.from(o.optJSONObject("user")) ?: return null
            val media = o.optJSONArray("media").mapObj { m ->
                val url = m.str("url") ?: return@mapObj null
                Media(url, m.optString("type", "image"), m.str("poster"), m.optInt("width", m.optInt("w")), m.optInt("height", m.optInt("h")))
            }
            val world = o.optBoolean("world")
            val idStr = o.optString("id")
            val ll = o.optJSONObject("lastLiker")
            val lc = o.optJSONObject("lastComment")
            val src = o.optJSONObject("source")
            return Post(
                id = idStr, numId = idStr.toLongOrNull() ?: 0, kind = o.optString("kind", "post"), media = media,
                caption = o.str("caption"), location = o.str("location"), audio = o.str("audio"), createdAt = o.str("createdAt"),
                user = user, likeCount = o.optInt("likeCount"), commentCount = o.optInt("commentCount"),
                liked = o.optBoolean("liked"), saved = o.optBoolean("saved"), following = o.optBoolean("following"),
                lastLiker = ll?.str("username"), lastLikerAvatar = ll?.str("avatarUrl"),
                lastCommentUser = lc?.str("username"), lastCommentText = lc?.str("text"),
                viewCount = o.optInt("viewCount"), reposted = o.optBoolean("reposted"),
                world = world, wid = o.optLong("wid"), sourceLicense = src?.str("license"), sourceUrl = src?.str("url"),
            )
        }
        fun list(o: JSONObject, key: String = "posts") = o.optJSONArray(key).mapObj { from(it) }
    }
}

@Immutable
data class Comment(
    val id: Long, val text: String, val createdAt: String?, val parentId: Long?,
    val likeCount: Int, val liked: Boolean, val ownerLiked: Boolean, val user: User,
) {
    companion object {
        fun from(o: JSONObject) = User.from(o.optJSONObject("user"))?.let { u ->
            Comment(o.long("id"), o.optString("text"), o.str("createdAt"), if (o.isNull("parentId")) null else o.long("parentId"),
                o.optInt("likeCount"), o.optBoolean("liked"), o.optBoolean("ownerLiked"), u)
        }
    }
}

@Immutable
data class Story(val id: Long, val url: String, val type: String, val createdAt: String?, val seen: Boolean)

@Immutable
data class StoryGroup(val user: User, val stories: List<Story>, val allSeen: Boolean, val close: Boolean) {
    companion object {
        fun from(o: JSONObject) = User.from(o.optJSONObject("user"))?.let { u ->
            StoryGroup(u, o.optJSONArray("stories").mapObj { s ->
                Story(s.long("id"), s.optString("url"), s.optString("type", "image"), s.str("createdAt"), s.optBoolean("seen"))
            }, o.optBoolean("allSeen"), o.optBoolean("close"))
        }
    }
}

@Immutable
data class Notif(
    val id: Long, val type: String, val text: String?, val read: Boolean, val createdAt: String?,
    val postId: Long?, val postThumb: String?, val actor: User, val followStatus: String,
) {
    companion object {
        fun from(o: JSONObject) = User.from(o.optJSONObject("actor"))?.let { a ->
            Notif(o.long("id"), o.optString("type"), o.str("text"), o.optBoolean("read"), o.str("createdAt"),
                if (o.isNull("postId")) null else o.long("postId"), o.str("postThumb"), a, o.optString("followStatus", "none"))
        }
    }
}

@Immutable
data class Conversation(
    val user: User, val activeAt: String?, val lastText: String?, val lastMedia: String?, val lastMediaType: String?,
    val lastHasPost: Boolean, val lastMine: Boolean, val lastAt: String?, val unread: Int,
) {
    companion object {
        fun from(o: JSONObject) = User.from(o.optJSONObject("user"))?.let { u ->
            val l = o.optJSONObject("last") ?: JSONObject()
            Conversation(u, o.str("activeAt"), l.str("text"), if (l.optBoolean("media")) "1" else null, l.str("mediaType"),
                l.optBoolean("post"), l.optBoolean("mine"), l.str("createdAt"), o.optInt("unread"))
        }
    }
}

@Immutable
data class Message(
    val id: Long, val mine: Boolean, val text: String?, val mediaUrl: String?, val mediaType: String?, val mediaMeta: JSONObject?,
    val postId: Long?, val postThumb: String?, val postUser: String?, val read: Boolean, val createdAt: String?, val replyText: String?, val reactions: List<Pair<String, Boolean>>, val gone: Boolean, val edited: Boolean = false,
) {
    val isSignal get() = text?.startsWith("⟦NXCALL⟧") == true
    val isCallLog get() = text?.startsWith("⟦NXLOG⟧") == true
    companion object {
        fun from(o: JSONObject): Message {
            val reply = o.optJSONObject("reply")
            val reactions = o.optJSONArray("reactions").mapObj { r -> r.str("emoji")?.let { it to r.optBoolean("mine") } }
            return Message(o.long("id"), o.optBoolean("mine"), o.str("text"), o.str("mediaUrl"), o.str("mediaType"), o.optJSONObject("mediaMeta"),
                o.optJSONObject("post")?.long("id"), o.optJSONObject("post")?.str("thumb"), o.optJSONObject("post")?.str("username"),
                o.optBoolean("read"), o.str("createdAt"),
                reply?.let { r -> if (r.optBoolean("gone")) "…" else r.str("text") ?: if (r.optBoolean("media")) "📷" else if (r.optBoolean("post")) "▣" else null },
                reactions, o.optBoolean("gone"), o.optBoolean("edited"))
        }
    }
}

@Immutable
data class Profile(
    val user: User, val posts: Int, val followers: Int, val following: Int, val followStatus: String,
    val followsYou: Boolean, val hasStory: Boolean, val isMe: Boolean, val canView: Boolean, val canMessage: Boolean,
    val mutuals: List<String>, val note: String?, val links: List<Pair<String, String>>,
) {
    companion object {
        fun from(o: JSONObject): Profile? {
            val uo = o.optJSONObject("user") ?: return null
            val user = User.from(uo) ?: return null
            val st = o.optJSONObject("stats") ?: JSONObject()
            val mutuals = o.optJSONArray("mutuals").mapObj { it.str("username") }
            val links = uo.optJSONArray("links").mapObj { l -> l.str("url")?.let { (l.str("title") ?: it) to it } }
            return Profile(user, st.optInt("posts"), st.optInt("followers"), st.optInt("following"), o.optString("followStatus", "none"),
                o.optBoolean("followsYou"), o.optBoolean("hasStory"), o.optBoolean("isMe"), o.optBoolean("canView", true),
                o.optBoolean("canMessage"), mutuals, uo.str("note"), links)
        }
    }
}
