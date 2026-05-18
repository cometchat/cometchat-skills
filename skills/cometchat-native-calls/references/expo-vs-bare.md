# Expo managed vs bare RN — calls integration paths

Calls require native modules. Expo managed workflows have three states; only two of them can run calls.

| Expo state | Calls work? | What the skill does |
|---|---|---|
| **Bare RN CLI** | ✓ | Edit native files directly |
| **Expo + dev client** | ✓ | Config plugins regenerate native projects on prebuild |
| **Expo Go (the public client)** | ✗ | Skill refuses to scaffold; tells the user to add `expo-dev-client` or eject |

---

## Detect which mode the project is in

The skill checks (in order):

1. `app.json` exists with `"expo"` key → Expo project
2. `expo-dev-client` in `package.json` deps → has dev client
3. `ios/` and `android/` directories committed → bare or prebuild already ran
4. `expo-modules-core` in `package.json` → managed

The dispatcher branches:

- **Bare RN** (no `expo` in app.json): edit `ios/` + `android/` directly. Run `cd ios && pod install` after package install.
- **Expo + dev client**: write config plugins to `app.json`, run `npx expo prebuild --clean`, the prebuild regenerates `ios/` + `android/` with the calls config baked in.
- **Expo Go**: print the message below and exit.

---

## Expo Go message

When the project is Expo managed without a dev client, the dispatcher prints:

> Calls require native modules that Expo Go cannot load (`react-native-callkeep`, `react-native-voip-push-notification`, `react-native-webrtc`). To proceed:
>
> **Option A — Add expo-dev-client (recommended for managed projects):**
> ```bash
> npx expo install expo-dev-client
> npx expo prebuild --clean
> npx expo run:ios     # or run:android
> ```
> This builds a custom dev client locally. Re-run `/cometchat-calls` after that.
>
> **Option B — Eject to bare:**
> ```bash
> npx expo prebuild --no-install
> ```
> This generates `ios/` + `android/` directories permanently. After this, you're a bare RN project; the calls flow runs normally.
>
> **Option C — Use EAS Build:**
> If you don't want to build locally, EAS can build the dev client for you. Configure `eas.json` profiles, then `eas build --profile development`.
>
> Pick one and re-run `/cometchat-calls`.

---

## Config plugins for Expo + dev client

The skill writes the following to `app.json` `expo.plugins`:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-callkeep",
        {
          "ios": {
            "appName": "YourApp",
            "supportsVideo": true,
            "imageName": "callkit_icon"
          }
        }
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      [
        "expo-build-properties",
        {
          "ios": { "useFrameworks": "static" },
          "android": { "minSdkVersion": 26 }
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["audio", "voip", "remote-notification"],
        "NSMicrophoneUsageDescription": "So you can talk during voice and video calls.",
        "NSCameraUsageDescription": "So you can be seen during video calls."
      },
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "android": {
      "permissions": [
        "RECORD_AUDIO",
        "CAMERA",
        "MANAGE_OWN_CALLS",
        "BIND_TELECOM_CONNECTION_SERVICE",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_PHONE_CALL",
        "FOREGROUND_SERVICE_MICROPHONE",
        "FOREGROUND_SERVICE_CAMERA",
        "POST_NOTIFICATIONS"
      ],
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

Then `npx expo prebuild --clean` regenerates `ios/` + `android/` from this config. Re-run after every config change.

---

## EAS Build profile for the dev client

`eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

Run `eas build --profile development --platform ios` (or `android`). Wait ~10-15 min, install the resulting `.ipa` / `.apk` to a real device, and `expo start --dev-client` connects to it.

**Real device only** for VoIP testing — simulators don't deliver PushKit / FCM VoIP messages.

---

## When to recommend bare over Expo

The dispatcher defaults to keeping projects on Expo if they're already there. But for calls specifically, bare can be simpler if:

- The project will need many native modules (calls is one of several)
- The team is comfortable with Xcode + Android Studio
- They want full control of `Podfile`, `build.gradle`, `Info.plist`

Bare's downside: no `expo prebuild` to regenerate from config — every native config change is manual. For most teams, Expo + dev client is the right balance.

---

## File-tree differences

Bare:

```
ios/
  Podfile                    ← edit directly
  YourApp/Info.plist         ← edit directly
  YourApp/AppDelegate.mm     ← edit for PushKit registration
android/
  app/build.gradle           ← edit directly
  app/src/main/AndroidManifest.xml
  app/google-services.json   ← drop in directly
```

Expo + dev client:

```
app.json                     ← single source of truth (config plugins)
google-services.json         ← root of project
GoogleService-Info.plist     ← root of project
ios/                         ← regenerated by prebuild; DO NOT edit directly
android/                     ← regenerated by prebuild; DO NOT edit directly
```

The skill is aware of this and writes to `app.json` for Expo, to native files for bare.
