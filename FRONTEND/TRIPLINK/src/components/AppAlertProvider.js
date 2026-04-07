import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/** @type {{ current: AppAlertApi | null }} */
const registry = { current: null };

const COLORS = {
  title: "#0f172a",
  body: "#64748b",
  cardBg: "#ffffff",
  backdrop: "rgba(15, 23, 42, 0.45)",
  successIconBg: "#ecfdf5",
  successIcon: "#166534",
  successBtn: "#1f6b2a",
  errorIconBg: "#fef2f2",
  errorIcon: "#b91c1c",
  errorBtn: "#334155",
  warningIconBg: "#fffbeb",
  warningIcon: "#b45309",
  warningBtn: "#b45309",
  infoIconBg: "#eff6ff",
  infoIcon: "#1d4ed8",
  infoBtn: "#1f6b2a",
  cancelBtnBg: "#f1f5f9",
  cancelBtnText: "#475569",
  destructiveBtn: "#b91c1c",
};

/**
 * @typedef {'success' | 'error' | 'warning' | 'info'} AppAlertType
 * @typedef {{ label: string, onPress?: () => void, variant?: 'cancel' | 'destructive' }} AppAlertOption
 * @typedef {{
 *   showAlert: (o: { title: string, message?: string, type?: AppAlertType, onOk?: () => void }) => void
 *   showConfirm: (o: {
 *     title: string, message?: string, type?: AppAlertType,
 *     confirmText?: string, cancelText?: string, destructive?: boolean,
 *     onConfirm?: () => void, onCancel?: () => void
 *   }) => void
 *   showOptions: (o: { title: string, message?: string, options: AppAlertOption[] }) => void
 * }} AppAlertApi
 */

function iconForType(type) {
  switch (type) {
    case "success":
      return { name: "checkmark-circle", bg: COLORS.successIconBg, fg: COLORS.successIcon };
    case "error":
      return { name: "close-circle", bg: COLORS.errorIconBg, fg: COLORS.errorIcon };
    case "warning":
      return { name: "warning", bg: COLORS.warningIconBg, fg: COLORS.warningIcon };
    default:
      return { name: "information-circle", bg: COLORS.infoIconBg, fg: COLORS.infoIcon };
  }
}

function primaryBtnColor(type, mode) {
  if (mode === "confirm" && type === "error") return COLORS.errorBtn;
  switch (type) {
    case "success":
      return COLORS.successBtn;
    case "error":
      return COLORS.errorBtn;
    case "warning":
      return COLORS.warningBtn;
    default:
      return COLORS.infoBtn;
  }
}

const AppAlertContext = createContext(null);

export function useAppAlert() {
  const ctx = useContext(AppAlertContext);
  if (!ctx) {
    throw new Error("useAppAlert must be used within AppAlertProvider");
  }
  return ctx;
}

export function showAppAlert(payload) {
  registry.current?.showAlert(payload);
}

export function showAppConfirm(payload) {
  registry.current?.showConfirm(payload);
}

export function showAppOptions(payload) {
  registry.current?.showOptions(payload);
}

