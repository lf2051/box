import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext();

const ACCESS_PASSWORD = '2026';
const STORAGE_KEY = 'brasa-fogao-access';

const FIXED_USER = {
  id: '00000000-0000-0000-0000-000000000026',
  email: 'acesso@brasafogao.local',
  user_metadata: {
    name: 'Brasa & Fogão Restaurante',
  },
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedAccess = localStorage.getItem(STORAGE_KEY);
      setUser(storedAccess ? FIXED_USER : null);
    } catch {
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (password) => {
    if (password !== ACCESS_PASSWORD) {
      const error = { message: 'Senha incorreta.' };
      toast({
        title: 'Erro no acesso',
        description: error.message,
        variant: 'destructive',
      });
      return { user: null, error };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ authenticated: true }));
    setUser(FIXED_USER);

    toast({
      title: 'Acesso liberado',
      description: 'Bem-vindo ao Brasa & Fogão Restaurante.',
    });

    return { user: FIXED_USER, error: null };
  }, [toast]);

  const logout = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);

    toast({
      title: 'Sessao encerrada',
      description: 'Até logo!',
    });

    return { error: null };
  }, [toast]);

  const signup = useCallback(async () => {
    const error = { message: 'Cadastro desativado.' };
    toast({
      title: 'Cadastro indisponivel',
      description: error.message,
      variant: 'destructive',
    });
    return { user: null, error };
  }, [toast]);

  const resetPassword = useCallback(async () => {
    const error = { message: 'Recuperacao desativada.' };
    toast({
      title: 'Recuperacao indisponivel',
      description: error.message,
      variant: 'destructive',
    });
    return { error };
  }, [toast]);

  const value = useMemo(() => ({
    user,
    loading,
    signup,
    login,
    logout,
    resetPassword,
    isAuthenticated: !!user,
  }), [user, loading, signup, login, logout, resetPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
