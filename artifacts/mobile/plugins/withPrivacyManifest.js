/**
 * Expo config plugin — injects PrivacyInfo.xcprivacy into the iOS project
 * during EAS build (expo prebuild).
 *
 * Apple has required a privacy manifest for all new/updated apps since May 2024.
 * This plugin writes the file into the generated ios/ directory so EAS picks it up
 * automatically in managed workflow (where ios/ is not committed to source control).
 *
 * Required-reason API categories declared here:
 *  - NSPrivacyAccessedAPICategoryUserDefaults (CA92.1) — AsyncStorage
 *  - NSPrivacyAccessedAPICategoryFileTimestamp (C617.1) — image-picker and
 *    share-card image handling
 *
 * Collected data types:
 *  - Email address (linked, app functionality)
 *  - Name (linked, app functionality)
 *  - Photos or Videos (linked, app functionality — identity fingerprint)
 *  - User ID (linked, app functionality)
 *  - Device ID (linked, app functionality — push notification token)
 *  - Purchase History (linked, app functionality — RevenueCat subscriptions)
 *
 * Production analytics is currently disabled and the app does not send crash
 * or diagnostic reports. Those data types are intentionally not declared.
 */

const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PRIVACY_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- ─── Tracking ───────────────────────────────────────────────────── -->
  <!-- Rook does NOT track users across apps or websites for advertising -->
  <key>NSPrivacyTracking</key>
  <false/>

  <!-- ─── Tracking Domains ─────────────────────────────────────────── -->
  <key>NSPrivacyTrackingDomains</key>
  <array/>

  <!-- ─── Required-Reason APIs ─────────────────────────────────────── -->
  <key>NSPrivacyAccessedAPITypes</key>
  <array>

    <!-- NSUserDefaults — AsyncStorage, expo-secure-store, various Expo modules -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <!-- CA92.1: Read/write data in UserDefaults from the same app -->
        <string>CA92.1</string>
      </array>
    </dict>

    <!-- File timestamps — react-native-view-shot, expo-image-picker, expo-file-system -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <!-- C617.1: Display file information or use it for app functionality -->
        <string>C617.1</string>
      </array>
    </dict>

  </array>

  <!-- ─── Collected Data Types ──────────────────────────────────────── -->
  <key>NSPrivacyCollectedDataTypes</key>
  <array>

    <!-- Email address — required for account creation and sign-in (Clerk) -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeEmailAddress</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>

    <!-- Name — displayed in profile, used to build identity fingerprint -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeName</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>

    <!-- Photos / Videos — user uploads profile photos for identity fingerprinting -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePhotosOrVideos</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>

    <!-- User ID — Clerk user ID stored and used to scope all scan/threat data -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeUserID</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>

    <!-- Purchase history — subscription entitlement and restoration via RevenueCat -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePurchaseHistory</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>

    <!-- Device ID — Expo push token linked to the signed-in user for alerts -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeDeviceID</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>

  </array>
</dict>
</plist>
`;

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withPrivacyManifest = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const manifestPath = path.join(
        config.modRequest.platformProjectRoot,
        "PrivacyInfo.xcprivacy"
      );
      fs.writeFileSync(manifestPath, PRIVACY_MANIFEST, "utf8");
      return config;
    },
  ]);
};

module.exports = withPrivacyManifest;
