import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send } from "lucide-react";
import { useBackend } from "../../hooks/useBackend";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../../contexts/AuthContext";

interface ChatPanelProps {
  sessionId: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  senderUserId: string;
  message: string;
  createdAt: Date;
}

export default function ChatPanel({ sessionId, onClose }: ChatPanelProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const backend = useBackend();
  const { toast } = useToast();
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading) return;

    const messageText = message.trim();
    setMessage("");
    setIsLoading(true);

    try {
      const result = await backend.chat.sendChatMessage({
        sessionId,
        message: messageText,
      });

      // Add message to local state (optimistic update)
      setMessages(prev => [...prev, {
        id: result.id.toString(),
        senderUserId: user?.id ?? "me",
        message: messageText,
        createdAt: result.createdAt,
      }]);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      });
      // Restore message on error
      setMessage(messageText);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="font-semibold text-white">Chat</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p>No messages yet.</p>
              <p className="text-sm">Start a conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-400">
                    {msg.senderUserId === (user?.id ?? "") ? "You" : msg.senderUserId.slice(0, 6)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(msg.createdAt, { addSuffix: true })}
                  </span>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-white text-sm">{msg.message}</p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500"
            maxLength={500}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!message.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
