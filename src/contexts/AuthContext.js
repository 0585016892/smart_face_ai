import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import authApi from "../api/authApi";

const AuthContext = createContext(null);

const getUserFromResponse = (result) => {
  return result?.user || result?.data?.user || result;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sfs_user") || "null");
    } catch {
      return null;
    }
  });

  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("sfs_token");
    localStorage.removeItem("sfs_user");
    setUser(null);
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await authApi.login(credentials);

    const token = result?.token || result?.accessToken || result?.access_token;

    const account = result?.user || result?.account || result?.profile;

    if (!token) {
      throw new Error("API đăng nhập không trả về JWT token");
    }

    if (!account) {
      throw new Error("API đăng nhập không trả về thông tin tài khoản");
    }

    localStorage.setItem("sfs_token", token);
    localStorage.setItem("sfs_user", JSON.stringify(account));

    setUser(account);

    return account;
  }, []);

  const refreshUser = useCallback(async () => {
    const result = await authApi.getMe();
    const account = getUserFromResponse(result);

    if (!account) {
      throw new Error("Không lấy được thông tin tài khoản");
    }

    localStorage.setItem("sfs_user", JSON.stringify(account));
    setUser(account);

    return account;
  }, []);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      const token = localStorage.getItem("sfs_token");

      if (!token) {
        if (active) setInitializing(false);
        return;
      }

      try {
        const result = await authApi.getMe();
        const account = getUserFromResponse(result);

        if (active && account) {
          localStorage.setItem("sfs_user", JSON.stringify(account));
          setUser(account);
        }
      } catch (error) {
        localStorage.removeItem("sfs_token");
        localStorage.removeItem("sfs_user");

        if (active) setUser(null);
      } finally {
        if (active) setInitializing(false);
      }
    };

    initialize();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      isAuthenticated: Boolean(user && localStorage.getItem("sfs_token")),
      login,
      logout,
      refreshUser,
    }),
    [user, initializing, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth phải được sử dụng bên trong AuthProvider");
  }

  return context;
}
