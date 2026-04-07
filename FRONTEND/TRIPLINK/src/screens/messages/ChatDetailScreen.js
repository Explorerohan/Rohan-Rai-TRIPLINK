import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
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
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  getChatMessages,
  sendChatMessage,
  sendChatMessageMultipart,
  markRoomRead,
  getWebSocketBase,
  getChatItinerary,
  createChatItineraryItem,
  updateChatItineraryItem,
  deleteChatItineraryItem,
  createChatItineraryTrip,
  sendChatItineraryTrip,
  getChatItineraryPdfUrl,
} from "../../utils/api";
import { useAppAlert } from "../../components/AppAlertProvider";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDateLabel = (iso, t) => {
  if (!iso || !t) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return t("today");
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return t("yesterday");
  return d.toLocaleDateString();
};

const DEFAULT_ITINERARY_TIME_LABEL = "9:00 AM";

/** Parse stored time_label into a Date (defaults to 9:00 today). */
const parseTimeLabelToDate = (label) => {
  const trimmed = (label || "").trim();
  const d = new Date();
  d.setSeconds(0, 0);
  if (!trimmed) {
    d.setHours(9, 0, 0, 0);
    return d;
  }
  const m12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let hh = parseInt(m12[1], 10);
    const mm = parseInt(m12[2], 10);
    const ap = m12[3].toUpperCase();
    if (ap === "PM" && hh !== 12) hh += 12;
    if (ap === "AM" && hh === 12) hh = 0;
    d.setHours(hh, mm, 0, 0);
    return d;
  }
  const m24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    d.setHours(parseInt(m24[1], 10), parseInt(m24[2], 10), 0, 0);
    return d;
  }
  d.setHours(9, 0, 0, 0);
  return d;
};

const formatTimeLabelFromDate = (date) => {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return DEFAULT_ITINERARY_TIME_LABEL;
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const mm = String(m).padStart(2, "0");
  return `${h12}:${mm} ${period}`;
};

/** Strip "Re: [Title - Location]\n\n" from text (e.g. agent reply about a custom package). Works even when the package was deleted. */
const getMessageBody = (msg) => {
  const pkg = msg?.custom_package_detail || null;
  let text = (msg?.text || "").trim();
  if (/^Re: \[.+\]\s*[\r\n]+/.test(text)) {
    text = text.replace(/^Re: \[.+\]\s*[\r\n]+/, "").trim();
  }
  return {
    pkg,
    text: text || msg?.text || "",
    attachmentUrl: msg?.attachment_url,
    attachmentName: msg?.attachment_name,
  };
};

const attachmentKindFromMeta = (url, name) => {
  const pickExt = (s) => {
    if (!s || typeof s !== "string") return "";
    const base = s.split("?")[0];
    const i = base.lastIndexOf(".");
    return i >= 0 ? base.slice(i + 1).toLowerCase() : "";
  };
  const ext = pickExt(name) || pickExt(url);
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "file";
};

const isBrandedItineraryPdf = (displayText, fileName) => {
  const t = (displayText || "").toLowerCase();
  const n = (fileName || "").toLowerCase();
  return t.includes("itinerary") || n.includes("itinerary");
};

