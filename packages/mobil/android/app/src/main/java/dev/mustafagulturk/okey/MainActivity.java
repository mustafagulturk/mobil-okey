package dev.mustafagulturk.okey;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Uygulamanın kendi yerel eklentileri super.onCreate'ten ÖNCE kaydedilmeli.
        registerPlugin(TamEkranEklentisi.class);
        super.onCreate(savedInstanceState);
    }
}
