module.exports = {
  expo: {
    name: "TRIPLINK",
    slug: "TRIPLINK",
    version: "1.0.0",
    sdkVersion: "52.0.0",
    newArchEnabled: true,
    ios: {
      deploymentTarget: "15.1",
      infoPlist: {
        NSPhotoLibraryUsageDescription: "This app needs access to your photo library to select profile pictures.",
        NSCameraUsageDescription: "This app needs access to your camera to take profile pictures.",
      },
    },
    android: {
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "READ_MEDIA_IMAGES",
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
    ],
  },
};