/** Generic file row (non-itinerary PDFs and other types). */
const GenericFileAttachment = ({ url, fileLabel, variant, t }) => {
  const isDark = variant === "incomingDark";
  const isOutgoing = variant === "outgoing";
  const open = () => {
    if (url) Linking.openURL(url);
  };
  return (
    <TouchableOpacity
      style={[
        styles.pdfAttachCard,
        isOutgoing && styles.pdfAttachCardOutgoing,
        variant === "incoming" && styles.pdfAttachCardIncoming,
        isDark && styles.pdfAttachCardIncomingDark,
      ]}
      onPress={open}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${fileLabel}. ${t("chatAttachmentTapToOpen")}`}
    >
      <View style={[styles.pdfAttachIconWrap, isDark && styles.pdfAttachIconWrapDark]}>
        <Ionicons name="document-attach" size={22} color={isDark ? "#fecaca" : "#b91c1c"} />
      </View>
      <View style={styles.pdfAttachTextCol}>
        <Text style={[styles.pdfAttachTitle, isDark && styles.pdfAttachTitleDark]} numberOfLines={2}>
          {fileLabel}
        </Text>
        <Text style={[styles.pdfAttachSub, isDark && styles.pdfAttachSubDark]} numberOfLines={1}>
          {t("chatAttachmentTapToOpen")}
        </Text>
      </View>
      <View style={[styles.pdfAttachAction, isDark && styles.pdfAttachActionDark]}>
        <Ionicons name="open-outline" size={20} color={isDark ? "#ffffff" : "#1f6b2a"} />
      </View>
    </TouchableOpacity>
  );
};

const CHAT_IMAGE_CELL = 72;
/** Space between thumbnails; white grid background in gutters so bubble color never shows through. */
const CHAT_IMAGE_GAP = 6;

/** Square thumbnails (cover); full image opens in lightbox on press. Bubble shrink-wraps to grid width. */
const ChatImageThumbGrid = ({ urls, variant, onImagePress }) => {
  const outgoing = variant === "outgoing" || variant === "incomingDark";

  return (
    <View
      style={[
        styles.chatImageGrid,
        outgoing ? styles.chatImageGridOutgoing : styles.chatImageGridIncoming,
      ]}
    >
      {urls.map((url, idx) => (
        <TouchableOpacity
          key={`${url}-${idx}`}
          activeOpacity={0.88}
          onPress={() => onImagePress?.(url)}
          accessibilityRole="button"
          accessibilityLabel="Open image"
          style={[styles.chatImageGridCell, { width: CHAT_IMAGE_CELL, height: CHAT_IMAGE_CELL }]}
        >
          <Image source={{ uri: url }} style={styles.chatImageGridCellImg} resizeMode="cover" />
        </TouchableOpacity>
      ))}
    </View>
  );
};

function hasPackageCard(msg) {
  const pkg = msg?.custom_package_detail;
  return !!(pkg && (pkg.image_url || pkg.title));
}

/** Group consecutive image messages from the same sender with matching caption (batch uploads). */
function clusterChatMessages(msgs, isOutgoingFn) {
  const clusters = [];
  let i = 0;
  const MAX_GAP_MS = 20000;

  while (i < msgs.length) {
    const msg = msgs[i];
    if (hasPackageCard(msg)) {
      clusters.push({ type: "single", msg });
      i++;
      continue;
    }

    const out = isOutgoingFn(msg);
    const body = getMessageBody(msg);
    const url = body.attachmentUrl;
    const name = body.attachmentName;
    const isImg = url && attachmentKindFromMeta(url, name) === "image";

    if (!isImg) {
      clusters.push({ type: "single", msg });
      i++;
      continue;
    }

    const textKey = (body.text || "").trim();
    const group = [msg];
    let j = i + 1;
    while (j < msgs.length) {
      const next = msgs[j];
      if (hasPackageCard(next)) break;
      if (isOutgoingFn(next) !== out) break;
      const b2 = getMessageBody(next);
      const u2 = b2.attachmentUrl;
      const n2 = b2.attachmentName;
      if (!u2 || attachmentKindFromMeta(u2, n2) !== "image") break;
      if ((b2.text || "").trim() !== textKey) break;
      const prevTime = new Date(group[group.length - 1].created_at).getTime();
      const nextTime = new Date(next.created_at).getTime();
      if (nextTime - prevTime > MAX_GAP_MS) break;
      group.push(next);
      j++;
    }

    clusters.push({ type: "image_group", messages: group, outgoing: out });
    i = j;
  }
  return clusters;
}

/** Renders image, itinerary PDF card, or generic file row. */
const ChatAttachmentBlock = ({ url, name, variant, t, displayText, hasContentAbove, onImagePress }) => {
  const kind = attachmentKindFromMeta(url, name);
  if (kind === "image" && url) {
    return (
      <View
        style={[
          variant === "outgoing" ? styles.chatAttachImageWrapOutgoing : styles.chatAttachImageWrapIncoming,
          hasContentAbove ? styles.chatAttachImageWrapAfterContent : styles.chatAttachImageWrapBleedTB,
        ]}
      >
        <ChatImageThumbGrid urls={[url]} variant={variant} onImagePress={onImagePress} />
      </View>
    );
  }
  if (kind === "pdf" && isBrandedItineraryPdf(displayText, name)) {
    return <ItineraryPdfAttachment url={url} variant={variant} t={t} />;
  }
  if (kind === "pdf") {
    return (
      <GenericFileAttachment
        url={url}
        fileLabel={name || "document.pdf"}
        variant={variant}
        t={t}
      />
    );
  }
  return (
    <GenericFileAttachment
      url={url}
      fileLabel={name || t("chatAttachmentFile")}
      variant={variant}
      t={t}
    />
  );
};

/** Inline card for itinerary PDF links in chat (traveler + agent bubbles). */
const ItineraryPdfAttachment = ({ url, variant, t }) => {
  const isDark = variant === "incomingDark";
  const isOutgoing = variant === "outgoing";
  const open = () => {
    if (url) Linking.openURL(url);
  };
  return (
    <TouchableOpacity
      style={[
        styles.pdfAttachCard,
        isOutgoing && styles.pdfAttachCardOutgoing,
        variant === "incoming" && styles.pdfAttachCardIncoming,
        isDark && styles.pdfAttachCardIncomingDark,
      ]}
      onPress={open}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${t("itineraryPdfTitle")}. ${t("itineraryPdfSubtitle")}`}
    >
      <View style={[styles.pdfAttachIconWrap, isDark && styles.pdfAttachIconWrapDark]}>
        <Ionicons name="document-text" size={22} color={isDark ? "#fecaca" : "#b91c1c"} />
      </View>
      <View style={styles.pdfAttachTextCol}>
        <Text style={[styles.pdfAttachTitle, isDark && styles.pdfAttachTitleDark]} numberOfLines={1}>
          {t("itineraryPdfTitle")}
        </Text>
        <Text style={[styles.pdfAttachSub, isDark && styles.pdfAttachSubDark]} numberOfLines={2}>
          {t("itineraryPdfSubtitle")}
        </Text>
      </View>
      <View style={[styles.pdfAttachAction, isDark && styles.pdfAttachActionDark]}>
        <Ionicons name="download-outline" size={20} color={isDark ? "#ffffff" : "#1f6b2a"} />
      </View>
    </TouchableOpacity>
  );
};

