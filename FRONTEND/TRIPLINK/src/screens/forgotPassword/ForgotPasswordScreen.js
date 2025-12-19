import React, { useEffect, useRef, useState } from "react";
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
import { generateOtp, sendOtpEmail } from "../../utils/otp";

const ForgotPasswordScreen = ({ onBack = () => {}, onResetComplete = () => {} }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showOverlay, setShowOverlay] = useState(false);
  const requestTimer = useRef(null);
  const overlayTimer = useRef(null);

  const handleReset = () => {
    setError("");
    setInfo("");
    if (requestTimer.current) {
      clearTimeout(requestTimer.current);
    }
    if (overlayTimer.current) {
      clearTimeout(overlayTimer.current);
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    const targetEmail = email.trim();
    const otp = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    setLoading(true);
    sendOtpEmail(targetEmail, otp)
      .then(() => {
        setInfo("Check your inbox for reset instructions.");
        setShowOverlay(true);
        overlayTimer.current = setTimeout(() => {
          setShowOverlay(false);
          onResetComplete({
            email: targetEmail,
            otp,
            expiresAt,
            resendsUsed: 0,
            maxResends: 3,
          });
        }, 3000);
      })
      .catch((err) => {
        const msg =
          err?.message ||
          "Failed to send OTP email. Please check EmailJS service/template/public key or network and try again.";
        setError(msg);
        console.warn("OTP send failed:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    return () => {
      if (requestTimer.current) clearTimeout(requestTimer.current);
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#1f1f1f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Forgot Password</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.subtitle}>Enter your email account to reset your password</Text>

        <View style={styles.inputGroup}>
          <View style={styles.inputIconWrap}>
            <Ionicons name="mail-outline" size={18} color="#9aa0a6" />
          </View>
          <TextInput
            placeholder="you@example.com"
            placeholderTextColor="#9aa0a6"
            style={[styles.input, styles.inputWithIcon]}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.success}>{info}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={handleReset} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Reset Password</Text>}
        </TouchableOpacity>
      </View>

      {showOverlay && (
        <View style={styles.overlayBackdrop}>
          <View style={styles.overlayCard}>
            <View style={styles.overlayIconWrap}>
              <Ionicons name="mail-unread-outline" size={26} color="#ffffff" />
            </View>
            <Text style={styles.overlayTitle}>Check your email</Text>
            <Text style={styles.overlaySubtitle}>
              We have sent password recovery instructions to your email
            </Text>
          </View>
        </View>
      )}
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
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1f1f1f",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#6f747a",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 10,
  },
  inputGroup: {
    width: "100%",
    marginBottom: 12,
    position: "relative",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#1f1f1f",
    backgroundColor: "#f7f8fa",
  },
  inputWithIcon: {
    paddingLeft: 44,
  },
  inputIconWrap: {
    position: "absolute",
    width: 18,
    height: 18,
    left: 14,
    top: "50%",
    marginTop: -9,
    zIndex: 1,
    justifyContent: "center",
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  success: {
    color: "#1f6b2a",
    fontSize: 13,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  primaryButton: {
    marginTop: 8,
    width: "100%",
    backgroundColor: "#1f6b2a",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  overlayBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  overlayCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  overlayIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1f6b2a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  overlayIcon: {
    width: 26,
    height: 26,
    tintColor: "#ffffff",
  },
  overlayTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1f1f1f",
    marginBottom: 6,
  },
  overlaySubtitle: {
    fontSize: 14,
    color: "#6f747a",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
});

export default ForgotPasswordScreen;
