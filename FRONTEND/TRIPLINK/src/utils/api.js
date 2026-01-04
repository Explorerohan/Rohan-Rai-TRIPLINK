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
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || data.message || `HTTP error! status: ${response.status}`);
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

    const data = await response.json();
    
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
 * @returns {Promise<object>}
 */
export const getPackages = async (filters = {}) => {
  const queryParams = new URLSearchParams();
  if (filters.location) queryParams.append('location', filters.location);
  if (filters.country) queryParams.append('country', filters.country);
  
  const queryString = queryParams.toString();
  const endpoint = `/api/auth/packages/${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest(endpoint, { method: "GET" });
};

/**
 * Get package by ID
 * @param {number} packageId - Package ID
 * @returns {Promise<object>}
 */
export const getPackageById = async (packageId) => {
  return apiRequest(`/api/auth/packages/${packageId}/`, { method: "GET" });
};

