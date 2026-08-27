import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Alara is a Next.js app (SSR + APIs). The Capacitor shell loads that URL.
 * Set CAPACITOR_SERVER_URL to override. Default is this PC’s Wi‑Fi LAN for phone APKs.
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() || "http://192.168.100.21:3001";

const config: CapacitorConfig = {
  appId: "pk.edu.cedar.alara",
  appName: "Alara",
  webDir: "www",
  server: {
    url: serverUrl,
    // Allow http:// during local/dev APK testing. Turn off for production HTTPS.
    cleartext: !serverUrl.startsWith("https://"),
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#102a56",
  },
};

export default config;
