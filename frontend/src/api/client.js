/**
 * HTTP Client with interceptors for authentication, error handling, and logging
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

class APIClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.timeout = 10000; // 10 seconds
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Set or get the authentication token
   */
  setToken(token) {
    if (token) {
      localStorage.setItem("syncro-token", token);
    } else {
      localStorage.removeItem("syncro-token");
    }
  }

  getToken() {
    return localStorage.getItem("syncro-token");
  }

  /**
   * Clear token and perform logout
   */
  clearAuth() {
    this.setToken(null);
  }

  /**
   * Main fetch wrapper with error handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    // Merge default options
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    // Always include auth token if available
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request logging in development
    if (import.meta.env.DEV) {
      console.log(`📤 ${config.method || "GET"} ${endpoint}`, {
        hasAuth: !!token,
        body: config.body ? JSON.parse(config.body) : null,
      });
    }

    // Retry logic for network failures
    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await Promise.race([
          fetch(url, config),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Request timeout")), this.timeout)
          ),
        ]);

        // Handle response
        return await this.handleResponse(response, endpoint);
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx) or if last attempt
        if (error.status >= 400 || attempt === this.maxRetries - 1) {
          throw error;
        }

        // Wait before retrying
        const delay = this.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Handle API response
   */
  async handleResponse(response, endpoint) {
    // Try to parse JSON response
    let data;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`📥 ${response.status} ${endpoint}`, data);
    }

    // Handle errors
    if (!response.ok) {
      // Token expired or invalid
      if (response.status === 401) {
        this.clearAuth();
        window.dispatchEvent(new CustomEvent("auth:expired"));
        throw new APIError(
          data?.error || "Unauthorized",
          response.status,
          "AUTH_FAILED"
        );
      }

      // Forbidden
      if (response.status === 403) {
        throw new APIError(
          data?.error || "Forbidden",
          response.status,
          "FORBIDDEN"
        );
      }

      // Server error
      if (response.status >= 500) {
        throw new APIError(
          data?.error || "Server error",
          response.status,
          "SERVER_ERROR"
        );
      }

      // Client error
      throw new APIError(
        data?.error || "Request failed",
        response.status,
        "VALIDATION_ERROR"
      );
    }

    return data;
  }

  /**
   * GET request
   */
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "GET" });
  }

  /**
   * POST request
   */
  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * PUT request
   */
  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  /**
   * DELETE request
   */
  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "DELETE" });
  }
}

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(message, status, code = "UNKNOWN") {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = code;
  }

  isNetworkError() {
    return this.code === "NETWORK";
  }

  isAuthError() {
    return this.code === "AUTH_FAILED";
  }

  isValidationError() {
    return this.code === "VALIDATION_ERROR";
  }

  isServerError() {
    return this.code === "SERVER_ERROR";
  }
}

export const apiClient = new APIClient();
