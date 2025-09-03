import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type { GetSessionRequest, GetSessionResponse, Session } from "./types";

// Retrieves a single session by ID after enforcing access control.
export const getSession = api<GetSessionRequest, GetSessionResponse>(
  { expose: true, method: "GET", path: "/sessions/:sessionId", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    const { data: s, error: sErr } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", req.sessionId)
      .maybeSingle();

    if (sErr) {
      throw APIError.internal("failed to load session", sErr);
    }
    if (!s) {
      throw APIError.notFound("session not found");
    }

    // Access control: owner, target, or participant.
    if (s.owner_id !== auth.userID && s.target_user_id !== auth.userID) {
      const { data: part, error: pErr } = await supabaseAdmin
        .from("session_participants")
        .select("id")
        .eq("session_id", req.sessionId)
        .eq("user_id", auth.userID)
        .maybeSingle();

      if (pErr) {
        throw APIError.internal("failed to check participant", pErr);
      }
      if (!part) {
        throw APIError.permissionDenied("not allowed to view this session");
      }
    }

    const session: Session = {
      id: s.id,
      code: s.code,
      name: s.name,
      ownerId: s.owner_id,
      targetUserId: s.target_user_id,
      status: s.status,
      allowClipboard: s.allow_clipboard,
      isPublic: s.is_public,
      createdAt: new Date(s.created_at),
      updatedAt: new Date(s.updated_at),
    };

    return { session };
  }
);
