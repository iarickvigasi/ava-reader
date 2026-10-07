import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ReaderPanelDialog } from "./reader-panel-dialog";
import { PanelTitle } from "./panel-title";
import { MobileCloseButton } from "./mobile-close-button";

it.each([
  ["contents", "Contents"],
  ["search", "Search"],
  ["preferences", "Preferences"],
  ["download", "Download"],
  ["highlights", "Highlights"],
  ["ai-comments", "Saved answers"],
  ["ai-chats", "AI chats"],
  ["ai-toolbox", "Ask AVA"],
] as const)("%s names its dialog from its visible heading", (panel, title) => {
  const html = renderToStaticMarkup(
    <ReaderPanelDialog panel={panel} onClose={() => {}}>
      <PanelTitle>{title}</PanelTitle>
      <button type="button">Close</button>
    </ReaderPanelDialog>,
  );
  expect(html).toContain(`id="reader-panel-${panel}"`);
  expect(html).toContain(`aria-labelledby="reader-panel-${panel}-title"`);
  expect(html).toContain(`id="reader-panel-${panel}-title"`);
  expect(html).toContain(`>${title}</h2>`);
  expect(html).toContain('aria-modal="true"');
  expect(html).not.toContain('aria-label=');
});

it("offers a visible initial dismissal control at both desktop and mobile sizes", () => {
  const html = renderToStaticMarkup(
    <MobileCloseButton ariaLabel="Close preferences" onClose={() => {}} />,
  );
  expect(html).toContain('data-reader-initial-focus="true"');
  expect(html).toContain('aria-label="Close preferences"');
  expect(html).not.toContain("md:hidden");
});
