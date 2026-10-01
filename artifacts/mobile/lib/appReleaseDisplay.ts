export type AppReleaseRuntime = "native" | "expo-go" | "browser";

export interface AppReleaseInfo {
  runtime: AppReleaseRuntime;
  version: string | null;
  nativeBuild: string | null;
  platformName: string;
}

export function formatAppReleaseFooter(info: AppReleaseInfo): string {
  const version = info.version ? `v${info.version}` : "version unavailable";

  if (info.runtime === "expo-go") {
    return `Expo Go · source config ${version} · not a Rook native build`;
  }
  if (info.runtime === "browser") {
    return `Browser · source config ${version} · no native build`;
  }

  const build = info.nativeBuild ?? "native build unavailable";
  return `Native binary · ${version} · ${info.platformName} build ${build}`;
}

export function getAppReleaseRows(info: AppReleaseInfo): Array<{ label: string; value: string }> {
  const version = info.version ? `v${info.version}` : "Unavailable";
  if (info.runtime === "expo-go") {
    return [
      { label: "App Version", value: `Source config ${version}` },
      { label: "Build", value: "Unavailable in Expo Go" },
      { label: "Runtime", value: "Expo Go · not a Rook native binary" },
    ];
  }
  if (info.runtime === "browser") {
    return [
      { label: "App Version", value: `Source config ${version}` },
      { label: "Build", value: "Not applicable in browser" },
      { label: "Runtime", value: "Browser · no native binary" },
    ];
  }
  return [
    { label: "App Version", value: version },
    {
      label: "Build",
      value: info.nativeBuild ? `${info.platformName} native build ${info.nativeBuild}` : "Native build unavailable",
    },
    { label: "Runtime", value: "Installed native binary" },
  ];
}