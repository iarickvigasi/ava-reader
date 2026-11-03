export type CheckpointRequest = {
  clientSessionId: string;
  startedAt: string;
  checkpointAt: string;
  timeZone: string;
  revision: number;
  endedAt: string | null;
};

export type ReadingCheckpoint = {
  clientSessionId: string;
  startedAt: Date;
  checkpointAt: Date;
  timeZone: string;
  revision: number;
  durationSeconds: number;
  endedAt: Date | null;
};
