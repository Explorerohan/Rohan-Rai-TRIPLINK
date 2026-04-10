import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { API_BASE } from "../../config";
import { loginTravelerWithGoogle, parseJsonResponse } from "../../utils/api";
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
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";

const HERO = require("../../Assets/Login.jpg");
const EMAIL_ICON = require("../../Assets/email.png");
const LOCK_ICON = require("../../Assets/lock.png");

const LOGIN_ENDPOINT = `${API_BASE}/api/auth/login/`;
WebBrowser.maybeCompleteAuthSession();

const LoginScreen = ({
  onLoginSuccess = () => {},
  onForgotPress = () => {},
  onSignupPress = () => {},
}) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    scopes: ["openid", "profile", "email"],
  });

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError(t("emailPasswordRequired"));
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
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || t("invalidCredentials"));
      }
      const role = data?.user?.role;
      if (role !== "traveler") {
        throw new Error(t("onlyTravelerCanLogin"));
      }
      onLoginSuccess({ access: data.access, refresh: data.refresh, user: data.user });
    } catch (e) {
      setError(e.message || t("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const run = async () => {
      if (!googleResponse || googleResponse.type !== "success") return;
      setGoogleLoading(true);
      setError("");
      try {
        const idToken =
          googleResponse.authentication?.idToken || googleResponse.params?.id_token || "";
        if (!idToken) throw new Error("Google sign-in did not return an ID token.");
        const data = await loginTravelerWithGoogle(idToken);
        const role = data?.user?.role;
        if (role !== "traveler") {
          throw new Error(t("onlyTravelerCanLogin"));
        }
        onLoginSuccess({ access: data.access, refresh: data.refresh, user: data.user });
      } catch (e) {
        setError(e.message || "Google login failed");
      } finally {
        setGoogleLoading(false);
      }
    };
    run();
  }, [googleResponse, onLoginSuccess, t]);

  const handleGoogleLogin = async () => {
    setError("");
    if (!googleRequest) {
      setError("Google sign-in is still loading. Please try again.");
      return;
    }
    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID && !process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) {
      setError("Missing Google OAuth client IDs in .env.");
      return;
    }
    try {
      const isExpoGo = Constants.appOwnership === "expo";
      await promptGoogleSignIn(isExpoGo ? { useProxy: true } : undefined);
    } catch (e) {
      setError(e?.message || "Google login failed");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.heroWrapper}>
        <Image source={HERO} style={styles.hero} resizeMode="contain" />
      </View>

      <View style={styles.content}>
        <Text style={styles.heading}>{t("loginToTripLink")} <Text style={styles.headingAccent}>TRIPLINK</Text></Text>

        <View style={styles.inputGroup}>
          <Image source={EMAIL_ICON} style={styles.inputIcon} resizeMode="contain" />
          <TextInput
            placeholder={t("email")}
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
            placeholder={t("password")}
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
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#6b7280"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.forgotWrap} onPress={onForgotPress}>
          <Text style={styles.forgot}>{t("forgotPassword")}</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("login")}</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.googleButton}
          activeOpacity={0.85}
          onPress={handleGoogleLogin}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#1f6b2a" />
          ) : (
            <Text style={styles.googleText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t("newOnTripLink")} </Text>
          <TouchableOpacity onPress={onSignupPress}>
            <Text style={styles.footerLink}>{t("signup")}</Text>
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
  googleButton: {
    marginTop: 12,
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d5d9dd",
  },
  googleText: {
    color: "#1f1f1f",
    fontSize: 16,
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
