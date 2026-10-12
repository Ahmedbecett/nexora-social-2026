package com.ahmedbecetti.nexora.kt.data

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * Native Google sign-in with Credential Manager. Uses the existing web OAuth client of the
 * nexora-social-2026 Firebase project (the Android client for com.ahmedbecetti.nexora + release SHA-1
 * is already registered there), then the server's existing `auth/google` endpoint.
 */
object GoogleAuth {
    private const val WEB_CLIENT_ID = "549843291889-r62avhn7b93ojh01rocklpu653q7e503.apps.googleusercontent.com"

    class Cancelled : Exception("cancelled")

    /** Returns a Google ID token, or throws [Cancelled] if the user closed the picker. */
    suspend fun idToken(activity: Context): String {
        val req = GetCredentialRequest.Builder()
            .addCredentialOption(GetSignInWithGoogleOption.Builder(WEB_CLIENT_ID).build())
            .build()
        val res = try { CredentialManager.create(activity).getCredential(activity, req) } catch (e: GetCredentialCancellationException) { throw Cancelled() }
        val cred = res.credential
        if (cred is CustomCredential && cred.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            return GoogleIdTokenCredential.createFrom(cred.data).idToken
        }
        throw ApiException("google_failed", 0)
    }
}
