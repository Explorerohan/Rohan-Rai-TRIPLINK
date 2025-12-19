import React, { useEffect, useMemo, useRef, useState } from "react";
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
const colors = {
  background: "#ffffff",
  text: "#1f1f1f",
  muted: "#6f747a",
  brand: "#1f6b2a",
  border: "#f6f7f9",
  field: "#f6f7f9",
  surface: "#f3f4f6",
};

const VerificationScreen = ({
  email = "your email",
  expectedCode,
  expiresAt,
  resendsUsed = 0,
  maxResends = 3,
  onBack = () => {},
  onVerify = () => {},
  onResend = () => {},
}) => {
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

  const handleVerify = () => {
    if (!isComplete) return;
    if (isExpired) {
      setError("OTP expired. Please resend a new code.");
      return;
    }
    if (expectedCode && codeValue !== expectedCode) {
      setError("Invalid code. Try again.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onVerify(codeValue);
    }, 500);
  };

  const handleResend = () => {
    if (resendsLeft <= 0) {
      setError("Resend limit reached.");
      return;
    }
    setDigits(Array(CODE_LENGTH).fill(""));
    inputsRef.current[0]?.focus();
    onResend();
    setError("");
    setInfo("We sent a new code to your email.");
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
    // reset fields when new code issued
    setDigits(Array(CODE_LENGTH).fill(""));
    setError("");
    setInfo("");
  }, [expectedCode, expiresAt]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#1f1f1f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>OTP Verification</Text>
        <Text style={styles.subtitle}>
          Please check your email {email}{"\n"}to see the verification code
        </Text>

        <View style={styles.sectionLabelWrap}>
          <Text style={styles.sectionLabel}>OTP Code</Text>
        </View>

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
              returnKeyType="done"
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !isComplete && styles.primaryButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleVerify}
          disabled={!isComplete || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify</Text>}
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <View style={styles.footerRow}>
          <TouchableOpacity onPress={handleResend} activeOpacity={0.8}>
            <Text style={styles.resend}>Resend code to</Text>
          </TouchableOpacity>
          <Text style={styles.timer}>
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </Text>
        </View>
        <Text style={styles.resendMeta}>Resends left: {resendsLeft}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingTop: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  sectionLabelWrap: {
    width: "100%",
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
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
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  primaryButton: {
    marginTop: 0,
    width: "100%",
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 1,
    backgroundColor: colors.brand,
  },
  primaryText: {
    color: colors.background,
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
    color: colors.brand,
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
    color: colors.muted,
    fontWeight: "700",
  },
  timer: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "700",
  },
  resendMeta: {
    marginTop: 6,
    fontSize: 12,
    color: colors.muted,
  },
});

export default VerificationScreen;
