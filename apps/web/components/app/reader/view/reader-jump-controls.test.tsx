import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { ReaderNavigationActions } from "../state/reader-navigation-context";
import { ReaderJumpControls } from "./reader-jump-controls";
const holder = vi.hoisted(() => ({
  navigation: null as ReaderNavigationActions | null,
}));
vi.mock("../state/reader-navigation-context", () => ({
  useReaderNavigationActions: () => holder.navigation,
}));
const actions = {
  jump: vi.fn(),
  back: vi.fn(),
  leavePassage: vi.fn(),
  settle: vi.fn(),
};
it("reserves the same controls slot before, during and after the last return", () => {
  const shells: string[] = [];
  for (const [canBack, pending] of [
    [false, false],
    [false, true],
    [true, false],
    [true, true],
    [false, false],
  ]) {
    holder.navigation = { ...actions, canBack, pending, error: null };
    const html = renderToStaticMarkup(<ReaderJumpControls />);
    shells.push(html.match(/^<div[^>]+>/)![0]);
    expect(html).toContain("min-h-12");
    expect(html.includes("Back to previous place")).toBe(canBack);
  }
  expect(new Set(shells).size).toBe(1);
});
it("keeps Back disabled through measured origin recovery and announces the honest status", () => {
  holder.navigation = {
    ...actions,
    canBack: true,
    pending: true,
    error: "Returning to your previous place…",
  };
  const html = renderToStaticMarkup(<ReaderJumpControls />);
  expect(html).toContain('disabled=""');
  expect(html).toContain("Returning to your previous place");
});

it("reserves at least the rendered Back button height plus both vertical paddings", () => {
  holder.navigation = {
    ...actions,
    canBack: true,
    pending: false,
    error: null,
  };
  const html = renderToStaticMarkup(<ReaderJumpControls />);
  const shell = html.match(/^<div[^>]+>/)![0];
  const button = html.match(/<button[^>]+>/)![0];
  const reserved = Number(shell.match(/min-h-(\d+)/)![1]);
  const padding = Number(shell.match(/py-(\d+)/)![1]);
  const buttonHeight = Number(button.match(/min-h-(\d+)/)![1]);
  expect(reserved).toBeGreaterThanOrEqual(buttonHeight + 2 * padding);
});
