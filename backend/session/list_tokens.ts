import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type { ListTokensRequest, ListTokensResponse, SessionToken } from "./types";

// Lists active tokens for a session that the user owns.
export const listSessionTokens = api<ListTokensRequest, ListTokensResponse>(
  { expose: true, method: "GET", path: "/sessions/:sessionId/tokens", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify session exists and user owns it
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("id, owner_id")
      .eq("id", req.sessionId)
      .maybeSingle();

    if (sessionError) {
      throw APIError.internal("failed to load session", sessionError);
    }
    if (!session) {
      throw APIError.notFound("session not found");
    }
    if (session.owner_id !== auth.userID) {
      throw APIError.permissionDenied("only session owner can view tokens");
    }

    // Get active tokens for the session
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from("session_tokens")
      .select("*")
      .eq("session_id", req.sessionId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (tokensError) {
      throw APIError.internal("failed to load tokens", tokensError);
    }

    const sessionTokens: SessionToken[] = (tokens || []).map((token) => ({
      id: token.id,
      sessionId: token.session_id,
      token: token.token,
      purpose: token.purpose,
      expiresAt: new Date(token.expires_at),
      createdAt: new Date(token.created_at),
    }));

    return { tokens: sessionTokens };
  }
);
