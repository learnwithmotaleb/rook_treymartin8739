import React, { useState, useCallback } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp, type IndexedPhoto } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";

const MOCK_POST_COLORS = [
  ["#1e3a5f", "#2563eb"],
  ["#1a2e1a", "#16a34a"],
  ["#3a1a2e", "#9333ea"],
  ["#2e1a1a", "#dc2626"],
  ["#1a2e3a", "#0891b2"],
  ["#2e2a1a", "#d97706"],
  ["#1e1e3a", "#6366f1"],
  ["#2a1a2e", "#ec4899"],
  ["#1a3a2e", "#059669"],
];

function PhotoCell({
  photo,
  hasMatch,
  onRemove,
}: {
  photo: IndexedPhoto;
  hasMatch: boolean;
  onRemove: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.photoCell}>
      <View style={[styles.photoCellInner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Image
          source={{ uri: photo.localUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[styles.removeBtnInner, { backgroundColor: colors.background + "CC" }]}>
            <Ionicons name="close" size={12} color={colors.foreground} />
          </View>
        </TouchableOpacity>
      </View>
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor: hasMatch ? colors.danger + "22" : colors.primary + "22",
            borderColor: hasMatch ? colors.danger + "44" : colors.primary + "44",
          },
        ]}
      >
        <View style={[styles.statusDot, { backgroundColor: hasMatch ? colors.danger : colors.primary }]} />
        <Text style={[styles.statusText, { color: hasMatch ? colors.danger : colors.primary, fontFamily: "Inter_400Regular" }]}>
          {hasMatch ? "Match" : "Monitoring"}
        </Text>
      </View>
    </View>
  );
}

