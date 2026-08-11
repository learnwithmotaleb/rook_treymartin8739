/**
 * TermsUpdateModal — shown on app startup when the stored termsVersion
 * is older than CURRENT_TERMS_VERSION. Forces re-acceptance of updated
 * Terms and Privacy Policy before proceeding.
 *
 * This is required to maintain compliance when terms are materially updated.
 */
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { recordTermsAcceptance, CURRENT_TERMS_VERSION } from "@/lib/api";

interface Props {
  visible: boolean;
  /** Called after the user successfully re-accepts the updated terms. */
  onAccepted: () => void;
  /** Called if user chooses to delete their account instead. Routes to deletion. */
  onDeleteAccount: () => void;
}

const PRIVACY_URL = "https://getrook.app/privacy";
const TERMS_URL = "https://getrook.app/terms";

export function TermsUpdateModal({ visible, onAccepted, onDeleteAccount }: Props) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await recordTermsAcceptance();
      onAccepted();
    } catch {
      setError("Could not save your acceptance. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [onAccepted]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Icon */}
          <View style={[styles.iconBg, { backgroundColor: "#1E40AF20" }]}>
            <Ionicons name="document-text" size={28} color="#60A5FA" />
          </View>

          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            We've updated our Terms &amp; Privacy Policy
          </Text>

          <Text style={[styles.body, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            We've added detailed disclosures about how Rook processes your photos for identity
            monitoring — including the specific data derived, third-party services involved,
            your retention rights, and how to withdraw consent at any time.{"\n\n"}
            These updates are required to comply with Illinois BIPA, Texas CUBI, and GDPR Article 9.
          </Text>

          {/* Read links */}
          <View style={styles.linkRow}>
            <TouchableOpacity
              onPress={() => Linking.openURL(TERMS_URL)}
              activeOpacity={0.7}
              style={styles.linkBtn}
            >
              <Ionicons name="open-outline" size={13} color="#60A5FA" style={{ marginRight: 4 }} />
              <Text style={[styles.linkText, { fontFamily: "Inter_400Regular" }]}>
                Terms of Service
              </Text>
            </TouchableOpacity>

            <View style={[styles.linkDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              onPress={() => Linking.openURL(PRIVACY_URL)}
              activeOpacity={0.7}
              style={styles.linkBtn}
            >
              <Ionicons name="open-outline" size={13} color="#60A5FA" style={{ marginRight: 4 }} />
              <Text style={[styles.linkText, { fontFamily: "Inter_400Regular" }]}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.version, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Version {CURRENT_TERMS_VERSION}
          </Text>

          {error !== "" && (
            <Text style={[styles.error, { fontFamily: "Inter_400Regular" }]}>{error}</Text>
          )}

          {/* Accept */}
          <TouchableOpacity
            onPress={handleAccept}
            disabled={loading}
            style={[styles.acceptBtn, { opacity: loading ? 0.7 : 1 }]}
            activeOpacity={0.82}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.acceptText, { fontFamily: "Inter_600SemiBold" }]}>
                I Accept — Continue
              </Text>
            )}
          </TouchableOpacity>

          {/* Destructive alternative */}
          <TouchableOpacity onPress={onDeleteAccount} style={styles.deleteLink} activeOpacity={0.7}>
            <Text style={[styles.deleteLinkText, { color: "#EF4444", fontFamily: "Inter_400Regular" }]}>
              I do not accept — Delete my account
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: 16,
  },
  iconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 19,
    textAlign: "center",
    lineHeight: 26,
  },
  body: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  linkDivider: {
    width: 1,
    height: 16,
  },
  linkText: {
    fontSize: 13,
    color: "#60A5FA",
    textDecorationLine: "underline",
  },
  version: {
    fontSize: 11,
  },
  error: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
  },
  acceptBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  acceptText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  deleteLink: {
    paddingVertical: 4,
  },
  deleteLinkText: {
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
