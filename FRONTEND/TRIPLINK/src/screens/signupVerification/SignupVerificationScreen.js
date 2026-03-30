import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const CODE_LENGTH = 4;

const SignupVerificationScreen = ({
  email = "",
  expiresAt,
  resendsUsed = 0,
  maxResends = 3,
  onBack = () => {},
  onVerify = () => {},
  onResend = () => {},
}) => {
  const { t } = useLanguage();
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [remaining, setRemaining] = useState(0);
  const inputsRef = useRef([]);

  const codeValue = useMemo(() => digits.join(""), [digits]);
  const isComplete = useMemo(() => codeValue.length === CODE_LENGTH && !digits.includes(""), [codeValue, digits]);
  const isExpired = expiresAt ? Date.now() > expiresAt : false;
  const resendsLeft = Math.max(0, maxResends - resendsUsed);

  const handleChange = (idx, value) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...digits];
    nextDigits[idx] = char;
    setDigits(nextDigits);
    if (char && idx < CODE_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handleKeyPress = (idx, key) => {
    if (key === "Backspace" && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (!isComplete) return;
    if (isExpired) {
      setError(t("otpExpired"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await Promise.resolve(onVerify(codeValue));
    } catch (e) {
      setError(e?.message || t("invalidCode"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (resendsLeft <= 0) {
      setError(t("resendLimitReached"));
      return;
    }
    setDigits(Array(CODE_LENGTH).fill(""));
    inputsRef.current[0]?.focus();
    onResend();
    setError("");
    setInfo(t("sentNewCode"));
  };

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemaining(diff);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    setDigits(Array(CODE_LENGTH).fill(""));
    setError("");
    setInfo("");
  }, [expiresAt]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#1f1f1f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("signupOtpTitle")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{t("signupOtpTitle")}</Text>
        <Text style={styles.subtitle}>
          {t("otpCheckEmail")} {email}
        </Text>

        <View style={styles.codeRow}>
          {digits.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={(el) => (inputsRef.current[idx] = el)}
              style={styles.codeInput}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(v) => handleChange(idx, v)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(idx, nativeEvent.key)}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !isComplete && styles.primaryButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleVerify}
          disabled={!isComplete || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("verifyOtpAndCreate")}</Text>}
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <View style={styles.footerRow}>
          <TouchableOpacity onPress={handleResend} activeOpacity={0.8}>
            <Text style={styles.resend}>{t("resendCodeTo")}</Text>
          </TouchableOpacity>
          <Text style={styles.timer}>
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </Text>
        </View>
        <Text style={styles.resendMeta}>{t("resendsLeft")} {resendsLeft}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 22,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingTop: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1f1f1f",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#6f747a",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 26,
  },
  codeInput: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: "#f6f7f9",
    borderWidth: 1,
    borderColor: "#f6f7f9",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#1f6b2a",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 1,
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  info: {
    color: "#1f6b2a",
    fontSize: 13,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 14,
  },
  resend: {
    fontSize: 13,
    color: "#6f747a",
    fontWeight: "700",
  },
  timer: {
    fontSize: 13,
    color: "#6f747a",
    fontWeight: "700",
  },
  resendMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "#6f747a",
  },
});

export default SignupVerificationScreen;
