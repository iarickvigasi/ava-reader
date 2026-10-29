import type { LinkState } from "./types";
export const EMPTY_LINK: LinkState = {
  snapshot: null,
  pending: null,
  error: "",
};
export function selectedCatalogLink(state: LinkState) {
  return state.pending ? state.pending.link : state.snapshot;
}
