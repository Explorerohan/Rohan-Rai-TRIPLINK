import React, { useMemo, useState, useEffect } from "react";
import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getPackages, getProfile } from "../../utils/api";

const DEFAULT_AVATAR_URL =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

const AVATAR = {
  uri: DEFAULT_AVATAR_URL,
};

const popularTrips = [
  {
    id: "1",
    title: "Paris City Lights",
    location: "Paris, France",
    locationName: "Paris",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80",
    price: "$899",
    nights: "5D/4N",
    perks: ["Free cancel", "Breakfast", "Guide"],
  },
  {
    id: "2",
    title: "Great Ocean Drive",
    location: "Melbourne, AU",
    locationName: "Melbourne",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    price: "$1040",
    nights: "6D/5N",
    perks: ["Transfers", "Breakfast", "Guide"],
  },
  {
    id: "3",
    title: "Tokyo Culture Run",
    location: "Tokyo, Japan",
    locationName: "Tokyo",
    image: "https://the-running-ginger.blog/wp-content/uploads/2024/03/TokyoBannerBona.png",
    price: "$1299",
    nights: "7D/6N",
    perks: ["Rail pass", "Guide", "Meals"],
  },
];

const recommendedTrips = [
  {
    id: "a",
    title: "Swiss Alps Escape",
    badge: "Hot Deal",
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80",
    price: "$1180",
    nights: "5D/4N",
    tag: "Ski + Scenic",
  },
  {
    id: "b",
    title: "Bali Beachside",
    badge: "Limited",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    price: "$740",
    nights: "4D/3N",
    tag: "Couple Retreat",
  },
  {
    id: "c",
    title: "Santorini Sunset",
    badge: "Top Pick",
    image: "https://media.istockphoto.com/id/541132240/photo/oia-at-sunset.jpg?s=612x612&w=0&k=20&c=kql4X3tMkOmYsa4PX45WK7-vHzpOk__IeAaHiz4VfyA=",
    price: "$960",
    nights: "5D/4N",
    tag: "Island Hopper",
  },
];

const NAV_ICON_SIZE = 22;

const navItems = [
  { key: "home", label: "Home", icon: "home-outline", active: true },
  { key: "calendar", label: "Calendar", icon: "calendar-outline", active: false },
  { key: "messages", label: "Messages", icon: "chatbubble-ellipses-outline", active: false },
  { key: "profile", label: "Profile", icon: "person-outline", active: false },
];

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

