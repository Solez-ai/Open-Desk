import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import { randomSessionCode } from "../common/utils";
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  Session,
  Participant,
} from "./types";

// Creates a new remote control session owned by the authenticated user.
export const createSession = api<CreateSessionRequest, CreateSessionResponse>(
  { expose: true, method: "POST", path: "/sessions", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const code = randomSessionCode(6);

    const { data: insertSession, error } = await supabaseAdmin
      .from("sessions")
      .insert({
        code,
        name: req.name ?? null,
        owner_id: auth.userID,
        target_user_id: req.targetUserId ?? null,
        status: "pending",
        allow_clipboard: req.allowClipboard ?? false,
        is_public: req.isPublic ?? false,
      })
      .select()
      .single();

    if (error || !insertSession) {
      throw APIError.internal("failed to create session", error ?? undefined);
    }

    // Owner joins as controller by default.
    const { data: insertParticipant, error: pErr } = await supabaseAdmin
      .from("session_participants")
      .insert({
        session_id: insertSession.id,
        user_id: auth.userID,
        role: "controller",
        status: "joined",
        connected_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (pErr || !insertParticipant) {
      throw APIError.internal("failed to create owner participant", pErr ?? undefined);
    }

    const session: Session = {
      id: insertSession.id,
      code: insertSession.code,
      name: insertSession.name,
      ownerId: insertSession.owner_id,
      targetUserId: insertSession.target_user_id,
      status: insertSession.status,
      allowClipboard: insertSession.allow_clipboard,
      isPublic: insertSession.is_public,
      createdAt: new Date(insertSession.created_at),
      updatedAt: new Date(insertSession.updated_at),
    };

    return { session };
  }
);
