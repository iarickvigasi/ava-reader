export type MembershipChange = {
  collectionId: string;
  member: boolean;
  baselineMember: boolean;
};

export type MembershipMutation = {
  libraryItemId: string;
  revision: string;
  queuedAt: string;
  changes: MembershipChange[];
};

export type MembershipDropEvent = { libraryItemId: string; reason: string };
export type GetToken = () => Promise<string | null>;
