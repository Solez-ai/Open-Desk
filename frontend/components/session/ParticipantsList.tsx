import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Crown, Monitor, MousePointer } from "lucide-react";
import type { Participant } from "~backend/session/types";

interface ParticipantsListProps {
  participants: Participant[];
  onClose: () => void;
}

export default function ParticipantsList({ participants, onClose }: ParticipantsListProps) {
  const getParticipantIcon = (role: string) => {
    switch (role) {
      case "host":
        return <Monitor className="h-4 w-4" />;
      case "controller":
        return <MousePointer className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getParticipantBadge = (role: string) => {
    switch (role) {
      case "host":
        return (
          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
            Host
          </Badge>
        );
      case "controller":
        return (
          <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-200">
            Controller
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="font-semibold text-white">
          Participants ({participants.length})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Participants List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {participants.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p>No participants yet.</p>
            </div>
          ) : (
            participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center space-x-3 p-3 rounded-lg bg-gray-800 border border-gray-700"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gray-700 text-white">
                    {participant.userId.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-white truncate">
                      User {participant.userId.slice(-8)}
                    </p>
                    {getParticipantIcon(participant.role)}
                  </div>
                  
                  <div className="flex items-center space-x-2 mt-1">
                    {getParticipantBadge(participant.role)}
                    
                    <Badge
                      variant={participant.status === "joined" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {participant.status}
                    </Badge>
                  </div>

                  {participant.connectedAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Connected {new Date(participant.connectedAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>

                {/* Owner indicator */}
                {participant.role === "host" && (
                  <Crown className="h-4 w-4 text-yellow-400" />
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
