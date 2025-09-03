import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Monitor, Play } from "lucide-react";
import { useBackend } from "../../hooks/useBackend";
import { useSession } from "../../contexts/SessionContext";
import { useSupabase } from "../../contexts/SupabaseContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useWebRTC } from "../../webrtc/useWebRTC";
import type { ControlMessage, SignalPayload } from "../../webrtc/types";
import SessionToolbar from "./SessionToolbar";
import RemoteDisplay from "./RemoteDisplay";
import ChatPanel from "./ChatPanel";
import ParticipantsList from "./ParticipantsList";
import ConnectionStatus from "./ConnectionStatus";
import LoadingSpinner from "../ui/LoadingSpinner";
import RemoteCursor from "./RemoteCursor";
import type { Session as SessionData, Participant } from "~backend/session/types";

export default function SessionRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const { toast } = useToast();
  const { subscribeToSession } = useSupabase();
  const { user } = useAuth();
  const {
    currentSession,
    setCurrentSession,
    participants,
    setParticipants,
    updateParticipant,
  } = useSession();
  
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isControlEnabled, setIsControlEnabled] = useState(true);
  const [remoteCursor, setRemoteCursor] = useState<{ x: number; y: number } | null>(null);
  const [peerConnections, setPeerConnections] = useState<Record<string, ReturnType<typeof useWebRTC>>>({});

  const myRole = participants.find(p => p.userId === user?.id)?.role;

  const handleDataMessage = useCallback((message: ControlMessage) => {
    if (myRole !== "host") return;

    switch (message.type) {
      case "mousemove":
        setRemoteCursor({ x: message.x * window.innerWidth, y: message.y * window.innerHeight });
        break;
      case "mousedown":
      case "mouseup":
        const el = document.elementFromPoint(message.x * window.innerWidth, message.y * window.innerHeight);
        if (el instanceof HTMLElement) {
          const event = new MouseEvent(message.type, {
            bubbles: true,
            cancelable: true,
            view: window,
            button: message.button,
            clientX: message.x * window.innerWidth,
            clientY: message.y * window.innerHeight,
          });
          el.dispatchEvent(event);
        }
        break;
    }
  }, [myRole]);

  const {
    remoteStream,
    startScreenShare,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    sendData,
  } = useWebRTC({ onDataMessage: handleDataMessage });

  const publishSignal = (type: "offer" | "answer" | "ice-candidate", payload: SignalPayload, recipientUserId: string) => {
    if (!sessionId) return;
    backend.signaling.publishSignal({
      sessionId,
      type: type === "ice-candidate" ? "ice" : type,
      payload,
      recipientUserId,
    });
  };

  // Fetch session data
  const { data: sessionsData, isLoading, error } = useQuery({
    queryKey: ["sessions", sessionId],
    queryFn: async () => {
      try {
        // This is a placeholder, in a real app you'd fetch session details by ID
        return await backend.session.listMySessions();
      } catch (error) {
        console.error("Failed to fetch session:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load session." });
        throw error;
      }
    },
  });

  const session = sessionsData?.sessions.find(s => s.id === sessionId);

  // Real-time subscriptions
  useEffect(() => {
    if (!sessionId || !user) return;

    const handleNewParticipant = async (participant: Participant) => {
      updateParticipant(participant);
      if (myRole === "controller" && participant.role === "host") {
        const offer = await createOffer();
        if (offer) {
          publishSignal("offer", offer, participant.userId);
        }
      }
    };

    const handleSignal = async (signal: any) => {
      if (signal.recipient_user_id !== user.id) return;

      const payload = signal.payload;
      switch (signal.type) {
        case "offer":
          if (myRole === "host") {
            await startScreenShare();
            const answer = await handleOffer(payload);
            if (answer) {
              publishSignal("answer", answer, signal.sender_user_id);
            }
          }
          break;
        case "answer":
          await handleAnswer(payload);
          break;
        case "ice":
          await addIceCandidate(payload);
          break;
      }
    };

    const unsubscribe = subscribeToSession(sessionId, {
      onSessionUpdate: (updatedSession: any) => setCurrentSession(updatedSession),
      onParticipantUpdate: handleNewParticipant,
      onSignal: handleSignal,
    });

    return unsubscribe;
  }, [sessionId, user, myRole, createOffer, handleOffer, handleAnswer, addIceCandidate, startScreenShare, updateParticipant, setCurrentSession]);

  useEffect(() => {
    if (session) setCurrentSession(session);
  }, [session, setCurrentSession]);

  const handleLeaveSession = async () => {
    if (!sessionId) return;
    await backend.session.leaveSession({ sessionId });
    navigate("/dashboard");
  };

  const handleTerminateSession = async () => {
    if (!sessionId) return;
    await backend.session.terminateSession({ sessionId });
    navigate("/dashboard");
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (error || !session) return <div className="min-h-screen flex items-center justify-center"><p>Session not found.</p></div>;

  const HostView = () => (
    <div className="h-full flex flex-col items-center justify-center bg-gray-800 text-white">
      <Monitor className="h-24 w-24 mb-4" />
      <h2 className="text-2xl font-bold">You are hosting this session</h2>
      <p className="text-muted-foreground">Your screen is being shared.</p>
      {remoteCursor && <RemoteCursor position={remoteCursor} />}
    </div>
  );

  const ControllerView = () => (
    <RemoteDisplay
      remoteStream={remoteStream}
      sendControlMessage={sendData}
      isControlEnabled={isControlEnabled}
    />
  );

  return (
    <div className="min-h-screen bg-black text-white relative">
      <ConnectionStatus />
      <SessionToolbar
        session={session}
        onLeave={handleLeaveSession}
        onTerminate={handleTerminateSession}
        onToggleChat={() => setChatOpen(!chatOpen)}
        onToggleParticipants={() => setParticipantsOpen(!participantsOpen)}
        onToggleFullScreen={toggleFullScreen}
        isFullScreen={isFullScreen}
        isControlEnabled={isControlEnabled}
        onToggleControl={() => setIsControlEnabled(!isControlEnabled)}
      />
      <div className="flex h-screen pt-16">
        <div className="flex-1 relative">
          {myRole === 'host' ? <HostView /> : <ControllerView />}
        </div>
        {chatOpen && <div className="w-80 border-l border-gray-700"><ChatPanel sessionId={session.id} onClose={() => setChatOpen(false)} /></div>}
        {participantsOpen && <div className="w-80 border-l border-gray-700"><ParticipantsList participants={participants} onClose={() => setParticipantsOpen(false)} /></div>}
      </div>
    </div>
  );
}
