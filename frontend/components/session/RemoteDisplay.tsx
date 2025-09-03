import { useRef, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import type { ControlMessage } from "../../webrtc/types";
import RemoteCursor from "./RemoteCursor";

interface RemoteDisplayProps {
  remoteStream: MediaStream | null;
  sendControlMessage: (message: ControlMessage) => void;
  isControlEnabled: boolean;
}

export default function RemoteDisplay({
  remoteStream,
  sendControlMessage,
  isControlEnabled,
}: RemoteDisplayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
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

  const handleKeyEvent = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isControlEnabled) return;
    e.preventDefault();
    sendControlMessage({ type: e.type as "keydown" | "keyup", key: e.key, code: e.code });
  };

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-black relative cursor-none"
      onMouseMove={handleMouseEvent}
      onMouseDown={handleMouseEvent}
      onMouseUp={handleMouseEvent}
      onKeyDown={handleKeyEvent}
      onKeyUp={handleKeyEvent}
      tabIndex={0} // Make div focusable
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
      {isControlEnabled && (
        <RemoteCursor position={cursorPosition} name={user?.email || "You"} />
      )}
    </div>
  );
}
