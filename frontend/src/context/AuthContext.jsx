import { useState, useEffect } from "react";
import { AuthContext } from "./auth";
import { authAPI } from "../api/auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user from token on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await authAPI.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error("Failed to load user:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const signup = async (email, password, name, passwordConfirm) => {
    // Validation
    if (!email || !password || !name) {
      throw new Error("All fields are required");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    if (!email.includes("@")) {
      throw new Error("Invalid email address");
    }
    if (password !== passwordConfirm) {
      throw new Error("Passwords do not match");
    }

    try {
      const userData = await authAPI.signup(email, password, name);
      setUser(userData);
      setError(null);
      return userData;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const login = async (email, password) => {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    try {
      const userData = await authAPI.login(email, password);
      setUser(userData);
      setError(null);
      return userData;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
    setError(null);
  };

  const updateProfile = (updates) => {
    if (!user) return;

    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem("syncro-user", JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signup, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
