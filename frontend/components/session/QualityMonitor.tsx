import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Wifi, 
  WifiOff, 
  Signal, 
  Zap,
  AlertTriangle,
  CheckCircle,
  Activity,
} from "lucide-react";
import { ConnectionMonitor, NetworkStats, QualityMetrics } from "../../webrtc/ConnectionMonitor";
import { AdaptiveBitrateController, QUALITY_PRESETS } from "../../webrtc/AdaptiveBitrate";

interface QualityMonitorProps {
  connectionMonitor?: ConnectionMonitor;
  bitrateController?: AdaptiveBitrateController;
  className?: string;
}

function formatBandwidth(bps: number): string {
  if (bps < 1000) return `${bps} bps`;
  if (bps < 1000000) return `${(bps / 1000).toFixed(1)} Kbps`;
  return `${(bps / 1000000).toFixed(1)} Mbps`;
}

function formatLatency(ms: number): string {
  return `${Math.round(ms * 1000)}ms`;
}

export default function QualityMonitor({ 
  connectionMonitor, 
  bitrateController,
  className = "" 
}: QualityMonitorProps) {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [quality, setQuality] = useState<QualityMetrics | null>(null);
  const [currentPreset, setCurrentPreset] = useState<string | null>(null);
  const [isAutoAdjustEnabled, setIsAutoAdjustEnabled] = useState(true);

  useEffect(() => {
    if (!connectionMonitor) return;

    const handleStats = (newStats: NetworkStats) => {
      setStats(newStats);
    };

    const handleQuality = (newQuality: QualityMetrics) => {
      setQuality(newQuality);
    };

    connectionMonitor.on("stats", handleStats);
    connectionMonitor.on("quality", handleQuality);

    return () => {
      connectionMonitor.off("stats", handleStats);
      connectionMonitor.off("quality", handleQuality);
    };
  }, [connectionMonitor]);

  useEffect(() => {
    if (!bitrateController) return;

    const updatePreset = () => {
      setCurrentPreset(bitrateController.getCurrentPreset().name);
      setIsAutoAdjustEnabled(bitrateController.isAutoAdjustEnabled());
    };

    updatePreset();

    // Poll for preset changes
    const interval = setInterval(updatePreset, 1000);
    return () => clearInterval(interval);
  }, [bitrateController]);

  const getQualityIcon = () => {
    if (!quality) return <WifiOff className="h-4 w-4 text-gray-400" />;

    switch (quality.category) {
      case "excellent":
        return <Wifi className="h-4 w-4 text-green-500" />;
      case "good":
        return <Signal className="h-4 w-4 text-green-400" />;
      case "fair":
        return <Signal className="h-4 w-4 text-yellow-400" />;
      case "poor":
        return <Signal className="h-4 w-4 text-red-400" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getQualityColor = () => {
    if (!quality) return "bg-gray-100 text-gray-800 border-gray-200";

    switch (quality.category) {
      case "excellent":
        return "bg-green-100 text-green-800 border-green-200";
      case "good":
        return "bg-green-100 text-green-700 border-green-200";
      case "fair":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "poor":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTooltipContent = () => {
    if (!stats || !quality) return "No connection data";

    return (
      <div className="space-y-2 text-xs">
        <div className="font-semibold">Connection Quality: {quality.category}</div>
        <div>Score: {quality.score}/100</div>
        <div>Bandwidth: {formatBandwidth(stats.bandwidth)}</div>
        <div>Latency: {formatLatency(stats.roundTripTime)}</div>
        <div>Packet Loss: {stats.packetsLostRate.toFixed(2)}%</div>
        <div>Jitter: {stats.jitter.toFixed(1)}ms</div>
        {currentPreset && (
          <div>Quality: {currentPreset}</div>
        )}
        {quality.issues.length > 0 && (
          <div>
            <div className="font-semibold">Issues:</div>
            {quality.issues.map((issue, i) => (
              <div key={i}>• {issue}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className={`flex items-center space-x-2 ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`${getQualityColor()} flex items-center space-x-1`}>
              {getQualityIcon()}
              <span>
                {quality?.category || "Unknown"}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {getTooltipContent()}
          </TooltipContent>
        </Tooltip>

        {currentPreset && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs bg-gray-900/80 text-white border-gray-600 flex items-center space-x-1">
                <Activity className="h-3 w-3" />
                <span>{currentPreset.split(" ")[0]}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div>Video Quality: {currentPreset}</div>
                <div>Auto-adjust: {isAutoAdjustEnabled ? "On" : "Off"}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {stats && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs bg-gray-900/80 text-white border-gray-600">
                {formatBandwidth(stats.bandwidth)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                Current bandwidth usage
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {stats && stats.roundTripTime > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs bg-gray-900/80 text-white border-gray-600">
                {formatLatency(stats.roundTripTime)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                Round-trip latency
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
