import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type { BroadcastStatusRequest, BroadcastStatusResponse } from "./types";

// Broadcasts session status changes to all participants
export const broadcastStatus = api<BroadcastStatusRequest, BroadcastStatusResponse>(
  { expose: true, method: "POST", path: "/sessions/:sessionId/broadcast-status", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify the user is a participant in this session
    const { data: participant, error: pErr } = await supabaseAdmin
      .from("session_participants")
      .select("id, role")
      .eq("session_id", req.sessionId)
      .eq("user_id", auth.userID)
      .eq("status", "joined")
      .maybeSingle();

    if (pErr) {
      throw APIError.internal("failed to verify participant", pErr);
    }
    if (!participant) {
      throw APIError.permissionDenied("not a participant in this session");
    }

    // Get current session status
    const { data: session, error: sErr } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", req.sessionId)
      .single();

    if (sErr || !session) {
      throw APIError.internal("failed to get session", sErr ?? undefined);
    }

    // Get all participants
    const { data: participants, error: partErr } = await supabaseAdmin
      .from("session_participants")
      .select("user_id")
      .eq("session_id", req.sessionId)
      .eq("status", "joined");

    if (partErr) {
      throw APIError.internal("failed to get participants", partErr);
    }

    // Create a signal payload describing the status update
    const signalData = {
      type: "session_status_update",
      sessionId: req.sessionId,
      status: session.status,
      timestamp: new Date().toISOString(),
    };

    // Send to all participants (recipient is optional to allow broadcast)
    const signalPromises = participants.map(participant =>
      supabaseAdmin.from("signals").insert({
        session_id: req.sessionId,
        sender_user_id: auth.userID,
        recipient_user_id: participant.user_id,
        type: "status",
        payload: signalData,
      })
    );

    await Promise.all(signalPromises);

    return {
      success: true,
      status: session.status,
      participantsNotified: participants.length,
    };
  }
);
