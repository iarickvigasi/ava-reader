import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
import { isReportHandshakeCleanup } from "@/features/admin/pdf-reports/handshake-cleanup";

const authenticate = clerkMiddleware();

// Clerk can handshake-redirect before its custom handler runs. App shells must
// survive that path too; server API helpers treat missing auth context as null.
export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  const appShell =
    request.nextUrl.pathname === "/app" ||
    request.nextUrl.pathname.startsWith("/app/");
  try {
    const response = await authenticate(request, event);
    if (
      appShell &&
      response &&
      response.status >= 300 &&
      response.status < 400
    ) {
      // Keep the SDK's handoff cookies and URL cleanup for the exact
      // validated report; otherwise retain the app shell's offline resilience.
      if (
        isReportHandshakeCleanup(request.url, response.headers.get("location"))
      )
        return response;
      return NextResponse.next();
    }
    return response;
  } catch (error) {
    if (appShell) return NextResponse.next();
    throw error;
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
