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
  onSuccess 
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join Session</DialogTitle>
          <DialogDescription>
            Enter a session code to join an existing remote desktop session.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sessionCode">Session Code</Label>
            <Input
              id="sessionCode"
              placeholder="Enter 6-digit code"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              disabled={isLoading}
              maxLength={6}
              className="text-center text-lg font-mono"
            />
          </div>

          <div className="space-y-3">
            <Label>Join as</Label>
            <RadioGroup
              value={role}
              onValueChange={(value: "host" | "controller") => setRole(value)}
              disabled={isLoading}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="controller" id="controller" />
                <Label htmlFor="controller" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Controller</div>
                    <div className="text-sm text-muted-foreground">
                      Control someone else's computer
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="host" id="host" />
                <Label htmlFor="host" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Host</div>
                    <div className="text-sm text-muted-foreground">
                      Share your computer screen
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join Session
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
