package com.ahmedbecetti.nexora.kt.ui.screens

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

@Composable
fun AuthScreen() {
    var mode by rememberSaveable { mutableStateOf("login") }
    val c = Nx.c
    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding().imePadding()) {
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(56.dp))
            Wordmark(size = 54.sp)
            Spacer(Modifier.height(28.dp))
            when (mode) {
                "login" -> LoginForm(onForgot = { mode = "forgot" })
                "signup" -> SignupForm()
                else -> ForgotForm(onBack = { mode = "login" })
            }
        }
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(c.border))
        Row(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalArrangement = Arrangement.Center) {
            if (mode == "signup") {
                Text(t("haveAccount") + " ", color = c.muted, fontSize = 14.sp)
                Text(t("loginLink"), color = Blue, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.noRippleClick { mode = "login" })
            } else {
                Text(t("noAccount") + " ", color = c.muted, fontSize = 14.sp)
                Text(t("createNew"), color = Blue, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.noRippleClick { mode = "signup" })
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
        Modifier.fillMaxWidth().padding(vertical = 4.dp).height(52.dp).clip(RoundedCornerShape(10.dp))
            .background(if (c.dark) c.surface else androidx.compose.ui.graphics.Color(0xFFFAFAFA))
            .border(1.dp, c.border, RoundedCornerShape(10.dp)).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Text(placeholder, color = c.muted, fontSize = 14.sp, maxLines = 1)
            BasicTextField(
                value, onChange, singleLine = true, textStyle = TextStyle(color = c.text, fontSize = 15.sp),
                cursorBrush = SolidColor(c.text),
                visualTransformation = if (password && !show) PasswordVisualTransformation() else VisualTransformation.None,
                keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboard, imeAction = ime),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (password && value.isNotEmpty()) Icon(if (show) NxIcons.EyeOff else NxIcons.Eye, null, tint = c.text,
            modifier = Modifier.size(22.dp).noRippleClick { show = !show })
    }
}

@Composable
private fun ErrorText(err: String?) {
    if (err != null) Text(err, color = Red, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp))
}

@Composable
private fun LoginForm(onForgot: () -> Unit) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var id by rememberSaveable { mutableStateOf("") }
    var pw by rememberSaveable { mutableStateOf("") }
    var busy by rememberSaveable { mutableStateOf(false) }
    var err by rememberSaveable { mutableStateOf<String?>(null) }
    AuthField(id, { id = it; err = null }, t("loginId"), keyboard = KeyboardType.Email)
    AuthField(pw, { pw = it; err = null }, t("password"), password = true, ime = ImeAction.Done)
    Spacer(Modifier.height(12.dp))
    NxButton(t("login"), onClick = {
        busy = true; err = null
        scope.launch {
            try {
                val r = Api.post("auth/login", json("identifier" to id.trim(), "password" to pw))
                app.onLoggedIn(r.getString("token"), User.from(r.optJSONObject("user")))
            } catch (e: ApiException) { err = I18n.err(e.code) } finally { busy = false }
        }
    }, enabled = id.isNotBlank() && pw.length >= 6, loading = busy, modifier = Modifier.fillMaxWidth(), height = 46.dp, radius = 22.dp)
    ErrorText(err)
    Spacer(Modifier.height(14.dp))
    Text(t("forgot"), color = Nx.c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.noRippleClick(onForgot))
}

@Composable
private fun SignupForm() {
    val app = LocalApp.current
    val c = Nx.c
    val scope = rememberCoroutineScope()
    var email by rememberSaveable { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var user by rememberSaveable { mutableStateOf("") }
    var pw by rememberSaveable { mutableStateOf("") }
    var busy by rememberSaveable { mutableStateOf(false) }
    var err by rememberSaveable { mutableStateOf<String?>(null) }
    Text(t("createSub"), color = c.muted, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 14.dp))
    AuthField(email, { email = it; err = null }, t("email"), keyboard = KeyboardType.Email)
    AuthField(name, { name = it; err = null }, t("fullName"))
    AuthField(user, { user = it.lowercase().replace(" ", ""); err = null }, t("username"))
    AuthField(pw, { pw = it; err = null }, t("password"), password = true, ime = ImeAction.Done)
    Text(t("terms"), color = c.muted, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(vertical = 12.dp))
    NxButton(t("createAccount"), onClick = {
        busy = true; err = null
        scope.launch {
            try {
                val r = Api.post("auth/register", json("fullName" to name.trim(), "username" to user.trim(), "email" to email.trim(), "password" to pw))
                app.onLoggedIn(r.getString("token"), User.from(r.optJSONObject("user")))
            } catch (e: ApiException) { err = I18n.err(e.code) } finally { busy = false }
        }
    }, enabled = email.isNotBlank() && name.isNotBlank() && user.isNotBlank() && pw.length >= 6, loading = busy,
        modifier = Modifier.fillMaxWidth(), height = 46.dp, radius = 22.dp)
    ErrorText(err)
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
        }, enabled = id.isNotBlank(), loading = busy, modifier = Modifier.fillMaxWidth(), height = 46.dp, radius = 22.dp)
        ErrorText(err)
    }
    Spacer(Modifier.height(18.dp))
    Text(t("backToLogin"), color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.noRippleClick(onBack))
}
