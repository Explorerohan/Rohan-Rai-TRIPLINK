import React, { useMemo, useState } from "react";
import {
  Image,
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

const AVATAR = {
  uri: "https://hips.hearstapps.com/hmg-prod/images/cristiano-ronaldo-of-portugal-during-the-uefa-nations-news-photo-1748359673.pjpeg?crop=0.610xw:0.917xh;0.317xw,0.0829xh&resize=640:*",
};

const categories = ["All", "Kathmandu", "Pokhara", "Dharan", "Mustang"];

const popularTrips = [
  {
    id: "1",
    title: "Paris City Lights",
    location: "Paris, France",
    distance: "2450 kms",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80",
    price: "$899",
    nights: "5D/4N",
    rating: 4.8,
    reviews: 1200,
    perks: ["Free cancel", "Breakfast", "Guide"],
    region: "All",
  },
  {
    id: "2",
    title: "Great Ocean Drive",
    location: "Melbourne, AU",
    distance: "870 kms",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    price: "$1040",
    nights: "6D/5N",
    rating: 4.7,
    reviews: 860,
    perks: ["Transfers", "Breakfast", "Guide"],
    region: "All",
  },
  {
    id: "3",
    title: "Tokyo Culture Run",
    location: "Tokyo, Japan",
    distance: "5420 kms",
    image: "https://the-running-ginger.blog/wp-content/uploads/2024/03/TokyoBannerBona.png",
    price: "$1299",
    nights: "7D/6N",
    rating: 4.9,
    reviews: 1430,
    perks: ["Rail pass", "Guide", "Meals"],
    region: "All",
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

const HomeScreen = ({ session, onTripPress = () => {} }) => {
  const [activeCategory, setActiveCategory] = useState(categories[0]);

  const displayName =
    session?.user?.first_name ||
    session?.user?.name ||
    (session?.user?.email ? session.user.email.split("@")[0] : null) ||
    "Rohan";

  const filteredPopular = useMemo(() => {
    if (activeCategory === "All") return popularTrips;
    return popularTrips.filter((place) => place.region === activeCategory);
  }, [activeCategory]);

  const handleTripSelect = (trip) => {
    onTripPress({
      ...trip,
      facilities: trip.facilities || defaultFacilities,
      price: cleanPrice(trip.price),
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.headerRow}>
          <Image source={AVATAR} style={styles.avatar} />
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
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#7a7f85" style={styles.searchIcon} />
            <TextInput
              placeholder="Search Places"
              placeholderTextColor="#9aa0a6"
              style={styles.searchInput}
            />
          </View>
          <TouchableOpacity style={styles.filterButton} activeOpacity={0.85}>
            <Ionicons name="options-outline" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

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
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#fcd34d" />
                  <Text style={styles.ratingText}>{place.rating}</Text>
                  <Text style={styles.ratingCount}>({place.reviews})</Text>
                </View>
              </View>

              <View style={styles.placeBody}>
                <View style={styles.placeTitleRow}>
                  <Text style={styles.placeTitle}>{place.title}</Text>
                  <TouchableOpacity style={styles.saveBadge} activeOpacity={0.8}>
                    <Ionicons name="bookmark-outline" size={18} color="#1f6b2a" />
                  </TouchableOpacity>
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
                  <Text style={styles.placeDistance}>{place.distance}</Text>
                </View>

                <View style={styles.perkRow}>
                  {place.perks.map((perk) => (
                    <View key={perk} style={styles.perkChip}>
                      <Text style={styles.perkText}>{perk}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

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

      <View style={styles.navBar}>
        <View style={styles.navSide}>
          {navItems.slice(0, 2).map((item) => {
            const color = item.active ? "#1f6b2a" : "#7a7f85";
            return (
              <TouchableOpacity key={item.key} style={styles.navItem} activeOpacity={0.85}>
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
              <TouchableOpacity key={item.key} style={styles.navItem} activeOpacity={0.85}>
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
  filterButton: {
    width: 48,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#1f6b2a",
    alignItems: "center",
    justifyContent: "center",
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
    ...shadow,
  },
  placeImage: {
    width: "100%",
    height: 160,
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
    padding: 12,
    gap: 6,
  },
  placeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  placeTitle: {
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
    ...shadow,
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
    ...shadow,
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
    ...shadow,
  },
});

export default HomeScreen;
