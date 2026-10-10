import { describe, expect, it, vi } from "vitest";
import { stripMeasurementDescriptions } from "./strip-measurement-descriptions";

describe("measurement figure descriptions", () => {
  it("strips the cloned association while retaining description content and layout", () => {
    const removeFigure = vi.fn(),
      removeDescription = vi.fn();
    const figure = {
      getAttribute: () => "caption-id",
      removeAttribute: removeFigure,
    };
    const description = {
      id: "caption-id",
      closest: () => figure,
      removeAttribute: removeDescription,
    };
    const clone = {
      querySelectorAll: () => [description],
    } as unknown as HTMLElement;
    stripMeasurementDescriptions(clone);
    expect(removeFigure).toHaveBeenCalledExactlyOnceWith("aria-describedby");
    expect(removeDescription).toHaveBeenCalledExactlyOnceWith("id");
  });
  it("does not erase an unrelated description association", () => {
    const removeFigure = vi.fn(),
      removeDescription = vi.fn();
    const figure = {
      getAttribute: () => "another-id",
      removeAttribute: removeFigure,
    };
    const description = {
      id: "caption-id",
      closest: () => figure,
      removeAttribute: removeDescription,
    };
    stripMeasurementDescriptions({
      querySelectorAll: () => [description],
    } as unknown as HTMLElement);
    expect(removeFigure).not.toHaveBeenCalled();
    expect(removeDescription).toHaveBeenCalledExactlyOnceWith("id");
  });
});
