import type { ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReaderPanel } from "@/components/app/core/reader-ui-context";
import type { ReadyReaderProps } from "../shared/types";
import { ReadyReaderOverlays } from "./ready-reader-overlays";
const f = vi.hoisted(() => ({
  panel: "preferences" as ReaderPanel,
  close: vi.fn(),
  dismiss: vi.fn(),
  triggerFocus: vi.fn(),
  targetFocus: vi.fn(),
  range: { chapterId: "four", startBlockId: "body", startOffset: 11 },
}));
vi.mock("@/components/app/core/reader-ui-context", () => ({
  useReaderUi: () => ({ activePanel: f.panel, closePanel: f.close }),
}));
vi.mock("../overlays/use-panel-dismiss-focus", () => ({
  usePanelDismissFocus: () => f.dismiss,
}));
vi.mock("../overlays/highlights/highlights-context", () => ({
  useHighlightsContext: () => ({
    highlights: [{ id: "mark", locator: f.range }],
  }),
}));
vi.mock("../overlays/ai-comments/ai-comments-context", () => ({
  useAiCommentsContext: () => ({
    comments: [{ id: "answer", locator: f.range }],
  }),
}));
const select = vi.fn(() => f.targetFocus());
const props = {
  activeChapter: { chapterId: "one" },
  payload: { toc: [], book: {} },
  onSelectChapter: select,
} as unknown as ReadyReaderProps;
type Overlay = {
  onClose: () => void;
  onSelectHighlight?: (id: string) => void;
  onSelectAiComment?: (id: string) => void;
};
const view = () => (ReadyReaderOverlays(props) as ReactElement<Overlay>).props;
beforeEach(() => {
  vi.clearAllMocks();
  f.dismiss.mockImplementation(() => {
    f.close();
    f.triggerFocus();
  });
});
it.each(["preferences", "ai-comments", "highlights", "ai-chats"] as const)(
  "%s close uses explicit popup dismissal",
  (panel) => {
    f.panel = panel;
    view().onClose();
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.triggerFocus).toHaveBeenCalledOnce();
    expect(select).not.toHaveBeenCalled();
  },
);
it.each(["contents", "search", "download", "ai-toolbox"] as const)(
  "%s retains its existing close/focus owner",
  (panel) => {
    f.panel = panel;
    view().onClose();
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.dismiss).not.toHaveBeenCalled();
    expect(f.triggerFocus).not.toHaveBeenCalled();
  },
);
it.each(["highlights", "ai-comments"] as const)(
  "%s destination selection keeps exact target focus instead of popup trigger focus",
  (panel) => {
    f.panel = panel;
    const overlay = view();
    if (panel === "highlights") overlay.onSelectHighlight?.("mark");
    else overlay.onSelectAiComment?.("answer");
    expect(f.close).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledWith("four", {
      blockId: "body",
      textOffset: 11,
    });
    expect(f.targetFocus).toHaveBeenCalledOnce();
    expect(f.dismiss).not.toHaveBeenCalled();
    expect(f.triggerFocus).not.toHaveBeenCalled();
  },
);
