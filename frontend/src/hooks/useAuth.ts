import { useState, useEffect } from "react";

const AUTH_TOKEN_KEY = "iq_auth_token";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const login = (email: string) => {
    const mockToken = `iq_session_${email}_${Date.now()}`;
    localStorage.setItem(AUTH_TOKEN_KEY, mockToken);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setIsAuthenticated(false);
  };

  return { isAuthenticated, login, logout };
}
