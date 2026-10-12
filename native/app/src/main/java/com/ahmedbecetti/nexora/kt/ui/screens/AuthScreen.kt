package com.ahmedbecetti.nexora.kt.ui.screens

import com.ahmedbecetti.nexora.kt.ui.GradientWordmark
import com.ahmedbecetti.nexora.kt.ui.IconBtn
import com.ahmedbecetti.nexora.kt.ui.mirrorIfRtl
import androidx.compose.runtime.remember
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.items

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
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
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.Wordmark
import com.ahmedbecetti.nexora.kt.ui.noRippleClick
import com.ahmedbecetti.nexora.kt.ui.theme.Blue
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import com.ahmedbecetti.nexora.kt.ui.theme.Red
import kotlinx.coroutines.launch

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun AuthScreen() {
    val app = LocalApp.current
    var mode by rememberSaveable { mutableStateOf(if (app.authStart == null && app.accounts.isNotEmpty()) "saved" else app.authStart ?: "login") }
    var prefill by rememberSaveable { mutableStateOf(app.accounts.firstOrNull()?.takeIf { it.token == null && app.accounts.size == 1 }?.username ?: "") }
    var pending by remember { mutableStateOf<org.json.JSONObject?>(null) }
    var langSheet by remember { mutableStateOf(false) }
    val c = Nx.c
    if (mode == "saved") {
        SavedProfilesScreen(onUseAnother = { u -> prefill = u ?: ""; mode = "login" }, onCreate = { mode = "signup" })
        return
    }
    if (pending != null) {
        CompleteProfileForm(pending!!, onCancel = { pending = null })
        return
    }
    androidx.activity.compose.BackHandler(enabled = mode != "login" || app.accounts.isNotEmpty()) {
        mode = if (mode == "login" && app.accounts.isNotEmpty()) "saved" else "login"
    }
    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding().imePadding()) {
        Box(Modifier.fillMaxWidth().height(52.dp)) {
            if (mode == "login") Row(Modifier.align(Alignment.Center).noRippleClick { langSheet = true }, verticalAlignment = Alignment.CenterVertically) {
                Text(I18n.languages.firstOrNull { it.first == I18n.lang }?.second ?: I18n.lang, color = c.muted, fontSize = 15.sp)
                Icon(NxIcons.Down, null, tint = c.muted, modifier = Modifier.padding(start = 4.dp).size(16.dp))
            } else IconBtn(NxIcons.Back, { mode = "login" }, size = 26.dp, modifier = Modifier.align(Alignment.CenterStart).padding(start = 8.dp))
        }
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            when (mode) {
                "login" -> {
                    Spacer(Modifier.height(64.dp))
                    GradientWordmark(size = 62.sp)
                    Spacer(Modifier.height(44.dp))
                    LoginForm(prefill, onForgot = { mode = "forgot" }, onPending = { pending = it })
                }
                "signup" -> SignupForm(onPending = { pending = it })
                else -> { Spacer(Modifier.height(24.dp)); ForgotForm(onBack = { mode = "login" }) }
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 20.dp), horizontalArrangement = Arrangement.Center) {
            if (mode == "signup") {
                Text(t("haveAccount") + " ", color = c.muted, fontSize = 15.sp)
                Text(t("loginLink"), color = Blue, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, modifier = Modifier.noRippleClick { mode = "login" })
            } else {
                Text(t("noAccount") + " ", color = c.muted, fontSize = 15.sp)
                Text(t("createNew"), color = Blue, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, modifier = Modifier.noRippleClick { mode = "signup" })
            }
        }
    }
    if (langSheet) androidx.compose.material3.ModalBottomSheet(onDismissRequest = { langSheet = false }, containerColor = c.elevated) {
        androidx.compose.foundation.lazy.LazyColumn(Modifier.fillMaxWidth().fillMaxSize(0.8f)) {
            items(I18n.languages, key = { it.first }) { (code, native, english) ->
                Row(Modifier.fillMaxWidth().clickable { app.setLanguage(code); langSheet = false }.padding(horizontal = 20.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(native, color = c.text, fontSize = 16.sp)
                        Text(english, color = c.muted, fontSize = 13.sp)
                    }
                    if (code == I18n.lang) Icon(NxIcons.Check, null, tint = Blue, modifier = Modifier.size(22.dp))
                }
            }
        }
    }
}

