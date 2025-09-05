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

    setCursorPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });

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
    sendControlMessage({ type: "scroll", deltaX: e.deltaX, deltaY: e.deltaY });
  };

  const handleKeyEvent = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isControlEnabled) return;
    e.preventDefault();
    sendControlMessage({ type: e.type as "keydown" | "keyup", key: e.key, code: e.code });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isControlEnabled) {
      e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-black relative cursor-none"
      onMouseMove={handleMouseEvent}
      onMouseDown={handleMouseEvent}
      onMouseUp={handleMouseEvent}
      onWheel={handleWheel}
      onKeyDown={handleKeyEvent}
      onKeyUp={handleKeyEvent}
      onContextMenu={handleContextMenu}
      tabIndex={0} // Make div focusable
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
      {isControlEnabled && (
        <RemoteCursor position={cursorPosition} name={cursorName} />
      )}
    </div>
  );
}
