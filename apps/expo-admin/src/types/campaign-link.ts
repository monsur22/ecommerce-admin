/** Ad order links ("campaign links") — Marketing module. */

export type CampaignChannel = "facebook" | "instagram" | "whatsapp" | "messenger" | "tiktok" | "google" | "youtube" | "other";
export type CampaignTargetType = "product" | "collection" | "store" | "quick_order";
export type CampaignPeriod = "today" | "7d" | "30d" | "90d" | "all";

export interface CampaignLinkTarget {
  id: number | null;
  name: string | null;
  slug?: string | null;
  image?: string | null;
}

export interface CampaignLink {
  id: number;
  name: string;
  channel: CampaignChannel;
  targetType: CampaignTargetType;
  targetId: number | null;
  target: CampaignLinkTarget | null;
  code: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  notes: string;
  isActive: boolean;
  /** Store base URL; null when the store URL cannot be resolved (then only targetPath is set) */
  storeBaseUrl: string | null;
  targetPath: string;
  fullUrl: string;
  shortUrl: string;
  clicks: number;
  orders: number;
  revenue: number;
  /** Percentage 0–100 */
  conversionRate: number;
  createdByName?: string | null;
  lastClickedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CampaignLinkListParams {
  page?: number;
  perPage?: number;
  search?: string;
  channel?: CampaignChannel;
  targetType?: CampaignTargetType;
  active?: boolean;
  period?: CampaignPeriod;
}

export interface CampaignLinkListResult {
  data: CampaignLink[];
  total: number;
  page: number;
  lastPage: number;
}

export interface CampaignLinkDraft {
  name: string;
  channel: CampaignChannel;
  targetType: CampaignTargetType;
  targetId?: number | null;
  /** Custom short code (4–20 chars [A-Za-z0-9_-]); blank = auto */
  code?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  notes?: string;
  isActive?: boolean;
}

export interface CampaignDayStat {
  date: string;
  clicks: number;
  orders: number;
  revenue: number;
}

export interface CampaignLinkStats {
  clicks: number;
  orders: number;
  revenue: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
  pending: number;
  conversionRate: number;
  byDay: CampaignDayStat[];
  recentOrders: CampaignRecentOrder[];
  link: CampaignLink | null;
}

export interface CampaignRecentOrder {
  id: number;
  invoiceNo: string;
  customerName: string;
  amount: number;
  status: string;
  orderTime: string;
  isQuickOrder: boolean;
  possibleDuplicate: boolean;
}

export interface CampaignChannelSummary {
  channel: string;
  label?: string;
  clicks: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

export interface CampaignSummary {
  totals: { clicks: number; orders: number; revenue: number; conversionRate: number; links?: number; activeLinks?: number };
  channels: CampaignChannelSummary[];
  topLinks: CampaignLink[];
}
