import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type { ListParticipantsRequest, ListParticipantsResponse, Participant } from "./types";

// Lists all participants for a session with access control checks.
export const listParticipants = api<ListParticipantsRequest, ListParticipantsResponse>(
  { expose: true, method: "GET", path: "/sessions/:sessionId/participants", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    const { data: s, error: sErr } = await supabaseAdmin
      .from("sessions")
      .select("id, owner_id, target_user_id")
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
        throw APIError.permissionDenied("not allowed to view participants in this session");
      }
    }

    // First get the participants
    const { data: participantRows, error: lErr } = await supabaseAdmin
      .from("session_participants")
      .select("*")
      .eq("session_id", req.sessionId);

    if (lErr) {
      throw APIError.internal("failed to list participants", lErr);
    }

    // Then get profile data for each participant
    const participants: Participant[] = [];
    
    for (const p of participantRows || []) {
      // Get profile data for this participant
      const { data: profileData, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", p.user_id)
        .maybeSingle();

      // Don't fail if profile doesn't exist, just use null values
      const profile = profileErr ? null : profileData;

      participants.push({
        id: p.id,
        sessionId: p.session_id,
        userId: p.user_id,
        role: p.role,
        status: p.status,
        username: profile?.username || null,
        fullName: profile?.full_name || null,
        avatarUrl: profile?.avatar_url || null,
        connectedAt: p.connected_at ? new Date(p.connected_at) : null,
        disconnectedAt: p.disconnected_at ? new Date(p.disconnected_at) : null,
        createdAt: new Date(p.created_at),
        updatedAt: new Date(p.updated_at),
      });
    }

    return { participants };
  }
);
