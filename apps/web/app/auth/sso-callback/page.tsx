import { MissingAuthConfiguration } from "@/components/auth/missing-auth-configuration";
import { SsoCallbackHandler } from "@/components/auth/sso-callback-handler";

export default function SsoCallbackPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <MissingAuthConfiguration />;
  }

  return <SsoCallbackHandler />;
}
