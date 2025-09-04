export interface UpdateProfileRequest {
  username?: string;
  fullName?: string;
  avatarUrl?: string;
}

export interface Profile {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  updatedAt: Date | null;
}

export interface UpdateProfileResponse {
  profile: Profile;
}
