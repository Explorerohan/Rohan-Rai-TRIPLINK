import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
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

const DEFAULT_AVATAR_URL =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

const EditProfileScreen = ({ session, initialProfile = null, onBack, onSave }) => {
  const hasInitial = initialProfile != null && typeof initialProfile === "object";
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!hasInitial);
  const [profileData, setProfileData] = useState(() => {
    if (!hasInitial) return { first_name: "", last_name: "", phone_number: "", location: "" };
    return {
      first_name: initialProfile.first_name || "",
      last_name: initialProfile.last_name || "",
      phone_number: initialProfile.phone_number || "",
      location: initialProfile.location || "",
    };
  });
  const [profileImage, setProfileImage] = useState(null);
  const [profileImageUri, setProfileImageUri] = useState(() => {
    if (!hasInitial) return null;
    const url = initialProfile.profile_picture_url && String(initialProfile.profile_picture_url).trim();
    return url || null;
  });
  const [isFirstTimeProfile, setIsFirstTimeProfile] = useState(() => {
    if (!hasInitial) return true;
    const required = ["first_name", "last_name", "phone_number", "location"];
    return !required.every((f) => !!initialProfile[f]);
  });
  const isAgent = session?.user?.role === "agent";

  useEffect(() => {
    if (initialProfile && typeof initialProfile === "object" && fetching) {
      setProfileData({
        first_name: initialProfile.first_name || "",
        last_name: initialProfile.last_name || "",
        phone_number: initialProfile.phone_number || "",
        location: initialProfile.location || "",
      });
      const url = initialProfile.profile_picture_url && String(initialProfile.profile_picture_url).trim();
      if (url) setProfileImageUri(url);
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

      setProfileData({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        phone_number: data.phone_number || "",
        location: data.location || "",
      });

      const requiredBaseFields = ["first_name", "last_name", "phone_number", "location"];
      const isComplete = requiredBaseFields.every((field) => !!data[field]);
      setIsFirstTimeProfile(!isComplete);

      const url = data.profile_picture_url && String(data.profile_picture_url).trim();
      if (url) setProfileImageUri(url);
    } catch (error) {
      console.error("Error fetching profile:", error);
      if (!hasInitial) Alert.alert("Error", "Failed to load profile data");
    } finally {
      setFetching(false);
    }
  };

  const pickImage = () => {
    // Directly open gallery when change photo is clicked
    pickFromGallery();
  };

  const pickFromGallery = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions to upload images");
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
      }
    } catch (error) {
      console.error("Error picking image from gallery:", error);
      Alert.alert("Error", "Failed to open gallery. Please try again.");
    }
  };

  const handleSave = async () => {
    if (!session?.access) {
      Alert.alert("Error", "Not authenticated");
      return;
    }

    // If this is the first time profile is being completed, require all fields
    const requiredBaseFields = [
      "first_name",
      "last_name",
      "phone_number",
      "location",
    ];
    const requiredFields = requiredBaseFields;

    const missingRequired = requiredFields.filter(
      (field) => !profileData[field] || String(profileData[field]).trim() === ""
    );

    if (isFirstTimeProfile && missingRequired.length > 0) {
      Alert.alert(
        "Complete your profile",
        "Because this is your first time updating your profile, please fill in all fields before saving."
      );
      return;
    }

    setLoading(true);
    try {
      // Check if profile picture was removed (had image before, now null)
      const hadImageBefore = profileImageUri && !profileImageUri.includes("Assets");
      const imageRemoved = hadImageBefore && !profileImage;

      if (profileImage) {
        // Upload with new image using multipart/form-data
        const formData = new FormData();

        // Add text fields
        Object.keys(profileData).forEach((key) => {
          if (
            profileData[key] !== null &&
            profileData[key] !== undefined &&
            profileData[key] !== ""
          ) {
            formData.append(key, String(profileData[key]));
          }
        });

        // Add image - React Native FormData format
        const imageUri = profileImage.uri;
        let filename = imageUri.split("/").pop() || "profile.jpg";

        // Ensure filename has extension
        if (!filename.includes(".")) {
          filename = `${filename}.jpg`;
        }

        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";

        // Handle different platforms for image URI
        let finalUri = imageUri;
        if (Platform.OS === "ios") {
          // iOS needs file:// prefix removed
          finalUri = imageUri.replace("file://", "");
        }

        formData.append("profile_picture", {
          uri: finalUri,
          name: filename,
          type: type,
        });

        const response = await updateProfileWithImage(formData, session.access);
        Alert.alert("Success", "Profile updated successfully!");
        setIsFirstTimeProfile(false);
        if (onSave) onSave(response.data);
      } else if (imageRemoved) {
        // Profile picture was removed - send null to clear it
        const updateData = {
          ...profileData,
          profile_picture: null,
        };
        const response = await updateProfile(updateData, session.access);
        Alert.alert("Success", "Profile updated successfully!");
        setIsFirstTimeProfile(false);
        if (onSave) onSave(response.data);
      } else {
        // Update without image (no change to image)
        const response = await updateProfile(profileData, session.access);
        Alert.alert("Success", "Profile updated successfully!");
        setIsFirstTimeProfile(false);
        if (onSave) onSave(response.data);
      }

      if (onBack) onBack();
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", error.message || "Failed to update profile");
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
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity
            style={styles.saveButton}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Profile Image */}
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
              <Ionicons name="camera" size={20} color="#ffffff" />
            </View>
          </TouchableOpacity>
          <View style={styles.imageActionButtons}>
            <TouchableOpacity
              onPress={pickImage}
              style={styles.changePhotoButton}
            >
              <Ionicons name="image-outline" size={16} color="#1f6b2a" />
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
            {profileImageUri && (
              <TouchableOpacity
                onPress={() => {
                  setProfileImage(null);
                  setProfileImageUri(null);
                }}
                style={styles.removePhotoButton}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={styles.removePhotoText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={profileData.first_name}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, first_name: text })
                }
                placeholder="First name"
                placeholderTextColor="#9aa0a6"
              />
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#1f6b2a"
                style={styles.inputIcon}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={profileData.last_name}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, last_name: text })
                }
                placeholder="Last name"
                placeholderTextColor="#9aa0a6"
              />
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#1f6b2a"
                style={styles.inputIcon}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={profileData.location}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, location: text })
                }
                placeholder="City, Area"
                placeholderTextColor="#9aa0a6"
              />
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#1f6b2a"
                style={styles.inputIcon}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={profileData.phone_number}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, phone_number: text })
                }
                placeholder="+977 98XXXXXXXX"
                placeholderTextColor="#9aa0a6"
                keyboardType="phone-pad"
              />
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#1f6b2a"
                style={styles.inputIcon}
              />
            </View>
          </View>
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
  scroll: {
    flexGrow: 1,
    paddingBottom: 20,
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
    paddingVertical: 24,
  },
  imageContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#f3f5f7",
  },
  imageEditButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1f6b2a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  imageActionButtons: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
    alignItems: "center",
  },
  changePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f9f4",
    borderWidth: 1,
    borderColor: "#1f6b2a",
  },
  changePhotoText: {
    fontSize: 13,
    color: "#1f6b2a",
    fontWeight: "600",
  },
  removePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  removePhotoText: {
    fontSize: 13,
    color: "#ef4444",
    fontWeight: "600",
  },
  imageActionButtons: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
    alignItems: "center",
  },
  changePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f9f4",
    borderWidth: 1,
    borderColor: "#1f6b2a",
  },
  changePhotoText: {
    fontSize: 13,
    color: "#1f6b2a",
    fontWeight: "600",
  },
  removePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  removePhotoText: {
    fontSize: 13,
    color: "#ef4444",
    fontWeight: "600",
  },
  formSection: {
    paddingHorizontal: 18,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputWrapper: {
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f1f1f",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f5f6fa",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1f1f1f",
    borderWidth: 0,
  },
  inputIcon: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -9,
  },
});

export default EditProfileScreen;

