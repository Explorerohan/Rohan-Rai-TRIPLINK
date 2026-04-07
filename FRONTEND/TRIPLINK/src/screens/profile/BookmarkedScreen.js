import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getBookmarkedPackages, removeBookmarkedPackage } from "../../utils/api";
import { useAppAlert } from "../../components/AppAlertProvider";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80";

/** Parses API money (number, Decimal string, or numeric string). */
const parseMoneyValue = (v) => {
  if (v == null || v === "") return NaN;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

const formatRs = (num) =>
  `Rs. ${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const normalizeBookmarkPayload = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
};

const formatDateRange = (start, end) => {
  const fmt = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const startText = fmt(start);
  const endText = fmt(end);
  if (startText && endText) return `${startText} - ${endText}`;
  if (startText) return `From ${startText}`;
  if (endText) return `Until ${endText}`;
  return "Dates not set";
};

/** YYYY-MM-DD for local calendar day (compare date-only fields from API). */
const todayYmd = () => {
  const n = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
};

const toYmd = (value) => {
  if (value == null || value === "") return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Past bookmarks: same rules as package details (for Active vs Past sections). */
const isTripCompletedBookmark = (item) => {
  const st = String(item.status || "").toLowerCase();
  if (st === "completed") return true;
  const end = toYmd(item.trip_end_date);
  const start = toYmd(item.trip_start_date);
  const t = todayYmd();
  if (end) return end < t;
  if (start) return start < t;
  return false;
};

const mapPackages = (rawList) =>
  normalizeBookmarkPayload(rawList)
    .filter(Boolean)
    .map((pkg) => {
    const hasDeal = Boolean(
      pkg.has_active_deal && pkg.deal_price != null && pkg.deal_price !== ""
    );
    const displayPrice = hasDeal ? pkg.deal_price : pkg.price_per_person;
    let num = parseMoneyValue(displayPrice);
    if (!Number.isFinite(num) || num < 0) {
      num = parseMoneyValue(pkg.price_per_person);
    }
    if (!Number.isFinite(num)) num = 0;
    const priceStr = formatRs(num);
    return {
    id: String(pkg.id),
    title: pkg.title || "Package",
    location: `${pkg.location || ""}${pkg.country ? `, ${pkg.country}` : ""}`.replace(/^,\s*/, "") || "Location",
    image: pkg.main_image_url || FALLBACK_IMAGE,
    price: priceStr,
    has_active_deal: hasDeal,
    deal_discount_percent: pkg.deal_discount_percent,
    original_price: pkg.original_price,
    duration: pkg.duration_display || `${pkg.duration_days || 0}D/${pkg.duration_nights || 0}N`,
    trip_start_date: pkg.trip_start_date ?? null,
    trip_end_date: pkg.trip_end_date ?? null,
    status: pkg.status || "active",
    raw: pkg,
  };
  });

const BookmarkedScreen = ({
  session,
  onBack = () => {},
  onTripPress = () => {},
}) => {
  const { t } = useLanguage();
  const { showAlert } = useAppAlert();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyIds, setBusyIds] = useState([]);

  const fetchBookmarks = useCallback(async ({ silent = false } = {}) => {
    if (!session?.access) {
      setBookmarks([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const { data } = await getBookmarkedPackages(session.access);
      setBookmarks(mapPackages(data));
    } catch (err) {
      if (!silent) {
        showAlert({ title: t("loadFailed"), message: err?.message || t("couldNotLoadBookmarked"), type: "error" });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [session?.access, t]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await getBookmarkedPackages(session?.access);
      setBookmarks(mapPackages(data));
    } catch (_) {
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemove = async (item) => {
    const id = String(item?.id || "");
    if (!id || !session?.access || busyIds.includes(id)) return;
    setBusyIds((prev) => [...prev, id]);
    setBookmarks((prev) => prev.filter((row) => String(row.id) !== id));
    try {
      await removeBookmarkedPackage(id, session.access);
    } catch (err) {
      setBookmarks((prev) => [item, ...prev]);
      showAlert({ title: t("bookmarkError"), message: err?.message || t("couldNotUpdateBookmark"), type: "error" });
    } finally {
      setBusyIds((prev) => prev.filter((rowId) => rowId !== id));
    }
  };

  const { activeBookmarks, pastBookmarks } = useMemo(() => {
    const active = [];
    const past = [];
    for (const row of bookmarks) {
      if (isTripCompletedBookmark(row)) past.push(row);
      else active.push(row);
    }
    return { activeBookmarks: active, pastBookmarks: past };
  }, [bookmarks]);

  const headerSubtitle = useMemo(() => {
    const n = bookmarks.length;
    if (n === 0) return "";
    const a = activeBookmarks.length;
    const p = pastBookmarks.length;
    if (p > 0 && a > 0) {
      return t("bookmarksSummaryMixed")
        .replace("{{total}}", String(n))
        .replace("{{active}}", String(a))
        .replace("{{ended}}", String(p));
    }
    return `${n} saved package${n === 1 ? "" : "s"}`;
  }, [bookmarks.length, activeBookmarks.length, pastBookmarks.length, t]);

  const renderBookmarkCard = (item, isPast) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.card, isPast && styles.cardPast]}
      activeOpacity={0.9}
      onPress={() => onTripPress(item.raw || item)}
    >
      <View style={styles.cardImageColumn}>
        <Image
          source={{ uri: item.image }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <TouchableOpacity
            style={[styles.removeBtn, busyIds.includes(item.id) && styles.removeBtnDisabled]}
            activeOpacity={0.8}
            disabled={busyIds.includes(item.id)}
            onPress={(event) => {
              event?.stopPropagation?.();
              handleRemove(item);
            }}
          >
            <Ionicons name="bookmark" size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color="#64748b" />
          <Text style={styles.metaText} numberOfLines={1}>
            {item.location}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color="#64748b" />
          <Text style={styles.metaText}>
            {formatDateRange(item.trip_start_date, item.trip_end_date)}
          </Text>
        </View>

        <View style={styles.footerRow}>
          <Text style={[styles.priceText, isPast && styles.priceTextPast]}>{item.price}</Text>
          <Text style={styles.durationText}>{item.duration}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#1f1f1f" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{t("bookmarkedHeader")}</Text>
          <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.centerText}>{t("loadingBookmarks")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#1f6b2a"]}
              tintColor="#1f6b2a"
            />
          }
        >
          {bookmarks.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="bookmark-outline" size={26} color="#64748b" />
              <Text style={styles.emptyTitle}>{t("noBookmarks")}</Text>
              <Text style={styles.emptyText}>
                {t("bookmarkHint")}
              </Text>
            </View>
          ) : (
            <>
              {activeBookmarks.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t("bookmarksSectionActive")}</Text>
                  {activeBookmarks.map((item) => renderBookmarkCard(item, false))}
                </View>
              ) : null}
              {pastBookmarks.length > 0 ? (
                <View style={[styles.section, activeBookmarks.length > 0 && styles.sectionAfterActive]}>
                  <Text style={styles.sectionTitle}>{t("bookmarksSectionEnded")}</Text>
                  {pastBookmarks.map((item) => renderBookmarkCard(item, true))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
    backgroundColor: "#ffffff",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f6f7f9",
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
  },
  headerSpacer: {
    width: 40,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  centerText: {
    fontSize: 14,
    color: "#64748b",
  },
  scroll: {
    padding: 16,
    paddingBottom: 28,
  },
  section: {
    gap: 12,
  },
  sectionAfterActive: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  emptyCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    backgroundColor: "#f8fafc",
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: "#e3e6ea",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  cardPast: {
    opacity: 0.96,
    borderColor: "#e2e8f0",
    backgroundColor: "#fafafa",
  },
  cardImageColumn: {
    width: 118,
    minHeight: 132,
    alignSelf: "stretch",
    backgroundColor: "#eef2f7",
    overflow: "hidden",
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: "flex-start",
    gap: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f6b2a",
  },
  removeBtnDisabled: {
    opacity: 0.55,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f6b2a",
  },
  priceTextPast: {
    color: "#64748b",
  },
  durationText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
});

export default BookmarkedScreen;
