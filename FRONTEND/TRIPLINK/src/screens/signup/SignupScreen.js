import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const HERO = require("../../Assets/Login.jpg");
const GOOGLE_ICON = require("../../Assets/google.png");
const EMAIL_ICON = require("../../Assets/email.png");
const LOCK_ICON = require("../../Assets/lock.png");
const EYE_ICON = require("../../Assets/eye.png");

const API_BASE = "http://192.168.18.6:8000";
const REGISTER_ENDPOINT = `${API_BASE}/api/auth/register/`;

const SignupScreen = ({ onSignupComplete = () => {}, onBackToLogin = () => {} }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimerRef = useRef(null);

  const parseError = (data) => {
    if (!data) return "Signup failed";
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    const key = Object.keys(data)[0];
    if (key && Array.isArray(data[key])) return data[key][0];
    if (key && typeof data[key] === "string") return data[key];
    return "Signup failed";
  };

  const handleSignup = async () => {
    setError("");
    setInfo("");
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const displayName = name.trim() || email.trim() || "traveler";
      const res = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role: "traveler",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(parseError(data));
      }
      setInfo("Account created! Continue to login.");
      setShowSuccess(true);
      successTimerRef.current = setTimeout(() => {
        setShowSuccess(false);
        onSignupComplete({ email: email.trim() });
      }, 3000);
    } catch (e) {
      setError(e.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.pageContent}>
        <View style={styles.heroWrapper}>
          <Image source={HERO} style={styles.hero} resizeMode="contain" />
        </View>

        <View style={styles.content}>
          <Text style={styles.heading}>
            Create your <Text style={styles.headingAccent}>TRIPLINK</Text> account
          </Text>

          <View style={styles.inputGroup}>
            <Image source={EMAIL_ICON} style={styles.inputIcon} resizeMode="contain" />
            <TextInput
              placeholder="Full name"
              placeholderTextColor="#9aa0a6"
              style={[styles.input, styles.inputWithIcon]}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Image source={EMAIL_ICON} style={styles.inputIcon} resizeMode="contain" />
            <TextInput
              placeholder="Email"
              placeholderTextColor="#9aa0a6"
              style={[styles.input, styles.inputWithIcon]}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Image source={LOCK_ICON} style={styles.inputIcon} resizeMode="contain" />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#9aa0a6"
              style={[styles.input, styles.inputWithIcon]}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eye}
              onPress={() => setShowPassword((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Image source={EYE_ICON} style={styles.eyeImage} resizeMode="contain" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Image source={LOCK_ICON} style={styles.inputIcon} resizeMode="contain" />
            <TextInput
              placeholder="Confirm password"
              placeholderTextColor="#9aa0a6"
              style={[styles.input, styles.inputWithIcon]}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eye}
              onPress={() => setShowConfirm((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Image source={EYE_ICON} style={styles.eyeImage} resizeMode="contain" />
            </TouchableOpacity>
          </View>

          <Text style={styles.helper}>Use 8+ characters with a number and symbol.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!showSuccess && info ? <Text style={styles.success}>{info}</Text> : null}

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create account</Text>}
          </TouchableOpacity>

          <Text style={styles.or}>or</Text>

          <TouchableOpacity style={styles.googleButton} activeOpacity={0.85}>
            <Image source={GOOGLE_ICON} style={styles.googleIcon} />
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={onBackToLogin}>
              <Text style={styles.footerLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {showSuccess && (
        <View style={styles.overlayBackdrop}>
          <View style={styles.overlayCard}>
            <View style={styles.overlayIconWrap}>
              <Ionicons name="checkmark" size={26} color="#ffffff" />
            </View>
            <Text style={styles.overlayTitle}>Account created</Text>
            <Text style={styles.overlaySubtitle}>
              Congrats {name.trim() || email.trim() || "traveler"}, your TripLink traveler account is ready.
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
    position: "relative",
  },
  heroWrapper: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 10,
  },
  hero: {
    width: "100%",
    height: 210,
  },
  pageContent: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1f6b2a",
    marginBottom: 14,
    textAlign: "center",
  },
  headingAccent: {
    color: "#1f6b2a",
  },
  inputGroup: {
    width: "100%",
    marginBottom: 12,
    position: "relative",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#d5d9dd",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#1f1f1f",
    backgroundColor: "#fff",
  },
  inputWithIcon: {
    paddingLeft: 42,
  },
  inputIcon: {
    position: "absolute",
    width: 18,
    height: 18,
    left: 12,
    top: "50%",
    marginTop: -9,
    zIndex: 1,
    pointerEvents: "none",
  },
  eye: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -15,
    padding: 4,
  },
  eyeImage: {
    width: 20,
    height: 20,
  },
  helper: {
    width: "100%",
    color: "#7a7f85",
    fontSize: 13,
    marginTop: -2,
    marginBottom: 6,
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
    marginTop: 18,
    width: "100%",
    backgroundColor: "#1f6b2a",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  or: {
    marginVertical: 12,
    color: "#7a7f85",
    fontSize: 13,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: "#d5d9dd",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  googleIcon: {
    width: 18,
    height: 18,
  },
  googleText: {
    color: "#1f1f1f",
    fontSize: 15,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 12,
  },
  footerText: {
    color: "#b8b8b8",
    fontSize: 13,
  },
  footerLink: {
    color: "#1f6b2a",
    fontSize: 13,
    fontWeight: "700",
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 50,
    elevation: 50,
  },
  overlayCard: {
    width: "90%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 18,
    alignItems: "center",
    zIndex: 60,
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

export default SignupScreen;
