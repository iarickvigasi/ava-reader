import { Button, ButtonLink } from "@/components/ui/button";
import { reportReturnTarget } from "@/features/admin/pdf-reports/auth-return";
import type { ReportState } from "@/features/admin/pdf-reports/types";
import {
  REPORT_ROUTE,
  reportHref,
  type ReportQuery,
} from "@/features/admin/pdf-reports/query";

const messages: Record<Exclude<ReportState, "ready">, string> = {
  empty: "Find a saved conversion or admission refusal by its reference.",
  signIn: "Sign in with your authorized AVA operator account to read reports.",
  forbidden:
    "Admin access is required. An ordinary reader or developer membership does not grant report access.",
  accessChanged:
    "Your session or admin access changed. Sign in again before reading this report.",
  unavailable:
    "Reports are unavailable. Check your connection, then try again. No saved report is shown offline.",
  missing: "No investigation was found for this reference.",
  invalid:
    "The reference, page cursor, or returned report could not be verified. Start with the original reference again.",
  changed:
    "The cost projection changed. Open the cost view from its first page again.",
  tooLarge:
    "This export exceeds the report page limit. Read the timeline and cost pages separately.",
};
export function ReportStateNotice({
  state,
  query,
  onRetry,
}: {
  state: Exclude<ReportState, "ready">;
  query?: ReportQuery;
  onRetry?: () => void;
}) {
  return (
    <div className="space-y-3">
      <p role={state === "empty" ? "status" : "alert"}>
        {onRetry && state === "signIn"
          ? "Your operator session could not be verified. Retry this report or sign in again."
          : messages[state]}
      </p>
      {["signIn", "accessChanged"].includes(state) && (
        <ButtonLink
          href={`/sign-in?redirect_url=${encodeURIComponent(reportReturnTarget(query ? reportHref(query) : REPORT_ROUTE))}`}
          size="sm"
        >
          Sign in
        </ButtonLink>
      )}
      {onRetry && ["signIn", "accessChanged"].includes(state) && (
        <Button type="button" onClick={onRetry} size="sm" variant="soft">
          Retry report
        </Button>
      )}
      {query && ["changed", "invalid", "unavailable"].includes(state) && (
        <a
          href={reportHref({
            ...query,
            eventCursor: undefined,
            costCursor: undefined,
          })}
          className="inline-flex min-h-10 items-center underline"
        >
          Start this view again
        </a>
      )}
    </div>
  );
}
