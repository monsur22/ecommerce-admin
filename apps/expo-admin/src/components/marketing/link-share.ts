import { Alert, Platform, Share, ToastAndroid } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { CampaignLink, CampaignTargetType } from "@/types/campaign-link";

export const TARGET_LABEL: Record<CampaignTargetType, string> = {
  product: "Product page",
  quick_order: "Quick order form",
  collection: "Collection",
  store: "Whole store",
};

/** The URL to post: the short link when the server made one, else the full tracked URL. */
export function shareUrl(link: Pick<CampaignLink, "shortUrl" | "fullUrl">): string {
  return link.shortUrl || link.fullUrl;
}

export function targetSummary(link: Pick<CampaignLink, "targetType" | "target">): string {
  const name = link.target?.name;
  if (link.targetType === "store") return TARGET_LABEL.store;
  return name ? `${TARGET_LABEL[link.targetType]} · ${name}` : TARGET_LABEL[link.targetType];
}

/** Ready-to-post text for a Facebook / Instagram / WhatsApp post with the link. */
export function buildCaption(link: Pick<CampaignLink, "channel" | "targetType" | "target" | "shortUrl" | "fullUrl">): string {
  const url = shareUrl(link);
  const product = link.target?.name;
  const headline =
    link.targetType === "store"
      ? "New arrivals are live in our shop!"
      : product
        ? `${product} is available now!`
        : "Now available!";
  const howTo =
    link.targetType === "quick_order"
      ? "Order in 1 minute: tap the link, enter your name, phone and address. No login needed."
      : "Tap the link to see details and order.";
  const lines = [headline, "", howTo, "Cash on delivery available. We'll call you to confirm.", "", `Order here: ${url}`];
  if (link.channel === "whatsapp") lines.push("", "Reply to this message if you have any questions.");
  return lines.join("\n");
}

function toast(message: string) {
  if (Platform.OS === "android") ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(message);
}

export async function copyText(text: string, message = "Copied") {
  if (!text) return;
  await Clipboard.setStringAsync(text);
  toast(message);
}

export async function shareText(text: string) {
  if (!text) return;
  try {
    await Share.share({ message: text });
  } catch {
    Alert.alert("Could not open share sheet", "Copy the link instead.");
  }
}
