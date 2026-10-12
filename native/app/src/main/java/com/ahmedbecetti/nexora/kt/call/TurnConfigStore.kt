package com.ahmedbecetti.nexora.kt.call

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class TurnConfig(val urls: List<String> = emptyList(), val username: String = "", val credential: String = "") {
    val configured get() = urls.isNotEmpty()
}

/** Encrypts TURN secrets at rest with a device-bound Android Keystore AES/GCM key. */
object TurnConfigStore {
    private const val ALIAS = "nexora.turn.credentials.v1"
    private const val PREF = "turn_secure"
    private const val KEY = "payload"

    private fun secretKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).setKeySize(256).build())
        return gen.generateKey()
    }

    fun load(ctx: Context): TurnConfig = try {
        val raw = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString(KEY, null) ?: return TurnConfig()
        val all = Base64.decode(raw, Base64.NO_WRAP)
        val iv = all.copyOfRange(0, 12)
        val encrypted = all.copyOfRange(12, all.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
        val json = JSONObject(String(cipher.doFinal(encrypted), Charsets.UTF_8))
        val arr = json.optJSONArray("urls") ?: JSONArray()
        TurnConfig((0 until arr.length()).map { arr.optString(it) }.filter { it.startsWith("turn:") || it.startsWith("turns:") }, json.optString("username"), json.optString("credential"))
    } catch (_: Exception) { TurnConfig() }

    fun save(ctx: Context, config: TurnConfig) {
        require(config.urls.size <= 8 && config.urls.all { it.length <= 300 && (it.startsWith("turn:") || it.startsWith("turns:")) })
        require(config.username.length <= 256 && config.credential.length <= 512)
        if (!config.configured) { clear(ctx); return }
        val json = JSONObject().put("urls", JSONArray(config.urls)).put("username", config.username).put("credential", config.credential).toString()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val encrypted = cipher.doFinal(json.toByteArray(Charsets.UTF_8))
        val combined = cipher.iv + encrypted
        ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().putString(KEY, Base64.encodeToString(combined, Base64.NO_WRAP)).apply()
    }

    fun clear(ctx: Context) { ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().remove(KEY).apply() }
}
