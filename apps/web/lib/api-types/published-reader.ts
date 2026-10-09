export type PublishedReader = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  introduction: string;
  currentBook: { title: string; authors: string[] } | null;
};
