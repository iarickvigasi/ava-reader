import Link from "next/link";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { BrandWordmark } from "@/components/brand/brand-wordmark";

function navButtonClassName(tone: "primary" | "soft") {
  if (tone === "primary") {
    return "inline-flex min-h-11 items-center justify-center rounded-[14px] border border-brand-fill bg-brand-fill px-4 text-sm font-medium text-brand-foreground shadow-[var(--shadow-card)] transition hover:bg-brand-fill-strong";
  }

  return "inline-flex min-h-11 items-center justify-center rounded-[14px] border border-line bg-white/70 px-4 text-sm font-medium text-ink transition hover:bg-white";
}

export function ClerkNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/88 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-end gap-3">
          <BrandWordmark
            variant="compact"
            className="text-[2.3rem] sm:text-[2.7rem]"
          />
          <span className="pb-[0.35rem] font-display text-lg tracking-[-0.03em] text-title">
            Reader
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton mode="redirect">
              <button type="button" className={navButtonClassName("soft")}>
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <button type="button" className={navButtonClassName("primary")}>
                Create account
              </button>
            </SignUpButton>
          </Show>

          <Show when="signed-in">
            <div className="flex items-center gap-3">
              <Link
                href="/app"
                className="text-sm font-medium text-copy transition hover:text-ink"
              >
                Open app
              </Link>
              <UserButton />
            </div>
          </Show>
        </div>
      </div>
    </header>
  );
}
