import { useMemo } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors } from "@/constants/theme";
import { qrMatrix } from "@/lib/qr";

/**
 * QR modules as one SVG path (4-module quiet zone), or null when the text is too long.
 * Horizontal runs of dark modules are merged so no hairline seams show between them.
 */
function qrPath(value: string): { d: string; n: number } | null {
  const matrix = qrMatrix(value);
  if (!matrix) return null;
  let d = "";
  matrix.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let run = 1;
      while (x + run < row.length && row[x + run]) run++;
      d += `M${x + 4},${y + 4}h${run}v1h-${run}z`;
      x += run - 1;
    }
  });
  return { d, n: matrix.length + 8 };
}

/** QR code for a URL (same pure-TS encoder as the web admin). */
export function LinkQrCode({ value, size = 184 }: { value: string; size?: number }) {
  const qr = useMemo(() => qrPath(value), [value]);
  if (!qr) {
    return <Text style={styles.tooLong}>This link is too long for a QR code. Use the short link.</Text>;
  }
  // whole-dp modules keep the edges on the pixel grid (crisper, easier to scan)
  const px = Math.max(1, Math.floor(size / qr.n)) * qr.n;
  return (
    <View style={styles.frame} accessibilityRole="image" accessibilityLabel={`QR code for ${value}`}>
      <Svg width={px} height={px} viewBox={`0 0 ${qr.n} ${qr.n}`}>
        <Rect width={qr.n} height={qr.n} fill="#ffffff" />
        <Path d={qr.d} fill="#000000" />
      </Svg>
    </View>
  );
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Share a printable PDF with the QR code, the link name and the URL (for flyers / shop counters). */
export async function shareQrPdf(value: string, title: string) {
  const qr = qrPath(value);
  if (!qr) {
    Alert.alert("QR code unavailable", "This link is too long for a QR code. Use the short link.");
    return;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.n} ${qr.n}" width="320" height="320" shape-rendering="crispEdges"><rect width="${qr.n}" height="${qr.n}" fill="#fff"/><path d="${qr.d}" fill="#000"/></svg>`;
  const html = `
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body style="font-family: -apple-system, Roboto, Arial, sans-serif; text-align: center; padding: 48px 24px; color: #0f172a;">
        <h2 style="margin: 0 0 8px;">${escapeHtml(title)}</h2>
        <p style="margin: 0 0 24px; color: #64748b;">Scan to order</p>
        ${svg}
        <p style="margin-top: 24px; font-size: 14px; word-break: break-all;">${escapeHtml(value)}</p>
      </body>
    </html>`;
  try {
    const result = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", dialogTitle: `QR code: ${title}`, UTI: "com.adobe.pdf" });
      return;
    }
    await Share.share({ message: value });
  } catch {
    Alert.alert("Could not share the QR code", "Try again, or share the link instead.");
  }
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "center",
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#ffffff",
  },
  tooLong: { color: colors.muted, fontSize: 12, textAlign: "center" },
});
