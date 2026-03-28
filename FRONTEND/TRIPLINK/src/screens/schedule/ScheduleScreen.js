import React, { useState, useMemo, useEffect } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getMyBookings, getPackages } from "../../utils/api";
import { PLACEHOLDER_IMAGE, mapBookingsToScheduleItems } from "../../utils/scheduleBookingItems";

const DAYS_HEADER = ["S", "M", "T", "W", "T", "F", "S"];

// Build calendar grid for a full month: 6 rows x 7 cols, with leading empty cells
const getMonthGrid = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay(); // 0 = Sunday

  const grid = [];
  // Leading empty cells
  for (let i = 0; i < startWeekday; i++) {
    grid.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(d);
  }
  // Pad to multiple of 7 for full rows (e.g. 6 rows)
  const totalCells = 42;
  while (grid.length < totalCells) {
    grid.push(null);
  }
  return grid;
};

const formatMonthYear = (date) => {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

const formatDayMonth = (date) => {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
};

const NAV_ICON_SIZE = 22;

const navItems = [
  { key: "home", label: "Home", icon: "home-outline", active: false },
  { key: "calendar", label: "Calendar", icon: "calendar-outline", active: true },
  { key: "messages", label: "Messages", icon: "chatbubble-ellipses-outline", active: false },
  { key: "profile", label: "Profile", icon: "person-outline", active: false },
];

const toDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Parse API trip_start_date (YYYY-MM-DD or ISO) to local calendar date (avoids UTC shift). */
const parseTripStartLocal = (raw) => {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const part = raw.split("T")[0];
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(part);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const day = Number(m[3]);
      return new Date(y, mo, day);
    }
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isSameCalendarDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Bookings whose trip start falls on the selected calendar day (excludes Date TBA). */
const filterScheduleItemsBySelectedDate = (items, selectedDate) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.filter((item) => {
    const trip = parseTripStartLocal(item.tripStartDateRaw);
    if (!trip) return false;
    return isSameCalendarDay(trip, selectedDate);
  });
};

