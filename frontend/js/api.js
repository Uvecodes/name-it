/**
 * API Client for NAME IT SCENTS
 * Handles all API communication with the backend
 */

// API Base URL: set globally for all frontend calls.
// Uses same-origin /api by default so backend host stays out of frontend code.
window.API_BASE_URL = window.API_BASE_URL || '/api';

const API_BASE_URL = String(window.API_BASE_URL || '/api').replace(/\/$/, '');

class APIClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('authToken') || null;
  }

  /**
   * Set authentication token
   * @param {string} token - JWT token
   */
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  /**
   * Get authentication token
   * @returns {string|null} Token or null
   */
  getToken() {
    return this.token || localStorage.getItem('authToken');
  }

  /**
   * Make API request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {string} userData.email - User email
   * @param {string} userData.password - User password
   * @param {string} userData.name - User name
   * @param {string} userData.phoneNumber - User phone number (optional)
   * @returns {Promise<Object>} Registration response with token and user
   */
  async register(userData) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: userData,
    });

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Login response with token and user
   */
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  /**
   * Logout user
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } finally {
      this.setToken(null);
    }
  }

  /**
   * Get current user information
   * @returns {Promise<Object>} User data
   */
  async getCurrentUser() {
    return await this.request('/auth/me');
  }

  /**
   * Send password reset email
   * @param {string} email - User email
   * @returns {Promise<Object>} Response data
   */
  async forgotPassword(email) {
    return await this.request('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  }

  /**
   * Check if user is authenticated (has valid token)
   * @returns {boolean} True if token exists
   */
  isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * Verify token validity with backend
   * @returns {Promise<Object>} Verification response with user data
   */
  async verify() {
    try {
      const userData = await this.getCurrentUser();
      return {
        valid: true,
        user: userData.user,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  // Products methods
  /**
   * Get products with optional filters
   * @param {Object} params - Query parameters (popular, status, category, limit, offset)
   * @returns {Promise<Object>} Products response
   */
  async getProducts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/products${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get popular products
   * @param {number} limit - Maximum number of products
   * @returns {Promise<Object>} Products response
   */
  async getPopularProducts(limit = 10) {
    return await this.request(`/products/popular?limit=${limit}`);
  }

  /**
   * Get products by category
   * @param {string} category - Product category
   * @param {number} limit - Maximum number of products
   * @returns {Promise<Object>} Products response
   */
  async getProductsByCategory(category, limit = null) {
    const limitParam = limit ? `?limit=${limit}` : '';
    return await this.request(`/products/category/${category}${limitParam}`);
  }

  /**
   * Get single product by ID
   * @param {string} id - Product ID
   * @returns {Promise<Object>} Product response
   */
  async getProduct(id) {
    return await this.request(`/products/${id}`);
  }

  // Orders methods
  /**
   * Create a new order
   * @param {Object} orderData - Order data
   * @returns {Promise<Object>} Order creation response
   */
  async createOrder(orderData) {
    return await this.request('/orders', {
      method: 'POST',
      body: orderData,
    });
  }

  /**
   * Get current user's orders
   * @param {number} limit - Maximum number of orders
   * @returns {Promise<Object>} Orders response
   */
  async getOrders(limit = null) {
    const limitParam = limit ? `?limit=${limit}` : '';
    return await this.request(`/orders${limitParam}`);
  }

  /**
   * Get order by ID
   * @param {string} id - Order ID
   * @returns {Promise<Object>} Order response
   */
  async getOrder(id) {
    return await this.request(`/orders/${id}`);
  }

  // Storage methods
  /**
   * Upload file
   * @param {File} file - File to upload
   * @param {string} path - Optional custom path
   * @returns {Promise<Object>} Upload response with URL
   */
  async uploadFile(file, path = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (path) {
      formData.append('path', path);
    }

    const token = this.getToken();
    const url = `${this.baseURL}/storage/upload`;

    const config = {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  /**
   * Get file download URL
   * @param {string} path - File path
   * @returns {Promise<Object>} URL response
   */
  async getFileURL(path) {
    return await this.request(`/storage/url/${encodeURIComponent(path)}`);
  }

  /**
   * Delete file
   * @param {string} path - File path
   * @returns {Promise<Object>} Delete response
   */
  async deleteFile(path) {
    return await this.request(`/storage/${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
  }

  // Analytics methods
  /**
   * Log analytics event
   * @param {string} eventName - Event name
   * @param {Object} eventParams - Event parameters
   * @returns {Promise<Object>} Log response
   */
  async logEvent(eventName, eventParams = {}) {
    return await this.request('/analytics/events', {
      method: 'POST',
      body: { eventName, eventParams },
    });
  }

  /**
   * Log page view
   * @param {string} page - Page path
   * @returns {Promise<Object>} Log response
   */
  async logPageView(page) {
    return await this.request('/analytics/pageview', {
      method: 'POST',
      body: { page },
    });
  }

  // ============================================
  // WISHLIST METHODS
  // ============================================

  /**
   * Get user's wishlist
   * @returns {Promise<Object>} Wishlist response
   */
  async getWishlist() {
    return await this.request('/wishlist');
  }

  /**
   * Add product to wishlist
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Response
   */
  async addToWishlist(productId) {
    return await this.request(`/wishlist/${productId}`, {
      method: 'POST',
    });
  }

  /**
   * Remove product from wishlist
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Response
   */
  async removeFromWishlist(productId) {
    return await this.request(`/wishlist/${productId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get wishlist item count
   * @returns {Promise<Object>} Count response
   */
  async getWishlistCount() {
    return await this.request('/wishlist/count');
  }

  /**
   * Check if product is in wishlist
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Response with inWishlist boolean
   */
  async isInWishlist(productId) {
    return await this.request(`/wishlist/check/${productId}`);
  }

  // ============================================
  // ACTIVITY METHODS
  // ============================================

  /**
   * Get user's recent activity
   * @param {number} limit - Maximum number of activities
   * @returns {Promise<Object>} Activity response
   */
  async getActivity(limit = 10) {
    return await this.request(`/activity?limit=${limit}`);
  }

  /**
   * Log a user activity
   * @param {string} type - Activity type
   * @param {string} description - Activity description
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Response
   */
  async logActivity(type, description, metadata = {}) {
    return await this.request('/activity', {
      method: 'POST',
      body: { type, description, metadata },
    });
  }

  // ============================================
  // REWARDS METHODS
  // ============================================

  /**
   * Get user's rewards summary
   * @returns {Promise<Object>} Rewards summary
   */
  async getRewards() {
    return await this.request('/rewards');
  }

  /**
   * Get rewards transaction history
   * @param {number} limit - Maximum number of transactions
   * @returns {Promise<Object>} History response
   */
  async getRewardsHistory(limit = 20) {
    return await this.request(`/rewards/history?limit=${limit}`);
  }

  /**
   * Redeem reward points
   * @param {number} points - Points to redeem
   * @param {string} reason - Reason for redemption
   * @returns {Promise<Object>} Redemption response
   */
  async redeemPoints(points, reason = '') {
    return await this.request('/rewards/redeem', {
      method: 'POST',
      body: { points, reason },
    });
  }

  // ============================================
  // PROFILE METHODS
  // ============================================

  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<Object>} Updated profile
   */
  async updateProfile(profileData) {
    return await this.request('/auth/profile', {
      method: 'PUT',
      body: profileData,
    });
  }

  /**
   * Update avatar
   * @param {string} avatarUrl - Avatar URL
   * @returns {Promise<Object>} Response
   */
  async updateAvatar(avatarUrl) {
    return await this.request('/auth/avatar', {
      method: 'POST',
      body: { avatarUrl },
    });
  }

  /**
   * Upload avatar file and update profile
   * @param {File} file - Image file
   * @returns {Promise<Object>} Response with avatar URL
   */
  async uploadAvatar(file) {
    // First upload the file
    const uploadResponse = await this.uploadFile(file, `avatars/${Date.now()}-${file.name}`);
    
    // Then update the profile with the new URL
    if (uploadResponse.url) {
      await this.updateAvatar(uploadResponse.url);
      return { avatarUrl: uploadResponse.url };
    }
    
    throw new Error('Failed to upload avatar');
  }

  // ============================================
  // ACCOUNT MANAGEMENT METHODS
  // ============================================

  /**
   * Change user password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {string} confirmPassword - Confirm new password
   * @returns {Promise<Object>} Response
   */
  async changePassword(currentPassword, newPassword, confirmPassword) {
    return await this.request('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword, confirmPassword },
    });
  }

  /**
   * Delete user account
   * @param {string} password - User password for verification
   * @param {string} confirmDelete - Must be 'DELETE' to confirm
   * @returns {Promise<Object>} Response
   */
  async deleteAccount(password, confirmDelete = 'DELETE') {
    return await this.request('/auth/account', {
      method: 'DELETE',
      body: { password, confirmDelete },
    });
  }
}

// Create singleton instance and expose to window
const apiClient = new APIClient();
window.apiClient = apiClient;

// Also create authAPI alias for backward compatibility
window.authAPI = {
  login: (email, password) => apiClient.login(email, password),
  register: (userData) => apiClient.register(userData),
  signup: (userData) => apiClient.register(userData), // Alias for register
  logout: () => apiClient.logout(),
  getCurrentUser: () => apiClient.getCurrentUser(),
  forgotPassword: (email) => apiClient.forgotPassword(email),
  isAuthenticated: () => apiClient.isAuthenticated(),
  verify: () => apiClient.verify(),
};

// Removed export default - using window.apiClient for global access instead
// Export statement removed because scripts are loaded without type="module"
