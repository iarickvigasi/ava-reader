import { fetchServerApiResult, ServerApiError } from "@/lib/server-api";
import {
  parseReportQuery,
  reportApiPath,
  type ReportQuery,
  type Search,
} from "./query";
import { parseReportResponse } from "./parse-response";
import type { ReportData, ReportState } from "./types";

type Request = (
  path: string,
) => Promise<
  | { status: "ready"; data: unknown }
  | { status: "authUnavailable" | "apiUnavailable" }
>;
export type LoadedReport = {
  state: ReportState;
  ownerId?: string;
  query?: ReportQuery;
  report?: ReportData;
};
export async function loadReport(
  search: Search,
  request: Request = fetchServerApiResult,
): Promise<LoadedReport> {
  let query: ReportQuery | null = null;
  try {
    const access = await request("/api/me");
    if (access.status !== "ready")
      return {
        state: access.status === "authUnavailable" ? "signIn" : "unavailable",
      };
    const user = access.data as {
      roles?: unknown;
      clerkUserId?: unknown;
    } | null;
    if (!user || !Array.isArray(user.roles) || !user.roles.includes("ADMIN"))
      return { state: "forbidden" };
    if (typeof user.clerkUserId !== "string") return { state: "invalid" };
    const ownerId = user.clerkUserId;
    try {
      query = parseReportQuery(search);
    } catch {
      return { state: "invalid", ownerId };
    }
    if (!query) return { state: "empty", ownerId };
    const response = await request(reportApiPath(query));
    if (response.status !== "ready")
      return {
        query,
        state:
          response.status === "authUnavailable"
            ? "accessChanged"
            : "unavailable",
      };
    try {
      return {
        state: "ready",
        ownerId,
        query,
        report: parseReportResponse(response.data, query),
      };
    } catch {
      return { state: "invalid", ownerId, query };
    }
  } catch (error) {
    const states: Record<number, ReportState> = {
      400: "invalid",
      401: "signIn",
      403: "forbidden",
      404: "missing",
      409: "changed",
      413: "tooLarge",
    };
    return {
      query: query ?? undefined,
      state:
        error instanceof ServerApiError
          ? (states[error.status] ?? "unavailable")
          : "unavailable",
    };
  }
}
