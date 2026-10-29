-- Kept outside an explicit transaction for populated metadata installations.
CREATE INDEX CONCURRENTLY "ImportRecord_externalId_payloadHash_idx"
ON "ImportRecord" ("externalId", "payloadHash");
