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
import com.ahmedbecetti.nexora.kt.ui.rememberMediaPicker
import com.ahmedbecetti.nexora.kt.data.t
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
            val full = r is Route.Chat || r is Route.Stories || r is Route.ReelsAt || r is Route.Inbox || r is Route.Create || r is Route.NewHighlight
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
        is Route.SettingsPage -> SettingsPage(r.key)
        Route.Inbox -> InboxScreen(active)
        Route.Discover -> UserListScreen(t("suggested"), "suggestions", t("noFollowersYet"))
        Route.NewHighlight -> NewHighlightScreen()
        is Route.Create -> CreateScreen(r.uris, r.reel)
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
    val pick = rememberMediaPicker(multi = true) { uris -> app.push(Route.Create(uris, reel = false)) }
    Column(Modifier.fillMaxWidth().background(bg).navigationBarsPadding()) {
        if (!reels) Box(Modifier.fillMaxWidth().height(0.5.dp).background(c.sep))
        Row(Modifier.fillMaxWidth().height(52.dp), verticalAlignment = Alignment.CenterVertically) {
            @Composable
            fun Item(content: @Composable () -> Unit, onClick: () -> Unit) =
                Box(Modifier.weight(1f).height(52.dp).noRippleClick(onClick), contentAlignment = Alignment.Center) { content() }
            val top = app.stack.isEmpty()
            Item({ Icon(if (app.tab == Tab.Home && top) NxIcons.HomeFill else NxIcons.Home, "home", tint = fg, modifier = Modifier.size(27.dp)) }) { app.selectTab(Tab.Home) }
            Item({ Icon(if (app.tab == Tab.Search && top) NxIcons.SearchBold else NxIcons.Search, "search", tint = fg, modifier = Modifier.size(26.dp)) }) { app.selectTab(Tab.Search) }
            Item({ Icon(NxIcons.PlusSquare, "create", tint = fg, modifier = Modifier.size(27.dp)) }) { pick() }
            Item({ Icon(if (app.tab == Tab.Reels && top) NxIcons.ReelsFill else NxIcons.Reels, "reels", tint = fg, modifier = Modifier.size(27.dp)) }) { app.selectTab(Tab.Reels) }
            Item({ Icon(if (app.tab == Tab.Profile && top) NxIcons.UserFill else NxIcons.User, "profile", tint = fg, modifier = Modifier.size(27.dp)) }) { app.selectTab(Tab.Profile) }
        }
    }
}
