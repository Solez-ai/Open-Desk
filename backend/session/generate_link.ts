import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import { randomSessionCode } from "../common/utils";
import type { GenerateLinkRequest, GenerateLinkResponse } from "./types";

// Generates a shareable link with a temporary token for session access.
export const generateSessionLink = api<GenerateLinkRequest, GenerateLinkResponse>(
  { expose: true, method: "POST", path: "/sessions/:sessionId/generate-link", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify session exists and user has permission to generate links
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", req.sessionId)
      .maybeSingle();

    if (sessionError) {
      throw APIError.internal("failed to load session", sessionError);
    }
    if (!session) {
      throw APIError.notFound("session not found");
    }

    // Only session owner can generate links
    if (session.owner_id !== auth.userID) {
      throw APIError.permissionDenied("only session owner can generate invite links");
    }

    // Generate a unique token
    const token = randomSessionCode(32); // Longer token for security

    // Calculate expiration time (default 24 hours, max 7 days)
    const expiresInHours = Math.min(req.expiresInHours || 24, 168); // Max 7 days
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Insert token into database
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("session_tokens")
      .insert({
        session_id: req.sessionId,
        token,
        purpose: "join",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (tokenError || !tokenRow) {
      throw APIError.internal("failed to create session token", tokenError ?? undefined);
    }

    // Generate the shareable link
    const baseUrl = req.baseUrl || "https://opendesk.example.com"; // In production, use actual domain
    const link = `${baseUrl}/join/${token}`;

    return {
      link,
      token,
      expiresAt,
    };
  }
);
