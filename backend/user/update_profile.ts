import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import supabaseAdmin from "./supabase"; // use service-local client
import type { UpdateProfileRequest, UpdateProfileResponse, Profile } from "./types";

// Updates the authenticated user's profile.
export const updateProfile = api<UpdateProfileRequest, UpdateProfileResponse>(
  { expose: true, method: "POST", path: "/user/profile", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const { username, fullName, avatarUrl } = req;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (username !== undefined) updates.username = username;
    if (fullName !== undefined) updates.full_name = fullName;
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

    // Update profiles table
    const { data: profileData, error: pErr } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", auth.userID)
      .select()
      .single();

    if (pErr) {
      if (pErr.code === "23505") {
        // unique_violation
        throw APIError.alreadyExists("username is already taken");
      }
      throw APIError.internal("failed to update profile", pErr);
    }

    // Also update auth.users.user_metadata for JWT consistency
    const metaUpdates: Record<string, any> = {};
    if (fullName !== undefined) metaUpdates.full_name = fullName;
    if (avatarUrl !== undefined) metaUpdates.avatar_url = avatarUrl;
    if (username !== undefined) metaUpdates.username = username;

    if (Object.keys(metaUpdates).length > 0) {
      const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(auth.userID, {
        user_metadata: metaUpdates,
      });
      if (uErr) {
        // This is not critical if the profile table updated, but log it.
        console.error("Failed to update user_metadata:", uErr);
      }
    }

    const profile: Profile = {
      id: profileData.id,
      username: profileData.username,
      fullName: profileData.full_name,
      avatarUrl: profileData.avatar_url,
      updatedAt: profileData.updated_at ? new Date(profileData.updated_at) : null,
    };

    return { profile };
  }
);