const buildItineraryTemplate = (item) => {
  const timeText = (item?.time_label || "").trim();
  const placeText = (item?.place || "").trim();
  const activityText = (item?.activity || "").trim();
  const foodText = (item?.food_name || "").trim();
  const dayText = (item?.day_label || "").trim();
  const dateText = (item?.travel_date || "").trim();
  const heading = [dayText, dateText].filter(Boolean).join(" - ");
  const intro = heading ? `Itinerary update (${heading})` : "Itinerary update";
  const main = placeText
    ? `At ${timeText}, we will visit ${placeText} for ${activityText}.`
    : `At ${timeText}: ${activityText}.`;
  const food = foodText ? ` Food plan: ${foodText}.` : "";
  return `${intro}\n${main}${food}`;
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
  onPackagePress,
}) => {
  const { t } = useLanguage();
  const { showAlert, showConfirm, showOptions } = useAppAlert();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [itinerary, setItinerary] = useState([]);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [showItineraryModal, setShowItineraryModal] = useState(false);
  const [itineraryWizardStep, setItineraryWizardStep] = useState(0);
  const [itineraryWizardData, setItineraryWizardData] = useState({
    startDate: "",
    daysCount: 1,
    nightsCount: 0,
    itemsBySlot: [],
    tripId: null,
    currentSlot: 0,
  });
  const [editingItineraryId, setEditingItineraryId] = useState(null);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [imageLightboxUri, setImageLightboxUri] = useState(null);
  const [itineraryForm, setItineraryForm] = useState({
    time_label: DEFAULT_ITINERARY_TIME_LABEL,
    activity: "",
  });
  const [itineraryTimePickerVisible, setItineraryTimePickerVisible] = useState(false);
  const scrollRef = useRef(null);
  const wsRef = useRef(null);

  const accessToken = session?.access;
  const isAgent = session?.user?.role === "agent";

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

  const loadItinerary = useCallback(async () => {
    if (!roomId || !accessToken) return;
    setItineraryLoading(true);
    try {
      const { data } = await getChatItinerary(roomId, accessToken);
      const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
      setItinerary(list);
    } catch (_) {
      setItinerary([]);
    } finally {
      setItineraryLoading(false);
    }
  }, [roomId, accessToken]);

  useEffect(() => {
    loadMessages();
    loadItinerary();
  }, [loadMessages, loadItinerary]);

  useEffect(() => {
    if (!showItineraryModal) setItineraryTimePickerVisible(false);
  }, [showItineraryModal]);

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
            const isFromMe =
              otherUserId != null && otherUserId !== ""
                ? Number(data.sender_id) !== Number(otherUserId)
                : true;
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
  }, [roomId, accessToken, otherUserId]);

  useEffect(() => {
    if (!roomId || !accessToken || loading) return;
    const poll = () => {
      getChatMessages(roomId, accessToken)
        .then(({ data }) => {
          const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
          const ordered = [...list].reverse();
          setMessages((prev) => {
            const tempMsgs = prev.filter((m) => String(m.id || "").startsWith("temp-"));
            if (tempMsgs.length === 0) return ordered;
            const oid = otherUserId != null ? Number(otherUserId) : null;
            const stillPending = tempMsgs.filter((t) => {
              const matched = ordered.some((o) => {
                if (String(o.text || "").trim() !== String(t.text || "").trim()) return false;
                if (oid == null || Number.isNaN(oid)) return false;
                return Number(o.sender_id) !== oid;
              });
              return !matched;
            });
            return stillPending.length > 0 ? [...ordered, ...stillPending] : ordered;
          });
        })
        .catch(() => {});
      getChatItinerary(roomId, accessToken)
        .then(({ data }) => {
          const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
          setItinerary(list);
        })
        .catch(() => {});
    };
    poll();
    const pollInterval = setInterval(poll, 1000);
    return () => clearInterval(pollInterval);
  }, [roomId, accessToken, loading, otherUserId]);

  const uploadChatAttachment = useCallback(
    async (uri, filename, mimeType) => {
      if (!roomId || !accessToken) return;
      setSending(true);
      try {
        const formData = new FormData();
        formData.append("text", (inputText || "").trim());
        formData.append("attachment", {
          uri,
          name: filename || "file",
          type: mimeType || "application/octet-stream",
        });
        await sendChatMessageMultipart(roomId, formData, accessToken);
        setInputText("");
        await loadMessages(false);
      } catch (err) {
        showAlert({ title: t("error"), message: err?.message || t("chatAttachmentUploadFailed"), type: "error" });
      } finally {
        setSending(false);
      }
    },
    [roomId, accessToken, inputText, loadMessages, t, showAlert]
  );

  /** Up to 10 images per request (`attachments` field); same caption on each message server-side. */
  const uploadChatImagesBatch = useCallback(
    async (assets) => {
      if (!roomId || !accessToken || !assets?.length) return;
      setSending(true);
      try {
        const formData = new FormData();
        formData.append("text", (inputText || "").trim());
        assets.slice(0, 10).forEach((a, i) => {
          formData.append("attachments", {
            uri: a.uri,
            name: a.fileName || `photo_${i + 1}.jpg`,
            type: a.mimeType || "image/jpeg",
          });
        });
        await sendChatMessageMultipart(roomId, formData, accessToken);
        setInputText("");
        await loadMessages(false);
      } catch (err) {
        showAlert({ title: t("error"), message: err?.message || t("chatAttachmentUploadFailed"), type: "error" });
      } finally {
        setSending(false);
      }
    },
    [roomId, accessToken, inputText, loadMessages, t, showAlert]
  );

  const pickImageFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert({ title: t("error"), message: t("chatMediaLibraryPermission"), type: "warning" });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;
    await uploadChatImagesBatch(result.assets);
  }, [uploadChatImagesBatch, t, showAlert]);

  const pickFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showAlert({ title: t("error"), message: t("chatCameraPermission"), type: "warning" });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    await uploadChatImagesBatch([a]);
  }, [uploadChatImagesBatch, t, showAlert]);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    await uploadChatAttachment(a.uri, a.name || "file", a.mimeType || "application/octet-stream");
  }, [uploadChatAttachment]);

  const openAttachMenu = useCallback(() => {
    if (sending || !roomId || !accessToken) return;
    showOptions({
      title: t("chatAttachTitle"),
      options: [
        { label: t("chatAttachPhotoLibrary"), onPress: () => pickImageFromLibrary() },
        { label: t("chatAttachCamera"), onPress: () => pickFromCamera() },
        { label: t("chatAttachDocument"), onPress: () => pickDocument() },
        { label: t("cancel"), variant: "cancel" },
      ],
    });
  }, [sending, roomId, accessToken, t, pickImageFromLibrary, pickFromCamera, pickDocument, showOptions]);

  const sendMessage = async (messageOverride = null) => {
    const baseText = messageOverride !== null && messageOverride !== undefined ? messageOverride : inputText;
    const text = (baseText || "").trim();
    if (!text || !roomId || !accessToken) return;

    setSending(true);
    if (messageOverride == null) {
      setInputText("");
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      text,
      sender_id: -1,
      sender_name: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // Always persist via REST so sending works even when Channels/WebSocket delivery fails in dev.
    // WebSocket remains for receiving other participants' messages in real time.
    try {
      await sendChatMessage(roomId, { text }, accessToken);
      await loadMessages(false);
    } catch (err) {
      if (messageOverride == null) {
        setInputText(text);
      }
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      showAlert({ title: t("error"), message: err?.message || "Failed to send message", type: "error" });
    } finally {
      setSending(false);
    }
  };

  const groupedByDate = (() => {
    const map = {};
    messages.forEach((m) => {
      const label = formatDateLabel(m.created_at, t) || t("today");
      if (!map[label]) map[label] = [];
      map[label].push(m);
    });
    return Object.entries(map);
  })();
  const itineraryByDate = itinerary.reduce((acc, item) => {
    const key = item.travel_date || "No date";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const itineraryGroups = Object.entries(itineraryByDate);

  const isOutgoing = (msg) => {
    if (otherUserId == null || otherUserId === "") {
      return String(msg.id || "").startsWith("temp-") || msg.sender_id === -1;
    }
    return Number(msg.sender_id) !== Number(otherUserId);
  };

  const slotLabels = (days, nights) => {
    const labels = [];
    for (let i = 0; i < days + nights; i++) {
      const d = Math.floor(i / 2) + 1;
      labels.push(i % 2 === 0 ? `Day ${d}` : `Night ${d}`);
    }
    return labels;
  };

  const resetItineraryForm = () => {
    setEditingItineraryId(null);
    setItineraryWizardStep(0);
    setItineraryWizardData({ startDate: "", daysCount: 1, nightsCount: 0, itemsBySlot: [], tripId: null, currentSlot: 0 });
    setItineraryForm({ time_label: DEFAULT_ITINERARY_TIME_LABEL, activity: "" });
  };

  const openNewItineraryModal = () => {
    resetItineraryForm();
    setItineraryWizardStep(0);
    const today = new Date().toISOString().slice(0, 10);
    setItineraryWizardData((p) => ({ ...p, startDate: today }));
    setShowItineraryModal(true);
  };

  const openEditItineraryModal = (item) => {
    setEditingItineraryId(item.id);
    setItineraryWizardStep(1);
    setItineraryWizardData((p) => ({ ...p, currentSlot: 0 }));
    setItineraryForm({
      time_label: (item.time_label || "").trim() || DEFAULT_ITINERARY_TIME_LABEL,
      activity: item.activity || "",
    });
    setShowItineraryModal(true);
  };

  const itineraryStep0Next = () => {
    const days = Math.max(1, parseInt(String(itineraryWizardData.daysCount), 10) || 1);
    const nights = Math.max(0, parseInt(String(itineraryWizardData.nightsCount), 10) || 0);
    if (!itineraryWizardData.startDate) {
      showAlert({ title: "Missing date", message: "Please select a start date.", type: "warning" });
      return;
    }
    const slots = days + nights;
    const itemsBySlot = Array.from({ length: slots }, () => []);
    setItineraryWizardData((p) => ({
      ...p,
      daysCount: days,
      nightsCount: nights,
      currentSlot: 0,
      itemsBySlot,
    }));
    setItineraryWizardStep(1);
    setItineraryForm({ time_label: DEFAULT_ITINERARY_TIME_LABEL, activity: "" });
  };

  const itineraryAddEntry = () => {
    const time = (itineraryForm.time_label || "").trim();
    const activity = (itineraryForm.activity || "").trim();
    if (!time || !activity) {
      showAlert({ title: "Missing details", message: "Please fill time and activity.", type: "warning" });
      return;
    }
    const { daysCount, nightsCount, currentSlot, itemsBySlot } = itineraryWizardData;
    const arr = itemsBySlot[currentSlot] || [];
    if (arr.length >= 24) {
      showAlert({ title: "Limit reached", message: "Maximum 24 entries per day or night.", type: "warning" });
      return;
    }
    const labels = slotLabels(daysCount, nightsCount);
    const newEntry = {
      day_number: Math.floor(currentSlot / 2) + 1,
      is_night: currentSlot % 2 === 1,
      day_label: labels[currentSlot],
      time_label: time,
      place: "",
      activity,
      food_name: "",
      notes: "",
    };
    const newItemsBySlot = [...itemsBySlot];
    newItemsBySlot[currentSlot] = [...(newItemsBySlot[currentSlot] || []), newEntry];
    setItineraryWizardData((p) => ({ ...p, itemsBySlot: newItemsBySlot }));
    setItineraryForm({ time_label: DEFAULT_ITINERARY_TIME_LABEL, activity: "" });
  };

  const itineraryFormNext = async () => {
    const { daysCount, nightsCount, currentSlot, itemsBySlot } = itineraryWizardData;
    const labels = slotLabels(daysCount, nightsCount);
    if (currentSlot + 1 >= labels.length) {
      const flat = (itemsBySlot || []).flat();
      setSavingItinerary(true);
      try {
        const { data } = await createChatItineraryTrip(
          roomId,
          {
            start_date: itineraryWizardData.startDate,
            days_count: daysCount,
            nights_count: nightsCount,
            items: flat,
          },
          accessToken
        );
        setItineraryWizardData((p) => ({ ...p, tripId: data.id }));
        setItineraryWizardStep(2);
        await loadItinerary();
      } catch (err) {
        showAlert({ title: "Couldn't save itinerary", message: err?.message || "Could not create itinerary.", type: "error" });
      } finally {
        setSavingItinerary(false);
      }
      return;
    }
    setItineraryWizardData((p) => ({ ...p, currentSlot: currentSlot + 1 }));
    setItineraryForm({ time_label: DEFAULT_ITINERARY_TIME_LABEL, activity: "" });
  };

  const itineraryFormBack = () => {
    const { currentSlot } = itineraryWizardData;
    if (currentSlot <= 0) {
      setItineraryWizardStep(0);
      return;
    }
    setItineraryWizardData((p) => ({ ...p, currentSlot: currentSlot - 1 }));
    setItineraryForm({ time_label: DEFAULT_ITINERARY_TIME_LABEL, activity: "" });
  };

  const onItineraryTimePickerChange = (event, date) => {
    if (Platform.OS === "android") {
      setItineraryTimePickerVisible(false);
    }
    if (event?.type === "dismissed") {
      setItineraryTimePickerVisible(false);
      return;
    }
    if (date) {
      setItineraryForm((p) => ({ ...p, time_label: formatTimeLabelFromDate(date) }));
    }
  };

  const itineraryCheckPdf = () => {
    const tripId = itineraryWizardData.tripId;
    if (!tripId) return;
    const url = getChatItineraryPdfUrl(roomId, tripId, accessToken);
    Linking.openURL(url);
  };

  const itinerarySend = async () => {
    const tripId = itineraryWizardData.tripId;
    if (!tripId) return;
    setSavingItinerary(true);
    try {
      await sendChatItineraryTrip(roomId, tripId, accessToken);
      setShowItineraryModal(false);
      resetItineraryForm();
      await loadMessages(false);
    } catch (err) {
      showAlert({ title: "Couldn't send", message: err?.message || "Could not send itinerary.", type: "error" });
    } finally {
      setSavingItinerary(false);
    }
  };

  const submitItineraryEdit = async () => {
    if (!editingItineraryId) return;
    const payload = {
      time_label: itineraryForm.time_label.trim(),
      activity: itineraryForm.activity.trim(),
    };
    if (!payload.time_label || !payload.activity) {
      showAlert({ title: "Missing details", message: "Please fill time and activity.", type: "warning" });
      return;
    }
    setSavingItinerary(true);
    try {
      await updateChatItineraryItem(roomId, editingItineraryId, payload, accessToken);
      setShowItineraryModal(false);
      resetItineraryForm();
      await loadItinerary();
    } catch (err) {
      showAlert({ title: "Couldn't update", message: err?.message || "Could not update.", type: "error" });
    } finally {
      setSavingItinerary(false);
    }
  };

  const removeItineraryItem = (itemId) => {
    showConfirm({
      title: "Delete item?",
      message: "This itinerary entry will be removed.",
      cancelText: "Cancel",
      confirmText: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteChatItineraryItem(roomId, itemId, accessToken);
          await loadItinerary();
        } catch (err) {
          showAlert({ title: "Couldn't delete", message: err?.message || "Please try again.", type: "error" });
        }
      },
    });
  };

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
              {wsConnected ? t("activeNow") : t("offline")}
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
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            <View style={styles.itinerarySection}>
              <View style={styles.itineraryHeaderRow}>
                <Text style={styles.itineraryTitle}>Day-by-day itinerary</Text>
                {isAgent && (
                  <TouchableOpacity style={styles.itineraryCreateBtn} onPress={openNewItineraryModal} activeOpacity={0.8}>
                    <Ionicons name="add" size={16} color="#ffffff" />
                    <Text style={styles.itineraryCreateBtnText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
              {itineraryLoading ? (
                <ActivityIndicator size="small" color="#1f6b2a" />
              ) : itineraryGroups.length === 0 ? (
                <Text style={styles.itineraryEmpty}>No itinerary items yet.</Text>
              ) : (
                itineraryGroups.map(([dateKey, items]) => (
                  <View key={dateKey} style={styles.itineraryDateGroup}>
                    <Text style={styles.itineraryDateLabel}>{dateKey}</Text>
                    {items.map((item) => (
                      <View key={item.id} style={styles.itineraryCard}>
                        <View style={styles.itineraryCardTop}>
                          <Text style={styles.itineraryCardTime}>{item.time_label}</Text>
                          {!!item.day_label && <Text style={styles.itineraryCardDay}>{item.day_label}</Text>}
                        </View>
                        <Text style={styles.itineraryCardMain}>
                          {(item.place || "").trim() ? `${item.place} — ${item.activity}` : item.activity}
                        </Text>
                        {!!item.food_name && <Text style={styles.itineraryCardSub}>Food: {item.food_name}</Text>}
                        {!!item.notes && <Text style={styles.itineraryCardSub}>Note: {item.notes}</Text>}
                        {isAgent && (
                          <View style={styles.itineraryActions}>
                            <TouchableOpacity onPress={() => openEditItineraryModal(item)} activeOpacity={0.8}>
                              <Text style={styles.itineraryActionText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeItineraryItem(item.id)} activeOpacity={0.8}>
                              <Text style={[styles.itineraryActionText, styles.itineraryDeleteText]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ))
              )}
            </View>
            {groupedByDate.map(([dateLabel, msgs]) => (
              <React.Fragment key={dateLabel}>
                <View style={styles.dateRow}>
                  <View style={styles.dateBubble}>
                    <Text style={styles.dateText}>{dateLabel}</Text>
                  </View>
                </View>
                {clusterChatMessages(msgs, isOutgoing).map((cluster) => {
                  if (cluster.type === "image_group") {
                    const { messages, outgoing } = cluster;
                    const first = messages[0];
                    const last = messages[messages.length - 1];
                    const { text: bodyText, pkg } = getMessageBody(first);
                    const showText = !!(bodyText && String(bodyText).trim());
                    const urls = messages
                      .map((m) => getMessageBody(m).attachmentUrl)
                      .filter(Boolean);
                    const clusterKey = messages.map((m) => m.id).join("-");
                    if (outgoing) {
                      return (
                        <View key={clusterKey} style={styles.msgRowRight}>
                          <View style={[styles.msgBubbleRight, !showText && styles.msgBubbleImageOnly]}>
                            {showText ? <Text style={styles.msgText}>{bodyText}</Text> : null}
                            <View style={styles.msgImageWithMetaColOutgoing}>
                              <View
                                style={[
                                  styles.chatImageGridWrap,
                                  showText ? styles.chatImageGridWrapAfterText : styles.chatImageGridWrapFlush,
                                ]}
                              >
                                <ChatImageThumbGrid
                                  urls={urls}
                                  variant="outgoing"
                                  onImagePress={setImageLightboxUri}
                                />
                              </View>
                              <View style={[styles.msgMetaRight, styles.msgMetaBelowImage, !showText && styles.msgMetaInsetH]}>
                                <Text style={styles.msgTime}>{formatTime(last.created_at)}</Text>
                                <Ionicons name="checkmark-done" size={16} color="#22c55e" />
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    }
                    const hasPkg = !!(pkg && (pkg.image_url || pkg.title));
                    const BubbleWrapper = hasPkg && pkg?.id && onPackagePress ? TouchableOpacity : View;
                    const bubbleProps = hasPkg && pkg?.id && onPackagePress
                      ? { activeOpacity: 0.85, onPress: () => onPackagePress(pkg.id) }
                      : {};
                    const variant = hasPkg ? "incomingDark" : "incoming";
                    return (
                      <View key={clusterKey} style={styles.msgRowLeft}>
                        <Image
                          source={{ uri: contactAvatar || DEFAULT_AVATAR }}
                          style={styles.senderAvatar}
                        />
                        <BubbleWrapper
                          style={[
                            styles.msgBubbleLeft,
                            hasPkg && styles.msgBubbleLeftWithPkg,
                            !showText && !hasPkg && styles.msgBubbleImageOnly,
                          ]}
                          {...bubbleProps}
                        >
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
                          {showText ? (
                            <Text style={[styles.msgText, hasPkg && styles.msgTextAfterPkg]}>{bodyText}</Text>
                          ) : null}
                          <View style={styles.msgImageWithMetaColIncoming}>
                            <View
                              style={[
                                styles.chatImageGridWrap,
                                showText || hasPkg ? styles.chatImageGridWrapAfterText : styles.chatImageGridWrapFlush,
                              ]}
                            >
                              <ChatImageThumbGrid
                                urls={urls}
                                variant={variant}
                                onImagePress={setImageLightboxUri}
                              />
                            </View>
                            <View style={[styles.msgMetaLeft, styles.msgMetaBelowImage, !showText && !hasPkg && styles.msgMetaInsetH]}>
                              <Text style={[styles.msgTime, hasPkg && styles.msgTimeInPkg]}>
                                {formatTime(last.created_at)}
                              </Text>
                              <Ionicons name="checkmark-done" size={16} color={hasPkg ? "#a7f3d0" : "#22c55e"} />
                            </View>
                          </View>
                        </BubbleWrapper>
                      </View>
                    );
                  }
                  const msg = cluster.msg;
                  return isOutgoing(msg) ? (() => {
                    const { text: bodyText, attachmentUrl, attachmentName } = getMessageBody(msg);
                    const showText = !!(bodyText && String(bodyText).trim());
                    const isImageAttach =
                      !!(attachmentUrl && attachmentKindFromMeta(attachmentUrl, attachmentName) === "image");
                    return (
                      <View key={msg.id} style={styles.msgRowRight}>
                        <View style={styles.msgBubbleRight}>
                          {showText ? <Text style={styles.msgText}>{bodyText}</Text> : null}
                          {attachmentUrl && isImageAttach ? (
                            <View style={styles.msgImageWithMetaColOutgoing}>
                              <ChatAttachmentBlock
                                url={attachmentUrl}
                                name={attachmentName}
                                variant="outgoing"
                                t={t}
                                displayText={bodyText}
                                hasContentAbove={showText}
                                onImagePress={setImageLightboxUri}
                              />
                              <View style={[styles.msgMetaRight, styles.msgMetaBelowImage]}>
                                <Text style={styles.msgTime}>{formatTime(msg.created_at)}</Text>
                                <Ionicons name="checkmark-done" size={16} color="#22c55e" />
                              </View>
                            </View>
                          ) : (
                            <>
                              {attachmentUrl ? (
                                <ChatAttachmentBlock
                                  url={attachmentUrl}
                                  name={attachmentName}
                                  variant="outgoing"
                                  t={t}
                                  displayText={bodyText}
                                  hasContentAbove={showText}
                                  onImagePress={setImageLightboxUri}
                                />
                              ) : null}
                              <View style={styles.msgMetaRight}>
                                <Text style={styles.msgTime}>{formatTime(msg.created_at)}</Text>
                                <Ionicons name="checkmark-done" size={16} color="#22c55e" />
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })() : (
                    (() => {
                      const { pkg, text, attachmentUrl, attachmentName } = getMessageBody(msg);
                      const hasPkg = !!(pkg && (pkg.image_url || pkg.title));
                      const BubbleWrapper = hasPkg && pkg?.id && onPackagePress ? TouchableOpacity : View;
                      const bubbleProps = hasPkg && pkg?.id && onPackagePress
                        ? { activeOpacity: 0.85, onPress: () => onPackagePress(pkg.id) }
                        : {};
                      const showText = !!(text && String(text).trim());
                      const isImageAttach =
                        !!(attachmentUrl && attachmentKindFromMeta(attachmentUrl, attachmentName) === "image");
                      return (
                        <View key={msg.id} style={styles.msgRowLeft}>
                          <Image
                            source={{ uri: contactAvatar || DEFAULT_AVATAR }}
                            style={styles.senderAvatar}
                          />
                          <BubbleWrapper
                            style={[styles.msgBubbleLeft, hasPkg && styles.msgBubbleLeftWithPkg]}
                            {...bubbleProps}
                          >
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
                            {showText ? (
                              <Text style={[styles.msgText, hasPkg && styles.msgTextAfterPkg]}>{text}</Text>
                            ) : null}
                            {attachmentUrl && isImageAttach ? (
                              <View style={styles.msgImageWithMetaColIncoming}>
                                <ChatAttachmentBlock
                                  url={attachmentUrl}
                                  name={attachmentName}
                                  variant={hasPkg ? "incomingDark" : "incoming"}
                                  t={t}
                                  displayText={text}
                                  hasContentAbove={showText || hasPkg}
                                  onImagePress={setImageLightboxUri}
                                />
                                <View style={[styles.msgMetaLeft, styles.msgMetaBelowImage]}>
                                  <Text style={[styles.msgTime, hasPkg && styles.msgTimeInPkg]}>{formatTime(msg.created_at)}</Text>
                                  <Ionicons name="checkmark-done" size={16} color={hasPkg ? "#a7f3d0" : "#22c55e"} />
                                </View>
                              </View>
                            ) : (
                              <>
                                {attachmentUrl ? (
                                  <ChatAttachmentBlock
                                    url={attachmentUrl}
                                    name={attachmentName}
                                    variant={hasPkg ? "incomingDark" : "incoming"}
                                    t={t}
                                    displayText={text}
                                    hasContentAbove={showText || hasPkg}
                                    onImagePress={setImageLightboxUri}
                                  />
                                ) : null}
                                <View style={styles.msgMetaLeft}>
                                  <Text style={[styles.msgTime, hasPkg && styles.msgTimeInPkg]}>{formatTime(msg.created_at)}</Text>
                                  <Ionicons name="checkmark-done" size={16} color={hasPkg ? "#a7f3d0" : "#22c55e"} />
                                </View>
                              </>
                            )}
                          </BubbleWrapper>
                        </View>
                      );
                    })()
                  );
                })}
              </React.Fragment>
            ))}
          </ScrollView>
        )}

        <View style={styles.inputRow} pointerEvents="box-none">
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder={t("typeMessage")}
              placeholderTextColor="#9aa0a6"
              value={inputText}
              onChangeText={setInputText}
              editable={!sending}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={styles.attachBtn}
              activeOpacity={0.8}
              onPress={openAttachMenu}
              disabled={sending || !roomId || !accessToken}
              accessibilityLabel={t("chatAttachTitle")}
            >
              <Ionicons name="attach" size={22} color={sending || !accessToken ? "#cbd5e1" : "#7a7f85"} />
            </TouchableOpacity>
          </View>
          {isAgent && (
            <TouchableOpacity
              style={styles.itineraryBtn}
              activeOpacity={0.8}
              onPress={openNewItineraryModal}
              disabled={sending}
            >
              <Ionicons name="calendar-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.micBtn}
            activeOpacity={0.75}
            onPress={() => sendMessage()}
            disabled={sending || !inputText.trim()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="send" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={showItineraryModal} transparent animationType="slide" onRequestClose={() => { setShowItineraryModal(false); resetItineraryForm(); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {editingItineraryId ? (
              <>
                <View style={styles.modalHead}>
                  <Text style={styles.modalTitle}>Edit itinerary item</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalFieldLabel}>Time</Text>
                  {Platform.OS === "web" ? (
                    <TextInput
                      style={styles.modalInput}
                      value={itineraryForm.time_label}
                      onChangeText={(v) => setItineraryForm((p) => ({ ...p, time_label: v }))}
                      placeholder="9:00 AM"
                    />
                  ) : (
                    <TouchableOpacity
                      style={[styles.modalInput, styles.modalTimeRow]}
                      onPress={() => setItineraryTimePickerVisible(true)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel="Select time"
                    >
                      <Text style={styles.modalTimeText}>{itineraryForm.time_label}</Text>
                      <Ionicons name="time-outline" size={22} color="#475569" />
                    </TouchableOpacity>
                  )}
                  <TextInput style={styles.modalInput} placeholder="Activity" value={itineraryForm.activity} onChangeText={(v) => setItineraryForm((p) => ({ ...p, activity: v }))} />
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn]} onPress={() => { setShowItineraryModal(false); resetItineraryForm(); }}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalSaveBtn]} onPress={submitItineraryEdit} disabled={savingItinerary}>
                    {savingItinerary ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.modalSaveText}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : itineraryWizardStep === 0 ? (
              <>
                <View style={styles.modalHead}>
                  <Text style={styles.modalTitle}>Create itinerary</Text>
                  <Text style={styles.itineraryStepLabel}>Select trip start date and duration</Text>
                </View>
                <Text style={styles.modalFieldLabel}>Start date</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="YYYY-MM-DD"
                  value={itineraryWizardData.startDate}
                  onChangeText={(v) => setItineraryWizardData((p) => ({ ...p, startDate: v }))}
                />
                <View style={styles.itineraryDurationRow}>
                  <View style={styles.modalFieldHalf}>
                    <Text style={styles.modalFieldLabel}>Days</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="1"
                      keyboardType="number-pad"
                      value={String(itineraryWizardData.daysCount)}
                      onChangeText={(v) => setItineraryWizardData((p) => ({ ...p, daysCount: parseInt(v, 10) || 1 }))}
                    />
                  </View>
                  <View style={styles.modalFieldHalf}>
                    <Text style={styles.modalFieldLabel}>Nights</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0"
                      keyboardType="number-pad"
                      value={String(itineraryWizardData.nightsCount)}
                      onChangeText={(v) => setItineraryWizardData((p) => ({ ...p, nightsCount: parseInt(v, 10) || 0 }))}
                    />
                  </View>
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn]} onPress={() => { setShowItineraryModal(false); resetItineraryForm(); }}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalSaveBtn]} onPress={itineraryStep0Next}>
                    <Text style={styles.modalSaveText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : itineraryWizardStep === 1 ? (
              <>
                <View style={styles.modalHead}>
                  <Text style={styles.modalTitle}>
                    Add itinerary for {slotLabels(itineraryWizardData.daysCount, itineraryWizardData.nightsCount)[itineraryWizardData.currentSlot]}
                  </Text>
                  <Text style={styles.itineraryStepLabel}>
                    {(itineraryWizardData.itemsBySlot?.[itineraryWizardData.currentSlot]?.length || 0)} entries (up to 24)
                  </Text>
                </View>
                <ScrollView style={styles.itineraryChipScroll} showsVerticalScrollIndicator={false}>
                  {(itineraryWizardData.itemsBySlot?.[itineraryWizardData.currentSlot] || []).map((e, i) => (
                    <View key={i} style={styles.itineraryChip}>
                      <Text style={styles.itineraryChipText} numberOfLines={1}>{e.time_label} – {e.activity}</Text>
                    </View>
                  ))}
                </ScrollView>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalFieldLabel}>Time</Text>
                  {Platform.OS === "web" ? (
                    <TextInput
                      style={styles.modalInput}
                      value={itineraryForm.time_label}
                      onChangeText={(v) => setItineraryForm((p) => ({ ...p, time_label: v }))}
                      placeholder="9:00 AM"
                    />
                  ) : (
                    <TouchableOpacity
                      style={[styles.modalInput, styles.modalTimeRow]}
                      onPress={() => setItineraryTimePickerVisible(true)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel="Select time"
                    >
                      <Text style={styles.modalTimeText}>{itineraryForm.time_label}</Text>
                      <Ionicons name="time-outline" size={22} color="#475569" />
                    </TouchableOpacity>
                  )}
                  <TextInput style={styles.modalInput} placeholder="Activity" value={itineraryForm.activity} onChangeText={(v) => setItineraryForm((p) => ({ ...p, activity: v }))} />
                </ScrollView>
                <View style={[styles.modalActions, styles.modalActionsForm]}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn, styles.modalBtnBack]} onPress={itineraryFormBack}>
                    <Text style={styles.modalCancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalSecondaryBtn]} onPress={itineraryAddEntry}>
                    <Text style={styles.modalSecondaryText}>Add entry</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalSaveBtn]} onPress={itineraryFormNext} disabled={savingItinerary}>
                    {savingItinerary ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.modalSaveText}>Next</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.modalHead}>
                  <Text style={styles.modalTitle}>Itinerary ready</Text>
                  <Text style={styles.itineraryStepLabel}>Preview the PDF or send it to the traveler</Text>
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn]} onPress={() => { setShowItineraryModal(false); resetItineraryForm(); }}>
                    <Text style={styles.modalCancelText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalOutlineBtn]} onPress={itineraryCheckPdf}>
                    <Text style={styles.modalOutlineText}>Preview PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalSaveBtn]} onPress={itinerarySend} disabled={savingItinerary}>
                    {savingItinerary ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.modalSaveText}>Send</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
          {itineraryTimePickerVisible && (editingItineraryId || itineraryWizardStep === 1) && Platform.OS === "ios" ? (
            <Modal
              visible={itineraryTimePickerVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setItineraryTimePickerVisible(false)}
            >
              <View style={styles.itineraryTimePickerBackdrop}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setItineraryTimePickerVisible(false)} />
                <View style={styles.itineraryTimePickerSheet}>
                  <View style={styles.itineraryTimePickerBar}>
                    <TouchableOpacity
                      onPress={() => setItineraryTimePickerVisible(false)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityRole="button"
                      accessibilityLabel="Done"
                    >
                      <Text style={styles.itineraryTimePickerDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={parseTimeLabelToDate(itineraryForm.time_label)}
                    mode="time"
                    display="spinner"
                    themeVariant="light"
                    onChange={(_, d) => {
                      if (d) setItineraryForm((p) => ({ ...p, time_label: formatTimeLabelFromDate(d) }));
                    }}
                  />
                </View>
              </View>
            </Modal>
          ) : null}
          {itineraryTimePickerVisible && (editingItineraryId || itineraryWizardStep === 1) && Platform.OS === "android" ? (
            <DateTimePicker
              value={parseTimeLabelToDate(itineraryForm.time_label)}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={onItineraryTimePickerChange}
            />
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={!!imageLightboxUri}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setImageLightboxUri(null)}
      >
        <View style={styles.imageLightboxRoot}>
          <Pressable
            style={styles.imageLightboxBackdrop}
            onPress={() => setImageLightboxUri(null)}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
          />
          <View style={styles.imageLightboxCenter} pointerEvents="box-none">
            {imageLightboxUri ? (
              <Image
                key={imageLightboxUri}
                source={{ uri: imageLightboxUri }}
                style={{
                  width: Dimensions.get("window").width - 32,
                  height: Dimensions.get("window").height * 0.86,
                }}
                resizeMode="contain"
              />
            ) : null}
          </View>
          <Pressable
            style={[
              styles.imageLightboxClose,
              {
                top:
                  Platform.OS === "ios"
                    ? 52
                    : (StatusBar.currentHeight || 0) + 8,
              },
            ]}
            onPress={() => setImageLightboxUri(null)}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close-circle" size={40} color="#ffffff" />
          </Pressable>
        </View>
      </Modal>
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
  itinerarySection: {
    marginBottom: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
  },
  itineraryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itineraryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  itineraryCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1f6b2a",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  itineraryCreateBtnText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 12,
  },
  itineraryEmpty: {
    color: "#64748b",
    fontSize: 13,
  },
  itineraryDateGroup: {
    marginTop: 6,
  },
  itineraryDateLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
    marginBottom: 6,
  },
  itineraryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    marginBottom: 8,
  },
  itineraryCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itineraryCardTime: {
    fontSize: 12,
    color: "#0369a1",
    fontWeight: "700",
  },
  itineraryCardDay: {
    fontSize: 12,
    color: "#334155",
  },
  itineraryCardMain: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  itineraryCardSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#475569",
  },
  itineraryActions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 16,
  },
  itineraryActionText: {
    color: "#0ea5e9",
    fontWeight: "600",
    fontSize: 12,
  },
  itineraryDeleteText: {
    color: "#ef4444",
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
    alignSelf: "flex-end",
    backgroundColor: "#7dd3fc",
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 8,
    borderRadius: 16,
    borderTopRightRadius: 4,
    overflow: "hidden",
    borderWidth: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderColor: "transparent",
  },
  /** Image-only bubble: flush thumbnails on every side (no inner padding). */
  msgBubbleImageOnly: {
    padding: 0,
  },
  chatAttachImageWrapOutgoing: {
    marginHorizontal: -14,
  },
  chatAttachImageWrapIncoming: {
    marginHorizontal: -14,
  },
  /** Image is the only content: bleed to bubble top; meta sits in column below (no negative bottom). */
  chatAttachImageWrapBleedTB: {
    marginTop: -10,
    marginBottom: 0,
  },
  /** Image below text or package card. */
  chatAttachImageWrapAfterContent: {
    marginTop: 8,
    marginBottom: 0,
  },
  /** Incoming: full width of bubble for image + meta. */
  msgImageWithMetaColIncoming: {
    width: "100%",
    alignSelf: "stretch",
  },
  /** Outgoing: shrink to thumbnails + meta (no empty strip). */
  msgImageWithMetaColOutgoing: {
    alignSelf: "flex-end",
    maxWidth: "100%",
  },
  chatImageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CHAT_IMAGE_GAP,
    maxWidth: CHAT_IMAGE_CELL * 3 + CHAT_IMAGE_GAP * 2,
    backgroundColor: "#ffffff",
  },
  chatImageGridOutgoing: {
    alignSelf: "flex-end",
  },
  chatImageGridIncoming: {
    alignSelf: "flex-start",
  },
  chatImageGridCell: {
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    borderWidth: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderColor: "transparent",
    elevation: 0,
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
  },
  chatImageGridCellImg: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
  },
  chatImageGridWrap: {
    marginHorizontal: -14,
  },
  /** No side/top/bottom offset — used with msgBubbleImageOnly. */
  chatImageGridWrapFlush: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  chatImageGridWrapBleed: {
    marginTop: -10,
  },
  chatImageGridWrapAfterText: {
    marginTop: 8,
  },
  msgMetaInsetH: {
    paddingHorizontal: 14,
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
  msgMetaBelowImage: {
    marginTop: 6,
    marginBottom: 0,
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
    overflow: "hidden",
    borderWidth: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderColor: "transparent",
  },
  msgBubbleLeftWithPkg: {
    backgroundColor: "#2A733E",
    borderWidth: 0,
    borderColor: "transparent",
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
  pdfAttachCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
  },
  pdfAttachCardOutgoing: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  pdfAttachCardIncoming: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pdfAttachCardIncomingDark: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  pdfAttachIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(185,28,28,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  pdfAttachIconWrapDark: {
    backgroundColor: "rgba(254,202,202,0.2)",
  },
  pdfAttachTextCol: {
    flex: 1,
    minWidth: 0,
  },
  pdfAttachTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  pdfAttachTitleDark: {
    color: "#ffffff",
  },
  pdfAttachSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    lineHeight: 16,
  },
  pdfAttachSubDark: {
    color: "rgba(255,255,255,0.82)",
  },
  pdfAttachAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(31,107,42,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  pdfAttachActionDark: {
    backgroundColor: "rgba(255,255,255,0.2)",
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
    zIndex: 2,
    elevation: 8,
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
  itineraryBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1f6b2a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  imageLightboxRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
  },
  imageLightboxBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imageLightboxCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  imageLightboxClose: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: "#e8ecf1",
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    maxHeight: "88%",
  },
  modalHead: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 14,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  itineraryStepLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 0,
    lineHeight: 20,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  itineraryDurationRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 4,
  },
  modalFieldHalf: {
    flex: 1,
  },
  modalTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTimeText: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
  },
  itineraryTimePickerBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  itineraryTimePickerSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  itineraryTimePickerBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  itineraryTimePickerDone: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1f6b2a",
  },
  itineraryChipScroll: {
    maxHeight: 120,
    marginBottom: 8,
  },
  itineraryChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 6,
  },
  itineraryChipText: {
    fontSize: 12,
    color: "#334155",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
    color: "#1e293b",
    backgroundColor: "#fafbfc",
  },
  modalNotes: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 10,
  },
  modalActionsForm: {
    marginTop: 12,
  },
  modalBtn: {
    minWidth: 88,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalBtnBack: {
    marginRight: "auto",
  },
  modalCancelBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalSecondaryBtn: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalSecondaryText: {
    color: "#1e3a2f",
    fontWeight: "600",
    fontSize: 13,
  },
  modalOutlineBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  modalOutlineText: {
    color: "#1e3a2f",
    fontWeight: "600",
    fontSize: 13,
  },
  modalSaveBtn: {
    backgroundColor: "#1f6b2a",
  },
  modalCancelText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 13,
  },
  modalSaveText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
});

export default ChatDetailScreen;
