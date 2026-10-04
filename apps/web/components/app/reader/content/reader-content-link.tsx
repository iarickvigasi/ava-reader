import type { ReactNode } from "react";
import type { ReaderLinkTarget } from "@/lib/api-types/reader-content";
import { useReaderMeasurement } from "./reader-measurement-context";
import { ReaderInternalLink } from "./reader-internal-link";

export function ReaderContentLink({
  link,
  children,
}: {
  link: { href?: string; target?: ReaderLinkTarget; sourceOffset?: number };
  children: ReactNode;
}) {
  const measurement = useReaderMeasurement();
  if (link.target)
    return (
      <ReaderInternalLink target={link.target} sourceOffset={link.sourceOffset}>
        {children}
      </ReaderInternalLink>
    );
  return link.href ? (
    <a
      href={measurement ? undefined : link.href}
      className="underline decoration-line/60 underline-offset-4 hover:text-title"
    >
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}
