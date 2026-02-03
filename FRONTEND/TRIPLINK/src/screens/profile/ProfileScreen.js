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
import { getProfile } from "../../utils/api";

const NAV_ICON_SIZE = 22;

const DEFAULT_AVATAR_URL =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

const navItems = [
  { key: "home", label: "Home", icon: "home-outline", active: false },
  { key: "calendar", label: "Calendar", icon: "calendar-outline", active: false },
  { key: "messages", label: "Messages", icon: "chatbubble-ellipses-outline", active: false },
  { key: "profile", label: "Profile", icon: "person-outline", active: true },
];

const menuItems = [
  { id: "profile", label: "Profile", icon: "person-outline" },
  { id: "bookmarked", label: "Bookmarked", icon: "bookmark-outline" },
  { id: "previousTrips", label: "Previous Trips", icon: "airplane-outline" },
  { id: "settings", label: "Settings", icon: "settings-outline" },
  { id: "leaderboard", label: "LeaderBoard", icon: "trophy-outline" },
  { id: "logout", label: "Logout", icon: "log-out-outline" },
];

const ProfileScreen = ({
  session,
  initialProfile = null,
  onUpdateCachedProfile = () => {},
  onBack = () => {},
  onEdit = () => {},
  onLogout = () => {},
  onCalendarPress = () => {},
}) => {
  const hasInitial = initialProfile != null;
  const [profile, setProfile] = useState(() => initialProfile);
  const [loading, setLoading] = useState(!hasInitial);

  useEffect(() => {
    if (initialProfile != null && profile == null) {
      setProfile(initialProfile);
      setLoading(false);
    }
  }, [initialProfile]);

  useEffect(() => {
    fetchProfile();
  }, [session]);

  const fetchProfile = async () => {
    if (!session?.access) {
      setLoading(false);
      return;
    }
    try {
      const response = await getProfile(session.access);
      const data = response?.data ?? {};
      setProfile(data);
      onUpdateCachedProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
      if (!profile) setProfile({});
    } finally {
      setLoading(false);
    }
  };

  const displayName =
    profile?.full_name ||
    (profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile?.first_name || profile?.last_name) ||
    (session?.user?.email ? session.user.email.split("@")[0] : null) ||
    "User";

  // Only use user's image when they have set one; otherwise show default
  const profileImageUri =
    profile?.profile_picture_url && String(profile.profile_picture_url).trim()
      ? profile.profile_picture_url
      : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.contentContainer}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.8}
            onPress={onBack}
          >
            <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.editButton}
            activeOpacity={0.8}
            onPress={onEdit}
          >
            <Ionicons name="pencil" size={20} color="#1f6b2a" />
          </TouchableOpacity>
        </View>

        {/* Profile Information - First name & Last name only */}
        <View style={styles.profileSection}>
          <Image
            source={
              profileImageUri ? { uri: profileImageUri } : { uri: DEFAULT_AVATAR_URL }
            }
            style={styles.profileImage}
          />
          <Text style={styles.profileName}>{displayName}</Text>
        </View>

        {/* Statistics Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Reward Points</Text>
            <Text style={styles.statValue}>360</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Past Trips</Text>
            <Text style={styles.statValue}>238</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Upcoming Trips</Text>
            <Text style={styles.statValue}>473</Text>
          </View>
        </View>

        {/* Navigation List */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 && styles.menuItemLast,
              ]}
              activeOpacity={0.7}
              onPress={item.id === "logout" ? onLogout : undefined}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons
                  name={item.icon}
                  size={23}
                  color={item.id === "logout" ? "#ef4444" : "#1f1f1f"}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    item.id === "logout" && styles.menuItemTextLogout,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
              {item.id !== "logout" && (
                <Ionicons name="chevron-forward" size={21} color="#9aa0a6" />
              )}
            </TouchableOpacity>
          ))}
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
                  onPress={item.key === "home" ? onBack : item.key === "calendar" ? onCalendarPress : undefined}
                >
                  <Ionicons name={item.icon} size={NAV_ICON_SIZE} color={color} />
                  <Text
                    style={[styles.navLabel, item.active && styles.navLabelActive]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.fab} activeOpacity={0.9}>
            <Ionicons name="add" size={26} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.navSide}>
            {navItems.slice(2).map((item) => {
              const color = item.active ? "#1f6b2a" : "#7a7f85";
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.navItem}
                  activeOpacity={0.85}
                >
                  <Ionicons name={item.icon} size={NAV_ICON_SIZE} color={color} />
                  <Text
                    style={[styles.navLabel, item.active && styles.navLabelActive]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
  contentContainer: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 110,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
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
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  profileSection: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 18,
  },
  profileImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#f3f5f7",
  },
  profileName: {
    fontSize: 22,
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
  detailsCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 18,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3e6ea",
    padding: 18,
  },
  detailItem: {
    marginBottom: 16,
  },
  detailItemLast: {
    marginBottom: 0,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6b7076",
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    color: "#1f1f1f",
    fontWeight: "500",
    lineHeight: 22,
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    marginHorizontal: 18,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3e6ea",
    paddingVertical: 23,
    paddingHorizontal: 13,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#e3e6ea",
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 13,
    color: "#6b7076",
    fontWeight: "600",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 21,
    fontWeight: "800",
    color: "#1f6b2a",
  },
  menuSection: {
    marginHorizontal: 18,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3e6ea",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 17,
    paddingHorizontal: 19,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f5f7",
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f1f1f",
  },
  menuItemTextLogout: {
    color: "#ef4444",
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

export default ProfileScreen;

