import React, { createContext, useContext, useState, useEffect } from 'react';

const API_AUTH_BASE = 'http://localhost:8000/api/v1/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('collage_token') || null);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('collage_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const isAuthenticated = Boolean(token && user);
  const isAdmin = user?.role === 'admin';
  const isUser = user?.role === 'user';

  // Save/remove from localStorage on state change
  const saveAuthSession = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('collage_token', newToken);
    localStorage.setItem('collage_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('collage_token');
    localStorage.removeItem('collage_user');
  };

  const login = async (email, password) => {
    const res = await fetch(`${API_AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }

    const data = await res.json();
    saveAuthSession(data.access_token, data.user);
    return data;
  };

  const registerAdmin = async ({ name, email, password, college_name }) => {
    const res = await fetch(`${API_AUTH_BASE}/admin/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, college_name }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Admin registration failed');
    }

    const data = await res.json();
    saveAuthSession(data.access_token, data.user);
    return data;
  };

  const registerUser = async ({ name, email, password, college_slug }) => {
    const res = await fetch(`${API_AUTH_BASE}/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, college_slug }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'User registration failed');
    }

    const data = await res.json();
    saveAuthSession(data.access_token, data.user);
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated,
        isAdmin,
        isUser,
        login,
        logout,
        registerAdmin,
        registerUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
