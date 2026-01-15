import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  email: string;
}

interface Doctor {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  interfaceLanguage: string | null;
  workDays: string[] | null;
  workDayStartTime: string | null;
  workDayEndTime: string | null;
  slotStepMinutes: number | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  googleCalendarId: string | null;
  googleSheetId: string | null;
  aiEnabled: boolean | null;
}

interface AuthContextType {
  user: User | null;
  doctor: Doctor | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setDoctor(data.doctor);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const res = await apiRequest('POST', '/api/auth/login', { email, password });
      const data = await res.json();
      setUser(data.user);
      setDoctor(data.doctor);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const res = await apiRequest('POST', '/api/auth/register', { email, password, firstName, lastName });
      const data = await res.json();
      setUser(data.user);
      setDoctor(data.doctor);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
    } finally {
      setUser(null);
      setDoctor(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, doctor, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
