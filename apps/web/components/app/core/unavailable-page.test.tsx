import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import fr from "@/i18n/messages/fr.json";
import de from "@/i18n/messages/de.json";
import ptBR from "@/i18n/messages/pt-BR.json";
import uk from "@/i18n/messages/uk.json";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { UnavailablePage } from "./unavailable-page";
import { OfflineRouteFallback } from "./offline-route-fallback";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useTransition: () => [false, (callback: () => void) => callback()],
}));
const network = vi.hoisted(() => ({ online: true }));
const actions = vi.hoisted(() => ({
  refresh: vi.fn(),
  click: undefined as (() => void) | undefined,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({
    onClick,
    children,
  }: {
    onClick?: () => void;
    children: React.ReactNode;
  }) => {
    actions.click = onClick;
    return <button>{children}</button>;
  },
  ButtonLink: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: actions.refresh }),
}));
vi.mock("@/features/offline/net/use-network-state", () => ({
  useNetworkState: () => network.online,
}));

const render = (node: React.ReactNode) => renderToStaticMarkup(withIntl(node));

describe("unavailable pages", () => {
  it("shows API unavailability while online, and offline mode when disconnected", () => {
    network.online = true;
    const online = render(
      <OfflineRouteFallback routeKey="home" reason="apiUnavailable" />,
    );
    expect(online).toContain("Service unavailable");
    expect(online).not.toContain("Back online");
    network.online = false;
    const offline = render(
      <OfflineRouteFallback routeKey="home" reason="apiUnavailable" />,
    );
    expect(offline).toContain("Offline mode");
    expect(offline).not.toContain("<button");
  });

  it("keeps a known 404 distinct even when offline", () => {
    network.online = false;
    const html = render(<UnavailablePage kind="notFound" />);
    expect(html).toContain("Page not found");
    expect(html).toContain('href="/app"');
    expect(html).not.toContain("<button");
  });

  it("does not label an unspecified cache miss as a confirmed API outage", () => {
    network.online = true;
    expect(render(<OfflineRouteFallback routeKey="generic" />)).toContain(
      "Unable to load",
    );
  });
});

it.each(Object.entries({ en, es, fr, de, "pt-BR": ptBR, uk }))(
  "renders localized reader recovery and Library/Retry actions in %s",
  (locale, messages) => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <UnavailablePage kind="readerUpgrade" />
      </NextIntlClientProvider>,
    );
    const copy = messages.unavailablePage;
    expect(html).toContain(
      renderToStaticMarkup(<>{copy.readerUpgrade.title}</>),
    );
    expect(html).toContain(
      renderToStaticMarkup(<>{copy.readerUpgrade.body}</>),
    );
    expect(html).toContain(renderToStaticMarkup(<>{copy.retry}</>));
    expect(html).toContain('href="/app/library"');
    expect(html).not.toContain("PDF_READER_UPGRADE_REQUIRED");
  },
);
it("calls the reader retry override while retaining router refresh for other pages", () => {
  actions.refresh.mockClear();
  const retry = vi.fn();
  render(<UnavailablePage kind="readerUpgrade" onRetry={retry} />);
  actions.click?.();
  expect(retry).toHaveBeenCalledOnce();
  expect(actions.refresh).not.toHaveBeenCalled();
  render(<UnavailablePage kind="unavailable" />);
  actions.click?.();
  expect(actions.refresh).toHaveBeenCalledOnce();
});
