export type FinishDateMutation = {
  libraryItemId: string;
  revision: string;
  queuedAt: string;
  finishedAt: string | null;
};

export type FinishDateSyncFailure = { libraryItemId: string; reason: string };
export type GetToken = () => Promise<string | null>;
