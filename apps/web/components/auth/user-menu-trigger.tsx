import { useTranslations } from "next-intl";
import type { CurrentUserPayload } from "@/lib/api-types/user";
import { cn } from "@/lib/cn";
import { UserAvatarFallback } from "./user-avatar-fallback";

export function UserMenuTrigger({
  currentUser,
  showName,
}: {
  currentUser: CurrentUserPayload | null;
  showName: boolean;
}) {
  const t = useTranslations("nav");
  const authT = useTranslations("auth.device");
  const name = currentUser?.displayName ?? t("userFallbackName");

  return (
    <summary
      aria-label={authT("menu")}
      className={cn(
        "flex cursor-pointer list-none items-center gap-2 transition hover:bg-soft-tone-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong [&::-webkit-details-marker]:hidden",
        showName ? "rounded-control bg-soft-fill py-2 xl:px-3" : "rounded-full",
      )}
    >
      {showName && (
        <span
          className="hidden w-24 min-w-0 truncate text-right text-sm font-semibold text-copy-strong xl:block"
          title={name}
        >
          {name}
        </span>
      )}
      <UserAvatarFallback currentUser={currentUser} />
    </summary>
  );
}
