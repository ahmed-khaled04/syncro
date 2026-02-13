const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const authAPI = {
  async signup(email, password, name) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Signup failed");
    }

    const data = await response.json();
    // Save token to localStorage
    localStorage.setItem("syncro-token", data.token);
    localStorage.setItem("syncro-user", JSON.stringify(data.user));
    return data.user;
  },

  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const data = await response.json();
    // Save token to localStorage
    localStorage.setItem("syncro-token", data.token);
    localStorage.setItem("syncro-user", JSON.stringify(data.user));
    return data.user;
  },

  async getCurrentUser() {
    const token = localStorage.getItem("syncro-token");
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        // Token is invalid, clear it
        localStorage.removeItem("syncro-token");
        localStorage.removeItem("syncro-user");
        return null;
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error("Failed to get current user:", error);
      return null;
    }
  },

  logout() {
    localStorage.removeItem("syncro-token");
    localStorage.removeItem("syncro-user");
  },

  getToken() {
    return localStorage.getItem("syncro-token");
  },
};
