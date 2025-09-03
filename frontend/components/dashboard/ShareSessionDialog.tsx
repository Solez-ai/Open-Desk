import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Copy, 
  Link, 
  Loader2, 
  Trash2, 
  Share,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useBackend } from "../../hooks/useBackend";
import { useToast } from "@/components/ui/use-toast";
import type { Session } from "~backend/session/types";

interface ShareSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session;
}

export default function ShareSessionDialog({
  open,
  onOpenChange,
  session,
}: ShareSessionDialogProps) {
  const [expiresInHours, setExpiresInHours] = useState("24");
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current domain for generating links
  const baseUrl = `${window.location.protocol}//${window.location.host}`;

  // Fetch existing tokens
  const { data: tokensData, isLoading: isLoadingTokens } = useQuery({
    queryKey: ["session-tokens", session.id],
    queryFn: () => backend.session.listSessionTokens({ sessionId: session.id }),
    enabled: open,
  });

  // Generate new link mutation
  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      return backend.session.generateSessionLink({
        sessionId: session.id,
        expiresInHours: parseInt(expiresInHours),
        baseUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-tokens", session.id] });
      toast({
        title: "Link generated",
        description: "Shareable link has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Failed to generate link:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate shareable link. Please try again.",
      });
    },
  });

  // Revoke token mutation
  const revokeTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      return backend.session.revokeSessionToken({
        sessionId: session.id,
        tokenId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-tokens", session.id] });
      toast({
        title: "Link revoked",
        description: "The shareable link has been disabled.",
      });
    },
    onError: (error: any) => {
      console.error("Failed to revoke token:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to revoke link. Please try again.",
      });
    },
  });

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: "Copied",
      description: "Shareable link copied to clipboard.",
    });
  };

  const handleGenerateLink = () => {
    generateLinkMutation.mutate();
  };

  const handleRevokeToken = (tokenId: string) => {
    revokeTokenMutation.mutate(tokenId);
  };

  const activeTokens = tokensData?.tokens || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl border-emerald-500/10 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share className="h-5 w-5 text-emerald-600" />
            Share Session
          </DialogTitle>
          <DialogDescription>
            Create shareable links for {session.name || `Session ${session.code}`}. 
            Links expire automatically and can be revoked at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Generate new link */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generate New Link</CardTitle>
              <CardDescription>
                Create a time-limited invite link for this session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="expiry">Link Expiration</Label>
                  <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="72">3 days</SelectItem>
                      <SelectItem value="168">1 week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleGenerateLink}
                    disabled={generateLinkMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
                  >
                    {generateLinkMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Link className="mr-2 h-4 w-4" />
                    Generate Link
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Links</CardTitle>
              <CardDescription>
                Manage existing shareable links for this session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTokens ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : activeTokens.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Link className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active links</p>
                  <p className="text-sm">Generate a link to start sharing this session.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeTokens.map((token) => {
                    const link = `${baseUrl}/join/${token.token}`;
                    const isExpired = new Date(token.expiresAt) < new Date();
                    
                    return (
                      <div
                        key={token.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant={isExpired ? "destructive" : "default"}
                              className="text-xs"
                            >
                              {isExpired ? "Expired" : "Active"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 inline mr-1" />
                              Expires {formatDistanceToNow(token.expiresAt, { addSuffix: true })}
                            </span>
                          </div>
                          <Input
                            value={link}
                            readOnly
                            className="text-sm font-mono bg-background"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyLink(link)}
                            disabled={isExpired}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeToken(token.id)}
                            disabled={revokeTokenMutation.isPending}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                Security Notice
              </p>
              <p className="text-yellow-700 dark:text-yellow-300">
                Anyone with these links can join your session. Only share with trusted individuals 
                and revoke links when no longer needed.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-emerald-500/20 hover:bg-emerald-500/10"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
