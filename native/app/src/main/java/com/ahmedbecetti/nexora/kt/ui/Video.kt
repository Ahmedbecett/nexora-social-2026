package com.ahmedbecetti.nexora.kt.ui

import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import kotlinx.coroutines.delay

/**
 * Native video surface (ExoPlayer). The player only exists while this composable is on screen;
 * [playing] toggles playback, [muted] the volume.
 */
@OptIn(UnstableApi::class)
@Composable
fun VideoPlayer(
    url: String,
    poster: String?,
    playing: Boolean,
    muted: Boolean,
    modifier: Modifier = Modifier,
    fill: Boolean = true,
    loop: Boolean = true,
    onEnded: (() -> Unit)? = null,
    onProgress: ((Long, Long) -> Unit)? = null,
    onError: (() -> Unit)? = null,
) {
    val ctx = LocalContext.current
    var firstFrame by remember(url) { mutableStateOf(false) }
    val ended by rememberUpdatedState(onEnded)
    val failed by rememberUpdatedState(onError)
    val player = remember(url) {
        val http = androidx.media3.datasource.DefaultHttpDataSource.Factory()
            .setUserAgent(com.ahmedbecetti.nexora.kt.data.Api.USER_AGENT)
            .setAllowCrossProtocolRedirects(true)
        val ds = androidx.media3.datasource.DefaultDataSource.Factory(ctx, http)
        ExoPlayer.Builder(ctx)
            .setMediaSourceFactory(androidx.media3.exoplayer.source.DefaultMediaSourceFactory(ds))
            .build().apply {
            setMediaItem(MediaItem.fromUri(url))
            repeatMode = if (loop) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
            prepare()
        }
    }
    DisposableEffect(player) {
        val l = object : Player.Listener {
            override fun onRenderedFirstFrame() { firstFrame = true }
            override fun onPlaybackStateChanged(state: Int) { if (state == Player.STATE_ENDED) ended?.invoke() }
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) { failed?.invoke() }
        }
        player.addListener(l)
        onDispose { player.removeListener(l); player.release() }
    }
    LaunchedEffect(player, playing) { player.playWhenReady = playing }
    LaunchedEffect(player, muted) { player.volume = if (muted) 0f else 1f }
    if (onProgress != null) LaunchedEffect(player, playing) {
        while (playing) { onProgress(player.currentPosition, player.duration.coerceAtLeast(0)); delay(100) }
    }
    Box(modifier) {
        AndroidView(
            factory = { c ->
                PlayerView(c).apply {
                    useController = false
                    layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                    setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
                    resizeMode = if (fill) AspectRatioFrameLayout.RESIZE_MODE_ZOOM else AspectRatioFrameLayout.RESIZE_MODE_FIT
                    this.player = player
                }
            },
            update = { it.player = player; it.resizeMode = if (fill) AspectRatioFrameLayout.RESIZE_MODE_ZOOM else AspectRatioFrameLayout.RESIZE_MODE_FIT },
            modifier = Modifier.fillMaxSize(),
        )
        if (!firstFrame && poster != null) AsyncImage(poster, null, contentScale = if (fill) ContentScale.Crop else ContentScale.Fit, modifier = Modifier.fillMaxSize())
    }
}
