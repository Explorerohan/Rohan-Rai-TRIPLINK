import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
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
import { getCustomPackageById } from "../../utils/api";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80";

const CustomPackageDetailScreen = ({ packageId, session, onBack }) => {
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!packageId || !session?.access) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getCustomPackageById(packageId, session.access)
      .then((res) => setPkg(res?.data ?? null))
      .catch(() => setError("Could not load package"))
      .finally(() => setLoading(false));
  }, [packageId, session?.access]);

  const formatPrice = (price) => {
    if (typeof price === "number") return `Rs. ${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (typeof price === "string") return price;
    return "—";
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Custom package</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !pkg) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Custom package</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{error || "Package not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{pkg.title}</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: pkg.main_image_url || PLACEHOLDER_IMAGE }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <View style={styles.body}>
          <Text style={styles.title}>{pkg.title}</Text>
          <Text style={styles.location}>
            {pkg.location}, {pkg.country}
          </Text>
          <Text style={styles.price}>{formatPrice(pkg.price_per_person)}</Text>
          {pkg.duration_display ? (
            <Text style={styles.duration}>{pkg.duration_display}</Text>
          ) : null}
          {pkg.trip_start_date || pkg.trip_end_date ? (
            <Text style={styles.dates}>
              {[pkg.trip_start_date, pkg.trip_end_date].filter(Boolean).join(" — ")}
            </Text>
          ) : null}
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.description}>{pkg.description || "—"}</Text>
          {Array.isArray(pkg.features) && pkg.features.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Features</Text>
              <View style={styles.featureList}>
                {pkg.features.map((f) => (
                  <View key={f.id} style={styles.featureChip}>
                    <Text style={styles.featureText}>{f.name}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {pkg.additional_notes ? (
            <>
              <Text style={styles.sectionLabel}>Things to consider</Text>
              <Text style={styles.notes}>{pkg.additional_notes}</Text>
            </>
          ) : null}
          {pkg.status ? (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={styles.statusValue}>{pkg.status}</Text>
            </View>
          ) : null}
          {pkg.claimed_by_name ? (
            <Text style={styles.claimedBy}>Handled by: {pkg.claimed_by_name}</Text>
          ) : null}
        </View>
      </ScrollView>
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
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
  },
  headerRight: {
    width: 32,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
  },
  errorText: {
    fontSize: 15,
    color: "#64748b",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#e2e8f0",
  },
  body: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
  },
  location: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f6b2a",
    marginTop: 12,
  },
  duration: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
  dates: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
    marginTop: 20,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 22,
  },
  featureList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  featureChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  featureText: {
    fontSize: 13,
    color: "#475569",
  },
  notes: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 6,
  },
  statusLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  claimedBy: {
    fontSize: 13,
    color: "#1f6b2a",
    marginTop: 8,
  },
});

export default CustomPackageDetailScreen;
