import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type {
  JoinByTokenRequest,
  JoinByTokenResponse,
  Session,
  Participant,
} from "./types";

// Joins a session using a temporary token from a shareable link.
export const joinByToken = api<JoinByTokenRequest, JoinByTokenResponse>(
  { expose: true, method: "POST", path: "/sessions/join-by-token", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Validate and find the token
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("session_tokens")
      .select("*")
      .eq("token", req.token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (tokenError) {
      throw APIError.internal("token validation failed", tokenError);
    }
    if (!tokenRow) {
      throw APIError.invalidArgument("invalid or expired token");
    }

    // Get the session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", tokenRow.session_id)
      .maybeSingle();

    if (sessionError || !session) {
      throw APIError.notFound("session not found", sessionError ?? undefined);
    }

    if (session.status === "ended") {
      throw APIError.invalidArgument("session has already ended");
    }

    // Upsert participant row - default to controller role for token joins
    const { data: participant, error: joinError } = await supabaseAdmin
      .from("session_participants")
      .upsert(
        {
          session_id: session.id,
          user_id: auth.userID,
          role: req.role || "controller",
          status: "joined",
          connected_at: new Date().toISOString(),
          disconnected_at: null,
        },
        { onConflict: "session_id,user_id" }
      )
      .select()
      .single();

    if (joinError || !participant) {
      throw APIError.internal("failed to join session", joinError ?? undefined);
    }

    // Update session status if conditions are met
    if (session.status !== "ended") {
      const [{ data: hostJoined }, { data: controllerJoined }] = await Promise.all([
        supabaseAdmin
          .from("session_participants")
          .select("id")
          .eq("session_id", session.id)
          .eq("role", "host")
          .eq("status", "joined")
          .maybeSingle(),
        supabaseAdmin
          .from("session_participants")
          .select("id")
          .eq("session_id", session.id)
          .eq("role", "controller")
          .eq("status", "joined")
          .maybeSingle(),
      ]);

      const shouldBeActive = req.role === "host" || (!!hostJoined && !!controllerJoined);

      if (shouldBeActive && session.status !== "active") {
        await supabaseAdmin.from("sessions").update({ status: "active" }).eq("id", session.id);
        session.status = "active";
      }
    }

    const sessionData: Session = {
      id: session.id,
      code: session.code,
      name: session.name,
      ownerId: session.owner_id,
      targetUserId: session.target_user_id,
      status: session.status,
      allowClipboard: session.allow_clipboard,
      isPublic: session.is_public,
      createdAt: new Date(session.created_at),
      updatedAt: new Date(session.updated_at),
    };

    const participantData: Participant = {
      id: participant.id,
      sessionId: participant.session_id,
      userId: participant.user_id,
      role: participant.role,
      status: participant.status,
      connectedAt: participant.connected_at ? new Date(participant.connected_at) : null,
      disconnectedAt: participant.disconnected_at ? new Date(participant.disconnected_at) : null,
      createdAt: new Date(participant.created_at),
      updatedAt: new Date(participant.updated_at),
    };

    return { session: sessionData, participant: participantData };
  }
);
