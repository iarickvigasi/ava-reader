import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import type { ReadyReaderProps } from "../../shared/types";
import {
  ReaderNavigationContext,
  useReaderNavigationActions,
} from "../../state/reader-navigation-context";
import { BilingualPreparingPage } from "./bilingual-preparing-page";

vi.mock("../../view/ready-reader", () => ({
  ReadyReader: () => {
    const navigation = useReaderNavigationActions();
    return <span>{navigation ? "can-settle-jump" : "preview-only"}</span>;
  },
}));
vi.mock("./bilingual-panes", () => ({
  BilingualPanes: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("../loading/bilingual-page-skeleton", () => ({
  BilingualPageSkeleton: () => <span>Preparing translation</span>,
}));
it("prevents the temporary source preview from settling the final bilingual jump", () => {
  const navigation = {
    jump: vi.fn(),
    back: vi.fn(),
    leavePassage: vi.fn(),
    settle: vi.fn(),
    canBack: false,
    pending: true,
    error: null,
  };
  const html = renderToStaticMarkup(
    <ReaderNavigationContext value={navigation}>
      <BilingualPreparingPage {...({} as ReadyReaderProps)} />
    </ReaderNavigationContext>,
  );
  expect(html).toContain("preview-only");
  expect(html).not.toContain("can-settle-jump");
});
