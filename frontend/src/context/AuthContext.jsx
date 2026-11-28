import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { AuthContext } from './useAuth';

const TOKEN_KEY = 'foodloop_auth_token';
const USER_KEY = 'foodloop_auth_user';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    delete axios.defaults.headers.common.Authorization;
    setToken('');
    setUser(null);
  }, []);

  // Keep axios Authorization header synced with token
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, [token]);

  // Verify existing session on mount
  useEffect(() => {
    let active = true;
    const verifySession = async () => {
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        const res = await axios.get(`${API_URL}/auth/me`);
        if (active && res.data?.user) {
          setUser(res.data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
        }
      } catch {
        if (active) clearSession();
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    verifySession();
    return () => {
      active = false;
    };
  }, [token, clearSession]);

  // Global 401 handler to clear expired/revoked sessions automatically
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
          clearSession();
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [clearSession]);

  const persistSession = (sessionData) => {
    const { token: newToken, user: newUser } = sessionData;
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    axios.defaults.headers.common.Authorization = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(newUser);
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    persistSession(res.data);
    return res.data.user;
  };

  const register = async ({ name, email, password, role, organization }) => {
    const res = await axios.post(`${API_URL}/auth/register`, {
      name,
      email,
      password,
      role,
      organization,
    });
    persistSession(res.data);
    return res.data.user;
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post(`${API_URL}/auth/logout`);
      }
    } catch {
      // Clear local session regardless of network response
    } finally {
      clearSession();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authLoading,
        isAuthenticated: Boolean(user && token),
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

