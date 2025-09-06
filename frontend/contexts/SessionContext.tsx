import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Session, Participant } from "~backend/session/types";

interface SessionContextType {
  currentSession: Session | null;
  participants: Participant[];
  isConnected: boolean;
  connectionQuality: "excellent" | "good" | "poor" | "offline";
  setCurrentSession: (session: Session | null) => void;
  setParticipants: (participants: Participant[]) => void;
  updateParticipant: (participant: Participant) => void;
  removeParticipant: (userId: string) => void;
  setIsConnected: (connected: boolean) => void;
  setConnectionQuality: (quality: "excellent" | "good" | "poor" | "offline") => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<"excellent" | "good" | "poor" | "offline">("offline");

  const updateParticipant = useCallback((participant: Participant) => {
    console.log(`[SessionContext] Updating participant: ${participant.userId} (${participant.role}) - ${participant.status}`);
    setParticipants(prev => {
      const index = prev.findIndex(p => p.id === participant.id);
      if (index >= 0) {
        const newParticipants = [...prev];
        newParticipants[index] = participant;
        return newParticipants;
      }
      return [...prev, participant];
    });
  }, []);

  const removeParticipant = useCallback((userId: string) => {
    console.log(`[SessionContext] Removing participant: ${userId}`);
    setParticipants(prev => prev.filter(p => p.userId !== userId));
  }, []);

  return (
    <SessionContext.Provider value={{
      currentSession,
      participants,
      isConnected,
      connectionQuality,
      setCurrentSession,
      setParticipants,
      updateParticipant,
      removeParticipant,
      setIsConnected,
      setConnectionQuality,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
