import React, { useState, useEffect } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { getProfile, updateProfile, updateProfileWithImage } from "../../utils/api";
import { useAppAlert } from "../../components/AppAlertProvider";

const DEFAULT_AVATAR_URL =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

/** Nepal mobile: fixed +977 prefix; user enters exactly 10 local digits. */
const NEPAL_PHONE_PREFIX = "+977";

const extractNepalLocalDigits = (phone) => {
  if (phone == null || typeof phone !== "string") return "";
  const s = phone.replace(/\s/g, "");
  if (s.startsWith("+977")) return s.slice(4).replace(/\D/g, "").slice(0, 10);
  if (s.startsWith("977")) return s.slice(3).replace(/\D/g, "").slice(0, 10);
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 10 && digits.startsWith("977")) return digits.slice(3, 13);
  return digits.slice(0, 10);
};

const fullNepalPhone = (localDigits) => {
  const d = String(localDigits || "").replace(/\D/g, "");
  if (d.length !== 10) return "";
  return `${NEPAL_PHONE_PREFIX}${d}`;
};

/** Outlined field: label sits on the top border (Material-style). */
const OutlinedTextField = ({
  label,
  value,
  onChangeText,
  placeholder,
  style,
  inputStyle,
  ...inputProps
}) => (
  <View style={[outlineStyles.field, style]}>
    <Text style={outlineStyles.label} numberOfLines={1}>
      {label}
    </Text>
    <TextInput
      style={[outlineStyles.input, inputStyle]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      {...inputProps}
    />
  </View>
);

const outlineStyles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    minHeight: 52,
    justifyContent: "center",
  },
  label: {
    position: "absolute",
    left: 10,
    top: -9,
    backgroundColor: "#ffffff",
    paddingHorizontal: 4,
    fontSize: 12,
    color: "#9ca3af",
    zIndex: 1,
    maxWidth: "90%",
  },
  input: {
    fontSize: 16,
    color: "#111827",
    padding: 0,
    minHeight: 22,
  },
});

