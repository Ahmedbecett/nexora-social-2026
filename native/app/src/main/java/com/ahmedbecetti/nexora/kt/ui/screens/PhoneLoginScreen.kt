package com.ahmedbecetti.nexora.kt.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ahmedbecetti.nexora.kt.LocalApp
import com.ahmedbecetti.nexora.kt.data.Api
import com.ahmedbecetti.nexora.kt.data.ApiException
import com.ahmedbecetti.nexora.kt.data.I18n
import com.ahmedbecetti.nexora.kt.data.User
import com.ahmedbecetti.nexora.kt.data.json
import com.ahmedbecetti.nexora.kt.data.t
import com.ahmedbecetti.nexora.kt.ui.NxButton
import com.ahmedbecetti.nexora.kt.ui.theme.Blue
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Phone login uses the existing free, owner-operated SMS gateway API. This never calls Firebase phone auth.
 * The page explicitly reports when SMS_GATEWAY env is not configured; it never pretends a code was sent.
 */
@Composable
fun PhoneLoginScreen(onBack: () -> Unit, onPending: (JSONObject) -> Unit) {
    val app = LocalApp.current
    val c = Nx.c
    val scope = rememberCoroutineScope()
    var configured by remember { mutableStateOf<Boolean?>(null) }
    var phone by rememberSaveable { mutableStateOf("+213") }
    var code by rememberSaveable { mutableStateOf("") }
    var step by rememberSaveable { mutableStateOf("phone") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var cooldown by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        configured = try { Api.get("auth/phone/config").optBoolean("enabled") } catch (_: Exception) { false }
    }
    LaunchedEffect(cooldown) {
        if (cooldown > 0) { delay(1000); cooldown-- }
    }

    Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(t("phoneTitle"), color = c.text, fontSize = 27.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Text(t("phoneSub"), color = c.muted, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 22.dp))
        when (configured) {
            null -> CircularProgressIndicator(Modifier.size(26.dp), color = Blue)
            false -> {
                Text(t("phoneUnavailable"), color = c.muted, fontSize = 14.sp, textAlign = TextAlign.Center)
                Text(t("phoneGatewayHelp"), color = c.muted, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
            }
            true -> if (step == "phone") {
                OutlinedTextField(
                    value = phone, onValueChange = { phone = it.filter { ch -> ch.isDigit() || ch == '+' || ch == ' ' || ch == '-' || ch == '(' || ch == ')' }.take(20); error = null },
                    modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(t("phoneNumber")) }, placeholder = { Text("+213 555 12 34 56") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    supportingText = { Text(t("phoneE164Hint")) },
                )
                Spacer(Modifier.height(12.dp))
                NxButton(t("sendCode"), onClick = {
                    busy = true; error = null
                    scope.launch {
                        try {
                            val normalized = phone.replace(Regex("[\\s()\\-]"), "")
                            Api.post("auth/phone/send", json("phone" to normalized, "lang" to I18n.lang))
                            step = "code"; cooldown = 45
                        } catch (e: ApiException) { error = I18n.err(e.code) }
                        catch (_: Exception) { error = t("phoneSendFailed") }
                        busy = false
                    }
                }, enabled = !busy && phone.startsWith("+") && phone.filter(Char::isDigit).length in 8..15, loading = busy,
                    modifier = Modifier.fillMaxWidth(), height = 52.dp, radius = 14.dp, fontSize = 16.sp)
            } else {
                Text(t("phoneCodeSent", "p" to phone), color = c.muted, fontSize = 14.sp, textAlign = TextAlign.Center)
                OutlinedTextField(
                    value = code, onValueChange = { code = it.filter(Char::isDigit).take(6); error = null },
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp), singleLine = true,
                    label = { Text(t("verificationCode")) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                Spacer(Modifier.height(12.dp))
                NxButton(t("verifyCode"), onClick = {
                    busy = true; error = null
                    scope.launch {
                        try {
                            val r = Api.post("auth/phone/verify", json("phone" to phone.replace(Regex("[\\s()\\-]"), ""), "code" to code))
                            val token = r.optString("token")
                            if (token.isNotBlank()) app.onLoggedIn(token, User.from(r.optJSONObject("user")))
                            else if (r.optBoolean("needsProfile")) onPending(r)
                            else error = t("phoneVerifyFailed")
                        } catch (e: ApiException) { error = I18n.err(e.code) }
                        catch (_: Exception) { error = t("phoneVerifyFailed") }
                        busy = false
                    }
                }, enabled = !busy && code.length == 6, loading = busy, modifier = Modifier.fillMaxWidth(), height = 52.dp, radius = 14.dp, fontSize = 16.sp)
                TextButton(enabled = cooldown == 0 && !busy, onClick = {
                    scope.launch {
                        busy = true
                        try { Api.post("auth/phone/send", json("phone" to phone.replace(Regex("[\\s()\\-]"), ""), "lang" to I18n.lang)); cooldown = 45; error = null }
                        catch (e: ApiException) { error = I18n.err(e.code) }
                        catch (_: Exception) { error = t("phoneSendFailed") }
                        busy = false
                    }
                }) { Text(if (cooldown > 0) t("resendIn", "s" to cooldown) else t("resendCode"), color = Blue) }
                TextButton(onClick = { step = "phone"; code = ""; error = null }) { Text(t("changePhone"), color = c.muted) }
            }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) }
    }
}
