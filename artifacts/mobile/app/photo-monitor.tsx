import React, { useState, useCallback, useEffect } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import {
  getAccountMedia,
  getPhotoConsent,
  type AccountMediaItem,
} from "@/lib/api";
import { PhotoConsentModal } from "@/components/PhotoConsentModal";

const FALLBACK_COLORS: [string, string][] = [
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

interface AccountMediaState {
  loading: boolean;
  items: AccountMediaItem[];
  hasAccess: boolean;
  error?: string;
}

// ─── PhotoCell: shows a monitored photo with status/match badge ───────────────

function PhotoCell({
  photo,
  hasMatch,
  isReviewExample = false,
  onRemove,
}: {
  photo: { id: string; localUri: string };
  hasMatch: boolean;
  isReviewExample?: boolean;
  onRemove: () => void;
}) {
  const colors = useColors();
  const statusColor = isReviewExample
    ? colors.warning
    : hasMatch
    ? colors.danger
    : colors.primary;
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
          accessibilityLabel={isReviewExample ? "Dismiss review example" : "Remove monitored photo"}
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
            backgroundColor: statusColor + "22",
            borderColor: statusColor + "44",
          },
        ]}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor, fontFamily: "Inter_400Regular" }]}>
          {isReviewExample ? "Review Example" : hasMatch ? "Match" : "Monitored"}
        </Text>
      </View>
    </View>
  );
}

// ─── RealPostCell: shows an actual photo from a connected account ──────────────

