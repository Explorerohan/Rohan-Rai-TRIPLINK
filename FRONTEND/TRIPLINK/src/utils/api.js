const API_BASE = "http://192.168.18.6:8000";

// Token refresh: when we get 401, get new access token and retry (or log out if refresh fails)
let tokenRefreshHandler = null;
// Single refresh in flight so concurrent 401s don't trigger multiple refresh calls
let refreshPromise = null;

/**
 * Register handler for token refresh. Call from App with getRefreshToken, onNewAccessToken, onRefreshFailed.
 * onNewAccessToken(access, refresh?) – refresh optional if backend returns new refresh token.
 * @param {{ getRefreshToken: () => string|null, onNewAccessToken: (access: string, refresh?: string) => void, onRefreshFailed?: () => void }} handler
 */
export const setTokenRefreshHandler = (handler) => {
  tokenRefreshHandler = handler;
};

/**
 * Call backend refresh endpoint; returns { access, refresh? } or throws.
 * @param {string} refreshToken
 * @returns {Promise<{ access: string, refresh?: string }>}
 */
export const refreshAccessToken = async (refreshToken) => {
  const url = `${API_BASE}/api/auth/refresh/`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  let data = {};
  try {
    data = await response.json();
  } catch (_) {}
  if (!response.ok) {
    const msg = data.detail || data.message || `Refresh failed (${response.status})`;
    throw new Error(msg);
  }
  if (!data.access) throw new Error("No access token in refresh response");
  return { access: data.access, refresh: data.refresh || null };
};

/**
 * Make an authenticated API request. On 401, tries to refresh token and retry once.
 * @param {string} endpoint - API endpoint (e.g., '/api/auth/profile/')
 * @param {object} options - Fetch options
 * @param {string} accessToken - JWT access token
 * @returns {Promise<Response>}
 */
export const apiRequest = async (endpoint, options = {}, accessToken = null) => {
  const doRequest = async (token) => {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const config = { ...options, headers };
    const response = await fetch(url, config);
    let data;
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }
    return { response, data };
  };

  let result = await doRequest(accessToken);

  if (result.response.status === 401 && accessToken && tokenRefreshHandler) {
    const refreshToken = tokenRefreshHandler.getRefreshToken && tokenRefreshHandler.getRefreshToken();
    if (refreshToken) {
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken(refreshToken).then((tokens) => {
            if (tokenRefreshHandler.onNewAccessToken) tokenRefreshHandler.onNewAccessToken(tokens.access, tokens.refresh);
            return tokens;
          }).finally(() => { refreshPromise = null; });
        }
        const tokens = await refreshPromise;
        result = await doRequest(tokens.access);
      } catch (refreshErr) {
        refreshPromise = null;
        if (tokenRefreshHandler.onRefreshFailed) tokenRefreshHandler.onRefreshFailed();
        const msg = result.data?.detail || result.data?.message || "Session expired. Please log in again.";
        throw new Error(msg);
      }
    }
  }

  if (!result.response.ok) {
    const data = result.data;
    let message = data.detail || data.message;
    if (!message && typeof data === "object") {
      const firstKey = Object.keys(data)[0];
      if (firstKey) {
        const val = data[firstKey];
        message = Array.isArray(val) ? val[0] : val;
      }
    }
    throw new Error(message || `HTTP error ${result.response.status}`);
  }

  return { data: result.data, status: result.response.status };
};

/**
 * Make an authenticated multipart/form-data request (for file uploads). On 401, tries refresh and retry once.
 * @param {string} endpoint - API endpoint
 * @param {FormData} formData - FormData object
 * @param {string} accessToken - JWT access token
 * @returns {Promise<Response>}
 */
