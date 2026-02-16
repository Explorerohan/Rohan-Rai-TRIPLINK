import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getChatRooms } from "../../utils/api";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

const NAV_ICON_SIZE = 22;

const navItems = [
  { key: "home", label: "Home", icon: "home-outline", active: false },
  { key: "calendar", label: "calendar", icon: "calendar-outline", active: false },
  { key: "messages", label: "Messages", icon: "chatbubble-ellipses-outline", active: true },
  { key: "profile", label: "Profile", icon: "person-outline", active: false },
];

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const MessagesScreen = ({
  session,
  unreadCount = 0,
  onBack = () => {},
  onHomePress = () => {},
  onCalendarPress = () => {},
  onPlusPress = () => {},
  onProfilePress = () => {},
  onChatPress = () => {},
}) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchRooms = useCallback(async (isRefresh = false) => {
    if (!session?.access) {
      setRooms([]);
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data } = await getChatRooms(session.access);
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Failed to load conversations");
      setRooms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    if (!session?.access || loading) return;
    const poll = () => {
      getChatRooms(session.access)
        .then(({ data }) => {
          const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
          setRooms(list);
        })
        .catch(() => {});
    };
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [session?.access, loading]);

  const handleChatPress = (room) => {
    const chatPayload = {
      id: room.id,
      roomId: room.id,
      name: room.other_user_name || "Unknown",
      avatar: room.other_user_avatar || DEFAULT_AVATAR,
      other_user_id: room.other_user_id,
      last_message: room.last_message,
      last_message_at: room.last_message_at,
    };
    onChatPress(chatPayload);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8}>
          <Ionicons name="ellipsis-vertical" size={22} color="#1f1f1f" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Messages</Text>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.8}>
            <Ionicons name="pencil" size={20} color="#1f1f1f" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#9aa0a6" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for chats & messages"
            placeholderTextColor="#9aa0a6"
            editable={false}
          />
        </View>

        <ScrollView
          style={styles.chatList}
          contentContainerStyle={styles.chatListContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchRooms(true)}
              colors={["#1f6b2a"]}
              tintColor="#1f6b2a"
            />
          }
        >
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#1f6b2a" />
              <Text style={styles.loadingText}>Loading conversations...</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          ) : rooms.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>Chat with agents from your bookings</Text>
            </View>
          ) : (
            rooms.map((room) => {
              const unread = room.unread_count || 0;
              const showRowBadge = unread > 0;
              return (
                <TouchableOpacity
                  key={room.id}
                  style={styles.chatRow}
                  activeOpacity={0.7}
                  onPress={() => handleChatPress(room)}
                >
                  <View style={styles.avatarWrap}>
                    <Image
                      source={{ uri: room.other_user_avatar || DEFAULT_AVATAR }}
                      style={styles.avatar}
                    />
                    {showRowBadge ? (
                      <View style={styles.rowBadge}>
                        <Text style={styles.rowBadgeText}>{unread > 99 ? "99+" : unread}</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusDot, { backgroundColor: "#22c55e" }]} />
                    )}
                  </View>
                  <View style={styles.chatBody}>
                    <View style={styles.chatTop}>
                      <Text style={[styles.chatName, showRowBadge && styles.chatNameUnread]} numberOfLines={1}>
                        {room.other_user_name || "Unknown"}
                      </Text>
                      <View style={styles.timeRow}>
                        {!showRowBadge && (
                          <Ionicons name="checkmark-done" size={18} color="#22c55e" style={styles.checkIcon} />
                        )}
                        <Text style={[styles.timeText, showRowBadge && styles.timeTextUnread]}>
                          {formatTime(room.last_message_at)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.lastMessage, showRowBadge && styles.lastMessageUnread]} numberOfLines={1}>
                      {room.last_message || "No messages yet"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

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
                onPress={item.key === "profile" ? onProfilePress : undefined}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerBtn: {
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
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f6f7f9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 18,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1f1f1f",
    padding: 0,
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    paddingBottom: 110,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#7a7f85",
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: "#94a3b8",
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  avatarWrap: {
    position: "relative",
    marginRight: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  statusDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  rowBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  rowBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  chatNameUnread: {
    fontWeight: "800",
  },
  timeTextUnread: {
    color: "#1f1f1f",
    fontWeight: "600",
  },
  lastMessageUnread: {
    color: "#1f1f1f",
    fontWeight: "600",
  },
  chatBody: {
    flex: 1,
    minWidth: 0,
  },
  chatTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  checkIcon: {
    marginRight: 2,
  },
  timeText: {
    fontSize: 13,
    color: "#7a7f85",
    fontWeight: "500",
  },
  lastMessage: {
    fontSize: 14,
    color: "#61656b",
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

export default MessagesScreen;
