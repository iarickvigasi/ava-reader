import { getActiveUserId } from "../../db";

type Artwork = { ratio: number; src: string };
type WarmCover = {
  artwork: Artwork;
  image: HTMLImageElement;
  owner: string | null;
  released: boolean;
};
const MAX_WARM_COVERS = 16;
const covers = new Map<string, WarmCover>();

export function readWarmCover(libraryItemId: string | null) {
  if (!libraryItemId) return null;
  const cover = covers.get(libraryItemId);
  if (!cover || cover.owner !== getActiveUserId()) return null;
  covers.delete(libraryItemId);
  covers.set(libraryItemId, cover);
  return cover.artwork;
}

export function rememberCover(
  libraryItemId: string | null,
  image: HTMLImageElement,
  src: string,
): Artwork | null {
  if (!image.naturalWidth || !image.naturalHeight) return null;
  const artwork = { ratio: image.naturalWidth / image.naturalHeight, src };
  if (!libraryItemId) return artwork;
  const previous = covers.get(libraryItemId);
  if (previous?.artwork.src === src && previous.owner === getActiveUserId())
    return previous.artwork;
  dropCover(libraryItemId);
  covers.set(libraryItemId, {
    artwork,
    image,
    owner: getActiveUserId(),
    released: false,
  });
  if (covers.size > MAX_WARM_COVERS) dropCover(covers.keys().next().value!);
  return artwork;
}

export function releaseCoverUrl(url: string) {
  const cover = [...covers.values()].find((item) => item.artwork.src === url);
  if (cover) cover.released = true;
  else URL.revokeObjectURL(url);
}

export function forgetWarmCover(libraryItemId: string | null) {
  if (libraryItemId) dropCover(libraryItemId);
}

export function clearWarmCover() {
  for (const id of covers.keys()) dropCover(id);
}

function dropCover(id: string) {
  const cover = covers.get(id);
  if (cover?.released) URL.revokeObjectURL(cover.artwork.src);
  covers.delete(id);
}
