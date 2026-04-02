import { MissingAuthConfiguration } from "@/components/auth/missing-auth-configuration";
import { SignUpFlow } from "@/components/auth/sign-up-flow";

type SignUpPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getNotice(value?: string | string[]) {
  const notice = Array.isArray(value) ? value[0] : value;

  switch (notice) {
    case "oauth_continue":
      return "Continue creating your account to start reading.";
    case "oauth_requirements":
      return "A bit more account information is needed before we can finish sign-up.";
    default:
      return undefined;
  }
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <MissingAuthConfiguration />;
  }

  const params = (await searchParams) ?? {};

  return <SignUpFlow initialNotice={getNotice(params.notice)} />;
}
