"use client";

// Drop-in replacement for `<Link href={getReaderHref(slug)}>` on any surface
// that opens the reader (book-info Read button, home "continue reading",
// engagement cover, …). Behaves identically online; when the user is
// offline AND the book hasn't been saved to Dexie, we intercept the click
// and surface the missing-book modal instead of letting the user land on
// an empty reader page.
//
// Cache state is read on mount + on libraryItemId change, so by the time
// the user clicks the link the answer is already in memory and the click
// handler stays synchronous. While the very first cache check is in flight
// we fall through to normal navigation; the reader's BookContextProvider
// will then emit the same modal as a fallback.

import Link from "next/link";
import {
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

import { hasBookContent } from "@/features/offline/buckets/book";
import { emitMissingBookOfflineModal } from "@/features/offline/missing-book-bus";
import { useNetworkState } from "@/features/offline/use-network-state";

type LinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick"
>;

type Props = LinkProps & {
  href: string;
  libraryItemId: string;
  children: ReactNode;
  // Pass through callbacks that callers might still want to fire even when
  // the navigation is intercepted (e.g., closing a menu). They run AFTER
  // the offline-cache decision has been made and the modal has been
  // dispatched if needed.
  onClickExtra?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export function ReadBookLink({
  href,
  libraryItemId,
  children,
  onClickExtra,
  ...rest
}: Props) {
  const online = useNetworkState();
  const [cached, setCached] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hasBookContent(libraryItemId).then((present) => {
      if (!cancelled) {
        setCached(present);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [libraryItemId]);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!online && cached === false) {
      event.preventDefault();
      emitMissingBookOfflineModal({ libraryItemId });
    }
    onClickExtra?.(event);
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
