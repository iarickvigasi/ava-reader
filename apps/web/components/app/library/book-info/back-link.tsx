import Link from "next/link";

type BackLinkProps = {
  backHref: string;
};

export function BackLink({ backHref }: BackLinkProps) {
  const label = backHref.includes("/collections/")
    ? "Back to Collection"
    : "Back to Library";

  return (
    <Link
      href={backHref}
      className="inline-flex text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand-fill hover:text-brand-fill-strong"
    >
      {label}
    </Link>
  );
}
