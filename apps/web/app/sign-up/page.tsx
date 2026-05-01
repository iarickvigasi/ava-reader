import { getTranslations } from "next-intl/server";
import { MissingAuthConfiguration } from "@/components/auth/missing-auth-configuration";
import { SignUpFlow } from "@/components/auth/sign-up-flow";

type SignUpPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getNoticeKey(value?: string | string[]) {
  const notice = Array.isArray(value) ? value[0] : value;

  switch (notice) {
    case "oauth_continue":
      return "oauthContinue" as const;
    case "oauth_requirements":
      return "oauthRequirements" as const;
    default:
      return undefined;
  }
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <MissingAuthConfiguration />;
  }

  const params = (await searchParams) ?? {};
  const noticeKey = getNoticeKey(params.notice);
  const t = await getTranslations("auth.signUp.notices");
  const initialNotice = noticeKey ? t(noticeKey) : undefined;

  return <SignUpFlow initialNotice={initialNotice} />;
}
