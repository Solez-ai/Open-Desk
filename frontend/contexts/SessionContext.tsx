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
    setParticipants(prev => {
      // Prefer dedupe by userId (stable across reconnects) then by id
      const byUserIndex = prev.findIndex(p => p.userId === participant.userId);
      if (byUserIndex >= 0) {
        const newParticipants = [...prev];
        newParticipants[byUserIndex] = participant;
        return newParticipants;
      }
      const byIdIndex = prev.findIndex(p => p.id === participant.id);
      if (byIdIndex >= 0) {
        const newParticipants = [...prev];
        newParticipants[byIdIndex] = participant;
        return newParticipants;
      }
      return [...prev, participant];
    });
  }, []);

  const removeParticipant = useCallback((userId: string) => {
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
