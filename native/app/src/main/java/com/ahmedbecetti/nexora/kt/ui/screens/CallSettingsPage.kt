package com.ahmedbecetti.nexora.kt.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.ahmedbecetti.nexora.kt.call.TurnConfig
import com.ahmedbecetti.nexora.kt.call.TurnConfigStore
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.theme.Nx

/** Optional authenticated TURN relay configuration; credentials are encrypted at rest by Android Keystore. */
@Composable
fun CallSettingsPage() {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val app = com.ahmedbecetti.nexora.kt.LocalApp.current
    val c = Nx.c
    var urls by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var credential by remember { mutableStateOf("") }
    var saved by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        val cfg = TurnConfigStore.load(ctx)
        urls = cfg.urls.joinToString("\n")
        username = cfg.username
        credential = cfg.credential
        saved = cfg.configured
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(t("turnIntro"), style = MaterialTheme.typography.bodyMedium, color = c.muted)
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = urls, onValueChange = { urls = it; error = null },
            modifier = Modifier.fillMaxWidth(), minLines = 2, maxLines = 5,
            label = { Text(t("turnUrls")) }, placeholder = { Text("turn:turn.example.net:3478?transport=udp") },
            supportingText = { Text(t("turnUrlsHint")) },
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(value = username, onValueChange = { username = it; error = null }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, label = { Text(t("turnUser")) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text))
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(value = credential, onValueChange = { credential = it; error = null }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, label = { Text(t("turnCredential")) }, visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
        Text(t("turnSecureNote"), style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.padding(top = 8.dp))
        if (saved) Text(t("turnConfigured"), color = c.muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
        Spacer(Modifier.height(18.dp))
        Button(modifier = Modifier.fillMaxWidth(), onClick = {
            try {
                val list = urls.lines().flatMap { it.split(',') }.map { it.trim() }.filter { it.isNotEmpty() }.distinct()
                if (list.any { !it.startsWith("turn:") && !it.startsWith("turns:") }) throw IllegalArgumentException(t("turnInvalidUrl"))
                if (list.isNotEmpty() && (username.isBlank() || credential.isBlank())) throw IllegalArgumentException(t("turnNeedCredentials"))
                if (list.isEmpty() && (username.isNotBlank() || credential.isNotBlank())) throw IllegalArgumentException(t("turnNeedUrls"))
                TurnConfigStore.save(ctx, TurnConfig(list, username.trim(), credential))
                saved = list.isNotEmpty(); error = null
                android.widget.Toast.makeText(ctx, t("turnSaved"), android.widget.Toast.LENGTH_SHORT).show()
            } catch (e: Exception) { error = e.message ?: t("turnSaveFailed") }
        }) { Text(t("save")) }
        if (saved) {
            Spacer(Modifier.height(8.dp))
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                TurnConfigStore.clear(ctx); urls = ""; username = ""; credential = ""; saved = false
                android.widget.Toast.makeText(ctx, t("turnRemoved"), android.widget.Toast.LENGTH_SHORT).show()
            }) { Text(t("turnRemove")) }
        }
        Spacer(Modifier.height(12.dp))
        Text(t("turnAppliesNextCall"), style = MaterialTheme.typography.bodySmall, color = c.muted)
    }
}