function MockPostCell({
  index,
  selected,
  onToggle,
}: {
  index: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  const [c1, c2] = MOCK_POST_COLORS[index % MOCK_POST_COLORS.length]!;
  return (
    <TouchableOpacity style={styles.mockCell} onPress={onToggle} activeOpacity={0.8}>
      <LinearGradient
        colors={[c1, c2]}
        style={[styles.mockCellInner, { borderColor: selected ? colors.primary : "transparent", borderWidth: selected ? 2 : 0 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <MaterialCommunityIcons name="image" size={22} color="#ffffff44" />
      </LinearGradient>
      {selected && (
        <View style={[styles.checkOverlay, { backgroundColor: colors.primary }]}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function PhotoMonitorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { indexedPhotos, addIndexedPhotos, removeIndexedPhoto, threats, user } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [accountSelections, setAccountSelections] = useState<Record<string, Set<number>>>({});
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [monitoringAccount, setMonitoringAccount] = useState<string | null>(null);

  const matchedPhotoIds = new Set(
    threats
      .filter((t) => t.type === "stolen_photo" && !t.resolved)
      .flatMap((t) => t.evidence.map((e) => e.id.replace(/^ev_/, "")))
  );

  const handlePickPhotos = useCallback(async () => {
    if (addingPhotos) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    setAddingPhotos(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 20,
      });
      if (!result.canceled && result.assets.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addIndexedPhotos(result.assets.map((a) => a.uri), "camera_roll");
      }
    } finally {
      setAddingPhotos(false);
    }
  }, [addingPhotos, addIndexedPhotos]);

  const toggleMockPost = (accountId: string, index: number) => {
    setAccountSelections((prev) => {
      const existing = new Set(prev[accountId] ?? []);
      if (existing.has(index)) {
        existing.delete(index);
      } else {
        existing.add(index);
      }
      return { ...prev, [accountId]: existing };
    });
  };

  const handleMonitorSelected = (accountId: string) => {
    const selected = accountSelections[accountId];
    if (!selected || selected.size === 0) return;
    setMonitoringAccount(accountId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const mockUris = Array.from(selected).map(
      (i) => `mock://account/${accountId}/post/${i}`
    );
    addIndexedPhotos(mockUris, "account", accountId);
    setAccountSelections((prev) => ({ ...prev, [accountId]: new Set() }));
    setTimeout(() => setMonitoringAccount(null), 1500);
  };

  const connectedAccounts = user.connectedAccounts;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary + "18", "transparent"]}
        style={styles.topGradient}
      />

      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Photo Monitor
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
      >
        <Text style={[styles.sectionDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Upload photos from your camera roll or import from connected accounts. ShieldID monitors for unauthorized use across all major platforms.
        </Text>

        {/* Your Photos */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="image-search" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Your Photos
          </Text>
          {indexedPhotos.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primary + "22" }]}>
              <Text style={[styles.countText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                {indexedPhotos.length}
              </Text>
            </View>
          )}
        </View>

        {indexedPhotos.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "18" }]}>
              <MaterialCommunityIcons name="image-plus" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              No photos indexed yet
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Add photos from your camera roll or import from a connected account to start monitoring.
            </Text>
          </GlassCard>
        ) : (
          <GlassCard style={styles.photoGridCard}>
            <View style={styles.photoGrid}>
              {indexedPhotos.map((photo) => (
                <PhotoCell
                  key={photo.id}
                  photo={photo}
                  hasMatch={matchedPhotoIds.has(photo.id)}
                  onRemove={() => removeIndexedPhoto(photo.id)}
                />
              ))}
            </View>
          </GlassCard>
        )}

        {/* Add from Camera Roll */}
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary, opacity: addingPhotos ? 0.7 : 1 }]}
          activeOpacity={0.85}
          onPress={handlePickPhotos}
          disabled={addingPhotos}
        >
          <Ionicons name={addingPhotos ? "hourglass" : "images"} size={20} color="#FFFFFF" />
          <Text style={[styles.addBtnText, { fontFamily: "Inter_600SemiBold" }]}>
            {addingPhotos ? "Opening Library…" : "Add from Camera Roll"}
          </Text>
        </TouchableOpacity>

        {/* Import from Connected Accounts */}
        {connectedAccounts.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 8 }]}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Import from Account
              </Text>
            </View>
            <Text style={[styles.importDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Select posts from your connected accounts to include in monitoring.
            </Text>

            {connectedAccounts.map((account) => {
              const selected = accountSelections[account.id] ?? new Set();
              const selectedCount = selected.size;
              const isMonitoring = monitoringAccount === account.id;

              return (
                <GlassCard key={account.id} style={styles.accountCard}>
                  <View style={styles.accountHeader}>
                    <PlatformIcon platform={account.platform!} size={32} />
                    <View style={styles.accountInfo}>
                      <Text style={[styles.accountUsername, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        @{account.username}
                      </Text>
                      <Text style={[styles.accountPlatform, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {account.platform} · {account.photosIndexed} photos indexed
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.mockGridLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    Recent posts (preview)
                  </Text>

                  <View style={styles.mockGrid}>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <MockPostCell
                        key={i}
                        index={i}
                        selected={selected.has(i)}
                        onToggle={() => toggleMockPost(account.id, i)}
                      />
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.monitorBtn,
                      {
                        backgroundColor: selectedCount > 0 ? colors.primary : colors.secondary,
                        borderColor: selectedCount > 0 ? colors.primary : colors.border,
                        opacity: isMonitoring ? 0.7 : 1,
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => handleMonitorSelected(account.id)}
                    disabled={selectedCount === 0 || isMonitoring}
                  >
                    {isMonitoring ? (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                        <Text style={[styles.monitorBtnText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
                          Added to monitoring!
                        </Text>
                      </>
                    ) : (
                      <>
                        <MaterialCommunityIcons name="radar" size={18} color={selectedCount > 0 ? "#FFFFFF" : colors.mutedForeground} />
                        <Text
                          style={[
                            styles.monitorBtnText,
                            { color: selectedCount > 0 ? "#FFFFFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
                          ]}
                        >
                          {selectedCount > 0 ? `Monitor Selected (${selectedCount})` : "Select posts to monitor"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </GlassCard>
              );
            })}
          </>
        )}

        {/* Info card */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Photos are stored locally on your device and never uploaded to ShieldID servers. We use on-device fingerprinting for privacy-safe monitoring.
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const CELL_SIZE = 100;

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 300 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, alignItems: "flex-start" },
  headerTitle: { flex: 1, fontSize: 20, textAlign: "center" },
  headerRight: { width: 36 },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },

  sectionDesc: { fontSize: 14, lineHeight: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  sectionTitle: { fontSize: 16, flex: 1 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countText: { fontSize: 13 },

  emptyCard: { alignItems: "center", gap: 10, paddingVertical: 28 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 16 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  photoGridCard: { paddingBottom: 8 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoCell: { gap: 4 },
  photoCellInner: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
  },
  removeBtn: { position: "absolute", top: 4, right: 4 },
  removeBtnInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 28,
  },
  addBtnText: { fontSize: 16, color: "#FFFFFF" },

  importDesc: { fontSize: 13, lineHeight: 18, marginTop: -6 },
  accountCard: { gap: 12 },
  accountHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  accountInfo: { flex: 1 },
  accountUsername: { fontSize: 15 },
  accountPlatform: { fontSize: 13, marginTop: 2, textTransform: "capitalize" },
  mockGridLabel: { fontSize: 12 },
  mockGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  mockCell: { position: "relative" },
  mockCellInner: {
    width: 78,
    height: 78,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  checkOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  monitorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
  },
  monitorBtnText: { fontSize: 14 },

  infoCard: { gap: 0 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
