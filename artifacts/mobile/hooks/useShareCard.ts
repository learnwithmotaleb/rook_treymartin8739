import { useRef, useState } from "react";
import { Alert, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

export function useShareCard() {
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const share = async () => {
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

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          "Sharing unavailable",
          "Your device does not support sharing. Please screenshot the card manually."
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share to Stories",
        UTI: "public.png",
      });
    } catch (err) {
      Alert.alert(
        "Could not share",
        "There was a problem creating the share card. Please try again."
      );
    } finally {
      setIsSharing(false);
    }
  };

  return { cardRef, isSharing, share };
}
