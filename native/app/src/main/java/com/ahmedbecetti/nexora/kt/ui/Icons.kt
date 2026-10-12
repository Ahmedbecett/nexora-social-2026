package com.ahmedbecetti.nexora.kt.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

class P(val d: String, val fill: Boolean, val stroke: Boolean)

fun nxIcon(name: String, sw: Float, vararg paths: P): ImageVector =
    ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).apply {
        for (p in paths) addPath(
            pathData = addPathNodes(p.d),
            pathFillType = PathFillType.EvenOdd,
            fill = if (p.fill) SolidColor(Color.Black) else null,
            stroke = if (p.stroke) SolidColor(Color.Black) else null,
            strokeLineWidth = sw,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
        )
    }.build()

object NxIcons2 {
    val BookmarkFill: ImageVector by lazy { nxIcon("BookmarkFill", 2f, P("M20 21 12 13.44 4 21V3h16Z", true, true)) }
    val VolumeOn: ImageVector by lazy { nxIcon("VolumeOn", 2f, P("M4 9.5h3.5L12 5.5v13l-4.5-4H4z", false, true), P("M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11", false, true)) }
    val VolumeOff: ImageVector by lazy { nxIcon("VolumeOff", 2f, P("M4 9.5h3.5L12 5.5v13l-4.5-4H4z", false, true), P("m16 9.5 5 5M21 9.5l-5 5", false, true)) }
    val Phone: ImageVector by lazy { nxIcon("Phone", 1.9f, P("M5.2 3.5h3l1.5 4.2-2 1.3a11 11 0 0 0 5.3 5.3l1.3-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.2 5.7a2 2 0 0 1 2-2.2Z", false, true)) }
    val Video: ImageVector by lazy { nxIcon("Video", 1.9f, P("M3 7.5A2.5 2.5 0 0 1 5.5 5h8A2.5 2.5 0 0 1 16 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 16.5z", false, true), P("m16 10 5-3v10l-5-3", false, true)) }
    val MicOff: ImageVector by lazy { nxIcon("MicOff", 1.9f, P("M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-.6 1.8M9 9v2a3 3 0 0 0 4.6 2.5", false, true), P("M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11a6.4 6.4 0 0 1-.6 2.7M12 17.5V21M3 3l18 18", false, true)) }
    val VideoOff: ImageVector by lazy { nxIcon("VideoOff", 1.9f, P("M6 5h7.5A2.5 2.5 0 0 1 16 7.5v6M16 16.5a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 16.5v-9a2.5 2.5 0 0 1 1-2", false, true), P("m16 10 5-3v10l-3-1.8M3 3l18 18", false, true)) }
    val Flip: ImageVector by lazy { nxIcon("Flip", 1.9f, P("M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.5-2h6.4l1.5 2h1.8A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z", false, true), P("M9 11.5a3.2 3.2 0 0 1 5.6-1.3M15 14.2a3.2 3.2 0 0 1-5.6 1.3M14.8 8.6v1.8H13M9.2 17.4v-1.8H11", false, true)) }
    val Sparkle: ImageVector by lazy { nxIcon("Sparkle", 1.8f, P("M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", false, true), P("M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z", false, true)) }
    val PhoneEnd: ImageVector by lazy { nxIcon("PhoneEnd", 1.9f, P("M2.5 13.8v-1.6c0-1 .6-1.8 1.5-2.1A23 23 0 0 1 20 10.1c.9.3 1.5 1.1 1.5 2.1v1.6a1.2 1.2 0 0 1-1.4 1.2l-3.3-.6a1.2 1.2 0 0 1-1-1v-1.8a17 17 0 0 0-7.6 0v1.8a1.2 1.2 0 0 1-1 1l-3.3.6a1.2 1.2 0 0 1-1.4-1.2Z", true, true)) }
    val Sticker: ImageVector by lazy { nxIcon("Sticker", 1.9f, P("M21 12.5V8a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h4.5c.5 0 1-.2 1.4-.6l6.5-6.5c.4-.4.6-.9.6-1.4Z", false, true), P("M13 21v-3.5a4.5 4.5 0 0 1 4.5-4.5H21M8.5 9.5v.5M14.5 9.5v.5M8 14c1.2 1.3 2.8 1.6 4 1.3", false, true)) }
    val Gif: ImageVector by lazy { nxIcon("Gif", 1.9f, P("M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z", false, true), P("M10 10H8.2a1.2 1.2 0 0 0-1.2 1.2v1.6A1.2 1.2 0 0 0 8.2 14H10v-2H9M12.5 10v4M15.5 14v-4H18M15.5 12h2", false, true)) }
    val Draw: ImageVector by lazy { nxIcon("Draw", 1.9f, P("M4 17c3-6 5.5-9 7.5-9s.5 5 2.5 5 3-4 5-4M4 21h16", false, true)) }
    val AiImage: ImageVector by lazy { nxIcon("AiImage", 1.9f, P("M14 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-7", false, true), P("m3 17 5-5 4 4 2-2 7 6M18 2l.9 2.1L21 5l-2.1.9L18 8l-.9-2.1L15 5l2.1-.9z", false, true)) }
    val Smile: ImageVector by lazy { nxIcon("Smile", 1.9f, P("M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0Z", false, true), P("M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.5M15 9.5v.5", false, true)) }
    val Effects: ImageVector by lazy { nxIcon("Effects", 1.9f, P("M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0Z", false, true), P("M8 14.5c1.1 1.2 2.4 1.8 4 1.8s2.9-.6 4-1.8M8.2 9.5h1.6M14.2 9.5h1.6M17.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z", false, true)) }
    val Verified: ImageVector by lazy {
        ImageVector.Builder("Verified", 24.dp, 24.dp, 24f, 24f).apply {
            addPath(addPathNodes("M12 1.5l2.4 1.8 3-.2 1 2.8 2.6 1.5-.6 2.9 1.3 2.7-2.1 2.1-.2 3-2.9.6-1.7 2.5-2.8-1-2.8 1-1.7-2.5-2.9-.6-.2-3-2.1-2.1 1.3-2.7-.6-2.9L5.6 6l1-2.8 3 .2z"),
                fill = SolidColor(Color(0xFF0095F6)))
            addPath(addPathNodes("m8 12.3 2.6 2.6L16.2 9.3"), stroke = SolidColor(Color.White), strokeLineWidth = 2.2f,
                strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round)
        }.build()
    }
}
