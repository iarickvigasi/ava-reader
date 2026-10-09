export type ProfilePatch = {
  displayName?: string;
  telegramUrl?: string | null;
  introduction?: string;
  profilePublished?: boolean;
  shareCurrentBook?: boolean;
};
export const CONNECT_DRAFT_KEY = "me:connect-draft";
export type ConnectDraft = { introduction: string; shareCurrentBook: boolean };
export type ProfileMutation = {
  patch: ProfilePatch;
  revision: string;
  error?: boolean;
};
export const PROFILE_KEY = "me:profile-mutation";
