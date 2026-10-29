import Link from "next/link";
import type { ReactNode } from "react";

export function FeaturedEditionLink({
  editionId,
  children,
}: {
  editionId?: string | null;
  children: ReactNode;
}) {
  if (!editionId) return <>{children}</>;
  return (
    <Link
      className="block"
      href={`/app/explore/editions/${encodeURIComponent(editionId)}`}
    >
      {children}
    </Link>
  );
}
