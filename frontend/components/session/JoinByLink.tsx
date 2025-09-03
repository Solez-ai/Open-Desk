import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, Users, Monitor } from "lucide-react";
import { useBackend } from "../../hooks/useBackend";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LoadingSpinner from "../ui/LoadingSpinner";

export default function JoinByLink() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const { toast } = useToast();
  const [role, setRole] = useState<"host" | "controller">("controller");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!token) return;
    
    setIsJoining(true);
    setError(null);

    try {
      const result = await backend.session.joinByToken({
        token,
        role,
      });

      toast({
        title: "Joined session",
        description: `Successfully joined session ${result.session.code}.`,
      });

      navigate(`/session/${result.session.id}`);
    } catch (error: any) {
      console.error("Failed to join session:", error);
      const errorMessage = error?.message || "Failed to join session. The link may be invalid or expired.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsJoining(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>
              This link is not valid. Please check the URL and try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate("/dashboard")} 
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img src="/logo.png" alt="OpenDesk Logo" className="h-8 w-8" />
            <h1 className="text-xl font-semibold">OpenDesk</h1>
          </div>
          <CardTitle>Join Session</CardTitle>
          <CardDescription>
            You've been invited to join a remote session. Choose your role to continue.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Label>Join as</Label>
            <RadioGroup
              value={role}
              onValueChange={(value: "host" | "controller") => setRole(value)}
              disabled={isJoining}
              className="grid grid-cols-1 gap-3"
            >
              <label
                htmlFor="controller"
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  role === "controller"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem
                    value="controller"
                    id="controller"
                    className="data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                  />
                  <Users className="h-5 w-5 text-emerald-600" />
                  <div className="flex-1">
                    <div className="font-medium">Controller</div>
                    <div className="text-sm text-muted-foreground">
                      Control someone else's computer remotely
                    </div>
                  </div>
                </div>
              </label>

              <label
                htmlFor="host"
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  role === "host"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem
                    value="host"
                    id="host"
                    className="data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                  />
                  <Monitor className="h-5 w-5 text-emerald-600" />
                  <div className="flex-1">
                    <div className="font-medium">Host</div>
                    <div className="text-sm text-muted-foreground">
                      Share your screen with others
                    </div>
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              disabled={isJoining}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoin}
              disabled={isJoining}
              className="flex-1 bg-emerald-600 hover:bg-emerald-600/90 text-white"
            >
              {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join Session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
