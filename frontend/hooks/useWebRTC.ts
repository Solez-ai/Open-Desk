import { useEffect, useRef, useState, useCallback } from "react";
import { ICE_SERVERS } from "../config";

export interface WebRTCConnection {
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnected: boolean;
  createOffer: () => Promise<RTCSessionDescriptionInit | null>;
  createAnswer: (offer: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit | null>;
  setRemoteAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  disconnect: () => void;
}

export function useWebRTC(): WebRTCConnection {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      setIsConnected(pc.connectionState === "connected");
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    return () => {
      pc.close();
    };
  }, []);

  const createOffer = useCallback(async (): Promise<RTCSessionDescriptionInit | null> => {
    const pc = pcRef.current;
    if (!pc) return null;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error("Failed to create offer:", error);
      return null;
    }
  }, []);

  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> => {
    const pc = pcRef.current;
    if (!pc) return null;

    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error("Failed to create answer:", error);
      return null;
    }
  }, []);

  const setRemoteAnswer = useCallback(async (answer: RTCSessionDescriptionInit): Promise<void> => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(answer);
    } catch (error) {
      console.error("Failed to set remote answer:", error);
    }
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit): Promise<void> => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.error("Failed to add ICE candidate:", error);
    }
  }, []);

  const startScreenShare = useCallback(async (): Promise<void> => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      
      setLocalStream(stream);
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    } catch (error) {
      console.error("Failed to start screen share:", error);
    }
  }, []);

  const stopScreenShare = useCallback((): void => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  const disconnect = useCallback((): void => {
    const pc = pcRef.current;
    if (pc) {
      pc.close();
    }
    stopScreenShare();
    setRemoteStream(null);
    setIsConnected(false);
  }, [stopScreenShare]);

  return {
    peerConnection: pcRef.current,
    localStream,
    remoteStream,
    isConnected,
    createOffer,
    createAnswer,
    setRemoteAnswer,
    addIceCandidate,
    startScreenShare,
    stopScreenShare,
    disconnect,
  };
}
