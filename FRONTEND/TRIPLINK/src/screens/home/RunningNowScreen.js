import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addBookmarkedPackage, getPackages, removeBookmarkedPackage } from "../../utils/api";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80";

const defaultFacilities = [
  { key: "heater", label: "Heater", icon: "thermometer-outline" },
  { key: "dinner", label: "Dinner", icon: "restaurant-outline" },
  { key: "tub", label: "1 Tub", icon: "water-outline" },
  { key: "pool", label: "Pool", icon: "water-outline" },
];

const cleanPrice = (price) => {
  if (typeof price === "number") return price;
  if (typeof price === "string") {
    const parsed = Number(price.replace(/[^0-9.]/g, ""));
    return Number.isNaN(parsed) ? price : parsed;
  }
  return price;
};

const formatPrice = (price) => {
  const numericValue = typeof cleanPrice(price) === "number" ? cleanPrice(price) : 0;
  return `Rs. ${numericValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};

const toNumericPrice = (price) => {
  const cleaned = cleanPrice(price);
  return typeof cleaned === "number" && Number.isFinite(cleaned) ? cleaned : 0;
};

const toDateOnlyKey = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeDateKey = (value) => {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return toDateOnlyKey(str);
};

const isPackageRunningToday = (pkg, todayKey) => {
  const startKey = normalizeDateKey(pkg?.trip_start_date);
  const endKey = normalizeDateKey(pkg?.trip_end_date);
  if (!startKey || !endKey || !todayKey) return false;
  return startKey <= todayKey && todayKey <= endKey;
};

const formatDateRange = (start, end) => {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const validStart = startDate && !Number.isNaN(startDate.getTime());
  const validEnd = endDate && !Number.isNaN(endDate.getTime());
  const fmt = (date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (validStart && validEnd) return `${fmt(startDate)} - ${fmt(endDate)}`;
  if (validStart) return `From ${fmt(startDate)}`;
  if (validEnd) return `Until ${fmt(endDate)}`;
  return "Running now";
};

const transformRawPackages = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  return rawList.filter(Boolean).map((pkg) => ({
    id: String(pkg.id),
    title: pkg.title || "Package",
    location: `${pkg.location || ""}, ${pkg.country || ""}`.replace(/^,\s*|,\s*$/g, "").trim() || "Location",
    locationName: (pkg.location || "").trim() || "Other",
    country: (pkg.country || "").trim() || "Other",
    agentName: (pkg.agent_name || "").trim() || "Travel Agent",
    image: pkg.main_image_url || FALLBACK_IMAGE,
    price: pkg.price_per_person,
    priceValue: toNumericPrice(pkg.price_per_person),
    nights: pkg.duration_display || `${pkg.duration_days || 0}D/${pkg.duration_nights || 0}N`,
    rating: parseFloat(pkg.agent_rating ?? pkg.rating) || 4.5,
    reviews: pkg.participants_count || 0,
    description: pkg.description,
    hero: pkg.main_image_url || FALLBACK_IMAGE,
    facilities: pkg.features?.map((feature, index) => ({
      key: `feature_${index}`,
      label: feature.name,
      icon: feature.icon || "checkmark-circle-outline",
    })) || defaultFacilities,
    user_has_booked: pkg.user_has_booked ?? false,
    is_bookmarked: Boolean(pkg.is_bookmarked),
    trip_start_date: pkg.trip_start_date ?? null,
    trip_end_date: pkg.trip_end_date ?? null,
    packageData: pkg,
  }));
};

const toRawCacheList = (items) =>
  items.map((item) => ({
    ...(item.packageData || {}),
    is_bookmarked: Boolean(item.is_bookmarked),
  }));

const RunningNowScreen = ({
  session,
  initialPackages = null,
  onUpdateCachedPackages = () => {},
  onTripPress = () => {},
  onBack = () => {},
}) => {
  const { t } = useLanguage();
  const hasInitialPackages = Array.isArray(initialPackages) && initialPackages.length > 0;
  const [packages, setPackages] = useState(() =>
    hasInitialPackages ? transformRawPackages(initialPackages) : []
  );
  const [loading, setLoading] = useState(!hasInitialPackages);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyIds, setBusyIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const syncPackages = useCallback(
    (rawList) => {
      const transformed = transformRawPackages(rawList);
      setPackages(transformed);
      onUpdateCachedPackages(rawList);
    },
    [onUpdateCachedPackages]
  );

  const fetchPackages = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const response = await getPackages({}, session?.access ?? null);
        const rawList = Array.isArray(response?.data) ? response.data : response?.data?.results ?? [];
        syncPackages(rawList);
      } catch (err) {
        setError(err?.message || "Could not load running trips.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [session?.access, syncPackages]
  );

  useEffect(() => {
    if (hasInitialPackages) return;
    fetchPackages();
  }, [fetchPackages, hasInitialPackages]);

  useEffect(() => {
    if (!Array.isArray(initialPackages)) return;
    setPackages(transformRawPackages(initialPackages));
    setLoading(false);
  }, [initialPackages]);

  const runningNowTrips = useMemo(() => {
    const todayKey = toDateOnlyKey(new Date());
    let list = packages.filter((pkg) => isPackageRunningToday(pkg, todayKey));

    const query = String(searchQuery || "").trim().toLowerCase();
    if (query) {
      list = list.filter((item) => {
        const title = String(item.title || "").toLowerCase();
        const location = String(item.location || "").toLowerCase();
        const country = String(item.country || "").toLowerCase();
        const agent = String(item.agentName || "").toLowerCase();
        const description = String(item.description || "").toLowerCase();
        return (
          title.includes(query) ||
          location.includes(query) ||
          country.includes(query) ||
          agent.includes(query) ||
          description.includes(query)
        );
      });
    }

    return list.sort((a, b) => {
      const aEnd = normalizeDateKey(a.trip_end_date);
      const bEnd = normalizeDateKey(b.trip_end_date);
      return String(aEnd).localeCompare(String(bEnd));
    });
  }, [packages, searchQuery]);

  const handleTripSelect = useCallback(
    (trip) => {
      if (!trip || typeof trip !== "object") return;
      onTripPress({
        ...trip,
        facilities: trip.facilities || defaultFacilities,
        price: cleanPrice(trip.price),
        rating: trip.rating ?? 4.5,
        reviews: trip.reviews ?? 0,
        description:
          trip.description ||
          "Discover tailored experiences with comfortable stays, great dining, and curated activities throughout your trip.",
      });
    },
    [onTripPress]
  );

  const handleToggleBookmark = useCallback(
    async (trip) => {
      const id = String(trip?.id || "");
      if (!id || !session?.access) {
        Alert.alert(t("loginRequired"), t("pleaseLoginBookmarks"));
        return;
      }
      if (busyIds.includes(id)) return;

      const currentlyBookmarked = Boolean(trip?.is_bookmarked);
      const nextBookmarked = !currentlyBookmarked;

      setBusyIds((prev) => [...prev, id]);
      setPackages((prev) => {
        const next = prev.map((item) =>
          String(item.id) === id ? { ...item, is_bookmarked: nextBookmarked } : item
        );
        onUpdateCachedPackages(toRawCacheList(next));
        return next;
      });

      try {
        if (nextBookmarked) {
          await addBookmarkedPackage(id, session.access);
        } else {
          await removeBookmarkedPackage(id, session.access);
        }
      } catch (err) {
        setPackages((prev) => {
          const next = prev.map((item) =>
            String(item.id) === id ? { ...item, is_bookmarked: currentlyBookmarked } : item
          );
          onUpdateCachedPackages(toRawCacheList(next));
          return next;
        });
        Alert.alert(t("bookmarkError"), err?.message || t("couldNotUpdateBookmark"));
      } finally {
        setBusyIds((prev) => prev.filter((busyId) => busyId !== id));
      }
    },
    [busyIds, onUpdateCachedPackages, session?.access]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPackages({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [fetchPackages]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={onBack} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={22} color="#1f1f1f" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{t("runningNowHeader")}</Text>
          <Text style={styles.headerSubtitle}>{t("tripsLiveToday")}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.centerText}>{t("loadingRunningTrips")}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#1f6b2a"]}
              tintColor="#1f6b2a"
            />
          }
          scrollEventThrottle={16}
          decelerationRate={Platform.OS === "ios" ? "fast" : 0.998}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={19} color="#7a7f85" style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search running trips"
                placeholderTextColor="#9aa0a6"
                style={styles.searchInput}
              />
            </View>
          </View>

          <View style={styles.resultsRow}>
            <Text style={styles.resultsText}>
              {runningNowTrips.length} trip{runningNowTrips.length === 1 ? "" : "s"} running today
            </Text>
          </View>

          {error ? (
            <View style={styles.feedbackCardError}>
              <Text style={styles.feedbackTitleError}>Couldn't load running trips</Text>
              <Text style={styles.feedbackTextError}>{error}</Text>
            </View>
          ) : null}

          {!error && runningNowTrips.length === 0 ? (
            <View style={styles.feedbackCard}>
              <Ionicons name="time-outline" size={26} color="#64748b" />
              <Text style={styles.feedbackTitle}>No trips are live today</Text>
              <Text style={styles.feedbackText}>
                When your booked or curated packages are active, they will appear here while they are
                running.
              </Text>
            </View>
          ) : null}

          {runningNowTrips.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.92}
              onPress={() => handleTripSelect(item)}
            >
              <Image source={{ uri: item.image }} style={styles.cardImage} />
              <View style={styles.imageOverlay}>
                <View style={styles.liveChip}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveChipText}>LIVE</Text>
                </View>
                <View style={styles.dateChip}>
                  <Ionicons name="calendar-outline" size={13} color="#ffffff" />
                  <Text style={styles.dateChipText}>
                    {formatDateRange(item.trip_start_date, item.trip_end_date)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={14} color="#6b7076" />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {item.location}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.bookmarkButton,
                      item.is_bookmarked && styles.bookmarkButtonActive,
                    ]}
                    activeOpacity={0.85}
                    disabled={busyIds.includes(item.id)}
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      handleToggleBookmark(item);
                    }}
                  >
                    <Ionicons
                      name={item.is_bookmarked ? "bookmark" : "bookmark-outline"}
                      size={18}
                      color={item.is_bookmarked ? "#ffffff" : "#1f6b2a"}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.cardDescription} numberOfLines={3}>
                  {item.description ||
                    "A thoughtfully planned trip with stays, experiences, and a smooth itinerary."}
                </Text>

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.priceLabel}>Price per person</Text>
                    <Text style={styles.priceText}>{formatPrice(item.price)}</Text>
                  </View>
                  <View style={styles.durationPill}>
                    <Ionicons name="moon-outline" size={14} color="#1f6b2a" />
                    <Text style={styles.durationText}>{item.nights}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
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
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
    backgroundColor: "#ffffff",
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f6f7f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
  },
  headerSpacer: {
    width: 42,
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
    padding: 18,
    paddingBottom: 30,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  searchBox: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d5d9dd",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    color: "#1f1f1f",
  },
  resultsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  resultsText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  feedbackCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 20,
    alignItems: "center",
    marginTop: 6,
  },
  feedbackCardError: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    padding: 18,
    marginBottom: 12,
  },
  feedbackTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  feedbackTitleError: {
    fontSize: 16,
    fontWeight: "800",
    color: "#991b1b",
  },
  feedbackText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#64748b",
    textAlign: "center",
  },
  feedbackTextError: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#b91c1c",
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e3e6ea",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    marginBottom: 16,
  },
  cardImage: {
    width: "100%",
    height: 220,
    backgroundColor: "#eef2f7",
  },
  imageOverlay: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(185, 28, 28, 0.92)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(254, 202, 202, 0.55)",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  liveChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(17, 24, 39, 0.55)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  cardBody: {
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  locationRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: "#6b7076",
  },
  bookmarkButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e3e6ea",
    backgroundColor: "#f3f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  bookmarkButtonActive: {
    backgroundColor: "#1f6b2a",
    borderColor: "#1f6b2a",
  },
  cardDescription: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    color: "#5f6369",
  },
  cardFooter: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#eef2f7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  priceLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  priceText: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "800",
    color: "#1f6b2a",
  },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#edf7ed",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  durationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f6b2a",
  },
});

export default RunningNowScreen;

