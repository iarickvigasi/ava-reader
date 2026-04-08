"use client";

import dynamic from "next/dynamic";

const ClerkUserButton = dynamic(
  () => import("@clerk/nextjs").then((module) => module.UserButton),
  {
    ssr: false,
    loading: () => <div className="size-8 rounded-full bg-soft-fill" aria-hidden="true" />,
  },
);

export function UserMenuButton() {
  return <ClerkUserButton />;
}
