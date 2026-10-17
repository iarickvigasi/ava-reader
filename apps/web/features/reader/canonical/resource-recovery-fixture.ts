import { canonicalFixture } from "./fixtures/payload";
import { createResourceRecovery } from "./resource-recovery";
import { windowImage } from "./fixtures/resource";

export const resourceBytes = Buffer.from(windowImage.split(",")[1], "base64");
export const resourceOptions = {
  token: "fixture-token",
  apiBase: "https://api.example.invalid",
};
export function networkResourcePayload() {
  const payload = canonicalFixture();
  payload.resourceUrls = {
    "image-one": "/api/library/pdf-imports/run/resources/image",
  };
  return payload;
}
export function failedResourcePayload() {
  const payload = canonicalFixture();
  payload.resourceRequests = {
    "image-one":
      "https://api.example.invalid/api/library/pdf-imports/run/resources/image",
  };
  payload.resourceUrls = { "image-one": "" };
  payload.resourceFailures = ["image-one"];
  return payload;
}
export function recovery(
  isCurrent: () => boolean = () => true,
  getToken = async () => "fixture-token",
) {
  return createResourceRecovery(failedResourcePayload(), {
    apiBase: resourceOptions.apiBase,
    isCurrent,
    getToken,
  });
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
