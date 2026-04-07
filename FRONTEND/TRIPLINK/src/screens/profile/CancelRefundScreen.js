import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getMyBookings, cancelBooking } from "../../utils/api";
import { canCancelByTwoDayRule, getCalendarDaysUntilTripStart } from "../../utils/bookingCancellation";
import {
  mapBookingsToScheduleItems,
  filterUpcomingConfirmedBookings,
} from "../../utils/scheduleBookingItems";
import { useAppAlert } from "../../components/AppAlertProvider";

const CancelRefundScreen = ({
  session,
  initialBookings = null,
  onUpdateCachedBookings = () => {},
  onBack = () => {},
  onTripPress,
}) => {
  const { t } = useLanguage();
  const { showAlert, showConfirm } = useAppAlert();
  const hasInitial = Array.isArray(initialBookings) && initialBookings.length > 0;
  const [bookings, setBookings] = useState(() => (Array.isArray(initialBookings) ? initialBookings : []));
  const [loading, setLoading] = useState(!hasInitial);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const upcomingRaw = useMemo(() => filterUpcomingConfirmedBookings(bookings), [bookings]);

  const items = useMemo(
    () => mapBookingsToScheduleItems(upcomingRaw),
    [upcomingRaw]
  );

  const fetchBookings = useCallback(
    async ({ silent = false } = {}) => {
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
        onUpdateCachedBookings(arr);
      } catch (_) {
        if (!silent) setBookings([]);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [session?.access, onUpdateCachedBookings]
  );

  useEffect(() => {
    if (Array.isArray(initialBookings)) {
      setBookings(initialBookings);
      setLoading(false);
    }
  }, [initialBookings]);

  useEffect(() => {
    fetchBookings({ silent: hasInitial });
  }, [session?.access]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchBookings({ silent: true });
    } finally {
      setRefreshing(false);
    }
  };

  const handleCancelBooking = (item) => {
    const booking = item?.booking;
    if (!booking || !session?.access) return;
    if (!canCancelByTwoDayRule(item.tripStartDateRaw)) {
      showAlert({ title: t("cannotCancelBooking"), message: t("cancelBookingTwoDayRule"), type: "warning" });
      return;
    }
    showConfirm({
      title: t("cancelBookingTitle"),
      message: t("cancelBookingConfirmMessage"),
      cancelText: t("keepBooking"),
      confirmText: t("cancelBookingTitle"),
      destructive: true,
      onConfirm: async () => {
        try {
          setCancellingId(item.id);
          await cancelBooking(booking.id, session.access);
          const res = await getMyBookings(session.access);
          const list = res?.data ?? [];
          const arr = Array.isArray(list) ? list : [];
          setBookings(arr);
          onUpdateCachedBookings(arr);
          showAlert({ title: t("bookingCancelledTitle"), message: t("bookingCancelledRefundSoonBody"), type: "success" });
        } catch (err) {
          showAlert({ title: t("error"), message: err?.message || t("couldNotCancelBooking"), type: "error" });
        } finally {
          setCancellingId(null);
        }
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("cancelRefundScreenTitle")}</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1f6b2a" />}
        >
          {items.length > 0 && (
            <View style={styles.policyCard}>
              <Ionicons name="information-circle-outline" size={22} color="#1f6b2a" style={styles.policyIcon} />
              <View style={styles.policyCardTextWrap}>
                <Text style={styles.policyCardTitle}>{t("scheduleRefundPolicyTitle")}</Text>
                <Text style={styles.policyCardBody}>{t("scheduleRefundPolicyBody")}</Text>
              </View>
            </View>
          )}

          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyTitle}>{t("cancelRefundEmptyTitle")}</Text>
              <Text style={styles.emptyBody}>{t("cancelRefundEmptyBody")}</Text>
            </View>
          ) : (
            items.map((item) => {
              const isConfirmed = item.booking?.status === "confirmed";
              const daysUntilTrip = getCalendarDaysUntilTripStart(item.tripStartDateRaw);
              const canCancel = isConfirmed && canCancelByTwoDayRule(item.tripStartDateRaw);
              const showCancellationClosed =
                isConfirmed && !canCancel && Boolean(item.tripStartDateRaw);
              const showTbaCancelNote = isConfirmed && canCancel && daysUntilTrip === null;
              const isCancelled = item.booking?.status === "cancelled";
              const isCancelling = cancellingId === item.id;
              let closedDetailText = t("cancellationWindowClosedTooSoon").replace(
                "{{days}}",
                String(daysUntilTrip != null ? Math.max(0, daysUntilTrip) : 0)
              );
              if (daysUntilTrip != null) {
                if (daysUntilTrip < 0) closedDetailText = t("cancellationWindowClosedPastTrip");
                else if (daysUntilTrip === 0) closedDetailText = t("cancellationWindowClosedTripToday");
                else if (daysUntilTrip === 1) closedDetailText = t("cancellationWindowClosedTripTomorrow");
              }
              return (
                <View key={item.id} style={styles.card}>
                  <TouchableOpacity
                    style={styles.cardRow}
                    activeOpacity={0.85}
                    onPress={() => onTripPress?.(item)}
                  >
                    <View style={styles.cardImageWrap}>
                      <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardDateRow}>
                        <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
                        <Text style={styles.cardDate}>{item.date}</Text>
                      </View>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={styles.cardLocationRow}>
                        <Ionicons name="location-outline" size={13} color="#94a3b8" />
                        <Text style={styles.cardLocation} numberOfLines={1}>
                          {item.location}
                        </Text>
                      </View>
                      {isConfirmed && canCancel && (
                        <View style={styles.cancelEligiblePill}>
                          <Ionicons name="checkmark-circle" size={14} color="#166534" />
                          <Text style={styles.cancelEligiblePillText}>{t("cancellationWindowOpen")}</Text>
                        </View>
                      )}
                      {isCancelled && (
                        <Text style={styles.bookingStatusMeta}>{t("bookingStatusCancelled")}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#94a3b8" style={styles.cardArrow} />
                  </TouchableOpacity>

                  {showCancellationClosed && (
                    <View style={styles.cancelBlockedBox}>
                      <Ionicons name="lock-closed-outline" size={20} color="#b45309" />
                      <View style={styles.cancelBlockedTextWrap}>
                        <Text style={styles.cancelBlockedTitle}>{t("cancellationNotAvailableTitle")}</Text>
                        <Text style={styles.cancelBlockedText}>{closedDetailText}</Text>
                        <Text style={styles.cancelBlockedSub}>{t("cancellationContactHint")}</Text>
                      </View>
                    </View>
                  )}

                  {showTbaCancelNote && (
                    <Text style={styles.cancelTbaNote}>{t("tripDateTbaCancelNote")}</Text>
                  )}

                  {canCancel && (
                    <>
                      <TouchableOpacity
                        style={[styles.cancelBookingBtn, isCancelling && styles.cancelBookingBtnDisabled]}
                        onPress={() => handleCancelBooking(item)}
                        disabled={isCancelling}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="wallet-outline" size={18} color="#b91c1c" />
                        <Text style={styles.cancelBookingText}>
                          {isCancelling ? t("cancellingBooking") : t("cancelAndRefund")}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.cancelRefundHint}>{t("cancelRefundButtonHint")}</Text>
                    </>
                  )}
                </View>
              );
            })
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
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
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
  headerRightPlaceholder: {
    width: 40,
    height: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#64748b",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 21,
  },
  policyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  policyIcon: {
    marginTop: 2,
  },
  policyCardTextWrap: {
    flex: 1,
  },
  policyCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#14532d",
    marginBottom: 4,
  },
  policyCardBody: {
    fontSize: 12,
    color: "#166534",
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardImageWrap: {
    width: 76,
    height: 76,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
    marginRight: 12,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f1f5f9",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  cardLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardLocation: {
    fontSize: 12,
    color: "#94a3b8",
    flex: 1,
  },
  bookingStatusMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  cancelEligiblePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cancelEligiblePillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#166534",
  },
  cancelBlockedBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 10,
    padding: 12,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
  },
  cancelBlockedTextWrap: {
    flex: 1,
  },
  cancelBlockedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: 4,
  },
  cancelBlockedText: {
    fontSize: 12,
    color: "#a16207",
    lineHeight: 17,
  },
  cancelBlockedSub: {
    marginTop: 6,
    fontSize: 11,
    color: "#78716c",
  },
  cancelTbaNote: {
    marginTop: 8,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 17,
    paddingHorizontal: 2,
  },
  cancelRefundHint: {
    marginTop: 6,
    fontSize: 11,
    color: "#64748b",
    lineHeight: 16,
    paddingLeft: 4,
    paddingRight: 4,
  },
  cardArrow: {
    marginLeft: 6,
  },
  cancelBookingBtn: {
    marginTop: 10,
    marginRight: 4,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  cancelBookingBtnDisabled: {
    opacity: 0.7,
  },
  cancelBookingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#b91c1c",
  },
});

export default CancelRefundScreen;
