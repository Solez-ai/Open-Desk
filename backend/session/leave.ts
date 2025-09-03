import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type { LeaveSessionRequest, LeaveSessionResponse } from "./types";

// Leaves a session; updates participant status and connection timestamps.
// Recomputes the session status: "active" only if both host and controller are joined,
// otherwise "pending" (unless session is already "ended").
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

    // Recompute session status after leaving.
    const { data: sess, error: sErr } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", req.sessionId)
      .maybeSingle();

    if (sErr) {
      throw APIError.internal("failed to load session", sErr);
    }
    if (!sess) {
      throw APIError.notFound("session not found");
    }

    if (sess.status !== "ended") {
      const [{ data: hostJoined }, { data: controllerJoined }] = await Promise.all([
        supabaseAdmin
          .from("session_participants")
          .select("id")
          .eq("session_id", req.sessionId)
          .eq("role", "host")
          .eq("status", "joined")
          .maybeSingle(),
        supabaseAdmin
          .from("session_participants")
          .select("id")
          .eq("session_id", req.sessionId)
          .eq("role", "controller")
          .eq("status", "joined")
          .maybeSingle(),
      ]);

      const shouldBeActive = !!hostJoined && !!controllerJoined;

      const nextStatus = shouldBeActive ? "active" : "pending";
      if (sess.status !== nextStatus) {
        await supabaseAdmin
          .from("sessions")
          .update({ status: nextStatus })
          .eq("id", req.sessionId);
      }
    }

    return { success: true };
  }
);
