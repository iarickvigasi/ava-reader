import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

// Offline-first route protection (see docs/specs/10-auth.md, edge cases).
//
// `auth.protect()` would redirect whenever the session token can't be
// verified — including when it merely couldn't *refresh* because Clerk's
// cloud is unreachable (wifi drop against a reachable dev server, or a Clerk
// outage in prod). That redirect strands the tab on a dead host. Instead:
// - verified user → through.
// - unverified but a `__session*` cookie exists (a previously signed-in user
//   with a stale token) → let the shell through. Pages render from the
//   offline buckets, and the API independently verifies every bearer token,
//   so serving the shell exposes nothing sensitive.
// - no session cookie at all → the local sign-in page (same-origin via
//   NEXT_PUBLIC_CLERK_SIGN_IN_URL, never the hosted Account Portal).
export default clerkMiddleware(async (auth, req) => {
  if (!isProtectedRoute(req)) {
    return;
  }
  const hasSessionCookie = req.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("__session"));

  let userId: string | null = null;
  let redirectToSignIn: Awaited<ReturnType<typeof auth>>["redirectToSignIn"] | null = null;
  try {
    ({ userId, redirectToSignIn } = await auth());
  } catch {
    // Clerk unreachable (offline JWKS fetch). Can't verify — fall back to
    // cookie presence: a returning user keeps the shell, a stranger goes to
    // the local sign-in.
    return hasSessionCookie
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/sign-in", req.url));
  }

  if (userId) {
    return;
  }
  if (hasSessionCookie) {
    return NextResponse.next();
  }
  return redirectToSignIn({ returnBackUrl: req.url });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
