import Link from "next/link";
import { BrandSigilDivider } from "@/components/brand/brand-sigil-divider";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { ScreenContainer } from "@/components/ui/screen-container";
import { ButtonLink } from "@/components/ui/button";

export default function Home() {
  return (
    <ScreenContainer className="justify-between py-14 sm:py-18">
      <div className="flex flex-1 flex-col items-center justify-center gap-12 text-center">
        <div className="flex max-w-sm flex-col items-center gap-8">
          <BrandWordmark variant="stacked" />
          <div className="max-w-[16rem] space-y-3 text-[0.95rem] uppercase tracking-[0.32em] text-muted sm:text-base">
            <p>Investigate deeper</p>
            <p>meaning of books</p>
            <p>without breaking</p>
            <p>focus</p>
          </div>
        </div>

        <BrandSigilDivider />

        <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
          <ButtonLink href="/sign-in" className="flex-1">
            Sign in
          </ButtonLink>
          <ButtonLink
            href="/sign-up"
            variant="soft"
            className="flex-1 hover:border-transparent! hover:bg-brand-fill/12!"
          >
            Create account
          </ButtonLink>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 pb-4 text-center text-[0.68rem] uppercase tracking-[0.42em] text-muted/85">
        <span>2026</span>
        <span className="h-1 w-1 rounded-full bg-line-strong" />
        <Link
          href="/sign-in"
          className="pt-3 text-[0.78rem] normal-case tracking-[0.12em] text-ink transition-colors hover:text-title"
        >
          Begin reading
        </Link>
      </div>
    </ScreenContainer>
  );
}
