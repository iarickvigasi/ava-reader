# Reader panels (overview)

> Status: shipped · Updated: 2026-09-02 · ADRs: [[3-offline-first-dexie-buckets]],
> [[2-openrouter-and-byo-key]] · Related: [[2-reader/_overview]], [[4-offline/_overview]] · Code:
> apps/web/components/app/reader/overlays, apps/web/features/offline/buckets/{highlights,ai-comments}

## Summary
What the reader opens *over* the page: the panels and overlays a reader reaches while reading —
saving highlights, running AI tools on a selection, revisiting persisted AI comments, and adjusting
how the text is set. The reading surface itself is [[2-reader/_overview]]; these are the tools laid
on top of it. Split by subsystem, like [[2-reader/_overview]].

## Sub-specs
- 5.1 highlights — color-coded saved selections, painted in-text and listed in a panel.
- 5.2 ai-toolbox — on-selection AI tools (translate, explain, etymology) streaming in place.
- 5.3 ai-comments — persisted AI annotations anchored to passages, with their panel.
- 5.4 preferences — reading + language settings and the theme override.

## Shared model
- **Selection in, panel out.** Every panel here starts from a reader selection and ends as a panel
  row. The selection itself is not theirs: the reader produces a `ReaderRangeLocator`
  ([[2.4-locators]], [[2.6-selection-bridge]]) and these specs consume it. Locator internals,
  anchoring and repair belong to the reader, never here.
- **Selection context** — the sentences surrounding a selection plus book metadata, captured at
  enqueue time so an offline request replays with the same context it was created from. Shared by
  5.2 and 5.3.
- **Each panel owns a bucket.** Highlights and AI comments are offline-first
  ([[3-offline-first-dexie-buckets]]): local writes land in Dexie with a mutation queue and flush on
  reconnect ([[4-offline/_overview]], Local truth). Preferences ride the `me` bucket. A panel never
  fetches its own data raw.
- **Panels are peers.** They share the reader's overlay chrome and are mutually exclusive on screen;
  none may assume another is open or drive another's state.