@Composable
fun AuthField(
    value: String, onChange: (String) -> Unit, placeholder: String, password: Boolean = false,
    keyboard: KeyboardType = KeyboardType.Text, ime: ImeAction = ImeAction.Next,
) {
    val c = Nx.c
    var show by rememberSaveable { mutableStateOf(false) }
    Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp).height(56.dp).clip(RoundedCornerShape(12.dp))
            .background(if (c.dark) c.surface else androidx.compose.ui.graphics.Color(0xFFFAFAFA))
            .border(1.dp, c.border, RoundedCornerShape(12.dp)).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Text(placeholder, color = c.muted, fontSize = 15.sp, maxLines = 1)
            BasicTextField(
                value, onChange, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 16.sp),
                cursorBrush = SolidColor(c.text),
                visualTransformation = if (password && !show) PasswordVisualTransformation() else VisualTransformation.None,
                keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboard, imeAction = ime),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (password) Icon(if (show) NxIcons.Eye else NxIcons.EyeOff, null, tint = c.muted,
            modifier = Modifier.padding(start = 8.dp).size(22.dp).noRippleClick { show = !show })
    }
}

@Composable
private fun ErrorText(err: String?) {
    if (err != null) Text(err, color = Red, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp))
}

@Composable
private fun LoginForm(prefill: String, onForgot: () -> Unit, onPending: (org.json.JSONObject) -> Unit) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var id by rememberSaveable(prefill) { mutableStateOf(prefill) }
    var pw by rememberSaveable { mutableStateOf("") }
    var busy by rememberSaveable { mutableStateOf(false) }
    var err by rememberSaveable { mutableStateOf<String?>(null) }
    AuthField(id, { id = it; err = null }, t("loginId"), keyboard = KeyboardType.Email)
    AuthField(pw, { pw = it; err = null }, t("password"), password = true, ime = ImeAction.Done)
    Spacer(Modifier.height(14.dp))
    NxButton(t("login"), onClick = {
        busy = true; err = null
        scope.launch {
            try {
                val r = Api.post("auth/login", json("identifier" to id.trim(), "password" to pw))
                app.onLoggedIn(r.getString("token"), User.from(r.optJSONObject("user")))
            } catch (e: ApiException) { err = I18n.err(e.code) } finally { busy = false }
        }
    }, enabled = id.isNotBlank() && pw.length >= 6, loading = busy, modifier = Modifier.fillMaxWidth(), height = 54.dp, radius = 14.dp, fontSize = 17.sp)
    ErrorText(err)
    Spacer(Modifier.height(26.dp))
    OrDivider()
    GoogleButton(onPending)
    Spacer(Modifier.height(22.dp))
    Text(t("forgot"), color = Blue, fontWeight = FontWeight.Medium, fontSize = 15.sp, modifier = Modifier.noRippleClick(onForgot))
}

