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

    // Get participants with profile data using a join
    const { data: participantRows, error: lErr } = await supabaseAdmin
      .from("session_participants")
      .select(`
        id,
        session_id,
        user_id,
        role,
        status,
        connected_at,
        disconnected_at,
        created_at,
        updated_at,
        profiles!inner (
          username,
          full_name,
          avatar_url
        )
      `)
      .eq("session_id", req.sessionId);

    if (lErr) {
      throw APIError.internal("failed to list participants", lErr);
    }

    // Map the results to the expected format
    const participants: Participant[] = (participantRows || []).map((p) => ({
      id: p.id,
      sessionId: p.session_id,
      userId: p.user_id,
      role: p.role as "host" | "controller",
      status: p.status as "joined" | "left",
      username: p.profiles?.username || null,
      fullName: p.profiles?.full_name || null,
      avatarUrl: p.profiles?.avatar_url || null,
      connectedAt: p.connected_at ? new Date(p.connected_at) : null,
      disconnectedAt: p.disconnected_at ? new Date(p.disconnected_at) : null,
      createdAt: new Date(p.created_at),
      updatedAt: new Date(p.updated_at),
    }));

    return { participants };
  }
);
