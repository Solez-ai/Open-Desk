import { useState } from "react";
import {
  ArrowLeft,
  Users,
  MessageCircle,
  Settings,
  PhoneOff,
  Maximize,
  Minimize,
  Monitor,
  Mouse,
  Keyboard,
  Copy,
  Upload,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import type { Session } from "~backend/session/types";

interface SessionToolbarProps {
  session: Session;
  onLeave: () => void;
  onTerminate: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleFullScreen: () => void;
  isFullScreen: boolean;
}

export default function SessionToolbar({
  session,
  onLeave,
  onTerminate,
  onToggleChat,
  onToggleParticipants,
  onToggleFullScreen,
  isFullScreen,
}: SessionToolbarProps) {
  const navigate = useNavigate();
  const [mouseEnabled, setMouseEnabled] = useState(true);
  const [keyboardEnabled, setKeyboardEnabled] = useState(true);

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
              <Monitor className="h-5 w-5 text-blue-400" />
              <div>
                <h2 className="font-semibold text-white">
                  {session.name || `Session ${session.code}`}
                </h2>
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
                  variant={mouseEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMouseEnabled(!mouseEnabled)}
                >
                  <Mouse className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{mouseEnabled ? "Disable" : "Enable"} mouse control</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={keyboardEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setKeyboardEnabled(!keyboardEnabled)}
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{keyboardEnabled ? "Disable" : "Enable"} keyboard input</p>
              </TooltipContent>
            </Tooltip>

            {session.allowClipboard && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sync clipboard</p>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload file</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download files</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleChat}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle chat</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleParticipants}
                >
                  <Users className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show participants</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleFullScreen}
                >
                  {isFullScreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFullScreen ? "Exit" : "Enter"} fullscreen</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Session settings</p>
              </TooltipContent>
            </Tooltip>

            <Button
              variant="destructive"
              size="sm"
              onClick={onLeave}
            >
              <PhoneOff className="h-4 w-4 mr-2" />
              Leave
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
