import type { ReactNode } from "react";
import type { NoteRole } from "@/lib/api-types/canonical-reader.generated";

// DPUB-ARIA 1.1: endnotes use a collection with native list items; the singular
// doc-endnote role is deprecated. Labels remain outside selectable source text.
export function ReaderNoteSemantics({
  noteRole,
  children,
}: {
  noteRole?: NoteRole;
  children: ReactNode;
}) {
  return noteRole === "endnote" ? (
    <section
      role="doc-endnotes"
      aria-label="Endnotes"
      className="break-inside-avoid-column"
    >
      <ol role="list" className="m-0 list-none p-0">
        <li>{children}</li>
      </ol>
    </section>
  ) : (
    <aside role="doc-footnote" className="break-inside-avoid-column">
      {children}
    </aside>
  );
}
