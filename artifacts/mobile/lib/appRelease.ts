import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { AppReleaseInfo } from "./appReleaseDisplay";

export { formatAppReleaseFooter, getAppReleaseRows } from "./appReleaseDisplay";
export type { AppReleaseInfo, AppReleaseRuntime } from "./appReleaseDisplay";

export function getAppReleaseInfo(): AppReleaseInfo {
  const version = Constants.expoConfig?.version ?? null;
  if (Platform.OS === "web") {
    return { runtime: "browser", version, nativeBuild: null, platformName: "Browser" };
  }

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return { runtime: "expo-go", version, nativeBuild: null, platformName: "Expo Go" };
  }

  const nativeBuild =
    Platform.OS === "ios"
      ? Constants.platform?.ios?.buildNumber
      : Constants.platform?.android?.versionCode;

  return {
    runtime: "native",
    version,
    nativeBuild: nativeBuild == null ? null : String(nativeBuild),
    platformName: Platform.OS === "ios" ? "iOS" : "Android",
  };
}