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
  onBack = () => {},
  onVerify = () => {},
  onResend = () => {},
}) => {
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef([]);

  const codeValue = useMemo(() => digits.join(""), [digits]);
  const isComplete = useMemo(() => codeValue.length === CODE_LENGTH && !digits.includes(""), [codeValue, digits]);

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
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onVerify(codeValue);
    }, 500);
  };

  const handleResend = () => {
    setDigits(Array(CODE_LENGTH).fill(""));
    inputsRef.current[0]?.focus();
    onResend();
  };

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

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

        <View style={styles.footerRow}>
          <TouchableOpacity onPress={handleResend} activeOpacity={0.8}>
            <Text style={styles.resend}>Resend code to</Text>
          </TouchableOpacity>
          <Text style={styles.timer}>01:26</Text>
        </View>
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
});

export default VerificationScreen;
