/**
 * Central config for API base URL.
 * Set EXPO_PUBLIC_API_BASE in .env (e.g. http://192.168.1.50:8000) then rebuild the app.
 * Must match your PC's LAN IP and the port Django/Daphne listens on (use 0.0.0.0:8000 on the server).
 */
export const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE || "http://192.168.18.6:8000"
).replace(/\/$/, "");
