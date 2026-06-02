import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { updateMe } from "@/lib/api";

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
  const { user, refreshData } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

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
      email !== (user.email ?? "")
    );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your full name.");
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
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar preview */}
        <View style={styles.avatarSection}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primary + "33", borderColor: colors.primary + "66" },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
              {initials || "?"}
            </Text>
          </View>
          <Text style={[styles.avatarHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Avatar updates live as you type your name
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
              Save Changes
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.footer, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Your identity data is encrypted and never shared with third parties.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
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
});
