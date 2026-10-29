import type { ReactNode } from "react";
import type { CatalogText } from "@/lib/catalog-types";
import { cn } from "@/lib/cn";
import { CatalogDescription } from "./catalog-description";
export function CatalogDetailsSection({
  texts,
  children,
}: {
  texts: CatalogText[];
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid gap-10 border-t border-line/30 pt-10 lg:gap-12 lg:pt-14",
        texts.length
          ? "lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]"
          : "lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]",
      )}
    >
      {texts.length > 0 && <CatalogDescription texts={texts} />}
      <aside className="space-y-4">{children}</aside>
    </section>
  );
}
