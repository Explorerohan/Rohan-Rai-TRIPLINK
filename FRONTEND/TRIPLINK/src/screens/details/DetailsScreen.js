import React, { useMemo, useState, useEffect } from "react";
import {
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getPackageById } from "../../utils/api";

const defaultTrip = {
  title: "Coeurdes Alpes",
  location: "Aspen, United States",
  rating: 4.5,
  reviews: 355,
  price: 199,
  description:
    "Aspen is as close as one can get to a storybook alpine town in America. The choose-your-own-adventure possibilities - skiing, hiking, dining, shopping and more - make it perfect for every traveler. Wander through charming streets, soak up alpine sunshine, and unwind with world-class dining before your next adventure begins.",
  hero: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  facilities: [
    { key: "heater", label: "1 Heater", icon: "snow-outline" },
    { key: "dinner", label: "Dinner", icon: "restaurant-outline" },
    { key: "tub", label: "1 Tub", icon: "water-outline" },
    { key: "pool", label: "Pool", icon: "water-outline" },
  ],
};

const formatPrice = (price) => {
  // Extract numeric value from price
  let numericValue = 0;
  
  if (typeof price === "number") {
    numericValue = price;
  } else if (typeof price === "string") {
    // Remove any currency symbols and extract number
    const cleaned = price.replace(/[^0-9.]/g, "");
    numericValue = parseFloat(cleaned) || 0;
  }
  
  // Format with Rs. and add commas for thousands
  return `Rs. ${numericValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatTripDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const COLS = 4;
const CARD_GAP = 10;
const ROW_GAP = 12;

const DetailsScreen = ({ route, trip: tripProp, session, onBack = () => {}, onBook = () => {} }) => {
  const { width: windowWidth } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [userHasBooked, setUserHasBooked] = useState(false);
  const trip = useMemo(() => {
    const incoming = tripProp || route?.params?.trip || {};
    const pkg = incoming.packageData || {};
    return {
      ...defaultTrip,
      ...incoming,
      hero: incoming.hero || incoming.image || defaultTrip.hero,
      facilities: incoming.facilities || defaultTrip.facilities,
      price: incoming.price ?? defaultTrip.price,
      rating: incoming.rating ?? defaultTrip.rating,
      reviews: incoming.reviews ?? defaultTrip.reviews,
      description: incoming.description || defaultTrip.description,
      user_has_booked: incoming.user_has_booked ?? false,
      trip_start_date: incoming.trip_start_date ?? pkg.trip_start_date ?? null,
      trip_end_date: incoming.trip_end_date ?? pkg.trip_end_date ?? null,
    };
  }, [tripProp, route?.params?.trip]);

  const packageId = trip?.id || trip?.packageData?.id;
  useEffect(() => {
    setUserHasBooked(trip.user_has_booked ?? false);
    if (session?.access && packageId) {
      getPackageById(packageId, session.access)
        .then((res) => {
          if (res?.data?.user_has_booked === true) setUserHasBooked(true);
        })
        .catch(() => {});
    }
  }, [session?.access, packageId, trip.user_has_booked]);

  const body = expanded
    ? trip.description
    : trip.description.length > 140
    ? `${trip.description.slice(0, 140)}...`
    : trip.description;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f2f3f5" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Image source={{ uri: trip.hero }} style={styles.heroImage} />
          <TouchableOpacity style={styles.backButton} activeOpacity={0.85} onPress={onBack}>
            <Ionicons name="chevron-back" size={20} color="#1f1f1f" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{trip.title}</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.mapLink}>Show map</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color="#f7b500" />
            <Text style={styles.ratingValue}>{trip.rating}</Text>
            <Text style={styles.ratingMeta}> ({trip.reviews} Reviews)</Text>
          </View>

          {(trip.trip_start_date || trip.trip_end_date) && (
            <View style={styles.tripDatesRow}>
              <Ionicons name="calendar-outline" size={18} color="#1f6b2a" />
              <Text style={styles.tripDatesText}>
                {trip.trip_start_date && trip.trip_end_date
                  ? `${formatTripDate(trip.trip_start_date)} – ${formatTripDate(trip.trip_end_date)}`
                  : trip.trip_start_date
                    ? `From ${formatTripDate(trip.trip_start_date)}`
                    : `To ${formatTripDate(trip.trip_end_date)}`}
              </Text>
            </View>
          )}

          <View style={styles.descriptionWrap}>
            <Text style={styles.description}>{body}</Text>
            {trip.description.length > 0 && (
              <TouchableOpacity
                style={styles.readMoreRow}
                activeOpacity={0.8}
                onPress={() => setExpanded(!expanded)}
              >
                <Text style={styles.readMoreText}>{expanded ? "Read less" : "Read more"}</Text>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color="#1f6b2a"
                  style={{ marginLeft: 2 }}
                />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionTitle}>Facilities</Text>
          <View style={styles.facilityGrid}>
            {(() => {
              const list = Array.isArray(trip.facilities) ? trip.facilities : [];
              const contentWidth = windowWidth - 16 * 2 - 10 * 2;
              const cardWidth = (contentWidth - (COLS - 1) * CARD_GAP) / COLS;
              const rows = [];
              for (let i = 0; i < list.length; i += COLS) {
                rows.push(list.slice(i, i + COLS));
              }
              return rows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={[styles.facilityRow, rowIndex === rows.length - 1 && styles.facilityRowLast]}>
                  {row.map((facility, colIndex) => (
                    <View
                      key={facility.key || `${rowIndex}-${colIndex}`}
                      style={[
                        styles.facilityCard,
                        { width: cardWidth, marginRight: colIndex < row.length - 1 ? CARD_GAP : 0 },
                      ]}
                    >
                      <View style={styles.facilityIcon}>
                        <Ionicons name={facility.icon || "checkmark-circle-outline"} size={22} color="#8b9096" />
                      </View>
                      <Text style={styles.facilityLabel} numberOfLines={2}>{facility.label || facility.name || ""}</Text>
                    </View>
                  ))}
                </View>
              ));
            })()}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.priceWrap}>
          <Text style={styles.priceLabel}>Price</Text>
          <Text style={styles.priceValue}>{formatPrice(trip.price)}</Text>
        </View>
        {(userHasBooked || trip.user_has_booked) ? (
          <View style={styles.alreadyBookedBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#1f6b2a" />
            <Text style={styles.alreadyBookedText}>Already booked</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.bookButton} activeOpacity={0.88} onPress={() => onBook(trip)}>
            <Text style={styles.bookText}>Book Now</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f2f3f5",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 130,
  },
  heroCard: {
    position: "relative",
    height: 350,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  backButton: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  body: {
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    fontSize: 23,
    fontWeight: "800",
    color: "#1f1f1f",
    flex: 1,
  },
  mapLink: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  ratingValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f1f1f",
    marginLeft: 4,
  },
  ratingMeta: {
    fontSize: 14,
    color: "#6f747a",
  },
  tripDatesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  tripDatesText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  descriptionWrap: {
    marginBottom: 18,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5f6369",
  },
  readMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  readMoreText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f1f1f",
    marginBottom: 12,
  },
  facilityGrid: {
    flexDirection: "column",
    width: "100%",
  },
  facilityRow: {
    flexDirection: "row",
    marginBottom: ROW_GAP,
    width: "100%",
  },
  facilityRowLast: {
    marginBottom: 0,
  },
  facilityCard: {
    backgroundColor: "#f1f4f6",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e1e5ea",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  facilityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(31,107,42,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  facilityLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6f747a",
    marginTop: 8,
    textAlign: "center",
    alignSelf: "stretch",
    paddingHorizontal: 2,
  },
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#e8ecef",
  },
  priceWrap: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1f6b2a",
    letterSpacing: -0.5,
  },
  bookButton: {
    flexShrink: 0,
    backgroundColor: "#1f6b2a",
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#1f6b2a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  bookText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  alreadyBookedBadge: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  alreadyBookedText: {
    color: "#166534",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default DetailsScreen;
