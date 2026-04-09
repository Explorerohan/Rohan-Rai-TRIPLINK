/**
 * Central config for API base URL.
 * Override with EXPO_PUBLIC_API_BASE in .env — rebuild APK after changing.
 */
export const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ||
    "https://rohan-rai-triplink.onrender.com"
).replace(/\/$/, "");