export const apiRequestMultipart = async (endpoint, formData, accessToken) => {
  const doRequest = async (token) => {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    let data;
    try {
      const rawText = await response.text();
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      data = {};
    }
    return { response, data };
  };

  let result = await doRequest(accessToken);

  if (result.response.status === 401 && accessToken && tokenRefreshHandler) {
    const refreshToken = tokenRefreshHandler.getRefreshToken && tokenRefreshHandler.getRefreshToken();
    if (refreshToken) {
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken(refreshToken).then((tokens) => {
            if (tokenRefreshHandler.onNewAccessToken) tokenRefreshHandler.onNewAccessToken(tokens.access, tokens.refresh);
            return tokens;
          }).finally(() => { refreshPromise = null; });
        }
        const tokens = await refreshPromise;
        result = await doRequest(tokens.access);
      } catch (refreshErr) {
        refreshPromise = null;
        if (tokenRefreshHandler.onRefreshFailed) tokenRefreshHandler.onRefreshFailed();
        throw new Error(result.data?.detail || result.data?.message || "Session expired. Please log in again.");
      }
    }
  }

  if (!result.response.ok) {
    const data = result.data;
    const messageFromDetail = data?.detail || data?.message;
    let messageFromFields = null;
    if (!messageFromDetail && data && typeof data === "object" && !Array.isArray(data)) {
      const firstKey = Object.keys(data)[0];
      if (firstKey) {
        const fieldError = data[firstKey];
        messageFromFields = Array.isArray(fieldError) ? fieldError[0] : fieldError;
      }
    }
    throw new Error(messageFromDetail || messageFromFields || `HTTP error ${result.response.status}`);
  }

  return { data: result.data, status: result.response.status };
};

/**
 * Get user profile
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const getProfile = async (accessToken) => {
  return apiRequest("/api/auth/profile/", { method: "GET" }, accessToken);
};

/**
 * Update user profile
 * @param {object} profileData - Profile data to update
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const updateProfile = async (profileData, accessToken) => {
  return apiRequest(
    "/api/auth/profile/",
    {
      method: "PUT",
      body: JSON.stringify(profileData),
    },
    accessToken
  );
};

/**
 * Update profile with image
 * @param {FormData} formData - FormData with profile data and image
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const updateProfileWithImage = async (formData, accessToken) => {
  return apiRequestMultipart("/api/auth/profile/", formData, accessToken);
};

/**
 * Get all packages
 * @param {object} filters - Optional filters (location, country)
 * @param {string} accessToken - Optional JWT; when provided, response includes user_has_booked per package
 * @returns {Promise<object>}
 */
export const getPackages = async (filters = {}, accessToken = null) => {
  const queryParams = new URLSearchParams();
  if (filters.location) queryParams.append('location', filters.location);
  if (filters.country) queryParams.append('country', filters.country);
  if (filters.date) queryParams.append('date', filters.date);
  
  const queryString = queryParams.toString();
  const endpoint = `/api/auth/packages/${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest(endpoint, { method: "GET" }, accessToken);
};

/**
 * Get package by ID (optional token for user_has_booked when logged in)
 * @param {number|string} packageId - Package ID
 * @param {string} accessToken - Optional JWT
 * @returns {Promise<object>}
 */
export const getPackageById = async (packageId, accessToken = null) => {
  const id = typeof packageId === "string" ? packageId : String(packageId);
  return apiRequest(`/api/auth/packages/${id}/`, { method: "GET" }, accessToken);
};

/**
 * Create a booking for the current user (traveler)
 * @param {number|string} packageId - Package ID to book
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const createBooking = async (packageId, accessToken) => {
  const id = typeof packageId === "string" ? parseInt(packageId, 10) : packageId;
  return apiRequest(
    "/api/auth/bookings/",
    {
      method: "POST",
      body: JSON.stringify({ package_id: id }),
    },
    accessToken
  );
};

/**
 * Get current user's bookings
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const getMyBookings = async (accessToken) => {
  return apiRequest("/api/auth/bookings/", { method: "GET" }, accessToken);
};

/**
 * Cancel a booking (traveler only). Sets status to \"cancelled\".
 * Backend enforces that this is only allowed up to 2 days before trip_start_date.
 * @param {number|string} bookingId - Booking id
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const cancelBooking = async (bookingId, accessToken) => {
  const id = typeof bookingId === "string" ? bookingId : String(bookingId);
  return apiRequest(`/api/auth/bookings/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" }),
  }, accessToken);
};

/**
 * Get reviews for an agent
 * @param {number|string} agentId - Agent (user) ID
 * @returns {Promise<object>}
 */
