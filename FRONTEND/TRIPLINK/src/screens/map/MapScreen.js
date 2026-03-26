import React, { useMemo } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";

const toNumberOrNull = (value) => {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidLatitude = (value) => value >= -90 && value <= 90;
const isValidLongitude = (value) => value >= -180 && value <= 180;
const LOCATIONIQ_KEY = process.env.EXPO_PUBLIC_LOCATIONIQ_KEY || "";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const MapScreen = ({ mapData = null, onBack = () => {} }) => {
  const { t } = useLanguage();

  const title = mapData?.title || t("tripLocation");
  const subtitle = mapData?.locationLabel || t("locationNotAvailable");
  const latitude = toNumberOrNull(mapData?.latitude);
  const longitude = toNumberOrNull(mapData?.longitude);
  const hasValidCoordinates =
    latitude != null &&
    longitude != null &&
    isValidLatitude(latitude) &&
    isValidLongitude(longitude);
  const hasLocationIqKey = LOCATIONIQ_KEY.trim().length > 0;

  const locationIqHtml = useMemo(() => {
    if (!hasValidCoordinates || !hasLocationIqKey) return null;

    const safeTitle = escapeHtml(title || "Selected place");
    const safeSubtitle = escapeHtml(subtitle || "");
    const key = LOCATIONIQ_KEY.trim();

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
      body { background: #f2f3f5; }
      .leaflet-control-attribution { font-size: 10px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      (function () {
        var lat = ${latitude};
        var lng = ${longitude};
        var map = L.map("map", { zoomControl: true }).setView([lat, lng], 14);

        L.tileLayer("https://{s}-tiles.locationiq.com/v3/streets/r/{z}/{x}/{y}.png?key=${key}", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.locationiq.com/">LocationIQ</a> | &copy; OpenStreetMap contributors'
        }).addTo(map);

        L.marker([lat, lng]).addTo(map).bindPopup("<b>${safeTitle}</b><br/>${safeSubtitle}");
      })();
    </script>
  </body>
</html>`;
  }, [hasValidCoordinates, hasLocationIqKey, latitude, longitude, subtitle, title]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.8} onPress={onBack}>
          <Ionicons name="chevron-back" size={22} color="#1f1f1f" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.rightSpacer} />
      </View>

      {hasValidCoordinates && hasLocationIqKey && locationIqHtml ? (
        <WebView
          style={styles.map}
          originWhitelist={["*"]}
          source={{ html: locationIqHtml }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
        />
      ) : (
        <View style={styles.fallbackCard}>
          <Ionicons name="map-outline" size={34} color="#6b7280" />
          <Text style={styles.fallbackTitle}>{t("mapUnavailable")}</Text>
          <Text style={styles.fallbackText}>
            {hasValidCoordinates ? "LocationIQ API key is missing." : t("missingCoordinatesMessage")}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f2f3f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  headerCenter: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
  },
  rightSpacer: {
    width: 36,
  },
  map: {
    flex: 1,
  },
  fallbackCard: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  fallbackTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  fallbackText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#6b7280",
    textAlign: "center",
  },
});

export default MapScreen;
