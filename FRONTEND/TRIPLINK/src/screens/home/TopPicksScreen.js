import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
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
import DateTimePicker from "@react-native-community/datetimepicker";
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

const isPackageUpcoming = (pkg, todayKey) => {
  const startKey = normalizeDateKey(pkg?.trip_start_date);
  if (!startKey || !todayKey) return false;
  return startKey > todayKey;
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
  return "Dates to be announced";
};

const parsePickerDate = (value) => {
  if (!isIsoDateInput(value)) return new Date();
  const parsed = new Date(`${String(value).trim()}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatFilterDateLabel = (value) => {
  if (!isIsoDateInput(value)) return "Tap to pick date";
  const parsed = new Date(`${String(value).trim()}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Tap to pick date";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const DEFAULT_FILTERS = {
  location: "All",
  country: "All",
  agent: "All",
  dateFrom: "",
  dateTo: "",
  minPrice: "",
  maxPrice: "",
  minRating: "Any",
};

const isIsoDateInput = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());

const countActiveFilters = (filters) => {
  let count = 0;
  if (filters.location !== "All") count += 1;
  if (filters.country !== "All") count += 1;
  if (filters.agent !== "All") count += 1;
  if (filters.dateFrom) count += 1;
  if (filters.dateTo) count += 1;
  if (filters.minPrice) count += 1;
  if (filters.maxPrice) count += 1;
  if (filters.minRating !== "Any") count += 1;
  return count;
};

