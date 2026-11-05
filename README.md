# Collection Summary (वसुली सारांश)

A local-first daily pigmy-collection app for a savings society. Built with React 19 +
TypeScript + Vite and packaged for Android with Capacitor.

## Features

- Daily collection entry with automatic receipt numbering and configurable start number
- Holder management (add / edit / deactivate / delete) with search, filters and sorting
- Holder history screen with totals and a per-holder statement PDF
- Monthly report with 3% commission, per-holder and per-day breakdowns
- Daily / monthly / statement PDF generation (native Android renderer) and sharing
- WhatsApp / SMS payment reminders
- JSON backup export and restore
- Marathi / English UI with Devanagari digits and dark / light themes
- Offline storage in SQLite on device, localStorage on the web

## Development

```bash
npm install
npm run dev        # web dev server
npm run lint       # oxlint
npm run build      # typecheck + production build
```

## Android

```bash
npm run android:sync   # build web assets and copy them into the Android project
npm run android:open   # open the project in Android Studio
npm run android:apk    # build a debug APK
```

Debug APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.

### Release signing

1. Copy `keystore.properties.example` to `android/keystore.properties` and fill it in.
2. Create the keystore at `android/release.keystore` (see the comments in the example).
3. Build a signed release:

```bash
npm run android:sync
cd android && ./gradlew assembleRelease
```

Release APK output: `android/app/build/outputs/apk/release/app-release.apk`.

The keystore and `android/keystore.properties` are git-ignored. **Back them up** —
losing the keystore means existing installs can never be updated in place.

If `android/keystore.properties` is absent, the release build is left unsigned so CI and
local builds still work.

### Scanner (Gemini)

The front-page scanner takes a photo with the phone camera and reads it with the
Gemini API. Add a Gemini API key in **Settings** on the device; the key
is stored only on that device and is never included in backups. The scanned page
image is sent to Google for recognition, so scanning requires internet access.

### Versioning

Before building a release, bump `versionCode` and `versionName` in
`android/app/build.gradle`. Increase `versionCode` by one for every release so
Android treats the APK as an upgrade; keep the same signing key.

### Developing on a new machine

The signing password is stored in the developer's notes app on the phone; it is
intentionally **not** in this repository.

1. Copy the backed-up `release.keystore` file into `android/release.keystore`.
2. Copy `keystore.properties.example` to `android/keystore.properties`.
3. Fill `storePassword` and `keyPassword` with the password from the notes app.
   Keep `storeFile=../release.keystore` and `keyAlias=collection`.
4. Build the signed release:

```bash
npm run android:sync
cd android && ./gradlew assembleRelease
```

Use the same keystore and password for every future release. A different key means
phones must uninstall the old app (losing data) before installing the new one.