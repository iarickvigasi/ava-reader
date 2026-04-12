import { ButtonLink } from "@/components/ui/button";

type LibraryPlaceholderPageProps = {
  ctaHref?: string;
  ctaLabel?: string;
  eyebrow: string;
  title: string;
  body: string;
};

export function LibraryPlaceholderPage({
  body,
  ctaHref = "/app",
  ctaLabel = "Back to Home",
  eyebrow,
  title,
}: LibraryPlaceholderPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
      <section className="w-full rounded-[28px] bg-surface px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-2xl space-y-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">
            {eyebrow}
          </p>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">{title}</h1>
          <p className="text-lg leading-8 text-copy">{body}</p>
          <ButtonLink href={ctaHref} className="mt-2">
            {ctaLabel}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
