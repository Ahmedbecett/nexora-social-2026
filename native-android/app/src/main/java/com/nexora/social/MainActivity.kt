package com.nexora.social

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddBox
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.PersonOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.io.IOException

private val Ink = Color(0xFF101018)
private val Muted = Color(0xFF777785)
private val Violet = Color(0xFF7657FF)
private val Pink = Color(0xFFFF4D9D)
private val Page = Color(0xFFF8F8FC)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = Page) {
                    NexoraRoot()
                }
            }
        }
    }
}

private enum class Destination(val title: String) {
    Home("الرئيسية"),
    Explore("استكشاف"),
    Create("إنشاء"),
    Messages("الرسائل"),
    Profile("حسابي")
}

@Composable
private fun NexoraRoot() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var token by rememberSaveable { mutableStateOf(NexoraApi.savedToken(context)) }
    var loading by rememberSaveable { mutableStateOf(false) }
    var loginError by rememberSaveable { mutableStateOf<String?>(null) }

    if (token.isNullOrBlank()) {
        SignInScreen(
            loading = loading,
            error = loginError,
            onLogin = { identifier, password ->
                if (!loading) {
                    scope.launch {
                        loading = true
                        loginError = null
                        try {
                            val session = NexoraApi.login(identifier, password)
                            NexoraApi.saveSession(context, session.token)
                            token = session.token
                        } catch (e: Exception) {
                            loginError = e.message ?: "حدث خطأ غير متوقع."
                        } finally {
                            loading = false
                        }
                    }
                }
            }
        )
    } else {
        NativeShell(
            token = token!!,
            onSignOut = {
                NexoraApi.clearSession(context)
                token = null
            }
        )
    }
}

@Composable
private fun SignInScreen(
    loading: Boolean,
    error: String?,
    onLogin: (String, String) -> Unit
) {
    var identifier by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    Box(
        modifier = Modifier.fillMaxSize().background(
            Brush.verticalGradient(listOf(Color(0xFFF7F4FF), Color.White, Color(0xFFFFF4FA)))
        ).padding(horizontal = 26.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier.size(64.dp).background(
                    Brush.linearGradient(listOf(Violet, Pink)), RoundedCornerShape(20.dp)
                ),
                contentAlignment = Alignment.Center
            ) {
                Text("N", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.height(22.dp))
            Text("NEXORA", color = Ink, fontSize = 30.sp, fontWeight = FontWeight.Black)
            Text("تواصل مع عالمك.", color = Muted, fontSize = 16.sp)
            Spacer(Modifier.height(30.dp))
            OutlinedTextField(
                value = identifier,
                onValueChange = { identifier = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("اسم المستخدم أو البريد الإلكتروني") },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
                enabled = !loading
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("كلمة المرور") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                shape = RoundedCornerShape(16.dp),
                enabled = !loading
            )
            Spacer(Modifier.height(18.dp))
            Button(
                onClick = { onLogin(identifier, password) },
                enabled = identifier.isNotBlank() && password.isNotBlank() && !loading,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Violet)
            ) {
                if (loading) CircularProgressIndicator(
                    modifier = Modifier.size(22.dp), color = Color.White, strokeWidth = 2.dp
                ) else Text("تسجيل الدخول", fontWeight = FontWeight.Bold)
            }
            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Text(error, color = Color(0xFFB42318), fontSize = 13.sp, lineHeight = 19.sp)
            }
            Spacer(Modifier.height(12.dp))
            Text(
                "تسجيل الدخول يتصل بخادم NEXORA الحقيقي. لا يتم إنشاء حساب أو جلسة تجريبية.",
                color = Muted, fontSize = 12.sp, lineHeight = 18.sp
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NativeShell(token: String, onSignOut: () -> Unit) {
    var selected by rememberSaveable { mutableStateOf(Destination.Home) }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("NEXORA", fontWeight = FontWeight.Black, color = Ink, fontSize = 23.sp) }
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                Destination.values().forEach { destination ->
                    val icon = when (destination) {
                        Destination.Home -> Icons.Default.Home
                        Destination.Explore -> Icons.Default.Explore
                        Destination.Create -> Icons.Default.AddBox
                        Destination.Messages -> Icons.Default.ChatBubbleOutline
                        Destination.Profile -> Icons.Default.PersonOutline
                    }
                    NavigationBarItem(
                        selected = selected == destination,
                        onClick = { selected = destination },
                        icon = { Icon(icon, contentDescription = destination.title) },
                        label = { Text(destination.title, fontSize = 10.sp) }
                    )
                }
            }
        },
        containerColor = Page
    ) { padding ->
        when (selected) {
            Destination.Home -> FeedScreen(token = token, modifier = Modifier.padding(padding))
            Destination.Explore -> EmptyFeatureScreen(
                modifier = Modifier.padding(padding),
                title = "استكشاف",
                detail = "سيتم ربط نتائج الاستكشاف الحقيقية في مرحلة نقل هذه الشاشة."
            )
            Destination.Create -> EmptyFeatureScreen(
                modifier = Modifier.padding(padding),
                title = "إنشاء منشور",
                detail = "رفع الصور والفيديو عبر منتقي الوسائط الأصلي قيد النقل."
            )
            Destination.Messages -> EmptyFeatureScreen(
                modifier = Modifier.padding(padding),
                title = "الرسائل",
                detail = "لن تظهر محادثات وهمية. نظام الرسائل والمكالمات الأصلي لم يُنقل بعد."
            )
            Destination.Profile -> Column(
                modifier = Modifier.padding(padding).fillMaxSize().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("حسابي", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text("تم تسجيل الدخول إلى جلسة NEXORA.", color = Muted)
                Button(onClick = onSignOut) { Text("تسجيل الخروج") }
            }
        }
    }
}

