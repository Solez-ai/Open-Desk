import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useBackend } from "../../hooks/useBackend";
import { useSession } from "../../contexts/SessionContext";
import { useSupabase } from "../../contexts/SupabaseContext";
import { useToast } from "@/components/ui/use-toast";
import SessionToolbar from "./SessionToolbar";
import RemoteDisplay from "./RemoteDisplay";
import ChatPanel from "./ChatPanel";
import ParticipantsList from "./ParticipantsList";
import ConnectionStatus from "./ConnectionStatus";
import LoadingSpinner from "../ui/LoadingSpinner";
import type { Session, Participant } from "~backend/session/types";

export default function SessionRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const { toast } = useToast();
  const { subscribeToSession } = useSupabase();
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

  // Fetch session data
  const { data: sessionsData, isLoading, error } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      try {
        return await backend.session.listMySessions();
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load session. Please try again.",
        });
        throw error;
      }
    },
  });

  // Find current session
  const session = sessionsData?.sessions.find(s => s.id === sessionId);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeToSession(sessionId, {
      onSessionUpdate: (updatedSession: any) => {
        setCurrentSession({
          id: updatedSession.id,
          code: updatedSession.code,
          name: updatedSession.name,
          ownerId: updatedSession.owner_id,
          targetUserId: updatedSession.target_user_id,
          status: updatedSession.status,
          allowClipboard: updatedSession.allow_clipboard,
          isPublic: updatedSession.is_public,
          createdAt: new Date(updatedSession.created_at),
          updatedAt: new Date(updatedSession.updated_at),
        });
      },
      onParticipantUpdate: (participant: any) => {
        updateParticipant({
          id: participant.id,
          sessionId: participant.session_id,
          userId: participant.user_id,
          role: participant.role,
          status: participant.status,
          connectedAt: participant.connected_at ? new Date(participant.connected_at) : null,
          disconnectedAt: participant.disconnected_at ? new Date(participant.disconnected_at) : null,
          createdAt: new Date(participant.created_at),
          updatedAt: new Date(participant.updated_at),
        });
      },
      onSignal: (signal: any) => {
        // Handle WebRTC signaling
        console.log("Received signal:", signal);
      },
      onChatMessage: (message: any) => {
        // Handle chat messages
        console.log("Received chat message:", message);
      },
    });

    return unsubscribe;
  }, [sessionId, subscribeToSession, setCurrentSession, updateParticipant]);

  // Set current session when loaded
  useEffect(() => {
    if (session) {
      setCurrentSession(session);
    }
  }, [session, setCurrentSession]);

  const handleLeaveSession = async () => {
    if (!sessionId) return;

    try {
      await backend.session.leaveSession({ sessionId });
      toast({
        title: "Left session",
        description: "You have left the session.",
      });
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to leave session:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to leave session. Please try again.",
      });
    }
  };

  const handleTerminateSession = async () => {
    if (!sessionId) return;

    try {
      await backend.session.terminateSession({ sessionId });
      toast({
        title: "Session terminated",
        description: "The session has been ended.",
      });
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to terminate session:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to terminate session. Please try again.",
      });
    }
  };

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullScreen(!isFullScreen);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-3">
              <h3 className="text-lg font-medium">Session not found</h3>
              <p className="text-muted-foreground">
                The session you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Connection Status */}
      <ConnectionStatus />

      {/* Session Toolbar */}
      <SessionToolbar
        session={session}
        onLeave={handleLeaveSession}
        onTerminate={handleTerminateSession}
        onToggleChat={() => setChatOpen(!chatOpen)}
        onToggleParticipants={() => setParticipantsOpen(!participantsOpen)}
        onToggleFullScreen={toggleFullScreen}
        isFullScreen={isFullScreen}
      />

      {/* Main Content Area */}
      <div className="flex h-screen pt-16">
        {/* Remote Display */}
        <div className="flex-1 relative">
          <RemoteDisplay session={session} />
        </div>

        {/* Chat Panel */}
        {chatOpen && (
          <div className="w-80 border-l border-gray-700">
            <ChatPanel 
              sessionId={session.id}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}

        {/* Participants Panel */}
        {participantsOpen && (
          <div className="w-80 border-l border-gray-700">
            <ParticipantsList
              participants={participants}
              onClose={() => setParticipantsOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
