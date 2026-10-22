"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { isOnline } from "@/features/offline/net/net-state";
import { withDeadline } from "./with-deadline";

export type LoginMessage =
  | "tryAgain"
  | "sendFailed"
  | "checkCode"
  | "finishFailed";

export function useLoginAction(initialNotice?: string) {
  const t = useTranslations("auth.shared.errors");
  const [message, setMessage] = useState(initialNotice);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  async function run(work: () => Promise<void>, failure: LoginMessage) {
    if (locked.current) return;
    if (!isOnline()) {
      setMessage(t("offline"));
      return;
    }
    locked.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      await withDeadline(work());
    } catch (error) {
      const key =
        error instanceof Error && error.message === "finishFailed"
          ? "finishFailed"
          : failure;
      setMessage(t(isOnline() ? key : "offline"));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return { message, busy, run, clear: () => setMessage(undefined) };
}
