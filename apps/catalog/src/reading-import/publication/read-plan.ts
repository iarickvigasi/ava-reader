import { readFile, stat } from 'node:fs/promises';
import type { Approval, PublicationBook } from './types';
export async function readPublicationPlan(path: string) {
  if ((await stat(path)).size > 8 * 1024 * 1024)
    throw new Error('Plan exceeds 8 MiB');
  const plan = JSON.parse(await readFile(path, 'utf8')) as {
    version: number;
    books: PublicationBook[];
  };
  if (
    plan.version !== 1 ||
    !Array.isArray(plan.books) ||
    plan.books.length > 300
  )
    throw new Error('Expected version 1 and at most 300 books');
  const seen = new Set<string>();
  const approvals: Approval[] = [];
  for (const book of plan.books) {
    if (!book || typeof book.id !== 'string' || !book.id || seen.has(book.id))
      throw new Error('Missing or duplicate book id');
    seen.add(book.id);
    if (book.publication === null || book.publication === undefined) continue;
    const a = book.publication;
    const r = a.review;
    if (
      a.status !== 'APPROVED' ||
      !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(a.editionId ?? '') ||
      !/^[a-f\d]{64}$/.test(a.checksum ?? '') ||
      !r ||
      r.sha256 !== a.checksum ||
      r.rightsConfirmed !== true ||
      r.qualityConfirmed !== true ||
      [r.rightsStatement, r.rightsUrl, r.rightsJurisdiction, r.notes].some(
        (v) => typeof v !== 'string' || !v.trim() || v.length > 4000,
      )
    )
      throw new Error(`Incomplete exact-file approval: ${book.id}`);
    if (new URL(r.rightsUrl).protocol !== 'https:')
      throw new Error('Evidence must use HTTPS');
    if (approvals.some((old) => old.editionId === a.editionId))
      throw new Error('Duplicate edition approval');
    approvals.push(a);
  }
  return { approvals, skipped: plan.books.length - approvals.length };
}
