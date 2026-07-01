import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";

export function MissingAuthConfiguration() {
  const t = useTranslations("auth.misconfigured");
  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={<ButtonLink href="/">{t("returnToSplash")}</ButtonLink>}
    >
      <div className="rounded-card bg-white/68 p-5 text-left">
        <p className="text-sm uppercase tracking-[0.22em] text-muted">
          {t("requiredVarsLabel")}
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-paper px-4 py-4 text-sm text-copy">
          {`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=\nCLERK_SECRET_KEY=\nNEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in\nNEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`}
        </pre>
      </div>
    </AuthShell>
  );
}
