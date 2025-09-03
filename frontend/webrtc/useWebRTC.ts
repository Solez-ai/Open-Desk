import { useEffect, useRef, useState, useCallback } from "react";
import { ICE_SERVERS }from "../config";
import type { ControlMessage } from "./types";

interface WebRTCHookProps {
  onDataMessage?: (message: ControlMessage) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onTrack?: (event: RTCTrackEvent) => void;
}

export function useWebRTC({
  onDataMessage,
  onIceCandidate,
  onConnectionStateChange,
  onTrack,
}: WebRTCHookProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const initializePeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate?.(event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setIsConnected(state === "connected");
      onConnectionStateChange?.(state);
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      onTrack?.(event);
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      dataChannelRef.current = channel;
      setupDataChannel(channel);
    };

    return pc;
  }, [onIceCandidate, onConnectionStateChange, onTrack]);

  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.onopen = () => console.log("Data channel open");
    channel.onclose = () => console.log("Data channel closed");
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ControlMessage;
        onDataMessage?.(message);
      } catch (error) {
        console.error("Failed to parse data channel message:", error);
      }
    };
  };

  const createOffer = useCallback(async (): Promise<RTCSessionDescriptionInit | null> => {
    let pc = pcRef.current;
    if (!pc) {
      pc = initializePeerConnection();
    }

    const dataChannel = pc.createDataChannel("control", { ordered: true });
    dataChannelRef.current = dataChannel;
    setupDataChannel(dataChannel);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error("Failed to create offer:", error);
      return null;
    }
  }, [initializePeerConnection]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> => {
    let pc = pcRef.current;
    if (!pc) {
      pc = initializePeerConnection();
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error("Failed to create answer:", error);
      return null;
    }
  }, [initializePeerConnection]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit): Promise<void> => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState !== "have-local-offer") return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error("Failed to set remote answer:", error);
    }
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit): Promise<void> => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Failed to add ICE candidate:", error);
    }
  }, []);

  const startScreenShare = useCallback(async (): Promise<void> => {
    let pc = pcRef.current;
    if (!pc) {
      pc = initializePeerConnection();
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: true,
      });
      
      setLocalStream(stream);
      
      stream.getTracks().forEach(track => {
        pc?.addTrack(track, stream);
      });
    } catch (error) {
      console.error("Failed to start screen share:", error);
      throw error;
    }
  }, [initializePeerConnection]);

  const stopScreenShare = useCallback((): void => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  const sendData = useCallback((data: ControlMessage): void => {
    const channel = dataChannelRef.current;
    if (channel && channel.readyState === "open") {
      channel.send(JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback((): void => {
    stopScreenShare();
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    setRemoteStream(null);
    setIsConnected(false);
  }, [stopScreenShare]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    peerConnection: pcRef.current,
    localStream,
    remoteStream,
    isConnected,
    initializePeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    startScreenShare,
    stopScreenShare,
    sendData,
    disconnect,
  };
}