export const getAgentReviews = async (agentId) => {
  const id = typeof agentId === "string" ? agentId : String(agentId);
  return apiRequest(`/api/auth/agents/${id}/reviews/`, { method: "GET" });
};

/**
 * Create a review for an agent (only after completing a trip with that agent)
 * @param {number|string} agentId - Agent (user) ID
 * @param {number} rating - Rating (1-5)
 * @param {string} comment - Review comment
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const createAgentReview = async (agentId, rating, comment, accessToken) => {
  const id = typeof agentId === "string" ? agentId : String(agentId);
  return apiRequest(
    `/api/auth/agents/${id}/reviews/`,
    {
      method: "POST",
      body: JSON.stringify({ rating, comment }),
    },
    accessToken
  );
};

/**
 * Get list of package features (for custom package / agent forms)
 * @returns {Promise<object>}
 */
export const getFeatures = async () => {
  return apiRequest("/api/auth/features/", { method: "GET" });
};

/**
 * Get current user's custom packages (traveler only)
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const getCustomPackages = async (accessToken) => {
  return apiRequest("/api/auth/custom-packages/", { method: "GET" }, accessToken);
};

/**
 * Get a single custom package by id (traveler's own only)
 * @param {number} id - Custom package id
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const getCustomPackageById = async (id, accessToken) => {
  return apiRequest(`/api/auth/custom-packages/${id}/`, { method: "GET" }, accessToken);
};

/**
 * Update a custom package (traveler's own only). Use to cancel: { status: "cancelled" }.
 * @param {number} id - Custom package id
 * @param {object} payload - Partial update, e.g. { status: "cancelled" }
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const updateCustomPackage = async (id, payload, accessToken) => {
  return apiRequest(`/api/auth/custom-packages/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, accessToken);
};

/**
 * Delete a custom package (traveler's own only).
 * @param {number} id - Custom package id
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const deleteCustomPackage = async (id, accessToken) => {
  return apiRequest(`/api/auth/custom-packages/${id}/`, { method: "DELETE" }, accessToken);
};

/**
 * Create a custom package (traveler only). Sends JSON or FormData if main_image is provided.
 * @param {object} payload - { title, location, country, description, price_per_person, duration_days, duration_nights, trip_start_date?, trip_end_date?, feature_ids?, additional_notes?, main_image? (uri for FormData) }
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const createCustomPackage = async (payload, accessToken) => {
  const hasImage = payload.main_image != null && typeof payload.main_image === "object" && payload.main_image.uri;
  if (hasImage) {
    const formData = new FormData();
    formData.append("title", payload.title || "");
    formData.append("location", payload.location || "");
    formData.append("country", payload.country || "");
    formData.append("description", payload.description || "");
    formData.append("price_per_person", String(payload.price_per_person ?? ""));
    formData.append("duration_days", String(payload.duration_days ?? 7));
    formData.append("duration_nights", String(payload.duration_nights ?? 6));
    if (payload.trip_start_date) formData.append("trip_start_date", payload.trip_start_date);
    if (payload.trip_end_date) formData.append("trip_end_date", payload.trip_end_date);
    if (payload.additional_notes) formData.append("additional_notes", payload.additional_notes);
    if (Array.isArray(payload.feature_ids)) {
      payload.feature_ids.forEach((id) => formData.append("feature_ids", String(id)));
    }
    const uri = payload.main_image.uri;
    const name = uri.split("/").pop() || "image.jpg";
    formData.append("main_image", { uri, name, type: "image/jpeg" });
    const url = `${API_BASE}/api/auth/custom-packages/`;
    let token = accessToken;
    let response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
    let data;
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }
    if (response.status === 401 && token && tokenRefreshHandler) {
      const refreshToken = tokenRefreshHandler.getRefreshToken && tokenRefreshHandler.getRefreshToken();
      if (refreshToken) {
        try {
          if (!refreshPromise) {
            refreshPromise = refreshAccessToken(refreshToken).then((tokens) => {
              if (tokenRefreshHandler.onNewAccessToken) tokenRefreshHandler.onNewAccessToken(tokens.access, tokens.refresh);
              return tokens;
            }).finally(() => { refreshPromise = null; });
          }
          const tokens = await refreshPromise;
          token = tokens.access;
          response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
          try {
            data = await response.json();
          } catch (_) {
            data = {};
          }
        } catch (refreshErr) {
          refreshPromise = null;
          if (tokenRefreshHandler.onRefreshFailed) tokenRefreshHandler.onRefreshFailed();
          throw new Error(data?.detail || data?.message || "Session expired. Please log in again.");
        }
      }
    }
    if (!response.ok) {
      const msg = data.detail || data.message || (data && typeof data === "object" && Object.keys(data)[0] && (Array.isArray(data[Object.keys(data)[0]]) ? data[Object.keys(data)[0]][0] : data[Object.keys(data)[0]])) || `HTTP ${response.status}`;
      throw new Error(msg);
    }
    return { data, status: response.status };
  }
  const body = {
    title: payload.title || "",
    location: payload.location || "",
    country: payload.country || "",
    description: payload.description || "",
    price_per_person: payload.price_per_person ?? 0,
    duration_days: payload.duration_days ?? 7,
    duration_nights: payload.duration_nights ?? 6,
    trip_start_date: payload.trip_start_date || null,
    trip_end_date: payload.trip_end_date || null,
    additional_notes: payload.additional_notes || "",
    feature_ids: Array.isArray(payload.feature_ids) ? payload.feature_ids : [],
  };
  return apiRequest("/api/auth/custom-packages/", { method: "POST", body: JSON.stringify(body) }, accessToken);
};

// ---- Chat API ----

/**
 * Get WebSocket base URL from API_BASE (http -> ws, https -> wss)
 */
