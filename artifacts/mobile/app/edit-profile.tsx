import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { ReviewerDemoBanner } from "@/components/ReviewerDemoBanner";
import { previewReviewerDemoAvatar, updateMe, uploadAvatar } from "@/lib/api";

interface FieldProps {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "words" | "sentences";
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  borderColor: string;
  primaryColor: string;
  foreground: string;
  mutedForeground: string;
  last?: boolean;
}

function Field({
  icon,
  iconColor,
  label,
  value,
  onChange,
  placeholder,
  prefix,
  keyboardType,
  autoCapitalize,
  focused,
  onFocus,
  onBlur,
  borderColor,
  primaryColor,
  foreground,
  mutedForeground,
  last,
}: FieldProps) {
  return (
    <View
      style={[
        styles.fieldRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
        focused && { backgroundColor: primaryColor + "08" },
      ]}
    >
      <View style={[styles.fieldIcon, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
      </View>
      <View style={styles.fieldBody}>
        <Text style={[styles.fieldLabel, { color: mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {label}
        </Text>
        <View style={styles.fieldInputRow}>
          {prefix ? (
            <Text style={[styles.fieldPrefix, { color: foreground, fontFamily: "Inter_500Medium" }]}>
              {prefix}
            </Text>
          ) : null}
          <TextInput
            style={[styles.fieldInput, { color: foreground, fontFamily: "Inter_500Medium" }]}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={mutedForeground}
            keyboardType={keyboardType ?? "default"}
            autoCapitalize={autoCapitalize ?? "words"}
            onFocus={onFocus}
            onBlur={onBlur}
            returnKeyType="done"
          />
        </View>
      </View>
    </View>
  );
}

export default function EditProfile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, refreshData, isReviewerDemo, reviewerDemo } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [previewNotice, setPreviewNotice] = useState(false);
  const demoAvatarOptions = isReviewerDemo
    ? (reviewerDemo?.accounts ?? [])
        .flatMap((account) => reviewerDemo?.mediaByAccount[account.id]?.items ?? [])
        .filter((item) => item.type === "image")
        .map((item) => item.thumbnailUrl || item.url)
        .filter((url, index, urls) => Boolean(url) && urls.indexOf(url) === index)
    : [];

  useEffect(() => {
    if (user.name && !initialized) {
      setName(user.name);
      setUsername((user.username ?? "").replace(/^@/, ""));
      setEmail(user.email ?? "");
      setInitialized(true);
    }
  }, [user.name, user.username, user.email, initialized]);

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const hasChanges =
    initialized && (
      name.trim() !== (user.name ?? "") ||
      username !== (user.username ?? "").replace(/^@/, "") ||
      email !== (user.email ?? "") ||
      avatarPreview !== user.avatarUrl
    );

  const handlePickAvatar = async () => {
    if (isReviewerDemo) {
      setAvatarPickerVisible(true);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Allow photo access to change your avatar.");
      return;
    }
    if (isReviewerDemo) {
      setAvatarPickerVisible(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    if (isReviewerDemo) {
      setAvatarPickerVisible(true);
      return;
    }
    const asset = result.assets[0];
    const base64 = asset.base64;
    if (!base64) return;
    setUploadingAvatar(true);
    try {
      const { avatarUrl } = await uploadAvatar(`data:image/jpeg;base64,${base64}`);
      setAvatarPreview(avatarUrl);
      await refreshData();
    } catch {
      Alert.alert("Upload Failed", "Could not save your photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSelectDemoAvatar = async (avatarUrl: string) => {
    setAvatarPickerVisible(false);
    setUploadingAvatar(true);
    try {
      const result = previewReviewerDemoAvatar(avatarUrl);
      setAvatarPreview(result.avatarUrl);
      await refreshData();
      setPreviewNotice(true);
    } catch {
      Alert.alert("Preview Unavailable", "Could not select this reviewer-demo sample photo.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your full name.");
      return;
    }
    if (username.trim() && !/^[a-zA-Z0-9._]{1,30}$/.test(username.trim())) {
      Alert.alert("Invalid Username", "Username can only contain letters, numbers, dots, and underscores (max 30 characters).");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (isReviewerDemo) {
      setSaving(true);
      try {
        await updateMe({
          name: name.trim(),
          username: username.trim() ? `@${username.trim().replace(/^@/, "")}` : undefined,
          email: email.trim() || undefined,
        });
        await refreshData();
        setPreviewNotice(true);
      } catch {
        Alert.alert("Preview Unavailable", "Could not update the local demo profile preview.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    try {
      await updateMe({
        name: name.trim(),
        username: username.trim() ? `@${username.trim().replace(/^@/, "")}` : undefined,
        email: email.trim() || undefined,
      });
      await refreshData();
      Alert.alert("Profile Updated", "Your changes have been saved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const fieldProps = {
    borderColor: colors.border,
    primaryColor: colors.primary,
    foreground: colors.foreground,
    mutedForeground: colors.mutedForeground,
  };

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <View
        style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Edit Profile
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={!hasChanges || saving}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text
              style={[
                styles.saveBtn,
                { color: hasChanges ? colors.primary : colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {isReviewerDemo ? "Preview" : "Save"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {isReviewerDemo && (
          <ReviewerDemoBanner message="Profile and avatar changes are local preview only." />
        )}
        {isReviewerDemo && previewNotice && (
          <View style={[styles.previewFeedback, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.previewFeedbackText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Preview updated in temporary demo state only. Your real account profile and avatar are unchanged.
            </Text>
          </View>
        )}

        {/* Avatar preview */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85} style={styles.avatarWrapper}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.primary + "33", borderColor: colors.primary + "66" },
              ]}
            >
              {avatarPreview ? (
                <Image source={{ uri: avatarPreview }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                  {initials || "?"}
                </Text>
              )}
            </View>
            <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
              {uploadingAvatar ? (
                <ActivityIndicator size={10} color="#fff" />
              ) : (
                <Ionicons name={isReviewerDemo ? "images" : "camera"} size={12} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {isReviewerDemo
              ? "Choose a local preview photo"
              : avatarPreview ? "Tap to change photo" : "Tap to add a photo"}
          </Text>
        </View>

        {/* Personal Info */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Personal Info
        </Text>
        <GlassCard noPadding>
          <Field
            icon="person"
            iconColor={colors.primary}
            label="Full Name"
            value={name}
            onChange={setName}
            placeholder="Your full name"
            focused={focusedField === "name"}
            onFocus={() => setFocusedField("name")}
            onBlur={() => setFocusedField(null)}
            {...fieldProps}
          />
          <Field
            icon="at"
            iconColor={colors.primary}
            label="Username"
            value={username}
            onChange={setUsername}
            placeholder="handle"
            prefix="@"
            autoCapitalize="none"
            focused={focusedField === "username"}
            onFocus={() => setFocusedField("username")}
            onBlur={() => setFocusedField(null)}
            {...fieldProps}
            last
          />
        </GlassCard>

        {/* Contact */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Contact
        </Text>
        <GlassCard noPadding>
          <Field
            icon="mail"
            iconColor={colors.primary}
            label="Email Address"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            focused={focusedField === "email"}
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
            {...fieldProps}
            last
          />
        </GlassCard>

        <TouchableOpacity
          style={[
            styles.saveBlock,
            { backgroundColor: hasChanges ? colors.primary : colors.secondary },
          ]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.saveBtnBlock, { fontFamily: "Inter_700Bold" }]}>
              {isReviewerDemo ? "Preview Changes" : "Save Changes"}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.footer, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {isReviewerDemo
            ? "Profile edits and the selected sample avatar stay in temporary reviewer-demo state."
            : "Your identity data is encrypted and never shared with third parties."}
        </Text>
      </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={avatarPickerVisible && isReviewerDemo}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPickerVisible(false)}
      >
        <View style={styles.avatarPickerBackdrop}>
          <View style={[styles.avatarPickerSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.avatarPickerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Choose a sample avatar
            </Text>
            <Text style={[styles.avatarPickerDescription, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Select a photo from the reviewer-demo fixture. The camera roll and photo permissions are not used.
            </Text>
            {demoAvatarOptions.length > 0 ? (
              <View style={styles.sampleAvatarGrid}>
                {demoAvatarOptions.map((url, index) => (
                  <TouchableOpacity
                    key={`${url}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Select sample avatar ${index + 1}`}
                    onPress={() => void handleSelectDemoAvatar(url)}
                    style={[styles.sampleAvatarOption, { borderColor: colors.border }]}
                    disabled={uploadingAvatar}
                  >
                    <Image source={{ uri: url }} style={styles.sampleAvatarImage} />
                    <Text style={[styles.sampleAvatarLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      Sample {index + 1}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={[styles.avatarPickerDescription, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No sample photos are available in this preview. Your photo library was not opened.
              </Text>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setAvatarPickerVisible(false)}
              style={[styles.avatarPickerCancel, { borderColor: colors.border }]}
              disabled={uploadingAvatar}
            >
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17 },
  saveBtn: { fontSize: 16 },
  content: { padding: 20, gap: 14 },
  previewFeedback: { borderWidth: 1, borderRadius: 12, padding: 12 },
  previewFeedbackText: { fontSize: 13, lineHeight: 19 },
  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 8 },
  avatarWrapper: { position: "relative" },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    overflow: "hidden",
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 32 },
  avatarHint: { fontSize: 12 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 4 },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  fieldIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fieldBody: { flex: 1 },
  fieldLabel: { fontSize: 11, marginBottom: 3 },
  fieldInputRow: { flexDirection: "row", alignItems: "center" },
  fieldPrefix: { fontSize: 16 },
  fieldInput: { flex: 1, fontSize: 16, padding: 0 },
  saveBlock: { height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginTop: 8 },
  saveBtnBlock: { color: "#FFFFFF", fontSize: 16 },
  footer: { fontSize: 12, textAlign: "center", lineHeight: 18, opacity: 0.7 },
  avatarPickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.68)", justifyContent: "center", padding: 24 },
  avatarPickerSheet: { width: "100%", maxWidth: 420, alignSelf: "center", borderWidth: 1, borderRadius: 20, padding: 20, gap: 12 },
  avatarPickerTitle: { fontSize: 18, textAlign: "center" },
  avatarPickerDescription: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  sampleAvatarGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginVertical: 4 },
  sampleAvatarOption: { alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 14, padding: 8 },
  sampleAvatarImage: { width: 74, height: 74, borderRadius: 37, backgroundColor: "#64748B22" },
  sampleAvatarLabel: { fontSize: 11 },
  avatarPickerCancel: { minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
