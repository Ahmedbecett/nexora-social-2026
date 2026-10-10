package com.ahmedbecetti.nexora

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Button
import android.widget.Toast
import com.google.firebase.auth.FirebaseAuth

class MainActivity : Activity() {
    private val background = Color.rgb(16, 19, 31)
    private val accent = Color.rgb(139, 92, 246)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(28, 32, 28, 32)
            setBackgroundColor(background)
        }
        val logo = TextView(this).apply {
            text = "NEXORA"
            textSize = 38f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            letterSpacing = 0.12f
        }
        val subtitle = TextView(this).apply {
            text = "Connect beyond limits."
            textSize = 16f
            setTextColor(Color.rgb(190, 195, 215))
            gravity = Gravity.CENTER
            setPadding(0, 12, 0, 32)
        }
        val status = TextView(this).apply {
            text = if (FirebaseAuth.getInstance().currentUser != null) "You are signed in" else "Your social space starts here"
            textSize = 16f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 24)
        }
        val button = Button(this).apply {
            text = "Check Firebase connection"
            setBackgroundColor(accent)
            setTextColor(Color.WHITE)
            setOnClickListener {
                try {
                    FirebaseAuth.getInstance().currentUser
                    Toast.makeText(this@MainActivity, "Firebase SDK initialized. Enable Email/Password in Firebase Console to add sign-in.", Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Firebase setup incomplete. Add app/google-services.json and sync Gradle.", Toast.LENGTH_LONG).show()
                }
            }
        }
        root.addView(logo)
        root.addView(subtitle)
        root.addView(status)
        root.addView(button)
        setContentView(root)
    }
}
