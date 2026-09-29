"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useDatabaseAccess } from "./use-database-access";

export function DatabaseAccessGate({ children }: { children: ReactNode }) {
  const state = useDatabaseAccess();
  if (state === "ready") return children;
  if (state === "opening") return <p role="status">Opening your library…</p>;
  const update = state === "update-required";
  return (
    <main className="mx-auto max-w-lg space-y-4 p-6 text-ink" role="alert">
      <h1 className="font-reader text-2xl text-title">
        {update ? "Please update AVA Reader" : "Local storage is unavailable"}
      </h1>
      <p>
        {update
          ? "Your saved data requires a newer version of AVA Reader. Connect to the internet and reload to get the latest app. If you are offline, try again when connected."
          : "We could not open your saved library. Please try reloading the app."}
      </p>
      <p>Your saved data has not been cleared.</p>
      <Button onClick={() => window.location.reload()}>Reload app</Button>
    </main>
  );
}
