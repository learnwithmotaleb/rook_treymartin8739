import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { analyzeScam } from "@/lib/api";

type RiskLevel = "safe" | "suspicious" | "scam";

interface AnalysisResult {
  risk: RiskLevel;
  score: number;
  explanation: string;
  indicators: string[];
  recommendation: string;
}

function riskColor(risk: RiskLevel, colors: ReturnType<typeof useColors>) {
  if (risk === "scam") return colors.danger;
  if (risk === "suspicious") return colors.warning;
  return colors.success;
}

export default function ScamAnalyzer() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const apiResult = await analyzeScam(text.trim());
      const riskMap: Record<string, RiskLevel> = {
        low: "safe",
        medium: "suspicious",
        high: "scam",
      };
      setResult({
        risk: riskMap[apiResult.riskLevel] ?? "suspicious",
        score: apiResult.riskScore,
        explanation: apiResult.explanation,
        indicators: apiResult.detectedPatterns.length > 0
          ? apiResult.detectedPatterns
          : ["No specific patterns detected"],
        recommendation: apiResult.recommendation,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError("Analysis failed. Please check your connection and try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#3B82F611", "transparent"]}
        style={styles.topGradient}
      />
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Scam Analyzer
        </Text>
        <View
          style={[
            styles.aiBadge,
            { backgroundColor: colors.primary + "22" },
          ]}
        >
          <Text
            style={[
              styles.aiBadgeText,
              { color: colors.primary, fontFamily: "Inter_700Bold" },
            ]}
          >
            AI
          </Text>
        </View>
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 24 },
        ]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <MaterialCommunityIcons name="brain" size={20} color={colors.primary} />
            <Text
              style={[
                styles.inputLabel,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Paste suspicious content
            </Text>
          </View>
          <TextInput
            style={[
              styles.textInput,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.secondary,
                fontFamily: "Inter_400Regular",
              },
            ]}
            placeholder="Paste a message, link, or suspicious text here..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[
              styles.analyzeBtn,
              {
                backgroundColor: text.trim() ? colors.primary : colors.secondary,
                borderRadius: 22,
              },
            ]}
            activeOpacity={0.8}
            onPress={handleAnalyze}
            disabled={!text.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="brain" size={18} color={text.trim() ? "#FFFFFF" : colors.mutedForeground} />
                <Text
                  style={[
                    styles.analyzeBtnText,
                    {
                      color: text.trim() ? "#FFFFFF" : colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Analyze
                </Text>
              </>
            )}
          </TouchableOpacity>
        </GlassCard>

        {loading && (
          <View style={styles.loadingSection}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text
              style={[
                styles.loadingText,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              Analyzing content with AI...
            </Text>
          </View>
        )}

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.danger + "22", borderColor: colors.danger + "44" }]}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger, fontFamily: "Inter_400Regular" }]}>
              {error}
            </Text>
          </View>
        )}

        {result && (
          <>
            <View
              style={[
                styles.riskBanner,
                {
                  backgroundColor: riskColor(result.risk, colors) + "22",
                  borderColor: riskColor(result.risk, colors) + "44",
                },
              ]}
            >
              <View style={styles.riskLeft}>
                <Ionicons
                  name={
                    result.risk === "safe"
                      ? "shield-checkmark"
                      : result.risk === "suspicious"
                      ? "warning"
                      : "alert-circle"
                  }
                  size={28}
                  color={riskColor(result.risk, colors)}
                />
                <View>
                  <Text
                    style={[
                      styles.riskLabel,
                      {
                        color: riskColor(result.risk, colors),
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {result.risk === "safe"
                      ? "Appears Safe"
                      : result.risk === "suspicious"
                      ? "Suspicious"
                      : "High Risk Scam"}
                  </Text>
                  <Text
                    style={[
                      styles.riskSub,
                      { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                    ]}
                  >
                    Risk Score: {result.score}/100
                  </Text>
                </View>
              </View>
            </View>

            <GlassCard style={styles.resultCard}>
              <Text
                style={[
                  styles.resultLabel,
                  { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                ]}
              >
                AI Explanation
              </Text>
              <Text
                style={[
                  styles.resultText,
                  { color: colors.foreground, fontFamily: "Inter_400Regular" },
                ]}
              >
                {result.explanation}
              </Text>
            </GlassCard>

            <GlassCard style={styles.resultCard}>
              <Text
                style={[
                  styles.resultLabel,
                  { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                ]}
              >
                Risk Indicators
              </Text>
              {result.indicators.map((ind, i) => (
                <View key={i} style={styles.indicator}>
                  <View
                    style={[
                      styles.indicatorDot,
                      { backgroundColor: riskColor(result.risk, colors) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.indicatorText,
                      { color: colors.foreground, fontFamily: "Inter_400Regular" },
                    ]}
                  >
                    {ind}
                  </Text>
                </View>
              ))}
            </GlassCard>

            <GlassCard
              style={[
                styles.resultCard,
                { borderColor: colors.primary + "44" },
              ]}
            >
              <Text
                style={[
                  styles.resultLabel,
                  { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                ]}
              >
                Recommendation
              </Text>
              <Text
                style={[
                  styles.resultText,
                  { color: colors.foreground, fontFamily: "Inter_400Regular" },
                ]}
              >
                {result.recommendation}
              </Text>
            </GlassCard>
          </>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, flex: 1, marginLeft: 12 },
  aiBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  aiBadgeText: { fontSize: 12 },
  content: { padding: 16, gap: 14 },
  inputCard: { gap: 14 },
  inputHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  inputLabel: { fontSize: 15 },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 100,
    lineHeight: 21,
  },
  analyzeBtn: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  analyzeBtnText: { fontSize: 15 },
  loadingSection: { alignItems: "center", gap: 12, padding: 20 },
  loadingText: { fontSize: 14 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  errorText: { fontSize: 13, flex: 1, lineHeight: 18 },
  riskBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  riskLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  riskLabel: { fontSize: 17 },
  riskSub: { fontSize: 13 },
  resultCard: { gap: 10 },
  resultLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  resultText: { fontSize: 14, lineHeight: 22 },
  indicator: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  indicatorDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  indicatorText: { fontSize: 14, flex: 1, lineHeight: 20 },
});
