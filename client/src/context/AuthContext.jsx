import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { touchPresence } from '../api/api';

const AuthContext = createContext(null);
const storageKey = 'rrc-auth-user';

export function AuthProvider({ children }) {
  const navigate = useNavigate();
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

  useEffect(() => {
    const handleSessionExpired = () => {
      const loginPath = user?.role === 'admin' ? '/admin/login' : '/login';
      setUser(null);
      localStorage.removeItem(storageKey);
      navigate(loginPath, {
        replace: true,
        state: { sessionExpired: true },
      });
    };

    window.addEventListener('rrc:session-expired', handleSessionExpired);
    return () => window.removeEventListener('rrc:session-expired', handleSessionExpired);
  }, [navigate, user]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const reportPresence = () => {
      touchPresence().catch(() => {});
    };

    reportPresence();
    const interval = window.setInterval(reportPresence, 20000);
    return () => window.clearInterval(interval);
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
