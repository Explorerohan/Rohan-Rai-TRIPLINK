import React from "react";
import {
  Image,
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

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

const NAV_ICON_SIZE = 22;

const navItems = [
  { key: "home", label: "Home", icon: "home-outline", active: false },
  { key: "calendar", label: "calendar", icon: "calendar-outline", active: false },
  { key: "messages", label: "Messages", icon: "chatbubble-ellipses-outline", active: true },
  { key: "profile", label: "Profile", icon: "person-outline", active: false },
];

// Static mock chat list matching the sample design
const MOCK_CHATS = [
  {
    id: "1",
    name: "Sajib Rahman",
    lastMessage: "Hi, John! 👋 How are you doing?",
    time: "09:46",
    isFromMe: false,
    isTyping: false,
    isRead: false,
    avatar: DEFAULT_AVATAR,
    statusColor: "#facc15",
  },
  {
    id: "2",
    name: "Adom Shafi",
    lastMessage: "Typing...",
    time: "08:42",
    isFromMe: false,
    isTyping: true,
    isRead: false,
    avatar: DEFAULT_AVATAR,
    statusColor: "#94a3b8",
  },
  {
    id: "3",
    name: "HR Rumen",
    lastMessage: "You: Cool! 🤩 Let's meet at 18:00 near the traveling!",
    time: "Yesterday",
    isFromMe: true,
    isTyping: false,
    isRead: false,
    avatar: DEFAULT_AVATAR,
    statusColor: "#22c55e",
  },
  {
    id: "4",
    name: "Anjelina",
    lastMessage: "You: Hey, will you come to the party on Saturday?",
    time: "07:56",
    isFromMe: true,
    isTyping: false,
    isRead: false,
    avatar: DEFAULT_AVATAR,
    statusColor: "#ef4444",
  },
  {
    id: "5",
    name: "Alexa Shorna",
    lastMessage: "Thank you for coming! Your or...",
    time: "05:52",
    isFromMe: false,
    isTyping: false,
    isRead: true,
    avatar: DEFAULT_AVATAR,
    statusColor: "#22c55e",
  },
];

const MessagesScreen = ({
  onBack = () => {},
  onHomePress = () => {},
  onCalendarPress = () => {},
  onPlusPress = () => {},
  onProfilePress = () => {},
  onChatPress = () => {},
}) => {
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
        {/* Section title + edit */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Messages</Text>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.8}>
            <Ionicons name="pencil" size={20} color="#1f1f1f" />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#9aa0a6" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for chats & messages"
            placeholderTextColor="#9aa0a6"
            editable={false}
          />
        </View>

        {/* Chat list */}
        <ScrollView
          style={styles.chatList}
          contentContainerStyle={styles.chatListContent}
          showsVerticalScrollIndicator={false}
        >
          {MOCK_CHATS.map((chat) => (
            <TouchableOpacity
              key={chat.id}
              style={styles.chatRow}
              activeOpacity={0.7}
              onPress={() => onChatPress(chat)}
            >
              <View style={styles.avatarWrap}>
                <Image source={{ uri: chat.avatar }} style={styles.avatar} />
                <View style={[styles.statusDot, { backgroundColor: chat.statusColor }]} />
              </View>
              <View style={styles.chatBody}>
                <View style={styles.chatTop}>
                  <Text style={styles.chatName} numberOfLines={1}>
                    {chat.name}
                  </Text>
                  <View style={styles.timeRow}>
                    {chat.isRead ? (
                      <Ionicons name="checkmark-done" size={18} color="#22c55e" style={styles.checkIcon} />
                    ) : (
                      <Ionicons name="checkmark" size={18} color="#22c55e" style={styles.checkIcon} />
                    )}
                    <Text style={styles.timeText}>{chat.time}</Text>
                  </View>
                </View>
                <Text
                  style={[styles.lastMessage, chat.isTyping && styles.typingText]}
                  numberOfLines={1}
                >
                  {chat.lastMessage}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bottom nav bar */}
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
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.navItem}
                activeOpacity={0.85}
                onPress={item.key === "profile" ? onProfilePress : undefined}
              >
                <Ionicons name={item.icon} size={NAV_ICON_SIZE} color={color} />
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
  typingText: {
    color: "#3b82f6",
    fontWeight: "500",
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

export default MessagesScreen;
