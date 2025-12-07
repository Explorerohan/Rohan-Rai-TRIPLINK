import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const HERO = require("../../Assets/Login.jpg");
const GOOGLE_ICON = require("../../Assets/google.png");
const EMAIL_ICON = require("../../Assets/email.png");
const LOCK_ICON = require("../../Assets/lock.png");
const EYE_ICON = require("../../Assets/eye.png");

const API_BASE = "http://192.168.18.6:8000";
const LOGIN_ENDPOINT = `${API_BASE}/api/auth/login/`;

const LoginScreen = ({ onLoginSuccess = () => {} }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      console.log("Logging in to:", LOGIN_ENDPOINT);
      const res = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || "Invalid credentials");
      }
      const role = data?.user?.role;
      if (role !== "traveler") {
        throw new Error("Only traveler accounts can log in.");
      }
      onLoginSuccess({ access: data.access, refresh: data.refresh, user: data.user });
    } catch (e) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.heroWrapper}>
        <Image source={HERO} style={styles.hero} resizeMode="contain" />
      </View>

      <View style={styles.content}>
        <Text style={styles.heading}>Login to <Text style={styles.headingAccent}>TRIPLINK</Text></Text>

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

        <TouchableOpacity style={styles.forgotWrap}>
          <Text style={styles.forgot}>Forgot password ?</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Login</Text>}
        </TouchableOpacity>

        <Text style={styles.or}>or</Text>

        <TouchableOpacity style={styles.googleButton} activeOpacity={0.85}>
          <Image source={GOOGLE_ICON} style={styles.googleIcon} />
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Are you new on TRIPLINK ? </Text>
          <TouchableOpacity>
            <Text style={styles.footerLink}>signup</Text>
          </TouchableOpacity>
        </View>
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
  heroWrapper: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 10,
  },
  hero: {
    width: "100%",
    height: 220,
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1f6b2a",
    marginBottom: 18,
  },
  headingAccent: {
    color: "#1f6b2a",
  },
  inputGroup: {
    width: "100%",
    marginBottom: 14,
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
  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: 0,
  },
  forgot: {
    fontSize: 15,
    color: "#111",
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  primaryButton: {
    marginTop: 30,
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
    marginTop: 225,
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
});

export default LoginScreen;
