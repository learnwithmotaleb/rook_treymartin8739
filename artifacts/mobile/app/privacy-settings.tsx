/**
 * Privacy & Data Settings screen
 * ─────────────────────────────
 * Provides GDPR Art. 20 data portability export, BIPA / GDPR consent management,
 * and photo-derived data deletion — without requiring full account deletion.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { useApp } from "@/context/AppContext";
import { PhotoConsentModal } from "@/components/PhotoConsentModal";

type ConsentStatus = {
  hasConsent: boolean;
  consentedAt: string | null;
  consentVersion: string | null;
};

export default function PrivacySettings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { clearIndexedPhotos } = useApp();

  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [consentLoading, setConsentLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showConsentNotice, setShowConsentNotice] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"withdraw" | "delete" | null>(null);
  const [confirmCoolingDown, setConfirmCoolingDown] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

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
    if (confirmCoolingDown) return;
    setFeedback(null);
    setConfirmAction("withdraw");
  }, [confirmCoolingDown]);

  const handleDeletePhotoData = useCallback(() => {
    if (confirmCoolingDown) return;
    setFeedback(null);
    setConfirmAction("delete");
  }, [confirmCoolingDown]);

  const dismissConfirmation = useCallback(() => {
    setConfirmAction(null);
    setConfirmCoolingDown(true);
    setTimeout(() => setConfirmCoolingDown(false), 400);
  }, []);

  const handleConfirmDestructiveAction = useCallback(async () => {
    const action = confirmAction;
    if (!action) return;
    dismissConfirmation();
    setFeedback(null);

    if (action === "withdraw") {
      setWithdrawing(true);
      let serverWithdrawalSucceeded = false;
      try {
        await withdrawPhotoConsent();
        serverWithdrawalSucceeded = true;
        await clearIndexedPhotos();
        await fetchConsent();
        setFeedback({
          kind: "success",
          text: "Consent withdrawn. Photo-derived data was deleted and photo scanning is disabled.",
        });
      } catch {
        setFeedback({
          kind: "error",
          text: serverWithdrawalSucceeded
            ? "Consent was withdrawn and server photo data was deleted, but local photo cleanup could not be confirmed. Please try again."
            : "Could not withdraw consent. Please try again.",
        });
      } finally {
        setWithdrawing(false);
      }
      return;
    }

    setDeletingPhoto(true);
    let serverDeletionSucceeded = false;
    try {
      await deletePhotoData();
      serverDeletionSucceeded = true;
      await clearIndexedPhotos();
      setFeedback({
        kind: "success",
        text: "Photo-derived data was deleted. Your consent remains active.",
      });
    } catch {
      setFeedback({
        kind: "error",
        text: serverDeletionSucceeded
          ? "Server photo data was deleted, but local photo cleanup could not be confirmed. Please try again."
          : "Could not delete photo data. Please try again.",
      });
    } finally {
      setDeletingPhoto(false);
    }
  }, [clearIndexedPhotos, confirmAction, dismissConfirmation, fetchConsent]);

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
      setFeedback({ kind: "error", text: "Could not generate your data export. Please try again." });
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
        {feedback && (
          <View
            accessibilityRole="alert"
            style={[
              styles.feedback,
              {
                backgroundColor: feedback.kind === "success" ? "#064E3B" : "#450A0A",
                borderColor: feedback.kind === "success" ? "#10B981" : "#EF4444",
              },
            ]}
          >
            <Ionicons
              name={feedback.kind === "success" ? "checkmark-circle" : "alert-circle"}
              size={18}
              color={feedback.kind === "success" ? "#34D399" : "#F87171"}
            />
            <Text style={[styles.feedbackText, { fontFamily: "Inter_500Medium" }]}>
              {feedback.text}
            </Text>
          </View>
        )}
        {/* Export section */}
        <SectionHeader title="Data Portability" subtitle="GDPR Article 20 — right to receive your personal data in a machine-readable format." colors={colors} />

        <Card colors={colors}>
          <ActionRow
            icon="download-outline"
            iconColor="#60A5FA"
            label="Download My Data"
            description="Includes your profile and avatar, account metadata (never OAuth secrets), scan history, consent logs, and photo-derived records as JSON."
            loading={exporting}
            onPress={handleExport}
            colors={colors}
          />
        </Card>

        {/* Photo consent section */}
        <SectionHeader
          title="Photo Processing Consent"
          subtitle="Rook uses AI to analyze your profile photos for identity monitoring. This processing requires your explicit consent under Illinois BIPA, Texas CUBI, and GDPR Article 9."
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
                 description="Deletes photo hashes, image URLs in alert evidence, embeddings, visual fingerprints, and your stored avatar from Rook's active systems. Photo scanning is disabled; text monitoring continues."
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
                 description="Deletes photo hashes, image URLs in alert evidence, embeddings, visual fingerprints, and your stored avatar from Rook's active systems. Consent remains active; new photo processing may resume on a later scan."
                loading={deletingPhoto}
                onPress={handleDeletePhotoData}
                colors={colors}
              />
            </>
          )}

          {!consentLoading && !consent?.hasConsent && (
            <>
              <Divider colors={colors} />
              <ActionRow
                icon="shield-checkmark-outline"
                iconColor="#A78BFA"
                label="Review Notice & Enable Photo Scanning"
                description="Review the required disclosure and explicitly opt in. No photos are processed unless consent is successfully recorded."
                onPress={() => {
                  setFeedback(null);
                  setShowConsentNotice(true);
                }}
                colors={colors}
              />
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
          <RetentionRow label="Face and photo data" value="Images may contain faces, but Rook does not extract facial geometry or create face templates. Photo hashes, image URLs in alert evidence, embeddings, fingerprints, and the stored avatar are deleted from active systems when requested. Backups are purged within 30 days where applicable." colors={colors} />
          <RetentionRow label="Consent records" value="Retained 7 years as a legal compliance record (BIPA § 15(a))." colors={colors} />
          <RetentionRow label="Scan history &amp; threat alerts" value="30 days for the current Free and Premium plans." colors={colors} />
          <RetentionRow label="Account data" value="Until account deletion. Backups purged within 30 days." colors={colors} last />
        </View>
      </ScrollView>
      <PhotoConsentModal
        visible={showConsentNotice}
        onConsent={() => {
          setShowConsentNotice(false);
          setFeedback(null);
          void fetchConsent();
        }}
        onSkip={() => setShowConsentNotice(false)}
      />
      <Modal
        visible={confirmAction !== null}
        transparent
        animationType="fade"
        onRequestClose={dismissConfirmation}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.confirmSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.confirmIcon}>
              <Ionicons name="warning-outline" size={28} color="#EF4444" />
            </View>
            <Text style={[styles.confirmTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {confirmAction === "withdraw" ? "Withdraw Photo Processing Consent" : "Delete Photo Data"}
            </Text>
            <Text style={[styles.confirmBody, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {confirmAction === "withdraw"
                ? "This will delete all photo-derived data and disable photo-based scanning. Text and username monitoring will continue. You can re-consent later."
                : "This deletes stored media records, hashes, embeddings, image URLs in alert evidence, visual fingerprints, and your avatar. Consent remains active, so new photo processing may resume on a later scan."}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.destructiveButton}
              onPress={() => void handleConfirmDestructiveAction()}
            >
              <Text style={[styles.destructiveButtonText, { fontFamily: "Inter_700Bold" }]}>
                {confirmAction === "withdraw" ? "Withdraw & Delete" : "Delete Data"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.cancelButton}
              onPress={dismissConfirmation}
            >
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  feedback: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  feedbackText: { flex: 1, color: "#E2E8F0", fontSize: 13, lineHeight: 19 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 24 },
  confirmSheet: { width: "100%", maxWidth: 420, borderRadius: 20, borderWidth: 1, padding: 22, alignItems: "center", gap: 14 },
  confirmIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#EF444422", alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontSize: 20, textAlign: "center" },
  confirmBody: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  destructiveButton: { width: "100%", minHeight: 50, borderRadius: 14, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", marginTop: 4 },
  destructiveButtonText: { color: "#FFFFFF", fontSize: 15 },
  cancelButton: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
});
