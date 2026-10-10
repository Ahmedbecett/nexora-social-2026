package com.ahmedbecetti.nexora

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

/**
 * NEXORA's first complete navigation/UI skeleton.
 * Native Android views are used intentionally; no APK/build was run.
 */
class MainActivity : Activity() {
    private val ink = Color.rgb(17, 18, 23)
    private val paper = Color.WHITE
    private val surface = Color.rgb(248, 248, 250)
    private val soft = Color.rgb(238, 239, 243)
    private val gray = Color.rgb(116, 119, 129)
    private val violet = Color.rgb(123, 82, 255)
    private val pink = Color.rgb(255, 69, 128)
    private lateinit var auth: FirebaseAuth
    private lateinit var db: FirebaseFirestore
    private lateinit var page: LinearLayout
    private lateinit var body: LinearLayout
    private lateinit var status: TextView
    private var selectedTab = "Home"
    private var feedListener: ListenerRegistration? = null
    private var selectedMedia: Uri? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        auth = FirebaseAuth.getInstance()
        db = FirebaseFirestore.getInstance()
        window.statusBarColor = paper
        window.navigationBarColor = paper
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        render()
    }

    override fun onDestroy() {
        feedListener?.remove()
        super.onDestroy()
    }

    @Deprecated("Legacy result API retained for broad Android compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 410 && resultCode == RESULT_OK) {
            selectedMedia = data?.data
            Toast.makeText(this, if (selectedMedia != null) "Media selected. Upload integration is the next step." else "No media selected.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun render() {
        feedListener?.remove()
        page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(paper)
        }
        if (auth.currentUser == null) {
            showAuth()
            setContentView(page)
            return
        }
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
        page.addView(bottomBar())
        setContentView(page)
        when (selectedTab) {
            "Home" -> showHome()
            "Search" -> showSearch()
            "Reels" -> showReels()
            "Activity" -> showActivity()
            "Profile" -> showProfile()
            "Messages" -> showMessages()
            "Create" -> showCreate()
        }
    }

    private fun topBar(): View {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(9), dp(14), dp(9))
            setBackgroundColor(paper)
        }
        val logo = text("nexora", 28, ink, true).apply {
            letterSpacing = -0.045f
            setOnClickListener { selectedTab = "Home"; render() }
        }
        bar.addView(logo, LinearLayout.LayoutParams(0, -2, 1f))
        bar.addView(iconButton("＋", 30, ink) { selectedTab = "Create"; render() })
        bar.addView(space(8))
        bar.addView(iconButton("♡", 30, ink) { selectedTab = "Activity"; render() })
        bar.addView(space(8))
        bar.addView(iconButton("➤", 24, ink) { selectedTab = "Messages"; render() })
        return bar
    }

    private fun bottomBar(): View {
        val nav = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(4), dp(5), dp(4), dp(5))
            setBackgroundColor(paper)
            background = shape(paper, 0, topStroke = Color.rgb(239, 239, 242))
        }
        val items = listOf(
            Triple("Home", "⌂", "Home"),
            Triple("Search", "⌕", "Search"),
            Triple("Reels", "▻", "Reels"),
            Triple("Activity", "♡", "Activity"),
            Triple("Profile", "●", "Profile")
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
        stories.addView(storyItem("＋", "Your story", true) { selectedTab = "Create"; render() })
        val uid = auth.currentUser?.uid ?: return
        db.collection("users").limit(18).get().addOnSuccessListener { users ->
            users.documents.filter { it.id != uid }.take(17).forEach { user ->
                stories.addView(storyItem(
                    (user.getString("displayName") ?: "N").take(1).uppercase(),
                    user.getString("displayName") ?: "Member",
                    true
                ) { Toast.makeText(this, "Stories will be connected in the next feature stage.", Toast.LENGTH_SHORT).show() })
            }
        }
        body.addView(storyScroll)
        body.addView(divider())

        val heading = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(12), dp(16), dp(8))
        }
        heading.addView(text("For you", 18, ink, true), LinearLayout.LayoutParams(0, -2, 1f))
        heading.addView(text("Latest posts", 12, gray))
        body.addView(heading)
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
                docs.forEach { doc -> feed.addView(postCard(doc.id, doc.getString("uid") ?: "", doc.getString("authorName") ?: "NEXORA member", doc.getString("text") ?: "", doc.getLong("createdAt") ?: 0L)) }
            }
        }
    }

    private fun postCard(postId: String, authorUid: String, author: String, content: String, createdAt: Long): View {
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
                if (which == 0) Toast.makeText(this, "Reporting will be added with safety controls.", Toast.LENGTH_SHORT).show()
            }.show()
        })
        card.addView(head)
        // Placeholder media canvas gives the feed a clear visual hierarchy until upload wiring lands.
        val media = FrameLayout(this).apply {
            background = GradientDrawable(GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.rgb(239, 235, 255), Color.rgb(255, 232, 240), Color.rgb(232, 242, 255)))
            layoutParams = LinearLayout.LayoutParams(-1, dp(225))
        }
        val mediaLabel = TextView(this).apply {
            text = "N"
            textSize = 74f
            typeface = Typeface.create("sans-serif-black", Typeface.BOLD)
            setTextColor(Color.argb(65, 123, 82, 255))
            gravity = Gravity.CENTER
        }
        media.addView(mediaLabel, FrameLayout.LayoutParams(-1, -1))
        card.addView(media)
        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(3), dp(12), dp(2))
        }
        actions.addView(iconButton("♡", 29, ink) { toggleLike(postId) })
        actions.addView(iconButton("◯", 24, ink) { commentDialog(postId) })
        actions.addView(iconButton("➤", 22, ink) { Toast.makeText(this, "Sharing will be added with messaging.", Toast.LENGTH_SHORT).show() })
        actions.addView(LinearLayout(this), LinearLayout.LayoutParams(0, 1, 1f))
        actions.addView(iconButton("⌑", 27, ink) { Toast.makeText(this, "Saved posts are coming later.", Toast.LENGTH_SHORT).show() })
        card.addView(actions)
        val caption = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(15), dp(2), dp(15), dp(8))
        }
        caption.addView(text("NEXORA community", 12, ink, true))
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

    private fun toggleLike(postId: String) {
        val uid = auth.currentUser?.uid ?: return
        val ref = db.collection("posts").document(postId).collection("likes").document(uid)
        ref.get().addOnSuccessListener { snapshot ->
            if (snapshot.exists()) ref.delete()
            else ref.set(mapOf("uid" to uid, "createdAt" to System.currentTimeMillis()))
        }.addOnFailureListener { toast("Couldn't update like. Check Firestore rules.") }
    }

    private fun commentDialog(postId: String) {
        val input = EditText(this).apply {
            hint = "Write a comment…"
            setTextColor(ink)
            setPadding(dp(14), dp(10), dp(14), dp(10))
        }
        AlertDialog.Builder(this)
            .setTitle("Add comment")
            .setView(input)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Post") { _, _ ->
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
                        .addOnSuccessListener { toast("Comment posted.") }
                        .addOnFailureListener { toast("Comment failed. Check Firestore rules.") }
                }
            }.show()
    }

    private fun showSearch() {
        body.addView(sectionTitle("Explore"))
        val input = EditText(this).apply {
            hint = "Search people by name or email"
            textSize = 14f
            setSingleLine(true)
            setTextColor(ink)
            setPadding(dp(14), dp(10), dp(14), dp(10))
            background = shape(surface, 14)
        }
        val searchButton = primaryButton("Search people") {}
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
        }.addOnSuccessListener { toast("Following member.") }
            .addOnFailureListener { toast("Follow failed. Check Firestore rules.") }
    }

    private fun showReels() {
        body.addView(sectionTitle("Reels"))
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(26), dp(45), dp(26), dp(45))
            background = shape(Color.rgb(24, 22, 35), 22)
            setMargins(dp(16), dp(10), dp(16), dp(12))
        }
        panel.addView(text("▶", 64, Color.WHITE, true).apply { gravity = Gravity.CENTER })
        panel.addView(text("Short videos", 23, Color.WHITE, true).apply { gravity = Gravity.CENTER; setPadding(0, dp(12), 0, dp(6)) })
        panel.addView(text("The Reels screen is ready for the video player and media upload integration.", 14, Color.rgb(218, 214, 230)).apply { gravity = Gravity.CENTER; setPadding(0, 0, 0, dp(18)) })
        panel.addView(primaryButton("Create a video post") { selectedTab = "Create"; render() })
        body.addView(panel)
    }

    private fun showActivity() {
        body.addView(sectionTitle("Activity"))
        body.addView(emptyState("Your activity", "Likes, new followers and comments will appear here once notifications are connected."))
    }

    private fun showMessages() {
        body.addView(sectionTitle("Messages"))
        body.addView(emptyState("Your conversations", "The inbox layout is prepared. Real-time direct messaging is a later implementation stage."))
        body.addView(padded(primaryButton("Find people to message") { selectedTab = "Search"; render() }))
    }

    private fun showCreate() {
        body.addView(sectionTitle("Create post"))
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(16))
            background = shape(surface, 18)
            setMargins(dp(14), dp(8), dp(14), dp(12))
        }
        card.addView(text("Share a moment", 20, ink, true))
        card.addView(text("Write a caption or choose a photo/video. Media upload will be connected to Neon in the next stage.", 13, gray).apply { setPadding(0, dp(5), 0, dp(14) ) })
        val caption = EditText(this).apply {
            hint = "Write a caption…"
            minLines = 4
            gravity = Gravity.TOP
            textSize = 15f
            setTextColor(ink)
            setPadding(dp(12), dp(12), dp(12), dp(12))
            background = shape(paper, 12, Color.rgb(224, 225, 230))
        }
        card.addView(caption)
        card.addView(space(10))
        card.addView(secondaryButton(if (selectedMedia == null) "＋  Choose photo or video" else "✓  Media selected") { pickMedia() })
        status = text("", 12, gray).apply { setPadding(0, dp(8), 0, dp(4)) }
        card.addView(status)
        card.addView(space(10))
        card.addView(primaryButton("Share post") {
            val user = auth.currentUser
            val value = caption.text.toString().trim()
            if (user == null) return@primaryButton
            if (value.isBlank() && selectedMedia == null) {
                status.text = "Write a caption or choose media first."
            } else if (value.length > 2200) {
                status.text = "Caption must be 2,200 characters or fewer."
            } else if (selectedMedia != null) {
                status.text = "Media is selected, but upload is not connected yet. Text posts can be shared now."
            } else {
                status.text = "Sharing…"
                db.collection("users").document(user.uid).get().addOnSuccessListener { profile ->
                    val data = mapOf(
                        "uid" to user.uid,
                        "authorName" to (profile.getString("displayName") ?: user.email?.substringBefore("@") ?: "NEXORA member"),
                        "text" to value,
                        "createdAt" to System.currentTimeMillis()
                    )
                    db.collection("posts").add(data)
                        .addOnSuccessListener {
                            selectedMedia = null
                            selectedTab = "Home"
                            toast("Post shared.")
                            render()
                        }
                        .addOnFailureListener { status.text = "Could not share. Check Firestore rules." }
                }.addOnFailureListener { status.text = "Could not load profile. Check connection." }
            }
        })
        body.addView(card)
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
        body.addView(sectionTitle("Profile"))
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
        db.collection("users").document(user.uid).get().addOnSuccessListener { doc ->
            name.setText(doc.getString("displayName") ?: user.displayName ?: "")
            bio.setText(doc.getString("bio") ?: "")
            message.text = user.email ?: "NEXORA member"
        }.addOnFailureListener { message.text = "Profile couldn't load." }
        card.addView(primaryButton("Save profile") {
            val n = name.text.toString().trim()
            val b = bio.text.toString().trim()
            if (n.isBlank() || n.length > 60 || b.length > 160) {
                message.text = "Name required (max 60); bio max 160 characters."
            } else {
                db.collection("users").document(user.uid).update(mapOf("displayName" to n, "bio" to b))
                    .addOnSuccessListener { message.text = "Profile saved."; toast("Profile updated.") }
                    .addOnFailureListener { message.text = "Save failed. Check Firestore rules." }
            }
        })
        body.addView(card)
        val stats = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setMargins(dp(14), 0, dp(14), dp(12)) }
        val followers = statCard("Followers", "…")
        val following = statCard("Following", "…")
        stats.addView(followers, LinearLayout.LayoutParams(0, -2, 1f))
        stats.addView(space(8))
        stats.addView(following, LinearLayout.LayoutParams(0, -2, 1f))
        body.addView(stats)
        db.collection("users").document(user.uid).collection("followers").get().addOnSuccessListener { setStat(followers, "Followers", it.size().toString()) }
        db.collection("users").document(user.uid).collection("following").get().addOnSuccessListener { setStat(following, "Following", it.size().toString()) }
        body.addView(padded(secondaryButton("Sign out") {
            auth.signOut()
            selectedTab = "Home"
            render()
        }))
    }

    private fun showAuth() {
        page.setPadding(dp(22), dp(42), dp(22), dp(28))
        page.addView(space(35))
        page.addView(text("nexora", 40, ink, true).apply { gravity = Gravity.CENTER; letterSpacing = -0.04f })
        page.addView(text("Your world. Your people.", 14, gray).apply { gravity = Gravity.CENTER; setPadding(0, dp(4), 0, dp(28)) })
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(20), dp(18), dp(20))
            background = shape(surface, 18)
        }
        val title = text("Welcome back", 22, ink, true)
        val name = EditText(this).apply { hint = "Display name"; setTextColor(ink); visibility = View.GONE }
        val email = EditText(this).apply { hint = "Email address"; inputType = 33; setTextColor(ink) }
        val password = EditText(this).apply { hint = "Password"; inputType = 129; setTextColor(ink) }
        val message = text("", 12, gray)
        var registering = false
        val submit = primaryButton("Sign in") {}
        val switch = secondaryButton("Create a new account") {}
        fun updateMode() {
            title.text = if (registering) "Create your account" else "Welcome back"
            name.visibility = if (registering) View.VISIBLE else View.GONE
            submit.text = if (registering) "Create account" else "Sign in"
            switch.text = if (registering) "I already have an account" else "Create a new account"
        }
        switch.setOnClickListener { registering = !registering; updateMode() }
        submit.setOnClickListener {
            val e = email.text.toString().trim()
            val p = password.text.toString()
            val n = name.text.toString().trim()
            if (e.isBlank() || p.isBlank() || (registering && n.isBlank())) {
                message.text = "Complete all required fields."
            } else if (registering && p.length < 6) {
                message.text = "Password must contain at least 6 characters."
            } else if (registering) {
                auth.createUserWithEmailAndPassword(e, p).addOnCompleteListener(this) { task ->
                    if (!task.isSuccessful) message.text = task.exception?.localizedMessage ?: "Registration failed."
                    else {
                        val uid = auth.currentUser?.uid ?: return@addOnCompleteListener
                        db.collection("users").document(uid).set(mapOf(
                            "uid" to uid, "displayName" to n, "email" to e, "bio" to "",
                            "photoUrl" to "", "createdAt" to System.currentTimeMillis()
                        )).addOnSuccessListener { selectedTab = "Home"; render() }
                            .addOnFailureListener { message.text = "Account created, but profile sync failed." }
                    }
                }
            } else {
                auth.signInWithEmailAndPassword(e, p).addOnCompleteListener(this) { task ->
                    if (task.isSuccessful) { selectedTab = "Home"; render() }
                    else message.text = task.exception?.localizedMessage ?: "Sign-in failed."
                }
            }
        }
        card.addView(title)
        card.addView(text("Join a community that feels like yours.", 13, gray).apply { setPadding(0, dp(5), 0, dp(16)) })
        card.addView(name); card.addView(email); card.addView(password)
        card.addView(message); card.addView(space(8)); card.addView(submit); card.addView(switch)
        page.addView(card)
    }

    private fun storyItem(initial: String, title: String, isNew: Boolean, click: () -> Unit): View {
        val item = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(5), dp(3), dp(5), dp(2))
            setOnClickListener { click() }
        }
        val circle = FrameLayout(this).apply {
            background = shape(if (isNew) Color.rgb(255, 242, 247) else soft, 50, if (isNew) pink else Color.rgb(221, 222, 229), dp(2))
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
        background = shape(Color.rgb(239, 233, 255), 50, Color.rgb(223, 211, 255), dp(1))
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
        background = shape(Color.rgb(242, 237, 255), 10)
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
