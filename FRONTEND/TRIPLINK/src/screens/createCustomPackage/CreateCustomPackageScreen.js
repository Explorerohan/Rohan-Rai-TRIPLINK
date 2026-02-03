import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
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
import * as ImagePicker from "expo-image-picker";
import { getFeatures, createCustomPackage } from "../../utils/api";

const CreateCustomPackageScreen = ({ session, onBack, onCreateSuccess }) => {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerPerson, setPricePerPerson] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [durationNights, setDurationNights] = useState("6");
  const [tripStartDate, setTripStartDate] = useState("");
  const [tripEndDate, setTripEndDate] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [mainImage, setMainImage] = useState(null);
  const [featureIds, setFeatureIds] = useState([]);
  const [features, setFeatures] = useState([]);
  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFeatures()
      .then((res) => {
        if (!cancelled && res?.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
          setFeatures(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {
        if (!cancelled) setFeatures([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFeatures(false);
      });
    return () => { cancelled = true; };
  }, []);

  const toggleFeature = (id) => {
    setFeatureIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions to upload an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        allowsMultiple: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        setMainImage(result.assets[0]);
      }
    } catch (e) {
      console.error("Image picker error:", e);
      Alert.alert("Error", "Failed to open gallery.");
    }
  };

  const handleSubmit = async () => {
    const trim = (s) => (typeof s === "string" ? s.trim() : "");
    if (!trim(title)) {
      Alert.alert("Required", "Please enter a title.");
      return;
    }
    if (!trim(location)) {
      Alert.alert("Required", "Please enter a location.");
      return;
    }
    if (!trim(country)) {
      Alert.alert("Required", "Please enter a country.");
      return;
    }
    if (!trim(description)) {
      Alert.alert("Required", "Please enter a description.");
      return;
    }
    const price = parseFloat(pricePerPerson);
    if (Number.isNaN(price) || price < 0) {
      Alert.alert("Invalid price", "Please enter a valid price per person.");
      return;
    }
    if (!trim(tripStartDate)) {
      Alert.alert("Required", "Please enter trip start date (YYYY-MM-DD).");
      return;
    }
    if (!trim(tripEndDate)) {
      Alert.alert("Required", "Please enter trip end date (YYYY-MM-DD).");
      return;
    }
    if (!session?.access) {
      Alert.alert("Error", "You must be logged in to create a custom package.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: trim(title),
        location: trim(location),
        country: trim(country),
        description: trim(description),
        price_per_person: price,
        duration_days: parseInt(durationDays, 10) || 7,
        duration_nights: parseInt(durationNights, 10) || 6,
        trip_start_date: trim(tripStartDate),
        trip_end_date: trim(tripEndDate),
        additional_notes: trim(additionalNotes) || "",
        feature_ids: featureIds,
      };
      if (mainImage) payload.main_image = mainImage;
      const res = await createCustomPackage(payload, session.access);
      const createdPackage = res?.data;
      Alert.alert("Success", "Your custom package has been created. Only you can see it.", [
        { text: "OK", onPress: () => { onCreateSuccess?.(createdPackage); onBack?.(); } },
      ]);
    } catch (err) {
      const message = err?.message || "Failed to create custom package. Please try again.";
      Alert.alert("Could not create package", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create custom package</Text>
        <View style={styles.headerRight} />
      </View>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Paris City Lights"
            placeholderTextColor="#94a3b8"
            value={title}
            onChangeText={setTitle}
          />
          <Text style={styles.label}>Location *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Paris"
            placeholderTextColor="#94a3b8"
            value={location}
            onChangeText={setLocation}
          />
          <Text style={styles.label}>Country *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. France"
            placeholderTextColor="#94a3b8"
            value={country}
            onChangeText={setCountry}
          />
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your trip..."
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
          <Text style={styles.label}>Price per person (Rs.) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 15000"
            placeholderTextColor="#94a3b8"
            value={pricePerPerson}
            onChangeText={setPricePerPerson}
            keyboardType="numeric"
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Duration (days)</Text>
              <TextInput
                style={styles.input}
                placeholder="7"
                placeholderTextColor="#94a3b8"
                value={durationDays}
                onChangeText={setDurationDays}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Nights</Text>
              <TextInput
                style={styles.input}
                placeholder="6"
                placeholderTextColor="#94a3b8"
                value={durationNights}
                onChangeText={setDurationNights}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <Text style={styles.label}>Trip start date *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            value={tripStartDate}
            onChangeText={setTripStartDate}
          />
          <Text style={styles.label}>Trip end date *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            value={tripEndDate}
            onChangeText={setTripEndDate}
          />
          <Text style={styles.label}>Cover image (optional)</Text>
          <TouchableOpacity style={styles.imageButton} onPress={pickImage} activeOpacity={0.8}>
            {mainImage?.uri ? (
              <Image source={{ uri: mainImage.uri }} style={styles.imagePreview} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={40} color="#94a3b8" />
                <Text style={styles.imagePlaceholderText}>Tap to add image</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.label}>Features (optional)</Text>
          {loadingFeatures ? (
            <ActivityIndicator size="small" color="#1f6b2a" style={styles.featureLoader} />
          ) : (
            <View style={styles.featureList}>
              {features.map((f) => {
                const selected = featureIds.includes(f.id);
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.featureChip, selected && styles.featureChipSelected]}
                    onPress={() => toggleFeature(f.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.featureChipText, selected && styles.featureChipTextSelected]}>{f.name}</Text>
                    {selected && <Ionicons name="checkmark" size={18} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <Text style={styles.label}>Additional things to consider on this trip (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g. only flights as transportation, only 5 star hotels, any local transportation, etc."
            placeholderTextColor="#94a3b8"
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Create custom package</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.hint}>This package is only visible to you.</Text>
          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
  },
  headerRight: {
    width: 32,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1e293b",
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  half: {
    flex: 1,
  },
  imageButton: {
    marginBottom: 16,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  imagePreview: {
    width: "100%",
    height: 160,
  },
  imagePlaceholder: {
    width: "100%",
    height: 120,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 6,
  },
  featureLoader: {
    marginVertical: 8,
  },
  featureList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  featureChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    gap: 6,
  },
  featureChipSelected: {
    backgroundColor: "#1f6b2a",
  },
  featureChipText: {
    fontSize: 13,
    color: "#475569",
  },
  featureChipTextSelected: {
    color: "#fff",
  },
  submitButton: {
    backgroundColor: "#1f6b2a",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  hint: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 12,
  },
  bottomPad: {
    height: 40,
  },
});

export default CreateCustomPackageScreen;
