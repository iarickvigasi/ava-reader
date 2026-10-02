-- Prisma runs this once before API startup via db:migrate:deploy.
-- Stored subjects contain comma-separated text and numbered lists; no EPUB re-import needed.
-- Book includes both private imports and catalog entries, regardless of library membership.
WITH normalized AS (
  SELECT book."id", ARRAY(
    SELECT unique_tokens.token
    FROM (
      SELECT DISTINCT ON (lower(trimmed.token))
        trimmed.token, subject.position AS subject_position, part.position AS part_position
      FROM unnest(book."genres") WITH ORDINALITY AS subject(value, position)
      CROSS JOIN LATERAL (
        SELECT regexp_replace(subject.value, '^\s+|\s+$', '', 'g') AS value,
          subject.value ~ '^\s*\d+\.\s+' AND subject.value ~ '\S\s+\d+\.\s+' AS numbered
      ) AS source
      CROSS JOIN LATERAL regexp_split_to_table(source.value,
        CASE WHEN source.numbered THEN ',|\s+(--|-)\s+|(^|\s+)\d+\.\s+'
          ELSE ',|\s+(--|-)\s+' END)
        WITH ORDINALITY AS part(value, position)
      CROSS JOIN LATERAL (
        SELECT regexp_replace(part.value, '^\s+|\s+$', '', 'g') AS token
      ) AS clean
      CROSS JOIN LATERAL (
        SELECT CASE WHEN source.numbered
          THEN regexp_replace(clean.token, '\s*\.$', '', 'g')
          ELSE clean.token END AS token
      ) AS trimmed
      WHERE trimmed.token <> ''
      ORDER BY lower(trimmed.token), subject.position, part.position
    ) AS unique_tokens
    ORDER BY unique_tokens.subject_position, unique_tokens.part_position
  ) AS genres
  FROM "Book" AS book
)
UPDATE "Book" AS book
SET "genres" = normalized.genres, "updatedAt" = CURRENT_TIMESTAMP
FROM normalized
WHERE book."id" = normalized."id"
  AND book."genres" IS DISTINCT FROM normalized.genres;
