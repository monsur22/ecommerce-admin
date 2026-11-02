import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { adSourceMeta } from "@/components/orders/AdSourceBadge";
import { copyText, shareText, shareUrl, targetSummary } from "@/components/marketing/link-share";
import { apiErrorMessage } from "@/lib/format";
import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_PERIODS,
  deleteCampaignLink,
  getCampaignLinks,
  getCampaignSummary,
  setCampaignLinkActive,
} from "@/services/campaign-links";
import type { CampaignChannel, CampaignLink, CampaignPeriod, CampaignSummary } from "@/types/campaign-link";

const PAGE_SIZE = 20;
const MODULE = "Marketing";

const fmtPct = (v: number) => `${v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)}%`;

export default function AdOrderLinksScreen() {
  const { canRead, canWrite, canDelete } = useAuth();
  const { formatCurrency } = useCurrency();
  const [period, setPeriod] = useState<CampaignPeriod>("30d");
  const [channel, setChannel] = useState<CampaignChannel | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [summary, setSummary] = useState<CampaignSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [items, setItems] = useState<CampaignLink[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const loadedOnce = useRef(false);
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (showSpinner = true) => {
      const id = ++requestId.current;
      if (showSpinner) setLoading(true);
      const [sumRes, listRes] = await Promise.allSettled([
        getCampaignSummary(period),
        getCampaignLinks({
          page: 1,
          perPage: PAGE_SIZE,
          period,
          search: debouncedSearch || undefined,
          channel: channel === "all" ? undefined : channel,
        }),
      ]);
      if (id !== requestId.current) return;
      if (sumRes.status === "fulfilled") {
        setSummary(sumRes.value);
        setSummaryError(false);
      } else {
        setSummaryError(true);
      }
      if (listRes.status === "fulfilled") {
        setItems(listRes.value.data);
        setTotal(listRes.value.total);
        setPage(listRes.value.page);
        setLastPage(listRes.value.lastPage);
        setError(null);
      } else {
        setError(apiErrorMessage(listRes.reason, "Could not load ad order links."));
      }
      setLoading(false);
      loadedOnce.current = true;
    },
    [period, debouncedSearch, channel],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (loadedOnce.current) void load(false);
    }, [load]),
  );

  if (!canRead(MODULE)) return <AccessDenied />;

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loading || loadingMore || page >= lastPage) return;
    setLoadingMore(true);
    try {
      const res = await getCampaignLinks({
        page: page + 1,
        perPage: PAGE_SIZE,
        period,
        search: debouncedSearch || undefined,
        channel: channel === "all" ? undefined : channel,
      });
      setItems((prev) => [...prev, ...res.data.filter((l) => !prev.some((p) => p.id === l.id))]);
      setPage(res.page);
      setLastPage(res.lastPage);
      setTotal(res.total);
    } catch {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleActive = async (link: CampaignLink, value: boolean) => {
    setTogglingId(link.id);
    setItems((cur) => cur.map((l) => (l.id === link.id ? { ...l, isActive: value } : l)));
    try {
      const updated = await setCampaignLinkActive(link.id, value);
      if (updated) setItems((cur) => cur.map((l) => (l.id === link.id ? { ...l, isActive: updated.isActive } : l)));
    } catch (err) {
      setItems((cur) => cur.map((l) => (l.id === link.id ? { ...l, isActive: !value } : l)));
      Alert.alert("Update failed", apiErrorMessage(err, "Could not update the link."));
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = (link: CampaignLink) => {
    Alert.alert(
      "Delete link",
      `Delete "${link.name}"? The link stops working; orders it brought keep their source.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCampaignLink(link.id);
              setItems((cur) => cur.filter((l) => l.id !== link.id));
              setTotal((t) => Math.max(0, t - 1));
            } catch (err) {
              Alert.alert("Delete failed", apiErrorMessage(err, "Could not delete the link."));
            }
          },
        },
      ],
    );
  };

  const openMenu = (link: CampaignLink) => {
    Alert.alert(link.name, shareUrl(link) || undefined, [
      { text: "View stats", onPress: () => router.push(`/marketing/${link.id}` as any) },
      { text: "Share link", onPress: () => void shareText(shareUrl(link)) },
      { text: "Copy link", onPress: () => void copyText(shareUrl(link), "Link copied") },
      ...(canDelete(MODULE) ? [{ text: "Delete", style: "destructive" as const, onPress: () => confirmDelete(link) }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const filtered = Boolean(debouncedSearch) || channel !== "all";
  const channelsWithData = (summary?.channels ?? [])
    .filter((c) => c.clicks > 0 || c.orders > 0 || c.revenue > 0)
    .sort((a, b) => b.orders - a.orders || b.clicks - a.clicks);

  const header = (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
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

      <View style={styles.summaryCard}>
        <View style={styles.kpiRow}>
          <Kpi label="Clicks" value={summary ? String(summary.totals.clicks) : "—"} icon="hand-left-outline" />
          <Kpi label="Orders" value={summary ? String(summary.totals.orders) : "—"} icon="receipt-outline" />
        </View>
        <View style={styles.kpiRow}>
          <Kpi label="Revenue" value={summary ? formatCurrency(summary.totals.revenue) : "—"} icon="cash-outline" />
          <Kpi label="Conversion" value={summary ? fmtPct(summary.totals.conversionRate) : "—"} icon="trending-up-outline" />
        </View>

        {summaryError ? (
          <Text style={styles.summaryNote}>Summary is unavailable right now. Pull to refresh.</Text>
        ) : channelsWithData.length > 0 ? (
          <View style={styles.channelTable}>
            <View style={styles.channelHead}>
              <Text style={[styles.channelHeadText, { flex: 1 }]}>By channel</Text>
              <Text style={[styles.channelHeadText, styles.colNum]}>Clicks</Text>
              <Text style={[styles.channelHeadText, styles.colNum]}>Orders</Text>
              <Text style={[styles.channelHeadText, styles.colRev]}>Revenue</Text>
            </View>
            {channelsWithData.map((c) => {
              const meta = adSourceMeta(c.channel);
              return (
                <Pressable
                  key={c.channel}
                  style={styles.channelRow}
                  onPress={() => router.push({ pathname: "/(tabs)/orders", params: { adSource: c.channel } } as any)}
                >
                  <View style={[styles.channelIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={14} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.channelName} numberOfLines={1}>{meta.label}</Text>
                    <Text style={styles.channelConv}>{fmtPct(c.conversionRate)} conversion</Text>
                  </View>
                  <Text style={[styles.channelNum, styles.colNum]}>{c.clicks}</Text>
                  <Text style={[styles.channelNum, styles.colNum]}>{c.orders}</Text>
                  <Text style={[styles.channelNum, styles.colRev]} numberOfLines={1}>{formatCurrency(c.revenue)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : summary ? (
          <Text style={styles.summaryNote}>No clicks or ad orders in this period yet.</Text>
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search links..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Pressable style={[styles.chip, channel === "all" && styles.chipActive]} onPress={() => setChannel("all")}>
          <Text style={[styles.chipText, channel === "all" && styles.chipTextActive]}>All channels</Text>
        </Pressable>
        {CAMPAIGN_CHANNELS.map((c) => {
          const meta = adSourceMeta(c);
          const active = channel === c;
          return (
            <Pressable key={c} style={[styles.chip, active && styles.chipActive]} onPress={() => setChannel(c)}>
              <Ionicons name={meta.icon} size={13} color={active ? "#fff" : meta.color} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.listTitle}>Links{!loading ? ` (${total})` : ""}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ad order links</Text>
          <Text style={styles.subtitle}>Track orders from Facebook, Instagram, WhatsApp…</Text>
        </View>
        {canWrite(MODULE) ? (
          <Pressable style={styles.addBtn} onPress={() => router.push("/marketing/create" as any)}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      {loading && !loadedOnce.current ? (
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 12 }} /> : null}
          renderItem={({ item }) => {
            const meta = adSourceMeta(item.channel);
            const url = shareUrl(item);
            return (
              <Pressable
                style={[styles.card, !item.isActive && { opacity: 0.7 }]}
                onPress={() => router.push(`/marketing/${item.id}` as any)}
                onLongPress={() => openMenu(item)}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.cardIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>{targetSummary(item)}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Switch
                      value={item.isActive}
                      onValueChange={(v) => void toggleActive(item, v)}
                      disabled={!canWrite(MODULE) || togglingId === item.id}
                      trackColor={{ true: colors.primary, false: "#cbd5e1" }}
                    />
                    <Text style={[styles.activeText, item.isActive && { color: colors.primaryDark }]}>
                      {item.isActive ? "Active" : "Off"}
                    </Text>
                  </View>
                </View>

                {url ? (
                  <View style={styles.urlRow}>
                    <Ionicons name="link-outline" size={14} color={colors.muted} />
                    <Text style={styles.urlText} numberOfLines={1}>{url.replace(/^https?:\/\//, "")}</Text>
                    <Pressable onPress={() => void copyText(url, "Link copied")} hitSlop={8} style={styles.urlBtn}>
                      <Ionicons name="copy-outline" size={15} color={colors.primaryDark} />
                    </Pressable>
                    <Pressable onPress={() => void shareText(url)} hitSlop={8} style={styles.urlBtn}>
                      <Ionicons name="share-social-outline" size={15} color={colors.primaryDark} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.urlRow}>
                    <Ionicons name="warning-outline" size={14} color={colors.warning} />
                    <Text style={[styles.urlText, { color: colors.warning }]} numberOfLines={1}>
                      Store web address not set · {item.targetPath || "/"}
                    </Text>
                  </View>
                )}

                <View style={styles.statsRow}>
                  <Stat label="Clicks" value={String(item.clicks)} />
                  <Stat label="Orders" value={String(item.orders)} />
                  <Stat label="Revenue" value={formatCurrency(item.revenue)} wide />
                  <Stat label="Conv." value={fmtPct(item.conversionRate)} />
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.primaryDark} style={{ marginTop: 30 }} />
            ) : (
              <View style={styles.empty}>
                <Ionicons name={error ? "alert-circle-outline" : "megaphone-outline"} size={44} color={colors.muted} />
                <Text style={styles.emptyTitle}>{error ? "Couldn't load links" : filtered ? "No links found" : "No ad order links yet"}</Text>
                <Text style={styles.emptyText}>
                  {error ??
                    (filtered
                      ? "Try a different search or channel."
                      : "Create a link for each Facebook post, Instagram story or WhatsApp status. Orders placed through it are tagged so you can see which post sells.")}
                </Text>
                {!error && !filtered && canWrite(MODULE) ? (
                  <Pressable style={styles.emptyBtn} onPress={() => router.push("/marketing/create" as any)}>
                    <Text style={styles.emptyBtnText}>Create link</Text>
                  </Pressable>
                ) : null}
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.kpi}>
      <Ionicons name={icon} size={16} color={colors.primaryDark} />
      <View style={{ flex: 1 }}>
        <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.stat, wide && { flex: 1.6 }]}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12 },
  addBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  chipRow: { gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  summaryCard: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 12, gap: 8,
  },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.background, borderRadius: 12, padding: 10,
  },
  kpiValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
  kpiLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  summaryNote: { color: colors.muted, fontSize: 12, textAlign: "center", paddingVertical: 6 },
  channelTable: { marginTop: 4, gap: 2 },
  channelHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingBottom: 4 },
  channelHeadText: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  channelRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: colors.border,
  },
  channelIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  channelName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  channelConv: { color: colors.muted, fontSize: 11 },
  channelNum: { color: colors.text, fontSize: 13, fontWeight: "700" },
  colNum: { width: 50, textAlign: "right" },
  colRev: { width: 86, textAlign: "right" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8, height: 44,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  listTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 2 },
  card: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  cardMeta: { color: colors.muted, fontSize: 12 },
  cardRight: { alignItems: "center" },
  activeText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  urlRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  urlText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "600" },
  urlBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: "#ecfdf5",
    alignItems: "center", justifyContent: "center",
  },
  statsRow: { flexDirection: "row", gap: 6 },
  stat: { flex: 1, alignItems: "flex-start" },
  statValue: { color: colors.text, fontSize: 14, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 11 },
  empty: { alignItems: "center", paddingTop: 40, gap: 10, paddingHorizontal: 24 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  emptyBtn: {
    marginTop: 6, borderRadius: 12, backgroundColor: colors.primaryDark,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
