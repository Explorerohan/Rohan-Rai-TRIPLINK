import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getNotifications, markNotificationRead } from "../../utils/api";

const NotificationsScreen = ({
  session,
  onBack = () => {},
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(async () => {
    if (!session?.access) return;
    try {
      const { data } = await getNotifications(session.access);
      const list = Array.isArray(data) ? data : data?.results ?? [];
      setNotifications(list);
    } catch (e) {
      console.warn("Failed to fetch notifications:", e);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (item) => {
    if (item.is_read) return;
    const id = item.recipient_id ?? item.id;
    if (!id) return;
    try {
      await markNotificationRead(
        item.recipient_id ? { recipient_id: item.recipient_id } : { notification_id: item.id },
        session.access
      );
      setNotifications((prev) =>
        prev.map((n) =>
          (n.recipient_id === item.recipient_id || (n.id === item.id && !n.recipient_id))
            ? { ...n, is_read: true }
            : n
        )
      );
    } catch (e) {
      console.warn("Failed to mark notification read:", e);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.is_read && styles.notificationCardUnread]}
      activeOpacity={0.8}
      onPress={() => handleMarkRead(item)}
    >
      <View style={styles.notificationIconWrap}>
        <Ionicons
          name={item.is_read ? "mail-open-outline" : "mail-unread-outline"}
          size={24}
          color={item.is_read ? "#94a3b8" : "#1f6b2a"}
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage} numberOfLines={3}>
          {item.message}
        </Text>
        <View style={styles.notificationMeta}>
          <Text style={styles.notificationSender}>{item.sender_name || "TRIPLINK"}</Text>
          <Text style={styles.notificationDate}>
            {item.created_at
              ? new Date(item.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const keyExtractor = (item) => `${item.id}-${item.recipient_id ?? ""}`;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1f6b2a" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              You'll see updates from agents and TRIPLINK here
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1f6b2a"
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#1e293b" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 16, paddingBottom: 32 },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationCardUnread: {
    backgroundColor: "#f0fdf4",
    borderLeftWidth: 4,
    borderLeftColor: "#1f6b2a",
  },
  notificationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ecfdf5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  notificationContent: { flex: 1, minWidth: 0 },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notificationSender: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },
  notificationDate: { fontSize: 12, color: "#94a3b8" },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#64748b", marginTop: 16 },
  emptySubtext: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
});

export default NotificationsScreen;
