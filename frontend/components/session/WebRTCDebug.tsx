import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { ChevronDown, ChevronRight, Wifi, WifiOff, Monitor, Users, Activity } from "lucide-react";

interface WebRTCDebugProps {
  connections: Map<string, any>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  myRole: "host" | "controller" | undefined;
}

export default function WebRTCDebug({ connections, localStream, remoteStream, myRole }: WebRTCDebugProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [connectionStats, setConnectionStats] = useState<Map<string, any>>(new Map());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      updateConnectionStats();
      setRefreshKey(prev => prev + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, [connections]);

  const updateConnectionStats = async () => {
    const stats = new Map();
    
    for (const [userId, record] of connections) {
      try {
        const pc = record.pc;
        const statsData: any = {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          iceGatheringState: pc.iceGatheringState,
          signalingState: pc.signalingState,
          dataChannelState: record.dc?.readyState || 'closed',
          localTracks: pc.getSenders().map(s => ({
            kind: s.track?.kind,
            id: s.track?.id,
            enabled: s.track?.enabled
          })),
          remoteTracks: pc.getReceivers().map(r => ({
            kind: r.track.kind,
            id: r.track.id,
            enabled: r.track.enabled
          }))
        };

        // Get ICE candidate stats
        try {
          const iceStats = await pc.getStats();
          const candidateStats: any = {};
          iceStats.forEach((stat) => {
            if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
              candidateStats.localCandidate = stat.localCandidateId;
              candidateStats.remoteCandidate = stat.remoteCandidateId;
              candidateStats.rtt = stat.currentRoundTripTime;
            }
          });
          statsData.candidateStats = candidateStats;
        } catch (err) {
          console.warn('Failed to get ICE stats:', err);
        }

        stats.set(userId, statsData);
      } catch (err) {
        console.error('Failed to get connection stats:', err);
      }
    }
    
    setConnectionStats(stats);
  };

  const getConnectionStatusColor = (state: string) => {
    switch (state) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      case 'failed': return 'bg-red-600';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getDataChannelStatusColor = (state: string) => {
    switch (state) {
      case 'open': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'closing': return 'bg-orange-500';
      case 'closed': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const formatStreamInfo = (stream: MediaStream | null) => {
    if (!stream) return 'No stream';
    
    const tracks = stream.getTracks();
    const videoTracks = tracks.filter(t => t.kind === 'video');
    const audioTracks = tracks.filter(t => t.kind === 'audio');
    
    return `${videoTracks.length} video, ${audioTracks.length} audio tracks`;
  };

  const copyDebugInfo = () => {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      myRole,
      localStream: formatStreamInfo(localStream),
      remoteStream: formatStreamInfo(remoteStream),
      connections: Array.from(connections.entries()).map(([userId, record]) => ({
        userId,
        connectionState: record.pc.connectionState,
        iceConnectionState: record.pc.iceConnectionState,
        signalingState: record.pc.signalingState,
        dataChannelState: record.dc?.readyState || 'closed',
        localTracks: record.pc.getSenders().map(s => ({
          kind: s.track?.kind,
          id: s.track?.id,
          enabled: s.track?.enabled
        })),
        remoteTracks: record.pc.getReceivers().map(r => ({
          kind: r.track.kind,
          id: r.track.id,
          enabled: r.track.enabled
        }))
      }))
    };
    
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="sm"
          className="bg-black/80 text-white border-gray-600 hover:bg-gray-800"
        >
          <Activity className="h-4 w-4 mr-2" />
          WebRTC Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-96 max-h-96 overflow-y-auto">
      <Card className="bg-black/90 text-white border-gray-600">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              WebRTC Debug
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                onClick={copyDebugInfo}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Copy Info
              </Button>
              <Button
                onClick={() => setIsOpen(false)}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                ×
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Role and Stream Info */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {myRole?.toUpperCase() || 'UNKNOWN'}
              </Badge>
            </div>
            
            <div className="text-xs space-y-1">
              <div className="flex items-center space-x-2">
                <Monitor className="h-3 w-3" />
                <span>Local: {formatStreamInfo(localStream)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Monitor className="h-3 w-3" />
                <span>Remote: {formatStreamInfo(remoteStream)}</span>
              </div>
            </div>
          </div>

          {/* Connections */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Users className="h-3 w-3" />
              <span className="text-xs font-medium">Connections ({connections.size})</span>
            </div>
            
            {connections.size === 0 ? (
              <div className="text-xs text-gray-400">No active connections</div>
            ) : (
              Array.from(connections.entries()).map(([userId, record]) => {
                const stats = connectionStats.get(userId);
                return (
                  <Collapsible key={userId}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor(record.pc.connectionState)}`} />
                        <span className="text-xs">{userId.slice(0, 8)}...</span>
                      </div>
                      <ChevronRight className="h-3 w-3" />
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="mt-2 space-y-1">
                      <div className="text-xs space-y-1 pl-4">
                        <div className="flex items-center space-x-2">
                          <Wifi className="h-3 w-3" />
                          <span>Connection: {record.pc.connectionState}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Wifi className="h-3 w-3" />
                          <span>ICE: {record.pc.iceConnectionState}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${getDataChannelStatusColor(record.dc?.readyState || 'closed')}`} />
                          <span>Data Channel: {record.dc?.readyState || 'closed'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>Signaling: {record.pc.signalingState}</span>
                        </div>
                        
                        {stats?.localTracks && stats.localTracks.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs font-medium">Local Tracks:</div>
                            {stats.localTracks.map((track: any, i: number) => (
                              <div key={i} className="text-xs pl-2">
                                {track.kind}: {track.id?.slice(0, 8)}... ({track.enabled ? 'enabled' : 'disabled'})
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {stats?.remoteTracks && stats.remoteTracks.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs font-medium">Remote Tracks:</div>
                            {stats.remoteTracks.map((track: any, i: number) => (
                              <div key={i} className="text-xs pl-2">
                                {track.kind}: {track.id?.slice(0, 8)}... ({track.enabled ? 'enabled' : 'disabled'})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}