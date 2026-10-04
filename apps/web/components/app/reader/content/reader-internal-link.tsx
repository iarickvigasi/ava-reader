import { activateInternalLink } from "@/features/reader/activate-internal-link";
import { useReaderMeasurement } from "./reader-measurement-context";
import type { ReactNode } from "react";
import type { ReaderLinkTarget } from "@/lib/api-types/reader-content";
import { useReaderNavigationActions } from "../state/reader-navigation-context";

export function ReaderInternalLink({
  target,
  sourceOffset = 0,
  children,
}: {
  target: ReaderLinkTarget;
  sourceOffset?: number;
  children: ReactNode;
}) {
  const measurement = useReaderMeasurement();
  const navigation = useReaderNavigationActions();
  return (
    <a
      href={
        measurement
          ? undefined
          : `#reader-${target.chapterId}-${target.blockId}`
      }
      role={target.note ? "doc-noteref" : undefined}
      className="underline decoration-line/60 underline-offset-4 hover:text-title"
      onClick={
        measurement
          ? undefined
          : (event) =>
              activateInternalLink(event, {
                target,
                sourceOffset,
                jump: navigation?.jump,
              })
      }
    >
      {children}
    </a>
  );
}
