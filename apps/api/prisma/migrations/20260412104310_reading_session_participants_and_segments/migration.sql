DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class AS c
        JOIN pg_namespace AS n ON n.oid = c.relnamespace
        WHERE c.relkind = 'i'
          AND n.nspname = CURRENT_SCHEMA()
          AND c.relname = 'ReadingSessionParticipant_readingSessionId_stoppedAt_lastSeenAt'
    ) THEN
        ALTER INDEX "ReadingSessionParticipant_readingSessionId_stoppedAt_lastSeenAt"
            RENAME TO "ReadingSessionParticipant_readingSessionId_stoppedAt_lastSe_idx";
    END IF;
END
$$;