@Composable
private fun FeedScreen(token: String, modifier: Modifier = Modifier) {
    var posts by remember { mutableStateOf<List<NexoraPost>>(emptyList()) }
    var loading by rememberSaveable { mutableStateOf(true) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(token) {
        loading = true
        error = null
        try {
            posts = NexoraApi.feed(token)
        } catch (e: Exception) {
            error = e.message ?: "تعذّر تحميل المنشورات."
        } finally {
            loading = false
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("آخر المنشورات", color = Ink, fontSize = 23.sp, fontWeight = FontWeight.Bold)
        }
        if (loading) {
            item { CircularProgressIndicator(color = Violet) }
        } else if (error != null) {
            item {
                EmptyCard(
                    title = "تعذّر تحميل الخلاصة",
                    detail = error ?: "خطأ غير معروف"
                )
            }
        } else if (posts.isEmpty()) {
            item {
                EmptyCard(
                    title = "لا توجد منشورات بعد",
                    detail = "لم يُرجع الخادم منشورات لحسابك أو الحسابات التي تتابعها."
                )
            }
        } else {
            items(posts, key = { it.id }) { post ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(Modifier.padding(18.dp)) {
                        Text("@${post.username}", color = Violet, fontWeight = FontWeight.Bold)
                        if (post.caption.isNotBlank()) {
                            Spacer(Modifier.height(8.dp))
                            Text(post.caption, color = Ink, fontSize = 15.sp, lineHeight = 22.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyFeatureScreen(modifier: Modifier = Modifier, title: String, detail: String) {
    Box(modifier = modifier.fillMaxSize().padding(20.dp), contentAlignment = Alignment.TopCenter) {
        EmptyCard(title = title, detail = detail)
    }
}

@Composable
private fun EmptyCard(title: String, detail: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(22.dp)) {
            Box(
                modifier = Modifier.size(44.dp).background(
                    Brush.linearGradient(listOf(Violet, Pink)), CircleShape
                ),
                contentAlignment = Alignment.Center
            ) {
                Text("N", color = Color.White, fontWeight = FontWeight.Black, fontSize = 23.sp)
            }
            Spacer(Modifier.height(16.dp))
            Text(title, color = Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(detail, color = Muted, fontSize = 14.sp, lineHeight = 21.sp)
        }
    }
}
