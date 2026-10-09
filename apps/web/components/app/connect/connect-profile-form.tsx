import { useTranslations } from "next-intl";
import type { CurrentUserPayload } from "@/lib/api-types/user";
import { useConnectProfile } from "@/features/connect/use-connect-profile";
import {
  INTRODUCTION_LIMIT,
  INTRODUCTION_MINIMUM,
  introductionLength,
} from "@/features/connect/introduction";
import { ConnectBookSwitch } from "./connect-book-switch";
import { ConnectProfileActions } from "./connect-profile-actions";
import { ConnectProfilePreview } from "./connect-profile-preview";

export function ConnectProfileForm({ user }: { user: CurrentUserPayload }) {
  const t = useTranslations("connect.profile");
  const model = useConnectProfile(user);
  return (
    <form
      onSubmit={model.submit}
      className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
    >
      <div className="min-w-0 space-y-12">
        <div className="space-y-3">
          <label
            htmlFor="connect-introduction"
            className="block font-ui text-xs leading-4 uppercase tracking-[0.16em] text-muted"
          >
            {t("introduction")}
          </label>
          <textarea
            id="connect-introduction"
            name="introduction"
            required
            rows={3}
            aria-describedby="connect-introduction-limit"
            disabled={!model.ready}
            placeholder={t("placeholder")}
            value={model.values.introduction}
            onChange={(event) => model.setIntroduction(event.target.value)}
            className="block w-full resize-none rounded-control bg-paper px-4 py-3 text-lg leading-7 text-copy-strong outline-none transition focus-visible:ring-2 focus-visible:ring-line-strong"
          />
          <p
            id="connect-introduction-limit"
            className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-muted"
          >
            <span>{t("minimum", { minimum: INTRODUCTION_MINIMUM })}</span>
            <span>
              {t("counter", {
                count: introductionLength(model.values.introduction),
                limit: INTRODUCTION_LIMIT,
              })}
            </span>
          </p>
        </div>
        <ConnectBookSwitch model={model} />
        <ConnectProfileActions model={model} />
      </div>
      <ConnectProfilePreview model={model} />
    </form>
  );
}
