import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type { LeaveSessionRequest, LeaveSessionResponse } from "./types";

// Leaves a session; updates participant status and connection timestamps.
export const leaveSession = api<LeaveSessionRequest, LeaveSessionResponse>(
  { expose: true, method: "POST", path: "/sessions/:sessionId/leave", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify participant exists
    const { data: part, error: pErr } = await supabaseAdmin
      .from("session_participants")
      .select("*")
      .eq("session_id", req.sessionId)
      .eq("user_id", auth.userID)
      .maybeSingle();

    if (pErr) {
      throw APIError.internal("failed to lookup participant", pErr);
    }
    if (!part) {
      throw APIError.notFound("not participating in this session");
    }

    const { error: uErr } = await supabaseAdmin
      .from("session_participants")
      .update({
        status: "left",
        disconnected_at: new Date().toISOString(),
      })
      .eq("id", part.id);

    if (uErr) {
      throw APIError.internal("failed to leave session", uErr);
    }

    return { success: true };
  }
);
