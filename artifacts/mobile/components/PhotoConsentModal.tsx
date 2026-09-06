/**
 * PhotoConsentModal — shown the first time a user connects a social account or
 * uploads a reference photo that will trigger photo fingerprinting.
 *
 * Constitutes the in-app delivery of the written notice and explicit consent
 * required by Illinois BIPA § 15(b), Texas CUBI, and GDPR Article 9(2)(a).
 */
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { recordPhotoConsent } from "@/lib/api";

interface Props {
  visible: boolean;
  /** Called when the user taps "I Understand & Agree". Modal will close. */
  onConsent: () => void;
  /** Called when the user taps "Skip for Now". The caller must discard any
   * pending photo-processing action; skip is never consent. */
  onSkip: () => void;
}

export function PhotoConsentModal({ visible, onConsent, onSkip }: Props) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConsent = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await recordPhotoConsent();
      onConsent();
    } catch {
      setError("Could not record your consent. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [onConsent]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconBg, { backgroundColor: "#6D28D920" }]}>
              <Ionicons name="shield-checkmark" size={26} color="#A78BFA" />
            </View>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Photo Processing Notice
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Required disclosure under Illinois BIPA, Texas CUBI, and GDPR Article 9
            </Text>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* What we derive */}
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                What Rook derives from your photos
              </Text>
              <Item icon="scan-outline" color="#A78BFA" colors={colors}>
                A <Text style={styles.bold}>perceptual fingerprint</Text> — a compact digital
                signature of your photo's visual structure. It is NOT raw image data, NOT facial
                recognition, and cannot reconstruct your photo.
              </Item>
              <Item icon="analytics-outline" color="#60A5FA" colors={colors}>
                An <Text style={styles.bold}>AI-derived visual representation</Text> — used
                to detect visually similar images on other accounts. Cannot reconstruct your photo.
              </Item>
            </View>

            {/* Purpose */}
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Sole purpose
              </Text>
              <Item icon="search-outline" color="#34D399" colors={colors}>
                To detect whether your photos appear on other social accounts without your
                authorization. This data is never sold, never used for ads, and never used for
                any other purpose.
              </Item>
            </View>

            {/* Third parties */}
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Third-party services that receive photo data
              </Text>
              <Item icon="logo-google" color="#EA4335" colors={colors}>
                <Text style={styles.bold}>Google</Text> — receives your public photo URL to
                find where similar images appear on the web.
              </Item>
              <Item icon="sparkles-outline" color="#F59E0B" colors={colors}>
                <Text style={styles.bold}>OpenAI</Text> — analyzes your photo for visual
                similarity detection across platforms.
              </Item>
            </View>

            {/* Retention */}
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                How long it is kept
              </Text>
              <Item icon="time-outline" color="#94A3B8" colors={colors}>
                While your account is active. Deleted within 30 days of account deletion.
                Never retained beyond 3 years. You can delete it at any time without deleting
                your account.
              </Item>
            </View>

            {/* Withdrawal */}
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                You can withdraw consent anytime
              </Text>
              <Item icon="trash-outline" color="#EF4444" colors={colors}>
                Go to <Text style={styles.bold}>Profile → Settings → Privacy → Manage Photo
                Data</Text> to delete all fingerprint data and disable photo-based scanning —
                without deleting your account.
              </Item>
            </View>

            {error !== "" && (
              <Text style={[styles.error, { fontFamily: "Inter_400Regular" }]}>{error}</Text>
            )}

            {/* Legal links */}
            <TouchableOpacity onPress={() => router.push("/legal" as any)} style={styles.legalLink}>
              <Text style={[styles.legalLinkText, { color: "#60A5FA", fontFamily: "Inter_400Regular" }]}>
                Read full Privacy Policy (Section 2) →
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Actions */}
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={onSkip}
              disabled={loading}
              style={[styles.skipBtn, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Skip for Now
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConsent}
              disabled={loading}
              style={[styles.consentBtn, { opacity: loading ? 0.7 : 1 }]}
              activeOpacity={0.82}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.consentText, { fontFamily: "Inter_600SemiBold" }]}>
                  I Understand &amp; Agree
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Item({
  icon,
  color,
  colors,
  children,
}: {
  icon: string;
  color: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.item}>
      <Ionicons name={icon as any} size={16} color={color} style={{ marginTop: 2 }} />
      <Text style={[styles.itemText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: "90%",
  },
  header: {
    alignItems: "center",
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 8,
  },
  iconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  body: {
    paddingHorizontal: 20,
  },
  section: {
    borderTopWidth: 1,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 4,
  },
  item: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  bold: {
    fontWeight: "600",
    color: "#CBD5E1",
  },
  legalLink: {
    paddingVertical: 16,
    alignItems: "center",
  },
  legalLinkText: {
    fontSize: 13,
  },
  error: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
  },
  skipBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 15,
  },
  consentBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#6D28D9",
    alignItems: "center",
    justifyContent: "center",
  },
  consentText: {
    fontSize: 15,
    color: "#FFFFFF",
  },
});
