package com.ahmedbecetti.nexora;

import android.graphics.Color;
import android.os.Build;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Colours the status bar, navigation bar and window background from JS (dark / light theme). */
@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        final String hex = call.getString("color", "#0C1014");
        final boolean darkIcons = Boolean.TRUE.equals(call.getBoolean("darkIcons", false));
        getActivity().runOnUiThread(() -> {
            try {
                int color = Color.parseColor(hex);
                Window w = getActivity().getWindow();
                w.getDecorView().setBackgroundColor(color);
                if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().setBackgroundColor(color);
                if (Build.VERSION.SDK_INT < 35) {
                    w.setStatusBarColor(color);
                    w.setNavigationBarColor(color);
                }
                WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(w, w.getDecorView());
                ic.setAppearanceLightStatusBars(darkIcons);
                ic.setAppearanceLightNavigationBars(darkIcons);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }
}
