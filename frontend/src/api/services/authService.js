/**
 * Auth Service - Handles all authentication operations
 */

import { apiClient } from "../client.js";

export const authService = {
  /**
   * Register a new user
   */
  async register(email, password, name) {
    const data = await apiClient.post("/auth/signup", {
      email,
      password,
      name,
    });
    
    // Store token if provided
    if (data.token) {
      apiClient.setToken(data.token);
    }
    
    return data.user;
  },

  /**
   * Login user
   */
  async login(email, password) {
    const data = await apiClient.post("/auth/login", {
      email,
      password,
    });

    // Store token if provided
    if (data.token) {
      apiClient.setToken(data.token);
    }

    return data.user;
  },

  /**
   * Verify user session
   */
  async verify() {
    const token = apiClient.getToken();
    if (!token) {
      return null;
    }

    try {
      const data = await apiClient.post("/auth/verify", {});
      return data.user;
    } catch (error) {
      // Token invalid, clear it
      apiClient.clearAuth();
      throw error;
    }
  },

  /**
   * Logout user
   */
  logout() {
    apiClient.clearAuth();
  },

  /**
   * Set token from external source (e.g., redirect)
   */
  setToken(token) {
    apiClient.setToken(token);
  },

  /**
   * Get current token
   */
  getToken() {
    return apiClient.getToken();
  },

  /**
   * Check if token exists
   */
  isAuthenticated() {
    return !!apiClient.getToken();
  },
};
