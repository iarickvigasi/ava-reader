import { useState } from "react";
import type { useSignUp } from "@clerk/nextjs";

type SignUp = ReturnType<typeof useSignUp>["signUp"];

export function useEmailSignUp(
  signUp: SignUp,
  finalize: () => Promise<void>,
  incomplete: () => void,
) {
  const [phase, setPhase] = useState<"idle" | "email" | "code">("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  async function request() {
    const { error } = await signUp.create({ emailAddress: email });
    if (error) return;
    const result = await signUp.verifications.sendEmailCode();
    if (!result.error) setPhase("code");
  }
  async function verify() {
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) return;
    if (signUp.status === "complete") await finalize();
    else incomplete();
  }
  async function resend() {
    await signUp.verifications.sendEmailCode();
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
