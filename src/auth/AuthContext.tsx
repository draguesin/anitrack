import React, { createContext, useContext, useEffect, useState } from "react";
import { getValidAccessToken, loginWithMAL, logout as malLogout } from "./malAuth";

type AuthContextType = {
  token: string | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getValidAccessToken()
      .then(setToken)
      .finally(() => setLoading(false));
  }, []);

  const login = async () => {
    const accessToken = await loginWithMAL();
    setToken(accessToken);
  };

  const logout = async () => {
    await malLogout();
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
