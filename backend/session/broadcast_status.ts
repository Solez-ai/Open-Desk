import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "../signaling/supabase";
import type { BroadcastStatusRequest, BroadcastStatusResponse } from "./types";

// Broadcasts session status updates to all participants via Supabase signals
export const broadcastStatus = api<BroadcastStatusRequest, BroadcastStatusResponse>(
  { expose: true, method: "POST", path: "/session/broadcast-status", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify the sender is a participant in the session
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

    // Get current session status
    const { data: session, error: sErr } = await supabaseAdmin
      .from("sessions")
      .select("status")
      .eq("id", req.sessionId)
      .single();

    if (sErr || !session) {
      throw APIError.internal("session lookup failed", sErr);
    }

    // Get all participants in the session
    const { data: participants, error: partsErr } = await supabaseAdmin
      .from("session_participants")
      .select("user_id")
      .eq("session_id", req.sessionId)
      .eq("status", "joined");

    if (partsErr) {
      throw APIError.internal("participants lookup failed", partsErr);
    }

    // Create status update signal
    const statusUpdate = {
      type: "session_status_update",
      status: session.status,
      timestamp: new Date().toISOString(),
      sessionId: req.sessionId,
    };

    // Send status update to all participants
    const signalPromises = participants.map(async (participant) => {
      const { error } = await supabaseAdmin
        .from("signals")
        .insert({
          session_id: req.sessionId,
          type: "session_status_update",
          sender_user_id: auth.userID,
          recipient_user_id: participant.user_id,
          payload: statusUpdate,
        });

      if (error) {
        console.error(`Failed to send status update to ${participant.user_id}:`, error);
      }
    });

    await Promise.all(signalPromises);

    return {
      success: true,
      status: session.status,
      participantsNotified: participants.length,
    };
  }
);