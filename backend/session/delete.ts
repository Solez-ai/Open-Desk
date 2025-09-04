import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type { DeleteSessionRequest, DeleteSessionResponse } from "./types";

// Permanently deletes a session and all related data.
// Only the session owner can delete, and only when the session has ended.
export const deleteSession = api<DeleteSessionRequest, DeleteSessionResponse>(
  { expose: true, method: "DELETE", path: "/sessions/:sessionId", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Load the session
    const { data: sess, error: sErr } = await supabaseAdmin
      .from("sessions")
      .select("id, owner_id, status")
      .eq("id", req.sessionId)
      .maybeSingle();

    if (sErr) {
      throw APIError.internal("failed to load session", sErr);
    }
    if (!sess) {
      throw APIError.notFound("session not found");
    }

    if (sess.owner_id !== auth.userID) {
      throw APIError.permissionDenied("only the session owner can delete the session");
    }

    if (sess.status !== "ended") {
      throw APIError.failedPrecondition("session must be ended before it can be deleted");
    }

    // Delete the session; all related rows will cascade delete.
    const { error: dErr } = await supabaseAdmin
      .from("sessions")
      .delete()
      .eq("id", req.sessionId);

    if (dErr) {
      throw APIError.internal("failed to delete session", dErr);
    }

    return { success: true };
  }
);
