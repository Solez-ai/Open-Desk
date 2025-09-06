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

    // Update auth.users.user_metadata only (no separate profiles table required)
    const userMeta: Record<string, any> = {};
    if (fullName !== undefined) userMeta.full_name = fullName;
    if (avatarUrl !== undefined) userMeta.avatar_url = avatarUrl;
    if (username !== undefined) userMeta.username = username;

    try {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(auth.userID, {
        user_metadata: userMeta,
      });
      if (error) {
        // Surface unique constraint violations nicely if present in details
        if ((error as any).status === 409) {
          throw APIError.alreadyExists("username is already taken");
        }
        throw APIError.internal("failed to update user profile", error as any);
      }

      const updated = data?.user;
      const meta = (updated?.user_metadata as Record<string, any>) || {};

      const profile: Profile = {
        id: auth.userID,
        username: meta.username ?? null,
        fullName: meta.full_name ?? null,
        avatarUrl: meta.avatar_url ?? null,
        updatedAt: new Date(),
      };

      return { profile };
    } catch (err: any) {
      if (err instanceof APIError) throw err;
      throw APIError.internal("unexpected error updating profile", err);
    }
  }
);
