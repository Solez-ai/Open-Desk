import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { useBackend } from "../../hooks/useBackend";
import { useToast } from "@/components/ui/use-toast";

interface JoinSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function JoinSessionDialog({
  open,
  onOpenChange,
  onSuccess,
}: JoinSessionDialogProps) {
  const [sessionCode, setSessionCode] = useState("");
  const [role, setRole] = useState<"host" | "controller">("controller");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const backend = useBackend();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sessionCode.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a session code.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await backend.session.joinSession({
        code: sessionCode.trim().toUpperCase(),
        role,
      });

      toast({
        title: "Joined session",
        description: `Successfully joined session ${result.session.code}.`,
      });

      onSuccess();
      onOpenChange(false);
      navigate(`/session/${result.session.id}`);

      // Reset form
      setSessionCode("");
      setRole("controller");
    } catch (error) {
      console.error("Failed to join session:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to join session. Please check the code and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-emerald-500/10">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Join Session</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter a session code to join an existing remote session.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="sessionCode">Session Code</Label>
            <Input
              id="sessionCode"
              placeholder="Enter 6-character code"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              disabled={isLoading}
              maxLength={6}
              className="text-center text-lg font-mono tracking-widest focus:ring-emerald-500/30"
            />
            <p className="text-xs text-muted-foreground">
              Codes are not case sensitive.
            </p>
          </div>

          <div className="space-y-3">
            <Label>Join as</Label>
            <RadioGroup
              value={role}
              onValueChange={(value: "host" | "controller") => setRole(value)}
              disabled={isLoading}
              className="grid grid-cols-2 gap-2"
            >
              <label
                htmlFor="controller"
                className={`cursor-pointer rounded-lg border p-3 ${
                  role === "controller"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="controller"
                    id="controller"
                    className="data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                  />
                  <div>
                    <div className="font-medium text-sm">Controller</div>
                    <div className="text-xs text-muted-foreground">
                      Control someone else's computer
                    </div>
                  </div>
                </div>
              </label>

              <label
                htmlFor="host"
                className={`cursor-pointer rounded-lg border p-3 ${
                  role === "host"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="host"
                    id="host"
                    className="data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                  />
                  <div>
                    <div className="font-medium text-sm">Host</div>
                    <div className="text-xs text-muted-foreground">
                      Share your screen
                    </div>
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="border-emerald-500/20 hover:bg-emerald-500/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join Session
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
