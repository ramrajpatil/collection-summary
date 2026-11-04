package collection.summary.build;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;

import androidx.core.view.WindowCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemUi")
public class SystemUiPlugin extends Plugin {

    @PluginMethod
    public void setTheme(PluginCall call) {
        String background = call.getString("background", "#04050a");
        boolean light = Boolean.TRUE.equals(call.getBoolean("light", false));

        final int color;
        try {
            color = Color.parseColor(background);
        } catch (Exception e) {
            call.reject("Invalid background color: " + background);
            return;
        }

        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            View decor = window.getDecorView();
            decor.setBackgroundColor(color);

            View content = getActivity().findViewById(android.R.id.content);
            if (content != null) {
                content.setBackgroundColor(color);
            }

            WindowCompat.getInsetsController(window, decor)
                    .setAppearanceLightStatusBars(light);
            WindowCompat.getInsetsController(window, decor)
                    .setAppearanceLightNavigationBars(light);

            if (Build.VERSION.SDK_INT < 35) {
                window.setStatusBarColor(color);
                window.setNavigationBarColor(color);
            }
        });

        call.resolve();
    }
}
