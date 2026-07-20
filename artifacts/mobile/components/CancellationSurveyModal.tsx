import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { postCancellationSurvey } from "@/lib/api";

const REASONS = [
  { key: "too_expensive", label: "Too expensive" },
  { key: "no_threats", label: "Didn't find threats" },
  { key: "just_exploring", label: "Just exploring" },
  { key: "other", label: "Other" },
] as const;

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function CancellationSurveyModal({ visible, onDismiss }: Props) {
  const colors = useColors();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSelect = async (key: string) => {
    if (submitting || done) return;
    setSelected(key);
    setSubmitting(true);
    try {
      await postCancellationSurvey(key);
    } catch {
      // Non-fatal — dismiss anyway
    }
    setDone(true);
    setTimeout(() => {
      onDismiss();
    }, 800);
  };

  const handleSkip = () => {
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleSkip}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.handle} />

          <View style={[styles.iconWrap, { backgroundColor: colors.danger + "18" }]}>
            <Ionicons name="shield-outline" size={28} color={colors.danger} />
          </View>

          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Sorry to see you go
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            What made you leave? (tap one)
          </Text>

          {done ? (
            <View style={styles.doneRow}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={[styles.doneText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
                Thanks for your feedback
              </Text>
            </View>
          ) : (
            <View style={styles.options}>
              {REASONS.map((reason) => {
                const isSelected = selected === reason.key;
                return (
                  <TouchableOpacity
                    key={reason.key}
                    activeOpacity={0.75}
                    onPress={() => handleSelect(reason.key)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: isSelected ? colors.primary + "20" : colors.secondary,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    disabled={submitting}
                  >
                    {isSelected && submitting ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <View style={[styles.optionDot, { borderColor: isSelected ? colors.primary : colors.mutedForeground }]}>
                        {isSelected && (
                          <View style={[styles.optionDotFill, { backgroundColor: colors.primary }]} />
                        )}
                      </View>
                    )}
                    <Text style={[
                      styles.optionLabel,
                      { color: isSelected ? colors.primary : colors.foreground, fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular" },
                    ]}>
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} disabled={submitting && !done}>
            <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Skip
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
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 4,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", marginTop: -8 },
  options: { width: "100%", gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  optionDotFill: { width: 8, height: 8, borderRadius: 4 },
  optionLabel: { fontSize: 15, flex: 1 },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  doneText: { fontSize: 16 },
  skipBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  skipText: { fontSize: 14 },
});
