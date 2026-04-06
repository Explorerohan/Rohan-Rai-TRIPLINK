import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useLanguage } from "../../context/LanguageContext";
import { getNotifications, markNotificationRead } from "../../utils/api";

const NOTIFICATION_ICONS = {
  alert: { icon: "alert-circle", color: "#f59e0b" },
  emergency: { icon: "warning", color: "#dc2626" },
  rule_violation: { icon: "close-circle", color: "#b91c1c" },
  info: { icon: "information-circle", color: "#0ea5e9" },
  update: { icon: "megaphone", color: "#1f6b2a" },
  promotion: { icon: "gift", color: "#7c3aed" },
  general: { icon: "notifications", color: "#f59e0b" },
  trip_reminder_24h: { icon: "calendar", color: "#2563eb" },
  trip_reminder_1h: { icon: "airplane", color: "#1d4ed8" },
  trip_review_request: { icon: "star", color: "#ca8a04" },
};

const getNotificationIcon = (type) => NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.general;

const NotificationsScreen = ({
  session,
  onBack = () => {},
  onReadStateChange = () => {},
}) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markAllBusy, setMarkAllBusy] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(async () => {
    if (!session?.access) return;
    try {
      const { data } = await getNotifications(session.access);
      const list = Array.isArray(data) ? data : data?.results ?? [];
      setNotifications(list);
      const unread = list.filter((n) => !n?.is_read).length;
      onReadStateChange(unread);
    } catch (e) {
      console.warn("Failed to fetch notifications:", e);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access, onReadStateChange]);

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
      setNotifications((prev) => {
        const next = prev.map((n) =>
          (n.recipient_id === item.recipient_id || (n.id === item.id && !n.recipient_id))
            ? { ...n, is_read: true }
            : n
        );
        onReadStateChange(next.filter((n) => !n?.is_read).length);
        return next;
      });
    } catch (e) {
      console.warn("Failed to mark notification read:", e);
    }
  };

  const handleMarkAllRead = async () => {
    if (!session?.access || markAllBusy) return;
    const unreadItems = notifications.filter((item) => !item?.is_read);
    if (unreadItems.length === 0) return;

    setMarkAllBusy(true);
    try {
      await Promise.all(
        unreadItems.map((item) =>
          markNotificationRead(
            item.recipient_id ? { recipient_id: item.recipient_id } : { notification_id: item.id },
            session.access
          )
        )
      );
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      onReadStateChange(0);
    } catch (e) {
      console.warn("Failed to mark all notifications read:", e);
      Alert.alert("Error", "Could not mark all notifications as read.");
    } finally {
      setMarkAllBusy(false);
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
    const unread = !item.is_read;
    const titleText =
      item.title && String(item.title).trim() ? String(item.title).trim() : t("notificationDefaultTitle");
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          unread ? styles.notificationCardUnread : styles.notificationCardRead,
        ]}
        activeOpacity={0.8}
        onPress={() => handleMarkRead(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.notificationIconWrap,
                { backgroundColor: color },
                unread && styles.notificationIconWrapUnread,
              ]}
            >
              <Ionicons name={icon} size={18} color="#ffffff" />
            </View>
            <View style={styles.titleRow}>
              <Text
                style={[styles.notificationTitle, unread ? styles.notificationTitleUnread : styles.notificationTitleRead]}
                numberOfLines={2}
              >
                {titleText}
              </Text>
            </View>
          </View>
          <Text style={[styles.notificationTime, unread ? styles.notificationTimeUnread : styles.notificationTimeRead]}>
            {formatTimeAgo(item.created_at)}
          </Text>
        </View>
        <View style={[styles.cardDivider, unread ? styles.cardDividerUnread : styles.cardDividerRead]} />
        <Text style={[styles.notificationMessage, unread ? styles.notificationMessageUnread : styles.notificationMessageRead]}>
          {item.message}
        </Text>
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
          <Text style={styles.headerTitle}>{t("notifications")}</Text>
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
        <Text style={styles.headerTitle}>{t("notifications")}</Text>
        <TouchableOpacity
          style={[styles.markAllButton, markAllBusy && styles.markAllButtonDisabled]}
          onPress={handleMarkAllRead}
          disabled={markAllBusy}
        >
          <Ionicons name="checkmark-done" size={20} color="#1f6b2a" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>{t("notificationsEmptyTitle")}</Text>
            <Text style={styles.emptySubtext}>{t("notificationsEmptySubtitle")}</Text>
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
  markAllButton: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  markAllButtonDisabled: {
    opacity: 0.5,
  },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 16, paddingBottom: 32 },
  notificationCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  notificationCardUnread: {
    backgroundColor: "#ecfdf5",
    borderColor: "#6ee7b7",
    shadowColor: "#1f6b2a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  notificationCardRead: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    opacity: 0.97,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  cardHeaderLeft: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  titleRow: { flex: 1, minWidth: 0 },
  notificationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f59e0b",
    justifyContent: "center",
    alignItems: "center",
  },
  notificationIconWrapUnread: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: "#1e293b",
  },
  notificationTitleUnread: {
    fontWeight: "700",
    color: "#0f172a",
  },
  notificationTitleRead: {
    fontWeight: "500",
    color: "#64748b",
  },
  notificationTime: { fontSize: 12, flexShrink: 0 },
  notificationTimeUnread: { color: "#047857", fontWeight: "600" },
  notificationTimeRead: { color: "#94a3b8", fontWeight: "400" },
  cardDivider: { height: 1, marginVertical: 12 },
  cardDividerUnread: { backgroundColor: "#a7f3d0" },
  cardDividerRead: { backgroundColor: "#f1f5f9" },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 21,
  },
  notificationMessageUnread: {
    color: "#1e293b",
    fontWeight: "500",
  },
  notificationMessageRead: {
    color: "#64748b",
    fontWeight: "400",
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
