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
  onSuccess 
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
        description: `Session ${result.session.code} has been created successfully.`,
      });

      onSuccess();
      onOpenChange(false);
      navigate(`/session/${result.session.id}`);
      
      // Reset form
      setName("");
      setAllowClipboard(false);
      setIsPublic(false);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
          <DialogDescription>
            Create a new remote desktop session that others can join.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Session Name (Optional)</Label>
            <Input
              id="name"
              placeholder="e.g., Help with computer setup"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allowClipboard"
                checked={allowClipboard}
                onCheckedChange={setAllowClipboard}
                disabled={isLoading}
              />
              <Label htmlFor="allowClipboard" className="text-sm">
                Allow clipboard synchronization
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPublic"
                checked={isPublic}
                onCheckedChange={setIsPublic}
                disabled={isLoading}
              />
              <Label htmlFor="isPublic" className="text-sm">
                Make session public (anyone can join)
              </Label>
            </div>
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
              Create Session
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
