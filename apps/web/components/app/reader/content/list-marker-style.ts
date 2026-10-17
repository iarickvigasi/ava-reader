import type { CSSProperties } from "react";
import type { ReaderListItem } from "@/lib/api-types/reader-content";
import { canonicalStyle } from "@/features/reader/canonical/style";
import { sourceForeground } from "@/features/reader/canonical/source-color";
import classes from "./list-marker-style.module.css";

export function listMarkerProps(item: ReaderListItem) {
  const marker = item.markerPresentation;
  if (!marker) return {};
  const style = canonicalStyle(marker);
  // Assign every variable at this item so a styled child with unknown properties
  // cannot inherit a parent's marker overrides. Unstyled items have no selector.
  return {
    className: classes.marker,
    "data-reader-marker-style": marker.id,
    style: {
      "--reader-marker-color":
        marker.color == null ? "initial" : sourceForeground(marker.color),
      "--reader-marker-family": style.fontFamily ?? "initial",
      "--reader-marker-weight": style.fontWeight ?? "initial",
      "--reader-marker-style": style.fontStyle ?? "initial",
      "--reader-marker-variant": style.fontVariant ?? "initial",
      "--reader-marker-size": style.fontSize ?? "initial",
    } as CSSProperties,
  };
}
