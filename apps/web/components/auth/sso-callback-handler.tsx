"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export function SsoCallbackHandler() {
  const clerk = useClerk();
  const router = useRouter();
  const hasRun = useRef(false);
  const [message, setMessage] = useState("Finishing Google authentication...");

  useEffect(() => {
    const completeFlow = async () => {
      if (!clerk.loaded || hasRun.current) {
        return;
      }

      hasRun.current = true;

      try {
        await clerk.handleRedirectCallback(
          {
            signInUrl: "/sign-in",
            signUpUrl: "/sign-up",
            firstFactorUrl: "/sign-in?notice=oauth_continue",
            secondFactorUrl: "/sign-in?notice=oauth_continue",
            continueSignUpUrl: "/sign-up?notice=oauth_requirements",
            signInForceRedirectUrl: "/app",
            signUpForceRedirectUrl: "/app",
            transferable: true,
          },
          async (target) => {
            router.replace(target);
          },
        );
      } catch {
        setMessage(
          "Google authentication could not be completed. Return to sign in and try again.",
        );

        window.setTimeout(() => {
          router.replace("/sign-in?notice=oauth_continue");
        }, 1000);
      }
    };

    void completeFlow();
  }, [clerk, router]);

  return (
    <AuthShell title="Just a moment" subtitle={message}>
      <div className="rounded-[var(--radius-card)] border border-line bg-white/68 px-5 py-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-line border-t-ink" />
      </div>
    </AuthShell>
  );
}
