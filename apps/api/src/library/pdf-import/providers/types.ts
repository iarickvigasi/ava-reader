import type { AttemptAuthority } from '../jobs';
import type { PilotInventory } from './pilot-schema';
export type ProviderMessage = {
  role: 'system' | 'user';
  content:
    | string
    | (
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      )[];
};
export type ProviderTask = {
  taskId: string;
  purpose: 'transcribe_region' | 'resolve_structure';
  sourceSha256: string;
  pageIndices: number[];
  promptVersion: string;
  schemaVersion: string;
  messages: ProviderMessage[];
  responseSchema: Record<string, unknown>;
};
export type ProviderDispatch = {
  authority: AttemptAuthority;
  task: ProviderTask;
  signal?: AbortSignal;
};
export type ProviderReceipt = {
  callId: string;
  generationId: string;
  output: string;
  actualNano: string;
  reused: boolean;
};
export type RouteConfiguration = {
  version: 1;
  maxContextTokens: number;
  maxOutputTokens: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  maxImages: number;
  timeoutMs: number;
  dataCollection: 'deny';
  zeroDataRetention: boolean;
  promptHashes: Record<string, string>;
  schemaHashes: Record<string, string>;
  operationLimitNano: string;
  authorizedSourceSha256: string[];
  pilotInventory?: PilotInventory;
};
export type RouteTariff = {
  version: 1;
  promptPerMillionUsd: string;
  completionPerMillionUsd: string;
  requestUsd: string;
  imageUsd: string;
  evidenceSha256: string;
  sourceUrl: string;
};
export type ProviderTransport = (input: {
  request: Buffer;
  apiKey: string;
  timeoutMs: number;
  maxResponseBytes: number;
  signal?: AbortSignal;
}) => Promise<Buffer>;
