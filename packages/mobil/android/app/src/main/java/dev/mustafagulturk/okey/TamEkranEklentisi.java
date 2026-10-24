package dev.mustafagulturk.okey;

import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Masada tam ekran (immersive) için küçük yerel eklenti.
 * JavaScript tarafı: src/platform/tamEkran.ts -> TamEkran.ac() / TamEkran.kapat().
 * Durum ve gezinme çubukları gizlenir; kenardan kaydırınca geçici olarak görünürler.
 */
@CapacitorPlugin(name = "TamEkran")
public class TamEkranEklentisi extends Plugin {

    @PluginMethod
    public void ac(PluginCall call) {
        ayarla(true);
        call.resolve();
    }

    @PluginMethod
    public void kapat(PluginCall call) {
        ayarla(false);
        call.resolve();
    }

    private void ayarla(boolean gizle) {
        getActivity().runOnUiThread(() -> {
            Window pencere = getActivity().getWindow();
            WindowInsetsControllerCompat denetci = WindowCompat.getInsetsController(pencere, pencere.getDecorView());
            if (gizle) {
                denetci.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                denetci.hide(WindowInsetsCompat.Type.systemBars());
            } else {
                denetci.show(WindowInsetsCompat.Type.systemBars());
            }
        });
    }
}
