import { ServiceUnavailableException } from '@nestjs/common';
import { checksumBuffer } from '../../../shared/blob-utils';
import { contractSchemas } from '../../../pdf-conversion/contracts/generated/schemas';
import type {
  ContractName,
  SemanticValidator,
} from '../../../pdf-conversion/contracts/types';
import { validateContract } from '../../../pdf-conversion/contracts/validate-contract';

export type ReaderSemanticValidator = SemanticValidator & {
  // Opt in only when this identity describes the validator's version/configuration.
  validationIdentity?: () => string | null | Promise<string | null>;
};
type Scope = {
  actualSha256: string;
  byteLength: number;
  adapterFingerprint: string;
  readerBuildFingerprint: string;
};
const schemaDigests = Object.fromEntries(
  Object.entries(contractSchemas).map(([name, schema]) => [
    name,
    checksumBuffer(Buffer.from(JSON.stringify(schema))),
  ]),
);
const limits = {
  maxEntries: 64,
  maxBytes: 256 * 1024 * 1024,
  ttlMs: 5 * 60 * 1000,
  maxInFlight: 2,
  maxInFlightBytes: 128 * 1024 * 1024,
};

// Only successful semantic results are retained, never bytes or parsed graphs.
// Bytes still load/hash/parse/validate structurally on every accepted-reader request.
export class ReaderValidationCache {
  private readonly limits: typeof limits;
  private readonly hits = new Map<
    string,
    { bytes: number; expiresAt: number }
  >();
  private readonly pending = new Map<string, Promise<boolean>>();
  private readonly semanticIds = new WeakMap<SemanticValidator, number>();
  private nextSemanticId = 0;
  private bytes = 0;
  private inFlightBytes = 0;

  constructor(
    overrides: Partial<typeof limits> = {},
    private readonly now: () => number = Date.now,
  ) {
    this.limits = { ...limits, ...overrides };
  }

  async validate<K extends ContractName>(
    name: K,
    bytes: Buffer,
    semantic: ReaderSemanticValidator,
    scope: Scope,
  ) {
    // Reserve before validateContract snapshots/parses another caller's graph.
    this.admit(bytes.length);
    try {
      return await validateContract(
        name,
        bytes,
        this.semanticFor(
          semantic,
          { ...scope, byteLength: bytes.length },
          false,
        ),
      );
    } finally {
      this.inFlightBytes -= bytes.length;
    }
  }

  semanticFor(
    semantic: ReaderSemanticValidator,
    scope: Scope,
    reserve = true,
  ): SemanticValidator {
    if (!semantic.validationIdentity) return semantic;
    let id = this.semanticIds.get(semantic);
    if (id === undefined) {
      id = ++this.nextSemanticId;
      this.semanticIds.set(semantic, id);
    }
    const semanticId = id;
    return async (name, payload, wireJson) => {
      // Every caller retains its own parsed graph, including coalesced waiters.
      if (reserve) this.admit(scope.byteLength);
      try {
        const identity = await semantic.validationIdentity!();
        if (!identity) return await semantic(name, payload, wireJson);
        const key = JSON.stringify([
          name,
          schemaDigests[name],
          semanticId,
          identity,
          scope,
        ]);
        for (const [expiredKey, hit] of this.hits)
          if (hit.expiresAt <= this.now()) this.remove(expiredKey);
        const hit = this.hits.get(key);
        if (hit) {
          this.hits.delete(key);
          this.hits.set(key, hit);
          return true;
        }
        const existing = this.pending.get(key);
        if (existing) return await existing;
        if (this.pending.size >= this.limits.maxInFlight)
          throw new ServiceUnavailableException('Reader validation is busy.');
        const validation = semantic(name, payload, wireJson).then(
          async (valid) => {
            // Never retain an outcome across a validator update while it was pending.
            if (
              valid &&
              identity === (await semantic.validationIdentity!()) &&
              scope.byteLength <= this.limits.maxBytes
            ) {
              this.hits.set(key, {
                bytes: scope.byteLength,
                expiresAt: this.now() + this.limits.ttlMs,
              });
              this.bytes += scope.byteLength;
              while (
                this.hits.size > this.limits.maxEntries ||
                this.bytes > this.limits.maxBytes
              ) {
                const oldest = this.hits.keys().next();
                if (oldest.done) break;
                this.remove(oldest.value);
              }
            }
            return valid;
          },
        );
        this.pending.set(key, validation);
        try {
          return await validation;
        } finally {
          if (this.pending.get(key) === validation) this.pending.delete(key);
        }
      } finally {
        if (reserve) this.inFlightBytes -= scope.byteLength;
      }
    };
  }

  private admit(bytes: number) {
    if (this.inFlightBytes + bytes > this.limits.maxInFlightBytes)
      throw new ServiceUnavailableException('Reader validation is busy.');
    this.inFlightBytes += bytes;
  }

  private remove(key: string) {
    const hit = this.hits.get(key);
    if (hit) this.bytes -= hit.bytes;
    this.hits.delete(key);
  }
}
export const acceptedReaderValidationCache = new ReaderValidationCache();
