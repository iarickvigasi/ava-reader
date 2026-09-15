import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { useReadingGoal } from "./use-reading-goal";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: false, isSignedIn: false, getToken: async () => null }),
}));

function Goal({ baseline }: { baseline?: number }) {
  const [goal] = useReadingGoal(baseline);
  return <output>{goal}</output>;
}

afterEach(() => vi.unstubAllGlobals());

it("renders the home goal before preferences load", () => {
  expect(renderToStaticMarkup(<Goal baseline={45} />)).toBe("<output>45</output>");
});

it("keeps the server snapshot stable even with a different browser storage value", () => {
  vi.stubGlobal("window", { localStorage: { getItem: () => "30" } });
  expect(renderToStaticMarkup(<Goal baseline={45} />)).toBe("<output>45</output>");
});

it("uses 60 minutes when no home baseline is supplied", () => {
  expect(renderToStaticMarkup(<Goal />)).toBe("<output>60</output>");
});
