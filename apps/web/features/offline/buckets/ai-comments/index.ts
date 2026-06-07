// Public surface of the offline-first AI comments bucket.
//
// Storage substrate is Dexie (rows in `aiComments` + `aiCommentMutations`).

export type {
  AiCommentKind,
  AiCommentRecord,
  AiCommentStatus,
  DropEvent,
  DropListener,
  GenerateEtymologyPayload,
  GenerateExplainPayload,
  GenerateTranslatePayload,
  PendingMutation,
  ServerAiComment,
} from "./types";

export {
  getAiCommentsBucket,
  setBucketAuth,
  subscribeToAiComments,
  subscribeToDrops,
  __resetAiCommentsBucketsForTests,
  awaitAiCommentsPersistDrain,
} from "./bucket";

export { selectAiComments, selectStableAiComments } from "./selectors";

export { enqueueDelete, enqueueGenerate } from "./mutations";

export { applyServerSnapshot, flushBucket } from "./sync";

export { generateAiCommentId } from "./id";
