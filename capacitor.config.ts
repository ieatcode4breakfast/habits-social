import type { CapacitorConfig } from '@capacitor/cli';

// ponytail: no server.url — remote webview is explicitly forbidden by roadmap step 7 (no mixed content, no cleartext, no remote nav). androidScheme:'https' forces HTTPS origin in the WebView.
const config: CapacitorConfig = {
  appId: 'com.habitssocial.app',
  appName: 'Habits Social',
  webDir: '.output/public',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
