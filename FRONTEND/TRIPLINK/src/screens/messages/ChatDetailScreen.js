import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
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
import {
  getChatMessages,
  sendChatMessage,
  markRoomRead,
  getWebSocketBase,
} from "../../utils/api";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDateLabel = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString();
};

/** For messages with custom_package_detail: strip "Re: [Title - Location]\n\n" from text. */
const getMessageBody = (msg) => {
  const pkg = msg?.custom_package_detail || null;
  let text = (msg?.text || "").trim();
  if (pkg && /^Re: \[.+\]\s*[\r\n]+/.test(text)) {
    text = text.replace(/^Re: \[.+\]\s*[\r\n]+/, "").trim();
  }
  return { pkg, text: text || msg?.text || "" };
};

const ChatDetailScreen = ({
  roomId,
  contactName = "Chat",
  contactAvatar = DEFAULT_AVATAR,
  otherUserId,
  session,
  isActive = true,
  onBack = () => {},
  onMarkRoomRead,
}) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const scrollRef = useRef(null);
  const wsRef = useRef(null);

  const accessToken = session?.access;

  const loadMessages = useCallback(async (showLoading = true) => {
    if (!roomId || !accessToken) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const { data } = await getChatMessages(roomId, accessToken);
      const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
      setMessages([...list].reverse());
    } catch (err) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [roomId, accessToken]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!roomId || !accessToken) return;
    markRoomRead(roomId, accessToken).then(() => onMarkRoomRead?.()).catch(() => {});
  }, [roomId, accessToken, onMarkRoomRead]);

  useEffect(() => {
    if (!roomId || !accessToken) return;

    const wsBase = getWebSocketBase();
    const url = `${wsBase}/ws/chat/${roomId}/?token=${encodeURIComponent(accessToken)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chat_message") {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === data.id || (m.id && String(m.id) === String(data.id)));
            if (exists) return prev;
            const isFromMe = data.sender_id !== otherUserId;
            const newMsg = {
              id: data.id,
              text: data.text,
              sender_id: data.sender_id,
              sender_name: data.sender_name,
              created_at: data.created_at,
            };
            if (isFromMe) {
              const withoutTemp = prev.filter((m) => !String(m.id || "").startsWith("temp-"));
              return [...withoutTemp, newMsg];
            }
            return [...prev, newMsg];
          });
        }
      } catch (_) {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomId, accessToken]);

  useEffect(() => {
    if (!roomId || !accessToken || loading) return;
    const poll = () => {
      getChatMessages(roomId, accessToken)
        .then(({ data }) => {
          const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
          const ordered = [...list].reverse();
          setMessages((prev) => {
            const tempMsgs = prev.filter((m) => String(m.id || "").startsWith("temp-"));
            return tempMsgs.length > 0 ? [...ordered, ...tempMsgs] : ordered;
          });
        })
        .catch(() => {});
    };
    poll();
    const pollInterval = setInterval(poll, 1000);
    return () => clearInterval(pollInterval);
  }, [roomId, accessToken, loading]);

  const sendMessage = async () => {
    const text = (inputText || "").trim();
    if (!text || !roomId || !accessToken) return;

    setSending(true);
    setInputText("");

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      text,
      sender_id: -1,
      sender_name: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "message", text }));
      setSending(false);
      return;
    }

    try {
      await sendChatMessage(roomId, { text }, accessToken);
      await loadMessages(false);
    } catch (_) {
      setInputText(text);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const groupedByDate = (() => {
    const map = {};
    messages.forEach((m) => {
      const label = formatDateLabel(m.created_at) || "Today";
      if (!map[label]) map[label] = [];
      map[label].push(m);
    });
    return Object.entries(map);
  })();

  const isOutgoing = (msg) => msg.sender_id !== otherUserId;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>{contactName}</Text>
          {isActive && (
            <Text style={styles.headerStatus}>
              {wsConnected ? "Active Now" : "Offline"}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8}>
          <Ionicons name="call-outline" size={22} color="#1f1f1f" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1f6b2a" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {groupedByDate.map(([dateLabel, msgs]) => (
              <React.Fragment key={dateLabel}>
                <View style={styles.dateRow}>
                  <View style={styles.dateBubble}>
                    <Text style={styles.dateText}>{dateLabel}</Text>
                  </View>
                </View>
                {msgs.map((msg) =>
                  isOutgoing(msg) ? (
                    <View key={msg.id} style={styles.msgRowRight}>
                      <View style={styles.msgBubbleRight}>
                        <Text style={styles.msgText}>{msg.text}</Text>
                        <View style={styles.msgMetaRight}>
                          <Text style={styles.msgTime}>{formatTime(msg.created_at)}</Text>
                          <Ionicons name="checkmark-done" size={16} color="#22c55e" />
                        </View>
                      </View>
                    </View>
                  ) : (
                    (() => {
                      const { pkg, text } = getMessageBody(msg);
                      const hasPkg = !!(pkg && (pkg.image_url || pkg.title));
                      return (
                        <View key={msg.id} style={styles.msgRowLeft}>
                          <Image
                            source={{ uri: contactAvatar || DEFAULT_AVATAR }}
                            style={styles.senderAvatar}
                          />
                          <View style={[styles.msgBubbleLeft, hasPkg && styles.msgBubbleLeftWithPkg]}>
                            {hasPkg && (
                              <View style={styles.msgPkgCard}>
                                {pkg.image_url ? (
                                  <Image source={{ uri: pkg.image_url }} style={styles.msgPkgImage} resizeMode="cover" />
                                ) : null}
                                <Text style={styles.msgPkgTitle} numberOfLines={2}>
                                  {pkg.title}{pkg.location ? ` – ${pkg.location}` : ""}
                                </Text>
                              </View>
                            )}
                            <Text style={[styles.msgText, hasPkg && styles.msgTextAfterPkg]}>{text}</Text>
                            <View style={styles.msgMetaLeft}>
                              <Text style={[styles.msgTime, hasPkg && styles.msgTimeInPkg]}>{formatTime(msg.created_at)}</Text>
                              <Ionicons name="checkmark-done" size={16} color={hasPkg ? "#a7f3d0" : "#22c55e"} />
                            </View>
                          </View>
                        </View>
                      );
                    })()
                  )
                )}
              </React.Fragment>
            ))}
          </ScrollView>
        )}

        <View style={styles.inputRow}>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Type your message"
              placeholderTextColor="#9aa0a6"
              value={inputText}
              onChangeText={setInputText}
              editable={!sending}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.attachBtn} activeOpacity={0.8}>
              <Ionicons name="attach" size={22} color="#7a7f85" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.micBtn}
            activeOpacity={0.8}
            onPress={sendMessage}
            disabled={sending || !inputText.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="send" size={20} color="#ffffff" />
            )}
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
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#7a7f85",
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
  msgTimeInPkg: {
    color: "rgba(255,255,255,0.85)",
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
  msgBubbleLeftWithPkg: {
    backgroundColor: "#2A733E",
    borderColor: "#2A733E",
    overflow: "hidden",
  },
  msgPkgCard: {
    marginHorizontal: -14,
    marginTop: -10,
    marginBottom: 8,
  },
  msgPkgImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#1e3a2a",
  },
  msgPkgTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    paddingTop: 6,
  },
  msgTextAfterPkg: {
    color: "#ffffff",
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
