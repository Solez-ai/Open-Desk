import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Play,
  Copy,
  MoreVertical,
  Clock,
  Eye,
  Shield,
  Trash2,
  Share,
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
import { useAuth } from "../../contexts/AuthContext";
import type { Session } from "~backend/session/types";
import ShareSessionDialog from "./ShareSessionDialog";

interface SessionCardProps {
  session: Session;
  onRefresh: () => void;
}

export default function SessionCard({ session, onRefresh }: SessionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const navigate = useNavigate();
  const backend = useBackend();
  const { toast } = useToast();
  const { user } = useAuth();

  const isOwner = session.ownerId === user?.id;

  const statusChip = () => {
    const base =
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs";
    const dot = (cls: string) => (
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
    );

    switch (session.status) {
      case "active":
        return (
          <span className={`${base} border-emerald-500/30 text-emerald-600 dark:text-emerald-400`}>
            {dot("bg-emerald-500")}
            Active
          </span>
        );
      case "pending":
        return (
          <span className={`${base} border-emerald-500/20 text-foreground`}>
            {dot("bg-emerald-400/70")}
            Pending
          </span>
        );
      case "ended":
        return (
          <span className={`${base} border-border text-muted-foreground`}>
            {dot("bg-muted-foreground/40")}
            Ended
          </span>
        );
      case "rejected":
        return (
          <span className={`${base} border-destructive/30 text-destructive`}>
            {dot("bg-destructive")}
            Rejected
          </span>
        );
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
      title: "Copied",
      description: "Session code copied to clipboard.",
    });
  };

  const handleTerminate = async () => {
    setIsLoading(true);
    try {
      await backend.session.terminateSession({ sessionId: session.id });
      toast({
        title: "Session terminated",
        description: "The session has been ended.",
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

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "This will permanently delete the session and all related data. This action cannot be undone. Continue?"
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await backend.session.deleteSession({ sessionId: session.id });
      toast({
        title: "Session deleted",
        description: "The session was permanently deleted.",
      });
      onRefresh();
    } catch (error: any) {
      console.error("Failed to delete session:", error);
      const msg =
        error?.message ||
        "Failed to delete the session. Ensure the session is ended and you are the owner.";
      toast({
        variant: "destructive",
        title: "Error",
        description: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canJoin = session.status === "active" || session.status === "pending";
  const canTerminate = isOwner && (session.status === "active" || session.status === "pending");
  const canShare = isOwner && (session.status === "active" || session.status === "pending");
  const canDelete = isOwner && session.status === "ended";

  return (
    <>
      <Card className="group transition-colors border-emerald-500/10 hover:border-emerald-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-medium text-base">
                {session.name || `Session ${session.code}`}
              </h3>
              <div className="flex items-center gap-2">
                {statusChip()}
                {session.isPublic && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3 text-emerald-500" />
                    Public
                  </span>
                )}
                {session.allowClipboard && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3 text-emerald-500" />
                    Clipboard
                  </span>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
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
                {canShare && (
                  <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
                    <Share className="h-4 w-4 mr-2" />
                    Share Session
                  </DropdownMenuItem>
                )}
                {canTerminate && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleTerminate}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Terminate
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Permanently
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-foreground tracking-wide">
                {session.code}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-emerald-500" />
              <span>{formatDistanceToNow(session.createdAt, { addSuffix: true })}</span>
            </div>
          </div>

          {canJoin && (
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-600/90 text-white"
                onClick={handleJoinSession}
                disabled={isLoading}
              >
                <Play className="h-4 w-4 mr-2" />
                Join
              </Button>
              {canShare && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-500/20 hover:bg-emerald-500/10"
                  onClick={() => setShareDialogOpen(true)}
                >
                  <Share className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-500/20 hover:bg-emerald-500/10"
                onClick={handleCopyCode}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          {canDelete && (
            <div className="flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Permanently
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ShareSessionDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        session={session}
      />
    </>
  );
}
