import { useRef, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Play, Loader2 } from "lucide-react";
import { useWebRTC } from "../../hooks/useWebRTC";
import type { Session } from "~backend/session/types";

interface RemoteDisplayProps {
  session: Session;
}

export default function RemoteDisplay({ session }: RemoteDisplayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    remoteStream,
    localStream,
    isConnected,
    startScreenShare,
    stopScreenShare,
    disconnect,
  } = useWebRTC();

  // Set up video stream
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleStartSharing = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      await startScreenShare();
    } catch (err) {
      console.error("Failed to start screen sharing:", err);
      setError("Failed to start screen sharing. Please check your permissions.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStopSharing = () => {
    stopScreenShare();
  };

  if (!isConnected && !localStream && !remoteStream) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <Card className="w-full max-w-md bg-gray-800 border-gray-700">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="text-center space-y-3">
              <Monitor className="h-16 w-16 text-gray-400 mx-auto" />
              <h3 className="text-lg font-medium text-white">
                Ready to Connect
              </h3>
              <p className="text-gray-400">
                Start screen sharing to begin the remote session.
              </p>
            </div>
            
            {error && (
              <div className="text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <Button
              onClick={handleStartSharing}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {isConnecting ? "Starting..." : "Start Screen Share"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full bg-black relative">
      {/* Remote video stream */}
      {remoteStream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.play().catch(console.error);
            }
          }}
        />
      )}

      {/* Local screen share preview (small corner overlay) */}
      {localStream && (
        <div className="absolute bottom-4 right-4 w-48 h-32 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600">
          <video
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            ref={(video) => {
              if (video && localStream) {
                video.srcObject = localStream;
              }
            }}
          />
          <div className="absolute top-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
            Your Screen
          </div>
          <Button
            size="sm"
            variant="destructive"
            className="absolute top-2 right-2"
            onClick={handleStopSharing}
          >
            Stop
          </Button>
        </div>
      )}

      {/* Connection status overlay */}
      {!isConnected && (localStream || remoteStream) && (
        <div className="absolute top-4 left-4 bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm">
          Connecting...
        </div>
      )}

      {isConnected && (
        <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-2 rounded-lg text-sm">
          Connected
        </div>
      )}
    </div>
  );
}
