"use client";

import { useExploreReturn } from "@/features/explore/use-explore-return";
import { catalogHref } from "@/features/explore/explore-return";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type BookAuthor = { name: string; id?: string };

export function BookAuthors({
  authors,
  className,
}: {
  authors: BookAuthor[];
  className?: string;
}) {
  const returnHref = useExploreReturn();
  if (!authors.length) return null;
  return (
    <p
      className={cn(
        "text-plum",
        className ?? "font-reader text-xl md:text-[1.75rem]",
      )}
    >
      {authors.map((author, index) => (
        <span key={author.id ?? `${author.name}-${index}`}>
          {index > 0 && ", "}
          {author.id ? (
            <Link
              className="transition hover:text-ink hover:underline"
              href={catalogHref(
                `/app/explore/authors/${author.id}`,
                returnHref,
              )}
            >
              {author.name}
            </Link>
          ) : (
            author.name
          )}
        </span>
      ))}
    </p>
  );
}
