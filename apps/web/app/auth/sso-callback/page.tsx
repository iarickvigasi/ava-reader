import { MissingAuthConfiguration } from "@/components/auth/missing-auth-configuration";
import { SsoCallbackHandler } from "@/components/auth/sso-callback-handler";

import { reportReturnTarget } from "@/features/admin/pdf-reports/auth-return";

export default async function SsoCallbackPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <MissingAuthConfiguration />;
  }

  const params = (await searchParams) ?? {};
  return (
    <SsoCallbackHandler returnTo={reportReturnTarget(params.redirect_url)} />
  );
}
