# Catalog category maintenance

Set `CATALOG_DATABASE_URL` explicitly. Run `pnpm --filter catalog categories:rebuild` for a dry-run
over retained work subjects. Review counts and examples; append `--apply` to update derived
categories in bounded transactions. Production builds expose `categories:rebuild:prod`.

Revision conflicts leave that work unchanged, increment the conflict count, and produce a nonzero
exit status; rerun after concurrent metadata writes finish. Successful writes increment the work
revision, preserve source-managed revision ownership, and add an outbox event atomically.

Matching rules are code-reviewed explicit aliases. Unsupported or ambiguous labels stay unknown.
No old substring fallback or upload-specific setup runs. No book files are touched.
