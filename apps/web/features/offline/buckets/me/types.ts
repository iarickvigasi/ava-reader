export type ProfilePatch = { displayName: string; telegramUrl?: string | null };
export type ProfileMutation = {
  patch: ProfilePatch;
  revision: string;
  error?: boolean;
};
export const PROFILE_KEY = "me:profile-mutation";
