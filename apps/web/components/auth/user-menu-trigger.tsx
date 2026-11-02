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
        "flex cursor-pointer list-none items-center gap-2 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong [&::-webkit-details-marker]:hidden",
        showName &&
          "xl:rounded-control xl:bg-soft-fill xl:px-3 xl:py-2 xl:hover:bg-soft-tone-fill",
      )}
    >
      {showName && (
        <span
          className="hidden max-w-48 min-w-0 text-right text-sm font-semibold whitespace-normal text-copy-strong [overflow-wrap:anywhere] xl:block"
          title={name}
        >
          {name}
        </span>
      )}
      <UserAvatarFallback currentUser={currentUser} />
    </summary>
  );
}
