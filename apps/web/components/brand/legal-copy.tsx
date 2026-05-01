import { useTranslations } from "next-intl";

export function LegalCopy() {
  const t = useTranslations("legal");
  return (
    <p className="mx-auto max-w-[18rem] text-center text-[0.96rem] leading-6 text-muted">
      {t("agreePrefix")}{" "}
      <span className="font-medium text-copy-strong underline underline-offset-4">
        {t("termsAndPrivacy")}
      </span>
    </p>
  );
}
