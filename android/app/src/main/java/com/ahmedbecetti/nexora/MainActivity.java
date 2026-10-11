package com.ahmedbecetti.nexora;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemBarsPlugin.class);
        super.onCreate(savedInstanceState);
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null) {
            // native feel: no stretch/glow overscroll, no long-press link previews
            wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
            wv.setHapticFeedbackEnabled(false);
            wv.setLongClickable(false);
            wv.setOnLongClickListener(v -> false);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // stop any video / reel sound when the app goes to the background
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null) {
            wv.evaluateJavascript("document.querySelectorAll('video,audio').forEach(function(m){try{m.pause()}catch(e){}})", null);
        }
    }
}
