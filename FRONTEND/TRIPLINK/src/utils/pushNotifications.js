import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request permission and return Expo push token string, or null (simulator / denied / error).
 */
export async function registerForExpoPushTokenAsync() {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1f6b2a",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    Constants?.manifest?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn(
      "Expo push registration failed: missing EAS projectId. Set it in app.json under expo.extra.eas.projectId."
    );
    return null;
  }

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data || null;
}

/** Subscribe to user tapping a notification (app was backgrounded). Returns a subscription with `.remove()`. */
export function subscribeToNotificationResponse(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/** If the app was opened by tapping a notification, invoke handler once with that response. */
export function consumeInitialNotificationResponse(handler) {
  return Notifications.getLastNotificationResponseAsync().then((last) => {
    if (last) handler(last);
  });
}
