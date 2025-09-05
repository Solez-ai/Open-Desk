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
      console.log("Setting video srcObject:", remoteStream);
      console.log("Video tracks:", remoteStream.getTracks().map(t => `${t.kind}:${t.id}`));
      videoRef.current.srcObject = remoteStream;
      
      // Force play
      videoRef.current.play().catch(err => {
        console.error("Video play failed:", err);
      });
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
        className="w-full h-full object-contain"
        onLoadedMetadata={() => console.log("Video metadata loaded")}
        onCanPlay={() => console.log("Video can play")}
        onError={(e) => console.error("Video error:", e)}
      />
      
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
