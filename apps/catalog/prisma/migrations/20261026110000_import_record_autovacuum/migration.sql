-- Trigger cleanup around 102k updates and analyze around 180k at 15.45M rows.
-- Thresholds scale with table size; this changes scheduling, not vacuum capacity.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "public"."ImportRecord" SET (
  autovacuum_vacuum_threshold = 25000,
  autovacuum_vacuum_scale_factor = 0.005,
  autovacuum_analyze_threshold = 25000,
  autovacuum_analyze_scale_factor = 0.01
);
COMMIT;
