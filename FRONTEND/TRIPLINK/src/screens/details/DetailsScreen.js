import React, { useMemo, useState } from "react";
import {
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const defaultTrip = {
  title: "Coeurdes Alpes",
  location: "Aspen, United States",
  rating: 4.5,
  reviews: 355,
  price: 199,
  description:
    "Aspen is as close as one can get to a storybook alpine town in America. The choose-your-own-adventure possibilities—skiing, hiking, dining, shopping and more—make it perfect for every traveler.",
  hero: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80",
  facilities: [
    { key: "heater", label: "Heater", icon: "thermometer-outline" },
    { key: "dinner", label: "Dinner", icon: "restaurant-outline" },
    { key: "tub", label: "1 Tub", icon: "water-outline" },
    { key: "pool", label: "Pool", icon: "water-outline" },
  ],
};

const DetailsScreen = ({ route, trip: tripProp, onBack = () => {}, onBook = () => {} }) => {
  const [expanded, setExpanded] = useState(false);
  const trip = useMemo(() => {
    const incoming = tripProp || route?.params?.trip || {};
    return {
      ...defaultTrip,
      ...incoming,
      hero: incoming.hero || incoming.image || defaultTrip.hero,
      price: incoming.price ?? defaultTrip.price,
      rating: incoming.rating ?? defaultTrip.rating,
      reviews: incoming.reviews ?? defaultTrip.reviews,
      facilities: incoming.facilities || defaultTrip.facilities,
    };
  }, [tripProp, route?.params?.trip]);
  const fullDescription = trip.description || defaultTrip.description;
  const description =
    expanded || fullDescription.length <= 120 ? fullDescription : `${fullDescription.slice(0, 120)}...`;
  const priceLabel =
    typeof trip.price === "number" ? `$${trip.price}` : typeof trip.price === "string" ? trip.price : "$0";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f2f3f5" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.imageWrap}>
            <Image source={{ uri: trip.hero }} style={styles.image} />
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.circleButton} onPress={onBack} activeOpacity={0.85}>
                <Ionicons name="chevron-back" size={20} color="#1f1f1f" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleButton} activeOpacity={0.85}>
                <Ionicons name="share-outline" size={18} color="#1f1f1f" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{trip.title}</Text>
              </View>
              <TouchableOpacity activeOpacity={0.8}>
                <Text style={styles.link}>Show map</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#f7b500" />
              <Text style={styles.ratingValue}>{trip.rating}</Text>
              <Text style={styles.ratingMeta}>({trip.reviews} Reviews)</Text>
            </View>

            <View style={styles.descriptionWrap}>
              <Text style={styles.description}>{description}</Text>
              <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
                <Text style={styles.readMore}>{expanded ? "Read less" : "Read more"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Facilities</Text>
            <View style={styles.facilityRow}>
              {trip.facilities.map((facility) => (
                <View key={facility.key} style={styles.facilityCard}>
                  <View style={styles.facilityIconWrap}>
                    <Ionicons name={facility.icon} size={20} color="#1f6b2a" />
                  </View>
                  <Text style={styles.facilityLabel}>{facility.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.priceWrap}>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.priceValue}>{priceLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.bookButton}
            activeOpacity={0.88}
            onPress={() => onBook(trip)}
          >
            <Text style={styles.bookText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const shadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 8,
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f2f3f5",
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
    ...shadow,
  },
  imageWrap: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 260,
  },
  imageActions: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  link: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  ratingMeta: {
    fontSize: 13,
    color: "#6f747a",
  },
  descriptionWrap: {
    gap: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5f6369",
  },
  readMore: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f1f1f",
    marginTop: 6,
  },
  facilityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  facilityCard: {
    flex: 1,
    backgroundColor: "#f6f8fa",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e4e7eb",
  },
  facilityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(31, 107, 42, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  facilityLabel: {
    fontSize: 13,
    color: "#1f1f1f",
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    ...shadow,
  },
  priceWrap: {
    gap: 4,
  },
  priceLabel: {
    fontSize: 13,
    color: "#6f747a",
  },
  priceValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1f6b2a",
  },
  bookButton: {
    backgroundColor: "#1f6b2a",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  bookText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});

export default DetailsScreen;
