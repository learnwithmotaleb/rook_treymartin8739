import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
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
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import {
  getAccountMedia,
  reverseImageSearch,
  checkIsDemoUser,
  type AccountMediaItem,
} from "@/lib/api";

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

interface SearchResult {
  totalSearched: number;
  matchesFound: number;
  threatsCreated: number;
  error?: string;
}

// ─── PhotoCell: shows an indexed (local) photo with monitoring/match badge ────

function PhotoCell({
  photo,
  hasMatch,
  onRemove,
}: {
  photo: { id: string; localUri: string };
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

// ─── SearchResultBanner: shows after a reverse image search completes ─────────

function SearchResultBanner({ result, onDismiss }: { result: SearchResult; onDismiss: () => void }) {
  const colors = useColors();
  const hasThreats = result.threatsCreated > 0;
  const hasError = !!result.error;

  return (
    <View
      style={[
        styles.resultBanner,
        {
          backgroundColor: hasError
            ? colors.secondary
            : hasThreats
            ? colors.danger + "18"
            : colors.success + "18",
          borderColor: hasError
            ? colors.border
            : hasThreats
            ? colors.danger + "44"
            : colors.success + "44",
        },
      ]}
    >
      <Ionicons
        name={hasError ? "alert-circle" : hasThreats ? "warning" : "checkmark-circle"}
        size={20}
        color={hasError ? colors.mutedForeground : hasThreats ? colors.danger : colors.success}
      />
      <View style={{ flex: 1 }}>
        {hasError ? (
          <Text style={[styles.resultTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            {result.error}
          </Text>
        ) : hasThreats ? (
          <>
            <Text style={[styles.resultTitle, { color: colors.danger, fontFamily: "Inter_600SemiBold" }]}>
              {result.threatsCreated} unauthorized use{result.threatsCreated !== 1 ? "s" : ""} detected
            </Text>
            <Text style={[styles.resultDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Check the Alerts tab for details on who's using your photos.
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.resultTitle, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
              {result.totalSearched} photo{result.totalSearched !== 1 ? "s" : ""} searched — no matches found
            </Text>
            <Text style={[styles.resultDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Your photos weren't found on any other profiles. Good news!
            </Text>
          </>
        )}
      </View>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PhotoMonitorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { indexedPhotos, addIndexedPhotos, removeIndexedPhoto, threats, user, refreshData } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [accountMedia, setAccountMedia] = useState<Record<string, AccountMediaState>>({});
  const [accountSelections, setAccountSelections] = useState<Record<string, Set<number>>>({});
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [searching, setSearching] = useState(false);
  const [monitoringAccount, setMonitoringAccount] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isDemoUser, setIsDemoUser] = useState<boolean | null>(null);

  const connectedAccounts = user.connectedAccounts;
  const accountIdsKey = connectedAccounts.map((a) => a.id).join(",");

  // Check if demo user once on mount
  useEffect(() => {
    checkIsDemoUser().then(setIsDemoUser);
  }, []);

  // Fetch real media for each connected account when demo status is known
  useEffect(() => {
    if (isDemoUser === null) return;
    if (connectedAccounts.length === 0) return;

    for (const account of connectedAccounts) {
      // Don't re-fetch if already loading or loaded
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
  }, [accountIdsKey, isDemoUser]);

  const matchedPhotoIds = new Set(
    threats
      .filter((t) => t.type === "stolen_photo" && !t.resolved)
      .flatMap((t) => t.evidence.map((e) => e.id.replace(/^ev_/, "")))
  );

  // ── Camera roll: pick photos, get base64, run reverse image search ────────

  const handlePickPhotos = useCallback(async () => {
    if (addingPhotos || searching) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    setAddingPhotos(true);
    setSearchResult(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsMultipleSelection: true,
        quality: 0.6,
        selectionLimit: 10,
        base64: isDemoUser === false, // Only fetch base64 if we can actually search
      });

      if (!result.canceled && result.assets.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addIndexedPhotos(result.assets.map((a) => a.uri), "camera_roll");

        // Search if authenticated (not demo user) and base64 available
        if (isDemoUser === false) {
          setSearching(true);
          let totalMatches = 0;
          let totalThreats = 0;
          let searchError: string | undefined;

          for (const asset of result.assets) {
            if (!asset.base64) continue;
            try {
              const res = await reverseImageSearch({ imageBase64: asset.base64 });
              if (res.configured) {
                totalMatches += res.matches.length;
                totalThreats += res.threatsCreated;
              }
            } catch {
              searchError = "Search failed for one or more photos.";
            }
          }

          if (totalThreats > 0) await refreshData();

          Haptics.notificationAsync(
            totalThreats > 0
              ? Haptics.NotificationFeedbackType.Warning
              : Haptics.NotificationFeedbackType.Success
          );

          setSearchResult({
            totalSearched: result.assets.length,
            matchesFound: totalMatches,
            threatsCreated: totalThreats,
            error: searchError,
          });
          setSearching(false);
        }
      }
    } finally {
      setAddingPhotos(false);
      setSearching(false);
    }
  }, [addingPhotos, searching, isDemoUser, addIndexedPhotos, refreshData]);

  // ── Account photos: select CDN-hosted posts, run reverse image search ─────

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
    async (accountId: string, items: AccountMediaItem[]) => {
      const selected = accountSelections[accountId];
      if (!selected || selected.size === 0 || searching) return;

      const selectedItems = Array.from(selected)
        .map((i) => items[i])
        .filter((item): item is AccountMediaItem => !!item);

      setSearching(true);
      setMonitoringAccount(accountId);
      setSearchResult(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let totalMatches = 0;
      let totalThreats = 0;
      let searchError: string | undefined;

      try {
        // Register photos locally for tracking
        addIndexedPhotos(
          selectedItems.map((item) => item.url),
          "account",
          accountId
        );

        // Reverse search each selected photo's CDN URL
        for (const item of selectedItems) {
          try {
            const res = await reverseImageSearch({ imageUrl: item.url });
            if (res.configured) {
              totalMatches += res.matches.length;
              totalThreats += res.threatsCreated;
            }
          } catch {
            searchError = "Search failed for one or more photos.";
          }
        }

        if (totalThreats > 0) await refreshData();

        setAccountSelections((prev) => ({ ...prev, [accountId]: new Set() }));
        Haptics.notificationAsync(
          totalThreats > 0
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success
        );
        setSearchResult({
          totalSearched: selectedItems.length,
          matchesFound: totalMatches,
          threatsCreated: totalThreats,
          error: searchError,
        });
      } catch {
        setSearchResult({
          totalSearched: selectedItems.length,
          matchesFound: 0,
          threatsCreated: 0,
          error: "Search failed. Please try again.",
        });
      } finally {
        setSearching(false);
        setMonitoringAccount(null);
      }
    },
    [accountSelections, searching, addIndexedPhotos, refreshData]
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
          Upload photos or import from connected accounts. ShieldID uses Google reverse image search to find unauthorized use across the web.
        </Text>

        {/* Search result banner */}
        {searchResult && (
          <SearchResultBanner
            result={searchResult}
            onDismiss={() => setSearchResult(null)}
          />
        )}

        {/* ── Your Photos ────────────────────────────────────────────────── */}
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
              Add photos from your camera roll or select from a connected account below.
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

        {/* ── Camera Roll button ──────────────────────────────────────────── */}
        <TouchableOpacity
          style={[
            styles.addBtn,
            {
              backgroundColor: colors.primary,
              opacity: addingPhotos || searching ? 0.7 : 1,
            },
          ]}
          activeOpacity={0.85}
          onPress={handlePickPhotos}
          disabled={addingPhotos || searching}
        >
          {searching && !monitoringAccount ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={[styles.addBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                Searching…
              </Text>
            </>
          ) : (
            <>
              <Ionicons name={addingPhotos ? "hourglass" : "images"} size={20} color="#FFFFFF" />
              <Text style={[styles.addBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                {addingPhotos ? "Opening Library…" : "Add & Search from Camera Roll"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {isDemoUser === true && (
          <Text style={[styles.demoNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Sign in to enable reverse image search — photos will be searched across the web for unauthorized use.
          </Text>
        )}

        {/* ── Import from Connected Accounts ─────────────────────────────── */}
        {connectedAccounts.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 8 }]}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Import from Accounts
              </Text>
            </View>
            <Text style={[styles.importDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Select photos from your connected accounts to search for unauthorized use on other platforms.
            </Text>

            {connectedAccounts.map((account) => {
              const mediaState = accountMedia[account.id] ?? {
                loading: false,
                items: [],
                hasAccess: false,
              };
              const selected = accountSelections[account.id] ?? new Set<number>();
              const selectedCount = selected.size;
              const isThisAccountSearching = searching && monitoringAccount === account.id;

              return (
                <GlassCard key={account.id} style={styles.accountCard}>
                  {/* Account header */}
                  <View style={styles.accountHeader}>
                    <PlatformIcon platform={account.platform!} size={32} />
                    <View style={styles.accountInfo}>
                      <Text style={[styles.accountUsername, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        @{account.username}
                      </Text>
                      <Text style={[styles.accountPlatform, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {account.platform}
                        {mediaState.items.length > 0
                          ? ` · ${mediaState.items.length} photos`
                          : account.photosIndexed > 0
                          ? ` · ${account.photosIndexed} indexed`
                          : ""}
                      </Text>
                    </View>
                    {mediaState.loading && (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                  </View>

                  {/* Media content */}
                  {mediaState.loading ? (
                    <View style={styles.postGrid}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonCell key={i} index={i} />
                      ))}
                    </View>
                  ) : !mediaState.hasAccess ? (
                    <View style={styles.noAccessRow}>
                      <Ionicons name="lock-closed-outline" size={15} color={colors.mutedForeground} />
                      <Text style={[styles.noAccessText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        Connect via OAuth to import and search your photos from this account.
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
                    <TouchableOpacity
                      style={[
                        styles.monitorBtn,
                        {
                          backgroundColor:
                            selectedCount > 0 && !searching
                              ? colors.primary
                              : colors.secondary,
                          borderColor:
                            selectedCount > 0 ? colors.primary : colors.border,
                          opacity: searching ? 0.7 : 1,
                        },
                      ]}
                      activeOpacity={0.85}
                      onPress={() => handleMonitorSelected(account.id, mediaState.items)}
                      disabled={selectedCount === 0 || searching}
                    >
                      {isThisAccountSearching ? (
                        <>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={[styles.monitorBtnText, { color: "#FFFFFF", fontFamily: "Inter_600SemiBold" }]}>
                            Searching {selectedCount} photo{selectedCount !== 1 ? "s" : ""}…
                          </Text>
                        </>
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name="radar"
                            size={18}
                            color={selectedCount > 0 ? "#FFFFFF" : colors.mutedForeground}
                          />
                          <Text
                            style={[
                              styles.monitorBtnText,
                              {
                                color:
                                  selectedCount > 0 ? "#FFFFFF" : colors.mutedForeground,
                                fontFamily: "Inter_600SemiBold",
                              },
                            ]}
                          >
                            {selectedCount > 0
                              ? `Search & Monitor (${selectedCount})`
                              : "Select photos to search"}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </GlassCard>
              );
            })}
          </>
        )}

        {/* ── Info card ──────────────────────────────────────────────────── */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Photos from connected accounts are searched via Google Cloud Vision reverse image search — your actual pixels are matched against the entire public web to find unauthorized use.
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 10 }]}>
            <Ionicons name="phone-portrait-outline" size={18} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Camera roll photos are sent securely to our servers for one-time search and never stored.
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
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

  // Search result banner
  resultBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  resultTitle: { fontSize: 14, marginBottom: 2 },
  resultDesc: { fontSize: 13, lineHeight: 18 },

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
  demoNote: { fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: -4 },

  importDesc: { fontSize: 13, lineHeight: 18, marginTop: -6 },
  accountCard: { gap: 12 },
  accountHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  accountInfo: { flex: 1 },
  accountUsername: { fontSize: 15 },
  accountPlatform: { fontSize: 13, marginTop: 2, textTransform: "capitalize" },

  // Real post grid
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
});
