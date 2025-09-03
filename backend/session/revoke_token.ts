import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type { RevokeTokenRequest, RevokeTokenResponse } from "./types";

// Revokes a session token to disable the associated shareable link.
export const revokeSessionToken = api<RevokeTokenRequest, RevokeTokenResponse>(
  { expose: true, method: "DELETE", path: "/sessions/:sessionId/tokens/:tokenId", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify the token exists and belongs to a session owned by the user
    const { data: token, error: tokenError } = await supabaseAdmin
      .from("session_tokens")
      .select(`
        *,
        sessions!inner(owner_id)
      `)
      .eq("id", req.tokenId)
      .eq("session_id", req.sessionId)
      .maybeSingle();

    if (tokenError) {
      throw APIError.internal("failed to load token", tokenError);
    }
    if (!token) {
      throw APIError.notFound("token not found");
    }
    if (token.sessions.owner_id !== auth.userID) {
      throw APIError.permissionDenied("only session owner can revoke tokens");
    }

    // Delete the token
    const { error: deleteError } = await supabaseAdmin
      .from("session_tokens")
      .delete()
      .eq("id", req.tokenId);

    if (deleteError) {
      throw APIError.internal("failed to revoke token", deleteError);
    }

    return { success: true };
  }
);
