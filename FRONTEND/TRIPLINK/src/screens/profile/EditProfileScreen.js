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

const EditProfileScreen = ({ session, onBack, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [profileData, setProfileData] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    date_of_birth: "",
    address: "",
    city: "",
    country: "",
    bio: "",
    // Agent-specific fields
    company_name: "",
    license_number: "",
    website: "",
  });
  const [profileImage, setProfileImage] = useState(null);
  const [profileImageUri, setProfileImageUri] = useState(null);
  const isAgent = session?.user?.role === "agent";

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
      const data = response.data;

      setProfileData({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        phone_number: data.phone_number || "",
        date_of_birth: data.date_of_birth || "",
        address: data.address || "",
        city: data.city || "",
        country: data.country || "",
        bio: data.bio || "",
        company_name: data.company_name || "",
        license_number: data.license_number || "",
        website: data.website || "",
      });

      if (data.profile_picture_url) {
        setProfileImageUri(data.profile_picture_url);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      Alert.alert("Error", "Failed to load profile data");
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

    setLoading(true);
    try {
      // Check if profile picture was removed (had image before, now null)
      const hadImageBefore = profileImageUri && !profileImageUri.includes("Assets");
      const imageRemoved = hadImageBefore && !profileImage;

      if (profileImage) {
        // Upload with new image
        const formData = new FormData();
        
        // Add text fields
        Object.keys(profileData).forEach((key) => {
          if (profileData[key] !== null && profileData[key] !== undefined && profileData[key] !== "") {
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
        if (onSave) onSave(response.data);
      } else if (imageRemoved) {
        // Profile picture was removed - send null to clear it
        const updateData = {
          ...profileData,
          profile_picture: null,
        };
        const response = await updateProfile(updateData, session.access);
        Alert.alert("Success", "Profile updated successfully!");
        if (onSave) onSave(response.data);
      } else {
        // Update without image (no change to image)
        const response = await updateProfile(profileData, session.access);
        Alert.alert("Success", "Profile updated successfully!");
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
                profileImageUri
                  ? { uri: profileImageUri }
                  : require("../../Assets/Logo.png")
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
            <TextInput
              style={styles.input}
              value={profileData.first_name}
              onChangeText={(text) =>
                setProfileData({ ...profileData, first_name: text })
              }
              placeholder="Enter first name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={profileData.last_name}
              onChangeText={(text) =>
                setProfileData({ ...profileData, last_name: text })
              }
              placeholder="Enter last name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={profileData.phone_number}
              onChangeText={(text) =>
                setProfileData({ ...profileData, phone_number: text })
              }
              placeholder="Enter phone number"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              value={profileData.date_of_birth}
              onChangeText={(text) =>
                setProfileData({ ...profileData, date_of_birth: text })
              }
              placeholder="YYYY-MM-DD"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profileData.address}
              onChangeText={(text) =>
                setProfileData({ ...profileData, address: text })
              }
              placeholder="Enter address"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={profileData.city}
              onChangeText={(text) =>
                setProfileData({ ...profileData, city: text })
              }
              placeholder="Enter city"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              value={profileData.country}
              onChangeText={(text) =>
                setProfileData({ ...profileData, country: text })
              }
              placeholder="Enter country"
            />
          </View>

          {isAgent && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Company Name</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.company_name}
                  onChangeText={(text) =>
                    setProfileData({ ...profileData, company_name: text })
                  }
                  placeholder="Enter company name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>License Number</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.license_number}
                  onChangeText={(text) =>
                    setProfileData({ ...profileData, license_number: text })
                  }
                  placeholder="Enter license number"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Website</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.website}
                  onChangeText={(text) =>
                    setProfileData({ ...profileData, website: text })
                  }
                  placeholder="https://example.com"
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profileData.bio}
              onChangeText={(text) =>
                setProfileData({ ...profileData, bio: text })
              }
              placeholder="Tell us about yourself"
              multiline
              numberOfLines={4}
            />
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f1f1f",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f3f5f7",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#e3e6ea",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});

export default EditProfileScreen;

