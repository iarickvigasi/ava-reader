import Link from "next/link";

type AuthRouteSwitcherProps = {
  prompt: string;
  actionLabel: string;
  href: string;
};

export function AuthRouteSwitcher({
  prompt,
  actionLabel,
  href,
}: AuthRouteSwitcherProps) {
  return (
    <p className="text-base text-copy">
      {prompt}{" "}
      <Link
        href={href}
        className="font-semibold text-ink underline underline-offset-4 transition-colors hover:text-title"
      >
        {actionLabel}
      </Link>
    </p>
  );
}
