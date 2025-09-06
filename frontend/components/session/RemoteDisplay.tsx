import { useRef, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import type { ControlMessage } from "../../webrtc/types";
import RemoteCursor from "./RemoteCursor";

interface RemoteDisplayProps {
  remoteStream: MediaStream | null;
  sendControlMessage: (message: ControlMessage) => void;
  isControlEnabled: boolean;
  cursorName?: string;
}

export default function RemoteDisplay({
  remoteStream,
  sendControlMessage,
  isControlEnabled,
  cursorName,
}: RemoteDisplayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      console.log(`[RemoteDisplay] Setting video srcObject with ${remoteStream.getTracks().length} tracks`);
      console.log(`[RemoteDisplay] Video tracks:`, remoteStream.getTracks().map(t => `${t.kind}:${t.id}:${t.enabled}:${t.readyState}`));
      
      const video = videoRef.current;
      video.srcObject = remoteStream;
      video.muted = false;
      video.autoplay = true;
      video.playsInline = true;
      
      // Enhanced play attempt with multiple retries
      const attemptPlay = async (attempt = 1) => {
        try {
          await video.play();
          console.log(`[RemoteDisplay] Video playing successfully on attempt ${attempt}`);
          console.log(`[RemoteDisplay] Video dimensions: ${video.videoWidth}x${video.videoHeight}`);
        } catch (err) {
          console.error(`[RemoteDisplay] Video play failed on attempt ${attempt}:`, err);
          
          if (attempt < 3) {
            setTimeout(() => attemptPlay(attempt + 1), 500);
          }
        }
      };
      
      // Try playing immediately
      attemptPlay();
      
      // Also try after a short delay
      setTimeout(() => attemptPlay(), 100);
      
      // Listen for video events
      const handleLoadedData = () => {
        console.log(`[RemoteDisplay] Video loaded data - dimensions: ${video.videoWidth}x${video.videoHeight}`);
      };
      
      const handleCanPlay = () => {
        console.log(`[RemoteDisplay] Video can play`);
        video.play().catch(err => console.warn(`[RemoteDisplay] Auto-play failed:`, err));
      };
      
      const handleError = (e: Event) => {
        console.error(`[RemoteDisplay] Video error:`, e);
      };
      
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);
      
      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
      };
    } else {
      console.log(`[RemoteDisplay] No video ref or remote stream available`);
    }
  }, [remoteStream]);

  const handleMouseEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isControlEnabled || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Update cursor position for visual feedback
    setCursorPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setShowCursor(true);

    console.log(`Mouse ${e.type} at normalized coords: ${x.toFixed(3)}, ${y.toFixed(3)}`);

    switch (e.type) {
      case "mousemove":
        sendControlMessage({ type: "mousemove", x, y });
        break;
      case "mousedown":
        sendControlMessage({ type: "mousedown", x, y, button: e.button });
        break;
      case "mouseup":
        sendControlMessage({ type: "mouseup", x, y, button: e.button });
        break;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isControlEnabled) return;
    e.preventDefault();
    
    console.log(`Scroll: deltaX=${e.deltaX}, deltaY=${e.deltaY}`);
    sendControlMessage({ type: "scroll", deltaX: e.deltaX, deltaY: e.deltaY });
  };

  const handleKeyEvent = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isControlEnabled) return;
    e.preventDefault();
    
    console.log(`Key ${e.type}: ${e.key} (${e.code})`);
    sendControlMessage({ type: e.type as "keydown" | "keyup", key: e.key, code: e.code });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isControlEnabled) {
      e.preventDefault();
    }
  };

  const handleMouseLeave = () => {
    setShowCursor(false);
  };

  // Focus the container when control is enabled to capture keyboard events
  useEffect(() => {
    if (isControlEnabled && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isControlEnabled]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-black relative overflow-hidden"
      style={{ cursor: isControlEnabled ? 'none' : 'default' }}
      onMouseMove={handleMouseEvent}
      onMouseDown={handleMouseEvent}
      onMouseUp={handleMouseEvent}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onKeyDown={handleKeyEvent}
      onKeyUp={handleKeyEvent}
      onContextMenu={handleContextMenu}
      tabIndex={0} // Make div focusable for keyboard events
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        data-remote="true"
        className="w-full h-full object-contain bg-gray-800"
        style={{ minHeight: '200px' }}
        onLoadedMetadata={(e) => {
          const video = e.target as HTMLVideoElement;
          console.log(`[RemoteDisplay] Video metadata loaded - ${video.videoWidth}x${video.videoHeight}`);
        }}
        onCanPlay={(e) => {
          const video = e.target as HTMLVideoElement;
          console.log(`[RemoteDisplay] Video can play - ${video.videoWidth}x${video.videoHeight}`);
        }}
        onPlay={() => console.log(`[RemoteDisplay] Video started playing`)}
        onPause={() => console.log(`[RemoteDisplay] Video paused`)}
        onError={(e) => {
          const video = e.target as HTMLVideoElement;
          console.error(`[RemoteDisplay] Video error:`, video.error);
        }}
        onLoadStart={() => console.log(`[RemoteDisplay] Video load started`)}
        onWaiting={() => console.log(`[RemoteDisplay] Video waiting for data`)}
        onStalled={() => console.log(`[RemoteDisplay] Video stalled`)}
      />
      
      {/* Debug overlay for stream status */}
      {!remoteStream && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50">
          <div className="text-center text-white p-4">
            <div className="animate-pulse text-lg mb-2">🔄</div>
            <p className="text-sm">Waiting for video stream...</p>
            <p className="text-xs text-gray-400 mt-1">Host needs to start screen sharing</p>
          </div>
        </div>
      )}
      
      {remoteStream && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          📺 {remoteStream.getTracks().filter(t => t.kind === 'video').length} video, {remoteStream.getTracks().filter(t => t.kind === 'audio').length} audio
        </div>
      )}
      
      {/* Remote cursor visualization when control is enabled */}
      {isControlEnabled && showCursor && (
        <RemoteCursor position={cursorPosition} name={cursorName} />
      )}
      
      {/* Control status overlay */}
      {!isControlEnabled && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="bg-black/80 text-white px-6 py-3 rounded-lg backdrop-blur-sm">
            <p className="text-lg font-semibold">Remote Control Disabled</p>
            <p className="text-sm text-gray-300">Enable control from the toolbar to interact with the host's screen</p>
          </div>
        </div>
      )}
    </div>
  );
}
