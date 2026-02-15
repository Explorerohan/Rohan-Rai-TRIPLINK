import React from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
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

// Static mock messages for Sajib Rahman chat (chronological order)
const MOCK_MESSAGES = [
  { id: "d1", type: "date", text: "Today" },
  { id: "1", text: "Hello!", time: "9:24", isFromMe: true },
  {
    id: "2",
    text: "Thank you very mouch for your traveling, we really like the apartments. we will stay here for anather 5 days...",
    time: "9:30",
    isFromMe: true,
  },
  { id: "3", text: "Hello!", time: "9:34", isFromMe: false, avatar: DEFAULT_AVATAR },
  { id: "4", text: "I'm very glab you like it👍", time: "9:35", isFromMe: false, avatar: DEFAULT_AVATAR },
  {
    id: "5",
    text: "We are arriving today at 01:45, will someone be at home?",
    time: "9:37",
    isFromMe: false,
    avatar: DEFAULT_AVATAR,
  },
  { id: "6", text: "I will be at home", time: "9:39", isFromMe: true },
];

const ChatDetailScreen = ({
  contactName = "Sajib Rahman",
  contactAvatar = DEFAULT_AVATAR,
  isActive = true,
  onBack = () => {},
}) => {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>{contactName}</Text>
          {isActive && <Text style={styles.headerStatus}>Active Now</Text>}
        </View>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8}>
          <Ionicons name="call-outline" size={22} color="#1f1f1f" />
        </TouchableOpacity>
      </View>

      {/* Chat content */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {MOCK_MESSAGES.map((msg) => {
            if (msg.type === "date") {
              return (
                <View key={msg.id} style={styles.dateRow}>
                  <View style={styles.dateBubble}>
                    <Text style={styles.dateText}>{msg.text}</Text>
                  </View>
                </View>
              );
            }
            if (msg.isFromMe) {
              return (
                <View key={msg.id} style={styles.msgRowRight}>
                  <View style={styles.msgBubbleRight}>
                    <Text style={styles.msgText}>{msg.text}</Text>
                    <View style={styles.msgMetaRight}>
                      <Text style={styles.msgTime}>{msg.time}</Text>
                      <Ionicons name="checkmark-done" size={16} color="#22c55e" />
                    </View>
                  </View>
                </View>
              );
            }
            return (
              <View key={msg.id} style={styles.msgRowLeft}>
                <Image source={{ uri: msg.avatar || DEFAULT_AVATAR }} style={styles.senderAvatar} />
                <View style={styles.msgBubbleLeft}>
                  <Text style={styles.msgText}>{msg.text}</Text>
                  <View style={styles.msgMetaLeft}>
                    <Text style={styles.msgTime}>{msg.time}</Text>
                    <Ionicons name="checkmark-done" size={16} color="#22c55e" />
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Input area */}
        <View style={styles.inputRow}>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Type you message"
              placeholderTextColor="#9aa0a6"
              editable={false}
            />
            <TouchableOpacity style={styles.attachBtn} activeOpacity={0.8}>
              <Ionicons name="attach" size={22} color="#7a7f85" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.micBtn} activeOpacity={0.8}>
            <Ionicons name="mic" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    paddingTop: Platform.OS === "ios" ? 14 : 12,
    backgroundColor: "#ffffff",
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
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  headerStatus: {
    fontSize: 13,
    color: "#22c55e",
    marginTop: 2,
    fontWeight: "500",
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  dateRow: {
    alignItems: "center",
    marginBottom: 20,
  },
  dateBubble: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  dateText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  msgRowRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  msgBubbleRight: {
    maxWidth: "80%",
    backgroundColor: "#7dd3fc",
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 8,
    borderRadius: 16,
    borderTopRightRadius: 4,
  },
  msgText: {
    fontSize: 15,
    color: "#1f1f1f",
    lineHeight: 20,
  },
  msgMetaRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 4,
  },
  msgTime: {
    fontSize: 11,
    color: "#64748b",
  },
  msgRowLeft: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  msgBubbleLeft: {
    maxWidth: "75%",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 8,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  msgMetaLeft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 22,
    paddingLeft: 18,
    paddingRight: 8,
    height: 48,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1f1f1f",
    paddingVertical: 0,
    maxHeight: 80,
  },
  attachBtn: {
    padding: 8,
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#7dd3fc",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ChatDetailScreen;