function RealPostCell({
  item,
  index,
  selected,
  onToggle,
}: {
  item: AccountMediaItem;
  index: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  const [imgError, setImgError] = useState(false);
  const [c1, c2] = FALLBACK_COLORS[index % FALLBACK_COLORS.length]!;

  return (
    <TouchableOpacity style={styles.postCell} onPress={onToggle} activeOpacity={0.8}>
      <View
        style={[
          styles.postCellInner,
          {
            borderColor: selected ? colors.primary : "transparent",
            borderWidth: selected ? 2 : 0,
          },
        ]}
      >
        {imgError ? (
          <LinearGradient
            colors={[c1, c2]}
            style={[StyleSheet.absoluteFill, styles.fallbackGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialCommunityIcons name="image" size={20} color="#ffffff44" />
          </LinearGradient>
        ) : (
          <Image
            source={{ uri: item.thumbnailUrl || item.url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        )}
        {item.type === "video" && (
          <View style={styles.videoBadge}>
            <Ionicons name="play" size={10} color="#FFFFFF" />
          </View>
        )}
      </View>
      {selected && (
        <View style={[styles.checkOverlay, { backgroundColor: colors.primary }]}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── SkeletonCell: placeholder while media loads ─────────────────────────────

function SkeletonCell({ index }: { index: number }) {
  const colors = useColors();
  const [c1, c2] = FALLBACK_COLORS[index % FALLBACK_COLORS.length]!;
  return (
    <View style={styles.postCell}>
      <LinearGradient
        colors={[c1 + "55", c2 + "33"]}
        style={styles.postCellInner}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PhotoMonitorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    indexedPhotos,
    reviewerSamplePhoto,
    dismissReviewerSamplePhoto,
    addIndexedPhotos,
    removeIndexedPhoto,
    refreshData,
    threats,
    user,
  } = useApp();
  const params = useLocalSearchParams<{ justConnected?: string; platform?: string; accountId?: string }>();
  const justConnected = params.justConnected === "1";
  const connectedAccountId = params.accountId ?? "";
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [accountMedia, setAccountMedia] = useState<Record<string, AccountMediaState>>({});
  const [accountSelections, setAccountSelections] = useState<Record<string, Set<number>>>({});
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [photoConsent, setPhotoConsent] = useState<boolean | null>(null);
  const [showConsentNotice, setShowConsentNotice] = useState(false);

  const connectedAccounts = user.connectedAccounts;
  const accountIdsKey = connectedAccounts.map((a) => a.id).join(",");
  const accountAccessKey = connectedAccounts.map((a) => `${a.id}:${a.verified}`).join(",");

  const totalSelected = Object.values(accountSelections).reduce(
    (sum, s) => sum + s.size,
    0
  );
  // Approximate: Google Vision processes ~4 s / photo
  const estScanSecs = totalSelected * 4;
  const estScanLabel =
    estScanSecs < 60
      ? `~${estScanSecs}s`
      : `~${Math.ceil(estScanSecs / 60)}m`;

  const matchedPhotoIds = new Set(
    threats
      .filter((t) => t.type === "stolen_photo" && !t.resolved)
      .flatMap((t) => t.evidence.map((e) => e.id.replace(/^ev_/, "")))
  );
  const displayedPhotos = reviewerSamplePhoto
    ? [...indexedPhotos, reviewerSamplePhoto]
    : indexedPhotos;

  useFocusEffect(useCallback(() => {
    // Reviewer images can change on the server while this account stays signed
    // in. Refresh on entry rather than relying exclusively on login hydration.
    void refreshData();
  }, [refreshData]));

  useEffect(() => {
    getPhotoConsent()
      .then((status) => setPhotoConsent(status.hasConsent))
      .catch(() => setPhotoConsent(null));
  }, []);

  // Request account media only for ownership-verified accounts; manual usernames
  // support public web searches but grant no account-media access.
  useEffect(() => {
    // Account media is photo-derived data too. Do not even call the endpoint
    // until the server has confirmed active consent (and fail closed while it
    // is still loading or unavailable).
    if (photoConsent !== true) {
      setAccountMedia({});
      return;
    }
    if (connectedAccounts.length === 0) return;

    for (const account of connectedAccounts) {
      if (!account.verified) continue;
      setAccountMedia((prev) => {
        if (prev[account.id]) return prev;
        return { ...prev, [account.id]: { loading: true, items: [], hasAccess: false } };
      });

      getAccountMedia(account.id)
        .then((data) => {
          setAccountMedia((prev) => ({
            ...prev,
            [account.id]: { loading: false, items: data.items, hasAccess: data.hasAccess },
          }));
        })
        .catch(() => {
          setAccountMedia((prev) => ({
            ...prev,
            [account.id]: {
              loading: false,
              items: [],
              hasAccess: false,
              error: "Could not load photos",
            },
          }));
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIdsKey, accountAccessKey, photoConsent]);

  // ── Camera roll: pick photos and add to monitored list ───────────────────

  const pickPhotos = useCallback(async () => {
    if (addingPhotos) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Photo Access Needed",
        "Allow photo access in Settings to choose images for identity monitoring.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    setAddingPhotos(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsMultipleSelection: true,
        quality: 0.1,
        selectionLimit: 10,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addIndexedPhotos(
          result.assets.map((a) => ({ uri: a.uri, base64: a.base64 ?? undefined })),
          "camera_roll"
        );
        setAddedFeedback(`${result.assets.length} photo${result.assets.length !== 1 ? "s" : ""} added — will be scanned next time you run a scan`);
        setTimeout(() => setAddedFeedback(null), 4000);
      }
    } finally {
      setAddingPhotos(false);
    }
  }, [addingPhotos, addIndexedPhotos]);

  const handlePickPhotos = useCallback(async () => {
    if (photoConsent !== true) {
      setShowConsentNotice(true);
      return;
    }
    await pickPhotos();
  }, [photoConsent, pickPhotos]);

  // ── Account photos: select and add to monitored list ─────────────────────

  const toggleAccountPost = useCallback((accountId: string, index: number) => {
    setAccountSelections((prev) => {
      const existing = new Set(prev[accountId] ?? []);
      if (existing.has(index)) {
        existing.delete(index);
      } else {
        existing.add(index);
      }
      return { ...prev, [accountId]: existing };
    });
  }, []);

  const handleMonitorSelected = useCallback(
    (accountId: string, items: AccountMediaItem[]) => {
      const selected = accountSelections[accountId];
      if (!selected || selected.size === 0) return;
      if (photoConsent !== true) {
        setShowConsentNotice(true);
        return;
      }

      const selectedItems = Array.from(selected)
        .map((i) => items[i])
        .filter((item): item is AccountMediaItem => !!item);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      addIndexedPhotos(
        selectedItems.map((item) => ({ uri: item.url })),
        "account",
        accountId
      );

      setAccountSelections((prev) => ({ ...prev, [accountId]: new Set() }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddedFeedback(`${selectedItems.length} photo${selectedItems.length !== 1 ? "s" : ""} added — will be scanned next time you run a scan`);
      setTimeout(() => setAddedFeedback(null), 4000);
    },
    [accountSelections, addIndexedPhotos, photoConsent]
  );

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
          Choose photos for image matching across publicly available web pages when you run a scan. Manual usernames are checked through public web search; account media is only available after sign-in where the platform supports it.
        </Text>

        {/* Welcome banner: shown after OAuth connect */}
        {justConnected && !welcomeDismissed && (
          <View style={[styles.welcomeBanner, { backgroundColor: colors.primary + "1A", borderColor: colors.primary + "44" }]}>
            <View style={styles.welcomeRow}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Text style={[styles.welcomeTitle, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                Account connected!
              </Text>
              <TouchableOpacity
                onPress={() => setWelcomeDismissed(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.welcomeDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Select photos below to start monitoring them. Tap "Monitor" when ready — they'll be protected on your next scan.
            </Text>
          </View>
        )}

        {/* Feedback banner */}
        {addedFeedback && (
          <View style={[styles.feedbackBanner, { backgroundColor: colors.success + "18", borderColor: colors.success + "44" }]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.feedbackText, { color: colors.success, fontFamily: "Inter_500Medium" }]}>
              {addedFeedback}
            </Text>
          </View>
        )}

        {/* ── Your Monitored Photos ──────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="image-search" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Monitored Photos
          </Text>
          {indexedPhotos.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primary + "22" }]}>
              <Text style={[styles.countText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                {indexedPhotos.length}
              </Text>
            </View>
          )}
        </View>

        {displayedPhotos.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "18" }]}>
              <MaterialCommunityIcons name="image-plus" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              No photos added yet
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Upload from your camera roll or select from a connected account below.
            </Text>
          </GlassCard>
        ) : (
          <GlassCard style={styles.photoGridCard}>
            <View style={styles.photoGrid}>
              {displayedPhotos.map((photo) => {
                const isReviewExample = photo.source === "review_example";
                return (
                  <PhotoCell
                    key={photo.id}
                    photo={photo}
                    hasMatch={!isReviewExample && matchedPhotoIds.has(photo.id)}
                    isReviewExample={isReviewExample}
                    onRemove={() => {
                      if (isReviewExample) {
                        void dismissReviewerSamplePhoto().then((saved) => {
                          if (!saved) {
                            Alert.alert(
                              "Dismissal Not Saved",
                              "The Review Example is hidden for this session, but we couldn't save your dismissal. It may appear again next time."
                            );
                          }
                        });
                      } else {
                        removeIndexedPhoto(photo.id);
                      }
                    }}
                  />
                );
              })}
            </View>
            {reviewerSamplePhoto && (
              <View style={styles.reviewExampleNote}>
                <Ionicons name="information-circle-outline" size={15} color={colors.warning} />
                <Text style={[styles.reviewExampleNoteText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Review Example is for review only; it is not monitored or analyzed.
                </Text>
              </View>
            )}
          </GlassCard>
        )}

        {/* ── Camera Roll button ──────────────────────────────────────────── */}
        <TouchableOpacity
          style={[
            styles.addBtn,
            {
              backgroundColor: colors.primary,
              opacity: addingPhotos ? 0.7 : 1,
            },
          ]}
          activeOpacity={0.85}
          onPress={handlePickPhotos}
          disabled={addingPhotos}
        >
          {addingPhotos ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={[styles.addBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                Opening Library…
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="images" size={20} color="#FFFFFF" />
              <Text style={[styles.addBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                Add from Camera Roll
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Import from Connected Accounts ─────────────────────────────── */}
        {connectedAccounts.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 8 }]}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Import from Accounts
              </Text>
              {totalSelected > 0 && (
                <View style={[styles.selectionBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.selectionBadgeText, { fontFamily: "Inter_700Bold" }]}>
                    {totalSelected} selected
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.importDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Select media from signed-in accounts where the platform allows access. Manually added usernames do not provide account or photo access; those are checked through public web search instead.
            </Text>

            {connectedAccounts.map((account) => {
              const mediaState = accountMedia[account.id] ?? {
                loading: false,
                items: [],
                hasAccess: false,
              };
              const selected = accountSelections[account.id] ?? new Set<number>();
              const selectedCount = selected.size;

              const isNewAccount = justConnected && connectedAccountId === account.id;

              return (
                <GlassCard
                  key={account.id}
                  style={[
                    styles.accountCard,
                    isNewAccount && { borderColor: colors.primary + "66", borderWidth: 1.5 },
                  ]}
                >
                  {/* Account header */}
                  <View style={styles.accountHeader}>
                    <PlatformIcon platform={account.platform!} size={32} />
                    <View style={styles.accountInfo}>
                      <Text style={[styles.accountUsername, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        @{account.username}
                      </Text>
                      <Text style={[styles.accountPlatform, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {account.platform}
                        {account.verified && mediaState.items.length > 0
                          ? ` · ${mediaState.items.length} photos`
                          : account.verified && account.photosIndexed > 0
                          ? ` · ${account.photosIndexed} indexed`
                          : account.verified
                          ? ""
                          : " · Manual entry"}
                      </Text>
                    </View>
                    {mediaState.loading && (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                  </View>

                  {/* Media content */}
                  {!account.verified ? (
                    <View style={styles.noAccessRow}>
                      <Ionicons name="search-outline" size={15} color={colors.primary} />
                      <Text style={[styles.noAccessText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        This username is monitored through public web searches. Rook is not connected to the account and cannot import its photos or posts.
                      </Text>
                    </View>
                  ) : mediaState.loading ? (
                    <View style={styles.postGrid}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonCell key={i} index={i} />
                      ))}
                    </View>
                  ) : mediaState.error ? (
                    <View style={styles.noAccessRow}>
                      <Ionicons name="alert-circle-outline" size={15} color={colors.mutedForeground} />
                      <Text style={[styles.noAccessText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        Could not load photos from this account. Try again later.
                      </Text>
                    </View>
                  ) : !mediaState.hasAccess ? (
                    <View style={styles.noAccessRow}>
                      <Ionicons name="lock-closed-outline" size={15} color={colors.mutedForeground} />
                      <Text style={[styles.noAccessText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        Account media is not available for this connection. You can add photos from your camera roll or continue with public web-search monitoring.
                      </Text>
                    </View>
                  ) : mediaState.items.length === 0 ? (
                    <Text style={[styles.noAccessText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      No photos found on this account.
                    </Text>
                  ) : (
                    <View style={styles.postGrid}>
                      {mediaState.items.map((item, i) => (
                        <RealPostCell
                          key={item.id}
                          item={item}
                          index={i}
                          selected={selected.has(i)}
                          onToggle={() => toggleAccountPost(account.id, i)}
                        />
                      ))}
                    </View>
                  )}

                  {/* Monitor button — only shown when media is accessible */}
                  {mediaState.hasAccess && mediaState.items.length > 0 && (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.monitorBtn,
                          {
                            backgroundColor: selectedCount > 0 ? colors.primary : colors.secondary,
                            borderColor: selectedCount > 0 ? colors.primary : colors.border,
                          },
                        ]}
                        activeOpacity={0.85}
                        onPress={() => handleMonitorSelected(account.id, mediaState.items)}
                        disabled={selectedCount === 0}
                      >
                        <MaterialCommunityIcons
                          name="image-check"
                          size={18}
                          color={selectedCount > 0 ? "#FFFFFF" : colors.mutedForeground}
                        />
                        <Text
                          style={[
                            styles.monitorBtnText,
                            {
                              color: selectedCount > 0 ? "#FFFFFF" : colors.mutedForeground,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          {selectedCount > 0
                            ? `Monitor ${selectedCount} Photo${selectedCount !== 1 ? "s" : ""}`
                            : "Select photos to monitor"}
                        </Text>
                      </TouchableOpacity>
                      {selectedCount > 0 && estScanSecs > 0 && (
                        <Text style={[styles.scanEstimate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          Est. scan time for selected: {estScanLabel}
                        </Text>
                      )}
                    </>
                  )}
                </GlassCard>
              );
            })}
          </>
        )}

        {/* ── Info card ──────────────────────────────────────────────────── */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="scan-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Photos you add are searched across publicly available web pages when you run a scan. A manually entered username is checked through public web search only; it does not grant account or media access.
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 10 }]}>
            <Ionicons name="phone-portrait-outline" size={18} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Camera roll photos are processed securely and used only for your scans. Go to the Scan tab and tap Start Full Scan to run now.
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
      <PhotoConsentModal
        visible={showConsentNotice}
        onSkip={() => setShowConsentNotice(false)}
        onConsent={() => {
          setPhotoConsent(true);
          setShowConsentNotice(false);
        }}
      />
    </View>
  );
}

const CELL_SIZE = 96;
const POST_CELL_SIZE = 80;

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
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  countText: { fontSize: 13 },

  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 18 },

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
  reviewExampleNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10 },
  reviewExampleNoteText: { flex: 1, fontSize: 12, lineHeight: 16 },
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

  postGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  postCell: { position: "relative" },
  postCellInner: {
    width: POST_CELL_SIZE,
    height: POST_CELL_SIZE,
    borderRadius: 8,
    overflow: "hidden",
  },
  fallbackGradient: {
    alignItems: "center",
    justifyContent: "center",
  },
  videoBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    padding: 3,
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

  noAccessRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  noAccessText: { flex: 1, fontSize: 13, lineHeight: 18 },

  monitorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    marginTop: 2,
  },
  monitorBtnText: { fontSize: 14 },

  infoCard: { gap: 0 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },

  welcomeBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  welcomeTitle: { flex: 1, fontSize: 15 },
  welcomeDesc: { fontSize: 13, lineHeight: 18 },

  selectionBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectionBadgeText: { fontSize: 12, color: "#FFFFFF" },

  scanEstimate: { fontSize: 12, textAlign: "center", marginTop: 6 },
});
