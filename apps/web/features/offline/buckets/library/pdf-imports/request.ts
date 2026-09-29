import { getPublicApiBaseUrl } from "@/lib/api";
import { getDb, type AvaReaderDB } from "../../../db";
import type { GetToken } from "./types";

export async function pdfImportRequest(
  db: AvaReaderDB,
  getToken: GetToken,
  path: string,
  init?: RequestInit,
) {
  const token = await getToken();
  if (!token || db !== getDb()) throw new Error("ACCOUNT_UNAVAILABLE");
  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/library/pdf-imports${path}`,
    {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    },
  );
  if (db !== getDb()) throw new Error("ACCOUNT_CHANGED");
  return response;
}