const transformRawPackages = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  return rawList.filter(Boolean).map((pkg) => {
    const hasDeal = Boolean(pkg.has_active_deal && pkg.deal_price != null);
    const displayPrice = hasDeal ? pkg.deal_price : pkg.price_per_person;
    const priceValue = toNumericPrice(displayPrice);
    const priceStr = `Rs. ${priceValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    return {
    id: String(pkg.id),
    title: pkg.title || "Package",
    location: `${pkg.location || ""}, ${pkg.country || ""}`.replace(/^,\s*|,\s*$/g, "").trim() || "Location",
    locationName: (pkg.location || "").trim() || "Other",
    country: (pkg.country || "").trim() || "Other",
    agentName: (pkg.agent_name || "").trim() || "Travel Agent",
    image: pkg.main_image_url || FALLBACK_IMAGE,
    price: priceStr,
    priceValue,
    has_active_deal: hasDeal,
    deal_discount_percent: pkg.deal_discount_percent,
    original_price: pkg.original_price,
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
  };
  });
};

const toRawCacheList = (items) =>
  items.map((item) => ({
    ...(item.packageData || {}),
    is_bookmarked: Boolean(item.is_bookmarked),
  }));

const TopPicksScreen = ({
  session,
  initialPackages = null,
  onUpdateCachedPackages = () => {},
  onTripPress = () => {},
  onBack = () => {},
}) => {
  const { t } = useLanguage();
  const hasInitialPackages = Array.isArray(initialPackages) && initialPackages.length > 0;
  const [packages, setPackages] = useState(() => (hasInitialPackages ? transformRawPackages(initialPackages) : []));
  const [loading, setLoading] = useState(!hasInitialPackages);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyIds, setBusyIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [draftFilters, setDraftFilters] = useState({ ...DEFAULT_FILTERS });
  const [filterVisible, setFilterVisible] = useState(false);
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);

  const syncPackages = useCallback((rawList) => {
    const transformed = transformRawPackages(rawList);
    setPackages(transformed);
    onUpdateCachedPackages(rawList);
  }, [onUpdateCachedPackages]);

  const scheduleCacheUpdateFromItems = useCallback((items) => {
    const rawList = toRawCacheList(items);
    setTimeout(() => {
      onUpdateCachedPackages(rawList);
    }, 0);
  }, [onUpdateCachedPackages]);

  const fetchPackages = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await getPackages({}, session?.access ?? null);
      const rawList = Array.isArray(response?.data) ? response.data : response?.data?.results ?? [];
      syncPackages(rawList);
    } catch (err) {
      setError(err?.message || "Could not load top picks.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [session?.access, syncPackages]);

  useEffect(() => {
    if (hasInitialPackages) return;
    fetchPackages();
  }, [fetchPackages, hasInitialPackages]);

  useEffect(() => {
    if (!Array.isArray(initialPackages)) return;
    setPackages(transformRawPackages(initialPackages));
    setLoading(false);
  }, [initialPackages]);

  const upcomingTopPicks = useMemo(() => {
    const todayKey = toDateOnlyKey(new Date());
    return packages
      .filter((pkg) => isPackageUpcoming(pkg, todayKey))
      .sort((a, b) => String(normalizeDateKey(a.trip_start_date)).localeCompare(String(normalizeDateKey(b.trip_start_date))));
  }, [packages]);

  const locationOptions = useMemo(() => {
    if (!upcomingTopPicks.length) return ["All"];
    const names = upcomingTopPicks.map((pkg) => pkg.locationName).filter(Boolean);
    const unique = [...new Set(names)].sort((a, b) => String(a).localeCompare(String(b)));
    return ["All", ...unique];
  }, [upcomingTopPicks]);

  const countryOptions = useMemo(() => {
    if (!upcomingTopPicks.length) return ["All"];
    const names = upcomingTopPicks.map((pkg) => pkg.country).filter(Boolean);
    const unique = [...new Set(names)].sort((a, b) => String(a).localeCompare(String(b)));
    return ["All", ...unique];
  }, [upcomingTopPicks]);

  const agentOptions = useMemo(() => {
    if (!upcomingTopPicks.length) return ["All"];
    const names = upcomingTopPicks.map((pkg) => pkg.agentName).filter(Boolean);
    const unique = [...new Set(names)].sort((a, b) => String(a).localeCompare(String(b)));
    return ["All", ...unique];
  }, [upcomingTopPicks]);

  const filteredTopPicks = useMemo(() => {
    let list = upcomingTopPicks;

    if (filters.location !== "All") {
      const locationLower = String(filters.location).trim().toLowerCase();
      list = list.filter(
        (item) => String(item.locationName || "").trim().toLowerCase() === locationLower
      );
    }

    if (filters.country !== "All") {
      const countryLower = String(filters.country).trim().toLowerCase();
      list = list.filter(
        (item) => String(item.country || "").trim().toLowerCase() === countryLower
      );
    }

    if (filters.agent !== "All") {
      const agentLower = String(filters.agent).trim().toLowerCase();
      list = list.filter(
        (item) => String(item.agentName || "").trim().toLowerCase() === agentLower
      );
    }

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

    const minPrice = filters.minPrice ? parseFloat(String(filters.minPrice).replace(/[^0-9.]/g, "")) : null;
    const maxPrice = filters.maxPrice ? parseFloat(String(filters.maxPrice).replace(/[^0-9.]/g, "")) : null;
    if (Number.isFinite(minPrice)) {
      list = list.filter((item) => item.priceValue >= minPrice);
    }
    if (Number.isFinite(maxPrice)) {
      list = list.filter((item) => item.priceValue <= maxPrice);
    }

    if (filters.minRating !== "Any") {
      const minRating = parseFloat(filters.minRating);
      if (Number.isFinite(minRating)) {
        list = list.filter((item) => Number(item.rating || 0) >= minRating);
      }
    }

    const dateFrom = isIsoDateInput(filters.dateFrom) ? filters.dateFrom.trim() : "";
    const dateTo = isIsoDateInput(filters.dateTo) ? filters.dateTo.trim() : "";
    if (dateFrom || dateTo) {
      list = list.filter((item) => {
        const startKey = normalizeDateKey(item.trip_start_date);
        const endKey = normalizeDateKey(item.trip_end_date) || startKey;
        if (!startKey) return false;
        if (dateFrom && endKey < dateFrom) return false;
        if (dateTo && startKey > dateTo) return false;
        return true;
      });
    }

    return list;
  }, [filters, searchQuery, upcomingTopPicks]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const hasAnyFiltersApplied = activeFilterCount > 0 || searchQuery.trim().length > 0;

  const openFilterSheet = useCallback(() => {
    setDraftFilters({ ...filters });
    setFilterVisible(true);
  }, [filters]);

  const applyFilters = useCallback(() => {
    let nextDateFrom = draftFilters.dateFrom.trim();
    let nextDateTo = draftFilters.dateTo.trim();
    if (isIsoDateInput(nextDateFrom) && isIsoDateInput(nextDateTo) && nextDateFrom > nextDateTo) {
      const temp = nextDateFrom;
      nextDateFrom = nextDateTo;
      nextDateTo = temp;
    }

    let nextMinPrice = draftFilters.minPrice.trim();
    let nextMaxPrice = draftFilters.maxPrice.trim();
    const minPriceValue = nextMinPrice ? parseFloat(nextMinPrice) : null;
    const maxPriceValue = nextMaxPrice ? parseFloat(nextMaxPrice) : null;
    if (Number.isFinite(minPriceValue) && Number.isFinite(maxPriceValue) && minPriceValue > maxPriceValue) {
      nextMinPrice = String(maxPriceValue);
      nextMaxPrice = String(minPriceValue);
    }

    setFilters({
      ...draftFilters,
      dateFrom: nextDateFrom,
      dateTo: nextDateTo,
      minPrice: nextMinPrice,
      maxPrice: nextMaxPrice,
    });
    setFilterVisible(false);
  }, [draftFilters]);

  const clearAllFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setDraftFilters({ ...DEFAULT_FILTERS });
    setSearchQuery("");
  }, []);

  const onDateFromChange = useCallback((event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowDateFromPicker(false);
    }
    if (event?.type === "dismissed" || !selectedDate) return;

    const nextDate = toDateOnlyKey(selectedDate);
    setDraftFilters((prev) => {
      const next = { ...prev, dateFrom: nextDate };
      if (isIsoDateInput(prev.dateTo) && prev.dateTo < nextDate) {
        next.dateTo = nextDate;
      }
      return next;
    });
  }, []);

  const onDateToChange = useCallback((event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowDateToPicker(false);
    }
    if (event?.type === "dismissed" || !selectedDate) return;

    const nextDate = toDateOnlyKey(selectedDate);
    setDraftFilters((prev) => {
      const next = { ...prev, dateTo: nextDate };
      if (isIsoDateInput(prev.dateFrom) && prev.dateFrom > nextDate) {
        next.dateFrom = nextDate;
      }
      return next;
    });
  }, []);

  const handleTripSelect = useCallback((trip) => {
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
  }, [onTripPress]);

  const handleToggleBookmark = useCallback(async (trip) => {
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
      scheduleCacheUpdateFromItems(next);
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
        scheduleCacheUpdateFromItems(next);
        return next;
      });
      Alert.alert(t("bookmarkError"), err?.message || t("couldNotUpdateBookmark"));
    } finally {
      setBusyIds((prev) => prev.filter((busyId) => busyId !== id));
    }
  }, [busyIds, onUpdateCachedPackages, session?.access]);

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
          <Text style={styles.headerTitle}>{t("topPicksHeader")}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.centerText}>{t("loadingTopPicks")}</Text>
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
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!filterVisible}
          fadingEdgeLength={Platform.OS === "android" ? 40 : 0}
        >
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={19} color="#7a7f85" style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search packages or locations"
                placeholderTextColor="#9aa0a6"
                style={styles.searchInput}
              />
            </View>

            <TouchableOpacity
              style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
              activeOpacity={0.85}
              onPress={openFilterSheet}
            >
              <Ionicons
                name="options-outline"
                size={20}
                color={activeFilterCount > 0 ? "#ffffff" : "#1f6b2a"}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.resultsRow}>
            <Text style={styles.resultsText}>
              {filteredTopPicks.length} package{filteredTopPicks.length === 1 ? "" : "s"}
            </Text>
            {hasAnyFiltersApplied ? (
              <TouchableOpacity style={styles.clearFiltersButton} activeOpacity={0.85} onPress={clearAllFilters}>
                <Ionicons name="close-circle-outline" size={14} color="#1f6b2a" />
                <Text style={styles.clearFiltersText}>Clear</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.activeFilterPill}>
                <Ionicons name="sparkles-outline" size={13} color="#1f6b2a" />
                <Text style={styles.activeFilterText}>All top picks</Text>
              </View>
            )}
          </View>

          {hasAnyFiltersApplied ? (
            <View style={styles.appliedFiltersWrap}>
              {searchQuery.trim() ? (
                <View style={styles.appliedFilterChip}>
                  <Ionicons name="search-outline" size={12} color="#1f6b2a" />
                  <Text style={styles.appliedFilterText}>{searchQuery.trim()}</Text>
                </View>
              ) : null}
              {filters.location !== "All" ? (
                <View style={styles.appliedFilterChip}>
                  <Ionicons name="pin-outline" size={12} color="#1f6b2a" />
                  <Text style={styles.appliedFilterText}>{filters.location}</Text>
                </View>
              ) : null}
              {filters.country !== "All" ? (
                <View style={styles.appliedFilterChip}>
                  <Ionicons name="earth-outline" size={12} color="#1f6b2a" />
                  <Text style={styles.appliedFilterText}>{filters.country}</Text>
                </View>
              ) : null}
              {filters.agent !== "All" ? (
                <View style={styles.appliedFilterChip}>
                  <Ionicons name="person-outline" size={12} color="#1f6b2a" />
                  <Text style={styles.appliedFilterText}>{filters.agent}</Text>
                </View>
              ) : null}
              {filters.minRating !== "Any" ? (
                <View style={styles.appliedFilterChip}>
                  <Ionicons name="star-outline" size={12} color="#1f6b2a" />
                  <Text style={styles.appliedFilterText}>{filters.minRating}+ rating</Text>
                </View>
              ) : null}
              {filters.minPrice || filters.maxPrice ? (
                <View style={styles.appliedFilterChip}>
                  <Ionicons name="cash-outline" size={12} color="#1f6b2a" />
                  <Text style={styles.appliedFilterText}>
                    {filters.minPrice || "0"} - {filters.maxPrice || "Any"}
                  </Text>
                </View>
              ) : null}
              {filters.dateFrom || filters.dateTo ? (
                <View style={styles.appliedFilterChip}>
                  <Ionicons name="calendar-outline" size={12} color="#1f6b2a" />
                  <Text style={styles.appliedFilterText}>
                    {filters.dateFrom || "Start"} to {filters.dateTo || "End"}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <Modal
            visible={filterVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setFilterVisible(false)}
          >
            <Pressable
              style={styles.filterOverlay}
              onPress={() => setFilterVisible(false)}
            >
              <Pressable style={styles.filterModal} onPress={() => {}}>
                <View style={styles.filterHeader}>
                  <View>
                    <Text style={styles.filterTitle}>Filter top picks</Text>
                    <Text style={styles.filterSubtitle}>
                      Showing {filteredTopPicks.length} · {activeFilterCount} active filter
                      {activeFilterCount === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setFilterVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name="close" size={22} color="#64748b" />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.filterList}
                  contentContainerStyle={styles.filterListContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  scrollEventThrottle={16}
                  decelerationRate={Platform.OS === "ios" ? "fast" : 0.998}
                  bounces
                  overScrollMode="always"
                  fadingEdgeLength={Platform.OS === "android" ? 40 : 0}
                >
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Basics</Text>
                    <View style={styles.filterRow}>
                      <Text style={styles.filterRowLabel}>Location</Text>
                      <View style={styles.optionWrap}>
                        {locationOptions.map((option) => {
                          const active = draftFilters.location === option;
                          return (
                            <TouchableOpacity
                              key={`location-${option}`}
                              style={[styles.optionChip, active && styles.optionChipActive]}
                              activeOpacity={0.8}
                              onPress={() => setDraftFilters((prev) => ({ ...prev, location: option }))}
                            >
                              <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                    <View style={styles.filterRow}>
                      <Text style={styles.filterRowLabel}>Country</Text>
                      <View style={styles.optionWrap}>
                        {countryOptions.map((option) => {
                          const active = draftFilters.country === option;
                          return (
                            <TouchableOpacity
                              key={`country-${option}`}
                              style={[styles.optionChip, active && styles.optionChipActive]}
                              activeOpacity={0.8}
                              onPress={() => setDraftFilters((prev) => ({ ...prev, country: option }))}
                            >
                              <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                    <View style={styles.filterRow}>
                      <Text style={styles.filterRowLabel}>Agent</Text>
                      <View style={styles.optionWrap}>
                        {agentOptions.map((option) => {
                          const active = draftFilters.agent === option;
                          return (
                            <TouchableOpacity
                              key={`agent-${option}`}
                              style={[styles.optionChip, active && styles.optionChipActive]}
                              activeOpacity={0.8}
                              onPress={() => setDraftFilters((prev) => ({ ...prev, agent: option }))}
                            >
                              <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Trip dates</Text>
                    <View style={styles.inlineInputs}>
                      <View style={styles.inlineInputWrap}>
                        <Text style={styles.inlineLabel}>From</Text>
                        <TouchableOpacity
                          style={styles.filterDateButton}
                          activeOpacity={0.85}
                          onPress={() => setShowDateFromPicker(true)}
                        >
                          <Text style={draftFilters.dateFrom ? styles.filterDateText : styles.filterDatePlaceholder}>
                            {formatFilterDateLabel(draftFilters.dateFrom)}
                          </Text>
                          <Ionicons name="calendar-outline" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.inlineInputWrap}>
                        <Text style={styles.inlineLabel}>To</Text>
                        <TouchableOpacity
                          style={styles.filterDateButton}
                          activeOpacity={0.85}
                          onPress={() => setShowDateToPicker(true)}
                        >
                          <Text style={draftFilters.dateTo ? styles.filterDateText : styles.filterDatePlaceholder}>
                            {formatFilterDateLabel(draftFilters.dateTo)}
                          </Text>
                          <Ionicons name="calendar-outline" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.filterHint}>Only trips overlapping this date range will be shown.</Text>
                    {showDateFromPicker ? (
                      <DateTimePicker
                        value={parsePickerDate(draftFilters.dateFrom)}
                        mode="date"
                        display={Platform.OS === "android" ? "calendar" : "default"}
                        onChange={onDateFromChange}
                      />
                    ) : null}
                    {showDateFromPicker && Platform.OS === "ios" ? (
                      <TouchableOpacity
                        style={styles.datePickerDoneButton}
                        activeOpacity={0.85}
                        onPress={() => setShowDateFromPicker(false)}
                      >
                        <Text style={styles.datePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    ) : null}
                    {showDateToPicker ? (
                      <DateTimePicker
                        value={parsePickerDate(draftFilters.dateTo)}
                        mode="date"
                        display={Platform.OS === "android" ? "calendar" : "default"}
                        onChange={onDateToChange}
                        minimumDate={isIsoDateInput(draftFilters.dateFrom) ? parsePickerDate(draftFilters.dateFrom) : undefined}
                      />
                    ) : null}
                    {showDateToPicker && Platform.OS === "ios" ? (
                      <TouchableOpacity
                        style={styles.datePickerDoneButton}
                        activeOpacity={0.85}
                        onPress={() => setShowDateToPicker(false)}
                      >
                        <Text style={styles.datePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Price & rating</Text>
                    <View style={styles.inlineInputs}>
                      <View style={styles.inlineInputWrap}>
                        <Text style={styles.inlineLabel}>Min price</Text>
                        <TextInput
                          value={draftFilters.minPrice}
                          onChangeText={(value) => setDraftFilters((prev) => ({ ...prev, minPrice: value.replace(/[^0-9.]/g, "") }))}
                          placeholder="0"
                          placeholderTextColor="#9aa0a6"
                          keyboardType="numeric"
                          style={styles.filterInput}
                        />
                      </View>
                      <View style={styles.inlineInputWrap}>
                        <Text style={styles.inlineLabel}>Max price</Text>
                        <TextInput
                          value={draftFilters.maxPrice}
                          onChangeText={(value) => setDraftFilters((prev) => ({ ...prev, maxPrice: value.replace(/[^0-9.]/g, "") }))}
                          placeholder="Any"
                          placeholderTextColor="#9aa0a6"
                          keyboardType="numeric"
                          style={styles.filterInput}
                        />
                      </View>
                    </View>
                    <View style={styles.filterRow}>
                      <Text style={styles.inlineLabel}>Minimum agent rating</Text>
                      <View style={styles.optionWrap}>
                        {["Any", "4.0", "4.5"].map((option) => {
                          const active = draftFilters.minRating === option;
                          return (
                            <TouchableOpacity
                              key={`rating-${option}`}
                              style={[styles.optionChip, active && styles.optionChipActive]}
                              activeOpacity={0.8}
                              onPress={() => setDraftFilters((prev) => ({ ...prev, minRating: option }))}
                            >
                              <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                                {option === "Any" ? option : `${option}+`}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.filterFooter}>
                  <TouchableOpacity
                    style={styles.filterFooterSecondary}
                    activeOpacity={0.85}
                    onPress={() => setDraftFilters({ ...DEFAULT_FILTERS })}
                  >
                    <Text style={styles.filterFooterSecondaryText}>Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.filterFooterPrimary}
                    activeOpacity={0.85}
                    onPress={applyFilters}
                  >
                    <Text style={styles.filterFooterPrimaryText}>Apply filters</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {error ? (
            <View style={styles.feedbackCardError}>
              <Text style={styles.feedbackTitleError}>Couldn't load top picks</Text>
              <Text style={styles.feedbackTextError}>{error}</Text>
            </View>
          ) : null}

          {!error && filteredTopPicks.length === 0 ? (
            <View style={styles.feedbackCard}>
              <Ionicons name="airplane-outline" size={26} color="#64748b" />
              <Text style={styles.feedbackTitle}>
                {upcomingTopPicks.length === 0 ? "No upcoming top picks right now" : "No packages match your filters"}
              </Text>
              <Text style={styles.feedbackText}>
                {upcomingTopPicks.length === 0
                  ? "New curated packages will appear here once their trip dates are ahead of today."
                  : "Try another destination or clear your search to see more packages."}
              </Text>
            </View>
          ) : null}

          {filteredTopPicks.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.92}
              onPress={() => handleTripSelect(item)}
            >
              <Image source={{ uri: item.image }} style={styles.cardImage} />
              <View style={styles.imageOverlay}>
                <View style={styles.dateChip}>
                  <Ionicons name="calendar-outline" size={13} color="#ffffff" />
                  <Text style={styles.dateChipText}>{formatDateRange(item.trip_start_date, item.trip_end_date)}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={14} color="#6b7076" />
                      <Text style={styles.locationText} numberOfLines={1}>{item.location}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.bookmarkButton, item.is_bookmarked && styles.bookmarkButtonActive]}
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
                  {item.description || "A thoughtfully planned trip with stays, experiences, and a smooth itinerary."}
                </Text>

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.priceLabel}>Price per person</Text>
                    <View style={styles.priceRow}>
                      {item.has_active_deal && item.original_price != null ? (
                        <Text style={styles.priceOriginal}>{formatPrice(item.original_price)}</Text>
                      ) : null}
                      <Text style={styles.priceText}>{item.price}</Text>
                      {item.has_active_deal && item.deal_discount_percent != null ? (
                        <View style={styles.dealBadge}><Text style={styles.dealBadgeText}>{item.deal_discount_percent}% OFF</Text></View>
                      ) : null}
                    </View>
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
    gap: 10,
    marginBottom: 14,
  },
  searchBox: {
    flex: 1,
    height: 50,
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
  filterButton: {
    width: 48,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dce4dc",
    backgroundColor: "#f3f8f3",
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: {
    backgroundColor: "#1f6b2a",
    borderColor: "#1f6b2a",
  },
  resultsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 10,
  },
  resultsText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  clearFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#edf7ed",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  activeFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#edf7ed",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  appliedFiltersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  appliedFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f3f8f3",
    borderWidth: 1,
    borderColor: "#dce4dc",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  appliedFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f6b2a",
  },
  filterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  filterModal: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 24,
    maxHeight: "70%",
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  filterTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
  },
  filterSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  filterList: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  filterListContent: {
    paddingBottom: 24,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  filterRow: {
    marginTop: 10,
  },
  filterRowLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d5d9dd",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  optionChipActive: {
    backgroundColor: "#1f6b2a",
    borderColor: "#1f6b2a",
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  optionChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  inlineInputs: {
    flexDirection: "row",
    gap: 10,
  },
  inlineInputWrap: {
    flex: 1,
  },
  inlineLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 6,
  },
  filterInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d5d9dd",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#1f1f1f",
  },
  filterDateButton: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d5d9dd",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterDateText: {
    fontSize: 14,
    color: "#1f1f1f",
    fontWeight: "600",
  },
  filterDatePlaceholder: {
    fontSize: 14,
    color: "#9aa0a6",
  },
  filterHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b",
  },
  datePickerDoneButton: {
    alignSelf: "flex-end",
    marginTop: 8,
    backgroundColor: "#edf7ed",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  datePickerDoneText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  filterFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  filterFooterSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d5d9dd",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  filterFooterSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  filterFooterPrimary: {
    flex: 1.4,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#1f6b2a",
    alignItems: "center",
    justifyContent: "center",
  },
  filterFooterPrimaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
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
    justifyContent: "flex-start",
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
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  priceOriginal: {
    fontSize: 14,
    color: "#94a3b8",
    textDecorationLine: "line-through",
  },
  dealBadge: {
    backgroundColor: "#dc2626",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  dealBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
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

export default TopPicksScreen;
