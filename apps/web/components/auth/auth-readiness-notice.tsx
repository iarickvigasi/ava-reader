"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { AuthReadiness } from "@/features/auth/use-auth-readiness";
import type { AuthOperationState } from "@/features/auth/auth-operation";

type Props = {
  readiness: AuthReadiness;
  operation?: AuthOperationState;
  error?: string;
};

export function AuthReadinessNotice({
  readiness,
  operation = "idle",
  error,
}: Props) {
  const t = useTranslations("auth.shared.readiness");
  const state =
    operation === "timed-out"
      ? "timed-out"
      : readiness !== "ready"
        ? readiness
        : operation;
  if (state === "idle" && !error) return <span data-auth-readiness="ready" />;
  const key =
    state === "timed-out"
      ? "stalled"
      : state === "unavailable"
        ? "unavailable"
        : state === "pending"
          ? "pending"
          : "loading";
  const reload = state === "unavailable" || state === "timed-out";
  return (
    <div
      data-auth-readiness={state === "idle" ? "error" : state}
      role={error && !reload ? "alert" : "status"}
      className="rounded-card bg-surface p-4 text-sm text-copy"
    >
      <p>{reload || !error ? t(key) : error}</p>
      {reload && (
        <Button
          type="button"
          variant="soft"
          size="sm"
          className="mt-3"
          onClick={() => window.location.reload()}
        >
          {t("reload")}
        </Button>
      )}
    </div>
  );
}