const EditProfileScreen = ({ session, initialProfile = null, onBack, onSave }) => {
  const { t } = useLanguage();
  const { showAlert, showOptions } = useAppAlert();
  const hasInitial = initialProfile != null && typeof initialProfile === "object";
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!hasInitial);
  const [phoneDigits, setPhoneDigits] = useState(() =>
    hasInitial ? extractNepalLocalDigits(initialProfile.phone_number) : ""
  );
  const [profileData, setProfileData] = useState(() => {
    if (!hasInitial) return { first_name: "", last_name: "", phone_number: "", location: "" };
    const local = extractNepalLocalDigits(initialProfile.phone_number);
    return {
      first_name: initialProfile.first_name || "",
      last_name: initialProfile.last_name || "",
      phone_number: fullNepalPhone(local),
      location: initialProfile.location || "",
    };
  });
  const [profileImage, setProfileImage] = useState(null);
  const [profileImageUri, setProfileImageUri] = useState(() => {
    if (!hasInitial) return null;
    const url = initialProfile.profile_picture_url && String(initialProfile.profile_picture_url).trim();
    return url || null;
  });
  const [refundQrImage, setRefundQrImage] = useState(null);
  const [refundQrUri, setRefundQrUri] = useState(() => {
    if (!hasInitial) return null;
    const u = initialProfile.refund_qr_url && String(initialProfile.refund_qr_url).trim();
    return u || null;
  });
  const [refundQrRemoved, setRefundQrRemoved] = useState(false);
  /** Only true when user taps Remove on profile photo — not when they simply did not pick a new file. */
  const [profilePictureRemoved, setProfilePictureRemoved] = useState(false);
  const [isFirstTimeProfile, setIsFirstTimeProfile] = useState(() => {
    if (!hasInitial) return true;
    const required = ["first_name", "last_name", "phone_number", "location"];
    return !required.every((f) => !!initialProfile[f]);
  });
  const isAgent = session?.user?.role === "agent";

  useEffect(() => {
    if (initialProfile && typeof initialProfile === "object" && fetching) {
      const local = extractNepalLocalDigits(initialProfile.phone_number);
      setPhoneDigits(local);
      setProfileData({
        first_name: initialProfile.first_name || "",
        last_name: initialProfile.last_name || "",
        phone_number: fullNepalPhone(local),
        location: initialProfile.location || "",
      });
      const url = initialProfile.profile_picture_url && String(initialProfile.profile_picture_url).trim();
      if (url) setProfileImageUri(url);
      const rqUrl = initialProfile.refund_qr_url && String(initialProfile.refund_qr_url).trim();
      if (rqUrl) setRefundQrUri(rqUrl);
      const required = ["first_name", "last_name", "phone_number", "location"];
      setIsFirstTimeProfile(!required.every((f) => !!initialProfile[f]));
      setFetching(false);
    }
  }, [initialProfile]);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    if (!session?.access) {
      setFetching(false);
      return;
    }
    try {
      const response = await getProfile(session.access);
      const data = response?.data ?? {};

      const local = extractNepalLocalDigits(data.phone_number);
      setPhoneDigits(local);
      setProfileData({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        phone_number: fullNepalPhone(local),
        location: data.location || "",
      });

      const requiredBaseFields = ["first_name", "last_name", "phone_number", "location"];
      const isComplete = requiredBaseFields.every((field) => !!data[field]);
      setIsFirstTimeProfile(!isComplete);

      const url = data.profile_picture_url && String(data.profile_picture_url).trim();
      if (url) setProfileImageUri(url);
      const rq = data.refund_qr_url && String(data.refund_qr_url).trim();
      if (rq) {
        setRefundQrUri(rq);
        setRefundQrRemoved(false);
      } else {
        setRefundQrUri(null);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      if (!hasInitial) showAlert({ title: "Couldn't load profile", message: "Failed to load profile data.", type: "error" });
    } finally {
      setFetching(false);
    }
  };

  const pickImage = () => {
    showOptions({
      title: t("changePhoto"),
      message: t("howToUpdatePhoto"),
      options: [
        { label: t("takePhoto"), onPress: () => takePhotoWithCamera() },
        { label: t("chooseFromGallery"), onPress: () => pickFromGallery() },
        { label: t("cancel"), variant: "cancel" },
      ],
    });
  };

  const takePhotoWithCamera = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        showAlert({ title: "Permission needed", message: "Please grant camera permissions to take a photo.", type: "warning" });
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log("Camera result:", result);

      if (!result.canceled && result.assets && result.assets[0]) {
        setProfileImage(result.assets[0]);
        setProfileImageUri(result.assets[0].uri);
        setProfilePictureRemoved(false);
      }
    } catch (error) {
      console.error("Error taking photo with camera:", error);
      showAlert({ title: "Couldn't open camera", message: "Please try again.", type: "error" });
    }
  };

  const appendFileToFormData = (formData, fieldName, imageAsset) => {
    if (!imageAsset?.uri) return;
    const imageUri = imageAsset.uri;
    let filename = imageUri.split("/").pop() || `${fieldName}.jpg`;
    if (!filename.includes(".")) filename = `${filename}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const mime = match ? `image/${match[1] === "jpg" ? "jpeg" : match[1]}` : "image/jpeg";
    let finalUri = imageUri;
    if (Platform.OS === "ios") finalUri = imageUri.replace("file://", "");
    formData.append(fieldName, {
      uri: finalUri,
      name: filename,
      type: mime,
    });
  };

  const pickRefundQr = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showAlert({ title: "Permission needed", message: "Please allow photo library access to upload your refund QR.", type: "warning" });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.9,
        allowsMultiple: false,
        selectionLimit: 1,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setRefundQrImage(result.assets[0]);
        setRefundQrUri(result.assets[0].uri);
        setRefundQrRemoved(false);
      }
    } catch (error) {
      console.error("Error picking refund QR:", error);
      showAlert({ title: "Couldn't open gallery", message: "Please try again.", type: "error" });
    }
  };

  const pickFromGallery = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showAlert({ title: "Permission needed", message: "Please grant photo library access to upload images.", type: "warning" });
        return;
      }

      // Launch image library
      // Note: mediaTypes removed as it defaults to images and causes type issues in v15
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultiple: false,
        selectionLimit: 1,
      });

      console.log("Image picker result:", result);

      if (!result.canceled && result.assets && result.assets[0]) {
        setProfileImage(result.assets[0]);
        setProfileImageUri(result.assets[0].uri);
        setProfilePictureRemoved(false);
      }
    } catch (error) {
      console.error("Error picking image from gallery:", error);
      showAlert({ title: "Couldn't open gallery", message: "Please try again.", type: "error" });
    }
  };

  const handleSave = async () => {
    if (!session?.access) {
      showAlert({ title: "Not signed in", message: "Please log in and try again.", type: "warning" });
      return;
    }

    const cleanDigits = phoneDigits.replace(/\D/g, "").slice(0, 10);
    if (cleanDigits.length !== 10) {
      showAlert({ title: t("error"), message: t("phoneMustBe10Digits"), type: "warning" });
      return;
    }
    const resolvedPhone = fullNepalPhone(cleanDigits);
    const payloadProfile = { ...profileData, phone_number: resolvedPhone };

    // If this is the first time profile is being completed, require all fields
    const requiredBaseFields = [
      "first_name",
      "last_name",
      "phone_number",
      "location",
    ];
    const requiredFields = requiredBaseFields;

    const missingRequired = requiredFields.filter((field) => {
      if (field === "phone_number") return false;
      return !payloadProfile[field] || String(payloadProfile[field]).trim() === "";
    });

    if (isFirstTimeProfile && missingRequired.length > 0) {
      showAlert({
        title: "Complete your profile",
        message: "Fill in all fields before saving.",
        type: "info",
      });
      return;
    }

    setLoading(true);
    try {
      const hasNewProfileImage = !!profileImage;
      const hasNewRefundQr = !!refundQrImage;
      const needsMultipart = hasNewProfileImage || hasNewRefundQr;

      const appendTextFields = (fd) => {
        Object.keys(payloadProfile).forEach((key) => {
          if (
            payloadProfile[key] !== null &&
            payloadProfile[key] !== undefined &&
            payloadProfile[key] !== ""
          ) {
            fd.append(key, String(payloadProfile[key]));
          }
        });
      };

      let response;

      if (needsMultipart) {
        if (refundQrRemoved && !hasNewRefundQr) {
          await updateProfile({ ...payloadProfile, refund_qr: null }, session.access);
        }
        if (profilePictureRemoved && !hasNewProfileImage) {
          await updateProfile({ ...payloadProfile, profile_picture: null }, session.access);
        }
        const formData = new FormData();
        appendTextFields(formData);
        if (hasNewProfileImage) appendFileToFormData(formData, "profile_picture", profileImage);
        if (hasNewRefundQr) appendFileToFormData(formData, "refund_qr", refundQrImage);
        response = await updateProfileWithImage(formData, session.access);
      } else {
        const updateData = { ...payloadProfile };
        if (profilePictureRemoved) updateData.profile_picture = null;
        if (refundQrRemoved) updateData.refund_qr = null;
        response = await updateProfile(updateData, session.access);
      }

      const didClearRefundQr = refundQrRemoved;
      const didRemoveProfilePicture = profilePictureRemoved;
      setIsFirstTimeProfile(false);
      setRefundQrRemoved(false);
      setProfilePictureRemoved(false);
      setRefundQrImage(null);
      setProfileImage(null);
      if (response?.data?.profile_picture_url) {
        setProfileImageUri(String(response.data.profile_picture_url).trim());
      } else if (didRemoveProfilePicture && !hasNewProfileImage) {
        setProfileImageUri(null);
      }
      if (response?.data?.refund_qr_url) {
        setRefundQrUri(String(response.data.refund_qr_url).trim());
      } else if (didClearRefundQr) {
        setRefundQrUri(null);
      }
      setProfileData((prev) => ({ ...prev, phone_number: resolvedPhone }));
      if (onSave) onSave(response.data);
      else if (onBack) onBack();
      showAlert({
        title: "Profile updated",
        message: "Your changes have been saved.",
        type: "success",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      showAlert({ title: "Couldn't save", message: error.message || "Failed to update profile.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.8}
            onPress={onBack}
          >
            <Ionicons name="chevron-back" size={24} color="#1f1f1f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("editProfile")}</Text>
          <TouchableOpacity
            style={styles.saveButton}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>{t("save")}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Profile image — FAB camera; tap image to change */}
        <View style={styles.imageSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={pickImage}
            style={styles.imageContainer}
          >
            <Image
              source={
                profileImageUri?.trim?.()
                  ? { uri: profileImageUri.trim() }
                  : { uri: DEFAULT_AVATAR_URL }
              }
              style={styles.profileImage}
            />
            <View style={styles.imageEditButton}>
              <Ionicons name="camera" size={22} color="#ffffff" />
            </View>
          </TouchableOpacity>
          {profileImageUri ? (
            <TouchableOpacity
              onPress={() => {
                setProfileImage(null);
                setProfileImageUri(null);
                setProfilePictureRemoved(true);
              }}
              style={styles.removePhotoLink}
              activeOpacity={0.7}
            >
              <Text style={styles.removePhotoLinkText}>{t("removePhoto")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Outlined fields — two-column names, location, split phone */}
        <View style={styles.profileContentBelowPhoto}>
          <View style={styles.nameRow}>
            <OutlinedTextField
              style={styles.nameField}
              label={t("firstName")}
              value={profileData.first_name}
              onChangeText={(text) =>
                setProfileData({ ...profileData, first_name: text })
              }
              placeholder={t("firstName")}
            />
            <OutlinedTextField
              style={styles.nameField}
              label={t("lastName")}
              value={profileData.last_name}
              onChangeText={(text) =>
                setProfileData({ ...profileData, last_name: text })
              }
              placeholder={t("lastName")}
            />
          </View>

          <OutlinedTextField
            style={styles.fieldRow}
            label={t("locationLabel")}
            value={profileData.location}
            onChangeText={(text) =>
              setProfileData({ ...profileData, location: text })
            }
            placeholder={t("locationLabel")}
          />

          <View style={styles.phoneSplitRow}>
            <View style={styles.countryOutline}>
              <Text style={styles.countryFlag}>🇳🇵</Text>
              <Text style={styles.countryCode}>{NEPAL_PHONE_PREFIX}</Text>
              <Ionicons name="chevron-down" size={16} color="#6b7280" />
            </View>
            <OutlinedTextField
              style={styles.phoneField}
              label={t("phone")}
              value={phoneDigits}
              onChangeText={(text) => {
                const only = text.replace(/\D/g, "").slice(0, 10);
                setPhoneDigits(only);
                setProfileData((prev) => ({
                  ...prev,
                  phone_number: fullNepalPhone(only),
                }));
              }}
              placeholder={t("phoneNumberPlaceholder")}
              keyboardType="number-pad"
              maxLength={10}
              inputStyle={styles.phoneInputDigits}
            />
          </View>

          {!isAgent && (
            <View style={styles.refundBlock}>
              <Text style={styles.refundGroupTitle}>{t("refundQrSectionTitle")}</Text>
              <Text style={styles.refundQrHint}>{t("refundQrSectionHint")}</Text>
              <TouchableOpacity
                style={styles.refundQrPreviewWrap}
                onPress={pickRefundQr}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={
                  refundQrUri?.trim?.() ? t("refundQrChange") : t("refundQrUpload")
                }
              >
                {refundQrUri?.trim?.() ? (
                  <Image
                    source={{ uri: refundQrUri.trim() }}
                    style={styles.refundQrPreview}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.refundQrPlaceholder}>
                    <Ionicons name="qr-code-outline" size={32} color="#d1d5db" />
                    <Text style={styles.refundQrPlaceholderText}>{t("refundQrEmpty")}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.refundQrActions}>
                <TouchableOpacity onPress={pickRefundQr} style={styles.refundLinkBtn} activeOpacity={0.7}>
                  <Text style={styles.refundLinkBtnText}>
                    {refundQrUri?.trim?.() ? t("refundQrChange") : t("refundQrUpload")}
                  </Text>
                </TouchableOpacity>
                {refundQrUri ? <Text style={styles.refundActionSep}>·</Text> : null}
                {refundQrUri ? (
                  <TouchableOpacity
                    onPress={() => {
                      setRefundQrImage(null);
                      setRefundQrUri(null);
                      setRefundQrRemoved(true);
                    }}
                    style={styles.refundLinkBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.refundLinkRemoveText}>{t("refundQrRemove")}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 36,
    backgroundColor: "#ffffff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7076",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "#ffffff",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#1f6b2a",
    borderRadius: 20,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  imageSection: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: "#ffffff",
  },
  imageContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: "#f3f5f7",
  },
  imageEditButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1f6b2a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  removePhotoLink: {
    marginTop: 12,
    paddingVertical: 4,
  },
  removePhotoLinkText: {
    fontSize: 14,
    color: "#9ca3af",
    fontWeight: "500",
  },
  profileContentBelowPhoto: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  nameField: {
    flex: 1,
    minWidth: 0,
  },
  fieldRow: {
    marginBottom: 18,
  },
  phoneSplitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  countryOutline: {
    width: 118,
    flexShrink: 0,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  phoneField: {
    flex: 1,
    minWidth: 0,
  },
  phoneInputDigits: {
    letterSpacing: 0.5,
  },
  refundBlock: {
    marginTop: 8,
    paddingTop: 20,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
  },
  refundGroupTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
  },
  refundQrHint: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
    marginBottom: 14,
  },
  refundQrPreviewWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
    borderRadius: 8,
    minHeight: 112,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  refundQrPreview: {
    width: 140,
    height: 140,
  },
  refundQrPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  refundQrPlaceholderText: {
    marginTop: 6,
    fontSize: 13,
    color: "#9ca3af",
  },
  refundQrActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  refundLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  refundLinkBtnText: {
    fontSize: 16,
    color: "#1f6b2a",
    fontWeight: "600",
  },
  refundLinkRemoveText: {
    fontSize: 16,
    color: "#dc2626",
    fontWeight: "600",
  },
  refundActionSep: {
    fontSize: 16,
    color: "#d1d5db",
    marginHorizontal: 6,
  },
});

export default EditProfileScreen;

