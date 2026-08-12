import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { Role } from './types';

export interface AuthState {
  role: Role;
  email: string;
  name: string;
}

interface AuthContextValue extends AuthState {
  setAuth: (auth: AuthState) => void;
  clear: () => void;
}

const STORAGE_KEY = 'ts_auth';

function readStored(): AuthState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthState;
      if (parsed && parsed.role) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { role: 'unauthorized', email: '', name: '' };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readStored);

  const setAuth = (auth: AuthState) => {
    setState(auth);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  };

  const clear = () => {
    setState({ role: 'unauthorized', email: '', name: '' });
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ ...state, setAuth, clear }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
