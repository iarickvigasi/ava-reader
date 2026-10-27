import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Avatar } from "./avatar";

it("keeps initials visible and the image hidden until it loads", () => {
  const markup = renderToStaticMarkup(
    <Avatar src="https://images.test/ada" initials="AR" />,
  );
  expect(markup).toContain("AR");
  expect(markup).toContain("opacity-0");
  expect(markup).not.toContain("opacity-100");
});

it("keeps initials when no photo is available", () => {
  const markup = renderToStaticMarkup(<Avatar src={null} initials="AR" />);
  expect(markup).toContain("AR");
  expect(markup).not.toContain("<img");
});
