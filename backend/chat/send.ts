import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";

interface SendChatMessageRequest {
  sessionId: string;
  message: string;
}

interface SendChatMessageResponse {
  id: string | number;
  createdAt: Date;
}

// Sends a chat message to the session; clients subscribe via Supabase Realtime.
export const sendChatMessage = api<SendChatMessageRequest, SendChatMessageResponse>(
  { expose: true, method: "POST", path: "/chat/send", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    if (!req.message || !req.message.trim()) {
      throw APIError.invalidArgument("message cannot be empty");
    }

    // Ensure the sender is a participant in the session
    const { data: participant, error: pErr } = await supabaseAdmin
      .from("session_participants")
      .select("id")
      .eq("session_id", req.sessionId)
      .eq("user_id", auth.userID)
      .maybeSingle();

    if (pErr) {
      throw APIError.internal("participant check failed", pErr);
    }
    if (!participant) {
      throw APIError.permissionDenied("not a participant in this session");
    }

    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        session_id: req.sessionId,
        sender_user_id: auth.userID,
        message: req.message.trim(),
      })
      .select()
      .single();

    if (iErr || !inserted) {
      throw APIError.internal("failed to send chat message", iErr ?? undefined);
    }

    return {
      id: inserted.id,
      createdAt: new Date(inserted.created_at),
    };
  }
);
