// Test-only helper that wraps a node tree with `NextIntlClientProvider`
// so client components using `useTranslations` can render in vitest. The
// component tests use `renderToStaticMarkup`, which doesn't itself supply
// any provider context; without this wrapper every `useTranslations` call
// throws "context from `NextIntlClientProvider` was not found."
//
// We load the real English message catalogue rather than a stub so the
// rendered output is the same prose the production app shows — assertions
// against translated text stay meaningful.

import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import enMessages from "@/i18n/messages/en.json";

export function withIntl(node: ReactNode): ReactElement {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {node}
    </NextIntlClientProvider>
  );
}
