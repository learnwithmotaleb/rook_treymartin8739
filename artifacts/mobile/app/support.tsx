import React, { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";

const FAQ = [
  {
    q: "How does identity monitoring work?",
    a: "Rook uses AI to scan social platforms and public photo indexes for matches to your profile. When a potential impersonator or stolen asset is detected, you're immediately alerted with evidence.",
  },
  {
    q: "Which platforms are monitored?",
    a: "We actively monitor Instagram and Facebook. Support for X (Twitter), TikTok, YouTube, LinkedIn, and Snapchat is coming soon.",
  },
  {
    q: "How often are scans performed?",
    a: "Free accounts get manual scans once per month. Pro accounts scan weekly with automated scheduling. Premium accounts scan daily with deep AI analysis.",
  },
  {
    q: "What do I do if I find an impersonator?",
    a: "Open the threat alert and tap 'Report Account'. We'll provide a pre-filled report for the platform, evidence screenshots, and a step-by-step takedown guide.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted at rest and in transit. We never sell your personal information or share it with third parties. You can delete your account and all data at any time.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "Go to Profile → Subscription → Manage Billing. You can cancel anytime and retain access until your billing period ends. No cancellation fees.",
  },
  {
    q: "What is the Photo Monitor?",
    a: "Photo Monitor uses AI-powered image recognition to detect when your photos are copied, edited, cropped, or re-uploaded elsewhere — even versions that look different from the original.",
  },
  {
    q: "Why am I seeing false positives?",
    a: "AI matching isn't perfect. For each alert, you can tap 'Dismiss' or 'Not me' to improve accuracy. Our AI learns from your feedback over time.",
  },
];

export default function Support() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<number | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const toggle = (i: number) => setExpanded(expanded === i ? null : i);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert("Cannot Open Link", "Please visit tryrook.app in your browser.")
    );
  };

  const emailSupport = () => {
    Linking.openURL("mailto:support@tryrook.app?subject=Support%20Request").catch(() =>
      Alert.alert("Email Support", "Contact us at support@tryrook.app")
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Help & Support
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Hero */}
        <GlassCard style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + "18" }]}>
            <Ionicons name="help-buoy" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            How can we help?
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Browse the FAQ below or contact our support team.
          </Text>
        </GlassCard>

        {/* Contact options */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Contact Us
        </Text>
        <View style={styles.contactRow}>
          <ContactCard
            icon="mail"
            iconColor={colors.primary}
            label="Email Support"
            sub="24-48 hour response"
            onPress={emailSupport}
            colors={colors}
          />
          <ContactCard
            icon="logo-twitter"
            iconColor="#1DA1F2"
            label="Twitter / X"
            sub="@RookApp"
            onPress={() => openLink("https://x.com/RookApp")}
            colors={colors}
          />
        </View>

        {/* FAQ */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Frequently Asked Questions
        </Text>
        <GlassCard noPadding>
          {FAQ.map((item, i) => (
            <View
              key={i}
              style={[
                styles.faqItem,
                i < FAQ.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <TouchableOpacity
                style={styles.faqQuestion}
                activeOpacity={0.7}
                onPress={() => toggle(i)}
              >
                <Text
                  style={[styles.faqQ, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                  numberOfLines={expanded === i ? undefined : 2}
                >
                  {item.q}
                </Text>
                <Ionicons
                  name={expanded === i ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
              {expanded === i && (
                <Text
                  style={[styles.faqA, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
                >
                  {item.a}
                </Text>
              )}
            </View>
          ))}
        </GlassCard>

        {/* Legal */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Legal
        </Text>
        <GlassCard noPadding>
          {[
            { label: "Privacy Policy", url: "https://tryrook.app/api/legal/privacy" },
            { label: "Terms of Service", url: "https://tryrook.app/api/legal/terms" },
            { label: "Open Source Licenses", url: "https://tryrook.app/api/legal/privacy" },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.legalRow,
                i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
              onPress={() => openLink(item.url)}
              activeOpacity={0.7}
            >
              <Text style={[styles.legalLabel, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                {item.label}
              </Text>
              <Ionicons name="open-outline" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </GlassCard>

        <TouchableOpacity
          style={[styles.deleteRow, { borderColor: colors.danger + "44" }]}
          onPress={() =>
            Alert.alert(
              "Delete Account",
              "This will permanently delete your Rook account and all monitoring data. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Request Deletion",
                  style: "destructive",
                  onPress: () => emailSupport(),
                },
              ]
            )
          }
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={[styles.deleteLabel, { color: colors.danger, fontFamily: "Inter_500Medium" }]}>
            Delete Account & Data
          </Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Rook v1.0.0 · support@tryrook.app
        </Text>
      </ScrollView>
    </View>
  );
}

function ContactCard({
  icon,
  iconColor,
  label,
  sub,
  onPress,
  colors,
}: {
  icon: string;
  iconColor: string;
  label: string;
  sub: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.contactIcon, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon as any} size={22} color={iconColor} />
      </View>
      <Text style={[styles.contactLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
        {label}
      </Text>
      <Text style={[styles.contactSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {sub}
      </Text>
    </TouchableOpacity>
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
  content: { padding: 20, gap: 14 },
  hero: { alignItems: "center", gap: 12, paddingVertical: 8 },
  heroIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 20 },
  heroSub: { fontSize: 14, textAlign: "center" },
  sectionLabel: { fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 4 },
  contactRow: { flexDirection: "row", gap: 12 },
  contactCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  contactIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  contactLabel: { fontSize: 14, textAlign: "center" },
  contactSub: { fontSize: 12, textAlign: "center" },
  faqItem: {},
  faqQuestion: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  faqQ: { flex: 1, fontSize: 15, lineHeight: 20 },
  faqA: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16 },
  legalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  legalLabel: { fontSize: 15 },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  deleteLabel: { fontSize: 15 },
  version: { fontSize: 12, textAlign: "center", opacity: 0.6 },
});
