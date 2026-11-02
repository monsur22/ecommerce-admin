import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AdSource } from "@/types/order";

type IconName = keyof typeof Ionicons.glyphMap;

export interface AdSourceMeta {
  label: string;
  icon: IconName;
  /** Brand-ish foreground colour */
  color: string;
  /** Light tint for pills / icon wells */
  bg: string;
}

/** Display data for every order source / campaign channel (unknown values fall back to "other"). */
export const AD_SOURCE_META: Record<AdSource, AdSourceMeta> = {
  facebook: { label: "Facebook", icon: "logo-facebook", color: "#1877f2", bg: "#e7f0fd" },
  instagram: { label: "Instagram", icon: "logo-instagram", color: "#c13584", bg: "#fbe7f3" },
  whatsapp: { label: "WhatsApp", icon: "logo-whatsapp", color: "#128c4b", bg: "#dcf8e7" },
  messenger: { label: "Messenger", icon: "chatbubble-ellipses", color: "#0084ff", bg: "#e0efff" },
  tiktok: { label: "TikTok", icon: "logo-tiktok", color: "#111827", bg: "#e5e7eb" },
  google: { label: "Google", icon: "logo-google", color: "#ea4335", bg: "#fde8e6" },
  youtube: { label: "YouTube", icon: "logo-youtube", color: "#dc2626", bg: "#fee2e2" },
  phone: { label: "Phone call", icon: "call", color: "#0f766e", bg: "#ccfbf1" },
  other: { label: "Other", icon: "megaphone-outline", color: "#7c3aed", bg: "#ede9fe" },
};

/** Sources an admin can filter orders by (social/ad first). */
export const AD_SOURCE_FILTERS: AdSource[] = ["facebook", "instagram", "whatsapp", "messenger", "tiktok", "google", "youtube", "phone", "other"];

/** Sources that count as social / ads ("From ads" filter = adSource=any: any non-null source except phone). */
export const SOCIAL_SOURCES: AdSource[] = ["facebook", "instagram", "whatsapp", "messenger", "tiktok", "google", "youtube"];

/**
 * "Order came from" options for orders typed in by staff (same list as the web New sale form).
 * "direct" = walk-in / direct and is sent as no `adSource` (stored null).
 */
export const MANUAL_SOURCE_OPTIONS: { value: "direct" | AdSource; label: string }[] = [
  { value: "direct", label: "Walk-in / direct" },
  { value: "facebook", label: "Facebook" },
  { value: "messenger", label: "Messenger" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "tiktok", label: "TikTok" },
  { value: "phone", label: "Phone call" },
  { value: "other", label: "Other" },
];

export function adSourceMeta(source?: string | null): AdSourceMeta {
  const key = String(source ?? "").toLowerCase() as AdSource;
  return AD_SOURCE_META[key] ?? AD_SOURCE_META.other;
}

export function adSourceLabel(source?: string | null): string {
  return adSourceMeta(source).label;
}

/** Small brand pill: icon + name. */
export function AdSourceBadge({ source, size = "sm" }: { source?: string | null; size?: "sm" | "md" }) {
  if (!source) return null;
  const meta = adSourceMeta(source);
  const md = size === "md";
  return (
    <View style={[s.pill, { backgroundColor: meta.bg }, md && s.pillMd]}>
      <Ionicons name={meta.icon} size={md ? 13 : 11} color={meta.color} />
      <Text style={[s.text, { color: meta.color }, md && s.textMd]} numberOfLines={1}>{meta.label}</Text>
    </View>
  );
}

/** Quick order / possible duplicate flags. */
export function OrderFlagBadge({ kind }: { kind: "quick" | "duplicate" }) {
  const quick = kind === "quick";
  return (
    <View style={[s.pill, { backgroundColor: quick ? "#e0f2fe" : "#fee2e2" }]}>
      <Ionicons name={quick ? "flash" : "warning"} size={11} color={quick ? "#0369a1" : "#b91c1c"} />
      <Text style={[s.text, { color: quick ? "#0369a1" : "#b91c1c" }]}>{quick ? "Quick order" : "Possible duplicate"}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  pillMd: { paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 11, fontWeight: "700" },
  textMd: { fontSize: 12 },
});
