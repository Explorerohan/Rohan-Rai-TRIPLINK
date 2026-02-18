import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { getCustomPackageById, updateCustomPackage, deleteCustomPackage } from "../../utils/api";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80";

const COLS = 4;
const CARD_GAP = 10;
const ROW_GAP = 12;

const formatTripDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const CustomPackageDetailScreen = ({ packageId, session, onBack, onCancelSuccess, onDeleteSuccess }) => {
  const { width: windowWidth } = useWindowDimensions();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
    if (typeof price === "number")
      return `Rs. ${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (typeof price === "string") return price;
    return "—";
  };

  const renderBackButton = () => (
    <TouchableOpacity style={styles.backButton} activeOpacity={0.85} onPress={onBack}>
      <Ionicons name="chevron-back" size={20} color="#1f1f1f" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#f2f3f5" />
        <View style={styles.heroCard}>
          <View style={[styles.heroImage, styles.heroPlaceholder]} />
          {renderBackButton()}
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.loadingText}>Loading your package...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !pkg) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#f2f3f5" />
        <View style={styles.heroCard}>
          <View style={[styles.heroImage, styles.heroPlaceholder]} />
          {renderBackButton()}
        </View>
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
          <Text style={styles.errorTitle}>Couldn't load package</Text>
          <Text style={styles.errorSubtext}>{error || "Package not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const description = pkg.description || "";
  const descriptionPreview = description.length > 140 ? `${description.slice(0, 140)}...` : description;
  const body = expanded ? description : descriptionPreview;
  const featuresList = (Array.isArray(pkg.features) ? pkg.features : []).map((f, idx) => ({
    key: `feature_${idx}`,
    label: f.name,
    icon: f.icon || "checkmark-circle-outline",
  }));
  const contentWidth = windowWidth - 16 * 2 - 10 * 2;
  const cardWidth = (contentWidth - (COLS - 1) * CARD_GAP) / COLS;
  const facilityRows = [];
  for (let i = 0; i < featuresList.length; i += COLS) {
    facilityRows.push(featuresList.slice(i, i + COLS));
  }

  const canCancelBase = pkg.status === "open" || pkg.status === "claimed";

  const canCancelByDate = () => {
    if (!pkg.trip_start_date) return false;
    const start = new Date(pkg.trip_start_date);
    const today = new Date();
    const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffMs = startMidnight.getTime() - todayMidnight.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 2;
  };

  const canCancel = canCancelBase && canCancelByDate();

  const handleCancelPackage = () => {
    Alert.alert(
      "Cancel package",
      "Are you sure you want to cancel this trip request? You can still delete it later if needed.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel package",
          style: "destructive",
          onPress: async () => {
            if (!session?.access || !pkg?.id) return;
            setActionLoading(true);
            try {
              const res = await updateCustomPackage(pkg.id, { status: "cancelled" }, session.access);
              const updated = res?.data ?? null;
              if (updated) {
                setPkg(updated);
                onCancelSuccess?.(updated);
              }
              Alert.alert("Done", "Your package has been cancelled.");
            } catch (err) {
              Alert.alert("Error", err?.message || "Could not cancel package.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeletePackage = () => {
    Alert.alert(
      "Delete package",
      "Permanently delete this custom package? This cannot be undone.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!session?.access || !pkg?.id) return;
            setActionLoading(true);
            try {
              await deleteCustomPackage(pkg.id, session.access);
              onDeleteSuccess?.(pkg.id);
              Alert.alert("Deleted", "Your package has been removed.", [{ text: "OK" }]);
            } catch (err) {
              Alert.alert("Error", err?.message || "Could not delete package.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f2f3f5" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Image - same as package details */}
        <View style={styles.heroCard}>
          <Image
            source={{ uri: pkg.main_image_url || PLACEHOLDER_IMAGE }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          {renderBackButton()}
        </View>

        <View style={styles.body}>
          {/* Title & Map Link - same layout as DetailsScreen */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{pkg.title}</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.mapLink}>Show map</Text>
            </TouchableOpacity>
          </View>

          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#6f747a" />
            <Text style={styles.locationText}>
              {pkg.location}, {pkg.country}
            </Text>
          </View>

          {/* Duration row - similar to rating row in Details */}
          {pkg.duration_display ? (
            <View style={styles.ratingRow}>
              <Ionicons name="time-outline" size={16} color="#1f6b2a" />
              <Text style={styles.ratingValue}>{pkg.duration_display}</Text>
              <Text style={styles.ratingMeta}> Duration</Text>
            </View>
          ) : null}

          {/* Trip Dates */}
          {(pkg.trip_start_date || pkg.trip_end_date) && (
            <View style={styles.tripDatesRow}>
              <Ionicons name="calendar-outline" size={18} color="#1f6b2a" />
              <Text style={styles.tripDatesText}>
                {pkg.trip_start_date && pkg.trip_end_date
                  ? `${formatTripDate(pkg.trip_start_date)} – ${formatTripDate(pkg.trip_end_date)}`
                  : pkg.trip_start_date
                    ? `From ${formatTripDate(pkg.trip_start_date)}`
                    : `To ${formatTripDate(pkg.trip_end_date)}`}
              </Text>
            </View>
          )}

          {/* Description with Read more - same as DetailsScreen */}
          <View style={styles.descriptionWrap}>
            <Text style={styles.description}>{body || "No description provided."}</Text>
            {description.length > 140 && (
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

          {/* Facilities - same section as package details */}
          <Text style={styles.sectionTitle}>Facilities</Text>
          {facilityRows.length > 0 ? (
            <View style={styles.facilityGrid}>
              {facilityRows.map((row, rowIndex) => (
                <View
                  key={`row-${rowIndex}`}
                  style={[styles.facilityRow, rowIndex === facilityRows.length - 1 && styles.facilityRowLast]}
                >
                  {row.map((facility, colIndex) => (
                    <View
                      key={facility.key}
                      style={[
                        styles.facilityCard,
                        { width: cardWidth, marginRight: colIndex < row.length - 1 ? CARD_GAP : 0 },
                      ]}
                    >
                      <View style={styles.facilityIcon}>
                        <Ionicons name={facility.icon || "checkmark-circle-outline"} size={22} color="#8b9096" />
                      </View>
                      <Text style={styles.facilityLabel} numberOfLines={2}>
                        {facility.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noFacilitiesCard}>
              <Ionicons name="list-outline" size={28} color="#d1d5db" />
              <Text style={styles.noFacilitiesText}>No facilities added</Text>
            </View>
          )}

          {/* Things to consider - custom package only */}
          {pkg.additional_notes ? (
            <>
              <Text style={styles.sectionTitle}>Things to consider</Text>
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>{pkg.additional_notes}</Text>
              </View>
            </>
          ) : null}

          {/* Status & Claimed by - custom package only */}
          <View style={styles.customMetaRow}>
            {pkg.status ? (
              <View style={[styles.statusPill, pkg.status === "claimed" && styles.statusPillClaimed, pkg.status === "cancelled" && styles.statusPillCancelled]}>
                <Text style={[styles.statusPillText, pkg.status === "claimed" && styles.statusPillTextClaimed, pkg.status === "cancelled" && styles.statusPillTextCancelled]}>
                  {String(pkg.status).charAt(0).toUpperCase() + String(pkg.status).slice(1)}
                </Text>
              </View>
            ) : null}
            {pkg.claimed_by_name ? (
              <View style={styles.claimedByRow}>
                <Ionicons name="person-circle-outline" size={16} color="#1f6b2a" />
                <Text style={styles.claimedByText}>Handled by {pkg.claimed_by_name}</Text>
              </View>
            ) : null}
          </View>

          {/* Cancel / Delete actions */}
          <View style={styles.actionsSection}>
            {canCancel && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnCancel]}
                onPress={handleCancelPackage}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                <Ionicons name="close-circle-outline" size={20} color="#b91c1c" />
                <Text style={styles.actionBtnCancelText}>Cancel package</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDelete]}
              onPress={handleDeletePackage}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={20} color="#64748b" />
              <Text style={styles.actionBtnDeleteText}>Delete package</Text>
            </TouchableOpacity>
          </View>
          {!canCancel && canCancelBase && (
            <Text style={styles.cancelInfoText}>
              You can only cancel this request up to 2 days before the trip start date.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Bottom Bar - same as package details */}
      <View style={styles.bottomBar}>
        <View style={styles.priceWrap}>
          <Text style={styles.priceLabel}>Price</Text>
          <Text style={styles.priceValue}>{formatPrice(pkg.price_per_person)}</Text>
        </View>
        <View style={styles.customRequestBadge}>
          <Ionicons name="document-text-outline" size={20} color="#1f6b2a" />
          <Text style={styles.customRequestBadgeText}>Your request</Text>
        </View>
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
    height: 300,
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
  heroPlaceholder: {
    backgroundColor: "#e2e8f0",
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
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: "#6f747a",
  },
  errorCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f1f1f",
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 15,
    color: "#6f747a",
    marginTop: 8,
    textAlign: "center",
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
    marginBottom: 6,
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
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 14,
    color: "#6f747a",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
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
    marginBottom: 20,
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
  noFacilitiesCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e5ea",
    marginBottom: 20,
  },
  noFacilitiesText: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 8,
  },
  notesCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e1e5ea",
    borderLeftWidth: 4,
    borderLeftColor: "#1f6b2a",
  },
  notesText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5f6369",
  },
  customMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  statusPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statusPillClaimed: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
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
  claimedByRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  claimedByText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f6b2a",
  },
  actionsSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 140,
  },
  actionBtnCancel: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  actionBtnCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#b91c1c",
  },
  actionBtnDelete: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  actionBtnDeleteText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  cancelInfoText: {
    marginTop: 8,
    fontSize: 12,
    color: "#9ca3af",
  },
  // Bottom Bar - same as DetailsScreen
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
  customRequestBadge: {
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
  customRequestBadgeText: {
    color: "#166534",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default CustomPackageDetailScreen;
