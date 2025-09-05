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
// Joining with a valid session code now authorizes controllers to join private sessions.
// Session status is only set to "active" when both a host and a controller are joined.
// Otherwise, it remains or is set to "pending".
export const joinSession = api<JoinSessionRequest, JoinSessionResponse>(
  { expose: true, method: "POST", path: "/sessions/join", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    if (!req.sessionId && !req.code) {
      throw APIError.invalidArgument("must provide sessionId or code");
    }

    // Normalize code to uppercase to avoid case sensitivity issues.
    const normalizedCode = req.code?.toUpperCase().trim();

    // Find session by id or code.
    let session;
    if (req.sessionId) {
      const { data: rows, error: fErr } = await supabaseAdmin
        .from("sessions")
        .select("*")
        .eq("id", req.sessionId)
        .maybeSingle();
      
      if (fErr) {
        throw APIError.internal("failed to lookup session", fErr);
      }
      session = rows;
    } else {
      const { data: rows, error: fErr } = await supabaseAdmin
        .from("sessions")
        .select("*")
        .eq("code", normalizedCode!)
        .maybeSingle();
      
      if (fErr) {
        throw APIError.internal("failed to lookup session", fErr);
      }
      session = rows;
    }

    if (!session) {
      throw APIError.notFound("No session found with that code");
    }

    if (session.status === "ended") {
      throw APIError.invalidArgument("session has already ended");
    }

    // Access control - be more permissive for valid session codes
    if (req.role === "host") {
      // Host must be the target if specified, otherwise allow owner or public sessions.
      if (session.target_user_id && session.target_user_id !== auth.userID) {
        throw APIError.permissionDenied("not authorized as host for this session");
      }
      if (!session.target_user_id && session.owner_id !== auth.userID && !session.is_public) {
        throw APIError.permissionDenied("host join denied");
      }
    } else if (req.role === "controller") {
      const isOwner = session.owner_id === auth.userID;
      const isTarget = !!session.target_user_id && session.target_user_id === auth.userID;
      const isPublic = session.is_public;
      
      // Allow joining by valid code (most permissive for ease of use)
      const allowByCode = !!normalizedCode;

      // Check for valid token if provided
      let hasToken = false;
      if (req.token) {
        const { data: tokenRow, error: tErr } = await supabaseAdmin
          .from("session_tokens")
          .select("*")
          .eq("session_id", session.id)
          .eq("token", req.token)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (tErr) {
          throw APIError.internal("token validation failed", tErr);
        }
        hasToken = !!tokenRow;
      }

      // Allow access if any of these conditions are met:
      // 1. User is the owner
      // 2. User is the target
      // 3. Session is public
      // 4. User has a valid token
      // 5. User provided a valid session code (most common case)
      if (!isOwner && !isTarget && !isPublic && !hasToken && !allowByCode) {
        throw APIError.permissionDenied("controller join denied");
      }
    }

    // Check if user is already a participant
    const { data: existingParticipant, error: existingErr } = await supabaseAdmin
      .from("session_participants")
      .select("*")
      .eq("session_id", session.id)
      .eq("user_id", auth.userID)
      .maybeSingle();

    if (existingErr) {
      throw APIError.internal("failed to check existing participant", existingErr);
    }

    let participant;
    if (existingParticipant) {
      // Update existing participant
      const { data: updatedParticipant, error: updateErr } = await supabaseAdmin
        .from("session_participants")
        .update({
          role: req.role,
          status: "joined",
          connected_at: new Date().toISOString(),
          disconnected_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingParticipant.id)
        .select()
        .single();

      if (updateErr || !updatedParticipant) {
        throw APIError.internal("failed to update participant", updateErr ?? undefined);
      }
      participant = updatedParticipant;
    } else {
      // Create new participant
      const { data: newParticipant, error: createErr } = await supabaseAdmin
        .from("session_participants")
        .insert({
          session_id: session.id,
          user_id: auth.userID,
          role: req.role,
          status: "joined",
          connected_at: new Date().toISOString(),
          disconnected_at: null,
        })
        .select()
        .single();

      if (createErr || !newParticipant) {
        throw APIError.internal("failed to create participant", createErr ?? undefined);
      }
      participant = newParticipant;
    }

    // Update session status:
    // Only mark as active if both a host and a controller are currently joined.
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

      const shouldBeActive = !!hostJoined && !!controllerJoined;

      if (shouldBeActive && session.status !== "active") {
        const { data: updatedSession, error: updateErr } = await supabaseAdmin
          .from("sessions")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", session.id)
          .select()
          .single();
        
        if (!updateErr && updatedSession) {
          session = updatedSession;
        }
      } else if (!shouldBeActive && session.status !== "pending") {
        const { data: updatedSession, error: updateErr } = await supabaseAdmin
          .from("sessions")
          .update({ status: "pending", updated_at: new Date().toISOString() })
          .eq("id", session.id)
          .select()
          .single();
        
        if (!updateErr && updatedSession) {
          session = updatedSession;
        }
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
