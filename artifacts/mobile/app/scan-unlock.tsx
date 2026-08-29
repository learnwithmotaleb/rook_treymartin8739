import React from "react";
import { Redirect } from "expo-router";

/**
 * Backward-compatible route for older deep links.
 * Rook now has one paid offer, so all upgrade paths use the Premium paywall.
 */
export default function ScanUnlockRedirect() {
  return <Redirect href="/subscription" />;
}