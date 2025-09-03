import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Monitor, Play, Square } from "lucide-react";
import { useBackend } from "../../hooks/useBackend";
import { useSession } from "../../contexts/SessionContext";
import { useSupabase } from "../../contexts/SupabaseContext";
import { useAuth } from "../../contexts/AuthContext";
import RemoteDisplay from "./RemoteDisplay";
import ChatPanel from "./ChatPanel";
import ParticipantsList from "./ParticipantsList";
import ConnectionStatus from "./ConnectionStatus";
import SessionToolbar from "./SessionToolbar";
import LoadingSpinner from "../ui/LoadingSpinner";
import type { ControlMessage, SignalPayload } from "../../webrtc/types";
import type { Session as SessionData, Participant } from "~backend/session/types";
import { ICE_SERVERS } from "../../config";

type PCRecord = {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  remoteStream: MediaStream | null;
};

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
    removeParticipant,
    setIsConnected,
    setConnectionQuality,
  } = useSession();

  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isControlEnabled, setIsControlEnabled] = useState(true);

  // Screen sharing state (host)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isStartingShare, setIsStartingShare] = useState(false);

  // For controller we display a single remote stream (from host).
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Manage multiple peer connections: key by remoteUserId.
  const connectionsRef = useRef<Map<string, PCRecord>>(new Map());
  // Offers received before host starts screen share (requires user gesture).
  const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map());

  const myParticipant = participants.find((p) => p.userId === user?.id);
  const myRole = myParticipant?.role;

  const hostParticipant = useMemo(
    () => participants.find((p) => p.role === "host" && p.status === "joined"),
    [participants]
  );

  // API helpers
  const publishSignal = useCallback(
    async (
      type: "offer" | "answer" | "ice",
      payload: SignalPayload,
      recipientUserId: string
    ) => {
      if (!sessionId) return;
      try {
        await backend.signaling.publishSignal({
          sessionId,
          type,
          payload,
          recipientUserId,
        });
      } catch (err) {
        console.error("Failed to publish signal:", err);
        toast({
          variant: "destructive",
          title: "Connection error",
          description: "Failed to send signaling data.",
        });
      }
    },
    [backend, sessionId, toast]
  );

  // Initialize participants and session details
  const {
    data: sessionDetail,
    isLoading: isLoadingSession,
    error: sessionError,
  } = useQuery({
    queryKey: ["session", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const [sess, parts] = await Promise.all([
        backend.session.getSession({ sessionId: sessionId! }),
        backend.session.listParticipants({ sessionId: sessionId! }),
      ]);
      return { session: sess.session, participants: parts.participants };
    },
  });

  useEffect(() => {
    if (sessionDetail?.session) {
      setCurrentSession(sessionDetail.session);
    }
    if (sessionDetail?.participants) {
      setParticipants(sessionDetail.participants);
    }
  }, [sessionDetail, setCurrentSession, setParticipants]);

  // Handle incoming data messages (controller -> host)
  const handleDataMessage = useCallback(
    (message: ControlMessage) => {
      if (myRole !== "host") return;

      // For now, visualize cursor; In a real host agent, events would be handled natively.
      switch (message.type) {
        case "mousemove":
          // Intentionally not visualizing on host view; could be extended.
          break;
        case "mousedown":
        case "mouseup":
        case "scroll":
        case "keydown":
        case "keyup":
        case "clipboard":
          // Stub: handle additional control messages if host has an agent.
          break;
      }
    },
    [myRole]
  );

  // Map connection state to a user-friendly quality label
  const updateConnectionIndicators = useCallback((state: RTCPeerConnectionState) => {
    switch (state) {
      case "connected":
        setIsConnected(true);
        setConnectionQuality("excellent");
        break;
      case "connecting":
        setIsConnected(false);
        setConnectionQuality("good");
        break;
      case "disconnected":
        setIsConnected(false);
        setConnectionQuality("poor");
        break;
      case "failed":
      case "closed":
      default:
        setIsConnected(false);
        setConnectionQuality("offline");
        break;
    }
  }, [setConnectionQuality, setIsConnected]);

  // Create or get a peer connection with a remote user
  const ensurePeerConnection = useCallback(
    (remoteUserId: string, asOfferer: boolean): PCRecord => {
      let existing = connectionsRef.current.get(remoteUserId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const record: PCRecord = { pc, dc: null, remoteStream: null };
      connectionsRef.current.set(remoteUserId, record);

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await publishSignal("ice", event.candidate.toJSON(), remoteUserId);
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        updateConnectionIndicators(state);
        if (state === "disconnected" || state === "failed" || state === "closed") {
          // Clean up on disconnect
          try {
            record.dc?.close();
          } catch {}
          try {
            pc.close();
          } catch {}
          connectionsRef.current.delete(remoteUserId);
        }
      };

      pc.ontrack = (event) => {
        // For controllers, set the host's stream.
        record.remoteStream = event.streams[0];
        setRemoteStream(event.streams[0]);
      };

      if (asOfferer) {
        const dc = pc.createDataChannel("control", { ordered: true });
        record.dc = dc;
        dc.onopen = () => {};
        dc.onclose = () => {};
        dc.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data) as ControlMessage;
            handleDataMessage(msg);
          } catch (err) {
            console.error("Failed to parse data channel message:", err);
          }
        };
      } else {
        pc.ondatachannel = (event) => {
          record.dc = event.channel;
          const dc = event.channel;
          dc.onopen = () => {};
          dc.onclose = () => {};
          dc.onmessage = (e) => {
            try {
              const msg = JSON.parse(e.data) as ControlMessage;
              handleDataMessage(msg);
            } catch (err) {
              console.error("Failed to parse data channel message:", err);
            }
          };
        };
      }

      // If host, attach current local stream tracks to the new connection.
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      return record;
    },
    [handleDataMessage, localStream, publishSignal, updateConnectionIndicators]
  );

  const createAndSendOfferTo = useCallback(
    async (remoteUserId: string) => {
      const rec = ensurePeerConnection(remoteUserId, true);
      try {
        const offer = await rec.pc.createOffer();
        await rec.pc.setLocalDescription(offer);
        await publishSignal("offer", offer, remoteUserId);
      } catch (err) {
        console.error("Failed to create/send offer:", err);
        toast({
          variant: "destructive",
          title: "Connection error",
          description: "Failed to initiate connection.",
        });
      }
    },
    [ensurePeerConnection, publishSignal, toast]
  );

  const handleOffer = useCallback(
    async (senderUserId: string, offer: RTCSessionDescriptionInit) => {
      // Host must have a local stream before answering; if not, queue the offer.
      if (myRole === "host" && !localStream) {
        pendingOffersRef.current.set(senderUserId, offer);
        toast({
          title: "Connection request",
          description: "A controller wants to connect. Click Start Sharing to accept.",
        });
        return;
      }

      const rec = ensurePeerConnection(senderUserId, false);
      try {
        await rec.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await rec.pc.createAnswer();
        await rec.pc.setLocalDescription(answer);
        await publishSignal("answer", answer, senderUserId);
      } catch (err) {
        console.error("Failed to handle offer:", err);
        toast({
          variant: "destructive",
          title: "Connection error",
          description: "Failed to accept connection request.",
        });
      }
    },
    [ensurePeerConnection, localStream, myRole, publishSignal, toast]
  );

  const handleAnswer = useCallback(async (senderUserId: string, answer: RTCSessionDescriptionInit) => {
    const rec = connectionsRef.current.get(senderUserId);
    if (!rec) return;
    try {
      if (rec.pc.signalingState === "have-local-offer") {
        await rec.pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.error("Failed to handle answer:", err);
    }
  }, []);

  const handleIce = useCallback(async (senderUserId: string, cand: RTCIceCandidateInit) => {
    const rec = connectionsRef.current.get(senderUserId);
    if (!rec) return;
    try {
      await rec.pc.addIceCandidate(new RTCIceCandidate(cand));
    } catch (err) {
      console.error("Failed to add ICE candidate:", err);
    }
  }, []);

  // Start/stop screen sharing (host)
  const startScreenShare = useCallback(async () => {
    setIsStartingShare(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: true,
      });
      setLocalStream(stream);

      // Attach to all existing connections (host side).
      connectionsRef.current.forEach((rec) => {
        stream.getTracks().forEach((track) => {
          rec.pc.addTrack(track, stream);
        });
      });

      toast({
        title: "Screen sharing started",
        description: "Your screen is now being shared.",
      });

      // Process any pending offers now that we have a local stream.
      for (const [sender, offer] of pendingOffersRef.current.entries()) {
        await handleOffer(sender, offer);
        pendingOffersRef.current.delete(sender);
      }

      // Handle stop event
      const handleEnded = () => {
        stopScreenShare();
      };
      stream.getVideoTracks().forEach((t) => (t.onended = handleEnded));
      stream.getAudioTracks().forEach((t) => (t.onended = handleEnded));
    } catch (err: any) {
      console.error("Failed to start screen share:", err);
      toast({
        variant: "destructive",
        title: "Screen share failed",
        description: err?.message || "Permission denied or unsupported browser.",
      });
    } finally {
      setIsStartingShare(false);
    }
  }, [handleOffer, toast]);

  const stopScreenShare = useCallback(() => {
    const s = localStream;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    toast({ title: "Screen sharing stopped" });
  }, [localStream, toast]);

  // Send data messages (controller -> host)
  const sendData = useCallback(
    (message: ControlMessage) => {
      if (!isControlEnabled) return;
      // Controller sends to host; Host might broadcast if needed.
      if (myRole === "controller" && hostParticipant) {
        const rec = connectionsRef.current.get(hostParticipant.userId);
        if (rec?.dc && rec.dc.readyState === "open") {
          rec.dc.send(JSON.stringify(message));
        }
      }
    },
    [hostParticipant, isControlEnabled, myRole]
  );

  // Subscribe to realtime updates
  useEffect(() => {
    if (!sessionId || !user) return;

    const handleNewParticipant = async (participant: Participant) => {
      updateParticipant(participant);

      // If controller and a host joined, initiate offer to host.
      if (myRole === "controller" && participant.role === "host" && participant.status === "joined") {
        // Avoid duplicate offers if connection already exists.
        const exists = connectionsRef.current.has(participant.userId);
        if (!exists) {
          await createAndSendOfferTo(participant.userId);
        }
      }

      // If participant left, tear down connection.
      if (participant.status === "left") {
        const rec = connectionsRef.current.get(participant.userId);
        if (rec) {
          try {
            rec.dc?.close();
          } catch {}
          try {
            rec.pc.close();
          } catch {}
          connectionsRef.current.delete(participant.userId);
        }
      }
    };

    const handleSignal = async (signal: any) => {
      // Only process messages addressed to me.
      if (signal.recipient_user_id !== user.id) return;

      const payload = signal.payload;
      switch (signal.type) {
        case "offer":
          await handleOffer(signal.sender_user_id, payload);
          break;
        case "answer":
          await handleAnswer(signal.sender_user_id, payload);
          break;
        case "ice":
          await handleIce(signal.sender_user_id, payload);
          break;
      }
    };

    const unsubscribe = subscribeToSession(sessionId, {
      onSessionUpdate: (updated: any) => {
        // Updated session status
        const s: SessionData = {
          id: updated.id,
          code: updated.code,
          name: updated.name,
          ownerId: updated.owner_id,
          targetUserId: updated.target_user_id,
          status: updated.status,
          allowClipboard: updated.allow_clipboard,
          isPublic: updated.is_public,
          createdAt: new Date(updated.created_at),
          updatedAt: new Date(updated.updated_at),
        };
        setCurrentSession(s);
      },
      onParticipantUpdate: handleNewParticipant,
      onSignal: handleSignal,
    });

    return unsubscribe;
  }, [
    sessionId,
    user,
    myRole,
    subscribeToSession,
    setCurrentSession,
    updateParticipant,
    createAndSendOfferTo,
    handleOffer,
    handleAnswer,
    handleIce,
  ]);

  // On initial host presence when controller joins late
  useEffect(() => {
    if (myRole === "controller" && hostParticipant) {
      const exists = connectionsRef.current.has(hostParticipant.userId);
      if (!exists) {
        createAndSendOfferTo(hostParticipant.userId);
      }
    }
  }, [hostParticipant, myRole, createAndSendOfferTo]);

  // Leave/Terminate handlers
  const handleLeaveSession = async () => {
    if (!sessionId) return;
    try {
      await backend.session.leaveSession({ sessionId });
    } finally {
      // Cleanup connections
      connectionsRef.current.forEach((rec) => {
        try {
          rec.dc?.close();
        } catch {}
        try {
          rec.pc.close();
        } catch {}
      });
      connectionsRef.current.clear();
      stopScreenShare();
      navigate("/dashboard");
    }
  };

  const handleTerminateSession = async () => {
    if (!sessionId) return;
    try {
      await backend.session.terminateSession({ sessionId });
    } finally {
      // Cleanup as well
      connectionsRef.current.forEach((rec) => {
        try {
          rec.dc?.close();
        } catch {}
        try {
          rec.pc.close();
        } catch {}
      });
      connectionsRef.current.clear();
      stopScreenShare();
      navigate("/dashboard");
    }
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

  if (isLoadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (sessionError || !currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Session not found.</p>
      </div>
    );
  }

  const HostView = () => (
    <div className="h-full flex flex-col items-center justify-center bg-gray-800 text-white space-y-4">
      <Monitor className="h-24 w-24" />
      <h2 className="text-2xl font-bold">
        {localStream ? "You are sharing your screen" : "You are hosting this session"}
      </h2>
      {!localStream ? (
        <Button onClick={startScreenShare} disabled={isStartingShare}>
          {isStartingShare ? (
            <>
              <Play className="h-4 w-4 mr-2" />
              Starting...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start screen sharing
            </>
          )}
        </Button>
      ) : (
        <Button variant="destructive" onClick={stopScreenShare}>
          <Square className="h-4 w-4 mr-2" />
          Stop screen sharing
        </Button>
      )}
      <p className="text-sm text-gray-300">
        Controllers will connect automatically when you start sharing.
      </p>
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
        session={currentSession}
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
          {myRole === "host" ? <HostView /> : <ControllerView />}
        </div>
        {chatOpen && (
          <div className="w-80 border-l border-gray-700">
            <ChatPanel sessionId={currentSession.id} onClose={() => setChatOpen(false)} />
          </div>
        )}
        {participantsOpen && (
          <div className="w-80 border-l border-gray-700">
            <ParticipantsList participants={participants} onClose={() => setParticipantsOpen(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
