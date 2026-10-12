package com.ahmedbecetti.nexora.kt.ui.screens

import androidx.compose.ui.graphics.toArgb

import android.graphics.Bitmap
import android.graphics.Paint
import android.graphics.Path as APath
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

private data class LineData(val pts: MutableList<Offset>, val color: Color, val width: Float)

/** Real freehand drawing canvas; serializes the user's strokes into a transparent PNG for upload. */
@Composable
fun DrawingSheet(onDismiss: () -> Unit, onSend: (Bitmap) -> Unit) {
    val strokes = remember { mutableStateListOf<LineData>() }
    var color by remember { mutableStateOf(Color(0xFF202124)) }
    var width by remember { mutableFloatStateOf(9f) }
    var canvasW by remember { mutableIntStateOf(900) }
    var canvasH by remember { mutableIntStateOf(900) }
    val colors = listOf(Color(0xFF202124), Color(0xFFE54656), Color(0xFF7048E8), Color(0xFF208AE5), Color(0xFF29A36A), Color(0xFFFFB21A), Color.White)
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxWidth().padding(16.dp).background(Color(0xFFFAFAFA), MaterialTheme.shapes.extraLarge).padding(16.dp)) {
            Text("Draw", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                colors.forEach { col -> Box(Modifier.size(32.dp).background(col, CircleShape).clickable { color = col }) }
                TextButton(onClick = { if (strokes.isNotEmpty()) strokes.removeAt(strokes.lastIndex) }) { Text("Undo") }
                TextButton(onClick = { strokes.clear() }) { Text("Clear") }
            }
            Canvas(Modifier.fillMaxWidth().height(340.dp).background(Color.White, MaterialTheme.shapes.medium).pointerInput(color, width) {
                detectDragGestures(onDragStart = { p -> strokes.add(LineData(mutableListOf(p), color, width)) }, onDrag = { change, _ ->
                    change.consume(); strokes.lastOrNull()?.pts?.add(change.position)
                })
            }) {
                canvasW = size.width.toInt().coerceAtLeast(1); canvasH = size.height.toInt().coerceAtLeast(1)
                strokes.forEach { line ->
                    if (line.pts.isNotEmpty()) {
                        val p = Path().apply { moveTo(line.pts[0].x, line.pts[0].y); line.pts.drop(1).forEach { lineTo(it.x, it.y) } }
                        drawPath(p, line.color, style = Stroke(line.width, cap = StrokeCap.Round, join = StrokeJoin.Round))
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Cancel") }
                Button(onClick = {
                    val bmp = Bitmap.createBitmap(canvasW, canvasH, Bitmap.Config.ARGB_8888)
                    val canvas = android.graphics.Canvas(bmp); canvas.drawColor(android.graphics.Color.TRANSPARENT, android.graphics.PorterDuff.Mode.CLEAR)
                    strokes.forEach { l ->
                        val p = APath(); l.pts.firstOrNull()?.let { p.moveTo(it.x, it.y) }; l.pts.drop(1).forEach { p.lineTo(it.x, it.y) }
                        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { setColor(l.color.toArgb()); strokeWidth = l.width; style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
                        canvas.drawPath(p, paint)
                    }
                    onSend(bmp)
                }) { Text("Send") }
            }
        }
    }
}
