module.exports = {
  expo: {
    name: "TRIPLINK",
    slug: "TRIPLINK",
    version: "1.0.0",
    icon: "./assets/Logo.png",
    sdkVersion: "52.0.0",
    newArchEnabled: false,
    extra: {
      eas: {
        projectId: "6193951f-6227-4e24-be29-7651f8900c79",
      },
    },
    ios: {
      deploymentTarget: "15.1",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
      },
      infoPlist: {
        NSPhotoLibraryUsageDescription: "This app needs access to your photo library to select profile pictures.",
        NSCameraUsageDescription: "This app needs access to your camera to take profile pictures.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/Logo.png",
        backgroundColor: "#ffffff",
      },
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        },
      },
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "READ_MEDIA_IMAGES",
        "POST_NOTIFICATIONS",
      ],
    },
    plugins: [
      [
        "expo-image-picker",
        {
          photosPermission: "The app accesses your photos to let you share them as your profile picture.",
          cameraPermission: "The app accesses your camera to let you take a profile picture.",
        },
      ],
      [
        "expo-notifications",
        {
          color: "#1f6b2a",
          defaultChannel: "default",
        },
      ],
    ],
  },
};

