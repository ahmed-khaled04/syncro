/**
 * DEPRECATED: Use authService from api/services/authService.js instead
 * This file is kept for backwards compatibility
 */

import { authService } from "./services/authService.js";

// Map old API names to new service names for backwards compatibility
export const authAPI = {
  signup: (email, password, name) => authService.register(email, password, name),
  login: authService.login,
  getCurrentUser: authService.verify,
  logout: authService.logout,
  getToken: authService.getToken,
};

