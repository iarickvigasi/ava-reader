import {
  WORKER_OBSERVATION_BYTES,
  WORKER_OBSERVATION_PREFIX,
} from './worker-observation';

// Only one reserved line has a separate observational allowance. All other
// stderr retains its original limit, including duplicate reserved lines.
export function workerStderr(observations = false) {
  const prefix = Buffer.from(WORKER_OBSERVATION_PREFIX);
  const ordinary: number[] = [],
    candidate: number[] = [],
    probe: number[] = [];
  let mode: 'probe' | 'ordinary' | 'candidate' = 'probe';
  let total = 0,
    reserved = 0,
    malformed = false,
    pendingNewline = false,
    exhausted = false;
  const appendOrdinary = (byte: number) => {
    if (ordinary.length === 8192) {
      exhausted = true;
      return false;
    }
    ordinary.push(byte);
    return true;
  };
  return {
    append(chunk: Buffer) {
      for (const byte of chunk) {
        if (++total > 8192 + (observations ? WORKER_OBSERVATION_BYTES : 0)) {
          exhausted = true;
          return false;
        }
        if (!observations) {
          if (!appendOrdinary(byte)) return false;
          continue;
        }
        if (mode === 'probe') {
          probe.push(byte);
          if (byte !== prefix[probe.length - 1]) {
            if (pendingNewline && !appendOrdinary(10)) return false;
            pendingNewline = byte === 10;
            for (const pending of byte === 10 ? probe.slice(0, -1) : probe)
              if (!appendOrdinary(pending)) return false;
            probe.length = 0;
            mode = byte === 10 ? 'probe' : 'ordinary';
          } else if (probe.length === prefix.length) {
            reserved++;
            if (reserved === 1) {
              if (pendingNewline) candidate.push(10);
              candidate.push(...probe);
              mode = 'candidate';
            } else {
              malformed = true;
              if (pendingNewline && !appendOrdinary(10)) return false;
              for (const pending of probe)
                if (!appendOrdinary(pending)) return false;
              mode = 'ordinary';
            }
            pendingNewline = false;
            probe.length = 0;
          }
        } else if (mode === 'candidate') {
          if (candidate.length < WORKER_OBSERVATION_BYTES) candidate.push(byte);
          else {
            malformed = true;
            if (!appendOrdinary(byte)) return false;
          }
          if (byte === 10) mode = 'probe';
        } else {
          if (byte === 10) {
            pendingNewline = true;
            mode = 'probe';
          } else if (!appendOrdinary(byte)) return false;
        }
      }
      return true;
    },
    finish() {
      if (pendingNewline) appendOrdinary(10);
      for (const byte of probe) if (!appendOrdinary(byte)) break;
      probe.length = 0;
      if (mode === 'candidate') malformed = true;
      return {
        stderr: Buffer.from(ordinary).toString('utf8'),
        exhausted,
        observationStderr: candidate.length
          ? Buffer.from(candidate).toString('utf8')
          : undefined,
        observationMalformed: malformed,
      };
    },
  };
}
