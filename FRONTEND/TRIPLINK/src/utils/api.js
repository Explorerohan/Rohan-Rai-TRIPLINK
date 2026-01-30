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
 * Get reviews for a package
 * @param {number|string} packageId - Package ID
 * @returns {Promise<object>}
 */
export const getPackageReviews = async (packageId) => {
  const id = typeof packageId === "string" ? packageId : String(packageId);
  return apiRequest(`/api/auth/packages/${id}/reviews/`, { method: "GET" });
};

/**
 * Create a review for a package
 * @param {number|string} packageId - Package ID
 * @param {number} rating - Rating (1-5)
 * @param {string} comment - Review comment
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object>}
 */
export const createReview = async (packageId, rating, comment, accessToken) => {
  const id = typeof packageId === "string" ? packageId : String(packageId);
  return apiRequest(
    `/api/auth/packages/${id}/reviews/`,
    {
      method: "POST",
      body: JSON.stringify({ rating, comment }),
    },
    accessToken
  );
};

