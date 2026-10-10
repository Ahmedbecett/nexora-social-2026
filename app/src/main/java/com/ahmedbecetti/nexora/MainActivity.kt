package com.ahmedbecetti.nexora

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

class MainActivity : Activity() {
    private val background = Color.rgb(10, 12, 24)
    private val panel = Color.rgb(23, 27, 46)
    private val accent = Color.rgb(124, 92, 255)
    private val muted = Color.rgb(177, 185, 207)
    private lateinit var auth: FirebaseAuth
    private lateinit var db: FirebaseFirestore
    private lateinit var root: LinearLayout
    private var registering = false
    private var feedListener: ListenerRegistration? = null
    private var activeTab = "Home"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        auth = FirebaseAuth.getInstance()
        db = FirebaseFirestore.getInstance()
        window.statusBarColor = background
        window.navigationBarColor = background
        showScreen()
    }

    override fun onDestroy() {
        feedListener?.remove()
        super.onDestroy()
    }

    private fun showScreen() {
        feedListener?.remove()
        val scroll = ScrollView(this).apply { setBackgroundColor(background) }
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(24), dp(18), dp(28))
            setBackgroundColor(background)
        }
        root.addView(label("NEXORA", 32, Color.WHITE, true).apply {
            letterSpacing = 0.16f
            gravity = Gravity.CENTER
        })
        root.addView(label("Your world. Your people. Your space.", 13, muted).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(5), 0, dp(20))
        })
        if (auth.currentUser == null) showAuth() else showSocial()
        scroll.addView(root)
        setContentView(scroll)
    }

    private fun showAuth() {
        val card = columnCard()
        card.addView(label(if (registering) "Create your account" else "Welcome back", 23, Color.WHITE, true))
        card.addView(label(if (registering) "Join the NEXORA community." else "Sign in to continue.", 14, muted).apply {
            setPadding(0, dp(6), 0, dp(16))
        })
        val name = makeInput("Display name").apply { visibility = if (registering) View.VISIBLE else View.GONE }
        val email = makeInput("Email address").apply { inputType = 33 }
        val password = makeInput("Password (at least 6 characters)").apply { inputType = 129 }
        if (registering) card.addView(name)
        card.addView(email)
        card.addView(password)
        val status = label("", 13, muted)
        card.addView(status)
        card.addView(actionButton(if (registering) "Create account" else "Sign in") {
            val e = email.text.toString().trim()
            val p = password.text.toString()
            val n = name.text.toString().trim()
            if (e.isBlank() || p.isBlank() || (registering && n.isBlank())) {
                status.text = "Complete all required fields."
            } else if (registering && p.length < 6) {
                status.text = "Password must contain at least 6 characters."
            } else {
                status.text = "Connecting securely…"
                if (registering) {
                    auth.createUserWithEmailAndPassword(e, p).addOnCompleteListener(this) { task ->
                        if (!task.isSuccessful) {
                            status.text = task.exception?.localizedMessage ?: "Could not create account."
                        } else {
                            val uid = auth.currentUser?.uid ?: return@addOnCompleteListener
                            val profile = hashMapOf<String, Any>(
                                "uid" to uid, "displayName" to n, "email" to e,
                                "bio" to "", "photoUrl" to "", "createdAt" to System.currentTimeMillis()
                            )
                            db.collection("users").document(uid).set(profile)
                                .addOnSuccessListener { Toast.makeText(this, "Welcome to NEXORA!", Toast.LENGTH_SHORT).show(); showScreen() }
                                .addOnFailureListener { status.text = "Account created, profile sync failed: " + (it.localizedMessage ?: "unknown error") }
                        }
                    }
                } else {
                    auth.signInWithEmailAndPassword(e, p).addOnCompleteListener(this) { task ->
                        if (task.isSuccessful) showScreen()
                        else status.text = task.exception?.localizedMessage ?: "Sign-in failed."
                    }
                }
            }
        })
        card.addView(actionButton(if (registering) "Already have an account? Sign in" else "New to NEXORA? Create account", false) {
            registering = !registering
            showScreen()
        })
        root.addView(card)
    }

    private fun showSocial() {
        val user = auth.currentUser ?: return
        val nav = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER; setPadding(0, dp(12), 0, dp(14)) }
        listOf("Home", "Discover", "Profile").forEach { tab ->
            val b = Button(this).apply {
                text = tab
                textSize = 12f
                setTextColor(Color.WHITE)
                setBackgroundColor(if (activeTab == tab) accent else panel)
                setOnClickListener { activeTab = tab; showScreen() }
            }
            nav.addView(b, LinearLayout.LayoutParams(0, dp(44), 1f).apply { setMargins(dp(3), 0, dp(3), 0) })
        }
        root.addView(nav)
        when (activeTab) {
            "Discover" -> showDiscover()
            "Profile" -> showProfile(user.uid)
            else -> showFeed(user.uid)
        }
        root.addView(actionButton("Sign out", false) {
            feedListener?.remove()
            auth.signOut()
            activeTab = "Home"
            showScreen()
        })
    }

    private fun showFeed(uid: String) {
        val composer = columnCard()
        composer.addView(label("Share a moment", 19, Color.WHITE, true))
        val postInput = makeInput("What's happening?")
        postInput.minLines = 2
        postInput.maxLines = 5
        postInput.gravity = Gravity.TOP
        composer.addView(postInput)
        val status = label("", 12, muted)
        composer.addView(status)
        composer.addView(actionButton("Publish post") {
            val text = postInput.text.toString().trim()
            if (text.isBlank()) {
                status.text = "Write something before publishing."
            } else if (text.length > 2200) {
                status.text = "Posts must be 2,200 characters or fewer."
            } else {
                status.text = "Publishing…"
                val data = hashMapOf<String, Any>(
                    "uid" to uid,
                    "authorName" to (auth.currentUser?.displayName ?: auth.currentUser?.email?.substringBefore("@") ?: "NEXORA member"),
                    "text" to text,
                    "createdAt" to System.currentTimeMillis()
                )
                db.collection("users").document(uid).get().addOnSuccessListener { profile ->
                    data["authorName"] = profile.getString("displayName")
                        ?: auth.currentUser?.email?.substringBefore("@") ?: "NEXORA member"
                    db.collection("posts").add(data)
                        .addOnSuccessListener { postInput.setText(""); status.text = "Posted successfully."; loadFeed(uid) }
                        .addOnFailureListener { status.text = "Could not publish: " + (it.localizedMessage ?: "check Firestore rules") }
                }.addOnFailureListener {
                    db.collection("posts").add(data)
                        .addOnSuccessListener { postInput.setText(""); status.text = "Posted successfully."; loadFeed(uid) }
                        .addOnFailureListener { status.text = "Could not publish: " + (it.localizedMessage ?: "check Firestore rules") }
                }
            }
        })
        root.addView(composer)
        root.addView(label("Latest posts", 20, Color.WHITE, true).apply { setPadding(0, dp(20), 0, dp(8)) })
        loadFeed(uid)
    }

    private fun loadFeed(uid: String) {
        feedListener?.remove()
        feedListener = db.collection("posts").limit(50).addSnapshotListener(this) { snapshot, error ->
            if (error != null) {
                Toast.makeText(this, "Feed error: " + (error.localizedMessage ?: "check Firestore rules"), Toast.LENGTH_LONG).show()
                return@addSnapshotListener
            }
            val start = root.indexOfChild(root.findViewWithTag< View >("feed_container"))
            val old = root.findViewWithTag<View>("feed_container")
            if (old != null) root.removeView(old)
            val feed = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                tag = "feed_container"
            }
            val posts = snapshot?.documents?.sortedByDescending {
                it.getLong("createdAt") ?: it.getTimestamp("createdAt")?.toDate()?.time ?: 0L
            } ?: emptyList()
            if (posts.isEmpty()) {
                feed.addView(columnCard().apply {
                    addView(label("Your feed starts here", 17, Color.WHITE, true))
                    addView(label("Be the first to share a moment with the community.", 13, muted))
                })
            } else {
                posts.forEach { doc ->
                    val card = columnCard()
                    card.addView(label(doc.getString("authorName") ?: "NEXORA member", 15, Color.WHITE, true))
                    card.addView(label(doc.getString("text") ?: "", 15, Color.rgb(229, 232, 243)).apply { setPadding(0, dp(10), 0, dp(12)) })
                    val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                    val like = Button(this).apply {
                        text = "♥ Like"
                        textSize = 12f
                        setTextColor(Color.WHITE)
                        setBackgroundColor(panel)
                        setOnClickListener {
                            val ref = db.collection("posts").document(doc.id).collection("likes").document(uid)
                            ref.get().addOnSuccessListener { existing ->
                                if (existing.exists()) ref.delete()
                                else ref.set(hashMapOf("uid" to uid, "createdAt" to System.currentTimeMillis()))
                            }.addOnFailureListener { Toast.makeText(this@MainActivity, "Like failed: " + (it.localizedMessage ?: ""), Toast.LENGTH_SHORT).show() }
                        }
                    }
                    val comments = Button(this).apply {
                        text = "Comment"
                        textSize = 12f
                        setTextColor(Color.WHITE)
                        setBackgroundColor(panel)
                        setOnClickListener { showCommentDialog(doc.id, uid) }
                    }
                    actions.addView(like)
                    actions.addView(comments)
                    card.addView(actions)
                    val commentList = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
                    card.addView(commentList)
                    db.collection("posts").document(doc.id).collection("comments")
                        .limit(3).get().addOnSuccessListener { rows ->
                            rows.documents.forEach { comment ->
                                commentList.addView(label((comment.getString("authorName") ?: "Member") + ": " + (comment.getString("text") ?: ""), 12, muted))
                            }
                        }
                    feed.addView(card)
                }
            }
            val composerIndex = root.indexOfChild(root.findViewWithTag<View>("feed_container"))
            if (composerIndex >= 0) root.removeViewAt(composerIndex)
            root.addView(feed)
            feed.tag = "feed_container"
        }
    }

    private fun showCommentDialog(postId: String, uid: String) {
        val input = EditText(this).apply { hint = "Write a comment"; setTextColor(Color.WHITE); setHintTextColor(muted) }
        val box = android.app.AlertDialog.Builder(this)
            .setTitle("Comment")
            .setView(input)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Send", null)
            .create()
        box.setOnShowListener {
            box.getButton(android.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val text = input.text.toString().trim()
                if (text.isBlank() || text.length > 1000) {
                    Toast.makeText(this, "Comment must contain 1–1,000 characters.", Toast.LENGTH_SHORT).show()
                } else {
                    val name = auth.currentUser?.email?.substringBefore("@") ?: "NEXORA member"
                    val data = hashMapOf<String, Any>("uid" to uid, "authorName" to name, "text" to text, "createdAt" to System.currentTimeMillis())
                    db.collection("posts").document(postId).collection("comments").add(data)
                        .addOnSuccessListener { box.dismiss(); showScreen() }
                        .addOnFailureListener { Toast.makeText(this, "Comment failed: " + (it.localizedMessage ?: ""), Toast.LENGTH_LONG).show() }
                }
            }
        }
        box.show()
    }

    private fun showDiscover() {
        val card = columnCard()
        card.addView(label("Discover people", 20, Color.WHITE, true))
        val query = makeInput("Search display name or email")
        card.addView(query)
        val results = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        card.addView(results)
        fun search() {
            results.removeAllViews()
            val term = query.text.toString().trim().lowercase()
            db.collection("users").limit(50).get().addOnSuccessListener { docs ->
                docs.documents.filter { d ->
                    d.id != auth.currentUser?.uid &&
                        ((d.getString("displayName") ?: "").lowercase().contains(term) ||
                        (d.getString("email") ?: "").lowercase().contains(term))
                }.forEach { d ->
                    val row = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(8), 0, dp(8)) }
                    row.addView(label(d.getString("displayName") ?: "NEXORA member", 15, Color.WHITE, true))
                    row.addView(label(d.getString("bio") ?: "", 12, muted))
                    row.addView(actionButton("Follow") { followUser(d.id) })
                    results.addView(row)
                }
                if (results.childCount == 0) results.addView(label("No matching members yet.", 13, muted))
            }.addOnFailureListener { results.addView(label("Search unavailable. Check Firestore rules.", 13, muted)) }
        }
        card.addView(actionButton("Search") { search() })
        search()
        root.addView(card)
    }

    private fun followUser(targetUid: String) {
        val uid = auth.currentUser?.uid ?: return
        if (uid == targetUid) return
        val following = db.collection("users").document(uid).collection("following").document(targetUid)
        val follower = db.collection("users").document(targetUid).collection("followers").document(uid)
        val data = hashMapOf<String, Any>("uid" to targetUid, "createdAt" to System.currentTimeMillis())
        db.runBatch { batch ->
            batch.set(following, data)
            batch.set(follower, hashMapOf("uid" to uid, "createdAt" to System.currentTimeMillis()))
        }.addOnSuccessListener { Toast.makeText(this, "Followed member.", Toast.LENGTH_SHORT).show() }
            .addOnFailureListener { Toast.makeText(this, "Follow failed: " + (it.localizedMessage ?: "check Firestore rules"), Toast.LENGTH_LONG).show() }
    }

    private fun showProfile(uid: String) {
        val card = columnCard()
        card.addView(label("Your profile", 20, Color.WHITE, true))
        val displayName = makeInput("Display name")
        val bio = makeInput("Bio")
        card.addView(displayName)
        card.addView(bio)
        val status = label("Loading profile…", 12, muted)
        card.addView(status)
        db.collection("users").document(uid).get().addOnSuccessListener { doc ->
            displayName.setText(doc.getString("displayName") ?: "")
            bio.setText(doc.getString("bio") ?: "")
            status.text = "Keep your profile up to date."
        }.addOnFailureListener { status.text = "Could not load profile: " + (it.localizedMessage ?: "") }
        card.addView(actionButton("Save profile") {
            val name = displayName.text.toString().trim()
            val about = bio.text.toString().trim()
            if (name.isBlank() || name.length > 60 || about.length > 160) {
                status.text = "Name is required (max 60); bio limit is 160 characters."
            } else {
                db.collection("users").document(uid).update(
                    mapOf("displayName" to name, "bio" to about)
                ).addOnSuccessListener { status.text = "Profile saved."; Toast.makeText(this, "Profile updated.", Toast.LENGTH_SHORT).show() }
                    .addOnFailureListener { status.text = "Save failed: " + (it.localizedMessage ?: "check Firestore rules") }
            }
        })
        val stats = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val followers = label("Followers: …", 13, muted)
        val following = label("Following: …", 13, muted)
        stats.addView(followers, LinearLayout.LayoutParams(0, -2, 1f))
        stats.addView(following, LinearLayout.LayoutParams(0, -2, 1f))
        card.addView(stats)
        db.collection("users").document(uid).collection("followers").get().addOnSuccessListener { followers.text = "Followers: " + it.size() }
        db.collection("users").document(uid).collection("following").get().addOnSuccessListener { following.text = "Following: " + it.size() }
        root.addView(card)
    }

    private fun columnCard(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(16), dp(16), dp(16))
        setBackgroundColor(panel)
        val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        p.bottomMargin = dp(12)
        layoutParams = p
    }

    private fun label(textValue: String, size: Int, color: Int, bold: Boolean = false): TextView =
        TextView(this).apply {
            text = textValue
            textSize = size.toFloat()
            setTextColor(color)
            if (bold) typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(4), 0, dp(4))
        }

    private fun makeInput(hintText: String): EditText = EditText(this).apply {
        hint = hintText
        singleLine = false
        textSize = 15f
        setTextColor(Color.WHITE)
        setHintTextColor(muted)
        setPadding(dp(12), dp(10), dp(12), dp(10))
        setBackgroundColor(background)
        val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        p.bottomMargin = dp(10)
        layoutParams = p
    }

    private fun actionButton(textValue: String, primary: Boolean = true, action: () -> Unit): Button =
        Button(this).apply {
            text = textValue
            textSize = 13f
            setTextColor(Color.WHITE)
            setBackgroundColor(if (primary) accent else panel)
            setOnClickListener { action() }
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.topMargin = dp(5)
            layoutParams = p
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
