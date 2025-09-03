import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings, Zap, ZapOff } from "lucide-react";
import { AdaptiveBitrateController, QUALITY_PRESETS } from "../../webrtc/AdaptiveBitrate";
import { useToast } from "@/components/ui/use-toast";

interface QualityControlProps {
  bitrateController?: AdaptiveBitrateController;
}

export default function QualityControl({ bitrateController }: QualityControlProps) {
  const [open, setOpen] = useState(false);
  const [autoAdjust, setAutoAdjust] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof QUALITY_PRESETS>("high");
  const { toast } = useToast();

  if (!bitrateController) return null;

  const handleAutoAdjustChange = (enabled: boolean) => {
    setAutoAdjust(enabled);
    bitrateController.setAutoAdjustEnabled(enabled);
    
    toast({
      title: enabled ? "Auto-adjust enabled" : "Auto-adjust disabled",
      description: enabled 
        ? "Quality will automatically adapt to network conditions"
        : "Quality will remain fixed at selected preset",
    });
  };

  const handlePresetChange = async (presetKey: keyof typeof QUALITY_PRESETS) => {
    setSelectedPreset(presetKey);
    
    try {
      if (autoAdjust) {
        await bitrateController.setQualityPreset(presetKey);
        bitrateController.setAutoAdjustEnabled(true);
      } else {
        await bitrateController.forceQualityPreset(presetKey);
      }
      
      toast({
        title: "Quality updated",
        description: `Set to ${QUALITY_PRESETS[presetKey].name}`,
      });
    } catch (error) {
      console.error("Failed to update quality preset:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update video quality",
      });
    }
  };

  const currentPreset = bitrateController.getCurrentPreset();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Quality
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Video Quality Settings</DialogTitle>
          <DialogDescription>
            Configure video quality and adaptive streaming settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          <div className="space-y-2">
            <Label>Current Quality</Label>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">{currentPreset.name}</Badge>
              {autoAdjust && (
                <Badge variant="outline" className="text-green-600">
                  <Zap className="h-3 w-3 mr-1" />
                  Auto
                </Badge>
              )}
            </div>
          </div>

          {/* Auto-adjust Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-adjust">Adaptive Quality</Label>
              <div className="text-sm text-muted-foreground">
                Automatically adjust quality based on network conditions
              </div>
            </div>
            <Switch
              id="auto-adjust"
              checked={autoAdjust}
              onCheckedChange={handleAutoAdjustChange}
            />
          </div>

          {/* Quality Preset Selector */}
          <div className="space-y-2">
            <Label>Quality Preset</Label>
            <Select
              value={selectedPreset}
              onValueChange={(value: keyof typeof QUALITY_PRESETS) => handlePresetChange(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select quality preset" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col">
                      <span>{preset.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(preset.video.maxBitrate / 1000)}kbps, {preset.video.maxFramerate}fps
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {autoAdjust 
                ? "This preset will be used as a starting point for adaptive streaming"
                : "Video quality will be fixed at this preset"
              }
            </div>
          </div>

          {/* Quality Details */}
          <div className="space-y-2">
            <Label>Current Settings</Label>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Video: {Math.round(currentPreset.video.maxBitrate / 1000)}kbps, {currentPreset.video.maxFramerate}fps</div>
              <div>Audio: {Math.round(currentPreset.audio.maxBitrate / 1000)}kbps</div>
              <div>Scale: {currentPreset.video.scaleResolutionDownBy}x</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
