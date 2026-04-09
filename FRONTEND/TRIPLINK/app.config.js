// App + Play metadata. Launcher icons for Android are generated into android/app/src/main/res/
// when you run `npx expo prebuild --platform android` — `gradlew assembleRelease` alone does not
// re-copy the icon asset into mipmaps; re-run prebuild after changing assets/Logo.png.
//
// Adaptive icons: Android scales the foreground to a 108dp layer, then the launcher mask crops the
// outer rim. Edge-to-edge logos look "zoomed"; plugins/withAdaptiveIconInset.js adds ~20dp inset.
module.exports = {
  expo: {
    name: "TRIPLINK",
    slug: "TRIPLINK",
    version: "1.0.5",
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
      package: "com.rohandev.TRIPLINK",
      versionCode: 6,
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
      "./plugins/withAdaptiveIconInset",
    ],
  },
};

