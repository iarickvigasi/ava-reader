import { useTranslations } from "next-intl";
import { biographyContent } from "@/features/explore/biography-content";

export function CatalogBiography({ biography }: { biography: string }) {
  const t = useTranslations("explore");
  const content = biographyContent(biography);
  return (
    <section className="max-w-[65ch] space-y-4 font-reader text-lg leading-relaxed text-copy">
      <p className="whitespace-pre-line wrap-anywhere">{content.text}</p>
      {content.sources.map((href, index) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mr-4 text-plum underline"
        >
          {t("source")}
          {content.sources.length > 1 ? ` ${index + 1}` : ""}
        </a>
      ))}
    </section>
  );
}
