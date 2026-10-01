export type LogoutAuthorizationMode = "pending" | "demo" | "live" | "unavailable";

export interface CapturedLogoutAuthorization {
  ownerId: string;
  bearerToken: string;
}

export interface CapturedDevicePushToken {
  ownerId: string;
  token: string;
  platform: "ios" | "android";
}

export interface PinnedPushTokenCleanup {
  ownerId: string;
  bearerToken: string;
  deviceToken: string;
  platform: "ios" | "android";
}

export function shouldCaptureLiveLogoutCleanup(
  authorization: { accountKey: string | null; status: LogoutAuthorizationMode },
  ownerId: string | null,
  skipServerCleanup: boolean,
): ownerId is string {
  return Boolean(
    !skipServerCleanup &&
    ownerId &&
    authorization.status === "live" &&
    authorization.accountKey === ownerId
  );
}

export function createPinnedPushTokenCleanup(
  authorization: CapturedLogoutAuthorization | null,
  device: CapturedDevicePushToken | null,
  expectedOwnerId: string,
): PinnedPushTokenCleanup | null {
  if (
    !expectedOwnerId ||
    !authorization ||
    !device ||
    authorization.ownerId !== expectedOwnerId ||
    device.ownerId !== expectedOwnerId ||
    !authorization.bearerToken.trim() ||
    !device.token.trim()
  ) return null;
  return {
    ownerId: expectedOwnerId,
    bearerToken: authorization.bearerToken,
    deviceToken: device.token,
    platform: device.platform,
  };
}

export function buildPinnedPushTokenCleanupRequest(
  cleanup: PinnedPushTokenCleanup,
): {
  path: string;
  method: "DELETE";
  headers: { Authorization: string; "Content-Type": string };
} {
  const query = new URLSearchParams({ token: cleanup.deviceToken });
  return {
    path: `/notifications/token?${query.toString()}`,
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${cleanup.bearerToken}`,
      "Content-Type": "application/json",
    },
  };
}