const ScheduleScreen = ({
  session,
  initialBookings = null,
  onUpdateCachedBookings = () => {},
  onBack,
  onScheduleItemPress,
  onHomePress,
  onMessagesPress = () => {},
  onProfilePress,
  onTripPress,
  onPlusPress = () => {},
  unreadCount = 0,
}) => {
  const { t } = useLanguage();
  const hasInitialBookings = Array.isArray(initialBookings) && initialBookings.length > 0;
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleItems, setScheduleItems] = useState(() => (hasInitialBookings ? mapBookingsToScheduleItems(initialBookings) : []));
  const [scheduleLoading, setScheduleLoading] = useState(!hasInitialBookings);
  const [packagesOnDate, setPackagesOnDate] = useState([]);
  const [loadingPackagesOnDate, setLoadingPackagesOnDate] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthGrid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const scheduleItemsForSelectedDate = useMemo(
    () => filterScheduleItemsBySelectedDate(scheduleItems, selectedDate),
    [scheduleItems, selectedDate]
  );

  const isSelected = (dayNum) => {
    if (dayNum == null) return false;
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === dayNum
    );
  };

  const goPrevMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const selectDay = (dayNum) => {
    if (dayNum == null) return;
    setSelectedDate(new Date(year, month, dayNum));
  };

  useEffect(() => {
    const dateStr = toDateString(selectedDate);
    let cancelled = false;
    setLoadingPackagesOnDate(true);
    getPackages({ date: dateStr }, session?.access ?? null)
      .then((res) => {
        if (!cancelled && res?.data) {
          setPackagesOnDate(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) setPackagesOnDate([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPackagesOnDate(false);
      });
    return () => { cancelled = true; };
  }, [selectedDate, session?.access]);

  useEffect(() => {
    if (initialBookings && initialBookings.length > 0 && scheduleItems.length === 0) {
      setScheduleItems(mapBookingsToScheduleItems(initialBookings));
      setScheduleLoading(false);
    }
  }, [initialBookings]);

  useEffect(() => {
    if (!session?.access) {
      setScheduleLoading(false);
      setScheduleItems([]);
      return;
    }
    const fetchBookings = async () => {
      const alreadyHaveData = scheduleItems.length > 0;
      if (!alreadyHaveData) setScheduleLoading(true);
      try {
        const res = await getMyBookings(session.access);
        const list = res?.data ?? [];
        const items = Array.isArray(list) && list.length > 0 ? mapBookingsToScheduleItems(list) : [];
        setScheduleItems(items);
        onUpdateCachedBookings(Array.isArray(list) ? list : []);
      } catch (e) {
        console.warn("Schedule: could not load bookings", e);
        if (!alreadyHaveData) setScheduleItems([]);
      } finally {
        setScheduleLoading(false);
      }
    };
    fetchBookings();
  }, [session?.access]);

  const isSelectedInViewMonth =
    selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
  const displayMonthLabel = isSelectedInViewMonth
    ? formatDayMonth(selectedDate)
    : formatMonthYear(viewDate);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("schedule")}</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Calendar block */}
        <View style={styles.calendarBlock}>
          <View style={styles.calendarRow}>
            <Text style={styles.monthLabel}>{displayMonthLabel}</Text>
            <View style={styles.arrowWrap}>
              <TouchableOpacity onPress={goPrevMonth} style={styles.arrowBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={18} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={goNextMonth} style={styles.arrowBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Day names */}
          <View style={styles.daysRow}>
            {DAYS_HEADER.map((day, i) => (
              <Text key={i} style={styles.dayName}>
                {day}
              </Text>
            ))}
          </View>

          {/* Full month grid */}
          <View style={styles.grid}>
            {monthGrid.map((dayNum, index) => {
              const selected = isSelected(dayNum);
              const col = index % 7;
              const dayLabel = DAYS_HEADER[col];
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.cell, selected && styles.cellSelected]}
                  onPress={() => selectDay(dayNum)}
                  activeOpacity={0.7}
                  disabled={dayNum == null}
                >
                  {dayNum != null ? (
                    <>
                      <Text style={[styles.cellDayName, selected && styles.cellDayNameSelected]}>
                        {dayLabel}
                      </Text>
                      <Text style={[styles.cellNum, selected && styles.cellNumSelected]}>{dayNum}</Text>
                    </>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Trips on selected date */}
        <View style={styles.tripsOnDateSection}>
          <Text style={styles.tripsOnDateTitle}>
            Trips on {formatDayMonth(selectedDate)}
          </Text>
          {loadingPackagesOnDate ? (
            <View style={styles.scheduleEmpty}>
              <Text style={styles.scheduleEmptyText}>Checking trips…</Text>
            </View>
          ) : packagesOnDate.length === 0 ? (
            <View style={styles.scheduleEmpty}>
              <Text style={styles.scheduleEmptyText}>No trips on this date.</Text>
            </View>
          ) : (
            packagesOnDate.map((pkg) => {
              const dateStr = pkg.trip_start_date
                ? new Date(pkg.trip_start_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : "—";
              const locationStr = pkg.location && pkg.country ? `${pkg.location}, ${pkg.country}` : pkg.location || "—";
              return (
                <TouchableOpacity
                  key={pkg.id}
                  style={styles.card}
                  activeOpacity={0.85}
                  onPress={() => onTripPress?.(pkg)}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.cardImageWrap}>
                      <Image
                        source={{ uri: pkg.main_image_url || PLACEHOLDER_IMAGE }}
                        style={styles.cardImage}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardDateRow}>
                        <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
                        <Text style={styles.cardDate}>{dateStr}</Text>
                      </View>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {pkg.title}
                      </Text>
                      <View style={styles.cardLocationRow}>
                        <Ionicons name="location-outline" size={13} color="#94a3b8" />
                        <Text style={styles.cardLocation} numberOfLines={1}>
                          {locationStr}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#94a3b8" style={styles.cardArrow} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* My Schedule — only bookings whose trip starts on the selected calendar day */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleBlock}>
              <Text style={styles.sectionTitle}>{t("mySchedule")}</Text>
              <Text style={styles.sectionDateHint}>{formatDayMonth(selectedDate)}</Text>
            </View>
          </View>

          {!scheduleLoading && scheduleItemsForSelectedDate.length > 0 && (
            <Text style={styles.scheduleSectionHint}>{t("scheduleCancelRefundMovedHint")}</Text>
          )}

          {scheduleLoading ? (
            <View style={styles.scheduleEmpty}>
              <Text style={styles.scheduleEmptyText}>Loading your bookings…</Text>
            </View>
          ) : scheduleItems.length === 0 ? (
            <View style={styles.scheduleEmpty}>
              <Ionicons name="calendar-outline" size={40} color="#94a3b8" style={{ marginBottom: 8 }} />
              <Text style={styles.scheduleEmptyText}>
                {session?.access ? "No booked packages yet. Book a trip from Home to see it here." : "Log in to see your booked packages."}
              </Text>
            </View>
          ) : scheduleItemsForSelectedDate.length === 0 ? (
            <View style={styles.scheduleEmpty}>
              <Ionicons name="calendar-outline" size={40} color="#94a3b8" style={{ marginBottom: 8 }} />
              <Text style={styles.scheduleEmptyText}>{t("noBookingsForDate")}</Text>
            </View>
          ) : (
            scheduleItemsForSelectedDate.map((item) => {
              const isCancelled = item.booking?.status === "cancelled";
              return (
                <View key={item.id} style={styles.card}>
                  <TouchableOpacity
                    style={styles.cardRow}
                    activeOpacity={0.85}
                    onPress={() => onScheduleItemPress?.(item)}
                  >
                    <View style={styles.cardImageWrap}>
                      <Image
                        source={{ uri: item.image }}
                        style={styles.cardImage}
                        resizeMode="cover"
                      />
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
                      {isCancelled && (
                        <Text style={styles.bookingStatusMeta}>{t("bookingStatusCancelled")}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#94a3b8" style={styles.cardArrow} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
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
                onPress={item.key === "home" ? onHomePress : undefined}
              >
                <Ionicons name={item.icon} size={NAV_ICON_SIZE} color={color} />
                <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>{t(item.key)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={onPlusPress}>
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
                <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>{t(item.key)}</Text>
              </TouchableOpacity>
            );
          })}
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
    paddingBottom: 100,
  },
  calendarBlock: {
    marginTop: 12,
    marginBottom: 0,
  },
  calendarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  monthLabel: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
  },
  arrowWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 4,
  },
  arrowBtn: {
    padding: 6,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  dayName: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
  },
  cell: {
    width: "14.28%",
    aspectRatio: 1,
    maxWidth: 48,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    marginTop: 0,
    marginBottom: 0,
  },
  cellSelected: {
    backgroundColor: "#1f6b2a",
  },
  cellDayName: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 2,
  },
  cellDayNameSelected: {
    color: "#ffffff",
  },
  cellNum: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
  },
  cellNumSelected: {
    color: "#ffffff",
  },
  tripsOnDateSection: {
    marginTop: -12,
    marginBottom: 0,
  },
  tripsOnDateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitleBlock: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },
  sectionDateHint: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
    marginTop: 4,
  },
  scheduleSectionHint: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 17,
    marginBottom: 12,
    marginTop: -4,
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
  cardArrow: {
    marginLeft: 6,
  },
  scheduleEmpty: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleEmptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
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

export default ScheduleScreen;
