"use client";

// Drop-in replacement for `<Link href={getReaderHref(slug)}>` on any surface
// that opens the reader (book-info Read button, home "continue reading",
// engagement cover, …). Behaves identically online; when the user is offline
// AND the book isn't saved to Dexie, we intercept the click and surface the
// missing-book modal instead of letting the user land on an empty reader page.
//
// The offline cache state is read FRESH on each click (see
// read-book-link-action)

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type AnchorHTMLAttributes, type ReactNode } from "react";

import { hasBookContent } from "@/features/offline/buckets/book";
import { emitMissingBookOfflineModal } from "@/features/offline/notices/missing-book-bus";
import { useNetworkState } from "@/features/offline/net/use-network-state";

import { resolveOfflineReadAction } from "./read-book-link-action";

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
  const router = useRouter();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClickExtra?.(event);
    // Let the browser/Next handle online navigation and modified clicks
    // (new tab, etc.) natively; only guard a plain offline left-click.
    if (
      event.defaultPrevented ||
      online ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    // Offline: block the native navigation and decide against the CURRENT
    // cache state. If the book is cached (possibly cached by the primer after
    // this link mounted), navigate; otherwise show the missing-book modal.
    event.preventDefault();
    void resolveOfflineReadAction(libraryItemId, hasBookContent).then(
      (action) => {
        if (action === "navigate") {
          router.push(href);
        } else {
          emitMissingBookOfflineModal({ libraryItemId });
        }
      },
    );
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
