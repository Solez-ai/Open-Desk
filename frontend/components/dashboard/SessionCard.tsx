import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { 
  Play, 
  Copy, 
  MoreVertical, 
  Clock, 
  Users, 
  Shield,
  Trash2,
  Eye,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { useBackend } from "../../hooks/useBackend";
import type { Session } from "~backend/session/types";

interface SessionCardProps {
  session: Session;
  onRefresh: () => void;
}

export default function SessionCard({ session, onRefresh }: SessionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const backend = useBackend();
  const { toast } = useToast();

  const getStatusBadge = () => {
    switch (session.status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case "ended":
        return <Badge variant="secondary">Ended</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{session.status}</Badge>;
    }
  };

  const handleJoinSession = async () => {
    setIsLoading(true);
    try {
      await backend.session.joinSession({
        sessionId: session.id,
        role: "controller",
      });
      navigate(`/session/${session.id}`);
    } catch (error) {
      console.error("Failed to join session:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to join session. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(session.code);
    toast({
      title: "Copied!",
      description: "Session code copied to clipboard.",
    });
  };

  const handleTerminate = async () => {
    setIsLoading(true);
    try {
      await backend.session.terminateSession({ sessionId: session.id });
      toast({
        title: "Session terminated",
        description: "The session has been ended successfully.",
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to terminate session:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to terminate session. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canJoin = session.status === "active" || session.status === "pending";
  const canTerminate = session.status === "active" || session.status === "pending";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">
              {session.name || `Session ${session.code}`}
            </h3>
            <div className="flex items-center space-x-2">
              {getStatusBadge()}
              {session.isPublic && (
                <Badge variant="outline" className="text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  Public
                </Badge>
              )}
              {session.allowClipboard && (
                <Badge variant="outline" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Clipboard
                </Badge>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyCode}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </DropdownMenuItem>
              {canJoin && (
                <DropdownMenuItem onClick={handleJoinSession}>
                  <Play className="h-4 w-4 mr-2" />
                  Join Session
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {canTerminate && (
                <DropdownMenuItem 
                  onClick={handleTerminate}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Terminate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <span className="font-mono text-lg font-semibold text-foreground">
              {session.code}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{formatDistanceToNow(session.createdAt, { addSuffix: true })}</span>
          </div>
        </div>

        {canJoin && (
          <div className="flex space-x-2">
            <Button 
              className="flex-1" 
              onClick={handleJoinSession}
              disabled={isLoading}
            >
              <Play className="h-4 w-4 mr-2" />
              Join Session
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCopyCode}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
