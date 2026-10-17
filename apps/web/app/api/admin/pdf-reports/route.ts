import { loadReport } from "@/features/admin/pdf-reports/load-report";
import type { Search } from "@/features/admin/pdf-reports/query";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const search: Search = Object.create(null);
  for (const [key, value] of new URL(request.url).searchParams) {
    const prior = search[key];
    search[key] =
      prior === undefined
        ? value
        : [...(Array.isArray(prior) ? prior : [prior]), value];
  }
  const result = await loadReport(search);
  const status =
    result.state === "signIn" ? 401 : result.state === "forbidden" ? 403 : 200;
  return Response.json(result, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
