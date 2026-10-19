"use client";
import { useMemo, useState } from "react";
import type { CanonicalBookV2 } from "@/lib/api-types/canonical-reader.generated";
export function CandidateText({ book }: { book: CanonicalBookV2 }) {
  const [chapterId, setChapter] = useState(book.spine[0]);
  const [page, setPage] = useState(0);
  const index = useMemo(
    () => new Map(book.blocks.map((block) => [block.id, block])),
    [book],
  );
  const chapter = book.chapters.find((item) => item.id === chapterId);
  const blocks =
    chapter?.block_ids.flatMap((id) => {
      const value = index.get(id);
      return value ? [value] : [];
    }) ?? [];
  return (
    <section className="space-y-4" aria-label="Candidate source text">
      <h3 className="text-xl font-semibold">Candidate text</h3>
      <label className="flex flex-col gap-2">
        Chapter
        <select
          value={chapterId}
          onChange={(event) => {
            setChapter(event.target.value);
            setPage(0);
          }}
          className="rounded-control border border-line p-2"
        >
          {book.spine.map((id) => (
            <option key={id} value={id}>
              {book.chapters.find((c) => c.id === id)?.title ?? id}
            </option>
          ))}
        </select>
      </label>
      <ol className="space-y-5">
        {blocks.slice(page * 40, (page + 1) * 40).map((block) => (
          <li key={block.id} className="border-l-2 border-line pl-4">
            <p className="mb-1 text-xs text-muted">
              {block.kind} · Source page{" "}
              {Array.from(new Set(block.evidence.map((e) => e.page))).join(
                ", ",
              )}
            </p>
            {"content" in block ? (
              <p className="whitespace-pre-wrap">{block.content.text}</p>
            ) : block.kind === "table" ? (
              <table className="w-full">
                <tbody>
                  {Array.from(new Set(block.cells.map((c) => c.row))).map(
                    (row) => (
                      <tr key={row}>
                        {block.cells
                          .filter((c) => c.row === row)
                          .map((cell) => (
                            <td
                              key={cell.id}
                              className="border border-line p-2"
                            >
                              {cell.content.text}
                            </td>
                          ))}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            ) : block.kind === "figure" ? (
              <p>Illustration: {block.alt || block.resource_id}</p>
            ) : (
              <hr />
            )}
          </li>
        ))}
      </ol>
      <nav
        className="flex items-center gap-4"
        aria-label="Candidate text pages"
      >
        <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(blocks.length / 40))}
        </span>
        <button
          disabled={(page + 1) * 40 >= blocks.length}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </nav>
    </section>
  );
}
