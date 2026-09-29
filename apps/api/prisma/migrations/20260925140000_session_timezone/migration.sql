-- NULL means the historical timezone was never captured. Preserve its UTC day allocation.
ALTER TABLE "ReadingSession" ADD COLUMN "timeZone" TEXT;
