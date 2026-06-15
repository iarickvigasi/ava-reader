"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getPublicApiBaseUrl } from "@/lib/api";

type CurrentUserPayload = {
  id: string;
  clerkUserId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type BootstrapState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; user: CurrentUserPayload };

export function AppBootstrapPanel() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [state, setState] = useState<BootstrapState>({ status: "loading" });
  const [isPending, startTransition] = useTransition();

  const loadCurrentUser = useEffectEvent(async () => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    setState({ status: "loading" });
    const token = await getToken();

    if (!token) {
      setState({
        status: "error",
        message: "A session token was not available for the API request.",
      });
      return;
    }

    const response = await fetch(`${getPublicApiBaseUrl()}/api/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      setState({
        status: "error",
        message:
          payload?.message ??
          "The API could not bootstrap the current user record.",
      });
      return;
    }

    const currentUser = (await response.json()) as CurrentUserPayload;
    setState({ status: "ready", user: currentUser });
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    void loadCurrentUser();
  }, [isLoaded, isSignedIn]);

  return (
    <section className="rounded-shell bg-surface px-6 py-7 sm:px-8 sm:py-9">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.28em] text-muted">
            Protected app shell
          </p>
          <h1 className="font-display text-4xl leading-none text-ink sm:text-5xl">
            /app
          </h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-card bg-white/65 p-5">
            <p className="text-sm uppercase tracking-[0.22em] text-muted">
              API bootstrap
            </p>

            {state.status === "loading" ? (
              <p className="mt-4 text-lg text-copy">
                Loading the current user from Nest...
              </p>
            ) : null}

            {state.status === "error" ? (
              <div className="mt-4 space-y-3">
                <p className="text-lg text-danger">{state.message}</p>
                <p className="text-sm text-copy">
                  Check your Clerk keys and the Nest API configuration.
                </p>
              </div>
            ) : null}

            {state.status === "ready" ? (
              <dl className="mt-4 space-y-4 text-left">
                <div>
                  <dt className="text-xs uppercase tracking-[0.22em] text-muted">
                    Display name
                  </dt>
                  <dd className="mt-1 text-xl text-copy-strong">
                    {state.user.displayName ?? "Reader"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.22em] text-muted">
                    Email
                  </dt>
                  <dd className="mt-1 text-base text-copy">{state.user.email}</dd>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.22em] text-muted">
                      Local ID
                    </dt>
                    <dd className="mt-1 break-all text-sm text-copy">
                      {state.user.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.22em] text-muted">
                      Clerk user
                    </dt>
                    <dd className="mt-1 break-all text-sm text-copy">
                      {state.user.clerkUserId}
                    </dd>
                  </div>
                </div>
              </dl>
            ) : null}
          </article>

          <article className="rounded-card bg-white/65 p-5">
            <p className="text-sm uppercase tracking-[0.22em] text-muted">
              Session
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-paper-strong">
                {user?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={user.fullName ?? "Signed-in user"}
                    className="h-full w-full object-cover"
                    src={user.imageUrl}
                  />
                ) : (
                  <span className="font-display text-2xl text-ink">A</span>
                )}
              </div>
              <div>
                <p className="text-lg text-copy-strong">
                  {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Active session"}
                </p>
                <p className="text-sm text-copy">
                  Clerk is the auth source of truth.
                </p>
              </div>
            </div>
            <div className="mt-6">
              <Button
                type="button"
                variant="soft"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => {
                    void signOut({ redirectUrl: "/sign-in?notice=signed_out" });
                  })
                }
              >
                {isPending ? "Signing out..." : "Sign out"}
              </Button>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
