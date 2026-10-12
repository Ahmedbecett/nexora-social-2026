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
    val Verified: ImageVector by lazy {
        ImageVector.Builder("Verified", 24.dp, 24.dp, 24f, 24f).apply {
            addPath(addPathNodes("M12 1.5l2.4 1.8 3-.2 1 2.8 2.6 1.5-.6 2.9 1.3 2.7-2.1 2.1-.2 3-2.9.6-1.7 2.5-2.8-1-2.8 1-1.7-2.5-2.9-.6-.2-3-2.1-2.1 1.3-2.7-.6-2.9L5.6 6l1-2.8 3 .2z"),
                fill = SolidColor(Color(0xFF0095F6)))
            addPath(addPathNodes("m8 12.3 2.6 2.6L16.2 9.3"), stroke = SolidColor(Color.White), strokeLineWidth = 2.2f,
                strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round)
        }.build()
    }
}
