package com.tohobil.app

import android.Manifest
import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Shader
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.RemoteMessage
import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

/** Renders data messages while preserving Capawesome token and JavaScript events. */
class TohobilMessagingService : MessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        if (data.isEmpty() || data["type"] == "status_check" || isForeground()) return
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val title = data["title"]?.takeIf { it.isNotBlank() } ?: return
        val body = data["body"]?.takeIf { it.isNotBlank() } ?: return
        val channel = if (data["channel"] == "security") "security" else "announcements"
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(NotificationChannel("security", getString(R.string.push_channel_security), NotificationManager.IMPORTANCE_HIGH))
            manager.createNotificationChannel(NotificationChannel("announcements", getString(R.string.push_channel_announcements), NotificationManager.IMPORTANCE_DEFAULT))
        }
        val id = (System.currentTimeMillis() and 0x7fffffff).toInt()
        val intent = Intent(this, MainActivity::class.java)
            .setAction(Intent.ACTION_VIEW).setData(actionUri(data))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(this, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.ic_stat_tohobil).setColor(0xff14b8a6.toInt())
            .setContentTitle(title).setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pending).setAutoCancel(true)
            .setPriority(if (channel == "security") NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
        download(data["image_url"])?.let { builder.setStyle(NotificationCompat.BigPictureStyle().bigPicture(it).bigLargeIcon(null as Bitmap?)) }
        val logo = when (data["logo_mode"]) {
            "custom" -> download(data["logo_url"])
            "app" -> bundledLogo()
            else -> null
        }
        logo?.let { builder.setLargeIcon(round(it)) }
        manager.notify(id, builder.build())
    }

    private fun isForeground(): Boolean {
        val info = ActivityManager.RunningAppProcessInfo()
        ActivityManager.getMyMemoryState(info)
        return info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }

    private fun actionUri(data: Map<String, String>): Uri {
        val value = data["action_value"]
        val uri = when {
            data["action_type"] == "screen" && value?.startsWith("tohobil://") == true -> Uri.parse(value).buildUpon()
            data["action_type"] == "url" && value?.startsWith("https://") == true -> Uri.parse("tohobil://open").buildUpon().appendQueryParameter("url", value)
            else -> Uri.parse("tohobil://home").buildUpon()
        }
        data["campaign_id"]?.let { uri.appendQueryParameter("campaign", it) }
        return uri.build()
    }

    private fun download(address: String?): Bitmap? {
        val debug = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        if (address == null || !(address.startsWith("https://") || (debug && address.startsWith("http://")))) return null
        var connection: HttpURLConnection? = null
        return try {
            connection = URL(address).openConnection() as HttpURLConnection
            connection.connectTimeout = 3000
            connection.readTimeout = 3000
            connection.instanceFollowRedirects = false
            if (connection.responseCode != 200 || connection.contentLength > MAX_IMAGE_BYTES) return null
            val bytes = ByteArrayOutputStream()
            connection.inputStream.use { input ->
                val buffer = ByteArray(8192)
                var total = 0
                while (true) {
                    val n = input.read(buffer)
                    if (n < 0) break
                    total += n
                    if (total > MAX_IMAGE_BYTES) return null
                    bytes.write(buffer, 0, n)
                }
            }
            val data = bytes.toByteArray()
            BitmapFactory.decodeByteArray(data, 0, data.size)
        } catch (_: Exception) { null }
        finally { connection?.disconnect() }
    }

    private fun bundledLogo(): Bitmap? {
        val drawable = ContextCompat.getDrawable(this, R.mipmap.ic_launcher) ?: return null
        val bitmap = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888)
        drawable.setBounds(0, 0, 128, 128)
        drawable.draw(Canvas(bitmap))
        return bitmap
    }

    private fun round(bitmap: Bitmap): Bitmap {
        val size = minOf(bitmap.width, bitmap.height)
        val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        paint.shader = BitmapShader(bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        Canvas(output).drawCircle(size / 2f, size / 2f, size / 2f, paint)
        return output
    }

    companion object { private const val MAX_IMAGE_BYTES = 1_000_000 }
}