@Composable
private fun SignupForm(onPending: (org.json.JSONObject) -> Unit) {
    val app = LocalApp.current
    val c = Nx.c
    val scope = rememberCoroutineScope()
    var email by rememberSaveable { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var user by rememberSaveable { mutableStateOf("") }
    var pw by rememberSaveable { mutableStateOf("") }
    var busy by rememberSaveable { mutableStateOf(false) }
    var err by rememberSaveable { mutableStateOf<String?>(null) }
    var terms by remember { mutableStateOf(false) }
    Spacer(Modifier.height(10.dp))
    Text(t("createAccount"), color = c.text, fontSize = 30.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
    Text(t("createSub"), color = c.muted, fontSize = 15.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 10.dp, bottom = 26.dp))
    AuthField(name, { name = it; err = null }, t("fullName"))
    AuthField(user, { user = it.lowercase().replace(" ", ""); err = null }, t("username"))
    AuthField(email, { email = it; err = null }, t("email"), keyboard = KeyboardType.Email)
    AuthField(pw, { pw = it; err = null }, t("password"), password = true, ime = ImeAction.Done)
    Spacer(Modifier.height(14.dp))
    NxButton(t("next"), onClick = {
        busy = true; err = null
        scope.launch {
            try {
                val r = Api.post("auth/register", json("fullName" to name.trim(), "username" to user.trim(), "email" to email.trim(), "password" to pw))
                app.onLoggedIn(r.getString("token"), User.from(r.optJSONObject("user")))
            } catch (e: ApiException) { err = I18n.err(e.code) } finally { busy = false }
        }
    }, enabled = email.isNotBlank() && name.isNotBlank() && user.isNotBlank() && pw.length >= 6, loading = busy,
        modifier = Modifier.fillMaxWidth(), height = 54.dp, radius = 14.dp, fontSize = 17.sp)
    ErrorText(err)
    OrDivider()
    GoogleButton(onPending)
    Text(t("termsShort"), color = c.muted, fontSize = 12.sp, textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 16.dp).noRippleClick { terms = true })
    if (terms) androidx.compose.material3.AlertDialog(
        onDismissRequest = { terms = false }, containerColor = c.elevated,
        title = { Text(t("termsOfUse"), fontWeight = FontWeight.SemiBold, color = c.text) },
        text = { Text(t("termsText"), color = c.muted, fontSize = 14.sp) },
        confirmButton = { androidx.compose.material3.TextButton(onClick = { terms = false }) { Text("OK", color = Blue) } },
    )
}

@Composable
private fun ForgotForm(onBack: () -> Unit) {
    val c = Nx.c
    val scope = rememberCoroutineScope()
    var id by rememberSaveable { mutableStateOf("") }
    var busy by rememberSaveable { mutableStateOf(false) }
    var err by rememberSaveable { mutableStateOf<String?>(null) }
    var sent by rememberSaveable { mutableStateOf<String?>(null) }
    Box(Modifier.size(84.dp).border(2.dp, c.text, androidx.compose.foundation.shape.CircleShape), contentAlignment = Alignment.Center) {
        Icon(NxIcons.Lock, null, tint = c.text, modifier = Modifier.size(40.dp))
    }
    Text(t("troubleLogin"), color = c.text, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(vertical = 12.dp))
    if (sent != null) {
        Text(t("resetSent", "e" to sent!!), color = c.muted, fontSize = 14.sp, textAlign = TextAlign.Center)
    } else {
        AuthField(id, { id = it; err = null }, t("loginIdShort"), keyboard = KeyboardType.Email, ime = ImeAction.Done)
        Spacer(Modifier.height(12.dp))
        NxButton(t("sendLoginLink"), onClick = {
            busy = true
            scope.launch {
                try { sent = Api.post("auth/reset", json("identifier" to id.trim())).optString("sentTo") }
                catch (e: ApiException) { err = I18n.err(e.code) } finally { busy = false }
            }
        }, enabled = id.isNotBlank(), loading = busy, modifier = Modifier.fillMaxWidth(), height = 54.dp, radius = 14.dp, fontSize = 17.sp)
        ErrorText(err)
    }
    Spacer(Modifier.height(18.dp))
    Text(t("backToLogin"), color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.noRippleClick(onBack))
}


@Composable
private fun OrDivider() {
    val c = Nx.c
    Row(Modifier.fillMaxWidth().padding(vertical = 22.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f).height(1.dp).background(c.border))
        Text(t("or").lowercase().replaceFirstChar { it.uppercase() }, color = c.muted, fontSize = 14.sp, modifier = Modifier.padding(horizontal = 18.dp))
        Box(Modifier.weight(1f).height(1.dp).background(c.border))
    }
}

