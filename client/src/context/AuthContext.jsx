import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setAuthToken } from "../services/apiClient";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

const TOKEN_KEY = "attendance_token";
const USER_KEY = "attendance_user";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) || ""
  );
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAuthToken(token || null);
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  async function login(email, password) {
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      setToken(data.token);
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      const isNetworkError = !err?.response;
      return {
        ok: false,
        message:
          err?.response?.data?.message ||
          (isNetworkError ? "Cannot reach API server." : "Login failed"),
      };
    } finally {
      setLoading(false);
    }
  }

  async function register(email, password, role, firstName, lastName) {
    setLoading(true);
    try {
      const data = await authService.register(
        email,
        password,
        role,
        firstName,
        lastName
      );
      setToken(data.token);
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      const isNetworkError = !err?.response;
      return {
        ok: false,
        message:
          err?.response?.data?.message ||
          (isNetworkError
            ? "Cannot reach API server (is it running on http://localhost:5000?)"
            : "Register failed"),
      };
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
  }

  const value = useMemo(
    () => ({ token, user, loading, login, register, logout, setUser }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
