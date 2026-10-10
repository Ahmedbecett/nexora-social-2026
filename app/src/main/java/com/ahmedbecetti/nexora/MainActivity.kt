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
import com.google.firebase.firestore.FirebaseFirestore
import java.util.HashMap

class MainActivity : Activity() {
    private val background = Color.rgb(12, 15, 29)
    private val panel = Color.rgb(24, 29, 49)
    private val accent = Color.rgb(139, 92, 246)
    private val muted = Color.rgb(180, 188, 210)
    private lateinit var auth: FirebaseAuth
    private lateinit var db: FirebaseFirestore
    private lateinit var root: LinearLayout
    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var nameInput: EditText
    private lateinit var statusText: TextView
    private var registering = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        auth = FirebaseAuth.getInstance()
        db = FirebaseFirestore.getInstance()
        showScreen()
    }

    private fun showScreen() {
        val scroll = ScrollView(this).apply { setBackgroundColor(background) }
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(36), dp(24), dp(32))
            setBackgroundColor(background)
        }
        val logo = TextView(this).apply {
            text = "NEXORA"
            textSize = 36f
            letterSpacing = 0.16f
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        val subtitle = TextView(this).apply {
            text = "Your world. Your people. Your space."
            textSize = 14f
            setTextColor(muted)
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(28))
        }
        root.addView(logo)
        root.addView(subtitle)

        val currentUser = auth.currentUser
        if (currentUser != null) {
            showSignedIn(currentUser.email ?: "NEXORA member")
        } else {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(20), dp(22), dp(20), dp(22))
                setBackgroundColor(panel)
            }
            val heading = TextView(this).apply {
                text = if (registering) "Create your account" else "Welcome back"
                textSize = 23f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.WHITE)
            }
            val helper = TextView(this).apply {
                text = if (registering) "Join the NEXORA community." else "Sign in to continue to NEXORA."
                textSize = 14f
                setTextColor(muted)
                setPadding(0, dp(7), 0, dp(18))
            }
            card.addView(heading)
            card.addView(helper)
            nameInput = EditText(this).apply {
                hint = "Display name"
                singleLine = true
                setTextColor(Color.WHITE)
                setHintTextColor(muted)
                setPadding(dp(12), dp(10), dp(12), dp(10))
                setBackgroundColor(background)
                visibility = if (registering) View.VISIBLE else View.GONE
            }
            emailInput = makeInput("Email address")
            emailInput.inputType = 33
            passwordInput = makeInput("Password (at least 6 characters)")
            passwordInput.inputType = 129
            if (registering) card.addView(nameInput)
            card.addView(emailInput)
            card.addView(passwordInput)
            statusText = TextView(this).apply {
                textSize = 13f
                setTextColor(muted)
                setPadding(0, dp(8), 0, dp(8))
            }
            val primary = Button(this).apply {
                text = if (registering) "Create account" else "Sign in"
                setTextColor(Color.WHITE)
                setBackgroundColor(accent)
                setOnClickListener { submitAuth() }
            }
            val switch = Button(this).apply {
                text = if (registering) "Already have an account? Sign in" else "New to NEXORA? Create account"
                setTextColor(Color.WHITE)
                setBackgroundColor(panel)
                setOnClickListener {
                    registering = !registering
                    showScreen()
                }
            }
            card.addView(statusText)
            card.addView(primary)
            card.addView(switch)
            root.addView(card)
            val note = TextView(this).apply {
                text = "By continuing, you agree to use NEXORA respectfully."
                textSize = 12f
                setTextColor(muted)
                gravity = Gravity.CENTER
                setPadding(0, dp(20), 0, 0)
            }
            root.addView(note)
        }
        scroll.addView(root)
        setContentView(scroll)
    }

    private fun showSignedIn(email: String) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(22), dp(20), dp(22))
            setBackgroundColor(panel)
        }
        val title = TextView(this).apply {
            text = "You're in."
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
        }
        val detail = TextView(this).apply {
            text = "Signed in as $email"
            textSize = 14f
            setTextColor(muted)
            setPadding(0, dp(10), 0, dp(18))
        }
        val signOut = Button(this).apply {
            text = "Sign out"
            setTextColor(Color.WHITE)
            setBackgroundColor(accent)
            setOnClickListener {
                auth.signOut()
                registering = false
                showScreen()
            }
        }
        card.addView(title)
        card.addView(detail)
        card.addView(signOut)
        root.addView(card)
    }

    private fun makeInput(hintText: String): EditText {
        return EditText(this).apply {
            hint = hintText
            singleLine = true
            textSize = 15f
            setTextColor(Color.WHITE)
            setHintTextColor(muted)
            setPadding(dp(12), dp(10), dp(12), dp(10))
            setBackgroundColor(background)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            params.bottomMargin = dp(12)
            layoutParams = params
        }
    }

    private fun submitAuth() {
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString()
        if (email.isBlank() || password.isBlank()) {
            statusText.text = "Enter your email and password."
            return
        }
        if (registering && nameInput.text.toString().trim().isBlank()) {
            statusText.text = "Enter a display name."
            return
        }
        if (registering && password.length < 6) {
            statusText.text = "Password must contain at least 6 characters."
            return
        }
        statusText.text = "Connecting securely…"
        if (registering) {
            val displayName = nameInput.text.toString().trim()
            auth.createUserWithEmailAndPassword(email, password)
                .addOnCompleteListener(this) { task ->
                    if (!task.isSuccessful) {
                        statusText.text = task.exception?.localizedMessage ?: "Could not create account."
                        return@addOnCompleteListener
                    }
                    val uid = auth.currentUser?.uid ?: return@addOnCompleteListener
                    val profile = hashMapOf<String, Any>(
                        "uid" to uid,
                        "displayName" to displayName,
                        "email" to email,
                        "bio" to "",
                        "photoUrl" to "",
                        "createdAt" to System.currentTimeMillis()
                    )
                    db.collection("users").document(uid).set(profile)
                        .addOnSuccessListener {
                            Toast.makeText(this, "Welcome to NEXORA!", Toast.LENGTH_LONG).show()
                            showScreen()
                        }
                        .addOnFailureListener {
                            Toast.makeText(this, "Account created, but profile sync failed: ${it.localizedMessage}", Toast.LENGTH_LONG).show()
                            showScreen()
                        }
                }
        } else {
            auth.signInWithEmailAndPassword(email, password)
                .addOnCompleteListener(this) { task ->
                    if (task.isSuccessful) {
                        Toast.makeText(this, "Welcome back!", Toast.LENGTH_SHORT).show()
                        showScreen()
                    } else {
                        statusText.text = task.exception?.localizedMessage ?: "Sign-in failed."
                    }
                }
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
