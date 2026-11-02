/**
 * Campaign / ad order links API — proxied through the Next.js route.
 * Trackable links for Facebook / Instagram / WhatsApp / TikTok posts and ads (AD_ORDERS_API_CONTRACT.md §3).
 */

import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const API_URL = '/api/proxy';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      const companyId = getCompanyId();
      if (companyId) {
        if (!config.params) config.params = {};
        config.params.company_id = companyId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const LINK_CHANNELS = ['facebook', 'instagram', 'whatsapp', 'messenger', 'tiktok', 'google', 'youtube', 'other'] as const;
export type LinkChannel = typeof LINK_CHANNELS[number];

export const LINK_TARGETS = ['product', 'collection', 'store', 'quick_order'] as const;
export type LinkTargetType = typeof LINK_TARGETS[number];

export type LinkPeriod = 'today' | '7d' | '30d' | '90d' | 'all';

export interface LinkStats {
  clicks: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

export interface CampaignLink {
  id: number;
  name: string;
  channel: LinkChannel;
  targetType: LinkTargetType;
  targetId: number | null;
  target: { id: number; name: string; slug?: string | null; image?: string | null } | null;
  code: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  notes: string | null;
  isActive: boolean;
  createdBy: number | null;
  createdByName: string | null;
  /** null when the store URL cannot be resolved (then fullUrl / shortUrl are null too). */
  storeBaseUrl: string | null;
  targetPath: string;
  fullUrl: string | null;
  shortUrl: string | null;
  stats: LinkStats;
  lastClickedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignLinkPayload {
  name: string;
  channel: LinkChannel;
  targetType: LinkTargetType;
  targetId?: number | null;
  /** null = auto (6 chars). Custom: 4–20 chars [A-Za-z0-9_-]. */
  code?: string | null;
  /** null / empty = server default from channel + name + target. */
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface PeriodInfo { key: string; from: string; to: string }

export interface ChannelSummary extends LinkStats { channel: string; label: string }

export interface LinksSummary {
  period: PeriodInfo;
  totals: LinkStats & { links: number; activeLinks: number };
  byChannel: ChannelSummary[];
  topLinks: (LinkStats & { id: number; name: string; code: string; channel: string })[];
}

export interface LinkOrder {
  id: number;
  invoiceNo: string;
  customerName: string;
  amount: number;
  status: string;
  orderTime: string;
  isQuickOrder: boolean;
  possibleDuplicate: boolean;
}

export interface LinkDetailStats extends LinkStats {
  link: CampaignLink;
  period: PeriodInfo;
  confirmed: number;
  delivered: number;
  cancelled: number;
  pending: number;
  byDay: { date: string; clicks: number; orders: number; revenue: number }[];
  recentOrders: LinkOrder[];
}

const n = (v: any): number => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const s = (v: any): string | null => (v === null || v === undefined || v === '' ? null : String(v));

const normalizeStats = (st: any): LinkStats => ({
  clicks: n(st?.clicks),
  orders: n(st?.orders),
  revenue: n(st?.revenue),
  conversionRate: n(st?.conversionRate ?? st?.conversion_rate),
});

export const normalizeLink = (l: any): CampaignLink => ({
  id: Number(l?.id),
  name: l?.name ?? '',
  channel: (l?.channel ?? 'other') as LinkChannel,
  targetType: (l?.targetType ?? l?.target_type ?? 'store') as LinkTargetType,
  targetId: l?.targetId ?? l?.target_id ?? null,
  target: l?.target ? { id: Number(l.target.id), name: l.target.name ?? '', slug: l.target.slug ?? null, image: l.target.image ?? l.target.imageUrl ?? null } : null,
  code: l?.code ?? '',
  utmSource: s(l?.utmSource ?? l?.utm_source),
  utmMedium: s(l?.utmMedium ?? l?.utm_medium),
  utmCampaign: s(l?.utmCampaign ?? l?.utm_campaign),
  utmContent: s(l?.utmContent ?? l?.utm_content),
  notes: s(l?.notes),
  isActive: !!(l?.isActive ?? l?.is_active),
  createdBy: l?.createdBy ?? null,
  createdByName: l?.createdByName ?? null,
  storeBaseUrl: s(l?.storeBaseUrl),
  targetPath: l?.targetPath ?? '',
  fullUrl: s(l?.fullUrl),
  shortUrl: s(l?.shortUrl),
  stats: normalizeStats(l?.stats),
  lastClickedAt: l?.lastClickedAt ?? null,
  createdAt: l?.createdAt ?? l?.created_at ?? '',
  updatedAt: l?.updatedAt ?? l?.updated_at ?? '',
});

const normalizePeriod = (p: any): PeriodInfo => ({ key: p?.key ?? '', from: p?.from ?? '', to: p?.to ?? '' });

export interface ListParams {
  search?: string;
  channel?: string;
  targetType?: string;
  isActive?: 'true' | 'false';
  period?: LinkPeriod;
  page?: number;
  perPage?: number;
}

export const campaignLinkApi = {
  getAll: async (params?: ListParams): Promise<{ data: CampaignLink[]; total: number; lastPage: number }> => {
    const res = await api.get('/campaign-links', { params });
    const list = Array.isArray(res.data?.data) ? res.data.data : (res.data?.data?.data ?? []);
    const pg = res.data?.meta?.pagination ?? {};
    return {
      data: list.map(normalizeLink),
      total: n(pg.total ?? list.length),
      lastPage: Math.max(1, n(pg.lastPage ?? pg.last_page ?? 1)),
    };
  },

  summary: async (period: LinkPeriod): Promise<LinksSummary> => {
    const res = await api.get('/campaign-links/summary', { params: { period } });
    const d = res.data?.data ?? {};
    return {
      period: normalizePeriod(d.period),
      totals: { ...normalizeStats(d.totals), links: n(d.totals?.links), activeLinks: n(d.totals?.activeLinks) },
      byChannel: (d.byChannel ?? []).map((c: any) => ({ ...normalizeStats(c), channel: c.channel, label: c.label ?? c.channel })),
      topLinks: (d.topLinks ?? []).map((t: any) => ({ ...normalizeStats(t), id: Number(t.id), name: t.name ?? '', code: t.code ?? '', channel: t.channel ?? 'other' })),
    };
  },

  getById: async (id: number): Promise<CampaignLink> => {
    const res = await api.get(`/campaign-links/${id}`);
    return normalizeLink(res.data?.data);
  },

  create: async (data: CampaignLinkPayload): Promise<CampaignLink> => {
    const res = await api.post('/campaign-links', data);
    return normalizeLink(res.data?.data);
  },

  update: async (id: number, data: Partial<CampaignLinkPayload>): Promise<CampaignLink> => {
    const res = await api.put(`/campaign-links/${id}`, data);
    return normalizeLink(res.data?.data);
  },

  setActive: async (id: number, isActive: boolean): Promise<CampaignLink> => {
    const res = await api.patch(`/campaign-links/${id}/status`, { isActive });
    return normalizeLink(res.data?.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/campaign-links/${id}`);
  },

  stats: async (id: number, period: LinkPeriod): Promise<LinkDetailStats> => {
    const res = await api.get(`/campaign-links/${id}/stats`, { params: { period } });
    const d = res.data?.data ?? {};
    return {
      ...normalizeStats(d),
      link: normalizeLink(d.link),
      period: normalizePeriod(d.period),
      confirmed: n(d.confirmed),
      delivered: n(d.delivered),
      cancelled: n(d.cancelled),
      pending: n(d.pending),
      byDay: (d.byDay ?? []).map((b: any) => ({ date: b.date, clicks: n(b.clicks), orders: n(b.orders), revenue: n(b.revenue) })),
      recentOrders: (d.recentOrders ?? []).map((o: any) => ({
        id: Number(o.id), invoiceNo: o.invoiceNo ?? '', customerName: o.customerName ?? '', amount: n(o.amount),
        status: o.status ?? '', orderTime: o.orderTime ?? '', isQuickOrder: !!o.isQuickOrder, possibleDuplicate: !!o.possibleDuplicate,
      })),
    };
  },
};

export default campaignLinkApi;
