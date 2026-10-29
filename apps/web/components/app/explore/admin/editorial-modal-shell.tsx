import { useId, type ReactNode } from "react";
import { ModalShell } from "@/components/app/library/collection/collection-actions/modal-shell";

export function EditorialModalShell({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const titleId = useId();
  return (
    <ModalShell onClose={close} labelledBy={titleId}>
      <section className="space-y-6 rounded-modal bg-paper p-6 shadow-(--shadow-card)">
        <h2
          id={titleId}
          className="font-reader text-[1.75rem] leading-[1.1] text-title"
        >
          {title}
        </h2>
        {children}
      </section>
    </ModalShell>
  );
}
