package collection.summary.build;

import android.graphics.Color;
import android.os.Bundle;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PdfGeneratorPlugin.class);
        registerPlugin(SystemUiPlugin.class);
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.parseColor("#04050a"));
        getWindow().setNavigationBarColor(Color.parseColor("#04050a"));
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
                .setAppearanceLightStatusBars(false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
                .setAppearanceLightNavigationBars(false);
    }
}
