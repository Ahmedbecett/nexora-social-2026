package com.ahmedbecetti.nexora;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // تسجيل صريح لإضافة تشخيص المصادقة (Fire OS / Play Services / Firebase config).
        // يجب أن يسبق super.onCreate حتى تجدها Capacitor جاهزة عند أوّل استدعاء من JavaScript،
        // ولا يعتمد على أن يكتشفها `npx cap sync` تلقائيًا.
        registerPlugin(NexoraAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
