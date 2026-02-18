import React, { useState, useEffect } from "react";
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
import { getCustomPackages } from "../../utils/api";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80";

const NAV_ICON_SIZE = 22;

const formatTripDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const navItems = [
  { key: "home", label: "Home", icon: "home-outline", active: false },
  { key: "calendar", label: "Calendar", icon: "calendar-outline", active: false },
  { key: "messages", label: "Messages", icon: "chatbubble-ellipses-outline", active: false },
  { key: "profile", label: "Profile", icon: "person-outline", active: false },
];

const CustomPackagesListScreen = ({
  session,
  initialCustomPackages,
  onUpdateCachedCustomPackages,
  onBack,
  onCreatePress,
  onPackagePress,
  onHomePress,
  onCalendarPress,
  onMessagesPress = () => {},
  onProfilePress,
  unreadCount = 0,
}) => {
  const hasCache = initialCustomPackages !== undefined && initialCustomPackages !== null;
  const [list, setList] = useState(() => (Array.isArray(initialCustomPackages) ? initialCustomPackages : []));
  const [loading, setLoading] = useState(!hasCache);
  const [refreshing, setRefreshing] = useState(false);

  const fetchList = async (isRefresh = false) => {
    if (!session?.access) {
      setLoading(false);
      setList([]);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else if (!hasCache) setLoading(true);
    try {
      const res = await getCustomPackages(session.access);
      const data = res?.data;
      const nextList = Array.isArray(data) ? data : [];
      setList(nextList);
      if (onUpdateCachedCustomPackages) onUpdateCachedCustomPackages(nextList);
    } catch (e) {
      console.warn("Fetch custom packages failed:", e);
      if (!hasCache) setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (initialCustomPackages !== undefined && initialCustomPackages !== null) {
      setList(Array.isArray(initialCustomPackages) ? initialCustomPackages : []);
      setLoading(false);
    }
  }, [initialCustomPackages]);

  useEffect(() => {
    fetchList();
  }, [session?.access]);

  const onRefresh = () => fetchList(true);

  const formatPrice = (p) => {
    if (typeof p === "number") return `Rs. ${p.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (typeof p === "string") return p;
    return "—";
  };

  const getStatusConfig = (status) => {
    if (!status) return null;
    const value = String(status).toLowerCase();
    if (value === "claimed") {
      return {
        label: "Claimed",
        containerStyle: styles.statusPillClaimed,
        textStyle: styles.statusPillTextClaimed,
      };
    }
    if (value === "cancelled") {
      return {
        label: "Cancelled",
        containerStyle: styles.statusPillCancelled,
        textStyle: styles.statusPillTextCancelled,
      };
    }
    return {
      label: "Open",
      containerStyle: styles.statusPillOpen,
      textStyle: styles.statusPillTextOpen,
    };
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Custom packages</Text>
        <TouchableOpacity onPress={onCreatePress} style={styles.headerAction} activeOpacity={0.85}>
          <Ionicons name="add" size={22} color="#1f6b2a" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1f6b2a"]} tintColor="#1f6b2a" />
          }
        >
          <View style={styles.introCard}>
            <Text style={styles.sectionTitle}>Your custom trips</Text>
            <Text style={styles.sectionSubtitle}>
              See all trip requests you&apos;ve created and check their latest status.
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#1f6b2a" style={styles.loader} />
          ) : list.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>You haven't created any custom packages yet.</Text>
              <Text style={styles.emptySubtext}>Tap the + button above to create one.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {list.map((pkg) => {
                const statusCfg = getStatusConfig(pkg.status);
                const hasDates = pkg.trip_start_date || pkg.trip_end_date;
                let tripSummary = null;
                if (pkg.trip_start_date && pkg.trip_end_date) {
                  tripSummary = `${formatTripDate(pkg.trip_start_date)} – ${formatTripDate(pkg.trip_end_date)}`;
                } else if (pkg.trip_start_date) {
                  tripSummary = `From ${formatTripDate(pkg.trip_start_date)}`;
                } else if (pkg.trip_end_date) {
                  tripSummary = `To ${formatTripDate(pkg.trip_end_date)}`;
                }

                return (
                  <TouchableOpacity
                    key={pkg.id}
                    style={styles.card}
                    activeOpacity={0.9}
                    onPress={() => onPackagePress?.(pkg.id)}
                  >
                    <View style={styles.cardImageWrap}>
                      <Image
                        source={{ uri: pkg.main_image_url || PLACEHOLDER_IMAGE }}
                        style={styles.cardImage}
                        resizeMode="cover"
                      />
                      {statusCfg && (
                        <View style={[styles.statusPill, statusCfg.containerStyle]}>
                          <Text style={[styles.statusPillText, statusCfg.textStyle]}>
                            {statusCfg.label}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {pkg.title}
                        </Text>
                      </View>
                      <Text style={styles.cardLocation} numberOfLines={1}>
                        {pkg.location}, {pkg.country}
                      </Text>
                      <View style={styles.cardMetaRow}>
                        <View style={styles.cardMetaLeft}>
                          <Text style={styles.cardPriceLabel}>From</Text>
                          <Text style={styles.cardPrice}>{formatPrice(pkg.price_per_person)}</Text>
                        </View>
                        <View style={styles.cardMetaRight}>
                          {pkg.duration_display ? (
                            <Text style={styles.cardDuration}>{pkg.duration_display}</Text>
                          ) : hasDates && tripSummary ? (
                            <Text style={styles.cardDates} numberOfLines={1}>
                              {tripSummary}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={styles.navBar}>
          <View style={styles.navSide}>
            {navItems.slice(0, 2).map((item) => {
              const color = item.active ? "#1f6b2a" : "#7a7f85";
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.navItem}
                  activeOpacity={0.85}
                  onPress={item.key === "home" ? onHomePress : item.key === "calendar" ? onCalendarPress : undefined}
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
              const showBadge = item.key === "messages" && unreadCount > 0;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.navItem}
                  activeOpacity={0.85}
                  onPress={item.key === "messages" ? onMessagesPress : item.key === "profile" ? onProfilePress : undefined}
                >
                  <View style={styles.navIconWrap}>
                    <Ionicons name={item.icon} size={NAV_ICON_SIZE} color={color} />
                    {showBadge && (
                      <View style={styles.navBadge}>
                        <Text style={styles.navBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  headerRight: {
    width: 32,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f9f4",
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 110,
  },
  introCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#e3e6ea",
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f1f1f",
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6b7076",
    lineHeight: 19,
  },
  loader: {
    marginVertical: 32,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 12,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
    textAlign: "center",
  },
  list: {
    marginBottom: 24,
    gap: 16,
  },
  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e3e6ea",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
  },
  cardImageWrap: {
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#e2e8f0",
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  cardLocation: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 6,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cardMetaLeft: {
    flexDirection: "column",
  },
  cardMetaRight: {
    alignItems: "flex-end",
    maxWidth: "55%",
  },
  cardPriceLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "500",
    marginBottom: 2,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f6b2a",
  },
  cardDuration: {
    fontSize: 13,
    color: "#4b5563",
    fontWeight: "600",
  },
  cardDates: {
    fontSize: 12,
    color: "#6b7280",
  },
  statusPill: {
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusPillOpen: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  statusPillTextOpen: {
    color: "#1f2937",
  },
  statusPillClaimed: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  statusPillTextClaimed: {
    color: "#166534",
  },
  statusPillCancelled: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  statusPillTextCancelled: {
    color: "#b91c1c",
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
  navIconWrap: {
    position: "relative",
  },
  navBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  navBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
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
});

export default CustomPackagesListScreen;
