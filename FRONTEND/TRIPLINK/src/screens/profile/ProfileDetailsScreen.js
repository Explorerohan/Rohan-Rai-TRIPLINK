import React from "react";
import {
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const DEFAULT_AVATAR_URL =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const PERSONAL_FIELDS = [
  { key: "email", label: "Email", valueKey: "email", icon: "mail-outline" },
  { key: "first_name", label: "First name", valueKey: "first_name", icon: "person-outline" },
  { key: "last_name", label: "Last name", valueKey: "last_name", icon: "person-outline" },
  { key: "phone_number", label: "Phone number", valueKey: "phone_number", icon: "call-outline" },
  { key: "location", label: "Location", valueKey: "location", icon: "location-outline" },
];

const ACCOUNT_FIELDS = [
  {
    key: "member_since",
    label: "Member since",
    valueKey: "created_at",
    icon: "calendar-outline",
    format: (v) => (v ? formatDate(v) : "—"),
  },
  {
    key: "last_updated",
    label: "Last updated",
    valueKey: "updated_at",
    icon: "time-outline",
    format: (v) => (v ? formatDate(v) : "—"),
  },
];

const DetailRow = ({ icon, label, value, isLast, isEmpty }) => (
  <View style={[styles.row, isLast && styles.rowLast]}>
    <View style={styles.rowIconWrap}>
      <Ionicons name={icon} size={22} color="#1f6b2a" />
    </View>
    <View style={styles.rowContent}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, isEmpty && styles.rowValueEmpty]} numberOfLines={2}>
        {value || "—"}
      </Text>
    </View>
  </View>
);

const ProfileDetailsScreen = ({ profile = null, onBack }) => {
  const displayName =
    profile?.full_name ||
    (profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile?.first_name || profile?.last_name) ||
    (profile?.email ? profile.email.split("@")[0] : null) ||
    "User";

  const profileImageUri =
    profile?.profile_picture_url && String(profile.profile_picture_url).trim()
      ? profile.profile_picture_url
      : null;

  const getValue = (field) => {
    const raw = profile?.[field.valueKey];
    return field.format ? field.format(raw) : (raw && String(raw).trim()) || null;
  };

  const renderRows = (fields) =>
    fields.map((field, index) => {
      const value = getValue(field);
      const isEmpty = !value || value === "—";
      return (
        <DetailRow
          key={field.key}
          icon={field.icon}
          label={field.label}
          value={value}
          isLast={index === fields.length - 1}
          isEmpty={isEmpty}
        />
      );
    });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero with soft brand background */}
        <View style={styles.heroWrap}>
          <View style={styles.hero}>
            <View style={styles.avatarWrap}>
              <Image
                source={profileImageUri ? { uri: profileImageUri } : { uri: DEFAULT_AVATAR_URL }}
                style={styles.avatar}
              />
            </View>
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.heroSubtext}>Your account information</Text>
          </View>
          <View style={styles.heroAccent} />
        </View>

        {/* Personal information */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Personal information</Text>
          {renderRows(PERSONAL_FIELDS)}
        </View>

        {/* Account */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Account</Text>
          {renderRows(ACCOUNT_FIELDS)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
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
  headerRight: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 44,
  },
  heroWrap: {
    backgroundColor: "#f0f9f4",
    borderRadius: 20,
    marginBottom: 24,
    overflow: "hidden",
  },
  hero: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  avatarWrap: {
    marginBottom: 14,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: "#ffffff",
    ...Platform.select({
      ios: {
        shadowColor: "#1f6b2a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  displayName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
    textAlign: "center",
  },
  heroSubtext: {
    fontSize: 13,
    color: "#5a6b5e",
    fontWeight: "500",
  },
  heroAccent: {
    height: 4,
    backgroundColor: "#1f6b2a",
    opacity: 0.35,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e8eaed",
    overflow: "hidden",
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1f6b2a",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#f3f5f7",
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0f9f4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7076",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    lineHeight: 22,
  },
  rowValueEmpty: {
    color: "#9ca3af",
    fontStyle: "italic",
    fontWeight: "500",
  },
});

export default ProfileDetailsScreen;
