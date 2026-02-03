import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Modal,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getPackages } from "../../utils/api";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80";
const DEFAULT_AVATAR_URL =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

const defaultFacilities = [
  { key: "heater", label: "Heater", icon: "thermometer-outline" },
  { key: "dinner", label: "Dinner", icon: "restaurant-outline" },
  { key: "tub", label: "1 Tub", icon: "water-outline" },
  { key: "pool", label: "Pool", icon: "water-outline" },
];

const formatDateRange = (start, end) => {
  if (!start && !end) return "—";
  const fmt = (d) => {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const s = fmt(start);
  const e = fmt(end);
  if (s && e && s !== e) return `${s}–${e}`;
  return s || e || "—";
};

const transformRawPackages = (rawList) => {
  if (!rawList?.length) return [];
  return rawList.filter(Boolean).map((pkg) => ({
    id: pkg.id.toString(),
    title: pkg.title,
    location: `${pkg.location || ""}, ${pkg.country || ""}`.replace(/^,\s*|,\s*$/g, "").trim() || "—",
    locationName: (pkg.location || "").trim() || "Other",
    image: pkg.main_image_url || PLACEHOLDER_IMAGE,
    price: pkg.price_per_person,
    nights: pkg.duration_display || `${pkg.duration_days}D/${pkg.duration_nights}N`,
    description: pkg.description,
    hero: pkg.main_image_url,
    trip_start_date: pkg.trip_start_date ?? null,
    trip_end_date: pkg.trip_end_date ?? null,
    rating: parseFloat(pkg.agent_rating ?? pkg.rating) || 4.5,
    participants_count: pkg.participants_count ?? 0,
    participants_preview: Array.isArray(pkg.participants_preview) ? pkg.participants_preview.slice(0, 5) : [],
    facilities: pkg.features?.map((f, idx) => ({
      key: `feature_${idx}`,
      label: f.name,
      icon: f.icon || "checkmark-circle-outline",
    })) || defaultFacilities,
    user_has_booked: pkg.user_has_booked ?? false,
    packageData: pkg,
  }));
};

const SearchScreen = ({ session, initialPackages = null, onBack, onTripPress }) => {
  const hasInitial = initialPackages && initialPackages.length > 0;
  const [packages, setPackages] = useState(() => (hasInitial ? transformRawPackages(initialPackages) : []));
  const [loading, setLoading] = useState(!hasInitial);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [filterVisible, setFilterVisible] = useState(false);

  useEffect(() => {
    if (initialPackages && initialPackages.length > 0 && packages.length === 0) {
      setPackages(transformRawPackages(initialPackages));
      setLoading(false);
    }
  }, [initialPackages]);

  useEffect(() => {
    const fetchPackages = async () => {
      const alreadyHaveData = packages.length > 0;
      if (!alreadyHaveData) setLoading(true);
      try {
        const response = await getPackages({}, session?.access ?? null);
        const rawList = Array.isArray(response?.data) ? response.data : response?.data?.results ?? [];
        if (rawList.length > 0) {
          setPackages(transformRawPackages(rawList));
        }
      } catch (err) {
        console.error("SearchScreen fetch packages:", err);
        if (!alreadyHaveData) setPackages([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPackages();
  }, [session?.access]);

  const categories = useMemo(() => {
    if (!Array.isArray(packages) || packages.length === 0) return ["All"];
    const names = packages.map((p) => p?.locationName).filter(Boolean);
    const unique = [...new Set(names)].sort((a, b) => String(a).localeCompare(String(b)));
    return ["All", ...unique];
  }, [packages]);

  const filteredList = useMemo(() => {
    if (!Array.isArray(packages)) return [];
    let list = packages;
    if (activeCategory !== "All") {
      const categoryLower = String(activeCategory).trim().toLowerCase();
      list = list.filter(
        (place) => String(place?.locationName ?? "").trim().toLowerCase() === categoryLower
      );
    }
    const query = String(searchQuery || "").trim().toLowerCase();
    if (!query) return list;
    return list.filter((place) => {
      const title = String(place?.title ?? "").toLowerCase();
      const location = String(place?.location ?? "").toLowerCase();
      const locationName = String(place?.locationName ?? "").toLowerCase();
      return title.includes(query) || location.includes(query) || locationName.includes(query);
    });
  }, [activeCategory, packages, searchQuery]);

  const formatPrice = (price) => {
    if (typeof price === "number") return `Rs. ${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (typeof price === "string") {
      const n = Number(price.replace(/[^0-9.]/g, ""));
      return Number.isNaN(n) ? price : `Rs. ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return "Rs. —";
  };

  const handleSelect = (trip) => {
    if (!trip || typeof trip !== "object") return;
    let priceValue = trip.price;
    if (typeof priceValue === "string") {
      const cleaned = priceValue.replace(/[^0-9.]/g, "");
      priceValue = parseFloat(cleaned) || 0;
    }
    onTripPress?.({
      ...trip,
      facilities: trip.facilities || defaultFacilities,
      price: priceValue,
      rating: trip.rating ?? 4.5,
      reviews: trip.reviews ?? 320,
      description: trip.description || "Discover tailored experiences with comfortable stays, great dining, and curated activities throughout your trip.",
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
        <TouchableOpacity onPress={onBack} style={styles.cancelBtn} activeOpacity={0.8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#7a7f85" style={styles.searchIcon} />
          <TextInput
            placeholder="Search Places"
            placeholderTextColor="#9aa0a6"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={() => setFilterVisible(true)}
            style={styles.filterIconWrap}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="options-outline" size={22} color="#1f6b2a" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Section title */}
      <Text style={styles.sectionTitle}>All Popular Trip Package</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : filteredList.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            {searchQuery.trim() ? "No packages match your search" : "No packages available"}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredList.map((place) => (
            <TouchableOpacity
              key={place.id}
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => handleSelect(place)}
            >
              <Image source={{ uri: place.image }} style={styles.cardImage} />
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{place.title}</Text>
                  <View style={styles.cardPriceBadge}>
                    <Text style={styles.cardPriceBadgeText}>{formatPrice(place.price)}</Text>
                  </View>
                </View>
                <View style={styles.cardDateRow}>
                  <Ionicons name="calendar-outline" size={14} color="#64748b" />
                  <Text style={styles.cardDate}>
                    {formatDateRange(place.trip_start_date, place.trip_end_date)}
                  </Text>
                </View>
                <View style={styles.cardLocationRow}>
                  <Ionicons name="location-outline" size={14} color="#64748b" />
                  <Text style={styles.cardLocationText} numberOfLines={1}>{place.location}</Text>
                </View>
                <View style={styles.cardJoinedRow}>
                  {(place.participants_count ?? 0) > 0 && (
                    <View style={styles.joinedAvatars}>
                      {(place.participants_preview ?? []).slice(0, 5).map((p, i) => (
                        <Image
                          key={i}
                          source={{ uri: p.profile_picture_url || DEFAULT_AVATAR_URL }}
                          style={[styles.joinedAvatar, { marginLeft: i > 0 ? -8 : 0 }]}
                        />
                      ))}
                    </View>
                  )}
                  <Text style={styles.cardJoinedText}>
                    {place.participants_count ?? 0} Person Joined
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Filter modal */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableOpacity
          style={styles.filterOverlay}
          activeOpacity={1}
          onPress={() => setFilterVisible(false)}
        >
          <View style={styles.filterModal} onStartShouldSetResponder={() => true}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filter by location</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.filterList} showsVerticalScrollIndicator={false}>
              {categories.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.filterItem, active && styles.filterItemActive]}
                    onPress={() => {
                      setActiveCategory(cat);
                      setFilterVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterItemText, active && styles.filterItemTextActive]}>{cat}</Text>
                    {active && <Ionicons name="checkmark" size={20} color="#1f6b2a" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f6b2a",
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
    backgroundColor: "#f8fafc",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    color: "#1e293b",
  },
  filterIconWrap: {
    padding: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  scroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImage: {
    width: 120,
    height: 140,
    backgroundColor: "#e2e8f0",
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
  cardPriceBadge: {
    backgroundColor: "#1f6b2a",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexShrink: 0,
  },
  cardPriceBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  cardDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  cardDate: {
    fontSize: 12,
    color: "#64748b",
  },
  cardLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  cardLocationText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    color: "#64748b",
  },
  cardJoinedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  joinedAvatars: {
    flexDirection: "row",
    alignItems: "center",
  },
  joinedAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#cbd5e1",
    borderWidth: 2,
    borderColor: "#f8fafc",
    overflow: "hidden",
  },
  cardJoinedText: {
    fontSize: 12,
    color: "#64748b",
  },
  filterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  filterModal: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 24,
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
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  filterList: {
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: 320,
  },
  filterItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  filterItemActive: {
    backgroundColor: "#f0f9f4",
  },
  filterItemText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1e293b",
  },
  filterItemTextActive: {
    color: "#1f6b2a",
    fontWeight: "600",
  },
});

export default SearchScreen;
