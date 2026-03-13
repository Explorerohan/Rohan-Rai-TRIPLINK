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

const NOTIFICATION_ICONS = {
  alert: { icon: "alert-circle", color: "#f59e0b" },
  emergency: { icon: "warning", color: "#dc2626" },
  rule_violation: { icon: "close-circle", color: "#b91c1c" },
  info: { icon: "information-circle", color: "#0ea5e9" },
  update: { icon: "megaphone", color: "#1f6b2a" },
  promotion: { icon: "gift", color: "#7c3aed" },
  general: { icon: "notifications", color: "#f59e0b" },
};

const getNotificationIcon = (type) => NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.general;

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

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const renderItem = ({ item }) => {
    const { icon, color } = getNotificationIcon(item.notification_type);
    return (
    <TouchableOpacity
      style={[styles.notificationCard, !item.is_read && styles.notificationCardUnread]}
      activeOpacity={0.8}
      onPress={() => handleMarkRead(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.notificationIconWrap, { backgroundColor: color }]}>
            <Ionicons name={icon} size={18} color="#ffffff" />
          </View>
          <Text style={styles.notificationLabel}>Notification</Text>
        </View>
        <Text style={styles.notificationTime}>{formatTimeAgo(item.created_at)}</Text>
      </View>
      <View style={styles.cardDivider} />
      <Text style={styles.notificationMessage}>{item.message}</Text>
    </TouchableOpacity>
    );
  };

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
              You'll see updates and alerts here
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
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#1e293b" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 16, paddingBottom: 32 },
  notificationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  notificationCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  notificationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f59e0b",
    justifyContent: "center",
    alignItems: "center",
  },
  notificationLabel: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  notificationTime: { fontSize: 13, color: "#94a3b8" },
  cardDivider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 12 },
  notificationMessage: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 21,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#64748b", marginTop: 16 },
  emptySubtext: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
});

export default NotificationsScreen;
