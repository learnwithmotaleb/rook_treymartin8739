/**
 * Privacy & Data Settings screen
 * ─────────────────────────────
 * Provides GDPR Art. 20 data portability export, BIPA / GDPR consent management,
 * and photo-derived data deletion — without requiring full account deletion.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  getPhotoConsent,
  withdrawPhotoConsent,
  deletePhotoData,
  downloadMyData,
} from "@/lib/api";

type ConsentStatus = {
  hasConsent: boolean;
  consentedAt: string | null;
  consentVersion: string | null;
};

export default function PrivacySettings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [consentLoading, setConsentLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchConsent = useCallback(async () => {
    try {
      setConsentLoading(true);
      const status = await getPhotoConsent();
      setConsent(status);
    } catch {
      setConsent(null);
    } finally {
      setConsentLoading(false);
    }
  }, []);

  useEffect(() => { fetchConsent(); }, [fetchConsent]);

  const handleWithdraw = useCallback(() => {
    Alert.alert(
      "Withdraw Photo Processing Consent",
      "This will delete all perceptual hash fingerprints and AI embeddings derived from your photos, and disable photo-based scanning. Text and username monitoring will continue.\n\nThis action cannot be undone — you can re-consent at any time to resume photo scanning.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw & Delete",
          style: "destructive",
          onPress: async () => {
            setWithdrawing(true);
            try {
              await withdrawPhotoConsent();
              await fetchConsent();
              Alert.alert(
                "Consent Withdrawn",
                "All photo-derived data has been deleted. Photo-based scanning is now disabled for your account."
              );
            } catch {
              Alert.alert("Error", "Could not withdraw consent. Please try again.");
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ]
    );
  }, [fetchConsent]);

  const handleDeletePhotoData = useCallback(() => {
    Alert.alert(
      "Delete Photo Data",
      "This will delete all perceptual hash fingerprints and AI embeddings derived from your photos. Your consent status is preserved — photo-based scanning will continue (but re-fingerprint your photos on the next scan).\n\nTo also disable photo scanning, use 'Withdraw Consent' instead.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Data",
          style: "destructive",
          onPress: async () => {
            setDeletingPhoto(true);
            try {
              await deletePhotoData();
              Alert.alert("Done", "All photo-derived fingerprint data has been deleted.");
            } catch {
              Alert.alert("Error", "Could not delete photo data. Please try again.");
            } finally {
              setDeletingPhoto(false);
            }
          },
        },
      ]
    );
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const data = await downloadMyData();
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "rook-data-export.json"; a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          title: "Rook Data Export",
          message: json,
        });
      }
    } catch {
      Alert.alert("Error", "Could not generate your data export. Please try again.");
    } finally {
      setExporting(false);
    }
  }, []);

  const renderConsentBadge = () => {
    if (consentLoading) return <ActivityIndicator size="small" color="#64748B" />;
    if (!consent) return null;
    if (consent.hasConsent) {
      return (
        <View style={[styles.badge, { backgroundColor: "#064E3B" }]}>
          <Ionicons name="checkmark-circle" size={13} color="#34D399" />
          <Text style={[styles.badgeText, { color: "#34D399", fontFamily: "Inter_500Medium" }]}>
            Active — consented {formatDate(consent.consentedAt)}
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, { backgroundColor: "#431407" }]}>
        <Ionicons name="close-circle" size={13} color="#F87171" />
        <Text style={[styles.badgeText, { color: "#F87171", fontFamily: "Inter_500Medium" }]}>
          Not consented — photo scanning disabled
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Privacy & Data
        </Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Export section */}
        <SectionHeader title="Data Portability" subtitle="GDPR Article 20 — right to receive your personal data in a machine-readable format." colors={colors} />

        <Card colors={colors}>
          <ActionRow
            icon="download-outline"
            iconColor="#60A5FA"
            label="Download My Data"
            description="Includes your profile, connected accounts, scan history, threat records, and consent logs as JSON."
            loading={exporting}
            onPress={handleExport}
            colors={colors}
          />
        </Card>

        {/* Photo consent section */}
        <SectionHeader
          title="Photo Processing Consent"
          subtitle="Rook derives perceptual hash fingerprints and AI feature vectors from your profile photos to detect impersonation. This requires your explicit consent under Illinois BIPA, Texas CUBI, and GDPR Article 9."
          colors={colors}
        />

        <Card colors={colors}>
          <View style={styles.consentStatus}>
            <Text style={[styles.consentLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Current status
            </Text>
            {renderConsentBadge()}
          </View>

          {consent && consent.hasConsent && (
            <>
              <Divider colors={colors} />
              <ActionRow
                icon="trash-outline"
                iconColor="#EF4444"
                label="Withdraw Consent & Delete Photo Data"
                description="Deletes all fingerprints and embeddings derived from your photos within 24 hours. Photo-based scanning will be disabled. Text monitoring continues."
                loading={withdrawing}
                onPress={handleWithdraw}
                colors={colors}
                danger
              />
              <Divider colors={colors} />
              <ActionRow
                icon="document-outline"
                iconColor="#F59E0B"
                label="Delete Photo Data Only"
                description="Deletes fingerprint data but keeps your consent. Rook will re-fingerprint on the next scan."
                loading={deletingPhoto}
                onPress={handleDeletePhotoData}
                colors={colors}
              />
            </>
          )}

          {consent && !consent.hasConsent && (
            <>
              <Divider colors={colors} />
              <View style={styles.noConsentNote}>
                <Ionicons name="information-circle-outline" size={15} color={colors.mutedForeground} />
                <Text style={[styles.noConsentText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Photo scanning is disabled. To enable it, connect a social account — you'll be shown the consent notice before any photo processing begins.
                </Text>
              </View>
            </>
          )}
        </Card>

        {/* Legal note */}
        <TouchableOpacity onPress={() => router.push("/legal" as any)} style={styles.legalLink} activeOpacity={0.7}>
          <Ionicons name="document-text-outline" size={14} color="#60A5FA" />
          <Text style={[styles.legalLinkText, { color: "#60A5FA", fontFamily: "Inter_400Regular" }]}>
            Read the full Privacy Policy (Section 2: Biometric Data Notice) →
          </Text>
        </TouchableOpacity>

        {/* Retention note */}
        <View style={[styles.retentionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.retentionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Data retention summary
          </Text>
          <RetentionRow label="Photo fingerprints &amp; AI embeddings" value="Active account. Deleted within 30 days of account deletion or within 24 hours of consent withdrawal. Never kept beyond 3 years." colors={colors} />
          <RetentionRow label="Consent records" value="Retained 7 years as a legal compliance record (BIPA § 15(a))." colors={colors} />
          <RetentionRow label="Scan history &amp; threat alerts" value="30 days (Premium), 7 days (Pro), 1 day (Free)." colors={colors} />
          <RetentionRow label="Account data" value="Until account deletion. Backups purged within 30 days." colors={colors} last />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, colors }: { title: string; subtitle: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{title}</Text>
      <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{subtitle}</Text>
    </View>
  );
}

function Card({ colors, children }: { colors: ReturnType<typeof useColors>; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function Divider({ colors }: { colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function ActionRow({
  icon,
  iconColor,
  label,
  description,
  loading,
  onPress,
  colors,
  danger,
}: {
  icon: string;
  iconColor: string;
  label: string;
  description: string;
  loading?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading} activeOpacity={0.7} style={styles.actionRow}>
      <View style={[styles.actionIconWrap, { backgroundColor: iconColor + "20" }]}>
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Ionicons name={icon as any} size={18} color={iconColor} />
        )}
      </View>
      <View style={styles.actionContent}>
        <Text style={[styles.actionLabel, { color: danger ? "#EF4444" : colors.foreground, fontFamily: "Inter_500Medium" }]}>
          {label}
        </Text>
        <Text style={[styles.actionDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function RetentionRow({ label, value, colors, last }: { label: string; value: string; colors: ReturnType<typeof useColors>; last?: boolean }) {
  return (
    <View style={[styles.retentionRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[styles.retentionLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      <Text style={[styles.retentionValue, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17 },
  scroll: { padding: 16, gap: 8 },
  sectionHeader: { marginTop: 12, marginBottom: 8, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 13, marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, lineHeight: 18 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  divider: { height: 1, marginHorizontal: 16 },
  consentStatus: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  consentLabel: { fontSize: 13 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  actionIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionContent: { flex: 1, gap: 2 },
  actionLabel: { fontSize: 14 },
  actionDesc: { fontSize: 12, lineHeight: 17 },
  noConsentNote: { flexDirection: "row", gap: 8, padding: 14, alignItems: "flex-start" },
  noConsentText: { flex: 1, fontSize: 13, lineHeight: 19 },
  legalLink: { flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 10, paddingHorizontal: 4 },
  legalLinkText: { fontSize: 12, flex: 1 },
  retentionCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 8, gap: 0 },
  retentionTitle: { fontSize: 13, marginBottom: 10 },
  retentionRow: { paddingVertical: 10, gap: 3 },
  retentionLabel: { fontSize: 12 },
  retentionValue: { fontSize: 12, lineHeight: 17 },
});
