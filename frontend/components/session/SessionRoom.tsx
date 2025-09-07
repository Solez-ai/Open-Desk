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
import WebRTCDebug from "./WebRTCDebug";
import type { ControlMessage, SignalPayload, FileMetaMessage, FileChunkMessage, FileCompleteMessage } from "../../webrtc/types";
import type { Session as SessionData, Participant } from "~backend/session/types";
import { ICE_SERVERS } from "../../config";
import { ICEOptimizer } from "../../webrtc/ICEOptimizer";
import { AdaptiveBitrateController } from "../../webrtc/AdaptiveBitrate";
import { ConnectionMonitor } from "../../webrtc/ConnectionMonitor";
import { BrowserEmulatedAdapter, ControlAdapter, LocalAgentAdapter } from "../../webrtc/ControlAdapters";
import { ScreenShareOptimizer } from "../../webrtc/ScreenShareOptimizer";

type PCRecord = {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  remoteStream: MediaStream | null;
  bitrateController?: AdaptiveBitrateController;
  connectionMonitor?: ConnectionMonitor;
  outgoingQueue?: ControlMessage[]; // messages queued until data channel opens
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
  const { subscribeToSession, supabase: supabaseClient } = useSupabase();
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
  
  // Clipboard monitoring
  const lastClipboardContent = useRef<string>('');
  const clipboardCheckInterval = useRef<NodeJS.Timeout | null>(null);

  const myParticipant = participants.find((p) => p.userId === user?.id);
  const myRole = myParticipant?.role;

  const hostParticipant = useMemo(
    () => participants.find((p) => p.role === "host" && p.status === "joined"),
    [participants]
  );

  // Helpers to map Supabase row -> Participant type
  const mapParticipant = (row: any): Participant => ({
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    username: row.username ?? null,
    fullName: row.full_name ?? null,
    avatarUrl: row.avatar_url ?? null,
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
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    queryFn: async () => {
      if (!sessionId) {
        throw new Error("Session ID is required");
      }
      
      try {
        console.log("Fetching session details for:", sessionId);
        // Always fetch session first
        const sess = await backend.session.getSession({ sessionId });

        // Try backend participants first, then gracefully fall back to Supabase direct select
        let initialParticipants: Participant[] = [];
        try {
          const parts = await backend.session.listParticipants({ sessionId });
          initialParticipants = parts.participants;
        } catch (err) {
          console.warn("Participants fetch via backend failed, trying Supabase directly:", err);
          try {
            if (supabaseClient) {
              const { data, error } = await supabaseClient
                .from("session_participants")
                .select("id, session_id, user_id, role, status, connected_at, disconnected_at, created_at, updated_at")
                .eq("session_id", sessionId);
              if (!error && data) {
                initialParticipants = data.map(mapParticipant);
              } else if (error) {
                console.warn("Supabase direct participants fetch failed:", error);
              }
            }
          } catch (e) {
            console.warn("Supabase direct participants exception:", e);
          }
        }

        console.log("Session fetched successfully:", sess.session);
        return { session: sess.session, participants: initialParticipants };
      } catch (error) {
        console.error("Failed to fetch session:", error);
        throw error;
      }
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

  // Fallback participants polling to reinforce realtime (stops once we see at least 2 joined or role-resolved peers)
  useEffect(() => {
    if (!sessionId) return;
    let stopped = false;

    const shouldStop = () => {
      const joinedCount = participants.filter((p) => p.status === "joined").length;
      // Stop when at least 2 joined members are present, or when host sees any controller
      const hasController = participants.some((p) => p.role === "controller" && p.status === "joined");
      const hasHost = participants.some((p) => p.role === "host" && p.status === "joined");
      return joinedCount >= 2 || (hasHost && hasController);
    };

    async function pollOnce() {
      try {
        const resp = await backend.session.listParticipants({ sessionId });
        if (!stopped && resp?.participants) {
          setParticipants(resp.participants);
        }
      } catch (err) {
        // Non-fatal: realtime will still deliver updates
        console.warn("Participants poll failed:", err);
      }
    }

    // Start a short-lived polling loop until we have a synced view
    const interval = setInterval(() => {
      if (shouldStop()) {
        clearInterval(interval);
        stopped = true;
        return;
      }
      pollOnce();
    }, 3000);

    // Kick an immediate poll
    pollOnce();

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [backend, sessionId, participants, setParticipants]);

  // Setup control adapter when acting as host (attempt native first)
  useEffect(() => {
    let destroyed = false;
    async function setupAdapter() {
      if (myRole !== "host") return;
      
      // Clean previous
      controlAdapterRef.current?.destroy();
      controlAdapterRef.current = null;

      // Request clipboard permissions if clipboard sync is enabled
      if (currentSession?.allowClipboard) {
        try {
          await navigator.clipboard.readText();
          console.log(`[Setup] Clipboard permission granted`);
        } catch (err) {
          console.log(`[Setup] Clipboard permission not granted yet:`, err);
          toast({
            title: "Clipboard Permission Needed",
            description: "Please allow clipboard access for clipboard sync to work.",
            duration: 5000,
          });
        }
      }

      const native = new LocalAgentAdapter();
      const ok = await native.init();
      if (!ok) {
        if (destroyed) return;
        const fallback = new BrowserEmulatedAdapter();
        await fallback.init();
        controlAdapterRef.current = fallback;
        setControlAdapterLabel(`${fallback.name}`);
        // Only show toast in development mode
        if (import.meta.env.DEV) {
        toast({
            title: "Using enhanced browser control",
            description: "Remote control with visual feedback enabled.",
            duration: 3000,
        });
        }
      } else {
        if (destroyed) return;
        controlAdapterRef.current = native;
        setControlAdapterLabel(`${native.name}`);
        // Only show toast in development mode
        if (import.meta.env.DEV) {
        toast({
            title: "Native agent with browser fallback",
          description: "Full remote control enabled.",
            duration: 3000,
        });
        }
      }
    }
    setupAdapter();

    return () => {
      destroyed = true;
      controlAdapterRef.current?.destroy();
      controlAdapterRef.current = null;
      setControlAdapterLabel(undefined);
    };
  }, [myRole, toast, currentSession?.allowClipboard]);

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

  // Handle session status update (top-level to avoid runtime reference errors)
  const handleSessionStatusUpdate = useCallback((payload: any) => {
    console.log("Received session status update:", payload);
    if (payload.sessionId === currentSession?.id) {
      setCurrentSession(prev => prev ? { ...prev, status: payload.status } : null);
      toast({
        title: "Session Status Updated",
        description: `Session is now ${payload.status}`,
        duration: 3000,
      });
    }
  }, [currentSession?.id, setCurrentSession, toast]);

  // Handle incoming data messages (controller -> host and file transfers, clipboard)
  const handleDataMessage = useCallback(
    async (message: any, senderUserId?: string) => {
      console.log("Received data message:", message.type, "from", senderUserId);

      // Handle capability messages
      if (message.type === "capability") {
        console.log("Received capability message:", message.role, "features:", message.features);
        return;
      }

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

      // Enhanced clipboard sync both directions if allowed
      if (message.type === "clipboard") {
        const content = (message as any).content as string;
        console.log(`[Clipboard] Received clipboard content from ${senderUserId}: ${content.length} characters`);
        
        if (currentSession?.allowClipboard) {
          try {
            // Try control adapter first (for host)
            if (myRole === "host" && controlAdapterRef.current) {
              console.log(`[Clipboard] Host: Using control adapter for clipboard sync`);
              await controlAdapterRef.current.onClipboard(content);
            } else {
              console.log(`[Clipboard] Using browser clipboard API`);
            await navigator.clipboard.writeText(content);
            }
            // Prevent auto-sync feedback loops by updating last seen content
            lastClipboardContent.current = content.trim();
            
            toast({
              title: "Clipboard synced",
              description: `Clipboard content received from ${myRole === 'host' ? 'controller' : 'host'}.`,
            });
            console.log(`[Clipboard] Successfully wrote clipboard content`);
          } catch (err) {
            console.error(`[Clipboard] Clipboard write failed:`, err);
            toast({
              variant: "destructive",
              title: "Clipboard sync failed",
              description: "Unable to write to clipboard. Please check browser permissions.",
            });
          }
        } else {
          console.log(`[Clipboard] Clipboard sync disabled for this session`);
          toast({
            variant: "destructive",
            title: "Clipboard disabled",
            description: "Clipboard sync is not enabled for this session.",
          });
        }
        return;
      }

      // Enhanced remote control events (host-side)
      if (myRole !== "host") {
        console.log(`[Control] Not host (${myRole}), ignoring control message: ${message.type}`);
        return;
      }
      
      if (!isControlEnabled) {
        console.log(`[Control] Control disabled, ignoring control message: ${message.type}`);
        return;
      }

      const adapter = controlAdapterRef.current;
      if (!adapter) {
        console.log(`[Control] No control adapter available for message: ${message.type}`);
        return;
      }

      console.log(`[Control] Processing control message from ${senderUserId}: ${message.type}`);

      switch (message.type) {
        case "mousemove":
          console.log(`[Control] Mouse move: ${message.x.toFixed(3)}, ${message.y.toFixed(3)}`);
          adapter.onMouseMove(message.x, message.y);
          break;
          
        case "mousedown":
          const downButton = message.button === 0 ? 'Left' : message.button === 1 ? 'Middle' : 'Right';
          console.log(`[Control] Mouse down: ${downButton} at ${message.x.toFixed(3)}, ${message.y.toFixed(3)}`);
          adapter.onMouseDown(message.x, message.y, message.button);
          break;
          
        case "mouseup":
          const upButton = message.button === 0 ? 'Left' : message.button === 1 ? 'Middle' : 'Right';
          console.log(`[Control] Mouse up: ${upButton} at ${message.x.toFixed(3)}, ${message.y.toFixed(3)}`);
          adapter.onMouseUp(message.x, message.y, message.button);
          break;
          
        case "scroll":
          console.log(`[Control] Scroll: deltaX=${message.deltaX}, deltaY=${message.deltaY}`);
          adapter.onScroll(message.deltaX, message.deltaY);
          break;
          
        case "keydown":
          console.log(`[Control] Key down: ${message.key} (${message.code}) from ${senderUserId} - modifiers: ctrl:${message.ctrlKey} alt:${message.altKey} shift:${message.shiftKey}`);
          adapter.onKeyDown(message.key, message.code, {
            ctrlKey: message.ctrlKey,
            altKey: message.altKey,
            shiftKey: message.shiftKey,
            metaKey: message.metaKey
          });
          break;
          
        case "keyup":
          console.log(`[Control] Key up: ${message.key} (${message.code}) from ${senderUserId} - modifiers: ctrl:${message.ctrlKey} alt:${message.altKey} shift:${message.shiftKey}`);
          adapter.onKeyUp(message.key, message.code, {
            ctrlKey: message.ctrlKey,
            altKey: message.altKey,
            shiftKey: message.shiftKey,
            metaKey: message.metaKey
          });
          break;
          
        default:
          console.warn(`[Control] Unknown control message type: ${message.type}`);
      }
    },
    [currentSession?.allowClipboard, isControlEnabled, myRole, toast]
  );

  // Create or get a peer connection with a remote user
  const ensurePeerConnection = useCallback(
    async (remoteUserId: string, asOfferer: boolean): Promise<PCRecord> => {
      let existing = connectionsRef.current.get(remoteUserId);
      if (existing) return existing;

      console.log(`Creating new peer connection with ${remoteUserId} (asOfferer: ${asOfferer})`);

      // Get optimized ICE configuration
      const optimizer = ICEOptimizer.getInstance();
      const iceConfig = await optimizer.getOptimizedConfig();
      
      const pc = ICEOptimizer.createOptimizedPeerConnection(
        iceConfig,
        async (candidate) => {
          if (candidate) {
            console.log(`Sending ICE candidate to ${remoteUserId}:`, candidate.type);
            await publishSignal("ice", candidate.toJSON(), remoteUserId);
          }
        },
        (state) => {
          console.log(`Connection state with ${remoteUserId}:`, state);
          updateConnectionIndicators(state);
          
          // Update session status when connection is established
          if (state === "connected" && currentSession?.status === "pending") {
            console.log("Connection established, updating session status to active");
            // Broadcast status update to all participants
            backend.session.broadcastStatus({ sessionId: currentSession.id }).catch(err => 
              console.error("Failed to broadcast status:", err)
            );
          }
          
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

      // If host has a local stream, attach tracks to the new connection immediately
      if (myRole === "host" && localStream) {
        console.log(`[WebRTC] Host: Attaching existing local stream tracks to new peer connection with ${remoteUserId}`);
        localStream.getTracks().forEach((track) => {
          try {
            console.log(`[WebRTC] Adding existing track: ${track.kind} (${track.id}) to new connection`);
            pc.addTrack(track, localStream);
          } catch (error) {
            console.error(`[WebRTC] Failed to add existing track to new connection:`, error);
          }
        });
        console.log(`[WebRTC] New connection ${remoteUserId} has ${pc.getSenders().length} senders`);
      }

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

      // Enhanced track handling with better debugging
      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received track: ${event.track.kind} from ${remoteUserId}`);
        console.log(`[WebRTC] Track ID: ${event.track.id}, ReadyState: ${event.track.readyState}, Enabled: ${event.track.enabled}`);
        console.log(`[WebRTC] Event streams:`, event.streams);
        console.log(`[WebRTC] My role: ${myRole}, Remote user: ${remoteUserId}`);
        
        // For controllers, set the host's stream
        if (myRole === "controller") {
          let stream: MediaStream | null = null;
          
        if (event.streams && event.streams[0]) {
            stream = event.streams[0];
            console.log(`[WebRTC] Using stream from event.streams[0], tracks: ${stream.getTracks().length}`);
        } else {
          // Fallback: create stream from track
            stream = new MediaStream([event.track]);
            console.log(`[WebRTC] Created new stream from track`);
          }
          
          if (stream) {
            // Ensure track is enabled
            event.track.enabled = true;
            
            // Store in record
          record.remoteStream = stream;
            
            console.log(`[WebRTC] Setting remote stream with ${stream.getTracks().length} tracks`);
            console.log(`[WebRTC] Stream tracks:`, stream.getTracks().map(t => `${t.kind}:${t.id}:${t.enabled}:${t.readyState}`));
            
            // Update React state
          setRemoteStream(stream);
            
            // Force video element update with multiple attempts
            const updateVideoElement = () => {
              const videoElement = document.querySelector('video[data-remote="true"]') as HTMLVideoElement;
              if (videoElement) {
                console.log(`[WebRTC] Updating video element, current srcObject:`, videoElement.srcObject);
                videoElement.srcObject = stream;
                videoElement.muted = false;
                videoElement.autoplay = true;
                videoElement.playsInline = true;
                
                // Force play
                videoElement.play().then(() => {
                  console.log(`[WebRTC] Video playing successfully`);
                }).catch(err => {
                  console.error(`[WebRTC] Video play failed:`, err);
                });
                
                console.log(`[WebRTC] Video element updated - width: ${videoElement.videoWidth}, height: ${videoElement.videoHeight}`);
              } else {
                console.warn(`[WebRTC] Video element with data-remote="true" not found`);
              }
            };
            
            // Try multiple times to ensure the video element is updated
            updateVideoElement();
            setTimeout(updateVideoElement, 100);
            setTimeout(updateVideoElement, 500);
            setTimeout(updateVideoElement, 1000);
            
            // Also trigger a re-render by updating a timestamp
            setTimeout(() => {
              console.log(`[WebRTC] Triggering additional stream update for controller`);
              setRemoteStream(prev => prev === stream ? new MediaStream(stream.getTracks()) : stream);
            }, 200);
          }
        }
      };

      // Enhanced data channel setup
      if (asOfferer) {
        const dc = pc.createDataChannel("control", { 
          ordered: true,
          // Reliable with partial reliability fallback for large transfers
          // Many browsers ignore both maxRetransmits and maxRetransmitTime when ordered:true
          // but we include conservative values for compatibility.
          maxRetransmits: 5,
          maxRetransmitTime: 3000
        });
        record.dc = dc;
        record.outgoingQueue = [];
        
        dc.onopen = () => {
          console.log("Data channel opened (offerer) with", remoteUserId);
          // Send initial control capability message
          const capabilityMsg = {
            type: "capability",
            role: myRole,
            features: ["mouse", "keyboard", "clipboard", "file-transfer"]
          };
          dc.send(JSON.stringify(capabilityMsg));
          // Flush any queued messages
          if (record.outgoingQueue && record.outgoingQueue.length > 0) {
            console.log(`[DC] Flushing ${record.outgoingQueue.length} queued messages to`, remoteUserId);
            for (const msg of record.outgoingQueue) {
              try { dc.send(JSON.stringify(msg)); } catch (e) { console.warn("Failed to send queued message", e); }
            }
            record.outgoingQueue = [];
          }
        };
        
        dc.onclose = () => {
          console.log("Data channel closed (offerer) with", remoteUserId);
        };
        
        dc.onerror = (error) => {
          console.error("Data channel error (offerer):", error);
        };
        
        dc.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data) as ControlMessage;
            console.log("Received data channel message:", msg.type, "from", remoteUserId);
            handleDataMessage(msg, remoteUserId);
          } catch (err) {
            console.error("Failed to parse data channel message:", err);
          }
        };
      } else {
        pc.ondatachannel = (event) => {
          record.dc = event.channel;
          const dc = event.channel;
          console.log("Data channel received (answerer) from", remoteUserId);
          record.outgoingQueue = [];
          
          dc.onopen = () => {
            console.log("Data channel opened (answerer) with", remoteUserId);
            // Send initial control capability message
            const capabilityMsg = {
              type: "capability",
              role: myRole,
              features: ["mouse", "keyboard", "clipboard", "file-transfer"]
            };
            dc.send(JSON.stringify(capabilityMsg));
            if (record.outgoingQueue && record.outgoingQueue.length > 0) {
              console.log(`[DC] Flushing ${record.outgoingQueue.length} queued messages to`, remoteUserId);
              for (const msg of record.outgoingQueue) {
                try { dc.send(JSON.stringify(msg)); } catch (e) { console.warn("Failed to send queued message", e); }
              }
              record.outgoingQueue = [];
            }
          };
          
          dc.onclose = () => {
            console.log("Data channel closed (answerer) with", remoteUserId);
          };
          
          dc.onerror = (error) => {
            console.error("Data channel error (answerer):", error);
          };
          
          dc.onmessage = (e) => {
            try {
              const msg = JSON.parse(e.data) as ControlMessage;
              console.log("Received data channel message:", msg.type, "from", remoteUserId);
              handleDataMessage(msg, remoteUserId);
            } catch (err) {
              console.error("Failed to parse data channel message:", err);
            }
          };
        };
      }

      return record;
    },
    [handleDataMessage, publishSignal, updateConnectionIndicators, myRole, hostParticipant, currentSession, backend]
  );

  // Add tracks to existing connections and prepare for renegotiation
  const addTracksToConnections = useCallback((stream: MediaStream) => {
    console.log("Adding tracks to existing connections");
    connectionsRef.current.forEach((record, userId) => {
      console.log("Processing connection with:", userId, "State:", record.pc.signalingState);
      
      // Add tracks to the peer connection
      stream.getTracks().forEach((track) => {
        try {
          console.log(`Adding track: ${track.kind} (${track.id}) to connection with ${userId}`);
          record.pc.addTrack(track, stream);
        } catch (error) {
          console.error(`Failed to add track to connection with ${userId}:`, error);
        }
      });
    });
  }, []);

  const createAndSendOfferTo = useCallback(
    async (remoteUserId: string) => {
      console.log(`[WebRTC] Creating offer to: ${remoteUserId} (myRole: ${myRole})`);
      const rec = await ensurePeerConnection(remoteUserId, true);
      
      try {
        // If host has a local stream, ensure tracks are added before creating offer
        if (myRole === "host" && localStream) {
          console.log(`[WebRTC] Host: Adding ${localStream.getTracks().length} tracks before creating offer`);
          
          // Remove any existing tracks first to avoid duplicates
          const existingSenders = rec.pc.getSenders();
          for (const sender of existingSenders) {
            if (sender.track) {
              console.log(`[WebRTC] Removing existing track: ${sender.track.kind}`);
              rec.pc.removeTrack(sender);
            }
          }
          
          // Add all tracks from local stream
          localStream.getTracks().forEach((track) => {
            try {
              console.log(`[WebRTC] Adding track to offer: ${track.kind} (${track.id}) enabled: ${track.enabled} readyState: ${track.readyState}`);
              rec.pc.addTrack(track, localStream);
            } catch (error) {
              console.error(`[WebRTC] Failed to add track:`, error);
            }
          });
          
          console.log(`[WebRTC] Total senders after adding tracks: ${rec.pc.getSenders().length}`);
        }
        
        const offer = await rec.pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        console.log(`[WebRTC] Created offer with ${offer.sdp?.split('m=').length - 1} media sections`);
        
        await rec.pc.setLocalDescription(offer);
        await publishSignal("offer", offer, remoteUserId);
        console.log(`[WebRTC] Offer sent to: ${remoteUserId}`);
      } catch (err) {
        console.error(`[WebRTC] Failed to create/send offer:`, err);
        toast({
          variant: "destructive",
          title: "Connection error",
          description: "Failed to initiate connection.",
        });
      }
    },
    [ensurePeerConnection, publishSignal, toast, myRole, localStream]
  );

  const handleOffer = useCallback(
    async (senderUserId: string, offer: RTCSessionDescriptionInit) => {
      console.log(`[WebRTC] Received offer from: ${senderUserId} (myRole: ${myRole})`);
      console.log(`[WebRTC] Offer SDP contains ${offer.sdp?.split('m=').length - 1} media sections`);
      
      // Host must have a local stream before answering; if not, queue the offer.
      if (myRole === "host" && !localStream) {
        console.log(`[WebRTC] Host has no local stream, queuing offer from ${senderUserId}`);
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
        console.log(`[WebRTC] Set remote description for ${senderUserId}`);
        
        // If host has a local stream, add tracks before creating answer
        if (myRole === "host" && localStream) {
          console.log(`[WebRTC] Host: Adding ${localStream.getTracks().length} tracks before creating answer`);
          
          // Remove any existing tracks first
          const existingSenders = rec.pc.getSenders();
          for (const sender of existingSenders) {
            if (sender.track) {
              console.log(`[WebRTC] Removing existing track: ${sender.track.kind}`);
              rec.pc.removeTrack(sender);
            }
          }
          
          // Add all tracks from local stream
          localStream.getTracks().forEach((track) => {
            try {
              console.log(`[WebRTC] Adding track to answer: ${track.kind} (${track.id}) enabled: ${track.enabled} readyState: ${track.readyState}`);
              rec.pc.addTrack(track, localStream);
            } catch (error) {
              console.error(`[WebRTC] Failed to add track to answer:`, error);
            }
          });
          
          console.log(`[WebRTC] Total senders after adding tracks: ${rec.pc.getSenders().length}`);
        }
        
        const answer = await rec.pc.createAnswer();
        console.log(`[WebRTC] Created answer with ${answer.sdp?.split('m=').length - 1} media sections`);
        
        await rec.pc.setLocalDescription(answer);
        await publishSignal("answer", answer, senderUserId);
        console.log(`[WebRTC] Answer sent to: ${senderUserId}`);
      } catch (err) {
        console.error(`[WebRTC] Failed to handle offer from ${senderUserId}:`, err);
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
    console.log("Received answer from:", senderUserId);
    const rec = connectionsRef.current.get(senderUserId);
    if (!rec) {
      console.warn("No peer connection found for answer from:", senderUserId);
      return;
    }
    try {
      if (rec.pc.signalingState === "have-local-offer") {
        await rec.pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("Answer processed for:", senderUserId);
      } else {
        console.warn("Unexpected signaling state for answer:", rec.pc.signalingState);
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
      console.log("Starting screen share...");
      
      // Get optimal constraints from screen share optimizer
      const optimizer = ScreenShareOptimizer.getInstance();
      const constraints = await optimizer.getOptimalConstraints();
      
      console.log("Using optimized constraints:", constraints);
      
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      console.log("Screen share stream created with tracks:", stream.getTracks().map(t => `${t.kind}:${t.id}`));
      setLocalStream(stream);

      console.log(`[ScreenShare] Stream created with ${stream.getTracks().length} tracks`);
      stream.getTracks().forEach(track => {
        console.log(`[ScreenShare] Track: ${track.kind} (${track.id}) enabled: ${track.enabled} readyState: ${track.readyState}`);
      });

      // Optimize the stream for all existing connections
      for (const [userId, record] of connectionsRef.current) {
        await optimizer.optimizeStream(stream, record.pc);
      }

      // Add tracks to all existing connections with enhanced logging
      console.log(`[ScreenShare] Adding tracks to ${connectionsRef.current.size} existing connections`);
    connectionsRef.current.forEach((record, userId) => {
        console.log(`[ScreenShare] Processing connection with: ${userId}, State: ${record.pc.signalingState}`);
        
        // Remove existing tracks first to avoid duplicates
        const existingSenders = record.pc.getSenders();
        existingSenders.forEach(sender => {
        if (sender.track) {
            console.log(`[ScreenShare] Removing existing track: ${sender.track.kind} from ${userId}`);
          record.pc.removeTrack(sender);
        }
      });
      
        // Add new tracks from the stream
      stream.getTracks().forEach((track) => {
          try {
            console.log(`[ScreenShare] Adding track: ${track.kind} (${track.id}) to connection with ${userId}`);
        record.pc.addTrack(track, stream);
          } catch (error) {
            console.error(`[ScreenShare] Failed to add track to connection with ${userId}:`, error);
          }
        });
        
        console.log(`[ScreenShare] Connection ${userId} now has ${record.pc.getSenders().length} senders`);
      });

      // Create new offers with the tracks
      const connectionPromises = Array.from(connectionsRef.current.entries()).map(
        async ([userId, record]) => {
          console.log(`[ScreenShare] Creating renegotiation offer for ${userId}, state: ${record.pc.signalingState}`);
          
      if (record.pc.signalingState === "stable") {
        try {
              const offer = await record.pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
              });
              
              console.log(`[ScreenShare] Created renegotiation offer for ${userId} with ${offer.sdp?.split('m=').length - 1} media sections`);
              
          await record.pc.setLocalDescription(offer);
          await publishSignal("offer", offer, userId);
              console.log(`[ScreenShare] Renegotiation offer sent to ${userId}`);
            } catch (error) {
              console.error(`[ScreenShare] Failed to create renegotiation offer for ${userId}:`, error);
        }
      } else {
            console.log(`[ScreenShare] Skipping renegotiation for ${userId} - signaling state: ${record.pc.signalingState}`);
          }
        }
      );

      await Promise.all(connectionPromises);
      console.log(`[ScreenShare] Renegotiation completed for all connections`);

      toast({
        title: "Screen sharing started",
        description: "Your screen is now being shared.",
      });

      // Process any pending offers now that we have a local stream.
      const pendingOffers = Array.from(pendingOffersRef.current.entries());
      pendingOffersRef.current.clear();
      
      for (const [sender, offer] of pendingOffers) {
        console.log("Processing pending offer from:", sender);
        await handleOffer(sender, offer);
      }

      // Handle stop event
      const handleEnded = () => {
        console.log("Screen share ended");
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
  }, [addTracksToConnections, handleOffer, publishSignal, toast]);

  const stopScreenShare = useCallback(() => {
    console.log("Stopping screen share...");
    const s = localStream;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    
    // Remove tracks from all connections
    connectionsRef.current.forEach((record) => {
      const senders = record.pc.getSenders();
      senders.forEach(sender => {
        if (sender.track) {
          record.pc.removeTrack(sender);
        }
      });
      record.bitrateController?.stop();
    });
    
    toast({ title: "Screen sharing stopped" });
  }, [localStream, toast]);

  // Send data messages (controller -> host) and file transfers
  const sendDataTo = useCallback((remoteUserId: string, message: ControlMessage) => {
    const rec = connectionsRef.current.get(remoteUserId);
    if (rec?.dc && rec.dc.readyState === "open") {
      console.log("Sending data message to", remoteUserId, ":", message.type);
      rec.dc.send(JSON.stringify(message));
      return true;
    } else if (rec) {
      console.warn("Data channel not ready; queueing message for", remoteUserId, message.type);
      if (!rec.outgoingQueue) rec.outgoingQueue = [];
      rec.outgoingQueue.push(message);
    return false;
    } else {
      console.warn("Cannot send data to", remoteUserId, "- no connection record");
      return false;
    }
  }, []);

  const sendData = useCallback(
    (message: ControlMessage) => {
      if (!isControlEnabled && message.type !== "clipboard" && message.type !== "file-meta" && message.type !== "file-chunk" && message.type !== "file-complete") {
        console.log("Control disabled, not sending message");
        return;
      }
      
      console.log("Sending control message:", message.type, "from", myRole);
      
      if (myRole === "controller" && hostParticipant) {
        const sent = sendDataTo(hostParticipant.userId, message);
        if (!sent) {
          console.warn("Failed to send control message to host");
        }
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
      
      console.log(`[FileTransfer] Starting file transfer: ${file.name} (${file.size} bytes)`);
      
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

      console.log(`[FileTransfer] Sending to ${targets.length} recipients: ${targets.join(', ')}`);

      const meta: FileMetaMessage = {
        type: "file-meta",
        id,
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        fromUserId: user.id,
      };

      // Send meta to all targets
      let metaSent = 0;
      targets.forEach((t) => {
        if (sendDataTo(t, meta)) {
          metaSent++;
        }
      });

      if (metaSent === 0) {
        toast({
          variant: "destructive",
          title: "Transfer failed",
          description: "No data channels are ready for file transfer.",
        });
        return;
      }

      console.log(`[FileTransfer] Meta sent to ${metaSent}/${targets.length} recipients`);

      // Send chunks with progress tracking
      let offset = 0;
      let index = 0;
      let successfulChunks = 0;

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

        // Backpressure handling: wait if bufferedAmount is too high
        for (const [userId, record] of connectionsRef.current.entries()) {
          const dc = record.dc;
          if (dc && dc.readyState === "open") {
            while (dc.bufferedAmount > 2 * 1024 * 1024) { // 2MB threshold
              await new Promise((res) => setTimeout(res, 50));
            }
          }
        }

        let chunkSent = 0;
        targets.forEach((t) => {
          if (sendDataTo(t, chunkMsg)) {
            chunkSent++;
          }
        });

        if (chunkSent > 0) {
          successfulChunks++;
        }

        offset += chunkSize;
        index++;

        // Show progress for large files
        if (file.size > 1024 * 1024 && index % 16 === 0) { // Every 1MB for files > 1MB
          const progress = Math.round((offset / file.size) * 100);
          console.log(`[FileTransfer] Progress: ${progress}% (${index}/${totalChunks} chunks)`);
        }
      }

      console.log(`[FileTransfer] Sent ${successfulChunks}/${totalChunks} chunks successfully`);

      // Send complete
      const complete: FileCompleteMessage = {
        type: "file-complete",
        id,
        totalChunks,
      };
      
      let completeSent = 0;
      targets.forEach((t) => {
        if (sendDataTo(t, complete)) {
          completeSent++;
        }
      });

      if (completeSent > 0) {
      toast({
        title: "File sent",
          description: `Sent "${file.name}" (${Math.round(file.size / 1024)} KB) to ${completeSent} recipient(s).`,
        });
        console.log(`[FileTransfer] Transfer completed: ${file.name}`);
      } else {
        toast({
          variant: "destructive",
          title: "Transfer incomplete",
          description: "File transfer may have failed. Check data channel connections.",
        });
      }
    },
    [hostParticipant, myRole, participants, sendDataTo, toast, user]
  );

  // Enhanced clipboard sync
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
      console.log(`[Clipboard] Reading clipboard content...`);
      const text = await navigator.clipboard.readText();
      
      if (!text || text.trim().length === 0) {
        toast({ 
          title: "Clipboard empty", 
          description: "Nothing to sync." 
        });
        return;
      }

      console.log(`[Clipboard] Clipboard content read: ${text.length} characters`);
      
      const msg: ControlMessage = { 
        type: "clipboard", 
        content: text.trim() 
      } as any;
      
      // Send to appropriate recipients
      let sentCount = 0;
      if (myRole === "controller" && hostParticipant) {
        if (sendDataTo(hostParticipant.userId, msg)) {
          sentCount++;
          console.log(`[Clipboard] Sent clipboard to host: ${hostParticipant.userId}`);
        }
      } else if (myRole === "host") {
        participants
          .filter((p) => p.role === "controller" && p.status === "joined")
          .forEach((p) => {
            if (sendDataTo(p.userId, msg)) {
              sentCount++;
              console.log(`[Clipboard] Sent clipboard to controller: ${p.userId}`);
            }
          });
      }

      if (sentCount > 0) {
        toast({ 
          title: "Clipboard sent", 
          description: `Clipboard content sent to ${sentCount} peer(s).` 
        });
        console.log(`[Clipboard] Successfully sent to ${sentCount} recipients`);
      } else {
        toast({
          variant: "destructive",
          title: "Clipboard sync failed",
          description: "No data channels are ready for clipboard sync.",
        });
        console.warn(`[Clipboard] Failed to send - no ready data channels`);
      }
    } catch (err) {
      console.error(`[Clipboard] Clipboard read failed:`, err);
      toast({
        variant: "destructive",
        title: "Clipboard error",
        description: "Unable to access clipboard. Please allow permission in browser settings.",
      });
    }
  }, [currentSession?.allowClipboard, sendDataTo, toast, myRole, hostParticipant, participants]);

  // Automatic clipboard monitoring for seamless sync
  useEffect(() => {
    if (!currentSession?.allowClipboard) {
      // Stop monitoring if clipboard sync is disabled
      if (clipboardCheckInterval.current) {
        clearInterval(clipboardCheckInterval.current);
        clipboardCheckInterval.current = null;
      }
      return;
    }

    console.log(`[Clipboard] Starting automatic clipboard monitoring`);
    
    const checkClipboard = async () => {
      try {
        const currentContent = await navigator.clipboard.readText();
        
        if (currentContent && 
            currentContent.trim() !== lastClipboardContent.current && 
            currentContent.trim().length > 0) {
          
          console.log(`[Clipboard] Detected clipboard change: ${currentContent.length} characters`);
          lastClipboardContent.current = currentContent.trim();
          
          // Auto-sync clipboard content
          const msg: ControlMessage = { 
            type: "clipboard", 
            content: currentContent.trim() 
          } as any;
          
          let sentCount = 0;
          if (myRole === "controller" && hostParticipant) {
            if (sendDataTo(hostParticipant.userId, msg)) {
              sentCount++;
              console.log(`[Clipboard] Auto-synced to host`);
            }
          } else if (myRole === "host") {
            participants
              .filter((p) => p.role === "controller" && p.status === "joined")
              .forEach((p) => {
                if (sendDataTo(p.userId, msg)) {
                  sentCount++;
                  console.log(`[Clipboard] Auto-synced to controller: ${p.userId}`);
                }
              });
          }
          
          if (sentCount > 0) {
            console.log(`[Clipboard] Auto-synced to ${sentCount} peer(s)`);
          }
        }
      } catch (err) {
        // Silently fail for auto-sync - user might not have granted permission yet
        console.debug(`[Clipboard] Auto-sync check failed (permission not granted):`, err);
      }
    };

    // Check clipboard every 2 seconds
    clipboardCheckInterval.current = setInterval(checkClipboard, 2000);
    
    // Initial check
    checkClipboard();

    return () => {
      if (clipboardCheckInterval.current) {
        clearInterval(clipboardCheckInterval.current);
        clipboardCheckInterval.current = null;
      }
    };
  }, [currentSession?.allowClipboard, myRole, hostParticipant?.userId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!sessionId || !user) return;

    const handleNewParticipant = async (raw: any) => {
      const participant = mapParticipant(raw);
      console.log(`[SessionRoom] Participant update: ${participant.userId} (${participant.role}) - ${participant.status}`);
      updateParticipant(participant);

      // If controller and a host joined, initiate offer to host.
      if (myRole === "controller" && participant.role === "host" && participant.status === "joined") {
        const exists = connectionsRef.current.has(participant.userId);
        if (!exists) {
          console.log(`[SessionRoom] Controller detected host joined: ${participant.userId}, creating offer`);
          await createAndSendOfferTo(participant.userId);
        }
      }

      // If host and a controller joined, be ready to accept offers
      if (myRole === "host" && participant.role === "controller" && participant.status === "joined") {
        console.log(`[SessionRoom] Host detected controller joined: ${participant.userId}`);
        // Host doesn't need to initiate, controllers will send offers
      }

      // If participant left, tear down connection.
      if (participant.status === "left") {
        console.log(`[SessionRoom] Participant left: ${participant.userId}, cleaning up connection`);
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
        // Remove from participants list
        removeParticipant(participant.userId);
      }
    };

    const handleSignal = async (signal: any) => {
      // If recipient is null we treat it as a broadcast to the whole session.
      if (!user) return;
      if (signal.recipient_user_id && signal.recipient_user_id !== user.id) return;

      const payload = signal.payload;
      console.log("Received signal:", signal.type, "from", signal.sender_user_id);
      
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
        case "session_status_update":
          handleSessionStatusUpdate(payload);
          break;
        case "status":
          // New generic DB-safe signal type; payload carries the specific subtype
          handleSessionStatusUpdate(payload);
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

    // Removed REST prefetch of signals to avoid RLS policy recursion/500s

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
    handleSessionStatusUpdate,
  ]);

  // On initial host presence when controller joins late
  useEffect(() => {
    if (myRole === "controller" && hostParticipant) {
      const exists = connectionsRef.current.has(hostParticipant.userId);
      if (!exists) {
        console.log("Controller detected host, creating offer");
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
    console.error("Session error:", sessionError);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Session Not Found</h1>
          <p className="text-muted-foreground">
            The session you're looking for doesn't exist or you don't have permission to access it.
          </p>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const HostView = () => (
    <div className="h-full flex flex-col items-center justify-center bg-gray-800 text-white space-y-6 p-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <Monitor className="h-24 w-24 text-emerald-400" />
            <div className="absolute -top-2 -right-2 bg-emerald-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
              HOST
            </div>
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-center">
        {localStream ? "You are sharing your screen" : "You are hosting this session"}
      </h2>
        
        <div className="bg-gray-700/50 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm text-gray-300 mb-2">Session Code:</p>
          <div className="font-mono text-2xl font-bold text-emerald-400 tracking-widest">
            {currentSession.code}
          </div>
        </div>

      {!localStream ? (
          <div className="space-y-4">
            <Button 
              onClick={startScreenShare} 
              disabled={isStartingShare}
              className="bg-emerald-600 hover:bg-emerald-600/90 text-white px-8 py-3 text-lg"
            >
          {isStartingShare ? (
            <>
                  <Play className="h-5 w-5 mr-3 animate-pulse" />
              Starting...
            </>
          ) : (
            <>
                  <Play className="h-5 w-5 mr-3" />
              Start screen sharing
            </>
          )}
        </Button>
            <p className="text-sm text-gray-300">
              Controllers will connect automatically when you start sharing.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Button 
              variant="destructive" 
              onClick={stopScreenShare}
              className="px-8 py-3 text-lg"
            >
              <Square className="h-5 w-5 mr-3" />
          Stop screen sharing
        </Button>
            <div className="text-center space-y-2">
              <p className="text-emerald-400 font-semibold">
                🟢 Your screen is being shared
              </p>
              <p className="text-sm text-gray-300">
                Controllers can now view and control your screen
              </p>
            </div>
          </div>
        )}

        {controlAdapterLabel && (
          <div className="mt-6 p-3 bg-blue-600/20 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-200">
              Remote control: <span className="font-semibold">{controlAdapterLabel}</span>
            </p>
          </div>
        )}
      </div>

      {/* Enhanced local preview - larger and better positioned */}
      {localStream && (
        <div className="mt-8 w-full max-w-6xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400">Your screen preview:</p>
            <div className="text-xs text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded">
              🟢 Broadcasting to {participants.filter(p => p.role === 'controller' && p.status === 'joined').length} controller(s)
            </div>
          </div>
        <video
          autoPlay
          muted
          playsInline
            className="w-full aspect-video max-h-[70vh] rounded-lg border-2 border-emerald-600 shadow-2xl bg-black object-contain"
          ref={(el) => {
            if (el && localStream) {
              el.srcObject = localStream;
                console.log("Host preview video updated with stream");
            }
          }}
        />
          <div className="mt-2 text-xs text-gray-500 text-center">
            Controllers can now view and control your screen
          </div>
        </div>
      )}
    </div>
  );

  const ControllerView = () => {
    const controllerName = user?.user_metadata?.username || user?.email || "You";
    
    if (!remoteStream) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-gray-800 text-white space-y-6 p-8">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <Monitor className="h-24 w-24 text-blue-400 opacity-50" />
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                  CONTROLLER
                </div>
              </div>
            </div>
            
            <h2 className="text-3xl font-bold">Waiting for host to share screen</h2>
            
            <div className="bg-gray-700/50 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-gray-300 mb-2">Session Code:</p>
              <div className="font-mono text-2xl font-bold text-blue-400 tracking-widest">
                {currentSession.code}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                <p className="text-yellow-400 font-semibold">Waiting for host...</p>
              </div>
          <p className="text-sm text-gray-300">
            The host needs to start screen sharing before you can view their screen.
          </p>
            </div>

            <div className="mt-6 p-4 bg-blue-600/10 border border-blue-500/20 rounded-lg">
              <h3 className="font-semibold text-blue-200 mb-2">As a Controller, you can:</h3>
              <ul className="text-sm text-blue-200 space-y-1 text-left">
                <li>• View the host's screen in real-time</li>
                <li>• Control the host's mouse and keyboard</li>
                <li>• Send files to the host</li>
                <li>• Sync clipboard content</li>
                <li>• Chat with other participants</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="h-full relative">
        {/* Control status indicator */}
        <div className="absolute top-4 left-4 z-10 flex items-center space-x-2">
          <div className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
            CONTROLLER
          </div>
          {isControlEnabled ? (
            <div className="bg-green-600 text-white text-xs px-3 py-1 rounded-full font-semibold flex items-center">
              <div className="w-2 h-2 bg-green-200 rounded-full mr-2 animate-pulse"></div>
              CONTROL ACTIVE
            </div>
          ) : (
            <div className="bg-gray-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
              CONTROL DISABLED
            </div>
          )}
        </div>

      <RemoteDisplay
        remoteStream={remoteStream}
        sendControlMessage={sendData}
        isControlEnabled={isControlEnabled}
        cursorName={controllerName}
      />
      </div>
    );
  };

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
      
      {/* WebRTC Debug Component */}
      <WebRTCDebug
        connections={connectionsRef.current}
        localStream={localStream}
        remoteStream={remoteStream}
        myRole={myRole}
      />
    </div>
  );
}
