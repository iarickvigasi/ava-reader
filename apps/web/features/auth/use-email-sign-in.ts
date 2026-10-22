"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";

type SignIn = ReturnType<typeof useSignIn>["signIn"];
type Result = { error: unknown };

export function useEmailSignIn(signIn: SignIn, finalize: () => Promise<void>) {
  const [phase, setPhase] = useState<"idle" | "email" | "code">("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  async function request() {
    assertSuccess(await signIn.create({ identifier: email }));
    assertSuccess(await signIn.emailCode.sendCode());
    setCode("");
    setPhase("code");
  }
  async function verify() {
    assertSuccess(await signIn.emailCode.verifyCode({ code }));
    if (signIn.status !== "complete")
      throw new Error("Sign-in needs more steps");
    await finalize();
  }
  async function resend() {
    if (signIn.firstFactorVerification.status === "expired") {
      assertSuccess(await signIn.reset());
      await request();
    } else {
      assertSuccess(await signIn.emailCode.sendCode());
      setCode("");
    }
  }
  return {
    phase,
    setPhase,
    email,
    setEmail,
    code,
    setCode,
    request,
    verify,
    resend,
  };
}

function assertSuccess(result: Result) {
  if (result.error) throw result.error;
}
