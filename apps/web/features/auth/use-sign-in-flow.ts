"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLocallySignedOut } from "./local-sign-out";
import { useOfflineLogin } from "./use-offline-login";
import { useLoginAction, type LoginMessage } from "./use-login-action";
import { useEmailSignIn } from "./use-email-sign-in";
import { startGoogleSignIn } from "./start-google-sign-in";

export function useSignInFlow(initialNotice?: string) {
  const { signIn, fetchStatus } = useSignIn();
  const { isSignedIn, userId, sessionId } = useAuth();
  const signedIn = isSignedIn && !isLocallySignedOut(userId ?? null, sessionId);
  const online = useOfflineLogin();
  const router = useRouter();
  const action = useLoginAction(initialNotice);
  useEffect(() => {
    if (signedIn) router.replace("/app");
  }, [signedIn, router]);
  async function finalize() {
    const result = await signIn.finalize({
      navigate: async ({ decorateUrl, session }) => {
        if (session?.currentTask) throw new Error("finishFailed");
        router.replace(decorateUrl("/app"));
      },
    });
    if (result.error) throw new Error("finishFailed");
  }
  const email = useEmailSignIn(signIn, finalize);
  const run = (work: () => Promise<void>, failure: LoginMessage) => () =>
    void action.run(work, failure);
  return {
    ...email,
    signedIn,
    online,
    message: action.message,
    busy: action.busy || fetchStatus === "fetching",
    google: run(() => startGoogleSignIn(signIn), "tryAgain"),
    request: run(email.request, "sendFailed"),
    verify: run(email.verify, "checkCode"),
    resend: run(email.resend, "sendFailed"),
    openEmail: () => {
      action.clear();
      email.setPhase("email");
    },
    back: () => {
      action.clear();
      email.setPhase(email.phase === "code" ? "email" : "idle");
    },
  };
}
