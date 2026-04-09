import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { API_BASE } from "../../config";
import { parseJsonResponse } from "../../utils/api";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getPasswordStrength } from "../../utils/passwordStrength";

const HERO = require("../../Assets/Login.jpg");
const GOOGLE_ICON = require("../../Assets/google.png");

const REGISTER_REQUEST_OTP_ENDPOINT = `${API_BASE}/api/auth/register/request-otp/`;

const SignupScreen = ({ onSignupComplete = () => {}, onBackToLogin = () => {} }) => {
  const { t } = useLanguage();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedPasswordField, setFocusedPasswordField] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const passwordStrength = getPasswordStrength(password);
  const confirmStrength = getPasswordStrength(confirmPassword);

  const getStrengthColor = (level) => {
    if (level === "basic") return "#d97706";
    if (level === "good") return "#2563eb";
    if (level === "strong") return "#16a34a";
    return "#e5e7eb";
  };

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
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      setError(t("pleaseFillAllFields"));
      return;
    }
    if (password.length < 8) {
      setError(t("passwordMinLength"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("passwordsDoNotMatch"));
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await fetch(REGISTER_REQUEST_OTP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(parseError(data));
      }
      onSignupComplete({
        email: normalizedEmail,
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        expiresAt: Date.now() + 5 * 60 * 1000,
        resendsUsed: 0,
        maxResends: 3,
      });
    } catch (e) {
      setError(e.message || t("signupFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        style={styles.pageContent}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <ScrollView
          style={styles.pageContent}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentInset}>
          <View style={styles.heroWrapper}>
            <Image source={HERO} style={styles.hero} resizeMode="contain" />
          </View>

          <View style={styles.content}>
            <Text style={styles.heading}>
              {t("createYourAccount")}
              <Text style={styles.headingAccent}>TRIPLINK</Text>
              {t("accountText")}
            </Text>
            <View style={styles.inputGroup}>
              <View style={styles.inputIconWrap}>
                <Ionicons name="person-outline" size={18} color="#9aa0a6" />
              </View>
              <TextInput
                placeholder={t("firstName")}
                placeholderTextColor="#9aa0a6"
                style={[styles.input, styles.inputWithIcon]}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.inputGroup}>
              <View style={styles.inputIconWrap}>
                <Ionicons name="person-outline" size={18} color="#9aa0a6" />
              </View>
              <TextInput
                placeholder={t("lastName")}
                placeholderTextColor="#9aa0a6"
                style={[styles.input, styles.inputWithIcon]}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
            <View style={styles.inputGroup}>
              <View style={styles.inputIconWrap}>
                <Ionicons name="mail-outline" size={18} color="#9aa0a6" />
              </View>
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
              <View style={styles.inputIconWrap}>
                <Ionicons name="lock-closed-outline" size={18} color="#9aa0a6" />
              </View>
              <TextInput
                placeholder={t("password")}
                placeholderTextColor="#9aa0a6"
                style={[styles.input, styles.inputWithIcon]}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedPasswordField("password")}
                onBlur={() => setFocusedPasswordField("")}
              />
              <TouchableOpacity style={styles.eye} onPress={() => setShowPassword((prev) => !prev)} activeOpacity={0.7}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {focusedPasswordField === "password" ? (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthTrack}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: `${Math.round(passwordStrength.progress * 100)}%`,
                        backgroundColor: getStrengthColor(passwordStrength.level),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: getStrengthColor(passwordStrength.level) }]}>
                  {t("passwordStrength")}: {t(`passwordStrength${passwordStrength.level.charAt(0).toUpperCase()}${passwordStrength.level.slice(1)}`)}
                </Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <View style={styles.inputIconWrap}>
                <Ionicons name="lock-closed-outline" size={18} color="#9aa0a6" />
              </View>
              <TextInput
                placeholder={t("confirmPassword")}
                placeholderTextColor="#9aa0a6"
                style={[styles.input, styles.inputWithIcon]}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setFocusedPasswordField("confirmPassword")}
                onBlur={() => setFocusedPasswordField("")}
              />
              <TouchableOpacity style={styles.eye} onPress={() => setShowConfirm((prev) => !prev)} activeOpacity={0.7}>
                <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {focusedPasswordField === "confirmPassword" ? (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthTrack}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: `${Math.round(confirmStrength.progress * 100)}%`,
                        backgroundColor: getStrengthColor(confirmStrength.level),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: getStrengthColor(confirmStrength.level) }]}>
                  {t("passwordStrength")}: {t(`passwordStrength${confirmStrength.level.charAt(0).toUpperCase()}${confirmStrength.level.slice(1)}`)}
                </Text>
              </View>
            ) : null}

            <Text style={styles.helper}>{t("passwordHelper")}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={handleSignup} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>{t("signup")}</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.or}>{t("or")}</Text>

            <TouchableOpacity style={styles.googleButton} activeOpacity={0.85}>
              <Image source={GOOGLE_ICON} style={styles.googleIcon} />
              <Text style={styles.googleText}>{t("continueWithGoogle")}</Text>
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>{t("alreadyHaveAccount")} </Text>
              <TouchableOpacity onPress={onBackToLogin}>
                <Text style={styles.footerLink}>{t("login")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  contentInset: {
    flex: 1,
    paddingHorizontal: 22,
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1f6b2a",
    marginBottom: 6,
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
  inputIconWrap: {
    position: "absolute",
    left: 12,
    top: "50%",
    marginTop: -9,
    zIndex: 1,
    justifyContent: "center",
  },
  eye: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -15,
    padding: 4,
  },
  helper: {
    width: "100%",
    color: "#7a7f85",
    fontSize: 13,
    marginTop: -2,
    marginBottom: 6,
  },
  strengthWrap: {
    width: "100%",
    marginTop: -4,
    marginBottom: 8,
  },
  strengthTrack: {
    width: "100%",
    height: 6,
    borderRadius: 99,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 99,
  },
  strengthText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
  },
  error: {
    color: "#c0392b",
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
});

export default SignupScreen;
