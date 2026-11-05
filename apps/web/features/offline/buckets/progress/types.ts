import type { ReaderLocator } from "@/lib/api-types";
export type ProgressWrite = { locator: ReaderLocator; readAt: string };
export type ProgressSyncOptions = { keepalive?: boolean };
export type GetProgressToken = () => Promise<string | null>;
