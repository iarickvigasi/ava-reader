"use client";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { beginReportRead } from "@/features/admin/pdf-reports/read-client";
import type { LoadedReport } from "@/features/admin/pdf-reports/load-report";
import type { Search } from "@/features/admin/pdf-reports/query";
import { ReportSearchForm } from "./search-form";
import { ReportStateNotice } from "./state-notice";
import { ReportResult } from "./result";

export function ReportClient({
  search,
  invalidSearch = false,
}: {
  search: Search;
  invalidSearch?: boolean;
}) {
  const auth = useAuth();
  const key = JSON.stringify([auth.userId, auth.sessionId, search]);
  const [loaded, setLoaded] = useState<{ key: string; result: LoadedReport }>();
  useEffect(() => {
    if (!auth.isLoaded || !auth.isSignedIn || !auth.userId) return;
    return beginReportRead(search, auth.userId, (result) =>
      setLoaded({ key, result }),
    );
  }, [auth.isLoaded, auth.isSignedIn, auth.userId, key, search]);
  if (!auth.isLoaded) return <p role="status">Checking operator session…</p>;
  if (!auth.isSignedIn) return <ReportStateNotice state="signIn" />;
  if (!loaded || loaded.key !== key)
    return <p role="status">Loading conversion report…</p>;
  const result: LoadedReport =
    invalidSearch && loaded.result.state === "empty"
      ? { state: "invalid" }
      : loaded.result;
  return (
    <>
      {!["signIn", "forbidden", "accessChanged"].includes(result.state) && (
        <ReportSearchForm />
      )}
      {result.state !== "ready" ? (
        <ReportStateNotice state={result.state} query={result.query} />
      ) : (
        result.query &&
        result.report && (
          <ReportResult query={result.query} report={result.report} />
        )
      )}
    </>
  );
}
