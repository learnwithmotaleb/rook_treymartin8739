import { useRef, useState } from "react";
import { Alert, Platform, Share, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

export function useShareCard() {
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  /**
   * Capture the off-screen ShareCard as a PNG and open the native share sheet.
   * @param reportUrl  The tryrook.app/report?... URL to accompany the image so
   *                   story viewers can tap through to report the impersonator.
   * @param caption    Optional human-readable caption attached alongside the image.
   */
  const share = async (reportUrl?: string, caption?: string) => {
    if (isSharing || !cardRef.current) return;
    setIsSharing(true);
    try {
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        width: 780,
        height: 1386,
      });

      const message =
        caption ??
        (reportUrl
          ? `Help me report this impersonator → ${reportUrl}`
          : "Someone is impersonating me online. Help me report them with Rook.");

      if (Platform.OS === "ios") {
        // iOS Share.share supports { url, message } together:
        // url  → shares the captured PNG via the system share sheet
        // message → travels as the caption/text (e.g. shown in Messages, copied to Notes)
        await Share.share({ url: uri, message });
      } else {
        // Android: expo-sharing handles content:// URIs and file permissions correctly.
        // We pass the URL in dialogTitle so it's visible in the chooser.
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          Alert.alert(
            "Sharing unavailable",
            "Your device does not support sharing. Please screenshot the card and share it manually."
          );
          return;
        }
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Help report this impersonator${reportUrl ? ` → ${reportUrl}` : ""}`,
          UTI: "public.png",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("cancel")) {
        Alert.alert(
          "Could not share",
          "There was a problem creating the share card. Please try again."
        );
      }
    } finally {
      setIsSharing(false);
    }
  };

  return { cardRef, isSharing, share };
}
