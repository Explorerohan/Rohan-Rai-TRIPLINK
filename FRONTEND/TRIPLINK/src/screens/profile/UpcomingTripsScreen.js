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
import { getMyBookings } from "../../utils/api";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80";

const formatPrice = (price) => {
  const numeric =
    typeof price === "number"
      ? price
      : typeof price === "string"
        ? parseFloat(String(price).replace(/[^0-9.]/g, "")) || 0
        : 0;
  return `Rs. ${numeric.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};

const formatDateRange = (start, end) => {
  const fmt = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const startText = fmt(start);
  const endText = fmt(end);
  if (startText && endText) return `${startText} – ${endText}`;
  if (startText) return `From ${startText}`;
  if (endText) return `Until ${endText}`;
  return "Dates not set";
};

const UpcomingTripsScreen = ({
  session,
  initialBookings = null,
  onUpdateCachedBookings = () => {},
  onBack = () => {},
  onTripPress = () => {},
}) => {
  const { t } = useLanguage();
  const [bookings, setBookings] = useState(() => Array.isArray(initialBookings) ? initialBookings : []);
  const [loading, setLoading] = useState(!Array.isArray(initialBookings) || initialBookings?.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const upcomingTrips = useMemo(() => {
    const confirmed = (bookings || []).filter((b) => b.status === "confirmed");
    return confirmed.filter((b) => (b.package_status || "").toLowerCase() === "active");
  }, [bookings]);

  const mappedItems = useMemo(
    () =>
      upcomingTrips.map((b) => {
        const location =
          b.package_location && b.package_country
            ? `${b.package_location}, ${b.package_country}`
            : b.package_location || "—";
        return {
          id: String(b.id),
          packageId: b.package_id,
          title: b.package_title || "Trip",
          location,
          image: b.package_image_url || FALLBACK_IMAGE,
          price: b.total_amount ?? b.price_per_person_snapshot,
          dateRange: formatDateRange(b.trip_start_date, b.trip_end_date),
          travelerCount: b.traveler_count ?? 1,
          raw: b,
        };
      }),
    [upcomingTrips]
  );

  const fetchBookings = useCallback(async ({ silent = false } = {}) => {
    if (!session?.access) {
      setBookings([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await getMyBookings(session.access);
      const list = res?.data ?? [];
      const arr = Array.isArray(list) ? list : [];
      setBookings(arr);
      onUpdateCachedBookings?.(arr);
    } catch (_) {
    } finally {
      if (!silent) setLoading(false);
    }
  }, [session?.access, onUpdateCachedBookings]);

  useEffect(() => {
    if (Array.isArray(initialBookings)) {
      setBookings(initialBookings);
      setLoading(false);
    }
  }, [initialBookings]);

  useEffect(() => {
    const hasInitial = Array.isArray(initialBookings) && initialBookings.length > 0;
    fetchBookings({ silent: hasInitial });
  }, [session?.access]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchBookings({ silent: true });
    } catch (_) {
    } finally {
      setRefreshing(false);
    }
  };

  const handleTripPress = (item) => {
    const pkg = item.raw?.package_id != null ? { id: String(item.raw.package_id) } : item.raw;
    onTripPress(pkg || { id: String(item.packageId) });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#1f1f1f" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{t("upcomingTrips")}</Text>
          <Text style={styles.headerSubtitle}>
            {upcomingTrips.length} upcoming trip{upcomingTrips.length === 1 ? "" : "s"}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.centerText}>Loading upcoming trips...</Text>
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
          {mappedItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={36} color="#64748b" />
              <Text style={styles.emptyTitle}>No upcoming trips</Text>
              <Text style={styles.emptyText}>
                Book a package to see your upcoming trips here.
              </Text>
            </View>
          ) : (
            mappedItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => handleTripPress(item)}
              >
                <Image source={{ uri: item.image }} style={styles.cardImage} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={14} color="#64748b" />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {item.location}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={14} color="#64748b" />
                    <Text style={styles.metaText}>{item.dateRange}</Text>
                  </View>

                  <View style={styles.footerRow}>
                    <Text style={styles.priceText}>{formatPrice(item.price)}</Text>
                    <View style={styles.badgeWrap}>
                      <Text style={styles.badgeText}>Upcoming</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
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
  emptyCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    backgroundColor: "#f8fafc",
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 10,
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
    borderWidth: 1,
    borderColor: "#e3e6ea",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    marginBottom: 12,
  },
  cardImage: {
    width: 118,
    height: 132,
    backgroundColor: "#eef2f7",
  },
  cardBody: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
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
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  priceText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f6b2a",
  },
  badgeWrap: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1e40af",
  },
});

export default UpcomingTripsScreen;
