import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import type { CampaignDayStat } from "@/types/campaign-link";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** More days than this are grouped so every bar stays wide enough to tap. */
const MAX_BARS = 45;
const CLICK_COLOR = "#a7f3d0";

/** "2026-10-04" → "4 Oct" (no Intl dependency). */
function dayLabel(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : iso;
}

interface Bar {
  key: string;
  label: string;
  clicks: number;
  orders: number;
  revenue: number;
}

/**
 * Daily clicks (light) with orders (solid) on the same scale — mirrors the web admin's ClicksOrdersChart.
 * Long ranges (e.g. "All time") are grouped into equal buckets of days. Tap a bar for its numbers.
 */
export function ClicksOrdersChart({
  days,
  height = 140,
  formatMoney,
}: {
  days: CampaignDayStat[];
  height?: number;
  formatMoney: (value: number) => string;
}) {
  const { bars, bucket } = useMemo(() => {
    const size = Math.max(1, Math.ceil(days.length / MAX_BARS));
    const out: Bar[] = [];
    for (let i = 0; i < days.length; i += size) {
      const group = days.slice(i, i + size);
      const first = group[0].date;
      const last = group[group.length - 1].date;
      out.push({
        key: first,
        label: size === 1 || first === last ? dayLabel(first) : `${dayLabel(first)} – ${dayLabel(last)}`,
        clicks: group.reduce((s, d) => s + d.clicks, 0),
        orders: group.reduce((s, d) => s + d.orders, 0),
        revenue: group.reduce((s, d) => s + d.revenue, 0),
      });
    }
    return { bars: out, bucket: size };
  }, [days]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => setSelected(null), [days]);

  if (!bars.some((b) => b.clicks || b.orders)) {
    return <Text style={styles.empty}>No clicks or orders in this period.</Text>;
  }

  const peak = Math.max(1, ...bars.map((b) => Math.max(b.clicks, b.orders)));
  // first / middle / last date under the plot (bars are too narrow for one label each)
  const axisKeys = bars.length > 2
    ? [bars[0].key, bars[Math.floor((bars.length - 1) / 2)].key, bars[bars.length - 1].key]
    : bars.map((b) => b.key);
  const current = bars.find((b) => b.key === selected) ?? null;
  const unit = bucket === 1 ? "day" : `${bucket} days`;

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.detail}>
        {current ? (
          <>
            <Text style={styles.detailDate}>{current.label}</Text>
            <Text style={styles.detailText}>
              {current.clicks} click{current.clicks === 1 ? "" : "s"} · {current.orders} order{current.orders === 1 ? "" : "s"}
              {current.revenue > 0 ? ` · ${formatMoney(current.revenue)}` : ""}
            </Text>
          </>
        ) : (
          <Text style={styles.detailHint}>Tap a bar to see that {bucket === 1 ? "day" : "period"}</Text>
        )}
      </View>

      <View
        style={[styles.plot, { height }]}
        accessibilityRole="image"
        accessibilityLabel={`Clicks and orders per ${unit}, peak ${peak}`}
      >
        {bars.map((b) => {
          const active = b.key === selected;
          return (
            <Pressable
              key={b.key}
              style={[styles.col, active && styles.colActive]}
              onPress={() => setSelected(active ? null : b.key)}
              hitSlop={{ top: 6, bottom: 6 }}
            >
              <View style={styles.barWrap}>
                <View
                  style={[styles.bar, { backgroundColor: CLICK_COLOR, height: `${b.clicks ? Math.max(2, (b.clicks / peak) * 100) : 0}%` }]}
                />
                <View
                  style={[styles.bar, { backgroundColor: colors.primaryDark, height: `${b.orders ? Math.max(3, (b.orders / peak) * 100) : 0}%` }]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.axis}>
        {axisKeys.map((k) => (
          <Text key={k} style={styles.axisLabel}>{dayLabel(k)}</Text>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: CLICK_COLOR }]} />
          <Text style={styles.legendText}>Clicks</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.primaryDark }]} />
          <Text style={styles.legendText}>Orders</Text>
        </View>
        <Text style={[styles.legendText, { marginLeft: "auto" }]}>Peak {peak}/{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 6 },
  detail: { minHeight: 34, justifyContent: "center" },
  detailDate: { color: colors.text, fontSize: 12, fontWeight: "800" },
  detailText: { color: colors.muted, fontSize: 12 },
  detailHint: { color: colors.muted, fontSize: 11 },
  plot: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  col: { flex: 1, height: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  colActive: { backgroundColor: "#f1f5f9" },
  barWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    maxWidth: 18,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  axisLabel: { color: colors.muted, fontSize: 10 },
  legend: { flexDirection: "row", alignItems: "center", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: colors.muted, fontSize: 11 },
});
