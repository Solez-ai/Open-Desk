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
import SessionToolbar from "./SessionToolbar";
import LoadingSpinner from "../ui/LoadingSpinner";
import TransfersPanel, { type ReceivedFile } from "./TransfersPanel";
import QualityMonitor from "./QualityMonitor";
import QualityControl from "./QualityControl";
import type { ControlMessage, SignalPayload, FileMetaMessage, FileChunkMessage, FileCompleteMessage } from "../../webrtc/types";
import type { Session as SessionData, Participant } from "~backend/session/types";
import { ICE_SERVERS } from "../../config";
import { ICEOptimizer } from "../../webrtc/ICEOptimizer";
import { AdaptiveBitrateController } from "../../webrtc/AdaptiveBitrate";
import { ConnectionMonitor } from "../../webrtc/ConnectionMonitor";
import { BrowserEmulatedAdapter, ControlAdapter, LocalAgentAdapter } from "../../webrtc/ControlAdapters";

type PCRecord = {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  remoteStream: MediaStream | null;
  bitrateController?: AdaptiveBitrateController;
  connectionMonitor?: ConnectionMonitor;
};

type SupabaseParticipantRow = {
  id: string;
  session_id: string;
  user_id: string;
  role: "host" | "controller";
  status: "joined" | "left";
  connected_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
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
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isControlEnabled, setIsControlEnabled] = useState(true);

  // Screen sharing state (host)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isStartingShare, setIsStartingShare] = useState(false);

  // For controller we display a single remote stream (from host).
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Quality monitoring
  const [primaryBitrateController, setPrimaryBitrateController] = useState<AdaptiveBitrateController | null>(null);
  const [primaryConnectionMonitor, setPrimaryConnectionMonitor] = useState<ConnectionMonitor | null>(null);

  // Manage multiple peer connections: key by remoteUserId.
  const connectionsRef = useRef<Map<string, PCRecord>>(new Map());
  // Offers received before host starts screen share (requires user gesture).
  const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map());

  // File transfer assembly state
  const incomingFilesRef = useRef<Map<string, {
    meta: FileMetaMessage;
    chunks: Uint8Array[];
    receivedBytes: number;
    totalChunks?: number;
  }>>(new Map());
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);

  // Control adapter (host-side)
  const controlAdapterRef = useRef<ControlAdapter | null>(null);
  const [controlAdapterLabel, setControlAdapterLabel] = useState<string | undefined>(undefined);

  const myParticipant = participants.find((p) => p.userId === user?.id);
  const myRole = myParticipant?.role;

  const hostParticipant = useMemo(
    () => participants.find((p) => p.role === "host" && p.status === "joined"),
    [participants]
  );

  // Helpers to map Supabase row -> Participant type
  const mapParticipant = (row: SupabaseParticipantRow): Participant => ({
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    connectedAt: row.connected_at ? new Date(row.connected_at) : null,
    disconnectedAt: row.disconnected_at ? new Date(row.disconnected_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });

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

  // Setup control adapter when acting as host (attempt native first)
  useEffect(() => {
    let destroyed = false;
    async function setupAdapter() {
      if (myRole !== "host") return;
      // Clean previous
      controlAdapterRef.current?.destroy();
      controlAdapterRef.current = null;

      const native = new LocalAgentAdapter();
      const ok = await native.init();
      if (!ok) {
        if (destroyed) return;
        const fallback = new BrowserEmulatedAdapter();
        await fallback.init();
        controlAdapterRef.current = fallback;
        setControlAdapterLabel(`${fallback.name}`);
        toast({
          title: "Native agent not found",
          description: "Using browser emulation (limited control). Install/launch the host agent for full control.",
        });
      } else {
        if (destroyed) return;
        controlAdapterRef.current = native;
        setControlAdapterLabel(`${native.name}`);
        toast({
          title: "Native agent connected",
          description: "Full remote control enabled.",
        });
      }
    }
    setupAdapter();

    return () => {
      destroyed = true;
      controlAdapterRef.current?.destroy();
      controlAdapterRef.current = null;
      setControlAdapterLabel(undefined);
    };
  }, [myRole, toast]);

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

  // Handle incoming data messages (controller -> host and file transfers, clipboard)
  const handleDataMessage = useCallback(
    async (message: ControlMessage) => {
      // File transfer handling
      if (message.type === "file-meta") {
        const meta = message as FileMetaMessage;
        incomingFilesRef.current.set(meta.id, {
          meta,
          chunks: [],
          receivedBytes: 0,
        });
        toast({
          title: "Incoming file",
          description: `Receiving "${meta.name}" (${Math.round(meta.size / 1024)} KB)`,
        });
        return;
      }

      if (message.type === "file-chunk") {
        const chunkMsg = message as FileChunkMessage;
        const entry = incomingFilesRef.current.get(chunkMsg.id);
        if (!entry) return;
        const bytes = base64ToUint8Array(chunkMsg.dataB64);
        entry.chunks.push(bytes);
        entry.receivedBytes += bytes.byteLength;
        return;
      }

      if (message.type === "file-complete") {
        const done = message as FileCompleteMessage;
        const entry = incomingFilesRef.current.get(done.id);
        if (!entry) return;

        const blob = new Blob(entry.chunks, { type: entry.meta.mime || "application/octet-stream" });
        const rf: ReceivedFile = {
          id: entry.meta.id,
          name: entry.meta.name,
          size: entry.meta.size,
          mime: entry.meta.mime,
          fromUserId: entry.meta.fromUserId,
          blob,
          receivedAt: new Date(),
        };
        setReceivedFiles((prev) => [rf, ...prev]);
        incomingFilesRef.current.delete(done.id);

        // Auto-download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = rf.name || "download";
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: "File received",
          description: `Downloaded "${rf.name}"`,
        });
        return;
      }

      // Clipboard sync both directions if allowed
      if (message.type === "clipboard") {
        const content = (message as any).content as string;
        // Host accepts controller clipboard if allowed
        if (currentSession?.allowClipboard) {
          try {
            // Try native agent first
            if (myRole === "host" && controlAdapterRef.current) {
              await controlAdapterRef.current.onClipboard(content);
            }
            // Also try browser clipboard as best-effort
            await navigator.clipboard.writeText(content);
            toast({
              title: "Clipboard synced",
              description: "Clipboard content received.",
            });
          } catch (err) {
            console.error("Clipboard write failed:", err);
          }
        }
        return;
      }

      // Remote control events (host-side)
      if (myRole !== "host") return;
      if (!isControlEnabled) return;

      const adapter = controlAdapterRef.current;
      if (!adapter) return;

      switch (message.type) {
        case "mousemove":
          adapter.onMouseMove(message.x, message.y);
          break;
        case "mousedown":
          adapter.onMouseDown(message.x, message.y, message.button);
          break;
        case "mouseup":
          adapter.onMouseUp(message.x, message.y, message.button);
          break;
        case "scroll":
          adapter.onScroll(message.deltaX, message.deltaY);
          break;
        case "keydown":
          adapter.onKeyDown(message.key, message.code);
          break;
        case "keyup":
          adapter.onKeyUp(message.key, message.code);
          break;
      }
    },
    [currentSession?.allowClipboard, isControlEnabled, myRole, toast]
  );

  // Create or get a peer connection with a remote user
  const ensurePeerConnection = useCallback(
    async (remoteUserId: string, asOfferer: boolean): Promise<PCRecord> => {
      let existing = connectionsRef.current.get(remoteUserId);
      if (existing) return existing;

      // Get optimized ICE configuration
      const iceConfig = await ICEOptimizer.getOptimizedConfig();
      
      const pc = ICEOptimizer.createOptimizedPeerConnection(
        iceConfig,
        async (candidate) => {
          if (candidate) {
            await publishSignal("ice", candidate.toJSON(), remoteUserId);
          }
        },
        (state) => {
          updateConnectionIndicators(state);
          if (state === "disconnected" || state === "failed" || state === "closed") {
            // Clean up on disconnect
            const record = connectionsRef.current.get(remoteUserId);
            if (record) {
              try {
                record.dc?.close();
              } catch {}
              try {
                record.bitrateController?.destroy();
              } catch {}
              try {
                record.connectionMonitor?.destroy();
              } catch {}
              try {
                pc.close();
              } catch {}
              connectionsRef.current.delete(remoteUserId);
            }
          }
        }
      );

      // Enable aggressive ICE for faster connection
      ICEOptimizer.enableAggressiveICE(pc);

      const record: PCRecord = { pc, dc: null, remoteStream: null };
      connectionsRef.current.set(remoteUserId, record);

      // Set up adaptive bitrate controller
      const bitrateController = new AdaptiveBitrateController(pc);
      const connectionMonitor = bitrateController.getConnectionMonitor();
      
      record.bitrateController = bitrateController;
      record.connectionMonitor = connectionMonitor;

      // Start monitoring if this is the primary connection
      if (myRole === "controller" && hostParticipant?.userId === remoteUserId) {
        setPrimaryBitrateController(bitrateController);
        setPrimaryConnectionMonitor(connectionMonitor);
        bitrateController.start();
      } else if (myRole === "host") {
        bitrateController.start();
      }

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
    [handleDataMessage, localStream, publishSignal, updateConnectionIndicators, myRole, hostParticipant]
  );

  const createAndSendOfferTo = useCallback(
    async (remoteUserId: string) => {
      const rec = await ensurePeerConnection(remoteUserId, true);
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

      const rec = await ensurePeerConnection(senderUserId, false);
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
        video: { 
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: true,
      });
      setLocalStream(stream);

      // Attach to all existing connections (host side).
      connectionsRef.current.forEach((rec) => {
        stream.getTracks().forEach((track) => {
          rec.pc.addTrack(track, stream);
        });
        
        // Start bitrate controller for each connection when stream is available
        if (rec.bitrateController) {
          rec.bitrateController.start();
        }
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
    
    // Stop all bitrate controllers
    connectionsRef.current.forEach((rec) => {
      rec.bitrateController?.stop();
    });
    
    toast({ title: "Screen sharing stopped" });
  }, [localStream, toast]);

  // Send data messages (controller -> host) and file transfers
  const sendDataTo = useCallback((remoteUserId: string, message: ControlMessage) => {
    const rec = connectionsRef.current.get(remoteUserId);
    if (rec?.dc && rec.dc.readyState === "open") {
      rec.dc.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const sendData = useCallback(
    (message: ControlMessage) => {
      if (!isControlEnabled) return;
      if (myRole === "controller" && hostParticipant) {
        sendDataTo(hostParticipant.userId, message);
      } else if (myRole === "host") {
        // Host may broadcast certain messages like clipboard to controllers.
        if (message.type === "clipboard") {
          participants
            .filter((p) => p.role === "controller" && p.status === "joined")
            .forEach((p) => sendDataTo(p.userId, message));
        }
      }
    },
    [hostParticipant, isControlEnabled, myRole, participants, sendDataTo]
  );

  // File upload via data channel
  const sendFile = useCallback(
    async (file: File) => {
      if (!user) return;
      const id = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const chunkSize = 64 * 1024; // 64KB
      const totalChunks = Math.ceil(file.size / chunkSize);

      // Determine recipients:
      let targets: string[] = [];
      if (myRole === "controller" && hostParticipant) {
        targets = [hostParticipant.userId];
      } else if (myRole === "host") {
        targets = participants.filter((p) => p.role === "controller" && p.status === "joined").map((p) => p.userId);
      }

      if (targets.length === 0) {
        toast({
          variant: "destructive",
          title: "No recipients",
          description: "No connected peer to send the file to.",
        });
        return;
      }

      const meta: FileMetaMessage = {
        type: "file-meta",
        id,
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        fromUserId: user.id,
      };

      // Send meta
      targets.forEach((t) => sendDataTo(t, meta));

      // Send chunks
      let offset = 0;
      let index = 0;
      while (offset < file.size) {
        const slice = file.slice(offset, offset + chunkSize);
        const arrayBuf = await slice.arrayBuffer();
        const dataB64 = bufferToBase64(arrayBuf);
        const chunkMsg: FileChunkMessage = {
          type: "file-chunk",
          id,
          index,
          dataB64,
        };
        targets.forEach((t) => sendDataTo(t, chunkMsg));
        offset += chunkSize;
        index++;
      }

      // Send complete
      const complete: FileCompleteMessage = {
        type: "file-complete",
        id,
        totalChunks,
      };
      targets.forEach((t) => sendDataTo(t, complete));

      toast({
        title: "File sent",
        description: `Sent "${file.name}" to ${targets.length} recipient(s).`,
      });
    },
    [hostParticipant, myRole, participants, sendDataTo, toast, user]
  );

  // Clipboard sync
  const syncClipboard = useCallback(async () => {
    if (!currentSession?.allowClipboard) {
      toast({
        variant: "destructive",
        title: "Clipboard disabled",
        description: "Clipboard sync is not enabled for this session.",
      });
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast({ title: "Clipboard empty", description: "Nothing to sync." });
        return;
      }
      const msg: ControlMessage = { type: "clipboard", content: text } as any;
      sendData(msg);
      toast({ title: "Clipboard sent", description: "Clipboard content sent to peer(s)." });
    } catch (err) {
      console.error("Clipboard read failed:", err);
      toast({
        variant: "destructive",
        title: "Clipboard error",
        description: "Unable to access clipboard. Please allow permission.",
      });
    }
  }, [currentSession?.allowClipboard, sendData, toast]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!sessionId || !user) return;

    const handleNewParticipant = async (raw: any) => {
      const participant = mapParticipant(raw as SupabaseParticipantRow);
      updateParticipant(participant);

      // If controller and a host joined, initiate offer to host.
      if (myRole === "controller" && participant.role === "host" && participant.status === "joined") {
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
            rec.bitrateController?.destroy();
          } catch {}
          try {
            rec.connectionMonitor?.destroy();
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
          rec.bitrateController?.destroy();
        } catch {}
        try {
          rec.connectionMonitor?.destroy();
        } catch {}
        try {
          rec.pc.close();
        } catch {}
      });
      connectionsRef.current.clear();
      controlAdapterRef.current?.destroy();
      controlAdapterRef.current = null;
      setPrimaryBitrateController(null);
      setPrimaryConnectionMonitor(null);
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
          rec.bitrateController?.destroy();
        } catch {}
        try {
          rec.connectionMonitor?.destroy();
        } catch {}
        try {
          rec.pc.close();
        } catch {}
      });
      connectionsRef.current.clear();
      controlAdapterRef.current?.destroy();
      controlAdapterRef.current = null;
      setPrimaryBitrateController(null);
      setPrimaryConnectionMonitor(null);
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

  // Utils for base64 <-> bytes
  function bufferToBase64(buf: ArrayBuffer) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToUint8Array(b64: string) {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

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

      {/* Optional local preview */}
      {localStream && (
        <video
          autoPlay
          muted
          playsInline
          className="mt-2 max-w-[60%] max-h-[40vh] rounded border border-gray-700"
          ref={(el) => {
            if (el && localStream) {
              el.srcObject = localStream;
            }
          }}
        />
      )}
    </div>
  );

  const ControllerView = () => (
    <RemoteDisplay
      remoteStream={remoteStream}
      sendControlMessage={sendData}
      isControlEnabled={isControlEnabled}
    />
  );

  const myRoleLabel = myRole ? (myRole === "host" ? "Host" : "Controller") : undefined;

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Quality Monitor in top-right corner */}
      <div className="fixed top-20 right-4 z-40 flex items-center space-x-2">
        <QualityMonitor
          connectionMonitor={primaryConnectionMonitor || undefined}
          bitrateController={primaryBitrateController || undefined}
        />
      </div>
      
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
        onUploadFile={sendFile}
        receivedCount={receivedFiles.length}
        onToggleTransfers={() => setTransfersOpen(!transfersOpen)}
        bitrateController={primaryBitrateController || undefined}
        onSyncClipboard={syncClipboard}
        myRoleLabel={myRoleLabel}
        controlAdapterLabel={myRole === "host" ? controlAdapterLabel : undefined}
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
        {transfersOpen && (
          <div className="w-96 border-l border-gray-700">
            <TransfersPanel
              files={receivedFiles}
              onClose={() => setTransfersOpen(false)}
              onClear={(id) => setReceivedFiles((prev) => prev.filter((f) => f.id !== id))}
              onClearAll={() => setReceivedFiles([])}
            />
          </div>
        )}
      </div>
    </div>
  );
}
