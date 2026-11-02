import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { AdSourceBadge, OrderFlagBadge } from "@/components/orders/AdSourceBadge";
import { buildCaption, copyText, shareText, shareUrl, targetSummary } from "@/components/marketing/link-share";
import { LinkQrCode, shareQrPdf } from "@/components/marketing/LinkQrCode";
import { ClicksOrdersChart } from "@/components/marketing/ClicksOrdersChart";
import { apiErrorMessage, formatCompactDate, formatDateTime } from "@/lib/format";
import { getImageUrl } from "@/lib/images";
import {
  CAMPAIGN_PERIODS,
  deleteCampaignLink,
  getCampaignLink,
  getCampaignLinkStats,
  setCampaignLinkActive,
} from "@/services/campaign-links";
import type { CampaignLink, CampaignLinkStats, CampaignPeriod } from "@/types/campaign-link";

const MODULE = "Marketing";
const fmtPct = (v: number) => `${v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)}%`;

const STATUS_COLOR: Record<string, string> = {
  Pending: "#f59e0b",
  Processing: "#3b82f6",
  Delivered: "#10b981",
  Cancelled: "#94a3b8",
};

export default function AdOrderLinkDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const linkId = Number(params.id);
  const { canRead, canWrite, canDelete } = useAuth();
  const { formatCurrency } = useCurrency();
  const [link, setLink] = useState<CampaignLink | null>(null);
  const [stats, setStats] = useState<CampaignLinkStats | null>(null);
  const [period, setPeriod] = useState<CampaignPeriod>("30d");
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [caption, setCaption] = useState("");
  const [captionEdited, setCaptionEdited] = useState(false);
  const [showQr, setShowQr] = useState(true);
  const loadedOnce = useRef(false);

  const loadLink = useCallback(async () => {
    try {
      const next = await getCampaignLink(linkId);
      setLink(next);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load the link."));
    }
  }, [linkId]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await getCampaignLinkStats(linkId, period));
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [linkId, period]);

  useEffect(() => {
    if (!Number.isFinite(linkId)) return;
    void loadLink().finally(() => {
      setLoading(false);
      loadedOnce.current = true;
    });
  }, [loadLink, linkId]);

  useEffect(() => {
    if (!Number.isFinite(linkId)) return;
    void loadStats();
  }, [loadStats, linkId]);

  // Back from edit: refresh the link silently.
  useFocusEffect(
    useCallback(() => {
      if (loadedOnce.current) void loadLink();
    }, [loadLink]),
  );

  useEffect(() => {
    if (link && !captionEdited) setCaption(buildCaption(link));
  }, [link, captionEdited]);

  if (!canRead(MODULE)) return <AccessDenied />;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLink(), loadStats()]);
    setRefreshing(false);
  };

  const toggleActive = async (value: boolean) => {
    if (!link) return;
    setToggling(true);
    setLink({ ...link, isActive: value });
    try {
      const updated = await setCampaignLinkActive(link.id, value);
      if (updated) setLink(updated);
    } catch (err) {
      setLink({ ...link, isActive: !value });
      Alert.alert("Update failed", apiErrorMessage(err, "Could not update the link."));
    } finally {
      setToggling(false);
    }
  };

  const confirmDelete = () => {
    if (!link) return;
    Alert.alert("Delete link", `Delete "${link.name}"? The link stops working; orders it brought keep their source.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCampaignLink(link.id);
            router.back();
          } catch (err) {
            Alert.alert("Delete failed", apiErrorMessage(err, "Could not delete the link."));
          }
        },
      },
    ]);
  };

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{link?.name ?? "Ad order link"}</Text>
      {link && canWrite(MODULE) ? (
        <Pressable
          onPress={() => router.push({ pathname: "/marketing/create", params: { id: String(link.id) } } as any)}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="create-outline" size={21} color={colors.text} />
        </Pressable>
      ) : (
        <View style={{ width: 38 }} />
      )}
    </View>
  );

  if (loading || !link) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {header}
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.primaryDark} size="large" />
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>{error ?? "Link not found."}</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const url = shareUrl(link);
  const thumb = getImageUrl(link.target?.image ?? null);
  const activeDays = (stats?.byDay ?? []).filter((d) => d.clicks > 0 || d.orders > 0).slice(-14).reverse();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Link card */}
        <View style={styles.card}>
          <View style={styles.topRow}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <Ionicons name={link.targetType === "store" ? "storefront-outline" : "cube-outline"} size={22} color={colors.muted} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <AdSourceBadge source={link.channel} size="md" />
              <Text style={styles.targetText} numberOfLines={2}>{targetSummary(link)}</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Switch
                value={link.isActive}
                onValueChange={(v) => void toggleActive(v)}
                disabled={!canWrite(MODULE) || toggling}
                trackColor={{ true: colors.primary, false: "#cbd5e1" }}
              />
              <Text style={[styles.activeText, link.isActive && { color: colors.primaryDark }]}>
                {link.isActive ? "Active" : "Off"}
              </Text>
            </View>
          </View>

          {!link.isActive ? (
            <View style={styles.warnBox}>
              <Ionicons name="pause-circle-outline" size={15} color="#92400e" />
              <Text style={styles.warnText}>This link is off. Shoppers who tap it land on your home page instead.</Text>
            </View>
          ) : null}

          {url ? (
            <>
              <Text style={styles.fieldLabel}>Link to post</Text>
              <View style={styles.urlBox}>
                <Text style={styles.urlText} selectable numberOfLines={2}>{url}</Text>
              </View>
              <View style={styles.btnRow}>
                <ActionButton icon="copy-outline" label="Copy link" onPress={() => void copyText(url, "Link copied")} />
                <ActionButton icon="share-social-outline" label="Share link" primary onPress={() => void shareText(url)} />
              </View>
              {link.fullUrl && link.fullUrl !== url ? (
                <Pressable style={styles.fullUrlRow} onPress={() => void copyText(link.fullUrl, "Full URL copied")}>
                  <Text style={styles.fullUrlText} numberOfLines={1}>Full URL: {link.fullUrl}</Text>
                  <Ionicons name="copy-outline" size={13} color={colors.muted} />
                </Pressable>
              ) : null}
            </>
          ) : (
            <View style={styles.warnBox}>
              <Ionicons name="warning-outline" size={15} color="#92400e" />
              <Text style={styles.warnText}>
                Your store web address is not set, so a full link can't be built. Set the online store domain in the web
                admin. Path: {link.targetPath || "/"}
              </Text>
            </View>
          )}
        </View>

        {/* QR code (for flyers, packaging, the shop counter) */}
        {url ? (
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>QR code</Text>
              <Pressable onPress={() => setShowQr((v) => !v)} hitSlop={8}>
                <Text style={styles.resetText}>{showQr ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>
            {showQr ? (
              <>
                <LinkQrCode value={url} />
                <Text style={styles.qrHint}>Customers scan it with their phone camera to open the link.</Text>
                <View style={styles.btnRow}>
                  <ActionButton icon="share-outline" label="Share QR (PDF)" onPress={() => void shareQrPdf(url, link.name)} />
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {/* Caption */}
        {url ? (
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Post caption</Text>
              {captionEdited ? (
                <Pressable onPress={() => setCaptionEdited(false)} hitSlop={8}>
                  <Text style={styles.resetText}>Reset</Text>
                </Pressable>
              ) : null}
            </View>
            <TextInput
              style={styles.captionInput}
              value={caption}
              onChangeText={(t) => {
                setCaption(t);
                setCaptionEdited(true);
              }}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.btnRow}>
              <ActionButton icon="copy-outline" label="Copy caption" onPress={() => void copyText(caption, "Caption copied")} />
              <ActionButton icon="share-social-outline" label="Share post" primary onPress={() => void shareText(caption)} />
            </View>
          </View>
        ) : null}

        {/* Stats */}
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Performance</Text>
            {statsLoading ? <ActivityIndicator size="small" color={colors.primaryDark} /> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CAMPAIGN_PERIODS.map((p) => (
              <Pressable
                key={p.value}
                style={[styles.chip, period === p.value && styles.chipActive]}
                onPress={() => setPeriod(p.value)}
              >
                <Text style={[styles.chipText, period === p.value && styles.chipTextActive]}>{p.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {stats ? (
            <>
              <View style={styles.grid}>
                <Metric label="Clicks" value={String(stats.clicks)} />
                <Metric label="Orders" value={String(stats.orders)} />
                <Metric label="Revenue" value={formatCurrency(stats.revenue)} />
                <Metric label="Conversion" value={fmtPct(stats.conversionRate)} />
              </View>
              <View style={styles.statusRow}>
                <StatusCount label="Pending" value={stats.pending} color={STATUS_COLOR.Pending} />
                <StatusCount label="Confirmed" value={stats.confirmed} color={STATUS_COLOR.Processing} />
                <StatusCount label="Delivered" value={stats.delivered} color={STATUS_COLOR.Delivered} />
                <StatusCount label="Cancelled" value={stats.cancelled} color={STATUS_COLOR.Cancelled} />
              </View>
              <ClicksOrdersChart days={stats.byDay} formatMoney={formatCurrency} />
              {activeDays.length > 0 ? (
                <View style={{ gap: 2 }}>
                  <Text style={styles.subHead}>Active days</Text>
                  {activeDays.map((d) => (
                    <View key={d.date} style={styles.dayRow}>
                      <Text style={styles.dayDate}>{formatCompactDate(d.date)}</Text>
                      <Text style={styles.dayNum}>{d.clicks} clicks</Text>
                      <Text style={styles.dayNum}>{d.orders} orders</Text>
                      <Text style={[styles.dayNum, { flex: 1.3 }]} numberOfLines={1}>{formatCurrency(d.revenue)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : !statsLoading ? (
            <Text style={styles.emptyText}>Stats are unavailable right now. Pull to refresh.</Text>
          ) : null}
        </View>

        {/* Orders */}
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Orders from this link</Text>
            {canRead("Orders") ? (
              <Pressable
                hitSlop={8}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/orders",
                    params: { campaignLinkId: String(link.id), campaignLinkName: link.name },
                  } as any)
                }
              >
                <Text style={styles.resetText}>See all</Text>
              </Pressable>
            ) : null}
          </View>
          {stats && stats.recentOrders.length > 0 ? (
            stats.recentOrders.map((o) => (
              <Pressable
                key={o.id}
                style={styles.orderRow}
                onPress={() => canRead("Orders") && router.push(`/orders/${o.id}` as any)}
              >
                <View style={[styles.orderDot, { backgroundColor: STATUS_COLOR[o.status] ?? colors.muted }]} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.orderNo}>#{o.invoiceNo} · {o.customerName}</Text>
                  <View style={styles.orderMeta}>
                    <Text style={styles.orderTime}>{formatDateTime(o.orderTime)}</Text>
                    {o.isQuickOrder ? <OrderFlagBadge kind="quick" /> : null}
                    {o.possibleDuplicate ? <OrderFlagBadge kind="duplicate" /> : null}
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.orderAmount}>{formatCurrency(o.amount)}</Text>
                  <Text style={[styles.orderStatus, { color: STATUS_COLOR[o.status] ?? colors.muted }]}>{o.status}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>No orders yet. Share the link to start getting orders.</Text>
          )}
        </View>

        {/* Tracking details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tracking</Text>
          <InfoRow label="Code" value={link.code || "-"} />
          <InfoRow label="UTM source" value={link.utmSource || "-"} />
          <InfoRow label="UTM medium" value={link.utmMedium || "-"} />
          <InfoRow label="UTM campaign" value={link.utmCampaign || "-"} />
          <InfoRow label="UTM content" value={link.utmContent || "-"} />
          {link.lastClickedAt ? <InfoRow label="Last click" value={formatDateTime(link.lastClickedAt)} /> : null}
          <InfoRow
            label="Created"
            value={`${formatDateTime(link.createdAt)}${link.createdByName ? ` by ${link.createdByName}` : ""}`}
          />
          {link.notes ? <Text style={styles.notes}>{link.notes}</Text> : null}
        </View>

        {canDelete(MODULE) ? (
          <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteText}>Delete link</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable style={[styles.actionBtn, primary && styles.actionBtnPrimary]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={primary ? "#fff" : colors.primaryDark} />
      <Text style={[styles.actionText, primary && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusCount({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statusCount}>
      <View style={[styles.orderDot, { backgroundColor: color }]} />
      <Text style={styles.statusValue}>{value}</Text>
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 10,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#f1f5f9" },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  targetText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  activeText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#fffbeb", borderRadius: 12, borderWidth: 1, borderColor: "#fde68a", padding: 10,
  },
  warnText: { flex: 1, color: "#92400e", fontSize: 12, lineHeight: 17 },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  urlBox: { backgroundColor: colors.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  urlText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  qrHint: { color: colors.muted, fontSize: 12, textAlign: "center" },
  fullUrlRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  fullUrlText: { flex: 1, color: colors.muted, fontSize: 11 },
  btnRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 12, paddingVertical: 11, backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0",
  },
  actionBtnPrimary: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  actionText: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  resetText: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  captionInput: {
    minHeight: 130, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, padding: 12, color: colors.text, fontSize: 14, lineHeight: 20,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.background, borderRadius: 12, padding: 10 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: "800" },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  statusRow: { flexDirection: "row", gap: 6 },
  statusCount: { flex: 1, alignItems: "center", gap: 2 },
  statusValue: { color: colors.text, fontSize: 15, fontWeight: "800" },
  statusLabel: { color: colors.muted, fontSize: 10, fontWeight: "600" },
  subHead: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
  dayRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border,
  },
  dayDate: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "700" },
  dayNum: { flex: 1, color: colors.muted, fontSize: 12, textAlign: "right" },
  orderRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border,
  },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderNo: { color: colors.text, fontSize: 13, fontWeight: "700" },
  orderMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  orderTime: { color: colors.muted, fontSize: 11 },
  orderAmount: { color: colors.text, fontSize: 13, fontWeight: "800" },
  orderStatus: { fontSize: 11, fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700", textAlign: "right" },
  notes: { color: colors.text, fontSize: 13, backgroundColor: colors.background, borderRadius: 10, padding: 10 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 6 },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 14, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", paddingVertical: 13,
  },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: "800" },
});
