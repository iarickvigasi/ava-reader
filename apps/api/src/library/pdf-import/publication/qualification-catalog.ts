// Filled only after independent browser qualification of exact deployed source bytes.
// An empty catalog fails closed; requests and environment variables cannot add builds.
export type QualifiedReaderBuild = {
  readerBuildFingerprint: string;
  adapterFingerprint: string;
  reportSha256: string;
  capabilities: string[];
};
export const QUALIFIED_READER_BUILDS: readonly QualifiedReaderBuild[] = [];
