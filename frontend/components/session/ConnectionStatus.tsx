import { useEffect, useState } from "react";
import { Wifi, WifiOff, Signal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSession } from "../../contexts/SessionContext";

export default function ConnectionStatus() {
  const { isConnected, connectionQuality } = useSession();
  const [latency, setLatency] = useState<number | null>(null);

  // Mock latency measurement (in a real app, this would measure actual latency)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected) {
        // Simulate latency measurement
        const mockLatency = Math.floor(Math.random() * 100) + 50;
        setLatency(mockLatency);
      } else {
        setLatency(null);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const getConnectionIcon = () => {
    if (!isConnected) {
      return <WifiOff className="h-4 w-4" />;
    }
    
    switch (connectionQuality) {
      case "excellent":
        return <Wifi className="h-4 w-4 text-green-400" />;
      case "good":
        return <Wifi className="h-4 w-4 text-yellow-400" />;
      case "poor":
        return <Signal className="h-4 w-4 text-red-400" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getConnectionText = () => {
    if (!isConnected) return "Disconnected";
    
    switch (connectionQuality) {
      case "excellent":
        return "Excellent";
      case "good":
        return "Good";
      case "poor":
        return "Poor";
      default:
        return "Unknown";
    }
  };

  const getConnectionColor = () => {
    if (!isConnected) return "bg-red-100 text-red-800 border-red-200";
    
    switch (connectionQuality) {
      case "excellent":
        return "bg-green-100 text-green-800 border-green-200";
      case "good":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "poor":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="fixed top-20 right-4 z-40 flex items-center space-x-2">
      <Badge className={`${getConnectionColor()} flex items-center space-x-1`}>
        {getConnectionIcon()}
        <span>{getConnectionText()}</span>
      </Badge>
      
      {latency !== null && (
        <Badge variant="outline" className="text-xs bg-gray-900/80 text-white border-gray-600">
          {latency}ms
        </Badge>
      )}
    </div>
  );
}
