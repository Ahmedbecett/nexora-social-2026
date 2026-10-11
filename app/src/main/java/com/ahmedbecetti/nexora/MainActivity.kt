package com.ahmedbecetti.nexora

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.os.Handler
import android.os.Looper
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.*
import org.json.JSONObject
import java.io.BufferedOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.auth.PhoneAuthCredential
import java.util.concurrent.TimeUnit
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.MobileAds

/**
 * NEXORA's first complete navigation/UI skeleton.
 * Native Android views are used intentionally; no APK/build was run.
 */
class MainActivity : Activity() {
    // NEXORA visual system inspired by the supplied reference: crisp white canvas,
    // near-black typography, subtle dividers, and Instagram-style violet/magenta accents.
    private val ink = Color.rgb(25, 25, 30)
    private val paper = Color.rgb(255, 255, 255)
    private val surface = Color.rgb(255, 255, 255)
    private val soft = Color.rgb(247, 247, 250)
    private val gray = Color.rgb(112, 115, 124)
    private val violet = Color.rgb(131, 58, 180)
    private val pink = Color.rgb(225, 48, 108)
    private lateinit var auth: FirebaseAuth
    private lateinit var db: FirebaseFirestore
    private lateinit var page: LinearLayout
    private lateinit var body: LinearLayout
    private lateinit var status: TextView
    private var selectedTab = "Home"
    private var feedListener: ListenerRegistration? = null
    private var selectedMedia: Uri? = null
    private var selectedMimeType: String? = null
    private var bannerAdView: AdView? = null
    private val network = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    // Change this to the actual Vercel deployment URL if the project uses a different domain.
    private val apiBaseUrl = "https://nexora-storage.vercel.app"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        auth = FirebaseAuth.getInstance()
        db = FirebaseFirestore.getInstance()
        NexoraPush.initialize(this)
        MobileAds.initialize(this) {}
        window.statusBarColor = Color.rgb(255, 255, 255)
        window.navigationBarColor = Color.rgb(255, 255, 255)
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        render()
    }

    override fun onDestroy() {
        feedListener?.remove()
        bannerAdView?.destroy()
        bannerAdView = null
        super.onDestroy()
    }

    @Deprecated("Legacy result API retained for broad Android compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 410 && resultCode == RESULT_OK) {
            selectedMedia = data?.data
            selectedMimeType = selectedMedia?.let { contentResolver.getType(it) }
            Toast.makeText(this, if (selectedMedia != null) "Media selected: ${selectedMimeType ?: "unknown type"}" else "No media selected.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun createBannerAd(): AdView {
        bannerAdView?.destroy()
        return AdView(this).apply {
            adUnitId = "ca-app-pub-6858364141205978/9187800239"
            setAdSize(AdSize.BANNER)
            bannerAdView = this
            loadAd(AdRequest.Builder().build())
        }
    }

    private fun render() {
        bannerAdView?.destroy()
        bannerAdView = null
        feedListener?.remove()
        page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(paper)
        }
        if (auth.currentUser == null) {
            showAuth()
            page.addView(createBannerAd(), LinearLayout.LayoutParams(-1, -2))
            setContentView(page)
            return
        }
        NexoraPush.syncToken()
        page.addView(topBar())
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            setBackgroundColor(paper)
        }
        body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, dp(4), 0, dp(18))
            setBackgroundColor(paper)
        }
        scroll.addView(body)
        page.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        page.addView(createBannerAd(), LinearLayout.LayoutParams(-1, -2))
        page.addView(bottomBar())
        setContentView(page)
        when (selectedTab) {
            "Home" -> showHome()
            "Search" -> showSearch()
            "Reels" -> showReels()
            "Activity" -> showActivity()
            "Profile" -> showProfile()
            "Settings" -> showSettings()
            "Messages" -> showMessages()
            "Create" -> showCreate()
            "CreateStory" -> showCreate()
        }
    }

    private fun topBar(): View {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(9), dp(14), dp(9))
            setBackgroundColor(paper)
        }
        val logo = text("NEXORA", 27, ink, true).apply {
            typeface = Typeface.create("sans-serif-black", Typeface.BOLD_ITALIC)
            letterSpacing = -0.06f
            post {
                paint.shader = android.graphics.LinearGradient(
                    0f, 0f, width.toFloat().coerceAtLeast(1f), 0f,
                    intArrayOf(Color.rgb(255, 154, 0), Color.rgb(255, 35, 85), Color.rgb(190, 0, 210)),
                    null, android.graphics.Shader.TileMode.CLAMP
                )
                invalidate()
            }
            setOnClickListener { selectedTab = "Home"; render() }
        }
        bar.addView(logo, LinearLayout.LayoutParams(0, -2, 1f))
        bar.addView(iconButton("♡", 30, ink) { selectedTab = "Activity"; render() })
        bar.addView(space(12))
        bar.addView(iconButton("➤", 24, ink) { selectedTab = "Messages"; render() })
        return bar
    }

    private fun bottomBar(): View {
        val nav = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(4), dp(5), dp(4), dp(5))
            setBackgroundColor(paper)
            background = shape(paper, 0, topStroke = Color.rgb(232, 232, 236))
        }
        val items = listOf(
            Triple("Home", "⌂", "Home"),
            Triple("Search", "⌕", "Search"),
            Triple("Create", "＋", "Create"),
            Triple("Reels", "▣", "Reels"),
            Triple("Profile", "♙", "Profile")
        )
        items.forEach { item ->
            val active = selectedTab == item.first
            val v = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setPadding(0, dp(5), 0, dp(4))
                setOnClickListener { selectedTab = item.first; render() }
            }
            val glyph = text(item.second, if (item.first == "Profile") 23 else 29, if (active) ink else gray, active)
            glyph.gravity = Gravity.CENTER
            if (item.first == "Profile") {
                glyph.background = shape(if (active) ink else soft, 50)
                glyph.setTextColor(if (active) paper else gray)
                glyph.setPadding(dp(5), 0, dp(5), 0)
            }
            v.addView(glyph)
            nav.addView(v, LinearLayout.LayoutParams(0, -2, 1f))
        }
        return nav
    }

    private fun showHome() {
        val stories = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(12), dp(7), dp(12), dp(12))
            gravity = Gravity.CENTER_VERTICAL
        }
        val storyScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(stories)
        }
        stories.addView(storyItem("＋", "Your story", true) { selectedTab = "CreateStory"; render() })
        val uid = auth.currentUser?.uid ?: return
        db.collection("users").limit(18).get().addOnSuccessListener { users ->
            users.documents.filter { it.id != uid }.take(17).forEach { user ->
                stories.addView(storyItem(
                    (user.getString("displayName") ?: "N").take(1).uppercase(),
                    user.getString("displayName") ?: "Member",
                    true
                ) { showStoriesFor(user.id, user.getString("displayName") ?: "Member") })
            }
        }
        body.addView(storyScroll)
        body.addView(divider())

        // Match the reference: stories lead directly into a clean, edge-to-edge feed.
        val feed = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            tag = "posts"
        }
        body.addView(feed)
        feedListener = db.collection("posts").limit(40).addSnapshotListener(this) { snapshot, error ->
            feed.removeAllViews()
            if (error != null) {
                feed.addView(emptyState("Couldn't load your feed", "Check the Firestore rules and connection."))
                return@addSnapshotListener
            }
            val docs = snapshot?.documents?.sortedByDescending { it.getLong("createdAt") ?: 0L } ?: emptyList()
            if (docs.isEmpty()) {
                feed.addView(emptyState("Your story starts here", "Share your first moment with NEXORA.", "Create a post") {
                    selectedTab = "Create"; render()
                })
            } else {
                docs.forEach { doc -> feed.addView(postCard(doc.id, doc.getString("uid") ?: "", doc.getString("authorName") ?: "NEXORA member", doc.getString("text") ?: "", doc.getLong("createdAt") ?: 0L, doc.getString("mediaKey"), doc.getString("mediaType"))) }
            }
        }
    }

    private fun postCard(postId: String, authorUid: String, author: String, content: String, createdAt: Long, mediaKey: String?, mediaType: String?): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, dp(6), 0, dp(10))
            setBackgroundColor(paper)
        }
        val head = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), dp(5), dp(12), dp(8))
        }
        head.addView(avatar(author.take(1).uppercase(), 42))
        head.addView(space(10))
        val names = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        names.addView(text(author, 14, ink, true))
        names.addView(text(if (createdAt > 0L) timeLabel(createdAt) else "NEXORA community", 11, gray))
        head.addView(names, LinearLayout.LayoutParams(0, -2, 1f))
        head.addView(iconButton("•••", 18, ink) {
            val options = arrayOf("Report post", "Cancel")
            AlertDialog.Builder(this).setItems(options) { _, which ->
                if (which == 0) {
                    val uid = auth.currentUser?.uid
                    if (uid == null) {
                        toast("Sign in to report a post.")
                    } else {
                        db.collection("reports").add(mapOf(
                            "reporterUid" to uid,
                            "targetType" to "post",
                            "targetId" to postId,
                            "targetUid" to authorUid,
                            "reason" to "user_report",
                            "status" to "open",
                            "createdAt" to System.currentTimeMillis()
                        )).addOnSuccessListener { toast("Report submitted for review.") }
                            .addOnFailureListener { toast("Report failed. Check Firestore rules.") }
                    }
                }
            }.show()
        })
        card.addView(head)
        // Only render a media canvas when the post actually contains uploaded media.
        // Text-only posts stay compact instead of displaying a fake placeholder image.
        if (!mediaKey.isNullOrBlank()) {
            val media = FrameLayout(this).apply {
                background = GradientDrawable(GradientDrawable.Orientation.TL_BR,
                    intArrayOf(Color.rgb(239, 235, 255), Color.rgb(255, 232, 240), Color.rgb(232, 242, 255)))
                layoutParams = LinearLayout.LayoutParams(-1, dp(340))
            }
            val mediaLabel = TextView(this).apply {
                text = "Loading media…"
                textSize = 18f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(ink)
                gravity = Gravity.CENTER
            }
            media.addView(mediaLabel, FrameLayout.LayoutParams(-1, -1))
            loadPostMedia(media, mediaLabel, mediaKey, mediaType ?: "image")
            card.addView(media)
        }
        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(3), dp(12), dp(2))
        }
        actions.addView(iconButton("♡", 29, ink) { toggleLike(postId) })
        actions.addView(iconButton("◯", 24, ink) { commentDialog(postId) })
        actions.addView(iconButton("➤", 22, ink) {
            val shareText = buildString {
                append(author)
                if (content.isNotBlank()) append("\n").append(content)
                append("\n\nShared from NEXORA")
                append("\nhttps://github.com/Ahmedbecetti/nexora-social-2026")
            }
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, shareText)
            }
            startActivity(Intent.createChooser(send, "Share with"))
        })
        actions.addView(LinearLayout(this), LinearLayout.LayoutParams(0, 1, 1f))
        actions.addView(iconButton("⌑", 27, ink) {
            val uid = auth.currentUser?.uid
            if (uid == null) {
                toast("Sign in to save posts.")
            } else {
                val ref = db.collection("users").document(uid).collection("savedPosts").document(postId)
                ref.get().addOnSuccessListener { saved ->
                    if (saved.exists()) {
                        ref.delete().addOnSuccessListener { toast("Removed from saved posts.") }
                            .addOnFailureListener { toast("Could not remove saved post.") }
                    } else {
                        ref.set(mapOf("postId" to postId, "savedAt" to System.currentTimeMillis()))
                            .addOnSuccessListener { toast("Post saved.") }
                            .addOnFailureListener { toast("Save failed. Check Firestore rules.") }
                    }
                }.addOnFailureListener { toast("Could not check saved posts.") }
            }
        })
        card.addView(actions)
        val likeSummary = text("Loading likes…", 12, ink, true).apply {
            setPadding(dp(15), dp(3), dp(15), dp(2))
        }
        card.addView(likeSummary)
        db.collection("posts").document(postId).collection("likes").get()
            .addOnSuccessListener { likes ->
                likeSummary.text = if (likes.isEmpty) "Be the first to like this" else "${likes.size()} likes"
            }
        val caption = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(15), dp(2), dp(15), dp(8))
        }
        caption.addView(text(author, 12, ink, true))
        caption.addView(text(content, 14, ink).apply { setPadding(0, dp(4), 0, dp(3)) })
        val comments = text("View comments / add a comment", 12, gray).apply {
            setPadding(0, dp(5), 0, dp(2))
            setOnClickListener { commentDialog(postId) }
        }
        caption.addView(comments)
        card.addView(caption)
        card.addView(divider())
        return card
    }

    private fun notifyUser(recipientUid: String, type: String, targetId: String) {
        val actor = auth.currentUser ?: return
        if (recipientUid.isBlank() || recipientUid == actor.uid) return
        val actorName = actor.displayName ?: actor.email?.substringBefore("@") ?: "NEXORA member"
        db.collection("notifications").add(mapOf(
            "actorUid" to actor.uid,
            "actorName" to actorName,
            "recipientUid" to recipientUid,
            "type" to type,
            "targetId" to targetId,
            "read" to false,
            "createdAt" to System.currentTimeMillis()
        )).addOnSuccessListener { notification ->
            sendPushForNotification(notification.id)
        }.addOnFailureListener { /* Activity remains usable if notifications are unavailable. */ }
    }

    private fun sendPushForNotification(notificationId: String) {
        val user = auth.currentUser ?: return
        user.getIdToken(false).addOnSuccessListener { tokenResult ->
            val idToken = tokenResult.token ?: return@addOnSuccessListener
            network.execute {
                var connection: HttpURLConnection? = null
                try {
                    connection = (URL("$apiBaseUrl/api/push").openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = 10000
                        readTimeout = 10000
                        doOutput = true
                        setRequestProperty("Authorization", "Bearer $idToken")
                        setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    }
                    val payload = JSONObject().put("notificationId", notificationId).toString()
                    connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                    connection.responseCode
                } catch (_: Exception) {
                    // Firestore notifications remain available if push delivery is not configured.
                } finally {
                    connection?.disconnect()
                }
            }
        }
    }

    private fun toggleLike(postId: String) {
        val uid = auth.currentUser?.uid ?: return
        val post = db.collection("posts").document(postId)
        val ref = post.collection("likes").document(uid)
        ref.get().addOnSuccessListener { snapshot ->
            if (snapshot.exists()) {
                ref.delete().addOnSuccessListener { toast("Like removed.") }
                    .addOnFailureListener { toast("Couldn't remove like. Check Firestore rules.") }
            } else {
                ref.set(mapOf("uid" to uid, "createdAt" to System.currentTimeMillis()))
                    .addOnSuccessListener { post.get().addOnSuccessListener { d -> notifyUser(d.getString("uid") ?: "", "like", postId) } }
                    .addOnFailureListener { toast("Couldn't like post. Check Firestore rules.") }
            }
        }.addOnFailureListener { toast("Couldn't update like. Check Firestore rules.") }
    }

    private fun commentDialog(postId: String) {
        val input = EditText(this).apply {
            hint = "Write a comment…"
            setTextColor(ink)
            setPadding(dp(14), dp(10), dp(14), dp(10))
        }
        AlertDialog.Builder(this)
            .setTitle("إضافة تعليق")
            .setView(input)
            .setNegativeButton("إلغاء", null)
            .setPositiveButton("نشر") { _, _ ->
                val message = input.text.toString().trim()
                val user = auth.currentUser ?: return@setPositiveButton
                if (message.isBlank() || message.length > 1000) {
                    toast("Comment must be 1–1,000 characters.")
                } else {
                    val data = mapOf(
                        "uid" to user.uid,
                        "authorName" to (user.displayName ?: user.email?.substringBefore("@") ?: "Member"),
                        "text" to message,
                        "createdAt" to System.currentTimeMillis()
                    )
                    db.collection("posts").document(postId).collection("comments").add(data)
                        .addOnSuccessListener {
                            db.collection("posts").document(postId).get().addOnSuccessListener { post ->
                                notifyUser(post.getString("uid") ?: "", "comment", postId)
                            }
                            toast("Comment posted.")
                        }
                        .addOnFailureListener { toast("Comment failed. Check Firestore rules.") }
                }
            }.show()
    }

    private fun showSearch() {
        body.addView(sectionTitle("Search"))
        val input = EditText(this).apply {
            hint = "ابحث عن أشخاص بالاسم أو البريد الإلكتروني"
            textSize = 14f
            setSingleLine(true)
            setTextColor(ink)
            setPadding(dp(14), dp(10), dp(14), dp(10))
            background = shape(surface, 14)
        }
        val searchButton = primaryButton("بحث عن أشخاص") {}
        val results = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(14), dp(6), dp(14), 0) }
        searchButton.setOnClickListener {
            results.removeAllViews()
            val term = input.text.toString().trim().lowercase()
            db.collection("users").limit(80).get().addOnSuccessListener { users ->
                users.documents.filter { d ->
                    d.id != auth.currentUser?.uid &&
                        ((d.getString("displayName") ?: "").lowercase().contains(term) ||
                         (d.getString("email") ?: "").lowercase().contains(term))
                }.forEach { d ->
                    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(9), 0, dp(9)) }
                    row.addView(avatar((d.getString("displayName") ?: "N").take(1).uppercase(), 44))
                    row.addView(space(10))
                    val details = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
                    details.addView(text(d.getString("displayName") ?: "NEXORA member", 14, ink, true))
                    details.addView(text(d.getString("bio") ?: "NEXORA member", 12, gray))
                    row.addView(details, LinearLayout.LayoutParams(0, -2, 1f))
                    row.addView(smallButton("Follow") { followUser(d.id) })
                    row.addView(space(4))
                    row.addView(smallButton("Message") { startConversation(d.id, d.getString("displayName") ?: "Member") })
                    results.addView(row)
                    results.addView(divider())
                }
                if (results.childCount == 0) results.addView(emptyState("No people found", "Try another name or email."))
            }.addOnFailureListener { results.addView(emptyState("Search unavailable", "Check Firestore rules and connection.")) }
        }
        body.addView(padded(input))
        body.addView(padded(searchButton))
        body.addView(results)
        if (results.childCount == 0) results.addView(emptyState("Find your people", "Search NEXORA members and follow their profiles."))
    }

    private fun followUser(targetUid: String) {
        val uid = auth.currentUser?.uid ?: return
        if (uid == targetUid) return
        val following = db.collection("users").document(uid).collection("following").document(targetUid)
        val follower = db.collection("users").document(targetUid).collection("followers").document(uid)
        db.runBatch { batch ->
            batch.set(following, mapOf("uid" to targetUid, "createdAt" to System.currentTimeMillis()))
            batch.set(follower, mapOf("uid" to uid, "createdAt" to System.currentTimeMillis()))
        }.addOnSuccessListener {
            notifyUser(targetUid, "follow", targetUid)
            toast("Following member.")
        }.addOnFailureListener { toast("Follow failed. Check Firestore rules.") }
    }

    private fun showReels() {
        body.addView(sectionTitle("Reels"))
        val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        body.addView(list)
        db.collection("posts").limit(80).get().addOnSuccessListener { snapshot ->
            val videos = snapshot.documents.filter { it.getString("mediaType") == "video" }
                .sortedByDescending { it.getLong("createdAt") ?: 0L }
            if (videos.isEmpty()) {
                list.addView(emptyState("No Reels yet", "Publish a video to see it here.", "Create a video") { selectedTab = "Create"; render() })
            } else {
                videos.forEach { d ->
                    list.addView(postCard(d.id, d.getString("uid") ?: "", d.getString("authorName") ?: "NEXORA member",
                        d.getString("text") ?: "", d.getLong("createdAt") ?: 0L, d.getString("mediaKey"), "video"))
                }
            }
        }.addOnFailureListener { list.addView(emptyState("Reels unavailable", "Check Firestore access and connection.")) }
    }
    private fun showActivity() {
        body.addView(sectionTitle("Notifications"))
        val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        body.addView(list)
        val uid = auth.currentUser?.uid ?: return
        db.collection("notifications").whereEqualTo("recipientUid", uid).limit(80).get().addOnSuccessListener { snapshot ->
            val items = snapshot.documents.sortedByDescending { it.getLong("createdAt") ?: 0L }
            if (items.isEmpty()) list.addView(emptyState("You are all caught up", "Likes, comments and follows will appear here."))
            items.forEach { d ->
                val actor = d.getString("actorName") ?: "A member"
                val type = d.getString("type") ?: "activity"
                val action = when (type) { "like" -> "liked your post"; "comment" -> "commented on your post"; "follow" -> "started following you"; "message" -> "sent you a message"; else -> "interacted with you" }
                val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(16), dp(12), dp(16), dp(12)) }
                row.addView(avatar(actor.take(1).uppercase(), 42)); row.addView(space(10))
                row.addView(text("$actor $action", 14, ink).apply { layoutParams = LinearLayout.LayoutParams(0, -2, 1f) })
                list.addView(row); list.addView(divider())
                if (d.getBoolean("read") != true) d.reference.update("read", true)
            }
        }.addOnFailureListener { list.addView(emptyState("Activity unavailable", "Check Firestore rules and connection.")) }
    }

    private fun showMessages() {
        body.addView(sectionTitle("Messages"))
        body.addView(padded(primaryButton("Find people to message") { selectedTab = "Search"; render() }))
        val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        body.addView(list)
        val uid = auth.currentUser?.uid ?: return
        db.collection("conversations").whereArrayContains("members", uid).limit(80).get().addOnSuccessListener { snapshot ->
            if (snapshot.isEmpty) list.addView(emptyState("Your inbox is empty", "Find a member in Search and start a conversation."))
            snapshot.documents.forEach { d ->
                val members = d.get("members") as? List<*> ?: emptyList<Any>()
                val other = members.filterIsInstance<String>().firstOrNull { it != uid } ?: return@forEach
                db.collection("users").document(other).get().addOnSuccessListener { profile ->
                    val name = profile.getString("displayName") ?: "NEXORA member"
                    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(16), dp(12), dp(16), dp(12)) }
                    row.addView(avatar(name.take(1).uppercase(), 44)); row.addView(space(10))
                    val details = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
                    details.addView(text(name, 14, ink, true))
                    details.addView(text(d.getString("lastMessage") ?: "Open conversation", 12, gray))
                    row.addView(details, LinearLayout.LayoutParams(0, -2, 1f))
                    row.setOnClickListener { openConversation(d.id, other, name) }
                    list.addView(row); list.addView(divider())
                }
            }
        }.addOnFailureListener { list.addView(emptyState("Inbox unavailable", "Check Firestore rules and connection.")) }
    }
    private fun startConversation(otherUid: String, otherName: String) {
        val me = auth.currentUser?.uid ?: return
        if (me == otherUid) return
        db.collection("conversations").whereArrayContains("members", me).get().addOnSuccessListener { snapshot ->
            val existing = snapshot.documents.firstOrNull { doc ->
                val members = doc.get("members") as? List<*>
                members?.size == 2 && members.contains(otherUid)
            }
            if (existing != null) { openConversation(existing.id, otherUid, otherName) }
            else {
                val now = System.currentTimeMillis()
                db.collection("conversations").add(mapOf("members" to listOf(me, otherUid), "createdAt" to now, "updatedAt" to now, "lastMessage" to "", "lastMessageAt" to now))
                    .addOnSuccessListener { openConversation(it.id, otherUid, otherName) }
                    .addOnFailureListener { toast("Could not start conversation. Check Firestore rules.") }
            }
        }.addOnFailureListener { toast("Could not find conversations. Check Firestore rules.") }
    }

    private fun openConversation(conversationId: String, otherUid: String, otherName: String) {
        val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(12), dp(8), dp(12), dp(8)) }
        val scroll = ScrollView(this)
        val messages = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll.addView(messages)
        panel.addView(scroll, LinearLayout.LayoutParams(-1, dp(300)))
        val input = EditText(this).apply { hint = "اكتب رسالة..."; setTextColor(ink); maxLines = 3 }
        panel.addView(input)
        val dialog = AlertDialog.Builder(this).setTitle(otherName).setView(panel).setNegativeButton("Close", null).setPositiveButton("Send", null).create()
        val listener = db.collection("conversations").document(conversationId).collection("messages").addSnapshotListener(this) { snap, error ->
            messages.removeAllViews()
            if (error != null) { messages.addView(text("Could not load messages.", 13, gray)); return@addSnapshotListener }
            snap?.documents?.sortedBy { it.getLong("createdAt") ?: 0L }?.forEach { d ->
                val mine = d.getString("uid") == auth.currentUser?.uid
                messages.addView(text((if (mine) "You: " else otherName + ": ") + (d.getString("text") ?: ""), 14, ink).apply { setPadding(dp(8), dp(6), dp(8), dp(6)) })
            }
            scroll.post { scroll.fullScroll(View.FOCUS_DOWN) }
        }
        dialog.setOnDismissListener { listener.remove() }
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val value = input.text.toString().trim()
                val me = auth.currentUser?.uid ?: return@setOnClickListener
                if (value.isBlank() || value.length > 4000) { toast("Message must be 1–4,000 characters."); return@setOnClickListener }
                val ref = db.collection("conversations").document(conversationId)
                val now = System.currentTimeMillis()
                db.runBatch { batch ->
                    batch.set(ref.collection("messages").document(), mapOf("uid" to me, "text" to value, "createdAt" to now))
                    batch.update(ref, mapOf("lastMessage" to value.take(120), "lastMessageAt" to now, "updatedAt" to now))
                }.addOnSuccessListener {
                    input.setText("")
                    notifyUser(otherUid, "message", conversationId)
                }.addOnFailureListener { toast("Message failed. Check Firestore rules.") }
            }
        }
        dialog.show()
    }
    private fun showCreate() {
        val isStory = selectedTab == "CreateStory"
        body.addView(sectionTitle(if (isStory) "New story" else "New post"))
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(16))
            background = shape(surface, 18)
            setMargins(dp(14), dp(8), dp(14), dp(12))
        }
        card.addView(text(if (isStory) "شارك لحظة تختفي بعد 24 ساعة" else "شارك لحظتك مع العالم", 20, ink, true))
        card.addView(text("Share a caption, photo or video. Media is uploaded to Neon through the authenticated Vercel API.", 13, gray).apply { setPadding(0, dp(5), 0, dp(14) ) })
        val caption = EditText(this).apply {
            hint = "اكتب وصفًا..."
            minLines = 4
            gravity = Gravity.TOP
            textSize = 15f
            setTextColor(ink)
            setPadding(dp(12), dp(12), dp(12), dp(12))
            background = shape(paper, 12, Color.rgb(224, 225, 230))
        }
        card.addView(caption)
        card.addView(space(10))
        card.addView(secondaryButton(if (selectedMedia == null) "＋  اختر صورة أو فيديو" else "✓  تم اختيار الوسائط") { pickMedia() })
        status = text("", 12, gray).apply { setPadding(0, dp(8), 0, dp(4)) }
        card.addView(status)
        card.addView(space(10))
        card.addView(primaryButton(if (isStory) "نشر القصة" else "نشر المنشور") {
            val user = auth.currentUser
            val value = caption.text.toString().trim()
            if (user == null) return@primaryButton
            if (isStory && selectedMedia == null) {
                status.text = "Choose a photo or video for your story."
            } else if (value.isBlank() && selectedMedia == null) {
                status.text = "Write a caption or choose media first."
            } else if (value.length > 2200) {
                status.text = "Caption must be 2,200 characters or fewer."
            } else {
                status.text = if (selectedMedia != null) "Uploading media…" else "Sharing…"
                val mediaUri = selectedMedia
                val mime = selectedMimeType
                if (mediaUri != null && mime != null) {
                    uploadMedia(mediaUri, mime, caption = value, statusView = status, isStory = isStory)
                } else if (isStory) {
                    status.text = "Stories require a photo or video."
                } else {
                    createPost(user.uid, value, null, null, status)
                }
            }
        })
        body.addView(card)
    }


    private fun createPost(uid: String, caption: String, mediaKey: String?, mediaType: String?, statusView: TextView) {
        db.collection("users").document(uid).get().addOnSuccessListener { profile ->
            val data = mutableMapOf<String, Any>(
                "uid" to uid,
                "authorName" to (profile.getString("displayName") ?: auth.currentUser?.email?.substringBefore("@") ?: "NEXORA member"),
                "text" to caption,
                "createdAt" to System.currentTimeMillis()
            )
            if (mediaKey != null && mediaType != null) {
                data["mediaKey"] = mediaKey
                data["mediaType"] = mediaType
                data["mediaContentType"] = selectedMimeType ?: "application/octet-stream"
            }
            db.collection("posts").add(data)
                .addOnSuccessListener {
                    selectedMedia = null
                    selectedMimeType = null
                    selectedTab = "Home"
                    toast("Post shared.")
                    render()
                }
                .addOnFailureListener { statusView.text = "Upload completed, but post save failed. The file may remain in storage." }
        }.addOnFailureListener { statusView.text = "Could not load profile. Check connection." }
    }

    private fun uploadMedia(uri: Uri, mime: String, caption: String, statusView: TextView, isStory: Boolean = false) {
        val user = auth.currentUser ?: return
        val bytes = try {
            contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } catch (_: Exception) { null }
        if (bytes == null || bytes.isEmpty()) {
            statusView.text = "Could not read the selected file."
            return
        }
        if (bytes.size > 20 * 1024 * 1024) {
            statusView.text = "Maximum upload size is 20 MB."
            return
        }
        if (mime !in listOf("image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm")) {
            statusView.text = "Choose JPG, PNG, WebP, MP4, MOV or WebM."
            return
        }
        statusView.text = "Preparing secure upload…"
        user.getIdToken(false).addOnSuccessListener { tokenResult ->
            network.execute {
                var key: String? = null
                var failure: String? = null
                try {
                    val request = JSONObject()
                        .put("contentType", mime)
                        .put("size", bytes.size)
                        .put("fileName", "upload." + (mime.substringAfter("/").replace("jpeg", "jpg")))
                    val conn = (URL("$apiBaseUrl/api/storage/upload-url").openConnection() as HttpURLConnection)
                    conn.requestMethod = "POST"
                    conn.connectTimeout = 15000
                    conn.readTimeout = 20000
                    conn.doOutput = true
                    conn.setRequestProperty("Authorization", "Bearer ${tokenResult.token}")
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.outputStream.use { it.write(request.toString().toByteArray(Charsets.UTF_8)) }
                    val code = conn.responseCode
                    val responseText = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
                    conn.disconnect()
                    if (code !in 200..299) throw IllegalStateException("Upload authorization failed (HTTP $code)")
                    val result = JSONObject(responseText)
                    val uploadUrl = result.getString("uploadUrl")
                    key = result.getString("key")
                    val put = (URL(uploadUrl).openConnection() as HttpURLConnection)
                    put.requestMethod = "PUT"
                    put.connectTimeout = 20000
                    put.readTimeout = 60000
                    put.doOutput = true
                    put.setRequestProperty("Content-Type", mime)
                    put.setFixedLengthStreamingMode(bytes.size)
                    BufferedOutputStream(put.outputStream).use { it.write(bytes) }
                    val putCode = put.responseCode
                    put.disconnect()
                    if (putCode !in 200..299) throw IllegalStateException("Object storage upload failed (HTTP $putCode)")
                } catch (e: Exception) {
                    failure = e.message ?: "Upload failed."
                }
                val finalKey = key
                val finalFailure = failure
                mainHandler.post {
                    if (finalFailure != null || finalKey == null) {
                        statusView.text = "Upload failed: ${finalFailure ?: "unknown error"}. Check Vercel URL and storage settings."
                    } else {
                        if (isStory) createStory(user.uid, caption, finalKey, if (mime.startsWith("video/")) "video" else "image", statusView) else createPost(user.uid, caption, finalKey, if (mime.startsWith("video/")) "video" else "image", statusView)
                    }
                }
            }
        }.addOnFailureListener { statusView.text = "Could not get a secure sign-in token." }
    }

    private fun createStory(uid: String, caption: String, key: String, mediaType: String, statusView: TextView) {
        val user = auth.currentUser ?: return
        val now = System.currentTimeMillis()
        val data = mapOf("uid" to uid, "authorName" to (user.displayName ?: user.email?.substringBefore("@") ?: "NEXORA member"), "text" to caption, "mediaKey" to key, "mediaType" to mediaType, "createdAt" to now, "expiresAt" to com.google.firebase.Timestamp(java.util.Date(now + 24L * 60L * 60L * 1000L)))
        db.collection("stories").add(data).addOnSuccessListener { selectedMedia = null; selectedMimeType = null; selectedTab = "Home"; toast("Story shared for 24 hours."); render() }
            .addOnFailureListener { statusView.text = "Media uploaded but story save failed. Check Firestore rules." }
    }

    private fun showStoriesFor(uid: String, displayName: String) {
        db.collection("stories").whereEqualTo("uid", uid).whereGreaterThan("expiresAt", com.google.firebase.Timestamp.now()).get().addOnSuccessListener { snapshot ->
            val active = snapshot.documents.filter { d -> val expiry = d.getTimestamp("expiresAt"); expiry != null && expiry.toDate().time > System.currentTimeMillis() }.sortedBy { it.getLong("createdAt") ?: 0L }
            if (active.isEmpty()) { toast(displayName + " has no active stories."); return@addOnSuccessListener }
            val first = active.first(); val key = first.getString("mediaKey")
            if (key == null) { toast("Story media is unavailable."); return@addOnSuccessListener }
            val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(12), dp(8), dp(12), dp(8)) }
            content.addView(text(displayName + " · " + active.size + " active stories", 14, ink, true))
            val frame = FrameLayout(this).apply { background = shape(soft, 16) }
            val label = text("Loading story…", 16, gray).apply { gravity = Gravity.CENTER }
            frame.addView(label, FrameLayout.LayoutParams(-1, -1)); content.addView(frame, LinearLayout.LayoutParams(-1, dp(360)))
            content.addView(text(first.getString("text") ?: "", 14, ink))
            AlertDialog.Builder(this).setView(content).setPositiveButton("Close", null).show()
            loadPostMedia(frame, label, key, first.getString("mediaType") ?: "image")
        }.addOnFailureListener { toast("Could not load stories. Check Firestore rules.") }
    }
    private fun loadPostMedia(container: FrameLayout, label: TextView, key: String, mediaType: String) {
        val user = auth.currentUser ?: return
        user.getIdToken(false).addOnSuccessListener { token ->
            network.execute {
                var signedUrl: String? = null
                try {
                    val conn = (URL("$apiBaseUrl/api/storage/view-url").openConnection() as HttpURLConnection)
                    conn.requestMethod = "POST"
                    conn.connectTimeout = 12000
                    conn.readTimeout = 15000
                    conn.doOutput = true
                    conn.setRequestProperty("Authorization", "Bearer ${token.token}")
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.outputStream.use { it.write(JSONObject().put("key", key).toString().toByteArray(Charsets.UTF_8)) }
                    if (conn.responseCode in 200..299) {
                        val result = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
                        signedUrl = result.getString("url")
                    }
                    conn.disconnect()
                } catch (_: Exception) { }
                val url = signedUrl
                mainHandler.post {
                    if (url == null) {
                        label.text = "Media unavailable"
                    } else if (mediaType == "video") {
                        val video = VideoView(this).apply {
                            setVideoURI(Uri.parse(url))
                            setOnPreparedListener { player -> player.isLooping = true; label.visibility = View.GONE }
                            setOnErrorListener { _, _, _ -> label.visibility = View.VISIBLE; label.text = "Video couldn't play"; true }
                        }
                        container.addView(video, FrameLayout.LayoutParams(-1, -1))
                        label.text = "▶  Tap to play video"
                        label.setOnClickListener { label.visibility = View.GONE; video.start() }
                    } else {
                        network.execute {
                            var bitmap: android.graphics.Bitmap? = null
                            try {
                                URL(url).openStream().use { bitmap = BitmapFactory.decodeStream(it) }
                            } catch (_: Exception) { }
                            val image = bitmap
                            mainHandler.post {
                                if (image == null) label.text = "Image couldn't load"
                                else {
                                    val imageView = ImageView(this).apply {
                                        setImageBitmap(image)
                                        scaleType = ImageView.ScaleType.CENTER_CROP
                                        contentDescription = "NEXORA post image"
                                    }
                                    container.addView(imageView, FrameLayout.LayoutParams(-1, -1))
                                    label.visibility = View.GONE
                                }
                            }
                        }
                    }
                }
            }
        }.addOnFailureListener { label.text = "Sign in to view media" }
    }

    private fun pickMedia() {
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"))
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        try {
            startActivityForResult(Intent.createChooser(intent, "Choose photo or video"), 410)
        } catch (_: Exception) {
            toast("Could not open the media picker.")
        }
    }

    private fun showProfile() {
        val user = auth.currentUser ?: return
        body.addView(sectionTitle(user.displayName ?: "Profile"))
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(18), dp(22), dp(18), dp(22))
            background = shape(surface, 18)
            setMargins(dp(14), dp(8), dp(14), dp(12))
        }
        card.addView(avatar((user.displayName ?: user.email ?: "N").take(1).uppercase(), 84))
        val name = EditText(this).apply {
            hint = "Display name"
            gravity = Gravity.CENTER
            textSize = 18f
            setTextColor(ink)
            setSingleLine(true)
        }
        val bio = EditText(this).apply {
            hint = "Add a short bio"
            gravity = Gravity.CENTER
            textSize = 14f
            setTextColor(ink)
            maxLines = 3
        }
        val message = text("Loading profile…", 12, gray)
        card.addView(name, LinearLayout.LayoutParams(-1, -2))
        card.addView(bio, LinearLayout.LayoutParams(-1, -2))
        card.addView(message)
        name.setText(user.displayName ?: user.email?.substringBefore("@") ?: "")
        bio.setText("")
        message.text = user.email ?: user.phoneNumber ?: "NEXORA member"
        db.collection("users").document(user.uid).get().addOnSuccessListener { doc ->
            if (doc.exists()) {
                name.setText(doc.getString("displayName")?.takeIf { it.isNotBlank() } ?: user.displayName ?: user.email?.substringBefore("@") ?: "")
                bio.setText(doc.getString("bio") ?: "")
            } else {
                // A valid Firebase account can exist before its Firestore profile document.
                val initialName = user.displayName ?: user.email?.substringBefore("@") ?: "NEXORA member"
                db.collection("users").document(user.uid).set(mapOf(
                    "uid" to user.uid, "displayName" to initialName, "email" to (user.email ?: ""),
                    "phoneNumber" to (user.phoneNumber ?: ""), "bio" to "",
                    "photoUrl" to (user.photoUrl?.toString() ?: ""), "createdAt" to System.currentTimeMillis()
                ), com.google.firebase.firestore.SetOptions.merge())
            }
        }.addOnFailureListener {
            // Keep the form usable with Firebase Auth data instead of leaving an empty, broken profile.
            message.text = user.email ?: user.phoneNumber ?: "Profile details are temporarily unavailable."
        }
        card.addView(primaryButton("Save profile") {
            val n = name.text.toString().trim()
            val b = bio.text.toString().trim()
            if (n.isBlank() || n.length > 60 || b.length > 160) {
                message.text = "Name required (max 60); bio max 160 characters."
            } else {
                val profileData = mapOf(
                    "uid" to user.uid, "displayName" to n, "bio" to b,
                    "email" to (user.email ?: ""), "phoneNumber" to (user.phoneNumber ?: ""),
                    "photoUrl" to (user.photoUrl?.toString() ?: ""), "updatedAt" to System.currentTimeMillis()
                )
                db.collection("users").document(user.uid).set(profileData, com.google.firebase.firestore.SetOptions.merge())
                    .addOnSuccessListener {
                        user.updateProfile(com.google.firebase.auth.UserProfileChangeRequest.Builder().setDisplayName(n).build())
                        message.text = "Profile saved."
                        toast("Profile updated.")
                    }
                    .addOnFailureListener { message.text = "Save failed. Check Firestore rules and connection." }
            }
        })
        body.addView(card)
        val stats = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setMargins(dp(14), 0, dp(14), dp(12)) }
        val postsCount = statCard("Posts", "…")
        val followers = statCard("Followers", "…")
        val following = statCard("Following", "…")
        stats.addView(postsCount, LinearLayout.LayoutParams(0, -2, 1f))
        stats.addView(space(5))
        stats.addView(followers, LinearLayout.LayoutParams(0, -2, 1f))
        stats.addView(space(5))
        stats.addView(following, LinearLayout.LayoutParams(0, -2, 1f))
        body.addView(stats)
        db.collection("posts").whereEqualTo("uid", user.uid).get().addOnSuccessListener { setStat(postsCount, "Posts", it.size().toString()) }
        db.collection("users").document(user.uid).collection("followers").get().addOnSuccessListener { setStat(followers, "Followers", it.size().toString()) }
        db.collection("users").document(user.uid).collection("following").get().addOnSuccessListener { setStat(following, "Following", it.size().toString()) }
        body.addView(sectionTitle("Posts"))
        val grid = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(2), dp(2), dp(2), dp(10))
        }
        body.addView(grid)
        db.collection("posts").whereEqualTo("uid", user.uid).limit(60).get()
            .addOnSuccessListener { snapshot ->
                grid.removeAllViews()
                val posts = snapshot.documents.sortedByDescending { it.getLong("createdAt") ?: 0L }
                if (posts.isEmpty()) {
                    grid.addView(emptyState("No posts yet", "Your photos and videos will appear here.", "Create your first post") {
                        selectedTab = "Create"; render()
                    })
                } else {
                    posts.chunked(3).forEach { group ->
                        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                        group.forEach { doc ->
                            val tile = FrameLayout(this).apply {
                                background = GradientDrawable(GradientDrawable.Orientation.TL_BR,
                                    intArrayOf(Color.rgb(255, 232, 241), Color.rgb(237, 231, 250), Color.rgb(231, 242, 255)))
                                setOnClickListener {
                                    AlertDialog.Builder(this@MainActivity)
                                        .setView(postCard(doc.id, user.uid,
                                            doc.getString("authorName") ?: "NEXORA member",
                                            doc.getString("text") ?: "",
                                            doc.getLong("createdAt") ?: 0L,
                                            doc.getString("mediaKey"), doc.getString("mediaType")))
                                        .setPositiveButton("Close", null).show()
                                }
                            }
                            val label = text(
                                if (doc.getString("mediaType") == "video") "▶" else (doc.getString("text") ?: "N").take(1).ifBlank { "N" },
                                22, violet, true
                            ).apply { gravity = Gravity.CENTER }
                            tile.addView(label, FrameLayout.LayoutParams(-1, -1))
                            val key = doc.getString("mediaKey")
                            if (key != null) loadPostMedia(tile, label, key, doc.getString("mediaType") ?: "image")
                            val params = LinearLayout.LayoutParams(0, dp(116), 1f)
                            params.setMargins(dp(1), dp(1), dp(1), dp(1))
                            row.addView(tile, params)
                        }
                        repeat(3 - group.size) {
                            val spacer = View(this)
                            row.addView(spacer, LinearLayout.LayoutParams(0, dp(116), 1f))
                        }
                        grid.addView(row)
                    }
                }
            }
            .addOnFailureListener { grid.addView(emptyState("Posts unavailable", "Check Firestore permissions and connection.")) }
        body.addView(padded(secondaryButton("⚙  Settings and activity") {
            selectedTab = "Settings"
            render()
        }))
        body.addView(padded(secondaryButton("Sign out") {
            auth.signOut()
            selectedTab = "Home"
            render()
        }))
    }

    private fun showSettings() {
        body.addView(sectionTitle("Settings and activity"))
        val search = EditText(this).apply {
            hint = "⌕  Search settings"
            textSize = 15f
            setSingleLine(true)
            setTextColor(ink)
            setPadding(dp(16), dp(13), dp(16), dp(13))
            background = shape(soft, 14)
        }
        body.addView(padded(search))
        body.addView(sectionTitle("Your account"))
        settingsRow("👤", "Account details", "Email, profile and personal information") {
            selectedTab = "Profile"; render()
        }
        settingsRow("🔔", "Notifications", "Likes, comments and new followers") {
            selectedTab = "Activity"; render()
        }
        settingsRow("🔖", "Saved posts", "Posts you have bookmarked") {
            showSavedPosts()
        }
        body.addView(sectionTitle("How others can interact with you"))
        settingsRow("✉", "Messages", "Open your conversations") {
            selectedTab = "Messages"; render()
        }
        settingsRow("＠", "Tags and mentions", "Manage how people find you") {
            AlertDialog.Builder(this).setTitle("Tags and mentions")
                .setMessage("NEXORA interaction controls are being expanded. Your account and posts remain available.")
                .setPositiveButton("OK", null).show()
        }
        settingsRow("♡", "Likes and comments", "Review recent activity") {
            selectedTab = "Activity"; render()
        }
        settingsRow("🔒", "Account privacy", "Privacy options") {
            AlertDialog.Builder(this).setTitle("Account privacy")
                .setMessage("Privacy controls depend on the account settings currently supported by NEXORA.")
                .setPositiveButton("OK", null).show()
        }
        body.addView(sectionTitle("Support"))
        settingsRow("ⓘ", "Help", "NEXORA account and app help") {
            AlertDialog.Builder(this).setTitle("NEXORA Help")
                .setMessage("For account access, check your email and connection. Password reset emails may appear in Spam or Junk.")
                .setPositiveButton("OK", null).show()
        }
        settingsRow("◉", "About NEXORA", "Version and project information") {
            AlertDialog.Builder(this).setTitle("NEXORA")
                .setMessage("NEXORA Social\nA social network by Ahmedbecetti.")
                .setPositiveButton("OK", null).show()
        }
        body.addView(sectionTitle("Login"))
        body.addView(padded(secondaryButton("Add account / Log in to another account") {
            auth.signOut()
            selectedTab = "Home"
            render()
        }))
        body.addView(padded(secondaryButton("Log out") {
            AlertDialog.Builder(this).setTitle("Log out?")
                .setMessage("You will need to sign in again to access this account.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Log out") { _, _ ->
                    auth.signOut()
                    selectedTab = "Home"
                    render()
                }.show()
        }))
    }

    private fun settingsRow(symbol: String, title: String, subtitle: String, action: () -> Unit) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(18), dp(13), dp(16), dp(13))
            setOnClickListener { action() }
            isClickable = true
            background = android.util.TypedValue().let { shape(paper, 0) }
        }
        row.addView(text(symbol, 23, ink, true).apply { gravity = Gravity.CENTER }, LinearLayout.LayoutParams(dp(38), dp(42)))
        val labels = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(12), 0, dp(4), 0) }
        labels.addView(text(title, 15, ink))
        labels.addView(text(subtitle, 12, gray).apply { setPadding(0, dp(3), 0, 0) })
        row.addView(labels, LinearLayout.LayoutParams(0, -2, 1f))
        row.addView(text("›", 28, gray))
        body.addView(row)
        body.addView(divider())
    }

    private fun showSavedPosts() {
        val user = auth.currentUser ?: return
        val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(14), dp(8), dp(14), dp(8)) }
        val scroll = ScrollView(this).apply { addView(list) }
        val dialog = AlertDialog.Builder(this).setTitle("Saved posts").setView(scroll)
            .setPositiveButton("Close", null).create()
        db.collection("users").document(user.uid).collection("savedPosts").limit(80).get()
            .addOnSuccessListener { saved ->
                if (saved.isEmpty) list.addView(emptyState("No saved posts", "Bookmark a post to find it here."))
                saved.documents.forEach { entry ->
                    val postId = entry.getString("postId") ?: entry.id
                    db.collection("posts").document(postId).get().addOnSuccessListener { post ->
                        if (post.exists()) {
                            list.addView(postCard(post.id, post.getString("uid") ?: "",
                                post.getString("authorName") ?: "NEXORA member",
                                post.getString("text") ?: "", post.getLong("createdAt") ?: 0L,
                                post.getString("mediaKey"), post.getString("mediaType")))
                        }
                    }
                }
            }.addOnFailureListener { list.addView(emptyState("Saved posts unavailable", "Check connection and Firestore rules.")) }
        dialog.show()
    }

    private fun authArabic(): Boolean =
        java.util.Locale.getDefault().language.startsWith("ar")

    private fun authText(ar: String, en: String): String = if (authArabic()) ar else en

    private fun showAuth() {
        page.setPadding(dp(24), dp(22), dp(24), dp(18))
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        page.layoutDirection = if (authArabic()) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR
        page.addView(space(18))
        page.addView(text("NEXORA", 42, ink, true).apply {
            gravity = Gravity.CENTER
            letterSpacing = -0.065f
            typeface = Typeface.create("sans-serif-black", Typeface.BOLD_ITALIC)
            // Brand gradient inspired by the reference, without copying Instagram's name or logo.
            post {
                paint.shader = android.graphics.LinearGradient(
                    0f, 0f, width.toFloat().coerceAtLeast(1f), 0f,
                    intArrayOf(Color.rgb(255, 154, 0), Color.rgb(255, 35, 85), Color.rgb(190, 0, 210)),
                    null, android.graphics.Shader.TileMode.CLAMP
                )
                invalidate()
            }
        })
        page.addView(text("Your world. Your people.", 15, gray).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(3), 0, dp(48))
        })

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = if (authArabic()) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR
            setPadding(0, dp(4), 0, dp(8))
        }
        val title = text(authText("أهلاً بعودتك", "Welcome back"), 27, ink, true)
        val subtitle = text(authText("انضم إلى مجتمع يشبهك.", "Join a community that feels like yours."), 15, gray).apply {
            setPadding(0, dp(6), 0, dp(24))
        }
        val name = authField(authText("الاسم الكامل", "Full name")).apply { visibility = View.GONE }
        val email = authField(authText("البريد الإلكتروني", "Email address")).apply {
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            layoutDirection = View.LAYOUT_DIRECTION_LTR
            textAlignment = View.TEXT_ALIGNMENT_VIEW_START
        }
        val password = authField(authText("كلمة السر", "Password")).apply {
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
            layoutDirection = View.LAYOUT_DIRECTION_LTR
            textAlignment = View.TEXT_ALIGNMENT_VIEW_START
        }
        val eye = text(authText("إظهار", "Show"), 13, Color.rgb(0, 112, 243), true).apply {
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(8), dp(8), dp(8))
        }
        var passwordVisible = false
        eye.setOnClickListener {
            passwordVisible = !passwordVisible
            password.inputType = if (passwordVisible)
                android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            else android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
            password.setSelection(password.text?.length ?: 0)
            eye.text = if (passwordVisible) authText("إخفاء", "Hide") else authText("إظهار", "Show")
        }
        val message = text("", 12, pink).apply { setPadding(0, dp(7), 0, dp(5)) }
        var registering = false
        val submit = authPrimaryButton(authText("تسجيل الدخول", "Sign in")) {}
        val switch = authSecondaryButton(authText("إنشاء حساب جديد", "Create a new account")) {}
        val forgot = text(authText("هل نسيت كلمة السر؟", "Forgot password?"), 14, Color.rgb(0, 112, 243), true).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(13), 0, dp(13))
            setOnClickListener {
                val address = email.text.toString().trim()
                if (address.isBlank() || !android.util.Patterns.EMAIL_ADDRESS.matcher(address).matches()) {
                    message.text = authText("أدخل بريدًا إلكترونيًا صحيحًا أولاً.", "Enter a valid email address first.")
                } else {
                    auth.sendPasswordResetEmail(address)
                        .addOnSuccessListener {
                            message.text = authText(
                                "أرسلنا رابط إعادة تعيين كلمة السر. افحص البريد الوارد ومجلد الرسائل غير المرغوب فيها (Spam/Junk)، وتأكد من كتابة البريد الصحيح.",
                                "Password reset email sent. Check your inbox and Spam/Junk folder, and make sure the email address is correct."
                            )
                        }
                        .addOnFailureListener { message.text = authErrorMessage(it) }
                }
            }
        }
        fun updateMode() {
            title.text = if (registering) authText("إنشاء حساب", "Create account") else authText("أهلاً بعودتك", "Welcome back")
            subtitle.text = if (registering) authText("أنشئ حساب NEXORA الخاص بك في خطوات سهلة.", "Create your NEXORA account in a few easy steps.") else authText("انضم إلى مجتمع يشبهك.", "Join a community that feels like yours.")
            name.visibility = if (registering) View.VISIBLE else View.GONE
            submit.text = if (registering) authText("إنشاء الحساب", "Create account") else authText("تسجيل الدخول", "Sign in")
            switch.text = if (registering) authText("لديك حساب بالفعل؟ تسجيل الدخول", "Already have an account? Sign in") else authText("ليس لديك حساب؟ إنشاء حساب جديد", "Don't have an account? Create one")
            forgot.visibility = if (registering) View.GONE else View.VISIBLE
        }
        switch.setOnClickListener { registering = !registering; message.text = ""; updateMode() }
        submit.setOnClickListener {
            val e = email.text.toString().trim()
            val p = password.text.toString()
            val n = name.text.toString().trim()
            if (e.isBlank() || p.isBlank() || (registering && n.isBlank())) {
                message.text = authText("أكمل الحقول المطلوبة.", "Please complete all required fields.")
            } else if (!android.util.Patterns.EMAIL_ADDRESS.matcher(e).matches()) {
                message.text = authText("أدخل بريدًا إلكترونيًا صحيحًا.", "Enter a valid email address.")
            } else if (registering && p.length < 6) {
                message.text = authText("يجب أن تتكون كلمة السر من 6 أحرف على الأقل.", "Password must be at least 6 characters.")
            } else if (registering) {
                submit.isEnabled = false
                auth.createUserWithEmailAndPassword(e, p).addOnCompleteListener(this) { task ->
                    submit.isEnabled = true
                    if (!task.isSuccessful) message.text = authErrorMessage(task.exception)
                    else {
                        val user = auth.currentUser ?: return@addOnCompleteListener
                        user.updateProfile(com.google.firebase.auth.UserProfileChangeRequest.Builder().setDisplayName(n).build())
                            .addOnCompleteListener {
                                db.collection("users").document(user.uid).set(mapOf(
                                    "uid" to user.uid, "displayName" to n, "email" to e, "bio" to "",
                                    "photoUrl" to "", "createdAt" to System.currentTimeMillis()
                                )).addOnSuccessListener { selectedTab = "Home"; render() }
                                    .addOnFailureListener { message.text = authText("أُنشئ الحساب لكن تعذر حفظ الملف الشخصي.", "Account created, but the profile could not be saved.") }
                            }
                    }
                }
            } else {
                submit.isEnabled = false
                auth.signInWithEmailAndPassword(e, p).addOnCompleteListener(this) { task ->
                    submit.isEnabled = true
                    if (task.isSuccessful) syncAuthProfileAndOpen(auth.currentUser?.displayName ?: e.substringBefore("@"), e)
                    else message.text = authErrorMessage(task.exception)
                }
            }
        }
        card.addView(title)
        card.addView(subtitle)
        card.addView(name)
        card.addView(space(10))
        card.addView(email, LinearLayout.LayoutParams(-1, -2))
        card.addView(space(10))
        val passwordRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        passwordRow.addView(password, LinearLayout.LayoutParams(0, -2, 1f))
        passwordRow.addView(eye)
        card.addView(passwordRow)
        card.addView(message)
        card.addView(space(8))
        card.addView(submit, LinearLayout.LayoutParams(-1, dp(54)))
        card.addView(forgot)
        card.addView(divider().apply { setPadding(0, dp(10), 0, dp(10)) })
        card.addView(authSecondaryButton(authText("المتابعة برقم الهاتف", "Continue with phone number")) { startPhoneAuthentication() })
        card.addView(space(10))
        card.addView(switch)
        page.addView(card)
        updateMode()
    }

    private fun authErrorMessage(error: Throwable?): String {
        val code = (error as? com.google.firebase.FirebaseException)?.message.orEmpty()
        val details = error?.message.orEmpty()
        return when {
            error is com.google.firebase.auth.FirebaseAuthUserCollisionException ||
                code.contains("EMAIL_ALREADY_IN_USE", true) ||
                details.contains("email address is already in use", true) ->
                authText("هذا البريد مرتبط بحساب موجود. ارجع إلى تسجيل الدخول أو استخدم «هل نسيت كلمة السر؟».", "This email is already in use. Switch to Sign in or use “Forgot password?”.")
            code.contains("INVALID_CREDENTIAL", true) || code.contains("WRONG_PASSWORD", true) -> authText("البريد أو كلمة السر غير صحيحة.", "Email or password is incorrect.")
            code.contains("TOO_MANY_REQUESTS", true) -> authText("محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.", "Too many attempts. Wait a while and try again.")
            else -> error?.localizedMessage ?: authText("حدث خطأ. حاول مجددًا.", "Something went wrong. Please try again.")
        }
    }

    private fun authField(hintText: String): EditText = EditText(this).apply {
        hint = hintText
        textSize = 15f
        setTextColor(ink)
        setHintTextColor(Color.rgb(145, 147, 154))
        isSingleLine = true
        setPadding(dp(16), dp(12), dp(16), dp(12))
        background = shape(Color.rgb(250, 250, 252), 12, Color.rgb(220, 220, 225), dp(1))
    }

    private fun authPrimaryButton(label: String, action: () -> Unit): Button = Button(this).apply {
        text = label
        textSize = 16f
        isAllCaps = false
        setTextColor(Color.WHITE)
        background = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
            intArrayOf(Color.rgb(0, 132, 255), Color.rgb(0, 102, 242))).apply { cornerRadius = dp(14).toFloat() }
        setPadding(dp(12), dp(10), dp(12), dp(10))
        setOnClickListener { action() }
    }

    private fun authSecondaryButton(label: String, action: () -> Unit): Button = Button(this).apply {
        text = label
        textSize = 14f
        isAllCaps = false
        setTextColor(ink)
        background = shape(Color.rgb(247, 247, 250), 12, Color.rgb(232, 232, 236), dp(1))
        setPadding(dp(12), dp(9), dp(12), dp(9))
        setOnClickListener { action() }
    }

    private fun startPhoneAuthentication() {
        val phoneInput = authField(authText("رقم الهاتف مع مفتاح الدولة، مثل +213…", "Phone number with country code, e.g. +213…")).apply {
            inputType = android.text.InputType.TYPE_CLASS_PHONE
            layoutDirection = View.LAYOUT_DIRECTION_LTR
            textAlignment = View.TEXT_ALIGNMENT_VIEW_START
        }
        AlertDialog.Builder(this)
            .setTitle(authText("التحقق برقم الهاتف", "Phone verification"))
            .setMessage(authText(
                "سنرسل رسالة SMS تحتوي على رمز تحقق إلى رقم الهاتف الذي أدخلته. تأكد من كتابة الرقم كاملًا مع مفتاح الدولة.",
                "We’ll send an SMS with a verification code to the phone number you enter. Include the country calling code."
            ))
            .setView(phoneInput)
            .setNegativeButton(authText("إلغاء", "Cancel"), null)
            .setPositiveButton(authText("إرسال الرمز", "Send code"), null)
            .create().also { dialog ->
                dialog.setOnShowListener {
                    dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                        val phoneNumber = phoneInput.text.toString().trim().replace(" ", "").replace("-", "")
                        if (!phoneNumber.matches(Regex("^\\+[1-9][0-9]{7,14}$"))) {
                            phoneInput.error = authText("اكتب الرقم الدولي مثل +213XXXXXXXXX", "Enter the full international number, e.g. +213XXXXXXXXX")
                            return@setOnClickListener
                        }
                        dialog.dismiss()
                        val options = PhoneAuthOptions.newBuilder(auth)
                            .setPhoneNumber(phoneNumber)
                            .setTimeout(60L, TimeUnit.SECONDS)
                            .setActivity(this)
                            .setCallbacks(object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                                    auth.signInWithCredential(credential).addOnCompleteListener(this@MainActivity) { task ->
                                        if (task.isSuccessful) syncAuthProfileAndOpen(phoneNumber, phoneNumber)
                                        else toast(authErrorMessage(task.exception))
                                    }
                                }
                                override fun onVerificationFailed(error: com.google.firebase.FirebaseException) {
                                    val detail = error.message.orEmpty()
                                    val friendly = when {
                                        detail.contains("OPERATION_NOT_ALLOWED", true) ->
                                            authText("إرسال SMS غير مفعّل في Firebase لهذا المشروع. فعّل Phone ضمن Authentication > Sign-in method، وتحقق من سياسة مناطق SMS.", "SMS sign-in is disabled in Firebase. Enable Phone under Authentication > Sign-in method and check the SMS region policy.")
                                        detail.contains("TOO_MANY_REQUESTS", true) || detail.contains("QUOTA_EXCEEDED", true) ->
                                            authText("تجاوزت طلبات SMS الحد المسموح مؤقتًا. انتظر قبل المحاولة مجددًا.", "The SMS quota or rate limit was reached. Wait before trying again.")
                                        detail.contains("INVALID_PHONE_NUMBER", true) ->
                                            authText("رقم الهاتف غير صالح. استخدم الصيغة الدولية مثل +213XXXXXXXXX.", "Invalid phone number. Use international format, e.g. +213XXXXXXXXX.")
                                        else -> authText("تعذر إرسال رسالة التحقق. تحقق من اتصال الإنترنت وإعدادات Firebase Phone Auth. التفاصيل: ", "Could not send the verification SMS. Check your internet connection and Firebase Phone Auth settings. Details: ") + detail
                                    }
                                    AlertDialog.Builder(this@MainActivity)
                                        .setTitle(authText("تعذّر إرسال رمز SMS", "Could not send SMS code"))
                                        .setMessage(friendly + "\n\n" + authText("رمز الخطأ: ", "Error details: ") + detail)
                                        .setPositiveButton(authText("حسنًا", "OK"), null)
                                        .show()
                                }
                                override fun onCodeSent(verificationId: String, token: PhoneAuthProvider.ForceResendingToken) {
                                    showOtpPrompt(verificationId, phoneNumber)
                                }
                            }).build()
                        PhoneAuthProvider.verifyPhoneNumber(options)
                        toast(authText("جارٍ إرسال رسالة التحقق إلى رقمك…", "Sending a verification SMS to your phone…"))
                    }
                }
                dialog.show()
            }
    }

    private fun showOtpPrompt(verificationId: String, phone: String) {
        val codeInput = authField(authText("رمز التحقق المكوّن من 6 أرقام", "6-digit verification code"))
        codeInput.inputType = 2
        AlertDialog.Builder(this)
            .setTitle(authText("تحقق من رقم الهاتف", "Verify phone number"))
            .setMessage("أدخل الرمز الذي وصلك برسالة SMS على $phone")
            .setView(codeInput)
            .setNegativeButton("إلغاء", null)
            .setPositiveButton("تحقق", null)
            .create().also { dialog ->
                dialog.setOnShowListener {
                    dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                        val code = codeInput.text.toString().trim()
                        if (!code.matches(Regex("^[0-9]{6}$"))) {
                            codeInput.error = "أدخل الرمز المكوّن من 6 أرقام"
                            return@setOnClickListener
                        }
                        val credential = PhoneAuthProvider.getCredential(verificationId, code)
                        auth.signInWithCredential(credential).addOnCompleteListener(this) { task ->
                            if (task.isSuccessful) {
                                dialog.dismiss()
                                syncAuthProfileAndOpen(phone, phone)
                            } else codeInput.error = task.exception?.localizedMessage ?: "الرمز غير صحيح"
                        }
                    }
                }
                dialog.show()
            }
    }

    private fun syncAuthProfileAndOpen(displayName: String, emailOrPhone: String) {
        val user = auth.currentUser ?: return
        val name = user.displayName?.takeIf { it.isNotBlank() } ?: displayName
        val profile = mapOf(
            "uid" to user.uid,
            "displayName" to name,
            "email" to (user.email ?: ""),
            "phoneNumber" to (user.phoneNumber ?: emailOrPhone),
            "bio" to "",
            "photoUrl" to (user.photoUrl?.toString() ?: ""),
            "lastLoginAt" to System.currentTimeMillis()
        )
        db.collection("users").document(user.uid).get().addOnSuccessListener { existing ->
            val data = if (existing.exists()) profile.filterKeys { it != "bio" } else profile + ("createdAt" to System.currentTimeMillis())
            db.collection("users").document(user.uid).set(data, com.google.firebase.firestore.SetOptions.merge())
                .addOnSuccessListener { selectedTab = "Home"; render() }
                .addOnFailureListener { toast("تم تسجيل الدخول، لكن تعذرت مزامنة الملف الشخصي.") ; selectedTab = "Home"; render() }
        }.addOnFailureListener { selectedTab = "Home"; render() }
    }

    private fun storyItem(initial: String, title: String, isNew: Boolean, click: () -> Unit): View {
        val item = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(5), dp(3), dp(5), dp(2))
            setOnClickListener { click() }
        }
        val circle = FrameLayout(this).apply {
            background = GradientDrawable(GradientDrawable.Orientation.TL_BR, if (isNew) intArrayOf(Color.rgb(255, 196, 70), Color.rgb(238, 42, 123), Color.rgb(131, 58, 180)) else intArrayOf(soft, soft)).apply { shape = GradientDrawable.OVAL; setStroke(dp(2), if (isNew) pink else Color.rgb(225, 225, 230)) }
            setPadding(dp(3), dp(3), dp(3), dp(3))
        }
        val glyph = TextView(this).apply {
            text = initial
            textSize = 21f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(if (initial == "＋") pink else violet)
            gravity = Gravity.CENTER
            background = shape(paper, 50)
        }
        circle.addView(glyph, FrameLayout.LayoutParams(dp(56), dp(56)))
        item.addView(circle)
        item.addView(text(title.take(13), 10, ink).apply { gravity = Gravity.CENTER; setPadding(0, dp(5), 0, 0) })
        return item
    }

    private fun avatar(initial: String, size: Int): TextView = text(initial, 16, violet, true).apply {
        gravity = Gravity.CENTER
        background = shape(Color.rgb(255, 239, 246), 50, Color.rgb(255, 210, 225), dp(1))
        layoutParams = LinearLayout.LayoutParams(dp(size), dp(size))
    }

    private fun sectionTitle(title: String): View = text(title, 25, ink, true).apply {
        setPadding(dp(16), dp(18), dp(16), dp(12))
    }

    private fun emptyState(title: String, subtitle: String, action: String? = null, click: (() -> Unit)? = null): View {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(22), dp(35), dp(22), dp(35))
            background = shape(surface, 18)
            setMargins(dp(14), dp(12), dp(14), dp(12))
        }
        box.addView(text("✦", 36, violet, true).apply { gravity = Gravity.CENTER })
        box.addView(text(title, 18, ink, true).apply { gravity = Gravity.CENTER; setPadding(0, dp(8), 0, dp(5)) })
        box.addView(text(subtitle, 13, gray).apply { gravity = Gravity.CENTER })
        if (action != null && click != null) {
            box.addView(space(12))
            box.addView(primaryButton(action, click))
        }
        return box
    }

    private fun statCard(label: String, value: String): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setPadding(dp(8), dp(14), dp(8), dp(14))
        background = shape(surface, 14)
        addView(text(value, 20, ink, true).apply { gravity = Gravity.CENTER; tag = "stat_value" })
        addView(text(label, 12, gray).apply { gravity = Gravity.CENTER })
    }

    private fun setStat(card: LinearLayout, label: String, value: String) {
        val valueView = card.getChildAt(0) as? TextView
        valueView?.text = value
    }

    private fun primaryButton(label: String, action: () -> Unit): Button = Button(this).apply {
        text = label
        textSize = 14f
        isAllCaps = false
        setTextColor(Color.WHITE)
        background = shape(violet, 12)
        setPadding(dp(12), dp(8), dp(12), dp(8))
        setOnClickListener { action() }
    }

    private fun secondaryButton(label: String, action: () -> Unit): Button = Button(this).apply {
        text = label
        textSize = 13f
        isAllCaps = false
        setTextColor(ink)
        background = shape(soft, 12)
        setOnClickListener { action() }
    }

    private fun smallButton(label: String, action: () -> Unit): Button = Button(this).apply {
        text = label
        textSize = 11f
        isAllCaps = false
        setTextColor(violet)
        background = shape(Color.rgb(255, 240, 246), 10)
        setOnClickListener { action() }
    }

    private fun iconButton(label: String, size: Int, color: Int, action: () -> Unit): TextView = text(label, size, color, true).apply {
        gravity = Gravity.CENTER
        setPadding(dp(3), dp(2), dp(3), dp(2))
        setOnClickListener { action() }
    }

    private fun text(value: String, size: Int, color: Int, bold: Boolean = false): TextView = TextView(this).apply {
        text = value
        textSize = size.toFloat()
        setTextColor(color)
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun divider(): View = View(this).apply {
        setBackgroundColor(Color.rgb(238, 238, 241))
        layoutParams = LinearLayout.LayoutParams(-1, dp(1))
    }

    private fun space(width: Int): View = View(this).apply {
        layoutParams = LinearLayout.LayoutParams(dp(width), dp(1))
    }

    private fun padded(view: View): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(5), dp(14), dp(5))
        addView(view)
    }

    private fun shape(color: Int, radius: Int, strokeColor: Int? = null, strokeWidth: Int = 1, topStroke: Int? = null): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radius).toFloat()
            if (strokeColor != null) setStroke(strokeWidth, strokeColor)
            if (topStroke != null) setStroke(dp(1), topStroke)
        }

    private fun LinearLayout.setMargins(left: Int, top: Int, right: Int, bottom: Int) {
        val params = LinearLayout.LayoutParams(-1, -2)
        params.setMargins(left, top, right, bottom)
        layoutParams = params
    }

    private fun timeLabel(time: Long): String {
        val age = (System.currentTimeMillis() - time).coerceAtLeast(0L)
        val minutes = age / 60000L
        return when {
            minutes < 1 -> "Just now"
            minutes < 60 -> "${minutes}m ago"
            minutes < 1440 -> "${minutes / 60}h ago"
            else -> "${minutes / 1440}d ago"
        }
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
