import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "../config";

interface SupabaseContextType {
  supabase: SupabaseClient | null;
  subscribeToSession: (sessionId: string, callbacks: SessionCallbacks) => () => void;
}

export interface SessionCallbacks {
  onSessionUpdate?: (session: any) => void;
  onParticipantUpdate?: (participant: any) => void;
  onSignal?: (signal: any) => void;
  onChatMessage?: (message: any) => void;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase configuration missing");
      return;
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });

    setSupabase(client);
  }, []);

  const subscribeToSession = (sessionId: string, callbacks: SessionCallbacks) => {
    if (!supabase) return () => {};

    const channels: RealtimeChannel[] = [];

    // Subscribe to session updates
    const sessionChannel = supabase
      .channel(`session:${sessionId}`)
      .on("postgres_changes", 
        { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (payload) => callbacks.onSessionUpdate?.(payload.new)
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "session_participants", filter: `session_id=eq.${sessionId}` },
        (payload) => callbacks.onParticipantUpdate?.(payload.new)
      )
      .subscribe();

    channels.push(sessionChannel);

    // Subscribe to signals
    const signalChannel = supabase
      .channel(`signals:${sessionId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "signals", filter: `session_id=eq.${sessionId}` },
        (payload) => callbacks.onSignal?.(payload.new)
      )
      .subscribe();

    channels.push(signalChannel);

    // Subscribe to chat messages
    const chatChannel = supabase
      .channel(`chat:${sessionId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => callbacks.onChatMessage?.(payload.new)
      )
      .subscribe();

    channels.push(chatChannel);

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  };

  return (
    <SupabaseContext.Provider value={{ supabase, subscribeToSession }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return context;
}
