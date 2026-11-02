import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { adSourceMeta } from "@/components/orders/AdSourceBadge";
import { apiErrorMessage, apiFieldErrors } from "@/lib/format";
import { getImageUrl } from "@/lib/images";
import {
  CAMPAIGN_CHANNELS,
  createCampaignLink,
  getCampaignLink,
  slugify,
  suggestUtm,
  updateCampaignLink,
} from "@/services/campaign-links";
import { getDisplayPrice, getProducts } from "@/services/products";
import { getCollections } from "@/services/collections";
import type { CampaignChannel, CampaignLinkDraft, CampaignTargetType } from "@/types/campaign-link";

const MODULE = "Marketing";

type PickedTarget = { id: number; name: string; image?: string | null; slug?: string | null; meta?: string };

const TARGETS: { value: CampaignTargetType; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "quick_order", label: "Quick order form", hint: "One-page order form for a product. Best for ads.", icon: "flash-outline" },
  { value: "product", label: "Product page", hint: "Opens the product in your online store.", icon: "cube-outline" },
  { value: "collection", label: "Collection", hint: "A group of products, e.g. Eid collection.", icon: "albums-outline" },
  { value: "store", label: "Whole store", hint: "Opens your store home page.", icon: "storefront-outline" },
];

export default function CampaignLinkFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const isEdit = editId !== null && Number.isFinite(editId);
  const { canWrite } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("facebook");
  const [targetType, setTargetType] = useState<CampaignTargetType>("quick_order");
  const [target, setTarget] = useState<PickedTarget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customUtm, setCustomUtm] = useState(isEdit);
  const [utm, setUtm] = useState({ utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "" });
  const [code, setCode] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isEdit || editId === null) return;
    let cancelled = false;
    getCampaignLink(editId)
      .then((link) => {
        if (cancelled) return;
        setName(link.name);
        setChannel(link.channel);
        setTargetType(link.targetType);
        setTarget(
          link.targetId !== null
            ? { id: link.targetId, name: link.target?.name ?? `#${link.targetId}`, image: link.target?.image, slug: link.target?.slug }
            : null,
        );
        setUtm({
          utmSource: link.utmSource,
          utmMedium: link.utmMedium,
          utmCampaign: link.utmCampaign,
          utmContent: link.utmContent,
        });
        setCode(link.code);
        setOriginalCode(link.code);
        setNotes(link.notes);
        setIsActive(link.isActive);
      })
      .catch((err) => {
        Alert.alert("Could not load link", apiErrorMessage(err));
        router.back();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, editId]);

  const needsTarget = targetType !== "store";
  const pickerKind: "product" | "collection" = targetType === "collection" ? "collection" : "product";

  const autoUtm = useMemo(
    () => suggestUtm(channel, name, needsTarget ? target?.slug ?? (target ? slugify(target.name) : null) : null),
    [channel, name, needsTarget, target],
  );
  const shownUtm = customUtm ? utm : autoUtm;

  if (!canWrite(MODULE)) return <AccessDenied />;

  const changeTargetType = (next: CampaignTargetType) => {
    if (next === targetType) return;
    const sameKind = (next === "collection") === (targetType === "collection");
    setTargetType(next);
    if (!sameKind || next === "store") setTarget(null);
    setErrors((e) => ({ ...e, targetType: "", targetId: "" }));
  };

  const startCustomUtm = () => {
    setUtm(autoUtm);
    setCustomUtm(true);
  };

  const save = async () => {
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = "Give the link a name.";
    if (needsTarget && !target) local.targetId = targetType === "collection" ? "Choose a collection." : "Choose a product.";
    if (code.trim() && !/^[A-Za-z0-9_-]{4,20}$/.test(code.trim())) {
      local.code = "The code may only contain letters, numbers, - and _ (4-20 characters).";
    }
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    const draft: CampaignLinkDraft = {
      name: name.trim(),
      channel,
      targetType,
      targetId: needsTarget ? target?.id ?? null : null,
      notes: notes.trim(),
      isActive,
      // Code: blank = auto on create; on edit only sent when changed.
      ...(code.trim() && code.trim().toLowerCase() !== originalCode.toLowerCase() ? { code: code.trim() } : {}),
      ...(customUtm
        ? {
            utmSource: utm.utmSource.trim(),
            utmMedium: utm.utmMedium.trim(),
            utmCampaign: utm.utmCampaign.trim(),
            utmContent: utm.utmContent.trim(),
          }
        : {}),
    };

    setSaving(true);
    try {
      if (isEdit && editId !== null) {
        await updateCampaignLink(editId, draft);
        router.back();
      } else {
        const created = await createCampaignLink(draft);
        router.replace(`/marketing/${created.id}` as any);
      }
    } catch (err) {
      const fieldErrors = apiFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      Alert.alert("Could not save link", apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? "Edit ad order link" : "New ad order link"}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={[styles.input, errors.name ? styles.inputError : null]}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (errors.name) setErrors((e) => ({ ...e, name: "" }));
                }}
                placeholder="e.g. Eid Panjabi FB post"
                placeholderTextColor="#94a3b8"
                maxLength={120}
              />
              {errors.name ? <Text style={styles.error}>{errors.name}</Text> : (
                <Text style={styles.help}>Only you see this. Name it after the post or ad.</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Where will you post it?</Text>
              <View style={styles.channelGrid}>
                {CAMPAIGN_CHANNELS.map((c) => {
                  const meta = adSourceMeta(c);
                  const active = channel === c;
                  return (
                    <Pressable
                      key={c}
                      style={[styles.channelChip, active && { borderColor: meta.color, backgroundColor: meta.bg }]}
                      onPress={() => setChannel(c)}
                    >
                      <Ionicons name={meta.icon} size={16} color={meta.color} />
                      <Text style={[styles.channelText, active && { color: meta.color }]}>{meta.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.channel ? <Text style={styles.error}>{errors.channel}</Text> : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>What should the link open?</Text>
              <View style={{ gap: 8 }}>
                {TARGETS.map((t) => {
                  const active = targetType === t.value;
                  return (
                    <Pressable
                      key={t.value}
                      style={[styles.targetCard, active && styles.targetCardActive]}
                      onPress={() => changeTargetType(t.value)}
                    >
                      <View style={[styles.targetIcon, active && { backgroundColor: colors.primaryDark }]}>
                        <Ionicons name={t.icon} size={18} color={active ? "#fff" : colors.primaryDark} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.targetLabel}>{t.label}</Text>
                        <Text style={styles.targetHint}>{t.hint}</Text>
                      </View>
                      <Ionicons
                        name={active ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={active ? colors.primaryDark : colors.muted}
                      />
                    </Pressable>
                  );
                })}
              </View>
              {errors.targetType ? <Text style={styles.error}>{errors.targetType}</Text> : null}

              {needsTarget ? (
                <Pressable
                  style={[styles.pickRow, errors.targetId ? styles.inputError : null]}
                  onPress={() => setPickerOpen(true)}
                >
                  {target ? (
                    <>
                      {getImageUrl(target.image ?? null) ? (
                        <Image source={{ uri: getImageUrl(target.image ?? null)! }} style={styles.pickThumb} />
                      ) : (
                        <View style={[styles.pickThumb, styles.pickThumbEmpty]}>
                          <Ionicons name={pickerKind === "collection" ? "albums-outline" : "cube-outline"} size={18} color={colors.muted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickName} numberOfLines={1}>{target.name}</Text>
                        <Text style={styles.pickMeta}>Tap to change</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={[styles.pickThumb, styles.pickThumbEmpty]}>
                        <Ionicons name="add" size={20} color={colors.primaryDark} />
                      </View>
                      <Text style={[styles.pickName, { flex: 1, color: colors.primaryDark }]}>
                        {pickerKind === "collection" ? "Choose a collection" : "Choose a product"}
                      </Text>
                    </>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              ) : null}
              {errors.targetId ? <Text style={styles.error}>{errors.targetId}</Text> : null}
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Tracking (UTM)</Text>
                {customUtm ? (
                  !isEdit ? (
                    <Pressable onPress={() => setCustomUtm(false)} hitSlop={8}>
                      <Text style={styles.linkText}>Use automatic</Text>
                    </Pressable>
                  ) : null
                ) : (
                  <Pressable onPress={startCustomUtm} hitSlop={8}>
                    <Text style={styles.linkText}>Customize</Text>
                  </Pressable>
                )}
              </View>
              {!customUtm ? (
                <Text style={styles.help}>Filled automatically from the channel and name. Google Analytics and Meta read these.</Text>
              ) : null}
              {(
                [
                  ["utmSource", "Source"],
                  ["utmMedium", "Medium"],
                  ["utmCampaign", "Campaign"],
                  ["utmContent", "Content"],
                ] as const
              ).map(([key, label]) =>
                customUtm ? (
                  <View key={key} style={{ gap: 4 }}>
                    <Text style={styles.smallLabel}>{label}</Text>
                    <TextInput
                      style={[styles.input, styles.inputSmall, errors[key] ? styles.inputError : null]}
                      value={utm[key]}
                      onChangeText={(t) => setUtm((u) => ({ ...u, [key]: t }))}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={100}
                      placeholder="auto"
                      placeholderTextColor="#94a3b8"
                    />
                    {errors[key] ? <Text style={styles.error}>{errors[key]}</Text> : null}
                  </View>
                ) : (
                  <View key={key} style={styles.utmRow}>
                    <Text style={styles.utmKey}>utm_{key.replace("utm", "").toLowerCase()}</Text>
                    <Text style={styles.utmValue} numberOfLines={1}>{shownUtm[key] || "—"}</Text>
                  </View>
                ),
              )}

              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={styles.smallLabel}>Short code (optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputSmall, errors.code ? styles.inputError : null]}
                  value={code}
                  onChangeText={(t) => {
                    setCode(t);
                    if (errors.code) setErrors((e) => ({ ...e, code: "" }));
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  placeholder="auto, e.g. k7m2qx"
                  placeholderTextColor="#94a3b8"
                />
                {errors.code ? <Text style={styles.error}>{errors.code}</Text> : (
                  <Text style={styles.help}>Used in the short link: yourstore.com/l/{code.trim().toLowerCase() || "code"}</Text>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 70 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional, e.g. boosted ৳500 for 3 days"
                placeholderTextColor="#94a3b8"
                multiline
                textAlignVertical="top"
              />
              <View style={[styles.rowBetween, { marginTop: 6 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Active</Text>
                  <Text style={styles.help}>When off, the link opens your home page and is not counted.</Text>
                </View>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.primary, false: "#cbd5e1" }} />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={() => void save()} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name={isEdit ? "checkmark" : "link"} size={18} color="#fff" />
                  <Text style={styles.saveText}>{isEdit ? "Save changes" : "Create link"}</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <TargetPickerSheet
        visible={pickerOpen}
        kind={pickerKind}
        selectedId={target?.id ?? null}
        onClose={() => setPickerOpen(false)}
        onPick={(t) => {
          setTarget(t);
          setPickerOpen(false);
          setErrors((e) => ({ ...e, targetId: "" }));
        }}
      />
    </SafeAreaView>
  );
}

/** Single-select search sheet for a product or a collection. */
function TargetPickerSheet({
  visible,
  kind,
  selectedId,
  onClose,
  onPick,
}: {
  visible: boolean;
  kind: "product" | "collection";
  selectedId: number | null;
  onClose: () => void;
  onPick: (target: PickedTarget) => void;
}) {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<PickedTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const request: Promise<PickedTarget[]> =
      kind === "product"
        ? getProducts({ page: 1, limit: 30, search: debounced || undefined }).then((res) =>
            res.data.map((p) => ({
              id: p.id,
              name: p.name,
              image: p.image ?? p.images?.[0]?.path ?? null,
              meta: [
                formatCurrency(getDisplayPrice(p).price),
                p.sku,
                `${p.stock} in stock`,
                !p.published || p.visibleOnline === false ? "Hidden online" : null,
              ]
                .filter(Boolean)
                .join("  ·  "),
            })),
          )
        : getCollections({ page: 1, limit: 30, search: debounced || undefined }).then((res) =>
            res.data.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              image: c.imageUrl ?? c.image,
              meta: `${c.productCount} product${c.productCount === 1 ? "" : "s"}${c.isPublished ? "" : "  ·  Hidden"}`,
            })),
          );
    request
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, kind, debounced, formatCurrency]);

  const close = () => {
    setSearch("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={sheet.backdrop} onPress={close} />
      <View style={sheet.sheet}>
        <View style={sheet.header}>
          <Text style={sheet.title}>{kind === "product" ? "Choose a product" : "Choose a collection"}</Text>
          <Pressable onPress={close} style={sheet.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>
        <View style={sheet.searchWrap}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            style={sheet.searchInput}
            placeholder={kind === "product" ? "Search by name, SKU or barcode..." : "Search collections..."}
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
        {loading ? (
          <View style={sheet.center}><ActivityIndicator color={colors.primaryDark} /></View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={sheet.list}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <Text style={sheet.empty}>{failed ? "Could not load. Try again." : kind === "product" ? "No products found." : "No collections found."}</Text>
            }
            renderItem={({ item }) => {
              const uri = getImageUrl(item.image ?? null);
              const selected = item.id === selectedId;
              return (
                <Pressable style={[sheet.row, selected && sheet.rowSelected]} onPress={() => onPick(item)}>
                  {uri ? (
                    <Image source={{ uri }} style={sheet.thumb} />
                  ) : (
                    <View style={[sheet.thumb, sheet.thumbEmpty]}>
                      <Ionicons name={kind === "product" ? "cube-outline" : "albums-outline"} size={18} color={colors.muted} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={sheet.name} numberOfLines={1}>{item.name}</Text>
                    {item.meta ? <Text style={sheet.meta} numberOfLines={1}>{item.meta}</Text> : null}
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primaryDark} /> : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 8,
  },
  label: { color: colors.text, fontSize: 14, fontWeight: "800" },
  smallLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  help: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  error: { color: colors.danger, fontSize: 12, fontWeight: "600" },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
    paddingHorizontal: 12, paddingVertical: 11, color: colors.text, fontSize: 15,
  },
  inputSmall: { paddingVertical: 8, fontSize: 14 },
  inputError: { borderColor: colors.danger },
  channelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  channelChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  channelText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  targetCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 10,
  },
  targetCardActive: { borderColor: colors.primary, backgroundColor: "#ecfdf5" },
  targetIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: "#ecfdf5",
    alignItems: "center", justifyContent: "center",
  },
  targetLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  targetHint: { color: colors.muted, fontSize: 12 },
  pickRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 10, backgroundColor: colors.background,
  },
  pickThumb: { width: 42, height: 42, borderRadius: 10, backgroundColor: "#f1f5f9" },
  pickThumbEmpty: { alignItems: "center", justifyContent: "center" },
  pickName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  pickMeta: { color: colors.muted, fontSize: 11 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  linkText: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  utmRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border,
  },
  utmKey: { width: 110, color: colors.muted, fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  utmValue: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700", textAlign: "right" },
  footer: {
    padding: 16, paddingTop: 10, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 14, backgroundColor: colors.primaryDark, paddingVertical: 15,
  },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

const sheet = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.4)" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: "85%",
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "#f1f5f9",
    alignItems: "center", justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 8, height: 44,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, paddingTop: 8 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 10,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: "#ecfdf5" },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#f1f5f9" },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  name: { color: colors.text, fontSize: 14, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12 },
});
