import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type { SignalType } from "../common/utils";

interface PublishSignalRequest {
  sessionId: string;
  type: SignalType;
  // Optional: direct a message to a specific recipient user id; otherwise broadcast to session.
  recipientUserId?: string;
  payload: unknown; // must be JSON-serializable
}

interface PublishSignalResponse {
  id: string;
  createdAt: Date;
}

// Publishes a signaling message (offer/answer/ice/status) into Supabase for realtime fan-out to peers.
export const publishSignal = api<PublishSignalRequest, PublishSignalResponse>(
  { expose: true, method: "POST", path: "/signaling/publish", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify the sender is a participant in the session.
    const { data: participant, error: pErr } = await supabaseAdmin
      .from("session_participants")
      .select("*")
      .eq("session_id", req.sessionId)
      .eq("user_id", auth.userID)
      .maybeSingle();

    if (pErr) {
      throw APIError.internal("participant lookup failed", pErr);
    }
    if (!participant) {
      throw APIError.permissionDenied("not a participant in this session");
    }

    // Optional: if targeting a specific recipient, ensure that user is also a participant.
    if (req.recipientUserId) {
      const { data: recip, error: rErr } = await supabaseAdmin
        .from("session_participants")
        .select("id")
        .eq("session_id", req.sessionId)
        .eq("user_id", req.recipientUserId)
        .maybeSingle();

      if (rErr) {
        throw APIError.internal("recipient lookup failed", rErr);
      }
      if (!recip) {
        throw APIError.invalidArgument("recipient is not in this session");
      }
    }

    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("signals")
      .insert({
        session_id: req.sessionId,
        type: req.type,
        sender_user_id: auth.userID,
        recipient_user_id: req.recipientUserId ?? null,
        payload: req.payload as any,
      })
      .select()
      .single();

    if (iErr || !inserted) {
      throw APIError.internal("failed to publish signal", iErr ?? undefined);
    }

    return {
      id: inserted.id,
      createdAt: new Date(inserted.created_at),
    };
  }
);
