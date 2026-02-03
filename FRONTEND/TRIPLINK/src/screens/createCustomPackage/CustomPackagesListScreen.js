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
  onHomePress,
  onCalendarPress,
  onProfilePress,
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Custom packages</Text>
        <View style={styles.headerRight} />
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
          <Text style={styles.sectionTitle}>Your custom packages</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#1f6b2a" style={styles.loader} />
          ) : list.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>You haven't created any custom packages yet.</Text>
              <Text style={styles.emptySubtext}>Tap the button below to create one.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {list.map((pkg) => (
                <View key={pkg.id} style={styles.card}>
                  <Image
                    source={{ uri: pkg.main_image_url || PLACEHOLDER_IMAGE }}
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{pkg.title}</Text>
                    <Text style={styles.cardLocation} numberOfLines={1}>
                      {pkg.location}, {pkg.country}
                    </Text>
                    <Text style={styles.cardPrice}>{formatPrice(pkg.price_per_person)}</Text>
                    {pkg.duration_display ? (
                      <Text style={styles.cardDuration}>{pkg.duration_display}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.createButton} onPress={onCreatePress} activeOpacity={0.85}>
            <Ionicons name="add-circle-outline" size={24} color="#fff" />
            <Text style={styles.createButtonText}>Create your custom package</Text>
          </TouchableOpacity>
          <View style={styles.bottomPad} />
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
      </View>
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
  },
  headerRight: {
    width: 32,
  },
  contentContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 110,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
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
    gap: 12,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#e2e8f0",
  },
  cardBody: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
  cardLocation: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f6b2a",
    marginTop: 6,
  },
  cardDuration: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f6b2a",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  bottomPad: {
    height: 24,
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
});

export default CustomPackagesListScreen;
