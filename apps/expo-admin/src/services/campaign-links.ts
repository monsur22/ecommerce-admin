import { api } from "@/lib/api";
import type {
  CampaignChannel,
  CampaignChannelSummary,
  CampaignLink,
  CampaignLinkDraft,
  CampaignLinkListParams,
  CampaignLinkListResult,
  CampaignLinkStats,
  CampaignPeriod,
  CampaignRecentOrder,
  CampaignSummary,
  CampaignTargetType,
} from "@/types/campaign-link";

export const CAMPAIGN_CHANNELS: CampaignChannel[] = ["facebook", "instagram", "whatsapp", "messenger", "tiktok", "google", "youtube", "other"];
const TARGET_TYPES: CampaignTargetType[] = ["product", "collection", "store", "quick_order"];

export const CAMPAIGN_PERIODS: { value: CampaignPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function pick(raw: any, ...keys: string[]): any {
  for (const k of keys) {
    if (raw?.[k] !== undefined && raw?.[k] !== null) return raw[k];
  }
  return undefined;
}

/** Conversion as a percentage 0–100 (server value when given, else orders / clicks). */
function pct(raw: any, clicks: number, orders: number): number {
  const v = pick(raw, "conversionRate", "conversion_rate", "conversion");
  if (v !== undefined) return num(v);
  return clicks > 0 ? (orders / clicks) * 100 : 0;
}

function normalizeChannel(value: unknown): CampaignChannel {
  const v = str(value).toLowerCase() as CampaignChannel;
  return CAMPAIGN_CHANNELS.includes(v) ? v : "other";
}

export function normalizeCampaignLink(raw: any): CampaignLink {
  const stats = raw?.stats ?? {};
  const clicks = num(pick(raw, "clicks", "clicksCount", "clicks_count") ?? pick(stats, "clicks"));
  const orders = num(pick(raw, "orders", "ordersCount", "orders_count") ?? pick(stats, "orders"));
  const revenue = num(pick(raw, "revenue") ?? pick(stats, "revenue"));
  const targetType = str(pick(raw, "targetType", "target_type")) as CampaignTargetType;
  const t = raw?.target;
  const targetId = pick(raw, "targetId", "target_id") ?? t?.id;
  return {
    id: num(raw?.id),
    name: str(raw?.name),
    channel: normalizeChannel(raw?.channel),
    targetType: TARGET_TYPES.includes(targetType) ? targetType : "store",
    targetId: targetId === undefined || targetId === null ? null : num(targetId),
    target:
      t || pick(raw, "targetName", "target_name")
        ? {
            id: targetId === undefined || targetId === null ? null : num(targetId),
            name: t?.name ?? pick(raw, "targetName", "target_name") ?? null,
            slug: t?.slug ?? null,
            image: t?.image ?? t?.imageUrl ?? null,
          }
        : null,
    code: str(raw?.code),
    utmSource: str(pick(raw, "utmSource", "utm_source")),
    utmMedium: str(pick(raw, "utmMedium", "utm_medium")),
    utmCampaign: str(pick(raw, "utmCampaign", "utm_campaign")),
    utmContent: str(pick(raw, "utmContent", "utm_content")),
    notes: str(raw?.notes),
    isActive: raw?.isActive === undefined && raw?.is_active === undefined ? true : bool(pick(raw, "isActive", "is_active")),
    storeBaseUrl: pick(raw, "storeBaseUrl", "store_base_url") ?? null,
    targetPath: str(pick(raw, "targetPath", "target_path")),
    fullUrl: str(pick(raw, "fullUrl", "full_url", "url")),
    shortUrl: str(pick(raw, "shortUrl", "short_url")),
    clicks,
    orders,
    revenue,
    conversionRate: pct(raw?.conversionRate !== undefined || raw?.conversion_rate !== undefined ? raw : stats, clicks, orders),
    createdByName: pick(raw, "createdByName", "created_by_name") ?? null,
    lastClickedAt: pick(raw, "lastClickedAt", "last_clicked_at") ?? null,
    createdAt: str(pick(raw, "createdAt", "created_at")),
    updatedAt: pick(raw, "updatedAt", "updated_at"),
  };
}

function draftToBody(draft: CampaignLinkDraft) {
  return {
    name: draft.name.trim(),
    channel: draft.channel,
    targetType: draft.targetType,
    targetId: draft.targetType === "store" ? null : draft.targetId ?? null,
    code: draft.code?.trim() || undefined,
    utmSource: draft.utmSource?.trim() || undefined,
    utmMedium: draft.utmMedium?.trim() || undefined,
    utmCampaign: draft.utmCampaign?.trim() || undefined,
    utmContent: draft.utmContent?.trim() || undefined,
    notes: draft.notes?.trim() || undefined,
    isActive: draft.isActive ?? true,
  };
}

export async function getCampaignLinks(params?: CampaignLinkListParams): Promise<CampaignLinkListResult> {
  const response = await api.get("/campaign-links", {
    params: {
      page: params?.page,
      perPage: params?.perPage,
      search: params?.search || undefined,
      channel: params?.channel,
      targetType: params?.targetType,
      isActive: params?.active === undefined ? undefined : params.active ? "true" : "false",
      period: params?.period,
    },
  });
  const body = response.data ?? {};
  const payload = body.data ?? {};
  const items: any[] = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : [];
  const meta = body.meta?.pagination ?? body.meta ?? (Array.isArray(payload) ? {} : payload);
  const total = num(meta.total ?? items.length, items.length);
  const page = num(meta.current_page ?? meta.currentPage ?? meta.page ?? params?.page ?? 1, 1);
  const perPage = num(meta.perPage ?? meta.per_page ?? params?.perPage ?? 20, 20);
  const lastPage = num(meta.lastPage ?? meta.last_page ?? Math.max(1, Math.ceil(total / Math.max(1, perPage))), 1);
  return { data: items.map(normalizeCampaignLink), total, page, lastPage };
}

export async function getCampaignLink(id: number): Promise<CampaignLink> {
  const response = await api.get(`/campaign-links/${id}`);
  return normalizeCampaignLink(response.data?.data ?? response.data);
}

export async function createCampaignLink(draft: CampaignLinkDraft): Promise<CampaignLink> {
  const response = await api.post("/campaign-links", draftToBody(draft));
  return normalizeCampaignLink(response.data?.data ?? response.data);
}

/** Partial update (any body field). */
export async function updateCampaignLink(id: number, draft: Partial<CampaignLinkDraft>): Promise<CampaignLink> {
  const response = await api.put(`/campaign-links/${id}`, draft);
  return normalizeCampaignLink(response.data?.data ?? response.data);
}

/** Turn a link on/off (inactive short links stop redirecting to the target). */
export async function setCampaignLinkActive(id: number, isActive: boolean): Promise<CampaignLink | null> {
  const response = await api.patch(`/campaign-links/${id}/status`, { isActive });
  const data = response.data?.data;
  return data && typeof data === "object" && "id" in data ? normalizeCampaignLink(data) : null;
}

export async function deleteCampaignLink(id: number) {
  await api.delete(`/campaign-links/${id}`);
}

export async function getCampaignLinkStats(id: number, period: CampaignPeriod = "30d"): Promise<CampaignLinkStats> {
  const response = await api.get(`/campaign-links/${id}/stats`, { params: { period } });
  const d = response.data?.data ?? {};
  const clicks = num(d.clicks);
  const orders = num(d.orders);
  const byDayRaw: any[] = Array.isArray(d.byDay) ? d.byDay : Array.isArray(d.by_day) ? d.by_day : Array.isArray(d.daily) ? d.daily : [];
  return {
    clicks,
    orders,
    revenue: num(d.revenue),
    confirmed: num(d.confirmed),
    delivered: num(d.delivered),
    cancelled: num(d.cancelled),
    pending: num(d.pending),
    conversionRate: pct(d, clicks, orders),
    byDay: byDayRaw.map((r) => ({
      date: str(r.date ?? r.day),
      clicks: num(r.clicks),
      orders: num(r.orders),
      revenue: num(r.revenue),
    })),
    recentOrders: (Array.isArray(d.recentOrders) ? d.recentOrders : []).map(
      (o: any): CampaignRecentOrder => ({
        id: num(o.id),
        invoiceNo: str(o.invoiceNo ?? o.invoice_no ?? o.id),
        customerName: str(o.customerName ?? o.customer_name) || "Customer",
        amount: num(o.amount),
        status: str(o.status),
        orderTime: str(o.orderTime ?? o.order_time ?? o.createdAt),
        isQuickOrder: bool(o.isQuickOrder),
        possibleDuplicate: bool(o.possibleDuplicate),
      }),
    ),
    link: d.link && typeof d.link === "object" ? normalizeCampaignLink(d.link) : null,
  };
}

export async function getCampaignSummary(period: CampaignPeriod = "30d"): Promise<CampaignSummary> {
  const response = await api.get("/campaign-links/summary", { params: { period } });
  const d = response.data?.data ?? {};
  const rawChannels: any[] = Array.isArray(d.channels)
    ? d.channels
    : Array.isArray(d.byChannel)
      ? d.byChannel
      : Array.isArray(d.by_channel)
        ? d.by_channel
        : d.byChannel && typeof d.byChannel === "object"
          ? Object.entries(d.byChannel).map(([channel, v]) => ({ channel, ...(v as object) }))
          : [];
  const channels: CampaignChannelSummary[] = rawChannels.map((c) => {
    const clicks = num(c.clicks);
    const orders = num(c.orders);
    return { channel: str(c.channel ?? c.adSource ?? c.source), label: c.label ?? undefined, clicks, orders, revenue: num(c.revenue), conversionRate: pct(c, clicks, orders) };
  });
  const t = d.totals ?? d.total ?? {};
  const clicks = t.clicks !== undefined ? num(t.clicks) : channels.reduce((a, c) => a + c.clicks, 0);
  const orders = t.orders !== undefined ? num(t.orders) : channels.reduce((a, c) => a + c.orders, 0);
  const revenue = t.revenue !== undefined ? num(t.revenue) : channels.reduce((a, c) => a + c.revenue, 0);
  const top: any[] = Array.isArray(d.topLinks) ? d.topLinks : Array.isArray(d.top_links) ? d.top_links : [];
  return {
    totals: {
      clicks,
      orders,
      revenue,
      conversionRate: pct(t, clicks, orders),
      links: t.links !== undefined ? num(t.links) : undefined,
      activeLinks: t.activeLinks !== undefined ? num(t.activeLinks) : undefined,
    },
    channels,
    topLinks: top.map(normalizeCampaignLink),
  };
}

export function slugify(value: string, max = 100): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

const UTM_MEDIUM: Record<CampaignChannel, string> = {
  facebook: "social",
  instagram: "social",
  messenger: "social",
  tiktok: "social",
  youtube: "social",
  whatsapp: "chat",
  google: "cpc",
  other: "referral",
};

/**
 * Preview of the UTM values the server fills when they are left blank (contract 3.1):
 * source = channel, medium by channel, campaign = slug(name), content = target slug or "store".
 */
export function suggestUtm(channel: CampaignChannel, name: string, targetSlug?: string | null) {
  return {
    utmSource: channel,
    utmMedium: UTM_MEDIUM[channel],
    utmCampaign: slugify(name),
    utmContent: targetSlug ? slugify(targetSlug) : "store",
  };
}
