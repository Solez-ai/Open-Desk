import {
  ArrowLeft,
  Users,
  MessageCircle,
  PhoneOff,
  Maximize,
  Minimize,
  MousePointer,
  Copy,
  Upload,
  Download,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import type { Session } from "~backend/session/types";
import { useRef } from "react";
import { useSession } from "../../contexts/SessionContext";
import { AdaptiveBitrateController } from "../../webrtc/AdaptiveBitrate";
import QualityControl from "./QualityControl";

interface SessionToolbarProps {
  session: Session;
  onLeave: () => void;
  onTerminate: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleFullScreen: () => void;
  isFullScreen: boolean;
  isControlEnabled: boolean;
  onToggleControl: () => void;
  onUploadFile: (file: File) => void;
  receivedCount: number;
  onToggleTransfers: () => void;
  bitrateController?: AdaptiveBitrateController;
  onSyncClipboard: () => void;
  myRoleLabel?: string;
  controlAdapterLabel?: string;
}

export default function SessionToolbar({
  session,
  onLeave,
  onTerminate,
  onToggleChat,
  onToggleParticipants,
  onToggleFullScreen,
  isFullScreen,
  isControlEnabled,
  onToggleControl,
  onUploadFile,
  receivedCount,
  onToggleTransfers,
  bitrateController,
  onSyncClipboard,
  myRoleLabel,
  controlAdapterLabel,
}: SessionToolbarProps) {
  const navigate = useNavigate();
  const { participants } = useSession();
  const { toast } = useToast();
  const joinedCount = participants.filter((p) => p.status === "joined").length;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file before upload
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `File size must be under 100MB. Selected file is ${Math.round(file.size / 1024 / 1024)}MB.`,
        });
        e.target.value = '';
        return;
      }

      // Check for dangerous file types
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.vbs', '.js'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (dangerousExtensions.includes(fileExtension)) {
        toast({
          variant: "destructive",
          title: "File type not allowed",
          description: `Files with extension ${fileExtension} are not allowed for security reasons.`,
        });
        e.target.value = '';
        return;
      }

      console.log(`[FileUpload] Uploading file: ${file.name} (${file.size} bytes, ${file.type})`);
      onUploadFile(file);
      
      toast({
        title: "File upload started",
        description: `Uploading "${file.name}" (${Math.round(file.size / 1024)} KB)...`,
      });
      
      e.target.value = "";
    }
  };

  return (
    <TooltipProvider>
      <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-700 h-16">
        <div className="flex items-center justify-between h-full px-4">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-gray-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>

            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="OpenDesk Logo" className="h-5 w-5" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-white">
                    {session.name || `Session ${session.code}`}
                  </h2>
                  {myRoleLabel && (
                    <Badge variant="outline" className="text-xs">
                      {myRoleLabel}
                    </Badge>
                  )}
                  {controlAdapterLabel && (
                    <Badge variant="outline" className="text-[10px] opacity-80">
                      {controlAdapterLabel}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {session.code}
                  </Badge>
                  <Badge
                    className={
                      session.status === "active"
                        ? "bg-green-100 text-green-800 border-green-200"
                        : "bg-yellow-100 text-yellow-800 border-yellow-200"
                    }
                  >
                    {session.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Center Section - Controls */}
          <div className="flex items-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isControlEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={onToggleControl}
                >
                  <MousePointer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isControlEnabled ? "Disable" : "Enable"} remote control</p>
              </TooltipContent>
            </Tooltip>

            {session.allowClipboard && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onSyncClipboard}
                  className={session.allowClipboard ? "border-emerald-500/50 hover:bg-emerald-500/10" : "opacity-50 cursor-not-allowed"}
                  disabled={!session.allowClipboard}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{session.allowClipboard ? "Sync clipboard (Auto-sync enabled)" : "Clipboard sync disabled"}</p>
              </TooltipContent>
            </Tooltip>
            )}

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleInputChange}
              className="hidden"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={openFilePicker}>
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload file to peer(s)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button variant="outline" size="sm" onClick={onToggleTransfers}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {receivedCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-emerald-600 text-white text-[10px]">
                      {receivedCount}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show received files</p>
              </TooltipContent>
            </Tooltip>

            {/* Quality Control */}
            {bitrateController && (
              <QualityControl bitrateController={bitrateController} />
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onToggleChat}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle chat</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button variant="outline" size="sm" onClick={onToggleParticipants}>
                    <Users className="h-4 w-4" />
                  </Button>
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-emerald-600 text-white text-[10px]">
                    {joinedCount}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show participants</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onToggleFullScreen}>
                  {isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFullScreen ? "Exit" : "Enter"} fullscreen</p>
              </TooltipContent>
            </Tooltip>

            <Button variant="destructive" size="sm" onClick={onLeave}>
              <PhoneOff className="h-4 w-4 mr-2" />
              Leave
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