export const getWebSocketBase = () => {
  const base = API_BASE.replace(/^http/, "ws");
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

/**
 * Get list of chat rooms for the current user
 * @param {string} accessToken - JWT access token
 * @returns {Promise<{ data: Array }>}
 */
export const getChatRooms = async (accessToken) => {
  return apiRequest("/api/auth/chat/rooms/", { method: "GET" }, accessToken);
};

/**
 * Create or get a chat room
 * @param {{ agent_id?: number, traveler_id?: number }} payload - agent_id (traveler) or traveler_id (agent)
 * @param {string} accessToken - JWT access token
 * @returns {Promise<{ data: object }>}
 */
export const createChatRoom = async (payload, accessToken) => {
  return apiRequest("/api/auth/chat/rooms/", {
    method: "POST",
    body: JSON.stringify(payload),
  }, accessToken);
};

/**
 * Get messages in a chat room
 * @param {number|string} roomId - Room ID
 * @param {string} accessToken - JWT access token
 * @returns {Promise<{ data: Array }>}
 */
export const getChatMessages = async (roomId, accessToken) => {
  const id = typeof roomId === "string" ? roomId : String(roomId);
  return apiRequest(`/api/auth/chat/rooms/${id}/messages/`, { method: "GET" }, accessToken);
};

/**
 * Get total unread message count for the current user
 * @param {string} accessToken - JWT access token
 * @returns {Promise<{ data: { count: number } }>}
 */
export const getUnreadCount = async (accessToken) => {
  return apiRequest("/api/auth/chat/unread-count/", { method: "GET" }, accessToken);
};

/**
 * Mark all messages in a room as read
 * @param {number|string} roomId - Room ID
 * @param {string} accessToken - JWT access token
 */
export const markRoomRead = async (roomId, accessToken) => {
  const id = typeof roomId === "string" ? roomId : String(roomId);
  return apiRequest(`/api/auth/chat/rooms/${id}/mark-read/`, { method: "POST" }, accessToken);
};

/**
 * Send a message via REST (fallback when WebSocket not connected)
 * @param {number|string} roomId - Room ID
 * @param {{ text: string }} payload
 * @param {string} accessToken - JWT access token
 * @returns {Promise<{ data: object }>}
 */
export const sendChatMessage = async (roomId, payload, accessToken) => {
  const id = typeof roomId === "string" ? roomId : String(roomId);
  return apiRequest(`/api/auth/chat/rooms/${id}/messages/`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, accessToken);
};

