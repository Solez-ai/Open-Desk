import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type { TerminateSessionRequest, TerminateSessionResponse, Session } from "./types";

// Terminates a session; only the owner can end a session.
export const terminateSession = api<TerminateSessionRequest, TerminateSessionResponse>(
  { expose: true, method: "POST", path: "/sessions/:sessionId/terminate", auth: true },
  async (req) => {
    const auth = getAuthData()!;

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
    if (sess.owner_id !== auth.userID) {
      throw APIError.permissionDenied("only owner can terminate session");
    }

    const { data: updated, error: uErr } = await supabaseAdmin
      .from("sessions")
      .update({ status: "ended" })
      .eq("id", req.sessionId)
      .select()
      .single();

    if (uErr || !updated) {
      throw APIError.internal("failed to terminate session", uErr ?? undefined);
    }

    const session: Session = {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      ownerId: updated.owner_id,
      targetUserId: updated.target_user_id,
      status: updated.status,
      allowClipboard: updated.allow_clipboard,
      isPublic: updated.is_public,
      createdAt: new Date(updated.created_at),
      updatedAt: new Date(updated.updated_at),
    };

    return { session };
  }
);