/** "Continue with Google" — native Credential Manager → server `auth/google` (same as 2.6). */
@Composable
private fun GoogleButton(onPending: (org.json.JSONObject) -> Unit) {
    val app = LocalApp.current
    val ctx = androidx.compose.ui.platform.LocalContext.current
    var busy by remember { mutableStateOf(false) }
    Row(Modifier.noRippleClick {
        if (busy) return@noRippleClick
        busy = true
        app.scope.launch {
            try {
                val idToken = com.ahmedbecetti.nexora.kt.data.GoogleAuth.idToken(ctx)
                val r = Api.post("auth/google", json("idToken" to idToken))
                if (r.optBoolean("needsProfile")) onPending(r)
                else app.onLoggedIn(r.getString("token"), User.from(r.optJSONObject("user")))
            } catch (_: com.ahmedbecetti.nexora.kt.data.GoogleAuth.Cancelled) {
            } catch (e: ApiException) { com.ahmedbecetti.nexora.kt.ui.toast(ctx, I18n.err(e.code))
            } catch (e: Exception) { com.ahmedbecetti.nexora.kt.ui.toast(ctx, I18n.err("google_failed")) } finally { busy = false }
        }
    }, verticalAlignment = Alignment.CenterVertically) {
        if (busy) androidx.compose.material3.CircularProgressIndicator(color = Blue, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
        else GoogleG(Modifier.size(24.dp))
        Text(t("continueGoogle"), color = Blue, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, modifier = Modifier.padding(start = 12.dp))
    }
}

/** Google "G" logo drawn with the four brand colours. */
@Composable
private fun GoogleG(modifier: Modifier) {
    androidx.compose.foundation.Canvas(modifier) {
        val sw = size.minDimension * 0.2f
        val inset = sw / 2
        val tl = androidx.compose.ui.geometry.Offset(inset, inset)
        val sz = androidx.compose.ui.geometry.Size(size.width - sw, size.height - sw)
        val st = androidx.compose.ui.graphics.drawscope.Stroke(width = sw)
        drawArc(androidx.compose.ui.graphics.Color(0xFFEA4335), 200f, 120f, false, tl, sz, style = st)
        drawArc(androidx.compose.ui.graphics.Color(0xFFFBBC05), 140f, 60f, false, tl, sz, style = st)
        drawArc(androidx.compose.ui.graphics.Color(0xFF34A853), 50f, 90f, false, tl, sz, style = st)
        drawArc(androidx.compose.ui.graphics.Color(0xFF4285F4), -10f, 60f, false, tl, sz, style = st)
        drawRect(androidx.compose.ui.graphics.Color(0xFF4285F4), androidx.compose.ui.geometry.Offset(size.width / 2, size.height / 2 - sw / 2),
            androidx.compose.ui.geometry.Size(size.width / 2 - inset / 2, sw))
    }
}

/** First Google sign-in: choose name + username (server `auth/complete`). */
@Composable
private fun CompleteProfileForm(r: org.json.JSONObject, onCancel: () -> Unit) {
    val app = LocalApp.current
    val c = Nx.c
    val sug = r.optJSONObject("suggested") ?: org.json.JSONObject()
    var name by rememberSaveable { mutableStateOf(sug.optString("fullName")) }
    var user by rememberSaveable { mutableStateOf(sug.optString("username")) }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }
    androidx.activity.compose.BackHandler(onBack = onCancel)
    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.fillMaxWidth().height(52.dp)) { IconBtn(NxIcons.Back, onCancel, size = 26.dp, modifier = Modifier.align(Alignment.CenterStart)) }
        Text(t("createAccount"), color = c.text, fontSize = 30.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
        Text(sug.optString("email"), color = c.muted, fontSize = 15.sp, modifier = Modifier.padding(top = 8.dp, bottom = 24.dp))
        AuthField(name, { name = it; err = null }, t("fullName"))
        AuthField(user, { user = it.lowercase().replace(" ", ""); err = null }, t("username"), ime = ImeAction.Done)
        Spacer(Modifier.height(14.dp))
        NxButton(t("next"), onClick = {
            busy = true
            app.scope.launch {
                try {
                    val res = Api.post("auth/complete", json("pending" to r.optString("pending"), "fullName" to name.trim(), "username" to user.trim()))
                    app.onLoggedIn(res.getString("token"), User.from(res.optJSONObject("user")))
                } catch (e: ApiException) { err = I18n.err(e.code) } finally { busy = false }
            }
        }, enabled = name.isNotBlank() && user.isNotBlank(), loading = busy, modifier = Modifier.fillMaxWidth(), height = 54.dp, radius = 14.dp, fontSize = 17.sp)
        ErrorText(err)
    }
}
