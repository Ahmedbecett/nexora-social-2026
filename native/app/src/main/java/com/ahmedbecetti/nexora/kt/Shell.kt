package com.ahmedbecetti.nexora.kt

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import com.ahmedbecetti.nexora.kt.ui.AvatarImage
import com.ahmedbecetti.nexora.kt.ui.NxIcons
import com.ahmedbecetti.nexora.kt.ui.NxIcons2
import com.ahmedbecetti.nexora.kt.ui.noRippleClick
import com.ahmedbecetti.nexora.kt.ui.screens.*
import com.ahmedbecetti.nexora.kt.ui.theme.Nx
import com.ahmedbecetti.nexora.kt.ui.theme.Red

@Composable
fun NexoraApp() {
    val app = LocalApp.current
    val c = Nx.c
    when {
        app.booting -> Splash()
        app.me == null -> AuthScreen()
        else -> MainShell()
    }
    // status-bar icon colour: Reels and the story viewer are always dark
    val view = LocalView.current
    val top = app.stack.lastOrNull()
    val darkSurface = app.me != null && ((top == null && app.tab == Tab.Reels) || top is Route.Stories || top is Route.ReelsAt)
    SideEffect {
        val w = (view.context as? Activity)?.window ?: return@SideEffect
        WindowCompat.getInsetsController(w, view).isAppearanceLightStatusBars = !c.dark && !darkSurface
        WindowCompat.getInsetsController(w, view).isAppearanceLightNavigationBars = !c.dark && !darkSurface
    }
}

@Composable
fun Splash() {
    Box(Modifier.fillMaxSize().background(Color.White), contentAlignment = Alignment.Center) {
        Image(painterResource(R.mipmap.ic_launcher_foreground), null, modifier = Modifier.size(180.dp))
    }
}

@Composable
fun MainShell() {
    val app = LocalApp.current
    val c = Nx.c
    val holder = rememberSaveableStateHolder()
    val visited = remember { mutableStateMapOf(Tab.Home to true) }
    LaunchedEffect(app.tab) { visited[app.tab] = true }

    BackHandler(enabled = app.stack.isNotEmpty() || app.tab != Tab.Home) {
        if (!app.pop()) app.tab = Tab.Home
    }

    Box(Modifier.fillMaxSize().background(c.bg)) {
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.weight(1f).fillMaxWidth()) {
                // Keep visited tabs alive (scroll position, loaded data) and show only the current one.
                for (t in Tab.entries) if (visited[t] == true) {
                    val shown = t == app.tab
                    Box(Modifier.fillMaxSize().then(if (shown) Modifier else Modifier.offset(x = 100000.dp))) {
                        holder.SaveableStateProvider(t.name) {
                            val active = shown && app.stack.isEmpty()
                            when (t) {
                                Tab.Home -> FeedScreen(active)
                                Tab.Reels -> ReelsTab(active)
                                Tab.Messages -> InboxScreen(active)
                                Tab.Search -> SearchScreen(active)
                                Tab.Profile -> ProfileScreen(app.me!!.username, isTab = true, active = active)
                            }
                        }
                    }
                }
            }
            BottomNav()
        }
        // pushed screens stack over the tabs; only the top one is "active"
        app.stack.forEachIndexed { i, r ->
            val isTop = i == app.stack.lastIndex
            val full = r is Route.Chat || r is Route.Stories || r is Route.ReelsAt
            Column(Modifier.fillMaxSize().background(c.bg).noRippleClick {}) {
                Box(Modifier.weight(1f).fillMaxWidth()) { RouteScreen(r, isTop) }
                if (!full) BottomNav()
            }
        }
    }
}

@Composable
fun RouteScreen(r: Route, active: Boolean) {
    when (r) {
        is Route.Profile -> ProfileScreen(r.username, isTab = false, active = active)
        is Route.PostDetail -> PostDetailScreen(r.id, r.initial, active)
        is Route.ReelsAt -> ReelsViewer(r.posts, r.start, active)
        is Route.FollowList -> FollowListScreen(r.username, r.kind)
        is Route.Likes -> LikesScreen(r.postId)
        Route.Notifications -> NotificationsScreen()
        Route.FollowRequests -> FollowRequestsScreen()
        Route.Settings -> SettingsScreen()
        Route.EditProfile -> EditProfileScreen()
        Route.Language -> LanguageScreen()
        Route.Saved -> SavedScreen()
        is Route.Chat -> ChatScreen(r.user, active)
        is Route.Stories -> StoryViewer(r.groups, r.start, active)
        is Route.Tag -> TagScreen(r.tag)
    }
}

@Composable
fun BottomNav() {
    val app = LocalApp.current
    val c = Nx.c
    val reels = app.tab == Tab.Reels && app.stack.isEmpty()
    val bg = if (reels) Color.Black else c.bg
    val fg = if (reels) Color.White else c.text
    Column(Modifier.fillMaxWidth().background(bg).navigationBarsPadding()) {
        if (!reels) Box(Modifier.fillMaxWidth().height(0.5.dp).background(c.sep))
        Row(Modifier.fillMaxWidth().height(50.dp), verticalAlignment = Alignment.CenterVertically) {
            for (t in Tab.entries) {
                val sel = app.tab == t
                Box(Modifier.weight(1f).height(50.dp).noRippleClick { app.selectTab(t) }, contentAlignment = Alignment.Center) {
                    when (t) {
                        Tab.Home -> Icon(if (sel) NxIcons.HomeFill else NxIcons.Home, t.name, tint = fg, modifier = Modifier.size(26.dp))
                        Tab.Reels -> Icon(if (sel) NxIcons.ReelsFill else NxIcons.Reels, t.name, tint = fg, modifier = Modifier.size(26.dp))
                        Tab.Messages -> Box {
                            Icon(if (sel) NxIcons.SendFill else NxIcons.Send, t.name, tint = fg, modifier = Modifier.size(26.dp))
                            if (app.msgBadge > 0) Box(
                                Modifier.align(Alignment.TopEnd).offset(x = 8.dp, y = (-6).dp).sizeIn(minWidth = 18.dp, minHeight = 18.dp)
                                    .clip(CircleShape).background(Red).border(2.dp, bg, CircleShape).padding(horizontal = 4.dp),
                                contentAlignment = Alignment.Center,
                            ) { Text(if (app.msgBadge > 9) "9+" else "${app.msgBadge}", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                        }
                        Tab.Search -> Icon(NxIcons.Search, t.name, tint = fg, modifier = Modifier.size(if (sel) 27.dp else 25.dp))
                        Tab.Profile -> Box(
                            Modifier.size(30.dp).then(if (sel) Modifier.border(2.dp, fg, CircleShape) else Modifier).padding(if (sel) 3.dp else 2.dp),
                            contentAlignment = Alignment.Center,
                        ) { AvatarImage(app.me?.avatarUrl, if (sel) 24.dp else 26.dp) }
                    }
                }
            }
        }
    }
}

