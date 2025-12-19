import React from "react";
import {
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

const PROFILE_IMAGE = {
  uri: "https://i.pinimg.com/564x/8b/16/7a/8b167af653c2399dd93b952a48740620.jpg",
};

const menuItems = [
  { id: "profile", label: "Profile", icon: "person-outline" },
  { id: "bookmarked", label: "Bookmarked", icon: "bookmark-outline" },
  { id: "previousTrips", label: "Previous Trips", icon: "airplane-outline" },
  { id: "settings", label: "Settings", icon: "settings-outline" },
  { id: "leaderboard", label: "LeaderBoard", icon: "trophy-outline" },
];

const ProfileScreen = ({ session, onBack = () => {}, onEdit = () => {}, onLogout = () => {} }) => {
  const displayName =
    session?.user?.first_name ||
    session?.user?.name ||
    (session?.user?.email ? session.user.email.split("@")[0] : null) ||
    "Leonardo";

  const displayEmail = session?.user?.email || "leonardo@gmail.com";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
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

        {/* Profile Information */}
        <View style={styles.profileSection}>
          <Image source={PROFILE_IMAGE} style={styles.profileImage} />
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{displayEmail}</Text>
        </View>

        {/* Statistics Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Reward Points</Text>
            <Text style={styles.statValue}>360</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Travel Trips</Text>
            <Text style={styles.statValue}>238</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Bucket List</Text>
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
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon} size={22} color="#1f1f1f" />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9aa0a6" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={onLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 20,
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
    paddingVertical: 24,
    paddingHorizontal: 18,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#f3f5f7",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f1f1f",
    marginBottom: 6,
  },
  profileEmail: {
    fontSize: 14,
    color: "#6b7076",
    fontWeight: "500",
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    marginHorizontal: 18,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3e6ea",
    paddingVertical: 20,
    paddingHorizontal: 12,
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
    fontSize: 20,
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
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f5f7",
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f1f1f",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fee2e2",
    backgroundColor: "#fef2f2",
    gap: 10,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ef4444",
  },
});

export default ProfileScreen;

