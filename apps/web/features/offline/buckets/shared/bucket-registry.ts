// Shared per-book bucket registry for the offline buckets (highlights,
// ai-comments). Both keep a Map of per-libraryItemId buckets, create them
// lazily with empty state, and hydrate from Dexie in the background with the
// same merge dance (splice the persisted pending queue in front of any
// in-memory pending, dedupe by id so the newer in-memory version wins; prefer
// an in-memory snapshot when one already exists). The only per-bucket inputs
// are the initial state shape and the Dexie read — everything else is here.

import {
  addDropListener,
  addListener,
  awaitPersistDrain,
  persist,
  setBucketAuth as applyBucketAuth,
} from "./bucket-core";

type Listener = () => void;

// The state shape the registry needs to reason about: a snapshot list and a
// pending queue, both keyed by `id`. Each bucket's concrete state extends this.
type RegistryState = {
  snapshot: { id: string }[];
  pending: { id: string }[];
};

// Structural shape every bucket satisfies. The registry constructs and
// hydrates this; the concrete `StorageBucket` types add nothing it touches.
type RegistryBucket<State, Event> = {
  state: State;
  listeners: Set<Listener>;
  dropListeners: Set<(event: Event) => void>;
  flushing: boolean;
  getToken: (() => Promise<string | null>) | null;
  apiBaseUrl: string;
  version: number;
  derived: unknown[];
  derivedVersion: number;
  retryDelayMs: number;
  retryHandle: ReturnType<typeof setTimeout> | null;
  hydratedPromise: Promise<void>;
  pendingPersist: Promise<unknown>;
  flushPromise: Promise<void> | null;
};

type RegistryConfig<State> = {
  // A fresh, empty state for a newly-created bucket.
  createInitialState: () => State;
  // Reads the persisted snapshot + pending queue for a book from Dexie.
  readStorage: (libraryItemId: string) => Promise<State>;
};

export function createBucketRegistry<
  State extends RegistryState,
  Event,
  Bucket extends RegistryBucket<State, Event>,
>({ createInitialState, readStorage }: RegistryConfig<State>) {
  const buckets = new Map<string, Bucket>();

  function getOrCreateBucket(
    libraryItemId: string,
    apiBaseUrl: string,
  ): Bucket {
    let bucket = buckets.get(libraryItemId);
    if (!bucket) {
      bucket = {
        // Start empty; Dexie hydrate runs in the background and fills the
        // state once available. The bucket's `version` bumps on hydrate so
        // subscribers re-read through the stable selector.
        state: createInitialState(),
        listeners: new Set(),
        dropListeners: new Set(),
        flushing: false,
        getToken: null,
        apiBaseUrl,
        version: 1,
        derived: [],
        derivedVersion: 0,
        retryDelayMs: 0,
        retryHandle: null,
        hydratedPromise: Promise.resolve(),
        pendingPersist: Promise.resolve(),
        flushPromise: null,
        // The concrete StorageBucket adds bucket-specific fields (derived,
        // dropListeners) typed more precisely than the registry can express;
        // the shared shape above is all the registry itself touches.
      } as unknown as Bucket;
      buckets.set(libraryItemId, bucket);
      bucket.hydratedPromise = hydrate(libraryItemId, bucket);
    }
    // The apiBaseUrl can shift between server-render and client-render in
    // dev — always keep the latest so flushes target the right host.
    bucket.apiBaseUrl = apiBaseUrl;
    return bucket;
  }

  async function hydrate(
    libraryItemId: string,
    bucket: Bucket,
  ): Promise<void> {
    try {
      const loaded = await readStorage(libraryItemId);
      // If the caller already mutated the bucket in the brief window before
      // hydrate resolved (e.g. an effect dispatched applyServerSnapshot or
      // enqueued while we were reading Dexie), splice the Dexie pending queue
      // in front of any in-memory pending; deduplicate by id so the in-memory
      // version (newer) wins.
      const inMemoryPendingById = new Map(
        bucket.state.pending.map((mutation) => [mutation.id, mutation] as const),
      );
      const mergedPending = [
        ...loaded.pending.filter(
          (mutation) => !inMemoryPendingById.has(mutation.id),
        ),
        ...bucket.state.pending,
      ];
      // Snapshot: same logic, but the *in-memory* one is preferred when both
      // exist — applyServerSnapshot would have replaced state.snapshot with
      // the freshest server view.
      const snapshot = bucket.state.snapshot.length
        ? bucket.state.snapshot
        : loaded.snapshot;
      bucket.state = { ...loaded, snapshot, pending: mergedPending };
      persist(bucket);
    } catch {
      // Dexie unavailable (private mode quirks, quota, …). The bucket keeps
      // working in-memory for this session; we just don't have offline replay.
    }
  }

  function subscribe(
    libraryItemId: string,
    apiBaseUrl: string,
    listener: Listener,
  ): () => void {
    return addListener(getOrCreateBucket(libraryItemId, apiBaseUrl), listener);
  }

  function subscribeToDrops(
    libraryItemId: string,
    apiBaseUrl: string,
    listener: (event: Event) => void,
  ): () => void {
    return addDropListener(
      getOrCreateBucket(libraryItemId, apiBaseUrl),
      listener,
    );
  }

  function setBucketAuth(
    libraryItemId: string,
    apiBaseUrl: string,
    getToken: () => Promise<string | null>,
  ): void {
    applyBucketAuth(getOrCreateBucket(libraryItemId, apiBaseUrl), getToken);
  }

  // Test-only — waits for every in-flight async piece kicked off by
  // mutations/sync (the fire-and-forget Dexie write chain *and* any
  // currently-running flush) to settle.
  function awaitDrain(libraryItemId: string): Promise<void> {
    return awaitPersistDrain(buckets.get(libraryItemId));
  }

  // Test-only — clears module-level state without nuking Dexie.
  function reset(): void {
    for (const bucket of buckets.values()) {
      if (bucket.retryHandle) {
        clearTimeout(bucket.retryHandle);
      }
    }
    buckets.clear();
  }

  return {
    buckets,
    getOrCreateBucket,
    subscribe,
    subscribeToDrops,
    setBucketAuth,
    awaitDrain,
    reset,
  };
}
