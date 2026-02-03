const API_BASE = "http://192.168.18.6:8000";

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint (e.g., '/api/auth/profile/')
 * @param {object} options - Fetch options
 * @param {string} accessToken - JWT access token
 * @returns {Promise<Response>}
 */
export const apiRequest = async (endpoint, options = {}, accessToken = null) => {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    let data;
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }

    if (!response.ok) {
      // DRF validation errors: { "field": ["msg"] } or { "detail": "..." }
      let message = data.detail || data.message;
      if (!message && typeof data === "object") {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const val = data[firstKey];
          message = Array.isArray(val) ? val[0] : val;
        }
      }
      throw new Error(message || `HTTP error ${response.status}`);
    }

    return { data, status: response.status };
  } catch (error) {
    throw error;
  }
};

/**
 * Make an authenticated multipart/form-data request (for file uploads)
 * @param {string} endpoint - API endpoint
 * @param {FormData} formData - FormData object
 * @param {string} accessToken - JWT access token
 * @returns {Promise<Response>}
 */
export const apiRequestMultipart = async (endpoint, formData, accessToken) => {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    // Don't set Content-Type for FormData - browser will set it with boundary
  };

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: formData,
    });

    let data;
    let rawText = null;
    try {
      rawText = await response.text();
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      data = { raw: rawText };
    }

    if (!response.ok) {
      // Log full error payload for debugging (field-level validation errors, etc.)
      console.log("Profile update error response:", response.status, data);

      // Try to surface a more helpful message if possible
      const messageFromDetail = data?.detail || data?.message;
      let messageFromFields = null;

      if (!messageFromDetail && data && typeof data === "object" && !Array.isArray(data)) {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const fieldError = data[firstKey];
          if (Array.isArray(fieldError) && fieldError.length > 0) {
            messageFromFields = `${firstKey}: ${fieldError[0]}`;
          } else if (typeof fieldError === "string") {
            messageFromFields = `${firstKey}: ${fieldError}`;
          }
        }
      }

      const finalMessage =
        messageFromDetail ||
        messageFromFields ||
        `HTTP error! status: ${response.status}`;

      throw new Error(finalMessage);
    }

    if (!response.ok) {
      throw new Error(data.detail || data.message || `HTTP error! status: ${response.status}`);
    }
    
    return { data, status: response.status };
  } catch (error) {
    throw error;
  }
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
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    let data;
    try {
      data = await response.json();
    } catch (_) {
      data = {};
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

