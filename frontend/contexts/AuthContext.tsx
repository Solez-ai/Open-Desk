import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { useSupabase } from "./SupabaseContext";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  getToken: () => Promise<string | null>;
  isSignedIn: boolean;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { supabase, isConfigured } = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !isConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, isConfigured]);

  const signUp = async (email: string, password: string) => {
    if (!supabase || !isConfigured) {
      return { error: new Error("Supabase not configured") as AuthError };
    }
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase || !isConfigured) {
      return { error: new Error("Supabase not configured") as AuthError };
    }
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error };
  };

  const signOut = async () => {
    if (!supabase || !isConfigured) {
      return { error: new Error("Supabase not configured") as AuthError };
    }
    
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    if (!supabase || !isConfigured) {
      return { error: new Error("Supabase not configured") as AuthError };
    }
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    
    return { error };
  };

  const getToken = async (): Promise<string | null> => {
    if (!supabase || !session || !isConfigured) return null;
    
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    return currentSession?.access_token ?? null;
  };

  const isSignedIn = !!user && isConfigured;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      getToken,
      isSignedIn,
      isConfigured,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
