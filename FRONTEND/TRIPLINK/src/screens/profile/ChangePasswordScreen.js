import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useLanguage } from "../../context/LanguageContext";
import { changePassword } from "../../utils/api";
import { getPasswordStrength } from "../../utils/passwordStrength";

const ChangePasswordScreen = ({ session, onBack = () => {} }) => {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedPasswordField, setFocusedPasswordField] = useState("");
  const [saving, setSaving] = useState(false);
  const newPasswordStrength = getPasswordStrength(newPassword);
  const confirmStrength = getPasswordStrength(confirmPassword);

  const getStrengthColor = (level) => {
    if (level === "basic") return "#d97706";
    if (level === "good") return "#2563eb";
    if (level === "strong") return "#16a34a";
    return "#e5e7eb";
  };

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t("changePasswordTitle"), t("changePasswordFillAll"));
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert(t("changePasswordTitle"), t("passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t("changePasswordTitle"), t("passwordsDoNotMatch"));
      return;
    }
    if (!session?.access) {
      Alert.alert(t("changePasswordTitle"), t("pleaseLoginToContinue"));
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword, confirmPassword, session.access);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert(t("success"), t("changePasswordSuccess"), [{ text: "OK", onPress: onBack }]);
    } catch (err) {
      Alert.alert(t("changePasswordTitle"), err?.message || t("changePasswordFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <ScrollView
          style={styles.safe}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
                <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{t("changePasswordTitle")}</Text>
              <View style={styles.headerSpacer} />
            </View>

            <Text style={styles.subtitle}>{t("changePasswordSubtitle")}</Text>

            <View style={styles.formCard}>
          <Text style={styles.label}>{t("currentPassword")}</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrentPassword}
              autoCapitalize="none"
              style={styles.input}
              placeholder={t("currentPassword")}
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity
              onPress={() => setShowCurrentPassword((v) => !v)}
              activeOpacity={0.8}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showCurrentPassword ? "eye-off" : "eye"}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t("newPassword")}</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
              style={styles.input}
              placeholder={t("newPassword")}
              placeholderTextColor="#9ca3af"
              onFocus={() => setFocusedPasswordField("newPassword")}
              onBlur={() => setFocusedPasswordField("")}
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword((v) => !v)}
              activeOpacity={0.8}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showNewPassword ? "eye-off" : "eye"}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>
          {focusedPasswordField === "newPassword" ? (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthTrack}>
                <View
                  style={[
                    styles.strengthFill,
                    {
                      width: `${Math.round(newPasswordStrength.progress * 100)}%`,
                      backgroundColor: getStrengthColor(newPasswordStrength.level),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.strengthText, { color: getStrengthColor(newPasswordStrength.level) }]}>
                {t("passwordStrength")}: {t(`passwordStrength${newPasswordStrength.level.charAt(0).toUpperCase()}${newPasswordStrength.level.slice(1)}`)}
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>{t("confirmNewPassword")}</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              style={styles.input}
              placeholder={t("confirmNewPassword")}
              placeholderTextColor="#9ca3af"
              onFocus={() => setFocusedPasswordField("confirmPassword")}
              onBlur={() => setFocusedPasswordField("")}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword((v) => !v)}
              activeOpacity={0.8}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={20}
                color="#6b7280"
              />
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
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSubmit}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveText}>{t("updatePassword")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 12 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1f1f1f" },
  headerSpacer: { width: 40, height: 40 },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 14,
    lineHeight: 18,
  },
  formCard: {
    borderWidth: 1,
    borderColor: "#e3e6ea",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    flex: 1,
    height: 52,
    borderWidth: 0,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 0,
    fontSize: 15,
    lineHeight: 52,
    color: "#1f1f1f",
    backgroundColor: "transparent",
    textAlignVertical: "center",
    includeFontPadding: true,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    height: 54,
    borderWidth: 1,
    borderColor: "#d5d9dd",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingLeft: 2,
  },
  eyeButton: {
    marginRight: 8,
    height: 54,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    marginTop: 18,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#1f6b2a",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  strengthWrap: {
    marginTop: 6,
    marginBottom: 4,
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
});

export default ChangePasswordScreen;
