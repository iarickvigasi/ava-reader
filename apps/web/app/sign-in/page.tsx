import { MissingAuthConfiguration } from "@/components/auth/missing-auth-configuration";
import { SignInFlow } from "@/components/auth/sign-in-flow";

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getNotice(value?: string | string[]) {
  const notice = Array.isArray(value) ? value[0] : value;

  switch (notice) {
    case "oauth_continue":
      return "Complete the sign-in flow to continue.";
    case "oauth_requirements":
      return "Additional account details are required. Continue with email to finish signing in.";
    case "signed_out":
      return "You have been signed out.";
    default:
      return undefined;
  }
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <MissingAuthConfiguration />;
  }

  const params = (await searchParams) ?? {};

  return <SignInFlow initialNotice={getNotice(params.notice)} />;
}
