import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);
const storageKey = 'rrc-auth-user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (profile) => {
    setUser(profile);
    localStorage.setItem(storageKey, JSON.stringify(profile));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(storageKey);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
