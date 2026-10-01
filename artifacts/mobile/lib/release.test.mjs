import assert from "node:assert/strict";
import test from "node:test";
import { formatAppReleaseFooter, getAppReleaseRows } from "./appReleaseDisplay.ts";
import { resolveApiBaseUrl, resolveAppOrigin, validateAppPath } from "./urls.ts";

test("resolves the configured production native API and OAuth origin", () => {
  const options = {
    platform: "native",
    nativeProduction: true,
    apiUrl: "https://tryrook.app",
  };
  assert.equal(resolveAppOrigin(options), "https://tryrook.app");
  assert.equal(resolveApiBaseUrl(options), "https://tryrook.app/api");
});

test("resolves a preview native build through its validated workflow domain", () => {
  assert.equal(
    resolveApiBaseUrl({ platform: "native", domain: "rook-preview.replit.dev" }),
    "https://rook-preview.replit.dev/api"
  );
  assert.equal(
    resolveApiBaseUrl({ platform: "native", domain: "https://rook-preview.replit.dev" }),
    "https://rook-preview.replit.dev/api"
  );
});

test("uses the browser origin in browser preview and keeps a relative SSR fallback", () => {
  assert.equal(
    resolveApiBaseUrl({ platform: "web", browserOrigin: "https://rook-preview.replit.app" }),
    "https://rook-preview.replit.app/api"
  );
  assert.equal(resolveApiBaseUrl({ platform: "web" }), "/api");
});

test("rejects unsafe native origins and malformed app paths", () => {
  assert.throws(
    () => resolveApiBaseUrl({ platform: "native", nativeProduction: true, domain: "tryrook.app" }),
    /Production API is not configured/
  );
  assert.throws(() => validateAppPath("//other.example/path"), /local absolute path/);
});

test("shows the installed native version and binary build separately from Expo Go source config", () => {
  const nativeRelease = {
    runtime: "native",
    version: "1.0.1",
    nativeBuild: "16",
    platformName: "iOS",
  };
  assert.equal(
    formatAppReleaseFooter(nativeRelease),
    "Native binary · v1.0.1 · iOS build 16"
  );
  assert.deepEqual(getAppReleaseRows(nativeRelease), [
    { label: "App Version", value: "v1.0.1" },
    { label: "Build", value: "iOS native build 16" },
    { label: "Runtime", value: "Installed native binary" },
  ]);

  const expoGoRelease = {
    runtime: "expo-go",
    version: "1.0.1",
    nativeBuild: null,
    platformName: "Expo Go",
  };
  assert.match(formatAppReleaseFooter(expoGoRelease), /source config v1\.0\.1/);
  assert.match(formatAppReleaseFooter(expoGoRelease), /not a Rook native build/);
  assert.equal(getAppReleaseRows(expoGoRelease)[1].value, "Unavailable in Expo Go");
});

test("marks browser builds as source config rather than installed native builds", () => {
  const browserRelease = {
    runtime: "browser",
    version: "1.0.1",
    nativeBuild: null,
    platformName: "Browser",
  };
  assert.match(formatAppReleaseFooter(browserRelease), /Browser · source config v1\.0\.1/);
  assert.equal(getAppReleaseRows(browserRelease)[1].value, "Not applicable in browser");
});