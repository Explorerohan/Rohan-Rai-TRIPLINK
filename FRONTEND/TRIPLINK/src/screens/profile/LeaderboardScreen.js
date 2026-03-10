import React, { useCallback, useEffect, useState } from "react";
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
import { getLeaderboard } from "../../utils/api";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

const RANK_COLORS = {
  1: "#1f6b2a", // Dark green
  2: "#f97316", // Orange
  3: "#0d9488", // Teal
};

const LeaderboardScreen = ({ session, onBack = () => {} }) => {
  const { t } = useLanguage();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!session?.access) {
      setList([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const { data } = await getLeaderboard(session.access);
      const arr = Array.isArray(data) ? data : [];
      setList(arr);
    } catch (err) {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData({ silent: true });
  };

  const top3 = list.slice(0, 3);
  const rest = list.slice(3);

  const getDisplayName = (item) =>
    item?.full_name ||
    (item?.first_name && item?.last_name
      ? `${item.first_name} ${item.last_name}`
      : item?.first_name || item?.last_name) ||
    (item?.email ? item.email.split("@")[0] : "Traveler");

  const getAvatarUri = (item) =>
    item?.profile_picture_url && String(item.profile_picture_url).trim()
      ? item.profile_picture_url
      : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.loadingText}>{t("loading")}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LeaderBoard</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1f6b2a"]} tintColor="#1f6b2a" />
        }
      >
        {/* Top 3 podium */}
        <View style={styles.top3Section}>
          {top3.length === 0 ? (
            <Text style={styles.emptyText}>{t("noLeaderboardEntries")}</Text>
          ) : (
            <>
              {/* Rank 2 (left) */}
              {top3[1] && (
                <View style={styles.podiumItem}>
                  <Image
                    source={{ uri: getAvatarUri(top3[1]) || DEFAULT_AVATAR }}
                    style={styles.top3Avatar}
                  />
                  <View style={[styles.top3Block, styles.top3BlockSecond, { backgroundColor: RANK_COLORS[2] }]}>
                    <Text style={styles.top3Name} numberOfLines={1}>{getDisplayName(top3[1])}</Text>
                    <Text style={styles.top3Points}>{top3[1].reward_points ?? 0} Pts</Text>
                    <Text style={styles.top3Rank}>2</Text>
                  </View>
                </View>
              )}
              {/* Rank 1 (center) */}
              {top3[0] && (
                <View style={[styles.podiumItem, styles.podiumCenter]}>
                  <Image
                    source={{ uri: getAvatarUri(top3[0]) || DEFAULT_AVATAR }}
                    style={styles.top3Avatar}
                  />
                  <View style={[styles.top3Block, styles.top3BlockCenter, { backgroundColor: RANK_COLORS[1] }]}>
                    <Text style={styles.top3Name} numberOfLines={1}>{getDisplayName(top3[0])}</Text>
                    <Text style={styles.top3Points}>{top3[0].reward_points ?? 0} Pts</Text>
                    <Text style={styles.top3Rank}>1</Text>
                  </View>
                </View>
              )}
              {/* Rank 3 (right) */}
              {top3[2] && (
                <View style={styles.podiumItem}>
                  <Image
                    source={{ uri: getAvatarUri(top3[2]) || DEFAULT_AVATAR }}
                    style={styles.top3Avatar}
                  />
                  <View style={[styles.top3Block, styles.top3BlockThird, { backgroundColor: RANK_COLORS[3] }]}>
                    <Text style={styles.top3Name} numberOfLines={1}>{getDisplayName(top3[2])}</Text>
                    <Text style={styles.top3Points}>{top3[2].reward_points ?? 0} Pts</Text>
                    <Text style={styles.top3Rank}>3</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* Rest of list */}
        <View style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>{t("leaderboard")}</Text>
            <Text style={styles.listHeaderPts}>Pts</Text>
          </View>
          {rest.length === 0 && top3.length === 0 ? (
            <Text style={styles.noEntries}>{t("noLeaderboardEntries")}</Text>
          ) : rest.length === 0 ? (
            null
          ) : (
            rest.map((item, idx) => {
              const rank = idx + 4;
              return (
                <View key={item.id ?? idx} style={styles.listRow}>
                  <View style={styles.listRankWrap}>
                    <Text style={styles.listRank}>{rank}</Text>
                  </View>
                  <Image
                    source={{ uri: getAvatarUri(item) || DEFAULT_AVATAR }}
                    style={styles.listAvatar}
                  />
                  <Text style={styles.listName} numberOfLines={1}>{getDisplayName(item)}</Text>
                  <Text style={styles.listPoints}>{item.reward_points ?? 0}</Text>
                </View>
              );
            })
          )}
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
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    position: "absolute",
    left: 18,
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7076",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  top3Section: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 8,
  },
  podiumItem: {
    flex: 1,
    alignItems: "center",
    maxWidth: 110,
  },
  podiumCenter: {
    maxWidth: 120,
  },
  top3Avatar: {
    width: 72,
    height: 72,
    borderRadius: 12,
    marginBottom: -12,
    zIndex: 1,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  top3Block: {
    width: "100%",
    paddingTop: 24,
    paddingBottom: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 90,
  },
  top3BlockCenter: {
    minHeight: 160,
  },
  top3BlockSecond: {
    minHeight: 130,
  },
  top3BlockThird: {
    minHeight: 30,
    paddingTop: 14,
    paddingBottom: 8,
    transform: [{ scaleY: 0.8 }, { scaleX: 0.9 }],
  },
  top3Name: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  top3Points: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
    opacity: 0.95,
  },
  top3Rank: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    color: "#6b7076",
  },
  listCard: {
    marginHorizontal: 18,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3e6ea",
    overflow: "hidden",
    paddingBottom: 12,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f5f7",
  },
  listHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  listHeaderPts: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7076",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  listRankWrap: {
    width: 28,
    alignItems: "center",
  },
  listRank: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  listName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1f1f1f",
  },
  listPoints: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  noEntries: {
    padding: 24,
    textAlign: "center",
    fontSize: 15,
    color: "#6b7076",
  },
});

export default LeaderboardScreen;