export function AppAlertProvider({ children }) {
  const { width: windowWidth } = useWindowDimensions();
  const cardMaxWidth = Math.min(340, windowWidth - 48);

  const [visible, setVisible] = useState(false);
  /** @type {[{ kind: 'alert'|'confirm'|'options', payload: any } | null, function]} */
  const [content, setContent] = useState(null);
  const queueRef = useRef([]);
  const visibleRef = useRef(false);

  const showNextFromQueue = useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      visibleRef.current = true;
      setContent(next);
      setVisible(true);
    }
  }, []);

  const finishClose = useCallback(() => {
    visibleRef.current = false;
    setVisible(false);
    setContent(null);
    requestAnimationFrame(() => {
      showNextFromQueue();
    });
  }, [showNextFromQueue]);

  const enqueue = useCallback((item) => {
    if (!visibleRef.current) {
      visibleRef.current = true;
      setContent(item);
      setVisible(true);
    } else {
      queueRef.current.push(item);
    }
  }, []);

  const showAlert = useCallback(
    (opts) => {
      enqueue({ kind: "alert", payload: { type: "info", ...opts } });
    },
    [enqueue]
  );

  const showConfirm = useCallback(
    (opts) => {
      enqueue({ kind: "confirm", payload: { type: "info", ...opts } });
    },
    [enqueue]
  );

  const showOptions = useCallback(
    (opts) => {
      enqueue({ kind: "options", payload: opts });
    },
    [enqueue]
  );

  const api = useMemo(
    () => ({
      showAlert,
      showConfirm,
      showOptions,
    }),
    [showAlert, showConfirm, showOptions]
  );

  useEffect(() => {
    registry.current = api;
    return () => {
      registry.current = null;
    };
  }, [api]);

  const onBackdrop = () => {
    if (!content) return;
    if (content.kind === "confirm") {
      content.payload.onCancel?.();
      finishClose();
    } else if (content.kind === "options") {
      const cancelOpt = content.payload.options?.find((o) => o.variant === "cancel");
      cancelOpt?.onPress?.();
      finishClose();
    } else if (content.kind === "alert") {
      finishClose();
    }
  };

  const renderBody = () => {
    if (!content) return null;

    if (content.kind === "alert") {
      const { title, message, type = "info", onOk } = content.payload;
      const icon = iconForType(type);
      const btnColor = primaryBtnColor(type, "alert");
      return (
        <View style={[styles.card, { maxWidth: cardMaxWidth }]}>
          <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={36} color={icon.fg} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: btnColor }]}
            onPress={() => {
              onOk?.();
              finishClose();
            }}
          >
            <Text style={styles.primaryBtnText}>OK</Text>
          </Pressable>
        </View>
      );
    }

    if (content.kind === "confirm") {
      const {
        title,
        message,
        type = "info",
        confirmText = "OK",
        cancelText = "Cancel",
        destructive,
        onConfirm,
        onCancel,
      } = content.payload;
      const icon = iconForType(destructive ? "error" : type);
      const confirmBg = destructive ? COLORS.destructiveBtn : primaryBtnColor(type, "confirm");
      return (
        <View style={[styles.card, { maxWidth: cardMaxWidth }]}>
          <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={36} color={icon.fg} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.confirmRow}>
            <Pressable
              style={[styles.secondaryBtn, { flex: 1 }]}
              onPress={() => {
                onCancel?.();
                finishClose();
              }}
            >
              <Text style={styles.secondaryBtnText}>{cancelText}</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtnFlat, { flex: 1, backgroundColor: confirmBg }]}
              onPress={() => {
                onConfirm?.();
                finishClose();
              }}
            >
              <Text style={styles.primaryBtnText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (content.kind === "options") {
      const { title, message, options } = content.payload;
      return (
        <View style={[styles.card, { maxWidth: cardMaxWidth }]}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <ScrollView style={styles.optionsScroll} keyboardShouldPersistTaps="handled">
            {options.map((opt, i) => {
              const isCancel = opt.variant === "cancel";
              const isDest = opt.variant === "destructive";
              return (
                <Pressable
                  key={`${opt.label}-${i}`}
                  style={[styles.optionBtn, i > 0 && styles.optionBtnBorder]}
                  onPress={() => {
                    opt.onPress?.();
                    finishClose();
                  }}
                >
                  <Text
                    style={[
                      styles.optionBtnText,
                      isCancel && styles.optionBtnTextCancel,
                      isDest && styles.optionBtnTextDestructive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    return null;
  };

  return (
    <AppAlertContext.Provider value={api}>
      {children}
      <Modal
        visible={visible && !!content}
        transparent
        animationType="fade"
        onRequestClose={onBackdrop}
      >
        <Pressable style={styles.backdrop} onPress={onBackdrop}>
          <Pressable style={styles.cardWrap} onPress={(e) => e.stopPropagation()}>
            {renderBody()}
          </Pressable>
        </Pressable>
      </Modal>
    </AppAlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  cardWrap: {
    width: "100%",
    alignItems: "center",
  },
  card: {
    width: "100%",
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.title,
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.body,
    textAlign: "center",
  },
  primaryBtn: {
    marginTop: 24,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnFlat: {
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  confirmRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
    width: "100%",
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.cancelBtnBg,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: COLORS.cancelBtnText,
    fontSize: 16,
    fontWeight: "600",
  },
  optionsScroll: {
    maxHeight: 280,
    marginTop: 16,
    width: "100%",
  },
  optionBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  optionBtnBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  optionBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.title,
  },
  optionBtnTextCancel: {
    color: COLORS.cancelBtnText,
    fontWeight: "600",
  },
  optionBtnTextDestructive: {
    color: COLORS.destructiveBtn,
  },
});
