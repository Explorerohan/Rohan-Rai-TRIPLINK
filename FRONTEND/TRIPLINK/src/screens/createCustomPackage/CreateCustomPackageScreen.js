import React, { useState, useEffect } from "react";
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLanguage } from "../../context/LanguageContext";
import { getFeatures, createCustomPackage } from "../../utils/api";
import { useAppAlert } from "../../components/AppAlertProvider";

function formatDateToYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYYYYMMDD(str) {
  if (!str || typeof str !== "string") return null;
  const parts = str.trim().split("-").map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || m < 1 || m > 12 || !d || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

const CreateCustomPackageScreen = ({ session, onBack, onCreateSuccess }) => {
  const { t } = useLanguage();
  const { showAlert } = useAppAlert();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerPerson, setPricePerPerson] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [durationNights, setDurationNights] = useState("6");
  const [tripStartDate, setTripStartDate] = useState("");
  const [tripEndDate, setTripEndDate] = useState("");
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [mainImage, setMainImage] = useState(null);
  const [featureIds, setFeatureIds] = useState([]);
  const [features, setFeatures] = useState([]);
  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const startDateValue = parseYYYYMMDD(tripStartDate) || new Date();
  const endDateValue = parseYYYYMMDD(tripEndDate) || new Date();

  const onStartDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") setShowStartDatePicker(false);
    if (event?.type === "set" && selectedDate) setTripStartDate(formatDateToYYYYMMDD(selectedDate));
    if (event?.type === "cancel") setShowStartDatePicker(false);
  };

  const onEndDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") setShowEndDatePicker(false);
    if (event?.type === "set" && selectedDate) setTripEndDate(formatDateToYYYYMMDD(selectedDate));
    if (event?.type === "cancel") setShowEndDatePicker(false);
  };

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
        showAlert({ title: t("permissionNeeded") || "Permission needed", message: t("permissionNeededGallery"), type: "warning" });
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
      showAlert({ title: t("error"), message: t("failedToOpenGallery"), type: "error" });
    }
  };

  const handleSubmit = async () => {
    const trim = (s) => (typeof s === "string" ? s.trim() : "");
    if (!trim(title)) {
      showAlert({ title: t("required"), message: t("pleaseEnterTitle"), type: "warning" });
      return;
    }
    if (!trim(location)) {
      showAlert({ title: t("required"), message: t("pleaseEnterLocation"), type: "warning" });
      return;
    }
    if (!trim(country)) {
      showAlert({ title: t("required"), message: t("pleaseEnterCountry"), type: "warning" });
      return;
    }
    if (!trim(description)) {
      showAlert({ title: t("required"), message: t("pleaseEnterDescription"), type: "warning" });
      return;
    }
    const price = parseFloat(pricePerPerson);
    if (Number.isNaN(price) || price < 0) {
      showAlert({ title: t("error"), message: t("pleaseEnterValidPrice"), type: "warning" });
      return;
    }
    if (!trim(tripStartDate)) {
      showAlert({ title: t("required"), message: t("pleaseEnterTripStartDate"), type: "warning" });
      return;
    }
    if (!trim(tripEndDate)) {
      showAlert({ title: t("required"), message: t("pleaseEnterTripEndDate"), type: "warning" });
      return;
    }
    if (!session?.access) {
      showAlert({ title: t("error"), message: t("mustBeLoggedInToCreate"), type: "warning" });
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
      showAlert({
        title: t("success"),
        message: t("customPackageCreated"),
        type: "success",
        onOk: () => {
          onCreateSuccess?.(createdPackage);
          onBack?.();
        },
      });
    } catch (err) {
      const message = err?.message || t("couldNotCreatePackage");
      showAlert({ title: t("couldNotCreatePackageTitle"), message, type: "error" });
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
        <Text style={styles.headerTitle}>{t("createCustomPackageHeader")}</Text>
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
          <Text style={styles.label}>{t("titleRequired")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("placeholderTitle")}
            placeholderTextColor="#94a3b8"
            value={title}
            onChangeText={setTitle}
          />
          <Text style={styles.label}>{t("locationRequired")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("placeholderLocation")}
            placeholderTextColor="#94a3b8"
            value={location}
            onChangeText={setLocation}
          />
          <Text style={styles.label}>{t("countryRequired")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("placeholderCountry")}
            placeholderTextColor="#94a3b8"
            value={country}
            onChangeText={setCountry}
          />
          <Text style={styles.label}>{t("descriptionRequired")}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t("describeYourTrip")}
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
          <Text style={styles.label}>{t("pricePerPersonRs")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("placeholderPrice")}
            placeholderTextColor="#94a3b8"
            value={pricePerPerson}
            onChangeText={setPricePerPerson}
            keyboardType="numeric"
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>{t("durationDays")}</Text>
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
              <Text style={styles.label}>{t("nights")}</Text>
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
          <Text style={styles.label}>{t("tripStartDateRequired")}</Text>
          <TouchableOpacity
            style={[styles.input, styles.dateInput]}
            onPress={() => setShowStartDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={tripStartDate ? styles.dateText : styles.datePlaceholder}>
              {tripStartDate || t("tapToPickDate")}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#94a3b8" style={styles.dateIcon} />
          </TouchableOpacity>
          {showStartDatePicker && (
            <DateTimePicker
              value={startDateValue}
              mode="date"
              display={Platform.OS === "android" ? "calendar" : "default"}
              onChange={onStartDateChange}
              minimumDate={new Date()}
            />
          )}
          {showStartDatePicker && Platform.OS === "ios" && (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setShowStartDatePicker(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>{t("done")}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.label}>{t("tripEndDateRequired")}</Text>
          <TouchableOpacity
            style={[styles.input, styles.dateInput]}
            onPress={() => setShowEndDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={tripEndDate ? styles.dateText : styles.datePlaceholder}>
              {tripEndDate || t("tapToPickDate")}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#94a3b8" style={styles.dateIcon} />
          </TouchableOpacity>
          {showEndDatePicker && (
            <DateTimePicker
              value={endDateValue}
              mode="date"
              display={Platform.OS === "android" ? "calendar" : "default"}
              onChange={onEndDateChange}
              minimumDate={startDateValue || new Date()}
            />
          )}
          {showEndDatePicker && Platform.OS === "ios" && (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setShowEndDatePicker(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>{t("done")}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.label}>{t("coverImageOptional")}</Text>
          <TouchableOpacity style={styles.imageButton} onPress={pickImage} activeOpacity={0.8}>
            {mainImage?.uri ? (
              <Image source={{ uri: mainImage.uri }} style={styles.imagePreview} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={40} color="#94a3b8" />
                <Text style={styles.imagePlaceholderText}>{t("tapToAddImage")}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.label}>{t("featuresOptional")}</Text>
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
          <Text style={styles.label}>{t("additionalThingsOptional")}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t("additionalNotesPlaceholder")}
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
              <Text style={styles.submitButtonText}>{t("createCustomPackage")}</Text>
            )}
          </TouchableOpacity> 
          <Text style={styles.hint}>{t("thisPackageOnlyVisibleToYou")}</Text>
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
  dateInput: {
    paddingRight: 44,
  },
  dateText: {
    fontSize: 15,
    color: "#1e293b",
  },
  datePlaceholder: {
    fontSize: 15,
    color: "#94a3b8",
  },
  dateIcon: {
    position: "absolute",
    right: 14,
    top: 14,
  },
  doneButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f6b2a",
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
