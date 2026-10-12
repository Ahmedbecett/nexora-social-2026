-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Credential Manager (Google sign-in)
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }
