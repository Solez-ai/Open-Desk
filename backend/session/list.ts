import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase";
import type { ListMySessionsResponse, Session } from "./types";

// Lists sessions the user owns or participates in.
export const listMySessions = api<void, ListMySessionsResponse>(
  { expose: true, method: "GET", path: "/sessions", auth: true },
  async () => {
    const auth = getAuthData()!;

    // Sessions owned by user or targeted to user
    const { data: owned, error: oErr } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .or(`owner_id.eq.${auth.userID},target_user_id.eq.${auth.userID}`);

    if (oErr) {
      throw oErr;
    }

    // Sessions participated by user
    const { data: participantIds, error: pErr } = await supabaseAdmin
      .from("session_participants")
      .select("session_id")
      .eq("user_id", auth.userID);

    if (pErr) {
      throw pErr;
    }

    const ids = new Set<string>(participantIds?.map((r) => r.session_id) ?? []);
    const base = [...(owned ?? [])];

    // Fetch any additional sessions by id not included in owned/targeted set
    const missing = [...ids].filter((id) => !(base ?? []).some((s) => s.id === id));
    let extra: any[] = [];
    if (missing.length > 0) {
      const { data: ex, error: eErr } = await supabaseAdmin.from("sessions").select("*").in("id", missing);
      if (eErr) {
        throw eErr;
      }
      extra = ex ?? [];
    }

    const all = [...base, ...extra];
    const sessions: Session[] = (all ?? []).map((s) => ({
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
    }));

    return { sessions };
  }
);
