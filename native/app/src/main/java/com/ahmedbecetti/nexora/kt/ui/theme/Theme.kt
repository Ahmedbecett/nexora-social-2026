package com.ahmedbecetti.nexora.kt.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.ahmedbecetti.nexora.kt.R

@Immutable
data class NxColors(
    val dark: Boolean,
    val bg: Color,
    val surface: Color,
    val elevated: Color,
    val text: Color,
    val muted: Color,
    val border: Color,
    val sep: Color,
    val input: Color,
    val btn: Color,
    val bubbleOther: Color,
)

val Blue = Color(0xFF0095F6)
val BlueDark = Color(0xFF1877F2)
val Red = Color(0xFFED4956)
val Like = Color(0xFFFF3040)
val StoryGradient = Brush.linearGradient(listOf(Color(0xFFFEDA75), Color(0xFFFA7E1E), Color(0xFFD62976), Color(0xFF962FBF), Color(0xFF4F5BD5)),
    start = androidx.compose.ui.geometry.Offset(0f, Float.POSITIVE_INFINITY), end = androidx.compose.ui.geometry.Offset(Float.POSITIVE_INFINITY, 0f))
val CloseFriendsGreen = Color(0xFF1FD166)
val ChatGradient = Brush.verticalGradient(listOf(Color(0xFF8A3AB9), Color(0xFF4C5FD7), Color(0xFF3797F0)))

val LightColors = NxColors(false, Color.White, Color.White, Color.White, Color(0xFF0C0C0C), Color(0xFF737373), Color(0xFFDBDBDB),
    Color(0xFFEFEFEF), Color(0xFFEFEFEF), Color(0xFFEFEFEF), Color(0xFFEFEFEF))
val DarkColors = NxColors(true, Color(0xFF0C1014), Color(0xFF1C2126), Color(0xFF262A2F), Color(0xFFF5F5F5), Color(0xFFA8A8A8),
    Color(0xFF363A3F), Color(0xFF25292E), Color(0xFF25292E), Color(0xFF25292E), Color(0xFF25292E))

val LocalNx = staticCompositionLocalOf { LightColors }

val GrandHotel = FontFamily(Font(R.font.grand_hotel))

object Nx {
    val c: NxColors @Composable get() = LocalNx.current
}

@Composable
fun NexoraTheme(mode: String, content: @Composable () -> Unit) {
    val dark = when (mode) { "dark" -> true; "light" -> false; else -> isSystemInDarkTheme() }
    val c = if (dark) DarkColors else LightColors
    val scheme = if (dark) darkColorScheme(primary = Blue, background = c.bg, surface = c.surface, onBackground = c.text, onSurface = c.text,
        surfaceContainerLow = c.surface, surfaceContainer = c.surface, surfaceContainerHigh = c.elevated, outline = c.border, surfaceContainerHighest = c.btn, surfaceContainerLowest = c.bg, surfaceVariant = c.btn, onSurfaceVariant = c.muted,
        secondary = c.muted, onSecondary = c.bg, secondaryContainer = c.btn, onSecondaryContainer = c.text, tertiary = Blue,
        primaryContainer = Blue, onPrimaryContainer = Color.White, onPrimary = Color.White, surfaceTint = Color.Transparent,
        outlineVariant = c.sep, error = Red)
    else lightColorScheme(primary = Blue, background = c.bg, surface = c.surface, onBackground = c.text, onSurface = c.text,
        surfaceContainerLow = c.surface, surfaceContainer = c.surface, surfaceContainerHigh = c.elevated, outline = c.border, surfaceContainerHighest = c.btn, surfaceContainerLowest = c.bg, surfaceVariant = c.btn, onSurfaceVariant = c.muted,
        secondary = c.muted, onSecondary = c.bg, secondaryContainer = c.btn, onSecondaryContainer = c.text, tertiary = Blue,
        primaryContainer = Blue, onPrimaryContainer = Color.White, onPrimary = Color.White, surfaceTint = Color.Transparent,
        outlineVariant = c.sep, error = Red)
    val typo = MaterialTheme.typography.let { t ->
        t.copy(bodyLarge = t.bodyLarge.copy(fontSize = 15.sp, letterSpacing = 0.sp), bodyMedium = t.bodyMedium.copy(fontSize = 14.sp, letterSpacing = 0.sp))
    }
    CompositionLocalProvider(LocalNx provides c) {
        MaterialTheme(colorScheme = scheme, typography = typo, content = content)
    }
}

val Bold = FontWeight.SemiBold
fun TextStyle.semi() = copy(fontWeight = FontWeight.SemiBold)
