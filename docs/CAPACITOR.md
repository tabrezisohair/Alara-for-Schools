# Capacitor (Alara Android APK)

Alara stays a Next.js web app. Capacitor is a thin Android shell that opens that URL. Before business go-live we plan to lead with PWA; Capacitor is for APK demos and WhatsApp installs until then.

## Build APK from the command line (no Android Studio UI)

Requires JDK **21** and Android SDK (platforms + build-tools). On this machine:

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm run cap:sync
npm run cap:apk
```

Output: `dist/Alara-debug.apk` (also under `android/app/build/outputs/apk/debug/`).

## Prerequisites

1. JDK 21 (Capacitor 8) + Android SDK, **or** [Android Studio](https://developer.android.com/studio)
2. Alara running somewhere the phone can reach:
   - Emulator: `npm run dev` then shell URL `http://10.0.2.2:3001`
   - Physical phone (same Wi‑Fi): `http://YOUR_PC_LAN_IP:3001`
   - Production: `https://your-deployed-alara`

Set the URL when syncing:

```powershell
$env:CAPACITOR_SERVER_URL="http://192.168.1.20:3001"
npm run cap:sync
```

Or put `CAPACITOR_SERVER_URL=...` in the environment / CI. Default in `capacitor.config.ts` is the emulator address `http://10.0.2.2:3001`.

## One-time setup

```powershell
cd school-alara
npm install
npm run cap:add:android
npm run cap:sync
npm run cap:open
```

In Android Studio: wait for Gradle sync, then **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

Debug APK path (typical):

`android/app/build/outputs/apk/debug/app-debug.apk`

Share that file on WhatsApp. Recipients must allow install from unknown sources for WhatsApp/Files.

## Daily loop

1. Keep `npm run dev` (or production) running at the server URL
2. Change the web app as usual
3. Only re-run `npm run cap:sync` when Capacitor config, plugins, or icons change
4. Rebuild the APK in Android Studio when you need a new installable file

## Production APK notes

- Point `CAPACITOR_SERVER_URL` at the Vercel HTTPS URL (see `docs/VERCEL.md`)
- `cleartext` turns off automatically for `https://` URLs in config
- Use a release keystore (not the debug key) before Play Store or wide school distribution
- Align `NEXT_PUBLIC_APP_URL` with the same public host so approval links work

## Before go-live handoff

Prefer PWA install for staff phones. Keep Capacitor if you still want a store/APK option.
