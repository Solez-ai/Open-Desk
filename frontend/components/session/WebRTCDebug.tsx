import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WebRTCDebugProps {
  connections: Map<string, any>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  myRole: string | undefined;
}

export default function WebRTCDebug({ connections, localStream, remoteStream, myRole }: WebRTCDebugProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const updateDebugInfo = () => {
      const info: any = {
        myRole,
        localStream: localStream ? {
          id: localStream.id,
          tracks: localStream.getTracks().map(t => ({
            kind: t.kind,
            id: t.id,
            enabled: t.enabled,
            readyState: t.readyState,
            muted: t.muted
          }))
        } : null,
        remoteStream: remoteStream ? {
          id: remoteStream.id,
          tracks: remoteStream.getTracks().map(t => ({
            kind: t.kind,
            id: t.id,
            enabled: t.enabled,
            readyState: t.readyState,
            muted: t.muted
          }))
        } : null,
        connections: Array.from(connections.entries()).map(([userId, record]) => ({
          userId,
          connectionState: record.pc.connectionState,
          iceConnectionState: record.pc.iceConnectionState,
          iceGatheringState: record.pc.iceGatheringState,
          signalingState: record.pc.signalingState,
          dataChannelState: record.dc?.readyState || 'not-created',
          hasRemoteStream: !!record.remoteStream,
          remoteStreamTracks: record.remoteStream?.getTracks().length || 0
        }))
      };
      setDebugInfo(info);
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 1000);
    return () => clearInterval(interval);
  }, [connections, localStream, remoteStream, myRole]);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
      >
        Debug WebRTC
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-96 overflow-y-auto z-50">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm">WebRTC Debug</CardTitle>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="sm"
          >
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>
          <strong>Role:</strong> {debugInfo.myRole || 'Unknown'}
        </div>
        
        <div>
          <strong>Local Stream:</strong>
          {debugInfo.localStream ? (
            <div className="ml-2">
              <div>ID: {debugInfo.localStream.id}</div>
              <div>Tracks: {debugInfo.localStream.tracks.length}</div>
              {debugInfo.localStream.tracks.map((track: any, i: number) => (
                <div key={i} className="ml-2 text-gray-600">
                  {track.kind}: {track.readyState} {track.enabled ? '✓' : '✗'}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-gray-500">None</span>
          )}
        </div>

        <div>
          <strong>Remote Stream:</strong>
          {debugInfo.remoteStream ? (
            <div className="ml-2">
              <div>ID: {debugInfo.remoteStream.id}</div>
              <div>Tracks: {debugInfo.remoteStream.tracks.length}</div>
              {debugInfo.remoteStream.tracks.map((track: any, i: number) => (
                <div key={i} className="ml-2 text-gray-600">
                  {track.kind}: {track.readyState} {track.enabled ? '✓' : '✗'}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-gray-500">None</span>
          )}
        </div>

        <div>
          <strong>Connections ({debugInfo.connections?.length || 0}):</strong>
          {debugInfo.connections?.map((conn: any, i: number) => (
            <div key={i} className="ml-2 border-l-2 border-gray-300 pl-2">
              <div>User: {conn.userId}</div>
              <div>State: {conn.connectionState}</div>
              <div>ICE: {conn.iceConnectionState}</div>
              <div>Signaling: {conn.signalingState}</div>
              <div>Data Channel: {conn.dataChannelState}</div>
              <div>Remote Stream: {conn.hasRemoteStream ? 'Yes' : 'No'}</div>
              <div>Remote Tracks: {conn.remoteStreamTracks}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
