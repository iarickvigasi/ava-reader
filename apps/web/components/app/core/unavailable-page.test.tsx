import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { UnavailablePage } from "./unavailable-page";
import { OfflineRouteFallback } from "./offline-route-fallback";

const network = vi.hoisted(() => ({ online: true }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/offline/net/use-network-state", () => ({ useNetworkState: () => network.online }));

const render = (node: React.ReactNode) => renderToStaticMarkup(withIntl(node));

describe("unavailable pages", () => {
  it("shows API unavailability while online, and offline mode when disconnected", () => {
    network.online = true;
    const online = render(<OfflineRouteFallback routeKey="home" reason="apiUnavailable" />);
    expect(online).toContain("Service unavailable");
    expect(online).not.toContain("Back online");
    network.online = false;
    const offline = render(<OfflineRouteFallback routeKey="home" reason="apiUnavailable" />);
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
    expect(render(<OfflineRouteFallback routeKey="generic" />)).toContain("Unable to load");
  });
});
