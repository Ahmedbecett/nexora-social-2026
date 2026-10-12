package com.ahmedbecetti.nexora.kt.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSink
import okio.source
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.URLEncoder

/**
 * Media uploads, using the same flow as the web app: ask our API for a short-lived Vercel Blob client token
 * (`POST upload/token`), then PUT the file straight to Vercel Blob. The server never proxies the bytes.
 */
object Upload {
    private const val BLOB_API = "https://vercel.com/api/blob/"
    private val VIDEO_TYPES = setOf("video/mp4", "video/quicktime", "video/webm")

    data class Result(val url: String, val type: String, val w: Int, val h: Int, val poster: String?) {
        fun toJson(): JSONObject = json("url" to url, "type" to type, "w" to w.takeIf { it > 0 }, "h" to h.takeIf { it > 0 }, "poster" to poster)
    }

    fun isVideo(ctx: Context, uri: Uri): Boolean = ctx.contentResolver.getType(uri)?.startsWith("video/") == true

    /** Uploads an image (re-encoded as JPEG, max 1440px, EXIF rotation applied) or a video (as-is, plus a poster frame). */
    suspend fun media(ctx: Context, uri: Uri, onProgress: (Float) -> Unit = {}): Result = withContext(Dispatchers.IO) {
        if (isVideo(ctx, uri)) video(ctx, uri, onProgress) else image(ctx, uri, onProgress)
    }

    suspend fun image(ctx: Context, uri: Uri, onProgress: (Float) -> Unit = {}, maxSide: Int = 1440): Result = withContext(Dispatchers.IO) {
        val bmp = decodeScaled(ctx, uri, maxSide) ?: throw ApiException("invalid_media", 0)
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, 86, out)
        val url = put(out.toByteArray().toRequestBody("image/jpeg".toMediaType()), "image/jpeg", onProgress)
        Result(url, "image", bmp.width, bmp.height, null).also { bmp.recycle() }
    }

    private suspend fun video(ctx: Context, uri: Uri, onProgress: (Float) -> Unit): Result {
        val cr = ctx.contentResolver
        val type = cr.getType(uri)?.takeIf { it in VIDEO_TYPES } ?: "video/mp4"
        val size = sizeOf(ctx, uri)
        if (size > 100L * 1024 * 1024) throw ApiException("file_too_large", 0)
        var w = 0; var h = 0; var poster: String? = null
        try {
            val r = MediaMetadataRetriever()
            r.setDataSource(ctx, uri)
            w = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
            h = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
            val rot = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
            if (rot == 90 || rot == 270) { val t = w; w = h; h = t }
            val frame = r.getFrameAtTime(500_000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
            r.release()
            if (frame != null) {
                val s = minOf(1f, 720f / maxOf(frame.width, frame.height))
                val small = if (s < 1f) Bitmap.createScaledBitmap(frame, (frame.width * s).toInt(), (frame.height * s).toInt(), true) else frame
                val out = ByteArrayOutputStream(); small.compress(Bitmap.CompressFormat.JPEG, 80, out)
                poster = put(out.toByteArray().toRequestBody("image/jpeg".toMediaType()), "image/jpeg") {}
            }
        } catch (_: Exception) {}
        val body = object : RequestBody() {
            override fun contentType(): MediaType = type.toMediaType()
            override fun contentLength(): Long = size
            override fun writeTo(sink: BufferedSink) {
                val input = cr.openInputStream(uri) ?: throw IOException("open failed")
                input.source().use { src ->
                    var total = 0L
                    while (true) {
                        val n = src.read(sink.buffer, 256 * 1024L)
                        if (n == -1L) break
                        total += n; sink.flush()
                        if (size > 0) onProgress((total.toFloat() / size).coerceAtMost(1f))
                    }
                }
            }
        }
        val url = put(body, type) {}
        return Result(url, "video", w, h, poster)
    }

    /** Uploads raw bytes (voice notes, GIFs, stickers, drawings, map cards). */
    suspend fun bytes(data: ByteArray, contentType: String): String = withContext(Dispatchers.IO) { put(data.toRequestBody(contentType.toMediaType()), contentType) {} }

    /** Uploads a bitmap as PNG (transparent: stickers, drawings) or JPEG. */
    suspend fun bitmap(bmp: Bitmap, png: Boolean): Result = withContext(Dispatchers.IO) {
        val out = ByteArrayOutputStream()
        bmp.compress(if (png) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG, if (png) 100 else 88, out)
        val type = if (png) "image/png" else "image/jpeg"
        Result(put(out.toByteArray().toRequestBody(type.toMediaType()), type) {}, "image", bmp.width, bmp.height, null)
    }

    /** PUT the body to Vercel Blob with a client token from our API; returns the public URL. */
    private suspend fun put(body: RequestBody, contentType: String, onProgress: (Float) -> Unit): String {
        val tok = Api.post("upload/token", json("contentType" to contentType))
        val pathname = tok.getString("pathname")
        val req = Request.Builder()
            .url(BLOB_API + "?pathname=" + URLEncoder.encode(pathname, "UTF-8"))
            .header("authorization", "Bearer " + tok.getString("clientToken"))
            .header("x-api-version", "11")
            .header("x-content-type", contentType)
            .put(body)
            .build()
        return withContext(Dispatchers.IO) {
            val res = try { Api.http.newCall(req).execute() } catch (e: IOException) { throw ApiException("network", 0) }
            res.use { r ->
                val text = r.body?.string().orEmpty()
                if (!r.isSuccessful) throw ApiException("upload_failed", r.code)
                onProgress(1f)
                JSONObject(text).getString("url")
            }
        }
    }

    private fun sizeOf(ctx: Context, uri: Uri): Long {
        ctx.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { c ->
            if (c.moveToFirst() && !c.isNull(0)) return c.getLong(0)
        }
        return ctx.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
    }

    /** Decodes a gallery image with subsampling, scales so the long side is <= [maxSide] and applies EXIF rotation. */
    fun decodeScaled(ctx: Context, uri: Uri, maxSide: Int): Bitmap? {
        val cr = ctx.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        cr.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0) return null
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
        val raw = cr.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) } ?: return null
        val rot = try {
            cr.openInputStream(uri)?.use {
                when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> 90f; ExifInterface.ORIENTATION_ROTATE_180 -> 180f; ExifInterface.ORIENTATION_ROTATE_270 -> 270f; else -> 0f
                }
            } ?: 0f
        } catch (_: Exception) { 0f }
        val s = minOf(1f, maxSide.toFloat() / maxOf(raw.width, raw.height))
        if (s >= 1f && rot == 0f) return raw
        val m = Matrix().apply { postScale(s, s); postRotate(rot) }
        return Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, m, true).also { if (it !== raw) raw.recycle() }
    }

    /** Small preview bitmap for the create screen (image or first video frame). */
    fun preview(ctx: Context, uri: Uri, maxSide: Int = 720): Bitmap? = try {
        if (isVideo(ctx, uri)) {
            val r = MediaMetadataRetriever(); r.setDataSource(ctx, uri)
            val f = r.getFrameAtTime(500_000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC); r.release(); f
        } else decodeScaled(ctx, uri, maxSide)
    } catch (_: Exception) { null }
}
