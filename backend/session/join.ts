import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type {
  JoinSessionRequest,
  JoinSessionResponse,
  Session,
  Participant,
} from "./types";

// Joins a session as host or controller after validating access rules.
export const joinSession = api<JoinSessionRequest, JoinSessionResponse>(
  { expose: true, method: "POST", path: "/sessions/join", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    if (!req.sessionId && !req.code) {
      throw APIError.invalidArgument("must provide sessionId or code");
    }

    // Find session by id or code.
    const query = supabaseAdmin.from("sessions").select("*").limit(1);

    const { data: rows, error: fErr } = req.sessionId
      ? await query.eq("id", req.sessionId)
      : await query.eq("code", req.code!);

    if (fErr || !rows || rows.length === 0) {
      throw APIError.notFound("session not found", fErr ?? undefined);
    }
    const s = rows[0];

    // Access control:
    // - Host: must be the target user (if specified) or owner (self-host)
    if (req.role === "host") {
      if (s.target_user_id && s.target_user_id !== auth.userID) {
        throw APIError.permissionDenied("not authorized as host for this session");
      }
      // If no explicit target, allow owner to be host on their own machine as fallback.
      if (!s.target_user_id && s.owner_id !== auth.userID) {
        // Allow join if public session
        if (!s.is_public) {
          throw APIError.permissionDenied("host join denied");
        }
      }
    }

    // - Controller: allowed if owner or invited target, or session is public, or has a valid token.
    if (req.role === "controller") {
      const isOwner = s.owner_id === auth.userID;
      const isTarget = !!s.target_user_id && s.target_user_id === auth.userID;

      let hasToken = false;
      if (req.token) {
        const { data: tokenRow, error: tErr } = await supabaseAdmin
          .from("session_tokens")
          .select("*")
          .eq("session_id", s.id)
          .eq("token", req.token)
          .gt("expires_at", new Date().toISOString())
          .limit(1)
          .maybeSingle();

        if (tErr) {
          throw APIError.internal("token validation failed", tErr);
        }
        hasToken = !!tokenRow;
      }

      if (!isOwner && !isTarget && !s.is_public && !hasToken) {
        throw APIError.permissionDenied("controller join denied");
      }
    }

    // Upsert participant row
    const { data: part, error: jErr } = await supabaseAdmin
      .from("session_participants")
      .upsert(
        {
          session_id: s.id,
          user_id: auth.userID,
          role: req.role,
          status: "joined",
          connected_at: new Date().toISOString(),
          disconnected_at: null,
        },
        { onConflict: "session_id,user_id" }
      )
      .select()
      .single();

    if (jErr || !part) {
      throw APIError.internal("failed to join session", jErr ?? undefined);
    }

    // If host joined, update session to active from pending, if not ended.
    if (req.role === "host" && s.status !== "ended" && s.status !== "active") {
      await supabaseAdmin.from("sessions").update({ status: "active" }).eq("id", s.id);
    }

    const session: Session = {
      id: s.id,
      code: s.code,
      name: s.name,
      ownerId: s.owner_id,
      targetUserId: s.target_user_id,
      status: s.status === "pending" && req.role === "host" ? "active" : s.status,
      allowClipboard: s.allow_clipboard,
      isPublic: s.is_public,
      createdAt: new Date(s.created_at),
      updatedAt: new Date(s.updated_at),
    };

    const participant: Participant = {
      id: part.id,
      sessionId: part.session_id,
      userId: part.user_id,
      role: part.role,
      status: part.status,
      connectedAt: part.connected_at ? new Date(part.connected_at) : null,
      disconnectedAt: part.disconnected_at ? new Date(part.disconnected_at) : null,
      createdAt: new Date(part.created_at),
      updatedAt: new Date(part.updated_at),
    };

    return { session, participant };
  }
);
