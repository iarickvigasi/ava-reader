import Link from "next/link";

export function BookBackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand-fill hover:text-brand-fill-strong"
    >
      {children}
    </Link>
  );
}
