-- Keep writes available while indexing existing staged dumps. Do not wrap in a transaction.
CREATE INDEX CONCURRENTLY "ImportRecord_runId_kind_status_id_idx"
ON "ImportRecord" ("runId", "kind", "status", "id");
