const MAX_COVER_BYTES = 200 * 1024 * 1024;
export async function readCoverResponse(response: Response): Promise<Blob> {
  const mime = response.headers.get("content-type")?.split(";")[0];
  const declared = response.headers.get("content-length");
  if (
    !response.ok ||
    !response.body ||
    !mime ||
    !["image/png", "image/jpeg"].includes(mime) ||
    (declared !== null &&
      (!/^\d+$/.test(declared) || Number(declared) > MAX_COVER_BYTES))
  ) {
    await response.body?.cancel().catch(() => {});
    throw new Error("COVER_UNAVAILABLE");
  }
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const reader = response.body.getReader();
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_COVER_BYTES) {
      await reader.cancel();
      throw new Error("COVER_LIMIT");
    }
    chunks.push(new Uint8Array(value));
  }
  if (!size) throw new Error("COVER_UNAVAILABLE");
  return new Blob(chunks, { type: mime });
}