const HomeScreen = ({ session, packagesRefreshKey = 0, onTripPress = () => {}, onProfilePress = () => {}, onCalendarPress = () => {}, onSearchPress = () => {} }) => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);

  // Prefer first name from profile; fall back to session / email username
  const displayName =
    profile?.first_name ||
    session?.user?.first_name ||
    session?.user?.name ||
    (session?.user?.email ? session.user.email.split("@")[0] : null) ||
    "Traveler";

  // Fetch profile (for avatar and first name) – show placeholder until loaded so we don't flash default then user image
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!session?.access) return;
      try {
        const response = await getProfile(session.access);
        setProfile(response?.data ?? {});
      } catch (err) {
        console.error("Error fetching profile in HomeScreen:", err);
        setProfile({}); // so we show default avatar on error, not placeholder forever
      }
    };

    fetchProfileData();
  }, [session]);

  // Fetch packages from API (pass token when logged in so backend can set user_has_booked)
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        const response = await getPackages({}, session?.access ?? null);
        const rawList = Array.isArray(response?.data) ? response.data : response?.data?.results ?? [];
        if (rawList.length > 0) {
          // Transform API data to match the expected format
          const transformedPackages = rawList.filter(Boolean).map((pkg) => ({
            id: pkg.id.toString(),
            title: pkg.title,
            location: `${pkg.location || ""}, ${pkg.country || ""}`.replace(/^,\s*|,\s*$/g, "").trim() || "—",
            locationName: (pkg.location || "").trim() || "Other",
            image: pkg.main_image_url || "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80",
            price: pkg.price_per_person, // Pass numeric value, DetailsScreen will format it
            nights: pkg.duration_display || `${pkg.duration_days}D/${pkg.duration_nights}N`,
            rating: parseFloat(pkg.agent_rating ?? pkg.rating) || 4.5,
            reviews: pkg.participants_count || 0,
            perks: pkg.features?.map(f => f.name) || [],
            description: pkg.description,
            hero: pkg.main_image_url,
            facilities: pkg.features?.map((f, idx) => ({
              key: `feature_${idx}`,
              label: f.name,
              icon: f.icon || "checkmark-circle-outline",
            })) || defaultFacilities,
            user_has_booked: pkg.user_has_booked ?? false,
            trip_start_date: pkg.trip_start_date ?? null,
            trip_end_date: pkg.trip_end_date ?? null,
            // Include full package data for detail view
            packageData: pkg,
          }));
          setPackages(transformedPackages);
        }
      } catch (err) {
        console.error("Error fetching packages:", err);
        setError(err.message);
        // Fallback to hardcoded data on error
        setPackages(popularTrips);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [session?.access, packagesRefreshKey]);

  const categories = useMemo(() => {
    if (!Array.isArray(packages) || packages.length === 0) return ["All"];
    const names = packages.map((p) => p?.locationName).filter(Boolean);
    const unique = [...new Set(names)].sort((a, b) => String(a).localeCompare(String(b)));
    return ["All", ...unique];
  }, [packages]);

  const filteredPopular = useMemo(() => {
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

  const handleTripSelect = (trip) => {
    if (!trip || typeof trip !== "object") return;
    // Extract numeric price value
    let priceValue = trip.price;
    if (typeof priceValue === "string") {
      // Remove currency symbols and extract number
      const cleaned = priceValue.replace(/[^0-9.]/g, "");
      priceValue = parseFloat(cleaned) || 0;
    }
    
    onTripPress({
      ...trip,
      facilities: trip.facilities || defaultFacilities,
      price: priceValue, // Pass numeric value for proper formatting
      rating: trip.rating ?? 4.5,
      reviews: trip.reviews ?? 320,
      description:
        trip.description ||
        "Discover tailored experiences with comfortable stays, great dining, and curated activities throughout your trip.",
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.contentContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        <View style={styles.headerRow}>
          {profile === null ? (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          ) : (
            <Image
              source={
                profile?.profile_picture_url?.trim?.()
                  ? { uri: profile.profile_picture_url.trim() }
                  : AVATAR
              }
              style={styles.avatar}
            />
          )}
          <View style={styles.headerText}>
            <Text style={styles.hello}>Hello ! {displayName}</Text>
            <Text style={styles.prompt}>Where do you want to go ?</Text>
          </View>
          <TouchableOpacity style={styles.alertButton} activeOpacity={0.8}>
            <Ionicons name="notifications-outline" size={22} color="#1f6b2a" />
            <View style={styles.alertDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TouchableOpacity style={styles.searchBox} activeOpacity={0.8} onPress={onSearchPress}>
            <Ionicons name="search-outline" size={20} color="#7a7f85" style={styles.searchIcon} />
            <Text style={styles.searchPlaceholder}>Search Places</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            activeOpacity={0.85}
            onPress={() => setFilterVisible(true)}
          >
            <Ionicons name="options-outline" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

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
                      <Text style={[styles.filterItemText, active && styles.filterItemTextActive]}>
                        {cat}
                      </Text>
                      {active && <Ionicons name="checkmark" size={20} color="#1f6b2a" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {categories.map((cat) => {
            const active = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActiveCategory(cat)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Picks for You</Text>
          <TouchableOpacity activeOpacity={0.8}>
            <Text style={styles.sectionLink}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1f6b2a" />
            <Text style={styles.loadingText}>Loading packages...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error loading packages: {error}</Text>
          </View>
        ) : filteredPopular.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery.trim()
                ? "No packages match your search"
                : activeCategory === "All"
                  ? "No packages available"
                  : `No packages in ${activeCategory}`}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardRow}
          >
            {filteredPopular.map((place) => (
            <TouchableOpacity
              key={place.id}
              style={styles.placeCard}
              activeOpacity={0.9}
              onPress={() => handleTripSelect(place)}
            >
              <View>
                <Image source={{ uri: place.image }} style={styles.placeImage} />
              </View>

              <View style={styles.placeBody}>
                <View style={styles.placeTitleRow}>
                  <Text style={styles.placeTitle} numberOfLines={2}>{place.title}</Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.price}>{place.price}</Text>
                  <View style={styles.nights}>
                    <Ionicons name="moon-outline" size={14} color="#6b7076" />
                    <Text style={styles.nightsText}>{place.nights}</Text>
                  </View>
                </View>

                <View style={styles.placeMetaRow}>
                  <View style={styles.metaLeft}>
                    <Ionicons name="location-outline" size={14} color="#6b7076" />
                    <Text style={styles.placeMeta}>{place.location}</Text>
                  </View>
                  <TouchableOpacity style={styles.saveBadge} activeOpacity={0.8}>
                    <Ionicons name="bookmark-outline" size={18} color="#1f6b2a" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recommended Packages</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recommendedRow}
        >
          {recommendedTrips.map((place) => (
            <TouchableOpacity
              key={place.id}
              style={styles.recommendCard}
              activeOpacity={0.9}
              onPress={() =>
                handleTripSelect({
                  ...place,
                  location: place.tag || "Scenic escape",
                  hero: place.image,
                })
              }
            >
              <View style={styles.recommendImageWrap}>
                <Image
                  source={{ uri: place.image }}
                  style={styles.recommendImage}
                />
                <View style={styles.recommendOverlay}>
                  <Text style={styles.recommendTitle}>{place.title}</Text>
                  <View style={styles.recommendMeta}>
                    <View style={styles.nights}>
                      <Ionicons name="time-outline" size={14} color="#e6e8ea" />
                      <Text style={styles.metaText}>{place.nights}</Text>
                    </View>
                    <Text style={styles.recommendPrice}>{place.price}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>
      </View>

      <View style={styles.navBar}>
        <View style={styles.navSide}>
          {navItems.slice(0, 2).map((item) => {
            const color = item.active ? "#1f6b2a" : "#7a7f85";
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.navItem}
                activeOpacity={0.85}
                onPress={item.key === "calendar" ? onCalendarPress : undefined}
              >
                <Ionicons name={item.icon} size={NAV_ICON_SIZE} color={color} />
                <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.fab} activeOpacity={0.9}>
          <Ionicons name="add" size={26} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.navSide}>
          {navItems.slice(2).map((item) => {
            const color = item.active ? "#1f6b2a" : "#7a7f85";
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.navItem}
                activeOpacity={0.85}
                onPress={item.key === "profile" ? onProfilePress : undefined}
              >
                <Ionicons name={item.icon} size={NAV_ICON_SIZE} color={color} />
                <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
};

const shadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 6,
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  contentContainer: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: "#e8eaed",
  },
  headerText: {
    flex: 1,
  },
  hello: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  prompt: {
    fontSize: 13,
    color: "#61656b",
    marginTop: 2,
  },
  alertButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f6f7f9",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  alertDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f59e0b",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d5d9dd",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 50,
    backgroundColor: "#ffffff",
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
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: "#9aa0a6",
  },
  filterButton: {
    width: 48,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#1f6b2a",
    alignItems: "center",
    justifyContent: "center",
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
  chipRow: {
    gap: 8,
    paddingRight: 10,
    marginBottom: 18,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d5d9dd",
    backgroundColor: "#ffffff",
  },
  chipActive: {
    backgroundColor: "#1f6b2a",
    borderColor: "#1f6b2a",
  },
  chipText: {
    color: "#5f6369",
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5b46f6",
  },
  cardRow: {
    gap: 14,
    paddingRight: 10,
    marginBottom: 22,
  },
  placeCard: {
    width: 230,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e3e6ea",
    overflow: "hidden",
  },
  placeImage: {
    width: "100%",
    height: 220,
  },
  ratingBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(31, 107, 42, 0.9)",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  ratingText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  ratingCount: {
    color: "#d8e9d8",
    fontSize: 11,
  },
  placeBody: {
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
  },
  placeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  placeTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  saveBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#f3f5f7",
    borderWidth: 1,
    borderColor: "#e3e6ea",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f6b2a",
  },
  nights: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nightsText: {
    fontSize: 12,
    color: "#6b7076",
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  placeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  placeMeta: {
    fontSize: 12,
    color: "#6b7076",
  },
  placeDistance: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1f6b2a",
  },
  perkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  perkChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#f3f5f7",
  },
  perkText: {
    fontSize: 11,
    color: "#1f1f1f",
    fontWeight: "700",
  },
  recommendedRow: {
    gap: 14,
    paddingRight: 10,
    marginBottom: 12,
  },
  recommendCard: {
    width: 180,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 0,
    borderColor: "transparent",
    overflow: "hidden",
  },
  recommendImageWrap: {
    position: "relative",
    width: "100%",
    height: 140,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f3f5f7",
  },
  recommendImage: {
    width: "100%",
    height: "100%",
  },
  recommendOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
    gap: 6,
  },
  recommendTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
  recommendMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: 12,
    color: "#e6e8ea",
  },
  recommendPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#edf7ed",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  navBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#e3e6ea",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    elevation: 10,
  },
  navSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 68,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7a7f85",
  },
  navLabelActive: {
    color: "#1f6b2a",
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1f6b2a",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#7a7f85",
  },
  errorContainer: {
    padding: 20,
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    marginHorizontal: 16,
  },
  errorText: {
    fontSize: 14,
    color: "#991b1b",
    textAlign: "center",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#7a7f85",
  },
});

export default HomeScreen;
