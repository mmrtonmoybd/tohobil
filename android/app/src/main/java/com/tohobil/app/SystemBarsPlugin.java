package com.tohobil.app;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {
    @PluginMethod
    public void setAppearance(PluginCall call) {
        String color = call.getString("backgroundColor", "#F3F6FB");
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        final int parsed;
        try { parsed = Color.parseColor(color); }
        catch (IllegalArgumentException exception) { call.reject("Invalid color"); return; }
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setNavigationBarColor(parsed);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.setNavigationBarContrastEnforced(false);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            controller.setAppearanceLightNavigationBars(!dark);
            call.resolve(new JSObject());
        });
    }
}
