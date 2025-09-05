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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useBackend } from "../../hooks/useBackend";
import { useToast } from "@/components/ui/use-toast";

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function CreateSessionDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateSessionDialogProps) {
  const [name, setName] = useState("");
  const [allowClipboard, setAllowClipboard] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const backend = useBackend();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await backend.session.createSession({
        name: name.trim() || undefined,
        allowClipboard,
        isPublic,
      });

      toast({
        title: "Session created",
        description: `Session ${result.session.code} has been created.`,
      });

      // Close dialog first
      onOpenChange(false);
      
      // Reset form
      setName("");
      setAllowClipboard(false);
      setIsPublic(false);
      
      // Refresh the session list
      onSuccess();
      
      // Navigate after a short delay to ensure the session is available
      setTimeout(() => {
        navigate(`/session/${result.session.id}`);
      }, 100);

    } catch (error) {
      console.error("Failed to create session:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create session. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-emerald-500/10">
        <DialogHeader>
          <DialogTitle className="tracking-tight">
            Create New Session
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Set up your remote session with the options below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Session Name (optional)</Label>
            <Input
              id="name"
              placeholder="e.g., Help with computer setup"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              className="focus:ring-emerald-500/30"
            />
            <p className="text-xs text-muted-foreground">
              A friendly label shown in your dashboard.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="allowClipboard"
                checked={allowClipboard}
                onCheckedChange={setAllowClipboard}
                disabled={isLoading}
                className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
              <Label htmlFor="allowClipboard" className="text-sm">
                Allow clipboard synchronization
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isPublic"
                checked={isPublic}
                onCheckedChange={setIsPublic}
                disabled={isLoading}
                className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
              <Label htmlFor="isPublic" className="text-sm">
                Make session public (anyone can join)
              </Label>
            </div>
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
              Create Session
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
